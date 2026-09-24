"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import { EmailStep } from "./EmailStep";
import { PasswordStep } from "./PasswordStep";
import { OtpStep } from "./OtpStep";
import { SignUpForm } from "./SignUpForm";
import { SuccessState } from "./SuccessState";

/**
 * AuthCard — the main state machine. Manages tab switching (Sign In / Sign Up)
 * and all step transitions. All API calls go through the useAuth hook.
 *
 * Corrected signup state machine (fix/auth-signup-state-machine):
 *
 *   Sign Up:  form (fullName, email, real password)
 *               → signup(fullName, email, password)  ← ONCE, real password
 *               → /api/auth/signup creates UNVERIFIED user + sends OTP
 *               → otp step
 *               → verifyOtp(email, code, "signup")
 *               → /api/auth/verify-email marks SAME user verified + session
 *               → success  (NO second /signup call)
 *
 *   Sign In:  email → otp → success  |  password → success
 *
 * Tab switching resets all state.
 *
 * The plaintext password is kept in component state ONLY for the sign-in
 * password flow (handleSignInPassword). The signup flow no longer needs to
 * keep the password after the initial signup() call — it's persisted on the
 * server immediately with the real password hash.
 */

type Tab = "signin" | "signup";
type Step =
  "email" | "password" | "otp" | "signup-form" | "signup-otp" | "success";

const EASE = [0.22, 1, 0.36, 1] as const;

export function AuthCard() {
  const router = useRouter();
  const t = useTranslations();
  const [tab, setTab] = useState<Tab>("signin");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [successContext, setSuccessContext] = useState<"signin" | "signup">(
    "signin",
  );

  const auth = useAuth();

  // After showing the success state for 2 seconds, redirect:
  //   - signup (new users) → /dashboard/getting-started (onboarding flow)
  //   - signin (existing users) → /dashboard (normal)
  // The redirect target is determined by the successContext (signup vs signin).
  // For signup, we route to the onboarding flow so new users are guided
  // through creating their first API key + sending/verifying a sandbox OTP.
  // Existing users (signin) are NOT forced through onboarding repeatedly.
  useEffect(() => {
    if (step !== "success") return;
    const timer = setTimeout(() => {
      if (successContext === "signup") {
        router.push("/dashboard/getting-started");
      } else {
        router.push("/dashboard");
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [step, router, successContext]);

  const switchTab = useCallback(
    (newTab: Tab) => {
      setTab(newTab);
      setStep(newTab === "signin" ? "email" : "signup-form");
      setEmail("");
      auth.clearError();
    },
    [auth],
  );

  // ---- Sign In handlers ----

  const handleSignInEmail = useCallback(
    async (em: string) => {
      const res = await auth.sendSigninOtp(em);
      if (res.ok) {
        setEmail(em);
        setStep("otp");
      }
    },
    [auth],
  );

  const handleSignInPassword = useCallback(
    async (em: string, pw: string) => {
      const res = await auth.signinPassword(em, pw);
      if (res.ok) {
        setSuccessContext("signin");
        setStep("success");
      }
    },
    [auth],
  );

  const handleVerifySignIn = useCallback(
    async (code: string) => {
      const res = await auth.verifyOtp(email, code, "login");
      if (res.ok) {
        setSuccessContext("signin");
        setStep("success");
      }
      return res;
    },
    [auth, email],
  );

  const handleResendSignIn = useCallback(async () => {
    await auth.sendSigninOtp(email);
  }, [auth, email]);

  // ---- Sign Up handlers ----

  /**
   * Handle signup form submission. Calls /api/auth/signup ONCE with the real
   * password + fullName. The server creates/updates an UNVERIFIED user and
   * sends the signup OTP. We do NOT keep the password in state after this —
   * it's no longer needed. The OTP verification step marks the SAME user
   * verified and establishes the session.
   */
  const handleSignUpSubmit = useCallback(
    async (name: string, em: string, pw: string) => {
      const res = await auth.signup(name, em, pw);
      if (res.ok) {
        // Keep only email for the OTP verification step. The password is
        // NOT needed — verify-email establishes the session.
        setEmail(em);
        setStep("signup-otp");
      }
    },
    [auth],
  );

  /**
   * Handle signup OTP verification. Calls /api/auth/verify-email which marks
   * the SAME user verified and establishes the session. There is NO second
   * /signup call — the user was already created (with the real password) in
   * handleSignUpSubmit.
   */
  const handleVerifySignUp = useCallback(
    async (code: string) => {
      const res = await auth.verifyOtp(email, code, "signup");
      if (res.ok) {
        // OTP verified — the server has marked the user verified AND
        // established the session. Transition directly to success.
        setSuccessContext("signup");
        setStep("success");
      }
      return res;
    },
    [auth, email],
  );

  const handleResendSignUp = useCallback(async () => {
    await auth.resendSignupOtp(email);
  }, [auth, email]);

  return (
    <div className="relative w-full max-w-md">
      {/* Glassmorphism card wrapper with gradient border */}
      <div className="relative rounded-2xl border border-emerald-500/10 bg-muted/40 p-8 backdrop-blur-xl">
        {/* Animated gradient border glow */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-50"
          style={{
            background:
              "linear-gradient(135deg, rgba(16,185,129,0.08), transparent 40%, transparent 60%, rgba(20,184,166,0.05))",
            maskImage:
              "linear-gradient(black, black) content-box, linear-gradient(black, black)",
            WebkitMask:
              "linear-gradient(black, black) content-box, linear-gradient(black, black)",
            maskComposite: "exclude",
            WebkitMaskComposite: "xor",
            padding: 1,
          }}
        />

        {/* Tab switcher */}
        <div className="relative mb-8 flex gap-1 rounded-xl bg-card/60 p-1 ring-1 ring-border/50">
          {(["signin", "signup"] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => switchTab(tabKey)}
              className={`relative flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors duration-300 ${tab === tabKey ? "text-foreground" : "text-muted-foreground"}`}
            >
              {tab === tabKey && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute inset-0 rounded-lg bg-emerald-600/10 ring-1 ring-emerald-500/25"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                {tabKey === "signin" ? t("auth.shell.tabSignIn") : t("auth.shell.tabSignUp")}
              </span>
            </button>
          ))}
        </div>

        {/* Step container with AnimatePresence */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, scale: 0.98, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {step === "email" && (
              <EmailStep
                loading={auth.loading}
                onSubmit={handleSignInEmail}
                onPasswordLink={() => setStep("password")}
                error={auth.error}
              />
            )}

            {step === "password" && (
              <PasswordStep
                loading={auth.loading}
                onSubmit={handleSignInPassword}
                onOtpLink={() => setStep("email")}
                error={auth.error}
              />
            )}

            {step === "otp" && (
              <OtpStep
                email={email}
                mode="signin"
                loading={auth.loading}
                onVerify={handleVerifySignIn}
                onResend={handleResendSignIn}
              />
            )}

            {step === "signup-form" && (
              <SignUpForm
                loading={auth.loading}
                onSubmit={handleSignUpSubmit}
                onSignInLink={() => switchTab("signin")}
                error={auth.error}
              />
            )}

            {step === "signup-otp" && (
              <OtpStep
                email={email}
                mode="signup"
                loading={auth.loading}
                onVerify={handleVerifySignUp}
                onResend={handleResendSignUp}
              />
            )}

            {step === "success" && <SuccessState context={successContext} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
