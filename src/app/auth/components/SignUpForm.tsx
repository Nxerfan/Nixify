"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Lock, Mail, User } from "lucide-react";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { isValidEmail, getPasswordStrength, passwordsMatch } from "@/lib/auth-utils";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

/**
 * Sign Up form — Full Name, Email, Password (with strength meter), Confirm
 * Password, Terms checkbox. Client-side validation gates the submit button.
 * On submit, calls sendOtp(signup) to start email verification before account
 * creation.
 */

interface SignUpFormProps {
  loading: boolean;
  onSubmit: (name: string, email: string, password: string) => void;
  onSignInLink: () => void;
  error: string | null;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function SignUpForm({ loading, onSubmit, onSignInLink, error }: SignUpFormProps) {
  const t = useTranslations();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [touched, setTouched] = useState({ confirm: false });

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const isValid =
    name.trim().length > 0 &&
    isValidEmail(email) &&
    password.length >= 8 &&
    passwordsMatch(password, confirmPassword) &&
    terms;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSubmit(name.trim(), email.trim(), password);
  };

  const confirmError = touched.confirm && !passwordsMatch(password, confirmPassword) && confirmPassword.length > 0;

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-4"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
    >
      {/* Full Name */}
      <motion.div className="space-y-2" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
        <Label htmlFor="su-name" className="text-sm font-medium text-muted-foreground">{t("auth.signUp.fullName")}</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input id="su-name" type="text" placeholder={t("auth.signUp.fullNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)}
            className="border-border bg-card/50 pl-10 text-foreground placeholder:text-muted-foreground/50 focus:border-emerald-500/50"
            autoFocus autoComplete="name" disabled={loading} />
        </div>
      </motion.div>

      {/* Email */}
      <motion.div className="space-y-2" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
        <Label htmlFor="su-email" className="text-sm font-medium text-muted-foreground">{t("auth.signUp.emailAddress")}</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input id="su-email" type="email" placeholder={t("auth.signUp.emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)}
            className="border-border bg-card/50 pl-10 text-foreground placeholder:text-muted-foreground/50 focus:border-emerald-500/50"
            autoComplete="email" disabled={loading} />
        </div>
      </motion.div>

      {/* Password + strength meter */}
      <motion.div className="space-y-2" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
        <Label htmlFor="su-password" className="text-sm font-medium text-muted-foreground">{t("auth.signUp.password")}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input id="su-password" type="password" placeholder={t("auth.signUp.passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)}
            className="border-border bg-card/50 pl-10 text-foreground placeholder:text-muted-foreground/50 focus:border-emerald-500/50"
            autoComplete="new-password" disabled={loading} />
        </div>
        {password && <PasswordStrengthMeter password={password} />}
      </motion.div>

      {/* Confirm password */}
      <motion.div className="space-y-2" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
        <Label htmlFor="su-confirm" className="text-sm font-medium text-muted-foreground">{t("auth.signUp.confirmPassword")}</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input id="su-confirm" type="password" placeholder={t("auth.signUp.confirmPlaceholder")} value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} onBlur={() => setTouched({ confirm: true })}
            className={`border-border bg-card/50 pl-10 text-foreground placeholder:text-muted-foreground/50 focus:border-emerald-500/50 ${confirmError ? "border-red-500/40" : ""}`}
            autoComplete="new-password" disabled={loading} />
        </div>
        {confirmError && <p className="text-xs text-red-400">{t("auth.signUp.passwordsDoNotMatch")}</p>}
      </motion.div>

      {/* Terms checkbox */}
      <motion.div className="flex items-start gap-2" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
        <Checkbox id="su-terms" checked={terms} onCheckedChange={(v) => setTerms(v === true)}
          className="mt-0.5 border-border data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" />
        <Label htmlFor="su-terms" className="text-xs leading-relaxed text-muted-foreground">
          {t("auth.signUp.termsPrefix")} <Link href="/terms" className="text-emerald-600 dark:text-emerald-400 underline-offset-2 hover:underline">{t("auth.signUp.termsLink")}</Link> {t("auth.signUp.andJoiner")} <Link href="/privacy" className="text-emerald-600 dark:text-emerald-400 underline-offset-2 hover:underline">{t("auth.signUp.privacyLink")}</Link>
        </Label>
      </motion.div>

      {error && (
        <motion.p className="text-sm text-red-400" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert">
          {error}
        </motion.p>
      )}

      <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
        <Button type="submit" className="w-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={loading || !isValid}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {loading ? t("auth.signUp.sendingCode") : t("auth.signUp.createAccountCta")}
        </Button>
      </motion.div>

      <motion.div className="text-center" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
        <button type="button" onClick={onSignInLink} className="text-sm text-muted-foreground/70 transition-colors hover:text-muted-foreground">
          {t("auth.signUp.alreadyHaveAccount")} <span className="text-emerald-600 dark:text-emerald-400">{t("auth.signUp.signInLinkInline")}</span>
        </button>
      </motion.div>
    </motion.form>
  );
}
