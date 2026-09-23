/**
 * UX-B: Emails guide — stage + creative copy types.
 *
 * The Emails guide is the seventh guide in the UX-B contextual guide system,
 * after Contacts, Branding, Automations, Templates, Broadcasts, and
 * Suppressions. It mirrors the REAL Nixify Emails dashboard page at:
 *   - src/app/dashboard/emails/page.tsx          (a 31-line PLACEHOLDER)
 *
 * HONESTY CONTRACT (REGRESSION-PROTECTED):
 *   - As of this audit, src/app/dashboard/emails/page.tsx is a 31-line
 *     PLACEHOLDER. It renders ONLY:
 *       1. A ghost "Back to Dashboard" link.
 *       2. An emerald Mail icon tile + h1 "Sent Emails" + subtitle
 *          "Track every email Nixify has delivered on your behalf."
 *       3. A centered bordered box with the empty-state copy "No emails sent
 *          yet. Send your first OTP from the Playground."
 *   - The page does NOT fetch from /api/dashboard/deliveries. There is no
 *     delivery table, no status badge, no event timeline, no detail drawer.
 *     Anything that looks like a list/timeline in this guide is explicitly
 *     labeled "concept preview" — it teaches what the page is MEANT to
 *     visualize once the placeholder is replaced.
 *
 * WHAT'S REAL (and what this guide teaches):
 *   - The Deliverability backend IS real and shipped (Phase 11). The page
 *     just hasn't been wired to it yet.
 *   - GET /api/dashboard/deliveries returns paginated EmailDelivery rows.
 *   - GET /api/dashboard/deliveries/{deliveryId} returns one row + its full
 *     immutable EmailDeliveryEvent history.
 *   - The state machine (queued → provider_accepted → {delivered | deferred
 *     | bounced | complained | rejected} ; queued → failed ; + the unknown
 *     recovery state) is enforced by src/lib/deliverability/service.ts.
 *   - Hard bounces and complaints trigger suppression via the consent
 *     service. Soft/transient bounces do NOT suppress.
 *   - SMTP deliveries stay in `provider_accepted` forever (no webhook) —
 *     this is correct behavior, not a bug.
 *
 * Architecture rules (REGRESSION-PROTECTED):
 *   - The stage + creative copy are guide-specific types defined here, but
 *     they all share the common GuideContentBase fields (chapters,
 *     writtenSteps, etc.) defined in ../types.
 *   - Each content dictionary (emails-en.ts, emails-fa.ts) exports an
 *     EmailsGuideContent that the view component consumes directly.
 *   - Technical tokens (deliveryId UUIDs, status strings like
 *     queued/provider_accepted/delivered/deferred/bounced/complained/
 *     rejected/failed/unknown, sourceType codes like broadcast/
 *     transactional/otp, provider codes like smtp, providerMessageId, ISO
 *     timestamps, {{var}} placeholders, email addresses, HTTP method
 *     names) stay LTR via <Ltr> at render time. They are stored as raw
 *     strings here.
 *   - The stage reads `dir` from the copy (ltr for en, rtl for fa) and is
 *     NOT permanently `dir="ltr"`.
 *
 * Source-of-truth UI audit (verbatim labels from the real placeholder page):
 *
 *   PLACEHOLDER PAGE (src/app/dashboard/emails/page.tsx — 31 lines):
 *   - Ghost link "Back to Dashboard" with ArrowLeft icon, mb-6, text-sm,
 *     text-gray-500 hover:text-gray-300.
 *   - Header: emerald-500/10 + emerald-500/15 bordered tile (h-10 w-10
 *     rounded-lg) containing an emerald-400 Mail icon (h-5 w-5). To the
 *     right: h1 "Sent Emails" (text-2xl font-bold text-gray-100) over a
 *     subtitle (text-sm text-gray-500).
 *   - Body: a single bordered rounded box (rounded-xl border-gray-800/40
 *     bg-gray-950/40 p-8 text-center backdrop-blur-xl) containing ONE
 *     paragraph of empty-state copy. No list. No filters. No buttons.
 *   - The page does NOT call useLocale() for any locale-specific copy
 *     beyond the dashboard.emails.* keys (title / subtitle / backToDashboard
 *     / empty).
 *
 * Real backend (NOT called from the stage — for teaching only):
 *   GET /api/dashboard/deliveries?page=1&pageSize=20&sourceType=&status=&provider=
 *   GET /api/dashboard/deliveries/{deliveryId}
 *
 *   EmailDelivery state machine (from src/lib/deliverability/service.ts):
 *
 *     queued                            (initial — before provider dispatch)
 *       ↓
 *     provider_accepted                 (provider.send() returned accepted=true)
 *       ↓ ↓ ↓ ↓ ↓
 *     delivered | deferred | bounced | complained | rejected
 *
 *     queued → failed                   (provider.send() threw before acceptance)
 *     provider.send() succeeded but DB persistence failed → unknown
 *
 *   Terminal states: delivered, bounced, complained, rejected, failed.
 *   Non-terminal intermediate: deferred (transient bounce — retry-eligible).
 *   Special: unknown is treated as terminal w.r.t. auto-retry (NEVER
 *   re-sent) but a later webhook event with a newer occurredAt CAN advance
 *   it to a concrete terminal state (delivered, bounced, complained,
 *   rejected).
 *
 *   NEVER-REGRESS RULES (verbatim from the service):
 *     - delivered → then a delayed `deferred` → stay `delivered`.
 *     - complained → then a delayed `delivered` → stay `complained`
 *       (compliance-aware: a complaint means the recipient marked the email
 *       as spam; subsequent delayed "delivered" signals cannot undo it).
 *     - bounced (hard) → terminal, no regression.
 *     - The only allowed forward transition OUT of a terminal state is
 *       delivered → complained (complaint is the stronger compliance signal).
 *
 *   SUPPRESSION INTEGRATION:
 *     - Hard bounce → suppressEmail() with reason hard_bounce.
 *     - Complaint → suppressEmail() with reason complaint.
 *     - Soft/transient bounce (deferred) → NO suppression.
 *     - Delivered, accepted, rejected, failed, unknown → NO suppression.
 *
 *   SMTP-vs-webhook contract:
 *     - SMTP provider has deliveryWebhooks=false. SMTP deliveries stay in
 *       `provider_accepted` indefinitely — this is correct (SMTP
 *       acceptance means the upstream MTA accepted the envelope, not that
 *       the message reached the inbox). ONLY a webhook-capable provider
 *       can advance a delivery to `delivered`.
 *
 *   SOURCE CORRELATION:
 *     - sourceType="broadcast"     → broadcastRecipientId (FK concept).
 *     - sourceType="transactional" → emailMessageId (EmailMessage.messageId).
 *     - sourceType="otp"           → reserved for future use; current
 *       Dashboard does not pass it. Phase 11 wires broadcast + transactional
 *       only.
 *
 *   AUTH / ENTITLEMENT:
 *     - 401 → "Login required." (code = unauthorized).
 *     - 403 → "Deliverability dashboard not available." (code =
 *       feature_not_available). Requires the CONTACTS feature key.
 */

