import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * OTP verifier → automation hook (Phase 5, section 2).
 *
 * Tests that consumeOtp enqueues the otp_verified orchestration job exactly
 * once after a successful verification, and that OTP verification success is
 * INDEPENDENT of the hook (fire-and-forget, errors swallowed).
 *
 * Everything is mocked — no DB, no real decideOtp, no real security, no real
 * ratelimit, no real analytics. This runs in the generic CI job.
 *
 * Mock strategy:
 *   - vi.mock("@/lib/automation", () => ({ enqueueOtpVerifiedJob: vi.fn() }))
 *     Fully stubbed — we only assert the call, never exercise the real impl.
 *   - vi.mock("@/lib/db", ...) — otpCode.{findFirst,findUnique,update,updateMany,create}
 *   - vi.mock("@/lib/security", ...) — checkAccountLock returns not-locked,
 *     countRecentFailedVerifies returns 0, brute-force lock disabled.
 *   - vi.mock("@/lib/ratelimit", ...) — enforceOtpVerifyLimits returns allowed.
 *   - vi.mock("@/lib/analytics", ...) — logOtpEvent is a no-op.
 *   - vi.mock("@/lib/otp/generator", ...) — decideOtp is fully controllable
 *     per-test (default "valid"); hashOtpCode/generateOtpCode/constantTimeVerify
 *     are stubs since the verifier imports them but the decision layer is mocked.
 *
 * Coverage:
 * - valid OTP + userId set → enqueueOtpVerifiedJob called exactly once with the
 *   full payload {otpCodeId, userId, email, environment, purpose}.
 * - mismatch OTP → enqueueOtpVerifiedJob NOT called.
 * - expired OTP → enqueueOtpVerifiedJob NOT called.
 * - already_used OTP → enqueueOtpVerifiedJob NOT called.
 * - not_found OTP → enqueueOtpVerifiedJob NOT called.
 * - locked OTP → enqueueOtpVerifiedJob NOT called.
 * - valid OTP but userId=null (legacy/web-auth without user) → enqueueOtpVerifiedJob
 *   NOT called (the hook checks `if (latest!.userId)`).
 * - enqueueOtpVerifiedJob throws → consumeOtp still returns ok:true (fire-and-forget,
 *   the catch swallows the error). CRITICAL Phase 5 section 2 test.
 * - dedupeKey derives from otpCodeId, NOT email — the payload passed to
 *   enqueueOtpVerifiedJob includes otpCodeId; the wrapper would build
 *   dedupeKey = `otp_verified:<otpCodeId>`.
 */

// ---- Mocks (must come BEFORE the verifier import) -------------------------

vi.mock("@/lib/automation", () => ({
  enqueueOtpVerifiedJob: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    otpCode: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/security", () => ({
  checkAccountLock: vi.fn(async () => ({ locked: false })),
  countRecentFailedVerifies: vi.fn(async () => 0),
  lockAccountForBruteForce: vi.fn(async () => {}),
  logEvent: vi.fn(async () => {}),
  SECURITY_CONFIG: {
    BRUTE_FORCE_MAX_FAILS: 5,
    ACCOUNT_LOCK_MS: 15 * 60_000,
  },
}));

vi.mock("@/lib/ratelimit", () => ({
  enforceOtpVerifyLimits: vi.fn(async () => ({
    allowed: true,
    retryAfterSeconds: null,
  })),
  enforceOtpSendLimits: vi.fn(async () => ({
    allowed: true,
    retryAfterSeconds: null,
  })),
  rateLimit: vi.fn(),
  checkRateLimit: vi.fn(),
  RATE_LIMITS: {},
}));

vi.mock("@/lib/analytics", () => ({
  logOtpEvent: vi.fn(async () => {}),
}));

// Mock the OTP generator: decideOtp is fully controllable per-test (default "valid").
// The other exports (hashOtpCode, generateOtpCode, constantTimeVerify, constants)
// are stubs — the verifier imports them but we never exercise the real hashing path.
vi.mock("@/lib/otp/generator", () => ({
  decideOtp: vi.fn(() => "valid" as const),
  generateOtpCode: vi.fn(() => "123456"),
  hashOtpCode: vi.fn(() => Buffer.alloc(32)),
  constantTimeVerify: vi.fn(() => true),
  OTP_TTL_MS: 10 * 60_000,
  OTP_LOCKOUT_MS: 15 * 60_000,
  OTP_MAX_ATTEMPTS: 5,
}));

