/**
 * PRICING UI DATA — presentation layer for the pricing page.
 *
 * DERIVED, NOT INDEPENDENT:
 *   Every numeric value on the pricing cards and comparison table is derived
 *   from one of two canonical sources:
 *
 *     1. `src/lib/billing/plan-catalog.ts` (PLAN_CATALOG) — display name,
 *        description, prices, CTA copy, marketing feature lines.
 *     2. `src/lib/entitlements/config.ts` (FEATURE_LIMITS) — quotas,
 *        rate limits, access flags.
 *
 *   Nothing in this file is allowed to hardcode a quota number or a price.
 *   If you need to change a number, change it in one of the two sources
 *   above. The drift guard tests in `src/lib/billing/billing.test.ts`
 *   assert this — if this file diverges, the tests fail.
 *
 * NON-GOALS — claims that were removed (Phase 14 cleanup):
 *   - "Enterprise" tier → renamed to "Max" (matches Plan enum).
 *   - "1 email template" (Free) → 2 (matches FREE EMAIL_TEMPLATES = 2).
 *   - "1,000,000 OTP emails" (Max) → "Unlimited" (matches MAX OTP_EMAILS = Infinity).
 *   - "Dedicated IP + SMTP relay" → removed (no dedicated-IP infra exists).
 *   - "Custom DKIM/SPF/DMARC" → removed (no per-customer DNS infra exists).
 *   - "SLA 99.99% uptime" → removed (no SLA contract exists).
 *   - "Dedicated support engineer" → removed (no such staffing exists).
 *   - Any mention of Stripe, checkout, proration, NET-30 invoices,
 *     money-back guarantee, one-click cancellation → removed (no billing
 *     provider is integrated).
 *
 * PRESERVED claims (truthful product copy):
 *   - "Sandbox mode" (implemented — src/lib/dx/sandbox.ts).
 *   - "Community support" / "Priority support" (acceptable product copy).
 *   - "Full branding + Brand Kit" (implemented for PRO+).
 *   - "Theme builder" (implemented — EmailTheme model + themes routes).
 *   - "Webhooks + API keys" (implemented).
 */

import {
  PLAN_CATALOG,
  PLAN_ORDER,
  getFeatureQuota,
  formatQuota,
  type PlanKey,
} from "@/lib/billing";
import { FEATURE_KEYS, FEATURE_LIMITS, type FeatureKey } from "@/lib/entitlements/config";

// ─── Public types (consumed by the pricing components) ──────────────────────
//
// These shapes are kept stable because they are imported by:
//   - src/app/pricing/components/PricingCards.tsx        (PricingTier)
//   - src/app/pricing/components/PricingComparison.tsx    (ComparisonRow)
//   - src/app/pricing/components/PricingFAQ.tsx           (FAQItem)
//   - src/hooks/usePricing.ts                             (all three)
//
// Renaming a field requires updating every consumer.

export interface PricingTier {
  /** Stable identifier matching the catalog PlanKey (lowercased for legacy UI). */
  id: string;
  /** Display name (e.g. "Free", "Pro", "Max"). Derived from PLAN_CATALOG. */
  name: string;
  /** Monthly price in whole currency units (e.g. 20). Derived from catalog. */
  priceMonthly: number;
  /** Effective monthly price when billed yearly (e.g. 16). Derived from catalog. */
  priceYearly: number;
  description: string;
  isPopular: boolean;
  ctaText: string;
  features: string[];
}

export interface ComparisonRow {
  feature: string;
  tooltip: string;
  /** The entitlement feature key this row represents. Used for deterministic tests. */
  featureKey?: string;
  free: boolean | string;
  pro: boolean | string;
  /** Renamed from `enterprise` → `max` to match the canonical plan name. */
  max: boolean | string;
}

