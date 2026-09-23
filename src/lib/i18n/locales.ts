/**
 * Phase 12 — Persian Localization & Regional Experience
 *
 * Core locale identifiers + helper predicates.
 *
 * Design notes:
 * - Locale identifiers are SHORT BCP-47 subtags: `"en"` and `"fa"`.
 *   We DO NOT use full region tags (e.g. `fa-IR`) internally — region/script
 *   is normalized at the boundary in `normalizeLocale`. Internal storage,
 *   cookies, DB columns, and translation dictionaries only ever see `en` | `fa`.
 * - The `mg_locale` cookie is a first-party, bounded, HttpOnly cookie. See
 *   `cookie.ts`. It contains ONLY the locale identifier string.
 * - Service names (Verify / Send / Broadcast / Flow / Audience / Events /
 *   Relay / Insights) remain canonical English product names. They are NOT
 *   translated. Only UI shell strings are localized.
 */

export const SUPPORTED_LOCALES = ["en", "fa"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/**
 * First-party, bounded cookie used to persist the visitor's locale choice
 * across requests. HttpOnly + SameSite=Lax + 1-year Max-Age. Contains ONLY
 * the locale identifier string (e.g. `"fa"`). See `cookie.ts`.
 */
export const LOCALE_COOKIE = "mg_locale";

export const LOCALE_HTML_DIR: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  fa: "rtl",
};

/**
 * Type guard. Narrows an unknown value to `Locale` if it is one of the
 * supported locales. The check is exact string match against the canonical
 * list — never infer a substring.
 */
export function isSupportedLocale(x: unknown): x is Locale {
  if (typeof x !== "string") return false;
  return (SUPPORTED_LOCALES as readonly string[]).includes(x);
}

/**
 * Normalize an arbitrary locale-ish input to a canonical `Locale`.
 *
 * Rules (deterministic):
 *   - `null` / `undefined` / non-string → `DEFAULT_LOCALE` (`"en"`).
 *   - Empty string → `DEFAULT_LOCALE`.
 *   - Case-insensitive: `FA` → `fa`, `EN` → `en`.
 *   - Region tag stripped: `fa-IR` → `fa`, `en-US` → `en`, `fa_IR` → `fa`.
 *   - Bare canonical tag passes through: `fa` → `fa`, `en` → `en`.
 *   - Anything else (unsupported like `de`, `fr`, `ar`) → `DEFAULT_LOCALE`.
 *
 * No regex on the whole string — we split on `-` and `_`, take the primary
 * subtag, lowercase it, and check membership. This is the same algorithm
 * used by `parseAcceptLanguage` for individual entries.
 */
export function normalizeLocale(x: unknown): Locale {
  if (typeof x !== "string") return DEFAULT_LOCALE;
  const trimmed = x.trim();
  if (!trimmed) return DEFAULT_LOCALE;
  // Split on the first `-` or `_` and take the primary subtag.
  const primary = trimmed.split(/[-_]/)[0]?.toLowerCase() ?? "";
  if (primary === "fa") return "fa";
  if (primary === "en") return "en";
  return DEFAULT_LOCALE;
}

/**
 * Whether a locale renders right-to-left. Currently `fa` is RTL; `en` is LTR.
 */
export function isRtlLocale(locale: Locale): boolean {
  return LOCALE_HTML_DIR[locale] === "rtl";
}
