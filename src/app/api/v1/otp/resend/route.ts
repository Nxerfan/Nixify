import { NextRequest } from "next/server";
import { z } from "zod";
import {
  withApiKey,
  okResponse,
  errorResponse,
  withRateLimitHeaders,
  type ApiContext,
} from "@/lib/dx/request-context";
import { getSandboxSimulation, type SandboxSimulation } from "@/lib/dx/sandbox";
import { deliverWebhook, type WebhookEvent } from "@/lib/dx/webhooks";
import { issueOtp } from "@/lib/otp/verifier";
import { enforceOtpSendLimits } from "@/lib/ratelimit";
import { generateOtpCode, hashOtpCode } from "@/lib/otp/generator";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Enter a valid email address" })
    .max(254),
  purpose: z.enum(["signup", "login", "reset"]).default("signup"),
});

/** Mask an email for webhook payloads: a***@domain.com */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local[0]}***@${domain}`;
}

/**
 * POST /api/v1/otp/resend
 *
 * Re-issues an OTP for the supplied email + purpose. Shares the same rate-limit,
 * lockout, sandbox, and webhook behavior as /otp/send — the only difference is
 * the `isResend: true` flag passed into issueOtp (so analytics logs "resent"
 * instead of "requested").
 */
export const POST = withApiKey(
  "otp:send",
  async (ctx: ApiContext, req: NextRequest) => {
    // ---- Parse + validate body ----
    let parsed: z.infer<typeof bodySchema>;
    try {
      const json = await req.json();
      const result = bodySchema.safeParse(json);
      if (!result.success) {
        const msg = result.error.issues.map((i) => i.message).join("; ");
        return errorResponse(
          ctx.requestId,
          400,
          "validation_failed",
          msg,
          req,
          ctx.apiKey.keyId,
        );
      }
      parsed = result.data;
    } catch {
      return errorResponse(
        ctx.requestId,
        400,
        "validation_failed",
        "Invalid JSON body",
        req,
        ctx.apiKey.keyId,
      );
    }

    const { email, purpose } = parsed;

    // ---- Sandbox simulation (dev keys only) ----
    const isDev = ctx.apiKey.environment === "development";
    const simulate: SandboxSimulation = isDev
      ? getSandboxSimulation(req)
      : "none";

    if (simulate === "rate_limited") {
      const res = errorResponse(
        ctx.requestId,
        429,
        "rate_limited",
        "Sandbox: rate limit simulated.",
        req,
        ctx.apiKey.keyId,
      );
      res.headers.set("Retry-After", "60");
      return withRateLimitHeaders(res, {
        limit: 3,
        remaining: 0,
        reset: Math.floor(Date.now() / 1000) + 60,
      });
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
    if (simulate === "smtp_error") {
      return errorResponse(
        ctx.requestId,
        500,
        "internal_error",
        "Sandbox: SMTP error simulated.",
        req,
        ctx.apiKey.keyId,
      );
    }

    let requestId: string;
    let expiresAt: Date;
    let sandboxCode: string | undefined;

    if (isDev) {
      const issued = await issueSandboxOtp(email, purpose, ctx.ip);
      requestId = issued.requestId;
      expiresAt = issued.expiresAt;
      sandboxCode = issued.code;
    } else {
      // Per-email rate limit (3/min, 10/hour) — checked before any work.
      const emailLimit = await enforceOtpSendLimits(email);
      if (!emailLimit.allowed) {
        const res = errorResponse(
          ctx.requestId,
          429,
          "rate_limited",
          "Too many OTP requests for this email. Please retry later.",
          req,
          ctx.apiKey.keyId,
        );
        res.headers.set("Retry-After", String(emailLimit.retryAfterSeconds));
        return withRateLimitHeaders(res, {
          limit: emailLimit.limit,
          remaining: 0,
          reset: Math.floor(Date.now() / 1000) + emailLimit.retryAfterSeconds,
        });
      }

      try {
        const issued = await issueOtp({
          email,
          purpose,
          isResend: true,
          skipEmailRateLimit: true,
          ip: ctx.ip,
        });
        requestId = issued.requestId;
        expiresAt = issued.expiresAt;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        const retryAfter = (err as { retryAfter?: number })?.retryAfter;
        if (msg === "rate_limited") {
          const res = errorResponse(
            ctx.requestId,
            429,
            "rate_limited",
            "Too many OTP requests. Please retry later.",
            req,
            ctx.apiKey.keyId,
          );
          if (retryAfter) res.headers.set("Retry-After", String(retryAfter));
          return withRateLimitHeaders(res, {
            limit: 3,
            remaining: 0,
            reset: Math.floor(Date.now() / 1000) + (retryAfter ?? 60),
          });
        }
        if (msg === "locked") {
          return errorResponse(
            ctx.requestId,
            423,
            "locked",
            "OTP locked due to too many failed attempts.",
            req,
            ctx.apiKey.keyId,
          );
        }
        return errorResponse(
          ctx.requestId,
          500,
          "internal_error",
          "Failed to resend OTP. Please retry.",
          req,
          ctx.apiKey.keyId,
        );
      }
    }

    // ---- Fire webhook (best-effort) ----
    const event: WebhookEvent = {
      type: "otp.sent",
      requestId,
      email: maskEmail(email),
      timestamp: new Date().toISOString(),
      data: { purpose, resend: true },
    };
    deliverWebhook(event).catch(() => {});

    // ---- Rate-limit headers ----
    const resetEpoch = Math.floor(Date.now() / 1000) + 60;
    const data: Record<string, unknown> = {
      request_id: requestId,
      message: "OTP resent",
      expires_at: expiresAt.toISOString(),
    };
    if (sandboxCode) data.code = sandboxCode;
    const res = okResponse(ctx.requestId, data);
    return withRateLimitHeaders(res, {
      limit: 3,
      remaining: 2,
      reset: resetEpoch,
    });
  },
);

async function issueSandboxOtp(
  email: string,
  purpose: "signup" | "login" | "reset",
  ip: string | null,
) {
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const created = await db.otpCode.create({
    data: {
      targetEmail: email,
      codeHash,
      purpose,
      attempts: 0,
      maxAttempts: 5,
      expiresAt,
      issuedFromIp: ip ?? null,
    },
  });
  return { requestId: created.requestId, code, expiresAt };
}
