/**
 * Phase 12 — Translation index.
 *
 * Exports:
 *   - `translations: Record<Locale, Dict>` — the typed dictionaries.
 *   - `translate(locale, key, vars?)` — pure lookup function with English fallback.
 *   - `useTranslations()` — client hook (re-exported from LocaleProvider).
 *   - `useLocale()` — client hook (re-exported from LocaleProvider).
 *   - `LocaleProvider` — client context provider (re-exported).
 *   - `Dict` type (re-exported from `en.ts`).
 *
 * MISSING-KEY BEHAVIOR:
 *   - If `fa` is missing a key, the English value is returned.
 *   - If BOTH dictionaries are missing a key, an empty string is returned
 *     (NEVER `undefined`, NEVER the raw key string, NEVER `[object Object]`).
 *   - In development (`NODE_ENV !== "production"`), a missing key logs a
 *     `console.warn` with the key + locale so the developer can fix it. In
 *     production, no warning is emitted (perf + log hygiene).
 *
 * INTERPOLATION:
 *   - `translate(locale, "auth.signIn.title")` → "Welcome back" / "خوش آمدید"
 *   - `translate(locale, "errors.tooShort")` — no vars.
 *   - Vars are NOT supported in this phase (no `{{name}}` substitution). The
 *     spec does not require it; adding it later requires a syntax decision.
 */

import { en, type Dict } from "./en";
import { fa } from "./fa";
import type { Locale } from "@/lib/i18n/locales";

export const translations: Record<Locale, Dict> = {
  en,
  fa,
};

export type { Dict };

/**
 * Walk a dotted key path (`"auth.signIn.title"`) into a nested object.
 * Returns `undefined` if any segment is missing.
 */
function getPath(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = key.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/**
 * Coerce any value into a render-safe string. NEVER returns `undefined` or
 * `[object Object]`. Objects/arrays → empty string (a missing key returns ""
 * rather than polluting the UI with junk).
 */
function toSafeString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  return "";
}

const isDev = process.env.NODE_ENV !== "production";
const warnedKeys = new Set<string>();

/**
 * Pure translation lookup.
 *
 * @param locale   The target locale.
 * @param key      Dotted key path, e.g. `"auth.signIn.title"`.
 * @returns The translated string. English fallback for missing Persian keys.
 *          Empty string if the key is missing from BOTH dictionaries.
 */
export function translate(locale: Locale, key: string): string {
  const target = translations[locale];
  const primary = getPath(target, key);
  if (typeof primary === "string") return primary;

  // English fallback for the missing key in the target locale.
  const fallback = getPath(en, key);
  if (typeof fallback === "string") {
    if (isDev) {
      const warnKey = `${locale}:${key}`;
      if (!warnedKeys.has(warnKey)) {
        warnedKeys.add(warnKey);
        console.warn(
          `[i18n] Missing translation key "${key}" in locale "${locale}". Falling back to English.`,
        );
      }
    }
    return fallback;
  }

  // Key missing from BOTH dictionaries. Return "" — never the raw key, never
  // `undefined`, never `[object Object]`. Warn loudly in dev.
  if (isDev) {
    const warnKey = `both:${key}`;
    if (!warnedKeys.has(warnKey)) {
      warnedKeys.add(warnKey);
      console.warn(
        `[i18n] Missing translation key "${key}" in BOTH en and fa dictionaries. Rendering empty string.`,
      );
    }
  }
  return "";
}

// Re-export the client-side provider + hooks. The LocaleProvider holds the
// resolved locale in React context and exposes `useLocale()` / `useTranslations()`
// which call `translate()` internally.
export { LocaleProvider, useLocale, useTranslations } from "@/lib/i18n/LocaleProvider";
