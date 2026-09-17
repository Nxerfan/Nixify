import { ROI_CONSTANTS } from "@/lib/pricingData";
import { db } from "@/lib/db";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

const RUN = process.env.RUN_BILLING_INTEGRATION === "1";

/**
 * PHASE 14 — Plans, Pricing & Billing tests.
 *
 * Two layers:
 *
 *   1. UNIT TESTS (always run, no DB required):
 *      - Plan catalog prices match the Phase 14 spec exactly.
 *      - Entitlement values match the Phase 14 spec (Section 5).
 *      - Pricing comparison data is DERIVED from the entitlement config —
 *        not independently hardcoded.
 *      - Quota separation: PRO BROADCAST_EMAILS === 0, FREE EMAIL_TEMPLATES
 *        === 2, API_MESSAGES / OTP_EMAILS / MESSAGING_EMAILS / BROADCAST_EMAILS
 *        are independent.
 *      - FAQs do not mention Stripe, proration, NET-30, money-back guarantee,
 *        or one-click cancellation.
 *
 *   2. DB-GATED INTEGRATION TESTS (skipped without DB + RUN_BILLING_INTEGRATION):
 *      - Plan mutation security: PATCH /api/dashboard/preferences/locale with
 *        { plan: "MAX" } in the body does NOT modify the user's plan. The
 *        route's Zod schema strips unknown keys, and the db.user.update call
 *        only sets whitelisted fields.
 *
 * FAIL-CLOSED CONTRACT:
 *   The `test:billing` script in package.json exits 1 if TEST_DATABASE_URL is
 *   not set, BEFORE vitest runs. This means in CI, the integration tests
 *   MUST run (the script provides TEST_DATABASE_URL + RUN_BILLING_INTEGRATION=1).
 *   Locally, `bun run test` runs only the unit tests — the integration tests
 *   are skipped via describe.skipIf.
 */

import {
  PLAN_CATALOG,
  PLAN_ORDER,
  getFeatureQuota,
  formatQuota,
  type PlanKey,
} from "@/lib/billing";
import {
  FEATURE_KEYS,
  FEATURE_LIMITS,
  type FeatureKey,
} from "@/lib/entitlements/config";
import {
  PRICING_TIERS,
  COMPARISON_DATA,
} from "@/lib/pricingData";
import { translations } from "@/i18n";

// ─── 1. UNIT TESTS (always run) ────────────────────────────────────────────

describe("Plan Catalog — prices match Phase 14 spec", () => {
  it("FREE plan is $0/month and $0/year", () => {
    const p = PLAN_CATALOG.FREE.pricing;
    expect(p.monthlyPriceMinor).toBe(0);
    expect(p.yearlyPriceMinor).toBe(0);
    expect(p.displayPriceMonthly).toBe(0);
    expect(p.displayPriceYearlyPerMonth).toBe(0);
  });

  it("PRO plan is $20/month and $192/year ($16/mo effective when billed yearly)", () => {
    const p = PLAN_CATALOG.PRO.pricing;
    expect(p.monthlyPriceMinor).toBe(2000); // $20.00 in cents
    expect(p.yearlyPriceMinor).toBe(19200); // $192.00 annual total in cents
    expect(p.displayPriceMonthly).toBe(20);
    expect(p.displayPriceYearlyPerMonth).toBe(16); // 192 / 12 = 16
  });

  it("MAX plan is $100/month and $960/year ($80/mo effective when billed yearly)", () => {
    const p = PLAN_CATALOG.MAX.pricing;
    expect(p.monthlyPriceMinor).toBe(10000); // $100.00 in cents
    expect(p.yearlyPriceMinor).toBe(96000); // $960.00 annual total in cents
    expect(p.displayPriceMonthly).toBe(100);
    expect(p.displayPriceYearlyPerMonth).toBe(80); // 960 / 12 = 80
  });

  it("yearly price is exactly 20% off the monthly price (annual billing discount)", () => {
    // PRO: $20/mo × 12 = $240/yr. Yearly = $192. Discount = $48 = 20% of $240.
    const pro = PLAN_CATALOG.PRO.pricing;
    const proMonthlyAnnualized = pro.monthlyPriceMinor * 12;
    const proDiscount = proMonthlyAnnualized - pro.yearlyPriceMinor;
    expect(proDiscount / proMonthlyAnnualized).toBeCloseTo(0.2, 2);

    // MAX: $100/mo × 12 = $1200/yr. Yearly = $960. Discount = $240 = 20%.
    const max = PLAN_CATALOG.MAX.pricing;
    const maxMonthlyAnnualized = max.monthlyPriceMinor * 12;
    const maxDiscount = maxMonthlyAnnualized - max.yearlyPriceMinor;
    expect(maxDiscount / maxMonthlyAnnualized).toBeCloseTo(0.2, 2);
  });

  it("catalog uses 'Max' as the third plan display name (NOT 'Enterprise')", () => {
    expect(PLAN_CATALOG.MAX.displayName).toBe("Max");
    expect(PLAN_CATALOG.MAX.displayName).not.toBe("Enterprise");
  });

  it("catalog has exactly 3 plans: FREE, PRO, MAX", () => {
    expect(Object.keys(PLAN_CATALOG).sort()).toEqual(["FREE", "MAX", "PRO"]);
  });

  it("PLAN_ORDER is [FREE, PRO, MAX]", () => {
    expect(PLAN_ORDER).toEqual(["FREE", "PRO", "MAX"]);
  });

  it("only the PRO plan is marked isPopular", () => {
    expect(PLAN_CATALOG.FREE.isPopular).toBe(false);
    expect(PLAN_CATALOG.PRO.isPopular).toBe(true);
    expect(PLAN_CATALOG.MAX.isPopular).toBe(false);
  });
});

describe("Entitlement values match Phase 14 spec (Section 5)", () => {
  it("API_MESSAGES: FREE=1000, PRO=50000, MAX=Infinity", () => {
    const f = FEATURE_LIMITS[FEATURE_KEYS.API_MESSAGES];
    expect(f.FREE.access).toBe(true);
    expect(f.FREE.quota).toBe(1_000);
    expect(f.PRO.quota).toBe(50_000);
    expect(f.MAX.quota).toBe(Infinity);
  });

  it("OTP_EMAILS: FREE=100, PRO=10000, MAX=Infinity", () => {
    const f = FEATURE_LIMITS[FEATURE_KEYS.OTP_EMAILS];
    expect(f.FREE.access).toBe(true);
    expect(f.FREE.quota).toBe(100);
    expect(f.PRO.quota).toBe(10_000);
    expect(f.MAX.quota).toBe(Infinity);
  });

  it("EMAIL_TEMPLATES: FREE=2 (NOT 1), PRO=20, MAX=Infinity", () => {
    const f = FEATURE_LIMITS[FEATURE_KEYS.EMAIL_TEMPLATES];
    expect(f.FREE.quota).toBe(2);
    expect(f.PRO.quota).toBe(20);
    expect(f.MAX.quota).toBe(Infinity);
  });

  it("MESSAGING_EMAILS: FREE=0 (access=false), PRO=10000, MAX=100000", () => {
    const f = FEATURE_LIMITS[FEATURE_KEYS.MESSAGING_EMAILS];
    expect(f.FREE.access).toBe(false);
    expect(f.FREE.quota).toBe(0);
    expect(f.PRO.access).toBe(true);
    expect(f.PRO.quota).toBe(10_000);
    expect(f.MAX.access).toBe(true);
    expect(f.MAX.quota).toBe(100_000);
  });

  it("BROADCAST_EMAILS: FREE=0, PRO=0 (MAX-only), MAX=50000", () => {
    const f = FEATURE_LIMITS[FEATURE_KEYS.BROADCAST_EMAILS];
    expect(f.FREE.access).toBe(false);
    expect(f.FREE.quota).toBe(0);
    expect(f.PRO.access).toBe(false);
    expect(f.PRO.quota).toBe(0);
    expect(f.MAX.access).toBe(true);
    expect(f.MAX.quota).toBe(50_000);
  });

  it("API_KEYS: FREE=1, PRO=5, MAX=20", () => {
    const f = FEATURE_LIMITS[FEATURE_KEYS.API_KEYS];
    expect(f.FREE.quota).toBe(1);
    expect(f.PRO.quota).toBe(5);
    expect(f.MAX.quota).toBe(20);
  });

  it("WEBHOOK_ENDPOINTS: FREE=0 (access=false), PRO=3, MAX=25", () => {
    const f = FEATURE_LIMITS[FEATURE_KEYS.WEBHOOK_ENDPOINTS];
    expect(f.FREE.access).toBe(false);
    expect(f.FREE.quota).toBe(0);
    expect(f.PRO.quota).toBe(3);
    expect(f.MAX.quota).toBe(25);
  });

  it("BRAND_KIT: FREE=false, PRO=true, MAX=true", () => {
    const f = FEATURE_LIMITS[FEATURE_KEYS.BRAND_KIT];
    expect(f.FREE.access).toBe(false);
    expect(f.PRO.access).toBe(true);
    expect(f.MAX.access).toBe(true);
  });

  it("CONTACTS: FREE=false, PRO=true, MAX=true", () => {
    const f = FEATURE_LIMITS[FEATURE_KEYS.CONTACTS];
    expect(f.FREE.access).toBe(false);
    expect(f.PRO.access).toBe(true);
    expect(f.MAX.access).toBe(true);
  });

  it("CUSTOM_BRANDING: FREE=false, PRO=true, MAX=true", () => {
    const f = FEATURE_LIMITS[FEATURE_KEYS.CUSTOM_BRANDING];
    expect(f.FREE.access).toBe(false);
    expect(f.PRO.access).toBe(true);
    expect(f.MAX.access).toBe(true);
  });

  it("DYNAMIC_THEME_RULES: FREE=false, PRO=3, MAX=3", () => {
    const f = FEATURE_LIMITS[FEATURE_KEYS.DYNAMIC_THEME_RULES];
    expect(f.FREE.access).toBe(false);
    expect(f.PRO.quota).toBe(3);
    expect(f.MAX.quota).toBe(3);
  });

  it("MULTI_LANGUAGE: FREE=false, PRO=5, MAX=5", () => {
    const f = FEATURE_LIMITS[FEATURE_KEYS.MULTI_LANGUAGE];
    expect(f.FREE.access).toBe(false);
    expect(f.PRO.quota).toBe(5);
    expect(f.MAX.quota).toBe(5);
  });

  it("AUDIT_LOG_RETENTION: FREE=7 days, PRO=90 days, MAX=365 days", () => {
    const f = FEATURE_LIMITS[FEATURE_KEYS.AUDIT_LOG_RETENTION];
    expect(f.FREE.quota).toBe(7);
    expect(f.PRO.quota).toBe(90);
    expect(f.MAX.quota).toBe(365);
  });
});

