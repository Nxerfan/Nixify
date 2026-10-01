import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { z } from "zod";
import { parseBody } from "@/lib/http";
import { createOrDetectOnboardingApiKey } from "@/lib/onboarding/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(100).default("Onboarding key"),
});

/**
 * POST /api/onboarding/create-key
 * Authenticated — creates a sandbox (mg_test_) API key for the user during
 * onboarding, OR detects that a usable sandbox key already exists.
 *
 * Blocker 3: a usable key is owned, not revoked, not expired,
 * environment=development, and authorized for otp:send + otp:verify.
 *
 * Blocker 4: quota_exhausted is handled correctly (not limit_reached).
 *
 * Blocker 5: if the quota is occupied by an unusable key, returns
 * quotaOccupiedUnusable so the UI can direct the user to /dashboard/api-keys.
 *
 * Returns the full key ONCE (never persisted in new storage).
 */
export async function POST(req: NextRequest) {
  const { getAuthenticatedUser } = await import("@/lib/auth/session");
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Sign in required.", 401);
  }
  const [data, err] = await parseBody(req as any, createSchema);
  if (err) return err;

  const result = await createOrDetectOnboardingApiKey(user.id, data.name);

  if (result.created) {
    return apiOk(
      {
        key: result.created.key,
        prefix: result.created.prefix,
        id: result.created.id,
        name: result.created.name,
        environment: result.created.environment,
        progress: result.progress,
      },
      201,
    );
  }
  if (result.existingUsable) {
    return apiOk({ existingUsable: true, progress: result.progress });
  }
  if (result.quotaOccupiedUnusable) {
    // Blocker 5: quota occupied by an unusable key. Return a 402 with a
    // structured response so the UI can show an actionable message + link.
    return apiError(
      ERROR_CODES.FORBIDDEN,
      "API key quota occupied by an unusable key. Manage your keys to continue.",
      402,
    );
  }

  // Should never reach here.
  return apiError(ERROR_CODES.INTERNAL, "Unexpected onboarding key result.", 500);
}
