"use client";

import { useCallback, useState } from "react";
import { postJson } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { localizeAuthError } from "@/lib/auth/errors";

/**
 * Custom hook that wraps all auth API calls with loading + error state.
 *
 * Corrected signup state machine (fix/auth-signup-state-machine):
 *
 *   signup(fullName, email, realPassword)
 *     → POST /api/auth/signup { fullName, email, password }  ← ONCE, real password
 *     → create/update UNVERIFIED user with the REAL password hash + fullName
 *     → send signup OTP
 *   verifyOtp(email, code, "signup")
 *     → POST /api/auth/verify-email { email, code, purpose: "signup" }
 *     → mark SAME user verified + establish session
 *     → success (NO second /signup call)
 *
 * The previous broken flow:
 *   1. sendOtp(email, "signup") → POST /signup with a RANDOM temp password
 *   2. verifyOtp → mark verified + session
 *   3. signup(name, email, realPassword) → POST /signup AGAIN → EMAIL_EXISTS
 *
 * The old `sendOtp(email, "signup")` generated `temppass_${random}` and called
 * /signup with it. The real password was only sent in a SECOND /signup call
 * after OTP verification — which correctly failed with EMAIL_EXISTS because
 * the user was already verified. That left the account with the TEMP password
 * hash, not the real one, and the client showed a failure after a successful
 * OTP verification.
 *
 * The fix: `signup()` is the single entry point for account creation. It
 * sends the real password + fullName once. `sendOtp(email, "signup")` is
 * kept only as a resend mechanism (it calls /resend-otp, NOT /signup). OTP
 * verification marks the SAME user verified — no second /signup call.
 *
 * Error localization: the API returns { error: "machine_code", message: "English text" }.
 * This hook uses the machine `error` code to select a localized message via
 * `localizeAuthError(errorCode, locale)`. The raw English `message` from the
 * backend is NOT displayed to the user — the localized translation is used
 * instead.
 */

type SignupResult = { ok: boolean; error?: string };
type VerifyOtpResult = { ok: boolean; error?: string; errorCode?: string };
type SigninOtpResult = { ok: boolean; error?: string };
type SigninPasswordResult = { ok: boolean; error?: string };

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { locale } = useLocale();

  /**
   * Signup: create/update an UNVERIFIED user with the REAL password + fullName,
   * then send the signup OTP. Called exactly ONCE in the signup lifecycle.
   *
   * After this succeeds, the client moves to the OTP step. OTP verification
   * (verifyOtp below) marks the SAME user verified and establishes the session.
   * There is NO second /signup call.
   */
  const signup = useCallback(async (
    fullName: string,
    email: string,
    password: string,
  ): Promise<SignupResult> => {
    setLoading(true);
    setError(null);
    try {
      const body: { email: string; password: string; fullName?: string } = { email, password };
      if (fullName.trim()) body.fullName = fullName.trim();
      const res = await postJson<{ message?: string; error?: string }>("/signup", body);
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

  /**
   * Resend the signup OTP. Calls /resend-otp (NOT /signup) — the user already
   * exists with the real password from the initial signup() call. We do NOT
   * re-submit the password here.
   */
  const resendSignupOtp = useCallback(async (email: string): Promise<SigninOtpResult> => {
    setLoading(true);
    setError(null);
    try {
      const res = await postJson<{ message?: string; error?: string }>("/resend-otp", {
        email,
        purpose: "signup",
      });
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

  /**
   * Sign-in OTP: send a login OTP to an existing (already-verified) user.
   * Calls /resend-otp with purpose "login".
   */
  const sendSigninOtp = useCallback(async (email: string): Promise<SigninOtpResult> => {
    setLoading(true);
    setError(null);
    try {
      const res = await postJson<{ message?: string; error?: string }>("/resend-otp", {
        email,
        purpose: "login",
      });
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

  return {
    loading,
    error,
    // Signup lifecycle: signup() creates the user + sends OTP once;
    // resendSignupOtp() re-sends the OTP without re-creating the user.
    signup,
    resendSignupOtp,
    // Sign-in lifecycle
    sendSigninOtp,
    verifyOtp,
    signinPassword,
    clearError,
  };
}
