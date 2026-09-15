import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { validateWebhookDestination } from "@/lib/dx/ssrf";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z
  .object({
    url: z.string().trim().min(1, "URL cannot be empty").max(2048, "URL is too long").optional(),
    events: z
      .array(z.string().trim().min(1, "Event type cannot be empty").max(100, "Event type is too long"))
      .min(1, "At least one event subscription is required")
      .max(50, "Too many event subscriptions (max 50)")
      .optional(),
  })
  .refine((v) => v.url !== undefined || v.events !== undefined, {
    message: "At least one of url or events must be provided.",
  });

/**
 * GET /api/dashboard/webhooks/:id
 *
 * Fetch one webhook endpoint. Tenant-scoped: cross-tenant access returns 404
 * (no existence leakage). Returns the FULL url (the list view masks it).
 *
 * The signing secret is NEVER returned by this route — only by POST create
 * and POST rotate-secret (each shown exactly once).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid endpoint ID." } },
      { status: 400 },
    );
  }

  // findFirst with userId filter = tenant scope + 404 on cross-tenant access.
  const ep = await db.webhookEndpoint.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
      // secret intentionally NOT selected.
    },
  });
  if (!ep) {
    return NextResponse.json(
      { error: { code: "webhook_not_found", message: "Webhook endpoint not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: ep.id,
    url: ep.url,
    events: ep.events,
    isActive: ep.isActive,
    createdAt: ep.createdAt.toISOString(),
  });
}

/**
 * PATCH /api/dashboard/webhooks/:id
 *
 * Update url and/or events. URL is re-validated via validateWebhookDestination
 * only when changed. isActive is NOT modifiable here — use DELETE for soft-delete.
 *
 * Tenant-scoped: cross-tenant = 404.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid endpoint ID." } },
      { status: 400 },
    );
  }

  let body: z.infer<typeof updateSchema>;
  try {
    const json = await req.json();
    const result = updateSchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i: any) => i.message).join("; ");
      return NextResponse.json(
        { error: { code: "validation_failed", message: msg } },
        { status: 400 },
      );
    }
    body = result.data;
  } catch {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  // Fetch first to enforce tenant scope (cross-tenant = 404).
  const existing = await db.webhookEndpoint.findFirst({
    where: { id, userId: user.id },
    select: { id: true, url: true, events: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: { code: "webhook_not_found", message: "Webhook endpoint not found." } },
      { status: 404 },
    );
  }

  // SSRF validation — only when URL is being changed to a new value.
  // Same-URL updates (e.g. only changing events) skip the check.
  if (body.url && body.url !== existing.url) {
    const ssrf = await validateWebhookDestination(body.url);
    if (!ssrf.ok) {
      return NextResponse.json(
        { error: { code: ssrf.code, message: ssrf.message } },
        { status: 400 },
      );
    }
  }

  const updated = await db.webhookEndpoint.update({
    where: { id },
    data: {
      ...(body.url ? { url: body.url } : {}),
      ...(body.events
        ? { events: Array.from(new Set(body.events)).join(",") }
        : {}),
    },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    id: updated.id,
    url: updated.url,
    events: updated.events,
    isActive: updated.isActive,
    createdAt: updated.createdAt.toISOString(),
  });
}

/**
 * DELETE /api/dashboard/webhooks/:id
 *
 * SOFT-DELETE: sets isActive=false. Does NOT physically remove the row.
 *
 * Why soft-delete:
 *   - Preserves WebhookDelivery history for the logs UI (audit + replay).
 *   - scheduleUserWebhookDeliveries() filters by isActive=true, so no new
 *     deliveries are scheduled to a soft-deleted endpoint.
 *   - The capacity check in POST counts only active endpoints, so soft-deleting
 *     frees the slot for a new endpoint.
 *
 * Tenant-scoped: cross-tenant = 404.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid endpoint ID." } },
      { status: 400 },
    );
  }

  // Tenant-scoped: cross-tenant = 404 (no existence leakage).
  const existing = await db.webhookEndpoint.findFirst({
    where: { id, userId: user.id },
    select: { id: true, isActive: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: { code: "webhook_not_found", message: "Webhook endpoint not found." } },
      { status: 404 },
    );
  }

  // Soft-delete — preserve row + delivery history. Idempotent if already inactive.
  await db.webhookEndpoint.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ deleted: true, id });
}
