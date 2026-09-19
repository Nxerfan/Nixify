import { db } from "@/lib/db";
import {
  generateOtpCode,
  hashOtpCode,
  decideOtp,
  OTP_LOCKOUT_MS,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  type OtpPurpose,
  type OtpDecision,
} from "@/lib/otp/generator";
import { createMailTransport, assertMailConfig, type MailTransport } from "@/lib/mail/transport";
import { enforceOtpSendLimits, enforceOtpVerifyLimits } from "@/lib/ratelimit";
import {
  checkAccountLock,
  countRecentFailedVerifies,
  lockAccountForBruteForce,
  logEvent,
  SECURITY_CONFIG,
} from "@/lib/security";
import { logOtpEvent } from "@/lib/analytics";
import { enqueueOtpVerifiedJob } from "@/lib/automation";
import { renderOtpEmail, purposeToEmailPurpose, type OtpEmailPurpose } from "@/lib/otp/email-renderer";
import type { Locale } from "@/lib/i18n/locales";

/**
 * OTP verification engine (doc Phase 10 / §6).
 *
 * Two entry points:
 *   - `issueOtp()`: generate a fresh code, store its HMAC, rate-limit, email it.
 *   - `consumeOtp()`: constant-time verify, increment attempts every check, and
 *     atomically mark the code consumed so it can't validate twice — even under
 *     concurrent requests (guarded `UPDATE ... WHERE consumedAt IS NULL`).
 *
 * `decideOtp()` is a pure decision function extracted for unit testing.
 */

export interface IssueOtpOptions {
  email: string;
  purpose: OtpPurpose;
  userId?: number;
  /** Inject a transport for tests (§13.5). Defaults to the app transport. */
  transport?: MailTransport;
  /** Override the display name in the email body. */
  appName?: string;
  /** True when this is a resend (logs "resent" instead of "requested"). */
  isResend?: boolean;
  /** Skip the internal enforceOtpSendLimits call — used when the caller has
   *  already checked per-email rate limits (e.g. v1 API routes). Prevents
   *  double-counting the same request against the rate limit bucket. */
  skipEmailRateLimit?: boolean;
  /** Client IP for analytics + audit. */
  ip?: string | null;
  /** Environment scoping ("development" | "production" | undefined).
   *  When set, the OTP row is tagged with this value so verify can enforce the
   *  test/live boundary — a `mg_test_` key cannot verify a `mg_live_` OTP and
   *  vice versa. Undefined for web-auth flows (backward-compatible with both
   *  test and live keys for legacy web auth). */
  environment?: string;
  /**
   * Phase 13 — REQUIRED locale for email rendering.
   *
   * Every production caller MUST pass an explicit locale:
   *   - First-party web auth: `resolveRequestUserLocale({ request, userId })`
   *   - v1 server-to-server API: `"en"` (Phase 13 contract — English unless
   *     an explicit recipient-locale API contract exists)
   *   - Requestless internal callers: `resolveUserLocale(userId)` or
   *     `DEFAULT_LOCALE`
   *
   * There is NO silent English fallback when locale is omitted — the type
   * system enforces that every caller passes it. This prevents the class of
   * bug where a caller (e.g. /api/v1/otp/resend) silently forgets locale and
   * falls back to English.
   */
  locale: Locale;
}

export interface IssueOtpResult {
  requestId: string;
  /** The plaintext code. Returned ONLY so the caller can hand it to the mail
   *  transport. It is never persisted, never logged by production transports. */
  code: string;
  expiresAt: Date;
}

