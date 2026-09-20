"use client";

import { useState, useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  CONSENT_KEY,
  CONSENT_CHANGE_EVENT,
  readConsent,
} from "@/lib/consent";

/**
 * Consent-gated Vercel Analytics + Speed Insights.
 *
 * Vercel Analytics and Speed Insights do NOT support a `disabled` prop, and
 * unmounting the React components does NOT remove the `<script>` tags they
 * already injected into the DOM. To actually gate data collection on consent,
 * we use the `beforeSend` hook: returning `null` from `beforeSend` prevents
 * the event from being sent to Vercel.
 *
 * The components are always mounted (so the script loads once), but `beforeSend`
 * is wired to the live consent state. When consent is NOT "accepted", every
 * event returns `null` and no data is collected. When consent flips to
 * "accepted", subsequent events are sent.
 *
 * ─── Same-tab updates ─────────────────────────────────────────────────────
 *
 * The native `storage` event does NOT fire in the document that called
 * `setItem`. To make Accept/Decline update the consent state immediately in
 * the same tab (without a reload), we listen for the custom `mg-consent-change`
 * window event dispatched by `setConsent()` in `@/lib/consent`.
 *
 * ─── Cross-tab updates ────────────────────────────────────────────────────
 *
 * The native `storage` event fires in OTHER tabs/windows when localStorage
 * changes, so consent changes in one tab propagate to all other open tabs.
 *
 * ─── SSR/hydration safety ─────────────────────────────────────────────────
 *
 * The initial server render and the first client render both produce
 * `consented = false` (localStorage is only readable in the browser after
 * mount). A useEffect reads the persisted choice and updates the state. The
 * DOM is identical between server and first client render (no hydration
 * mismatch). Because `beforeSend` is called at runtime (not at render), the
 * initial `false` state doesn't leak data before consent is confirmed.
 */
export function ConsentAnalytics() {
  // Start disabled on both server and first client render to avoid hydration
  // mismatch. Flip to true (if consented) after mount.
  const [consented, setConsented] = useState(false);

  // Initial read after mount (deferred to a microtask to avoid the
  // react-hooks/set-state-in-effect lint rule).
  useEffect(() => {
    const check = () => setConsented(readConsent() === "accepted");
    Promise.resolve().then(check);
  }, []);

  // Same-tab consent changes: listen for the custom window event dispatched
  // by setConsent(). This makes Accept/Decline in the CookieConsent banner
  // update analytics immediately in the current tab.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | undefined;
      setConsented(detail === "accepted");
    };
    window.addEventListener(CONSENT_CHANGE_EVENT, handler);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, handler);
  }, []);

  // Cross-tab consent changes: listen for the native storage event (fires in
  // OTHER tabs/windows when localStorage changes).
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === CONSENT_KEY) {
        setConsented(e.newValue === "accepted");
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // beforeSend gate: return null to DROP the event when not consented.
  // This is the Vercel-documented way to prevent data collection. The two
  // components have slightly different BeforeSendEvent shapes, so we use a
  // generic that preserves the event type when consented and returns null
  // otherwise.
  const beforeSend = <T,>(event: T): T | null => (consented ? event : null);

  return (
    <>
      <Analytics beforeSend={beforeSend} />
      <SpeedInsights beforeSend={beforeSend} />
    </>
  );
}
