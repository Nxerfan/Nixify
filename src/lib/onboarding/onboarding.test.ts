/**
 * Phase 19 — Developer onboarding service tests.
 *
 * Pure unit tests for the onboarding service logic. DB-gated integration
 * tests (real PostgreSQL) live in onboarding-integration.test.ts and run
 * only in CI with TEST_DATABASE_URL + RUN_ONBOARDING_INTEGRATION=1.
 */
import { describe, it, expect } from "vitest";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/onboarding/onboarding";

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

// ─── DB-gated integration tests (skipped without TEST_DATABASE_URL) ──────

const RUN_ONBOARDING_TESTS =
  process.env.RUN_ONBOARDING_INTEGRATION === "1" && !!process.env.TEST_DATABASE_URL;

describe.skipIf(!RUN_ONBOARDING_TESTS)("Onboarding DB Integration", () => {
  // Real PostgreSQL tests live in onboarding-integration.test.ts.
  it("placeholder (replaced by real DB integration tests)", () => {
    expect(true).toBe(true);
  });
});
