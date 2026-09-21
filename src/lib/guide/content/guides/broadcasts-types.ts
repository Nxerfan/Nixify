/**
 * UX-B: Broadcasts guide — stage + creative copy types.
 *
 * The Broadcasts guide is the fifth guide in the UX-B contextual guide
 * system, after Contacts, Branding, Automations, and Templates. It mirrors
 * the REAL Nixify Broadcasts page at:
 *   - src/app/dashboard/broadcasts/page.tsx          (broadcasts list)
 *
 * Architecture rules (REGRESSION-PROTECTED):
 *   - The stage + creative copy are guide-specific types defined here, but
 *     they all share the common GuideContentBase fields (chapters,
 *     writtenSteps, etc.) defined in ../types.
 *   - Each content dictionary (broadcasts-en.ts, broadcasts-fa.ts) exports
 *     a BroadcastsGuideContent that the view component consumes directly.
 *   - Technical tokens (broadcast IDs, audience type codes like
 *     all_contacts/group, status strings like draft/queued/sending/
 *     completed/cancelled/review_pending/paused_quota/rejected/failed,
 *     skip reasons, {{contact.name}}/{{contact.email}}/{{unsubscribe_url}}
 *     placeholders, ISO timestamps, HTML body strings, email addresses,
 *     HTTP method names, recipient count numbers) stay LTR via <Ltr> at
 *     render time. They are stored as raw strings here.
 *   - The stage reads `dir` from the copy (ltr for en, rtl for fa) and is
 *     NOT permanently `dir="ltr"`.
 *
 * Source-of-truth UI audit (verbatim labels from the real broadcasts page):
 *
 *   LIST PAGE (src/app/dashboard/broadcasts/page.tsx):
 *   - Header: h1 "Broadcasts" (Megaphone emerald icon) + emerald
 *     "New broadcast" button (Plus icon).
 *   - Card titled "Broadcasts" with subtitle "Marketing campaigns. Only
 *     explicitly subscribed, non-suppressed contacts can receive
 *     broadcasts." Card body is the list of broadcasts.
 *   - Each broadcast row:
 *     - Top-left: bold name + status Badge (variant outline, color from
 *       STATUS_COLORS map; status text is `b.status.replace(/_/g, " ")`).
 *       Plus an optional "Review pending" amber Badge when
 *       b.reviewStatus === "pending".
 *     - Subject: muted text, truncated, wrapped in <Ltr>.
 *     - Stats row: Total · Sent (emerald) · Skipped (amber) · Failed (rose)
 *       · Pending.
 *     - Top-right action buttons:
 *       - if status === "draft": "Preview" outline button + "Launch"
 *         emerald button (Play icon).
 *       - if status in [review_pending, queued, sending, paused_quota]:
 *         "Cancel" outline button with rose text (X icon).
 *   - Empty state: "No broadcasts yet" + "Create one above."
 *   - Loading state: 2 skeleton bars.
 *   - Pagination (only when total > page_size): "Page {page} · {total} total"
 *     + Prev / Next buttons.
 *   - 401 → router.push("/auth").
 *   - 403 → not-available screen: "Broadcasts not available" +
 *     "Broadcasts are part of the Contacts capability, which is not
 *     available on your current plan."
 *   - Create dialog (max-w-2xl): title "New broadcast" + description
 *     "Create a draft broadcast. You can preview the audience and launch
 *     when ready. Every recipient will receive an unsubscribe footer
 *     automatically." Fields: Name (Input, max 200), Subject (Input,
 *     max 200, with variables help "Variables: {{contact.name}},
 *     {{contact.email}}, {{unsubscribe_url}}"), HTML content (textarea,
 *     mono, with help "An unsubscribe footer is automatically appended
 *     if not present."), Audience (Select: All contacts / Specific
 *     group, with help "Only subscribed, non-suppressed contacts will
 *     receive the broadcast."). Buttons: Cancel + emerald "Create draft".
 *   - On create success: toast "Broadcast draft created" + dialog closes
 *     + list reloads. The new row appears with status = draft.
 *   - On Preview click: POST /preview → toast "Audience preview" with
 *     description "Total: {total} · Eligible: {eligible} · Unknown:
 *     {unknown} · Unsubscribed: {unsubscribed} · Suppressed: {suppressed}".
 *   - On Launch click: POST /launch → if data.requiresReview: toast
 *     "Broadcast submitted for admin review" / "Recipient count exceeds
 *     review threshold." Else: toast "Broadcast launched" with
 *     description = recipientCount. List reloads. The draft row
 *     transitions to queued (or review_pending if over threshold).
 *   - On Cancel click: POST /cancel → toast "Broadcast cancelled" +
 *     list reloads.
 *
 * Status → color mapping (verbatim from STATUS_COLORS in the real page):
 *   draft           → slate
 *   review_pending  → amber
 *   queued          → blue
 *   sending         → blue
 *   paused_quota    → orange
 *   completed       → emerald
 *   cancelled       → rose
 *   rejected        → rose
 *   failed          → rose
 *
 * Real API endpoints (NOT called from the stage — for teaching only):
 *   GET    /api/dashboard/broadcasts?page=&pageSize=&status=
 *   POST   /api/dashboard/broadcasts              (create draft: name, subject, htmlContent, textContent?, audienceType, targetGroupId?)
 *   POST   /api/dashboard/broadcasts/{id}/preview (DB-side audience aggregation; no sends)
 *   POST   /api/dashboard/broadcasts/{id}/launch (IRREVERSIBLE: snapshot audience via INSERT...SELECT, freeze content, review threshold check, transition draft → queued/review_pending)
 *   POST   /api/dashboard/broadcasts/{id}/cancel (idempotent; cancellable: review_pending/queued/sending/paused_quota)
 *
 * Auth / entitlement:
 *   401 → router.push("/auth")
 *   403 → entitled=false screen ("Broadcasts not available" +
 *   "Broadcasts are part of the Contacts capability, which is not
 *   available on your current plan.")
 *
 * Broadcast lifecycle invariants (from src/lib/broadcasts/service.ts):
 *   - Audience membership is snapshotted at launch via DB-side
 *     INSERT...SELECT. No full-audience ID array is materialized in
 *     Node memory.
 *   - Consent/suppression is NOT snapshotted — it's re-checked
 *     immediately before provider dispatch via
 *     `getMarketingEligibility()`.
 *   - Counts are DERIVED from BroadcastRecipient rows (no
 *     retry-sensitive counters).
 *   - Content is frozen at launch — no editing after draft status.
 *   - BROADCAST_EMAILS quota consumed exactly once per actual provider
 *     attempt. Skipped recipients consume no quota. Idempotent replays
 *     consume no second quota.
 *   - BROADCAST_REVIEW_THRESHOLD = 1000. Recipient count > threshold →
 *     review_pending (admin approval required) instead of queued.
 *   - Idempotency-Key: dashboard auto-generates per launch click. Same
 *     key + different scheduledAt → 409 idempotency_conflict.
 *   - Audience types: all_contacts OR group (with targetGroupId).
 *   - Variables: {{contact.name}}, {{contact.email}}, {{unsubscribe_url}}.
 *   - Unsubscribe footer auto-appended if not present.
 */

