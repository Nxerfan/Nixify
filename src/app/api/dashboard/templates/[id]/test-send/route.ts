import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  sendTransactionalEmail,
  dashboardTestSendSchema,
  MessagingValidationError,
  IdempotencyConflictError,
  MessagingQuotaError,
  SmtpEmailProvider,
  type SendRequest,
} from "@/lib/messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dashboard/templates/:id/test-send
 *
 * Real test send from the dashboard template editor. Consumes MESSAGING_EMAILS
 * (NOT API_MESSAGES — this is not /api/v1). Session-authenticated.
 *
 * Uses the same rendering/provider service as the public API. The template
 * must be owned by the authenticated user (tenant isolation). Source is
 * recorded as "dashboard_test" so it's distinguishable from API sends.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  // MESSAGING_EMAILS access gate (non-consuming — the actual consumption happens
  // inside the service when a delivery is attempted).
  const access = await canAccess(user.id, FEATURE_KEYS.MESSAGING_EMAILS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Transactional messaging is not available on your current account." } },
      { status: 403 },
    );
  }

  const { id: idStr } = await params;
  const templateId = Number(idStr);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid template ID." } },
      { status: 400 },
    );
  }

  let body: z.infer<typeof dashboardTestSendSchema>;
  try {
    const json = await req.json();
    const result = dashboardTestSendSchema.safeParse(json);
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

  // The dashboard route sends to a specific template by ID, not slug. We need
  // to resolve the slug to pass to the service (which resolves by slug+version).
  // Fetch the template (tenant-scoped).
  const { db } = await import("@/lib/db");
  const template = await db.transactionalTemplate.findFirst({
    where: { id: templateId, userId: user.id },
    select: { id: true, slug: true, currentVersion: true },
  });
  if (!template) {
    return NextResponse.json(
      { error: { code: "template_not_found", message: "Template not found." } },
      { status: 404 },
    );
  }

  // Build the send request. Dashboard test-send does NOT require an Idempotency-Key
  // (it's a manual UI action), but we synthesize one per-call so the service's
  // idempotency machinery still works (prevents accidental double-send if the
  // user double-clicks).
  const syntheticKey = `dashboard_${user.id}_${template.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const sendReq: SendRequest = {
    userId: user.id,
    to: body.to,
    templateSlug: template.slug,
    variables: body.variables,
    idempotencyKey: syntheticKey,
    source: "dashboard_test",
    environment: process.env.NODE_ENV === "production" ? "production" : "development",
  };

  try {
    const result = await sendTransactionalEmail(sendReq, new SmtpEmailProvider());

    if (result.status === "sent") {
      return NextResponse.json({
        message_id: result.messageId,
        status: "sent",
        quota_consumed: true,
      }, { status: 201 });
    }
    if (result.status === "failed") {
      return NextResponse.json(
        { error: { code: "delivery_failed", message: "Email delivery failed. Check your SMTP configuration.", error_code: result.errorCode } },
        { status: 502 },
      );
    }
    if (result.status === "rejected") {
      return NextResponse.json(
        { error: { code: result.errorCode ?? "quota_exhausted", message: result.errorMessage ?? "Messaging quota exhausted." } },
        { status: 402 },
      );
    }
    // pending (shouldn't happen — service returns synchronously)
    return NextResponse.json({ message_id: result.messageId, status: "pending" }, { status: 202 });
  } catch (err) {
    if (err instanceof IdempotencyConflictError) {
      return NextResponse.json(
        { error: { code: "idempotency_conflict", message: "Duplicate request detected." } },
        { status: 409 },
      );
    }
    if (err instanceof MessagingQuotaError) {
      const status = err.code === "rate_limited" ? 429 : 402;
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status },
      );
    }
    if (err instanceof MessagingValidationError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "An unexpected error occurred." } },
      { status: 500 },
    );
  }
}
