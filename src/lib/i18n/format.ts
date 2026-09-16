/**
 * Phase 12 — Date / number / relative-time formatting helpers.
 *
 * Uses `Intl.*Format` with the locale (`en` / `fa`) and Gregorian calendar.
 * We do NOT switch to the Jalali calendar in this phase (spec §24 — explicit
 * decision). Persian locale uses Persian digits where natural (via
 * `Intl.NumberFormat`), but timestamps stay canonical ISO in the DB.
 *
 * INVARIANTS:
 *   - Technical data (IDs, OTP codes, API keys, HTTP statuses, emails, URLs,
 *     code) stays canonical ASCII. NO global regex replacement of digits.
 *   - These helpers are PURE: same inputs → same outputs. They do not read
 *     `process.env`, do not consult the DB, do not mutate state.
 *   - All formatting falls back gracefully on environments where ICU data may
 *     differ (Node versions, edge runtime). If `Intl` throws, the helper
 *     returns the canonical input unchanged.
 */

import type { Locale } from "./locales";

/**
 * Format an ISO date string (or Date) for display in the given locale.
 *
 * Uses Gregorian calendar (the default for `Intl.DateTimeFormat` in `en` /
 * `fa` unless `calendar: "persian"` is explicitly requested — we never set
 * that). Persian locale produces Persian digit glyphs where natural.
 *
 * `dateISO` is a string because the canonical storage form in this codebase is
 * ISO 8601 (`DateTime` columns → `.toISOString()`). We accept `Date` too.
 *
 * Returns a string. If `Intl` is unavailable or throws, returns the canonical
 * input (ISO string or `.toString()`).
 */
export function formatDate(
  locale: Locale,
  dateISO: string | Date,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  try {
    const date = typeof dateISO === "string" ? new Date(dateISO) : dateISO;
    if (Number.isNaN(date.getTime())) {
      return typeof dateISO === "string" ? dateISO : dateISO.toString();
    }
    const formatter = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      ...opts,
    });
    return formatter.format(date);
  } catch {
    return typeof dateISO === "string" ? dateISO : String(dateISO);
  }
}

/**
 * Format a number for display in the given locale.
 *
 * Use this for human-facing counts (e.g. "1,234" in `en`, "۱٬۲۳۴" in `fa`).
 * DO NOT use this for technical identifiers — those stay canonical ASCII.
 *
 * If `Intl` throws, returns `String(n)`.
 */
export function formatNumber(
  locale: Locale,
  n: number,
  opts: Intl.NumberFormatOptions = {},
): string {
  try {
    const formatter = new Intl.NumberFormat(locale, opts);
    return formatter.format(n);
  } catch {
    return String(n);
  }
}

/**
 * Format a date as a relative time string ("2 minutes ago", "3 days ago").
 *
 * Persian locale produces localized relative phrases via `Intl.RelativeTimeFormat`.
 *
 * If `Intl` throws or the input is invalid, returns the canonical ISO string.
 */
export function formatRelativeTime(locale: Locale, dateISO: string | Date): string {
  try {
    const date = typeof dateISO === "string" ? new Date(dateISO) : dateISO;
    if (Number.isNaN(date.getTime())) {
      return typeof dateISO === "string" ? dateISO : dateISO.toString();
    }
    const now = Date.now();
    const diffMs = date.getTime() - now;
    const diffSec = Math.round(diffMs / 1000);
    const absSec = Math.abs(diffSec);

    // Choose the largest sensible unit.
    const units: { unit: Intl.RelativeTimeFormatUnit; sec: number }[] = [
      { unit: "year", sec: 60 * 60 * 24 * 365 },
      { unit: "month", sec: 60 * 60 * 24 * 30 },
      { unit: "week", sec: 60 * 60 * 24 * 7 },
      { unit: "day", sec: 60 * 60 * 24 },
      { unit: "hour", sec: 60 * 60 },
      { unit: "minute", sec: 60 },
      { unit: "second", sec: 1 },
    ];
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    for (const { unit, sec } of units) {
      if (absSec >= sec || unit === "second") {
        const value = Math.round(diffSec / sec);
        return rtf.format(value, unit);
      }
    }
    return rtf.format(0, "second");
  } catch {
    return typeof dateISO === "string" ? dateISO : String(dateISO);
  }
}

// Re-export the Ltr helper for caller convenience (single import surface).
export { Ltr } from "./Ltr";
