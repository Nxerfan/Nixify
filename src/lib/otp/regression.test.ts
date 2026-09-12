import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import { issueOtp, consumeOtp } from "@/lib/otp/verifier";
import { hashOtpCode, decideOtp, OTP_MAX_ATTEMPTS, OTP_TTL_MS } from "@/lib/otp/generator";
import type { MailTransport } from "@/lib/mail/transport";

/**
 * Regression tests for the OTP engine — the full send + verify cycle, plus
 * edge cases that are easy to break when refactoring (atomic single-use under
 * concurrency, test/live environment boundary, mismatch, expiration, lockout).
 *
 * The pure decideOtp() function is exhaustively tested in otp.test.ts. These
 * tests cover the database-backed issueOtp() + consumeOtp() path — the part
 * that actually touches the OTP table and enforces single-use atomically.
 *
 * Test design:
 *   - Uses a fake in-memory transport so no real email is sent.
 *   - Tags every OTP row with `environment: "development"` to exercise the
 *     test/live boundary code path (and to make cleanup easy: just delete
 *     rows where environment = "development").
 *   - Asserts the exact decision string for each case so a refactor that
 *     silently changes the decision (e.g. "valid" → "ok") fails loudly.
 *
 * NOTE: These tests require a working database connection. If the DB isn't
 * reachable (e.g. CI without Postgres), the suite is SKIPPED — vitest reports
 * each test as `skipped`, NOT as failed.
 */

const PEPPER = "regression-test-pepper-32-bytes-long!!";
const TARGET_EMAIL = "regression@test.com";
const PURPOSE = "signup" as const;

/** In-memory transport: captures the last send so the test can read the code. */
function fakeTransport(): MailTransport & { lastCode: string | null } {
  const holder: { lastCode: string | null } = { lastCode: null };
  return Object.assign(holder, {
    async send({ to, html }: { to: string; subject: string; text: string; html: string }) {
      // Extract the 6-digit code from the HTML body for the test to read.
      const match = html.match(/\b(\d{6})\b/);
      // We only care about the most recent send to this address.
      if (to === TARGET_EMAIL) holder.lastCode = match ? match[1] : null;
      return { messageId: "test-message-id" };
    },
  }) as MailTransport & { lastCode: string | null };
}

let dbAvailable = true;

beforeAll(async () => {
  process.env.OTP_PEPPER = PEPPER;
  try {
    // Touch the DB to verify it's reachable.
    await db.otpCode.count({ where: { environment: "development" } });
  } catch (err) {
    console.warn(
      "[regression.test] DB unavailable — skipping suite. Error:",
      err instanceof Error ? err.message : String(err),
    );
    dbAvailable = false;
  }
});

beforeEach(async () => {
  if (!dbAvailable) return;
  // Wipe the test fixtures between tests.
  await db.otpCode.deleteMany({
    where: { OR: [{ targetEmail: TARGET_EMAIL }, { environment: "development" }] },
  });
});

afterAll(async () => {
  if (!dbAvailable) return;
  await db.otpCode.deleteMany({
    where: { OR: [{ targetEmail: TARGET_EMAIL }, { environment: "development" }] },
  });
  await db.$disconnect();
});

// Skip the entire suite when DB is unavailable.
beforeEach((ctx) => {
  if (!dbAvailable) ctx.skip();
});

describe("OTP regression: send + verify happy path", () => {
  it("issues a code, then verifies it", async () => {
    const transport = fakeTransport();
    const issued = await issueOtp({
      email: TARGET_EMAIL,
      purpose: PURPOSE,
      environment: "development",
      transport,
      skipEmailRateLimit: true,
      ip: "127.0.0.1",
    });

    expect(issued.requestId).toBeTruthy();
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(transport.lastCode).toMatch(/^\d{6}$/);

    const result = await consumeOtp({
      email: TARGET_EMAIL,
      code: transport.lastCode!,
      purpose: PURPOSE,
      environment: "development",
      pepperOverride: PEPPER,
      ip: "127.0.0.1",
    });

    expect(result.ok).toBe(true);
    expect(result.decision).toBe("valid");
  });
});

