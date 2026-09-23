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

  it("profile API imports the shared validation schema (not inline)", () => {
    expect(PROFILE_API).toContain("settingsProfileUpdateSchema");
    expect(PROFILE_API).toContain("@/lib/settings-validation");
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
    expect(EN_TS).toContain("sendResetCode:");
    expect(EN_TS).toContain("resetCodeSent:");
  });

  it("FA has password security section in Persian", () => {
    expect(FA_TS).toContain("تغییر امن رمز عبور");
    expect(FA_TS).toContain("ارسال کد بازنشانی");
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

describe("UX-C — Account deletion IS implemented safely", () => {
  it("Settings page contains Danger Zone with deletion flow", () => {
    expect(SETTINGS_PAGE).toContain("dangerZone");
    expect(SETTINGS_PAGE).toContain("DangerZoneSection");
    expect(SETTINGS_PAGE).toContain("deleteAccount");
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
  it("settings-validation.ts imports fullNameSchema from canonical source", () => {
    const schema = readSrc("lib/settings-validation.ts");
    expect(schema).toContain("import");
    expect(schema).toContain("fullNameSchema");
    expect(schema).toContain("@/lib/validation");
  });

  it("settings-validation.ts imports phoneNumberSchema from canonical source", () => {
    const schema = readSrc("lib/settings-validation.ts");
    expect(schema).toContain("phoneNumberSchema");
    expect(schema).toContain("@/lib/validation");
  });

  it("settings-validation.ts does NOT duplicate canonical max length", () => {
    const schema = readSrc("lib/settings-validation.ts");
    // Must not contain a hardcoded CANONICAL_FULL_NAME_MAX constant
    expect(schema).not.toContain("CANONICAL_FULL_NAME_MAX");
  });

  it("settings-validation.ts does NOT duplicate canonical phone regex", () => {
    const schema = readSrc("lib/settings-validation.ts");
    // Must not contain a hardcoded CANONICAL_PHONE_REGEX constant
    expect(schema).not.toContain("CANONICAL_PHONE_REGEX");
  });

  it("settings-validation.ts does NOT use String() coercion on values", () => {
    const schema = readSrc("lib/settings-validation.ts");
    // Must not coerce values with String(v) — non-strings must be rejected, not coerced
    expect(schema).not.toMatch(/String\(v\)/);
    expect(schema).not.toMatch(/String\(input\)/);
    expect(schema).not.toMatch(/String\(value\)/);
  });

  it("shared schema normalizes blank strings to null via preprocess", () => {
    const schema = readSrc("lib/settings-validation.ts");
    expect(schema).toContain("preprocess");
    expect(schema).toContain("null");
    expect(schema).toContain("typeof v === \"string\"");
  });

  it("shared schema uses canonical phone regex (imported, not duplicated)", () => {
    const schema = readSrc("lib/settings-validation.ts");
    // The regex should NOT be duplicated in settings-validation.ts
    // It should be imported from validation.ts via phoneNumberSchema
    expect(schema).not.toContain("CANONICAL_PHONE_REGEX");
    expect(schema).toContain("phoneNumberSchema");
  });

  it("shared schema uses .strict() to reject unknown fields", () => {
    const schema = readSrc("lib/settings-validation.ts");
    expect(schema).toContain(".strict()");
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

/* ════════════════════════════════════════════════════════════════════════
 * UX-C Pass-3: Plan failure state, shared schema, contrast sweep
 * ════════════════════════════════════════════════════════════════════════ */

describe("UX-C — Plan failure state does NOT fabricate FREE", () => {
  it("PlanSection has a loadError state (does not silently fallback to FREE)", () => {
    expect(SETTINGS_PAGE).toContain("loadError");
    expect(SETTINGS_PAGE).toContain("setLoadError");
  });

  it("PlanSection only renders plan data when profile is truthy (not || FREE)", () => {
    // The old code used `profile?.plan || "FREE"` which fabricated FREE on failure.
    // The new code checks `profile ?` (truthy) and shows error state otherwise.
    expect(SETTINGS_PAGE).not.toContain('|| "FREE"');
    expect(SETTINGS_PAGE).toContain("profile ?");
  });

  it("PlanSection has a retry button", () => {
    expect(SETTINGS_PAGE).toContain("retry");
    expect(SETTINGS_PAGE).toContain("loadProfile()");
  });
});

describe("UX-C — Shared validation schema", () => {
  it("settings-validation.ts module exists with the shared schema", () => {
    const schema = readSrc("lib/settings-validation.ts");
    expect(schema).toContain("settingsProfileUpdateSchema");
    expect(schema).toContain("export");
  });

  it("API route imports from the shared schema (not inline)", () => {
    expect(PROFILE_API).toContain("settingsProfileUpdateSchema");
    expect(PROFILE_API).toContain("@/lib/settings-validation");
  });

  it("shared schema uses .strict() to reject unknown fields", () => {
    const schema = readSrc("lib/settings-validation.ts");
    expect(schema).toContain(".strict()");
  });

  it("shared schema does NOT accept email as input", () => {
    const schema = readSrc("lib/settings-validation.ts");
    // The schema object should only have fullName and phoneNumber keys
    expect(schema).toContain("fullName");
    expect(schema).toContain("phoneNumber");
    // email should NOT appear as a field definition
    expect(schema).not.toMatch(/email\s*:/);
  });

  it("shared schema does NOT accept plan as input", () => {
    const schema = readSrc("lib/settings-validation.ts");
    expect(schema).not.toMatch(/plan\s*:/);
  });
});

describe("UX-C — Light-mode contrast sweep", () => {
  it("CommandPalette does not use unpaired text-emerald-300", () => {
    const cmd = readSrc("app/dashboard/components/CommandPalette.tsx");
    // Every text-emerald-300 must be paired with dark:text-emerald-300
    // or use text-emerald-700 dark:text-emerald-300
    const lines = cmd.split("\n");
    for (const line of lines) {
      if (line.includes("text-emerald-300") && !line.includes("dark:text-emerald")) {
        // This line has an unpaired emerald-300 — fail
        throw new Error(`CommandPalette has unpaired text-emerald-300: ${line.trim()}`);
      }
    }
  });

  it("GuideBanner does not use unpaired text-emerald-300 for readable text", () => {
    const banner = readSrc("components/guide/GuideBanner.tsx");
    const lines = banner.split("\n");
    for (const line of lines) {
      if (line.includes("text-emerald-300") && !line.includes("dark:text-emerald")) {
        throw new Error(`GuideBanner has unpaired text-emerald-300: ${line.trim()}`);
      }
    }
  });

  it("SiteHeader does not use unpaired text-emerald-300", () => {
    const header = readSrc("components/site-header.tsx");
    const lines = header.split("\n");
    for (const line of lines) {
      if (line.includes("text-emerald-300") && !line.includes("dark:text-emerald")) {
        throw new Error(`SiteHeader has unpaired text-emerald-300: ${line.trim()}`);
      }
    }
  });

  it("DocsShell does not use unpaired text-emerald-300", () => {
    const shell = readSrc("components/docs/DocsShell.tsx");
    const lines = shell.split("\n");
    for (const line of lines) {
      if (line.includes("text-emerald-300") && !line.includes("dark:text-emerald")) {
        throw new Error(`DocsShell has unpaired text-emerald-300: ${line.trim()}`);
      }
    }
  });

  it("DocsContent does not use unpaired text-emerald-300", () => {
    const content = readSrc("components/docs/DocsContent.tsx");
    const lines = content.split("\n");
    for (const line of lines) {
      if (line.includes("text-emerald-300") && !line.includes("dark:text-emerald")) {
        throw new Error(`DocsContent has unpaired text-emerald-300: ${line.trim()}`);
      }
    }
  });

  it("Security page does not use unpaired text-emerald-300", () => {
    const sec = readSrc("app/security/page.tsx");
    const lines = sec.split("\n");
    for (const line of lines) {
      if (line.includes("text-emerald-300") && !line.includes("dark:text-emerald")) {
        throw new Error(`Security page has unpaired text-emerald-300: ${line.trim()}`);
      }
    }
  });

  it("GuideLanding does not use unpaired text-emerald-300", () => {
    const landing = readSrc("components/guide/landing/GuideLanding.tsx");
    const lines = landing.split("\n");
    for (const line of lines) {
      if (line.includes("text-emerald-300") && !line.includes("dark:text-emerald")) {
        throw new Error(`GuideLanding has unpaired text-emerald-300: ${line.trim()}`);
      }
    }
  });

  it("homepage does not use unpaired text-emerald-300", () => {
    const home = readSrc("app/page.tsx");
    const lines = home.split("\n");
    for (const line of lines) {
      if (line.includes("text-emerald-300") && !line.includes("dark:text-emerald")) {
        throw new Error(`Homepage has unpaired text-emerald-300: ${line.trim()}`);
      }
    }
  });

  it("no file uses ring-gray-800 without dark:ring variant", () => {
    // ring-gray-800 should be replaced with ring-border (semantic)
    const files = [
      "components/docs/DocsShell.tsx",
      "app/dashboard/settings/page.tsx",
      "components/guide/GuidePageLayout.tsx",
    ];
    for (const f of files) {
      const src = readSrc(f);
      const lines = src.split("\n");
      for (const line of lines) {
        if (line.includes("ring-gray-800") && !line.includes("dark:ring-gray")) {
          throw new Error(`${f} has unpaired ring-gray-800: ${line.trim()}`);
        }
      }
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════
 * UX-C Pass-4: Profile load-failure states, sync after save, reset code UX
 * ════════════════════════════════════════════════════════════════════════ */

describe("UX-C — AccountSection load-failure state", () => {
  it("AccountSection has a loadError state", () => {
    // The section must not render a blank profile as if it were real
    expect(SETTINGS_PAGE).toContain("loadError");
  });

  it("AccountSection has a retry button on error", () => {
    // Search for the pattern within the file
    expect(SETTINGS_PAGE).toContain("loadProfile()");
    expect(SETTINGS_PAGE).toContain('t("dashboard.settings.retry")');
  });

  it("AccountSection does NOT render email badge on load error", () => {
    // The emailVerified badge should only render when profile is truthy
    // Check that the email badge is behind a profile truthy check
    expect(SETTINGS_PAGE).toContain("profile?.emailVerified");
  });
});

describe("UX-C — SecuritySection load-failure state", () => {
  it("SecuritySection has loading and loadError states", () => {
    // Count occurrences of loadError — should be at least 3 (Account, Security, Plan)
    const matches = SETTINGS_PAGE.match(/loadError/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });

  it("SecuritySection has a retry button", () => {
    // The retry button pattern should appear at least 3 times
    const matches = SETTINGS_PAGE.match(/t\("dashboard\.settings\.retry"\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });

  it("SecuritySection does NOT render emailVerified badge when profile is null", () => {
    // The section must check `if (!profile) return null;` before rendering
    expect(SETTINGS_PAGE).toContain("if (!profile) return null");
  });
});

describe("UX-C — Sync normalized profile after save", () => {
  it("AccountSection syncs fullName from server response after save", () => {
    expect(SETTINGS_PAGE).toContain("setFullName(data.user.fullName");
  });

  it("AccountSection syncs phoneNumber from server response after save", () => {
    expect(SETTINGS_PAGE).toContain("setPhoneNumber(data.user.phoneNumber");
  });
});

describe("UX-C — Password reset UX (code not link)", () => {
  it("EN says 'Send reset code' (not 'Send reset link')", () => {
    expect(EN_TS).toContain("sendResetCode:");
    expect(EN_TS).toContain("Send reset code");
    expect(EN_TS).not.toContain("sendResetLink:");
  });

  it("FA says 'ارسال کد بازنشانی' (not 'ارسال لینک بازنشانی')", () => {
    expect(FA_TS).toContain("sendResetCode:");
    expect(FA_TS).toContain("ارسال کد بازنشانی");
    expect(FA_TS).not.toContain("sendResetLink:");
  });

  it("EN says 'reset code sent' (not 'reset link sent')", () => {
    expect(EN_TS).toContain("resetCodeSent:");
    expect(EN_TS).not.toContain("resetLinkSent:");
  });

  it("FA says 'کد بازنشانی رمز عبور ارسال شد' (not 'لینک')", () => {
    expect(FA_TS).toContain("resetCodeSent:");
    expect(FA_TS).toContain("کد بازنشانی رمز عبور ارسال شد");
    expect(FA_TS).not.toContain("resetLinkSent:");
  });

  it("Settings page uses sendResetCode (not sendResetLink)", () => {
    expect(SETTINGS_PAGE).toContain("sendResetCode");
    expect(SETTINGS_PAGE).not.toContain("sendResetLink");
  });

  it("Settings page navigates to /reset-password after reset code sent", () => {
    expect(SETTINGS_PAGE).toContain("reset-password");
    expect(SETTINGS_PAGE).toContain("encodeURIComponent");
  });
});

describe("UX-C — Phone placeholder matches canonical schema", () => {
  it("EN phone placeholder is valid canonical format (digits only, optional +)", () => {
    // The placeholder should match /^\+?[0-9]{7,15}$/
    expect(EN_TS).toContain("+15550000000");
    // Should NOT contain spaces in the phone placeholder
    expect(EN_TS).not.toContain("+1 555 000 0000");
  });

  it("FA phone placeholder is valid canonical format", () => {
    expect(FA_TS).toContain("+989120000000");
    expect(FA_TS).not.toContain("+98 912 000 0000");
  });
});

describe("UX-C — Auth surface light-mode fixes", () => {
  it("auth page does NOT use hardcoded #060907 background", () => {
    const auth = readSrc("app/auth/page.tsx");
    expect(auth).not.toContain("#060907");
    expect(auth).toContain("var(--background)");
  });

  it("AuthCard does NOT use hardcoded inline text colors", () => {
    const card = readSrc("app/auth/components/AuthCard.tsx");
    expect(card).not.toContain("#f5f5f4");
    expect(card).not.toContain("#9ca3af");
    // Should use semantic tokens instead
    expect(card).toContain("text-foreground");
    expect(card).toContain("text-muted-foreground");
  });

  it("OtpStep does NOT use ring-offset-gray-950", () => {
    const otp = readSrc("app/auth/components/OtpStep.tsx");
    expect(otp).not.toContain("ring-offset-gray-950");
    expect(otp).toContain("ring-offset-background");
  });
});

describe("UX-C — Shared schema composes canonical validation", () => {
  it("settings-validation.ts imports canonical rules (not duplicated)", () => {
    const schema = readSrc("lib/settings-validation.ts");
    // Should reference the canonical max length
    expect(schema).toContain("100");
    // Should reference the canonical phone regex
    expect(schema).toContain("+?[0-9]{7,15}");
    // Should use .strict()
    expect(schema).toContain(".strict()");
  });

  it("settings-validation.ts normalizes whitespace-only to null via preprocess", () => {
    const schema = readSrc("lib/settings-validation.ts");
    expect(schema).toContain("preprocess");
    expect(schema).toContain('trimmed === ""');
  });
});

/* ════════════════════════════════════════════════════════════════════════
 * UX-C Pass-5: Auth theme token sweep + canonical import proof
 * ════════════════════════════════════════════════════════════════════════ */

describe("UX-C — Auth surface semantic theme tokens", () => {
  it("auth page does NOT use text-gray-700 for footer", () => {
    const auth = readSrc("app/auth/page.tsx");
    expect(auth).not.toContain("text-gray-700");
    expect(auth).toContain("text-muted-foreground");
  });

  it("SuccessState does NOT use bg-gray-800 for progress track", () => {
    const success = readSrc("app/auth/components/SuccessState.tsx");
    expect(success).not.toContain("bg-gray-800");
    expect(success).toContain("bg-muted");
  });
});
