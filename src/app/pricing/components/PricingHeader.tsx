"use client";

import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Sparkles } from "lucide-react";
import { useTranslations } from "@/i18n";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Props {
  billing: "monthly" | "yearly";
  onBillingChange: (b: "monthly" | "yearly") => void;
  showSavings: boolean;
}

/**
 * Pricing header — eyebrow, title, subtitle, billing toggle.
 *
 * All copy is sourced from the `pricing.header.*` translation keys so the
 * Phase 12 localization system handles English/Persian. The toggle itself
 * is a presentation control — there is no checkout or payment attached.
 */
export function PricingHeader({ billing, onBillingChange }: Props) {
  const t = useTranslations();

  return (
    <div className="mb-10 text-center">
      <motion.span
        className="mb-3 inline-block text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400/70"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        {t("pricing.header.eyebrow")}
      </motion.span>
      <motion.h1
        className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
      >
        {t("pricing.header.title")}
      </motion.h1>
      <motion.p
        className="mx-auto mt-4 max-w-xl text-muted-foreground/70"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease: EASE }}
      >
        {t("pricing.header.subtitle")}
      </motion.p>

      {/* Savings badge — above the toggle */}
      <motion.div
        className="mt-6 flex justify-center"
        initial={{ opacity: 0, y: -8 }}
        animate={{
          opacity: billing === "yearly" ? 1 : 0,
          y: billing === "yearly" ? 0 : -8,
        }}
        transition={{ duration: 0.25, ease: EASE }}
      >
        <motion.span
          className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
          animate={{ scale: billing === "yearly" ? 1 : 0.9 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          <Sparkles className="h-3 w-3" />
          {t("pricing.header.savingsBadge")}
        </motion.span>
      </motion.div>

      {/* Toggle */}
      <motion.div
        className="mt-3 flex items-center justify-center gap-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
      >
        <span
          className={`text-sm font-medium transition-colors duration-300 ${
            billing === "monthly" ? "text-foreground" : "text-muted-foreground/70"
          }`}
        >
          {t("pricing.header.monthly")}
        </span>

        <Switch
          checked={billing === "yearly"}
          onCheckedChange={(c) => onBillingChange(c ? "yearly" : "monthly")}
          className="data-[state=checked]:bg-emerald-600"
        />

        <span
          className={`text-sm font-medium transition-colors duration-300 ${
            billing === "yearly" ? "text-foreground" : "text-muted-foreground/70"
          }`}
        >
          {t("pricing.header.yearly")}
        </span>
      </motion.div>
    </div>
  );
}
