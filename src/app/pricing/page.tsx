"use client";

import { usePricing } from "@/hooks/usePricing";
import { useTranslations } from "@/i18n";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { CustomCursor } from "@/app/auth/components/CustomCursor";
import { PricingHeader } from "./components/PricingHeader";
import { PricingCards } from "./components/PricingCards";
import { PricingComparison } from "./components/PricingComparison";
import { PricingFAQ } from "./components/PricingFAQ";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Pricing page.
 *
 * Phase 14 cleanup:
 *   - Removed fictional testimonials ("Sara Chen, CTO Stripeflow" etc.).
 *   - Removed "30-day money-back guarantee" / "No credit card required" /
 *     "Cancel anytime" badges from the final CTA — these claims assume a
 *     billing provider that does not exist.
 *   - Uses the Phase 12 localization system (useTranslations) for the new
 *     pricing UI copy. The copy lives under `pricing.*` in en.ts/fa.ts.
 *   - Tier data, comparison rows, and FAQ items are derived from the
 *     canonical plan catalog + entitlement config (see src/lib/pricingData.ts
 *     and src/lib/billing/plan-catalog.ts). The page renders whatever the
 *     catalog says — there is no hardcoded plan name, price, or quota here.
 */
export default function PricingPage() {
  const { tiers, comparison, faqs, loading, billing, setBilling } =
    usePricing();
  const t = useTranslations();

  const handleBillingChange = (b: "monthly" | "yearly") => {
    setBilling(b);
  };

  return (
    <>
      <AmbientBackground />
      <CustomCursor />

      <div className="relative min-h-screen px-4 pb-24 pt-28 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <PricingHeader
            billing={billing}
            onBillingChange={handleBillingChange}
            showSavings
          />

          {/* 3 pricing cards */}
          <PricingCards tiers={tiers} billing={billing} loading={loading} />

          {/* Comparison table */}
          <div className="mt-12">
            <div className="mb-6 text-center">
              <span className="mb-2 inline-block text-xs font-medium uppercase tracking-wider text-emerald-400/70">
                {t("pricing.compare.eyebrow")}
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-gray-100 sm:text-3xl">
                {t("pricing.compare.title")}
              </h2>
            </div>
            <PricingComparison rows={comparison} loading={loading} />
          </div>

          {/* FAQ */}
          <div className="mt-12">
            <PricingFAQ faqs={faqs} />
          </div>

          {/* Final CTA — no fictional billing claims */}
          <div className="mt-12 flex flex-col items-center text-center">
            <Button
              asChild
              size="lg"
              className="bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]"
            >
              <Link href="/auth">
                {t("pricing.finalCta.cta")}{" "}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-3 text-xs text-gray-600">
              {t("pricing.finalCta.subtitle")}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
