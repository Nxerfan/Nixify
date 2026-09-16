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
import { resolveRequestUserLocale } from "@/lib/i18n/resolve";
import type { Locale } from "@/lib/i18n/locales";

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
 * POST /api/v1/otp/send
 *
 * Issues a fresh OTP code for the supplied email + purpose, delivers it via the
 * configured mail transport, fires an `otp.sent` webhook, and returns the OTP
 * request_id (which clients use as the verify correlation handle).
 *
 * Sandbox (dev keys only, via `X-Sandbox-Simulate` header): returns the code in
 * the response without sending real mail; can also force simulated errors.
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

    // ---- Real (or sandbox non-error) issuance ----
    let requestId: string;
    let expiresAt: Date;
    let sandboxCode: string | undefined;

    if (isDev) {
      // Dev key (any non-error simulate value, or "none"): sandbox behavior —
      // generate + persist a real OTP row (so /verify works) but DON'T email it;
      // return the plaintext code in the response instead.
      const issued = await issueSandboxOtp(email, purpose, ctx.ip);
      requestId = issued.requestId;
      expiresAt = issued.expiresAt;
      sandboxCode = issued.code;
    } else {
      // Production key: real issuance via issueOtp.
      // Per-email rate limit (3/min, 10/hour) — checked here before any work.
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
        // Phase 13: resolve locale for localized OTP email.
        const locale: Locale = await resolveRequestUserLocale({
          request: req,
          userId: ctx.apiKey.userId ?? null,
        });
        const issued = await issueOtp({
          email,
          purpose,
          userId: ctx.apiKey.userId ?? undefined,
          environment: ctx.apiKey.environment,
          skipEmailRateLimit: true,
          ip: ctx.ip,
          locale,
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
        // SMTP / unknown send errors surface as internal_error.
        return errorResponse(
          ctx.requestId,
          500,
          "internal_error",
          "Failed to send OTP. Please retry.",
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
      data: { purpose },
    };
    deliverWebhook(event, ctx.apiKey.userId ?? undefined).catch(() => {});

    // ---- Rate-limit headers ----
    // The per-account rate limit is enforced by `withApiKey`'s entitlement check
    // (ratePerMin on FEATURE_KEYS.API_MESSAGES). We can't cheaply recompute the
    // exact remaining count here, so we advertise only the limit (3/min for FREE)
    // and the reset epoch — clients should rely on X-RateLimit-Remaining from
    // the withApiKey wrapper for the accurate per-minute count.
    const resetEpoch = Math.floor(Date.now() / 1000) + 60;
    const data: Record<string, unknown> = {
      request_id: requestId,
      message: "OTP sent",
      expires_at: expiresAt.toISOString(),
    };
    if (sandboxCode) data.code = sandboxCode;
    const res = okResponse(ctx.requestId, data);
    return withRateLimitHeaders(res, {
      limit: 3,
      remaining: 0, // accurate count is on the X-Quota-Remaining header from withApiKey
      reset: resetEpoch,
    });
  },
);

/**
 * Sandbox issuance path: generate + persist a real OTP row (so verify works),
 * but DON'T email it — return the plaintext code in the response instead.
 */
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
      codeHash: Uint8Array.from(codeHash),
      purpose,
      attempts: 0,
      maxAttempts: 5,
      expiresAt,
      environment: "development",
      issuedFromIp: ip ?? null,
    },
  });
  return { requestId: created.requestId, code, expiresAt };
}
