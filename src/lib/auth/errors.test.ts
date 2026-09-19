/**
 * Auth error localization behavioral tests.
 *
 * Proves that the same API error produces:
 * - English UI message in en locale
 * - Persian UI message in fa locale
 *
 * Also proves that:
 * - The machine error code is preserved separately
 * - Unknown error codes fall back to a generic localized message
 * - Network errors (no code) get a localized network message
 */
import { describe, it, expect } from "vitest";
import { localizeAuthError } from "@/lib/auth/errors";

describe("Auth error localization — known error codes", () => {
  it("mail_config_missing → English in en", () => {
    const msg = localizeAuthError("mail_config_missing", "en");
    expect(msg).toBe("Email delivery is not configured on this deployment. Contact the administrator.");
  });

  it("mail_config_missing → Persian in fa", () => {
    const msg = localizeAuthError("mail_config_missing", "fa");
    expect(msg).toBe("تحویل ایمیل در این استقرار پیکربندی نشده است. با مدیر سیستم تماس بگیرید.");
    expect(msg).not.toContain("mail_config_missing");
  });

  it("internal_error → English in en", () => {
    const msg = localizeAuthError("internal_error", "en");
    expect(msg).toBe("Something went wrong. Please try again.");
  });

  it("internal_error → Persian in fa (NOT 'internal_error')", () => {
    const msg = localizeAuthError("internal_error", "fa");
    expect(msg).toBe("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
    expect(msg).not.toContain("internal_error");
  });

  it("rate_limited → English in en", () => {
    const msg = localizeAuthError("rate_limited", "en");
    expect(msg).toBe("Too many requests. Please wait a minute and try again.");
  });

  it("rate_limited → Persian in fa", () => {
    const msg = localizeAuthError("rate_limited", "fa");
    expect(msg).toBe("درخواست‌های زیادی ارسال شده. لطفاً یک دقیقه صبر کنید و دوباره تلاش کنید.");
    expect(msg).not.toContain("rate_limited");
  });

  it("invalid_credentials → English in en", () => {
    const msg = localizeAuthError("invalid_credentials", "en");
    expect(msg).toBe("Incorrect email or password.");
  });

  it("invalid_credentials → Persian in fa", () => {
    const msg = localizeAuthError("invalid_credentials", "fa");
    expect(msg).toBe("ایمیل یا رمز عبور نادرست است.");
    expect(msg).not.toContain("invalid_credentials");
  });

  it("locked → English in en", () => {
    const msg = localizeAuthError("locked", "en");
    expect(msg).toBe("Too many attempts. Please try again later.");
  });

  it("locked → Persian in fa", () => {
    const msg = localizeAuthError("locked", "fa");
    expect(msg).toBe("تلاش‌های زیادی انجام شده. لطفاً بعداً دوباره تلاش کنید.");
    expect(msg).not.toContain("locked");
  });

  it("email_exists → English in en", () => {
    const msg = localizeAuthError("email_exists", "en");
    expect(msg).toBe("An account with this email already exists. Try logging in.");
  });

  it("email_exists → Persian in fa", () => {
    const msg = localizeAuthError("email_exists", "fa");
    expect(msg).toBe("حسابی با این ایمیل از قبل وجود دارد. وارد شوید.");
    expect(msg).not.toContain("email_exists");
  });

  it("code_mismatch → English in en", () => {
    const msg = localizeAuthError("code_mismatch", "en");
    expect(msg).toBe("That code didn't match. Please try again.");
  });

  it("code_mismatch → Persian in fa", () => {
    const msg = localizeAuthError("code_mismatch", "fa");
    expect(msg).toBe("کد مطابقت نداشت. لطفاً دوباره تلاش کنید.");
    expect(msg).not.toContain("code_mismatch");
  });

  it("expired → English in en", () => {
    const msg = localizeAuthError("expired", "en");
    expect(msg).toBe("Your code has expired. Request a new one.");
  });

  it("expired → Persian in fa", () => {
    const msg = localizeAuthError("expired", "fa");
    expect(msg).toBe("کد شما منقضی شده است. کد جدید درخواست کنید.");
  });
});

describe("Auth error localization — fallback behavior", () => {
  it("unknown error code → generic English in en", () => {
    const msg = localizeAuthError("some_unknown_code_xyz", "en");
    expect(msg).toBe("Something went wrong. Please try again.");
  });

  it("unknown error code → generic Persian in fa", () => {
    const msg = localizeAuthError("some_unknown_code_xyz", "fa");
    expect(msg).toBe("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
    expect(msg).not.toContain("some_unknown_code_xyz");
  });

  it("undefined error code (network failure) → network error in en", () => {
    const msg = localizeAuthError(undefined, "en");
    expect(msg).toBe("Network error. Check your connection.");
  });

  it("undefined error code (network failure) → network error in fa", () => {
    const msg = localizeAuthError(undefined, "fa");
    expect(msg).toBe("خطای شبکه. اتصال خود را بررسی کنید.");
    expect(msg).not.toContain("Network");
  });
});

describe("Auth error localization — same code produces different messages per locale", () => {
  it("mail_config_missing produces different text in en vs fa", () => {
    const enMsg = localizeAuthError("mail_config_missing", "en");
    const faMsg = localizeAuthError("mail_config_missing", "fa");
    expect(enMsg).not.toBe(faMsg);
    expect(enMsg).not.toContain("تحویل");
    expect(faMsg).not.toContain("Email delivery");
  });

  it("rate_limited produces different text in en vs fa", () => {
    const enMsg = localizeAuthError("rate_limited", "en");
    const faMsg = localizeAuthError("rate_limited", "fa");
    expect(enMsg).not.toBe(faMsg);
  });
});
