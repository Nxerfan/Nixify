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
 * Phase 13 locale contract (CHOOSE THE RIGHT HELPER):
 *
 *   1. `resolveRequestUserLocale({ request, userId? })` — the CANONICAL
 *      request-aware helper. Use this for any Phase 13 flow triggered by an
 *      HTTP request (e.g. signup OTP email — the User row may not exist yet,
 *      so cookie / Geo / Accept-Language signals determine the locale).
 *      This handles both the "authenticated user" and "signup / no User row"
 *      cases and delegates to `resolveLocale()` with the appropriate signals.
 *
 *   2. `resolveUserLocale(userId)` — the NARROWER stored-preference-only
 *      helper. Use this ONLY in requestless contexts (e.g. a cron job or
 *      background task with no HTTP request). It reads `User.preferredLocale`
 *      and falls back to `DEFAULT_LOCALE` if the preference is null. It does
 *      NOT consult Geo / cookie / Accept-Language because those signals are
 *      unavailable without a request. This is intentionally limited — do NOT
 *      use it for signup flows where the User row may not exist.
 *
 *   Phase 13 request-triggered OTP email MUST use `resolveRequestUserLocale()`.
 *   Phase 13 background/cron flows without a request MAY use
 *   `resolveUserLocale(userId)` with its narrower documented meaning.
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
 * NARROWER stored-preference-only locale resolver.
 *
 * Reads `User.preferredLocale` from the DB. If null, returns `DEFAULT_LOCALE`.
 * Does NOT consult Geo / cookie / Accept-Language — those are request-bound
 * signals that this helper has no access to.
 *
 * Use this helper ONLY in requestless contexts (e.g. a cron job or background
 * task with no HTTP request). For request-triggered flows (e.g. signup OTP
 * email), use `resolveRequestUserLocale({ request, userId? })` instead — it
 * handles the case where the User row may not exist yet.
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


/**
 * Phase 13 contract — request-aware locale resolver for OUT-OF-BAND rendering
 * (e.g. OTP email content) where the user may NOT yet exist (signup flow).
 *
 * This is the canonical helper Phase 13 MUST call. It handles both cases:
 *
 *   1. `userId` exists (authenticated user): loads `User.preferredLocale`
 *      and delegates to `resolveLocale()` with that preference. If the
 *      preference is null, the remaining signals (cookie, Geo, Accept-Language)
 *      are consulted — this handles the "existing user who hasn't set a
 *      preference yet" case.
 *
 *   2. `userId` is null/undefined (signup / first contact — no User row yet):
 *      delegates to `resolveLocale()` with no user preference. The cookie,
 *      Geo, and Accept-Language signals determine the locale. This handles
 *      the "first visit from Iran, no preference, signup OTP" case.
 *
 * Canonical precedence (from `resolveLocale`):
 *   saved preference > explicit request locale > cookie > Geo > Accept-Language > en
 *
 * Phase 13 MUST NOT reimplement Geo or Accept-Language detection. It calls
 * this helper.
 *
 * @param opts.request  The inbound Request (used for cookie, Geo, Accept-Language).
 * @param opts.userId   Optional authenticated user ID. Null/undefined for signup.
 * @returns `"en" | "fa"` only. Never null, never throws.
 */
export async function resolveRequestUserLocale(opts: {
  request: Request;
  userId?: number | null;
}): Promise<Locale> {
  let userPreference: Locale | null = null;

  if (opts.userId != null && Number.isFinite(opts.userId) && opts.userId > 0) {
    const user = await db.user.findUnique({
      where: { id: opts.userId },
      select: { preferredLocale: true },
    });
    if (
      user?.preferredLocale &&
      isSupportedLocale(user.preferredLocale)
    ) {
      userPreference = user.preferredLocale;
    }
  }

  const resolved = resolveLocale({
    userPreference,
    request: opts.request,
  });
  return resolved.locale;
}
