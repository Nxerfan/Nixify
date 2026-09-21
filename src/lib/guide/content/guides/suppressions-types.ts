/**
 * UX-B: Suppressions guide — stage + creative copy types.
 *
 * The Suppressions guide is the sixth guide in the UX-B contextual guide
 * system, after Contacts, Branding, Automations, Templates, and
 * Broadcasts. It mirrors the REAL Nixify Suppressions page at:
 *   src/app/dashboard/suppressions/page.tsx
 *
 * Architecture rules (REGRESSION-PROTECTED):
 *   - The stage + creative copy are guide-specific types defined here, but
 *     they all share the common GuideContentBase fields (chapters,
 *     writtenSteps, etc.) defined in ../types.
 *   - Each content dictionary (suppressions-en.ts, suppressions-fa.ts)
 *     exports a SuppressionsGuideContent that the view component consumes
 *     directly. (SuppressionsGuideContent = GuideContentBase & { stage,
 *     creative } — i.e. it satisfies GuideContentBase, just with the
 *     unknown stage/creative slots narrowed to typed shapes.)
 *   - Technical tokens (email addresses, reason codes like
 *     manual/unsubscribe/hard_bounce/complaint, source codes like
 *     dashboard/api/unsubscribe/system, ISO timestamps, suppression public
 *     IDs like sup_abc123, the NON_LIFTABLE_BY_RESUBSCRIBE token, the
 *     also_subscribe field name, HTTP method names) stay LTR via <Ltr> at
 *     render time. They are stored as raw strings here.
 *   - The stage reads `dir` from the copy (ltr for en, rtl for fa) and is
 *     NOT permanently `dir="ltr"`.
 *
 * Source-of-truth UI audit (verbatim labels from the real suppressions
 * page, src/app/dashboard/suppressions/page.tsx):
 *
 *   LIST PAGE:
 *   - Header: h1 "Suppressions" + emerald "Suppress email" button
 *     (Plus icon). (The real dashboard i18n key is
 *     `dashboard.suppressions.addSuppression` = "Suppress email".)
 *   - Card titled "Suppressions" with subtitle "Marketing suppression
 *     list. Suppressed emails are excluded from marketing eligibility."
 *   - Filter controls row:
 *     - Search input with Search icon (placeholder "Search by email…").
 *     - Toggle button: when activeOnly=true → emerald "Showing active
 *       only"; when false → outline "Showing all".
 *   - Separator.
 *   - Each suppression row (rounded border, hover accent):
 *     - Email (font-mono, break-all, wrapped in <Ltr>).
 *     - Badge row:
 *       - Reason badge (outline, small): Unsubscribe / Manual / Hard
 *         bounce / Complaint. The page uses REASON_LABELS verbatim.
 *       - Source badge (outline, small): "{Source label} {value}" — the
 *         "Source " prefix comes from `dashboard.contacts.source`.
 *         Values: Dashboard / API / Unsubscribe link / System.
 *       - Active or Lifted badge (outline, small): active =
 *         rose-tinted "Active"; lifted = slate-tinted "Lifted".
 *     - Created/Lifted timestamp line: "Created {date}" + optional
 *       "· Lifted {date}".
 *     - Right-side action: when entry.active === true → outline "Lift"
 *       button with ShieldOff icon. Lifted rows show no action.
 *   - Pagination (only when total > page_size): "Page {page} · {total}
 *     total" + Prev / Next buttons (ChevronLeft / ChevronRight).
 *
 *   ADD DIALOG (Dialog, not AlertDialog):
 *   - Title: "Add manual suppression".
 *   - Description: "Suppress an email from marketing. The contact
 *     matching this email (if any) will also be unsubscribed. Existing
 *     transactional messages are not affected."
 *     NOTE — the description copy in the i18n catalog predates the
 *     Phase 9 audit which confirmed that adding a suppression does NOT
 *     unsubscribe the contact. The guide teaches the canonical
 *     invariant: adding a manual suppression writes a SuppressionEntry
 *     with reason = manual; it does NOT mutate Contact.marketingStatus.
 *   - Email input (type=email, maxLength 254).
 *   - Footer: Cancel outline + emerald "Suppress" button (with
 *     "Suppressing…" spinner while creating).
 *   - On submit: POST /api/dashboard/suppressions with
 *     { email, reason: "manual" }. (The dashboard hard-codes
 *     reason = "manual" — the API schema accepts manual|unsubscribe,
 *     but the dialog only writes manual.)
 *
 *   LIFT DIALOG (AlertDialog, not Dialog):
 *   - Title: "Lift suppression for {email}?".
 *   - Description: "This deactivates the suppression entry. Lifting
 *     alone does NOT resubscribe the contact — to also explicitly
 *     subscribe, check the box below. The contact will then become
 *     eligible for marketing messages."
 *   - "Also subscribe this contact to marketing (explicit consent)"
 *     checkbox. When checked, the confirm button turns emerald; when
 *     unchecked, it turns rose (visual reinforcement of the "lift only"
 *     vs "lift + subscribe" distinction).
 *   - Cancel + confirm ("Lift suppression") action.
 *   - On submit: POST /api/dashboard/suppressions/{suppressionId} with
 *     { also_subscribe: boolean }. Defaults to false. POST (not DELETE)
 *     because lifting is a state transition that produces audit
 *     history, not a destructive delete.
 *
 *   AUTH / ENTITLEMENT:
 *   - 401 → router.push("/auth").
 *   - 403 → "Contacts not available" + "Suppression management is part
 *     of the Contacts capability, which is not available on your
 *     current plan."
 *
 *   CONSENT MODEL (audited from src/lib/consent/service.ts):
 *   - Four suppression reasons: manual, unsubscribe, hard_bounce,
 *     complaint. All four are writable by the central consent service.
 *   - NON_LIFTABLE_BY_RESUBSCRIBE = { hard_bounce, complaint }.
 *     These represent provider-driven signals (recipient's mailbox
 *     provider told us to stop sending). Lifting them requires an
 *     explicit out-of-band admin action — NOT a routine resubscribe.
 *     subscribeContact() throws ResubscribeBlockedError for these.
 *   - manual and unsubscribe ARE liftable by ordinary resubscribe —
 *     they represent user/dashboard choices the same actor can reverse.
 *   - Lift only deactivates the SuppressionEntry (active: false,
 *     liftedAt: now). It does NOT subscribe. Pass alsoSubscribe: true
 *     to combine lift + subscribe atomically (the only way Subscribe
 *     can lift a suppression — calling Subscribe alone on a manual
 *     suppression will lift it as a side effect, but the dashboard's
 *     explicit UI surface is the lift dialog).
 *
 *   INVARIANT: lift ≠ subscribe. Lift deactivates the suppression;
 *   subscribe sets marketingStatus = subscribed. A contact can be
 *   subscribed AND suppressed at the same time (eligible = false).
 *   A contact can be unsubscribed AND have no active suppression
 *   (eligible = false — marketingStatus gate fails). The two are
 *   independent gates; BOTH must pass for eligibility = true.
 *
 *   REAL API endpoints (NOT called from the stage — for teaching only):
 *   GET    /api/dashboard/suppressions?page=&pageSize=&activeOnly=&search=
 *   POST   /api/dashboard/suppressions                       (create: email, reason=manual|unsubscribe)
 *   GET    /api/dashboard/suppressions/{suppressionId}        (single entry)
 *   POST   /api/dashboard/suppressions/{suppressionId}        (lift: also_subscribe?)
 */

