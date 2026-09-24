import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { z } from "zod";
import { parseBody } from "@/lib/http";
import { markStepComplete, ONBOARDING_STEPS } from "@/lib/onboarding/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stepEnum = z.enum(ONBOARDING_STEPS);
const schema = z.object({ step: stepEnum });

/**
 * POST /api/onboarding/mark-step
 * Authenticated — marks a step as complete (explicit).
 *
 * The reconcile in getOnboardingProgress will still verify the real state on
 * the next fetch, so calling this with a false positive (e.g. marking otpSent
 * when no OTP row exists) will self-heal — the real-state check overrides the
 * cached flag if it drifted ahead.
 *
 * The client calls this AFTER a successful sandbox send/verify to immediately
 * update the cached flag without waiting for the next reconcile.
 */
export async function POST(req: NextRequest) {
  const { getAuthenticatedUser } = await import("@/lib/auth/session");
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Sign in required.", 401);
  }
  const [data, err] = await parseBody(req as any, schema);
  if (err) return err;
  const progress = await markStepComplete(user.id, data.step);
  return apiOk({ progress });
}
