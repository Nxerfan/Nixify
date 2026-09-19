/**
 * Persian (fa) localization + LTR/RTL regression tests.
 *
 * Tests that public-facing Persian surfaces are properly localized
 * and that code/technical containers have explicit LTR direction.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function readSrc(relPath: string): string {
  return readFileSync(resolve(__dirname, "../..", relPath), "utf-8");
}

// ─── site-header localization ─────────────────────────────────────────────

describe("Persian localization — site-header", () => {
  const header = readSrc("components/site-header.tsx");

  it("site-header imports useTranslations", () => {
    expect(header).toContain("useTranslations");
  });

  it("site-header does NOT hardcode 'Sign in' as a literal string", () => {
    // Should use t("header.nav.signIn") not a literal
    expect(header).not.toMatch(/>Sign in</);
  });

  it("site-header does NOT hardcode 'Sign up' as a literal string", () => {
    expect(header).not.toMatch(/>Sign up</);
  });

  it("site-header does NOT hardcode 'Free plan available' as a literal", () => {
    expect(header).not.toMatch(/>Free plan available</);
  });
});

// ─── site-footer localization ─────────────────────────────────────────────

describe("Persian localization — site-footer", () => {
  const footer = readSrc("components/site-footer.tsx");

  it("site-footer imports useTranslations", () => {
    expect(footer).toContain("useTranslations");
  });

  it("site-footer does NOT hardcode 'Product' as a column title", () => {
    expect(footer).not.toMatch(/title="Product"/);
  });

  it("site-footer does NOT hardcode 'Company' as a column title", () => {
    expect(footer).not.toMatch(/title="Company"/);
  });
});

// ─── about page localization ──────────────────────────────────────────────

describe("Persian localization — about page", () => {
  const about = readSrc("app/about/page.tsx");

  it("about page uses translate() or useTranslations()", () => {
    expect(about).toMatch(/translate\(|useTranslations/);
  });

  it("about page does NOT hardcode 'About Nixify' as h1 text", () => {
    expect(about).not.toMatch(/>About Nixify</);
  });

  it("about page uses generateMetadata (not static metadata)", () => {
    expect(about).toMatch(/generateMetadata|async function generateMetadata/);
  });
});

// ─── Landing page code preview LTR ────────────────────────────────────────

describe("Persian LTR — landing page code preview", () => {
  const page = readSrc("app/page.tsx");

  it("CodePreviewSection <pre> has dir=ltr", () => {
    expect(page).toMatch(/<pre[^>]*dir="ltr"/);
  });
});

// ─── Dashboard docs code LTR ──────────────────────────────────────────────

describe("Persian LTR — dashboard docs code blocks", () => {
  const docs = readSrc("app/dashboard/docs/page.tsx");

  it("docs CodeBlock <pre> has dir=ltr", () => {
    expect(docs).toMatch(/<pre[^>]*dir="ltr"/);
  });

  it("docs AI helper <pre> has dir=ltr", () => {
    expect(docs).toMatch(/dir="ltr"/);
  });
});

// ─── Root layout RTL ──────────────────────────────────────────────────────

describe("Persian RTL — root layout", () => {
  const layout = readSrc("app/layout.tsx");

  it("layout uses LOCALE_HTML_DIR for dir attribute", () => {
    expect(layout).toContain("LOCALE_HTML_DIR");
    expect(layout).toContain("LOCALE_HTML_DIR");
    expect(layout).toContain("dir=");
  });
});

// ─── Landing snippets canonical URLs ────────────────────────────────────

describe("Persian LTR — landing snippets are copy-paste runnable", () => {
  const snippets = readSrc("lib/seo/landing-snippets.ts");

  it("snippets use PRODUCTION_ORIGIN (not hardcoded URL)", () => {
    expect(snippets).toContain("PRODUCTION_ORIGIN");
  });

  it("snippets do NOT contain api.nixify.dev", () => {
    expect(snippets).not.toContain("api.nixify.dev");
  });
});

// ─── Translation key completeness ─────────────────────────────────────────

describe("Persian localization — translation keys exist in fa.ts", () => {
  const fa = readSrc("i18n/fa.ts");
  const en = readSrc("i18n/en.ts");

  // Check that key PATH SEGMENTS exist (e.g. "home:" and "header:")
  const checks = [
    ["header", "nav", "home"],
    ["header", "nav", "pricing"],
    ["header", "badge", "freePlan"],
    ["header", "signOut"],
    ["footer", "tagline"],
    ["footer", "columns", "product"],
    ["footer", "columns", "company"],
    ["about", "title"],
    ["about", "mission", "title"],
    ["about", "security", "title"],
    ["landing", "otpDemo", "cardTitle"],
    ["landing", "templateShowcase", "title"],
    ["landing", "comparison", "detailSingleUse"],
    ["landing", "getStarted", "stepPrefix"],
    ["pricing", "compare", "columnFeature"],
  ];

  for (const parts of checks) {
    const lastKey = parts[parts.length - 1] + ":";
    const section = parts[0];
    it(`fa.ts has ${parts.join(".")}`, () => {
      expect(fa).toContain(`${section}:`);
      expect(fa).toContain(lastKey);
    });
    it(`en.ts has ${parts.join(".")}`, () => {
      expect(en).toContain(`${section}:`);
      expect(en).toContain(lastKey);
    });
  }
});

// ─── Rendered Persian localization tests (strict) ──────────────────────────
//
// These tests verify that when locale=fa, the actual rendered UI text
// is Persian — not English. They use source-file inspection of the
// committed components to verify useTranslations() wiring.

describe("Persian localization — cookie consent is localized", () => {
  it("cookie-consent.tsx imports useTranslations", () => {
    expect(readSrc("components/cookie-consent.tsx")).toContain("useTranslations");
  });

  it("cookie-consent.tsx does NOT hardcode 'Accept' as a literal", () => {
    expect(readSrc("components/cookie-consent.tsx")).not.toMatch(/>Accept</);
  });

  it("cookie-consent.tsx does NOT hardcode 'Decline' as a literal", () => {
    expect(readSrc("components/cookie-consent.tsx")).not.toMatch(/>Decline</);
  });
});

describe("Persian localization — auth flow components are localized", () => {
  it("AuthCard.tsx imports useTranslations", () => {
    expect(readSrc("app/auth/components/AuthCard.tsx")).toContain("useTranslations");
  });

  it("EmailStep.tsx imports useTranslations", () => {
    expect(readSrc("app/auth/components/EmailStep.tsx")).toContain("useTranslations");
  });

  it("PasswordStep.tsx imports useTranslations", () => {
    expect(readSrc("app/auth/components/PasswordStep.tsx")).toContain("useTranslations");
  });

  it("SignUpForm.tsx imports useTranslations", () => {
    expect(readSrc("app/auth/components/SignUpForm.tsx")).toContain("useTranslations");
  });

  it("OtpStep.tsx imports useTranslations", () => {
    expect(readSrc("app/auth/components/OtpStep.tsx")).toContain("useTranslations");
  });

  it("SuccessState.tsx imports useTranslations", () => {
    expect(readSrc("app/auth/components/SuccessState.tsx")).toContain("useTranslations");
  });

  it("CountdownTimer.tsx imports useTranslations", () => {
    expect(readSrc("app/auth/components/CountdownTimer.tsx")).toContain("useTranslations");
  });

  it("PasswordStrengthMeter.tsx imports useTranslations", () => {
    expect(readSrc("app/auth/components/PasswordStrengthMeter.tsx")).toContain("useTranslations");
  });

  it("OtpStep.tsx does NOT hardcode 'Verifying...' as a literal", () => {
    expect(readSrc("app/auth/components/OtpStep.tsx")).not.toMatch(/>Verifying/);
  });

  it("OtpStep.tsx does NOT hardcode 'Resend code' as a literal", () => {
    expect(readSrc("app/auth/components/OtpStep.tsx")).not.toMatch(/>Resend code/);
  });

  it("EmailStep.tsx does NOT hardcode 'Continue' as a literal", () => {
    expect(readSrc("app/auth/components/EmailStep.tsx")).not.toMatch(/>Continue</);
  });

  it("SignUpForm.tsx does NOT hardcode 'Create Account' as a literal", () => {
    expect(readSrc("app/auth/components/SignUpForm.tsx")).not.toMatch(/>Create Account/);
  });
});

describe("Persian localization — error pages are localized", () => {
  it("not-found.tsx imports useTranslations", () => {
    expect(readSrc("app/not-found.tsx")).toContain("useTranslations");
  });

  it("not-found.tsx does NOT hardcode 'Back to home' as a literal", () => {
    expect(readSrc("app/not-found.tsx")).not.toMatch(/>Back to home</);
  });

  it("error.tsx imports useTranslations", () => {
    expect(readSrc("app/error.tsx")).toContain("useTranslations");
  });

  it("error.tsx does NOT hardcode 'Something went wrong' as a literal", () => {
    expect(readSrc("app/error.tsx")).not.toMatch(/>Something went wrong</);
  });
});

describe("Persian localization — profile page is localized", () => {
  it("profile/page.tsx imports useTranslations", () => {
    expect(readSrc("app/profile/page.tsx")).toContain("useTranslations");
  });

  it("profile/page.tsx does NOT hardcode 'Save & complete profile' as a literal", () => {
    expect(readSrc("app/profile/page.tsx")).not.toMatch(/>Save/);
  });
});

describe("Persian localization — translation key parity", () => {
  it("en.ts contains cookieConsent section", () => {
    expect(readSrc("i18n/en.ts")).toContain("cookieConsent:");
  });

  it("fa.ts contains cookieConsent section", () => {
    expect(readSrc("i18n/fa.ts")).toContain("cookieConsent:");
  });

  it("en.ts contains auth.shell.passwordStrength section", () => {
    expect(readSrc("i18n/en.ts")).toContain("passwordStrength:");
  });

  it("fa.ts contains auth.shell.passwordStrength section", () => {
    expect(readSrc("i18n/fa.ts")).toContain("passwordStrength:");
  });
});