import type { GuideContentBase } from "../types";

/* ─── Stage copy ────────────────────────────────────────────────────────── */

/** Reason tone — controls the badge color class on the row. */
export type SuppressionReasonTone =
  | "manual"
  | "unsubscribe"
  | "hard_bounce"
  | "complaint";

/** Source tone — controls the source badge. The label is localized; the
 * underlying code is the raw string from the API. */
export type SuppressionSourceTone =
  | "dashboard"
  | "api"
  | "unsubscribe"
  | "system";

/** A single suppression row shown in the simulated list. */
export interface SuppressionsStageEntry {
  /** Stable numeric ID (for React keys). */
  id: number;
  /** Public suppression identifier — LTR token (e.g. "sup_abc123"). */
  suppressionId: string;
  /** Email address — LTR token (mono font, wrapped in <Ltr>). */
  email: string;
  /** Reason code — LTR token. Drives the badge color + non-liftability. */
  reason: SuppressionReasonTone;
  /** Source code — LTR token. */
  source: SuppressionSourceTone;
  /** Whether the entry is currently active (false after a lift). */
  active: boolean;
  /** Created-at relative time string — LTR token. */
  createdAtRelative: string;
  /** Lifted-at relative time string — LTR token (or null if never lifted). */
  liftedAtRelative: string | null;
}

