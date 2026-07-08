import { describe, it, expect } from "vitest";
import {
  generateOtpCode,
  hashOtpCode,
  constantTimeVerify,
  decideOtp,
  OTP_MAX_ATTEMPTS,
  type OtpRecordInput,
} from "./generator";

/**
 * Unit tests for the OTP engine (doc Phase 10 / §6, §11 deliverables).
 *
 * These cover: code generation format, HMAC determinism, constant-time compare
 * (true / false / length-mismatch safety), and the pure decision function
 * `decideOtp` — including single-use enforcement (already_used) and lockout
 * after 5 attempts. No database is required: `decideOtp` is the pure decision
 * layer; the atomic single-use DB guard lives in `consumeOtp` (verifier.ts).
 */

const PEPPER = "test-pepper-please-change-in-production-32b";

function makeRecord(overrides: Partial<OtpRecordInput> = {}): OtpRecordInput {
  const code = "123456";
  return {
    codeHash: hashOtpCode(code, PEPPER),
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    // Far-future default so a record is "fresh" relative to any test `now`.
    expiresAt: new Date("2099-01-01T00:00:00Z"),
    consumedAt: null,
    ...overrides,
  };
}

describe("generateOtpCode", () => {
  it("always returns a 6-digit string", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
      const n = Number(code);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(999999);
    }
  });

  it("respects a custom length", () => {
    expect(generateOtpCode(8)).toMatch(/^\d{8}$/);
  });

  it("produces a variety of codes (not a constant)", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) codes.add(generateOtpCode());
    // 100 draws of a uniform 6-digit code should yield many distinct values.
    expect(codes.size).toBeGreaterThan(50);
  });
});

describe("hashOtpCode", () => {
  it("is deterministic for the same code + pepper", () => {
    const a = hashOtpCode("123456", PEPPER);
    const b = hashOtpCode("123456", PEPPER);
    expect(Buffer.compare(a, b)).toBe(0);
  });

  it("produces a 32-byte SHA-256 HMAC", () => {
    expect(hashOtpCode("123456", PEPPER).length).toBe(32);
  });

  it("differs across codes", () => {
    expect(
      Buffer.compare(hashOtpCode("123456", PEPPER), hashOtpCode("654321", PEPPER)),
    ).not.toBe(0);
  });

  it("differs across peppers", () => {
    expect(
      Buffer.compare(hashOtpCode("123456", PEPPER), hashOtpCode("123456", "other-pepper")),
    ).not.toBe(0);
  });
});

describe("constantTimeVerify", () => {
  it("returns true for the correct code", () => {
    const stored = hashOtpCode("123456", PEPPER);
    expect(constantTimeVerify("123456", stored, PEPPER)).toBe(true);
  });

  it("returns false for a wrong code", () => {
    const stored = hashOtpCode("123456", PEPPER);
    expect(constantTimeVerify("654321", stored, PEPPER)).toBe(false);
  });

  it("returns false when the pepper differs", () => {
    const stored = hashOtpCode("123456", PEPPER);
    expect(constantTimeVerify("123456", stored, "wrong-pepper")).toBe(false);
  });

  it("does not throw on a length-mismatched stored hash (returns false)", () => {
    const stored = hashOtpCode("123456", PEPPER);
    const truncated = stored.subarray(0, 10); // wrong length
    expect(() => constantTimeVerify("123456", truncated, PEPPER)).not.toThrow();
    expect(constantTimeVerify("123456", truncated, PEPPER)).toBe(false);
  });
});

describe("decideOtp", () => {
  const now = new Date("2026-01-01T12:00:00Z");

  it("returns not_found when there is no record", () => {
    expect(decideOtp(null, "123456", PEPPER, now)).toBe("not_found");
  });

  it("returns valid for the correct code on a fresh, unexpired record", () => {
    expect(decideOtp(makeRecord(), "123456", PEPPER, now)).toBe("valid");
  });

  it("returns mismatch for an incorrect code", () => {
    expect(decideOtp(makeRecord(), "000000", PEPPER, now)).toBe("mismatch");
  });

  it("returns expired when expiresAt is in the past", () => {
    const record = makeRecord({ expiresAt: new Date(now.getTime() - 1000) });
    expect(decideOtp(record, "123456", PEPPER, now)).toBe("expired");
  });

  it("returns expired at the exact expiry boundary", () => {
    const record = makeRecord({ expiresAt: now });
    expect(decideOtp(record, "123456", PEPPER, now)).toBe("expired");
  });

  // ---- Single-use enforcement (§10.4) -------------------------------------
  it("returns already_used once the code has been consumed (even with the right code)", () => {
    const record = makeRecord({ consumedAt: new Date(now.getTime() - 1000) });
    expect(decideOtp(record, "123456", PEPPER, now)).toBe("already_used");
  });

  it("already_used takes precedence over expired", () => {
    const record = makeRecord({
      consumedAt: new Date(now.getTime() - 60_000),
      expiresAt: new Date(now.getTime() - 1000),
    });
    expect(decideOtp(record, "123456", PEPPER, now)).toBe("already_used");
  });

  // ---- Lockout after 5 attempts (§6) --------------------------------------
  it("returns locked when attempts reach maxAttempts (5), even with the right code", () => {
    const record = makeRecord({ attempts: 5 });
    expect(record.maxAttempts).toBe(5);
    expect(decideOtp(record, "123456", PEPPER, now)).toBe("locked");
  });

  it("is NOT locked at 4 attempts (still allows verification)", () => {
    const record = makeRecord({ attempts: 4 });
    expect(decideOtp(record, "123456", PEPPER, now)).toBe("valid");
    expect(decideOtp(record, "000000", PEPPER, now)).toBe("mismatch");
  });

  it("locked takes precedence over expired", () => {
    const record = makeRecord({
      attempts: 5,
      expiresAt: new Date(now.getTime() - 1000),
    });
    expect(decideOtp(record, "123456", PEPPER, now)).toBe("locked");
  });

  it("already_used takes precedence over locked", () => {
    const record = makeRecord({
      attempts: 5,
      consumedAt: new Date(now.getTime() - 1000),
    });
    expect(decideOtp(record, "123456", PEPPER, now)).toBe("already_used");
  });
});
