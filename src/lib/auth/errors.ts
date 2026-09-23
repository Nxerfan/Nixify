/**
 * Auth error localization helper.
 *
 * Maps machine error codes (from the API `error` field) to localized
 * user-facing messages using the canonical translation dictionaries.
 *
 * The API returns: { error: "machine_code", message: "English text" }
 * This helper ignores the English `message` and uses the `error` code
 * to select the correct localized string for the current locale.
 *
 * Unknown error codes fall back to a generic localized message.
 */
import { translate } from "@/i18n";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Map a machine error code + locale to a localized user-facing message.
 *
 * @param errorCode - The machine error code from the API (e.g. "rate_limited",
 *                     "mail_config_missing"). May be undefined for network errors.
 * @param locale - The current UI locale ("en" or "fa").
 * @returns A localized human-readable message.
 */
export function localizeAuthError(
  errorCode: string | undefined,
  locale: Locale,
): string {
  if (!errorCode) {
    return translate(locale, "errors.authErrors.network");
  }

  // Build the translation key: errors.authErrors.<code>
  const key = `errors.authErrors.${errorCode}`;
  const localized = translate(locale, key);

  // If the key doesn't exist in the dictionary, translate returns ""
  // (or falls back to English). If we get an empty string or the key
  // itself back, use the generic fallback.
  if (localized && localized !== errorCode) {
    return localized;
  }

  return translate(locale, "errors.authErrors.generic");
}