export async function issueOtp(opts: IssueOtpOptions): Promise<IssueOtpResult> {
  const { email, purpose, userId } = opts;

  // Entitlement: check OTP email quota + rate limit (plan-gated).
  if (userId) {
    const { checkUsage } = await import("@/lib/entitlements/engine");
    const { FEATURE_KEYS: FK } = await import("@/lib/entitlements/config");
    const usage = await checkUsage(userId, FK.OTP_EMAILS);
    if (!usage.allowed) {
      const err = new Error(
        usage.reason === "rate_limited" ? "rate_limited" : "quota_exceeded",
      );
      (err as any).retryAfter = usage.resetAt
        ? Math.ceil((usage.resetAt.getTime() - Date.now()) / 1000)
        : undefined;
      throw err;
    }
  }

  // Rate limit before doing any work (skip if the caller already checked).
  if (!opts.skipEmailRateLimit) {
    const limit = await enforceOtpSendLimits(email);
    if (!limit.allowed) {
      const err = new Error("rate_limited");
      (err as any).retryAfter = limit.retryAfterSeconds;
      throw err;
    }
  }

  // Lockout: if the most recent code for this email+purpose hit max attempts
  // within the lockout window, refuse to issue a new one.
  // §Env scoping: when `environment` is set, lockout is scoped to OTP rows in
  // the same environment (or legacy null environment) — a dev lockout MUST NOT
  // block production issuance. Web-auth (no environment) matches any row.
  const lockRemaining = await lockoutRemainingMs(email, purpose, opts.environment);
  if (lockRemaining > 0) {
    const err = new Error("locked");
    (err as any).retryAfter = Math.ceil(lockRemaining / 1000);
    throw err;
  }

  // Validate ALL required mail config BEFORE any DB writes or code generation.
  // This ensures SMTP_HOST/PORT/USER/PASS/FROM are checked early — before
  // hashOtpCode() (which needs OTP_PEPPER) and before db.otpCode.create().
  // If any env var is missing, the error is thrown here with a clear message.
  if (!opts.transport) {
    assertMailConfig();
  }

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  // Create the mail transport BEFORE persisting the OTP row.
  const transport = opts.transport ?? createMailTransport();

  const created = await db.otpCode.create({
    data: {
      targetEmail: email,
      codeHash: Uint8Array.from(codeHash),
      purpose,
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt,
      userId: userId ?? null,
      environment: opts.environment ?? null,
    },
  });
  const appName = opts.appName ?? process.env.APP_NAME ?? "Nixify";

  // Phase 13: ONE canonical rendering pipeline.
  //
  // The locale is passed INTO `renderEmailForPurpose` (not used to bypass it).
  // The pipeline resolves BrandKit appName + active EmailTheme exactly as
  // before, then:
  //   - If a custom EmailTheme exists → render using that theme (user content
  //     is NOT auto-translated — it's user-generated content).
  //   - If NO custom theme → fall back to the localized system renderer
  //     (`renderOtpEmail`) which produces Persian or English copy based on
  //     the locale + purpose.
  //
  // This preserves branding/theme behavior while adding localization to the
  // system fallback copy.
  const { subject, text, html } = await renderEmailForPurpose({
    appName,
    code,
    purpose,
    expiresAt,
    email,
    userId: userId ?? null,
    locale: opts.locale,
  });

  // Log "requested" (or "resent") event — include userId for analytics scoping.
  await logOtpEvent({
    requestId: created.requestId,
    email,
    eventType: opts.isResend ? "resent" : "requested",
    status: "success",
    purpose,
    ip: opts.ip ?? null,
    userId: userId ?? null,
  });

  try {
    await transport.send({ to: email, subject, text, html });
    await logOtpEvent({
      requestId: created.requestId,
      email,
      eventType: "sent",
      status: "success",
      purpose,
      ip: opts.ip ?? null,
      userId: userId ?? null,
    });
  } catch (sendErr) {
    await logOtpEvent({
      requestId: created.requestId,
      email,
      eventType: "sent",
      status: "error",
      purpose,
      ip: opts.ip ?? null,
      detail: sendErr instanceof Error ? sendErr.message : "unknown send error",
      userId: userId ?? null,
    });
    throw sendErr;
  }

  return { requestId: created.requestId, code, expiresAt };
}

export interface ConsumeOtpOptions {
  email: string;
  code: string;
  purpose: OtpPurpose;
  /** Inject for tests. */
  pepperOverride?: string;
  /** Client IP for analytics + audit. */
  ip?: string | null;
  /** Environment scoping — when set, only OTP rows whose `environment` matches
   *  (or is null for legacy rows) are eligible for verification. Enforces the
   *  test/live boundary: a `mg_test_` key cannot verify a `mg_live_` OTP and
   *  vice versa. Web-auth flows leave this undefined (matches any row). */
  environment?: string;
}

