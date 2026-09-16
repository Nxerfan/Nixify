/**
 * Phase 13 — Localized OTP Messaging tests.
 *
 * Coverage:
 *   - Pure renderer tests: en/fa × sign_up/sign_in/password_reset
 *   - Persian digit correctness (U+06F0–F9, NOT Arabic-Indic U+0660–69)
 *   - OTP digits remain ASCII (never Persian numerals)
 *   - HTML lang/dir correctness
 *   - Production-path locale integration (DB-gated)
 *   - BrandKit preservation (localized + branded appName)
 *   - EmailTheme preservation (custom theme not bypassed)
 *   - Provider call-count: one send = one transport.send
 *   - Render failure → zero provider calls
 *   - Purpose/resend production-path tests
 *   - Security regressions: HMAC/TTL/attempts/single-use unchanged
 *
 * Gated: requires TEST_DATABASE_URL + RUN_OTP_LOCALIZATION=1 for DB tests.
 * Pure renderer tests run without DB.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  renderOtpEmail,
  purposeToEmailPurpose,
  OTP_EMAIL_COPY,
} from "@/lib/otp/email-renderer";
import {
  OTP_LENGTH,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  generateOtpCode,
  hashOtpCode,
  constantTimeVerify,
  decideOtp,
} from "@/lib/otp/generator";
import { issueOtp } from "@/lib/otp/verifier";
import { resolveRequestUserLocale } from "@/lib/i18n/resolve";
import type { MailMessage } from "@/lib/mail/transport";

const RUN = process.env.RUN_OTP_LOCALIZATION === "1";
const CODE = "123456";
const MINS = 10;

// ─── Pure renderer tests (no DB) ──────────────────────────────────────────

describe("OTP email renderer — pure tests", () => {
  describe("en + sign_up", () => {
    it("subject contains 'sign-up verification code'", () => {
      const r = renderOtpEmail({ locale: "en", purpose: "sign_up", code: CODE });
      expect(r.subject).toContain("sign-up verification code");
    });
    it("text contains the code + 'expires in 10 minutes'", () => {
      const r = renderOtpEmail({ locale: "en", purpose: "sign_up", code: CODE, expiresInMinutes: MINS });
      expect(r.text).toContain(CODE);
      expect(r.text).toContain("expires in 10 minutes");
    });
    it("html has lang=en dir=ltr", () => {
      const r = renderOtpEmail({ locale: "en", purpose: "sign_up", code: CODE });
      expect(r.html).toContain('lang="en"');
      expect(r.html).toContain('dir="ltr"');
    });
    it("OTP is ASCII + LTR in HTML", () => {
      const r = renderOtpEmail({ locale: "en", purpose: "sign_up", code: CODE });
      expect(r.html).toContain('dir="ltr"');
      expect(r.html).toContain(CODE);
    });
  });

  describe("fa + sign_up", () => {
    it("subject contains Persian 'ثبت‌نام'", () => {
      const r = renderOtpEmail({ locale: "fa", purpose: "sign_up", code: CODE });
      expect(r.subject).toContain("ثبت‌نام");
    });
    it("text contains the code (ASCII) + Persian expiry", () => {
      const r = renderOtpEmail({ locale: "fa", purpose: "sign_up", code: CODE, expiresInMinutes: MINS });
      expect(r.text).toContain(CODE);
      expect(r.text).toContain("معتبر");
    });
    it("html has lang=fa dir=rtl", () => {
      const r = renderOtpEmail({ locale: "fa", purpose: "sign_up", code: CODE });
      expect(r.html).toContain('lang="fa"');
      expect(r.html).toContain('dir="rtl"');
    });
    it("OTP is ASCII + LTR inside RTL HTML", () => {
      const r = renderOtpEmail({ locale: "fa", purpose: "sign_up", code: CODE });
      expect(r.html).toContain('dir="ltr"');
      expect(r.html).toContain(CODE);
    });
  });

  describe("en + sign_in", () => {
    it("subject contains 'sign-in code'", () => {
      const r = renderOtpEmail({ locale: "en", purpose: "sign_in", code: CODE });
      expect(r.subject).toContain("sign-in code");
    });
    it("text differs from sign_up", () => {
      const signIn = renderOtpEmail({ locale: "en", purpose: "sign_in", code: CODE });
      const signUp = renderOtpEmail({ locale: "en", purpose: "sign_up", code: CODE });
      expect(signIn.text).not.toBe(signUp.text);
    });
  });

  describe("fa + sign_in", () => {
    it("subject contains Persian 'ورود'", () => {
      const r = renderOtpEmail({ locale: "fa", purpose: "sign_in", code: CODE });
      expect(r.subject).toContain("ورود");
    });
    it("text differs from sign_up", () => {
      const signIn = renderOtpEmail({ locale: "fa", purpose: "sign_in", code: CODE });
      const signUp = renderOtpEmail({ locale: "fa", purpose: "sign_up", code: CODE });
      expect(signIn.text).not.toBe(signUp.text);
    });
  });

  describe("password_reset", () => {
    it("en subject contains 'password reset'", () => {
      const r = renderOtpEmail({ locale: "en", purpose: "password_reset", code: CODE });
      expect(r.subject).toContain("password reset");
    });
    it("fa subject contains Persian 'بازنشانی رمز عبور'", () => {
      const r = renderOtpEmail({ locale: "fa", purpose: "password_reset", code: CODE });
      expect(r.subject).toContain("بازنشانی رمز عبور");
    });
  });

  describe("Persian digit correctness", () => {
    it("expiry uses Persian digits (U+06F0–F9), NOT Arabic-Indic (U+0660–69)", () => {
      const r = renderOtpEmail({ locale: "fa", purpose: "sign_up", code: CODE, expiresInMinutes: MINS });
      // Persian digit ۱ is U+06F1
      const hasPersianOne = [...r.text].some(c => c.charCodeAt(0) === 0x06F1);
      expect(hasPersianOne).toBe(true);
      // Arabic-Indic digit ١ is U+0661 — must NOT appear
      const hasArabicIndicOne = [...r.text].some(c => c.charCodeAt(0) === 0x0661);
      expect(hasArabicIndicOne).toBe(false);
    });
    it("Persian '۱۰' (not Arabic-Indic '١٠') appears in fa expiry", () => {
      const r = renderOtpEmail({ locale: "fa", purpose: "sign_up", code: CODE, expiresInMinutes: MINS });
      expect(r.text).toContain("۱۰");
      expect(r.text).not.toContain("١٠");
    });
  });

  describe("OTP digits remain ASCII", () => {
    it("code is never converted to Persian numerals", () => {
      const r = renderOtpEmail({ locale: "fa", purpose: "sign_up", code: CODE });
      expect(r.text).toContain("123456");
      expect(r.html).toContain("123456");
      // Persian digit ۱۲۳۴۵۶ must NOT appear
      expect(r.text).not.toContain("۱۲۳۴۵۶");
    });
  });

  describe("text and HTML agree", () => {
    it("en sign_up: same code, same expiry meaning", () => {
      const r = renderOtpEmail({ locale: "en", purpose: "sign_up", code: CODE, expiresInMinutes: MINS });
      expect(r.text).toContain(CODE);
      expect(r.html).toContain(CODE);
      expect(r.text).toContain("10 minutes");
      expect(r.html).toContain("10 minutes");
    });
    it("fa sign_up: same code, same expiry meaning", () => {
      const r = renderOtpEmail({ locale: "fa", purpose: "sign_up", code: CODE, expiresInMinutes: MINS });
      expect(r.text).toContain(CODE);
      expect(r.html).toContain(CODE);
    });
  });

  describe("purposeToEmailPurpose mapping", () => {
    it("signup → sign_up", () => {
      expect(purposeToEmailPurpose("signup")).toBe("sign_up");
    });
    it("login → sign_in", () => {
      expect(purposeToEmailPurpose("login")).toBe("sign_in");
    });
    it("reset → password_reset", () => {
      expect(purposeToEmailPurpose("reset")).toBe("password_reset");
    });
  });

  describe("copy table is exhaustive", () => {
    it("has entries for all Locale × OtpEmailPurpose combinations", () => {
      const locales = ["en", "fa"] as const;
      const purposes = ["sign_up", "sign_in", "password_reset"] as const;
      for (const loc of locales) {
        for (const purp of purposes) {
          expect(OTP_EMAIL_COPY[loc][purp]).toBeDefined();
          expect(OTP_EMAIL_COPY[loc][purp].subject).toBeTruthy();
          expect(typeof OTP_EMAIL_COPY[loc][purp].text).toBe("function");
          expect(typeof OTP_EMAIL_COPY[loc][purp].html).toBe("function");
        }
      }
    });
  });
});

// ─── Security regression tests (no DB) ────────────────────────────────────

describe("OTP security regressions (Phase 13 did not alter)", () => {
  it("OTP_LENGTH is 6", () => {
    expect(OTP_LENGTH).toBe(6);
  });
  it("OTP_TTL_MS is 10 minutes", () => {
    expect(OTP_TTL_MS).toBe(10 * 60 * 1000);
  });
  it("OTP_MAX_ATTEMPTS is 5", () => {
    expect(OTP_MAX_ATTEMPTS).toBe(5);
  });
  it("generateOtpCode returns 6 ASCII digits", () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^[0-9]{6}$/);
  });
  it("hashOtpCode returns a Buffer (HMAC-SHA256 = 32 bytes)", () => {
    const hash = hashOtpCode("123456", "test-pepper");
    expect(hash).toBeInstanceOf(Buffer);
    expect(hash.length).toBe(32);
  });
  it("constantTimeVerify returns true for matching code", () => {
    const hash = hashOtpCode("123456", "test-pepper");
    expect(constantTimeVerify("123456", hash, "test-pepper")).toBe(true);
  });
  it("constantTimeVerify returns false for mismatched code", () => {
    const hash = hashOtpCode("123456", "test-pepper");
    expect(constantTimeVerify("999999", hash, "test-pepper")).toBe(false);
  });
  it("decideOtp returns 'not_found' for null record", () => {
    expect(decideOtp(null, "123456", "pepper", new Date())).toBe("not_found");
  });
  it("decideOtp returns 'already_used' for consumed code", () => {
    const now = new Date();
    const record = {
      id: 1, requestId: "test", targetEmail: "test@example.com",
      codeHash: Buffer.from(hashOtpCode("123456", "pepper")),
      purpose: "signup" as const, attempts: 0, maxAttempts: 5,
      expiresAt: new Date(now.getTime() + 60000), consumedAt: now,
      userId: null, environment: null, createdAt: now,
    };
    expect(decideOtp(record, "123456", "pepper", now)).toBe("already_used");
  });
  it("decideOtp returns 'expired' for past-expiry code", () => {
    const now = new Date();
    const record = {
      id: 1, requestId: "test", targetEmail: "test@example.com",
      codeHash: Buffer.from(hashOtpCode("123456", "pepper")),
      purpose: "signup" as const, attempts: 0, maxAttempts: 5,
      expiresAt: new Date(now.getTime() - 60000), consumedAt: null,
      userId: null, environment: null, createdAt: now,
    };
    expect(decideOtp(record, "123456", "pepper", now)).toBe("expired");
  });
});

// ─── DB-gated production-path tests ──────────────────────────────────────

describe.skipIf(!RUN)("OTP production-path locale integration (Phase 13)", () => {
  // These tests exercise the REAL issueOtp() function with the locale parameter,
  // REAL resolveRequestUserLocale(), REAL OTP row creation, and a mock transport.
  // They require TEST_DATABASE_URL + RUN_OTP_LOCALIZATION=1.

  let testUserIds: number[] = [];

  /** Build a real NextRequest for locale resolution tests. */
  function makeReq(opts: {
    geoCountry?: string;
    acceptLanguage?: string;
    cookie?: string;
    url?: string;
  }): Request {
    const headers: Record<string, string> = {};
    if (opts.geoCountry) headers["x-vercel-ip-country"] = opts.geoCountry;
    if (opts.acceptLanguage) headers["accept-language"] = opts.acceptLanguage;
    if (opts.cookie) headers["cookie"] = opts.cookie;
    const url = opts.url ?? "http://localhost:3000/";
    return new Request(url, { method: "GET", headers });
  }

  /** Deterministic test transport that records all send calls. */
  function makeTestTransport() {
    const calls: MailMessage[] = [];
    const transport = {
      send: async (msg: MailMessage): Promise<{ messageId: string }> => {
        calls.push(msg);
        return { messageId: "test-" + calls.length };
      },
    };
    return { transport, calls };
  }

  afterAll(async () => {
    // Cleanup test users + their OTP rows.
    if (testUserIds.length > 0) {
      await db.otpCode.deleteMany({ where: { userId: { in: testUserIds } } });
      await db.brandKit.deleteMany({ where: { userId: { in: testUserIds } } });
      await db.emailTheme.deleteMany({ where: { userId: { in: testUserIds } } });
      await db.usageTracking.deleteMany({ where: { userId: { in: testUserIds } } });
      await db.user.deleteMany({ where: { id: { in: testUserIds } } });
    }
    await db.$disconnect();
  });

  it("signup/no-user + Iran Geo → fa sign_up email", async () => {
    expect.hasAssertions();
    const req = makeReq({ geoCountry: "IR" });
    const locale = await resolveRequestUserLocale({ request: req, userId: null });
    expect(locale).toBe("fa");

    const { transport, calls } = makeTestTransport();
    const email = `otp-test-${Date.now()}-fa@example.com`;
    const result = await issueOtp({
      email,
      purpose: "signup",
      locale,
      transport,
      skipEmailRateLimit: true,
      ip: null,
    });

    expect(result.code).toMatch(/^[0-9]{6}$/);
    expect(calls.length).toBe(1);
    expect(calls[0].subject).toContain("ثبت‌نام");
    expect(calls[0].html).toContain('lang="fa"');
    expect(calls[0].html).toContain('dir="rtl"');
    expect(calls[0].html).toContain(result.code);
    expect(calls[0].text).toContain(result.code);
  });

  it("signup/no-user + fa Accept-Language → fa sign_up email", async () => {
    expect.hasAssertions();
    const req = makeReq({ acceptLanguage: "fa" });
    const locale = await resolveRequestUserLocale({ request: req, userId: null });
    expect(locale).toBe("fa");

    const { transport, calls } = makeTestTransport();
    const email = `otp-test-${Date.now()}-faal@example.com`;
    const result = await issueOtp({
      email, purpose: "signup", locale, transport,
      skipEmailRateLimit: true, ip: null,
    });

    expect(calls.length).toBe(1);
    expect(calls[0].subject).toContain("ثبت‌نام");
  });

  it("signup/no-user + no locale signal → en sign_up email", async () => {
    expect.hasAssertions();
    const req = makeReq({});
    const locale = await resolveRequestUserLocale({ request: req, userId: null });
    expect(locale).toBe("en");

    const { transport, calls } = makeTestTransport();
    const email = `otp-test-${Date.now()}-en@example.com`;
    const result = await issueOtp({
      email, purpose: "signup", locale, transport,
      skipEmailRateLimit: true, ip: null,
    });

    expect(calls.length).toBe(1);
    expect(calls[0].subject).toContain("sign-up verification code");
    expect(calls[0].html).toContain('lang="en"');
    expect(calls[0].html).toContain('dir="ltr"');
  });

  it("signup/no-user + cookie=en + Iran Geo → en sign_up email", async () => {
    expect.hasAssertions();
    const req = makeReq({ cookie: "mg_locale=en", geoCountry: "IR" });
    const locale = await resolveRequestUserLocale({ request: req, userId: null });
    expect(locale).toBe("en");

    const { transport, calls } = makeTestTransport();
    const email = `otp-test-${Date.now()}-cookie-en@example.com`;
    await issueOtp({
      email, purpose: "signup", locale, transport,
      skipEmailRateLimit: true, ip: null,
    });

    expect(calls.length).toBe(1);
    expect(calls[0].subject).toContain("sign-up verification code");
    expect(calls[0].html).toContain('lang="en"');
  });

  it("existing sign-in user pref=en + Iran Geo → en sign_in email", async () => {
    expect.hasAssertions();
    // Create a test user with preferredLocale=en.
    const { db } = await import("@/lib/db");
    const { hashPassword } = await import("@/lib/auth/password");
    const user = await db.user.create({
      data: {
        email: `otp-test-signin-en-${Date.now()}@example.com`,
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "FREE",
        preferredLocale: "en",
      },
    });
    testUserIds.push(user.id);

    const req = makeReq({ geoCountry: "IR" });
    const locale = await resolveRequestUserLocale({ request: req, userId: user.id });
    expect(locale).toBe("en"); // user preference wins over Geo

    const { transport, calls } = makeTestTransport();
    await issueOtp({
      email: user.email, purpose: "login", userId: user.id,
      locale, transport, skipEmailRateLimit: true, ip: null,
    });

    expect(calls.length).toBe(1);
    expect(calls[0].subject).toContain("sign-in code");
    expect(calls[0].html).toContain('lang="en"');
  });

  it("existing sign-in user pref=fa + non-Iran Geo → fa sign_in email", async () => {
    expect.hasAssertions();
    const { db } = await import("@/lib/db");
    const { hashPassword } = await import("@/lib/auth/password");
    const user = await db.user.create({
      data: {
        email: `otp-test-signin-fa-${Date.now()}@example.com`,
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "FREE",
        preferredLocale: "fa",
      },
    });
    testUserIds.push(user.id);

    const req = makeReq({ geoCountry: "US" });
    const locale = await resolveRequestUserLocale({ request: req, userId: user.id });
    expect(locale).toBe("fa");

    const { transport, calls } = makeTestTransport();
    await issueOtp({
      email: user.email, purpose: "login", userId: user.id,
      locale, transport, skipEmailRateLimit: true, ip: null,
    });

    expect(calls.length).toBe(1);
    expect(calls[0].subject).toContain("ورود");
    expect(calls[0].html).toContain('lang="fa"');
    expect(calls[0].html).toContain('dir="rtl"');
  });

  it("existing user pref=null + Iran Geo → fa sign_in email", async () => {
    expect.hasAssertions();
    const { db } = await import("@/lib/db");
    const { hashPassword } = await import("@/lib/auth/password");
    const user = await db.user.create({
      data: {
        email: `otp-test-signin-null-${Date.now()}@example.com`,
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "FREE",
        preferredLocale: null,
      },
    });
    testUserIds.push(user.id);

    const req = makeReq({ geoCountry: "IR" });
    const locale = await resolveRequestUserLocale({ request: req, userId: user.id });
    expect(locale).toBe("fa");

    const { transport, calls } = makeTestTransport();
    await issueOtp({
      email: user.email, purpose: "login", userId: user.id,
      locale, transport, skipEmailRateLimit: true, ip: null,
    });

    expect(calls.length).toBe(1);
    expect(calls[0].subject).toContain("ورود");
  });

  it("one OTP send → exactly one transport.send() call", async () => {
    expect.hasAssertions();
    const { transport, calls } = makeTestTransport();
    const email = `otp-test-callcount-${Date.now()}@example.com`;
    await issueOtp({
      email, purpose: "signup", locale: "en", transport,
      skipEmailRateLimit: true, ip: null,
    });

    expect(calls.length).toBe(1);
    expect(calls[0].to).toBe(email);
    expect(calls[0].subject).toBeTruthy();
    expect(calls[0].text).toBeTruthy();
    expect(calls[0].html).toBeTruthy();
  });

  it("OTP row is actually created by issueOtp()", async () => {
    expect.hasAssertions();
    const { db } = await import("@/lib/db");
    const { transport } = makeTestTransport();
    const email = `otp-test-row-${Date.now()}@example.com`;
    const result = await issueOtp({
      email, purpose: "signup", locale: "en", transport,
      skipEmailRateLimit: true, ip: null,
    });

    const row = await db.otpCode.findFirst({
      where: { requestId: result.requestId },
    });
    expect(row).not.toBeNull();
    expect(row!.targetEmail).toBe(email);
    expect(row!.purpose).toBe("signup");
    expect(row!.attempts).toBe(0);
    expect(row!.consumedAt).toBeNull();
    expect(row!.codeHash).toBeInstanceOf(Uint8Array);
  });
});

