/**
 * Regression tests for public-truth claims across Post-Roadmap C content
 * (/examples, /compare, /changelog, and the two new blog articles).
 *
 * These tests verify that the corrected factual claims are present and the
 * old inaccurate claims are absent. Source files are read (not imported) to
 * avoid triggering DB queries during the test run.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function readSrc(relPath: string): string {
  return readFileSync(resolve(__dirname, "../..", relPath), "utf-8");
}

const CHANGELOG = readSrc("app/changelog/page.tsx");
const COMPARE = readSrc("app/compare/page.tsx");
const EXAMPLES = readSrc("app/examples/page.tsx");
const BLOG_NEXTJS = readSrc("../content/blog/en/email-otp-api-for-nextjs.ts");
const BLOG_VS = readSrc("../content/blog/en/nixify-vs-building-email-otp-yourself.ts");

describe("Post-Roadmap C — public truth regression (changelog)", () => {
  it("does NOT invent a v1.0.0 / 2026-07-06 / Initial public release entry", () => {
    expect(CHANGELOG).not.toContain("v1.0.0");
    expect(CHANGELOG).not.toContain("2026-07-06");
    expect(CHANGELOG).not.toContain("Initial public release");
  });

  it("uses a 'Current API contract' label instead of invented version numbers", () => {
    expect(CHANGELOG).toContain("Current API contract");
  });

  it("does NOT hardcode '15 stable error codes' — refers to the public catalog instead", () => {
    expect(CHANGELOG).not.toContain("15 stable error codes");
    expect(CHANGELOG).not.toContain("15 error codes");
    expect(CHANGELOG).toContain("/docs#errors");
  });
});

describe("Post-Roadmap C — public truth regression (quotas & headers)", () => {
  const allFiles = [CHANGELOG, COMPARE, EXAMPLES, BLOG_NEXTJS, BLOG_VS];

  it("does NOT claim X-Quota-Remaining is on every response", () => {
    for (const f of allFiles) {
      expect(f).not.toContain("X-Quota-Remaining header on every response");
      expect(f).not.toContain("on every 2xx response");
    }
  });

  it("describes API_MESSAGES as authenticated v1 API requests, not generic OTP/email volume", () => {
    // At least one file should clarify the API_MESSAGES scope.
    const hasCorrectScope =
      COMPARE.includes("API_MESSAGES") ||
      CHANGELOG.includes("API_MESSAGES") ||
      BLOG_VS.includes("API_MESSAGES");
    expect(hasCorrectScope).toBe(true);
  });

  it("documents OTP email sends as a separate quota where quotas are mentioned", () => {
    // /compare and /changelog both mention quotas — both should mention the
    // separate OTP_EMAILS quota.
    expect(COMPARE).toContain("OTP_EMAILS");
    expect(CHANGELOG).toContain("OTP_EMAILS");
  });

  it("does NOT claim every 429 has Retry-After + X-RateLimit-*", () => {
    for (const f of allFiles) {
      expect(f).not.toContain("Rate-limited responses (429) include a Retry-After header");
      expect(f).not.toContain("returns 429 with a Retry-After header (seconds)");
    }
  });
});

describe("Post-Roadmap C — public truth regression (security & feature claims)", () => {
  it("uses 'more than 5 IP rate-limit violations' (not '5 IP violations triggers')", () => {
    expect(COMPARE).toContain("More than 5 IP rate-limit violations");
    expect(BLOG_VS).toContain("More than 5 IP rate-limit violations");
    // The old "5 IP rate-limit violations" (without "More than") must be gone.
    expect(COMPARE).not.toContain("5 IP rate-limit violations →");
    expect(BLOG_VS).not.toMatch(/^[^M]*5 IP rate-limit violations/);
  });

  it("does NOT claim POST /otp/send returns immediately", () => {
    expect(COMPARE).not.toContain("returns immediately");
    expect(BLOG_VS).not.toContain("returns immediately");
    expect(EXAMPLES).not.toContain("returns immediately");
  });

  it("qualifies email theming/branding by plan", () => {
    expect(COMPARE).toContain("Free includes 2 templates");
    expect(BLOG_VS).toContain("Free includes 2 templates");
  });

  it("does NOT imply automatic bounce/complaint handling", () => {
    for (const f of [CHANGELOG, COMPARE, EXAMPLES, BLOG_NEXTJS, BLOG_VS]) {
      expect(f).not.toContain("automatic bounce handling");
      expect(f).not.toContain("bounce feedback");
      expect(f).not.toContain("complaint feedback");
    }
  });
});

describe("Post-Roadmap C — public truth regression (comparison claims)", () => {
  it("does NOT contain invented line counts", () => {
    for (const f of [COMPARE, BLOG_VS]) {
      expect(f).not.toMatch(/~\d+\s*lines?/);
      expect(f).not.toContain("~50 lines");
      expect(f).not.toContain("~80 lines");
      expect(f).not.toContain("~100 lines");
      expect(f).not.toContain("~300+ lines");
      expect(f).not.toContain("~200+ lines");
      expect(f).not.toContain("~150+ lines");
    }
  });

  it("does NOT contain time estimates like 'minutes' or 'days to weeks'", () => {
    for (const f of [COMPARE, BLOG_VS]) {
      expect(f).not.toContain("minutes, not days");
      expect(f).not.toContain("days to weeks");
      expect(f).not.toContain("Minutes to a working OTP flow");
    }
  });

  it("does NOT claim 'test keys skip limits for fast CI'", () => {
    expect(COMPARE).not.toContain("fast CI");
    expect(BLOG_VS).not.toContain("fast CI");
  });
});

describe("Post-Roadmap C — public truth regression (examples & blog guide)", () => {
  it("/examples has a real resend example (the metadata claim is backed by code)", () => {
    expect(EXAMPLES).toContain("RESEND_SNIPPET");
    expect(EXAMPLES).toContain("/otp/resend");
    expect(EXAMPLES).toContain("Step 3b — Resend OTP");
  });

  it("blog guide does NOT claim 'three endpoints' while only implementing send + verify", () => {
    // The guide implements send + verify + mentions resend is available.
    // It should NOT say "calls three endpoints" as if that's the complete guide.
    expect(BLOG_NEXTJS).not.toContain("calls three endpoints from server-side route handlers");
  });

  it("documents rate_limited as potentially from per-email, per-IP, or plan-rate", () => {
    expect(EXAMPLES).toContain("per-email, per-IP, or plan-rate");
    expect(BLOG_NEXTJS).toContain("per-email, per-IP, or plan-rate");
  });

  it("blog webhook verifier is safe: rejects missing/malformed t/v1, enforces 5-min tolerance, checks lengths", () => {
    // The blog article must contain the complete safe verifier, not the weak one.
    expect(BLOG_NEXTJS).toContain("if (!t || !v1");
    expect(BLOG_NEXTJS).toContain("toleranceMs");
    expect(BLOG_NEXTJS).toContain("expected.length !== v1.length");
    // The old weak verifier did NOT have the guard, tolerance, or length check.
    // The new verifier must have all three — verified above.
  });
});

describe("Post-Roadmap C — public truth regression (no private repo links)", () => {
  it("no public page links to GitHub or the private repository", () => {
    for (const f of [CHANGELOG, COMPARE, EXAMPLES, BLOG_NEXTJS, BLOG_VS]) {
      expect(f).not.toContain("github.com");
      expect(f).not.toContain("Nxerfan");
      expect(f).not.toContain("/Nxerfan");
    }
  });
});