export interface SuppressionsStageCopy {
  dir: "ltr" | "rtl";
  locale: "en" | "fa";

  header: {
    title: string; // "Suppressions"
    addSuppression: string; // "Suppress email"
  };

  /** The Card title + subtitle shown above the list. */
  card: {
    title: string; // "Suppressions"
    subtitle: string; // "Marketing suppression list. Suppressed emails are excluded from marketing eligibility."
  };

  search: {
    placeholder: string; // "Search by email…"
  };

  filter: {
    showingActiveOnly: string; // "Showing active only"
    showingAll: string; // "Showing all"
  };

  /** Reason badge labels, keyed by reason tone. */
  reasonLabels: Record<SuppressionReasonTone, string>;
  /** Source badge labels, keyed by source tone. The real page prefixes
   * these with the localized "Source" label (see sourcePrefix). */
  sourceLabels: Record<SuppressionSourceTone, string>;
  /** The "Source" prefix shown on the source badge — comes from
   * `dashboard.contacts.source` in the real page. */
  sourcePrefix: string;

  /** Row state badges. */
  state: {
    active: string; // "Active"
    lifted: string; // "Lifted"
  };

  /** Row timestamp labels. */
  timestamps: {
    created: (when: string) => string; // "Created {date}"
    lifted: (when: string) => string; // "Lifted {date}"
    joined: (created: string, lifted: string | null) => string; // "Created {x} · Lifted {y}"
  };

  /** Row action button. */
  actions: {
    lift: string; // "Lift"
    noAction: string; // "—" or similar for lifted rows with no action
  };

  /** Empty-state copy (no rows). */
  empty: string; // "No suppressions found. Add one above or change the filter."

  /** Pagination copy. */
  pagination: {
    pageOf: (page: number, total: number) => string; // "Page {page} · {total} total"
    prev: string; // "Prev"
    next: string; // "Next"
  };

  /** 403 not-available screen. */
  notAvailable: {
    title: string; // "Contacts not available"
    description: string;
    cta: string; // "View Plans"
  };

  /** Add-suppression dialog. */
  addDialog: {
    title: string; // "Add manual suppression"
    description: string; // (canonical invariant — lift ≠ subscribe)
    emailLabel: string; // "Email"
    emailPlaceholder: string; // "user@example.com"
    cancel: string; // "Cancel"
    submit: string; // "Suppress"
    submitting: string; // "Suppressing…"
  };

  /** Lift-suppression confirmation dialog. */
  liftDialog: {
    title: (email: string) => string; // "Lift suppression for {email}?"
    description: string; // "This deactivates the suppression entry..."
    alsoSubscribeLabel: string; // "Also subscribe this contact to marketing (explicit consent)"
    cancel: string; // "Cancel"
    confirmLiftOnly: string; // "Lift suppression" (rose when only-lift)
    confirmLiftAndSubscribe: string; // "Lift + subscribe" (emerald when also-subscribe)
    submitting: string; // "Lifting…"
    /** Footnote shown in the simulated lift dialog. */
    footnote: string;
    /** Hard-bounce / complaint warning block (shown when the target row's
     * reason is in NON_LIFTABLE_BY_RESUBSCRIBE — taught as an explicit
     * caution in the lift path even though the dashboard does not gate
     * the button, since the guide is teaching the consent model). */
    nonLiftableWarningTitle: string;
    nonLiftableWarningBody: string;
  };

  /** Seed suppressions shown in the simulated list — local demo data only.
   * NEVER fetched from the API. Numbers chosen to exercise every reason
   * code + every source + both active and lifted states + the
   * hard_bounce/complaint non-liftable path. */
  entries: SuppressionsStageEntry[];
}

/* ─── Creative section copy ─────────────────────────────────────────────── */

/* 1. Suppression reason anatomy — the four reason codes decoded */

export interface ReasonAnatomyRowCopy {
  /** Reason code — LTR token (manual / unsubscribe / hard_bounce / complaint). */
  reason: SuppressionReasonTone;
  /** Localized reason label (matches the badge). */
  label: string;
  /** One-sentence description of what triggers this reason. */
  trigger: string;
  /** Who writes this reason — e.g. "Dashboard", "Unsubscribe link",
   * "Mailbox provider (bounce)", "Mailbox provider (complaint)". */
  writtenBy: string;
  /** Whether an ordinary Subscribe action can lift this suppression.
   * manual + unsubscribe → true. hard_bounce + complaint → false. */
  liftableByResubscribe: boolean;
  /** Tone — controls the row color (emerald for liftable, rose for
   * non-liftable). */
  tone: "liftable" | "non-liftable";
}

