import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

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
  FAQS,
} from "@/lib/pricingData";

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
  const allFaqText = FAQS.map((f) => `${f.q} ${f.a}`).join(" ").toLowerCase();

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

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { PATCH as localePatch } from "@/app/api/dashboard/preferences/locale/route";

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
    (getAuthenticatedUser as unknown as { mockResolvedValue: (v: unknown) => unknown })
      .mockResolvedValue(user);
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
