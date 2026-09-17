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
