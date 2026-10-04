/**
 * Phase 2: Service-specific SMTP configuration tests.
 *
 * Behavioral tests proving block-level precedence, isolation, partial-config
 * failure, DKIM atomicity, port validation, and OTP DB safety.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const SHARED_ENV: Record<string, string> = {
  SMTP_HOST: "smtp.shared.com",
  SMTP_PORT: "465",
  SMTP_USER: "shared@user.com",
  SMTP_PASS: "shared-pass",
  SMTP_FROM: "Shared <shared@from.com>",
  MAIL_REPLY_TO: "shared-reply@from.com",
  DKIM_DOMAIN: "shared-dkim.com",
  DKIM_SELECTOR: "shared-selector",
  DKIM_PRIVATE_KEY: "shared-key-data",
};

const OTP_ENV: Record<string, string> = {
  OTP_SMTP_HOST: "smtp.otp.com",
  OTP_SMTP_PORT: "587",
  OTP_SMTP_USER: "otp@user.com",
  OTP_SMTP_PASS: "otp-pass",
  OTP_SMTP_FROM: "OTP <otp@from.com>",
  OTP_MAIL_REPLY_TO: "otp-reply@from.com",
  OTP_DKIM_DOMAIN: "otp-dkim.com",
  OTP_DKIM_SELECTOR: "otp-selector",
  OTP_DKIM_PRIVATE_KEY: "otp-key-data",
};

const TRANSACTIONAL_ENV: Record<string, string> = {
  TRANSACTIONAL_SMTP_HOST: "smtp.trans.com",
  TRANSACTIONAL_SMTP_PORT: "465",
  TRANSACTIONAL_SMTP_USER: "trans@user.com",
  TRANSACTIONAL_SMTP_PASS: "trans-pass",
  TRANSACTIONAL_SMTP_FROM: "Trans <trans@from.com>",
  TRANSACTIONAL_MAIL_REPLY_TO: "trans-reply@from.com",
  TRANSACTIONAL_DKIM_DOMAIN: "trans-dkim.com",
  TRANSACTIONAL_DKIM_SELECTOR: "trans-selector",
  TRANSACTIONAL_DKIM_PRIVATE_KEY: "trans-key-data",
};

const BROADCAST_ENV: Record<string, string> = {
  BROADCAST_SMTP_HOST: "smtp.broadcast.com",
  BROADCAST_SMTP_PORT: "465",
  BROADCAST_SMTP_USER: "broadcast@user.com",
  BROADCAST_SMTP_PASS: "broadcast-pass",
  BROADCAST_SMTP_FROM: "Broadcast <broadcast@from.com>",
  BROADCAST_MAIL_REPLY_TO: "broadcast-reply@from.com",
  BROADCAST_DKIM_DOMAIN: "broadcast-dkim.com",
  BROADCAST_DKIM_SELECTOR: "broadcast-selector",
  BROADCAST_DKIM_PRIVATE_KEY: "broadcast-key-data",
};

const ENV_BACKUP: Record<string, string | undefined> = {};

function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) process.env[k] = v;
}

function clearEnv(vars: Record<string, string>) {
  for (const k of Object.keys(vars)) delete process.env[k];
}

beforeEach(() => {
  // Backup all relevant env vars
  const allKeys = new Set([
    ...Object.keys(SHARED_ENV), ...Object.keys(OTP_ENV),
    ...Object.keys(TRANSACTIONAL_ENV), ...Object.keys(BROADCAST_ENV),
    "MAIL_TRANSPORT", "EMAIL_PROVIDER", "NODE_ENV",
  ]);
  for (const k of allKeys) ENV_BACKUP[k] = process.env[k];

  // Start with shared env only (no service-specific)
  clearEnv({ ...OTP_ENV, ...TRANSACTIONAL_ENV, ...BROADCAST_ENV });
  setEnv(SHARED_ENV);
  delete process.env.MAIL_TRANSPORT;
  delete process.env.EMAIL_PROVIDER;
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  vi.resetModules();
});

afterEach(() => {
  clearEnv({ ...SHARED_ENV, ...OTP_ENV, ...TRANSACTIONAL_ENV, ...BROADCAST_ENV });
  for (const [k, v] of Object.entries(ENV_BACKUP)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.restoreAllMocks();
});

// ---- Legacy compatibility ---------------------------------------------------

describe("legacy compatibility — no service-specific vars", () => {
  it("OTP resolves legacy shared SMTP config", async () => {
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("otp");
    expect(config.host).toBe("smtp.shared.com");
    expect(config.user).toBe("shared@user.com");
    expect(config.from).toBe("Shared <shared@from.com>");
  });

  it("Transactional resolves legacy shared SMTP config", async () => {
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("transactional");
    expect(config.host).toBe("smtp.shared.com");
  });

  it("Broadcast resolves legacy shared SMTP config", async () => {
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("broadcast");
    expect(config.host).toBe("smtp.shared.com");
  });

  it("legacy MAIL_REPLY_TO works", async () => {
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("otp");
    expect(config.replyTo).toBe("shared-reply@from.com");
  });

  it("legacy DKIM works (all three set)", async () => {
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("transactional");
    expect(config.dkim).not.toBeNull();
    expect(config.dkim!.domainName).toBe("shared-dkim.com");
    expect(config.dkim!.keySelector).toBe("shared-selector");
    expect(config.dkim!.privateKey).toBe("shared-key-data");
  });
});

// ---- OTP isolation ----------------------------------------------------------

describe("OTP isolation — service-specific overrides legacy", () => {
  it("complete OTP-specific config overrides shared for OTP", async () => {
    setEnv(OTP_ENV);
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const otpConfig = loadSmtpConfig("otp");
    expect(otpConfig.host).toBe("smtp.otp.com");
    expect(otpConfig.user).toBe("otp@user.com");
    expect(otpConfig.pass).toBe("otp-pass");
    expect(otpConfig.from).toBe("OTP <otp@from.com>");
    expect(otpConfig.replyTo).toBe("otp-reply@from.com");
  });

  it("OTP-specific config does NOT affect Transactional", async () => {
    setEnv(OTP_ENV);
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const transConfig = loadSmtpConfig("transactional");
    expect(transConfig.host).toBe("smtp.shared.com");
    expect(transConfig.user).toBe("shared@user.com");
  });

  it("OTP-specific config does NOT affect Broadcast", async () => {
    setEnv(OTP_ENV);
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const bConfig = loadSmtpConfig("broadcast");
    expect(bConfig.host).toBe("smtp.shared.com");
    expect(bConfig.user).toBe("shared@user.com");
  });

  it("OTP DKIM is independent from shared DKIM", async () => {
    setEnv(OTP_ENV);
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const otpConfig = loadSmtpConfig("otp");
    expect(otpConfig.dkim!.domainName).toBe("otp-dkim.com");
    expect(otpConfig.dkim!.privateKey).toBe("otp-key-data");
    // Transactional still uses shared DKIM
    const transConfig = loadSmtpConfig("transactional");
    expect(transConfig.dkim!.domainName).toBe("shared-dkim.com");
  });
});

// ---- Transactional isolation -------------------------------------------------

describe("Transactional isolation", () => {
  it("complete Transactional-specific config affects only Transactional", async () => {
    setEnv(TRANSACTIONAL_ENV);
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const transConfig = loadSmtpConfig("transactional");
    expect(transConfig.host).toBe("smtp.trans.com");
    // OTP and Broadcast still use shared
    expect(loadSmtpConfig("otp").host).toBe("smtp.shared.com");
    expect(loadSmtpConfig("broadcast").host).toBe("smtp.shared.com");
  });
});

// ---- Broadcast isolation ----------------------------------------------------

describe("Broadcast isolation", () => {
  it("complete Broadcast-specific config affects only Broadcast", async () => {
    setEnv(BROADCAST_ENV);
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const bConfig = loadSmtpConfig("broadcast");
    expect(bConfig.host).toBe("smtp.broadcast.com");
    // OTP and Transactional still use shared
    expect(loadSmtpConfig("otp").host).toBe("smtp.shared.com");
    expect(loadSmtpConfig("transactional").host).toBe("smtp.shared.com");
  });
});

// ---- Partial configuration --------------------------------------------------

describe("partial configuration fails closed", () => {
  it("partial OTP config (USER set, PASS missing) throws and does NOT borrow SMTP_PASS", async () => {
    process.env.OTP_SMTP_HOST = "smtp.otp.com";
    process.env.OTP_SMTP_PORT = "465";
    process.env.OTP_SMTP_USER = "otp@user.com";
    // OTP_SMTP_PASS intentionally NOT set
    process.env.OTP_SMTP_FROM = "OTP <otp@from.com>";
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    expect(() => loadSmtpConfig("otp")).toThrow(/OTP_SMTP_PASS/);
  });

  it("partial OTP config with only OTP_SMTP_HOST set throws", async () => {
    process.env.OTP_SMTP_HOST = "smtp.otp.com";
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    expect(() => loadSmtpConfig("otp")).toThrow(/OTP_SMTP_PORT/);
  });
});

// ---- Optional reply-to ------------------------------------------------------

describe("optional reply-to", () => {
  it("service-specific *_MAIL_REPLY_TO works", async () => {
    setEnv(OTP_ENV);
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("otp");
    expect(config.replyTo).toBe("otp-reply@from.com");
  });

  it("service-specific account without *_MAIL_REPLY_TO does NOT inherit global MAIL_REPLY_TO", async () => {
    // Set OTP block without OTP_MAIL_REPLY_TO
    delete process.env.OTP_MAIL_REPLY_TO;
    setEnv(OTP_ENV);
    delete process.env.OTP_MAIL_REPLY_TO;
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("otp");
    // Should fall back to the OTP service-specific user, NOT the global MAIL_REPLY_TO
    expect(config.replyTo).toBe("otp@user.com");
    expect(config.replyTo).not.toBe("shared-reply@from.com");
  });
});

// ---- DKIM atomicity ---------------------------------------------------------

describe("DKIM atomicity", () => {
  it("complete service-specific DKIM resolves correctly", async () => {
    setEnv(OTP_ENV);
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("otp");
    expect(config.dkim).not.toBeNull();
    expect(config.dkim!.domainName).toBe("otp-dkim.com");
  });

  it("partial service-specific DKIM (DOMAIN set, SELECTOR missing) fails closed", async () => {
    setEnv(OTP_ENV);
    delete process.env.OTP_DKIM_SELECTOR;
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    expect(() => loadSmtpConfig("otp")).toThrow(/DKIM.*partial/i);
  });

  it("no service-specific DKIM → DKIM disabled for that service (does NOT borrow shared DKIM)", async () => {
    setEnv(OTP_ENV);
    delete process.env.OTP_DKIM_DOMAIN;
    delete process.env.OTP_DKIM_SELECTOR;
    delete process.env.OTP_DKIM_PRIVATE_KEY;
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("otp");
    expect(config.dkim).toBeNull();
  });
});

// ---- Port validation --------------------------------------------------------

describe("port validation", () => {
  it("non-numeric port fails safely", async () => {
    process.env.SMTP_PORT = "abc";
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    expect(() => loadSmtpConfig("otp")).toThrow(/SMTP_PORT.*integer/i);
  });

  it("zero port fails safely", async () => {
    process.env.SMTP_PORT = "0";
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    expect(() => loadSmtpConfig("otp")).toThrow(/SMTP_PORT/i);
  });

  it("negative port fails safely", async () => {
    process.env.SMTP_PORT = "-1";
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    expect(() => loadSmtpConfig("otp")).toThrow(/SMTP_PORT/i);
  });

  it("port above 65535 fails safely", async () => {
    process.env.SMTP_PORT = "70000";
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    expect(() => loadSmtpConfig("otp")).toThrow(/SMTP_PORT/i);
  });

  it("service-specific invalid port names the service-specific env var", async () => {
    setEnv(OTP_ENV);
    process.env.OTP_SMTP_PORT = "not-a-port";
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    expect(() => loadSmtpConfig("otp")).toThrow(/OTP_SMTP_PORT/i);
  });
});

// ---- Canonical validation ---------------------------------------------------

describe("canonical validation", () => {
  it("assertSmtpConfig(service) and loadSmtpConfig(service) cannot disagree", async () => {
    const { assertSmtpConfig, loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    // Both should succeed for valid shared config.
    expect(() => assertSmtpConfig("otp")).not.toThrow();
    expect(() => loadSmtpConfig("otp")).not.toThrow();
    // Both should throw for missing config.
    delete process.env.SMTP_HOST;
    expect(() => assertSmtpConfig("otp")).toThrow();
    expect(() => loadSmtpConfig("otp")).toThrow();
  });
});

// ---- OTP database safety ----------------------------------------------------

describe("OTP database safety", () => {
  it("invalid OTP-specific configuration fails before OTP persistence", async () => {
    setEnv(OTP_ENV);
    delete process.env.OTP_SMTP_PASS; // partial block
    const { assertMailConfig } = await import("@/lib/mail/transport");
    expect(() => assertMailConfig()).toThrow(/OTP_SMTP_PASS/);
  });

  it("injected OTP transport still bypasses SMTP env requirements", async () => {
    delete process.env.SMTP_HOST;
    // The verifier accepts opts.transport — that bypasses assertMailConfig.
    // We verify by checking the verifier source uses opts.transport.
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const src = readFileSync(resolve(process.cwd(), "src/lib/otp/verifier.ts"), "utf-8");
    expect(src).toMatch(/opts\.transport \?\? createMailTransportForService/);
  });
});

// ---- Existing safety --------------------------------------------------------

describe("existing safety contracts", () => {
  it("unknown MAIL_TRANSPORT fails closed", async () => {
    process.env.MAIL_TRANSPORT = "ses";
    const { __resetMailTransportCacheForTests } = await import("@/lib/mail/transport");
    __resetMailTransportCacheForTests();
    const { createMailTransportForService } = await import("@/lib/mail/transport");
    expect(() => createMailTransportForService("otp")).toThrow(/Unknown MAIL_TRANSPORT/);
  });

  it("MAIL_TRANSPORT=console fails in production", async () => {
    process.env.MAIL_TRANSPORT = "console";
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const { __resetMailTransportCacheForTests } = await import("@/lib/mail/transport");
    __resetMailTransportCacheForTests();
    const { createMailTransportForService } = await import("@/lib/mail/transport");
    expect(() => createMailTransportForService("otp")).toThrow(/not permitted in production/);
  });

  it("unknown EMAIL_PROVIDER fails closed", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    const { __resetProviderCacheForTests } = await import("@/lib/messaging/providers/factory");
    __resetProviderCacheForTests();
    const { getEmailProviderForService } = await import("@/lib/messaging/providers/factory");
    expect(() => getEmailProviderForService("transactional")).toThrow(/Unknown EMAIL_PROVIDER/);
  });

  it("MAIL_TRANSPORT=smtp compatibility", async () => {
    process.env.MAIL_TRANSPORT = "smtp";
    const { __resetMailTransportCacheForTests } = await import("@/lib/mail/transport");
    __resetMailTransportCacheForTests();
    const { createMailTransportForService } = await import("@/lib/mail/transport");
    const transport = createMailTransportForService("otp");
    expect(transport).toBeDefined();
  });

  it("MAIL_TRANSPORT=gmail (historical alias) compatibility", async () => {
    process.env.MAIL_TRANSPORT = "gmail";
    const { __resetMailTransportCacheForTests } = await import("@/lib/mail/transport");
    __resetMailTransportCacheForTests();
    const { createMailTransportForService } = await import("@/lib/mail/transport");
    const transport = createMailTransportForService("otp");
    expect(transport).toBeDefined();
  });
});

// ---- Cache isolation --------------------------------------------------------

describe("cache isolation with service-specific config", () => {
  it("service-specific transports remain distinct cache entries", async () => {
    setEnv(OTP_ENV); // OTP has its own config
    const { __resetMailTransportCacheForTests } = await import("@/lib/mail/transport");
    __resetMailTransportCacheForTests();
    const { createMailTransportForService } = await import("@/lib/mail/transport");
    const otpTransport = createMailTransportForService("otp");
    const transTransport = createMailTransportForService("transactional");
    // Different instances (different config, different cache entries)
    expect(otpTransport).not.toBe(transTransport);
  });
});

// ---- Secret safety ----------------------------------------------------------

describe("secret safety", () => {
  it("configuration error messages do not contain secret values", async () => {
    delete process.env.SMTP_PASS;
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    try {
      loadSmtpConfig("otp");
      expect.fail("should have thrown");
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).not.toContain("shared-pass");
      expect(msg).not.toContain("otp-pass");
    }
  });
});

// ---- Blocker 1: presence-based activation (not truthiness) ------------------

describe("presence-based block activation (not truthiness)", () => {
  it("empty string OTP_SMTP_HOST activates OTP block (does NOT fall back to shared)", async () => {
    process.env.OTP_SMTP_HOST = "";
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    // Must NOT resolve to shared host — OTP block is activated.
    // OTP_SMTP_HOST is defined (empty string), so required() rejects it.
    expect(() => loadSmtpConfig("otp")).toThrow(/OTP_SMTP_HOST/);
    // Must NOT have resolved to shared config.
    try { loadSmtpConfig("otp"); expect.fail("should throw"); } catch (err) {
      expect((err as Error).message).not.toContain("smtp.shared.com");
    }
  });

  it("empty string OTP_SMTP_PORT activates OTP block", async () => {
    process.env.OTP_SMTP_PORT = "";
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    // Block activated, OTP_SMTP_HOST is missing → throws about OTP_SMTP_HOST.
    expect(() => loadSmtpConfig("otp")).toThrow(/OTP_SMTP_HOST/);
  });

  it("empty string TRANSACTIONAL_SMTP_HOST activates Transactional block", async () => {
    process.env.TRANSACTIONAL_SMTP_HOST = "";
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    // Block activated, TRANSACTIONAL_SMTP_HOST is empty → required() rejects.
    expect(() => loadSmtpConfig("transactional")).toThrow(/TRANSACTIONAL_SMTP_HOST/);
    // OTP must still use shared config (unaffected)
    const otpConfig = loadSmtpConfig("otp");
    expect(otpConfig.host).toBe("smtp.shared.com");
  });

  it("empty string BROADCAST_SMTP_HOST activates Broadcast block", async () => {
    process.env.BROADCAST_SMTP_HOST = "";
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    // Block activated, BROADCAST_SMTP_HOST is empty → required() rejects.
    expect(() => loadSmtpConfig("broadcast")).toThrow(/BROADCAST_SMTP_HOST/);
    // Transactional must still use shared config (unaffected)
    const transConfig = loadSmtpConfig("transactional");
    expect(transConfig.host).toBe("smtp.shared.com");
  });

  it("empty string OTP_MAIL_REPLY_TO (optional var) activates OTP block", async () => {
    process.env.OTP_MAIL_REPLY_TO = "";
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    // Must NOT fall back to shared — OTP block is activated, all core required.
    expect(() => loadSmtpConfig("otp")).toThrow(/OTP_SMTP_HOST/);
  });

  it("empty string OTP_DKIM_DOMAIN activates OTP block", async () => {
    process.env.OTP_DKIM_DOMAIN = "";
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    expect(() => loadSmtpConfig("otp")).toThrow(/OTP_SMTP_HOST/);
  });
});

// ---- Blocker 2: legacy DKIM backward compatibility ------------------------

describe("legacy shared DKIM backward compatibility (permissive)", () => {
  it("only DKIM_DOMAIN set → no throw, dkim === null", async () => {
    delete process.env.DKIM_SELECTOR;
    delete process.env.DKIM_PRIVATE_KEY;
    // DKIM_DOMAIN is already set in SHARED_ENV
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("transactional");
    expect(config.dkim).toBeNull();
  });

  it("only DKIM_DOMAIN + DKIM_SELECTOR set (missing key) → no throw, dkim === null", async () => {
    delete process.env.DKIM_PRIVATE_KEY;
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("transactional");
    expect(config.dkim).toBeNull();
  });

  it("only DKIM_PRIVATE_KEY set → no throw, dkim === null", async () => {
    delete process.env.DKIM_DOMAIN;
    delete process.env.DKIM_SELECTOR;
    // DKIM_PRIVATE_KEY is already set
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("transactional");
    expect(config.dkim).toBeNull();
  });

  it("all three DKIM vars set → DKIM enabled (no throw)", async () => {
    // SHARED_ENV already has all three set
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("transactional");
    expect(config.dkim).not.toBeNull();
    expect(config.dkim!.domainName).toBe("shared-dkim.com");
  });

  it("no DKIM vars set → dkim === null (no throw)", async () => {
    delete process.env.DKIM_DOMAIN;
    delete process.env.DKIM_SELECTOR;
    delete process.env.DKIM_PRIVATE_KEY;
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("transactional");
    expect(config.dkim).toBeNull();
  });
});

// ---- Service-specific DKIM still strict -------------------------------------

describe("service-specific DKIM remains strict", () => {
  it("partial service-specific DKIM still throws (even though legacy is permissive)", async () => {
    setEnv(OTP_ENV);
    delete process.env.OTP_DKIM_SELECTOR;
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    expect(() => loadSmtpConfig("otp")).toThrow(/Service-specific DKIM.*partial/i);
  });

  it("complete service-specific DKIM still resolves correctly", async () => {
    setEnv(OTP_ENV);
    const { loadSmtpConfig } = await import("@/lib/messaging/providers/service-types");
    const config = loadSmtpConfig("otp");
    expect(config.dkim).not.toBeNull();
    expect(config.dkim!.domainName).toBe("otp-dkim.com");
  });
});