describe("OTP regression: resend path", () => {
  it("re-issues a code that verifies (resend = second issue + verify)", async () => {
    const transport = fakeTransport();
    await issueOtp({
      email: TARGET_EMAIL,
      purpose: PURPOSE,
      environment: "development",
      transport,
      skipEmailRateLimit: true,
      isResend: true,
      ip: "127.0.0.1",
    });
    expect(transport.lastCode).toMatch(/^\d{6}$/);

    const result = await consumeOtp({
      email: TARGET_EMAIL,
      code: transport.lastCode!,
      purpose: PURPOSE,
      environment: "development",
      pepperOverride: PEPPER,
      ip: "127.0.0.1",
    });
    expect(result.decision).toBe("valid");
  });
});

describe("OTP regression: expiration", () => {
  it("rejects an expired code", async () => {
    // Manually insert a row whose expiresAt is in the past.
    const code = "987654";
    const codeHash = hashOtpCode(code, PEPPER);
    await db.otpCode.create({
      data: {
        targetEmail: TARGET_EMAIL,
        codeHash: Uint8Array.from(codeHash),
        purpose: PURPOSE,
        attempts: 0,
        maxAttempts: OTP_MAX_ATTEMPTS,
        expiresAt: new Date(Date.now() - 1000), // expired 1s ago
        environment: "development",
      },
    });

    const result = await consumeOtp({
      email: TARGET_EMAIL,
      code,
      purpose: PURPOSE,
      environment: "development",
      pepperOverride: PEPPER,
      ip: "127.0.0.1",
    });
    expect(result.decision).toBe("expired");
    expect(result.ok).toBe(false);
  });
});

describe("OTP regression: mismatch", () => {
  it("rejects a wrong code with `mismatch`", async () => {
    const transport = fakeTransport();
    await issueOtp({
      email: TARGET_EMAIL,
      purpose: PURPOSE,
      environment: "development",
      transport,
      skipEmailRateLimit: true,
      ip: "127.0.0.1",
    });
    expect(transport.lastCode).toMatch(/^\d{6}$/);

    const result = await consumeOtp({
      email: TARGET_EMAIL,
      code: "000000", // wrong code (and unlikely to be the real code)
      purpose: PURPOSE,
      environment: "development",
      pepperOverride: PEPPER,
      ip: "127.0.0.1",
    });
    expect(result.decision).toBe("mismatch");
    expect(result.ok).toBe(false);
  });
});

describe("OTP regression: already-used (atomic single-use)", () => {
  it("a consumed code can't be verified again", async () => {
    const transport = fakeTransport();
    await issueOtp({
      email: TARGET_EMAIL,
      purpose: PURPOSE,
      environment: "development",
      transport,
      skipEmailRateLimit: true,
      ip: "127.0.0.1",
    });

    const code = transport.lastCode!;

    // First verify — should succeed.
    const r1 = await consumeOtp({
      email: TARGET_EMAIL,
      code,
      purpose: PURPOSE,
      environment: "development",
      pepperOverride: PEPPER,
      ip: "127.0.0.1",
    });
    expect(r1.decision).toBe("valid");

    // Second verify of the SAME code — should be already_used.
    const r2 = await consumeOtp({
      email: TARGET_EMAIL,
      code,
      purpose: PURPOSE,
      environment: "development",
      pepperOverride: PEPPER,
      ip: "127.0.0.1",
    });
    expect(r2.decision).toBe("already_used");
    expect(r2.ok).toBe(false);
  });

  it("concurrent verifies only succeed ONCE (atomic single-use guard)", async () => {
    // The atomic single-use is enforced via `updateMany WHERE consumedAt IS NULL`.
    // If two requests race, only one should get count=1; the other gets count=0
    // → already_used. We simulate this by issuing once, then firing N parallel
    // consumeOtp calls and asserting exactly one succeeds.
    const transport = fakeTransport();
    await issueOtp({
      email: TARGET_EMAIL,
      purpose: PURPOSE,
      environment: "development",
      transport,
      skipEmailRateLimit: true,
      ip: "127.0.0.1",
    });
    const code = transport.lastCode!;

    const N = 8;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        consumeOtp({
          email: TARGET_EMAIL,
          code,
          purpose: PURPOSE,
          environment: "development",
          pepperOverride: PEPPER,
          ip: "127.0.0.1",
        }),
      ),
    );
    const validCount = results.filter((r) => r.decision === "valid").length;
    const alreadyUsedCount = results.filter((r) => r.decision === "already_used").length;

    // Exactly ONE verify must succeed; the others must report already_used.
    expect(validCount).toBe(1);
    // The remaining N-1 are split between already_used and (possibly) mismatch
    // (if the increment happens between read+decide). Both are non-valid.
    expect(validCount + alreadyUsedCount).toBe(N);
  });
});

