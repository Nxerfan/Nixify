import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  getGroup,
  updateGroup,
  deleteGroup,
  MAX_GROUP_NAME,
  MAX_GROUP_DESCRIPTION,
} from "@/lib/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name cannot be empty")
      .max(MAX_GROUP_NAME, `Name must be at most ${MAX_GROUP_NAME} characters`)
      .optional(),
    description: z
      .string()
      .trim()
      .max(MAX_GROUP_DESCRIPTION, `Description must be at most ${MAX_GROUP_DESCRIPTION} characters`)
      .optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined, {
    message: "Provide at least one of name or description.",
  });

/**
 * GET /api/dashboard/groups/:groupId
 *
 * Fetch a single group by its public UUID. Returns 404 if the group
 * does not exist or belongs to a different user (no cross-tenant
 * existence leak).
 */
export async function GET(
  _req: NextRequest,
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

  const group = await getGroup(user.id, groupId);
  if (!group) {
    return NextResponse.json(
      { error: { code: "group_not_found", message: "Group not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: group.id,
    group_id: group.groupId,
    name: group.name,
    description: group.description,
    member_count: group.memberCount,
    created_at: group.createdAt.toISOString(),
    updated_at: group.updatedAt.toISOString(),
  });
}

/**
 * PATCH /api/dashboard/groups/:groupId
 */
export async function PATCH(
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

  let body: z.infer<typeof updateSchema>;
  try {
    const json = await req.json();
    const result = updateSchema.safeParse(json);
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

  try {
    const updated = await updateGroup(user.id, groupId, {
      name: body.name,
      description: body.description,
    });

    if (!updated) {
      return NextResponse.json(
        { error: { code: "group_not_found", message: "Group not found." } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: updated.id,
      group_id: updated.groupId,
      name: updated.name,
      description: updated.description,
      member_count: updated.memberCount,
      created_at: updated.createdAt.toISOString(),
      updated_at: updated.updatedAt.toISOString(),
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: { code: "duplicate_name", message: "A group with this name already exists." } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to update group." } },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/dashboard/groups/:groupId
 *
 * Cascade-deletes all memberships. Contacts are NOT deleted — they
 * remain owned by the user.
 */
export async function DELETE(
  _req: NextRequest,
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

  const deleted = await deleteGroup(user.id, groupId);
  if (!deleted) {
    return NextResponse.json(
      { error: { code: "group_not_found", message: "Group not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ deleted: true });
}
