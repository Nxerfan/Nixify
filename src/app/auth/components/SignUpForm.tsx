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
        <Label htmlFor="su-name" className="text-sm font-medium text-gray-300">Full name</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input id="su-name" type="text" placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)}
            className="border-gray-800 bg-gray-950/50 pl-10 text-gray-100 placeholder:text-gray-600 focus:border-emerald-500/50"
            autoFocus autoComplete="name" disabled={loading} />
        </div>
      </motion.div>

      {/* Email */}
      <motion.div className="space-y-2" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
        <Label htmlFor="su-email" className="text-sm font-medium text-gray-300">Email address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input id="su-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
            className="border-gray-800 bg-gray-950/50 pl-10 text-gray-100 placeholder:text-gray-600 focus:border-emerald-500/50"
            autoComplete="email" disabled={loading} />
        </div>
      </motion.div>

      {/* Password + strength meter */}
      <motion.div className="space-y-2" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
        <Label htmlFor="su-password" className="text-sm font-medium text-gray-300">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input id="su-password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)}
            className="border-gray-800 bg-gray-950/50 pl-10 text-gray-100 placeholder:text-gray-600 focus:border-emerald-500/50"
            autoComplete="new-password" disabled={loading} />
        </div>
        {password && <PasswordStrengthMeter password={password} />}
      </motion.div>

      {/* Confirm password */}
      <motion.div className="space-y-2" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
        <Label htmlFor="su-confirm" className="text-sm font-medium text-gray-300">Confirm password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input id="su-confirm" type="password" placeholder="Re-enter your password" value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} onBlur={() => setTouched({ confirm: true })}
            className={`border-gray-800 bg-gray-950/50 pl-10 text-gray-100 placeholder:text-gray-600 focus:border-emerald-500/50 ${confirmError ? "border-red-500/40" : ""}`}
            autoComplete="new-password" disabled={loading} />
        </div>
        {confirmError && <p className="text-xs text-red-400">Passwords don't match</p>}
      </motion.div>

      {/* Terms checkbox */}
      <motion.div className="flex items-start gap-2" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
        <Checkbox id="su-terms" checked={terms} onCheckedChange={(v) => setTerms(v === true)}
          className="mt-0.5 border-gray-700 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" />
        <Label htmlFor="su-terms" className="text-xs leading-relaxed text-gray-400">
          I agree to the <Link href="/terms" className="text-emerald-400 underline-offset-2 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-emerald-400 underline-offset-2 hover:underline">Privacy Policy</Link>
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
          {loading ? "Sending code..." : "Create Account"}
        </Button>
      </motion.div>

      <motion.div className="text-center" variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>
        <button type="button" onClick={onSignInLink} className="text-sm text-gray-500 transition-colors hover:text-gray-300">
          Already have an account? <span className="text-emerald-400">Sign in</span>
        </button>
      </motion.div>
    </motion.form>
  );
}
