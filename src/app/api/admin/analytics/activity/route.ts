import { db } from "@/lib/db";
import { apiOk, apiError } from "@/lib/api-response";
import { resolveAnalyticsRequester } from "@/lib/analytics-auth";
import { maskEmail, resolveRange, type TimeRange } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/analytics/activity
 * Query params:
 *   page, pageSize, range, from, to, email, requestId, status, eventType, search
 *
 * Returns a paginated, filtered activity feed. Emails are masked.
 * Access: admin (all data) OR PRO+/MAX user (own data only). FREE → 403.
 */
export async function GET(req: Request) {
  const auth = await resolveAnalyticsRequester();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(250, Math.max(1, Number(url.searchParams.get("pageSize") ?? "50")));
  const range = (url.searchParams.get("range") ?? "7d") as TimeRange;
  const dateRange = resolveRange(range, url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined);
  const email = url.searchParams.get("email")?.trim() || undefined;
  const requestId = url.searchParams.get("requestId")?.trim() || undefined;
  const status = url.searchParams.get("status")?.trim() || undefined;
  const eventType = url.searchParams.get("eventType")?.trim() || undefined;
  const search = url.searchParams.get("search")?.trim() || undefined;

  // Entitlement: enforce audit log retention at read-time.
  const { peekUsage } = await import("@/lib/entitlements/engine");
  const { FEATURE_KEYS: FK } = await import("@/lib/entitlements/config");
  const actingUserId = auth.userId ?? 0;
  const retention = await peekUsage(actingUserId, FK.AUDIT_LOG_RETENTION);
  const retentionDays = retention.quota === "unlimited" ? 365 : retention.quota || 90;
  const retentionCutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // Use the later of (retention cutoff, date range from) so both filters apply.
  const effectiveFrom = dateRange.from > retentionCutoff ? dateRange.from : retentionCutoff;

  const where: any = {
    createdAt: { gte: effectiveFrom, lte: dateRange.to },
  };
  // Scope: non-admin users only see their own events.
  if (auth.scope.userId !== undefined) {
    where.userId = auth.scope.userId;
  }
  if (email) where.email = { contains: email.toLowerCase() };
  if (requestId) where.requestId = requestId;
  if (status) where.status = status;
  if (eventType) where.eventType = eventType;
  if (search) {
    where.OR = [
      { email: { contains: search.toLowerCase() } },
      { requestId: { contains: search } },
    ];
  }

  const [total, rows] = await Promise.all([
    db.otpEvent.count({ where }),
    db.otpEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return apiOk({
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    rows: rows.map((r) => ({
      id: r.id,
      timestamp: r.createdAt,
      requestId: r.requestId,
      email: maskEmail(r.email),
      eventType: r.eventType,
      status: r.status,
      purpose: r.purpose,
      ip: r.ip,
      detail: r.detail,
      durationMs: r.durationMs,
    })),
  });
}