import type { GuideContentBase } from "../types";

/* ─── Stage copy ────────────────────────────────────────────────────────── */

/**
 * The 8 statuses that `currentStatus` on an EmailDelivery row can hold, plus
 * the special "unknown" recovery state. Kept as a union so the stage's
 * status-badge color map and the creative sections' interpretation table are
 * exhaustive.
 *
 * These literal codes NEVER appear localized — they are the raw string the
 * API returns and the DB stores. The localized label sits next to them.
 */
export type EmailDeliveryStatus =
  | "queued"
  | "provider_accepted"
  | "delivered"
  | "deferred"
  | "bounced"
  | "complained"
  | "rejected"
  | "failed"
  | "unknown";

/** Source-type codes that an EmailDelivery.sourceType can hold. */
export type EmailDeliverySourceType = "broadcast" | "transactional" | "otp";

/** Provider codes that EmailDelivery.provider can hold today. */
export type EmailDeliveryProvider = "smtp";

/**
 * A single simulated EmailDelivery row shown in the concept-preview scene.
 *
 * These rows are LOCAL DEMO DATA — the stage NEVER calls
 * /api/dashboard/deliveries. The numbers + statuses were chosen to exercise
 * every visible state in the lifecycle: queued, provider_accepted,
 * delivered, deferred, bounced, complained, rejected, failed, and unknown.
 */
