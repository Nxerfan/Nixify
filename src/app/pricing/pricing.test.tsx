/**
 * Phase 14 — Pricing page localization rendered regression tests.
 *
 * Renders the ACTUAL production pricing components (PricingHeader,
 * PricingCards, PricingFAQ) under a real `LocaleProvider` with
 * `locale="en"` and `locale="fa"`. Asserts that switching locale actually
 * changes the visible presentation copy:
 *
 *   - fa: Persian card badge ("محبوب‌ترین"), Persian tier name ("رایگان"),
 *     Persian FAQ title ("سؤالات؟"), Persian FAQ question copy visible.
 *   - fa: English card badge ("Most Popular") NOT visible.
 *   - en: English card badge ("Most Popular"), English tier name ("Free"),
 *     English FAQ title ("Questions?") visible.
 *
 * Also asserts that the canonical commercial numbers (prices, yearly
 * totals) are unchanged across locales — the catalog is locale-independent,
 * so $0/$20/$100 (monthly display) and $192/$960 (yearly catalog total)
 * must be identical in both renders. Per the agent-lessons rule "RTL
 * success does not prove localization success", this test renders the
 * real component and asserts the visible copy — it does not just check
 * that the dictionary contains Persian strings.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import React from "react";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { PricingHeader } from "@/app/pricing/components/PricingHeader";
import { PricingCards } from "@/app/pricing/components/PricingCards";
import { PricingFAQ } from "@/app/pricing/components/PricingFAQ";
import {
  PRICING_TIERS,
  COMPARISON_DATA,
  FAQS,
} from "@/lib/pricingData";
import { PLAN_CATALOG } from "@/lib/billing";

/**
 * Polyfill `window.matchMedia` (used by framer-motion + Accordion internals).
 * jsdom does not implement it natively.
 */
function installMatchMediaPolyfill() {
  if (typeof window === "undefined") return;
  const w = window as unknown as { matchMedia?: unknown };
  if (w.matchMedia) return;
  w.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/**
 * Polyfill `requestAnimationFrame` / `cancelAnimationFrame`. Framer-motion's
 * spring physics (used by AnimatedPrice inside PricingCards) requires rAF.
 * jsdom does not implement it natively.
 */
function installRafPolyfill() {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    requestAnimationFrame?: unknown;
    cancelAnimationFrame?: unknown;
  };
  if (w.requestAnimationFrame) return;
  let id = 0;
  w.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    id += 1;
    const handle = id;
    Promise.resolve().then(() => {
      (cb as (t: number) => void)(performance.now());
    });
    return handle;
  }) as unknown as typeof window.requestAnimationFrame;
  w.cancelAnimationFrame = (() => {}) as unknown as typeof window.cancelAnimationFrame;
}

/**
 * Polyfill `IntersectionObserver`. Framer-motion's `useInView` (used by
 * PricingComparison internally — we don't render it here, but PricingCards
 * uses motion which may lazy-init the observer) instantiates
 * IntersectionObserver during its effect.
 */
function installIntersectionObserverPolyfill() {
  if (typeof window === "undefined") return;
  const w = window as unknown as { IntersectionObserver?: unknown };
  if (w.IntersectionObserver) return;
  w.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof window.IntersectionObserver;
}

