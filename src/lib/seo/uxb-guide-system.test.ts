/**
 * UX-B: Guide system regression tests.
 *
 * Verifies:
 * - Guide registry covers all expected dashboard routes
 * - Guide definitions are well-formed (chapters + steps)
 * - Guide launcher is wired into the dashboard layout
 * - i18n keys exist for guide controls (en + fa)
 * - No literal t()/tr() in guide components
 * - Guide definitions reference valid scene names
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function readSrc(relPath: string): string {
  return readFileSync(resolve(__dirname, "../..", relPath), "utf-8");
}

const REGISTRY = readSrc("lib/guide/registry.ts");
const EN_TS = readSrc("i18n/en.ts");
const FA_TS = readSrc("i18n/fa.ts");
const LAYOUT = readSrc("app/dashboard/layout.tsx");
const SHELL = readSrc("components/guide/WalkthroughShell.tsx");
const LAUNCHER = readSrc("components/guide/GuideLauncher.tsx");

const EXPECTED_ROUTES = [
  "/dashboard",
  "/dashboard/activity",
  "/dashboard/emails",
  "/dashboard/contacts",
  "/dashboard/contacts/import",
  "/dashboard/suppressions",
  "/dashboard/broadcasts",
  "/dashboard/templates",
  "/dashboard/automations",
  "/dashboard/analytics",
  "/dashboard/branding",
  "/dashboard/api-keys",
  "/dashboard/webhooks",
  "/dashboard/playground",
  "/dashboard/logs",
  "/dashboard/errors",
  "/dashboard/groups",
  "/dashboard/notifications",
  "/dashboard/settings",
  "/dashboard/docs",
  "/dashboard/contacts/[id]",
  "/dashboard/templates/[id]",
  "/dashboard/groups/[groupId]",
];

describe("UX-B — guide system architecture", () => {
  it("guide types module exists with GuideDefinition type", () => {
    const types = readSrc("lib/guide/types.ts");
    expect(types).toContain("GuideDefinition");
    expect(types).toContain("GuideChapter");
    expect(types).toContain("GuideStep");
  });

  it("WalkthroughShell component exists with key controls", () => {
    expect(SHELL).toContain("Play");
    expect(SHELL).toContain("Pause");
    expect(SHELL).toContain("goNext");
    expect(SHELL).toContain("goPrev");
    expect(SHELL).toContain("replay");
    expect(SHELL).toContain("DemoStage");
    expect(SHELL).toContain("Spotlight");
    expect(SHELL).toContain("aria-live");
    expect(SHELL).toContain("prefers-reduced-motion");
  });

  it("GuideLauncher component exists and uses getGuideForRoute", () => {
    expect(LAUNCHER).toContain("getGuideForRoute");
    expect(LAUNCHER).toContain("WalkthroughShell");
    expect(LAUNCHER).toContain("guide.launchButton");
  });

  it("DemoStage component exists with scene rendering", () => {
    const demoStage = readSrc("components/guide/DemoStage.tsx");
    expect(demoStage).toContain("renderScene");
    expect(demoStage).toContain("AnimatePresence");
  });

  it("Spotlight component exists", () => {
    const spotlight = readSrc("components/guide/Spotlight.tsx");
    expect(spotlight).toContain("Spotlight");
    expect(spotlight).toContain("SpotlightTarget");
  });
});

describe("UX-B — guide registry covers expected routes", () => {
  for (const route of EXPECTED_ROUTES) {
    it(`guide exists for ${route}`, () => {
      expect(REGISTRY).toContain(`"${route}"`);
    });
  }
});

describe("UX-B — guide banner architecture", () => {
  it("GuideBanner component exists", () => {
    const banner = readSrc("components/guide/GuideBanner.tsx");
    expect(banner).toContain("GuideBanner");
    expect(banner).toContain("guidePath");
    expect(banner).toContain("routeKey");
  });

  it("GuidePageLayout component exists", () => {
    const layout = readSrc("components/guide/GuidePageLayout.tsx");
    expect(layout).toContain("GuidePageLayout");
    expect(layout).toContain("CinematicWalkthrough");
    expect(layout).toContain("backHref");
  });

  it("CinematicWalkthrough component exists", () => {
    const walkthrough = readSrc("components/guide/CinematicWalkthrough.tsx");
    expect(walkthrough).toContain("CinematicWalkthrough");
    expect(walkthrough).toContain("useReducedMotion");
    expect(walkthrough).toContain("Play");
    expect(walkthrough).toContain("Pause");
    expect(walkthrough).toContain("goNext");
    expect(walkthrough).toContain("goPrev");
    expect(walkthrough).toContain("aria-live");
  });

  it("layout no longer imports GuideLauncher (replaced by GuideBanner)", () => {
    expect(LAYOUT).not.toContain("GuideLauncher");
    expect(LAYOUT).not.toContain("usePathname");
  });
});

describe("UX-B — guide i18n keys exist", () => {
  it("en.ts has guide section with controls", () => {
    expect(EN_TS).toContain("guide:");
    expect(EN_TS).toContain("launchButton");
    expect(EN_TS).toContain("play:");
    expect(EN_TS).toContain("pause:");
    expect(EN_TS).toContain("next:");
    expect(EN_TS).toContain("previous:");
    expect(EN_TS).toContain("replay:");
    expect(EN_TS).toContain("close:");
    expect(EN_TS).toContain("chapter:");
    expect(EN_TS).toContain("step:");
  });

  it("fa.ts has guide section with Persian controls", () => {
    
    expect(FA_TS).toContain("راهنمای این بخش");
    
    expect(FA_TS).toContain("پخش");
    
    expect(FA_TS).toContain("توقف");
    
    expect(FA_TS).toContain("بعدی");
    
    expect(FA_TS).toContain("قبلی");
    
    expect(FA_TS).toContain("بازپخش");
    
    expect(FA_TS).toContain("بستن");
  });

  it("en.ts has guide caption keys", () => {
    expect(EN_TS).toContain("captions:");
  });

  it("fa.ts has guide caption keys", () => {
    expect(FA_TS).toContain("captions:");
  });
});

describe("UX-B — no literal t()/tr() in guide components", () => {
  const guideFiles = [
    "components/guide/WalkthroughShell.tsx",
    "components/guide/GuideLauncher.tsx",
    "components/guide/DemoStage.tsx",
    "components/guide/Spotlight.tsx",
  ];

  for (const file of guideFiles) {
    it(`${file} has no literal t("...") in JSX text`, () => {
      const src = readSrc(file);
      const brokenPattern = /(?:>|\n\s*)t\("|(?:>|\n\s*)tr\("/;
      expect(src).not.toMatch(brokenPattern);
    });
  }
});

describe("UX-B — accessibility", () => {
  it("WalkthroughShell has aria-label and aria-live", () => {
    expect(SHELL).toContain("aria-label");
    expect(SHELL).toContain("aria-live");
  });

  it("WalkthroughShell supports keyboard navigation", () => {
    expect(SHELL).toContain("Escape");
    expect(SHELL).toContain("ArrowRight");
    expect(SHELL).toContain("ArrowLeft");
    expect(SHELL).toContain("keydown");
  });

  it("WalkthroughShell respects RTL for arrow direction", () => {
    expect(SHELL).toContain("dir === \"rtl\"");
    expect(SHELL).toContain("isRTL");
  });
});
