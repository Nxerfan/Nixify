/**
 * Phase 12 — Locale cookie helpers.
 *
 * The `mg_locale` cookie is first-party, bounded, and HttpOnly. It contains
 * ONLY the locale identifier string (`"en"` or `"fa"`). Never anything else.
 *
 * Cookie attributes:
 *   - HttpOnly      — not readable by client-side JS (XSS protection).
 *   - Secure        — only sent over HTTPS (production). HTTP allowed in dev.
 *   - SameSite=Lax  — CSRF protection, allows top-level navigation.
 *   - Path=/        — available app-wide.
 *   - Max-Age=31536000  — 1 year (seconds).
 *
 * The cookie is used by `resolveLocale` as ONE of several signals (in
 * priority order: user_preference > url > cookie > geo > accept_language >
 * default). See `resolve.ts`.
 */

import type { Locale } from "./locales";
import { isSupportedLocale, LOCALE_COOKIE } from "./locales";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365; // 31536000

interface CookieSetter {
  set: (
    name: string,
    value: string,
    options: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "lax" | "strict" | "none";
      path?: string;
      maxAge?: number;
    },
  ) => void;
}

/**
 * Set the `mg_locale` cookie on a `Response` (Next.js `NextResponse` or a
 * standard `Response`). Validates the locale before writing — invalid locales
 * are silently ignored (the caller already validated, but we double-check
 * here as defense-in-depth).
 *
 * The cookie value is the bare locale identifier string ONLY.
 */
export function setLocaleCookie<T extends CookieSetter>(res: T, locale: Locale): T {
  if (!isSupportedLocale(locale)) return res;
  res.set(LOCALE_COOKIE, locale, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  return res;
}

/**
 * Minimal interface for "something that exposes a `cookies.get(name)` accessor"
 * — Next.js `NextRequest`, `Request` polyfill, or our test stubs.
 */
export interface LocaleCookieReader {
  cookies: {
    get: (name: string) => { value: string | undefined } | undefined;
  };
}

/**
 * Read the `mg_locale` cookie from a Next.js `NextRequest`-like object.
 * Returns `null` if the cookie is absent or contains an unsupported locale.
 *
 * The returned value is the bare locale identifier string ONLY — we never
 * accept additional data from the cookie (e.g. the cookie value cannot
 * contain a JSON object, an email, or a user ID).
 */
export function readLocaleCookie(req: LocaleCookieReader): Locale | null {
  const c = req.cookies.get(LOCALE_COOKIE);
  const value = c?.value;
  if (typeof value !== "string") return null;
  if (!isSupportedLocale(value)) return null;
  return value;
}

/**
 * Read the `mg_locale` cookie value from a raw `cookie` HTTP header string.
 *
 * Used by `resolveLocale` which works with a synthetic `Request` constructed
 * from `headers()` — that Request only exposes the cookie via the `cookie`
 * HTTP header (not via a `.cookies` accessor). Parses the header with a
 * bounded scan — does NOT use a regex on the whole string (we walk it
 * token-by-token to avoid edge cases around quoted values, escaping, etc.).
 *
 * Returns `null` if the `mg_locale` cookie is absent or contains an
 * unsupported locale.
 */
export function readLocaleCookieFromHeader(cookieHeader: string | null): Locale | null {
  if (!cookieHeader) return null;
  // Cookie header format: "name1=value1; name2=value2; ..."
  for (const pair of cookieHeader.split(";")) {
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name === LOCALE_COOKIE) {
      if (isSupportedLocale(value)) return value;
      return null;
    }
  }
  return null;
}

/**
 * Returns the cookie options object that `setLocaleCookie` uses. Exported for
 * the API route handler which writes the cookie via `NextResponse.json()`
 * (the `cookies.set` API surface uses the same option shape).
 */
export const LOCALE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: ONE_YEAR_SECONDS,
};
