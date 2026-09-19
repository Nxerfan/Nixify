/**
 * Auth Preview internal_error regression tests.
 *
 * Root cause: createMailTransport() was called AFTER the OTP row was persisted
 * to the DB. When SMTP env vars were missing (common on Vercel Preview), the
 * GmailSmtpTransport constructor threw "Missing required env var: SMTP_HOST"
 * — leaving an orphaned OTP row and returning a generic internal_error.
 *
 * Fix: moved transport creation BEFORE the DB write, and added specific
 * MAIL_CONFIG_MISSING error code detection so the route returns an
 * actionable 503 instead of a generic 500.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function readSrc(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf-8");
}

describe("Auth Preview — transport creation order", () => {
  it("issueOtp creates transport BEFORE db.otpCode.create (prevents orphaned rows)", () => {
    const verifier = readSrc("src/lib/otp/verifier.ts");
    const transportIdx = verifier.indexOf("const transport = opts.transport ?? createMailTransport();");
    const dbCreateIdx = verifier.indexOf("const created = await db.otpCode.create(");
    
    expect(transportIdx).toBeGreaterThan(-1);
    expect(dbCreateIdx).toBeGreaterThan(-1);
    // Transport must be created BEFORE the DB write
    expect(transportIdx).toBeLessThan(dbCreateIdx);
  });
});

describe("Auth Preview — SMTP config error detection", () => {
  it("api-response.ts has MAIL_CONFIG_MISSING error code", () => {
    expect(readSrc("src/lib/api-response.ts")).toContain("MAIL_CONFIG_MISSING");
  });

  it("resend-otp route detects missing env var errors", () => {
    const route = readSrc("src/app/api/auth/resend-otp/route.ts");
    expect(route).toContain("Missing required env var:");
    expect(route).toContain("MAIL_CONFIG_MISSING");
    expect(route).toContain("503");
  });

  it("signup route detects missing env var errors", () => {
    const route = readSrc("src/app/api/auth/signup/route.ts");
    expect(route).toContain("Missing required env var:");
    expect(route).toContain("MAIL_CONFIG_MISSING");
  });

  it("forgot-password route logs missing env var errors", () => {
    const route = readSrc("src/app/api/auth/forgot-password/route.ts");
    expect(route).toContain("Missing required env var:");
  });
});

// ─── Behavioral test: transport throws before DB write ─────────────────────


vi.mock("@/lib/entitlements/engine", () => ({
  checkUsage: vi.fn(async () => ({ allowed: true, quota: 100, used: 0 })),
}));

vi.mock("@/lib/entitlements/config", () => ({
  FEATURE_KEYS: { OTP_EMAILS: "otp_emails" },
}));

vi.mock("@/lib/ratelimit", () => ({
  enforceOtpSendLimits: vi.fn(async () => ({ allowed: true })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(async () => ({ id: 1, email: "test@example.com", emailVerified: true })),
    },
    otpCode: {
      findFirst: vi.fn(async () => null), // no existing OTP → no lockout
      create: vi.fn(async () => {
        throw new Error("db.otpCode.create should NOT be called when transport fails");
      }),
    },
  },
}));

vi.mock("@/lib/mail/transport", () => ({
  createMailTransport: vi.fn(() => {
    throw new Error("Missing required env var: SMTP_HOST");
  }),
  assertMailConfig: vi.fn(() => {
    throw new Error("Missing required env var: SMTP_HOST");
  }),
}));

vi.mock("@/lib/otp/generator", () => ({
  generateOtpCode: vi.fn(() => "123456"),
  hashOtpCode: vi.fn(() => new Uint8Array([1, 2, 3])),
  OTP_TTL_MS: 600000,
  OTP_MAX_ATTEMPTS: 5,
}));

vi.mock("@/lib/security/gate", () => ({
  preflightOtpSend: vi.fn(async () => null),
}));

vi.mock("@/lib/security", () => ({
  getClientIp: vi.fn(() => null),
}));

vi.mock("@/lib/http", () => ({
  parseBody: vi.fn(async () => [{ email: "test@example.com", purpose: "login" }, null]),
}));

vi.mock("@/lib/validation", () => ({
  resendOtpSchema: {},
}));

vi.mock("@/lib/i18n/resolve", () => ({
  resolveRequestUserLocale: vi.fn(async () => "en"),
}));

vi.mock("@/lib/api-response", () => ({
  apiOk: vi.fn((data, status) => Response.json(data, { status })),
  apiError: vi.fn((code, message, status) => 
    Response.json({ error: code, message }, { status })),
  ERROR_CODES: {
    RATE_LIMITED: "rate_limited",
    LOCKED: "locked",
    INTERNAL: "internal_error",
    MAIL_CONFIG_MISSING: "mail_config_missing",
  },
}));

describe("Auth Preview — issueOtp does not write DB row when SMTP is misconfigured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resend-otp returns 503 mail_config_missing when SMTP env vars are absent", async () => {
    const mod = await import("@/app/api/auth/resend-otp/route");
    const req = new Request("https://example.com/api/auth/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", purpose: "login" }),
    });

    const res = await mod.POST(req);
    expect(res.status).toBe(503);
    
    const body = await res.json();
    expect(body.error).toBe("mail_config_missing");
    
    // Verify db.otpCode.create was NOT called (no orphaned row)
    const { db } = await import("@/lib/db");
    expect(db.otpCode.create).not.toHaveBeenCalled();
  });

  it("resend-otp does NOT leak env var names to the client", async () => {
    const mod = await import("@/app/api/auth/resend-otp/route");
    const req = new Request("https://example.com/api/auth/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", purpose: "login" }),
    });

    const res = await mod.POST(req);
    const body = await res.json();
    // The message must NOT contain the env var name
    expect(body.message).not.toContain("SMTP_HOST");
    expect(body.message).not.toContain("SMTP_PORT");
    expect(body.message).not.toContain("OTP_PEPPER");
    expect(body.message).not.toContain("Missing required");
  });
});

// ─── assertMailConfig validates ALL required vars before DB writes ────────

describe("assertMailConfig validates all mail config before DB writes", () => {
  it("assertMailConfig is exported from transport module", () => {
    // Source-level test: verify the function exists
    const src = readFileSync(resolve(process.cwd(), "src/lib/mail/transport.ts"), "utf-8");
    expect(src).toContain("export function assertMailConfig");
    expect(src).toContain('required("SMTP_HOST")');
    expect(src).toContain('required("SMTP_PORT")');
    expect(src).toContain('required("SMTP_USER")');
    expect(src).toContain('required("SMTP_PASS")');
    expect(src).toContain('required("SMTP_FROM")');
  });

  it("issueOtp calls assertMailConfig BEFORE hashOtpCode and db.otpCode.create", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/otp/verifier.ts"), "utf-8");
    const assertIdx = src.indexOf("assertMailConfig()");
    // Use indexOf with a start position after the imports to find the actual call
    const hashIdx = src.indexOf("hashOtpCode(code)", 200);
    const createIdx = src.indexOf("db.otpCode.create({", 200);
    
    expect(assertIdx).toBeGreaterThan(-1);
    expect(hashIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(-1);
    
    // assertMailConfig must come before hashOtpCode call
    expect(assertIdx).toBeLessThan(hashIdx);
    // hashOtpCode call must come before db.otpCode.create
    expect(hashIdx).toBeLessThan(createIdx);
  });

  it("GmailSmtpTransport constructor validates SMTP_FROM at construction time", () => {
    const src = readFileSync(resolve(process.cwd(), "src/lib/mail/transport.ts"), "utf-8");
    // Find the constructor body
    const constructorIdx = src.indexOf("constructor() {");
    const constructorEnd = src.indexOf("}", constructorIdx + 20);
    const constructorBody = src.substring(constructorIdx, constructorEnd);
    
    // SMTP_FROM must be validated in the constructor, not just in send()
    expect(constructorBody).toContain('required("SMTP_FROM")');
  });
});
