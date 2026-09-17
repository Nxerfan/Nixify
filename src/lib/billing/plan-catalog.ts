/**
 * CANONICAL PLAN CATALOG — the single source of truth for commercial plan
 * metadata (display name, description, prices, CTA copy, marketing features).
 *
 * PHILOSOPHY:
 *   The entitlement config (`src/lib/entitlements/config.ts`) is the source of
 *   truth for LIMITS (quotas, rate limits, access flags). This catalog is the
 *   source of truth for COMMERCIAL METADATA (price, display name, marketing
 *   copy). The pricing UI derives BOTH: catalog metadata + entitlement limits.
 *
 *   We DO NOT duplicate quota numbers here. The catalog calls
 *   `getFeatureQuota()` to read from the entitlement config when it needs to
 *   display a numeric limit on a pricing card or comparison table.
 *
 * NO BILLING PROVIDER:
 *   There is no Stripe, no payment SDK, no checkout integration. This catalog
 *   is a static commercial-identity surface for the marketing/pricing UI and
 *   for downstream code that needs to map a plan key to display metadata.
 *   When a real billing provider is introduced, it must conform to this
 *   catalog (price lookup, plan key mapping) — not the other way around.
 *
 * DRIFT GUARD:
 *   `src/lib/billing/billing.test.ts` asserts that the catalog prices and
 *   entitlement limits match the Phase 14 spec exactly. If a future change
 *   drifts, the test fails.
 */

import {
  FEATURE_KEYS,
  FEATURE_LIMITS,
  type FeatureKey,
  type Plan,
} from "@/lib/entitlements/config";

// ─── Plan identity ────────────────────────────────────────────────────────

/**
 * PlanKey — the canonical commercial plan identifier.
 *
 * This MUST stay 1:1 with `Plan` in `src/lib/entitlements/config.ts`. The
 * alias exists so the billing domain has its own vocabulary that does not
 * import the entire entitlements surface — but the set of values is identical
 * so they can be used interchangeably when calling the entitlement engine.
 */
export type PlanKey = Plan; // "FREE" | "PRO" | "MAX"

/**
 * BillingInterval — how often a paid plan is billed.
 *
 * The catalog stores BOTH monthly and yearly prices so the pricing UI can
 * toggle without re-deriving. There is no payment processing attached to
 * this enum today; it is presentation metadata.
 */
export type BillingInterval = "monthly" | "yearly";

// ─── Pricing types ────────────────────────────────────────────────────────

export interface PlanPricing {
  /**
   * Monthly price in minor currency units (cents).
   * Example: 2000 = $20.00/month.
   * FREE is always 0.
   */
  monthlyPriceMinor: number;
  /**
   * Annual total price in minor currency units (cents), billed once per year.
   * This is the FULL yearly charge, not the per-month breakdown.
   * Example: 19200 = $192.00/year (= $16/month effective).
   * FREE is always 0.
   */
  yearlyPriceMinor: number;
  /**
   * Display price for the monthly billing view. Whole currency units.
   * Example: 20 (rendered as "$20/mo").
   */
  displayPriceMonthly: number;
  /**
   * Effective monthly price when billed yearly. Whole currency units.
   * Example: 16 (rendered as "$16/mo billed yearly").
   * Computed as yearlyPriceMinor / 12 / 100, rounded.
   */
  displayPriceYearlyPerMonth: number;
}

export interface PricingFeature {
  featureKey: FeatureKey | null;
  plan: PlanKey | null;
  labelKey: string;
}

export interface PlanCatalogEntry {
  key: PlanKey;
  /** Human-readable name shown on the pricing card. */
  displayName: string;
  description: string;
  pricing: PlanPricing;
  /** Whether the pricing UI should mark this plan as "Most Popular". */
  isPopular: boolean;
  /** CTA button copy. */
  ctaText: string;
  /**
   * Human-readable feature list for pricing cards.
   *
   * These strings may reference numeric limits — but the limits themselves
   * are pulled from `FEATURE_LIMITS` via the helper below, NEVER hardcoded
   * in this file. The strings here are pure presentation; the canonical
   * numbers live in the entitlement config.
   *
   * For dynamic strings (e.g. "Up to 20 email templates"), use
   * `quotaFeature(...)` which creates a structured descriptor. The numeric
   * value is resolved from FEATURE_LIMITS at render time by PricingCards.
   */
  features: PricingFeature[];
}

