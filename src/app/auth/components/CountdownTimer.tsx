"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

/**
 * Circular SVG countdown timer. Counts down from `duration` seconds.
 * Calls `onComplete` when it hits zero. To restart, the parent should change
 * the `key` prop — remounting naturally resets the state.
 *
 * No setState-in-effect: the interval callback updates state (that's fine —
 * it's inside a callback, not the effect body).
 */

interface CountdownTimerProps {
  duration: number;
  onComplete: () => void;
}

export function CountdownTimer({ duration, onComplete }: CountdownTimerProps) {
  const t = useTranslations();
  const [secondsLeft, setSecondsLeft] = useState(duration);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          onComplete();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // onComplete is stable (useCallback in parent); duration is fixed per mount.
  }, []);

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = secondsLeft / duration;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-12 w-12">
        <svg className="h-12 w-12 -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(75,85,99,0.2)" strokeWidth="3" />
          <motion.circle
            cx="22" cy="22" r={radius} fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-400" dir="ltr">
          {secondsLeft}
        </span>
      </div>
      <span className="text-sm text-gray-500">
        {secondsLeft > 0 ? t("auth.otp.resendAvailableShortly") : t("auth.otp.canResendNow")}
      </span>
    </div>
  );
}