export interface FAQItem {
  /**
   * Translation-key prefix that resolves to two leaves: `<key>.q` and
   * `<key>.a`. The actual FAQ copy lives in the i18n dictionaries
   * (`src/i18n/en.ts` and `src/i18n/fa.ts`) under `pricing.faq.items.N`,
   * so the FAQ renders localized copy under each locale. The FAQS array
   * itself is locale-agnostic — it only carries the keys.
   */
  key: string;
}

// ─── PRICING_TIERS — derived from PLAN_CATALOG ──────────────────────────────

function buildPricingTier(planKey: PlanKey): PricingTier {
  const entry = PLAN_CATALOG[planKey];
  return {
    id: planKey.toLowerCase(),
    name: entry.displayName,
    priceMonthly: entry.pricing.displayPriceMonthly,
    priceYearly: entry.pricing.displayPriceYearlyPerMonth,
    description: entry.description,
    isPopular: entry.isPopular,
    ctaText: entry.ctaText,
    // The catalog already interpolated every quota via getFeatureQuota().
    // We pass the resolved strings through verbatim — no re-derivation here.
    features: entry.features,
  };
}

export const PRICING_TIERS: PricingTier[] = PLAN_ORDER.map(buildPricingTier);

// ─── COMPARISON_DATA — derived from FEATURE_LIMITS ──────────────────────────
//
// Each row reads its three plan values straight from the entitlement config.
// A boolean feature (e.g. Brand Kit) renders as true/false. A quota feature
// (e.g. Email templates) renders as the formatted number, "Unlimited" for
// Infinity, or "—" (em dash) when access=false on every paid plan we want to
// surface. We never hardcode "1,000,000" or any other made-up value.

function quotaCell(featureKey: FeatureKey, plan: PlanKey): string {
  const quota = getFeatureQuota(featureKey, plan);
  // If access is false on this plan, "—" reads cleaner than "0" on the
  // comparison table. (Quota 0 + access true would be a degenerate config.)
  if (quota === 0) return "—";
  return formatQuota(quota);
}

function accessCell(featureKey: FeatureKey, plan: PlanKey): boolean {
  return FEATURE_LIMITS[featureKey][plan].access;
}

function comparisonRow(
  feature: string,
  tooltip: string,
  featureKey: FeatureKey,
  opts: { mode: "quota" | "access" } = { mode: "quota" },
): ComparisonRow {
  if (opts.mode === "access") {
    return {
      feature,
      tooltip,
      featureKey,
      free: accessCell(featureKey, "FREE"),
      pro: accessCell(featureKey, "PRO"),
      max: accessCell(featureKey, "MAX"),
    };
  }
  return {
    feature,
    tooltip,
    featureKey,
    free: quotaCell(featureKey, "FREE"),
    pro: quotaCell(featureKey, "PRO"),
    max: quotaCell(featureKey, "MAX"),
  };
}

