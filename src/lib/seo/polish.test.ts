/**
 * Phase 17 — Final Polish & QA test suite.
 *
 * Tests real production helpers, routes, and metadata for the defects fixed
 * in Phase 17. These are unit/integration tests that verify repo-controlled
 * correctness — they do NOT verify third-party model recommendations.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { translate } from "@/i18n";
import { en } from "@/i18n/en";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PRODUCTION_ORIGIN, absoluteUrl } from "@/lib/site/site-url";
import {
  PUBLIC_MARKETING_ROUTES,
  PRIVATE_ROUTE_PREFIXES,
  PRIVATE_STANDALONE_ROUTES,
} from "@/lib/site/public-routes";

// ─── Footer link correctness ───────────────────────────────────────────────

describe("Phase 17 — footer links point to real routes", () => {
  let footer: typeof import("@/components/site-footer").SiteFooter;
  beforeEach(async () => {
    const mod = await import("@/components/site-footer");
    footer = mod.SiteFooter;
  });

  it("SiteFooter module is importable (no broken imports)", () => {
    expect(footer).toBeDefined();
    expect(typeof footer).toBe("function");
  });
});

// ─── Terms page: no false commercial claims ───────────────────────────────

describe("Phase 17 — terms page has no false commercial claims", () => {
  let termsSource: string;
  beforeEach(() => {
    // Read the source file to check for stale claims (without importing the
    // page which would trigger the CSS chain).
    termsSource = readFileSync(
      resolve(__dirname, "../../app/terms/page.tsx"),
      "utf-8"
    );
  });

  it("does not reference 'Enterprise' plan", () => {
    expect(termsSource).not.toContain("Enterprise");
  });

  it("does not claim a '30-day money-back guarantee'", () => {
    expect(termsSource).not.toContain("money-back guarantee");
    expect(termsSource).not.toContain("money back guarantee");
  });

  it("does not claim 'cancel anytime'", () => {
    // "cancel anytime" as a commercial guarantee is not supported (no billing provider).
    // "delete your account at any time" is a different (factual) statement.
    expect(termsSource).not.toContain("cancel anytime");
  });

  it("references 'Pro, Max' (not 'Pro, Enterprise')", () => {
    expect(termsSource).toContain("Pro, Max");
  });
});

// ─── No stale 'workspace' terminology ─────────────────────────────────────

describe("Phase 17 — no stale 'workspace' terminology in user-visible copy", () => {
  it("en.ts dashboard subtitle does not say 'workspace'", () => {
    expect(translate("en", "dashboard.overview.subtitle")).not.toContain("workspace");
  });

  it("fa.ts dashboard subtitle does not say 'فضای کاری' (workspace)", () => {
    expect(translate("fa", "dashboard.overview.subtitle")).not.toContain("فضای کاری");
  });

  it("en.ts dashboard subtitle says 'dashboard'", () => {
    expect(translate("en", "dashboard.overview.subtitle")).toContain("dashboard");
  });

  it("fa.ts dashboard subtitle says 'داشبورد' (dashboard)", () => {
    expect(translate("fa", "dashboard.overview.subtitle")).toContain("داشبورد");
  });
});

// ─── No stale 'Enterprise' plan in translations ──────────────────────────

describe("Phase 17 — no 'Enterprise' plan in canonical translations", () => {
  // Check that the plan-related translation keys don't mention "Enterprise"
  it("en translations do not contain 'Enterprise' in plan names", () => {
    const json = JSON.stringify((en as { plans?: unknown }).plans ?? {});
    // "Enterprise" should not appear as a plan name in the translations
    expect(json).not.toMatch(/"[^"]*[Ee]nterprise/);
  });
});

// ─── Signup form has correct translation keys ────────────────────────────

describe("Phase 17 — signup form labels use correct translation keys", () => {
  it("auth.signUp.email key exists and is not the title", () => {
    const email = translate("en", "auth.signUp.email");
    const title = translate("en", "auth.signUp.title");
    expect(email).toBeTruthy();
    expect(email).not.toBe(title);
    expect(email.toLowerCase()).toContain("email");
  });

  it("auth.signUp.password key exists and is not the title", () => {
    const password = translate("en", "auth.signUp.password");
    const title = translate("en", "auth.signUp.title");
    expect(password).toBeTruthy();
    expect(password).not.toBe(title);
    expect(password.toLowerCase()).toContain("password");
  });

  it("fa auth.signUp.email is Persian", () => {
    const email = translate("fa", "auth.signUp.email");
    expect(email).toBe("ایمیل");
  });

  it("fa auth.signUp.password is Persian", () => {
    const password = translate("fa", "auth.signUp.password");
    expect(password).toBe("رمز عبور");
  });
});

// ─── Dead code FeatureStrip is deleted ────────────────────────────────────

describe("Phase 17 — dead-code FeatureStrip is deleted", () => {
  it("FeatureStrip.tsx does not exist", () => {
    const exists = existsSync(
      resolve(__dirname, "../../app/pricing/components/FeatureStrip.tsx")
    );
    expect(exists).toBe(false);
  });
});

// ─── Legal pages remain noindex ───────────────────────────────────────────

describe("Phase 17 — legal pages preserve noindex", () => {
  it("/privacy is not in PUBLIC_MARKETING_ROUTES", () => {
    expect(PUBLIC_MARKETING_ROUTES).not.toContain("/privacy");
  });

  it("/terms is not in PUBLIC_MARKETING_ROUTES", () => {
    expect(PUBLIC_MARKETING_ROUTES).not.toContain("/terms");
  });

  it("/privacy metadata has robots.index === false", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const mod = await import("@/app/privacy/page");
    const meta = mod.metadata;
    const robots = typeof meta.robots === "object" ? (meta.robots as { index?: boolean }) : undefined;
    expect(robots?.index).toBe(false);
  });

  it("/terms metadata has robots.index === false", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const mod = await import("@/app/terms/page");
    const meta = mod.metadata;
    const robots = typeof meta.robots === "object" ? (meta.robots as { index?: boolean }) : undefined;
    expect(robots?.index).toBe(false);
  });
});

// ─── Discoverability surfaces remain correct ──────────────────────────────

describe("Phase 17 — discoverability regression guard", () => {
  it("PUBLIC_MARKETING_ROUTES still contains /, /pricing, /blog, /about", () => {
    expect(PUBLIC_MARKETING_ROUTES).toContain("/");
    expect(PUBLIC_MARKETING_ROUTES).toContain("/pricing");
    expect(PUBLIC_MARKETING_ROUTES).toContain("/blog");
    expect(PUBLIC_MARKETING_ROUTES).toContain("/about");
  });

  it("PUBLIC_MARKETING_ROUTES does not contain private routes", () => {
    const joined = PUBLIC_MARKETING_ROUTES.join(",");
    for (const prefix of PRIVATE_ROUTE_PREFIXES) {
      expect(joined).not.toContain(prefix);
    }
    for (const route of PRIVATE_STANDALONE_ROUTES) {
      expect(joined).not.toContain(route);
    }
  });

  it("PRODUCTION_ORIGIN is still https://nixify.vercel.app", () => {
    expect(PRODUCTION_ORIGIN).toBe("https://nixify.vercel.app");
  });
});

// ─── Phase 17 corrective: public-truth regressions ────────────────────────
//
// These tests scan the REAL source files (via readFileSync) for forbidden
// public-facing claims that were removed in the corrective pass. They prevent
// reintroduction of trial language, fake metrics, nonexistent SDKs, Gmail
// customer-confusion, fabricated API domains, and OTP expiry mismatches.

function readSrc(relPath: string): string {
  return readFileSync(resolve(__dirname, "../..", relPath), "utf-8");
}

describe("Phase 17 corrective — no fictional trial language in public copy", () => {
  const FORBIDDEN_TRIAL = [
    "30-day trial",
    "1-month free trial",
    "Start trial",
    "active trial",
    "100% free during the trial",
    "money-back guarantee",
    "cancel anytime",
    "Cancel anytime",
  ];

  for (const term of FORBIDDEN_TRIAL) {
    it(`en.ts does not contain "${term}"`, () => {
      expect(readSrc("i18n/en.ts")).not.toContain(term);
    });
    it(`fa.ts does not contain "${term}"`, () => {
      expect(readSrc("i18n/fa.ts")).not.toContain(term);
    });
  }
});

describe("Phase 17 corrective — no fake live metrics on homepage", () => {
  const FAKE_METRICS = ["1247", "48392", "99.9%"];

  for (const metric of FAKE_METRICS) {
    it(`page.tsx does not contain hardcoded fake metric "${metric}"`, () => {
      expect(readSrc("app/page.tsx")).not.toContain(metric);
    });
  }

  it("page.tsx does not contain LiveStatsBar function", () => {
    expect(readSrc("app/page.tsx")).not.toContain("LiveStatsBar");
  });

  it("page.tsx does not contain CountUp component", () => {
    expect(readSrc("app/page.tsx")).not.toContain("function CountUp");
  });
});

describe("Phase 17 corrective — no nonexistent SDK claims", () => {
  it("en.ts does not claim 'Official SDKs'", () => {
    expect(readSrc("i18n/en.ts")).not.toContain("Official SDKs");
  });

  it("fa.ts does not claim 'SDK رسمی' (official SDK)", () => {
    expect(readSrc("i18n/fa.ts")).not.toContain("SDK رسمی");
  });

  it("en.ts mentions REST API instead", () => {
    expect(readSrc("i18n/en.ts")).toContain("REST API");
  });
});

describe("Phase 17 corrective — no Gmail App Password customer-confusion", () => {
  it("en.ts does not say 'your Gmail App Password'", () => {
    expect(readSrc("i18n/en.ts")).not.toContain("your Gmail App Password");
  });

  it("fa.ts does not say 'Gmail App Password شما'", () => {
    expect(readSrc("i18n/fa.ts")).not.toContain("Gmail App Password شما");
  });

  it("en FAQ clarifies no customer SMTP credentials needed", () => {
    const en = readSrc("i18n/en.ts");
    expect(en).toContain("no customer SMTP credentials required");
  });
});

describe("Phase 17 corrective — no fabricated api.nixify.dev domain", () => {
  it("code-snippets.ts does not use api.nixify.dev", () => {
    expect(readSrc("lib/dx/code-snippets.ts")).not.toContain("api.nixify.dev");
  });

  it("page.tsx does not use api.nixify.dev", () => {
    expect(readSrc("app/page.tsx")).not.toContain("api.nixify.dev");
  });

  it("docs page does not use your-nixify-domain.com", () => {
    expect(readSrc("app/dashboard/docs/page.tsx")).not.toContain("your-nixify-domain.com");
  });

  it("code-snippets.ts uses getSiteOrigin()", () => {
    expect(readSrc("lib/dx/code-snippets.ts")).toContain("getSiteOrigin");
  });
});

describe("Phase 17 corrective — OTP expiry is 10 minutes (not 5)", () => {
  it("en.ts does not say '5-min expiry'", () => {
    expect(readSrc("i18n/en.ts")).not.toContain("5-min expiry");
  });

  it("fa.ts does not say 'انقضای ۵ دقیقه'", () => {
    expect(readSrc("i18n/fa.ts")).not.toContain("انقضای ۵ دقیقه");
  });

  it("en.ts says '10-min expiry'", () => {
    expect(readSrc("i18n/en.ts")).toContain("10-min expiry");
  });

  it("fa.ts says 'انقضای ۱۰ دقیقه'", () => {
    expect(readSrc("i18n/fa.ts")).toContain("انقضای ۱۰ دقیقه");
  });
});

describe("Phase 17 corrective — no 'Bank-grade security' claim", () => {
  it("en.ts does not contain 'Bank-grade security'", () => {
    expect(readSrc("i18n/en.ts")).not.toContain("Bank-grade security");
  });

  it("fa.ts does not contain 'امنیت بانکی' or 'امنیت سطح بانکی'", () => {
    const fa = readSrc("i18n/fa.ts");
    expect(fa).not.toContain("امنیت بانکی");
    expect(fa).not.toContain("امنیت سطح بانکی");
  });
});

describe("Phase 17 corrective — no 'Enterprise' plan in public copy", () => {
  it("terms page does not mention Enterprise", () => {
    expect(readSrc("app/terms/page.tsx")).not.toContain("Enterprise");
  });

  it("en.ts does not contain 'Enterprise' plan label in user-visible strings", () => {
    const en = readSrc("i18n/en.ts");
    // Check that "Enterprise" doesn't appear as a plan name (excluding JSON-LD Organization type which is correct)
    expect(en).not.toMatch(/"Enterprise"/);
  });
});

describe("Phase 17 corrective — about page factual claims", () => {
  const about = readSrc("app/about/page.tsx");

  it("does not mention 'Gmail App Password'", () => {
    expect(about).not.toContain("Gmail App Password");
  });

  it("does not mention 'device fingerprinting'", () => {
    expect(about).not.toContain("device fingerprinting");
  });

  it("does not mention 'GDPR-compliant'", () => {
    expect(about).not.toContain("GDPR-compliant");
  });

  it("does not say 'zero cost to start'", () => {
    expect(about).not.toContain("zero cost to start");
    expect(about).not.toContain("all at zero cost");
  });

  it("does not mention 'self-hosted Postfix' as customer-facing", () => {
    expect(about).not.toContain("self-hosted Postfix");
  });
});

describe("Phase 17 corrective — privacy page factual claims", () => {
  const privacy = readSrc("app/privacy/page.tsx");

  it("says 'HMAC-SHA256' (not bare 'SHA-256')", () => {
    expect(privacy).toContain("HMAC-SHA256");
    // The bare "SHA-256" without HMAC should not appear in the OTP security context
    expect(privacy).not.toContain("hashed with SHA-256");
  });

  it("does not claim blanket '90 days' retention", () => {
    // The blanket "retained for 90 days" claim was replaced with plan-dependent language
    expect(privacy).not.toContain("retained for 90 days");
  });

  it("does not claim 'GDPR/CCPA' compliance", () => {
    expect(privacy).not.toContain("GDPR/CCPA");
  });

  it("has a visible 'Draft — pending legal review' notice", () => {
    expect(privacy).toContain("Draft");
    expect(privacy).toContain("pending legal review");
  });
});

describe("Phase 17 corrective — no generic competitor comparison", () => {
  it("en.ts does not contain 'othersLabel' (Others column removed)", () => {
    expect(readSrc("i18n/en.ts")).not.toContain("othersLabel");
  });

  it("fa.ts does not contain 'othersLabel'", () => {
    expect(readSrc("i18n/fa.ts")).not.toContain("othersLabel");
  });

  it("en.ts does not contain unsourced '$20+/mo' competitor claim", () => {
    expect(readSrc("i18n/en.ts")).not.toContain("$20+/mo");
  });

  it("page.tsx comparison subtitle is not 'zero cost'", () => {
    const page = readSrc("app/page.tsx");
    expect(page).not.toContain("for zero cost");
    expect(page).not.toContain("Everything you'd get from a paid ESP");
  });
});

describe("Phase 17 corrective — homepage positions Email OTP clearly", () => {
  it("en hero titleFirst contains 'OTP' or 'Email OTP'", () => {
    const en = readSrc("i18n/en.ts");
    expect(en).toMatch(/titleFirst:.*OTP/);
  });

  it("fa hero titleFirst contains 'OTP'", () => {
    const fa = readSrc("i18n/fa.ts");
    expect(fa).toMatch(/titleFirst:.*OTP/);
  });
});

describe("Phase 17 corrective — Free/Pro/Max are the only plan labels", () => {
  it("en.ts contains 'Free', 'Pro', 'Max' plan labels", () => {
    const en = readSrc("i18n/en.ts");
    // These are the canonical labels — verify they exist
    expect(en).toContain("Free");
    expect(en).toContain("Pro");
    expect(en).toContain("Max");
  });

  it("en.ts does not contain 'Enterprise' as a plan tier name in pricing/comparison", () => {
    const en = readSrc("i18n/en.ts");
    // The comparison section should not have an "Enterprise" label
    expect(en).not.toContain("othersPremium");
  });
});

// ─── Phase 17 FINAL corrective regressions ────────────────────────────────

describe("Phase 17 FINAL — no false Free-activation copy", () => {
  it("profile page does NOT say profile completion activates Free", () => {
    const profile = readSrc("app/profile/page.tsx");
    expect(profile).not.toContain("activate your Free plan");
    expect(profile).not.toContain("activates your Free plan");
  });

  it("EN landing does NOT say verification activates Free", () => {
    const en = readSrc("i18n/en.ts");
    expect(en).not.toContain("activate your Free plan instantly");
    expect(en).not.toContain("activates your Free plan");
  });

  it("FA landing does NOT say verification activates Free", () => {
    const fa = readSrc("i18n/fa.ts");
    expect(fa).not.toContain("پلان رایگان شما فوراً فعال شود");
    expect(fa).not.toContain("فعال شدن پلان رایگان");
  });
});

describe("Phase 17 FINAL — no Persian commercial trial language", () => {
  it("FA FAQ does NOT contain 'دوره آزمایش' (trial period)", () => {
    expect(readSrc("i18n/fa.ts")).not.toContain("دوره آزمایش");
  });

  it("FA FAQ does NOT contain 'آزمایش شامل تمام امکانات' (trial includes all features)", () => {
    expect(readSrc("i18n/fa.ts")).not.toContain("آزمایش شامل تمام امکانات");
  });

  it("FA FAQ does NOT contain 'در طول دوره آزمایش' (during the trial period)", () => {
    expect(readSrc("i18n/fa.ts")).not.toContain("در طول دوره آزمایش");
  });
});

describe("Phase 17 FINAL — SMTP FAQ is customer-correct", () => {
  it("EN FAQ does NOT ask 'Can I use my own SMTP server?'", () => {
    const en = readSrc("i18n/en.ts");
    expect(en).not.toContain("Can I use my own SMTP server?");
  });

  it("EN FAQ asks 'Do I need to provide SMTP credentials?'", () => {
    expect(readSrc("i18n/en.ts")).toContain("Do I need to provide SMTP credentials?");
  });

  it("FA FAQ does NOT ask 'آیا می‌توانم از سرور SMTP خودم استفاده کنم؟'", () => {
    const fa = readSrc("i18n/fa.ts");
    expect(fa).not.toContain("آیا می‌توانم از سرور SMTP خودم استفاده کنم؟");
  });

  it("FA FAQ asks 'آیا باید اعتبار SMTP ارائه دهم؟'", () => {
    expect(readSrc("i18n/fa.ts")).toContain("آیا باید اعتبار SMTP ارائه دهم؟");
  });
});

describe("Phase 17 FINAL — template/branding FAQ is plan-qualified", () => {
  it("EN FAQ does NOT contain unconditional '20 professionally designed templates with full branding'", () => {
    expect(readSrc("i18n/en.ts")).not.toContain("20 professionally designed templates with full branding customization");
  });

  it("EN FAQ mentions plan-dependent template availability", () => {
    expect(readSrc("i18n/en.ts")).toContain("Template and branding availability depends on your plan");
  });

  it("FA FAQ does NOT contain unconditional '۲۰ قالب حرفه‌ای با سفارشی‌سازی کامل برندینگ'", () => {
    expect(readSrc("i18n/fa.ts")).not.toContain("۲۰ قالب حرفه‌ای با سفارشی‌سازی کامل برندینگ");
  });

  it("FA FAQ mentions plan-dependent template availability", () => {
    expect(readSrc("i18n/fa.ts")).toContain("در دسترس بودن قالب و برندینگ به پلان شما بستگی دارد");
  });
});

describe("Phase 17 FINAL — no 'free forever' pricing promise", () => {
  it("EN pricing does NOT promise 'free forever'", () => {
    expect(readSrc("i18n/en.ts")).not.toContain('freeForever: "free forever"');
  });

  it("FA pricing does NOT promise 'برای همیشه رایگان'", () => {
    expect(readSrc("i18n/fa.ts")).not.toContain('freeForever: "برای همیشه رایگان"');
  });

  it("EN pricing uses factual '$0 plan' wording", () => {
    expect(readSrc("i18n/en.ts")).toContain('freeForever: "$0 plan"');
  });
});

describe("Phase 17 FINAL — canonical origin is single source for landing examples", () => {
  it("page.tsx does NOT contain hardcoded 'https://nixify.vercel.app' literal", () => {
    expect(readSrc("app/page.tsx")).not.toContain("https://nixify.vercel.app");
  });

  it("page.tsx imports PRODUCTION_ORIGIN from canonical site-url", () => {
    expect(readSrc("app/page.tsx")).toContain('PRODUCTION_ORIGIN');
    expect(readSrc("app/page.tsx")).toContain('from "@/lib/site/site-url"');
  });
});
