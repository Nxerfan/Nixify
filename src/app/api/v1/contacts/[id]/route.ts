import { NextRequest } from "next/server";
import { z } from "zod";
import {
  withApiKey,
  okResponse,
  errorResponse,
  type ApiContext,
} from "@/lib/dx/request-context";
import {
  getContactById,
  updateContact,
  deleteContact,
  getContactTimeline,
  MAX_NAME_LENGTH,
  ContactValidationError,
} from "@/lib/contacts";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().trim().max(MAX_NAME_LENGTH).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

async function checkAccess(ctx: ApiContext, req: NextRequest) {
  if (!ctx.apiKey.userId) {
    return errorResponse(
      ctx.requestId,
      403,
      "feature_not_available",
      "This API key cannot manage Contacts. Use a user-owned API key.",
      req,
      ctx.apiKey.keyId,
    );
  }
  const access = await canAccess(ctx.apiKey.userId, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) {
    return errorResponse(
      ctx.requestId,
      403,
      "feature_not_available",
      "Contacts is not available on your plan.",
      req,
      ctx.apiKey.keyId,
    );
  }
  return null;
}

/**
 * GET /api/v1/contacts/:id
 *
 * Get a single contact by ID. Returns 404 if the contact doesn't exist or
 * belongs to a different user (tenant-safe — no cross-tenant existence leak).
 */
export const GET = withApiKey("full", async (ctx: ApiContext, req: NextRequest) => {
  const accessErr = await checkAccess(ctx, req);
  if (accessErr) return accessErr;

  const id = extractId(req);
  if (!id) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid contact ID.", req, ctx.apiKey.keyId);
  }

  const contact = await getContactById(ctx.apiKey.userId!, id);
  if (!contact) {
    return errorResponse(ctx.requestId, 404, "contact_not_found", "Contact not found.", req, ctx.apiKey.keyId);
  }

  const { events } = await getContactTimeline(ctx.apiKey.userId!, id, { limit: 10 });

  return okResponse(ctx.requestId, {
    id: contact.id,
    email: contact.email,
    name: contact.name,
    attributes: contact.attributes,
    source: contact.source,
    marketing_status: contact.marketingStatus,
    created_at: contact.createdAt.toISOString(),
    updated_at: contact.updatedAt.toISOString(),
    timeline: events.map((e) => ({
      type: e.type,
      detail: e.detail,
      created_at: e.createdAt.toISOString(),
    })),
  });
});

/**
 * PATCH /api/v1/contacts/:id
 */
export const PATCH = withApiKey("full", async (ctx: ApiContext, req: NextRequest) => {
  const accessErr = await checkAccess(ctx, req);
  if (accessErr) return accessErr;

  const id = extractId(req);
  if (!id) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid contact ID.", req, ctx.apiKey.keyId);
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
    const contact = await updateContact(ctx.apiKey.userId!, id, {
      name: body.name,
      attributes: body.attributes as Record<string, unknown> | undefined,
    });

    if (!contact) {
      return errorResponse(ctx.requestId, 404, "contact_not_found", "Contact not found.", req, ctx.apiKey.keyId);
    }

    return okResponse(ctx.requestId, {
      id: contact.id,
      email: contact.email,
      name: contact.name,
      attributes: contact.attributes,
      source: contact.source,
      marketing_status: contact.marketingStatus,
      created_at: contact.createdAt.toISOString(),
      updated_at: contact.updatedAt.toISOString(),
    });
  } catch (e) {
    if (e instanceof ContactValidationError) {
      return errorResponse(ctx.requestId, 400, "validation_failed", e.message, req, ctx.apiKey.keyId);
    }
    return errorResponse(ctx.requestId, 500, "internal_error", "Failed to update contact.", req, ctx.apiKey.keyId);
  }
});

/**
 * DELETE /api/v1/contacts/:id
 */
export const DELETE = withApiKey("full", async (ctx: ApiContext, req: NextRequest) => {
  const accessErr = await checkAccess(ctx, req);
  if (accessErr) return accessErr;

  const id = extractId(req);
  if (!id) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid contact ID.", req, ctx.apiKey.keyId);
  }

  const deleted = await deleteContact(ctx.apiKey.userId!, id);
  if (!deleted) {
    return errorResponse(ctx.requestId, 404, "contact_not_found", "Contact not found.", req, ctx.apiKey.keyId);
  }

  return okResponse(ctx.requestId, { deleted: true });
});

function extractId(req: NextRequest): number | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const idStr = parts[parts.length - 1];
  const id = Number(idStr);
  return Number.isInteger(id) && id > 0 ? id : null;
}