import type { GuideContentBase } from "../types";

/* ─── Stage copy ────────────────────────────────────────────────────────── */

/** Status tone — controls the badge color class. */
export type BroadcastStatusTone =
  | "draft"
  | "review_pending"
  | "queued"
  | "sending"
  | "paused_quota"
  | "completed"
  | "cancelled"
  | "rejected"
  | "failed";

/** A single broadcast row shown in the simulated list. */
export interface BroadcastsStageBroadcast {
  /** Stable numeric ID (for keys). */
  id: number;
  /** Public broadcast identifier — LTR token (e.g. "bc_abc123"). */
  broadcastId: string;
  /** Human-friendly name. */
  name: string;
  /** Subject line with optional {{var}} placeholders — LTR token. */
  subject: string;
  /** Lifecycle status — LTR token. */
  status: BroadcastStatusTone;
  /** Whether the broadcast is awaiting admin review (recipient count > 1000). */
  reviewPending: boolean;
  /** Audience type code — LTR token. */
  audienceType: "all_contacts" | "group";
  /** Optional group name (when audienceType === "group"). */
  audienceLabel: string;
  /** Total recipient count at snapshot time. */
  totalRecipients: number;
  /** Sent count. */
  sentCount: number;
  /** Skipped count (consent re-check at send time). */
  skippedCount: number;
  /** Failed count (provider error). */
  failedCount: number;
  /** Pending count (not yet dispatched). */
  pendingCount: number;
  /** Created-at relative time string — LTR token. */
  createdAtRelative: string;
}

