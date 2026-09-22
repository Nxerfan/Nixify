/**
 * Phase 13 — Localized OTP email copy + pure renderer.
 *
 * This module is the SINGLE source of truth for OTP email copy across all
 * supported locales and purposes. The renderer is PURE — it accepts
 * `{ locale, purpose, code, expiresInMinutes, appName, email }` and returns
 * `{ subject, text, html }`. No DB access, no transport, no side effects.
 *
 * DESIGN INVARIANTS:
 *
 * 1. TYPE-SAFE COPY TABLE. `Record<Locale, Record<OtpEmailPurpose, OtpEmailCopy>>`.
 *    Missing locale/purpose combinations fail typecheck. The copy table is
 *    exhaustive — there is no fallback to undefined.
 *
 * 2. OTP REMAINS ASCII. The 6-digit OTP code is always ASCII `0-9`. Persian
 *    numerals are NOT used for the code. The code is wrapped in `<span dir="ltr">`
 *    in HTML so it renders correctly inside RTL Persian text.
 *
 * 3. HTML DIRECTIONALITY. Persian HTML uses `<html lang="fa" dir="rtl">`.
 *    English uses `<html lang="en" dir="ltr">`.
 *
 * 4. PURPOSE IS EXPLICIT. `sign_up`, `sign_in`, and `password_reset` are
 *    distinct semantic purposes. Sign-up copy says "sign-up verification code".
 *    Sign-in copy says "sign-in code". They are NOT interchangeable.
 *
 * 5. NO LOCALE DETECTION HERE. This module does NOT resolve the locale from
 *    the request — that is `resolveRequestUserLocale()` in
 *    `src/lib/i18n/resolve.ts`. The caller passes the already-resolved locale.
 *
 * 6. SECURITY UNCHANGED. Locale is presentation context only. The OTP code,
 *    HMAC, TTL, attempt limit, and single-use semantics are NOT affected by
 *    locale. Changing language must not invalidate a valid OTP.
 */

import type { Locale } from "@/lib/i18n/locales";

// ---- Types ----------------------------------------------------------------

/**
 * Bounded semantic OTP email purpose.
 *
 * - `sign_up` — user is creating a new account (signup OTP).
 * - `sign_in` — user is signing in to an existing account (login OTP).
 * - `password_reset` — user is resetting their password (reset OTP).
 *
 * This is DISTINCT from `OtpPurpose` in `generator.ts` (which uses
 * `"signup" | "login" | "reset"` — the DB-level purpose). The mapping is:
 *   "signup" → "sign_up"
 *   "login" → "sign_in"
 *   "reset" → "password_reset"
 *
 * The mapping lives in `purposeToEmailPurpose()` below.
 */
export type OtpEmailPurpose = "sign_up" | "sign_in" | "password_reset" | "account_deletion";

/**
 * Map the DB-level `OtpPurpose` to the email-level `OtpEmailPurpose`.
 *
 * This is the single point where the DB enum is translated to the email enum.
 * Callers pass the DB purpose; the renderer receives the email purpose.
 */
export function purposeToEmailPurpose(
  dbPurpose: "signup" | "login" | "reset" | "account_deletion",
): OtpEmailPurpose {
  switch (dbPurpose) {
    case "signup":
      return "sign_up";
    case "login":
      return "sign_in";
    case "reset":
      return "password_reset";
    case "account_deletion":
      return "account_deletion";
  }
}

export interface OtpEmailCopy {
  subject: string;
  /** Plain-text body. Must agree with HTML on locale, purpose, code, expiry. */
  text: (code: string, expiresInMinutes: number, appName: string, email: string) => string;
  /** HTML body. Must agree with text on locale, purpose, code, expiry. */
  html: (code: string, expiresInMinutes: number, appName: string, email: string) => string;
}

export interface RenderOtpEmailInput {
  locale: Locale;
  purpose: OtpEmailPurpose;
  code: string;
  expiresInMinutes?: number;
  appName?: string;
  email?: string;
}

export interface RenderedOtpEmail {
  subject: string;
  text: string;
  html: string;
}

