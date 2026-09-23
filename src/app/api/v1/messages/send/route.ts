import { NextRequest } from "next/server";
import { z } from "zod";
import {
  withApiKey,
  okResponse,
  errorResponse,
  type ApiContext,
} from "@/lib/dx/request-context";
import {
  sendTransactionalEmail,
  sendV1Schema,
  isValidIdempotencyKey,
  MessagingValidationError,
  IdempotencyConflictError,
  MessagingQuotaError,
  SmtpEmailProvider,
  type SendRequest,
} from "@/lib/messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/messages/send
 *
 * Send a transactional email from a Phase 3 template. Real SMTP delivery.
 *
 * Auth: API key with scope "full" (read_only denied).
 * Security bucket: "generic" — IP-block check only, NOT the OTP send limiter.
 * Entitlement: API_MESSAGES consumed by withApiKey middleware; MESSAGING_EMAILS
 *              consumed by the service only when a real delivery is attempted.
 *
 * Idempotency: Idempotency-Key header REQUIRED (8-128 chars). Same key + same
 * body returns the existing message (no double-send, no double-consume).
 * Same key + different body → 409 idempotency_conflict.
 *
 * Tenant: ctx.apiKey.userId must be non-null (system keys → owner_required).
 * Production: a development key (mg_test_) is rejected with live_key_required.
 */
export const POST = withApiKey(
  "full",
  async (ctx: ApiContext, req: NextRequest) => {
    // ---- Idempotency-Key header (required for v1 messaging) ----
    const idempotencyKey = req.headers.get("idempotency-key") ?? "";
    if (!idempotencyKey) {
      return errorResponse(ctx.requestId, 400, "validation_failed", "Idempotency-Key header is required.", req, ctx.apiKey.keyId);
    }
    if (!isValidIdempotencyKey(idempotencyKey)) {
      return errorResponse(ctx.requestId, 400, "validation_failed", "Idempotency-Key must be 8-128 characters.", req, ctx.apiKey.keyId);
    }

    // ---- Body validation ----
    let body: z.infer<typeof sendV1Schema>;
    try {
      const json = await req.json();
      const result = sendV1Schema.safeParse(json);
      if (!result.success) {
        const msg = result.error.issues.map((i) => i.message).join("; ");
        return errorResponse(ctx.requestId, 400, "validation_failed", msg, req, ctx.apiKey.keyId);
      }
      body = result.data;
    } catch {
      return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid JSON body.", req, ctx.apiKey.keyId);
    }

    // ---- Tenant ownership (section 5) ----
    // ctx.apiKey.userId must be non-null. System keys (userId=null) cannot send.
    if (ctx.apiKey.userId == null) {
      return errorResponse(ctx.requestId, 403, "owner_required", "A user-owned API key is required to send transactional email.", req, ctx.apiKey.keyId);
    }

    // ---- Test vs live key (section 6) ----
    if (process.env.NODE_ENV === "production" && ctx.apiKey.environment !== "production") {
      return errorResponse(ctx.requestId, 403, "live_key_required", "A production API key is required to send transactional email in production.", req, ctx.apiKey.keyId);
    }

    // ---- Send ----
    const sendReq: SendRequest = {
      userId: ctx.apiKey.userId, // real User.id, NOT ctx.apiKey.keyId
      to: body.to,
      templateSlug: body.template_slug,
      templateVersion: body.template_version,
      variables: body.variables,
      idempotencyKey,
      requestId: ctx.requestId,
      source: "api_v1",
      environment: ctx.apiKey.environment,
    };

    try {
      const result = await sendTransactionalEmail(sendReq, new SmtpEmailProvider());

      // Idempotent replay of a pending message → 202 (in-progress)
      if (result.replay && result.status === "pending") {
        return okResponse(ctx.requestId, { message_id: result.messageId, status: "pending" }, 202);
      }

      // Idempotent replay of a finished message → 200 with existing status
      if (result.replay) {
        return okResponse(ctx.requestId, { message_id: result.messageId, status: result.status });
      }

      // First-time send — succeeded
      if (result.status === "sent") {
        return okResponse(ctx.requestId, { message_id: result.messageId, status: "sent" }, 201);
      }

      // First-time send — provider failed (502 delivery_failed, no raw error text)
      if (result.status === "failed") {
        return errorResponse(ctx.requestId, 502, "delivery_failed", "Email delivery failed. Please try again later.", req, ctx.apiKey.keyId);
      }

      // rejected (quota) — handled by the catch below via MessagingQuotaError
      return errorResponse(ctx.requestId, 502, "delivery_failed", "Email delivery failed.", req, ctx.apiKey.keyId);
    } catch (err) {
      if (err instanceof IdempotencyConflictError) {
        return errorResponse(ctx.requestId, 409, "idempotency_conflict", "Idempotency-Key was used with a different request body.", req, ctx.apiKey.keyId);
      }
      if (err instanceof MessagingQuotaError) {
        const status = err.code === "rate_limited" ? 429 : 402;
        return errorResponse(ctx.requestId, status, err.code, err.message, req, ctx.apiKey.keyId);
      }
      if (err instanceof MessagingValidationError) {
        return errorResponse(ctx.requestId, 400, err.code, err.message, req, ctx.apiKey.keyId);
      }
      // Unknown error — never leak details.
      return errorResponse(ctx.requestId, 500, "internal_error", "An unexpected error occurred.", req, ctx.apiKey.keyId);
    }
  },
  // Phase 4 section 19: messaging uses the "generic" bucket — IP-block check
  // only, NOT the OTP-specific per-email/IP send limiter.
  { securityBucket: "generic" },
);
