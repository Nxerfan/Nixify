/**
 * Phase 12 — BLOCKER #1 landing page localization regression.
 *
 * Renders the ACTUAL production `LandingPage` component under a real
 * `LocaleProvider` with `locale="en"` and `locale="fa"`. Asserts that
 * switching locale actually changes the visible hero copy:
 *
 *   - fa: Persian hero title ("تأیید OTP ایمیل") is visible.
 *   - fa: English hero title ("Email OTP verification") is NOT visible anywhere.
 *   - fa: Persian primary CTA ("شروع رایگان") is visible.
 *   - en: English hero title ("Email OTP verification") is visible.
 *
 * This proves the route consumes the translation dictionaries — not just
 * that the dictionaries exist. RTL direction and `lang` attributes alone are
 * insufficient evidence; the production component must render translated
 * text into the DOM.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import React from "react";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import LandingPage from "./page";

/**
 * Polyfill `window.matchMedia` (used by CustomCursor + AmbientBackground).
 * jsdom does not implement it natively — without the polyfill, the
 * components crash on `useSyncExternalStore`.
 */
function installMatchMediaPolyfill() {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.matchMedia) return;
  w.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as any;
}

/**
 * Polyfill `requestAnimationFrame` / `cancelAnimationFrame`.
 * Framer-motion's spring physics and AmbientBackground's canvas loop both
 * require rAF. jsdom does not implement it natively.
 */
function installRafPolyfill() {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.requestAnimationFrame) return;
  let id = 0;
  w.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    id += 1;
    const handle = id;
    // Fire on next microtask so the callback runs but does not block.
    Promise.resolve().then(() => {
      (cb as any)(performance.now());
    });
    return handle;
  }) as any;
  w.cancelAnimationFrame = ((_handle: number) => {}) as any;
}

/**
 * Polyfill `IntersectionObserver`. Framer-motion's `useInView` (used by every
 * landing section) instantiates IntersectionObserver during its effect. jsdom
 * does not implement it. The stub reports every element as not-yet-in-view;
 * the test cares about text content (always rendered), not visibility state.
 */
function installIntersectionObserverPolyfill() {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.IntersectionObserver) return;
  w.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as any;
}

beforeEach(() => {
  installMatchMediaPolyfill();
  installRafPolyfill();
  installIntersectionObserverPolyfill();

  // ExploreTemplatesButton performs a fetch to /api/profile/me on mount.
  // Stub it so no real network call is made in jsdom.
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
  } as Response);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Landing page localization regression (BLOCKER #1)", () => {
  it("fa locale renders Persian hero copy and hides English hero copy", async () => {
    const { container } = render(
      <LocaleProvider locale="fa">
        <LandingPage />
      </LocaleProvider>,
    );

    // Wait for the AnimatedText to settle into the DOM (the text content
    // is present immediately — only opacity animates).
    await waitFor(() => {
      // Persian hero title is now "تأیید OTP" + "ایمیل"
      expect(container.textContent).toContain("تأیید");
      expect(container.textContent).toContain("OTP");
    });

    // English hero title MUST NOT be visible anywhere in the document.
    expect(container.textContent).not.toMatch(/Email\s+OTP/);

    // Persian primary CTA is visible.
    await waitFor(() => {
      expect(container.textContent).toContain("شروع رایگان");
    });
  });

  it("en locale renders the English hero copy", async () => {
    const { container } = render(
      <LocaleProvider locale="en">
        <LandingPage />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(container.textContent).toMatch(/Email\s+OTP/);
    });

    // English primary CTA is visible.
    await waitFor(() => {
      expect(container.textContent).toContain("Get started");
    });
  });

  it("fa locale renders Persian FAQ and final-CTA copy", async () => {
    const { container } = render(
      <LocaleProvider locale="fa">
        <LandingPage />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(container.textContent).toContain("آماده تأیید هستید؟");
    });
    expect(container.textContent).toContain("سؤالات؟");
  });
});