// ---- Copy table -----------------------------------------------------------
//
// Exhaustive: every Locale × OtpEmailPurpose combination has a typed entry.
// TypeScript enforces completeness — removing a key fails typecheck.

const OTP_EMAIL_COPY: Record<Locale, Record<OtpEmailPurpose, OtpEmailCopy>> = {
  en: {
    sign_up: {
      subject: "Nixify sign-up verification code",
      text: (code, mins, appName, email) =>
        [
          `${appName}`,
          "",
          `Your ${appName} sign-up verification code is: ${code}`,
          "",
          `This code expires in ${mins} minutes.`,
          "",
          `If you didn't request this code, you can safely ignore this email —`,
          `no account has been created.`,
          "",
          `This message was sent to ${email}.`,
        ].join("\n"),
      html: (code, mins, appName, email) =>
        renderHtml({
          lang: "en",
          dir: "ltr",
          appName,
          heading: "Verify your email",
          actionText: `Use this code to verify your email address. It expires in ${mins} minutes.`,
          code,
          expiryText: `This code expires in ${mins} minutes.`,
          footerText: "If you didn't request this code, you can safely ignore this email. No account has been created.",
          email,
        }),
    },
    sign_in: {
      subject: "Nixify sign-in code",
      text: (code, mins, appName, email) =>
        [
          `${appName}`,
          "",
          `Your ${appName} sign-in code is: ${code}`,
          "",
          `This code expires in ${mins} minutes.`,
          "",
          `If you didn't request this code, you can safely ignore this email —`,
          `no one has signed in to your account.`,
          "",
          `This message was sent to ${email}.`,
        ].join("\n"),
      html: (code, mins, appName, email) =>
        renderHtml({
          lang: "en",
          dir: "ltr",
          appName,
          heading: "Sign-in code",
          actionText: `Use this code to sign in to your account. It expires in ${mins} minutes.`,
          code,
          expiryText: `This code expires in ${mins} minutes.`,
          footerText: "If you didn't request this code, you can safely ignore this email. No one has signed in to your account.",
          email,
        }),
    },
    password_reset: {
      subject: "Nixify password reset code",
      text: (code, mins, appName, email) =>
        [
          `${appName}`,
          "",
          `Your ${appName} password reset code is: ${code}`,
          "",
          `This code expires in ${mins} minutes.`,
          "",
          `If you didn't request this code, you can safely ignore this email —`,
          `your password has not been changed.`,
          "",
          `This message was sent to ${email}.`,
        ].join("\n"),
      html: (code, mins, appName, email) =>
        renderHtml({
          lang: "en",
          dir: "ltr",
          appName,
          heading: "Reset your password",
          actionText: `Use this code to reset your password. It expires in ${mins} minutes.`,
          code,
          expiryText: `This code expires in ${mins} minutes.`,
          footerText: "If you didn't request this code, you can safely ignore this email. Your password has not been changed.",
          email,
        }),
    },
    account_deletion: {
      subject: "Nixify account deletion code",
      text: (code, mins, appName, email) =>
        [
          `${appName}`,
          "",
          `Your ${appName} account deletion verification code is: ${code}`,
          "",
          `This code expires in ${mins} minutes.`,
          "",
          `If you didn't request this code, you can safely ignore this email —`,
          `your account has not been deleted.`,
          "",
          `This message was sent to ${email}.`,
        ].join("\n"),
      html: (code, mins, appName, email) =>
        renderHtml({
          lang: "en",
          dir: "ltr",
          appName,
          heading: "Delete your account",
          actionText: `Use this code to confirm account deletion. It expires in ${mins} minutes.`,
          code,
          expiryText: `This code expires in ${mins} minutes.`,
          footerText: "If you didn't request this code, you can safely ignore this email. Your account has not been deleted.",
          email,
        }),
    },
  },
  fa: {
    sign_up: {
      subject: "کد تأیید ثبت‌نام Nixify",
      text: (code, mins, appName, email) =>
        [
          `${appName}`,
          "",
          `کد تأیید ثبت‌نام شما در ${appName}: ${code}`,
          "",
          `این کد تا ${toPersianDigits(mins)} دقیقه معتبر است.`,
          "",
          `اگر این درخواست را شما ارسال نکرده‌اید، می‌توانید این ایمیل را نادیده بگیرید —`,
          `هیچ حساب کاربری ایجاد نشده است.`,
          "",
          `این پیام به ${email} ارسال شد.`,
        ].join("\n"),
      html: (code, mins, appName, email) =>
        renderHtml({
          lang: "fa",
          dir: "rtl",
          appName,
          heading: "تأیید ایمیل",
          actionText: `از این کد برای تأیید آدرس ایمیل خود استفاده کنید. این کد تا ${toPersianDigits(mins)} دقیقه معتبر است.`,
          code,
          expiryText: `این کد تا ${toPersianDigits(mins)} دقیقه معتبر است.`,
          footerText: "اگر این درخواست را شما ارسال نکرده‌اید، می‌توانید این ایمیل را نادیده بگیرید. هیچ حساب کاربری ایجاد نشده است.",
          email,
        }),
    },
    sign_in: {
      subject: "کد ورود Nixify",
      text: (code, mins, appName, email) =>
        [
          `${appName}`,
          "",
          `کد ورود شما به ${appName}: ${code}`,
          "",
          `این کد تا ${toPersianDigits(mins)} دقیقه معتبر است.`,
          "",
          `اگر این درخواست را شما ارسال نکرده‌اید، می‌توانید این ایمیل را نادیده بگیرید —`,
          `هیچ‌کس وارد حساب شما نشده است.`,
          "",
          `این پیام به ${email} ارسال شد.`,
        ].join("\n"),
      html: (code, mins, appName, email) =>
        renderHtml({
          lang: "fa",
          dir: "rtl",
          appName,
          heading: "کد ورود",
          actionText: `از این کد برای ورود به حساب کاربری خود استفاده کنید. این کد تا ${toPersianDigits(mins)} دقیقه معتبر است.`,
          code,
          expiryText: `این کد تا ${toPersianDigits(mins)} دقیقه معتبر است.`,
          footerText: "اگر این درخواست را شما ارسال نکرده‌اید، می‌توانید این ایمیل را نادیده بگیرید. هیچ‌کس وارد حساب شما نشده است.",
          email,
        }),
    },
    password_reset: {
      subject: "کد بازنشانی رمز عبور Nixify",
      text: (code, mins, appName, email) =>
        [
          `${appName}`,
          "",
          `کد بازنشانی رمز عبور شما در ${appName}: ${code}`,
          "",
          `این کد تا ${toPersianDigits(mins)} دقیقه معتبر است.`,
          "",
          `اگر این درخواست را شما ارسال نکرده‌اید، می‌توانید این ایمیل را نادیده بگیرید —`,
          `رمز عبور شما تغییر نکرده است.`,
          "",
          `این پیام به ${email} ارسال شد.`,
        ].join("\n"),
      html: (code, mins, appName, email) =>
        renderHtml({
          lang: "fa",
          dir: "rtl",
          appName,
          heading: "بازنشانی رمز عبور",
          actionText: `از این کد برای بازنشانی رمز عبور خود استفاده کنید. این کد تا ${toPersianDigits(mins)} دقیقه معتبر است.`,
          code,
          expiryText: `این کد تا ${toPersianDigits(mins)} دقیقه معتبر است.`,
          footerText: "اگر این درخواست را شما ارسال نکرده‌اید، می‌توانید این ایمیل را نادیده بگیرید. رمز عبور شما تغییر نکرده است.",
          email,
        }),
    },
    account_deletion: {
      subject: "کد حذف حساب Nixify",
      text: (code, mins, appName, email) =>
        [
          `${appName}`,
          "",
          `کد تأیید حذف حساب ${appName} شما: ${code}`,
          "",
          `این کد در ${toPersianDigits(mins)} دقیقه منقضی می‌شود.`,
          "",
          `اگر این درخواست را ارسال نکرده‌اید، می‌توانید این ایمیل را نادیده بگیرید —`,
          `حساب شما حذف نشده است.`,
          "",
          `این پیام به ${email} ارسال شد.`,
        ].join("\n"),
      html: (code, mins, appName, email) =>
        renderHtml({
          lang: "fa",
          dir: "rtl",
          appName,
          heading: "حذف حساب",
          actionText: `از این کد برای تأیید حذف حساب استفاده کنید. این کد در ${toPersianDigits(mins)} دقیقه منقضی می‌شود.`,
          code,
          expiryText: `این کد در ${toPersianDigits(mins)} دقیقه منقضی می‌شود.`,
          footerText: "اگر این درخواست را ارسال نکرده‌اید، می‌توانید این ایمیل را نادیده بگیرید. حساب شما حذف نشده است.",
          email,
        }),
    },
  },
};

