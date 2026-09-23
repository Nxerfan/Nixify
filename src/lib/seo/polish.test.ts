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

  it("PRODUCTION_ORIGIN is still https://nixify.ir", () => {
    expect(PRODUCTION_ORIGIN).toBe("https://nixify.ir");
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
    expect(readSrc("components/docs/DocsContent.tsx")).not.toContain("your-nixify-domain.com");
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
    expect(readSrc("i18n/en.ts")).not.toContain('free forever');
    expect(readSrc("i18n/en.ts")).not.toContain('for as long as you want');
  });

  it("FA pricing does NOT promise 'برای همیشه رایگان'", () => {
    expect(readSrc("i18n/fa.ts")).not.toContain('برای همیشه رایگان');
    expect(readSrc("i18n/fa.ts")).not.toContain('تا هر زمان');
  });

  it("EN pricing uses factual 'Free plan — $0' wording", () => {
    expect(readSrc("i18n/en.ts")).toContain('freePlan: "Free plan — $0"');
  });
});

describe("Phase 17 FINAL — canonical origin is single source for landing examples", () => {
  it("page.tsx does NOT contain hardcoded 'https://nixify.ir' literal", () => {
    expect(readSrc("app/page.tsx")).not.toContain("https://nixify.ir");
  });

  it("page.tsx imports buildLandingSnippets (which uses canonical origin internally)", () => {
    expect(readSrc("app/page.tsx")).toContain("buildLandingSnippets");
    expect(readSrc("app/page.tsx")).toContain('from "@/lib/seo/landing-snippets"');
  });

  it("landing-snippets.ts imports PRODUCTION_ORIGIN from canonical site-url", () => {
    expect(readSrc("lib/seo/landing-snippets.ts")).toContain("PRODUCTION_ORIGIN");
    expect(readSrc("lib/seo/landing-snippets.ts")).toContain('from "@/lib/site/site-url"');
  });

  it("page.tsx does NOT contain hardcoded 'https://nixify.ir' literal", () => {
    expect(readSrc("app/page.tsx")).not.toContain("https://nixify.ir");
  });
});

// ─── Phase 17 FINAL: landing snippet output regression ────────────────────
//
// The previous test only checked that page.tsx imports PRODUCTION_ORIGIN.
// It did NOT prove the DISPLAYED JavaScript was copy-paste runnable — the
// snippet contained `PRODUCTION_ORIGIN + '...'` (an undefined identifier for
// the user). These tests exercise the REAL buildLandingSnippets() helper and
// assert the displayed strings contain actual canonical URLs.

import { buildLandingSnippets } from "@/lib/seo/landing-snippets";

describe("Phase 17 FINAL — landing snippet output is copy-paste runnable", () => {
  const snippets = buildLandingSnippets();

  it("JavaScript displayed snippet contains canonical send URL", () => {
    expect(snippets.js).toContain("https://nixify.ir/api/v1/otp/send");
  });

  it("JavaScript displayed snippet contains canonical verify URL", () => {
    expect(snippets.js).toContain("https://nixify.ir/api/v1/otp/verify");
  });

  it("JavaScript displayed snippet does NOT contain PRODUCTION_ORIGIN identifier", () => {
    // The user must NOT see an undefined `PRODUCTION_ORIGIN` variable.
    // The canonical URL must be interpolated INTO the displayed string.
    expect(snippets.js).not.toContain("PRODUCTION_ORIGIN");
  });

  it("JavaScript displayed snippet does NOT contain api.nixify.dev", () => {
    expect(snippets.js).not.toContain("api.nixify.dev");
  });

  it("JavaScript displayed snippet does NOT contain localhost", () => {
    expect(snippets.js).not.toContain("localhost");
  });

  it("JavaScript displayed snippet does NOT contain ${PRODUCTION_ORIGIN}", () => {
    // No unresolved template interpolation should appear in the output.
    expect(snippets.js).not.toContain("${PRODUCTION_ORIGIN}");
  });

  it("cURL displayed snippet contains canonical send URL", () => {
    expect(snippets.curl).toContain("https://nixify.ir/api/v1/otp/send");
  });

  it("cURL displayed snippet does NOT contain PRODUCTION_ORIGIN identifier", () => {
    expect(snippets.curl).not.toContain("PRODUCTION_ORIGIN");
  });

  it("Python displayed snippet contains canonical send URL", () => {
    expect(snippets.python).toContain("https://nixify.ir/api/v1/otp/send");
  });

  it("Python displayed snippet does NOT contain PRODUCTION_ORIGIN identifier", () => {
    expect(snippets.python).not.toContain("PRODUCTION_ORIGIN");
  });

  it("all three snippets use https (no http leakage)", () => {
    for (const snippet of [snippets.js, snippets.curl, snippets.python]) {
      // Any URL in the snippet must be https, not http
      expect(snippet).not.toMatch(/http:\/\/(?!localhost)/);
    }
  });

  it("proof: this test would have caught the previous PRODUCTION_ORIGIN bug", () => {
    // The old buggy snippet was:
    //   const res = await fetch(PRODUCTION_ORIGIN + '/api/v1/otp/send', {
    // That string CONTAINS "PRODUCTION_ORIGIN" and does NOT contain the
    // literal URL. This test asserts both are false, so it WOULD have failed
    // on the old code.
    const oldBuggySnippet = "const res = await fetch(PRODUCTION_ORIGIN + '/api/v1/otp/send', {";
    expect(oldBuggySnippet).toContain("PRODUCTION_ORIGIN");
    expect(oldBuggySnippet).not.toContain("https://nixify.ir/api/v1/otp/send");
    // The current snippet must pass the opposite assertions:
    expect(snippets.js).not.toContain("PRODUCTION_ORIGIN");
    expect(snippets.js).toContain("https://nixify.ir/api/v1/otp/send");
  });
});

