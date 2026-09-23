import { NextRequest } from "next/server";
import {
  withApiKey,
  okResponse,
  errorResponse,
  type ApiContext,
} from "@/lib/dx/request-context";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { removeContactFromGroup, getGroup } from "@/lib/groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
 * Extract :groupId and :contactId from path
 * `/api/v1/groups/[groupId]/contacts/[contactId]`.
 */
function extractParams(req: NextRequest): { groupId: string | null; contactId: number | null } {
  const parts = new URL(req.url).pathname.split("/");
  // ["", "api", "v1", "groups", "<groupId>", "contacts", "<contactId>"]
  const groupId = parts[4] ?? null;
  const contactIdStr = parts[6] ?? null;
  const contactId = Number(contactIdStr);
  return {
    groupId: groupId && groupId !== "contacts" ? groupId : null,
    contactId: Number.isInteger(contactId) && contactId > 0 ? contactId : null,
  };
}

/**
 * DELETE /api/v1/groups/:groupId/contacts/:contactId
 *
 * Remove a contact from a group. Idempotent — removing a non-member
 * is a no-op (200 with removed: false). Returns 404 only if the
 * group itself doesn't exist or belongs to another tenant.
 */
export const DELETE = withApiKey("full", async (ctx: ApiContext, req: NextRequest) => {
  const accessErr = await checkGroupAccess(ctx, req);
  if (accessErr) return accessErr;

  const { groupId, contactId } = extractParams(req);
  if (!groupId) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid group ID.", req, ctx.apiKey.keyId);
  }
  if (!contactId) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid contact ID.", req, ctx.apiKey.keyId);
  }

  const existing = await getGroup(ctx.apiKey.userId!, groupId);
  if (!existing) {
    return errorResponse(ctx.requestId, 404, "group_not_found", "Group not found.", req, ctx.apiKey.keyId);
  }

  const result = await removeContactFromGroup(ctx.apiKey.userId!, groupId, contactId);
  return okResponse(ctx.requestId, { removed: result.removed });
}, { securityBucket: "generic" });
