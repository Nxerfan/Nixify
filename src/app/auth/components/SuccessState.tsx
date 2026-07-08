"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Confetti } from "./Confetti";
import { AnimatedText } from "./AnimatedText";

/**
 * Success state — shown after password sign-in, OTP sign-in, or signup
 * completion. Animated checkmark + confetti burst + context-correct message.
 */

interface SuccessStateProps {
  context: "signin" | "signup";
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function SuccessState({ context }: SuccessStateProps) {
  const title = context === "signup" ? "Account created!" : "Welcome back!";
  const subtitle =
    context === "signup"
      ? "Your account is ready. You can now sign in anytime."
      : "You've been verified successfully.";

  return (
    <motion.div
      className="relative flex flex-col items-center justify-center py-8 text-center"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
    >
      {/* Confetti burst */}
      <Confetti />

      {/* Checkmark with ripple rings */}
      <motion.div
        className="relative"
        variants={{ hidden: { opacity: 0, scale: 0.5 }, show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 200, damping: 12 } } }}
      >
        {/* Expanding ripple rings */}
        <motion.div
          className="absolute inset-0 rounded-full border border-emerald-400/30"
          initial={{ scale: 0.8, opacity: 0.6 }}
          animate={{ scale: [0.8, 2.5], opacity: [0.6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5 }}
        />
        <motion.div
          className="absolute inset-0 rounded-full border border-emerald-400/20"
          initial={{ scale: 0.8, opacity: 0.4 }}
          animate={{ scale: [0.8, 3], opacity: [0.4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.5, delay: 0.3 }}
        />

        {/* Main checkmark */}
        <motion.div
          className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
        >
          <motion.div
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.4, ease: EASE }}
          >
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.h2
        className="mt-8 text-xl font-semibold text-gray-100"
        variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: 0.3 } } }}
      >
        <AnimatedText text={title} />
      </motion.h2>

      <motion.p
        className="mt-2 text-sm text-gray-400"
        variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: 0.5 } } }}
      >
        {subtitle}
      </motion.p>

      {/* Progress bar that fills to suggest "loading your session" */}
      <motion.div
        className="mt-8 h-0.5 w-32 overflow-hidden rounded-full bg-gray-800"
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: 0.7 } } }}
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
          initial={{ x: "-100%" }}
          animate={{ x: "0%" }}
          transition={{ duration: 1.2, delay: 0.8, ease: EASE }}
        />
      </motion.div>
    </motion.div>
  );
}