/** One row in the audience-preview breakdown. */
export interface BroadcastsStagePreviewBreakdown {
  /** Label key — used to look up the localized label. */
  key: "total" | "eligible" | "unknown" | "unsubscribed" | "suppressed";
  /** Numeric count. */
  count: number;
  /** Tone — controls the row color (eligible is emerald, suppressed/unsubscribed are muted). */
  tone: "neutral" | "good" | "warn";
}

/** A cancellable lifecycle status (used by the cancel-action eligibility map). */
export type BroadcastsStageCancellableStatus =
  | "review_pending"
  | "queued"
  | "sending"
  | "paused_quota";

export interface BroadcastsStageCopy {
  dir: "ltr" | "rtl";
  locale: "en" | "fa";

  header: {
    title: string; // "Broadcasts"
    subtitle: string; // "Marketing campaigns. Only explicitly subscribed..."
    create: string; // "New broadcast"
  };

  /** The Card title + subtitle shown above the list. */
  card: {
    title: string; // "Broadcasts"
    subtitle: string;
  };

  /** Status badge labels — already localized, keyed by status tone.
   * The dashboard renders the status string with underscores replaced by
   * spaces; we mirror that with the localized phrase. */
  statusLabels: Record<BroadcastStatusTone, string>;
  /** Review-pending badge text (shown next to the status badge). */
  reviewPendingBadge: string;

  /** Row stats line labels. */
  stats: {
    total: string; // "Total"
    sent: string; // "Sent"
    skipped: string; // "Skipped"
    failed: string; // "Failed"
    pending: string; // "Pending"
    audience: string; // "Audience"
  };

  /** Row action button copy. */
  actions: {
    preview: string; // "Preview"
    launch: string; // "Launch"
    cancel: string; // "Cancel"
    launching: string; // "Launching…"
    cancelling: string; // "Cancelling…"
  };

  /** Empty-state copy. */
  empty: {
    title: string; // "No broadcasts yet"
    description: string; // "Create one above."
  };

  /** Pagination copy. */
  pagination: {
    pageOf: (page: number, total: number) => string; // "Page {page} · {total} total"
    prev: string;
    next: string;
  };

  /** 403 not-available screen. */
  notAvailable: {
    title: string; // "Broadcasts not available"
    description: string;
    cta: string; // "View Plans"
  };

  /** Create-dialog copy. */
  createDialog: {
    title: string; // "New broadcast"
    description: string;
    nameLabel: string;
    namePlaceholder: string;
    subjectLabel: string;
    subjectPlaceholder: string;
    variablesHelp: string; // "Variables: {{contact.name}}, {{contact.email}}, {{unsubscribe_url}}"
    htmlLabel: string; // "HTML content"
    htmlPlaceholder: string;
    htmlHelp: string; // "An unsubscribe footer is automatically appended if not present."
    audienceLabel: string; // "Audience"
    audienceHelp: string; // "Only subscribed, non-suppressed contacts will receive the broadcast."
    allContacts: string; // "All contacts"
    specificGroup: string; // "Specific group"
    cancel: string;
    submit: string; // "Create draft"
    creating: string; // "Creating…"
  };

  /** Preview banner copy (the toast content rendered as a banner in the
   * simulated stage — never a real toast, never a real API call). */
  previewBanner: {
    title: string; // "Audience preview"
    /** "{label}: {count}" formatter per breakdown row. */
    rowLabel: (label: string, count: number) => string;
    /** Localized labels for each breakdown row. */
    labels: {
      total: string;
      eligible: string;
      unknown: string;
      unsubscribed: string;
      suppressed: string;
    };
    note: string; // "Preview eligibility reflects current consent state. Consent is re-checked at send time."
    dismiss: string;
  };

  /** Launch confirmation banner shown after a simulated Launch click. */
  launchBanner: {
    titleLaunched: string; // "Broadcast launched"
    titleReview: string; // "Broadcast submitted for admin review"
    bodyReview: string; // "Recipient count exceeds review threshold."
    /** "{n} recipients" formatter. */
    recipientCountLabel: (n: number) => string;
    dismiss: string;
  };

  /** Cancel confirmation banner shown after a simulated Cancel click. */
  cancelBanner: {
    title: string; // "Broadcast cancelled"
    dismiss: string;
  };

  /** Seed broadcasts shown in the simulated list — local demo data only.
   * NEVER fetched from the API. */
  broadcasts: BroadcastsStageBroadcast[];

  /** Audience-preview breakdown numbers for the previewBanner scene. */
  previewBreakdown: BroadcastsStagePreviewBreakdown[];
}