// ─── Pricing constants (Phase 14 spec — preserved) ──────────────────────────
//
// These prices are FINAL commercial numbers. Tests in billing.test.ts assert
// they match the spec exactly. Changing them requires updating the spec AND
// the test in the same commit.
//
//   FREE: $0/month, $0/year
//   PRO:  $20/month, $192/year (= $16/month effective when billed yearly)
//   MAX:  $100/month, $960/year (= $80/month effective when billed yearly)
//
// The yearly discount is intentional. The pricing UI now uses number-free
// annual-savings copy ("Save with annual billing") rather than a hardcoded
// percentage that could drift from the catalog.

const FREE_PRICING: PlanPricing = {
  monthlyPriceMinor: 0,
  yearlyPriceMinor: 0,
  displayPriceMonthly: 0,
  displayPriceYearlyPerMonth: 0,
};

const PRO_PRICING: PlanPricing = {
  monthlyPriceMinor: 2000, // $20.00
  yearlyPriceMinor: 19200, // $192.00 (annual total — $16/mo effective)
  displayPriceMonthly: 20,
  displayPriceYearlyPerMonth: 16, // 19200 / 100 / 12 = 16
};

const MAX_PRICING: PlanPricing = {
  monthlyPriceMinor: 10000, // $100.00
  yearlyPriceMinor: 96000, // $960.00 (annual total — $80/mo effective)
  displayPriceMonthly: 100,
  displayPriceYearlyPerMonth: 80, // 96000 / 100 / 12 = 80
};

// ─── Limit-derivation helpers ──────────────────────────────────────────────
//
// The pricing card feature lines below mention specific numeric limits. These
// helpers read from FEATURE_LIMITS so the catalog NEVER duplicates a quota
// number. If the entitlement config changes, the pricing card automatically
// reflects the new value.

/**
 * Read the configured monthly quota for a feature on a plan.
 * Returns the literal number, or `Infinity` (which the caller formats as
 * "Unlimited"). Returns `0` if the feature is access-gated off on the plan.
 */
export function getFeatureQuota(featureKey: FeatureKey, plan: PlanKey): number {
  const limits = FEATURE_LIMITS[featureKey][plan];
  if (!limits.access) return 0;
  return limits.quota;
}

/**
 * Format a quota as a display string. `Infinity` → "Unlimited", `0` → "0",
 * otherwise locale-formatted with thousands separators.
 */
export function formatQuota(quota: number): string {
  if (quota === Infinity) return "Unlimited";
  return quota.toLocaleString("en-US");
}

/**
 * Build a pricing-card feature line that references a numeric entitlement
 * limit. This is the ONLY way the catalog mentions quota numbers — it
 * stores structured descriptors (PricingFeature) that PricingCards resolves
 * at render time. The catalog file itself never hardcodes a duplicate value.
 * itself never hardcodes a duplicate of a quota value.
 */
function quotaFeature(featureKey: FeatureKey, plan: PlanKey, labelKey: string): PricingFeature {
  return { featureKey, plan, labelKey };
}

function staticFeature(labelKey: string): PricingFeature {
  return { featureKey: null, plan: null, labelKey };
}

// ─── The catalog ───────────────────────────────────────────────────────────