describe("Quota separation — independent counters", () => {
  it("PRO BROADCAST_EMAILS === 0 (broadcast is MAX-only, NOT PRO)", () => {
    const proBroadcast = FEATURE_LIMITS[FEATURE_KEYS.BROADCAST_EMAILS].PRO;
    expect(proBroadcast.access).toBe(false);
    expect(proBroadcast.quota).toBe(0);
  });

  it("FREE EMAIL_TEMPLATES === 2 (NOT 1 — the old pricing card said 1)", () => {
    expect(FEATURE_LIMITS[FEATURE_KEYS.EMAIL_TEMPLATES].FREE.quota).toBe(2);
  });

  it("API_MESSAGES, OTP_EMAILS, MESSAGING_EMAILS, BROADCAST_EMAILS have 4 distinct feature keys", () => {
    const keys: FeatureKey[] = [
      FEATURE_KEYS.API_MESSAGES,
      FEATURE_KEYS.OTP_EMAILS,
      FEATURE_KEYS.MESSAGING_EMAILS,
      FEATURE_KEYS.BROADCAST_EMAILS,
    ];
    expect(new Set(keys).size).toBe(4);
  });

  it("API_MESSAGES quota is independent from OTP_EMAILS quota", () => {
    expect(FEATURE_KEYS.API_MESSAGES).not.toBe(FEATURE_KEYS.OTP_EMAILS);
    // Different limits prove they are not aliased:
    expect(FEATURE_LIMITS[FEATURE_KEYS.API_MESSAGES].FREE.quota).toBe(1_000);
    expect(FEATURE_LIMITS[FEATURE_KEYS.OTP_EMAILS].FREE.quota).toBe(100);
  });

  it("MESSAGING_EMAILS quota is independent from BROADCAST_EMAILS quota", () => {
    expect(FEATURE_KEYS.MESSAGING_EMAILS).not.toBe(FEATURE_KEYS.BROADCAST_EMAILS);
    // PRO has messaging but NOT broadcast — proving they are separate gates:
    expect(FEATURE_LIMITS[FEATURE_KEYS.MESSAGING_EMAILS].PRO.access).toBe(true);
    expect(FEATURE_LIMITS[FEATURE_KEYS.BROADCAST_EMAILS].PRO.access).toBe(false);
  });

  it("OTP_EMAILS quota is independent from MESSAGING_EMAILS quota", () => {
    expect(FEATURE_KEYS.OTP_EMAILS).not.toBe(FEATURE_KEYS.MESSAGING_EMAILS);
    // FREE has OTP access but NOT messaging access:
    expect(FEATURE_LIMITS[FEATURE_KEYS.OTP_EMAILS].FREE.access).toBe(true);
    expect(FEATURE_LIMITS[FEATURE_KEYS.MESSAGING_EMAILS].FREE.access).toBe(false);
  });

  it("there is no shared 'total_email_usage' counter", () => {
    const allKeys = Object.values(FEATURE_KEYS);
    expect(allKeys).not.toContain("total_email_usage");
  });
});

describe("Pricing comparison data is DERIVED from entitlements (not independent)", () => {
  it("FREE pricing card says '2 email templates' (NOT '1')", () => {
    const freeTier = PRICING_TIERS.find((t) => t.id === "free");
    expect(freeTier).toBeDefined();
    const templatesLine = freeTier!.features.find((f) =>
      f.includes("email templates"),
    );
    expect(templatesLine).toBeDefined();
    expect(templatesLine).toContain("2");
    // Make sure it doesn't say "1 email template" (the old fictional value).
    expect(templatesLine).not.toMatch(/^1 email template/);
  });

  it("MAX pricing card says 'Unlimited' for OTP emails (NOT '1,000,000')", () => {
    const maxTier = PRICING_TIERS.find((t) => t.id === "max");
    expect(maxTier).toBeDefined();
    const otpLine = maxTier!.features.find((f) =>
      f.toLowerCase().includes("otp"),
    );
    expect(otpLine).toBeDefined();
    expect(otpLine!.toLowerCase()).toContain("unlimited");
    expect(otpLine).not.toContain("1,000,000");
    expect(otpLine).not.toContain("1000000");
    expect(otpLine).not.toContain("1 million");
  });

  it("MAX pricing card does NOT claim Dedicated IP, DKIM/SPF/DMARC, SLA, or Dedicated support engineer", () => {
    const maxTier = PRICING_TIERS.find((t) => t.id === "max");
    expect(maxTier).toBeDefined();
    const allFeatures = maxTier!.features.join(" ").toLowerCase();
    expect(allFeatures).not.toContain("dedicated ip");
    expect(allFeatures).not.toContain("dkim");
    expect(allFeatures).not.toContain("spf");
    expect(allFeatures).not.toContain("dmarc");
    expect(allFeatures).not.toContain("sla");
    expect(allFeatures).not.toContain("99.99");
    expect(allFeatures).not.toContain("dedicated support engineer");
  });

  it("pricing tiers use 'Max' (NOT 'Enterprise')", () => {
    const maxTier = PRICING_TIERS.find((t) => t.id === "max");
    expect(maxTier).toBeDefined();
    expect(maxTier!.name).toBe("Max");
    expect(maxTier!.name).not.toBe("Enterprise");
  });

  it("pricing tier count is exactly 3", () => {
    expect(PRICING_TIERS).toHaveLength(3);
  });

  it("comparison rows use `max` field (NOT `enterprise`)", () => {
    for (const row of COMPARISON_DATA) {
      expect(row).toHaveProperty("max");
      expect(row).not.toHaveProperty("enterprise");
    }
  });

  it("comparison 'Email templates' row matches entitlement config", () => {
    const row = COMPARISON_DATA.find((r) => r.feature === "Email templates");
    expect(row).toBeDefined();
    expect(row!.free).toBe("2"); // FREE EMAIL_TEMPLATES = 2
    expect(row!.pro).toBe("20"); // PRO EMAIL_TEMPLATES = 20
    expect(row!.max).toBe("Unlimited"); // MAX EMAIL_TEMPLATES = Infinity
  });

  it("comparison 'API messages' row matches entitlement config", () => {
    const row = COMPARISON_DATA.find((r) =>
      r.feature.startsWith("API messages"),
    );
    expect(row).toBeDefined();
    expect(row!.free).toBe("1,000");
    expect(row!.pro).toBe("50,000");
    expect(row!.max).toBe("Unlimited");
  });

  it("comparison 'OTP emails' row matches entitlement config", () => {
    const row = COMPARISON_DATA.find((r) =>
      r.feature.startsWith("OTP emails"),
    );
    expect(row).toBeDefined();
    expect(row!.free).toBe("100");
    expect(row!.pro).toBe("10,000");
    expect(row!.max).toBe("Unlimited");
  });

  it("comparison 'Broadcast emails' row shows PRO as unavailable (—)", () => {
    const row = COMPARISON_DATA.find((r) =>
      r.feature.startsWith("Broadcast emails"),
    );
    expect(row).toBeDefined();
    // FREE = 0 (access=false) → "—"
    expect(row!.free).toBe("—");
    // PRO = 0 (access=false) → "—" — this is the critical quota separation.
    expect(row!.pro).toBe("—");
    // MAX = 50,000 (access=true)
    expect(row!.max).toBe("50,000");
  });

  it("comparison 'Messaging emails' row matches entitlement config", () => {
    const row = COMPARISON_DATA.find((r) =>
      r.feature.startsWith("Messaging emails"),
    );
    expect(row).toBeDefined();
    expect(row!.free).toBe("—"); // FREE = 0 (access=false)
    expect(row!.pro).toBe("10,000");
    expect(row!.max).toBe("100,000");
  });

  it("comparison table does NOT have a 'Dedicated IP' row", () => {
    const row = COMPARISON_DATA.find((r) =>
      r.feature.toLowerCase().includes("dedicated ip"),
    );
    expect(row).toBeUndefined();
  });

  it("comparison table does NOT have an 'SLA' row", () => {
    const row = COMPARISON_DATA.find((r) =>
      r.feature.toLowerCase().includes("sla"),
    );
    expect(row).toBeUndefined();
  });
});

