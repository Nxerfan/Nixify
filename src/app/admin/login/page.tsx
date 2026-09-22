"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { CustomCursor } from "@/app/auth/components/CustomCursor";
import { ShieldAlert, Lock, Mail, Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Admin login — premium bento-split layout matching the /auth page.
 * Left panel: dark, ShieldAlert branding, security tagline, feature pills.
 * Right panel: glassmorphism card with email + password fields.
 * Same dark-green palette, ambient blobs, custom cursor, spring animations.
 */

export default function AdminLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Invalid credentials");
        toast({ title: "Login failed", description: data.message ?? "Invalid credentials", variant: "destructive" });
        return;
      }
      toast({ title: "Welcome, admin", description: "Logged in" });
      router.push("/admin");
    } catch {
      setError("Network error. Please try again.");
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AmbientBackground />
      <CustomCursor />

      <div className="flex min-h-screen flex-col lg:flex-row" style={{ backgroundColor: "transparent" }}>
        {/* Left panel — branding */}
        <motion.div
          className="relative flex flex-col justify-between overflow-hidden p-8 lg:w-2/5 lg:p-12"
          style={{ backgroundColor: "#060907" }}
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          {/* Inner glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(244,63,94,0.05), transparent 60%)" }}
          />

          {/* Logo */}
          <motion.div
            className="relative flex items-center gap-2.5"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
          >
            <motion.div
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/20"
              whileHover={{ scale: 1.08, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              <ShieldAlert className="h-5 w-5 text-rose-400" />
            </motion.div>
            <span className="text-lg font-semibold text-foreground">Nixify Admin</span>
          </motion.div>

          {/* Tagline */}
          <div className="hidden lg:block">
            <motion.h1
              className="text-3xl font-semibold leading-tight text-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            >
              Security dashboard.
              <br />
              <span className="bg-gradient-to-r from-rose-400 to-rose-500 bg-clip-text text-transparent">
                Authorized only.
              </span>
            </motion.h1>
            <motion.p
              className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground/70"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.5, ease: EASE }}
            >
              Manage API keys, monitor security events, block IPs, configure
              webhooks, and oversee the entire platform from one secure console.
            </motion.p>

            {/* Feature pills */}
            <motion.div
              className="mt-8 flex flex-wrap gap-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.5, ease: EASE }}
            >
              {["Security events", "IP blocking", "API keys", "Webhooks"].map((feat, i) => (
                <motion.span
                  key={feat}
                  className="rounded-full border border-rose-500/15 bg-rose-500/5 px-3 py-1 text-xs text-rose-300/70"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.2 + i * 0.08, type: "spring", stiffness: 300, damping: 20 }}
                >
                  {feat}
                </motion.span>
              ))}
            </motion.div>
          </div>

          {/* Footer */}
          <motion.div
            className="relative text-xs text-gray-700"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.5 }}
          >
            © 2026 Nixify · Restricted access
          </motion.div>
        </motion.div>

        {/* Right panel — form */}
        <motion.div
          className="flex flex-1 items-center justify-center p-6 sm:p-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6, ease: EASE }}
        >
          <div className="w-full max-w-md">
            {/* Back link */}
            <motion.button
              onClick={() => router.push("/")}
              className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground/70 transition-colors hover:text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              whileHover={{ x: -3 }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to site
            </motion.button>

            {/* Glassmorphism card */}
            <motion.div
              className="relative overflow-hidden rounded-2xl border border-rose-500/10 bg-muted/40 p-8 backdrop-blur-xl"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.5, ease: EASE }}
            >
              {/* Gradient border glow */}
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-50"
                style={{
                  background: "linear-gradient(135deg, rgba(244,63,94,0.06), transparent 40%, transparent 60%, rgba(16,185,129,0.04))",
                }}
              />

              {/* Header */}
              <motion.div
                className="relative mb-8 text-center"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4, ease: EASE }}
              >
                <motion.div
                  className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.7, type: "spring", stiffness: 200, damping: 12 }}
                >
                  <Lock className="h-6 w-6 text-rose-400" />
                </motion.div>
                <h2 className="text-xl font-semibold text-foreground">Admin access</h2>
                <p className="mt-1 text-sm text-muted-foreground/70">Security dashboard login. Authorized operators only.</p>
              </motion.div>

              {/* Form */}
              <motion.form
                onSubmit={onSubmit}
                className="relative space-y-5"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.8 } } }}
              >
                {/* Email */}
                <motion.div
                  className="space-y-2"
                  variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}
                >
                  <Label htmlFor="admin-email" className="text-sm font-medium text-muted-foreground">
                    Admin email
                  </Label>
                  <div className="group relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70 transition-colors group-focus-within:text-rose-400" />
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@nixify.local"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="border-border bg-card/50 pl-10 text-foreground placeholder:text-muted-foreground/50 transition-all focus:border-rose-500/50 focus-visible:border-rose-500/50 focus-visible:shadow-[0_0_0_3px_rgba(244,63,94,0.1)]"
                      autoComplete="username"
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                </motion.div>

                {/* Password */}
                <motion.div
                  className="space-y-2"
                  variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}
                >
                  <Label htmlFor="admin-password" className="text-sm font-medium text-muted-foreground">
                    Password
                  </Label>
                  <div className="group relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70 transition-colors group-focus-within:text-rose-400" />
                    <Input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-border bg-card/50 pl-10 pr-10 text-foreground placeholder:text-muted-foreground/50 transition-all focus:border-rose-500/50 focus-visible:border-rose-500/50 focus-visible:shadow-[0_0_0_3px_rgba(244,63,94,0.1)]"
                      autoComplete="current-password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </motion.div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      className="text-sm text-rose-400"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      role="alert"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <motion.div
                  variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}
                >
                  <Button
                    type="submit"
                    className="w-full bg-rose-600 text-white transition-all hover:bg-rose-500 hover:shadow-[0_0_24px_rgba(244,63,94,0.25)] disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                </motion.div>
              </motion.form>
            </motion.div>

            {/* Hint */}
            <motion.p
              className="mt-6 text-center text-xs text-muted-foreground/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.4 }}
            >
              Default credentials: <span className="font-mono text-muted-foreground/70">admin@nixify.local</span> / <span className="font-mono text-muted-foreground/70">admin1234</span>
            </motion.p>
          </div>
        </motion.div>
      </div>
    </>
  );
}
