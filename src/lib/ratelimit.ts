import { db } from "@/lib/db";

/**
 * Database-backed rate limiting (§8.6 / §13 — no in-memory state).
 *
 * Each bucket is keyed by a string like "otp_send:user@example.com". We keep a
 * counter and a window-start timestamp. On each hit we:
 *   - if the current window is older than the window size, reset it (count=1)
 *   - otherwise increment the count
 *   - reject if count exceeds the limit
 *
 * Because this lives in Postgres/SQLite, it survives across stateless Vercel
 * function invocations. The check-and-increment is wrapped in a transaction so
 * concurrent requests can't all read the same pre-increment count.
 */

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  /** Seconds until the current window resets (0 if allowed and you want to send). */
  retryAfterSeconds: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  return db.$transaction(async (tx) => {
    const existing = await tx.rateLimitBucket.findUnique({ where: { key } });

    if (!existing) {
      await tx.rateLimitBucket.create({
        data: { key, count: 1, windowStart: now },
      });
      return { allowed: true, count: 1, limit, retryAfterSeconds: 0 };
    }

    // If the stored window started before our sliding window cutoff, reset it.
    if (existing.windowStart < windowStart) {
      await tx.rateLimitBucket.update({
        where: { key },
        data: { count: 1, windowStart: now },
      });
      return { allowed: true, count: 1, limit, retryAfterSeconds: 0 };
    }

    const nextCount = existing.count + 1;
    const allowed = nextCount <= limit;
    await tx.rateLimitBucket.update({
      where: { key },
      data: { count: nextCount },
    });

    const retryAfterSeconds = allowed
      ? 0
      : Math.ceil((existing.windowStart.getTime() + windowMs - now.getTime()) / 1000);

    return { allowed, count: nextCount, limit, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  });
}

/** Check a limit without consuming a slot (useful for pre-flight checks). */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);
  const existing = await db.rateLimitBucket.findUnique({ where: { key } });

  if (!existing || existing.windowStart < windowStart) {
    return { allowed: true, count: 0, limit, retryAfterSeconds: 0 };
  }
  const allowed = existing.count < limit;
  const retryAfterSeconds = allowed
    ? 0
    : Math.ceil((existing.windowStart.getTime() + windowMs - now.getTime()) / 1000);
  return { allowed, count: existing.count, limit, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
}

// ---- Named helpers for the OTP flow (§8.6) -------------------------------

export const RATE_LIMITS = {
  OTP_SEND_PER_MIN: 3,
  OTP_SEND_PER_HOUR: 10,
  OTP_VERIFY_PER_MIN: 5,
} as const;

/** OTP send: 3/min and 10/hour per email. Returns the first failing limit. */
export async function enforceOtpSendLimits(email: string): Promise<RateLimitResult> {
  const perMin = await rateLimit(`otp_send_min:${email}`, RATE_LIMITS.OTP_SEND_PER_MIN, 60_000);
  if (!perMin.allowed) return perMin;
  const perHour = await rateLimit(`otp_send_hour:${email}`, RATE_LIMITS.OTP_SEND_PER_HOUR, 3_600_000);
  return perHour;
}

/** OTP verify: 5/min per email. */
export async function enforceOtpVerifyLimits(email: string): Promise<RateLimitResult> {
  return rateLimit(`otp_verify_min:${email}`, RATE_LIMITS.OTP_VERIFY_PER_MIN, 60_000);
}