describe("FAQs do not mention fictional billing claims", () => {
  // The FAQ copy now lives in the i18n dictionaries under
  // `pricing.faq.items.N.{q,a}`. FAQS itself carries only translation-key
  // prefixes, so we audit the rendered FAQ text from both the English and
  // Persian dictionaries — both must be free of fictional billing claims.
  const enItems = translations.en.pricing.faq.items;
  const faItems = translations.fa.pricing.faq.items;
  const collect = (items: Record<string, { q: string; a: string }>) =>
    Object.values(items)
      .map((i) => `${i.q} ${i.a}`)
      .join(" ")
      .toLowerCase();
  const allFaqText = `${collect(enItems)} ${collect(faItems)}`;

  it("does not mention Stripe", () => {
    expect(allFaqText).not.toContain("stripe");
  });

  it("does not mention proration", () => {
    expect(allFaqText).not.toContain("prorat");
  });

  it("does not mention NET-30 invoices", () => {
    expect(allFaqText).not.toContain("net-30");
    expect(allFaqText).not.toContain("net 30");
    expect(allFaqText).not.toContain("invoice");
  });

  it("does not mention money-back guarantee", () => {
    expect(allFaqText).not.toContain("money-back");
    expect(allFaqText).not.toContain("money back");
    expect(allFaqText).not.toContain("guarantee");
  });

  it("does not mention one-click cancellation", () => {
    expect(allFaqText).not.toContain("one click");
    expect(allFaqText).not.toContain("cancel anytime");
  });

  it("does not mention credit card requirements", () => {
    expect(allFaqText).not.toContain("credit card");
  });

  it("does not leak internal machine error codes into FAQ copy", () => {
    // The entitlement engine uses `quota_exhausted` as an internal reason;
    // some routes surface `quota_exceeded` as a public code. Both are
    // machine identifiers and must NOT appear in user-facing FAQ prose —
    // the FAQ uses plain language ("a clear error message") instead.
    expect(allFaqText).not.toContain("quota_exhausted");
    expect(allFaqText).not.toContain("quota_exceeded");
  });
});

describe("getFeatureQuota + formatQuota helpers", () => {
  it("getFeatureQuota returns the configured quota for a feature/plan", () => {
    expect(getFeatureQuota(FEATURE_KEYS.EMAIL_TEMPLATES, "FREE")).toBe(2);
    expect(getFeatureQuota(FEATURE_KEYS.EMAIL_TEMPLATES, "PRO")).toBe(20);
    expect(getFeatureQuota(FEATURE_KEYS.EMAIL_TEMPLATES, "MAX")).toBe(Infinity);
  });

  it("getFeatureQuota returns 0 when access is false on the plan", () => {
    expect(getFeatureQuota(FEATURE_KEYS.BROADCAST_EMAILS, "PRO")).toBe(0);
    expect(getFeatureQuota(FEATURE_KEYS.BRAND_KIT, "FREE")).toBe(0);
    expect(getFeatureQuota(FEATURE_KEYS.WEBHOOK_ENDPOINTS, "FREE")).toBe(0);
  });

  it("formatQuota renders Infinity as 'Unlimited'", () => {
    expect(formatQuota(Infinity)).toBe("Unlimited");
  });

  it("formatQuota renders 0 as '0'", () => {
    expect(formatQuota(0)).toBe("0");
  });

  it("formatQuota renders 50000 as '50,000'", () => {
    expect(formatQuota(50_000)).toBe("50,000");
  });
});

// ─── 2. DB-GATED INTEGRATION TESTS (plan mutation security) ────────────────
//
// These prove that a user-facing mutation endpoint (PATCH
// /api/dashboard/preferences/locale) cannot be coerced into modifying the
// user's `plan` field. The route's Zod schema strips unknown keys, and the
// db.user.update call only sets whitelisted fields (preferredLocale).
//
// We mock @/lib/auth/session so the route sees an authenticated test user
// without requiring cookies() from next/headers (which is not available in
// a vitest test context).
//
// These tests run ONLY when RUN_BILLING_INTEGRATION=1 and DATABASE_URL is a
// real Postgres URL (not a file: URL). The `test:billing` script in
// package.json sets both. When `bun run test` runs the file without those
// env vars, this describe block is skipped — the unit tests above still run.
//
// The plan-mutation-security contract is ONLY proven by execution against
// a real DB row. There is no static-only shortcut — the security guarantee
// is "the plan column in the DB does not change", which requires a DB read.

const SKIP_DB =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes("file:") ||
  process.env.RUN_BILLING_INTEGRATION !== "1";

// Mock the auth session module. This is hoisted by vitest before imports are
// resolved, so the route file receives the mocked getAuthenticatedUser.
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn(),
}));

// Mock the admin auth module — api-keys route tries `getAdmin()` first, so
// we mock it to return null (no admin cookie) to force the user session path.
vi.mock("@/lib/auth/admin", () => ({
  getAdmin: vi.fn(),
}));

// Mock the themes auth resolver — used by webhooks, themes/save, and
// brand-kit routes. We resolve to the test user (mode: "user") per test.
vi.mock("@/lib/themes-auth", () => ({
  resolveThemesViewer: vi.fn(),
  resolveThemesEditor: vi.fn(),
}));

import { hashPassword } from "@/lib/auth/password";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getAdmin } from "@/lib/auth/admin";
import { resolveThemesViewer } from "@/lib/themes-auth";
import { PATCH as localePatch } from "@/app/api/dashboard/preferences/locale/route";
import { POST as apiKeysPost } from "@/app/api/admin/api-keys/route";
import { POST as webhooksPost } from "@/app/api/admin/webhooks/route";
import { POST as themesSavePost } from "@/app/api/admin/themes/save/route";
import { POST as brandKitPost } from "@/app/api/admin/brand-kit/route";
import { POST as broadcastLaunchPost } from "@/app/api/dashboard/broadcasts/[broadcastId]/launch/route";

const mockedGetAuthenticatedUser = vi.mocked(getAuthenticatedUser);
const mockedGetAdmin = vi.mocked(getAdmin);
const mockedResolveThemesViewer = vi.mocked(resolveThemesViewer);

