import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/logs/events/:eventId
 *
 * Fetch a single InboundEvent with the FULL payload.
 *
 * This is the ONLY endpoint that returns the event `data` field. The list
 * view (GET /api/dashboard/logs/events) returns summary metadata only.
 *
 * Tenant-scoped: cross-tenant access returns 404 (no existence leakage).
 * The eventId is the public UUID, not the autoincrement integer.
 *
 * Session-authenticated, tenant-scoped by User.id. Does NOT consume API_MESSAGES.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const { eventId } = await params;
  if (!eventId || typeof eventId !== "string" || eventId.length > 100) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid eventId." } },
      { status: 400 },
    );
  }

  // findFirst with userId filter = tenant scope + 404 on cross-tenant access.
  const event = await db.inboundEvent.findFirst({
    where: { eventId, userId: user.id },
    select: {
      eventId: true,
      type: true,
      email: true,
      environment: true,
      data: true,
      contactId: true,
      createdAt: true,
    },
  });
  if (!event) {
    return NextResponse.json(
      { error: { code: "event_not_found", message: "Event not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    eventId: event.eventId,
    type: event.type,
    email: event.email,
    environment: event.environment,
    // This is the ONLY endpoint that returns `data` — the developer-supplied
    // event payload. Returned as-is (Prisma.JsonValue → JSON via NextResponse).
    data: event.data,
    contactId: event.contactId,
    createdAt: event.createdAt.toISOString(),
  });
}