export const COMPARISON_DATA: ComparisonRow[] = [
  comparisonRow(
    "Email templates",
    "Saved custom email themes per workspace. Quotas shown in the table are derived from entitlement configuration.",
    FEATURE_KEYS.EMAIL_TEMPLATES,
  ),
  comparisonRow(
    "API messages / month",
    "All authenticated v1 API requests (OTP send/verify/resend, messaging, broadcast, events). Independent from OTP email sends. Quotas derived from entitlement configuration.",
    FEATURE_KEYS.API_MESSAGES,
  ),
  comparisonRow(
    "OTP emails / month",
    "Actual OTP email sends via the verification pipeline. Independent from API messages and messaging. Quotas derived from entitlement configuration.",
    FEATURE_KEYS.OTP_EMAILS,
  ),
  comparisonRow(
    "Messaging emails / month",
    "Transactional / lifecycle email sends via the messaging API. Independent from OTP and Broadcast. Quotas derived from entitlement configuration.",
    FEATURE_KEYS.MESSAGING_EMAILS,
  ),
  comparisonRow(
    "Broadcast emails / month",
    "Marketing campaign sends. Independent from messaging. PRO plan does not include broadcast. Quotas derived from entitlement configuration.",
    FEATURE_KEYS.BROADCAST_EMAILS,
  ),
  comparisonRow(
    "Webhook endpoints",
    "Registered URLs that receive HTTP callbacks on events.",
    FEATURE_KEYS.WEBHOOK_ENDPOINTS,
  ),
  comparisonRow(
    "API keys",
    "Active API keys with fine-grained scopes.",
    FEATURE_KEYS.API_KEYS,
  ),
  comparisonRow(
    "Brand Kit",
    "Save your brand assets once and reuse across templates.",
    FEATURE_KEYS.BRAND_KIT,
    { mode: "access" },
  ),
  comparisonRow(
    "Theme builder",
    "Customize email templates with your colors, logo, and copy.",
    FEATURE_KEYS.BRANDING_VISUAL,
    { mode: "access" },
  ),
  comparisonRow(
    "Multi-language",
    "Multi-language OTP email rendering. English and Persian currently supported.",
    FEATURE_KEYS.MULTI_LANGUAGE,
    { mode: "access" },
  ),
  comparisonRow(
    "Contacts",
    "Manage subscribers and their consent state.",
    FEATURE_KEYS.CONTACTS,
    { mode: "access" },
  ),
  comparisonRow(
    "Events API",
    "POST /api/v1/events for programmatic event ingestion.",
    FEATURE_KEYS.EVENTS_API,
    { mode: "access" },
  ),
];

// ─── FAQS — locale-aware via translation dictionaries ────────────────────────
//
// The FAQ presentation copy (q/a pairs) lives in the i18n dictionaries at
// `pricing.faq.items.N.{q,a}` — see `src/i18n/en.ts` and `src/i18n/fa.ts`.
// The FAQS array below is locale-agnostic: it carries only translation-key
// prefixes so the rendered FAQ component can look up the right copy for the
// active locale via `useTranslations()`.
//
// The FAQ text has been curated to remove Stripe / money-back / NET-30 /
// one-click cancellation / proration claims. When a billing provider is
// integrated, these can be revised.
//
// The quota FAQ entry uses prose ("a clear error message") instead of the
// internal machine identifier `quota_exhausted` — public error wording
// belongs in product copy, not in FAQ answers.

export const FAQS: FAQItem[] = [
  { key: "pricing.faq.items.0" },
  { key: "pricing.faq.items.1" },
  { key: "pricing.faq.items.2" },
  { key: "pricing.faq.items.3" },
  { key: "pricing.faq.items.4" },
];

// ─── ROI Calculator constants ────────────────────────────────────────────────
// Used by src/app/pricing/components/ROIWidget.tsx. Numbers are illustrative
// averages — actual costs vary by team. The widget's job is to show order-of-
// magnitude savings, not precise quotes. These constants are NOT commercial
// prices — they are rough comparison anchors for the ROI widget.
//
/**
 * ROI comparison constants — DERIVED from the canonical plan catalog.
 *
 * The Nixify Pro monthly price used by the ROI widget is read directly from
 * `PLAN_CATALOG.PRO.pricing.displayPriceMonthly`. There is NO independent
 * duplicate of the Pro price in this file. If the catalog price changes,
 * the ROI widget automatically reflects the new price.
 *
 * The widget previously displayed invented per-OTP cost comparisons
 * ($0.02 in-house vs $0.002 Nixify Pro). Those numbers were not backed by
 * measured data and have been removed. The widget now uses the real Pro
 * annual price from the catalog only.
 */

export const ROI_CONSTANTS = {
  /** Pro monthly price — derived from the canonical plan catalog. */
  get proMonthlyBase(): number {
    return PLAN_CATALOG.PRO.pricing.displayPriceMonthly;
  },
  /** Pro annual total — derived from the canonical plan catalog. */
  get proAnnualTotal(): number {
    return PLAN_CATALOG.PRO.pricing.displayPriceYearlyPerMonth * 12;
  },
} as const;
