/**
 * @vitest-environment jsdom
 *
 * Behavioral regression: login OTP first-use must NOT report "already used".
 *
 * Root cause (proven): `OtpStep.handleVerify` had no synchronous in-flight
 * guard. `setVerifying(true)` is async (queued until React re-renders), so
 * a second trigger firing in the SAME tick (auto-submit on the 6th digit +
 * an immediate Enter keypress, or a paste immediately followed by Enter)
 * saw `verifying === false` and called `onVerify(code)` a SECOND time.
 *
 * Two concurrent verify requests → two `consumeOtp()` calls → the second
 * sees `consumedAt !== null` → returns `already_used` → UI shows
 * "This code has already been used." on a FIRST, legitimate verification.
 *
 * Fix: a `useRef` flag set SYNCHRONOUSLY in `handleVerify` before any
 * `await` guarantees exactly ONE `onVerify(code)` call per submission.
 *
 * These tests render the REAL `OtpStep` and drive it via real DOM events
 * (input change + keydown) so the actual trigger paths are exercised —
 * not source-regex approximations.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { OtpStep } from "./OtpStep";

// ---- Polyfills required by framer-motion / OtpStep DOM access --------------

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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---- Helpers ---------------------------------------------------------------

/**
 * Render OtpStep with a mock onVerify that tracks call count and resolves
 * with the given result. Returns the call tracker + rendered container.
 */
function renderOtpStep(
  onVerifyImpl: (code: string) => Promise<{ ok: boolean; error?: string; errorCode?: string }>,
  onResendImpl: () => Promise<void> = async () => {},
) {
  const calls: string[] = [];
  const onVerify = vi.fn(async (code: string) => {
    calls.push(code);
    return onVerifyImpl(code);
  });
  const onResend = vi.fn(async () => {
    await onResendImpl();
  });

  const utils = render(
    <LocaleProvider locale="en">
      <OtpStep
        email="user@example.com"
        mode="signin"
        loading={false}
        onVerify={onVerify}
        onResend={onResend}
      />
    </LocaleProvider>,
  );

  return { ...utils, onVerify, onResend, calls };
}

/** Type a single digit into the Nth OTP input box (0-indexed). */
function setDigit(container: HTMLElement, index: number, digit: string) {
  const inputs = container.querySelectorAll('input[type="text"]');
  const input = inputs[index] as HTMLInputElement;
  fireEvent.change(input, { target: { value: digit } });
  return input;
}

/** Fire an Enter keydown on the last input box. */
function pressEnterOnLast(container: HTMLElement) {
  const inputs = container.querySelectorAll('input[type="text"]');
  fireEvent.keyDown(inputs[inputs.length - 1], { key: "Enter" });
}

// ---- Tests -----------------------------------------------------------------