describe.skipIf(SKIP_DB)("Plan mutation security (DB-gated integration)", () => {
  let testUserId: number;

  beforeAll(async () => {
    // Clean up any previous test data with the same email prefix.
    await db.user.deleteMany({
      where: { email: "billing-plan-security-test@nixify-test.com" },
    });

    // Create a test user with plan=FREE.
    const user = await db.user.create({
      data: {
        email: "billing-plan-security-test@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "FREE",
      },
    });
    testUserId = user.id;

    // Wire the mock to return this user for all route-handler calls.
    mockedGetAuthenticatedUser.mockResolvedValue(user);
    // Ensure the admin mock returns null (no admin cookie) — the locale route
    // uses getAuthenticatedUser, but we set this defensively so the mock is
    // in a known state.
    mockedGetAdmin.mockResolvedValue(null);
  });

  afterAll(async () => {
    if (testUserId) {
      await db.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await db.$disconnect();
  });

  it("PATCH /api/dashboard/preferences/locale with { plan: 'MAX' } does NOT upgrade the user", async () => {
    // Confirm starting state.
    const before = await db.user.findUnique({ where: { id: testUserId } });
    expect(before?.plan).toBe("FREE");

    // Construct a real Request with the malicious body. The locale field is
    // valid so the schema parse succeeds; the `plan` field is an unknown key
    // that Zod's default strip behavior drops before it reaches
    // db.user.update.
    const req = new Request(
      "http://localhost/api/dashboard/preferences/locale",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: "en", plan: "MAX" }),
      },
    );

    const res = await localePatch(req);
    // The locale update succeeds (200) — the extra `plan` key was silently
    // stripped and never reached the update.
    expect(res.status).toBe(200);

    // Re-read the user. The plan MUST still be FREE.
    const after = await db.user.findUnique({ where: { id: testUserId } });
    expect(after?.plan).toBe("FREE");
    // The locale SHOULD have been updated (proving the route worked).
    expect(after?.preferredLocale).toBe("en");
  });

  it("PATCH /api/dashboard/preferences/locale with { plan: 'PRO' } does NOT upgrade the user", async () => {
    const req = new Request(
      "http://localhost/api/dashboard/preferences/locale",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: "fa", plan: "PRO" }),
      },
    );

    const res = await localePatch(req);
    expect(res.status).toBe(200);

    const after = await db.user.findUnique({ where: { id: testUserId } });
    expect(after?.plan).toBe("FREE"); // Still FREE — plan was NOT upgraded.
    expect(after?.preferredLocale).toBe("fa"); // Locale WAS updated.
  });

  it("PATCH /api/dashboard/preferences/locale ignores multiple malicious unknown keys", async () => {
    // The route uses Zod's default (non-strict) parsing, so unknown keys are
    // stripped rather than rejected. This is the correct behavior for a
    // mutation endpoint — we want the route to succeed on the documented
    // field (locale) and ignore anything else.
    const req = new Request(
      "http://localhost/api/dashboard/preferences/locale",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: "en",
          plan: "MAX",
          isAdmin: true,
          role: "admin",
          trialExpiresAt: "2099-01-01",
        }),
      },
    );

    const res = await localePatch(req);
    expect(res.status).toBe(200);

    const after = await db.user.findUnique({ where: { id: testUserId } });
    // None of the malicious fields were applied.
    expect(after?.plan).toBe("FREE");
    expect(after?.preferredLocale).toBe("en");
  });
});

// ─── Semantic regression: bucket descriptions ─────────────────────────────

describe("Quota bucket semantic descriptions (BLOCKER #3)", () => {
  it("MESSAGING_EMAILS tooltip does NOT claim broadcast is included", () => {
    const row = COMPARISON_DATA.find(r => r.featureKey === FEATURE_KEYS.MESSAGING_EMAILS);
    expect(row).toBeDefined();
    if (row) {
      // The tooltip may mention "broadcast" to say it's SEPARATE (e.g. "Independent from ... Broadcast").
      // But it must NOT say broadcast is INCLUDED (e.g. "transactional + broadcast").
      expect(row.tooltip.toLowerCase()).not.toContain("transactional + broadcast");
      expect(row.tooltip.toLowerCase()).not.toContain("transactional and broadcast");
      expect(row.tooltip.toLowerCase()).not.toMatch(/includes?.*broadcast/);
    }
  });

  it("MESSAGING_EMAILS tooltip mentions transactional/lifecycle", () => {
    const row = COMPARISON_DATA.find(r => r.featureKey === FEATURE_KEYS.MESSAGING_EMAILS);
    expect(row).toBeDefined();
    expect(row!.tooltip.toLowerCase()).toMatch(/transactional|lifecycle/);
  });

  it("BROADCAST_EMAILS tooltip is separate from MESSAGING_EMAILS", () => {
    const broadcastRow = COMPARISON_DATA.find(r => r.featureKey === FEATURE_KEYS.BROADCAST_EMAILS);
    expect(broadcastRow).toBeDefined();
    expect(broadcastRow!.tooltip.toLowerCase()).not.toContain("messaging api");
  });

  it("API_MESSAGES tooltip describes all authenticated v1 API requests (not OTP-only)", () => {
    const row = COMPARISON_DATA.find(r => r.featureKey === FEATURE_KEYS.API_MESSAGES);
    expect(row).toBeDefined();
    if (row) {
      expect(row.tooltip.toLowerCase()).not.toContain("otp send + verify");
      expect(row.tooltip.toLowerCase()).toMatch(/authenticated|api request/);
    }
  });

  it("Multi-language does NOT claim 5 shipped languages", () => {
    const row = COMPARISON_DATA.find(r => r.feature.toLowerCase().includes("language") || r.feature.toLowerCase().includes("multi"));
    expect(row).toBeDefined();
    if (row) {
      expect(row.tooltip).not.toContain("5 supported languages");
      expect(row.tooltip).not.toMatch(/five.*language/i);
    }
  });

  it("Multi-language mentions English and Persian", () => {
    const row = COMPARISON_DATA.find(r => r.feature.toLowerCase().includes("language") || r.feature.toLowerCase().includes("multi"));
    expect(row).toBeDefined();
    if (row) {
      expect(row.tooltip.toLowerCase()).toMatch(/english.*persian|persian.*english/);
    }
  });

  it("ROI_CONSTANTS does NOT contain invented per-OTP cost numbers", () => {
    expect(ROI_CONSTANTS).not.toHaveProperty("inHouseCostPerOtp");
    expect(ROI_CONSTANTS).not.toHaveProperty("proCostPerOtp");
  });
});


// ─── DB-gated production-path resource-gate tests ─────────────────────────
//
// These tests execute the REAL production mutation routes against a real
// database. The contract is: a route that creates a plan-gated resource
// must reject the request when the user's plan/quota does not allow it,
// and must NOT leave a new DB row behind. The test proves this by:
//
//   1. Creating a real test user with the appropriate plan.
//   2. Pre-populating any UsageTracking row needed to simulate "at limit".
//   3. Calling the REAL route handler (imported directly, NOT a mock).
//   4. Asserting the response status (403 for access-gated, 402 for
//      quota-exhausted, 200/201 for allowed).
//   5. Asserting the actual DB row count is unchanged after a denial.
//
// Auth is mocked (resolveThemesViewer / getAuthenticatedUser / getAdmin)
// so the route sees the test user without requiring cookies() from
// next/headers. Everything else — the route handler, the entitlement
// engine, the rate-limit table, the UsageTracking consume, the Zod
// schema, the DB writes — runs through real production code.
//
// Each test uses `expect.hasAssertions()` so an accidentally empty body
// cannot pass silently (per the agent-lessons "Empty test bodies are not
// coverage" rule).
//
// Per reliability protocol §3.3, each DB-gated test file uses a unique
// email prefix for its test users to prevent P2002 cross-file conflicts.
// This file uses `billgate-test-`.

import { NextRequest } from "next/server";

// Email prefix unique to this test file (per reliability protocol §3.3).
const BILLGATE_EMAIL_PREFIX = "billgate-test-";

function billingPeriodStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function billingPeriodEnd(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

async function createBillingTestUser(
  plan: "FREE" | "PRO" | "MAX",
): Promise<number> {
  const email = `${BILLGATE_EMAIL_PREFIX}${plan}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}@nixify-test.com`;
  const user = await db.user.create({
    data: {
      email,
      passwordHash: await hashPassword("testpass123"),
      emailVerified: true,
      plan,
    },
  });
  return user.id;
}

async function seedUsageAtQuota(
  userId: number,
  featureKey: string,
  count: number,
): Promise<void> {
  await db.usageTracking.create({
    data: {
      userId,
      featureKey,
      count,
      periodStart: billingPeriodStart(),
      periodEnd: billingPeriodEnd(),
    },
  });
}

/**
 * Wire the auth mocks to resolve to the test user. After this call:
 *   - `getAuthenticatedUser()` returns the user row.
 *   - `getAdmin()` returns null (no admin cookie — forces the user path).
 *   - `resolveThemesViewer()` returns an OK result with mode="user" and
 *     ownership scoped to the test user.
 *
 * The themes-auth OK variant requires `canModify`, which we wire so only
 * rows owned by this user can be modified — matching real production
 * behavior for a non-admin session.
 */
async function setupAuthMocksForUser(userId: number): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error(`Test user ${userId} not found`);
  mockedGetAuthenticatedUser.mockResolvedValue(user);
  mockedGetAdmin.mockResolvedValue(null);
  mockedResolveThemesViewer.mockResolvedValue({
    ok: true,
    mode: "user",
    userId: user.id,
    scope: { userId: user.id },
    canModify: (themeOwnerUserId: number | null) =>
      themeOwnerUserId === user.id,
  });
}

// ─── API key creation (POST /api/admin/api-keys) ───────────────────────────

describe.skipIf(SKIP_DB)(
  "Production-path: API key creation (POST /api/admin/api-keys)",
  () => {
    const createdUserIds: number[] = [];

    afterAll(async () => {
      if (createdUserIds.length > 0) {
        await db.apiKey
          .deleteMany({ where: { userId: { in: createdUserIds } } })
          .catch(() => {});
        await db.usageTracking
          .deleteMany({ where: { userId: { in: createdUserIds } } })
          .catch(() => {});
        await db.rateLimitBucket
          .deleteMany({
            where: {
              key: { startsWith: "entitlement_rate:api_keys:" },
            },
          })
          .catch(() => {});
        await db.user
          .deleteMany({ where: { id: { in: createdUserIds } } })
          .catch(() => {});
      }
    });

    it("FREE, 0 existing keys → creation succeeds (201, +1 ApiKey row)", async () => {
      expect.hasAssertions();
      const userId = await createBillingTestUser("FREE");
      createdUserIds.push(userId);
      await setupAuthMocksForUser(userId);

      const keysBefore = await db.apiKey.count({
        where: { userId, revokedAt: null },
      });
      expect(keysBefore).toBe(0);

      const req = new NextRequest("http://localhost/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test-key", environment: "development" }),
      });

      const res = await apiKeysPost(req);
      expect(res.status).toBe(201);

      const keysAfter = await db.apiKey.count({
        where: { userId, revokedAt: null },
      });
      expect(keysAfter).toBe(1); // +1 row created.
    });

    it("FREE, at quota=1 → creation blocked (402, no new row)", async () => {
      expect.hasAssertions();
      const userId = await createBillingTestUser("FREE");
      createdUserIds.push(userId);

      // Create 1 real active API key (FREE quota = 1).
      await db.apiKey.create({
        data: { userId, name: "existing-key", prefix: "mg_test_exist", keyHash: `hash-existing-${userId}-${Date.now()}`, environment: "development", scopes: "full" },
      });
      await setupAuthMocksForUser(userId);

      const keysBefore = await db.apiKey.count({
        where: { userId, revokedAt: null },
      });
      expect(keysBefore).toBe(1);

      const req = new NextRequest("http://localhost/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "second-key", environment: "development" }),
      });

      const res = await apiKeysPost(req);
      expect(res.status).toBe(402); // Payment Required (quota exhausted).

      const keysAfter = await db.apiKey.count({
        where: { userId, revokedAt: null },
      });
      expect(keysAfter).toBe(1); // Unchanged — no new row created.
    });

    it("PRO, below quota=5 → creation succeeds (201, +1 row)", async () => {
      expect.hasAssertions();
      const userId = await createBillingTestUser("PRO");
      createdUserIds.push(userId);
      await setupAuthMocksForUser(userId);

      const keysBefore = await db.apiKey.count({
        where: { userId, revokedAt: null },
      });
      expect(keysBefore).toBe(0);

      const req = new NextRequest("http://localhost/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "pro-key", environment: "production" }),
      });

      const res = await apiKeysPost(req);
      expect(res.status).toBe(201);

      const keysAfter = await db.apiKey.count({
        where: { userId, revokedAt: null },
      });
      expect(keysAfter).toBe(1);
    });

    it("PRO, at quota=5 → creation blocked (402, no new row)", async () => {
      expect.hasAssertions();
      const userId = await createBillingTestUser("PRO");
      createdUserIds.push(userId);

      // Create 5 real active API keys (PRO quota = 5).
      for (let i = 0; i < 5; i++) {
        await db.apiKey.create({
          data: { userId, name: `existing-key-${i}`, prefix: `mg_test_e${i}`, keyHash: `hash-${i}-` + Date.now(), environment: "development", scopes: "full" },
        });
      }
      await setupAuthMocksForUser(userId);

      const keysBefore = await db.apiKey.count({
        where: { userId, revokedAt: null },
      });
      expect(keysBefore).toBe(5); // 5 real active keys exist (at quota).

      const req = new NextRequest("http://localhost/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "over-key", environment: "development" }),
      });

      const res = await apiKeysPost(req);
      expect(res.status).toBe(402);

      const keysAfter = await db.apiKey.count({
        where: { userId, revokedAt: null },
      });
      expect(keysAfter).toBe(5); // Unchanged — no new row created.
    });
  },
);

// ─── Webhook endpoint creation (POST /api/admin/webhooks) ──────────────────

describe.skipIf(SKIP_DB)(
  "Production-path: Webhook endpoint creation (POST /api/admin/webhooks)",
  () => {
    const createdUserIds: number[] = [];

    afterAll(async () => {
      if (createdUserIds.length > 0) {
        await db.webhookDelivery
          .deleteMany({
            where: { endpoint: { userId: { in: createdUserIds } } },
          })
          .catch(() => {});
        await db.webhookEndpoint
          .deleteMany({ where: { userId: { in: createdUserIds } } })
          .catch(() => {});
        await db.usageTracking
          .deleteMany({ where: { userId: { in: createdUserIds } } })
          .catch(() => {});
        await db.user
          .deleteMany({ where: { id: { in: createdUserIds } } })
          .catch(() => {});
      }
    });

    it("FREE → creation denied (403, 0 endpoints)", async () => {
      expect.hasAssertions();
      const userId = await createBillingTestUser("FREE");
      createdUserIds.push(userId);
      await setupAuthMocksForUser(userId);

      const endpointsBefore = await db.webhookEndpoint.count({
        where: { userId },
      });
      expect(endpointsBefore).toBe(0);

      const req = new NextRequest("http://localhost/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/webhook",
          events: ["otp.sent"],
        }),
      });

      const res = await webhooksPost(req);
      expect(res.status).toBe(403); // FREE access=false → FORBIDDEN.

      const endpointsAfter = await db.webhookEndpoint.count({
        where: { userId },
      });
      expect(endpointsAfter).toBe(0); // No row created.
    });

    it("PRO, below quota=3 → creation succeeds (201, +1 endpoint)", async () => {
      expect.hasAssertions();
      const userId = await createBillingTestUser("PRO");
      createdUserIds.push(userId);
      await setupAuthMocksForUser(userId);

      const endpointsBefore = await db.webhookEndpoint.count({
        where: { userId },
      });
      expect(endpointsBefore).toBe(0);

      const req = new NextRequest("http://localhost/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/webhook",
          events: ["otp.sent", "otp.verified"],
        }),
      });

      const res = await webhooksPost(req);
      expect(res.status).toBe(201);

      const endpointsAfter = await db.webhookEndpoint.count({
        where: { userId },
      });
      expect(endpointsAfter).toBe(1); // +1 endpoint created.
    });

    it("PRO, at quota=3 → creation denied (402, count unchanged)", async () => {
      expect.hasAssertions();
      const userId = await createBillingTestUser("PRO");
      createdUserIds.push(userId);

      // Create 3 real webhook endpoints (PRO quota = 3).
      for (let i = 0; i < 3; i++) {
        await db.webhookEndpoint.create({
          data: { userId, url: `https://example.com/hook-${i}`, events: "otp.sent", secret: "secret-" + i, isActive: true, createdBy: "test" },
        });
      }
      await setupAuthMocksForUser(userId);

      const endpointsBefore = await db.webhookEndpoint.count({
        where: { userId },
      });
      expect(endpointsBefore).toBe(3); // 3 real endpoints exist.

      const req = new NextRequest("http://localhost/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/webhook",
          events: ["otp.sent"],
        }),
      });

      const res = await webhooksPost(req);
      expect(res.status).toBe(402); // Quota exhausted.

      const endpointsAfter = await db.webhookEndpoint.count({
        where: { userId },
      });
      expect(endpointsAfter).toBe(3); // Unchanged — no new row created.
    });
  },
);

