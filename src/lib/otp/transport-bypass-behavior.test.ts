/**
 * Behavioral test: injected MailTransport bypasses SMTP env requirements.
 *
 * This is the BEHAVIORAL proof for PR #50 regression requirement #11.
 * The `service-specific-config.test.ts` file has a lightweight source-contract
 * check for the same behavior; this file proves it end-to-end by actually
 * invoking `issueOtp()` with an injected transport while ALL SMTP_* env vars
 * are deleted — and confirming no SMTP configuration error is thrown.
 *
 * The verifier's DB-touching / external dependencies are mocked so this test
 * runs in the "Code Quality" CI job (no DB required). The DB-gated integration
 * coverage for the same bypass lives in `regression.test.ts` (skipped when the
 * DB is unavailable).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks (hoisted) ────────────────────────────────────────────────────────
//
// issueOtp() needs: rate-limit check, lockout lookup, OTP row create, email
// rendering, and analytics logging. We mock each so issueOtp() can execute
// its full real code path (including the `if (!opts.transport) assertMailConfig()`
// guard) without a live database.

vi.mock("@/lib/db", () => ({
  db: {
    otpCode: {
      create: vi.fn().mockResolvedValue({ requestId: "test-req-1", attempts: 0 }),
      findFirst: vi.fn().mockResolvedValue(null), // no lockout
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    emailTheme: {
      findFirst: vi.fn().mockResolvedValue(null), // no custom theme → system fallback
    },
    brandKit: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock("@/lib/ratelimit", () => ({
  enforceOtpSendLimits: vi.fn().mockResolvedValue({ allowed: true }),
  enforceOtpVerifyLimits: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock("@/lib/security", () => ({
  checkAccountLock: vi.fn(),
  countRecentFailedVerifies: vi.fn().mockResolvedValue(0),
  lockAccountForBruteForce: vi.fn(),
  logEvent: vi.fn(),
  SECURITY_CONFIG: {},
}));

vi.mock("@/lib/analytics", () => ({
  logOtpEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/automation", () => ({
  enqueueOtpVerifiedJob: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/otp/email-renderer", () => ({
  renderOtpEmail: vi.fn().mockReturnValue({
    subject: "Test OTP",
    text: "Your code is 123456",
    html: "<p>123456</p>",
  }),
  purposeToEmailPurpose: vi.fn().mockReturnValue("signup"),
}));

// ─── Test ──────────────────────────────────────────────────────────────────

const SMTP_KEYS = [
  "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM",
  "MAIL_REPLY_TO", "DKIM_DOMAIN", "DKIM_SELECTOR", "DKIM_PRIVATE_KEY",
  "OTP_SMTP_HOST", "OTP_SMTP_PORT", "OTP_SMTP_USER", "OTP_SMTP_PASS",
  "OTP_SMTP_FROM", "OTP_MAIL_REPLY_TO", "OTP_DKIM_DOMAIN",
  "OTP_DKIM_SELECTOR", "OTP_DKIM_PRIVATE_KEY",
  "MAIL_TRANSPORT", "EMAIL_PROVIDER",
];

const ENV_BACKUP: Record<string, string | undefined> = {};

describe("injected transport bypasses SMTP configuration (behavioral)", () => {
  beforeEach(() => {
    for (const k of SMTP_KEYS) {
      ENV_BACKUP[k] = process.env[k];
      delete process.env[k];
    }
    process.env.OTP_PEPPER = "test-pepper-32-bytes-hex-placeholder!!";
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(ENV_BACKUP)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("issueOtp with injected transport succeeds when ALL SMTP env vars are missing", async () => {
    // Sanity: no SMTP config exists at all.
    expect(process.env.SMTP_HOST).toBeUndefined();
    expect(process.env.OTP_SMTP_HOST).toBeUndefined();

    const { issueOtp } = await import("@/lib/otp/verifier");

    const sends: Array<{ to: string; subject: string }> = [];
    const fakeTransport = {
      async send(msg: { to: string; subject: string; text: string; html: string }) {
        sends.push(msg);
        return { messageId: "injected-transport-message-id" };
      },
    };

    // Must NOT throw about SMTP config — the injected transport bypasses
    // both assertMailConfig() and createMailTransportForService().
    const result = await issueOtp({
      email: "bypass@example.com",
      purpose: "signup",
      transport: fakeTransport as any,
      locale: "en",
    });

    expect(result.requestId).toBe("test-req-1");
    expect(result.code).toMatch(/^\d{6}$/);
    expect(sends).toHaveLength(1);
    expect(sends[0].to).toBe("bypass@example.com");
  });

  it("issueOtp WITHOUT transport throws about SMTP config when env vars are missing", async () => {
    // This is the negative control: WITHOUT an injected transport, the
    // `if (!opts.transport) assertMailConfig()` guard fires and the missing
    // SMTP_HOST causes a fail-closed throw.
    expect(process.env.SMTP_HOST).toBeUndefined();

    const { issueOtp } = await import("@/lib/otp/verifier");

    await expect(
      issueOtp({
        email: "no-bypass@example.com",
        purpose: "signup",
        locale: "en",
      } as any),
    ).rejects.toThrow(/SMTP_HOST/);
  });
});