describe("OtpStep duplicate-submit guard (login OTP first-use bug)", () => {
  it("one user action triggers exactly ONE onVerify call (auto-submit + Enter race)", async () => {
    // Simulate the race: typing the 6th digit triggers auto-submit, AND an
    // immediate Enter keypress also fires handleVerify in the same tick.
    const { calls, container } = renderOtpStep(async () => ({ ok: true }));

    // Type 5 digits (boxes 0-4), no auto-submit yet (only fires on index 5).
    for (let i = 0; i < 5; i++) setDigit(container, i, String(i + 1));

    // Type the 6th digit → auto-submit fires handleVerify.
    setDigit(container, 5, "6");
    // IMMEDIATELY (same tick) press Enter → would also fire handleVerify
    // WITHOUT the in-flight guard.
    pressEnterOnLast(container);

    // Wait for any pending microtasks to flush.
    await waitFor(() => {
      expect(calls.length).toBe(1);
    });

    // Even after a delay, exactly ONE call must have been made.
    await new Promise((r) => setTimeout(r, 50));
    expect(calls.length).toBe(1);
    expect(calls[0]).toBe("123456");
  });

  it("rapid double-Enter on a complete code triggers exactly ONE onVerify call", async () => {
    const { calls, container } = renderOtpStep(async () => ({ ok: true }));

    for (let i = 0; i < 6; i++) setDigit(container, i, String(i + 1));

    // Two rapid Enter presses in the same tick.
    pressEnterOnLast(container);
    pressEnterOnLast(container);

    await waitFor(() => {
      expect(calls.length).toBe(1);
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(calls.length).toBe(1);
  });

  it("paste of a 6-digit code followed immediately by Enter triggers ONE call", async () => {
    const { calls, container } = renderOtpStep(async () => ({ ok: true }));

    const firstInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.paste(firstInput, {
      clipboardData: { getData: () => "987654" },
    });
    // Immediately press Enter (simulates user reflex after paste).
    pressEnterOnLast(container);

    await waitFor(() => {
      expect(calls.length).toBe(1);
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(calls.length).toBe(1);
    expect(calls[0]).toBe("987654");
  });

  it("after a failed verification, a NEW submission is allowed (guard resets)", async () => {
    // First verification fails (e.g. wrong code). The in-flight guard must
    // reset so the user can submit a corrected code.
    let attempt = 0;
    const { calls, container } = renderOtpStep(async () => {
      attempt++;
      return attempt === 1
        ? { ok: false, error: "Wrong code", errorCode: "code_mismatch" }
        : { ok: true };
    });

    // First submission (wrong code).
    for (let i = 0; i < 6; i++) setDigit(container, i, "1");
    pressEnterOnLast(container);

    await waitFor(() => {
      expect(calls.length).toBe(1);
    });

    // Wait for the failure to be processed + shake to reset the digits.
    await new Promise((r) => setTimeout(r, 350));

    // The shake handler clears digits. After reset, type a new code.
    // Re-fill the digits and submit again.
    const inputs = container.querySelectorAll('input[type="text"]');
    for (let i = 0; i < 6; i++) {
      fireEvent.change(inputs[i] as HTMLInputElement, { target: { value: String(i + 1) } });
    }
    pressEnterOnLast(container);

    await waitFor(() => {
      expect(calls.length).toBe(2);
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(calls.length).toBe(2);
  });

  it("successful first-use does NOT show 'already_used' error", async () => {
    const { calls, container, queryByText } = renderOtpStep(async () => ({ ok: true }));

    for (let i = 0; i < 6; i++) setDigit(container, i, String(i + 1));
    // Trigger two paths simultaneously (auto-submit already fired on the 6th
    // digit; now also press Enter).
    pressEnterOnLast(container);

    await waitFor(() => {
      expect(calls.length).toBe(1);
    });

    // No "already used" text must appear on a first, successful verification.
    // Wait a beat to let any error state render if the bug were present.
    await new Promise((r) => setTimeout(r, 100));
    const alreadyUsed = queryByText(/already been used/i);
    expect(alreadyUsed).toBeNull();
  });
});

describe("OtpStep in-flight guard: failed first submission does not block retries", () => {
  it("mismatch code shows error but allows retry; guard resets between submissions", async () => {
    let attempt = 0;
    const { container, calls } = renderOtpStep(async () => {
      attempt++;
      return { ok: false, error: "mismatch", errorCode: "code_mismatch" };
    });

    for (let i = 0; i < 6; i++) setDigit(container, i, "0");
    pressEnterOnLast(container);

    await waitFor(() => expect(calls.length).toBe(1));
    await new Promise((r) => setTimeout(r, 350)); // shake reset

    const inputs = container.querySelectorAll('input[type="text"]');
    for (let i = 0; i < 6; i++) {
      fireEvent.change(inputs[i] as HTMLInputElement, { target: { value: "9" } });
    }
    pressEnterOnLast(container);

    await waitFor(() => expect(calls.length).toBe(2));
    expect(calls.length).toBe(2);
  });
});
