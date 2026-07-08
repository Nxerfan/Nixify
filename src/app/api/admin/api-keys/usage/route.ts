import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { listApiKeys } from "@/lib/dx/api-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/api-keys/usage?id=<apiKeyId>
 *
 * Returns RequestLog counts for the supplied API key, broken out by status band
 * (2xx / 4xx / 5xx) over the last 24h, last 7d, and all-time. Powers the
 * per-key usage chart on the API keys management page.
 *
 * Access: admin (any key) OR authenticated user (own keys only).
 */
export async function GET(req: NextRequest) {
  // Resolve requester (admin OR user).
  const admin = await getAdmin();
  const user = admin ? null : await getAuthenticatedUser();
  if (!admin && !user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Login required.", 401);
  }

  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Missing or invalid ?id=", 400);
  }

  // Ownership check: non-admin users can only query their own keys.
  if (user) {
    const ownKeys = await listApiKeys({ userId: user.id });
    if (!ownKeys.some((k) => k.id === id)) {
      return apiError(ERROR_CODES.NOT_FOUND, "API key not found.", 404);
    }
  }

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Run the three window queries in parallel for speed.
  const [last24h, last7d, allTime] = await Promise.all([
    db.requestLog.groupBy({
      by: ["status"],
      where: { apiKeyId: id, createdAt: { gte: dayAgo } },
      _count: { _all: true },
    }),
    db.requestLog.groupBy({
      by: ["status"],
      where: { apiKeyId: id, createdAt: { gte: weekAgo } },
      _count: { _all: true },
    }),
    db.requestLog.groupBy({
      by: ["status"],
      where: { apiKeyId: id },
      _count: { _all: true },
    }),
  ]);

  // Bucket status codes into 2xx / 4xx / 5xx (ignore 3xx — we don't emit them).
  const bucket = (rows: { status: number; _count: { _all: number } }[]) => {
    let success = 0;
    let client = 0;
    let server = 0;
    let total = 0;
    for (const r of rows) {
      const c = r._count._all;
      total += c;
      if (r.status >= 200 && r.status < 300) success += c;
      else if (r.status >= 400 && r.status < 500) client += c;
      else if (r.status >= 500) server += c;
    }
    return { success, client, server, total };
  };

  return apiOk({
    apiKeyId: id,
    last24h: bucket(last24h),
    last7d: bucket(last7d),
    allTime: bucket(allTime),
  });
}