export interface EmailsStageDelivery {
  /** Stable numeric ID for React keys + highlighting. */
  id: number;
  /** Public UUID-style delivery identifier — LTR token. */
  deliveryId: string;
  /** Recipient email address — LTR token. */
  recipient: string;
  /** Subject line (truncated in the list) — LTR token. */
  subject: string;
  /** Source-type code — LTR token. */
  sourceType: EmailDeliverySourceType;
  /** Optional source correlation label (e.g. a broadcast name). */
  sourceLabel: string;
  /** Provider code — LTR token. */
  provider: EmailDeliveryProvider;
  /** Current lifecycle status — LTR token. */
  currentStatus: EmailDeliveryStatus;
  /** Whether the delivery has triggered a suppression (hard bounce / complaint). */
  suppressionApplied: boolean;
  /** Optional safe error code (e.g. "smtp_5xx_permanent") — LTR token. */
  lastErrorCode: string | null;
  /** Relative-time string for "Created" — LTR token. */
  createdAtRelative: string;
  /** Whether the row should pulse to indicate it's actively in flight. */
  isLive: boolean;
}

/** A single EmailDeliveryEvent row for the timeline scene. */
export interface EmailsStageEvent {
  /** Stable numeric ID for React keys. */
  id: number;
  /** Provider event type — LTR token (delivered / deferred / bounced / complained / rejected). */
  type: "delivered" | "deferred" | "bounced" | "complained" | "rejected" | "accepted" | "queued";
  /** Localized description of what this event means. */
  desc: string;
  /** ISO timestamp string — LTR token. */
  occurredAt: string;
  /** Optional LTR token (e.g. "provider_accepted", "hard", "soft"). */
  token?: string;
  /** Tone for the badge color. */
  tone: "neutral" | "good" | "warn" | "bad";
}

/** One row in the "How emails relate to other surfaces" sources card. */
export interface EmailsStageSourceRow {
  /** Stable key. */
  key: "broadcast" | "transactional" | "otp";
  /** Localized label (e.g. "Broadcasts"). */
  label: string;
  /** Localized one-sentence description. */
  desc: string;
  /** LTR token (e.g. "broadcastRecipientId", "POST /api/.../send"). */
  token: string;
  /** Tone — controls the icon + accent. */
  tone: "broadcast" | "transactional" | "otp";
}

export interface EmailsStageCopy {
  /** Direction the simulated product chrome should render in. */
  dir: "ltr" | "rtl";
  /** Active locale code for the stage (matches the surrounding page). */
  locale: "en" | "fa";

  /** Header copy — mirrors the real placeholder's header verbatim. */
  header: {
    title: string; // "Sent Emails"
    subtitle: string; // "Track every email Nixify has delivered on your behalf."
    backToDashboard: string; // "Back to Dashboard"
  };

  /** The actual empty-state placeholder body that ships today. */
  placeholder: {
    body: string; // "No emails sent yet. Send your first OTP from the Playground."
    /** Tagline shown ABOVE the placeholder box explaining what it is. */
    calloutTitle: string;
    /** Body of the callout. */
    calloutBody: string;
  };

  /** Concept-preview copy — what the page WOULD look like once it's wired
   * to /api/dashboard/deliveries. Explicitly labeled as a concept. */
  concept: {
    /** Tagline strip at the top of the scene ("Concept preview — not the real UI today"). */
    tag: string;
    /** Title for the concept preview list card. */
    cardTitle: string;
    /** Subtitle for the card. */
    cardSubtitle: string;
    /** Caption shown after the list, reinforcing that this is a teaching aid. */
    caption: string;
  };

  /** The simulated delivery list table header labels. */
  table: {
    recipient: string; // "Recipient"
    subject: string; // "Subject"
    source: string; // "Source"
    status: string; // "Status"
    error: string; // "Error"
    created: string; // "Created"
  };

  /** Status badge labels — already localized, keyed by status code.
   * The status code itself stays LTR; this label is the human-friendly
   * display next to it. */
  statusLabels: Record<EmailDeliveryStatus, string>;