export const PLAN_CATALOG: Record<PlanKey, PlanCatalogEntry> = {
  FREE: {
    key: "FREE",
    displayName: "Free",
    description: "For side projects and testing.",
    pricing: FREE_PRICING,
    isPopular: false,
    ctaText: "Start free",
    features: [
      // FREE EMAIL_TEMPLATES = 2 (entitlement config). NOT 1.
      quotaFeature(FEATURE_KEYS.EMAIL_TEMPLATES, "FREE", "pricing.features.emailTemplates"),
      // FREE API_MESSAGES = 1000 — all authenticated v1 API requests.
      quotaFeature(FEATURE_KEYS.API_MESSAGES, "FREE", "pricing.features.apiMessages"),
      // FREE OTP_EMAILS = 100 — the actual OTP email sends.
      quotaFeature(FEATURE_KEYS.OTP_EMAILS, "FREE", "pricing.features.otpEmails"),
      staticFeature("pricing.features.sandboxMode"),
      staticFeature("pricing.features.communitySupport"),
    ],
  },

  PRO: {
    key: "PRO",
    displayName: "Pro",
    description: "For growing apps that need real verification.",
    pricing: PRO_PRICING,
    isPopular: true,
    ctaText: "Get Started",
    features: [
      // PRO EMAIL_TEMPLATES = 20.
      quotaFeature(FEATURE_KEYS.EMAIL_TEMPLATES, "PRO", "pricing.features.emailTemplates"),
      // PRO API_MESSAGES = 50,000.
      quotaFeature(FEATURE_KEYS.API_MESSAGES, "PRO", "pricing.features.apiMessages"),
      // PRO OTP_EMAILS = 10,000.
      quotaFeature(FEATURE_KEYS.OTP_EMAILS, "PRO", "pricing.features.otpEmails"),
      // PRO MESSAGING_EMAILS = 10,000 — separate quota from OTP_EMAILS.
      quotaFeature(FEATURE_KEYS.MESSAGING_EMAILS, "PRO", "pricing.features.messagingEmails"),
      staticFeature("pricing.features.brandKit"),
      staticFeature("pricing.features.themeBuilder"),
      staticFeature("pricing.features.webhooksApiKeys"),
      staticFeature("pricing.features.prioritySupport"),
    ],
  },

  MAX: {
    key: "MAX",
    displayName: "Max",
    description: "For high-volume platforms that need every quota unlocked.",
    pricing: MAX_PRICING,
    isPopular: false,
    ctaText: "Get started",
    features: [
      // MAX EMAIL_TEMPLATES = Infinity.
      quotaFeature(FEATURE_KEYS.EMAIL_TEMPLATES, "MAX", "pricing.features.emailTemplates"),
      // MAX API_MESSAGES = Infinity.
      quotaFeature(FEATURE_KEYS.API_MESSAGES, "MAX", "pricing.features.apiMessages"),
      // MAX OTP_EMAILS = Infinity — NOT "1,000,000".
      quotaFeature(FEATURE_KEYS.OTP_EMAILS, "MAX", "pricing.features.otpEmails"),
      // MAX MESSAGING_EMAILS = 100,000.
      quotaFeature(FEATURE_KEYS.MESSAGING_EMAILS, "MAX", "pricing.features.messagingEmails"),
      // MAX BROADCAST_EMAILS = 50,000. (PRO = 0 — broadcast is MAX-only.)
      quotaFeature(FEATURE_KEYS.BROADCAST_EMAILS, "MAX", "pricing.features.broadcastEmails"),
      staticFeature("pricing.features.brandKit"),
      staticFeature("pricing.features.themeBuilder"),
      staticFeature("pricing.features.webhooksApiKeys"),
      staticFeature("pricing.features.prioritySupport"),
    ],
  },
};

/**
 * Ordered list of plans for the pricing UI. Order = display order.
 */
export const PLAN_ORDER: PlanKey[] = ["FREE", "PRO", "MAX"];

/**
 * Lookup helper. Returns the catalog entry for a plan key, or throws if the
 * key is invalid (catalog is exhaustive — a missing key is a programming
 * error, not a runtime fallback).
 */
export function getPlanCatalogEntry(key: PlanKey): PlanCatalogEntry {
  const entry = PLAN_CATALOG[key];
  if (!entry) {
    throw new Error(`Unknown plan key: ${key}`);
  }
  return entry;
}

/**
 * Resolve the price (in minor units) for a plan + billing interval.
 * Used by the pricing UI's monthly/yearly toggle.
 */
export function getPriceMinor(
  key: PlanKey,
  interval: BillingInterval,
): number {
  const entry = getPlanCatalogEntry(key);
  return interval === "monthly"
    ? entry.pricing.monthlyPriceMinor
    : entry.pricing.yearlyPriceMinor;
}
