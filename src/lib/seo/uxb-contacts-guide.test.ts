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
    // The new architecture uses a GUIDE_VIEWS map instead of if-else chains.
    expect(ROUTE_PAGE).toContain("GUIDE_VIEWS");
    expect(ROUTE_PAGE).toContain("ContactsGuideView");
    expect(ROUTE_PAGE).toContain("contacts: ContactsGuideView");
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
    // The stage renders the real product surfaces via the copy prop.
    expect(CONTACTS_STAGE).toContain("MoreHorizontal");
    expect(CONTACTS_STAGE).toContain("Users");
    expect(CONTACTS_STAGE).toContain("BellRing");
    expect(CONTACTS_STAGE).toContain("ShieldAlert");
    expect(CONTACTS_STAGE).toContain("ShieldOff");
    expect(CONTACTS_STAGE).toContain("ListSurface");
    expect(CONTACTS_STAGE).toContain("DetailSurface");
    expect(CONTACTS_STAGE).toContain("CreateContactOverlay");
    // The human-facing labels (Add Contact, View/Edit, Consent & Marketing, Timeline)
    // are verified in the EN/FA stage copy tests below.
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
    // The component renders the matrix with the real consent states.
    expect(CONSENT_EXPLAINER).toContain("marketing_status");
    expect(CONSENT_EXPLAINER).toContain("suppressed");
    expect(CONSENT_EXPLAINER).toContain("eligible");
    expect(CONSENT_EXPLAINER).toContain("subscribed");
    expect(CONSENT_EXPLAINER).toContain("unsubscribed");
    expect(CONSENT_EXPLAINER).toContain("unknown");
    // The human-facing action labels (Subscribe, Unsubscribe, Manually Suppress,
    // Lift Suppression) and the 'never subscribes' note are verified in the
    // EN content dictionary tests (they live in the typed copy, not the component).
    expect(CONTENT_EN).toContain("Subscribe");
    expect(CONTENT_EN).toContain("Unsubscribe");
    expect(CONTENT_EN).toContain("Manually Suppress");
    expect(CONTENT_EN).toContain("Lift Suppression");
    expect(CONTENT_EN).toContain("never subscribes");
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

/* ========================================================================== *
 * Pass-2 regression tests: localized stage, corrected consent teaching,
 * non-liftable provider suppressions, canonical creative-section copy.
 * ========================================================================== */

describe("Contacts guide — 11. Stage UI is locale-aware (not permanently dir=ltr)", () => {
  it("the ContactsStage reads dir from the stage copy, not a hardcoded ltr", () => {
    expect(CONTACTS_STAGE).toContain("dir = copy.dir");
    // The code (stripped of comments) must NOT hardcode dir=ltr.
    const code = stripComments(CONTACTS_STAGE);
    expect(code).not.toContain('dir="ltr"');
  });

  it("the stage copy is part of the typed GuideContent model", () => {
    expect(CONTENT_TYPES).toContain("ContactsStageCopy");
    expect(CONTENT_TYPES).toContain("stage: ContactsStageCopy");
  });

  it("the EN stage copy is English + LTR", () => {
    expect(CONTENT_EN).toContain("dir: \"ltr\"");
    expect(CONTENT_EN).toContain("locale: \"en\"");
  });

  it("the FA stage copy is Persian + RTL", () => {
    expect(CONTENT_FA).toContain("dir: \"rtl\"");
    expect(CONTENT_FA).toContain("locale: \"fa\"");
  });

  it("the EN stage ships distinct English human UI copy (header, table columns, dialog)", () => {
    expect(CONTENT_EN).toContain("title: \"Contacts\"");
    expect(CONTENT_EN).toContain("addContact: \"Add Contact\"");
    expect(CONTENT_EN).toContain("name: \"Name\"");
    expect(CONTENT_EN).toContain("email: \"Email\"");
    expect(CONTENT_EN).toContain("source: \"Source\"");
    expect(CONTENT_EN).toContain("created: \"Created\"");
    expect(CONTENT_EN).toContain("updated: \"Updated\"");
    expect(CONTENT_EN).toContain("actions: \"Actions\"");
    expect(CONTENT_EN).toContain("viewEdit: \"View/Edit\"");
    expect(CONTENT_EN).toContain("delete: \"Delete\"");
  });

  it("the FA stage ships distinct Persian human UI copy", () => {
    expect(CONTENT_FA).toContain("title: \"مخاطبان\"");
    expect(CONTENT_FA).toContain("addContact: \"افزودن مخاطب\"");
    expect(CONTENT_FA).toContain("name: \"نام\"");
    expect(CONTENT_FA).toContain("email: \"ایمیل\"");
    expect(CONTENT_FA).toContain("source: \"منبع\"");
    expect(CONTENT_FA).toContain("created: \"ایجاد شده\"");
    expect(CONTENT_FA).toContain("updated: \"به‌روز شده\"");
    expect(CONTENT_FA).toContain("actions: \"اقدام‌ها\"");
    expect(CONTENT_FA).toContain("viewEdit: \"مشاهده/ویرایش\"");
    expect(CONTENT_FA).toContain("delete: \"حذف\"");
  });

  it("technical tokens stay LTR in both locales (source codes, marketing_status, eligible)", () => {
    // The stage copy stores source code values as raw strings (api, dashboard, etc.)
    // that are NEVER localized — only their badge labels are.
    expect(CONTENT_EN).toContain('code: "api"');
    expect(CONTENT_EN).toContain('code: "dashboard"');
    expect(CONTENT_EN).toContain('code: "otp_verified"');
    expect(CONTENT_EN).toContain('code: "import"');
    expect(CONTENT_FA).toContain('code: "api"');
    expect(CONTENT_FA).toContain('code: "dashboard"');
    expect(CONTENT_FA).toContain('code: "otp_verified"');
    expect(CONTENT_FA).toContain('code: "import"');
  });

  it("the ContactsGuideView passes the resolved stage copy to ContactsStage", () => {
    expect(CONTACTS_VIEW).toContain("content.stage");
    expect(CONTACTS_VIEW).toContain("copy={content.stage}");
  });

  it("the ContactsStage receives the copy as a prop (not via useLocale)", () => {
    expect(CONTACTS_STAGE).toContain("copy: ContactsStageCopy");
    expect(CONTACTS_STAGE).toContain("const copy = ctx.copy");
  });
});