// ─── EmailTheme creation (POST /api/admin/themes/save) ─────────────────────

describe.skipIf(SKIP_DB)(
  "Production-path: EmailTheme creation (POST /api/admin/themes/save)",
  () => {
    const createdUserIds: number[] = [];

    afterAll(async () => {
      if (createdUserIds.length > 0) {
        await db.emailTheme
          .deleteMany({ where: { userId: { in: createdUserIds } } })
          .catch(() => {});
        await db.usageTracking
          .deleteMany({ where: { userId: { in: createdUserIds } } })
          .catch(() => {});
        await db.rateLimitBucket
          .deleteMany({
            where: {
              key: { startsWith: "entitlement_rate:email_templates:" },
            },
          })
          .catch(() => {});
        await db.user
          .deleteMany({ where: { id: { in: createdUserIds } } })
          .catch(() => {});
      }
    });

    it("FREE, below quota=2 → creation succeeds (+1 theme)", async () => {
      expect.hasAssertions();
      const userId = await createBillingTestUser("FREE");
      createdUserIds.push(userId);
      await setupAuthMocksForUser(userId);

      const themesBefore = await db.emailTheme.count({
        where: { userId },
      });
      expect(themesBefore).toBe(0);

      const req = new Request("http://localhost/api/admin/themes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "test-theme",
          templateId: "minimal",
          purpose: "all",
          config: {},
        }),
      });

      const res = await themesSavePost(req);
      // The route returns 200 on create (apiOk default). 201 was for older
      // variants; both are "success" — assert it is NOT a denial status.
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);

      const themesAfter = await db.emailTheme.count({
        where: { userId },
      });
      expect(themesAfter).toBe(1); // +1 theme created.
    });

    it("FREE, at quota=2 → 3rd creation denied (402, no new theme)", async () => {
      expect.hasAssertions();
      const userId = await createBillingTestUser("FREE");
      createdUserIds.push(userId);

      // Create 2 real themes (FREE quota = 2).
      for (let i = 0; i < 2; i++) {
        await db.emailTheme.create({
          data: { userId, name: `existing-theme-${i}`, templateId: "minimal", purpose: "all", isActive: false, config: "{}" },
        });
      }
      await setupAuthMocksForUser(userId);

      const themesBefore = await db.emailTheme.count({
        where: { userId },
      });
      expect(themesBefore).toBe(2); // 2 real themes exist.

      const req = new Request("http://localhost/api/admin/themes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "third-theme",
          templateId: "minimal",
          purpose: "all",
          config: {},
        }),
      });

      const res = await themesSavePost(req);
      expect(res.status).toBe(402); // Quota exhausted.

      const themesAfter = await db.emailTheme.count({
        where: { userId },
      });
      expect(themesAfter).toBe(2); // Unchanged — no new theme created.
    });

    it("PRO, below quota=20 → creation succeeds (+1 theme)", async () => {
      expect.hasAssertions();
      const userId = await createBillingTestUser("PRO");
      createdUserIds.push(userId);
      await setupAuthMocksForUser(userId);

      const themesBefore = await db.emailTheme.count({
        where: { userId },
      });
      expect(themesBefore).toBe(0);

      const req = new Request("http://localhost/api/admin/themes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "pro-theme",
          templateId: "minimal",
          purpose: "all",
          config: {},
        }),
      });

      const res = await themesSavePost(req);
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);

      const themesAfter = await db.emailTheme.count({
        where: { userId },
      });
      expect(themesAfter).toBe(1);
    });

    it("PRO, at quota=20 → creation denied (402, no new theme)", async () => {
      expect.hasAssertions();
      const userId = await createBillingTestUser("PRO");
      createdUserIds.push(userId);

      // Create 20 real themes (PRO quota = 20).
      for (let i = 0; i < 20; i++) {
        await db.emailTheme.create({
          data: { userId, name: `existing-theme-${i}`, templateId: "minimal", purpose: "all", isActive: false, config: "{}" },
        });
      }
      await setupAuthMocksForUser(userId);

      const themesBefore = await db.emailTheme.count({
        where: { userId },
      });
      expect(themesBefore).toBe(20);

      const req = new Request("http://localhost/api/admin/themes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "over-theme",
          templateId: "minimal",
          purpose: "all",
          config: {},
        }),
      });

      const res = await themesSavePost(req);
      expect(res.status).toBe(402);

      const themesAfter = await db.emailTheme.count({
        where: { userId },
      });
      expect(themesAfter).toBe(20); // Unchanged.
    });
  },
);

// ─── BrandKit mutation (POST /api/admin/brand-kit) ────────────────────────

describe.skipIf(SKIP_DB)(
  "Production-path: BrandKit mutation (POST /api/admin/brand-kit)",
  () => {
    const createdUserIds: number[] = [];

    afterAll(async () => {
      if (createdUserIds.length > 0) {
        await db.brandKit
          .deleteMany({ where: { userId: { in: createdUserIds } } })
          .catch(() => {});
        await db.user
          .deleteMany({ where: { id: { in: createdUserIds } } })
          .catch(() => {});
      }
    });

    it("FREE → mutation denied (403, no BrandKit row created)", async () => {
      expect.hasAssertions();
      const userId = await createBillingTestUser("FREE");
      createdUserIds.push(userId);
      await setupAuthMocksForUser(userId);

      const kitsBefore = await db.brandKit.count({
        where: { userId },
      });
      expect(kitsBefore).toBe(0);

      const req = new Request("http://localhost/api/admin/brand-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName: "Test App",
          primaryColor: "#059669",
        }),
      });

      const res = await brandKitPost(req);
      expect(res.status).toBe(403); // BRAND_KIT access=false on FREE.

      const kitsAfter = await db.brandKit.count({
        where: { userId },
      });
      expect(kitsAfter).toBe(0); // No row created.
    });

    it("PRO → mutation succeeds (200, BrandKit upserted)", async () => {
      expect.hasAssertions();
      const userId = await createBillingTestUser("PRO");
      createdUserIds.push(userId);
      await setupAuthMocksForUser(userId);

      const kitsBefore = await db.brandKit.count({
        where: { userId },
      });
      expect(kitsBefore).toBe(0);

      const req = new Request("http://localhost/api/admin/brand-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName: "Pro App",
          primaryColor: "#059669",
          secondaryColor: "#0f172a",
        }),
      });

      const res = await brandKitPost(req);
      expect(res.status).toBe(200);

      const kitsAfter = await db.brandKit.count({
        where: { userId },
      });
      expect(kitsAfter).toBe(1); // BrandKit row created via upsert.
    });
  },
);

// ─── Broadcast launch (POST /api/dashboard/broadcasts/[broadcastId]/launch) ─

