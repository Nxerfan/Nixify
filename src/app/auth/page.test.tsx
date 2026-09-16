/**
 * Phase 12 — BLOCKER #1 auth shell localization regression.
 *
 * Renders the ACTUAL production `AuthPage` component under a real
 * `LocaleProvider` with `locale="en"` and `locale="fa"`. Asserts that
 * switching locale actually changes the visible tagline copy:
 *
 *   - fa: Persian tagline ("احراز هویت امن،") is visible.
 *   - fa: English tagline ("Secure authentication,") is NOT visible anywhere.
 *   - en: English tagline ("Secure authentication,") is visible.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import React from "react";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import AuthPage from "./page";

/**
 * Polyfill `window.matchMedia` (used by CustomCursor + AmbientBackground).
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
 */
function installRafPolyfill() {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.requestAnimationFrame) return;
  let id = 0;
  w.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    id += 1;
    const handle = id;
    Promise.resolve().then(() => {
      (cb as any)(performance.now());
    });
    return handle;
  }) as any;
  w.cancelAnimationFrame = ((_handle: number) => {}) as any;
}

/**
 * Polyfill `IntersectionObserver` (framer-motion's useInView uses it).
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

// Mock next/navigation — AuthCard calls useRouter(), which requires the
// Next.js App Router context. The test renders AuthPage (which renders
// AuthCard); without the mock, `useRouter` throws "invariant expected app
// router to be mounted".
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    refresh: () => {},
    back: () => {},
    forward: () => {},
    prefetch: () => {},
  }),
  usePathname: () => "/auth",
  useSearchParams: () => new URLSearchParams(),
  redirect: () => {},
}));

beforeEach(() => {
  installMatchMediaPolyfill();
  installRafPolyfill();
  installIntersectionObserverPolyfill();
  // AuthCard may probe session state on mount; stub fetch defensively.
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
  } as Response);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Auth shell localization regression (BLOCKER #1)", () => {
  it("fa locale renders Persian tagline and hides English tagline", async () => {
    const { container } = render(
      <LocaleProvider locale="fa">
        <AuthPage />
      </LocaleProvider>,
    );

    await waitFor(() => {
      // Persian first tagline part is visible. AnimatedText inserts a
      // non-breaking space (`\u00a0`) between words, so match with \s+ which
      // includes \u00a0 in JS regex.
      expect(container.textContent).toMatch(/احراز\s+هویت\s+امن،/);
    });

    // English tagline MUST NOT be visible anywhere.
    expect(container.textContent).not.toMatch(/Secure\s+authentication,/);

    // Persian feature pill "بدون رمز عبور" appears.
    await waitFor(() => {
      expect(container.textContent).toMatch(/بدون\s+رمز\s+عبور/);
    });

    // Persian footer appears.
    expect(container.textContent).toContain("© 2026 Nixify");
  });

  it("en locale renders the English tagline", async () => {
    const { container } = render(
      <LocaleProvider locale="en">
        <AuthPage />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(container.textContent).toMatch(/Secure\s+authentication,/);
    });

    // English second tagline part is visible.
    expect(container.textContent).toContain("simplified.");
  });
});
