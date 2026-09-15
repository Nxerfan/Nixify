import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { removeContactFromGroup } from "@/lib/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/dashboard/groups/:groupId/members/:contactId
 *
 * Remove a contact from a group. Idempotent — removing a contact that
 * is not a member is a no-op (200 with removed: false).
 *
 * Returns 404 only if the group itself does not exist or belongs to
 * another tenant. A missing membership is not an error.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ groupId: string; contactId: string }> },
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

  const { groupId, contactId: contactIdStr } = await params;
  if (!groupId) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "groupId is required." } },
      { status: 400 },
    );
  }
  const contactId = Number(contactIdStr);
  if (!Number.isInteger(contactId) || contactId <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "contactId must be a positive integer." } },
      { status: 400 },
    );
  }

  // Ensure the group exists (otherwise 404 — no cross-tenant leak).
  const { getGroup } = await import("@/lib/groups");
  const existing = await getGroup(user.id, groupId);
  if (!existing) {
    return NextResponse.json(
      { error: { code: "group_not_found", message: "Group not found." } },
      { status: 404 },
    );
  }

  const result = await removeContactFromGroup(user.id, groupId, contactId);
  // result.removed is false for both "not a member" and "contact doesn't exist".
  // Both are idempotent success — return 200 with removed: false.
  return NextResponse.json({ removed: result.removed });
}
