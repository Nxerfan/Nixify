import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  listMembers,
  addContactToGroup,
  bulkAddContactsToGroup,
  MAX_BULK_ADD,
} from "@/lib/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const addSchema = z
  .object({
    contactId: z.number().int().positive().optional(),
    contactIds: z.array(z.number().int().positive()).max(MAX_BULK_ADD).optional(),
  })
  .refine(
    (v) => v.contactId !== undefined || (v.contactIds !== undefined && v.contactIds.length > 0),
    { message: "Provide contactId or a non-empty contactIds array." },
  );

/**
 * GET /api/dashboard/groups/:groupId/members
 *
 * List members of a group. Paginated. Returns 404 if the group does
 * not exist or belongs to another tenant (no cross-tenant leak).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const access = await canAccess(user.id, FEATURE_KEYS.GROUPS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Groups is not available on your current account." } },
      { status: 403 },
    );
  }

  const { groupId } = await params;
  if (!groupId) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "groupId is required." } },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const pageStr = url.searchParams.get("page") ?? "1";
  const pageSizeStr = url.searchParams.get("pageSize") ?? "20";

  const page = Number(pageStr);
  const pageSize = Number(pageSizeStr);

  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "page must be a positive integer." } },
      { status: 400 },
    );
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "pageSize must be a positive integer (max 100)." } },
      { status: 400 },
    );
  }

  const result = await listMembers(user.id, groupId, { page, pageSize });
  if (!result) {
    return NextResponse.json(
      { error: { code: "group_not_found", message: "Group not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    members: result.members.map((m) => ({
      id: m.id,
      contact_id: m.contactId,
      contact_email: m.contactEmail,
      contact_name: m.contactName,
      source: m.source,
      created_at: m.createdAt.toISOString(),
    })),
    pagination: {
      page,
      pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / pageSize),
    },
  });
}

/**
 * POST /api/dashboard/groups/:groupId/members
 *
 * Add one or many contacts to a group. Idempotent — adding an existing
 * member is a no-op. Bulk is capped at MAX_BULK_ADD (100) contacts.
 *
 * Body:
 *   { "contactId": 123 }                       — single add
 *   { "contactIds": [1, 2, 3, ...] }           — bulk add (max 100)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const access = await canAccess(user.id, FEATURE_KEYS.GROUPS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Groups is not available on your current account." } },
      { status: 403 },
    );
  }

  const { groupId } = await params;
  if (!groupId) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "groupId is required." } },
      { status: 400 },
    );
  }

  let body: z.infer<typeof addSchema>;
  try {
    const json = await req.json();
    const result = addSchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
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

  // Verify the group exists (so we can return 404 for unknown groups).
  const { getGroup } = await import("@/lib/groups");
  const existing = await getGroup(user.id, groupId);
  if (!existing) {
    return NextResponse.json(
      { error: { code: "group_not_found", message: "Group not found." } },
      { status: 404 },
    );
  }

  // Single add — returns {added: boolean}.
  if (body.contactId !== undefined) {
    const r = await addContactToGroup(user.id, groupId, body.contactId, "manual");
    if (!r.added) {
      // Could be: group missing (already checked), contact missing, or already a member.
      // We treat "already a member" as idempotent success for the API contract.
      return NextResponse.json({ added: false, skipped: true });
    }
    return NextResponse.json({ added: true, skipped: false }, { status: 201 });
  }

  // Bulk add — returns {added, skipped}.
  const r = await bulkAddContactsToGroup(user.id, groupId, body.contactIds!, "manual");
  return NextResponse.json({
    added: r.added,
    skipped: r.skipped,
  });
}
