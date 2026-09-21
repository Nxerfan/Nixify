/**
 * UX-B: Canonical guide content model — multi-guide architecture.
 *
 * Each guide ships BOTH an `en` and a `fa` dictionary. The /guide/[section]
 * page resolves the active dictionary at render time from the active locale.
 *
 * Stage copy + creative-section copy live INSIDE the same typed dictionary.
 * Each guide has its own specific stage/creative types, but they all share
 * the common GuideContentBase fields (chapters, writtenSteps, etc.).
 *
 * Technical tokens (emails, dates, IDs, source codes) stay LTR via <Ltr>.
 *
 * LOCALIZATION MODEL:
 *   GuideMetadata and GuideCategoryMeta use typed LocalizedString values
 *   ({ en: "...", fa: "..." }) so the /guide landing page and the GuideBanner
 *   can render the correct language without unsafe casts or fallback drift.
 */

import type { WalkthroughChapter } from "@/components/guide/CinematicWalkthrough";

/* ─── Common section types ──────────────────────────────────────────────── */

export interface GuideContentSection {
  title: string;
  body: string;
}

export interface GuideContentChecklistItem {
  label: string;
}

export interface GuideContentRelatedLink {
  label: string;
  href: string;
}

/* ─── Localized value type ──────────────────────────────────────────────── */

/**
 * A string that exists in both supported locales. Used for metadata that
 * the landing page and banner render (guide titles, descriptions, category
 * labels). The caller resolves the right language at render time via
 * `pickLocalized(value, locale)`.
 */
export interface LocalizedString {
  en: string;
  fa: string;
}

/** Resolve a LocalizedString to the active locale. */
export function pickLocalized(value: LocalizedString, locale: "en" | "fa"): string {
  return locale === "fa" ? value.fa : value.en;
}

/* ─── Guide categories (for the /guide landing page) ────────────────────── */

export type GuideCategory =
  | "audience"
  | "messaging"
  | "automation"
  | "developer"
  | "delivery"
  | "customization";

export interface GuideCategoryMeta {
  id: GuideCategory;
  label: LocalizedString;
  description: LocalizedString;
}

/* ─── Landing page metadata (lightweight, for the /guide index) ─────────── */

export interface GuideMetadata {
  slug: string;
  routeKey: string;
  category: GuideCategory;
  dashboardRoute: string;
  title: LocalizedString;
  description: LocalizedString;
  stepCount: number;
  durationMin: number;
  published: boolean;
}

/* ─── Guide content base (shared by all guides) ─────────────────────────── */

export interface GuideContentBase {
  slug: string;
  routeKey: string;
  backHref: string;
  stepCount: number;
  durationMin: number;
  category: GuideCategory;
  dashboardRoute: string;
  title: string;
  description: string;
  chapters: WalkthroughChapter[];
  writtenSteps: GuideContentSection[];
  whyWhen: GuideContentSection[];
  mistakes: GuideContentSection[];
  proTips: GuideContentSection[];
  troubleshooting: GuideContentSection[];
  checklist: GuideContentChecklistItem[];
  whatNext: string;
  related: GuideContentRelatedLink[];
  /**
   * Stage copy and creative-section copy are guide-specific.
   * Each guide defines its own typed interfaces and casts at the view level.
   * Stored as `unknown` here so the registry can hold all guides uniformly.
   */
  stage: unknown;
  creative: unknown;
}

/**
 * A registered guide: slug → resolver that returns localized content + metadata.
 */
export interface GuideRegistration {
  slug: string;
  metadata: GuideMetadata;
  resolve: (locale: "en" | "fa") => GuideContentBase;
}

/* ─── Contacts-specific stage + creative copy types ─────────────────────── */

export interface ContactsStageSourceLabel {
  code: "api" | "dashboard" | "otp_verified" | "import";
  label: string;
}

