/**
 * Phase 19 — Cross-tenant OTP isolation + real-route-handler onboarding tests.
 *
 * Runs ONLY in CI with:
 *   TEST_DATABASE_URL=<postgres-url> RUN_ONBOARDING_INTEGRATION=1
 *
 * Blocker 1 — cross-tenant same-recipient OTP isolation:
 *   - tenant A API key + tenant B API key + same recipient email + same purpose
 *   - OTP A owned by A, OTP B owned by B
 *   - A's verify can only evaluate/consume A's OTP
 *   - B's verify can only evaluate/consume B's OTP
 *   - wrong-tenant verification does NOT increment attempts on the other's row
 *   - one tenant cannot cause the other's row to become consumed/locked/expired
 *
 * Blocker 2 — real production path via actual route handlers:
 *   - import POST from /api/v1/otp/send + /api/v1/otp/verify
 *   - invoke with realistic NextRequest objects + Bearer API key
 *   - prove: Bearer auth → sandbox send → owned OTP row → plaintext code →
 *     progress reconciliation → wrong-code failure → successful verify →
 *     consumed row → verified onboarding progress
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createOrDetectOnboardingApiKey, getOnboardingProgress } from "@/lib/onboarding/onboarding";

const RUN_TESTS =
  process.env.RUN_ONBOARDING_INTEGRATION === "1" && !!process.env.TEST_DATABASE_URL;

// Helper: create a real mg_test_ key for a user via the onboarding service
// (uses the canonical entitlement quota engine).
async function createTestKey(userId: number): Promise<string> {
  const result = await createOrDetectOnboardingApiKey(userId, "test key");
  if (!result.created) throw new Error("Failed to create test key");
  return result.created.key;
}

// Helper: invoke the REAL /api/v1/otp/send route handler
async function callSendRoute(apiKey: string, email: string, purpose: string = "signup") {
  const { POST } = await import("@/app/api/v1/otp/send/route");
  const req = new NextRequest("http://localhost/api/v1/otp/send", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ email, purpose }),
  });
  const res = await POST(req);
  return { res, json: await res.json().catch(() => ({})) };
}

// Helper: invoke the REAL /api/v1/otp/verify route handler
async function callVerifyRoute(apiKey: string, email: string, code: string, purpose: string = "signup") {
  const { POST } = await import("@/app/api/v1/otp/verify/route");
  const req = new NextRequest("http://localhost/api/v1/otp/verify", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ email, code, purpose }),
  });
  const res = await POST(req);
  return { res, json: await res.json().catch(() => ({})) };
}

describe.skipIf(!RUN_TESTS)("Cross-tenant OTP isolation + real route handlers", () => {
  let userA: { id: number; email: string };
  let userB: { id: number; email: string };
  let keyA: string;
  let keyB: string;
  // Both users share the SAME recipient email to prove cross-tenant isolation.
  let sharedEmail: string;

  beforeEach(async () => {
    sharedEmail = `shared-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.nixify.dev`;
    // Use lowercase emails — the v1 OTP send route normalizes to lowercase,
    // so the test must match the normalized form for OTP row lookups.
    const a = await db.user.create({
      data: { email: `usera-${Date.now()}@test.nixify.dev`, passwordHash: "hash", emailVerified: true, plan: "FREE" },
    });
    const b = await db.user.create({
      data: { email: `userb-${Date.now()}@test.nixify.dev`, passwordHash: "hash", emailVerified: true, plan: "FREE" },
    });
    userA = { id: a.id, email: a.email };
    userB = { id: b.id, email: b.email };
    keyA = await createTestKey(userA.id);
    keyB = await createTestKey(userB.id);
  });

  afterEach(async () => {
    try { await db.otpCode.deleteMany({ where: { targetEmail: sharedEmail } }); } catch {}
    try { await db.apiKey.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } }); } catch {}
    try { await db.onboardingProgress.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } }); } catch {}
    try { await db.user.delete({ where: { id: userA.id } }); } catch {}
    try { await db.user.delete({ where: { id: userB.id } }); } catch {}
  });

  // ─── Blocker 1: cross-tenant same-recipient isolation ─────────────────────

  it("Blocker 1: tenant A's verify can only consume A's OTP, not B's", async () => {
    // A sends an OTP to the shared email.
    const sendA = await callSendRoute(keyA, sharedEmail);
    expect(sendA.res.status).toBe(200);
    expect(sendA.json.code).toBeDefined();
    const codeA = sendA.json.code;

    // B sends an OTP to the SAME shared email.
    const sendB = await callSendRoute(keyB, sharedEmail);
    expect(sendB.res.status).toBe(200);
    expect(sendB.json.code).toBeDefined();
    const codeB = sendB.json.code;

    // The two codes should be different (different OTP rows).
    expect(codeA).not.toBe(codeB);

    // A verifies with A's code → success.
    const verifyA = await callVerifyRoute(keyA, sharedEmail, codeA);
    expect(verifyA.json.verified).toBe(true);

    // B verifies with B's code → success (B's OTP is independent).
    const verifyB = await callVerifyRoute(keyB, sharedEmail, codeB);
    expect(verifyB.json.verified).toBe(true);

    // A CANNOT verify B's code (wrong tenant).
    // First, re-send B's OTP (the previous one was consumed by B's verify).
    const resendB = await callSendRoute(keyB, sharedEmail);
    const resendCodeB = resendB.json.code;
    const wrongTenantVerify = await callVerifyRoute(keyA, sharedEmail, resendCodeB);
    expect(wrongTenantVerify.json.verified).not.toBe(true);
  });

  it("Blocker 1: wrong-tenant verification does NOT increment attempts on the other's row", async () => {
    // A sends an OTP.
    const sendA = await callSendRoute(keyA, sharedEmail);
    const codeA = sendA.json.code;

    // B tries to verify A's OTP with a wrong code. This should NOT find A's
    // OTP row at all (tenant-scoped query), so A's attempts should stay 0.
    const otpABefore = await db.otpCode.findFirst({
      where: { targetEmail: sharedEmail, userId: userA.id },
      orderBy: { createdAt: "desc" },
    });
    expect(otpABefore).not.toBeNull();
    expect(otpABefore!.attempts).toBe(0);

    // B tries to verify with a wrong code — should not touch A's row.
    await callVerifyRoute(keyB, sharedEmail, "000000");

    const otpAAfter = await db.otpCode.findFirst({
      where: { targetEmail: sharedEmail, userId: userA.id },
      orderBy: { createdAt: "desc" },
    });
    // A's OTP attempts unchanged — B's verify never evaluated A's row.
    expect(otpAAfter!.attempts).toBe(0);
    expect(otpAAfter!.consumedAt).toBeNull(); // not consumed
  });

  it("Blocker 1: one tenant cannot cause the other's row to be consumed/locked/expired", async () => {
    // A sends an OTP.
    const sendA = await callSendRoute(keyA, sharedEmail);
    const codeA = sendA.json.code;

    // B tries to consume A's OTP by calling verify with the correct code.
    // This MUST fail — B's tenant scope excludes A's OTP row.
    const wrongConsume = await callVerifyRoute(keyB, sharedEmail, codeA);
    expect(wrongConsume.json.verified).not.toBe(true);

    // A's OTP row is NOT consumed.
    const otpA = await db.otpCode.findFirst({
      where: { targetEmail: sharedEmail, userId: userA.id },
      orderBy: { createdAt: "desc" },
    });
    expect(otpA).not.toBeNull();
    expect(otpA!.consumedAt).toBeNull();

    // A can still verify their own OTP.
    const correctVerify = await callVerifyRoute(keyA, sharedEmail, codeA);
    expect(correctVerify.json.verified).toBe(true);
  });

  // ─── Blocker 2: real production path via actual route handlers ────────────
  // These tests use the user's OWN email (not the shared email) because the
  // onboarding reconciliation contract requires targetEmail === user's email.

  it("Blocker 2: real send route creates an owned development OTP + returns plaintext code", async () => {
    const { res, json } = await callSendRoute(keyA, userA.email);
    expect(res.status).toBe(200);
    expect(json.otp_request_id).toBeDefined();
    expect(json.code).toBeDefined();
    expect(json.code).toMatch(/^\d{6}$/);

    // Query by the requestId — the exact OTP row the send route created.
    const otp = await db.otpCode.findUnique({
      where: { requestId: json.otp_request_id },
    });
    expect(otp).not.toBeNull();
    expect(otp!.environment).toBe("development");
    expect(otp!.userId).toBe(userA.id);
    expect(otp!.consumedAt).toBeNull();
  });

  it("Blocker 2: onboarding progress sees otpSent only for the owning user", async () => {
    // A sends to A's OWN email (onboarding contract: targetEmail === user's email).
    await callSendRoute(keyA, userA.email);

    // A's progress sees otpSent (real evidence: owned OTP targeting A's email).
    const progressA = await getOnboardingProgress(userA.id);
    expect(progressA.stepOtpSent).toBe(true);

    // B's progress does NOT see otpSent (B didn't send anything to B's email).
    const progressB = await getOnboardingProgress(userB.id);
    expect(progressB.stepOtpSent).toBe(false);
  });

  it("Blocker 2: wrong code does not advance verification", async () => {
    const sendRes = await callSendRoute(keyA, userA.email);
    const code = sendRes.json.code;

    // Verify with a wrong code.
    const wrongVerify = await callVerifyRoute(keyA, userA.email, "000000");
    expect(wrongVerify.json.verified).not.toBe(true);

    // Progress should NOT show otpVerified.
    const progress = await getOnboardingProgress(userA.id);
    expect(progress.stepOtpVerified).toBe(false);
  });

  it("Blocker 2: successful verify consumes the owned row + otpVerified advances", async () => {
    const sendRes = await callSendRoute(keyA, userA.email);
    const code = sendRes.json.code;

    const verifyRes = await callVerifyRoute(keyA, userA.email, code);
    expect(verifyRes.json.verified).toBe(true);

    // The OTP row is consumed.
    const otp = await db.otpCode.findFirst({
      where: { targetEmail: userA.email, userId: userA.id },
      orderBy: { createdAt: "desc" },
    });
    expect(otp!.consumedAt).not.toBeNull();

    // Onboarding progress shows otpVerified.
    const progress = await getOnboardingProgress(userA.id);
    expect(progress.stepOtpVerified).toBe(true);
  });

  it("Blocker 2: another user's sandbox OTP does not advance the current user", async () => {
    // A sends to A's own email.
    await callSendRoute(keyA, userA.email);

    // B's progress is unchanged — B didn't send anything to B's email.
    const progressB = await getOnboardingProgress(userB.id);
    expect(progressB.stepOtpSent).toBe(false);
    expect(progressB.stepOtpVerified).toBe(false);
  });
});
