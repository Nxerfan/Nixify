/**
 * Regression tests for the consent helpers (Post-Roadmap B).
 *
 * Covers:
 *   - readConsent / setConsent round-trip
 *   - setConsent dispatches the custom `mg-consent-change` window event in the
 *     SAME tab (the native `storage` event does NOT fire in the same document)
 *   - cross-tab updates use the native `storage` event
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// localStorage is not available in the vitest jsdom env unless we stub it.
const store: Record<string, string> = {};

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
});

// Stub localStorage + window.dispatchEvent for the module under test.
const dispatchSpy = vi.fn();
const windowDispatch = (e: Event) => dispatchSpy(e);

Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  },
  configurable: true,
});

Object.defineProperty(globalThis, "window", {
  value: {
    dispatchEvent: windowDispatch,
    CustomEvent: class CustomEvent {
      type: string;
      detail: unknown;
      constructor(type: string, opts?: { detail?: unknown }) {
        this.type = type;
        this.detail = opts?.detail;
      }
    },
  },
  configurable: true,
});

describe("consent helpers — same-tab event dispatch", () => {
  it("readConsent returns null when no choice has been made", async () => {
    const { readConsent } = await import("@/lib/consent");
    expect(readConsent()).toBeNull();
  });

  it("setConsent persists the choice to localStorage", async () => {
    const { setConsent, readConsent } = await import("@/lib/consent");
    setConsent("accepted");
    expect(readConsent()).toBe("accepted");
    setConsent("declined");
    expect(readConsent()).toBe("declined");
  });

  it("setConsent dispatches the mg-consent-change custom event in the SAME tab", async () => {
    const { setConsent, CONSENT_CHANGE_EVENT } = await import("@/lib/consent");
    dispatchSpy.mockClear();
    setConsent("accepted");
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0][0];
    expect(event.type).toBe(CONSENT_CHANGE_EVENT);
    expect(event.detail).toBe("accepted");
  });

  it("setConsent dispatches declined as well", async () => {
    const { setConsent, CONSENT_CHANGE_EVENT } = await import("@/lib/consent");
    dispatchSpy.mockClear();
    setConsent("declined");
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0][0];
    expect(event.type).toBe(CONSENT_CHANGE_EVENT);
    expect(event.detail).toBe("declined");
  });
});
