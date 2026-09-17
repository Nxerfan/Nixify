/**
 * @vitest-environment jsdom
 *
 * Rendered pricing source-of-truth regression.
 * Renders the REAL PricingCards component under BOTH locale="en" and
 * locale="fa" and asserts the actual visible feature output derives
 * from FEATURE_LIMITS via the canonical plan catalog.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import React from "react";
import { PricingCards } from "@/app/pricing/components/PricingCards";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { PRICING_TIERS } from "@/lib/pricingData";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { getFeatureQuota, formatQuota } from "@/lib/billing";

// Mock framer-motion to avoid animation issues in jsdom
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => React.createElement("div", props, children),
    li: ({ children, ...props }: any) => React.createElement("li", props, children),
    span: ({ children, ...props }: any) => React.createElement("span", props, children),
  },
  useSpring: (initial: number) => ({ set: () => {}, on: () => () => {}, get: () => initial }),
  useTransform: (_spring: any, fn: (v: number) => string) => fn(0),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: any) => React.createElement("a", props, children),
}));

afterEach(() => cleanup());

function renderPricingCards(locale: "en" | "fa") {
  return render(
    <LocaleProvider locale={locale}>
      <PricingCards tiers={PRICING_TIERS} billing="monthly" loading={false} />
    </LocaleProvider>
  );
}

describe("Rendered PricingCards — en locale", () => {
  it("FREE card renders canonical quota values from FEATURE_LIMITS", () => {
    renderPricingCards("en");

    // FREE EMAIL_TEMPLATES = 2
    const expectedTemplates = formatQuota(getFeatureQuota(FEATURE_KEYS.EMAIL_TEMPLATES, "FREE"));
    const features = document.body.textContent ?? "";
    expect(features).toContain(expectedTemplates);

    // FREE API_MESSAGES = 1,000
    const expectedApi = formatQuota(getFeatureQuota(FEATURE_KEYS.API_MESSAGES, "FREE"));
    expect(features).toContain(expectedApi);

    // FREE OTP_EMAILS = 100
    const expectedOtp = formatQuota(getFeatureQuota(FEATURE_KEYS.OTP_EMAILS, "FREE"));
    expect(features).toContain(expectedOtp);
  });

  it("PRO card renders canonical quota values from FEATURE_LIMITS", () => {
    renderPricingCards("en");

    const features = document.body.textContent ?? "";

    // PRO EMAIL_TEMPLATES = 20
    expect(features).toContain(formatQuota(getFeatureQuota(FEATURE_KEYS.EMAIL_TEMPLATES, "PRO")));
    // PRO API_MESSAGES = 50,000
    expect(features).toContain(formatQuota(getFeatureQuota(FEATURE_KEYS.API_MESSAGES, "PRO")));
    // PRO OTP_EMAILS = 10,000
    expect(features).toContain(formatQuota(getFeatureQuota(FEATURE_KEYS.OTP_EMAILS, "PRO")));
    // PRO MESSAGING_EMAILS = 10,000
    expect(features).toContain(formatQuota(getFeatureQuota(FEATURE_KEYS.MESSAGING_EMAILS, "PRO")));
  });

  it("MAX card renders canonical quota values + Unlimited", () => {
    renderPricingCards("en");

    const features = document.body.textContent ?? "";

    // MAX MESSAGING_EMAILS = 100,000
    expect(features).toContain(formatQuota(getFeatureQuota(FEATURE_KEYS.MESSAGING_EMAILS, "MAX")));
    // MAX BROADCAST_EMAILS = 50,000
    expect(features).toContain(formatQuota(getFeatureQuota(FEATURE_KEYS.BROADCAST_EMAILS, "MAX")));
    // MAX has "Unlimited" for templates, API messages, OTP emails
    expect(features.toLowerCase()).toContain("unlimited");
  });

  it("en renders English feature prose (e.g. 'email templates')", () => {
    renderPricingCards("en");
    const features = document.body.textContent ?? "";
    expect(features.toLowerCase()).toContain("email templates");
    expect(features.toLowerCase()).toContain("api messages");
  });
});

describe("Rendered PricingCards — fa locale", () => {
  it("fa renders Persian feature prose (e.g. 'قالب ایمیل')", () => {
    renderPricingCards("fa");
    const features = document.body.textContent ?? "";
    expect(features).toContain("قالب ایمیل");
    expect(features).toContain("پیام API");
  });

  it("fa still renders canonical quota values from FEATURE_LIMITS", () => {
    renderPricingCards("fa");
    const features = document.body.textContent ?? "";

    // The numbers should still appear (formatQuota uses ASCII digits by default)
    // FREE EMAIL_TEMPLATES = 2
    expect(features).toContain(formatQuota(getFeatureQuota(FEATURE_KEYS.EMAIL_TEMPLATES, "FREE")));
    // FREE API_MESSAGES = 1,000
    expect(features).toContain(formatQuota(getFeatureQuota(FEATURE_KEYS.API_MESSAGES, "FREE")));
  });

  it("fa does NOT render English feature prose", () => {
    renderPricingCards("fa");
    const features = document.body.textContent ?? "";
    // English feature suffixes should NOT appear
    expect(features.toLowerCase()).not.toContain("email templates");
    expect(features.toLowerCase()).not.toContain("api messages / month");
  });
});

// ─── MAX Infinity source-of-truth: per-feature rendered regressions ─────

describe("MAX card — Infinity detected from canonical quota (not static keys)", () => {
  it("MAX EMAIL_TEMPLATES is a quota descriptor (not staticFeature)", () => {
    const tier = PRICING_TIERS.find(t => t.id === "max")!;
    const f = tier.features.find(f => f.featureKey === FEATURE_KEYS.EMAIL_TEMPLATES);
    expect(f).toBeDefined();
    expect(f!.plan).toBe("MAX");
    expect(f!.featureKey).not.toBeNull();
  });

  it("MAX API_MESSAGES is a quota descriptor (not staticFeature)", () => {
    const tier = PRICING_TIERS.find(t => t.id === "max")!;
    const f = tier.features.find(f => f.featureKey === FEATURE_KEYS.API_MESSAGES);
    expect(f).toBeDefined();
    expect(f!.plan).toBe("MAX");
    expect(f!.featureKey).not.toBeNull();
  });

  it("MAX OTP_EMAILS is a quota descriptor (not staticFeature)", () => {
    const tier = PRICING_TIERS.find(t => t.id === "max")!;
    const f = tier.features.find(f => f.featureKey === FEATURE_KEYS.OTP_EMAILS);
    expect(f).toBeDefined();
    expect(f!.plan).toBe("MAX");
    expect(f!.featureKey).not.toBeNull();
  });

  it("MAX MESSAGING_EMAILS is a quota descriptor with finite value", () => {
    const tier = PRICING_TIERS.find(t => t.id === "max")!;
    const f = tier.features.find(f => f.featureKey === FEATURE_KEYS.MESSAGING_EMAILS);
    expect(f).toBeDefined();
    expect(f!.plan).toBe("MAX");
  });

  it("MAX BROADCAST_EMAILS is a quota descriptor with finite value", () => {
    const tier = PRICING_TIERS.find(t => t.id === "max")!;
    const f = tier.features.find(f => f.featureKey === FEATURE_KEYS.BROADCAST_EMAILS);
    expect(f).toBeDefined();
    expect(f!.plan).toBe("MAX");
  });

  it("en: MAX card renders 'Unlimited' for EMAIL_TEMPLATES (from Infinity)", () => {
    renderPricingCards("en");
    const text = document.body.textContent ?? "";
    expect(text).toContain("Unlimited");
  });

  it("fa: MAX card renders Persian 'نامحدود' for unlimited features", () => {
    renderPricingCards("fa");
    const text = document.body.textContent ?? "";
    expect(text).toContain("نامحدود");
  });

  it("en: MAX card renders canonical 100,000 for MESSAGING_EMAILS", () => {
    renderPricingCards("en");
    const text = document.body.textContent ?? "";
    expect(text).toContain(formatQuota(getFeatureQuota(FEATURE_KEYS.MESSAGING_EMAILS, "MAX")));
  });

  it("en: MAX card renders canonical 50,000 for BROADCAST_EMAILS", () => {
    renderPricingCards("en");
    const text = document.body.textContent ?? "";
    expect(text).toContain(formatQuota(getFeatureQuota(FEATURE_KEYS.BROADCAST_EMAILS, "MAX")));
  });

  it("structural: no staticFeature with unlimitedX labelKey exists in MAX", () => {
    const tier = PRICING_TIERS.find(t => t.id === "max")!;
    const staticUnlimiteds = tier.features.filter(
      f => f.featureKey === null && f.labelKey.includes("unlimited")
    );
    expect(staticUnlimiteds.length).toBe(0);
  });
});

// ─── Feature-specific MAX unlimited rendered regressions ─────────────

describe("MAX card — per-feature unlimited rendering (en + fa)", () => {
  it("en: renders 'Unlimited email templates' for EMAIL_TEMPLATES", () => {
    renderPricingCards("en");
    const text = document.body.textContent ?? "";
    expect(text).toContain("Unlimited email templates");
  });

  it("en: renders 'Unlimited API messages / month' for API_MESSAGES", () => {
    renderPricingCards("en");
    const text = document.body.textContent ?? "";
    expect(text).toContain("Unlimited API messages / month");
  });

  it("en: renders 'Unlimited OTP emails / month' for OTP_EMAILS", () => {
    renderPricingCards("en");
    const text = document.body.textContent ?? "";
    expect(text).toContain("Unlimited OTP emails / month");
  });

  it("fa: renders 'نامحدود قالب ایمیل' for EMAIL_TEMPLATES", () => {
    renderPricingCards("fa");
    const text = document.body.textContent ?? "";
    expect(text).toContain("نامحدود قالب ایمیل");
  });

  it("fa: renders 'نامحدود پیام API / ماه' for API_MESSAGES", () => {
    renderPricingCards("fa");
    const text = document.body.textContent ?? "";
    expect(text).toContain("نامحدود پیام API / ماه");
  });

  it("fa: renders 'نامحدود ایمیل OTP / ماه' for OTP_EMAILS", () => {
    renderPricingCards("fa");
    const text = document.body.textContent ?? "";
    expect(text).toContain("نامحدود ایمیل OTP / ماه");
  });

  it("each MAX unlimited feature has Infinity in FEATURE_LIMITS", () => {
    expect(getFeatureQuota(FEATURE_KEYS.EMAIL_TEMPLATES, "MAX")).toBe(Infinity);
    expect(getFeatureQuota(FEATURE_KEYS.API_MESSAGES, "MAX")).toBe(Infinity);
    expect(getFeatureQuota(FEATURE_KEYS.OTP_EMAILS, "MAX")).toBe(Infinity);
  });
});
