/**
 * Shared analytics-consent helpers.
 *
 * The consent value lives in localStorage under `mg_cookie_consent`. Because
 * the browser `storage` event does NOT fire in the same document that called
 * `setItem`, we also dispatch a custom `window` event (`mg-consent-change`)
 * so in-tab listeners (ConsentAnalytics) update immediately when the
 * CookieConsent banner calls `setConsent(...)`.
 *
 * Cross-tab updates still use the native `storage` event (ConsentAnalytics
 * listens to both).
 */

export const CONSENT_KEY = "mg_cookie_consent";
export const CONSENT_CHANGE_EVENT = "mg-consent-change";

export type ConsentValue = "accepted" | "declined";

/**
 * Read the persisted consent value. Returns null if no choice has been made
 * or localStorage is unavailable.
 */
export function readConsent(): ConsentValue | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "accepted" || v === "declined") return v;
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist the consent choice AND notify same-tab listeners immediately.
 *
 * The native `storage` event fires in OTHER tabs/windows but NOT this one, so
 * we dispatch a custom `window` event for same-tab updates. The custom event
 * carries the new value in `detail`.
 */
export function setConsent(value: ConsentValue): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // localStorage unavailable (private mode, etc.) — the in-memory choice
    // still propagates via the custom event so the current tab updates.
  }
  // Same-tab notification. Cross-tab is handled by the native storage event.
  window.dispatchEvent(
    new CustomEvent(CONSENT_CHANGE_EVENT, { detail: value }),
  );
}