  /** Suppression pill copy (shown next to a row that triggered a suppression). */
  suppressionPill: string; // "suppressed"

  /** Source-type badge labels — localized, keyed by source code. */
  sourceLabels: Record<EmailDeliverySourceType, string>;

  /** Filters row copy (concept-only — the real page has no filters yet). */
  filters: {
    sourceType: string; // "Source type"
    status: string; // "Status"
    provider: string; // "Provider"
    all: string; // "All"
    apply: string; // "Apply"
    reset: string; // "Reset"
  };

  /** Empty-state copy for the simulated list when filters return zero rows. */
  noMatches: string;

  /** Decorative pagination strip (concept-only). */
  pagination: {
    pageOf: (page: number, total: number) => string;
    prev: string;
    next: string;
  };

  /** Single-delivery event-timeline overlay (concept: what the detail
   * drawer would show). */
  eventTimeline: {
    /** Tagline strip ("Concept preview — not the real UI today"). */
    tag: string;
    /** Card title for the overlay. */
    cardTitle: string;
    /** Card subtitle. */
    cardSubtitle: string;
    /** Field labels. */
    deliveryIdLabel: string;
    recipientLabel: string;
    statusLabel: string;
    providerLabel: string;
    sourceLabel: string;
    /** "Event history" sub-heading. */
    historyTitle: string;
    /** Footnote reinforcing the immutable + deduped + never-regress invariants. */
    footnote: string;
    /** Dismiss button. */
    dismiss: string;
  };

  /** "How emails relate to other surfaces" sources card. */
  sourcesCard: {
    title: string;
    subtitle: string;
    rows: EmailsStageSourceRow[];
    footnote: string;
  };

  /** Seed deliveries shown in the simulated list. NEVER fetched from the API. */
  deliveries: EmailsStageDelivery[];

  /** Seed event-history rows for the timeline overlay. NEVER fetched. */
  events: EmailsStageEvent[];
}

/* ─── Creative section copy ─────────────────────────────────────────────── */

/* 1. Email lifecycle — the EmailDelivery state machine */

export interface LifecycleStateCopy {
  /** Status code — LTR token (e.g. "queued"). */
  code: EmailDeliveryStatus;
  /** Localized state name (e.g. "Queued"). */
  label: string;
  /** One-sentence description of what this state means. */
  desc: string;
  /** Whether the state is terminal (no further transitions, except the
   * explicit delivered → complained override for the complaint-wins rule). */
  terminal: boolean;
  /** Whether the state can be advanced by a later provider event (true
   * for queued, provider_accepted, deferred, and unknown; false for the
   * concrete terminal states — except complained can be reached FROM
   * delivered). */
  canAdvance: boolean;
  /** Optional side-effect note (e.g. "triggers suppression"). */
  sideEffect?: string;
}

export interface LifecycleTransitionCopy {
  /** Transition label, e.g. "Provider accepts envelope". */
  label: string;
  /** From status code — LTR token. */
  from: EmailDeliveryStatus;
  /** To status code — LTR token. */
  to: EmailDeliveryStatus;
  /** One-sentence description of what triggers this transition. */
  desc: string;
  /** Side effect — what happens to recipients / suppressions / retries. */
  sideEffect: string;
  /** Tone — controls the timeline marker color. */
  tone: "normal" | "good" | "warn" | "bad" | "recovery";
}

export interface EmailLifecycleCopy {
  heading: string;
  subheading: string;
  statesTitle: string;
  states: LifecycleStateCopy[];
  transitionsTitle: string;
  transitions: LifecycleTransitionCopy[];
  footnote: string;
  /** Side note about the SMTP-vs-webhook contract. */
  smtpNote: string;
}

/* 2. Status interpretation — per-status meaning matrix */

export interface StatusInterpretationRowCopy {
  /** Status code — LTR token (e.g. "queued"). */
  code: EmailDeliveryStatus;
  /** Localized state name (e.g. "Queued"). */
  label: string;
  /** "What triggers it" column — one sentence. */
  trigger: string;
  /** "Side effect" column — one sentence (suppression? retry? terminal?). */
  sideEffect: string;
  /** "Can you act on it?" column — one sentence. */
  action: string;
  /** Tone for the row accent color. */
  tone: "neutral" | "good" | "warn" | "bad" | "recovery";
}

