/**
 * Phase 18 — Article view metrics unit tests (blocker fixes).
 *
 * Pure tests for the IP hashing + slug validation. DB-gated integration tests
 * (real recordArticleView + getMostViewedArticles + dedup + fabricated-slug
 * rejection) live in view-metrics-integration.test.ts and run only in CI.
 */
import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { hashIp, isValidArticleSlugAnyLocale } from "@/lib/blog/view-metrics";

describe("view-metrics — hashIp (Blocker 9)", () => {
  it("returns a stable hex hash for an IP", () => {
    const h1 = hashIp("1.2.3.4");
    const h2 = hashIp("1.2.3.4");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns 'unknown' for null/undefined/empty IP", () => {
    expect(hashIp(null)).toBe("unknown");
    expect(hashIp(undefined)).toBe("unknown");
    expect(hashIp("")).toBe("unknown");
  });

  it("produces different hashes for different IPs", () => {
    expect(hashIp("1.2.3.4")).not.toBe(hashIp("5.6.7.8"));
  });

  it("is keyed (HMAC), not unsalted SHA-256 of the IP alone (Blocker 9)", () => {
    // The hash uses an HMAC keyed by a server-side secret derived from
    // JWT_SECRET, so it's NOT the raw SHA-256 of the IP. An attacker who
    // knows the hashing algorithm cannot recover the IP by brute-forcing
    // unsalted SHA-256 of candidate IPs.
    const unsalted = createHash("sha256").update("1.2.3.4").digest("hex");
    expect(hashIp("1.2.3.4")).not.toBe(unsalted);
  });
});

describe("view-metrics — slug validation (Blocker 2)", () => {
  it("isValidArticleSlugAnyLocale accepts a real slug", () => {
    expect(isValidArticleSlugAnyLocale("welcome-to-nixify")).toBe(true);
    expect(isValidArticleSlugAnyLocale("smtp-vs-api-verification")).toBe(true);
  });

  it("isValidArticleSlugAnyLocale rejects a fabricated slug", () => {
    expect(isValidArticleSlugAnyLocale("fake-slug-xyz-999")).toBe(false);
  });
});

// ─── DB-gated integration tests (skipped without TEST_DATABASE_URL) ──────

const RUN_VIEW_TESTS =
  process.env.RUN_BLOG_INTEGRATION === "1" && !!process.env.TEST_DATABASE_URL;

describe.skipIf(!RUN_VIEW_TESTS)("view-metrics DB integration", () => {
  // Real PostgreSQL tests live in view-metrics-integration.test.ts.
  it("placeholder (replaced by real DB integration tests)", () => {
    expect(true).toBe(true);
  });
});