/**
 * Convert a number to Persian digits for display in prose (e.g. "۱۰ دقیقه").
 *
 * Uses `Intl.NumberFormat("fa-IR")` which produces correct Persian (Farsi)
 * digits (U+06F0–U+06F9), NOT Arabic-Indic digits (U+0660–U+0669).
 *
 * Previous implementation used `String.fromCharCode(d.charCodeAt(0) + 0x0630)`
 * which produced Arabic-Indic digits (٠١٢...) instead of Persian digits
 * (۰۱۲...). The offset was wrong: ASCII '0' is U+0030, Arabic-Indic '٠' is
 * U+0660 (offset +0x0630), but Persian '۰' is U+06F0 (offset +0x06C0).
 *
 * IMPORTANT: this is ONLY used for the expiry-minutes number in the surrounding
 * prose — NEVER for the OTP code itself. The OTP code must remain ASCII.
 */
function toPersianDigits(n: number): string {
  return new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(n);
}

// ---- HTML renderer --------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml(opts: {
  lang: string;
  dir: "ltr" | "rtl";
  appName: string;
  heading: string;
  actionText: string;
  code: string;
  expiryText: string;
  footerText: string;
  email: string;
}): string {
  const { lang, dir, appName, heading, actionText, code, expiryText, footerText, email } = opts;
  const codeHtml = escapeHtml(code);
  const appNameHtml = escapeHtml(appName);
  const headingHtml = escapeHtml(heading);
  const actionTextHtml = escapeHtml(actionText);
  const expiryHtml = escapeHtml(expiryText);
  const footerHtml = escapeHtml(footerText);
  const emailHtml = escapeHtml(email);

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="x-app" content="${appNameHtml}"/><title>${headingHtml}</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,'Vazirmatn','Tahoma',sans-serif;color:#0f172a;">
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
<p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#475569;">${actionTextHtml}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
<tr><td style="background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:20px;text-align:center;">
<span dir="ltr" style="font-size:34px;font-weight:700;letter-spacing:10px;color:#059669;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${codeHtml}</span>
</td></tr>
</table>
<p style="margin:0 0 6px 0;font-size:13px;color:#64748b;">${expiryHtml}</p>
</td></tr>
<tr><td style="padding:0 28px 28px 28px;">
<p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">${footerHtml}</p>
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

// ---- Pure renderer --------------------------------------------------------

/**
 * Render an OTP email for the given locale + purpose.
 *
 * PURE: no DB, no transport, no side effects. The caller passes the
 * already-resolved locale and the already-generated code.
 *
 * @param opts.locale   The resolved locale ("en" | "fa").
 * @param opts.purpose  The semantic email purpose ("sign_up" | "sign_in" | "password_reset").
 * @param opts.code     The 6-digit OTP code (ASCII digits — never Persian numerals).
 * @param opts.expiresInMinutes  TTL in minutes (default 10).
 * @param opts.appName  The app name for branding (default "Nixify").
 * @param opts.email    The recipient email (for the footer).
 * @returns `{ subject, text, html }` — all three agree on locale + purpose.
 */
export function renderOtpEmail(opts: RenderOtpEmailInput): RenderedOtpEmail {
  const {
    locale,
    purpose,
    code,
    expiresInMinutes = 10,
    appName = "Nixify",
    email = "",
  } = opts;

  const copy = OTP_EMAIL_COPY[locale][purpose];

  return {
    subject: copy.subject,
    text: copy.text(code, expiresInMinutes, appName, email),
    html: copy.html(code, expiresInMinutes, appName, email),
  };
}

// ---- Export for tests -----------------------------------------------------

export { OTP_EMAIL_COPY };
