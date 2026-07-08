import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/stats — dashboard overview numbers. */
export async function GET() {
  if (!(await getAdmin())) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    lockedAccounts,
    activeIpBlocks,
    disposableBlocked,
    events24h,
    otpsIssued24h,
    otpsVerified24h,
    recentEvents,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { lockedUntil: { gt: now } } }),
    db.ipBlock.count({ where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
    db.disposableDomain.count({ where: { listType: "block" } }),
    db.securityEvent.count({ where: { createdAt: { gt: last24h } } }),
    db.otpCode.count({ where: { createdAt: { gt: last24h } } }),
    db.otpCode.count({ where: { createdAt: { gt: last24h }, consumedAt: { not: null } } }),
    db.securityEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return apiOk({
    totals: {
      users: totalUsers,
      lockedAccounts,
      activeIpBlocks,
      disposableDomainsBlocked: disposableBlocked,
      securityEvents24h: events24h,
      otpsIssued24h,
      otpsVerified24h,
    },
    recentEvents: recentEvents.map((e) => ({
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
