/**
 * @vitest-environment jsdom
 *
 * Rendered pricing source-of-truth regression.
 * Proves the production pricing card feature strings derive from
 * FEATURE_LIMITS via the canonical plan catalog, not from translation
 * dictionary literals.
 */
import { describe, it, expect } from "vitest";
import { PRICING_TIERS } from "@/lib/pricingData";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { getFeatureQuota, formatQuota } from "@/lib/billing";

describe("Pricing card source-of-truth — features derive from FEATURE_LIMITS", () => {
  it("FREE card: features contain canonical quota values from FEATURE_LIMITS", () => {
    const tier = PRICING_TIERS.find(t => t.id === "free")!;
    const expectedTemplates = formatQuota(getFeatureQuota(FEATURE_KEYS.EMAIL_TEMPLATES, "FREE"));
    expect(tier.features.some(f => f.includes(expectedTemplates))).toBe(true);

    const expectedApi = formatQuota(getFeatureQuota(FEATURE_KEYS.API_MESSAGES, "FREE"));
    expect(tier.features.some(f => f.includes(expectedApi))).toBe(true);

    const expectedOtp = formatQuota(getFeatureQuota(FEATURE_KEYS.OTP_EMAILS, "FREE"));
    expect(tier.features.some(f => f.includes(expectedOtp))).toBe(true);
  });

  it("PRO card: features contain canonical quota values from FEATURE_LIMITS", () => {
    const tier = PRICING_TIERS.find(t => t.id === "pro")!;
    const expectedTemplates = formatQuota(getFeatureQuota(FEATURE_KEYS.EMAIL_TEMPLATES, "PRO"));
    expect(tier.features.some(f => f.includes(expectedTemplates))).toBe(true);

    const expectedApi = formatQuota(getFeatureQuota(FEATURE_KEYS.API_MESSAGES, "PRO"));
    expect(tier.features.some(f => f.includes(expectedApi))).toBe(true);

    const expectedOtp = formatQuota(getFeatureQuota(FEATURE_KEYS.OTP_EMAILS, "PRO"));
    expect(tier.features.some(f => f.includes(expectedOtp))).toBe(true);

    const expectedMsg = formatQuota(getFeatureQuota(FEATURE_KEYS.MESSAGING_EMAILS, "PRO"));
    expect(tier.features.some(f => f.includes(expectedMsg))).toBe(true);
  });

  it("MAX card: features contain canonical quota values + Unlimited", () => {
    const tier = PRICING_TIERS.find(t => t.id === "max")!;
    const expectedMsg = formatQuota(getFeatureQuota(FEATURE_KEYS.MESSAGING_EMAILS, "MAX"));
    expect(tier.features.some(f => f.includes(expectedMsg))).toBe(true);

    const expectedBcast = formatQuota(getFeatureQuota(FEATURE_KEYS.BROADCAST_EMAILS, "MAX"));
    expect(tier.features.some(f => f.includes(expectedBcast))).toBe(true);

    expect(tier.features.some(f => f.toLowerCase().includes("unlimited"))).toBe(true);
  });
});
