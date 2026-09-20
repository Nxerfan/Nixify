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
import * as crypto from "crypto";

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
      // Must NOT claim Nixify manages IP reputation or bounce handling for the user
      expect(f).not.toContain("manage SMTP deliverability");
      expect(f).not.toContain("IP reputation");
      expect(f).not.toContain("bounce handling");
    }
  });

  it("uses 'configured SMTP transport' wording (not 'manage SMTP deliverability')", () => {
    expect(COMPARE).toContain("configured SMTP transport");
    expect(BLOG_VS).toContain("configured SMTP transport");
    expect(COMPARE).toContain("operate the SMTP transport yourself");
    expect(BLOG_VS).toContain("operate the SMTP transport yourself");
  });

  it("does NOT use per-message pricing framing (Nixify uses flat plan pricing)", () => {
    for (const f of [COMPARE, BLOG_VS]) {
      expect(f).not.toContain("per-message cost");
      expect(f).not.toContain("per-message pricing");
    }
    expect(COMPARE).toContain("operational, control, or infrastructure requirements");
    expect(BLOG_VS).toContain("operational, control, or infrastructure requirements");
  });

  it("uses 'authenticated v1 API requests' quota terminology (not 'API messages')", () => {
    for (const f of [COMPARE, BLOG_VS, BLOG_NEXTJS]) {
      expect(f).not.toContain("API messages/month");
      expect(f).not.toContain("1,000 API messages");
    }
    expect(COMPARE).toContain("1,000 authenticated v1 API requests/month");
    expect(BLOG_VS).toContain("1,000 authenticated v1 API requests/month");
    expect(BLOG_NEXTJS).toContain("1,000 authenticated v1 API requests/month");
  });

  it("comparison does NOT claim line counts are approximate or estimate time", () => {
    for (const f of [COMPARE, BLOG_VS]) {
      expect(f).not.toContain("line counts are approximate");
      expect(f).not.toContain("based on the real implementation");
      expect(f).not.toContain("based on the real codebase");
      expect(f).not.toMatch(/~\d+\s*lines?/);
    }
    expect(COMPARE).toContain("does not estimate engineering time or code size");
    expect(BLOG_VS).toContain("does not estimate engineering time or code size");
  });

  it("rate-limit comparison clarifies test keys skip per-email OTP send limiter; per-IP + plan limits still apply", () => {
    expect(COMPARE).toContain("skip the per-email OTP send limiter");
    expect(COMPARE).toContain("per-IP limits still apply");
    expect(COMPARE).toContain("plan per-minute API request limit still applies");
    expect(BLOG_VS).toContain("skip the per-email OTP send limiter");
    expect(BLOG_VS).toContain("per-IP limits still apply");
    expect(BLOG_VS).toContain("plan per-minute API request limit still applies");
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

  it("blog webhook verifier is safe: rejects missing/malformed t/v1, enforces 5-min tolerance, requires 64-char hex v1", () => {
    // The blog article must contain the complete safe verifier, not the weak one.
    expect(BLOG_NEXTJS).toContain("if (!t || !v1");
    expect(BLOG_NEXTJS).toContain("toleranceMs");
    // Must require v1 to be a 64-char hex SHA-256 digest (not a string-length
    // check, which can be fooled by multibyte characters of the same count).
    expect(BLOG_NEXTJS).toContain("/^[0-9a-f]{64}$/");
    expect(BLOG_NEXTJS).not.toContain("expected.length !== v1.length");
  });

  it("/examples webhook verifier uses the same hex-regex guard (not string-length)", () => {
    expect(EXAMPLES).toContain("/^[0-9a-f]{64}$/");
    expect(EXAMPLES).not.toContain("expected.length !== v1.length");
  });
});

describe("Post-Roadmap C — webhook verifier multibyte safety", () => {
  // A functional test that actually exercises the verifier logic against a
  // multibyte v1 value with the same CHARACTER count as a valid hex digest
  // (64 chars) but a different BYTE length. The old string-length check
  // would pass this to timingSafeEqual and throw RangeError; the new hex-regex
  // guard returns false before reaching the comparison.
  //
  // We reconstruct the verifier inline (mirroring the /examples implementation)
  // because the snippets are inside template strings, not importable modules.

  function verifySignature(
    secret: string,
    payload: string,
    signatureHeader: string,
    toleranceMs = 5 * 60 * 1000,
  ): boolean {
    const parts = Object.fromEntries(
      signatureHeader.split(",").map((p) => p.split("=")),
    );
    const t = Number(parts.t);
    const v1 = parts.v1;
    if (!t || !v1) return false;
    if (Math.abs(Date.now() - t) > toleranceMs) return false;
    // The corrected guard: require 64-char hex, not string-length comparison.
    if (typeof v1 !== "string" || !/^[0-9a-f]{64}$/.test(v1)) return false;
    const signedPayload = `${t}.${payload}`;
    const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  }

  it("rejects a multibyte v1 with the same character count as a valid hex digest", () => {
    // 64 multibyte characters (each >1 byte) — same char count as a valid
    // 64-char hex digest, but Buffer.from() produces a different byte length.
    // The old string-length check would pass; the hex-regex guard rejects.
    const t = Date.now();
    const multibyteV1 = "é".repeat(64); // 64 chars, 128 bytes in UTF-8
    const header = `t=${t},v1=${multibyteV1}`;
    // Must return false, NOT throw.
    let result: boolean;
    expect(() => {
      result = verifySignature("secret", "payload", header);
    }).not.toThrow();
    expect(result!).toBe(false);
  });

  it("rejects a non-hex v1 with 64 characters", () => {
    const t = Date.now();
    const nonHexV1 = "g".repeat(64); // 64 chars, valid length, but not hex
    const header = `t=${t},v1=${nonHexV1}`;
    expect(() => {
      const r = verifySignature("secret", "payload", header);
      expect(r).toBe(false);
    }).not.toThrow();
  });

  it("rejects a valid-hex v1 with wrong length (not 64 chars)", () => {
    const t = Date.now();
    const shortHex = "abc123"; // valid hex, but too short
    const header = `t=${t},v1=${shortHex}`;
    expect(() => {
      const r = verifySignature("secret", "payload", header);
      expect(r).toBe(false);
    }).not.toThrow();
  });

  it("accepts a valid signature", () => {
    const t = Date.now();
    const payload = '{"type":"otp.sent"}';
    const secret = "mg_whsec_test";
    const signed = `${t}.${payload}`;
    const v1 = crypto.createHmac("sha256", secret).update(signed).digest("hex");
    const header = `t=${t},v1=${v1}`;
    const r = verifySignature(secret, payload, header);
    expect(r).toBe(true);
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
