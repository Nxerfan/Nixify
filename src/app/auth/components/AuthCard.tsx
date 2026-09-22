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
 * State machine:
 *   Sign In:  email → otp → success  |  password → success
 *   Sign Up:  form → otp → (signup API) → success
 *
 * Tab switching resets all state.
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
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [successContext, setSuccessContext] = useState<"signin" | "signup">(
    "signin",
  );
  const [creatingAccount, setCreatingAccount] = useState(false);

  const auth = useAuth();

  // After showing the success state for 2 seconds, redirect to the dashboard
  // so the header re-mounts and shows the profile avatar.
  useEffect(() => {
    if (step !== "success") return;
    const timer = setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
    return () => clearTimeout(timer);
  }, [step, router]);

  const switchTab = useCallback(
    (newTab: Tab) => {
      setTab(newTab);
      setStep(newTab === "signin" ? "email" : "signup-form");
      setEmail("");
      setName("");
      setPassword("");
      setCreatingAccount(false);
      auth.clearError();
    },
    [auth],
  );

  // ---- Sign In handlers ----

  const handleSignInEmail = useCallback(
    async (em: string) => {
      const res = await auth.sendOtp(em, "signin");
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
    await auth.sendOtp(email, "signin");
  }, [auth, email]);

  // ---- Sign Up handlers ----

  const handleSignUpSubmit = useCallback(
    async (n: string, em: string, pw: string) => {
      const res = await auth.sendOtp(em, "signup");
      if (res.ok) {
        setName(n);
        setEmail(em);
        setPassword(pw);
        setStep("signup-otp");
      }
    },
    [auth],
  );

  const handleVerifySignUp = useCallback(
    async (code: string) => {
      const res = await auth.verifyOtp(email, code, "signup");
      if (res.ok) {
        // OTP verified — now create the account.
        setCreatingAccount(true);
        const signupRes = await auth.signup(name, email, password);
        setCreatingAccount(false);
        if (signupRes.ok) {
          setSuccessContext("signup");
          setStep("success");
          return { ok: true };
        }
        // Account creation failed — return error so OtpStep shows it.
        return {
          ok: false,
          error: signupRes.error ?? t("auth.shell.accountCreationFailed"),
        };
      }
      return res;
    },
    [auth, email, name, password, t],
  );

  const handleResendSignUp = useCallback(async () => {
    await auth.sendOtp(email, "signup");
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
        <div className="relative mb-8 flex gap-1 rounded-xl bg-card/60 p-1 ring-1 ring-gray-800/50">
          {(["signin", "signup"] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => switchTab(tabKey)}
              className="relative flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors duration-300"
              style={{ color: tab === tabKey ? "#f5f5f4" : "#9ca3af" }}
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
              <>
                {creatingAccount ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <motion.div
                      className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-500"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    />
                    <p className="mt-4 text-sm text-muted-foreground">
                      {t("auth.shell.creatingAccount")}
                    </p>
                  </div>
                ) : (
                  <OtpStep
                    email={email}
                    mode="signup"
                    loading={auth.loading}
                    onVerify={handleVerifySignUp}
                    onResend={handleResendSignUp}
                  />
                )}
              </>
            )}

            {step === "success" && <SuccessState context={successContext} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
