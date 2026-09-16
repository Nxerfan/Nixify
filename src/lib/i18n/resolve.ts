/**
 * Phase 12 — Canonical server-side locale resolver.
 *
 * PRECEDENCE (highest to lowest — first signal wins):
 *
 *   1. user_preference  — authenticated user's `User.preferredLocale` (non-null).
 *   2. url              — explicit `?locale=fa` query param (must be a supported locale).
 *   3. cookie           — `mg_locale` first-party cookie (must be a supported locale).
 *   4. geo              — trusted Vercel `x-vercel-ip-country === "IR"` → `fa`.
 *   5. accept_language  — `Accept-Language` header parse.
 *   6. default          — `en`.
 *
 * INVARIANTS:
 *   - Geo NEVER overrides an explicit choice. If the user has explicitly chosen
 *     a locale (user_preference / url / cookie), Geo is not consulted.
 *   - All signal inputs are normalized + validated through `isSupportedLocale`
 *     at the boundary. Unsupported values silently fall through to the next
 *     signal (rather than throwing) — this is correct because a corrupted
 *     cookie value should not 500 a page render.
 *   - The function is PURE: it does not mutate the request, the response, or
 *     the DB. Persistence of the user's choice is the caller's responsibility
 *     (the locale mutation API route).
 *
 * Phase 13 contract — `resolveUserLocale(userId)`:
 *   - Phase 13 (OTP email localization) calls this helper to decide which
 *     language to render the OTP email in.
 *   - It MUST NOT need to re-implement Geo / Accept-Language detection — those
 *     are first-visit hints only and have NO place in the email rendering path
 *     (the user is not visiting a page; they are receiving an email triggered
 *     by an upstream action).
 *   - Returns canonical `"en" | "fa"` only. NULL preference → `DEFAULT_LOCALE`.
 */

import { db } from "@/lib/db";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  type Locale,
} from "./locales";
import { parseAcceptLanguage } from "./accept-language";
import { getGeoLocale } from "./geo";
import { readLocaleCookieFromHeader } from "./cookie";

export type LocaleSource =
  | "user_preference"
  | "url"
  | "cookie"
  | "geo"
  | "accept_language"
  | "default";

export interface ResolveLocaleInput {
  /** Authenticated user's stored preference (already loaded; null if anonymous or no pref). */
  userPreference?: Locale | null;
  /** The full `Request` object — used for URL query, cookie, Geo, Accept-Language. */
  request: Request;
  /** The URL search params, if already extracted. If absent, derived from `request.url`. */
  searchParams?: URLSearchParams;
}

export interface ResolvedLocale {
  locale: Locale;
  source: LocaleSource;
}

/**
 * Extract the `?locale=…` query param and return it if it's a supported locale.
 * Returns `null` otherwise.
 *
 * We intentionally ONLY consult the `locale` query param — not `lang` or other
 * variants — to keep the API surface small and predictable. This param is used
 * by the locale switcher links and the PATCH preference endpoint.
 */
function readUrlLocale(searchParams: URLSearchParams | undefined): Locale | null {
  if (!searchParams) return null;
  const raw = searchParams.get("locale");
  if (!raw) return null;
  return isSupportedLocale(raw) ? raw : null;
}

/**
 * Read the Accept-Language header from a `Request` and return the first
 * supported locale in descending q-value order. Returns `null` if none match.
 */
function readAcceptLanguageLocale(req: Request): Locale | null {
  const header = req.headers.get("accept-language");
  if (!header) return null;
  const list = parseAcceptLanguage(header);
  return list.length > 0 ? list[0] : null;
}

/**
 * Resolve the locale for the current request using the documented precedence.
 *
 * Pure function — does not persist anything. The caller decides whether to
 * write the resolved value to a cookie / DB.
 *
 * @see ResolveLocaleInput for parameters.
 */
export function resolveLocale(opts: ResolveLocaleInput): ResolvedLocale {
  const { request } = opts;
  const searchParams = opts.searchParams ?? new URL(request.url).searchParams;

  // 1. Authenticated user's explicit preference.
  if (opts.userPreference && isSupportedLocale(opts.userPreference)) {
    return { locale: opts.userPreference, source: "user_preference" };
  }

  // 2. Explicit `?locale=fa` URL param.
  const urlLocale = readUrlLocale(searchParams);
  if (urlLocale) {
    return { locale: urlLocale, source: "url" };
  }

  // 3. First-party `mg_locale` cookie (read from the `cookie` HTTP header).
  const cookieLocale = readLocaleCookieFromHeader(request.headers.get("cookie"));
  if (cookieLocale) {
    return { locale: cookieLocale, source: "cookie" };
  }

  // 4. Trusted Geo hint (Iran → fa). NEVER overrides an explicit choice above.
  const geoLocale = getGeoLocale(request);
  if (geoLocale) {
    return { locale: geoLocale, source: "geo" };
  }

  // 5. Accept-Language header parse.
  const alLocale = readAcceptLanguageLocale(request);
  if (alLocale) {
    return { locale: alLocale, source: "accept_language" };
  }

  // 6. Fallback.
  return { locale: DEFAULT_LOCALE, source: "default" };
}

/**
 * Phase 13 contract — resolve a user's preferred locale for OUT-OF-BAND
 * rendering (e.g. OTP email content).
 *
 * Reads `User.preferredLocale` from the DB. If null, returns `DEFAULT_LOCALE`.
 *
 * Phase 13 (OTP email localization) MUST call this helper. It returns canonical
 * `"en" | "fa"` only. Geo / Accept-Language detection has NO place in the
 * email rendering path — the user is not visiting a page; they are receiving an
 * email triggered by an upstream action. The preference column exists exactly
 * for this case.
 *
 * @param userId — the authenticated user's ID (numeric, from the session).
 * @returns `"en" | "fa"`. Never returns null, never throws for missing user.
 */
export async function resolveUserLocale(userId: number): Promise<Locale> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { preferredLocale: true },
  });
  if (!user) return DEFAULT_LOCALE;
  if (user.preferredLocale && isSupportedLocale(user.preferredLocale)) {
    return user.preferredLocale;
  }
  return DEFAULT_LOCALE;
}
