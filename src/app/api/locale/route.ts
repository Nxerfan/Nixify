import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk, ERROR_CODES } from "@/lib/api-response";
import { isSupportedLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n/locales";
import { LOCALE_COOKIE_OPTIONS } from "@/lib/i18n/cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postSchema = z.object({
  locale: z.string().min(1).max(8),
});

/**
 * POST /api/locale
 *
 * Unauthenticated cookie-set endpoint. Used by the LocaleSwitcher when the
 * visitor is NOT logged in (e.g. on the login / signup / landing pages).
 *
 * Body: `{ "locale": "en" | "fa" }`. Reject 400 on invalid.
 *
 * Sets the `mg_locale` cookie (first-party, HttpOnly, SameSite=Lax, 1-year
 * Max-Age) and returns `{ "locale": "<locale>" }`.
 *
 * No auth needed — this is a public preference signal. The cookie is ONLY a
 * locale identifier string; it carries no user identity, no session, no PII.
 *
 * SECURITY:
 *   - Validates the locale against the canonical supported list.
 *   - Bounded Max-Age (1 year) — no infinite cookie.
 *   - HttpOnly — not readable by client-side JS.
 *   - SameSite=Lax — CSRF protection.
 *   - Secure in production.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Invalid JSON body.", 400);
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Locale is required.", 400);
  }
  if (!isSupportedLocale(parsed.data.locale)) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Unsupported locale.", 400);
  }

  const locale: Locale = parsed.data.locale;
  const res = apiOk({ locale });
  res.cookies.set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS);
  return res;
}
