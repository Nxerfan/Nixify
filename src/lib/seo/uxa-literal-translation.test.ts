/**
 * Regression tests for UX-A: ensure no literal t("...") or tr("...")
 * text appears in visible JSX (broken translation calls that render
 * the literal string instead of the translated value).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";

function readSrc(relPath: string): string {
  // relPath is relative to project root (e.g. "src/app/dashboard/page.tsx")
  // __dirname is src/lib/seo/, so we go up 2 levels to root
  return readFileSync(resolve(__dirname, "../../..", relPath), "utf-8");
}

/** Recursively find all .tsx files under a directory (relative to project root). */
function findTsxFiles(dir: string, basePath: string = ""): string[] {
  const results: string[] = [];
  const fullPath = resolve(__dirname, "../..", dir);
  try {
    for (const entry of readdirSync(fullPath)) {
      const relPath = basePath ? `${basePath}/${entry}` : entry;
      const entryPath = join(fullPath, entry);
      const stat = statSync(entryPath);
      if (stat.isDirectory()) {
        results.push(...findTsxFiles(join(dir, entry), relPath));
      } else if (entry.endsWith(".tsx")) {
        results.push(`${dir}/${entry}`);
      }
    }
  } catch {
    // directory doesn't exist
  }
  return results;
}

const dashboardFiles = findTsxFiles("src/app/dashboard");
const sharedFiles = [
  "src/app/admin/analytics/AnalyticsDashboard.tsx",
  "src/app/dashboard/components/DashboardHeader.tsx",
  "src/app/dashboard/components/CommandPalette.tsx",
];
const allFiles = [...dashboardFiles, ...sharedFiles];