/* ─── Creative section copy ─────────────────────────────────────────────── */

/* 1. Broadcast lifecycle — the status state machine */

export interface LifecycleStateCopy {
  /** Status tone — matches the badge color in the real UI. */
  tone: BroadcastStatusTone;
  /** Localized state name (matches the badge label). */
  label: string;
  /** One-sentence description of what this state means. */
  desc: string;
  /** Whether the state is cancellable (Cancel button visible in the real UI). */
  cancellable: boolean;
  /** Whether the state is terminal (no further transitions). */
  terminal: boolean;
}

export interface LifecycleTransitionCopy {
  /** Transition label, e.g. "Launch click". */
  label: string;
  /** From state. */
  from: BroadcastStatusTone;
  /** To state. */
  to: BroadcastStatusTone;
  /** One-sentence description of what triggers this transition. */
  desc: string;
  /** Side effect — what happens to recipients / content / quota. */
  sideEffect: string;
}

export interface BroadcastLifecycleCopy {
  heading: string;
  subheading: string;
  statesTitle: string;
  states: LifecycleStateCopy[];
  transitionsTitle: string;
  transitions: LifecycleTransitionCopy[];
  footnote: string;
}

/* 2. Pre-send safety checklist — interactive checklist */

export interface PreSendChecklistItemCopy {
  /** Stable key — used as React key. */
  key: string;
  /** Localized checklist label. */
  label: string;
  /** One-sentence description of why this check matters. */
  desc: string;
  /** Optional LTR token (e.g. "POST /preview", "{{unsubscribe_url}}"). */
  token?: string;
}

export interface PreSendSafetyChecklistCopy {
  heading: string;
  subheading: string;
  checklistTitle: string;
  items: PreSendChecklistItemCopy[];
  allCheckedTitle: string;
  allCheckedBody: string;
  notAllCheckedTitle: string;
  notAllCheckedBody: string;
}

/* 3. Audience + Template flow — how the audience and content combine */

export interface AudienceTemplateFlowStepCopy {
  /** Step number badge — LTR token ("01", "02", ...). */
  badge: string;
  /** Step title. */
  title: string;
  /** Step body. */
  body: string;
  /** Optional LTR token (e.g. "all_contacts", "INSERT...SELECT"). */
  token?: string;
  /** Tone — controls color coding. */
  tone: "ui" | "state" | "downstream";
}

export interface AudienceTemplateFlowCopy {
  heading: string;
  subheading: string;
  legendTitle: string;
  legendItems: { label: string; tone: "ui" | "state" | "downstream" }[];
  steps: AudienceTemplateFlowStepCopy[];
  /** Side-by-side audience vs content card comparison. */
  audienceCard: {
    badge: string; // "Audience"
    title: string;
    body: string;
    items: string[]; // {{contact.name}}, {{contact.email}}, ...
  };
  contentCard: {
    badge: string; // "Content (frozen at launch)"
    title: string;
    body: string;
    items: string[]; // subject, html, text, unsubscribe footer
  };
  footnote: string;
}

/* 4. Send now vs Schedule — the launch decision */

export interface SendNowVsScheduleCopy {
  heading: string;
  subheading: string;
  sendNowCard: {
    badge: string; // "Send now"
    title: string;
    body: string;
    icon: "send";
  };
  scheduleCard: {
    badge: string; // "Schedule"
    title: string;
    body: string;
    icon: "clock";
  };
  /** Side-by-side comparison rows. */
  comparison: {
    dimension: string; // "API field"
    sendNowValue: string; // "scheduledAt: null"
    scheduleValue: string; // "scheduledAt: 2026-09-22T09:00:00Z"
  }[];
  /** Whether the dashboard UI currently exposes the schedule picker.
   * The launch API supports scheduledAt today, but the dashboard page.tsx
   * does not render a date picker yet — the schedule path is API-only
   * until the UI ships. */
  uiExposedNote: string;
  warningTitle: string;
  warningBody: string;
}

export interface BroadcastsCreativeCopy {
  lifecycle: BroadcastLifecycleCopy;
  preSendChecklist: PreSendSafetyChecklistCopy;
  audienceTemplateFlow: AudienceTemplateFlowCopy;
  sendNowVsSchedule: SendNowVsScheduleCopy;
}

/* ─── Combined guide content type ───────────────────────────────────────── */

export type BroadcastsGuideContent = GuideContentBase & {
  stage: BroadcastsStageCopy;
  creative: BroadcastsCreativeCopy;
};
