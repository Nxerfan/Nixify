"use client";

import { useState } from "react";
import {
  PRICING_TIERS,
  COMPARISON_DATA,
  FAQS,
  type PricingTier,
  type ComparisonRow,
  type FAQItem,
} from "@/lib/pricingData";

/**
 * usePricing — pricing-page state hook.
 *
 * The pricing data is fully static (derived from the canonical plan catalog
 * + entitlement config at module load). There is NO async fetch, NO API call,
 * NO loading spinner needed. The previous artificial 200ms setTimeout was
 * removed in Phase 14 — it was decorative and added nothing.
 *
 * The only stateful piece is the monthly/yearly billing toggle.
 */
export function usePricing() {
  const [tiers] = useState<PricingTier[]>(PRICING_TIERS);
  const [comparison] = useState<ComparisonRow[]>(COMPARISON_DATA);
  const [faqs] = useState<FAQItem[]>(FAQS);
  // `loading` is kept in the return shape for backward compatibility with
  // <PricingCards loading={loading} /> and <PricingComparison loading={loading} />
  // which use it to render skeletons. It is always false now — the data is
  // available synchronously on first render. We do not remove the prop
  // because that would force a refactor of the consumer components for no
  // functional benefit; the prop simply has no effect anymore.
  const loading = false;
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return { tiers, comparison, faqs, loading, billing, setBilling };
}
