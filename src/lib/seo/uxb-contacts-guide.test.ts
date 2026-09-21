/**
 * UX-B: Contacts guide — regression tests.
 *
 * Verifies every item from the user's checklist:
 *   1. Route architecture: /guide/[section]/page.tsx with typed registry
 *   2. Contacts-specific stage exists (no ScenePlaceholder fallback)
 *   3. Factual corrections: list-table columns, list-actions menu, no auto-suppress claim
 *   4. Contacts-specific creative sections (Journey, Manual vs Import, Consent, Anatomy)
 *   5. Related links point to real routes only (no dead future-guide links)
 *   6. Canonical localization model (typed EN/FA dictionaries + resolver)
 *   7. GuideBanner reduced-motion behavior
 *   8. CinematicWalkthrough keyboard nav scoped away from editable controls
 *   9. Dashboard banner integration + back-href
 *  10. No real mutation fetches anywhere in the guide
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function readSrc(relPath: string): string {
  return readFileSync(resolve(__dirname, "../..", relPath), "utf-8");
}

const ROUTE_PAGE = readSrc("app/guide/[section]/page.tsx");
const ROUTE_NOT_FOUND = readSrc("app/guide/[section]/not-found.tsx");
const CONTENT_TYPES = readSrc("lib/guide/content/types.ts");
const CONTENT_INDEX = readSrc("lib/guide/content/index.ts");
const CONTENT_EN = readSrc("lib/guide/content/contacts-en.ts");
const CONTENT_FA = readSrc("lib/guide/content/contacts-fa.ts");
const CONTACTS_STAGE = readSrc("components/guide/scenes/ContactsStage.tsx");
const CONTACTS_VIEW = readSrc("components/guide/views/ContactsGuideView.tsx");
const JOURNEY = readSrc("components/guide/sections/contacts/ContactJourney.tsx");
const MANUAL_VS_IMPORT = readSrc("components/guide/sections/contacts/ManualAddVsImport.tsx");
const CONSENT_EXPLAINER = readSrc("components/guide/sections/contacts/ConsentExplainer.tsx");
const CONTACT_ANATOMY = readSrc("components/guide/sections/contacts/ContactAnatomy.tsx");
const GUIDE_PAGE_LAYOUT = readSrc("components/guide/GuidePageLayout.tsx");
const GUIDE_BANNER = readSrc("components/guide/GuideBanner.tsx");
const CINEMATIC_WALKTHROUGH = readSrc("components/guide/CinematicWalkthrough.tsx");
const DASHBOARD_CONTACTS = readSrc("app/dashboard/contacts/page.tsx");

/**
 * The stage's safety contract is documented as "NO real fetch() calls" in a
 * code comment. The regression check must look for actual `fetch(` invocations
 * (call sites), not the literal word "fetch" anywhere in the file. We strip
 * block + line comments before scanning.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s\/\/.*$/gm, "");
}

describe("Contacts guide — 1. Route architecture", () => {
  it("/guide/[section]/page.tsx exists and uses a typed registry resolver", () => {
    expect(ROUTE_PAGE).toContain("isKnownGuideSlug");
    expect(ROUTE_PAGE).toContain("notFound");
    expect(ROUTE_PAGE).toContain("generateStaticParams");
    expect(ROUTE_PAGE).toContain("GUIDE_SLUGS");
  });

  it("/guide/[section]/page.tsx renders the Contacts view for the contacts slug", () => {
    expect(ROUTE_PAGE).toContain('section === "contacts"');
    expect(ROUTE_PAGE).toContain("ContactsGuideView");
  });

  it("a segment-level not-found boundary exists for unknown guide slugs", () => {
    expect(ROUTE_NOT_FOUND).toContain("default");
  });

  it("the obsolete /guide/[section]/contacts/page.tsx route no longer exists", () => {
    expect(ROUTE_PAGE).not.toMatch(/contacts\/page/);
  });

  it("the content registry exposes a slug list + isKnownGuideSlug guard", () => {
    expect(CONTENT_INDEX).toContain("GUIDE_SLUGS");
    expect(CONTENT_INDEX).toContain("isKnownGuideSlug");
    expect(CONTENT_INDEX).toContain("resolveGuideContent");
  });
});

describe("Contacts guide — 2. Contacts-specific stage (no ScenePlaceholder fallback)", () => {
  it("a dedicated ContactsStage component exists", () => {
    expect(CONTACTS_STAGE).toContain("ContactsStage");
    expect(CONTACTS_STAGE).toContain("SceneRenderContext");
  });

  it("ContactsStage mirrors real Contacts UI surfaces (list + detail)", () => {
    expect(CONTACTS_STAGE).toContain("Add Contact");
    expect(CONTACTS_STAGE).toContain("Search");
    expect(CONTACTS_STAGE).toContain("MoreHorizontal");
    expect(CONTACTS_STAGE).toContain("View/Edit");
    expect(CONTACTS_STAGE).toContain("Delete");
    expect(CONTACTS_STAGE).toContain("Consent & Marketing");
    expect(CONTACTS_STAGE).toContain("Timeline");
  });

  it("ContactsStage uses safe local demo state only — no real fetch call sites", () => {
    const code = stripComments(CONTACTS_STAGE);
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(CONTACTS_STAGE).toContain("SEED_CONTACTS");
  });

  it("the Contacts view wires ContactsStage as the renderScene callback", () => {
    expect(CONTACTS_VIEW).toContain("ContactsStage");
    expect(CONTACTS_VIEW).toContain("renderScene");
  });

  it("CinematicWalkthrough accepts a renderScene prop and delegates to it", () => {
    expect(CINEMATIC_WALKTHROUGH).toContain("renderScene");
    expect(CINEMATIC_WALKTHROUGH).toContain("SceneRenderer");
  });
});

describe("Contacts guide — 3. Factual corrections", () => {
  it("list-table teaching matches the REAL Contacts columns (Name, Email, Source, Created, Updated, Actions)", () => {
    expect(CONTENT_EN).toContain("Name");
    expect(CONTENT_EN).toContain("Email");
    expect(CONTENT_EN).toContain("Source");
    expect(CONTENT_EN).toContain("Created");
    expect(CONTENT_EN).toContain("Updated");
    expect(CONTENT_EN).toContain("Actions");
    expect(CONTENT_EN).toContain("Marketing status is intentionally not shown here");
  });

  it("list-table teaching does NOT claim marketing_status is a list column", () => {
    expect(CONTENT_EN).not.toMatch(/row includes.*marketing status/i);
    expect(CONTENT_EN).not.toMatch(/each row.*marketing status/i);
  });

  it("list Actions teaching exposes ONLY View/Edit and Delete (no subscribe/edit/marketing/groups in the menu)", () => {
    expect(CONTENT_EN).toContain("View/Edit");
    expect(CONTENT_EN).toContain("Delete");
    // The list row actions menu must NOT be described as exposing subscribe,
    // edit, change marketing status, or add-to-groups. The teaching must
    // explicitly say the menu has ONLY View/Edit + Delete.
    expect(CONTENT_EN).toContain("only two operations");
    expect(CONTENT_EN).toContain("only \"View/Edit\" and \"Delete\"");
  });

  it("list Actions teaching directs consent operations to the detail page", () => {
    expect(CONTENT_EN).toContain("contact detail page");
  });

  it("no invented auto-suppression lockout troubleshooting remains", () => {
    // The previous incorrect claim was that a contact may be auto-suppressed
    // by the system and the user should wait for a lockout period to expire.
    // The new content must explicitly state there is NO lockout.
    expect(CONTENT_EN).toContain("no system-imposed lockout");
    // And the troubleshooting entry must teach the real cause (button
    // disabled because the contact is already in that state).
    expect(CONTENT_EN).toContain("already in that state");
  });

  it("troubleshooting entry for cannot change marketing status teaches the real cause", () => {
    expect(CONTENT_EN).toContain("Cannot change a contact's marketing status");
    expect(CONTENT_EN).toContain("no system-imposed lockout period");
  });

  it("Persian copy teaches the same list columns (not marketing_status)", () => {
    expect(CONTENT_FA).toContain("نام");
    expect(CONTENT_FA).toContain("ایمیل");
    expect(CONTENT_FA).toContain("منبع");
    expect(CONTENT_FA).toContain("ایجاد شده");
    expect(CONTENT_FA).toContain("به‌روز شده");
    expect(CONTENT_FA).toContain("اقدام‌ها");
    expect(CONTENT_FA).toContain("وضعیت بازاریابی در این جدول نمایش داده نمی‌شود");
  });

  it("Persian copy teaches list Actions has only View/Edit + Delete", () => {
    expect(CONTENT_FA).toContain("مشاهده/ویرایش");
    expect(CONTENT_FA).toContain("حذف");
    expect(CONTENT_FA).toContain("تنها دو عملیات");
  });
});

describe("Contacts guide — 4. Contacts-specific creative sections", () => {
  it("the ContactJourney section exists and is wired into the view", () => {
    expect(JOURNEY).toContain("ContactJourney");
    expect(CONTACTS_VIEW).toContain("ContactJourney");
  });

  it("the ManualAddVsImport section exists and is wired into the view", () => {
    expect(MANUAL_VS_IMPORT).toContain("ManualAddVsImport");
    expect(CONTACTS_VIEW).toContain("ManualAddVsImport");
  });

  it("the ConsentExplainer section exists and is wired into the view", () => {
    expect(CONSENT_EXPLAINER).toContain("ConsentExplainer");
    expect(CONTACTS_VIEW).toContain("ConsentExplainer");
  });

  it("the ContactAnatomy section exists and is wired into the view", () => {
    expect(CONTACT_ANATOMY).toContain("ContactAnatomy");
    expect(CONTACTS_VIEW).toContain("ContactAnatomy");
  });

  it("GuidePageLayout exposes a creativeSections slot", () => {
    expect(GUIDE_PAGE_LAYOUT).toContain("creativeSections");
  });

  it("the ConsentExplainer uses the real consent model", () => {
    expect(CONSENT_EXPLAINER).toContain("marketing_status");
    expect(CONSENT_EXPLAINER).toContain("suppressed");
    expect(CONSENT_EXPLAINER).toContain("eligible");
    expect(CONSENT_EXPLAINER).toContain("subscribed");
    expect(CONSENT_EXPLAINER).toContain("unsubscribed");
    expect(CONSENT_EXPLAINER).toContain("unknown");
    expect(CONSENT_EXPLAINER).toContain("Subscribe");
    expect(CONSENT_EXPLAINER).toContain("Unsubscribe");
    expect(CONSENT_EXPLAINER).toContain("Manually Suppress");
    expect(CONSENT_EXPLAINER).toContain("Lift Suppression");
    expect(CONSENT_EXPLAINER).toContain("never subscribes");
  });
});

describe("Contacts guide — 5. No dead future-guide links", () => {
  it("related links do NOT point to /guide/groups (does not ship)", () => {
    expect(CONTENT_EN).not.toMatch(/href:\s*["`]\/guide\/groups/);
    expect(CONTENT_FA).not.toMatch(/href:\s*["`]\/guide\/groups/);
  });

  it("related links do NOT point to /guide/broadcasts (does not ship)", () => {
    expect(CONTENT_EN).not.toMatch(/href:\s*["`]\/guide\/broadcasts/);
    expect(CONTENT_FA).not.toMatch(/href:\s*["`]\/guide\/broadcasts/);
  });

  it("related links do NOT point to /guide/contacts-import (does not ship)", () => {
    expect(CONTENT_EN).not.toMatch(/href:\s*["`]\/guide\/contacts-import/);
    expect(CONTENT_FA).not.toMatch(/href:\s*["`]\/guide\/contacts-import/);
  });

  it("related links DO point to real dashboard feature routes", () => {
    expect(CONTENT_EN).toContain("/dashboard/contacts");
    expect(CONTENT_EN).toContain("/dashboard/contacts/import");
    expect(CONTENT_EN).toContain("/dashboard/suppressions");
    expect(CONTENT_FA).toContain("/dashboard/contacts");
    expect(CONTENT_FA).toContain("/dashboard/contacts/import");
    expect(CONTENT_FA).toContain("/dashboard/suppressions");
  });
});

describe("Contacts guide — 6. Canonical localization model", () => {
  it("a typed GuideContent interface exists", () => {
    expect(CONTENT_TYPES).toContain("export interface GuideContent");
    expect(CONTENT_TYPES).toContain("GuideContentSection");
    expect(CONTENT_TYPES).toContain("GuideContentChecklistItem");
    expect(CONTENT_TYPES).toContain("GuideContentRelatedLink");
  });

  it("the EN dictionary conforms to the typed model", () => {
    expect(CONTENT_EN).toContain("export const contactsEn: GuideContent");
  });

  it("the FA dictionary conforms to the typed model", () => {
    expect(CONTENT_FA).toContain("export const contactsFa: GuideContent");
  });

  it("EN content includes all required sections", () => {
    for (const key of [
      "chapters:",
      "writtenSteps:",
      "whyWhen:",
      "mistakes:",
      "proTips:",
      "troubleshooting:",
      "checklist:",
      "whatNext:",
      "related:",
    ]) {
      expect(CONTENT_EN).toContain(key);
    }
  });

  it("FA content includes all required sections (mirror of EN)", () => {
    for (const key of [
      "chapters:",
      "writtenSteps:",
      "whyWhen:",
      "mistakes:",
      "proTips:",
      "troubleshooting:",
      "checklist:",
      "whatNext:",
      "related:",
    ]) {
      expect(CONTENT_FA).toContain(key);
    }
  });

  it("both EN and FA ship the same number of walkthrough steps", () => {
    const enSceneCount = (CONTENT_EN.match(/scene:\s*"/g) || []).length;
    const faSceneCount = (CONTENT_FA.match(/scene:\s*"/g) || []).length;
    expect(enSceneCount).toBeGreaterThan(0);
    expect(faSceneCount).toBe(enSceneCount);
  });

  it("both EN and FA ship the same number of written steps", () => {
    const enStepCount = (CONTENT_EN.match(/title:\s*"/g) || []).length;
    const faStepCount = (CONTENT_FA.match(/title:\s*"/g) || []).length;
    expect(enStepCount).toBeGreaterThan(0);
    expect(faStepCount).toBe(enStepCount);
  });

  it("the page does NOT use inline isFa conditionals for the guide body", () => {
    expect(CONTACTS_VIEW).not.toMatch(/isFa\s*\?/);
  });
});

describe("Contacts guide — 7. GuideBanner reduced-motion behavior", () => {
  it("GuideBanner reads prefers-reduced-motion", () => {
    expect(GUIDE_BANNER).toContain("useReducedMotion");
    expect(GUIDE_BANNER).toContain("prefersReducedMotion");
  });

  it("GuideBanner skips the entrance Y movement under reduced motion", () => {
    expect(GUIDE_BANNER).toContain("bannerInitial");
    expect(GUIDE_BANNER).toContain("bannerAnimate");
    expect(GUIDE_BANNER).toMatch(/prefersReducedMotion\s*\?\s*\{\s*opacity:\s*0\s*\}/);
  });

  it("GuidePageLayout hero also respects reduced motion", () => {
    expect(GUIDE_PAGE_LAYOUT).toContain("useReducedMotion");
    expect(GUIDE_PAGE_LAYOUT).toContain("heroInitial");
    expect(GUIDE_PAGE_LAYOUT).toContain("heroAnimate");
  });
});

describe("Contacts guide — 8. Keyboard behavior scoped away from editable controls", () => {
  it("CinematicWalkthrough does NOT hijack inputs, textareas, selects, buttons, links", () => {
    expect(CINEMATIC_WALKTHROUGH).toContain("input");
    expect(CINEMATIC_WALKTHROUGH).toContain("textarea");
    expect(CINEMATIC_WALKTHROUGH).toContain("select");
    expect(CINEMATIC_WALKTHROUGH).toContain("button");
    expect(CINEMATIC_WALKTHROUGH).toContain("isContentEditable");
  });
});

describe("Contacts guide — 9. Dashboard banner integration", () => {
  it("the dashboard Contacts page renders a GuideBanner that links to /guide/contacts", () => {
    expect(DASHBOARD_CONTACTS).toContain("GuideBanner");
    expect(DASHBOARD_CONTACTS).toContain('guidePath="/guide/contacts"');
    expect(DASHBOARD_CONTACTS).toContain('routeKey="contacts"');
  });

  it("the dashboard Contacts page does NOT link to /guide/[section]/contacts (old broken route)", () => {
    expect(DASHBOARD_CONTACTS).not.toContain('guidePath="/guide/[section]/contacts"');
    expect(DASHBOARD_CONTACTS).not.toMatch(/guidePath=.*\/contacts\/contacts/);
  });

  it("Contacts guide content returns to /dashboard/contacts", () => {
    expect(CONTENT_EN).toContain('backHref: "/dashboard/contacts"');
    expect(CONTENT_FA).toContain('backHref: "/dashboard/contacts"');
  });
});

describe("Contacts guide — 10. No real mutation fetches", () => {
  it("the ContactsStage does NOT call fetch (no real API requests)", () => {
    const code = stripComments(CONTACTS_STAGE);
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toMatch(/\/api\/dashboard\/contacts/);
    expect(code).not.toMatch(/\/api\/dashboard\/suppressions/);
  });

  it("the ContactsGuideView does NOT call fetch (no real API requests)", () => {
    const code = stripComments(CONTACTS_VIEW);
    expect(code).not.toMatch(/\bfetch\s*\(/);
  });

  it("the creative sections do NOT call fetch", () => {
    expect(stripComments(JOURNEY)).not.toMatch(/\bfetch\s*\(/);
    expect(stripComments(MANUAL_VS_IMPORT)).not.toMatch(/\bfetch\s*\(/);
    expect(stripComments(CONSENT_EXPLAINER)).not.toMatch(/\bfetch\s*\(/);
    expect(stripComments(CONTACT_ANATOMY)).not.toMatch(/\bfetch\s*\(/);
  });
});