import { consumeOtp } from "@/lib/otp/verifier";
import { enqueueOtpVerifiedJob } from "@/lib/automation";
import { decideOtp } from "@/lib/otp/generator";
import { db } from "@/lib/db";

const mockedFindFirst = vi.mocked(db.otpCode.findFirst);
const mockedFindUnique = vi.mocked(db.otpCode.findUnique);
const mockedUpdate = vi.mocked(db.otpCode.update);
const mockedUpdateMany = vi.mocked(db.otpCode.updateMany);
const mockedDecideOtp = vi.mocked(decideOtp);
const mockedEnqueue = vi.mocked(enqueueOtpVerifiedJob);

// ---- helpers --------------------------------------------------------------

/** A fresh, unconsumed OTP row with userId=42 by default. */
function makeOtpRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 100,
    requestId: "req_abc123",
    userId: 42,
    targetEmail: "user@test.com",
    purpose: "signup",
    codeHash: new Uint8Array(32),
    attempts: 0,
    maxAttempts: 5,
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    environment: null,
    createdAt: new Date(Date.now() - 30_000),
    ...overrides,
  };
}

/** Set up the "everything passes" default mocks for the valid-verification path. */
function setupHappyPath() {
  mockedDecideOtp.mockReturnValue("valid");
  mockedFindFirst.mockResolvedValue(makeOtpRow() as any);
  mockedFindUnique.mockResolvedValue({ attempts: 1, maxAttempts: 5 } as any);
  mockedUpdate.mockResolvedValue(makeOtpRow() as any);
  // Atomic consume — 1 row affected = we won the race.
  mockedUpdateMany.mockResolvedValue({ count: 1 } as any);
  mockedEnqueue.mockResolvedValue(undefined);
}

const DEFAULT_ARGS = {
  email: "user@test.com",
  code: "123456",
  purpose: "signup" as const,
  pepperOverride: "test-pepper-please-do-not-read-env-32b!!",
};

// ---- tests -----------------------------------------------------------------