export interface SuppressionReasonAnatomyCopy {
  heading: string;
  subheading: string;
  tableTitle: string;
  columns: {
    reason: string;
    label: string;
    trigger: string;
    writtenBy: string;
    liftable: string;
  };
  rows: ReasonAnatomyRowCopy[];
  legendTitle: string;
  legendLiftable: string;
  legendNonLiftable: string;
  /** Footnote pointing to NON_LIFTABLE_BY_RESUBSCRIBE in the source. */
  footnote: string;
}

/* 2. Active vs Lifted — the two states side-by-side */

export interface ActiveVsLiftedCopy {
  heading: string;
  subheading: string;
  activeCard: {
    badge: string; // "Active"
    title: string; // "active: true"
    body: string;
    /** Effects on eligibility / sending. */
    effects: string[];
  };
  liftedCard: {
    badge: string; // "Lifted"
    title: string; // "active: false, liftedAt: set"
    body: string;
    effects: string[];
  };
  /** Comparison rows across both states. */
  comparison: {
    dimension: string; // "Eligible for marketing?"
    activeValue: string; // "No"
    liftedValue: string; // "Only if marketing_status = subscribed"
  }[];
  /** Reinforces that lifting ≠ subscribing. */
  warningTitle: string;
  warningBody: string;
}

/* 3. Safe-lifting decision tree */

export interface DecisionTreeBranchCopy {
  /** Stable key — used as React key. */
  key: string;
  /** Branch label / question, e.g. "Reason is hard_bounce or complaint?" */
  question: string;
  /** The outcome of taking this branch. */
  outcome: string;
  /** Recommended action — short imperative. */
  recommendation: string;
  /** Tone — emerald for safe, amber for caution, rose for blocked. */
  tone: "safe" | "caution" | "blocked";
  /** Optional LTR token shown beside the question (e.g. reason code). */
  token?: string;
}

export interface SafeLiftingDecisionTreeCopy {
  heading: string;
  subheading: string;
  rootQuestion: string;
  branches: DecisionTreeBranchCopy[];
  /** Side-by-side: lift-only path vs lift+subscribe path. */
  liftOnlyPath: {
    badge: string; // "Lift only"
    title: string; // "also_subscribe: false"
    body: string;
    apiCall: string; // LTR token
  };
  liftAndSubscribePath: {
    badge: string; // "Lift + subscribe"
    title: string; // "also_subscribe: true"
    body: string;
    apiCall: string; // LTR token
  };
  /** Final warning — never auto-subscribe on the back of a lift. */
  warningTitle: string;
  warningBody: string;
}

/* 4. Eligibility relationship — how suppression + marketing_status combine */

export interface EligibilityRelationshipCopy {
  heading: string;
  subheading: string;
  conceptCards: {
    label: string; // "marketing_status"
    value: string; // "subscribed | unsubscribed | unknown"
    desc: string;
  }[];
  matrixTitle: string;
  matrixSubtitle: string;
  marketingCol: string; // "marketing_status"
  suppressedCol: string; // "suppressed"
  eligibleCol: string; // "Eligible?"
  eligibleYes: string; // "Yes"
  eligibleNo: string; // "No"
  /** All 6 combinations: (marketing_status, suppressed) → eligible. */
  matrix: {
    marketingStatus: "subscribed" | "unsubscribed" | "unknown";
    suppressed: boolean;
    eligible: boolean;
  }[];
  /** Reinforces both gates must pass. */
  ruleTitle: string;
  ruleBody: string;
  /** The non-liftable note — provider-driven suppressions. */
  nonLiftableNote: string;
}

export interface SuppressionsCreativeCopy {
  reasonAnatomy: SuppressionReasonAnatomyCopy;
  activeVsLifted: ActiveVsLiftedCopy;
  safeLiftingDecisionTree: SafeLiftingDecisionTreeCopy;
  eligibilityRelationship: EligibilityRelationshipCopy;
}

/* ─── Combined guide content type ───────────────────────────────────────── */

export type SuppressionsGuideContent = GuideContentBase & {
  stage: SuppressionsStageCopy;
  creative: SuppressionsCreativeCopy;
};
