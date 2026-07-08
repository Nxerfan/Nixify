import { apiOk, apiError } from "@/lib/api-response";
import { resolveAnalyticsRequester } from "@/lib/analytics-auth";
import {
  getOverviewKpis,
  getOtpActivitySeries,
  getVerificationTrend,
  getTrafficHeatmap,
  getQuickStatus,
  resolveRange,
  type TimeRange,
} from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/analytics/overview?range=today|7d|30d|custom&from=ISO&to=ISO
 * Returns all data for the Overview tab: KPIs, activity series, verification
 * trend, traffic heatmap, and quick service status.
 *
 * Access: admin (all data) OR PRO+/MAX user (own data only). FREE → 403.
 */
export async function GET(req: Request) {
  const auth = await resolveAnalyticsRequester();
  if (!auth.ok) {
    return apiError(auth.code, auth.message, auth.status);
  }
  const scope = auth.scope;

  const url = new URL(req.url);
  const range = (url.searchParams.get("range") ?? "7d") as TimeRange;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const dateRange = resolveRange(range, from, to);

  const [kpis, activitySeries, verifyTrend, heatmap, quickStatus] = await Promise.all([
    getOverviewKpis(dateRange, scope),
    getOtpActivitySeries(dateRange, scope),
    getVerificationTrend(dateRange, scope),
    getTrafficHeatmap(dateRange, scope),
    getQuickStatus(),
  ]);

  return apiOk({
    range: { from: dateRange.from, to: dateRange.to },
    kpis,
    activitySeries,
    verifyTrend,
    heatmap,
    quickStatus,
  });
}
