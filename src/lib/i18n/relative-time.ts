/**
 * Locale-aware relative time formatter for dashboard UI.
 *
 * Uses the `Intl.RelativeTimeFormat` API (built into Node.js 12+ and all
 * modern browsers) to produce Persian relative-time text when the current
 * locale is `fa`, and English when `en`.
 *
 * This replaces raw `formatDistanceToNow(..., { addSuffix: true })` from
 * date-fns, which only produces English text.
 *
 * Usage:
 *   const t = useTranslations();
 *   const formatRelative = useRelativeTime();
 *   <span>{formatRelative(date)}</span>
 *   // fa: "۳ دقیقه پیش"
 *   // en: "3 minutes ago"
 */

import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * Format a date as a locale-aware relative time string.
 * Returns "just now" for dates < 60 seconds ago.
 */
export function formatRelativeTime(
  date: Date | string | number,
  locale: "en" | "fa" = "en",
): string {
  const d = typeof date === "string" ? new Date(date) : typeof date === "number" ? new Date(date) : date;
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const absMs = Math.abs(diffMs);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const intlLocale = locale === "fa" ? "fa-IR" : "en-US";

  // "just now" for < 60 seconds
  if (absMs < 60_000) {
    return locale === "fa" ? "همین الان" : "just now";
  }

  const seconds = Math.round(diffMs / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (Math.abs(minutes) < 60) {
    return rtf.format(minutes, "minute");
  }
  if (Math.abs(hours) < 24) {
    return rtf.format(hours, "hour");
  }
  if (Math.abs(days) < 30) {
    return rtf.format(days, "day");
  }

  // For > 30 days, use the locale-formatted absolute date
  return new Intl.DateTimeFormat(intlLocale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * React hook that returns a relative-time formatter bound to the current
 * locale from LocaleProvider.
 */
export function useRelativeTime() {
  const { locale } = useLocale();
  return (date: Date | string | number) => formatRelativeTime(date, locale);
}
