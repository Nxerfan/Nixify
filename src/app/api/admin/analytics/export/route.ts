import { db } from "@/lib/db";
import { apiError } from "@/lib/api-response";
import { resolveAnalyticsRequester } from "@/lib/analytics-auth";
import { getDailyStats, toCsv, resolveRange, maskEmail, type TimeRange } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/analytics/export?type=requests|verifications|errors|daily
 *   &range=7d&from=&to=&status=&eventType=
 *
 * Returns a CSV file download. Emails are masked in all exports.
 * Access: admin (all data) OR PRO+/MAX user (own data only). FREE → 403.
 */
export async function GET(req: Request) {
  const auth = await resolveAnalyticsRequester();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  const url = new URL(req.url);
  const type = (url.searchParams.get("type") ?? "requests") as "requests" | "verifications" | "errors" | "daily";
  const range = (url.searchParams.get("range") ?? "7d") as TimeRange;
  const dateRange = resolveRange(range, url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined);
  const status = url.searchParams.get("status")?.trim() || undefined;
  const eventType = url.searchParams.get("eventType")?.trim() || undefined;

  let csv = "";
  let filename = "";

  if (type === "daily") {
    const daily = await getDailyStats(dateRange, auth.scope);
    csv = toCsv(
      daily.map((d) => ({ ...d, date: d.date })),
      [
        { key: "date", label: "Date" },
        { key: "requests", label: "Total OTP Requests" },
        { key: "verified", label: "Successful Verifications" },
        { key: "failed", label: "Failed Verifications" },
        { key: "expired", label: "Expired OTPs" },
      ],
    );
    filename = `daily-stats-${dateRange.from.toISOString().slice(0, 10)}-to-${dateRange.to.toISOString().slice(0, 10)}.csv`;
  } else {
    const where: any = { createdAt: { gte: dateRange.from, lte: dateRange.to } };
    // Scope: non-admin users only see their own events.
    if (auth.scope.userId !== undefined) {
      where.userId = auth.scope.userId;
    }
    if (type === "requests") {
      where.eventType = { in: ["requested", "resent"] };
    } else if (type === "verifications") {
      where.eventType = { in: ["verified", "failed", "expired"] };
    } else if (type === "errors") {
      where.status = "error";
    }
    if (status) where.status = status;
    if (eventType) where.eventType = eventType;

    const rows = await db.otpEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10000, // safety cap
    });

    const csvRows = rows.map((r) => ({
      timestamp: r.createdAt.toISOString(),
      requestId: r.requestId,
      email: maskEmail(r.email),
      eventType: r.eventType,
      status: r.status,
      purpose: r.purpose,
      ip: r.ip ?? "",
      detail: r.detail ?? "",
      durationMs: r.durationMs ?? "",
    }));

    csv = toCsv(csvRows, [
      { key: "timestamp", label: "Timestamp" },
      { key: "requestId", label: "Request ID" },
      { key: "email", label: "Email (masked)" },
      { key: "eventType", label: "Event Type" },
      { key: "status", label: "Status" },
      { key: "purpose", label: "Purpose" },
      { key: "ip", label: "IP" },
      { key: "detail", label: "Detail" },
      { key: "durationMs", label: "Duration (ms)" },
    ]);
    filename = `${type}-${dateRange.from.toISOString().slice(0, 10)}-to-${dateRange.to.toISOString().slice(0, 10)}.csv`;
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
