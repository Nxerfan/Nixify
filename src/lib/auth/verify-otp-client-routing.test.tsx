/**
 * @vitest-environment jsdom
 *
 * Behavioral regression: useAuth.verifyOtp client routing (requirement A).
 *
 * Proves the client-side fix: login OTP verification POSTs to /login-otp
 * (NOT /verify-email), and signup verification continues using /verify-email.
 *
 * Uses renderHook to exercise the REAL useAuth hook (not a mock) with a
 * mocked postJson so the actual endpoint-selection logic is exercised.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";
import React from "react";

// Mock postJson to capture the endpoint path + body without making a real
// network request.
const postJsonMock = vi.fn();

vi.mock("@/lib/api-client", () => ({
  postJson: postJsonMock,
}));

vi.mock("@/lib/i18n/LocaleProvider", () => ({
  useLocale: () => ({ locale: "en" }),
}));

vi.mock("@/lib/auth/errors", () => ({
  localizeAuthError: () => "error",
}));

beforeEach(() => {
  postJsonMock.mockReset();
  postJsonMock.mockResolvedValue({ ok: true, data: { message: "ok" } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useAuth.verifyOtp — client routing (A)", () => {
  it("login verification POSTs to /login-otp (NOT /verify-email)", async () => {
    const { useAuth } = await import("@/hooks/useAuth");
    const { result } = renderHook(() => useAuth(), { wrapper: React.Fragment });

    await act(async () => {
      await result.current.verifyOtp("user@example.com", "123456", "login");
    });

    expect(postJsonMock).toHaveBeenCalledTimes(1);
    const [path] = postJsonMock.mock.calls[0];
    expect(path).toBe("/login-otp");
    expect(path).not.toBe("/verify-email");
  });

  it("signup verification POSTs to /verify-email (NOT /login-otp)", async () => {
    const { useAuth } = await import("@/hooks/useAuth");
    const { result } = renderHook(() => useAuth(), { wrapper: React.Fragment });

    await act(async () => {
      await result.current.verifyOtp("user@example.com", "123456", "signup");
    });

    expect(postJsonMock).toHaveBeenCalledTimes(1);
    const [path] = postJsonMock.mock.calls[0];
    expect(path).toBe("/verify-email");
    expect(path).not.toBe("/login-otp");
  });

  it("default (no purpose) POSTs to /verify-email (backward-compatible signup)", async () => {
    const { useAuth } = await import("@/hooks/useAuth");
    const { result } = renderHook(() => useAuth(), { wrapper: React.Fragment });

    await act(async () => {
      await result.current.verifyOtp("user@example.com", "123456");
    });

    expect(postJsonMock).toHaveBeenCalledTimes(1);
    const [path] = postJsonMock.mock.calls[0];
    expect(path).toBe("/verify-email");
  });

  it("does NOT send a 'purpose' field in the request body (login)", async () => {
    const { useAuth } = await import("@/hooks/useAuth");
    const { result } = renderHook(() => useAuth(), { wrapper: React.Fragment });

    await act(async () => {
      await result.current.verifyOtp("user@example.com", "123456", "login");
    });

    const [, body] = postJsonMock.mock.calls[0];
    expect(body).toEqual({ email: "user@example.com", code: "123456" });
    expect((body as Record<string, unknown>).purpose).toBeUndefined();
  });

  it("does NOT send a 'purpose' field in the request body (signup)", async () => {
    const { useAuth } = await import("@/hooks/useAuth");
    const { result } = renderHook(() => useAuth(), { wrapper: React.Fragment });

    await act(async () => {
      await result.current.verifyOtp("user@example.com", "123456", "signup");
    });

    const [, body] = postJsonMock.mock.calls[0];
    expect(body).toEqual({ email: "user@example.com", code: "123456" });
    expect((body as Record<string, unknown>).purpose).toBeUndefined();
  });
});
