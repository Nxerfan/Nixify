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

/* ════════════════════════════════════════════════════════════════════════
 * UX-C Pass-2: Theme fixes, dirty-state, fullName clearing, profile refresh
 * ════════════════════════════════════════════════════════════════════════ */

describe("UX-C — Theme selection state bug fix", () => {
  it("AppearanceSection sets mounted=true after hydration (not always false)", () => {
    // The mounted state must have a useEffect that sets it to true.
    // Before the fix, the effect was missing so mounted stayed false and
    // the active theme card was never highlighted.
    expect(SETTINGS_PAGE).toContain("setMounted(true)");
    expect(SETTINGS_PAGE).toContain("React.useEffect");
  });

  it("the active theme card check uses mounted (not always-false)", () => {
    // isActive must be 'mounted && theme === th.id', not just 'theme === th.id'
    // (which would cause a hydration mismatch).
    expect(SETTINGS_PAGE).toContain("mounted && theme === th.id");
  });
});

describe("UX-C — Dirty-state copy fix", () => {
  it("EN has unsavedChanges key (not noChanges shown when dirty)", () => {
    expect(EN_TS).toContain("unsavedChanges:");
    expect(EN_TS).toContain("You have unsaved changes");
  });

  it("FA has unsavedChanges in Persian", () => {
    expect(FA_TS).toContain("unsavedChanges:");
    expect(FA_TS).toContain("تغییرات ذخیره‌نشده دارید");
  });

  it("Settings page shows unsavedChanges (not noChanges) when dirty", () => {
    expect(SETTINGS_PAGE).toContain("unsavedChanges");
    expect(SETTINGS_PAGE).not.toContain('t("dashboard.settings.noChanges")');
  });
});

describe("UX-C — Allow empty fullName to map to null", () => {
  it("updateSchema allows fullName to be nullable and uses canonical max(100)", () => {
    const schemaStart = PROFILE_API.indexOf("const updateSchema");
    const schemaEnd = PROFILE_API.indexOf("});", schemaStart);
    const schemaBlock = PROFILE_API.slice(schemaStart, schemaEnd);
    expect(schemaBlock).toContain("nullable");
    expect(schemaBlock).toContain("max(100,");
    expect(schemaBlock).not.toContain("min(1)");
    expect(schemaBlock).not.toContain("max(200)");
  });

  it("empty fullName maps to null via transform", () => {
    expect(PROFILE_API).toContain("transform");
  });

  it("phoneNumber uses canonical regex validation", () => {
    const schemaStart = PROFILE_API.indexOf("const updateSchema");
    const schemaEnd = PROFILE_API.indexOf("});", schemaStart);
    const schemaBlock = PROFILE_API.slice(schemaStart, schemaEnd);
    expect(schemaBlock).toContain("+?[0-9]{7,15}");
  });
});

describe("UX-C — Shared profile refresh after save", () => {
  it("profile-events module exists with dispatch and subscribe", () => {
    const events = readSrc("lib/profile-events.ts");
    expect(events).toContain("dispatchProfileUpdated");
    expect(events).toContain("onProfileUpdated");
    expect(events).toContain("PROFILE_UPDATED_EVENT");
  });

  it("Settings page dispatches profile-updated event after save", () => {
    expect(SETTINGS_PAGE).toContain("dispatchProfileUpdated");
  });

  it("Sidebar listens for profile-updated events to refresh display name", () => {
    const sidebar = readSrc("app/dashboard/components/Sidebar.tsx");
    expect(sidebar).toContain("onProfileUpdated");
    expect(sidebar).toContain("loadProfile");
  });
});

describe("UX-C — Shared surfaces use semantic theme tokens", () => {
  it("Sidebar does NOT use hardcoded #060907 or inline backgroundColor", () => {
    const sidebar = readSrc("app/dashboard/components/Sidebar.tsx");
    expect(sidebar).not.toContain("#060907");
    expect(sidebar).not.toContain('backgroundColor: "#060907"');
    expect(sidebar).not.toContain('style={{ backgroundColor: "#060907" }}');
  });

  it("StatusBar does NOT use hardcoded #060907 or inline backgroundColor", () => {
    const statusBar = readSrc("app/dashboard/components/StatusBar.tsx");
    expect(statusBar).not.toContain("#060907");
    expect(statusBar).not.toContain('backgroundColor: "#060907"');
  });

  it("AmbientBackground uses theme-aware background (not hardcoded #0A0F0D)", () => {
    const ambient = readSrc("app/auth/components/AmbientBackground.tsx");
    expect(ambient).not.toContain('backgroundColor: "#0A0F0D"');
    expect(ambient).toContain("var(--background");
  });

  it("Dashboard layout does NOT use hardcoded dark text/bg classes", () => {
    const layout = readSrc("app/dashboard/layout.tsx");
    expect(layout).not.toContain("bg-gray-950");
    expect(layout).not.toContain("border-gray-800");
    expect(layout).not.toContain("text-gray-100");
    expect(layout).not.toContain("text-gray-400");
  });

  it("GuideBanner uses semantic tokens (not hardcoded gray)", () => {
    const banner = readSrc("components/guide/GuideBanner.tsx");
    expect(banner).not.toContain("text-gray-500");
    expect(banner).not.toContain("text-gray-100");
    expect(banner).not.toContain("text-gray-400");
    expect(banner).toContain("text-foreground");
    expect(banner).toContain("text-muted-foreground");
  });

  it("DocsShell uses semantic tokens for content (not hardcoded gray)", () => {
    const shell = readSrc("components/docs/DocsShell.tsx");
    expect(shell).toContain("text-foreground");
    expect(shell).toContain("text-muted-foreground");
    expect(shell).toContain("bg-card");
    expect(shell).toContain("border-border");
  });
});

describe("UX-C — UX-A locale behavior preserved", () => {
  it("LocaleSwitcher is still used (not replaced)", () => {
    expect(SETTINGS_PAGE).toContain("LocaleSwitcher");
    expect(SETTINGS_PAGE).toContain("@/components/LocaleSwitcher");
  });

  it("LocaleProvider is still used (canonical system)", () => {
    expect(SETTINGS_PAGE).toContain("useLocale");
    expect(SETTINGS_PAGE).toContain("useTranslations");
  });
});

describe("UX-C — No account deletion", () => {
  it("Settings page does NOT contain delete account functionality", () => {
    expect(SETTINGS_PAGE).not.toContain("deleteAccount");
    expect(SETTINGS_PAGE).not.toContain("danger zone");
    expect(SETTINGS_PAGE).not.toContain("danger-zone");
  });
});

describe("UX-C — Email remains read-only", () => {
  it("Settings page marks email input as readOnly and disabled", () => {
    expect(SETTINGS_PAGE).toContain("readOnly");
    expect(SETTINGS_PAGE).toContain("disabled");
  });

  it("profile API schema does NOT accept email as input", () => {
    const schemaStart = PROFILE_API.indexOf("const updateSchema");
    const schemaEnd = PROFILE_API.indexOf("});", schemaStart);
    const schemaBlock = PROFILE_API.slice(schemaStart, schemaEnd);
    expect(schemaBlock).not.toContain("email");
  });
});

describe("UX-C — Plan cannot be mutated through Settings", () => {
  it("profile API schema does NOT accept plan as input", () => {
    const schemaStart = PROFILE_API.indexOf("const updateSchema");
    const schemaEnd = PROFILE_API.indexOf("});", schemaStart);
    const schemaBlock = PROFILE_API.slice(schemaStart, schemaEnd);
    expect(schemaBlock).not.toContain("plan");
  });
});