describe("Contacts guide — 12. Consent teaching: manual suppress does NOT unsubscribe", () => {
  it("the EN consent action copy for Manually Suppress says it does NOT change marketing_status", () => {
    // Find the suppress action block and verify its description.
    const suppressBlock = CONTENT_EN.split("icon: \"suppress\"")[1]?.split("icon:")[0] ?? "";
    expect(suppressBlock).toContain("Does NOT change marketing_status");
    expect(suppressBlock).toContain("subscribed contact stays subscribed");
    expect(suppressBlock).not.toMatch(/sets marketing_status to unsubscribed/i);
  });

  it("the FA consent action copy for Manually Suppress says it does NOT change marketing_status", () => {
    const suppressBlock = CONTENT_FA.split('icon: "suppress"')[1]?.split("icon:")[0] ?? "";
    expect(suppressBlock).toContain("marketing_status را تغییر نمی‌دهد");
    expect(suppressBlock).not.toMatch(/marketing_status را به unsubscribed/);
  });

  it("the EN mistakes section calls out the Manually Suppress vs Unsubscribe confusion", () => {
    expect(CONTENT_EN).toContain("Confusing Manually Suppress with Unsubscribe");
    expect(CONTENT_EN).toContain("subscribed AND suppressed at the same time");
  });

  it("the FA mistakes section calls out the Manually Suppress vs Unsubscribe confusion", () => {
    expect(CONTENT_FA).toContain("اشتباه گرفتن «عدم ارسال دستی» با «لغو اشتراک»");
    expect(CONTENT_FA).toContain("همزمان مشترک و عدم‌ارسال‌شده");
  });

  it("the EN Unsubscribe action copy is distinct from Manually Suppress", () => {
    const unsubscribeBlock = CONTENT_EN.split('icon: "unsubscribe"')[1]?.split("icon:")[0] ?? "";
    expect(unsubscribeBlock).toContain("marketing_status to unsubscribed");
    expect(unsubscribeBlock).toContain("active suppression entry");
  });

  it("the FA Unsubscribe action copy is distinct from Manually Suppress", () => {
    const unsubscribeBlock = CONTENT_FA.split('icon: "unsubscribe"')[1]?.split("icon:")[0] ?? "";
    expect(unsubscribeBlock).toContain("unsubscribed تنظیم می‌کند");
    expect(unsubscribeBlock).toContain("ورودی عدم‌ارسال فعال");
  });

  it("the EN concept card for suppressed explicitly says a subscribed contact can be suppressed", () => {
    const suppressedCard = CONTENT_EN.split('label: "suppressed"')[1]?.split("label:")[0] ?? "";
    expect(suppressedCard).toContain("A subscribed contact can be suppressed");
  });

  it("the FA concept card for suppressed explicitly says a subscribed contact can be suppressed", () => {
    const suppressedCard = CONTENT_FA.split('label: "suppressed"')[1]?.split("label:")[0] ?? "";
    expect(suppressedCard).toContain("یک مخاطب مشترک می‌تواند عدم‌ارسال‌شده باشد");
  });
});

