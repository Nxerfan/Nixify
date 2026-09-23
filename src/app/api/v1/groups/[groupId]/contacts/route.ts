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
  listMembers,
  addContactToGroup,
  bulkAddContactsToGroup,
  getGroup,
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

function extractGroupId(req: NextRequest): string | null {
  // Path: /api/v1/groups/[groupId]/contacts
  const parts = new URL(req.url).pathname.split("/");
  // ["", "api", "v1", "groups", "<groupId>", "contacts"]
  const groupId = parts[4];
  if (!groupId || groupId === "contacts") return null;
  return groupId;
}

/**
 * GET /api/v1/groups/:groupId/contacts
 *
 * List members of a group. Returns 404 if the group doesn't exist or
 * belongs to another tenant.
 */
export const GET = withApiKey("read", async (ctx: ApiContext, req: NextRequest) => {
  const accessErr = await checkGroupAccess(ctx, req);
  if (accessErr) return accessErr;

  const groupId = extractGroupId(req);
  if (!groupId) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid group ID.", req, ctx.apiKey.keyId);
  }

  const url = new URL(req.url);
  const pageStr = url.searchParams.get("page") ?? "1";
  const pageSizeStr = url.searchParams.get("pageSize") ?? "50";

  const page = Number(pageStr);
  const pageSize = Number(pageSizeStr);

  if (!Number.isInteger(page) || page < 1) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "page must be a positive integer.", req, ctx.apiKey.keyId);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "pageSize must be a positive integer.", req, ctx.apiKey.keyId);
  }

  const result = await listMembers(ctx.apiKey.userId!, groupId, {
    page: Math.min(page, 10000),
    pageSize: Math.min(pageSize, 100),
  });
  if (!result) {
    return errorResponse(ctx.requestId, 404, "group_not_found", "Group not found.", req, ctx.apiKey.keyId);
  }

  return okResponse(ctx.requestId, {
    contacts: result.members.map((m) => ({
      id: m.id,
      contact_id: m.contactId,
      contact_email: m.contactEmail,
      contact_name: m.contactName,
      source: m.source,
      added_at: m.createdAt.toISOString(),
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
 * POST /api/v1/groups/:groupId/contacts
 *
 * Add one or many contacts to a group. Idempotent — re-adding an
 * existing member is a no-op. Bulk capped at MAX_BULK_ADD (100).
 */
export const POST = withApiKey("full", async (ctx: ApiContext, req: NextRequest) => {
  const accessErr = await checkGroupAccess(ctx, req);
  if (accessErr) return accessErr;

  const groupId = extractGroupId(req);
  if (!groupId) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid group ID.", req, ctx.apiKey.keyId);
  }

  let body: z.infer<typeof addSchema>;
  try {
    const json = await req.json();
    const result = addSchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
      return errorResponse(ctx.requestId, 400, "validation_failed", msg, req, ctx.apiKey.keyId);
    }
    body = result.data;
  } catch {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid JSON body.", req, ctx.apiKey.keyId);
  }

  const existing = await getGroup(ctx.apiKey.userId!, groupId);
  if (!existing) {
    return errorResponse(ctx.requestId, 404, "group_not_found", "Group not found.", req, ctx.apiKey.keyId);
  }

  if (body.contactId !== undefined) {
    const r = await addContactToGroup(ctx.apiKey.userId!, groupId, body.contactId, "api");
    return okResponse(ctx.requestId, { added: r.added, skipped: !r.added }, r.added ? 201 : 200);
  }

  const r = await bulkAddContactsToGroup(ctx.apiKey.userId!, groupId, body.contactIds!, "api");
  return okResponse(ctx.requestId, { added: r.added, skipped: r.skipped });
}, { securityBucket: "generic" });
