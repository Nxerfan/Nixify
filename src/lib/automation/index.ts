/**
 * Automation public API (Phase 5).
 */
import type { OtpVerifiedPayload } from "./processor";

export {
  enqueueJob,
  claimJobs,
  recoverStaleLocks,
  completeJob,
  failJob,
  retryJob,
  isTransientError,
  STALE_LOCK_TIMEOUT_MS,
  MAX_BATCH_SIZE,
  BACKOFF_BASE_MS,
  type JobType,
  type JobStatus,
  type EnqueueInput,
  type QueuedJob,
} from "./queue";

export {
  getAutomationSetting,
  upsertAutomationSetting,
  AutomationConfigError,
  AUTOMATION_TYPE_OTP_VERIFIED_WELCOME,
  BUILT_IN_VARIABLES,
  type AutomationConfigRow,
} from "./service";

export { processOtpVerifiedJob, type OtpVerifiedPayload } from "./processor";

/**
 * Convenience: enqueue the otp_verified orchestration job after successful
 * OTP verification. Fire-and-forget — never throws (OTP success must not
 * depend on this). Uses dedupeKey = "otp_verified:<otpCodeId>" for idempotency.
 */
export async function enqueueOtpVerifiedJob(payload: OtpVerifiedPayload): Promise<void> {
  const { enqueueJob } = await import("./queue");
  try {
    await enqueueJob({
      userId: payload.userId,
      type: "otp_verified",
      payload: payload as unknown as Record<string, unknown>,
      dedupeKey: `otp_verified:${payload.otpCodeId}`,
    });
  } catch {
    // Fire-and-forget. OTP verification success MUST NOT depend on this.
  }
}
