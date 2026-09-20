/**
 * Regression tests for UX-A: dashboard navigation, sidebar active-state,
 * language switcher persistence, and Persian UI coverage.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function readSrc(relPath: string): string {
  return readFileSync(resolve(__dirname, "../..", relPath), "utf-8");
}

const SIDEBAR = readSrc("app/dashboard/components/Sidebar.tsx");
const SITE_HEADER = readSrc("components/site-header.tsx");
const EN_TS = readSrc("i18n/en.ts");
const FA_TS = readSrc("i18n/fa.ts");

describe("UX-A — sidebar active-state logic", () => {
  it("derives active state from usePathname (not hardcoded)", () => {
    expect(SIDEBAR).toContain("usePathname");
    expect(SIDEBAR).toContain("isActive(pathname");
    // The old hardcoded `active: true` on Dashboard must be gone.
    expect(SIDEBAR).not.toContain("active: true");
    expect(SIDEBAR).not.toContain("active: false");
  });

  it("/dashboard is active ONLY on the exact root", () => {
    expect(SIDEBAR).toContain('href === "/dashboard"');
    expect(SIDEBAR).toContain('pathname === "/dashboard"');
  });

  it("nested routes keep parent active via startsWith", () => {
    expect(SIDEBAR).toContain("startsWith(href + \"/\")");
  });

  it("Dashboard is never active while inside other sections", () => {
    // The isActive function must NOT match /dashboard for paths like
    // /dashboard/broadcasts — only exact match for /dashboard.
    const fnBody = SIDEBAR.match(/function isActive[\s\S]*?^}/m)?.[0] ?? "";
    expect(fnBody).toContain('pathname === "/dashboard"');
    // Must NOT use startsWith for /dashboard (which would match nested routes)
    expect(fnBody).not.toContain('startsWith("/dashboard")');
  });
});

describe("UX-A — sidebar real user info + actions", () => {
  it("removes fake Alex Morgan / Pro plan identity", () => {
    expect(SIDEBAR).not.toContain("Alex Morgan");
    expect(SIDEBAR).not.toContain("Pro plan");
    expect(SIDEBAR).not.toContain("AM");
  });

  it("fetches real user data from /api/profile/me", () => {
    expect(SIDEBAR).toContain("/api/profile/me");
    expect(SIDEBAR).toContain("setUser");
  });

  it("has Settings + Sign out actions in the footer", () => {
    expect(SIDEBAR).toContain("handleSignOut");
    expect(SIDEBAR).toContain("/api/auth/logout");
    expect(SIDEBAR).toContain("/dashboard/settings");
  });

  it("has grouped navigation sections", () => {
    expect(SIDEBAR).toContain("group: \"main\"");
    expect(SIDEBAR).toContain("group: \"content\"");
    expect(SIDEBAR).toContain("group: \"developer\"");
    expect(SIDEBAR).toContain("group: \"account\"");
    expect(SIDEBAR).toContain("GROUP_LABEL_KEYS");
  });
});

describe("UX-A — Persian navigation labels (human-friendly)", () => {
  it("dashboard.nav keys are translated to the requested Persian labels in fa.ts", () => {
    expect(FA_TS).toContain("نمای کلی");
    expect(FA_TS).toContain("فعالیت‌ها");
    expect(FA_TS).toContain("ایمیل‌های ارسالی");
    expect(FA_TS).toContain("مخاطبان");
    expect(FA_TS).toContain("فهرست عدم ارسال");
    expect(FA_TS).toContain("ارسال انبوه");
    expect(FA_TS).toContain("قالب‌های ایمیل");
    expect(FA_TS).toContain("خودکارسازی");
    expect(FA_TS).toContain("آمار و گزارش‌ها");
    expect(FA_TS).toContain("ظاهر و برند");
    expect(FA_TS).toContain("کلیدهای API");
    expect(FA_TS).toContain("اتصال رویدادها (Webhook)");
    expect(FA_TS).toContain("محیط تست API");
    expect(FA_TS).toContain("گزارش درخواست‌ها");
    expect(FA_TS).toContain("راهنمای API");
    expect(FA_TS).toContain("اعلان‌ها");
    expect(FA_TS).toContain("تنظیمات");
  });

  it("does NOT intentionally preserve English product labels in fa nav", () => {
    // The old code had comments like "Canonical product name — do NOT translate"
    // and left "Broadcasts", "Webhooks", "Playground" in English.
    // These should now be translated.
    const navSection = FA_TS.match(/nav:\s*\{[\s\S]*?groups:/)?.[0] ?? "";
    expect(navSection).not.toContain("broadcasts: \"Broadcasts\"");
    expect(navSection).not.toContain("webhooks: \"Webhooks\"");
    expect(navSection).not.toContain("playground: \"Playground\"");
  });
});

describe("UX-A — public language switcher persistence contract", () => {
  it("site-header uses the existing LocaleSwitcher (not a custom implementation)", () => {
    expect(SITE_HEADER).toContain("LocaleSwitcher");
    expect(SITE_HEADER).toContain("from \"@/components/LocaleSwitcher\"");
    // Must NOT import a custom LanguageSwitcher
    expect(SITE_HEADER).not.toContain("LanguageSwitcher");
    expect(SITE_HEADER).not.toContain("language-switcher");
  });

  it("does NOT use a custom cookie-only persistence for authenticated users", () => {
    // The site-header must NOT have its own fetch to /api/locale or
    // /api/dashboard/preferences/locale — the LocaleSwitcher handles that.
    expect(SITE_HEADER).not.toContain("/api/locale");
    expect(SITE_HEADER).not.toContain("/api/dashboard/preferences/locale");
  });

  it("LocaleSwitcher uses PATCH for auth + POST fallback for anon", () => {
    const SWITCHER = readSrc("components/LocaleSwitcher.tsx");
    expect(SWITCHER).toContain("/api/dashboard/preferences/locale");
    expect(SWITCHER).toContain("PATCH");
    expect(SWITCHER).toContain("/api/locale");
    expect(SWITCHER).toContain("POST");
    expect(SWITCHER).toContain("setLocale(next)");
  });
});

describe("UX-A — dashboard page i18n coverage", () => {
  it("activity page uses useTranslations for title/subtitle/back", () => {
    const page = readSrc("app/dashboard/activity/page.tsx");
    expect(page).toContain("useTranslations");
    expect(page).toContain("dashboard.activity.title");
    expect(page).toContain("dashboard.activity.subtitle");
    expect(page).toContain("dashboard.activity.backToDashboard");
    expect(page).not.toContain("Back to Dashboard");
    expect(page).not.toContain(">Activity<");
  });

  it("emails page uses useTranslations for title/subtitle/back", () => {
    const page = readSrc("app/dashboard/emails/page.tsx");
    expect(page).toContain("useTranslations");
    expect(page).toContain("dashboard.emails.title");
    expect(page).not.toContain("Back to Dashboard");
    expect(page).not.toContain(">Emails<");
  });

  it("notifications page uses useTranslations for title/subtitle/back", () => {
    const page = readSrc("app/dashboard/notifications/page.tsx");
    expect(page).toContain("useTranslations");
    expect(page).toContain("dashboard.notifications.title");
    expect(page).not.toContain("Back to Dashboard");
    expect(page).not.toContain(">Notifications<");
  });

  it("dashboard i18n has section keys for all pages in both en and fa", () => {
    const sections = [
      "activity", "emails", "branding", "apiKeys", "playground", "logs", "docs", "notifications",
    ];
    for (const section of sections) {
      expect(EN_TS).toContain(`${section}: {`);
      expect(FA_TS).toContain(`${section}: {`);
    }
  });
});