export interface ConsumeOtpResult {
  ok: boolean;
  decision: OtpDecision;
  userId?: number;
  /** Seconds to wait before retrying, when rate-limited/locked. */
  retryAfterSeconds?: number;
  /**
   * The `requestId` (OTP correlation ID) of the exact OTP row that was
   * evaluated/consumed. This is the SAME row used for the decision — NOT a
   * separate lookup. Returns `undefined` when no OTP row was found
   * (`decision === "not_found"` with no row) or when the decision was made
   * before any OTP row was loaded (e.g. account lock).
   *
   * Route handlers MUST use this value for `otp_request_id` in the response
   * and for webhook correlation — NEVER a second independent DB lookup.
   */
  requestId?: string;
}

export async function consumeOtp(
  opts: ConsumeOtpOptions,
): Promise<ConsumeOtpResult> {
  const { email, code, purpose } = opts;
  const pepper = opts.pepperOverride ?? getPepper();

  // §9 — temporary account lock: if the account is locked, refuse all verifies.
  const lock = await checkAccountLock(email);
  if (lock.locked) {
    const retryAfter = lock.until
      ? Math.ceil((lock.until.getTime() - Date.now()) / 1000)
      : undefined;
    return { ok: false, decision: "locked", retryAfterSeconds: retryAfter };
  }

  // Rate limit verify attempts.
  const limit = await enforceOtpVerifyLimits(email);
  if (!limit.allowed) {
    return {
      ok: false,
      decision: "not_found",
      retryAfterSeconds: limit.retryAfterSeconds,
    };
  }

  // Fetch the latest unconsumed code for this email+purpose.
  // When `environment` is provided (v1 API key context), enforce the test/live
  // boundary: only rows whose environment matches OR is null (legacy/web-auth
  // rows) are eligible. This prevents a `mg_test_` key from verifying a
  // `mg_live_` OTP and vice versa. When `environment` is undefined (web-auth
  // flow), match any row for backward compatibility.
  const where: Record<string, unknown> = { targetEmail: email, purpose };
  if (opts.environment !== undefined) {
    where.OR = [
      { environment: opts.environment },
      { environment: null },
    ];
  }
  const latest = await db.otpCode.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const decision = decideOtp(latest, code, pepper, now);

  if (
    decision === "not_found" ||
    decision === "already_used" ||
    decision === "expired"
  ) {
    // No state change needed (no matching live code / already dead).
    if (decision === "expired" && latest) {
      await logOtpEvent({
        requestId: latest.requestId,
        email,
        eventType: "expired",
        status: "error",
        purpose,
        ip: opts.ip ?? null,
        detail: "Code expired before verification",
        userId: latest.userId ?? null,
      });
    }
    return { ok: false, decision, requestId: latest?.requestId };
  }

  if (decision === "locked") {
    const retryAfter = await lockoutRemainingMs(email, purpose, opts.environment);
    return {
      ok: false,
      decision: "locked",
      retryAfterSeconds: Math.ceil(retryAfter / 1000),
      requestId: latest?.requestId,
    };
  }

  // `mismatch` or `valid`: increment attempts (§6 — increment on every check).
  await db.otpCode.update({
    where: { id: latest!.id },
    data: { attempts: { increment: 1 } },
  });

  if (decision === "mismatch") {
    // Log the failed attempt.
    await logOtpEvent({
      requestId: latest!.requestId,
      email,
      eventType: "failed",
      status: "error",
      purpose,
      ip: opts.ip ?? null,
      detail: "Incorrect code entered",
      userId: latest!.userId ?? null,
    });
    // Re-check lockout after the increment so the client gets a clear signal.
    const refreshed = await db.otpCode.findUnique({
      where: { id: latest!.id },
    });
    if (refreshed && refreshed.attempts >= refreshed.maxAttempts) {
      return {
        ok: false,
        decision: "locked",
        retryAfterSeconds: Math.ceil(OTP_LOCKOUT_MS / 1000),
        requestId: latest!.requestId,
      };
    }
    // ---- Brute-force protection (§8) + temporary account lock (§9) ----
    const totalFails = await countRecentFailedVerifies(email);
    if (totalFails >= SECURITY_CONFIG.BRUTE_FORCE_MAX_FAILS) {
      await lockAccountForBruteForce(email);
      return {
        ok: false,
        decision: "locked",
        retryAfterSeconds: Math.ceil(SECURITY_CONFIG.ACCOUNT_LOCK_MS / 1000),
        requestId: latest!.requestId,
      };
    }
    return { ok: false, decision: "mismatch", requestId: latest!.requestId };
  }

  // decision === "valid": atomically mark consumed ONLY if still unconsumed.
  const consumed = await db.otpCode.updateMany({
    where: { id: latest!.id, consumedAt: null },
    data: { consumedAt: now },
  });

  if (consumed.count === 0) {
    return { ok: false, decision: "already_used", requestId: latest!.requestId };
  }

  // Log successful verification with duration (issue→verify latency).
  const durationMs = latest!.createdAt
    ? now.getTime() - latest!.createdAt.getTime()
    : null;
  await logOtpEvent({
    requestId: latest!.requestId,
    email,
    eventType: "verified",
    status: "success",
    purpose,
    ip: opts.ip ?? null,
    durationMs,
    userId: latest!.userId ?? null,
  });

  // ---- Phase 5 hook: enqueue otp_verified orchestration job ----
  // Fire-and-forget. OTP verification success MUST NOT depend on this.
  // The enqueue is idempotent (dedupeKey = otp_verified:<otpCodeId>).
  // Contact sync, ContactEvent, and automation send happen asynchronously
  // in the job processor — never inside the OTP verification transaction.
  if (latest!.userId) {
    try {
      await enqueueOtpVerifiedJob({
        otpCodeId: latest!.id,
        userId: latest!.userId,
        email,
        environment: opts.environment ?? null,
        purpose,
      });
    } catch {
      // Fire-and-forget — OTP success is unaffected by downstream failures.
    }
  }

  return { ok: true, decision: "valid", userId: latest!.userId ?? undefined, requestId: latest!.requestId };
}