describe("OTP regression: test/live boundary", () => {
  it("a test environment cannot verify a production OTP", async () => {
    // Issue a PRODUCTION OTP.
    const transport = fakeTransport();
    await issueOtp({
      email: TARGET_EMAIL,
      purpose: PURPOSE,
      environment: "production",
      transport,
      skipEmailRateLimit: true,
      ip: "127.0.0.1",
    });
    expect(transport.lastCode).toMatch(/^\d{6}$/);

    // Verify with environment=development — should NOT match the production OTP.
    const result = await consumeOtp({
      email: TARGET_EMAIL,
      code: transport.lastCode!,
      purpose: PURPOSE,
      environment: "development",
      pepperOverride: PEPPER,
      ip: "127.0.0.1",
    });
    expect(result.decision).toBe("not_found");
  });

  it("a live environment cannot verify a test OTP", async () => {
    // Issue a DEVELOPMENT OTP.
    const transport = fakeTransport();
    await issueOtp({
      email: TARGET_EMAIL,
      purpose: PURPOSE,
      environment: "development",
      transport,
      skipEmailRateLimit: true,
      ip: "127.0.0.1",
    });
    expect(transport.lastCode).toMatch(/^\d{6}$/);

    // Verify with environment=production — should NOT match the test OTP.
    const result = await consumeOtp({
      email: TARGET_EMAIL,
      code: transport.lastCode!,
      purpose: PURPOSE,
      environment: "production",
      pepperOverride: PEPPER,
      ip: "127.0.0.1",
    });
    expect(result.decision).toBe("not_found");
  });

  it("a web-auth flow (no environment) can verify BOTH test and live OTPs (backward compat)", async () => {
    // Issue a development OTP.
    const transport1 = fakeTransport();
    await issueOtp({
      email: TARGET_EMAIL,
      purpose: PURPOSE,
      environment: "development",
      transport: transport1,
      skipEmailRateLimit: true,
      ip: "127.0.0.1",
    });
    const devResult = await consumeOtp({
      email: TARGET_EMAIL,
      code: transport1.lastCode!,
      purpose: PURPOSE,
      // No environment → matches any row (backward-compat for web-auth).
      pepperOverride: PEPPER,
      ip: "127.0.0.1",
    });
    expect(devResult.decision).toBe("valid");

    // Issue a production OTP.
    const transport2 = fakeTransport();
    await issueOtp({
      email: TARGET_EMAIL,
      purpose: PURPOSE,
      environment: "production",
      transport: transport2,
      skipEmailRateLimit: true,
      ip: "127.0.0.1",
    });
    const prodResult = await consumeOtp({
      email: TARGET_EMAIL,
      code: transport2.lastCode!,
      purpose: PURPOSE,
      pepperOverride: PEPPER,
      ip: "127.0.0.1",
    });
    expect(prodResult.decision).toBe("valid");
  });
});

describe("OTP regression: pure decideOtp lockout + already_used precedence", () => {
  // These don't need the DB — they assert the pure decision function's
  // precedence rules, which the consumeOtp tests above rely on.
  const now = new Date("2026-01-01T12:00:00Z");

  it("already_used takes precedence over locked (5 attempts + consumed)", () => {
    const record = {
      codeHash: hashOtpCode("111111", PEPPER),
      attempts: OTP_MAX_ATTEMPTS,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      consumedAt: new Date(now.getTime() - 1000),
    };
    expect(decideOtp(record, "111111", PEPPER, now)).toBe("already_used");
  });

  it("locked takes precedence over expired (5 attempts, expired, not consumed)", () => {
    const record = {
      codeHash: hashOtpCode("222222", PEPPER),
      attempts: OTP_MAX_ATTEMPTS,
      maxAttempts: OTP_MAX_ATTEMPTS,
      expiresAt: new Date(now.getTime() - 1000),
      consumedAt: null,
    };
    expect(decideOtp(record, "222222", PEPPER, now)).toBe("locked");
  });
});
