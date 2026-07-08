import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/request-logs?page=1&pageSize=50&status=&search=
 *
 * Live request-log viewer for the v1 API. Paginated, newest first.
 *
 *  - `status` filters by HTTP status band: "2xx" | "4xx" | "5xx"
 *  - `search` filters on requestId (exact) or path (contains, case-insensitive)
 */
export async function GET(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize")) || 50));
  const status = url.searchParams.get("status") || "";
  const search = (url.searchParams.get("search") || "").trim();
  const skip = (page - 1) * pageSize;

  // Entitlement: enforce audit log retention at read-time.
  const { peekUsage } = await import("@/lib/entitlements/engine");
  const { FEATURE_KEYS: FK } = await import("@/lib/entitlements/config");
  const retention = await peekUsage(Number(admin.sub), FK.AUDIT_LOG_RETENTION);
  const retentionDays = retention.quota === "unlimited" ? 365 : retention.quota || 90;
  const retentionCutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // Build the Prisma where clause.
  const where: {
    createdAt?: { gte: Date };
    status?: { gte: number; lt: number };
    OR?: Array<{ requestId?: { contains: string }; path?: { contains: string } }>;
  } = { createdAt: { gte: retentionCutoff } };

  if (status === "2xx") {
    where.status = { gte: 200, lt: 300 };
  } else if (status === "4xx") {
    where.status = { gte: 400, lt: 500 };
  } else if (status === "5xx") {
    where.status = { gte: 500, lt: 600 };
  }

  if (search) {
    where.OR = [
      { requestId: { contains: search } },
      { path: { contains: search } },
    ];
  }

  const [total, logs] = await Promise.all([
    db.requestLog.count({ where }),
    db.requestLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
    }),
  ]);

  return apiOk({
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    filters: { status, search },
    logs: logs.map((l) => ({
      id: l.id,
      requestId: l.requestId,
      apiKeyId: l.apiKeyId,
      method: l.method,
      path: l.path,
      status: l.status,
      durationMs: l.durationMs,
      ip: l.ip,
      userAgent: l.userAgent,
      error: l.error,
      createdAt: l.createdAt,
    })),
  });
}