describe("UX-A — no literal t(\"...\") in visible JSX", () => {
  for (const file of allFiles) {
    it(`${file} has no literal t("...") or tr("...") in JSX text`, () => {
      const src = readSrc(file);
      // Match patterns where t("...") or tr("...") appears as literal text
      // in JSX (not wrapped in {}). Catches whitespace/newlines between the
      // opening tag and the literal text.
      // Examples that should be caught:
      //   <p>t("dashboard...")</p>
      //   <p>\n  t("dashboard...")\n</p>
      //   <li>t("dashboard...")</li>
      //   >t("dashboard...")<
      const brokenPattern = /(?:>|\n\s*)t\("|(?:>|\n\s*)tr\("/;
      expect(src).not.toMatch(brokenPattern);
    });
  }
});

describe("UX-A — api-keys page localization", () => {
  const src = readSrc("src/app/dashboard/api-keys/page.tsx");

  it("uses t() for security tip prose (not hardcoded English)", () => {
    expect(src).toContain('t("dashboard.apiKeys.tipRotateKeys")');
    expect(src).toContain('t("dashboard.apiKeys.tipTestKeys")');
    expect(src).not.toContain('"Rotate keys quarterly"');
    expect(src).not.toContain('>Use <code');
  });

  it("uses t() for form error messages", () => {
    expect(src).toContain('t("dashboard.apiKeys.nameRequired")');
    expect(src).toContain('t("dashboard.apiKeys.limitReached")');
    expect(src).not.toContain('"Name is required"');
    expect(src).not.toContain('"API key limit reached"');
  });

  it("uses t() for aria-label on Actions button", () => {
    expect(src).toContain('aria-label={t("dashboard.common.actions")}');
    expect(src).not.toContain('aria-label="Actions"');
  });
});

describe("UX-A — contacts/[id] page localization", () => {
  const src = readSrc("src/app/dashboard/contacts/[id]/page.tsx");

  it("uses t() for not-found description", () => {
    expect(src).toContain('t("dashboard.contacts.notFoundDesc")');
    expect(src).not.toContain('"This contact may have been deleted"');
  });

  it("uses t() for Source and Marketing status labels", () => {
    expect(src).toContain('t("dashboard.common.source")');
    expect(src).toContain('t("dashboard.common.marketingStatus")');
  });

  it("uses t() for No events yet", () => {
    expect(src).toContain('t("dashboard.common.noEventsYet")');
    expect(src).not.toContain('"No events yet"');
  });
});

describe("UX-A — CommandPalette localization", () => {
  const src = readSrc("src/app/dashboard/components/CommandPalette.tsx");

  it("uses {t()} expression for noResults (not literal)", () => {
    expect(src).toContain('{t("dashboard.commandPalette.noResults")}');
    expect(src).not.toMatch(/>t\("dashboard.commandPalette.noResults"\)</);
  });

  it("uses {t()} expression for placeholder", () => {
    expect(src).toContain('placeholder={t("dashboard.commandPalette.placeholder")}');
  });
});

// ─── Error catalog localization regression ──────────────────────────────────

import { ERRORS_CATALOG } from "@/lib/dx/errors-catalog";
import { getLocalizedError, FA_TRANSLATIONS, type Locale } from "@/lib/dx/errors-catalog-i18n";

describe("UX-A — error catalog localization", () => {
  it("Persian translations exist for every canonical error code", () => {
    for (const entry of ERRORS_CATALOG) {
      expect(FA_TRANSLATIONS).toHaveProperty(entry.code);
    }
  });

  it("getLocalizedError preserves machine code and HTTP status", () => {
    for (const entry of ERRORS_CATALOG) {
      const fa = getLocalizedError(entry, "fa");
      expect(fa.code).toBe(entry.code); // machine code unchanged
      expect(fa.httpStatus).toBe(entry.httpStatus); // HTTP status unchanged
    }
  });

  it("getLocalizedError returns English when locale=en", () => {
    const entry = ERRORS_CATALOG[0];
    const en = getLocalizedError(entry, "en");
    expect(en.title).toBe(entry.title);
    expect(en.description).toBe(entry.description);
    expect(en.causes).toEqual(entry.causes);
    expect(en.fixes).toEqual(entry.fixes);
  });

  it("getLocalizedError returns Persian when locale=fa", () => {
    const entry = ERRORS_CATALOG.find((e) => e.code === "rate_limited")!;
    const fa = getLocalizedError(entry, "fa");
    expect(fa.title).not.toBe(entry.title); // title is translated
    expect(fa.description).not.toBe(entry.description); // description is translated
    expect(fa.causes).not.toEqual(entry.causes); // causes are translated
    expect(fa.fixes).not.toEqual(entry.fixes); // fixes are translated
  });

  it("Persian translations preserve concrete rate-limit values", () => {
    const entry = ERRORS_CATALOG.find((e) => e.code === "rate_limited")!;
    const fa = getLocalizedError(entry, "fa");
    // The English causes mention "3 OTP sends per email per minute" and "10 per hour"
    // The Persian translation must preserve these limits
    const allCauses = fa.causes.join(" ");
    expect(allCauses).toContain("۳"); // Persian numeral for 3
    expect(allCauses).toContain("۱۰"); // Persian numeral for 10
  });

  it("Persian translations preserve quota behavior for quota_exceeded", () => {
    const entry = ERRORS_CATALOG.find((e) => e.code === "quota_exceeded")!;
    const fa = getLocalizedError(entry, "fa");
    expect(fa.description).toContain("API_MESSAGES");
  });
});

// ─── Docs page rendering regression ────────────────────────────────────────

describe("UX-A — docs page renders localized error catalog", () => {
  const docsSrc = readSrc("src/app/dashboard/docs/page.tsx");

  it("imports getLocalizedError", () => {
    expect(docsSrc).toContain("getLocalizedError");
    expect(docsSrc).toContain("errors-catalog-i18n");
  });

  it("applies getLocalizedError inside the ERRORS_CATALOG.map", () => {
    // The map must call getLocalizedError(raw, locale) before rendering
    expect(docsSrc).toContain("getLocalizedError(raw, locale)");
    expect(docsSrc).toContain("getLocalizedError");
  });

  it("does not render raw ERRORS_CATALOG entries without localization", () => {
    // The map callback must NOT be just (e) => — it must be (raw) => { const e = getLocalizedError(raw, locale) ...
    expect(docsSrc).not.toMatch(/ERRORS_CATALOG\.map\(\(e\) =>/);
  });
});

// ─── Error Explorer memoization regression ─────────────────────────────────

describe("UX-A — error explorer memoization depends on locale", () => {
  const errorsSrc = readSrc("src/app/dashboard/errors/page.tsx");

  it("useMemo dependency array includes locale", () => {
    expect(errorsSrc).toContain("[query, statusFilter, locale]");
  });

  it("uses getLocalizedError in the filter chain", () => {
    expect(errorsSrc).toContain("getLocalizedError(raw, locale)");
  });
});

