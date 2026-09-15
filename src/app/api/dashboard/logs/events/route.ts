import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 * GET /api/dashboard/logs/events
 *
 * Paginated list of InboundEvent rows owned by the authenticated user.
 * Tenant scope: WHERE userId = session.user.id.
 *
 * Filters: type?, email? (contains), environment?, dateRange?.
 *
 * Per section 29 — list view returns SUMMARY METADATA ONLY.
 * The event `data` field is NOT included here. Use GET
 * /api/dashboard/logs/events/:eventId to fetch the full payload (that is
 * the ONLY endpoint that returns `data`).
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

  const type = url.searchParams.get("type")?.trim() || undefined;
  const email = url.searchParams.get("email")?.trim() || undefined;
  const environment = url.searchParams.get("environment");

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

  // Build WHERE — tenant scoped by user.id.
  const where: Prisma.InboundEventWhereInput = { userId: user.id };
  if (type) where.type = type;
  if (email) where.email = { contains: email };
  if (environment) where.environment = environment;
  if (dateRange.range.gte || dateRange.range.lte) {
    where.createdAt = {};
    if (dateRange.range.gte) where.createdAt.gte = dateRange.range.gte;
    if (dateRange.range.lte) where.createdAt.lte = dateRange.range.lte;
  }

  const [total, events] = await Promise.all([
    db.inboundEvent.count({ where }),
    db.inboundEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
      select: {
        eventId: true,
        type: true,
        email: true,
        environment: true,
        createdAt: true,
        // data intentionally NOT selected — list view is summary-only (section 29).
        // contactId NOT selected here either — it's only meaningful on the detail view.
      },
    }),
  ]);

  return NextResponse.json({
    events: events.map((e) => ({
      eventId: e.eventId,
      type: e.type,
      email: e.email,
      environment: e.environment,
      createdAt: e.createdAt.toISOString(),
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
