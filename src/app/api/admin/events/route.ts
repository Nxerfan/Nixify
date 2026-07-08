import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/events?take=100 — recent security events. */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const url = new URL(req.url);
  const take = Math.min(Number(url.searchParams.get("take") ?? "100"), 500);
  const type = url.searchParams.get("type");

  // Entitlement: enforce audit log retention at read-time.
  // Rows older than the plan's retention window are excluded from results.
  const { peekUsage } = await import("@/lib/entitlements/engine");
  const { FEATURE_KEYS: FK } = await import("@/lib/entitlements/config");
  const retention = await peekUsage(Number(admin.sub), FK.AUDIT_LOG_RETENTION);
  const retentionDays = retention.quota === "unlimited" ? 365 : retention.quota || 90;
  const retentionCutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const where: any = { createdAt: { gte: retentionCutoff } };
  if (type) where.type = type;

  const events = await db.securityEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
  });
  return apiOk({
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      ip: e.ip,
      email: e.email,
      fingerprint: e.fingerprint ? e.fingerprint.slice(0, 8) : null,
      detail: e.detail,
      createdAt: e.createdAt,
    })),
  });
}