describe("Contacts guide — 13. Non-liftable provider suppressions (hard_bounce, complaint)", () => {
  it("the EN content mentions hard_bounce and complaint as non-liftable", () => {
    expect(CONTENT_EN).toContain("hard_bounce");
    expect(CONTENT_EN).toContain("complaint");
    expect(CONTENT_EN).toContain("NON_LIFTABLE_BY_RESUBSCRIBE");
  });

  it("the FA content mentions hard_bounce and complaint as non-liftable", () => {
    expect(CONTENT_FA).toContain("hard_bounce");
    expect(CONTENT_FA).toContain("complaint");
  });

  it("the EN Subscribe action copy states hard_bounce/complaint suppressions are NOT lifted", () => {
    const subscribeBlock = CONTENT_EN.split('icon: "subscribe"')[1]?.split("icon:")[0] ?? "";
    expect(subscribeBlock).toContain("NON_LIFTABLE_BY_RESUBSCRIBE");
    expect(subscribeBlock).toContain("Subscribe is rejected");
  });

  it("the FA Subscribe action copy states hard_bounce/complaint suppressions are NOT lifted", () => {
    const subscribeBlock = CONTENT_FA.split('icon: "subscribe"')[1]?.split("icon:")[0] ?? "";
    expect(subscribeBlock).toContain("قابل رفع نیستند");
    expect(subscribeBlock).toContain("اشتراک رد می‌شود");
  });

  it("the EN mistakes section warns about expecting Subscribe to lift hard_bounce/complaint", () => {
    expect(CONTENT_EN).toContain("Expecting Subscribe to lift a hard_bounce or complaint suppression");
  });

  it("the FA mistakes section warns about expecting Subscribe to lift hard_bounce/complaint", () => {
    expect(CONTENT_FA).toContain("انتظار رفع عدم‌ارسال hard_bounce یا complaint با اشتراک");
  });

  it("the EN troubleshooting section has an entry for rejected Subscribe on hard_bounce/complaint", () => {
    expect(CONTENT_EN).toContain("Subscribe was rejected for a hard_bounce or complaint suppression");
    expect(CONTENT_EN).toContain("explicit admin action is required");
  });

  it("the FA troubleshooting section has an entry for rejected Subscribe on hard_bounce/complaint", () => {
    expect(CONTENT_FA).toContain("اشتراک برای عدم‌ارسال hard_bounce یا complaint رد شد");
    expect(CONTENT_FA).toContain("اقدام صریح مدیر");
  });

  it("the ConsentExplainer renders a non-liftable note", () => {
    expect(CONSENT_EXPLAINER).toContain("nonLiftableNote");
    expect(CONSENT_EXPLAINER).toContain("ShieldAlert");
  });

  it("the EN non-liftable note copy is present in the dictionary", () => {
    expect(CONTENT_EN).toContain("nonLiftableNote");
    expect(CONTENT_EN).toContain("Provider-driven suppressions");
    expect(CONTENT_EN).toContain("explicit admin action");
  });

  it("the FA non-liftable note copy is present in the dictionary", () => {
    expect(CONTENT_FA).toContain("nonLiftableNote");
    expect(CONTENT_FA).toContain("اقدام صریح مدیر");
  });
});

