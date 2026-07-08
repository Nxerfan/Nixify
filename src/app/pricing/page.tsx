"use client";

import { usePricing } from "@/hooks/usePricing";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { CustomCursor } from "@/app/auth/components/CustomCursor";
import { PricingHeader } from "./components/PricingHeader";
import { PricingCards } from "./components/PricingCards";
import { PricingComparison } from "./components/PricingComparison";
import { PricingFAQ } from "./components/PricingFAQ";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PricingPage() {
  const { tiers, comparison, faqs, loading, billing, setBilling } =
    usePricing();

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
          />

          {/* 3 pricing cards */}
          <PricingCards tiers={tiers} billing={billing} loading={loading} />

          {/* Comparison table */}
          <div className="mt-12">
            <div className="mb-6 text-center">
              <span className="mb-2 inline-block text-xs font-medium uppercase tracking-wider text-emerald-400/70">
                Compare
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-gray-100 sm:text-3xl">
                Feature comparison
              </h2>
            </div>
            <PricingComparison rows={comparison} loading={loading} />
          </div>

          {/* FAQ */}
          <div className="mt-12">
            <PricingFAQ faqs={faqs} />
          </div>

          {/* Final CTA */}
          <div className="mt-12 flex flex-col items-center text-center">
            <div className="mb-6 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-600">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/60" />{" "}
                30-day money-back guarantee
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/60" /> No
                credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/60" />{" "}
                Cancel anytime
              </span>
            </div>
            <Button
              asChild
              size="lg"
              className="bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]"
            >
              <Link href="/auth">
                Get started — free <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-3 text-xs text-gray-600">
              Start on Free. Upgrade to Pro when you grow.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
