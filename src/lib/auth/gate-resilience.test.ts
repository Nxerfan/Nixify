/**
 * Security gate resilience regression tests.
 *
 * Root cause: preflightOtpSend did NOT have a top-level try/catch.
 * When any internal DB operation threw (rate limit table, device request
 * table, disposable domain table), the error propagated to the route
 * handler's outer catch and returned internal_error (500).
 *
 * The v1 API path did NOT call preflightOtpSend, so it was unaffected.
 * The website auth path DID call preflightOtpSend, so it failed.
 *
 * Fix: preflightOtpSend and preflightOtpVerify now have top-level try/catch
 * that logs the error and returns null (allow) — the security gate is a
 * defense-in-depth layer, and its failure should not block legitimate auth.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function readSrc(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf-8");
}

describe("Security gate resilience — preflightOtpSend has try/catch", () => {
  it("preflightOtpSend has a top-level try/catch", () => {
    const src = readSrc("src/lib/security/gate.ts");
    expect(src).toContain("export async function preflightOtpSend");
    expect(src).toContain("try {");
    expect(src).toContain("catch (err)");
    expect(src).toContain("preflightOtpSend error (allowing)");
    expect(src).toContain("return null");
  });

  it("preflightOtpVerify has a top-level try/catch", () => {
    const src = readSrc("src/lib/security/gate.ts");
    expect(src).toContain("export async function preflightOtpVerify");
    expect(src).toContain("preflightOtpVerify error (allowing)");
    expect(src).toContain("return null");
  });

  it("v1 API send route does NOT call preflightOtpSend", () => {
    const src = readSrc("src/app/api/v1/otp/send/route.ts");
    expect(src).not.toContain("preflightOtpSend");
  });

  it("website auth resend-otp route DOES call preflightOtpSend", () => {
    const src = readSrc("src/app/api/auth/resend-otp/route.ts");
    expect(src).toContain("preflightOtpSend");
  });

  it("website auth signup route DOES call preflightOtpSend", () => {
    const src = readSrc("src/app/api/auth/signup/route.ts");
    expect(src).toContain("preflightOtpSend");
  });
});
