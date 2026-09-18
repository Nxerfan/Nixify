"use client";

import { motion } from "framer-motion";
import { getPasswordStrength } from "@/lib/auth-utils";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

/**
 * Password strength meter — 4-segment bar that fills + changes color based on
 * the password's score. Animated with framer-motion for smooth transitions.
 *
 * The score→label mapping lives in the translation dictionary under
 * `auth.signUp.passwordStrength.{tooShort|weak|fair|good|strong}` so the
 * labels render in the active locale. We do NOT mutate `auth-utils.ts`
 * (it's a pure function shared with other code paths).
 */

const STRENGTH_KEYS = [
  "tooShort",
  "weak",
  "fair",
  "good",
  "strong",
] as const;

export function PasswordStrengthMeter({ password }: { password: string }) {
  const t = useTranslations();
  const strength = getPasswordStrength(password);
  const segments = [1, 2, 3, 4];

  if (!password) return null;

  const label = t(`auth.signUp.passwordStrength.${STRENGTH_KEYS[strength.score]}`);

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
        {label}
      </span>
    </div>
  );
}
