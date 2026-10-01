/**
 * Phase 19 — Developer onboarding service tests (blocker fixes).
 *
 * Pure unit tests for the onboarding service logic. DB-gated integration
 * tests (real PostgreSQL) live in onboarding-integration.test.ts and run
 * only in CI with TEST_DATABASE_URL + RUN_ONBOARDING_INTEGRATION=1.
 */
import { describe, it, expect } from "vitest";
import {
  ONBOARDING_STEPS,
  isUsableSandboxKey,
  type OnboardingStep,
} from "@/lib/onboarding/onboarding";

describe("onboarding service — static contracts", () => {
  it("ONBOARDING_STEPS has exactly 3 tracked steps", () => {
    expect(ONBOARDING_STEPS).toHaveLength(3);
    expect(ONBOARDING_STEPS).toEqual(["apiKeyCreated", "otpSent", "otpVerified"]);
  });

  it("OnboardingStep type is a union of the 3 step names", () => {
    const steps: OnboardingStep[] = ["apiKeyCreated", "otpSent", "otpVerified"];
    expect(steps).toHaveLength(3);
  });
});

// ─── Blocker 3: isUsableSandboxKey unit tests ──────────────────────────────

describe("isUsableSandboxKey (Blocker 3)", () => {
  it("accepts a non-revoked, non-expired, development, full-scope key", () => {
    expect(isUsableSandboxKey({
      revokedAt: null, expiresAt: null, environment: "development", scopes: "full",
    })).toBe(true);
  });

  it("rejects a production (mg_live_) key", () => {
    expect(isUsableSandboxKey({
      revokedAt: null, expiresAt: null, environment: "production", scopes: "full",
    })).toBe(false);
  });

  it("rejects a read_only key", () => {
    expect(isUsableSandboxKey({
      revokedAt: null, expiresAt: null, environment: "development", scopes: "read_only",
    })).toBe(false);
  });

  it("rejects a revoked key", () => {
    expect(isUsableSandboxKey({
      revokedAt: new Date(), expiresAt: null, environment: "development", scopes: "full",
    })).toBe(false);
  });

  it("rejects an expired key", () => {
    expect(isUsableSandboxKey({
      revokedAt: null, expiresAt: new Date(Date.now() - 1000), environment: "development", scopes: "full",
    })).toBe(false);
  });

  it("accepts custom scopes with otp:send + otp:verify", () => {
    expect(isUsableSandboxKey({
      revokedAt: null, expiresAt: null, environment: "development", scopes: "otp:send,otp:verify",
    })).toBe(true);
  });

  it("rejects custom scopes missing otp:verify", () => {
    expect(isUsableSandboxKey({
      revokedAt: null, expiresAt: null, environment: "development", scopes: "otp:send",
    })).toBe(false);
  });
});

// ─── DB-gated integration tests (skipped without TEST_DATABASE_URL) ──────

const RUN_ONBOARDING_TESTS =
  process.env.RUN_ONBOARDING_INTEGRATION === "1" && !!process.env.TEST_DATABASE_URL;

describe.skipIf(!RUN_ONBOARDING_TESTS)("Onboarding DB Integration", () => {
  // Real PostgreSQL tests live in onboarding-integration.test.ts.
  it("placeholder (replaced by real DB integration tests)", () => {
    expect(true).toBe(true);
  });
});