export interface StatusInterpretationCopy {
  heading: string;
  subheading: string;
  matrixTitle: string;
  matrixSubtitle: string;
  colStatus: string; // "Status"
  colTrigger: string; // "What triggers it"
  colSideEffect: string; // "Side effect"
  colAction: string; // "What you can do"
  rows: StatusInterpretationRowCopy[];
  /** Note about the SMTP-vs-webhook contract for `delivered`. */
  smtpDeliveredNote: string;
  /** Note about the `unknown` recovery state. */
  unknownRecoveryNote: string;
  /** Note about the never-regress rules. */
  neverRegressNote: string;
}

/* 3. Delivery timeline — EmailDeliveryEvent history + never-regress rules */

export interface TimelineStepCopy {
  /** Step badge ("01", "02", ...). */
  badge: string;
  /** Step title. */
  title: string;
  /** Step body. */
  body: string;
  /** Optional LTR token (e.g. "occurredAt", "(provider, providerEventId)"). */
  token?: string;
  /** Tone — controls color coding. */
  tone: "ui" | "state" | "downstream";
}

export interface TimelineRegressRuleCopy {
  /** LTR token describing the rule (e.g. "delivered → delayed deferred"). */
  scenario: string;
  /** Localized outcome (e.g. "stay delivered"). */
  outcome: string;
  /** One-sentence rationale. */
  rationale: string;
}

export interface DeliveryTimelineCopy {
  heading: string;
  subheading: string;
  stepsTitle: string;
  steps: TimelineStepCopy[];
  regressTitle: string;
  regressSubtitle: string;
  regressRules: TimelineRegressRuleCopy[];
  /** Side-by-side comparison: event arrives BEFORE vs AFTER the last seen. */
  comparisonTitle: string;
  comparison: {
    dimension: string; // "Event ordering"
    beforeValue: string; // "older than last seen"
    afterValue: string; // "at or after last seen"
  }[];
  footnote: string;
}

/* 4. Failed-email troubleshooting — diagnostic decision flowchart */

export interface FailedTroubleshootingPathCopy {
  /** Stable key. */
  key: "hard_bounce" | "soft_bounce" | "complaint" | "rejected" | "failed" | "unknown";
  /** Localized path title (e.g. "Hard bounce"). */
  title: string;
  /** LTR token (e.g. "bounced (hard)"). */
  token: string;
  /** One-sentence symptom (what you'd see in the list). */
  symptom: string;
  /** One-sentence cause. */
  cause: string;
  /** One-sentence action you can take. */
  action: string;
  /** Tone — controls the path accent color. */
  tone: "bad" | "warn" | "recovery" | "neutral";
  /** Whether this path triggers a suppression. */
  suppressionApplied: boolean;
  /** Whether this path is auto-retry-eligible (deferred soft bounces retry; everything else doesn't). */
  retryEligible: boolean;
}

export interface FailedEmailTroubleshootingCopy {
  heading: string;
  subheading: string;
  pathsTitle: string;
  paths: FailedTroubleshootingPathCopy[];
  /** Decision-tree-style summary at the bottom. */
  decisionTreeTitle: string;
  decisionTree: {
    /** Localized question (e.g. "Is the recipient a real mailbox?"). */
    question: string;
    /** Localized "if yes → outcome" branch. */
    yes: string;
    /** Localized "if no → outcome" branch. */
    no: string;
  }[];
  /** Footnote about suppression lifability (mirrors Suppressions guide). */
  suppressionFootnote: string;
  /** Warning about not manually retrying a hard bounce. */
  warningTitle: string;
  warningBody: string;
}

export interface EmailsCreativeCopy {
  lifecycle: EmailLifecycleCopy;
  statusInterpretation: StatusInterpretationCopy;
  deliveryTimeline: DeliveryTimelineCopy;
  failedTroubleshooting: FailedEmailTroubleshootingCopy;
}

/* ─── Combined guide content type ───────────────────────────────────────── */

export type EmailsGuideContent = GuideContentBase & {
  stage: EmailsStageCopy;
  creative: EmailsCreativeCopy;
};
