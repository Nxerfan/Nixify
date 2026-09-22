"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";
import { isValidEmail } from "@/lib/auth-utils";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

/**
 * Email entry step for Sign In. Calls sendOtp on submit, transitions to OTP
 * step on success. Shows inline error on failure.
 */

interface EmailStepProps {
  loading: boolean;
  onSubmit: (email: string) => void;
  onPasswordLink: () => void;
  error: string | null;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function EmailStep({ loading, onSubmit, onPasswordLink, error }: EmailStepProps) {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setLocalError(t("auth.shell.errors.invalidEmail"));
      return;
    }
    setLocalError(null);
    onSubmit(email);
  };

  const displayError = error ?? localError;

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-5"
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.05 } },
      }}
    >
      <motion.div
        className="space-y-2"
        variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}
      >
        <Label htmlFor="signin-email" className="text-sm font-medium text-muted-foreground">
          {t("auth.shell.emailAddress")}
        </Label>
        <div className="group relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70 transition-colors group-focus-within:text-emerald-400" />
          <Input
            id="signin-email"
            type="email"
            placeholder={t("auth.shell.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border-border bg-card/50 pl-10 text-foreground placeholder:text-muted-foreground/50 transition-all focus:border-emerald-500/50 focus-visible:border-emerald-500/50 focus-visible:shadow-[0_0_0_3px_rgba(16,185,129,0.1)]"
            autoFocus
            autoComplete="email"
            disabled={loading}
          />
        </div>
      </motion.div>

      {displayError && (
        <motion.p
          className="text-sm text-red-400"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
        >
          {displayError}
        </motion.p>
      )}

      <motion.div
        variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}
      >
        <Button
          type="submit"
          className="w-full bg-emerald-600 text-white transition-all hover:bg-emerald-500 hover:shadow-[0_0_24px_rgba(16,185,129,0.25)] disabled:opacity-50 disabled:hover:shadow-none"
          disabled={loading || !email}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? t("auth.shell.sendingCode") : t("auth.shell.continueButton")}
        </Button>
      </motion.div>

      <motion.div
        className="text-center"
        variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}
      >
        <button
          type="button"
          onClick={onPasswordLink}
          className="text-sm text-muted-foreground/70 transition-colors hover:text-muted-foreground"
        >
          {t("auth.shell.preferPassword")} <span className="text-emerald-400">{t("auth.shell.signInWithPassword")}</span>
        </button>
      </motion.div>
    </motion.form>
  );
}