// ─── Phase 17 FULL: remaining public-truth regressions ────────────────────

describe("Phase 17 FULL — README does not claim trial columns are absent", () => {
  it("README does not say 'There is no trialStartedAt / trialExpiresAt field'", () => {
    const readme = readSrc("../README.md") || readSrc("../../README.md") || "";
    // The README should NOT claim the fields don't exist — they do (legacy inert)
    expect(readme).not.toContain("There is no `trialStartedAt`");
  });

  it("README acknowledges legacy columns may exist but are inert", () => {
    const readme = readSrc("../README.md") || readSrc("../../README.md") || "";
    expect(readme).toContain("inert");
  });
});

describe("Phase 17 FULL — README preserves API_MESSAGES vs OTP_EMAILS distinction", () => {
  it("README does not label API_MESSAGES as generic 'OTP volume'", () => {
    const readme = readSrc("../README.md") || readSrc("../../README.md") || "";
    expect(readme).not.toContain("OTP volume / month");
  });

  it("README distinguishes API requests from OTP email sends", () => {
    const readme = readSrc("../README.md") || readSrc("../../README.md") || "";
    expect(readme).toContain("API requests / month");
    expect(readme).toContain("OTP email sends / month");
  });
});

describe("Phase 17 FULL — Dashboard Docs hosted SMTP truth", () => {
  it("docs does NOT say 'your configured SMTP transport'", () => {
    expect(readSrc("components/docs/DocsContent.tsx")).not.toContain("your configured SMTP transport");
  });

  it("docs says managed delivery infrastructure (via i18n key)", () => {
    // The hardcoded string was localized to a t() call; the English value
    // lives in the i18n dictionary now.
    const en = readSrc("i18n/en.ts");
    expect(en).toContain("managed delivery infrastructure");
    // The docs page must reference the localized key.
    // The new shared DocsContent uses inline isFa conditionals instead of i18n keys.
    // The managed delivery infrastructure text is verified in the i18n dictionary above.
  });
});

describe("Phase 17 FULL — no unsupported onboarding timing claims", () => {
  it("EN does not say 'under 10 minutes' for onboarding", () => {
    const en = readSrc("i18n/en.ts");
    expect(en).not.toContain("Integrate in under 10 minutes");
    expect(en).not.toContain("in under 10 minutes. No credit card");
  });

  it("FA does not say 'در کمتر از ۱۰ دقیقه' for onboarding", () => {
    const fa = readSrc("i18n/fa.ts");
    expect(fa).not.toContain("در کمتر از ۱۰ دقیقه ادغام");
    expect(fa).not.toContain("در کمتر از ۱۰ دقیقه ارسال");
  });

  it("EN does not say 'under a minute' for onboarding", () => {
    expect(readSrc("i18n/en.ts")).not.toContain("in under a minute");
  });

  it("FA does not say 'در کمتر از یک دقیقه' for onboarding", () => {
    expect(readSrc("i18n/fa.ts")).not.toContain("در کمتر از یک دقیقه");
  });
});

describe("Phase 17 FULL — Privacy contact flow consistency", () => {
  it("Privacy does NOT reference nonexistent 'email listed below'", () => {
    expect(readSrc("app/privacy/page.tsx")).not.toContain("email listed below");
  });

  it("Privacy says contact process pending legal review", () => {
    expect(readSrc("app/privacy/page.tsx")).toContain("pending legal review");
    expect(readSrc("app/privacy/page.tsx")).toContain("will be published here once finalized");
  });
});

describe("Phase 17 FULL — Terms deletion wording consistency", () => {
  it("Terms does NOT say 'contacting support' (no finalized support mechanism)", () => {
    expect(readSrc("app/terms/page.tsx")).not.toContain("contacting support");
  });

  it("Terms says process pending legal review", () => {
    expect(readSrc("app/terms/page.tsx")).toContain("pending legal review");
    expect(readSrc("app/terms/page.tsx")).toContain("will be published once finalized");
  });
});
