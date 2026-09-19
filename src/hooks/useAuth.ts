"use client";

import { useCallback, useState } from "react";
import { postJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { localizeAuthError } from "@/lib/auth/errors";

/**
 * Custom hook that wraps all auth API calls with loading + error state.
 * Maps the /auth page's logical operations to the actual backend endpoints:
 *   sendOtp  → POST /api/auth/signup   { email, password } (creates user + sends OTP)
 *   verifyOtp → POST /api/auth/verify-email { email, code }
 *   signup   → POST /api/auth/signup   { email, password }
 *   signinPassword → POST /api/auth/login { email, password }
 *
 * Error localization: the API returns { error: "machine_code", message: "English text" }.
 * This hook uses the machine `error` code to select a localized message via
 * `localizeAuthError(errorCode, locale)`. The raw English `message` from the
 * backend is NOT displayed to the user — the localized translation is used
 * instead.
 */

type SendOtpResult = { ok: boolean; error?: string };
type VerifyOtpResult = { ok: boolean; error?: string; errorCode?: string };
type SignupResult = { ok: boolean; error?: string };
type SigninPasswordResult = { ok: boolean; error?: string };

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { locale } = useLocale();

  const sendOtp = useCallback(async (email: string, mode: "signin" | "signup"): Promise<SendOtpResult> => {
    setLoading(true);
    setError(null);
    try {
      if (mode === "signup") {
        // Signup: create user + send OTP. Requires { email, password }.
        const tempPassword = "temppass_" + Math.random().toString(36).slice(2, 10);
        const res = await postJson<{ message?: string; error?: string }>("/signup", { email, password: tempPassword });
        if (!res.ok) {
          const msg = localizeAuthError(res.error.errorCode, locale);
          setError(msg);
          return { ok: false, error: msg };
        }
      } else {
        // Sign-in: the user already exists. Call /resend-otp to send a new code.
        // Use purpose "login" so it works even for already-verified users.
        const res = await postJson<{ message?: string; error?: string }>("/resend-otp", { email, purpose: "login" });
        if (!res.ok) {
          const msg = localizeAuthError(res.error.errorCode, locale);
          setError(msg);
          return { ok: false, error: msg };
        }
      }
      return { ok: true };
    } catch {
      const msg = localizeAuthError(undefined, locale);
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, [locale]);

  const verifyOtp = useCallback(async (email: string, code: string, purpose?: string): Promise<VerifyOtpResult> => {
    setLoading(true);
    setError(null);
    try {
      const res = await postJson<{ message?: string; error?: string }>("/verify-email", { email, code, purpose: purpose ?? "signup" });
      if (!res.ok) {
        const msg = localizeAuthError(res.error.errorCode, locale);
        setError(msg);
        return { ok: false, error: msg, errorCode: res.error.errorCode };
      }
      return { ok: true };
    } catch {
      const msg = localizeAuthError(undefined, locale);
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, [locale]);

  const signup = useCallback(async (_name: string, email: string, password: string): Promise<SignupResult> => {
    setLoading(true);
    setError(null);
    try {
      const res = await postJson<{ message?: string; error?: string }>("/signup", { email, password });
      if (!res.ok) {
        const msg = localizeAuthError(res.error.errorCode, locale);
        setError(msg);
        return { ok: false, error: msg };
      }
      return { ok: true };
    } catch {
      const msg = localizeAuthError(undefined, locale);
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, [locale]);

  const signinPassword = useCallback(async (email: string, password: string): Promise<SigninPasswordResult> => {
    setLoading(true);
    setError(null);
    try {
      const res = await postJson<{ message?: string; error?: string }>("/login", { email, password });
      if (!res.ok) {
        const msg = localizeAuthError(res.error.errorCode, locale);
        setError(msg);
        return { ok: false, error: msg };
      }
      return { ok: true };
    } catch {
      const msg = localizeAuthError(undefined, locale);
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, [locale]);

  const clearError = useCallback(() => setError(null), []);

  return { loading, error, sendOtp, verifyOtp, signup, signinPassword, clearError };
}
