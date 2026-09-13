import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  getContactById,
  updateContact,
  deleteContact,
  getContactTimeline,
  MAX_NAME_LENGTH,
  ContactValidationError,
} from "@/lib/contacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().trim().max(MAX_NAME_LENGTH).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

async function checkAuth() {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) return null;
  return user;
}

/**
 * GET /api/dashboard/contacts/:id
 *
 * Get a single contact with recent timeline events.
 * Tenant-scoped: returns 404 if the contact belongs to another user.
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

  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Contacts is not available on your current account." } },
      { status: 403 },
    );
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid contact ID." } },
      { status: 400 },
    );
  }

  const contact = await getContactById(user.id, id);
  if (!contact) {
    return NextResponse.json(
      { error: { code: "contact_not_found", message: "Contact not found." } },
      { status: 404 },
    );
  }

  const { events } = await getContactTimeline(user.id, id, { limit: 20 });

  return NextResponse.json({
    id: contact.id,
    email: contact.email,
    name: contact.name,
    source: contact.source,
    attributes: contact.attributes,
    marketing_status: contact.marketingStatus,
    created_at: contact.createdAt.toISOString(),
    updated_at: contact.updatedAt.toISOString(),
    timeline: events.map((e) => ({
      type: e.type,
      detail: e.detail,
      created_at: e.createdAt.toISOString(),
    })),
  });
}

/**
 * PATCH /api/dashboard/contacts/:id
 *
 * Update contact name and/or attributes.
 * Does NOT allow modifying email, userId, source, or marketing fields.
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

  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Contacts is not available on your current account." } },
      { status: 403 },
    );
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid contact ID." } },
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

  try {
    const contact = await updateContact(user.id, id, {
      name: body.name,
      attributes: body.attributes as Record<string, unknown> | undefined,
    });

    if (!contact) {
      return NextResponse.json(
        { error: { code: "contact_not_found", message: "Contact not found." } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: contact.id,
      email: contact.email,
      name: contact.name,
      source: contact.source,
      attributes: contact.attributes,
      marketing_status: contact.marketingStatus,
      created_at: contact.createdAt.toISOString(),
      updated_at: contact.updatedAt.toISOString(),
    });
  } catch (e) {
    if (e instanceof ContactValidationError) {
      return NextResponse.json(
        { error: { code: "validation_failed", message: e.message } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to update contact." } },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/dashboard/contacts/:id
 *
 * Delete a contact. Returns 404 if not found or belongs to another user.
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

  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Contacts is not available on your current account." } },
      { status: 403 },
    );
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid contact ID." } },
      { status: 400 },
    );
  }

  const deleted = await deleteContact(user.id, id);
  if (!deleted) {
    return NextResponse.json(
      { error: { code: "contact_not_found", message: "Contact not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true });
}
