import { apiOk, apiError } from "@/lib/api-response";
import { resolveAnalyticsRequester } from "@/lib/analytics-auth";
import { getDailyStats, resolveRange, type TimeRange } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/analytics/reports/daily?range=30d&from=&to=
 *  Access: admin (all data) OR PRO+/MAX user (own data only). FREE → 403. */
export async function GET(req: Request) {
  const auth = await resolveAnalyticsRequester();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  const url = new URL(req.url);
  const range = (url.searchParams.get("range") ?? "30d") as TimeRange;
  const dateRange = resolveRange(range, url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined);
  const daily = await getDailyStats(dateRange, auth.scope);
  return apiOk({ range: { from: dateRange.from, to: dateRange.to }, daily });
}