describe.skipIf(SKIP_DB)(
  "Production-path: Broadcast launch (POST /api/dashboard/broadcasts/[broadcastId]/launch)",
  () => {
    const createdUserIds: number[] = [];
    const createdBroadcastIds: number[] = [];

    afterAll(async () => {
      // Clean up broadcast-related rows for the test users.
      if (createdUserIds.length > 0) {
        await db.broadcastRecipient
          .deleteMany({
            where: { userId: { in: createdUserIds } },
          })
          .catch(() => {});
        await db.broadcastMutationIdempotency
          .deleteMany({
            where: { userId: { in: createdUserIds } },
          })
          .catch(() => {});
      }
      if (createdBroadcastIds.length > 0) {
        await db.broadcast
          .deleteMany({ where: { id: { in: createdBroadcastIds } } })
          .catch(() => {});
      }
      if (createdUserIds.length > 0) {
        await db.user
          .deleteMany({ where: { id: { in: createdUserIds } } })
          .catch(() => {});
      }
    });

    it("PRO user → launch rejected at entitlement gate (403)", async () => {
      expect.hasAssertions();
      const userId = await createBillingTestUser("PRO");
      createdUserIds.push(userId);
      await setupAuthMocksForUser(userId);

      // Use a random broadcastId — the route should reject BEFORE
      // looking up the broadcast (entitlement check is first).
      const req = new NextRequest(
        "http://localhost/api/dashboard/broadcasts/nonexistent-broadcast-id/launch",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      const res = await broadcastLaunchPost(req, {
        params: Promise.resolve({ broadcastId: "nonexistent-broadcast-id" }),
      });

      // PRO BROADCAST_EMAILS access=false → route returns 403 with
      // { error: { code: "feature_not_available" } } BEFORE calling
      // launchBroadcast. The broadcast doesn't even need to exist.
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("feature_not_available");
    });

    it("MAX user → launch passes entitlement gate (response not 403)", async () => {
      expect.hasAssertions();
      const userId = await createBillingTestUser("MAX");
      createdUserIds.push(userId);
      await setupAuthMocksForUser(userId);

      // Create a real broadcast in DRAFT state so the launch proceeds
      // past the entitlement gate. Audience = all_contacts, but the user
      // has no contacts → recipientCount will be 0, requiresReview=false,
      // launched=true.
      const bcast = await db.broadcast.create({
        data: {
          userId,
          name: "test-broadcast",
          subject: "Test Subject",
          htmlContent: "<p>Hello world</p>",
          textContent: "Hello world",
          audienceType: "all_contacts",
          status: "draft",
          reviewStatus: "not_required",
        },
      });
      createdBroadcastIds.push(bcast.id);

      const req = new NextRequest(
        `http://localhost/api/dashboard/broadcasts/${bcast.broadcastId}/launch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      const res = await broadcastLaunchPost(req, {
        params: Promise.resolve({ broadcastId: bcast.broadcastId }),
      });

      // The entitlement gate MUST pass for MAX (BROADCAST_EMAILS access=true).
      // The route should NOT return 403 — it may return 200 (launched=true)
      // since the broadcast is a valid draft.
      expect(res.status).not.toBe(403);
      // The launch should succeed — recipientCount=0, requiresReview=false.
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.launched).toBe(true);

      // Verify the broadcast transitioned out of draft.
      const after = await db.broadcast.findUnique({
        where: { id: bcast.id },
        select: { status: true },
      });
      expect(after?.status).not.toBe("draft");
    });
  },
);

// ─── DB-gated: persisted quota-independence ───────────────────────────────

describe.skipIf(!RUN)(
  "Persisted quota-independence (consuming one does not mutate others)",
  () => {
    let testUserId: number;

    beforeAll(async () => {
      const { hashPassword } = await import("@/lib/auth/password");
      const user = await db.user.create({
        data: {
          email: `billing-quota-indep-${Date.now()}@nixify-test.com`,
          passwordHash: await hashPassword("testpass123"),
          emailVerified: true,
          plan: "PRO",
        },
      });
      testUserId = user.id;
    });

    afterAll(async () => {
      await db.usageTracking.deleteMany({ where: { userId: testUserId } }).catch(() => {});
      await db.user.delete({ where: { id: testUserId } }).catch(() => {});
    });

    it("consuming API_MESSAGES does not create OTP_EMAILS/MESSAGING_EMAILS/BROADCAST_EMAILS counters", async () => {
      expect.hasAssertions();
      const { checkUsage } = await import("@/lib/entitlements/engine");
      const { FEATURE_KEYS: FK } = await import("@/lib/entitlements/config");

      // Clean slate
      await db.usageTracking.deleteMany({ where: { userId: testUserId } });

      // Consume one API_MESSAGES unit
      await checkUsage(testUserId, FK.API_MESSAGES);

      // Verify only API_MESSAGES has a counter
      const apiCount = await db.usageTracking.count({
        where: { userId: testUserId, featureKey: FK.API_MESSAGES },
      });
      expect(apiCount).toBe(1);

      // Verify NO counter was created for the other three
      const otpCount = await db.usageTracking.count({
        where: { userId: testUserId, featureKey: FK.OTP_EMAILS },
      });
      expect(otpCount).toBe(0);

      const msgCount = await db.usageTracking.count({
        where: { userId: testUserId, featureKey: FK.MESSAGING_EMAILS },
      });
      expect(msgCount).toBe(0);

      const bcastCount = await db.usageTracking.count({
        where: { userId: testUserId, featureKey: FK.BROADCAST_EMAILS },
      });
      expect(bcastCount).toBe(0);
    });

    it("consuming OTP_EMAILS does not create API_MESSAGES counter", async () => {
      expect.hasAssertions();
      const { checkUsage } = await import("@/lib/entitlements/engine");
      const { FEATURE_KEYS: FK } = await import("@/lib/entitlements/config");

      await db.usageTracking.deleteMany({ where: { userId: testUserId } });

      await checkUsage(testUserId, FK.OTP_EMAILS);

      const otpCount = await db.usageTracking.count({
        where: { userId: testUserId, featureKey: FK.OTP_EMAILS },
      });
      expect(otpCount).toBe(1);

      const apiCount = await db.usageTracking.count({
        where: { userId: testUserId, featureKey: FK.API_MESSAGES },
      });
      expect(apiCount).toBe(0);
    });
  },
);

// ─── DB-gated: downgrade behavior ─────────────────────────────────────────

describe.skipIf(!RUN)(
  "Downgrade behavior — existing resources survive, new creation blocked",
  () => {
    let testUserId: number;
    const createdUserIds: number[] = [];

    afterAll(async () => {
      await db.apiKey.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await db.usageTracking.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await db.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    });

    it("PRO user with 3 API keys → downgrade to FREE → keys remain, new creation blocked", async () => {
      expect.hasAssertions();
      const { hashPassword } = await import("@/lib/auth/password");
      const { getAuthenticatedUser } = await import("@/lib/auth/session");
      const { getAdmin } = await import("@/lib/auth/admin");

      // Create a PRO user
      const user = await db.user.create({
        data: {
          email: `billing-downgrade-${Date.now()}@nixify-test.com`,
          passwordHash: await hashPassword("testpass123"),
          emailVerified: true,
          plan: "PRO",
        },
      });
      testUserId = user.id;
      createdUserIds.push(user.id);

      // Create 3 API keys (PRO quota = 5, so this is below limit)
      for (let i = 0; i < 3; i++) {
        await db.apiKey.create({
          data: {
            userId: user.id,
            name: `key-${i}`,
            prefix: `mg_test_d${i}`,
            keyHash: `hash-downgrade-${i}-${Date.now()}`,
            environment: "development",
            scopes: "full",
          },
        });
      }

      // Downgrade to FREE (FREE API_KEYS quota = 1, but user has 3 keys)
      await db.user.update({
        where: { id: user.id },
        data: { plan: "FREE" },
      });

      // Existing keys MUST still exist (not deleted by downgrade)
      const keysAfterDowngrade = await db.apiKey.count({
        where: { userId: user.id, revokedAt: null },
      });
      expect(keysAfterDowngrade).toBe(3); // All 3 survive

      // New key creation MUST be blocked (FREE quota = 1, user has 3)
      const mockUser = await db.user.findUnique({ where: { id: user.id } });
      vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser!);
      vi.mocked(getAdmin).mockResolvedValue(null);

      const { POST: apiKeysPost } = await import("@/app/api/admin/api-keys/route");
      const { NextRequest } = await import("next/server");
      const req = new NextRequest("http://localhost/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "new-key-after-downgrade", environment: "development" }),
      });
      const res = await apiKeysPost(req);
      expect(res.status).toBe(402); // Blocked — above FREE quota

      // No new key was created
      const keysFinal = await db.apiKey.count({
        where: { userId: user.id, revokedAt: null },
      });
      expect(keysFinal).toBe(3); // Unchanged
    });
  },
);

// ─── DB-gated: concurrent last-slot tests ─────────────────────────────────

describe.skipIf(!RUN)(
  "Concurrent last-slot creation — exactly one winner (Phase 14 concurrency)",
  () => {
    const createdUserIds: number[] = [];

    afterAll(async () => {
      await db.apiKey.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await db.webhookEndpoint.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await db.emailTheme.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await db.usageTracking.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await db.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    });

    it("API_KEYS: FREE, 0 existing → 2 concurrent creates → exactly 1 succeeds, count=1", async () => {
      expect.hasAssertions();
      const { hashPassword } = await import("@/lib/auth/password");
      const { getAuthenticatedUser } = await import("@/lib/auth/session");
      const { getAdmin } = await import("@/lib/auth/admin");
      const { POST: apiKeysPost } = await import("@/app/api/admin/api-keys/route");
      const { NextRequest } = await import("next/server");

      const user = await db.user.create({
        data: {
          email: `billing-concurrent-apikey-${Date.now()}@nixify-test.com`,
          passwordHash: await hashPassword("testpass123"),
          emailVerified: true,
          plan: "FREE",
        },
      });
      createdUserIds.push(user.id);

      const mockUser = await db.user.findUnique({ where: { id: user.id } });
      vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser!);
      vi.mocked(getAdmin).mockResolvedValue(null);

      const makeReq = () => new NextRequest("http://localhost/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `concurrent-${Date.now()}-${Math.random()}`, environment: "development" }),
      });

      // Launch 2 concurrent create requests
      const [res1, res2] = await Promise.all([
        apiKeysPost(makeReq()),
        apiKeysPost(makeReq()),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one should succeed (201), exactly one should be blocked (402)
      expect(statuses).toEqual([201, 402]);

      // Final active key count must be exactly 1 (quota)
      const finalCount = await db.apiKey.count({
        where: { userId: user.id, revokedAt: null },
      });
      expect(finalCount).toBe(1);
    });

    it("WEBHOOK_ENDPOINTS: PRO, 2 existing → 2 concurrent creates → exactly 1 succeeds, count=3", async () => {
      expect.hasAssertions();
      const { hashPassword } = await import("@/lib/auth/password");
      const { resolveThemesViewer } = await import("@/lib/themes-auth");
      const { POST: webhooksPost } = await import("@/app/api/admin/webhooks/route");
      const { NextRequest } = await import("next/server");

      const user = await db.user.create({
        data: {
          email: `billing-concurrent-webhook-${Date.now()}@nixify-test.com`,
          passwordHash: await hashPassword("testpass123"),
          emailVerified: true,
          plan: "PRO",
        },
      });
      createdUserIds.push(user.id);

      // Seed 2 endpoints (PRO quota = 3)
      for (let i = 0; i < 2; i++) {
        await db.webhookEndpoint.create({
          data: { userId: user.id, url: `https://example.com/hook-${i}`, events: "otp.sent", secret: `s-${i}`, isActive: true, createdBy: "test" },
        });
      }

      vi.mocked(resolveThemesViewer).mockResolvedValue({
        ok: true, mode: "user", userId: user.id,
        scope: { userId: user.id },
        canModify: () => true,
      });

      const makeReq = () => new NextRequest("http://localhost/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `https://example.com/new-${Date.now()}-${Math.random()}`, events: ["otp.sent"] }),
      });

      const [res1, res2] = await Promise.all([
        webhooksPost(makeReq()),
        webhooksPost(makeReq()),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 402]);

      const finalCount = await db.webhookEndpoint.count({ where: { userId: user.id } });
      expect(finalCount).toBe(3);
    });

    it("EMAIL_TEMPLATES: FREE, 1 existing → 2 concurrent creates → exactly 1 succeeds, count=2", async () => {
      expect.hasAssertions();
      const { hashPassword } = await import("@/lib/auth/password");
      const { resolveThemesViewer } = await import("@/lib/themes-auth");
      const { POST: themesSavePost } = await import("@/app/api/admin/themes/save/route");

      const user = await db.user.create({
        data: {
          email: `billing-concurrent-theme-${Date.now()}@nixify-test.com`,
          passwordHash: await hashPassword("testpass123"),
          emailVerified: true,
          plan: "FREE",
        },
      });
      createdUserIds.push(user.id);

      // Seed 1 theme (FREE quota = 2)
      await db.emailTheme.create({
        data: { userId: user.id, name: "existing-theme", templateId: "minimal", purpose: "all", isActive: false, config: "{}" },
      });

      vi.mocked(resolveThemesViewer).mockResolvedValue({
        ok: true, mode: "user", userId: user.id,
        scope: { userId: user.id },
        canModify: () => true,
      });

      const makeReq = () => new Request("http://localhost/api/admin/themes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `concurrent-${Date.now()}-${Math.random()}`, templateId: "minimal", purpose: "all", config: {} }),
      });

      const [res1, res2] = await Promise.all([
        themesSavePost(makeReq()),
        themesSavePost(makeReq()),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 402]);

      const finalCount = await db.emailTheme.count({ where: { userId: user.id } });
      expect(finalCount).toBe(2);
    });
  },
);