/**
 * Milliseconds remaining in the lockout window for the latest code of this
 * email+purpose. Returns 0 if not locked.
 *
 * §Env scoping: when `environment` is provided, the lockout query is scoped to
 * OTP rows in the same environment OR rows with a null environment (legacy
 * web-auth rows). This prevents a development OTP lockout from blocking
 * production issuance/verification and vice versa. When `environment` is
 * undefined (web-auth flow), the query matches any row — backward compatible.
 */
export async function lockoutRemainingMs(
  email: string,
  purpose: OtpPurpose,
  environment?: string,
): Promise<number> {
  const where: Record<string, unknown> = { targetEmail: email, purpose };
  if (environment !== undefined) {
    where.OR = [
      { environment },
      { environment: null },
    ];
  }
  const latest = await db.otpCode.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return 0;
  if (latest.attempts < latest.maxAttempts) return 0;
  if (latest.consumedAt) return 0; // a consumed (used) code is not a lockout
  const lockUntil = new Date(latest.createdAt.getTime() + OTP_LOCKOUT_MS);
  const remaining = lockUntil.getTime() - Date.now();
  return remaining > 0 ? remaining : 0;
}

function getPepper(): string {
  const pepper = process.env.OTP_PEPPER;
  if (!pepper) throw new Error("Missing required env var: OTP_PEPPER");
  return pepper;
}

// ---- Email rendering ------------------------------------------------------
//
// The email is the single biggest deliverability lever we control from the
// application. This renderer produces:
//   - A clean subject WITHOUT the code (industry norm; avoids spammy
//     "...is 123456" subject patterns and keeps the code off lock-screen
//     previews).
//   - A complete plain-text body (some filters penalize HTML-only mail).
//   - A professional, table-based HTML layout with inline CSS (email-client
//     compatible), a branded header, a prominent code box, and a footer with
//     the "why you received this" + "not you? ignore" notes.
//
// See docs/EMAIL-DELIVERABILITY.md for the full strategy.

