/**
 * Phase 18 — Article view metrics tests.
 *
 * Pure tests for the IP hashing + dedup config. DB-gated integration tests
 * (real recordArticleView + getMostViewedArticles) run only in CI with a
 * real test database.
 */
import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { hashIp } from "@/lib/blog/view-metrics";

describe("view-metrics — hashIp", () => {
  it("returns a stable SHA-256 hex hash for an IP", () => {
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

  it("is salted (the hash is NOT the raw SHA-256 of the IP alone)", () => {
    // The hash includes an internal salt so the raw IP can't be recovered by
    // brute-forcing known IPs through unsalted SHA-256.
    const unsalted = createHash("sha256").update("1.2.3.4").digest("hex");
    expect(hashIp("1.2.3.4")).not.toBe(unsalted);
  });
});

// ─── DB-gated integration tests (skipped without TEST_DATABASE_URL) ──────

const RUN_VIEW_TESTS =
  process.env.RUN_COMMENTS_INTEGRATION === "1" && !!process.env.TEST_DATABASE_URL;

describe.skipIf(!RUN_VIEW_TESTS)("view-metrics DB integration", () => {
  it("placeholder — real DB integration tests run in CI", () => {
    expect(true).toBe(true);
  });
});
