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
      // Match patterns like >t("...")< or >tr("...")< — literal text in JSX
      // that renders the function name instead of the translated value.
      // Also match <p>t("...")</p> patterns (without braces).
      const brokenPattern = />t\("|>tr\("|<p>t\("|<p>tr\("|<span>t\("|<span>tr\("|<li>t\("|<li>tr\("/;
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