describe("OTP verifier → automation hook (Phase 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Successful verification enqueues the job ---------------------------

  it("valid OTP + userId set → enqueueOtpVerifiedJob called once with correct payload", async () => {
    const result = await consumeOtp(DEFAULT_ARGS);

    expect(result).toEqual({ ok: true, decision: "valid", userId: 42 });
    expect(mockedEnqueue).toHaveBeenCalledTimes(1);

    // Payload shape must include otpCodeId, userId, email, environment, purpose.
    const payload = mockedEnqueue.mock.calls[0][0];
    expect(payload).toEqual({
      otpCodeId: 100,
      userId: 42,
      email: "user@test.com",
      environment: null,
      purpose: "signup",
    });
  });

  it("valid OTP also calls the atomic consume + logOtpEvent", async () => {
    await consumeOtp(DEFAULT_ARGS);

    // attempts increment happens before the consume.
    expect(mockedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100 },
        data: { attempts: { increment: 1 } },
      }),
    );
    // atomic consume (single-use guard).
    expect(mockedUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 100, consumedAt: null },
        data: { consumedAt: expect.any(Date) },
      }),
    );
  });

  // ---- Negative decisions never enqueue -----------------------------------

  it("mismatch OTP → enqueueOtpVerifiedJob NOT called", async () => {
    mockedDecideOtp.mockReturnValue("mismatch");
    // Mismatch path re-fetches the row after the attempt increment.
    mockedFindUnique.mockResolvedValue({ attempts: 1, maxAttempts: 5 } as any);

    const result = await consumeOtp(DEFAULT_ARGS);

    expect(result.ok).toBe(false);
    expect(result.decision).toBe("mismatch");
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  it("expired OTP → enqueueOtpVerifiedJob NOT called", async () => {
    mockedDecideOtp.mockReturnValue("expired");

    const result = await consumeOtp(DEFAULT_ARGS);

    expect(result).toEqual({ ok: false, decision: "expired" });
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  it("already_used OTP → enqueueOtpVerifiedJob NOT called", async () => {
    mockedDecideOtp.mockReturnValue("already_used");

    const result = await consumeOtp(DEFAULT_ARGS);

    expect(result).toEqual({ ok: false, decision: "already_used" });
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  it("not_found OTP → enqueueOtpVerifiedJob NOT called", async () => {
    mockedDecideOtp.mockReturnValue("not_found");
    mockedFindFirst.mockResolvedValue(null);

    const result = await consumeOtp(DEFAULT_ARGS);

    expect(result).toEqual({ ok: false, decision: "not_found" });
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  it("locked OTP → enqueueOtpVerifiedJob NOT called", async () => {
    mockedDecideOtp.mockReturnValue("locked");
    // lockoutRemainingMs calls findFirst; return a fresh row so it computes
    // a positive remaining time without errors.
    mockedFindFirst.mockResolvedValue(
      makeOtpRow({
        attempts: 5,
        maxAttempts: 5,
        createdAt: new Date(), // fresh → lockUntil is in the future
      }) as any,
    );

    const result = await consumeOtp(DEFAULT_ARGS);

    expect(result.ok).toBe(false);
    expect(result.decision).toBe("locked");
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  // ---- userId=null (legacy/web-auth) skips the hook ------------------------

  it("valid OTP but userId=null → enqueueOtpVerifiedJob NOT called", async () => {
    mockedFindFirst.mockResolvedValue(
      makeOtpRow({ userId: null }) as any,
    );

    const result = await consumeOtp(DEFAULT_ARGS);

    // Verification still succeeds — the user just doesn't get the automation.
    expect(result).toEqual({ ok: true, decision: "valid", userId: undefined });
    // The hook is gated by `if (latest!.userId)` — null skips it entirely.
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  // ---- CRITICAL section 2: fire-and-forget error swallowing ----------------

  it("enqueueOtpVerifiedJob throws → consumeOtp still returns ok:true", async () => {
    // The hook is fire-and-forget: any failure inside the enqueue MUST NOT
    // affect OTP verification success. The try/catch swallows the error.
    mockedEnqueue.mockRejectedValue(new Error("Queue is down"));

    const result = await consumeOtp(DEFAULT_ARGS);

    // The hook was attempted.
    expect(mockedEnqueue).toHaveBeenCalledTimes(1);
    // But verification still succeeded — fire-and-forget swallowed the error.
    expect(result).toEqual({ ok: true, decision: "valid", userId: 42 });
  });

  it("enqueueOtpVerifiedJob throws + userId=null → enqueue NOT called at all", async () => {
    // userId=null short-circuits before the enqueue — so a broken enqueue
    // mock shouldn't even be touched. Belt-and-braces check.
    mockedEnqueue.mockRejectedValue(new Error("Should not be called"));
    mockedFindFirst.mockResolvedValue(makeOtpRow({ userId: null }) as any);

    const result = await consumeOtp(DEFAULT_ARGS);

    expect(result.ok).toBe(true);
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  // ---- dedupeKey uses otpCodeId, NOT email --------------------------------

  it("dedupeKey derives from otpCodeId (NOT email) — payload includes otpCodeId", async () => {
    // The verifier passes otpCodeId to enqueueOtpVerifiedJob. The wrapper
    // (in src/lib/automation/index.ts) then builds dedupeKey as
    // `otp_verified:${payload.otpCodeId}`. Two different OTPs for the same
    // email must each enqueue their own job — the dedupe key is per-otpCodeId,
    // never per-email.
    mockedFindFirst.mockResolvedValue(
      makeOtpRow({ id: 777, userId: 42 }) as any,
    );

    await consumeOtp(DEFAULT_ARGS);

    expect(mockedEnqueue).toHaveBeenCalledTimes(1);
    const payload = mockedEnqueue.mock.calls[0][0];

    // The payload MUST include otpCodeId (the dedupeKey source).
    expect(payload.otpCodeId).toBe(777);
    // The wrapper would build dedupeKey = `otp_verified:777`, NOT
    // `otp_verified:user@test.com`. This is what guarantees one email can
    // verify multiple OTPs without the second enqueue being silently deduped.
    const expectedDedupeKey = `otp_verified:${payload.otpCodeId}`;
    expect(expectedDedupeKey).toBe("otp_verified:777");
    expect(expectedDedupeKey).not.toContain(payload.email);
  });

  // ---- environment flows through to the hook payload -----------------------

  it("environment from opts is passed through to enqueueOtpVerifiedJob", async () => {
    await consumeOtp({ ...DEFAULT_ARGS, environment: "production" });

    expect(mockedEnqueue).toHaveBeenCalledTimes(1);
    const payload = mockedEnqueue.mock.calls[0][0];
    expect(payload.environment).toBe("production");
  });
});
