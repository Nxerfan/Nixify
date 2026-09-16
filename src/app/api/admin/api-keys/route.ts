import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { getAdmin } from "@/lib/auth/admin";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "@/lib/dx/api-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * API key management — admin OR authenticated user. The full key is returned
 * ONCE on creation; we only ever store + display the SHA-256 hash + display
 * prefix. Keys are scoped by userId: a user sees only their own keys; admin
 * sees all keys (including system keys with userId=null).
 */

/** Resolve the requester for API key routes. Admin OR any authenticated user. */
async function resolveRequester(): Promise<
  | { ok: true; mode: "admin"; adminEmail: string; userId: number }
  | { ok: true; mode: "user"; userId: number }
  | { ok: false; status: number; code: typeof ERROR_CODES.UNAUTHORIZED; message: string }
> {
  const admin = await getAdmin();
  if (admin) {
    return { ok: true, mode: "admin", adminEmail: admin.email, userId: Number(admin.sub) };
  }
  const user = await getAuthenticatedUser();
  if (!user) {
    return { ok: false, status: 401, code: ERROR_CODES.UNAUTHORIZED, message: "Login required." };
  }
  return { ok: true, mode: "user", userId: user.id };
}

/** GET /api/admin/api-keys — list keys (hashes never included).
 *  Admin sees all keys; user sees only their own keys. */
export async function GET() {
  const auth = await resolveRequester();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  const keys = auth.mode === "admin"
    ? await listApiKeys({ includeSystem: true })
    : await listApiKeys({ userId: auth.userId });

  return apiOk({
    keys: keys.map((k) => ({
      id: k.id,
      prefix: k.prefix,
      name: k.name,
      environment: k.environment,
      scopes: k.scopes,
      lastUsedAt: k.lastUsedAt,
      lastUsedIp: k.lastUsedIp,
      expiresAt: k.expiresAt,
      revokedAt: k.revokedAt,
      createdAt: k.createdAt,
      isRevoked: k.revokedAt !== null,
      isExpired: k.expiresAt !== null && k.expiresAt.getTime() <= Date.now(),
    })),
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  environment: z.enum(["development", "production"]),
  scopes: z.string().trim().max(200).optional(),
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .transform((v) => (v ? new Date(v) : null))
    .nullable()
    .optional(),
});

/** POST /api/admin/api-keys — create a key. Returns the FULL key ONCE. */
export async function POST(req: NextRequest) {
  const auth = await resolveRequester();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  const [data, err] = await parseBody(req, createSchema);
  if (err) return err;

  // Entitlement: resource cardinality check (NOT consumable usage).
  // API_KEYS is a resource-count limit, not a monthly quota. Revoked keys
  // do NOT consume a slot. This uses a concurrency-safe transaction with
  // a row lock to prevent over-allocation.
  const { createResourceWithCapacity } = await import("@/lib/entitlements/resource-capacity");
  const { FEATURE_KEYS: FK } = await import("@/lib/entitlements/config");

  try {
    const created = await createResourceWithCapacity(
      auth.userId,
      FK.API_KEYS,
      async (tx) => {
        // Create the API key using the SAME transaction client.
        const env = data.environment;
        const prefixEnv = env === "production" ? "mg_live_" : "mg_test_";
        const { randomBytes, createHash } = await import("crypto");
        const secret = randomBytes(18).toString("base64url");
        const fullKey = prefixEnv + secret;
        const keyHash = createHash("sha256").update(fullKey).digest("hex");
        const prefix = fullKey.slice(0, 12);

        const row = await tx.apiKey.create({
          data: {
            keyHash,
            prefix,
            name: data.name,
            environment: env,
            scopes: data.scopes ?? "full",
            expiresAt: data.expiresAt ?? null,
            userId: auth.userId,
          },
        });

        return {
          id: row.id,
          key: fullKey,
          prefix: row.prefix,
          name: row.name,
          environment: row.environment,
          scopes: row.scopes,
          expiresAt: row.expiresAt,
          createdAt: row.createdAt,
        };
      },
    );
    // The full `key` is shown ONCE here. Front-end must persist it locally.
    return apiOk(
      {
        id: created.id,
        key: created.key,
        prefix: created.prefix,
        name: created.name,
        environment: created.environment,
        scopes: created.scopes,
        expiresAt: created.expiresAt,
        createdAt: created.createdAt,
      },
      201,
    );
  } catch (e: any) {
    if (e?.reason === "quota_exhausted" || e?.message?.includes("Resource limit reached")) {
      return apiError(ERROR_CODES.FORBIDDEN, "API key limit reached. Revoke unused keys or upgrade.", 402);
    }
    if (e?.reason === "not_available_on_plan" || e?.message?.includes("not available on your plan")) {
      return apiError(ERROR_CODES.FORBIDDEN, "API keys are not available on your plan.", 403);
    }
    return apiError(
      ERROR_CODES.INTERNAL,
      e instanceof Error ? e.message : "Failed to create API key",
      500,
    );
  }
}

/** DELETE /api/admin/api-keys?id=123 — revoke a key by id (soft delete).
 *  Admin can revoke any key; user can revoke only their own keys. */
export async function DELETE(req: NextRequest) {
  const auth = await resolveRequester();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  const url = new URL(req.url);
  const idRaw = url.searchParams.get("id");
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Missing or invalid ?id=", 400);
  }

  // Ownership check: load the key and verify the user owns it (admin bypasses).
  if (auth.mode === "user") {
    const keys = await listApiKeys({ userId: auth.userId });
    if (!keys.some((k) => k.id === id)) {
      return apiError(ERROR_CODES.NOT_FOUND, "API key not found.", 404);
    }
  }

  try {
    await revokeApiKey(id);
  } catch {
    return apiError(ERROR_CODES.NOT_FOUND, "API key not found.", 404);
  }
  return apiOk({ message: `API key ${id} revoked.` });
}