function renderDefaultOtpEmail(opts: {
  appName: string;
  code: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  email: string;
}): { subject: string; text: string; html: string } {
  const { appName, code, purpose, expiresAt, email } = opts;

  const actionLabel =
    purpose === "signup"
      ? "verify your email address"
      : purpose === "reset"
        ? "reset your password"
        : "sign in to your account";

  const heading =
    purpose === "signup"
      ? "Verify your email"
      : purpose === "reset"
        ? "Reset your password"
        : "Sign-in code";

  // Clean subject — no code in the subject line.
  const subject = `${appName}: ${heading}`;

  // ---- Plain text (complete, with footer) ----
  const expiresFriendly = formatExpiry(expiresAt);
  const text = [
    `${appName}`,
    "",
    `${heading}`,
    "",
    `Use this 6-digit code to ${actionLabel}:`,
    "",
    `    ${code}`,
    "",
    `This code expires in 10 minutes (${expiresFriendly}).`,
    "",
    `If you didn't request this code, you can safely ignore this email —`,
    `no one has logged in to your account.`,
    "",
    `This message was sent to ${email} because someone entered this address`,
    `on ${appName}.`,
  ].join("\n");

  // ---- HTML (professional, email-client compatible) ----
  const html = renderOtpHtml({
    appName,
    heading,
    actionLabel,
    code,
    expiresFriendly,
    email,
  });

  return { subject, text, html };
}

