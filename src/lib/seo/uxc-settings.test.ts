/**
 * UX-C: Settings experience regression tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function readSrc(relPath: string): string {
  return readFileSync(resolve(__dirname, "../..", relPath), "utf-8");
}

const SETTINGS_PAGE = readSrc("app/dashboard/settings/page.tsx");
const THEME_PROVIDER = readSrc("components/theme-provider.tsx");
const GLOBALS_CSS = readSrc("app/globals.css");
const LAYOUT = readSrc("app/layout.tsx");
const PROFILE_API = readSrc("app/api/profile/settings/route.ts");
const EN_TS = readSrc("i18n/en.ts");
const FA_TS = readSrc("i18n/fa.ts");

describe("UX-C — Settings architecture", () => {
  it("Settings page has section sidebar with 5 sections", () => {
    expect(SETTINGS_PAGE).toContain("account");
    expect(SETTINGS_PAGE).toContain("appearance");
    expect(SETTINGS_PAGE).toContain("language");
    expect(SETTINGS_PAGE).toContain("security");
    expect(SETTINGS_PAGE).toContain("plan");
  });

  it("Settings page has GuideBanner with guideSlug=settings", () => {
    expect(SETTINGS_PAGE).toContain("GuideBanner");
    expect(SETTINGS_PAGE).toContain('guideSlug="settings"');
  });
});

describe("UX-C — Theme architecture", () => {
  it("ThemeProvider supports system theme and defaults to dark", () => {
    expect(THEME_PROVIDER).toContain("defaultTheme");
    expect(THEME_PROVIDER).toContain("dark");
    expect(THEME_PROVIDER).toContain("enableSystem");
  });

  it("globals.css has :root (light) and .dark (dark) token sets", () => {
    // Light theme tokens in :root
    expect(GLOBALS_CSS).toMatch(/:root\s*\{/);
    // Dark theme tokens in .dark
    expect(GLOBALS_CSS).toMatch(/\.dark\s*\{/);
  });

  it("root layout does NOT have hardcoded dark inline body styles", () => {
    expect(LAYOUT).not.toContain("#0A0F0D");
    expect(LAYOUT).not.toContain('backgroundColor: "#0A0F0D"');
  });

  it("body uses semantic bg-background text-foreground classes", () => {
    expect(GLOBALS_CSS).toContain("bg-background");
    expect(GLOBALS_CSS).toContain("text-foreground");
  });
});

describe("UX-C — Profile API", () => {
  it("PATCH /api/profile/settings endpoint exists", () => {
    expect(PROFILE_API).toContain("PATCH");
    expect(PROFILE_API).toContain("getAuthenticatedUser");
  });

  it("profile API only accepts fullName and phoneNumber (not email, not plan)", () => {
    expect(PROFILE_API).toContain("fullName");
    expect(PROFILE_API).toContain("phoneNumber");
    // The updateSchema does NOT accept email or plan as input.
    const schemaStart = PROFILE_API.indexOf("const updateSchema");
    const schemaEnd = PROFILE_API.indexOf("});", schemaStart);
    const schemaBlock = PROFILE_API.slice(schemaStart, schemaEnd);
    expect(schemaBlock).toContain("fullName");
    expect(schemaBlock).toContain("phoneNumber");
    expect(schemaBlock).not.toContain("email");
    expect(schemaBlock).not.toContain("plan");
  });

  it("profile API derives user identity from session only (no client userId)", () => {
    expect(PROFILE_API).toContain("getAuthenticatedUser");
    expect(PROFILE_API).not.toMatch(/userId.*req\./);
  });
});

describe("UX-C — Settings i18n keys exist in EN and FA", () => {
  it("EN has all Settings section labels", () => {
    for (const key of ["account:", "appearance:", "language:", "security:", "plan:"]) {
      expect(EN_TS).toContain(key);
    }
  });

  it("FA has all Settings section labels", () => {
    expect(FA_TS).toContain("حساب و پروفایل");
    expect(FA_TS).toContain("ظاهر");
    expect(FA_TS).toContain("امنیت");
    expect(FA_TS).toContain("پلان و وضعیت حساب");
  });

  it("EN has theme labels (Light, Dark, System)", () => {
    expect(EN_TS).toContain("themeLight:");
    expect(EN_TS).toContain("themeDark:");
    expect(EN_TS).toContain("themeSystem:");
  });

  it("FA has theme labels in Persian", () => {
    expect(FA_TS).toContain("روشن");
    expect(FA_TS).toContain("تیره");
    expect(FA_TS).toContain("سیستم");
  });

  it("EN has profile fields and save states", () => {
    expect(EN_TS).toContain("fullName:");
    expect(EN_TS).toContain("saveProfile:");
    expect(EN_TS).toContain("profileSaved:");
    expect(EN_TS).toContain("emailImmutable:");
  });

  it("FA has profile fields and save states in Persian", () => {
    expect(FA_TS).toContain("نام و نام خانوادگی");
    expect(FA_TS).toContain("ذخیره تغییرات");
    expect(FA_TS).toContain("پروفایل با موفقیت به‌روزرسانی شد");
  });

  it("EN has password security section", () => {
    expect(EN_TS).toContain("passwordSecurity:");
    expect(EN_TS).toContain("sendResetLink:");
    expect(EN_TS).toContain("resetLinkSent:");
  });

  it("FA has password security section in Persian", () => {
    expect(FA_TS).toContain("تغییر امن رمز عبور");
    expect(FA_TS).toContain("ارسال لینک بازنشانی");
  });

  it("EN has plan labels (Free, Pro, Max)", () => {
    expect(EN_TS).toContain("planFree:");
    expect(EN_TS).toContain("planPro:");
    expect(EN_TS).toContain("planMax:");
  });

  it("FA has plan labels in Persian", () => {
    expect(FA_TS).toContain("رایگان");
    expect(FA_TS).toContain("حرفه‌ای");
    expect(FA_TS).toContain("حداکثر");
  });
});

describe("UX-C — Settings page uses semantic theme tokens (not hardcoded)", () => {
  it("Settings page uses text-foreground, text-muted-foreground, bg-primary/10", () => {
    expect(SETTINGS_PAGE).toContain("text-foreground");
    expect(SETTINGS_PAGE).toContain("text-muted-foreground");
    expect(SETTINGS_PAGE).toContain("bg-primary/10");
  });

  it("Settings page does NOT use hardcoded gray-950/gray-800/gray-100", () => {
    // These hardcoded values don't adapt to light/dark themes
    expect(SETTINGS_PAGE).not.toContain("bg-gray-950");
    expect(SETTINGS_PAGE).not.toContain("border-gray-800");
    expect(SETTINGS_PAGE).not.toContain("text-gray-100");
    expect(SETTINGS_PAGE).not.toContain("text-gray-400");
  });
});

describe("UX-C — Account deletion is NOT implemented", () => {
  it("Settings page does NOT contain account deletion", () => {
    expect(SETTINGS_PAGE).not.toContain("deleteAccount");
    expect(SETTINGS_PAGE).not.toContain("account deletion");
    expect(SETTINGS_PAGE).not.toContain("delete account");
  });
});

describe("UX-C — No plan mutation", () => {
  it("profile settings API does NOT accept plan changes", () => {
    // The updateSchema does NOT accept plan as input.
    const schemaStart = PROFILE_API.indexOf("const updateSchema");
    const schemaEnd = PROFILE_API.indexOf("});", schemaStart);
    const schemaBlock = PROFILE_API.slice(schemaStart, schemaEnd);
    expect(schemaBlock).not.toContain("plan");
  });
});
