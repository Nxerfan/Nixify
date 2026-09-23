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

const MAX_SEARCH_LENGTH = 200;

/**
 * v1 group access check — system keys (userId=null) cannot manage Groups.
 * API_MESSAGES entitlement is consumed by the withApiKey middleware
 * (not here). GROUPS access is binary — no quota.
 */
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
 * GET /api/v1/groups
 *
 * List groups owned by the API key's owner. Paginated, searchable.
 * Works with both "full" and "read_only" API key scopes.
 */
export const GET = withApiKey("read", async (ctx: ApiContext, req: NextRequest) => {
  const accessErr = await checkGroupAccess(ctx, req);
  if (accessErr) return accessErr;

  const url = new URL(req.url);
  const pageStr = url.searchParams.get("page") ?? "1";
  const pageSizeStr = url.searchParams.get("pageSize") ?? "50";
  const search = url.searchParams.get("search")?.trim() || undefined;

  const page = Number(pageStr);
  const pageSize = Number(pageSizeStr);

  if (!Number.isInteger(page) || page < 1) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "page must be a positive integer.", req, ctx.apiKey.keyId);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "pageSize must be a positive integer.", req, ctx.apiKey.keyId);
  }
  if (search && search.length > MAX_SEARCH_LENGTH) {
    return errorResponse(ctx.requestId, 400, "validation_failed", `search must be at most ${MAX_SEARCH_LENGTH} characters.`, req, ctx.apiKey.keyId);
  }

  const result = await listGroups(ctx.apiKey.userId!, {
    page: Math.min(page, 10000),
    pageSize: Math.min(pageSize, 100),
    search,
  });

  return okResponse(ctx.requestId, {
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
      page: Math.min(page, 10000),
      pageSize: Math.min(pageSize, 100),
      total: result.total,
      totalPages: Math.ceil(result.total / Math.min(pageSize, 100)),
    },
  });
});

/**
 * POST /api/v1/groups
 *
 * Create a group owned by the API key's owner. Requires "full" scope.
 */
export const POST = withApiKey("full", async (ctx: ApiContext, req: NextRequest) => {
  const accessErr = await checkGroupAccess(ctx, req);
  if (accessErr) return accessErr;

  let body: z.infer<typeof createSchema>;
  try {
    const json = await req.json();
    const result = createSchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
      return errorResponse(ctx.requestId, 400, "validation_failed", msg, req, ctx.apiKey.keyId);
    }
    body = result.data;
  } catch {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid JSON body.", req, ctx.apiKey.keyId);
  }

  try {
    const group = await createGroup(ctx.apiKey.userId!, {
      name: body.name,
      description: body.description,
    });

    return okResponse(
      ctx.requestId,
      {
        id: group.id,
        group_id: group.groupId,
        name: group.name,
        description: group.description,
        member_count: group.memberCount,
        created_at: group.createdAt.toISOString(),
        updated_at: group.updatedAt.toISOString(),
      },
      201,
    );
  } catch (e: any) {
    if (e?.code === "P2002") {
      return errorResponse(ctx.requestId, 409, "duplicate_name", "A group with this name already exists.", req, ctx.apiKey.keyId);
    }
    return errorResponse(ctx.requestId, 500, "internal_error", "Failed to create group.", req, ctx.apiKey.keyId);
  }
}, { securityBucket: "generic" });