/** Format the expiry as a friendly, timezone-aware-ish string. */
function formatExpiry(expiresAt: Date): string {
  try {
    return expiresAt.toUTCString();
  } catch {
    return expiresAt.toISOString();
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderOtpHtml(opts: {
  appName: string;
  heading: string;
  actionLabel: string;
  code: string;
  expiresFriendly: string;
  email: string;
}): string {
  const { appName, heading, actionLabel, code, expiresFriendly, email } = opts;
  const codeHtml = escapeHtml(code);
  const appNameHtml = escapeHtml(appName);
  const headingHtml = escapeHtml(heading);
  const emailHtml = escapeHtml(email);

  // Table-based layout (email clients still need tables for reliable layout).
  // All CSS is inline (many clients strip <style> blocks).
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="x-app" content="${appNameHtml}"/><title>${headingHtml}</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
<tr><td style="background-color:#059669;padding:20px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">${appNameHtml}</td>
<td align="right" style="font-size:12px;color:#d1fae5;">Secure verification</td>
</tr></table>
</td></tr>
<tr><td style="padding:32px 28px 8px 28px;">
<h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#0f172a;">${headingHtml}</h1>
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#475569;">Use the code below to ${escapeHtml(actionLabel)}. It expires in 10 minutes.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
<tr><td style="background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:20px;text-align:center;">
<span style="font-size:34px;font-weight:700;letter-spacing:10px;color:#059669;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${codeHtml}</span>
</td></tr>
</table>
<p style="margin:0 0 6px 0;font-size:13px;color:#64748b;">Expires: ${escapeHtml(expiresFriendly)}</p>
</td></tr>
<tr><td style="padding:0 28px 28px 28px;">
<p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">If you didn't request this code, you can safely ignore this email. No one has logged in to your account.</p>
</td></tr>
<tr><td style="padding:18px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
<p style="margin:0 0 4px 0;font-size:12px;color:#64748b;line-height:1.5;">This message was sent to <strong>${emailHtml}</strong> because someone entered this address on ${appNameHtml}.</p>
<p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">Add this address to your contacts to keep future codes out of spam.</p>
</td></tr>
</table>
<p style="margin:16px 0 0 0;font-size:11px;color:#94a3b8;text-align:center;">&copy; ${new Date().getFullYear()} ${appNameHtml}. All rights reserved.</p>
</td></tr>
</table>
</body>
</html>`;
}

// ---- Email Customization integration --------------------------------------
/**
 * Resolve the active theme for the given purpose and render the email. If no
 * custom theme is active, falls back to the default `renderOtpEmail`.
 *
 * This is the bridge between the Email Customization System and the OTP engine.
 * The theme lookup is best-effort — if it fails, the default renderer runs.
 */
async function renderEmailForPurpose(opts: {
  appName: string;
  code: string;
  purpose: string;
  expiresAt: Date;
  email: string;
  userId?: number | null;
  /** Phase 13: locale for the system fallback renderer. Required. */
  locale: Locale;
}): Promise<{ subject: string; text: string; html: string }> {
  // ---- 1. Resolve effective appName based on user's plan ----
  let effectiveAppName = opts.appName;
  if (opts.userId) {
    try {
      const { getUserPlan } = await import("@/lib/entitlements/engine");
      const plan = await getUserPlan(opts.userId);
      if (plan === "FREE") {
        // FREE users always see the system app name
        effectiveAppName = process.env.APP_NAME ?? "Nixify";
      } else {
        // PRO/MAX users can use their Brand Kit's appName
        const { db } = await import("@/lib/db");
        const brandKit = await db.brandKit.findUnique({
          where: { userId: opts.userId },
        });
        if (brandKit?.appName && brandKit.appName.trim() !== "") {
          effectiveAppName = brandKit.appName;
        }
      }
    } catch {
      // best-effort: fall back to the passed appName
    }
  }

  // Subject is resolved AFTER the theme lookup — if no custom theme,
  // the localized renderer provides the subject. If a custom theme exists,
  // we use the theme's subject (from the English heading — themes are
  // user-generated content and are NOT auto-translated).
  let subject = "";

  // Phase 13 audit: SEPARATE theme lookup (best-effort) from theme rendering
  // (must NOT silently fall through to a different email).
  //
  // If the theme LOOKUP fails (DB unavailable, query error), we fall through
  // to the localized system fallback — this is the existing intended contract.
  //
  // But once a theme has been SELECTED, rendering failure (bad JSON config,
  // renderer throw) is a CORRECTNESS FAILURE — the error propagates and
  // issueOtp() rejects. The transport is NEVER called. We do NOT silently
  // substitute a different email when the user has configured a custom theme
  // that fails to render.

  let theme: { config: string } | null = null;

  // ---- Theme LOOKUP (best-effort — failure falls through to fallback) ----
  try {
    const { db } = await import("@/lib/db");
    const ownerFilter = opts.userId
      ? { OR: [{ userId: opts.userId }, { userId: null }] }
      : { userId: null };

    theme = await db.emailTheme.findFirst({
      where: {
        isActive: true,
        purpose: opts.purpose,
        ...ownerFilter,
      },
      orderBy: [{ userId: "desc" }, { createdAt: "desc" }],
    });

    if (!theme) {
      // Fall back to user's (or system's) "all" theme.
      theme = await db.emailTheme.findFirst({
        where: {
          isActive: true,
          purpose: "all",
          ...ownerFilter,
        },
        orderBy: [{ userId: "desc" }, { createdAt: "desc" }],
      });
    }
  } catch {
    // Lookup failure (DB unavailable) — fall through to system fallback.
    // This is the existing best-effort contract for theme availability.
    theme = null;
  }

  // ---- Theme RENDERING (NO silent catch — failure propagates) ----
  if (theme) {
    // A theme was SELECTED. Rendering failure is a correctness failure —
    // the error propagates and issueOtp() rejects. The transport is NEVER
    // called with a different email.
    const { renderThemeHtml, renderThemeText } =
      await import("@/lib/email-themes/renderer");
    const config = JSON.parse(theme.config);
    const html = renderThemeHtml(config, {
      code: opts.code,
      email: opts.email,
      expiresAt: opts.expiresAt,
      appName: effectiveAppName,
      mode: "auto",
    });
    const text = renderThemeText(config, {
      code: opts.code,
      email: opts.email,
      expiresAt: opts.expiresAt,
      appName: effectiveAppName,
    });
    const heading =
      opts.purpose === "signup"
        ? "Verify your email"
        : opts.purpose === "reset"
          ? "Reset your password"
          : "Sign-in code";
    return { subject: `${effectiveAppName}: ${heading}`, text, html };
  }

  // No custom theme → use the localized system renderer.
  // The locale controls the language (en/fa) of the system fallback copy.
  // The effectiveAppName (from BrandKit or system default) is passed through.
  const emailPurpose = purposeToEmailPurpose(opts.purpose as OtpPurpose);
  const fallback = renderOtpEmail({
    locale: opts.locale,
    purpose: emailPurpose,
    code: opts.code,
    expiresInMinutes: Math.round(OTP_TTL_MS / 60000),
    appName: effectiveAppName,
    email: opts.email,
  });
  return fallback;
}
