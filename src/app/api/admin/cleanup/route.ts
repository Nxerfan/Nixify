import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";
import { FEATURE_LIMITS, FEATURE_KEYS, type Plan } from "@/lib/entitlements/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN_GROUPS: Plan[] = ["FREE", "PRO", "MAX"];

/**
 * POST /api/admin/cleanup — prune old log/event rows.
 *
 * Called manually by an admin (no Vercel Cron is configured — vercel.json is
 * `{}`). This endpoint enforces per-plan audit-log retention WITHOUT touching
 * other tenants' data: tenant-owned rows (OtpCode, OtpEvent, RequestLog,
 * WebhookDelivery) are deleted only after being grouped by their owner's plan
 * and only when older than that plan's retention window.
 *
 * Tenant-owned tables are deleted using `userId: { in: [...userIdsOnPlan] }`
 * (or via the WebhookEndpoint relation for WebhookDelivery). This is the
 * critical data-safety property: a FREE plan cutoff (7 days) can NEVER delete
 * a MAX plan user's 365-day-old logs.
 *
 * System/global tables that have no `userId` (DeviceRequest, SecurityEvent)
 * are NOT deleted by this route — their TTL is not plan-dependent and removing
 * them according to an arbitrary tenant's retention would be unsafe.
 * RateLimitBucket is the one exception: its 2-hour self-expiry is independent
 * of any plan, so it is safe to prune by absolute age.
 *
 * AdminUser has no plan and no entitlements — we MUST NOT call getUserPlan() or
 * peekUsage() with the admin's id (they describe a different model: User).
 */
export async function POST() {
  const admin = await getAdmin();
  if (!admin) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }

  // Resolve per-plan retention windows and the user ids on each plan.
  // FEATURE_LIMITS is the single source of truth for quotas.
  const retentionByPlan = new Map<Plan, number>();
  const userIdsByPlan = new Map<Plan, number[]>();

  for (const plan of PLAN_GROUPS) {
    const limit = FEATURE_LIMITS[FEATURE_KEYS.AUDIT_LOG_RETENTION][plan];
    // quota represents days for AUDIT_LOG_RETENTION (TTL feature, not a counter).
    const days = limit.quota === Infinity ? 365 : Number(limit.quota) || 90;
    retentionByPlan.set(plan, days);

    const users = await db.user.findMany({
      where: { plan },
      select: { id: true },
    });
    userIdsByPlan.set(plan, users.map((u) => u.id));
  }

  const results = {
    retentionByPlan: Object.fromEntries(retentionByPlan),
    deleted: {
      rateLimitBuckets: 0,
      otpCodes: 0,
      otpEvents: 0,
      requestLogs: 0,
      webhookDeliveries: 0,
    },
    skipped: [
      "DeviceRequest (no userId — not plan-scoped; left to dedicated TTL process)",
      "SecurityEvent (no userId — global security audit; not plan-scoped)",
    ],
  };

  // RateLimitBucket — short-lived (2h) TTL, independent of any plan.
  results.deleted.rateLimitBuckets = (
    await db.rateLimitBucket.deleteMany({
      where: { windowStart: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
    })
  ).count;

  const now = Date.now();

  // Per-plan deletion for tenant-owned tables. The cutoff is computed from
  // THIS plan's retention, and the WHERE clause is constrained to users on
  // THIS plan. A FREE plan cutoff (7d) cannot affect MAX plan rows.
  for (const plan of PLAN_GROUPS) {
    const days = retentionByPlan.get(plan)!;
    const userIds = userIdsByPlan.get(plan)!;
    if (userIds.length === 0) continue;
    const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);

    // OtpCode — consumed OTP rows (consumedAt IS NOT NULL) older than retention.
    // Unconsumed rows (consumedAt IS NULL) are preserved so in-flight verifies
    // are not broken by cleanup.
    results.deleted.otpCodes += (
      await db.otpCode.deleteMany({
        where: {
          createdAt: { lt: cutoff },
          consumedAt: { not: null },
          userId: { in: userIds },
        },
      })
    ).count;

    // OtpEvent — analytics log rows older than retention.
    results.deleted.otpEvents += (
      await db.otpEvent.deleteMany({
        where: {
          createdAt: { lt: cutoff },
          userId: { in: userIds },
        },
      })
    ).count;

    // RequestLog — v1 API request logs older than retention.
    results.deleted.requestLogs += (
      await db.requestLog.deleteMany({
        where: {
          createdAt: { lt: cutoff },
          userId: { in: userIds },
        },
      })
    ).count;

    // WebhookDelivery — delivery records for endpoints owned by users on
    // this plan. Joined through the WebhookEndpoint relation (WebhookDelivery
    // itself has no userId column).
    results.deleted.webhookDeliveries += (
      await db.webhookDelivery.deleteMany({
        where: {
          createdAt: { lt: cutoff },
          endpoint: { userId: { in: userIds } },
        },
      })
    ).count;
  }

  return apiOk(results);
}
