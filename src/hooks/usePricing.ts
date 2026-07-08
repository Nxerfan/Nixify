"use client";

import { useState, useEffect } from "react";
import { PRICING_TIERS, COMPARISON_DATA, FAQS, type PricingTier, type ComparisonRow, type FAQItem } from "@/lib/pricingData";

export function usePricing() {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [comparison, setComparison] = useState<ComparisonRow[]>([]);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    const t = setTimeout(() => {
      setTiers(PRICING_TIERS);
      setComparison(COMPARISON_DATA);
      setFaqs(FAQS);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, []);

  return { tiers, comparison, faqs, loading, billing, setBilling };
}
