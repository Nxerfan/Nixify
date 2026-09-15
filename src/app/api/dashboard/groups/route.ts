import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  createGroup,
  listGroups,
  MAX_GROUP_NAME,
  MAX_GROUP_DESCRIPTION,
} from "@/lib/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(MAX_GROUP_NAME, `Name must be at most ${MAX_GROUP_NAME} characters`),
  description: z
    .string()
    .trim()
    .max(MAX_GROUP_DESCRIPTION, `Description must be at most ${MAX_GROUP_DESCRIPTION} characters`)
    .optional(),
});

/**
 * GET /api/dashboard/groups
 *
 * List the authenticated user's groups. Paginated, searchable.
 * Session-authenticated. Tenant-scoped by user.id (caller-supplied
 * userId is never accepted). Cross-tenant reads are structurally
 * impossible.
 */
export async function GET(req: NextRequest) {
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

  const url = new URL(req.url);
  const pageStr = url.searchParams.get("page") ?? "1";
  const pageSizeStr = url.searchParams.get("pageSize") ?? "20";
  const search = url.searchParams.get("search")?.trim() || undefined;

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
  if (search && search.length > 200) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "search must be at most 200 characters." } },
      { status: 400 },
    );
  }

  const result = await listGroups(user.id, { page, pageSize, search });

  return NextResponse.json({
    groups: result.groups.map((g) => ({
      id: g.id,
      group_id: g.groupId,
      name: g.name,
      description: g.description,
      member_count: g.memberCount,
      created_at: g.createdAt.toISOString(),
      updated_at: g.updatedAt.toISOString(),
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
 * POST /api/dashboard/groups
 *
 * Create a group for the authenticated user. Requires GROUPS access.
 * Tenant-scoped by user.id — caller-supplied userId is never accepted.
 */
export async function POST(req: NextRequest) {
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

  let body: z.infer<typeof createSchema>;
  try {
    const json = await req.json();
    const result = createSchema.safeParse(json);
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
    const group = await createGroup(user.id, {
      name: body.name,
      description: body.description,
    });

    return NextResponse.json(
      {
        id: group.id,
        group_id: group.groupId,
        name: group.name,
        description: group.description,
        member_count: group.memberCount,
        created_at: group.createdAt.toISOString(),
        updated_at: group.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (e: any) {
    // P2002: duplicate name within the same tenant (case-insensitive).
    if (e?.code === "P2002") {
      return NextResponse.json(
        { error: { code: "duplicate_name", message: "A group with this name already exists." } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to create group." } },
      { status: 500 },
    );
  }
}
