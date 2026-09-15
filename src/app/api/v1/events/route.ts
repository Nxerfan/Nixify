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
  ingestEvent,
  isValidIdempotencyKey,
  EventValidationError,
  IdempotencyConflictError,
  type IngestEventInput,
} from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/events
 *
 * Ingest a tenant-owned application event. Event ingestion + durable storage
 * only — no automations, no email sending, no webhook fan-out (section 18).
 *
 * Auth: API key with scope "full" (read_only denied).
 * Security bucket: "generic" — IP-block check only, NOT the OTP send limiter.
 * Entitlement: API_MESSAGES consumed by withApiKey middleware; EVENTS_API
 *              checked as non-consuming access gate.
 *
 * Idempotency: Idempotency-Key header REQUIRED (8-128 chars). Same key + same
 * body → 200 replay. Same key + different body → 409 idempotency_conflict.
 *
 * Tenant: ctx.apiKey.userId must be non-null (system keys → owner_required).
 */
export const POST = withApiKey(
  "full",
  async (ctx: ApiContext, req: NextRequest) => {
    // ---- Idempotency-Key header (required) ----
    const idempotencyKey = req.headers.get("idempotency-key") ?? "";
    if (!idempotencyKey) {
      return errorResponse(ctx.requestId, 400, "validation_failed", "Idempotency-Key header is required.", req, ctx.apiKey.keyId);
    }
    if (!isValidIdempotencyKey(idempotencyKey)) {
      return errorResponse(ctx.requestId, 400, "validation_failed", "Idempotency-Key must be 8-128 characters.", req, ctx.apiKey.keyId);
    }

    // ---- Body parsing (loose — the service validates structure) ----
    let body: { type?: string; email?: string; data?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid JSON body.", req, ctx.apiKey.keyId);
    }

    // ---- Tenant ownership (section 5) ----
    if (ctx.apiKey.userId == null) {
      return errorResponse(ctx.requestId, 403, "owner_required", "A user-owned API key is required to create events.", req, ctx.apiKey.keyId);
    }

    // ---- EVENTS_API entitlement (section 4, non-consuming) ----
    const access = await canAccess(ctx.apiKey.userId, FEATURE_KEYS.EVENTS_API);
    if (!access.allowed) {
      return errorResponse(ctx.requestId, 403, "feature_not_available", "Events API is not available on your current account.", req, ctx.apiKey.keyId);
    }

    // ---- Ingest ----
    const input: IngestEventInput = {
      userId: ctx.apiKey.userId, // real User.id, NOT ctx.apiKey.keyId
      type: body.type ?? "",
      email: body.email ?? "",
      data: body.data,
      environment: ctx.apiKey.environment ?? "production",
      idempotencyKey,
      requestId: ctx.requestId,
    };

    try {
      const result = await ingestEvent(input);

      // First insert → 201; idempotent replay → 200
      const status = result.replay ? 200 : 201;
      return okResponse(ctx.requestId, {
        event_id: result.eventId,
        type: result.type,
        email: result.email,
        environment: result.environment,
        created_at: result.createdAt.toISOString(),
        replay: result.replay,
      }, status);
    } catch (err) {
      if (err instanceof IdempotencyConflictError) {
        return errorResponse(ctx.requestId, 409, "idempotency_conflict", "Idempotency-Key was used with a different request body.", req, ctx.apiKey.keyId);
      }
      if (err instanceof EventValidationError) {
        return errorResponse(ctx.requestId, 400, err.code, err.message, req, ctx.apiKey.keyId);
      }
      // Unknown error — never leak raw event data or internals.
      return errorResponse(ctx.requestId, 500, "internal_error", "An unexpected error occurred.", req, ctx.apiKey.keyId);
    }
  },
  // Phase 4 section 19: events uses the "generic" bucket — IP-block check only,
  // NOT the OTP-specific per-email/IP send limiter.
  { securityBucket: "generic" },
);