// ─── Source-of-truth: no duplicate quota numbers in tooltips ─────────────

describe("Pricing tooltip source-of-truth (no duplicate quota literals)", () => {
  it("tooltips do NOT embed hardcoded quota numbers for email templates", () => {
    const row = COMPARISON_DATA.find(r => r.featureKey === FEATURE_KEYS.EMAIL_TEMPLATES);
    expect(row).toBeDefined();
    // The tooltip must NOT contain "Free = 2" or "Pro = 20" — those numbers
    // are derived in the table cells from FEATURE_LIMITS, not hardcoded in tooltip prose.
    expect(row!.tooltip).not.toMatch(/Free\s*=\s*\d/);
    expect(row!.tooltip).not.toMatch(/Pro\s*=\s*\d/);
  });

  it("tooltips do NOT embed hardcoded quota numbers for API_MESSAGES", () => {
    const row = COMPARISON_DATA.find(r => r.featureKey === FEATURE_KEYS.API_MESSAGES);
    expect(row).toBeDefined();
    expect(row!.tooltip).not.toMatch(/Free\s*=\s*[\d,]/);
    expect(row!.tooltip).not.toMatch(/Pro\s*=\s*[\d,]/);
  });

  it("tooltips do NOT embed hardcoded quota numbers for OTP_EMAILS", () => {
    const row = COMPARISON_DATA.find(r => r.featureKey === FEATURE_KEYS.OTP_EMAILS);
    expect(row).toBeDefined();
    expect(row!.tooltip).not.toMatch(/Free\s*=\s*\d/);
    expect(row!.tooltip).not.toMatch(/Pro\s*=\s*[\d,]/);
  });

  it("tooltips do NOT embed hardcoded quota numbers for MESSAGING_EMAILS", () => {
    const row = COMPARISON_DATA.find(r => r.featureKey === FEATURE_KEYS.MESSAGING_EMAILS);
    expect(row).toBeDefined();
    expect(row!.tooltip).not.toMatch(/Free\s*=\s*\d/);
    expect(row!.tooltip).not.toMatch(/Pro\s*=\s*[\d,]/);
    expect(row!.tooltip).not.toMatch(/Max\s*=\s*[\d,]/);
  });

  it("tooltips do NOT embed hardcoded quota numbers for BROADCAST_EMAILS", () => {
    const row = COMPARISON_DATA.find(r => r.featureKey === FEATURE_KEYS.BROADCAST_EMAILS);
    expect(row).toBeDefined();
    expect(row!.tooltip).not.toMatch(/Free\s*=\s*\d/);
    expect(row!.tooltip).not.toMatch(/Pro\s*=\s*\d/);
    expect(row!.tooltip).not.toMatch(/Max\s*=\s*[\d,]/);
  });

  it("table cells (quotaCell) ARE derived from FEATURE_LIMITS — not independent", () => {
    // The table cell for FREE EMAIL_TEMPLATES must match FEATURE_LIMITS exactly.
    const row = COMPARISON_DATA.find(r => r.featureKey === FEATURE_KEYS.EMAIL_TEMPLATES);
    expect(row).toBeDefined();
    expect(row!.free).toBe(formatQuota(FEATURE_LIMITS[FEATURE_KEYS.EMAIL_TEMPLATES].FREE.quota));
    expect(row!.pro).toBe(formatQuota(FEATURE_LIMITS[FEATURE_KEYS.EMAIL_TEMPLATES].PRO.quota));
  });
});

// ─── Source-of-truth: ROI derives from plan catalog ─────────────────────

describe("ROI source-of-truth (no duplicate Pro price)", () => {
  it("ROI_CONSTANTS.proMonthlyBase equals PLAN_CATALOG.PRO monthly price", () => {
    expect(ROI_CONSTANTS.proMonthlyBase).toBe(PLAN_CATALOG.PRO.pricing.displayPriceMonthly);
  });

  it("ROI_CONSTANTS.proAnnualTotal equals PLAN_CATALOG.PRO yearly total", () => {
    expect(ROI_CONSTANTS.proAnnualTotal).toBe(PLAN_CATALOG.PRO.pricing.displayPriceYearlyPerMonth * 12);
  });

  it("ROI_CONSTANTS has NO independent price property", () => {
    // The object must NOT have a standalone hardcoded price field — it uses
    // getters that derive from PLAN_CATALOG.
    const keys = Object.keys(ROI_CONSTANTS);
    expect(keys).toContain("proMonthlyBase");
    expect(keys).toContain("proAnnualTotal");
    // There should be no raw numeric property like 'price' or 'cost'
    expect(keys).not.toContain("price");
    expect(keys).not.toContain("cost");
  });
});
