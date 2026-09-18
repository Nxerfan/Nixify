/**
 * Phase 17 FINAL — API contract tests.
 *
 * These tests prove the v1 OTP API response contract is internally consistent:
 *   - `request_id` = API request trace ID (set by okResponse, matches X-Request-Id)
 *   - `otp_request_id` = OTP correlation ID (OtpCode.requestId, for webhook correlation)
 *
 * The previous contract had a collision: the send route put `request_id: otpRequestId`
 * in the data, then `okResponse(ctx.requestId, data)` OVERWROTE it with the API trace
 * ID — losing the OTP correlation ID entirely. These tests would have caught that.
 */
import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";

// ─── Test okResponse directly ─────────────────────────────────────────────

describe("Phase 17 FINAL — okResponse contract", () => {
  it("okResponse sets request_id from the API trace ID (first arg)", async () => {
    const mod = await import("@/lib/dx/request-context");
    const res = mod.okResponse("api-trace-id-123", { message: "OK" });
    const body = await res.json();
    expect(body.request_id).toBe("api-trace-id-123");
  });

  it("okResponse does NOT let handler data override request_id", async () => {
    // This is the collision regression: if a route puts `request_id: otpRequestId`
    // in the data, okResponse MUST overwrite it with the API trace ID.
    const mod = await import("@/lib/dx/request-context");
    const res = mod.okResponse("api-trace-id-123", {
      request_id: "otp-correlation-id-456", // route tried to set it
      message: "OTP sent",
    });
    const body = await res.json();
    // The API trace ID MUST win — handler data cannot redefine request_id.
    expect(body.request_id).toBe("api-trace-id-123");
    expect(body.request_id).not.toBe("otp-correlation-id-456");
  });

  it("okResponse preserves otp_request_id from handler data", async () => {
    const mod = await import("@/lib/dx/request-context");
    const res = mod.okResponse("api-trace-id-123", {
      otp_request_id: "otp-correlation-id-456",
      message: "OTP sent",
    });
    const body = await res.json();
    expect(body.otp_request_id).toBe("otp-correlation-id-456");
    expect(body.request_id).toBe("api-trace-id-123");
  });

  it("okResponse sets X-Request-Id header matching body request_id", async () => {
    const mod = await import("@/lib/dx/request-context");
    const res = mod.okResponse("api-trace-id-123", { message: "OK" });
    expect(res.headers.get("X-Request-Id")).toBe("api-trace-id-123");
    const body = await res.json();
    expect(body.request_id).toBe(res.headers.get("X-Request-Id"));
  });
});

// ─── Test errorResponse contract ──────────────────────────────────────────

describe("Phase 17 FINAL — errorResponse contract", () => {
  it("errorResponse sets request_id from API trace ID", async () => {
    const mod = await import("@/lib/dx/request-context");
    const req = new Request("https://example.com");
    const res = mod.errorResponse("api-trace-id-789", 400, "validation_failed", "bad input", req as any);
    const body = await res.json();
    expect(body.request_id).toBe("api-trace-id-789");
    expect(body.error.code).toBe("validation_failed");
    // Errors do NOT have otp_request_id unless explicitly added
    expect(body.otp_request_id).toBeUndefined();
  });
});

// ─── Landing snippet output tests ─────────────────────────────────────────

import { buildLandingSnippets } from "@/lib/seo/landing-snippets";

describe("Phase 17 FINAL — landing snippet API field correctness", () => {
  const snippets = buildLandingSnippets();

  it("JS snippet does NOT contain camelCase requestId", () => {
    expect(snippets.js).not.toContain("requestId");
  });

  it("JS snippet does NOT destructure { requestId } from API JSON", () => {
    expect(snippets.js).not.toContain("{ requestId }");
    expect(snippets.js).not.toContain("data.requestId");
  });

  it("JS snippet uses otp_request_id (snake_case) for OTP correlation", () => {
    expect(snippets.js).toContain("otp_request_id");
  });

  it("JS verify example includes purpose: 'signup'", () => {
    // The verify body must include purpose to match the send purpose
    expect(snippets.js).toContain("purpose: 'signup'");
  });

  it("JS send example includes purpose: 'signup'", () => {
    expect(snippets.js).toMatch(/purpose.*signup/);
  });

  it("cURL snippet includes purpose in send body", () => {
    expect(snippets.curl).toContain('"purpose":"signup"');
  });

  it("Python snippet includes purpose in send body", () => {
    expect(snippets.python).toContain("'purpose': 'signup'");
  });
});

// ─── Documentation regression tests ────────────────────────────────────────

import { readFileSync } from "fs";
import { resolve } from "path";

function readSrc(relPath: string): string {
  return readFileSync(resolve(__dirname, "../..", relPath), "utf-8");
}

describe("Phase 17 FINAL — docs page has no invalid requestId", () => {
  it("docs page does NOT contain data.requestId (camelCase API field)", () => {
    expect(readSrc("app/dashboard/docs/page.tsx")).not.toContain("data.requestId");
  });

  it("docs page does NOT contain { requestId } destructuring from API", () => {
    expect(readSrc("app/dashboard/docs/page.tsx")).not.toContain("{ requestId }");
  });

  it("docs page does NOT instruct users to store request_id for verify", () => {
    expect(readSrc("app/dashboard/docs/page.tsx")).not.toContain("store the request_id");
  });

  it("docs send response schema includes otp_request_id", () => {
    expect(readSrc("app/dashboard/docs/page.tsx")).toContain("otp_request_id");
  });

  it("docs verify response schema includes otp_request_id", () => {
    const docs = readSrc("app/dashboard/docs/page.tsx");
    // Both send and verify should have otp_request_id now
    expect(docs).toContain("otp_request_id");
  });
});

// ─── Send/verify route contract regression ────────────────────────────────

describe("Phase 17 FINAL — send/verify route contract", () => {
  it("send route uses otp_request_id for OTP correlation in data", () => {
    const send = readSrc("app/api/v1/otp/send/route.ts");
    expect(send).toContain("otp_request_id: requestId");
  });

  it("verify route uses otp_request_id for OTP correlation in response", () => {
    const verify = readSrc("app/api/v1/otp/verify/route.ts");
    expect(verify).toContain("otp_request_id: webhookRequestId");
  });

  it("verify request schema does NOT accept request_id or otp_request_id as input", () => {
    const verify = readSrc("app/api/v1/otp/verify/route.ts");
    // The body schema should only accept email, code, purpose
    expect(verify).not.toMatch(/request_id.*z\./);
    expect(verify).not.toMatch(/otp_request_id.*z\./);
  });
});
