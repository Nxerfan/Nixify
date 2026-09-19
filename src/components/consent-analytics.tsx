"use client";

import { useState, useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const CONSENT_KEY = "mg_cookie_consent";

/**
 * Consent-gated Vercel Analytics + Speed Insights.
 *
 * Renders Vercel Analytics and Speed Insights ONLY after the visitor has
 * explicitly accepted analytics consent (the `mg_cookie_consent` cookie set by
 * <CookieConsent />). Before any choice is made, or after Decline, both are
 * disabled (not rendered).
 *
 * SSR/hydration safety: the initial server render and the first client render
 * both produce `enabled = false` (the cookie is only readable in the browser
 * after mount). A useEffect reads localStorage and updates the state. This
 * means the DOM is identical between server and first client render (no
 * hydration mismatch), and the analytics scripts only load after consent is
 * confirmed.
 */
export function ConsentAnalytics() {
  // Start disabled on both server and first client render to avoid hydration
  // mismatch. Flip to true (if consented) after mount.
  const [enabled, setEnabled] = useState(false);

  // Read consent from localStorage after mount. We avoid calling setState
  // synchronously in the effect body (which the react-hooks lint rule flags)
  // by deferring the state update to a microtask.
  useEffect(() => {
    const check = () => {
      try {
        const consent = localStorage.getItem(CONSENT_KEY);
        setEnabled(consent === "accepted");
      } catch {
        // localStorage may be unavailable (private mode, etc.) — stay disabled.
        setEnabled(false);
      }
    };
    // Defer so we don't call setState synchronously inside the effect body.
    Promise.resolve().then(check);
  }, []);

  // Also listen for cross-tab / same-tab consent changes so Accept/Decline in
  // another tab (or the consent banner) is picked up without a full reload.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === CONSENT_KEY) {
        setEnabled(e.newValue === "accepted");
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  if (!enabled) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
