import { createHash, randomBytes, randomUUID } from "crypto";
import { db } from "@/lib/db";

/**
 * API key generation, hashing, and verification.
 *
 * Key format: `mg_live_<24 chars>` (production) or `mg_test_<24 chars>` (development).
 * The full key is shown ONCE at creation; we store only SHA-256(key).
 * The first 12 chars (prefix) are stored for display so admins can identify
 * keys without the secret.
 */

export interface CreatedApiKey {
  id: number;
  key: string; // full key — shown ONCE
  prefix: string;
  name: string;
  environment: string;
  scopes: string;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyRecord {
  id: number;
  prefix: string;
  name: string;
  environment: string;
  scopes: string;
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/** Generate a new API key + persist its hash. Returns the full key ONCE. */
export async function createApiKey(opts: {
  name: string;
  environment: "development" | "production";
  scopes?: string; // default "full"
  expiresAt?: Date | null;
  createdBy?: string;
  userId?: number | null; // owner scope (null = admin-managed system key)
}): Promise<CreatedApiKey> {
  const env = opts.environment;
  const prefixEnv = env === "production" ? "mg_live_" : "mg_test_";
  const secret = randomBytes(18).toString("base64url"); // ~24 url-safe chars
  const fullKey = prefixEnv + secret;
  const keyHash = hashKey(fullKey);
  const prefix = fullKey.slice(0, 12); // "mg_live_XXXX" for display

  const created = await db.apiKey.create({
    data: {
      keyHash,
      prefix,
      name: opts.name,
      environment: env,
      scopes: opts.scopes ?? "full",
      expiresAt: opts.expiresAt ?? null,
      createdBy: opts.createdBy ?? null,
      userId: opts.userId ?? null,
    },
  });

  return {
    id: created.id,
    key: fullKey,
    prefix,
    name: created.name,
    environment: created.environment,
    scopes: created.scopes,
    expiresAt: created.expiresAt,
    createdAt: created.createdAt,
  };
}

/** Hash a full API key for storage/lookup. SHA-256. */
export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export interface VerifiedKey {
  ok: boolean;
  keyId?: number;
  /** Owning user id (resolved at verify time). `null` for system/admin-managed keys. */
  userId?: number | null;
  environment?: string;
  scopes?: string;
  reason?: "not_found" | "revoked" | "expired" | "invalid_format";
}

/** Verify an API key (from the Authorization header). Updates lastUsedAt. */
export async function verifyApiKey(rawKey: string, ip?: string): Promise<VerifiedKey> {
  if (!rawKey || (!rawKey.startsWith("mg_live_") && !rawKey.startsWith("mg_test_"))) {
    return { ok: false, reason: "invalid_format" };
  }
  const keyHash = hashKey(rawKey);
  const record = await db.apiKey.findUnique({ where: { keyHash } });
  if (!record) return { ok: false, reason: "not_found" };
  if (record.revokedAt) return { ok: false, reason: "revoked" };
  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }
  // Update last-used (best-effort, non-blocking).
  db.apiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date(), lastUsedIp: ip ?? null },
  }).catch(() => {});
  return {
    ok: true,
    keyId: record.id,
    userId: record.userId,
    environment: record.environment,
    scopes: record.scopes,
  };
}

/** Check whether a key's scopes permit an action. */
export function hasScope(scopes: string, action: string): boolean {
  if (scopes === "full") return true;
  if (scopes === "read_only") return false;
  return scopes.split(",").map((s) => s.trim()).includes(action);
}

/** List all API keys (for management dashboard). Never returns the hash.
 *  If `userId` is provided, only keys owned by that user are returned.
 *  If `includeSystem` is true (admin), system keys (userId=null) are also included. */
export async function listApiKeys(opts?: {
  userId?: number;
  includeSystem?: boolean;
}): Promise<ApiKeyRecord[]> {
  const where = opts?.userId
    ? opts.includeSystem
      ? { OR: [{ userId: opts.userId }, { userId: null }] }
      : { userId: opts.userId }
    : undefined;
  const keys = await db.apiKey.findMany({ where, orderBy: { createdAt: "desc" } });
  return keys.map((k) => ({
    id: k.id, prefix: k.prefix, name: k.name, environment: k.environment,
    scopes: k.scopes, lastUsedAt: k.lastUsedAt, lastUsedIp: k.lastUsedIp,
    expiresAt: k.expiresAt, revokedAt: k.revokedAt, createdAt: k.createdAt,
  }));
}

/** Revoke an API key (soft delete — keyHash retained for audit). */
export async function revokeApiKey(id: number): Promise<void> {
  await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
}

/** Generate a new request ID (UUID v4). */
export function newRequestId(): string {
  return randomUUID();
}
