/**
 * Service-aware email provider foundation tests.
 *
 * Tests the REAL provider/transport/service infrastructure — no real SMTP
 * calls. Mocks `process.env` where needed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../../..");
function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf-8");
}

// ---- Service identity -------------------------------------------------------

describe("EmailService — canonical service model", () => {
  it("recognizes exactly otp, transactional, broadcast", async () => {
    const mod = await import("@/lib/messaging/providers/service-types");
    // The type is a union — we verify the canonical strings are the only
    // valid values by inspecting source.
    const src = read("src/lib/messaging/providers/service-types.ts");
    expect(src).toMatch(/"otp"\s*\|\s*"transactional"\s*\|\s*"broadcast"/);
  });
});

// ---- Legacy compatibility ---------------------------------------------------

describe("legacy SMTP compatibility — all services resolve", () => {
  beforeEach(() => {
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "user@test.com";
    process.env.SMTP_PASS = "test-pass";
    process.env.SMTP_FROM = "Test <test@test.com>";
    delete process.env.MAIL_REPLY_TO;
    delete process.env.DKIM_DOMAIN;
  });

  afterEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
  });

  it("loadSmtpConfig('otp') resolves with legacy SMTP_* vars", async () => {
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("otp");
    expect(config.host).toBe("smtp.test.com");
    expect(config.port).toBe(465);
    expect(config.user).toBe("user@test.com");
    expect(config.from).toBe("Test <test@test.com>");
  });

  it("loadSmtpConfig('transactional') resolves with legacy SMTP_* vars", async () => {
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("transactional");
    expect(config.host).toBe("smtp.test.com");
  });

  it("loadSmtpConfig('broadcast') resolves with legacy SMTP_* vars", async () => {
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("broadcast");
    expect(config.host).toBe("smtp.test.com");
  });
});

// ---- Invalid config --------------------------------------------------------

describe("invalid SMTP configuration fails closed", () => {
  beforeEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
  });

  it("missing SMTP_HOST throws", async () => {
    const { assertSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    expect(() => assertSmtpConfig("otp")).toThrow("SMTP_HOST");
  });

  it("missing SMTP_PASS throws", async () => {
    process.env.SMTP_HOST = "x";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "x";
    process.env.SMTP_FROM = "x";
    const { assertSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    expect(() => assertSmtpConfig("otp")).toThrow("SMTP_PASS");
  });
});

// ---- Service-aware cache isolation ------------------------------------------

describe("service-aware cache isolation", () => {
  it("transport cache is per-service (Map, not global singleton)", () => {
    const src = read("src/lib/mail/transport.ts");
    expect(src).toMatch(/Map<string, MailTransport>/);
    expect(src).toMatch(/createMailTransportForService/);
  });

  it("provider cache is per-service (Map, not global singleton)", () => {
    const src = read("src/lib/messaging/providers/factory.ts");
    expect(src).toMatch(/Map<EmailService, EmailProvider>/);
    expect(src).toMatch(/getEmailProviderForService/);
  });
});

// ---- OTP transport resolution -----------------------------------------------

describe("OTP transport resolution", () => {
  it("verifier resolves through createMailTransportForService('otp')", () => {
    const src = read("src/lib/otp/verifier.ts");
    expect(src).toMatch(/createMailTransportForService\("otp"\)/);
  });

  it("injected transport takes precedence over default", () => {
    const src = read("src/lib/otp/verifier.ts");
    expect(src).toMatch(/opts\.transport \?\? createMailTransportForService/);
  });

  it("assertMailConfig is called before DB mutation", () => {
    const src = read("src/lib/otp/verifier.ts");
    const assertIdx = src.indexOf("assertMailConfig");
    const createIdx = src.indexOf("db.otpCode.create");
    expect(assertIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(-1);
    expect(assertIdx).toBeLessThan(createIdx);
  });
});

// ---- Transactional provider resolution --------------------------------------

describe("transactional provider resolution", () => {
  it("messages/send route uses getEmailProviderForService('transactional')", () => {
    const src = read("src/app/api/v1/messages/send/route.ts");
    expect(src).toMatch(/getEmailProviderForService\("transactional"\)/);
    expect(src).not.toMatch(/new SmtpEmailProvider/);
  });

  it("automation processor uses getEmailProviderForService('transactional')", () => {
    const src = read("src/lib/automation/processor.ts");
    expect(src).toMatch(/getEmailProviderForService\("transactional"\)/);
    expect(src).not.toMatch(/new SmtpEmailProvider/);
  });

  it("templates test-send route uses getEmailProviderForService('transactional')", () => {
    const src = read("src/app/api/dashboard/templates/[id]/test-send/route.ts");
    expect(src).toMatch(/getEmailProviderForService\("transactional"\)/);
    expect(src).not.toMatch(/new SmtpEmailProvider/);
  });
});

// ---- Broadcast provider resolution ------------------------------------------

describe("broadcast provider resolution", () => {
  it("broadcast service uses getEmailProviderForService('broadcast')", () => {
    const src = read("src/lib/broadcasts/service.ts");
    expect(src).toMatch(/getEmailProviderForService\("broadcast"\)/);
    expect(src).not.toMatch(/new SmtpEmailProvider/);
  });
});

// ---- Unknown provider fails closed -------------------------------------------

describe("unknown provider fails closed", () => {
  it("factory rejects unknown EMAIL_PROVIDER", () => {
    const src = read("src/lib/messaging/providers/factory.ts");
    expect(src).toMatch(/Unknown EMAIL_PROVIDER/);
  });
});

// ---- SmtpMailTransport rename + compatibility alias ------------------------

describe("SmtpMailTransport rename + GmailSmtpTransport alias", () => {
  it("class is named SmtpMailTransport (not GmailSmtpTransport)", () => {
    const src = read("src/lib/mail/transport.ts");
    expect(src).toMatch(/export class SmtpMailTransport/);
  });

  it("GmailSmtpTransport alias is exported for backward compatibility", () => {
    const src = read("src/lib/mail/transport.ts");
    expect(src).toMatch(/export const GmailSmtpTransport = SmtpMailTransport/);
  });
});

// ---- .env.example truth -----------------------------------------------------

describe(".env.example — shared SMTP config truth", () => {
  it("documents shared SMTP config for all services", () => {
    const src = read(".env.example");
    expect(src).toMatch(/Shared SMTP configuration for ALL email services/);
    expect(src).toMatch(/OTP, transactional, broadcast/);
    expect(src).toMatch(/Service-/);  // line-broken in the comment
    expect(src).toMatch(/specific SMTP configuration/);
    expect(src).toMatch(/not enabled in this phase/);
  });
});

// ---- No migration needed ----------------------------------------------------

describe("no migration needed", () => {
  it("no new migration files were added", () => {
    const { readdirSync } = require("fs") as typeof import("fs");
    const { join } = require("path") as typeof import("path");
    const migrations = readdirSync(join(process.cwd(), "prisma/migrations"));
    // There should be no new migration referencing email/service/provider.
    const newMigrations = migrations.filter(
      (m: string) => /email.*service|service.*provider|provider.*pool/i.test(m),
    );
    expect(newMigrations).toEqual([]);
  });
});