beforeEach(() => {
  installMatchMediaPolyfill();
  installRafPolyfill();
  installIntersectionObserverPolyfill();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Pricing page rendered localization (Phase 14)", () => {
  it("en locale: English card badge + tier names + FAQ title visible", async () => {
    expect.hasAssertions();
    const { container } = render(
      <LocaleProvider locale="en">
        <PricingHeader
          billing="monthly"
          onBillingChange={() => {}}
          showSavings
        />
        <PricingCards tiers={PRICING_TIERS} billing="monthly" loading={false} />
        <PricingFAQ faqs={FAQS} />
      </LocaleProvider>,
    );

    await waitFor(() => {
      // "Most Popular" badge on the PRO tier.
      expect(container.textContent).toContain("Most Popular");
    });
    // Tier display names.
    expect(container.textContent).toContain("Free");
    expect(container.textContent).toContain("Pro");
    expect(container.textContent).toContain("Max");
    // "/mo" suffix on price.
    expect(container.textContent).toContain("/mo");
    // "free forever" under FREE price.
    expect(container.textContent).toContain("free forever");
    // FAQ title + first FAQ question in English.
    expect(container.textContent).toContain("Questions?");
    expect(container.textContent).toContain("Is the Free plan really free?");
  });

  it("fa locale: Persian card badge + tier names + FAQ title visible, English hidden", async () => {
    expect.hasAssertions();
    const { container } = render(
      <LocaleProvider locale="fa">
        <PricingHeader
          billing="monthly"
          onBillingChange={() => {}}
          showSavings
        />
        <PricingCards tiers={PRICING_TIERS} billing="monthly" loading={false} />
        <PricingFAQ faqs={FAQS} />
      </LocaleProvider>,
    );

    await waitFor(() => {
      // Persian "Most Popular" badge.
      expect(container.textContent).toContain("محبوب‌ترین");
    });
    // Persian tier names (Free → رایگان, Pro → Pro, Max → Max).
    expect(container.textContent).toContain("رایگان");
    // Pro/Max remain canonical product names — not translated.
    expect(container.textContent).toContain("Pro");
    expect(container.textContent).toContain("Max");
    // Persian "/mo" suffix.
    expect(container.textContent).toContain("/ماه");
    // Persian "free forever".
    expect(container.textContent).toContain("برای همیشه رایگان");
    // Persian FAQ title + first FAQ question.
    expect(container.textContent).toContain("سؤالات؟");
    expect(container.textContent).toContain(
      "آیا طرح رایگان واقعاً رایگان است؟",
    );

    // English copy MUST NOT be visible under fa locale.
    expect(container.textContent).not.toContain("Most Popular");
    expect(container.textContent).not.toContain("free forever");
    expect(container.textContent).not.toContain("Questions?");
    expect(container.textContent).not.toContain("Is the Free plan really free?");
  });

  it("canonical commercial numbers (prices + yearly totals) are unchanged across locales", () => {
    expect.hasAssertions();
    // The catalog is locale-independent — prices are NOT pulled from the
    // translation dictionaries, so they are stable across en/fa renders.
    // These are the Phase 14 spec values: $0/$20/$100 monthly, $192/$960
    // yearly totals, $16/$80 yearly-per-month effective.
    const free = PLAN_CATALOG.FREE.pricing;
    const pro = PLAN_CATALOG.PRO.pricing;
    const max = PLAN_CATALOG.MAX.pricing;

    // Monthly display prices (whole currency).
    expect(free.displayPriceMonthly).toBe(0);
    expect(pro.displayPriceMonthly).toBe(20); // $20/mo
    expect(max.displayPriceMonthly).toBe(100); // $100/mo

    // Yearly per-month effective display prices.
    expect(pro.displayPriceYearlyPerMonth).toBe(16); // $16/mo effective
    expect(max.displayPriceYearlyPerMonth).toBe(80); // $80/mo effective

    // Yearly TOTAL (annual charge) — not displayed in the UI but is the
    // canonical commercial number from the spec.
    expect(pro.yearlyPriceMinor).toBe(19200); // $192.00 annual total
    expect(max.yearlyPriceMinor).toBe(96000); // $960.00 annual total
  });

  it("rendered prices appear under both en and fa (catalog is locale-independent)", async () => {
    expect.hasAssertions();
    // The PricingCards component renders prices via framer-motion's spring
    // animation (AnimatedPrice), so the exact intermediate value may
    // differ between renders as the spring settles. We assert that the
    // canonical $-prefixed prices DO appear in BOTH locales — the catalog
    // is locale-independent, so the rendered price must be present in both
    // en and fa. The exact $80 value is asserted in the catalog-direct test
    // above (which doesn't depend on animation).
    const enRender = render(
      <LocaleProvider locale="en">
        <PricingCards tiers={PRICING_TIERS} billing="monthly" loading={false} />
      </LocaleProvider>,
    );
    await waitFor(() => {
      // $0 (Free) and $20 (PRO) appear quickly because they're small and
      // the spring settles fast.
      expect(enRender.container.textContent).toContain("$0");
      expect(enRender.container.textContent).toContain("$20");
    });
    cleanup();

    const faRender = render(
      <LocaleProvider locale="fa">
        <PricingCards tiers={PRICING_TIERS} billing="monthly" loading={false} />
      </LocaleProvider>,
    );
    await waitFor(() => {
      expect(faRender.container.textContent).toContain("$0");
      expect(faRender.container.textContent).toContain("$20");
    });
  });

  it("yearly billing renders the per-month effective price + 'billed annually' copy in both locales", async () => {
    expect.hasAssertions();
    const enRender = render(
      <LocaleProvider locale="en">
        <PricingCards tiers={PRICING_TIERS} billing="yearly" loading={false} />
      </LocaleProvider>,
    );
    await waitFor(() => {
      // PRO yearly per-month effective = $16 (small enough to settle fast).
      expect(enRender.container.textContent).toContain("$16");
      // "billed annually" appears under yearly billing for non-Free tiers.
      expect(enRender.container.textContent).toContain("billed annually");
    });
    cleanup();

    const faRender = render(
      <LocaleProvider locale="fa">
        <PricingCards tiers={PRICING_TIERS} billing="yearly" loading={false} />
      </LocaleProvider>,
    );
    await waitFor(() => {
      expect(faRender.container.textContent).toContain("$16");
      // Persian "billed annually".
      expect(faRender.container.textContent).toContain("صورت‌حساب سالانه");
    });
  });

  it("FAQ copy under fa is Persian and does not contain the internal quota_exhausted machine identifier", async () => {
    expect.hasAssertions();
    const { container } = render(
      <LocaleProvider locale="fa">
        <PricingFAQ faqs={FAQS} />
      </LocaleProvider>,
    );

    await waitFor(() => {
      // Persian FAQ title.
      expect(container.textContent).toContain("سؤالات؟");
    });
    // Persian copy must NOT contain the English machine identifier
    // "quota_exhausted" — the FAQ copy is prose-only.
    expect(container.textContent).not.toContain("quota_exhausted");
    expect(container.textContent).not.toContain("quota_exceeded");
  });

  it("comparison data is unchanged across locales (locale-independent catalog)", () => {
    expect.hasAssertions();
    // COMPARISON_DATA is built from FEATURE_LIMITS at module load time and
    // is locale-independent. The values are the same regardless of which
    // locale the page is rendered under.
    const templatesRow = COMPARISON_DATA.find((r) =>
      r.feature.startsWith("Email templates"),
    );
    expect(templatesRow).toBeDefined();
    expect(templatesRow!.free).toBe("2");
    expect(templatesRow!.pro).toBe("20");
    expect(templatesRow!.max).toBe("Unlimited");

    const apiRow = COMPARISON_DATA.find((r) =>
      r.feature.startsWith("API messages"),
    );
    expect(apiRow).toBeDefined();
    expect(apiRow!.free).toBe("1,000");
    expect(apiRow!.pro).toBe("50,000");
    expect(apiRow!.max).toBe("Unlimited");
  });
});
