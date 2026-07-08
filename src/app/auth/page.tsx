"use client";

import { motion } from "framer-motion";
import { AuthCard } from "./components/AuthCard";
import { AmbientBackground } from "./components/AmbientBackground";
import { CustomCursor } from "./components/CustomCursor";
import { AnimatedText } from "./components/AnimatedText";
import { ShieldCheck } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Auth page — 40/60 bento split with a page-load sequence.
 * Left panel slides in from the left; right panel fades in with a slight delay.
 * Mobile: left panel collapses to a small header above the form.
 */

export default function AuthPage() {
  return (
    <>
      <AmbientBackground />
      <CustomCursor />

      <div className="flex min-h-screen flex-col lg:flex-row" style={{ backgroundColor: "transparent" }}>
        {/* Left panel — 40% on desktop, header on mobile */}
        <motion.div
          className="relative flex flex-col justify-between overflow-hidden p-8 lg:w-2/5 lg:p-12"
          style={{ backgroundColor: "#060907" }}
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          {/* Subtle inner glow on left panel */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.06), transparent 60%)",
            }}
          />

          {/* Logo + wordmark */}
          <motion.div
            className="relative flex items-center gap-2.5"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
          >
            <motion.div
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20"
              whileHover={{ scale: 1.08, rotate: -5 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </motion.div>
            <span className="text-lg font-semibold text-gray-100">Nixify</span>
          </motion.div>

          {/* Tagline — centered on desktop, hidden on mobile */}
          <div className="hidden lg:block">
            <motion.h1
              className="text-3xl font-semibold leading-tight text-gray-100"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            >
              <AnimatedText text="Secure authentication," delay={0.5} />
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-teal-500 bg-clip-text text-transparent">
                <AnimatedText text="simplified." delay={0.9} />
              </span>
            </motion.h1>
            <motion.p
              className="mt-4 max-w-sm text-sm leading-relaxed text-gray-500"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4, duration: 0.5, ease: EASE }}
            >
              One-time codes delivered to your inbox. No passwords to remember,
              no third-party apps. Just your email.
            </motion.p>

            {/* Feature pills */}
            <motion.div
              className="mt-8 flex flex-wrap gap-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6, duration: 0.5, ease: EASE }}
            >
              {["No passwords", "6-digit codes", "5-min expiry", "Bank-grade security"].map((feat, i) => (
                <motion.span
                  key={feat}
                  className="rounded-full border border-emerald-500/15 bg-emerald-500/5 px-3 py-1 text-xs text-emerald-300/70"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.7 + i * 0.08, type: "spring", stiffness: 300, damping: 20 }}
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
            transition={{ delay: 2, duration: 0.5 }}
          >
            © 2026 Nixify. All rights reserved.
          </motion.div>
        </motion.div>

        {/* Right panel — 60% on desktop, form area on mobile */}
        <motion.div
          className="flex flex-1 items-center justify-center p-6 sm:p-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6, ease: EASE }}
        >
          <AuthCard />
        </motion.div>
      </div>
    </>
  );
}
