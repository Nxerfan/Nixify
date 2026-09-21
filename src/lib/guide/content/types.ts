/**
 * UX-B: Canonical guide content model.
 *
 * Reusable, typed content model for dashboard guide pages. Each guide
 * (Contacts today; future guides later) provides:
 *   - route metadata (slug, dashboard back-href, step count, duration)
 *   - chapters + steps (captions, durations, scene keys, typed text)
 *   - written steps
 *   - why/when, mistakes, pro tips, troubleshooting
 *   - checklist items
 *   - "what next" + related links
 *   - stage copy (human-facing strings rendered by the simulated product UI)
 *   - creative-section copy (Journey, Manual vs Import, Consent, Anatomy)
 *
 * Each guide ships BOTH an `en` and a `fa` dictionary. The /guide/[section]
 * page resolves the active dictionary at render time from the active locale
 * (the canonical locale resolver/persistence system is untouched).
 *
 * Stage copy + creative-section copy live INSIDE the same typed dictionary
 * (not as separate per-component useCopy() hooks). This keeps the reference
 * implementation scalable: a future guide adds one EN dict + one FA dict,
 * and every render component pulls from the resolved content.
 */

import type { WalkthroughChapter } from "@/components/guide/CinematicWalkthrough";

export interface GuideContentSection {
  title: string;
  body: string;
}

export interface GuideContentChecklistItem {
  label: string;
}

export interface GuideContentRelatedLink {
  /** Already-localized display label. */
  label: string;
  /** Either an existing /guide/<slug> route OR a real dashboard URL. */
  href: string;
}

/* ─── Stage copy ─────────────────────────────────────────────────────────── */

export interface ContactsStageSourceLabel {
  /** The internal source code — NEVER localized. */
  code: "api" | "dashboard" | "otp_verified" | "import";
  /** Localized display label (e.g. "API", "Dashboard", "OTP Verified", "Import"). */
  label: string;
}

export interface ContactsStageCopy {
  /** Direction the simulated product chrome should render in. */
  dir: "ltr" | "rtl";
  /** Active locale code for the stage (matches the surrounding page). */
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

/* ─── Creative-section copy ──────────────────────────────────────────────── */

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
  /** Note about provider-driven non-liftable suppressions. */
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

export interface GuideContent {
  slug: string;
  routeKey: string;
  backHref: string;
  stepCount: number;
  durationMin: number;
  chapters: WalkthroughChapter[];
  writtenSteps: GuideContentSection[];
  whyWhen: GuideContentSection[];
  mistakes: GuideContentSection[];
  proTips: GuideContentSection[];
  troubleshooting: GuideContentSection[];
  checklist: GuideContentChecklistItem[];
  whatNext: string;
  related: GuideContentRelatedLink[];
  stage: ContactsStageCopy;
  creative: CreativeSectionCopy;
}

export interface GuideRegistration {
  slug: string;
  resolve: (locale: "en" | "fa") => GuideContent;
}