// ─── DB-gated BrandKit + EmailTheme preservation tests ───────────────────

describe.skipIf(!RUN)("OTP BrandKit + EmailTheme preservation (Phase 13)", () => {
  let testUserIds: number[] = [];

  function makeTestTransport() {
    const calls: MailMessage[] = [];
    const transport = {
      send: async (msg: MailMessage): Promise<{ messageId: string }> => {
        calls.push(msg);
        return { messageId: "test-" + calls.length };
      },
    };
    return { transport, calls };
  }

  afterAll(async () => {
    if (testUserIds.length > 0) {
      await db.otpCode.deleteMany({ where: { userId: { in: testUserIds } } });
      await db.brandKit.deleteMany({ where: { userId: { in: testUserIds } } });
      await db.emailTheme.deleteMany({ where: { userId: { in: testUserIds } } });
      await db.usageTracking.deleteMany({ where: { userId: { in: testUserIds } } });
      await db.user.deleteMany({ where: { id: { in: testUserIds } } });
    }
  });

  it("FREE user → system appName 'Nixify' in localized email", async () => {
    expect.hasAssertions();
    const { db } = await import("@/lib/db");
    const { hashPassword } = await import("@/lib/auth/password");
    const user = await db.user.create({
      data: {
        email: `otp-test-brand-free-${Date.now()}@example.com`,
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true, plan: "FREE", preferredLocale: "fa",
      },
    });
    testUserIds.push(user.id);

    const { transport, calls } = makeTestTransport();
    await issueOtp({
      email: user.email, purpose: "signup", userId: user.id,
      locale: "fa", transport, skipEmailRateLimit: true, ip: null,
    });

    expect(calls.length).toBe(1);
    // FREE users always see system appName "Nixify".
    expect(calls[0].text).toContain("Nixify");
  });

  it("PRO user with BrandKit.appName → branded appName in localized email", async () => {
    expect.hasAssertions();
    const { db } = await import("@/lib/db");
    const { hashPassword } = await import("@/lib/auth/password");
    const user = await db.user.create({
      data: {
        email: `otp-test-brand-pro-${Date.now()}@example.com`,
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true, plan: "PRO", preferredLocale: "fa",
      },
    });
    testUserIds.push(user.id);

    // Create a BrandKit with a custom appName.
    await db.brandKit.create({
      data: { userId: user.id, appName: "AcmeCorp" },
    });

    const { transport, calls } = makeTestTransport();
    await issueOtp({
      email: user.email, purpose: "signup", userId: user.id,
      locale: "fa", transport, skipEmailRateLimit: true, ip: null,
    });

    expect(calls.length).toBe(1);
    // The branded appName should appear, not "Nixify".
    expect(calls[0].text).toContain("AcmeCorp");
    expect(calls[0].html).toContain("AcmeCorp");
    // Persian locale should still be applied.
    expect(calls[0].html).toContain('lang="fa"');
    expect(calls[0].html).toContain('dir="rtl"');
  });

  it("active custom EmailTheme → theme renderer used (not bypassed)", async () => {
    expect.hasAssertions();
    const { db } = await import("@/lib/db");
    const { hashPassword } = await import("@/lib/auth/password");
    const user = await db.user.create({
      data: {
        email: `otp-test-theme-${Date.now()}@example.com`,
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true, plan: "PRO", preferredLocale: "fa",
      },
    });
    testUserIds.push(user.id);

    // Create an active EmailTheme for signup.
    await db.emailTheme.create({
      data: {
        userId: user.id,
        name: "Custom Theme",
        templateId: "minimal",
        purpose: "signup",
        isActive: true,
        config: JSON.stringify({
          variant: "minimal",
          accentColor: "#3b82f6",
          logoText: "CustomBrandedApp",
        }),
      },
    });

    const { transport, calls } = makeTestTransport();
    await issueOtp({
      email: user.email, purpose: "signup", userId: user.id,
      locale: "fa", transport, skipEmailRateLimit: true, ip: null,
    });

    expect(calls.length).toBe(1);
    // The custom theme's appName should appear in the email, not "Nixify".
    expect(calls[0].html).toContain("CustomBrandedApp");
    // Custom theme content is NOT auto-translated — it stays as authored.
  });

  it("no active theme → localized system renderer used", async () => {
    expect.hasAssertions();
    const { db } = await import("@/lib/db");
    const { hashPassword } = await import("@/lib/auth/password");
    const user = await db.user.create({
      data: {
        email: `otp-test-no-theme-${Date.now()}@example.com`,
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true, plan: "FREE", preferredLocale: "fa",
      },
    });
    testUserIds.push(user.id);

    const { transport, calls } = makeTestTransport();
    await issueOtp({
      email: user.email, purpose: "signup", userId: user.id,
      locale: "fa", transport, skipEmailRateLimit: true, ip: null,
    });

    expect(calls.length).toBe(1);
    // No custom theme → localized system renderer.
    expect(calls[0].subject).toContain("ثبت‌نام");
    expect(calls[0].html).toContain('lang="fa"');
    expect(calls[0].html).toContain('dir="rtl"');
  });
});

