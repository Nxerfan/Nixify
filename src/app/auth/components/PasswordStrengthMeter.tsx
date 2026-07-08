"use client";

import { motion } from "framer-motion";
import { getPasswordStrength } from "@/lib/auth-utils";

/**
 * Password strength meter — 4-segment bar that fills + changes color based on
 * the password's score. Animated with framer-motion for smooth transitions.
 */

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  const segments = [1, 2, 3, 4];

  if (!password) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {segments.map((seg) => (
          <motion.div
            key={seg}
            className="h-1 flex-1 rounded-full"
            animate={{
              backgroundColor: seg <= strength.score ? strength.color : "rgba(75,85,99,0.2)",
            }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </div>
      <span className="text-xs font-medium" style={{ color: strength.color }}>
        {strength.label}
      </span>
    </div>
  );
}
