import { NextRequest } from "next/server";
import { z } from "zod";
import {
  withApiKey,
  okResponse,
  errorResponse,
  type ApiContext,
} from "@/lib/dx/request-context";
import { getSandboxSimulation } from "@/lib/dx/sandbox";
import { deliverWebhook, type WebhookEvent } from "@/lib/dx/webhooks";
import { consumeOtp } from "@/lib/otp/verifier";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: "Enter a valid email address" }).max(254),
  code: z.string().trim().regex(/^\d{6}$/, { message: "Code must be exactly 6 digits" }),
  purpose: z.enum(["signup", "login", "reset"]).default("signup"),
});

/** Mask an email for webhook payloads: a***@domain.com */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local[0]}***@${domain}`;
}

/**
 * Find the most recent OTP correlation ID for SANDBOX SIMULATION ONLY.
 *
 * This helper is used ONLY for sandbox-simulated outcomes (mismatch/expired)
 * that occur BEFORE `consumeOtp()` is called. It is environment-scoped to
 * `development` (sandbox is only available with dev keys).
 *
 * Real verification MUST use `result.requestId` from `consumeOtp()` — NEVER
 * this helper. This prevents cross-environment ID drift and race conditions.
 *
 * Returns `null` if no OTP row exists (the sandbox webhook will omit the
 * correlation ID rather than fabricating one from the API trace ID).
 */
async function latestSandboxOtpRequestId(
  email: string,
  purpose: string,
): Promise<string | null> {
  const latest = await db.otpCode.findFirst({
    where: {
      targetEmail: email,
      purpose,
      OR: [
        { environment: "development" },
        { environment: null },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { requestId: true },
  });
  return latest?.requestId ?? null;
}

/**
 * POST /api/v1/otp/verify
 *
 * Validates a 6-digit OTP against the latest unconsumed code for the email. On
 * success, fires `otp.verified`; on mismatch, fires `otp.failed`; on expiry,
 * fires `otp.expired`.
 *
 * OTP correlation identity (`otp_request_id` / webhook `requestId`) for real
 * verification comes from `consumeOtp().requestId` — the EXACT OTP row that was
 * evaluated/consumed. This is NOT a separate DB lookup, preventing
 * cross-environment drift and race conditions.
 *
 * Sandbox (dev keys only, via `X-Sandbox-Simulate`): can force mismatch / expired
 * / locked outcomes without calling consumeOtp. Sandbox correlation uses
 * `latestSandboxOtpRequestId()` (environment-scoped to development).
 */
export const POST = withApiKey("otp:verify", async (ctx: ApiContext, req: NextRequest) => {
  // ---- Parse + validate body ----
  let parsed: z.infer<typeof bodySchema>;
  try {
    const json = await req.json();
    const result = bodySchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
      return errorResponse(ctx.requestId, 400, "validation_failed", msg, req, ctx.apiKey.keyId);
    }
    parsed = result.data;
  } catch {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid JSON body", req, ctx.apiKey.keyId);
  }

  const { email, code, purpose } = parsed;

  // ---- Sandbox simulation (dev keys only) ----
  // These branches fire BEFORE consumeOtp — they use a sandbox-scoped lookup
  // for webhook correlation. Real verification (below) uses result.requestId.
  const isDev = ctx.apiKey.environment === "development";
  const simulate = isDev ? getSandboxSimulation(req) : "none";

  if (simulate === "mismatch") {
    // Only emit a webhook when a real sandbox OTP row exists — never
    // fabricate a correlation ID from the API trace ID. If no OTP row
    // exists for this email+purpose, skip the webhook entirely.
    const sandboxOtpId = await latestSandboxOtpRequestId(email, purpose);
    if (sandboxOtpId) {
      const event: WebhookEvent = {
        type: "otp.failed",
        requestId: sandboxOtpId,
        email: maskEmail(email),
        timestamp: new Date().toISOString(),
        data: { purpose, reason: "mismatch" },
      };
      deliverWebhook(event, ctx.apiKey.userId ?? undefined).catch(() => {});
    }
    return errorResponse(
      ctx.requestId,
      400,
      "code_mismatch",
      "Sandbox: code mismatch simulated.",
      req,
      ctx.apiKey.keyId,
    );
  }
  if (simulate === "expired") {
    // Same as mismatch — only emit when a real sandbox OTP row exists.
    const sandboxOtpId = await latestSandboxOtpRequestId(email, purpose);
    if (sandboxOtpId) {
      const event: WebhookEvent = {
        type: "otp.expired",
        requestId: sandboxOtpId,
        email: maskEmail(email),
        timestamp: new Date().toISOString(),
        data: { purpose },
      };
      deliverWebhook(event, ctx.apiKey.userId ?? undefined).catch(() => {});
    }
    return errorResponse(
      ctx.requestId,
      410,
      "expired",
      "Sandbox: OTP expired simulated.",
      req,
      ctx.apiKey.keyId,
    );
  }
  if (simulate === "locked") {
    return errorResponse(
      ctx.requestId,
      423,
      "locked",
      "Sandbox: locked simulated.",
      req,
      ctx.apiKey.keyId,
    );
  }

  // ---- Real verification ----
  // consumeOtp returns the requestId of the EXACT OTP row it evaluated/consumed.
  // This is the single source of OTP correlation identity — no second lookup.
  let result;
  try {
    result = await consumeOtp({
      email,
      code,
      purpose,
      environment: ctx.apiKey.environment,
      ip: ctx.ip,
    });
  } catch {
    return errorResponse(
      ctx.requestId,
      500,
      "internal_error",
      "Verification failed unexpectedly. Please retry.",
      req,
      ctx.apiKey.keyId,
    );
  }

  // The OTP correlation ID from the exact row consumeOtp evaluated.
  const otpRequestId = result.requestId;

  if (result.ok && result.decision === "valid") {
    const event: WebhookEvent = {
      type: "otp.verified",
      requestId: otpRequestId ?? "",
      email: maskEmail(email),
      timestamp: new Date().toISOString(),
      data: { purpose },
    };
    deliverWebhook(event, ctx.apiKey.userId ?? undefined).catch(() => {});
    return okResponse(ctx.requestId, { verified: true, otp_request_id: otpRequestId });
  }

  if (result.decision === "mismatch") {
    const event: WebhookEvent = {
      type: "otp.failed",
      requestId: otpRequestId ?? "",
      email: maskEmail(email),
      timestamp: new Date().toISOString(),
      data: { purpose, reason: "mismatch" },
    };
    deliverWebhook(event, ctx.apiKey.userId ?? undefined).catch(() => {});
    return errorResponse(
      ctx.requestId,
      400,
      "code_mismatch",
      "The code you entered is incorrect.",
      req,
      ctx.apiKey.keyId,
    );
  }

  if (result.decision === "expired") {
    const event: WebhookEvent = {
      type: "otp.expired",
      requestId: otpRequestId ?? "",
      email: maskEmail(email),
      timestamp: new Date().toISOString(),
      data: { purpose },
    };
    deliverWebhook(event, ctx.apiKey.userId ?? undefined).catch(() => {});
    return errorResponse(
      ctx.requestId,
      410,
      "expired",
      "The code has expired. Request a new one.",
      req,
      ctx.apiKey.keyId,
    );
  }

  if (result.decision === "locked") {
    const res = errorResponse(
      ctx.requestId,
      423,
      "locked",
      "Too many failed attempts. Please try again later.",
      req,
      ctx.apiKey.keyId,
    );
    if (result.retryAfterSeconds) res.headers.set("Retry-After", String(result.retryAfterSeconds));
    return res;
  }

  if (result.decision === "already_used") {
    return errorResponse(
      ctx.requestId,
      409,
      "already_used",
      "This code has already been used.",
      req,
      ctx.apiKey.keyId,
    );
  }

  if (result.decision === "not_found") {
    return errorResponse(
      ctx.requestId,
      404,
      "not_found",
      "No active code found for this email. Request a new OTP.",
      req,
      ctx.apiKey.keyId,
    );
  }

  // Fallback (should not happen).
  return errorResponse(
    ctx.requestId,
    500,
    "internal_error",
    "Unexpected verification outcome.",
    req,
    ctx.apiKey.keyId,
  );
});
