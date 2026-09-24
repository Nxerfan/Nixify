import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { z } from "zod";
import { parseBody } from "@/lib/http";
import {
  createOnboardingApiKey,
  markStepComplete,
} from "@/lib/onboarding/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(100).default("Onboarding key"),
});

/**
 * POST /api/onboarding/create-key
 * Authenticated — creates a sandbox (mg_test_) API key for the user during
 * onboarding. Uses the existing entitlement quota enforcement.
 *
 * Returns the full key ONCE. If the user already has a non-revoked key,
 * returns `{ existing: true }` (no new key created — the user continues
 * with their existing key; we never expose an existing secret).
 *
 * @throws 402 if the plan quota is exhausted.
 */
export async function POST(req: NextRequest) {
  const { getAuthenticatedUser } = await import("@/lib/auth/session");
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Sign in required.", 401);
  }
  const [data, err] = await parseBody(req as any, createSchema);
  if (err) return err;

  try {
    const created = await createOnboardingApiKey(user.id, data.name);
    if (created === null) {
      // User already has a non-revoked key — let them continue.
      // Mark the step complete (the existing key satisfies the precondition).
      const progress = await markStepComplete(user.id, "apiKeyCreated");
      return apiOk({ existing: true, progress });
    }
    // Key created — mark the step complete.
    const progress = await markStepComplete(user.id, "apiKeyCreated");
    return apiOk(
      {
        key: created.key,
        prefix: created.prefix,
        id: created.id,
        name: created.name,
        environment: created.environment,
        progress,
      },
      201,
    );
  } catch (e) {
    const reason = (e as { reason?: string }).reason;
    if (reason === "not_available_on_plan" || reason === "limit_reached") {
      return apiError(
        ERROR_CODES.FORBIDDEN,
        "API key limit reached. Revoke unused keys or upgrade your plan.",
        402,
      );
    }
    throw e;
  }
}
