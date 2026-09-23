/**
 * api-client behavioral tests.
 *
 * Proves that when the API returns:
 *   { error: "mail_config_missing", message: "Email delivery is not configured..." }
 *
 * The client surfaces the human-readable `message` to the UI,
 * NOT the machine code `error`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch
const mockFetch = vi.hoisted(() => vi.fn());
global.fetch = mockFetch as any;

import { postJson } from "@/lib/api-client";

describe("api-client — error message surfacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces `message` (not `error`) when API returns both fields", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "mail_config_missing",
          message: "Email delivery is not configured on this deployment. Contact the administrator.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await postJson("/resend-otp", { email: "test@example.com" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The user-facing message must be the human-readable `message`
      expect(result.error.error).toBe(
        "Email delivery is not configured on this deployment. Contact the administrator.",
      );
      // The machine code must be preserved separately
      expect(result.error.errorCode).toBe("mail_config_missing");
    }
  });

  it("surfaces `message` for rate_limited errors (not the code)", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "rate_limited",
          message: "Too many codes requested. Please wait a minute and try again.",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await postJson("/resend-otp", { email: "test@example.com" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe(
        "Too many codes requested. Please wait a minute and try again.",
      );
      expect(result.error.errorCode).toBe("rate_limited");
    }
  });

  it("surfaces `message` for invalid_credentials errors", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "invalid_credentials",
          message: "Incorrect email or password.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await postJson("/login", { email: "test@example.com", password: "wrong" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe("Incorrect email or password.");
      expect(result.error.errorCode).toBe("invalid_credentials");
    }
  });

  it("does NOT display machine code 'internal_error' as the user message", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "internal_error",
          message: "Something went wrong. Please try again.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await postJson("/resend-otp", { email: "test@example.com" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Must show the human message, NOT "internal_error"
      expect(result.error.error).toBe("Something went wrong. Please try again.");
      expect(result.error.error).not.toBe("internal_error");
      expect(result.error.errorCode).toBe("internal_error");
    }
  });

  it("falls back to status text when response is not JSON", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("<html>Internal Server Error</html>", {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }),
    );

    const result = await postJson("/resend-otp", { email: "test@example.com" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Should include the status code
      expect(result.error.error).toContain("500");
    }
  });

  it("returns ok:true with data on successful response", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ message: "A new code was sent to your inbox." }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await postJson<{ message: string }>("/resend-otp", { email: "test@example.com" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.message).toBe("A new code was sent to your inbox.");
    }
  });
});
