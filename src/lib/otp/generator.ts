import { createHmac, randomInt, timingSafeEqual } from "crypto";

/**
 * OTP code generation + cryptographic storage helpers (doc Phase 10 / §6).
 *
 *  - 6-digit code from `crypto.randomInt` (rejection-sampled, no modulo bias).
 *  - Stored as HMAC-SHA256(OTP_PEPPER, code) — never plaintext.
 *  - Verification uses `crypto.timingSafeEqual` (constant-time).
 */

export const OTP_LENGTH = 6;
/** OTP time-to-live: 10 minutes. */
export const OTP_TTL_MS = 10 * 60 * 1000;
/** Lockout window after max attempts exhausted: 15 minutes. */
export const OTP_LOCKOUT_MS = 15 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export type OtpPurpose = "signup" | "login" | "reset" | "account_deletion";

/**
 * Generate a 6-digit OTP code using rejection sampling (no modulo bias).
 * Returns a zero-padded 6-character string, e.g. "042917".
 */
export function generateOtpCode(length = OTP_LENGTH): string {
  const max = 10 ** length; // exclusive upper bound
  const n = randomInt(0, max); // uniform, rejection-sampled
  return n.toString().padStart(length, "0");
}

function getPepper(): string {
  const pepper = process.env.OTP_PEPPER;
  if (!pepper) throw new Error("Missing required env var: OTP_PEPPER");
  return pepper;
}

/**
 * HMAC-SHA256(pepper, code). Returns a Buffer suitable for the `Bytes` Prisma
 * column. The raw code is never persisted.
 */
export function hashOtpCode(code: string, pepper: string = getPepper()): Buffer {
  return createHmac("sha256", pepper).update(code).digest();
}

/**
 * Constant-time comparison of a candidate code against a stored HMAC.
 * Returns true only if the HMACs match exactly. Length mismatches are handled
 * safely (we never pass mismatched-length buffers to timingSafeEqual).
 */
export function constantTimeVerify(
  candidateCode: string,
  storedHash: Uint8Array | Buffer,
  pepper: string = getPepper(),
): boolean {
  const candidateHash = hashOtpCode(candidateCode, pepper);
  const candidateBytes = Uint8Array.from(candidateHash);
  const storedBytes = Uint8Array.from(storedHash);
  if (candidateBytes.length !== storedBytes.length) return false;
  return timingSafeEqual(candidateBytes, storedBytes);
}

// ---- Pure OTP decision (extracted for unit testing — no DB) --------------

export type OtpDecision =
  | "valid"
  | "mismatch"
  | "expired"
  | "locked"
  | "already_used"
  | "not_found";

/** Minimal shape of an OtpCode row used by the pure decision function. */
export interface OtpRecordInput {
  codeHash: Uint8Array | Buffer;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
}

/**
 * Pure decision: given a stored OTP record and a candidate code, decide the
 * outcome WITHOUT touching the database. This is what the unit tests exercise.
 *
 * Order matters: a consumed code reports `already_used` even if it also happens
 * to be expired; a locked code reports `locked` before we even compare.
 *
 *   - already_used  → code was consumed (single-use enforced)
 *   - locked        → attempts >= maxAttempts (lockout after 5 attempts)
 *   - expired       → past TTL
 *   - valid/mismatch → constant-time HMAC compare
 */
export function decideOtp(
  record: OtpRecordInput | null,
  candidateCode: string,
  pepper: string,
  now: Date = new Date(),
): OtpDecision {
  if (!record) return "not_found";
  if (record.consumedAt) return "already_used";
  if (record.attempts >= record.maxAttempts) return "locked";
  if (record.expiresAt.getTime() <= now.getTime()) return "expired";
  return constantTimeVerify(candidateCode, record.codeHash, pepper) ? "valid" : "mismatch";
}
