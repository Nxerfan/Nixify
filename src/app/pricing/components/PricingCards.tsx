"use client";

import * as React from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "@/i18n";
import type { PricingTier } from "@/lib/pricingData";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Props {
  tiers: PricingTier[];
  billing: "monthly" | "yearly";
  loading: boolean;
}

export function PricingCards({ tiers, billing, loading }: Props) {
  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[520px] animate-pulse rounded-2xl border border-gray-800/40 bg-gray-950/30"
          />
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid gap-5 lg:grid-cols-3 lg:items-stretch">
        {tiers.map((tier, i) => (
          <PricingCard key={tier.id} tier={tier} billing={billing} index={i} />
        ))}
      </div>
    </TooltipProvider>
  );
}

function PricingCard({
  tier,
  billing,
  index,
}: {
  tier: PricingTier;
  billing: "monthly" | "yearly";
  index: number;
}) {
  const t = useTranslations();
  const price = billing === "monthly" ? tier.priceMonthly : tier.priceYearly;
  const isPro = tier.isPopular;

  // Presentation strings (name, description, CTA) are localized via translation
  // dictionaries. Feature strings come directly from the canonical plan
  // catalog (`tier.features`) which already interpolated quota numbers via
  // getFeatureQuota() from FEATURE_LIMITS. For the fa locale, we format
  // the numeric portions using Persian digits — but the NUMBERS themselves
  // originate from the entitlement config, NOT from translation dictionaries.
  const tierKey = `pricing.card.tiers.${tier.id}`;
  const localizedName = t(`${tierKey}.name`);
  const localizedDescription = t(`${tierKey}.description`);
  const localizedCta = t(`${tierKey}.ctaText`);
  // Use the catalog's feature strings directly — they contain canonical
  // quota numbers derived from FEATURE_LIMITS. Do NOT use dictionary
  // translations for feature strings (they would duplicate commercial values).
  const localizedFeatures = tier.features;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: EASE }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="relative flex h-full"
    >
      {/* Pro: breathing glow behind card */}
      {isPro && (
        <motion.div
          className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-emerald-500/20 to-teal-500/10 blur-lg"
          animate={{ opacity: [0.25, 0.55, 0.25] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <Card
        className={`relative flex w-full flex-col overflow-hidden border ${
          isPro ? "border-emerald-500/25" : "border-gray-800/40"
        } bg-gray-950/60 backdrop-blur-xl`}
      >
        {/* Top accent bar */}
        <div
          className="h-1 w-full shrink-0"
          style={{
            background: isPro
              ? "linear-gradient(to right, #34d399, #14b8a6)"
              : "linear-gradient(to right, rgba(107,114,128,0.2), transparent)",
          }}
        />

        {/* "Most Popular" badge — absolute, doesn't affect content flow */}
        {isPro && (
          <div className="absolute left-1/2 top-3 z-30 -translate-x-1/2">
            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-1 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]">
              <Sparkles className="mr-1 h-3 w-3" />
              {t("pricing.card.mostPopular")}
            </Badge>
          </div>
        )}

        <div className="flex flex-1 flex-col p-6">
          {/* Name + description — consistent padding regardless of badge */}
          <div className="pt-1">
            <h3 className="text-lg font-semibold text-gray-100">
              {localizedName}
            </h3>
            <p className="mt-1 text-sm text-gray-500">{localizedDescription}</p>
          </div>

          {/* Price — canonical commercial data from the catalog */}
          <div className="mt-5 flex items-baseline gap-1">
            <span className="text-4xl font-bold tabular-nums text-gray-100">
              <AnimatedPrice value={price} />
            </span>
            <span className="text-sm text-gray-500">
              {t("pricing.card.perMonth")}
            </span>
          </div>
          {billing === "yearly" && tier.priceYearly > 0 && (
            <p className="mt-1 text-xs text-emerald-400/70">
              {t("pricing.card.billedAnnually")}
            </p>
          )}
          {price === 0 && (
            <p className="mt-1 text-xs text-gray-600">
              {t("pricing.card.freeForever")}
            </p>
          )}

          {/* Divider */}
          <div className="mb-6 mt-8 h-px bg-gradient-to-r from-transparent via-gray-800/50 to-transparent" />

          {/* Features */}
          <ul className="space-y-3">
            {localizedFeatures.map((f, fi) => (
              <motion.li
                key={fi}
                className="flex items-start gap-2.5"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: index * 0.1 + 0.3 + fi * 0.03,
                  duration: 0.3,
                  ease: EASE,
                }}
              >
                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <Check className="h-2.5 w-2.5 text-emerald-400" />
                </div>
                <span className="text-sm text-gray-400">{f}</span>
              </motion.li>
            ))}
          </ul>

          {/* CTA — mt-auto pushes to bottom for equal heights */}
          <div className="mt-auto pt-8">
            <Button
              asChild
              className="w-full bg-gradient-to-r from-emerald-400 to-teal-500 text-gray-900 transition-all hover:from-emerald-300 hover:to-teal-400 hover:shadow-[0_0_24px_rgba(16,185,129,0.3)]"
              variant="ghost"
            >
              <Link href="/auth">
                {localizedCta}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function AnimatedPrice({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 60, damping: 18 });
  const display = useTransform(spring, (v) => `$${Math.round(v)}`);
  React.useEffect(() => {
    spring.set(value);
  }, [spring, value]);
  return <motion.span>{display}</motion.span>;
}
