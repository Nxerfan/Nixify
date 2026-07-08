"use client";

import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Sparkles } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Props {
  billing: "monthly" | "yearly";
  onBillingChange: (b: "monthly" | "yearly") => void;
  showSavings: boolean;
}

export function PricingHeader({ billing, onBillingChange }: Props) {
  return (
    <div className="mb-10 text-center">
      <motion.span
        className="mb-3 inline-block text-xs font-medium uppercase tracking-wider text-emerald-400/70"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        Pricing
      </motion.span>
      <motion.h1
        className="text-4xl font-bold tracking-tight text-gray-100 sm:text-5xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
      >
        Simple, transparent pricing
      </motion.h1>
      <motion.p
        className="mx-auto mt-4 max-w-xl text-gray-500"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease: EASE }}
      >
        Start free. Upgrade when you grow. Cancel anytime.
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
          className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300"
          animate={{ scale: billing === "yearly" ? 1 : 0.9 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          <Sparkles className="h-3 w-3" />
          Save 20% with annual billing
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
            billing === "monthly" ? "text-gray-100" : "text-gray-500"
          }`}
        >
          Monthly
        </span>

        <Switch
          checked={billing === "yearly"}
          onCheckedChange={(c) => onBillingChange(c ? "yearly" : "monthly")}
          className="data-[state=checked]:bg-emerald-600"
        />

        <span
          className={`text-sm font-medium transition-colors duration-300 ${
            billing === "yearly" ? "text-gray-100" : "text-gray-500"
          }`}
        >
          Yearly
        </span>
      </motion.div>
    </div>
  );
}
