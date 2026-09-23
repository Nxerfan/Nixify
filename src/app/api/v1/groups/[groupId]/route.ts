import { NextRequest } from "next/server";
import { z } from "zod";
import {
  withApiKey,
  okResponse,
  errorResponse,
  type ApiContext,
} from "@/lib/dx/request-context";
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

async function checkGroupAccess(ctx: ApiContext, req: NextRequest) {
  if (!ctx.apiKey.userId) {
    return errorResponse(
      ctx.requestId,
      403,
      "owner_required",
      "A user-owned API key is required to manage groups.",
      req,
      ctx.apiKey.keyId,
    );
  }
  const access = await canAccess(ctx.apiKey.userId, FEATURE_KEYS.GROUPS);
  if (!access.allowed) {
    return errorResponse(
      ctx.requestId,
      403,
      "feature_not_available",
      "Groups is not available on your plan.",
      req,
      ctx.apiKey.keyId,
    );
  }
  return null;
}

/**
 * GET /api/v1/groups/:groupId
 */
export const GET = withApiKey("read", async (ctx: ApiContext, req: NextRequest) => {
  const accessErr = await checkGroupAccess(ctx, req);
  if (accessErr) return accessErr;

  const groupId = extractGroupId(req);
  if (!groupId) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid group ID.", req, ctx.apiKey.keyId);
  }

  const group = await getGroup(ctx.apiKey.userId!, groupId);
  if (!group) {
    return errorResponse(ctx.requestId, 404, "group_not_found", "Group not found.", req, ctx.apiKey.keyId);
  }

  return okResponse(ctx.requestId, {
    id: group.id,
    group_id: group.groupId,
    name: group.name,
    description: group.description,
    member_count: group.memberCount,
    created_at: group.createdAt.toISOString(),
    updated_at: group.updatedAt.toISOString(),
  });
});

/**
 * PATCH /api/v1/groups/:groupId
 */
export const PATCH = withApiKey("full", async (ctx: ApiContext, req: NextRequest) => {
  const accessErr = await checkGroupAccess(ctx, req);
  if (accessErr) return accessErr;

  const groupId = extractGroupId(req);
  if (!groupId) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid group ID.", req, ctx.apiKey.keyId);
  }

  let body: z.infer<typeof updateSchema>;
  try {
    const json = await req.json();
    const result = updateSchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
      return errorResponse(ctx.requestId, 400, "validation_failed", msg, req, ctx.apiKey.keyId);
    }
    body = result.data;
  } catch {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid JSON body.", req, ctx.apiKey.keyId);
  }

  try {
    const updated = await updateGroup(ctx.apiKey.userId!, groupId, {
      name: body.name,
      description: body.description,
    });

    if (!updated) {
      return errorResponse(ctx.requestId, 404, "group_not_found", "Group not found.", req, ctx.apiKey.keyId);
    }

    return okResponse(ctx.requestId, {
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
      return errorResponse(ctx.requestId, 409, "duplicate_name", "A group with this name already exists.", req, ctx.apiKey.keyId);
    }
    return errorResponse(ctx.requestId, 500, "internal_error", "Failed to update group.", req, ctx.apiKey.keyId);
  }
}, { securityBucket: "generic" });

/**
 * DELETE /api/v1/groups/:groupId
 */
export const DELETE = withApiKey("full", async (ctx: ApiContext, req: NextRequest) => {
  const accessErr = await checkGroupAccess(ctx, req);
  if (accessErr) return accessErr;

  const groupId = extractGroupId(req);
  if (!groupId) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid group ID.", req, ctx.apiKey.keyId);
  }

  const deleted = await deleteGroup(ctx.apiKey.userId!, groupId);
  if (!deleted) {
    return errorResponse(ctx.requestId, 404, "group_not_found", "Group not found.", req, ctx.apiKey.keyId);
  }

  return okResponse(ctx.requestId, { deleted: true });
}, { securityBucket: "generic" });

/**
 * Extract the :groupId path param. Next.js route is `/api/v1/groups/[groupId]`,
 * so the param is the last segment of the pathname. groupId is a UUID string.
 */
function extractGroupId(req: NextRequest): string | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const groupId = parts[parts.length - 1];
  if (!groupId || groupId === "groups") return null;
  return groupId;
}
