import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_BANDS = new Set(["2xx", "4xx", "5xx"]);
const VALID_ENVS = new Set(["development", "production"]);
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

/** Parse ?from + ?to ISO date strings into a Prisma DateTime filter. */
function parseDateRange(
  from: string | null,
  to: string | null,
): { ok: true; range: { gte?: Date; lte?: Date } } | { ok: false } {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) {
    const d = new Date(from);
    if (isNaN(d.getTime())) return { ok: false };
    range.gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (isNaN(d.getTime())) return { ok: false };
    range.lte = d;
  }
  return { ok: true, range };
}

/**
 * GET /api/dashboard/logs/requests
 *
 * Paginated list of RequestLog rows owned by the authenticated user.
 * Tenant scope: WHERE userId = session.user.id. System/legacy rows
 * (userId=null) are NEVER shown to dashboard users.
 *
 * Filters: requestId?, method?, path? (contains), status? (2xx/4xx/5xx band),
 *          environment?, dateRange? (?from, ?to ISO dates).
 *
 * SAFE field selection — NEVER returns:
 *   - Authorization header (not stored on RequestLog, but we don't expose it)
 *   - API key (apiKeyId is intentionally NOT selected)
 *   - request body (not stored on this model)
 *   - Idempotency-Key (not stored on this model)
 *
 * Max pageSize: 100.
 *
 * Session-authenticated, tenant-scoped by User.id. Does NOT consume API_MESSAGES.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSizeRaw = Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw));
  const skip = (page - 1) * pageSize;

  const requestId = url.searchParams.get("requestId")?.trim() || undefined;
  const methodRaw = url.searchParams.get("method")?.trim() || undefined;
  const method = methodRaw ? methodRaw.toUpperCase() : undefined;
  const path = url.searchParams.get("path")?.trim() || undefined;
  const band = url.searchParams.get("status");
  const environment = url.searchParams.get("environment");

  if (band && !VALID_BANDS.has(band)) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "status must be one of: 2xx, 4xx, 5xx." } },
      { status: 400 },
    );
  }
  if (environment && !VALID_ENVS.has(environment)) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "environment must be 'development' or 'production'." } },
      { status: 400 },
    );
  }

  const dateRange = parseDateRange(
    url.searchParams.get("from"),
    url.searchParams.get("to"),
  );
  if (!dateRange.ok) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid date range. Use ISO 8601 for ?from and ?to." } },
      { status: 400 },
    );
  }

  // Build WHERE — tenant scoped by user.id (NEVER AdminUser.id, never caller-supplied).
  const where: Prisma.RequestLogWhereInput = { userId: user.id };
  if (requestId) where.requestId = requestId;
  if (method) where.method = method;
  if (path) where.path = { contains: path };
  if (environment) where.environment = environment;
  if (band) {
    // Status band: "2xx" → 200-299, "4xx" → 400-499, "5xx" → 500-599.
    const start = Number(band[0]) * 100;
    where.status = { gte: start, lt: start + 100 };
  }
  if (dateRange.range.gte || dateRange.range.lte) {
    where.createdAt = {};
    if (dateRange.range.gte) where.createdAt.gte = dateRange.range.gte;
    if (dateRange.range.lte) where.createdAt.lte = dateRange.range.lte;
  }

  const [total, logs] = await Promise.all([
    db.requestLog.count({ where }),
    db.requestLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
      select: {
        requestId: true,
        method: true,
        path: true,
        status: true,
        durationMs: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        // apiKeyId, userId, environment, error intentionally NOT selected —
        // we only expose the safe debugging metadata listed in the spec.
      },
    }),
  ]);

  return NextResponse.json({
    logs: logs.map((l) => ({
      requestId: l.requestId,
      method: l.method,
      path: l.path,
      status: l.status,
      durationMs: l.durationMs,
      ip: l.ip,
      userAgent: l.userAgent,
      createdAt: l.createdAt.toISOString(),
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