export interface ContactsStageCopy {
  dir: "ltr" | "rtl";
  locale: "en" | "fa";
  header: {
    title: string;
    subtitle: string;
    addContact: string;
  };
  search: {
    placeholder: string;
    countPlural: (n: number) => string;
    countSingular: (n: number) => string;
  };
  table: {
    name: string;
    email: string;
    source: string;
    created: string;
    updated: string;
    actions: string;
    rowActionsAria: string;
    noMatches: (q: string) => string;
  };
  actionsMenu: {
    viewEdit: string;
    delete: string;
  };
  pagination: {
    pageOf: (page: number, total: number) => string;
    prev: string;
    next: string;
  };
  createDialog: {
    title: string;
    description: string;
    emailLabel: string;
    nameOptional: string;
    attributesOptional: string;
    keyPlaceholder: string;
    valuePlaceholder: string;
    cancel: string;
    submit: string;
  };
  detail: {
    backToContacts: string;
    emailImmutable: string;
    sourceLabel: string;
    updatedLabel: string;
    consentTitle: string;
    timelineTitle: string;
    suppressed: string;
    notSuppressed: string;
    eligibleForMarketing: string;
    importNote: string;
    subscribe: string;
    unsubscribe: string;
    manuallySuppress: string;
    liftSuppression: string;
    idLabel: string;
    createdLabel: string;
    timelineCreated: string;
    timelineUpdated: string;
    timelineSubscribed: string;
    timelineSuppressed: string;
  };
  sourceLabels: ContactsStageSourceLabel[];
  marketingStatusLabels: {
    subscribed: string;
    unsubscribed: string;
    unknown: string;
  };
}

export interface JourneyStepCopy {
  badge: string;
  title: string;
  body: string;
  surface: string;
  sideEffect: string;
}

export interface JourneyCopy {
  heading: string;
  subheading: string;
  legendTitle: string;
  legendItems: { label: string; tone: "ui" | "state" | "downstream" }[];
  steps: JourneyStepCopy[];
}

export interface ManualAddCopy {
  badge: string;
  title: string;
  whenTitle: string;
  whenBody: string;
  createsTitle: string;
  creates: string[];
  afterTitle: string;
  afterBody: string;
}

export interface ManualVsImportCopy {
  heading: string;
  subheading: string;
  manual: ManualAddCopy;
  import: ManualAddCopy;
  sourceLabel: string;
  marketingStatusLabel: string;
}

export interface ConsentConceptCard {
  label: string;
  value: string;
  desc: string;
}

export interface ConsentActionCopy {
  icon: "subscribe" | "unsubscribe" | "suppress" | "lift";
  label: string;
  desc: string;
  also: string;
}

export interface ConsentExplainerCopy {
  heading: string;
  subheading: string;
  conceptCards: ConsentConceptCard[];
  matrixTitle: string;
  matrixSubtitle: string;
  marketingCol: string;
  suppressedCol: string;
  eligibleCol: string;
  eligibleYes: string;
  eligibleNo: string;
  actionsTitle: string;
  actions: ConsentActionCopy[];
  importNote: string;
  nonLiftableNote: string;
}

export interface AnatomyFieldCopy {
  field: string;
  label: string;
  desc: string;
  icon: "name" | "email" | "source" | "attributes" | "dates" | "consent" | "timeline" | "id";
  value: string;
}

export interface ContactAnatomyCopy {
  heading: string;
  subheading: string;
  annotationsTitle: string;
  selectHint: string;
  annotations: AnatomyFieldCopy[];
}

export interface CreativeSectionCopy {
  journey: JourneyCopy;
  manualVsImport: ManualVsImportCopy;
  consent: ConsentExplainerCopy;
  anatomy: ContactAnatomyCopy;
}

/** Backwards-compatible alias. Contacts was the first guide; its content
 *  uses the full typed stage + creative copy. */
export type GuideContent = GuideContentBase & {
  stage: ContactsStageCopy;
  creative: CreativeSectionCopy;
};