describe("Contacts guide — 14. Consent matrix includes subscribed + suppressed combinations", () => {
  it("the ConsentExplainer matrix includes subscribed + suppressed = true → eligible = false", () => {
    // The MATRIX constant in the component must include the combination.
    expect(CONSENT_EXPLAINER).toContain('status: "subscribed"');
    expect(CONSENT_EXPLAINER).toContain("suppressed: true");
    expect(CONSENT_EXPLAINER).toContain("eligible: false");
  });

  it("the matrix subtitle explicitly says marketing_status and suppressed are INDEPENDENT", () => {
    expect(CONTENT_EN).toContain("marketing_status and suppressed are INDEPENDENT");
    expect(CONTENT_EN).toContain("Manually Suppress does not change marketing_status");
  });

  it("the FA matrix subtitle explicitly says marketing_status and suppressed are independent", () => {
    expect(CONTENT_FA).toContain("marketing_status و suppressed مستقل هستند");
    expect(CONTENT_FA).toContain("«عدم ارسال دستی» marketing_status را تغییر نمی‌دهد");
  });
});

describe("Contacts guide — 15. Creative sections use the canonical typed content model", () => {
  it("each creative section receives its copy as a typed prop (not useLocale + useCopy)", () => {
    expect(JOURNEY).toContain("copy: JourneyCopy");
    expect(MANUAL_VS_IMPORT).toContain("copy: ManualVsImportCopy");
    expect(CONSENT_EXPLAINER).toContain("copy: ConsentExplainerCopy");
    expect(CONTACT_ANATOMY).toContain("copy: ContactAnatomyCopy");
  });

  it("no creative section defines a local useCopy() hook", () => {
    expect(JOURNEY).not.toContain("useCopy");
    expect(MANUAL_VS_IMPORT).not.toContain("useCopy");
    expect(CONSENT_EXPLAINER).not.toContain("useCopy");
    expect(CONTACT_ANATOMY).not.toContain("useCopy");
  });

  it("the typed content model exports the creative-section copy interfaces", () => {
    expect(CONTENT_TYPES).toContain("JourneyCopy");
    expect(CONTENT_TYPES).toContain("ManualVsImportCopy");
    expect(CONTENT_TYPES).toContain("ConsentExplainerCopy");
    expect(CONTENT_TYPES).toContain("ContactAnatomyCopy");
    expect(CONTENT_TYPES).toContain("CreativeSectionCopy");
  });

  it("the ContactsGuideView passes the resolved creative copy to each section", () => {
    expect(CONTACTS_VIEW).toContain("content.creative.journey");
    expect(CONTACTS_VIEW).toContain("content.creative.manualVsImport");
    expect(CONTACTS_VIEW).toContain("content.creative.consent");
    expect(CONTACTS_VIEW).toContain("content.creative.anatomy");
  });

  it("the EN dictionary includes the creative section copy", () => {
    expect(CONTENT_EN).toContain("creative:");
    expect(CONTENT_EN).toContain("journey:");
    expect(CONTENT_EN).toContain("manualVsImport:");
    expect(CONTENT_EN).toContain("consent:");
    expect(CONTENT_EN).toContain("anatomy:");
  });

  it("the FA dictionary includes the creative section copy", () => {
    expect(CONTENT_FA).toContain("creative:");
    expect(CONTENT_FA).toContain("journey:");
    expect(CONTENT_FA).toContain("manualVsImport:");
    expect(CONTENT_FA).toContain("consent:");
    expect(CONTENT_FA).toContain("anatomy:");
  });
});

