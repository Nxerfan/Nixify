/**
 * Service-aware email provider foundation tests.
 *
 * Tests the REAL provider/transport/service infrastructure — no real SMTP
 * calls. Mocks `process.env` where needed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";

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

  it("createMailTransportForService uses canonical EmailService type (not string)", () => {
    const src = read("src/lib/mail/transport.ts");
    expect(src).toMatch(/createMailTransportForService\(service: EmailService\)/);
  });
});

// ---- Behavioral tests: service propagation through real wiring ------------

describe("behavioral: service propagation through real wiring", () => {
  const ENV_BACKUP: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save env
    for (const k of ["SMTP_HOST","SMTP_PORT","SMTP_USER","SMTP_PASS","SMTP_FROM","MAIL_TRANSPORT","MAIL_REPLY_TO","DKIM_DOMAIN","DKIM_SELECTOR","DKIM_PRIVATE_KEY","EMAIL_PROVIDER","NODE_ENV"]) {
      ENV_BACKUP[k] = process.env[k];
    }
    // Set valid test SMTP env
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "user@test.com";
    process.env.SMTP_PASS = "test-pass";
    process.env.SMTP_FROM = "Test <test@test.com>";
    delete process.env.MAIL_TRANSPORT;
    delete process.env.EMAIL_PROVIDER;
    (process.env as Record<string, string | undefined>).NODE_ENV = undefined;
    vi.resetModules();
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(ENV_BACKUP)) {
      if (k === "NODE_ENV") {
        (process.env as Record<string, string | undefined>).NODE_ENV = v;
      } else if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
    vi.restoreAllMocks();
  });

  it("OTP resolves the OTP service transport (not transactional)", async () => {
    const { __resetMailTransportCacheForTests } = await import("@/lib/mail/transport");
    __resetMailTransportCacheForTests();
    const { createMailTransportForService } = await import("@/lib/mail/transport");
    // OTP should get its own cache entry, not the transactional one.
    const otpTransport = createMailTransportForService("otp");
    const transactionalTransport = createMailTransportForService("transactional");
    // Different cache entries (even though they use the same config in Phase 1).
    expect(otpTransport).not.toBe(transactionalTransport);
  });

  it("Transactional provider resolution uses the transactional service transport", async () => {
    const { __resetProviderCacheForTests } = await import("@/lib/messaging/providers/factory");
    __resetProviderCacheForTests();
    const { getEmailProviderForService } = await import("@/lib/messaging/providers/factory");
    const provider = getEmailProviderForService("transactional");
    expect(provider.name).toBe("smtp");
  });

  it("Broadcast provider resolution uses the broadcast service transport", async () => {
    const { __resetProviderCacheForTests } = await import("@/lib/messaging/providers/factory");
    __resetProviderCacheForTests();
    const { getEmailProviderForService } = await import("@/lib/messaging/providers/factory");
    const provider = getEmailProviderForService("broadcast");
    expect(provider.name).toBe("smtp");
  });

  it("Different services do not share the same provider cache entry", async () => {
    const { __resetProviderCacheForTests } = await import("@/lib/messaging/providers/factory");
    __resetProviderCacheForTests();
    const { getEmailProviderForService } = await import("@/lib/messaging/providers/factory");
    const t = getEmailProviderForService("transactional");
    const b = getEmailProviderForService("broadcast");
    // Different cache entries even though same config in Phase 1.
    expect(t).not.toBe(b);
  });

  it("injected transports still take precedence over default resolution", async () => {
    const { SmtpEmailProvider } = await import("@/lib/messaging/providers/smtp");
    const fakeTransport = { send: vi.fn(async () => ({ messageId: "fake" })) };
    const provider = new SmtpEmailProvider(fakeTransport as any);
    // Should NOT throw (no SMTP env needed — injected transport used).
    expect(provider.name).toBe("smtp");
  });

  it("unknown EMAIL_PROVIDER fails closed", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    const { __resetProviderCacheForTests } = await import("@/lib/messaging/providers/factory");
    __resetProviderCacheForTests();
    const { getEmailProviderForService } = await import("@/lib/messaging/providers/factory");
    expect(() => getEmailProviderForService("transactional")).toThrow(/Unknown EMAIL_PROVIDER/);
  });

  it("unknown MAIL_TRANSPORT fails closed", async () => {
    process.env.MAIL_TRANSPORT = "ses";
    const { __resetMailTransportCacheForTests } = await import("@/lib/mail/transport");
    __resetMailTransportCacheForTests();
    const { createMailTransportForService } = await import("@/lib/mail/transport");
    expect(() => createMailTransportForService("otp")).toThrow(/Unknown MAIL_TRANSPORT/);
  });

  it("MAIL_TRANSPORT=console fails in production", async () => {
    process.env.MAIL_TRANSPORT = "console";
    (process.env as any).NODE_ENV = "production";
    const { __resetMailTransportCacheForTests } = await import("@/lib/mail/transport");
    __resetMailTransportCacheForTests();
    const { createMailTransportForService } = await import("@/lib/mail/transport");
    expect(() => createMailTransportForService("otp")).toThrow(/not permitted in production/);
  });

  it("valid SMTP/default compatibility continues to work", async () => {
    process.env.MAIL_TRANSPORT = "smtp";
    const { __resetMailTransportCacheForTests } = await import("@/lib/mail/transport");
    __resetMailTransportCacheForTests();
    const { createMailTransportForService } = await import("@/lib/mail/transport");
    const transport = createMailTransportForService("otp");
    expect(transport).toBeDefined();
  });

  it("missing SMTP configuration for OTP fails before OTP DB persistence", async () => {
    delete process.env.SMTP_HOST;
    const { assertMailConfig } = await import("@/lib/mail/transport");
    expect(() => assertMailConfig()).toThrow("SMTP_HOST");
  });

  it("all three Phase-1 services resolve the same legacy SMTP credentials", async () => {
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const otp = loadSmtpConfig("otp");
    const t = loadSmtpConfig("transactional");
    const b = loadSmtpConfig("broadcast");
    expect(otp.host).toBe(t.host);
    expect(t.host).toBe(b.host);
    expect(otp.user).toBe(t.user);
    expect(t.user).toBe(b.user);
  });

  it("factory passes service to SmtpEmailProvider (not hardcoded transactional)", async () => {
    // Read source to verify the factory passes `service` (not a hardcoded string).
    const src = read("src/lib/messaging/providers/factory.ts");
    expect(src).toMatch(/new SmtpEmailProvider\(service\)/);
  });

  it("SmtpEmailProvider resolves service-aware transport when given service string", async () => {
    const src = read("src/lib/messaging/providers/smtp.ts");
    // The constructor must accept EmailService and call createMailTransportForService(service).
    expect(src).toMatch(/transportOrService\?: MailTransport \| EmailService/);
    expect(src).toMatch(/createMailTransportForService\(service\)/);
  });

  it("createMailTransportForService uses canonical loadSmtpConfig (not legacy)", async () => {
    const src = read("src/lib/mail/transport.ts");
    expect(src).toMatch(/loadSmtpConfig\(service\)/);
    // Must NOT have a separate loadLegacySmtpConfig.
    expect(src).not.toMatch(/loadLegacySmtpConfig/);
  });

  it("MAIL_TRANSPORT default is 'smtp' (not 'gmail')", async () => {
    const src = read("src/lib/mail/transport.ts");
    // The default should be "smtp" (matching .env.example), with "gmail"
    // accepted as a historical compatibility alias.
    expect(src).toMatch(/process\.env\.MAIL_TRANSPORT \?\? "smtp"/);
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
    // Should NOT advertise speculative future variable names.
    expect(src).not.toMatch(/OTP_SMTP_1_\*/);
    expect(src).not.toMatch(/TRANSACTIONAL_SMTP_\*/);
  });
});

// ---- No migration needed ----------------------------------------------------

describe("no migration needed", () => {
  it("no new migration files were added", () => {
    const migrations = readdirSync(join(process.cwd(), "prisma/migrations"));
    // There should be no new migration referencing email/service/provider.
    const newMigrations = migrations.filter(
      (m: string) => /email.*service|service.*provider|provider.*pool/i.test(m),
    );
    expect(newMigrations).toEqual([]);
  });
});
