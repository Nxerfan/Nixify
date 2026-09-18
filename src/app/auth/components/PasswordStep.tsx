"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, Mail } from "lucide-react";
import { isValidEmail } from "@/lib/auth-utils";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

/**
 * Password sign-in step. Email + password fields, calls signinPassword on
 * submit. Shows inline error on failure.
 */

interface PasswordStepProps {
  loading: boolean;
  onSubmit: (email: string, password: string) => void;
  onOtpLink: () => void;
  error: string | null;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function PasswordStep({ loading, onSubmit, onOtpLink, error }: PasswordStepProps) {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setLocalError(t("auth.shell.errors.invalidEmail"));
      return;
    }
    if (password.length < 1) {
      setLocalError(t("auth.shell.errors.passwordRequired"));
      return;
    }
    setLocalError(null);
    onSubmit(email, password);
  };

  const displayError = error ?? localError;

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-5"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
    >
      <motion.div
        className="space-y-2"
        variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}
      >
        <Label htmlFor="pw-email" className="text-sm font-medium text-gray-300">{t("auth.shell.emailAddress")}</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input
            id="pw-email" type="email" placeholder={t("auth.shell.emailPlaceholder")}
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="border-gray-800 bg-gray-950/50 pl-10 text-gray-100 placeholder:text-gray-600 focus:border-emerald-500/50"
            autoFocus autoComplete="email" disabled={loading}
          />
        </div>
      </motion.div>

      <motion.div
        className="space-y-2"
        variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}
      >
        <Label htmlFor="pw-password" className="text-sm font-medium text-gray-300">{t("auth.shell.password")}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input
            id="pw-password" type="password" placeholder={t("auth.shell.passwordPlaceholder")}
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="border-gray-800 bg-gray-950/50 pl-10 text-gray-100 placeholder:text-gray-600 focus:border-emerald-500/50"
            autoComplete="current-password" disabled={loading}
          />
        </div>
      </motion.div>

      {displayError && (
        <motion.p className="text-sm text-red-400" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert">
          {displayError}
        </motion.p>
      )}

      <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
        <Button type="submit" className="w-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50" disabled={loading || !email || !password}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? t("auth.shell.signingIn") : t("auth.shell.signIn")}
        </Button>
      </motion.div>

      <motion.div className="text-center" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
        <button type="button" onClick={onOtpLink} className="text-sm text-gray-500 transition-colors hover:text-gray-300">
          <span className="text-emerald-400">{t("auth.shell.useOtpInstead")}</span>
        </button>
      </motion.div>
    </motion.form>
  );
}
