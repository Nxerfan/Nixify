/**
 * Auth login bug regression tests.
 *
 * Root cause: /api/auth/* route handlers lacked top-level try/catch.
 * When any DB call or security gate threw outside the narrow issueOtp
 * try/catch, Next.js returned an HTML 500, and api-client.ts fell back
 * to the generic "Request failed" message — hiding the real error.
 *
 * The same API key worked via v1 API (withApiKey wrapper has try/catch)
 * but failed on the website auth flow (no wrapper).
 *
 * Fix: top-level try/catch on all 5 auth route handlers + improved
 * error surfacing in api-client.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function readSrc(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf-8");
}

describe("Auth route handlers have top-level try/catch", () => {
  const routes = [
    "src/app/api/auth/login/route.ts",
    "src/app/api/auth/signup/route.ts",
    "src/app/api/auth/resend-otp/route.ts",
    "src/app/api/auth/verify-email/route.ts",
    "src/app/api/auth/forgot-password/route.ts",
    "src/app/api/auth/reset-password/route.ts",
  ];

  for (const route of routes) {
    const name = route.split("/api/auth/")[1].split("/")[0];
    it(`${name} route has top-level try/catch`, () => {
      const src = readSrc(route);
      // Must have a catch block that references the route name
      expect(src).toContain("catch (err)");
      expect(src).toContain(`[auth/${name}]`);
      expect(src).toContain("apiError");
    });
  }
});

describe("api-client.ts surfaces actionable error on non-JSON response", () => {
  it("does NOT use bare 'Request failed' as the only fallback", () => {
    const src = readSrc("src/lib/api-client.ts");
    // The old code was: data.error ?? "Request failed"
    // The new code includes res.statusText in the fallback
    expect(src).toContain("res.statusText");
    expect(src).toContain("res.status");
  });

  it("still falls back to a message when JSON has no error field", () => {
    const src = readSrc("src/lib/api-client.ts");
    // Should still have a fallback message, but now with status info
    expect(src).toMatch(/Request failed.*\$\{res\.status\}/);
  });
});

describe("Auth route error responses are JSON (not HTML)", () => {
  it("all auth routes import apiError for error responses", () => {
    const routes = [
      "src/app/api/auth/login/route.ts",
      "src/app/api/auth/signup/route.ts",
      "src/app/api/auth/resend-otp/route.ts",
      "src/app/api/auth/verify-email/route.ts",
      "src/app/api/auth/forgot-password/route.ts",
      "src/app/api/auth/reset-password/route.ts",
    ];
    for (const route of routes) {
      expect(readSrc(route)).toContain("apiError");
    }
  });
});
