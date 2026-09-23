"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { CountdownTimer } from "./CountdownTimer";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

/**
 * OTP verification step — 6-box input with auto-submit, shake on error,
 * circular resend countdown.
 *
 * onVerify returns a result object so this component can handle errors
 * directly in the callback (no useEffect + prop reaction needed).
 * The OTP code is held only in the input refs — never logged.
 */

interface OtpStepProps {
  email: string;
  mode: "signin" | "signup";
  loading: boolean;
  onVerify: (code: string) => Promise<{ ok: boolean; error?: string; errorCode?: string }>;
  onResend: () => Promise<void>;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function OtpStep({ email, mode, loading, onVerify, onResend }: OtpStepProps) {
  const t = useTranslations();
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [shakeKey, setShakeKey] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [resendKey, setResendKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus the first box on mount. (DOM-only — no setState, so the linter is fine.)
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const triggerShake = useCallback(() => {
    setShakeKey((k) => k + 1);
    setDigits(["", "", "", "", "", ""]);
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, []);

  const handleVerify = useCallback(
    async (code: string) => {
      setVerifying(true);
      setError(null);
      const res = await onVerify(code);
      setVerifying(false);
      if (!res.ok) {
        let msg: string;
        if (res.errorCode) {
          // Try the localized error map first, then fall back to the API error,
          // then the generic verification-failed string.
          const localized = t(`auth.otp.errors.${res.errorCode}`);
          msg = localized || res.error || t("auth.otp.verificationFailed");
        } else {
          msg = res.error || t("auth.otp.verificationFailed");
        }
        setError(msg);
        triggerShake();
      }
    },
    [onVerify, triggerShake, t],
  );

  const handleChange = useCallback(
    (index: number, value: string) => {
      const digit = value.replace(/\D/g, "").slice(-1);
      const next = [...digits];
      next[index] = digit;
      setDigits(next);
      setError(null);

      if (digit && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
      if (digit && index === 5) {
        const code = next.join("");
        if (code.length === 6) handleVerify(code);
      }
    },
    [digits, handleVerify],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      if (e.key === "Enter") {
        const code = digits.join("");
        if (code.length === 6) handleVerify(code);
      }
    },
    [digits, handleVerify],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (pasted.length > 0) {
        const next = pasted.split("").concat(Array(6 - pasted.length).fill(""));
        setDigits(next);
        if (pasted.length === 6) {
          handleVerify(pasted);
        } else {
          inputRefs.current[pasted.length]?.focus();
        }
      }
    },
    [handleVerify],
  );

  const handleResend = useCallback(async () => {
    setDigits(["", "", "", "", "", ""]);
    setError(null);
    setCanResend(false);
    setResendKey((k) => k + 1);
    await onResend();
    inputRefs.current[0]?.focus();
  }, [onResend]);

  const isLoading = loading || verifying;

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
    >
      <motion.div
        className="text-center"
        variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}
      >
        <p className="text-sm text-muted-foreground">
          {t("auth.otp.enterCodeSentToPrefix")} <span className="font-medium text-foreground" dir="ltr">{email}</span>
        </p>
      </motion.div>

      <motion.div
        key={shakeKey}
        className="flex justify-center gap-2"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }}
        // Shake on error (overrides the stagger animate)
        style={error ? { animation: "shake 0.4s ease-in-out" } : undefined}
      >
        {digits.map((digit, i) => (
          <motion.div
            key={i}
            variants={{
              hidden: { opacity: 0, y: 16, scale: 0.8 },
              show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 18 } },
            }}
          >
            <motion.input
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              disabled={isLoading}
              className="h-14 w-12 rounded-xl border bg-card/50 text-center text-2xl font-semibold text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              animate={{
                borderColor: error ? "rgba(239,68,68,0.5)" : digit ? "rgba(52,211,153,0.4)" : "rgba(75,85,99,0.25)",
                boxShadow: error
                  ? "0 0 0 1px rgba(239,68,68,0.2), 0 0 20px rgba(239,68,68,0.1)"
                  : digit
                    ? "0 0 0 1px rgba(52,211,153,0.1), 0 0 20px rgba(52,211,153,0.08)"
                    : "0 0 0 0px transparent",
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              aria-label={t("auth.otp.digitAria").replace("{n}", String(i + 1))}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Shake keyframe (injected once) */}
      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-10px)} 40%{transform:translateX(10px)} 60%{transform:translateX(-8px)} 80%{transform:translateX(4px)} }`}</style>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("auth.otp.verifying")}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && !isLoading && (
          <motion.p
            className="text-center text-sm text-red-400"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            aria-live="assertive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.div
        className="flex flex-col items-center gap-3"
        variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}
      >
        <div className="h-px w-full bg-border/50" />
        {canResend ? (
          <button
            type="button"
            onClick={handleResend}
            className="text-sm text-emerald-600 dark:text-emerald-400 transition-colors hover:text-emerald-700 dark:text-emerald-300"
          >
            {t("auth.otp.resendCode")}
          </button>
        ) : (
          <CountdownTimer key={resendKey} duration={60} onComplete={() => setCanResend(true)} />
        )}
      </motion.div>
    </motion.div>
  );
}