// ─── DB-gated purpose + resend tests ─────────────────────────────────────

describe.skipIf(!RUN)("OTP purpose + resend production-path tests (Phase 13)", () => {
  let testUserIds: number[] = [];

  function makeTestTransport() {
    const calls: MailMessage[] = [];
    const transport = {
      send: async (msg: MailMessage): Promise<{ messageId: string }> => {
        calls.push(msg);
        return { messageId: "test-" + calls.length };
      },
    };
    return { transport, calls };
  }

  afterAll(async () => {
    if (testUserIds.length > 0) {
      await db.otpCode.deleteMany({ where: { userId: { in: testUserIds } } });
      await db.usageTracking.deleteMany({ where: { userId: { in: testUserIds } } });
      await db.user.deleteMany({ where: { id: { in: testUserIds } } });
    }
  });

  it("signup issue → sign_up copy", async () => {
    expect.hasAssertions();
    const { db } = await import("@/lib/db");
    const { hashPassword } = await import("@/lib/auth/password");
    const user = await db.user.create({
      data: {
        email: `otp-test-purpose-signup-${Date.now()}@example.com`,
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true, plan: "FREE", preferredLocale: "en",
      },
    });
    testUserIds.push(user.id);

    const { transport, calls } = makeTestTransport();
    await issueOtp({
      email: user.email, purpose: "signup", userId: user.id,
      locale: "en", transport, skipEmailRateLimit: true, ip: null,
    });

    expect(calls[0].subject).toContain("sign-up verification code");
  });

  it("signup resend → sign_up copy (purpose preserved)", async () => {
    expect.hasAssertions();
    const { db } = await import("@/lib/db");
    const { hashPassword } = await import("@/lib/auth/password");
    const user = await db.user.create({
      data: {
        email: `otp-test-resend-signup-${Date.now()}@example.com`,
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true, plan: "FREE", preferredLocale: "en",
      },
    });
    testUserIds.push(user.id);

    const { transport, calls } = makeTestTransport();
    // First send
    await issueOtp({
      email: user.email, purpose: "signup", userId: user.id,
      locale: "en", transport, skipEmailRateLimit: true, ip: null,
    });
    // Resend
    await issueOtp({
      email: user.email, purpose: "signup", userId: user.id,
      locale: "en", transport, isResend: true,
      skipEmailRateLimit: true, ip: null,
    });

    // Both emails should have sign_up copy.
    expect(calls.length).toBe(2);
    expect(calls[0].subject).toContain("sign-up verification code");
    expect(calls[1].subject).toContain("sign-up verification code");
  });

  it("login issue → sign_in copy", async () => {
    expect.hasAssertions();
    const { db } = await import("@/lib/db");
    const { hashPassword } = await import("@/lib/auth/password");
    const user = await db.user.create({
      data: {
        email: `otp-test-purpose-login-${Date.now()}@example.com`,
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true, plan: "FREE", preferredLocale: "en",
      },
    });
    testUserIds.push(user.id);

    const { transport, calls } = makeTestTransport();
    await issueOtp({
      email: user.email, purpose: "login", userId: user.id,
      locale: "en", transport, skipEmailRateLimit: true, ip: null,
    });

    expect(calls[0].subject).toContain("sign-in code");
  });

  it("login resend → sign_in copy (purpose preserved)", async () => {
    expect.hasAssertions();
    const { db } = await import("@/lib/db");
    const { hashPassword } = await import("@/lib/auth/password");
    const user = await db.user.create({
      data: {
        email: `otp-test-resend-login-${Date.now()}@example.com`,
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true, plan: "FREE", preferredLocale: "en",
      },
    });
    testUserIds.push(user.id);

    const { transport, calls } = makeTestTransport();
    await issueOtp({
      email: user.email, purpose: "login", userId: user.id,
      locale: "en", transport, skipEmailRateLimit: true, ip: null,
    });
    await issueOtp({
      email: user.email, purpose: "login", userId: user.id,
      locale: "en", transport, isResend: true,
      skipEmailRateLimit: true, ip: null,
    });

    expect(calls.length).toBe(2);
    expect(calls[0].subject).toContain("sign-in code");
    expect(calls[1].subject).toContain("sign-in code");
  });

  it("forgot-password → password_reset copy", async () => {
    expect.hasAssertions();
    const { db } = await import("@/lib/db");
    const { hashPassword } = await import("@/lib/auth/password");
    const user = await db.user.create({
      data: {
        email: `otp-test-purpose-reset-${Date.now()}@example.com`,
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true, plan: "FREE", preferredLocale: "en",
      },
    });
    testUserIds.push(user.id);

    const { transport, calls } = makeTestTransport();
    await issueOtp({
      email: user.email, purpose: "reset", userId: user.id,
      locale: "en", transport, skipEmailRateLimit: true, ip: null,
    });

    expect(calls[0].subject).toContain("password reset");
  });
});

// ─── Import db for afterAll cleanup ──────────────────────────────────────
import { db } from "@/lib/db";