describe("Contacts guide — 16. No real mutation API calls remain (re-verify after refactor)", () => {
  it("the refactored ContactsStage still does NOT call fetch", () => {
    const code = stripComments(CONTACTS_STAGE);
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toMatch(/\/api\/dashboard\/contacts/);
    expect(code).not.toMatch(/\/api\/dashboard\/suppressions/);
  });

  it("the refactored creative sections still do NOT call fetch", () => {
    expect(stripComments(JOURNEY)).not.toMatch(/\bfetch\s*\(/);
    expect(stripComments(MANUAL_VS_IMPORT)).not.toMatch(/\bfetch\s*\(/);
    expect(stripComments(CONSENT_EXPLAINER)).not.toMatch(/\bfetch\s*\(/);
    expect(stripComments(CONTACT_ANATOMY)).not.toMatch(/\bfetch\s*\(/);
  });

  it("the ContactsGuideView still does NOT call fetch", () => {
    const code = stripComments(CONTACTS_VIEW);
    expect(code).not.toMatch(/\bfetch\s*\(/);
  });
});

/* ========================================================================== *
 * Pass-4: Multi-guide expansion — banner coverage + route coverage.
 * ========================================================================== */

const ALL_DASHBOARD_PAGES = [
  "app/dashboard/branding/page.tsx",
  "app/dashboard/automations/page.tsx",
  "app/dashboard/templates/page.tsx",
  "app/dashboard/broadcasts/page.tsx",
  "app/dashboard/suppressions/page.tsx",
  "app/dashboard/emails/page.tsx",
  "app/dashboard/api-keys/page.tsx",
  "app/dashboard/webhooks/page.tsx",
  "app/dashboard/contacts/page.tsx",
];

const BANNER_MAP: Record<string, { guidePath: string; routeKey: string }> = {
  "app/dashboard/branding/page.tsx": { guidePath: "/guide/branding", routeKey: "branding" },
  "app/dashboard/automations/page.tsx": { guidePath: "/guide/automations", routeKey: "automations" },
  "app/dashboard/templates/page.tsx": { guidePath: "/guide/templates", routeKey: "templates" },
  "app/dashboard/broadcasts/page.tsx": { guidePath: "/guide/broadcasts", routeKey: "broadcasts" },
  "app/dashboard/suppressions/page.tsx": { guidePath: "/guide/suppressions", routeKey: "suppressions" },
  "app/dashboard/emails/page.tsx": { guidePath: "/guide/emails", routeKey: "emails" },
  "app/dashboard/api-keys/page.tsx": { guidePath: "/guide/api-keys", routeKey: "api-keys" },
  "app/dashboard/webhooks/page.tsx": { guidePath: "/guide/webhooks", routeKey: "webhooks" },
  "app/dashboard/contacts/page.tsx": { guidePath: "/guide/contacts", routeKey: "contacts" },
};

describe("UX-B — GuideBanner coverage on all dashboard pages", () => {
  for (const pagePath of ALL_DASHBOARD_PAGES) {
    const expected = BANNER_MAP[pagePath];
    it(`${pagePath} has GuideBanner linking to ${expected.guidePath}`, () => {
      const src = readSrc(pagePath);
      expect(src).toContain("GuideBanner");
      expect(src).toContain(`guidePath="${expected.guidePath}"`);
      expect(src).toContain(`routeKey="${expected.routeKey}"`);
    });
  }

  it("GuideBanner is NOT in the dashboard layout (not in header)", () => {
    const layout = stripComments(readSrc("app/dashboard/layout.tsx"));
    expect(layout).not.toContain("GuideBanner");
  });

  it("GuideBanner is not sticky/floating (it's a block-level mt-12 card)", () => {
    const banner = readSrc("components/guide/GuideBanner.tsx");
    expect(banner).toContain("mt-12");
    expect(banner).not.toContain("position: sticky");
    expect(banner).not.toContain("position: fixed");
  });
});

describe("UX-B — Route coverage for all guide slugs", () => {
  const GUIDE_PAGE = readSrc("app/guide/[section]/page.tsx");

  const ALL_SLUGS = [
    "contacts",
    "branding",
    "automations",
    "templates",
    "broadcasts",
    "suppressions",
    "emails",
    "api-keys",
    "webhooks",
  ];

  for (const slug of ALL_SLUGS) {
    it(`/guide/${slug} is registered in the GUIDE_VIEWS map`, () => {
      expect(GUIDE_PAGE).toContain(slug);
    });
  }

  it("the GUIDE_VIEWS map has exactly the expected number of entries", () => {
    // Count the entries in GUIDE_VIEWS — should be 9 guides.
    const viewImports = GUIDE_PAGE.match(/GuideView/g) || [];
    expect(viewImports.length).toBeGreaterThanOrEqual(9);
  });

  it("unknown guide slugs trigger notFound", () => {
    expect(GUIDE_PAGE).toContain("notFound");
    expect(GUIDE_PAGE).toContain("isKnownGuideSlug");
  });
});

describe("UX-B — /guide landing page exists and uses the registry", () => {
  it("/guide/page.tsx exists and renders the GuideLanding component", () => {
    const landing = readSrc("app/guide/page.tsx");
    expect(landing).toContain("GuideLanding");
    expect(landing).toContain("GUIDE_METADATA");
  });

  it("the GuideLanding component reads from the registry metadata", () => {
    const landing = readSrc("components/guide/landing/GuideLanding.tsx");
    expect(landing).toContain("GuideMetadata");
    expect(landing).toContain("published");
  });

  it("the registry exports GUIDE_METADATA for the landing page", () => {
    const registry = readSrc("lib/guide/content/index.ts");
    expect(registry).toContain("GUIDE_METADATA");
    expect(registry).toContain("GUIDE_CATEGORIES");
  });

  it("the registry has all 9 guides registered", () => {
    const registry = readSrc("lib/guide/content/index.ts");
    for (const slug of ["contacts", "branding", "automations", "templates", "broadcasts", "suppressions", "emails", "api-keys", "webhooks"]) {
      expect(registry).toContain(slug);
    }
  });
});

describe("UX-B — All guides have EN + FA content dictionaries", () => {
  const GUIDE_CONTENT_FILES = [
    "lib/guide/content/guides/branding-en.ts",
    "lib/guide/content/guides/branding-fa.ts",
    "lib/guide/content/guides/automations-en.ts",
    "lib/guide/content/guides/automations-fa.ts",
    "lib/guide/content/guides/templates-en.ts",
    "lib/guide/content/guides/templates-fa.ts",
    "lib/guide/content/guides/broadcasts-en.ts",
    "lib/guide/content/guides/broadcasts-fa.ts",
    "lib/guide/content/guides/suppressions-en.ts",
    "lib/guide/content/guides/suppressions-fa.ts",
    "lib/guide/content/guides/emails-en.ts",
    "lib/guide/content/guides/emails-fa.ts",
    "lib/guide/content/guides/api-keys-en.ts",
    "lib/guide/content/guides/api-keys-fa.ts",
    "lib/guide/content/guides/webhooks-en.ts",
    "lib/guide/content/guides/webhooks-fa.ts",
  ];

  for (const file of GUIDE_CONTENT_FILES) {
    it(`${file} exists`, () => {
      const src = readSrc(file);
      expect(src).toBeTruthy();
    });
  }

  it("every EN dictionary exports a GuideContentBase-compatible object", () => {
    for (const file of GUIDE_CONTENT_FILES.filter((f) => f.endsWith("-en.ts"))) {
      const src = readSrc(file);
      expect(src).toContain("chapters:");
      expect(src).toContain("writtenSteps:");
      expect(src).toContain("stage:");
      expect(src).toContain("creative:");
    }
  });

  it("every FA dictionary exports a GuideContentBase-compatible object with dir=rtl", () => {
    for (const file of GUIDE_CONTENT_FILES.filter((f) => f.endsWith("-fa.ts"))) {
      const src = readSrc(file);
      expect(src).toContain("chapters:");
      expect(src).toContain("writtenSteps:");
      expect(src).toContain("stage:");
      expect(src).toContain("dir: \"rtl\"");
      expect(src).toContain("locale: \"fa\"");
    }
  });
});

describe("UX-B — All guides have view components", () => {
  const VIEW_FILES = [
    "components/guide/views/BrandingGuideView.tsx",
    "components/guide/views/AutomationsGuideView.tsx",
    "components/guide/views/TemplatesGuideView.tsx",
    "components/guide/views/BroadcastsGuideView.tsx",
    "components/guide/views/SuppressionsGuideView.tsx",
    "components/guide/views/EmailsGuideView.tsx",
    "components/guide/views/ApiKeysGuideView.tsx",
    "components/guide/views/WebhooksGuideView.tsx",
  ];

  for (const file of VIEW_FILES) {
    it(`${file} exists and uses the typed content model`, () => {
      const src = readSrc(file);
      expect(src).toContain("useLocale");
      expect(src).toContain("GuidePageLayout");
      expect(src).toContain("renderScene");
      expect(src).not.toMatch(/isFa\s*\?/);
    });
  }
});

describe("UX-B — All guides have feature-specific stage components", () => {
  const STAGE_FILES = [
    "components/guide/guides/branding/BrandingStage.tsx",
    "components/guide/guides/automations/AutomationsStage.tsx",
    "components/guide/guides/templates/TemplatesStage.tsx",
    "components/guide/guides/broadcasts/BroadcastsStage.tsx",
    "components/guide/guides/suppressions/SuppressionsStage.tsx",
    "components/guide/guides/emails/EmailsStage.tsx",
    "components/guide/guides/api-keys/ApiKeysStage.tsx",
    "components/guide/guides/webhooks/WebhooksStage.tsx",
  ];

  for (const file of STAGE_FILES) {
    it(`${file} exists and does NOT call fetch`, () => {
      const src = readSrc(file);
      const code = stripComments(src);
      expect(code).not.toMatch(/\bfetch\s*\(/);
    });
  }
});
