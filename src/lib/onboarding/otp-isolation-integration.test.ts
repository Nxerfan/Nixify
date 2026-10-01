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
import { hashOtpCode } from "@/lib/otp/generator";
import { SECURITY_CONFIG } from "@/lib/security";

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

  // ─── Final security blocker: strict owner scope — no null fallback ──────

  it("Final: tenant A can consume ONLY its owned row; null-owner row remains untouched", async () => {
    // Seed a LEGACY null-owner OTP row (userId = null) for the shared email.
    const legacyCode = "111111";
    const legacyHash = hashOtpCode(legacyCode);
    const legacyOtp = await db.otpCode.create({
      data: {
        targetEmail: sharedEmail,
        codeHash: Uint8Array.from(legacyHash),
        purpose: "signup",
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        environment: "development",
        userId: null, // legacy null-owner row
      },
    });

    // Seed tenant A's owned OTP row for the same email.
    const sendA = await callSendRoute(keyA, sharedEmail);
    expect(sendA.json.code).toBeDefined();
    const codeA = sendA.json.code;

    // Verify using tenant A's API key with A's code → should consume A's row.
    const verifyA = await callVerifyRoute(keyA, sharedEmail, codeA);
    expect(verifyA.json.verified).toBe(true);

    // A's row is consumed.
    const aOtp = await db.otpCode.findFirst({
      where: { targetEmail: sharedEmail, userId: userA.id },
      orderBy: { createdAt: "desc" },
    });
    expect(aOtp!.consumedAt).not.toBeNull();

    // The null-owner row is UNTOUCHED — attempts unchanged, not consumed.
    const legacyAfter = await db.otpCode.findUnique({ where: { id: legacyOtp.id } });
    expect(legacyAfter).not.toBeNull();
    expect(legacyAfter!.attempts).toBe(0);
    expect(legacyAfter!.consumedAt).toBeNull();
  });

  it("Final: only a null-owner OTP exists → tenant A verify must NOT consume or mutate it", async () => {
    // Seed ONLY a null-owner OTP row — no owned row exists.
    const legacyCode = "222222";
    const legacyHash = hashOtpCode(legacyCode);
    const legacyOtp = await db.otpCode.create({
      data: {
        targetEmail: sharedEmail,
        codeHash: Uint8Array.from(legacyHash),
        purpose: "signup",
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        environment: "development",
        userId: null, // legacy null-owner row
      },
    });

    // Tenant A tries to verify with the null-owner's code.
    const verifyA = await callVerifyRoute(keyA, sharedEmail, legacyCode);
    // Result: not verified (no eligible owned row for this tenant).
    expect(verifyA.json.verified).not.toBe(true);

    // The null-owner row is UNTOUCHED — attempts NOT incremented, not consumed.
    const legacyAfter = await db.otpCode.findUnique({ where: { id: legacyOtp.id } });
    expect(legacyAfter).not.toBeNull();
    expect(legacyAfter!.attempts).toBe(0);
    expect(legacyAfter!.consumedAt).toBeNull();
  });

  it("Final: wrong-code verify with only null-owner OTP → does NOT increment null-owner attempts", async () => {
    // Seed ONLY a null-owner OTP row.
    const legacyCode = "333333";
    const legacyHash = hashOtpCode(legacyCode);
    const legacyOtp = await db.otpCode.create({
      data: {
        targetEmail: sharedEmail,
        codeHash: Uint8Array.from(legacyHash),
        purpose: "signup",
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        environment: "development",
        userId: null,
      },
    });

    // Tenant A tries to verify with a WRONG code.
    const verifyA = await callVerifyRoute(keyA, sharedEmail, "000000");
    expect(verifyA.json.verified).not.toBe(true);

    // Null-owner attempts NOT incremented — the tenant-scoped query never
    // found the null-owner row.
    const legacyAfter = await db.otpCode.findUnique({ where: { id: legacyOtp.id } });
    expect(legacyAfter!.attempts).toBe(0);
    expect(legacyAfter!.consumedAt).toBeNull();
  });

  // ─── Blocker 1: Strict environment scope — no null fallback ──────────────

  it("Final: mg_test_ verify cannot consume/mutate a web-auth null-environment OTP", async () => {
    const webAuthCode = "444444";
    const webAuthHash = hashOtpCode(webAuthCode);
    const webAuthOtp = await db.otpCode.create({
      data: {
        targetEmail: sharedEmail,
        codeHash: Uint8Array.from(webAuthHash),
        purpose: "signup",
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        environment: null,
        userId: userA.id,
      },
    });
    const verifyA = await callVerifyRoute(keyA, sharedEmail, webAuthCode);
    expect(verifyA.json.verified).not.toBe(true);
    const after = await db.otpCode.findUnique({ where: { id: webAuthOtp.id } });
    expect(after).not.toBeNull();
    expect(after!.attempts).toBe(0);
    expect(after!.consumedAt).toBeNull();
  });

  it("Final: development and production keys cannot cross-consume each other's OTPs", async () => {
    const { createHash, randomBytes } = await import("crypto");
    const liveSecret = randomBytes(18).toString("base64url");
    const liveFullKey = "mg_live_" + liveSecret;
    const liveKeyHash = createHash("sha256").update(liveFullKey).digest("hex");
    await db.apiKey.create({
      data: { keyHash: liveKeyHash, prefix: liveFullKey.slice(0, 12), name: "live key",
        environment: "production", scopes: "full", userId: userA.id },
    });
    const sendDev = await callSendRoute(keyA, sharedEmail);
    const devCode = sendDev.json.code;
    const verifyLive = await callVerifyRoute(liveFullKey, sharedEmail, devCode);
    expect(verifyLive.json.verified).not.toBe(true);
    const devOtp = await db.otpCode.findUnique({ where: { requestId: sendDev.json.otp_request_id } });
    expect(devOtp!.consumedAt).toBeNull();
    await db.apiKey.deleteMany({ where: { userId: userA.id, environment: "production" } });
  });

  // ─── Blocker 2: Tenant-scope sandbox simulation correlation ──────────────

  it("Final: simulated mismatch from A correlates ONLY to A's owned sandbox OTP", async () => {
    const sendA = await callSendRoute(keyA, sharedEmail);
    const sendB = await callSendRoute(keyB, sharedEmail);
    const otpAId = sendA.json.otp_request_id;
    const otpBId = sendB.json.otp_request_id;
    expect(otpAId).not.toBe(otpBId);
    const { POST } = await import("@/app/api/v1/otp/verify/route");
    const req = new NextRequest("http://localhost/api/v1/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${keyA}`, "x-sandbox-simulate": "mismatch" },
      body: JSON.stringify({ email: sharedEmail, code: "000000", purpose: "signup" }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error?.code).toBe("code_mismatch");
    const aOtp = await db.otpCode.findUnique({ where: { requestId: otpAId } });
    expect(aOtp!.consumedAt).toBeNull();
    const bOtp = await db.otpCode.findUnique({ where: { requestId: otpBId } });
    expect(bOtp!.consumedAt).toBeNull();
  });

  it("Final: simulated expired from A correlates ONLY to A's owned sandbox OTP, not B's", async () => {
    const sendA = await callSendRoute(keyA, sharedEmail);
    const sendB = await callSendRoute(keyB, sharedEmail);
    const { POST } = await import("@/app/api/v1/otp/verify/route");
    const req = new NextRequest("http://localhost/api/v1/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${keyA}`, "x-sandbox-simulate": "expired" },
      body: JSON.stringify({ email: sharedEmail, code: "000000", purpose: "signup" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(410);
    const aOtp = await db.otpCode.findUnique({ where: { requestId: sendA.json.otp_request_id } });
    const bOtp = await db.otpCode.findUnique({ where: { requestId: sendB.json.otp_request_id } });
    expect(aOtp!.consumedAt).toBeNull();
    expect(bOtp!.consumedAt).toBeNull();
  });

  it("Final: null-owner/web-auth OTP is never selected for sandbox simulation correlation", async () => {
    const webAuthCode = "555555";
    const webAuthHash = hashOtpCode(webAuthCode);
    const webAuthOtp = await db.otpCode.create({
      data: {
        targetEmail: sharedEmail,
        codeHash: Uint8Array.from(webAuthHash),
        purpose: "signup",
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        environment: null,
        userId: null,
      },
    });
    const { POST } = await import("@/app/api/v1/otp/verify/route");
    const req = new NextRequest("http://localhost/api/v1/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${keyA}`, "x-sandbox-simulate": "mismatch" },
      body: JSON.stringify({ email: sharedEmail, code: "000000", purpose: "signup" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const after = await db.otpCode.findUnique({ where: { id: webAuthOtp.id } });
    expect(after!.attempts).toBe(0);
    expect(after!.consumedAt).toBeNull();
  });

  // ─── Blocker 3+4: Lockout isolation (tenant + environment) ────────────────

  it("Final: A locked OTP does not block B verification (different recipients)", async () => {
    // Uses different recipient emails — the per-email rate limiter
    // (5/min) is global and would block B if both used the same email.
    // This test proves OTP-level lockout isolation, NOT same-recipient
    // rate-limit isolation (which is documented as global recipient
    // protection policy).
    const sendA = await callSendRoute(keyA, userA.email);
    for (let i = 0; i < 5; i++) {
      await callVerifyRoute(keyA, userA.email, "000000");
    }
    const aOtp = await db.otpCode.findUnique({ where: { requestId: sendA.json.otp_request_id } });
    expect(aOtp!.attempts).toBeGreaterThanOrEqual(5);

    const sendB = await callSendRoute(keyB, userB.email);
    const verifyB = await callVerifyRoute(keyB, userB.email, sendB.json.code);
    expect(verifyB.json.verified).toBe(true);
  });

  it("Final: development lockout does not block production", async () => {
    // Create a mg_live_ key for userA.
    const { createHash, randomBytes } = await import("crypto");
    const liveSecret = randomBytes(18).toString("base64url");
    const liveFullKey = "mg_live_" + liveSecret;
    const liveKeyHash = createHash("sha256").update(liveFullKey).digest("hex");
    await db.apiKey.create({
      data: { keyHash: liveKeyHash, prefix: liveFullKey.slice(0, 12), name: "live key",
        environment: "production", scopes: "full", userId: userA.id },
    });

    // Lock A's development OTP.
    const sendDev = await callSendRoute(keyA, sharedEmail);
    for (let i = 0; i < 5; i++) {
      await callVerifyRoute(keyA, sharedEmail, "000000");
    }

    // A can still send via the production key — the dev lockout doesn't
    // block production issuance. (We can't call issueOtp with the live key
    // in this test because it would send a real email, but we CAN verify
    // that lockoutRemainingMs returns 0 for the production environment.)
    const { lockoutRemainingMs } = await import("@/lib/otp/verifier");
    const remaining = await lockoutRemainingMs(sharedEmail, "signup", "production", userA.id);
    expect(remaining).toBe(0);

    await db.apiKey.deleteMany({ where: { userId: userA.id, environment: "production" } });
  });

  it("Final: web-auth null-environment lockout does not block mg_test_ API flow", async () => {
    // Seed a locked web-auth OTP (environment=null, userId=null).
    const webAuthHash = hashOtpCode("999999");
    await db.otpCode.create({
      data: {
        targetEmail: sharedEmail,
        codeHash: Uint8Array.from(webAuthHash),
        purpose: "signup",
        attempts: 5,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        environment: null,
        userId: null,
        createdAt: new Date(), // within lockout window
      },
    });

    // The mg_test_ API flow should NOT see this lockout.
    const { lockoutRemainingMs } = await import("@/lib/otp/verifier");
    const remaining = await lockoutRemainingMs(sharedEmail, "signup", "development", userA.id);
    expect(remaining).toBe(0);
  });

  // ─── Final: v1 API failures cannot mutate Nixify User.locked* ──────────────

  it("Final: v1 tenant A failures do NOT set Nixify User.lockedReason/lockedUntil", async () => {
    // Create a real Nixify User whose account email IS the shared email.
    const recipientUser = await db.user.create({
      data: {
        email: sharedEmail,
        passwordHash: "hash",
        emailVerified: true,
        plan: "FREE",
      },
    });

    // Tenant A sends + exhausts wrong-code verifies (5 failures).
    const sendA = await callSendRoute(keyA, sharedEmail);
    for (let i = 0; i < 5; i++) {
      await callVerifyRoute(keyA, sharedEmail, "000000");
    }

    // The recipient Nixify User's locked* fields must NOT be set by v1
    // API-key failures.
    const after = await db.user.findUnique({
      where: { id: recipientUser.id },
      select: { lockedReason: true, lockedUntil: true, lockedAt: true },
    });
    expect(after!.lockedReason).toBeNull();
    expect(after!.lockedUntil).toBeNull();
    expect(after!.lockedAt).toBeNull();

    // Cleanup.
    await db.user.delete({ where: { id: recipientUser.id } });
  });

  it("Final: v1 tenant A failures do NOT prevent first-party web-auth for the same recipient", async () => {
    // Create a real Nixify User whose account email IS the shared email.
    const recipientUser = await db.user.create({
      data: {
        email: sharedEmail,
        passwordHash: "hash",
        emailVerified: true,
        plan: "FREE",
      },
    });

    // Tenant A sends + exhausts wrong-code verifies (5 failures).
    const sendA = await callSendRoute(keyA, sharedEmail);
    for (let i = 0; i < 5; i++) {
      await callVerifyRoute(keyA, sharedEmail, "000000");
    }

    // The recipient Nixify User is NOT locked — web-auth can still proceed.
    const { checkAccountLock } = await import("@/lib/security");
    const lockCheck = await checkAccountLock(sharedEmail);
    expect(lockCheck.locked).toBe(false);

    // Cleanup.
    await db.user.delete({ where: { id: recipientUser.id } });
  });

  it("Final: v1 tenant A failures do NOT mutate tenant B's OTP attempts", async () => {
    // Both tenants send to the shared email.
    const sendA = await callSendRoute(keyA, sharedEmail);
    const sendB = await callSendRoute(keyB, sharedEmail);

    // A verifies wrong 3 times.
    for (let i = 0; i < 3; i++) {
      await callVerifyRoute(keyA, sharedEmail, "000000");
    }

    // B's OTP attempts remain 0 — A's wrong verifies don't touch B's row.
    const bOtp = await db.otpCode.findUnique({ where: { requestId: sendB.json.otp_request_id } });
    expect(bOtp!.attempts).toBe(0);
    expect(bOtp!.consumedAt).toBeNull();
  });

  it("Final: web-auth brute-force still triggers account lock", async () => {
    // Create a real Nixify User whose account email IS the shared email.
    const recipientUser = await db.user.create({
      data: {
        email: sharedEmail,
        passwordHash: "hash",
        emailVerified: true,
        plan: "FREE",
      },
    });

    // Seed multiple web-auth OTPs — each one will be mismatched once and
    // then locked (attempts >= maxAttempts). We need BRUTE_FORCE_MAX_FAILS
    // total mismatches to trigger the account lock.
    const { consumeOtp } = await import("@/lib/otp/verifier");
    for (let i = 0; i < SECURITY_CONFIG.BRUTE_FORCE_MAX_FAILS; i++) {
      // Clean the per-email verify rate-limit bucket so the 5/min limiter
      // doesn't block the next verify (we need 10 mismatches, but the
      // rate limiter caps at 5/min).
      await db.rateLimitBucket.deleteMany({ where: { key: `otp_verify_min:${sharedEmail}` } }).catch(() => {});
      // Seed a fresh web-auth OTP for each attempt.
      const webHash = hashOtpCode("888888");
      await db.otpCode.create({
        data: {
          targetEmail: sharedEmail,
          codeHash: Uint8Array.from(webHash),
          purpose: "signup",
          attempts: 0,
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          environment: null,
          userId: null,
        },
      });
      // One wrong-code verify per OTP row.
      await consumeOtp({
        email: sharedEmail,
        code: "000000",
        purpose: "signup",
        // No userId/env → web-auth flow → brute-force account lock applies.
      });
    }

    // The Nixify User account IS locked — web-auth brute-force still works.
    const after = await db.user.findUnique({
      where: { id: recipientUser.id },
      select: { lockedReason: true, lockedUntil: true },
    });
    expect(after!.lockedReason).not.toBeNull();
    expect(after!.lockedUntil).not.toBeNull();

    // Cleanup.
    await db.user.delete({ where: { id: recipientUser.id } });
  });

  // ─── P0: v1 sandbox OTP cannot satisfy web-auth verify-email ──────────────

  it("P0: attacker's sandbox signup OTP cannot satisfy /api/auth/verify-email", async () => {
    // Victim is an unverified Nixify user whose email IS the shared email.
    const victim = await db.user.create({
      data: {
        email: sharedEmail,
        passwordHash: "victim-hash",
        emailVerified: false,
        plan: "FREE",
      },
    });

    // Attacker (tenant A) creates a sandbox signup OTP for victim's email.
    const sendAttacker = await callSendRoute(keyA, sharedEmail);
    const attackerCode = sendAttacker.json.code;

    // Attacker tries to call /api/auth/verify-email with their sandbox code.
    const { POST: verifyEmailPOST } = await import("@/app/api/auth/verify-email/route");
    const req = new NextRequest("http://localhost/api/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: sharedEmail, code: attackerCode, purpose: "signup" }),
    });
    const res = await verifyEmailPOST(req);
    const json = await res.json();

    // Verification must be rejected — the sandbox OTP (environment=development,
    // owned by tenant A) does not match the web-auth scope (environment=null,
    // owned by victim).
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(json.verified).not.toBe(true);

    // Victim remains unverified.
    const afterVictim = await db.user.findUnique({
      where: { id: victim.id },
      select: { emailVerified: true },
    });
    expect(afterVictim!.emailVerified).toBe(false);

    // Attacker's OTP row is NOT consumed by web-auth.
    const attackerOtp = await db.otpCode.findUnique({
      where: { requestId: sendAttacker.json.otp_request_id },
    });
    expect(attackerOtp!.consumedAt).toBeNull();

    // Cleanup.
    await db.user.delete({ where: { id: victim.id } });
  });

  it("P0: attacker's sandbox reset OTP cannot authorize /api/auth/reset-password", async () => {
    // Victim is a Nixify user with a known password hash.
    const victim = await db.user.create({
      data: {
        email: sharedEmail,
        passwordHash: "victim-original-hash",
        emailVerified: true,
        plan: "FREE",
      },
    });

    // Attacker (tenant A) creates a sandbox reset OTP for victim's email.
    const { POST: sendPOST } = await import("@/app/api/v1/otp/send/route");
    const sendReq = new NextRequest("http://localhost/api/v1/otp/send", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${keyA}` },
      body: JSON.stringify({ email: sharedEmail, purpose: "reset" }),
    });
    const sendRes = await sendPOST(sendReq);
    const sendJson = await sendRes.json();
    const attackerCode = sendJson.code;

    // Attacker tries to reset victim's password using the sandbox code.
    const { POST: resetPOST } = await import("@/app/api/auth/reset-password/route");
    const resetReq = new NextRequest("http://localhost/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: sharedEmail, code: attackerCode, newPassword: "hacked-password" }),
    });
    const resetRes = await resetPOST(resetReq);

    // Reset must be rejected.
    expect(resetRes.status).toBeGreaterThanOrEqual(400);

    // Victim's passwordHash is unchanged.
    const afterVictim = await db.user.findUnique({
      where: { id: victim.id },
      select: { passwordHash: true },
    });
    expect(afterVictim!.passwordHash).toBe("victim-original-hash");

    // Attacker's OTP row is NOT consumed.
    const attackerOtp = await db.otpCode.findUnique({
      where: { requestId: sendJson.otp_request_id },
    });
    expect(attackerOtp!.consumedAt).toBeNull();

    // Cleanup.
    await db.user.delete({ where: { id: victim.id } });
  });

  it("P0: v1 failures do NOT contribute to web-auth brute-force count", async () => {
    // Victim is a Nixify user whose email IS the shared email.
    const victim = await db.user.create({
      data: {
        email: sharedEmail,
        passwordHash: "hash",
        emailVerified: true,
        plan: "FREE",
      },
    });

    // Attacker makes several v1 verify failures.
    const sendAttacker = await callSendRoute(keyA, sharedEmail);
    for (let i = 0; i < 3; i++) {
      await callVerifyRoute(keyA, sharedEmail, "000000");
    }

    // The web-auth brute-force count for victim must NOT include v1 failures.
    const { countRecentFailedVerifies } = await import("@/lib/security");
    const webAuthFails = await countRecentFailedVerifies(sharedEmail, victim.id, null);
    expect(webAuthFails).toBe(0);

    // A single genuine web-auth mismatch does not suddenly lock the victim.
    // (victim has 0 web-auth fails — well below the 10 threshold.)
    const { checkAccountLock } = await import("@/lib/security");
    const lockCheck = await checkAccountLock(sharedEmail);
    expect(lockCheck.locked).toBe(false);

    // Cleanup.
    await db.user.delete({ where: { id: victim.id } });
  });

  // ─── Channel isolation: issuance lockout scoping ──────────────────────────

  it("Channel: locked development OTP does NOT block first-party web-auth issuance", async () => {
    // Create a real Nixify user whose email IS the shared email.
    const victim = await db.user.create({
      data: { email: sharedEmail, passwordHash: "hash", emailVerified: true, plan: "FREE" },
    });

    // Lock the development channel OTP (via tenant A's key).
    const sendDev = await callSendRoute(keyA, sharedEmail);
    for (let i = 0; i < 5; i++) {
      await callVerifyRoute(keyA, sharedEmail, "000000");
    }

    // First-party web-auth lockout check must return 0 (development lockout
    // does NOT block web-auth issuance).
    const { lockoutRemainingMs } = await import("@/lib/otp/verifier");
    const remaining = await lockoutRemainingMs(sharedEmail, "signup", null, victim.id);
    expect(remaining).toBe(0);

    await db.user.delete({ where: { id: victim.id } });
  });

  it("Channel: locked web-auth OTP DOES block another web-auth issuance for same user/purpose", async () => {
    const victim = await db.user.create({
      data: { email: sharedEmail, passwordHash: "hash", emailVerified: true, plan: "FREE" },
    });

    // Seed a locked web-auth OTP (environment=null, owned by victim).
    const webHash = hashOtpCode("123456");
    await db.otpCode.create({
      data: {
        targetEmail: sharedEmail,
        codeHash: Uint8Array.from(webHash),
        purpose: "signup",
        attempts: 5,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        environment: null,
        userId: victim.id,
        createdAt: new Date(),
      },
    });

    // Web-auth lockout check must return > 0 (same channel, same user).
    const { lockoutRemainingMs } = await import("@/lib/otp/verifier");
    const remaining = await lockoutRemainingMs(sharedEmail, "signup", null, victim.id);
    expect(remaining).toBeGreaterThan(0);

    await db.user.delete({ where: { id: victim.id } });
  });

  // ─── verify-email purpose hardcoding ──────────────────────────────────────

  it("Purpose: valid reset OTP cannot satisfy /api/auth/verify-email", async () => {
    const victim = await db.user.create({
      data: { email: sharedEmail, passwordHash: "hash", emailVerified: false, plan: "FREE" },
    });

    // Issue a web-auth reset OTP with a mock transport (no real SMTP).
    const { issueOtp } = await import("@/lib/otp/verifier");
    const mockTransport = { send: async () => {} };
    const issued = await issueOtp({
      email: sharedEmail,
      purpose: "reset",
      userId: victim.id,
      environment: null,
      locale: "en",
      transport: mockTransport as any,
    });

    // Clean rate-limit bucket.
    await db.rateLimitBucket.deleteMany({ where: { key: `otp_verify_min:${sharedEmail}` } }).catch(() => {});

    const { POST: verifyEmailPOST } = await import("@/app/api/auth/verify-email/route");
    const req = new NextRequest("http://localhost/api/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: sharedEmail, code: issued.code }),
    });
    const res = await verifyEmailPOST(req);

    expect(res.status).toBeGreaterThanOrEqual(400);

    const after = await db.user.findUnique({
      where: { id: victim.id },
      select: { emailVerified: true },
    });
    expect(after!.emailVerified).toBe(false);

    await db.user.delete({ where: { id: victim.id } });
  });

  it("Purpose: valid signup OTP succeeds via /api/auth/verify-email", async () => {
    const victim = await db.user.create({
      data: { email: `verify-test-${Date.now()}@test.nixify.dev`, passwordHash: "hash", emailVerified: false, plan: "FREE" },
    });

    const { issueOtp, consumeOtp } = await import("@/lib/otp/verifier");
    const mockTransport = { send: async () => {} };
    const issued = await issueOtp({
      email: victim.email,
      purpose: "signup",
      userId: victim.id,
      environment: null,
      locale: "en",
      transport: mockTransport as any,
    });

    await db.rateLimitBucket.deleteMany({ where: { key: `otp_verify_min:${victim.email}` } }).catch(() => {});

    // Simulate what /api/auth/verify-email does: consumeOtp with
    // purpose="signup", userId=victim.id, environment=null, context="web_auth".
    // We can't call the route handler directly because it calls
    // setSessionCookie (uses next/headers cookies() which requires a
    // Next.js request scope). Instead we test the core consumeOtp logic.
    const result = await consumeOtp({
      email: victim.email,
      code: issued.code,
      purpose: "signup",
      userId: victim.id,
      environment: null,
      context: "web_auth",
    });

    expect(result.ok).toBe(true);
    expect(result.decision).toBe("valid");

    await db.user.delete({ where: { id: victim.id } });
  });
});
