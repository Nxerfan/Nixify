import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";
import { peekUsage, getUserPlan } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/cleanup — prune old log/event rows based on the admin's
 * AUDIT_LOG_RETENTION entitlement. Called by Vercel Cron or manually.
 *
 * This endpoint enforces the audit_log_retention entitlement by deleting
 * rows older than the plan's retention window.
 */
export async function POST() {
  const admin = await getAdmin();
  if (!admin) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }

  // Entitlement: get the retention days for this plan.
  const plan = await getUserPlan(Number(admin.sub));
  const retention = await peekUsage(Number(admin.sub), FEATURE_KEYS.AUDIT_LOG_RETENTION);
  const retentionDays = retention.quota === "unlimited" ? 365 : retention.quota || 90;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const results = {
    plan,
    retentionDays,
    cutoff: cutoff.toISOString(),
    deleted: {
      rateLimitBuckets: 0,
      deviceRequests: 0,
      otpCodes: 0,
      otpEvents: 0,
      requestLogs: 0,
      webhookDeliveries: 0,
      securityEvents: 0,
    },
  };

  // Prune each table.
  results.deleted.rateLimitBuckets = (await db.rateLimitBucket.deleteMany({
    where: { windowStart: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
  })).count;

  results.deleted.deviceRequests = (await db.deviceRequest.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })).count;

  results.deleted.otpCodes = (await db.otpCode.deleteMany({
    where: { createdAt: { lt: cutoff }, consumedAt: { not: null } },
  })).count;

  results.deleted.otpEvents = (await db.otpEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })).count;

  results.deleted.requestLogs = (await db.requestLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })).count;

  results.deleted.webhookDeliveries = (await db.webhookDelivery.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })).count;

  results.deleted.securityEvents = (await db.securityEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })).count;

  return apiOk(results);
}
