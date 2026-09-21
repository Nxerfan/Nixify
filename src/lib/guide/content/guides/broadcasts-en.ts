/**
 * UX-B: Broadcasts guide — English content dictionary.
 *
 * AUDIT-GRADE FACTUAL ACCURACY (re-verified this pass):
 *   Every statement here was verified against:
 *     - src/app/dashboard/broadcasts/page.tsx                       (Broadcasts list UI)
 *     - src/app/api/dashboard/broadcasts/route.ts                   (list + create)
 *     - src/app/api/dashboard/broadcasts/[broadcastId]/launch/route.ts
 *     - src/app/api/dashboard/broadcasts/[broadcastId]/preview/route.ts
 *     - src/app/api/dashboard/broadcasts/[broadcastId]/cancel/route.ts
 *     - src/lib/broadcasts/service.ts                                (launch + cancel + preview invariants)
 *     - src/lib/broadcasts/constants.ts                             (statuses, threshold, audience types)
 *     - src/i18n/en.ts                                              (real dashboard labels)
 *
 * Specifically:
 *   - The real Broadcasts page renders the status string with underscores
 *     replaced by spaces (b.status.replace(/_/g, " ")). The badges use
 *     color-coded STATUS_COLORS classes — draft=slate, review_pending=amber,
 *     queued=blue, sending=blue, paused_quota=orange, completed=emerald,
 *     cancelled=rose, rejected=rose, failed=rose.
 *   - The list row shows: name + status badge + optional "Review pending"
 *     amber badge; subject (truncated, wrapped in <Ltr>); stats line
 *     Total / Sent (emerald) / Skipped (amber) / Failed (rose) / Pending;
 *     actions: Preview + Launch when draft; Cancel when cancellable.
 *   - The Launch action is irreversible: only the draft status can be
 *     launched. The transition is CAS — only one launch wins per broadcast.
 *   - Launch does THREE things atomically: (1) snapshot the audience
 *     via DB-side INSERT...SELECT (no full ID array in Node memory),
 *     (2) freeze the content (no editing after draft), and (3) check
 *     the review threshold. recipientCount > 1000 → review_pending;
 *     otherwise queued.
 *   - Audience preview is read-only and free — POST /preview aggregates
 *     marketingStatus + suppression counts DB-side. No sends, no quota.
 *   - Cancel is idempotent and only works for review_pending, queued,
 *     sending, paused_quota. Already-terminal statuses (completed,
 *     cancelled, rejected, failed) no-op.
 *   - BROADCAST_REVIEW_THRESHOLD = 1000. recipientCount > threshold →
 *     review_pending (admin approval required) instead of queued.
 *   - The launch API accepts a `scheduledAt` ISO datetime. The dashboard
 *     page.tsx does NOT currently render a date picker — it sends `{}`.
 *     The schedule path is API-only today.
 *   - Variables: {{contact.name}}, {{contact.email}}, {{unsubscribe_url}}.
 *   - Unsubscribe footer is auto-appended if not present in the HTML body.
 *   - Consent/suppression is re-checked at send time, not snapshotted.
 *     A subscribed contact who later unsubscribes between launch and
 *     dispatch is skipped (not_subscribed).
 *
 * Tokens that must stay LTR (broadcast IDs, status strings, audience type
 * codes, {{var}} placeholders, ISO timestamps, HTTP method names, recipient
 * counts) are stored as raw strings here and wrapped with <Ltr> at render
 * time in the page component.
 *
 * This dictionary ALSO contains:
 *   - stage: human-facing copy for the simulated BroadcastsStage product UI
 *   - creative: copy for the four creative sections (Lifecycle, Pre-Send
 *     Checklist, Audience + Template Flow, Send Now vs Schedule)
 * Both are typed via the shared BroadcastsGuideContent interface so the
 * render components receive resolved content rather than reading locale
 * directly.
 */

import type { BroadcastsGuideContent } from "./broadcasts-types";

export const broadcastsEn: BroadcastsGuideContent = {
  slug: "broadcasts",
  routeKey: "broadcasts",
  backHref: "/dashboard/broadcasts",
  stepCount: 6,
  durationMin: 5,
  category: "messaging",
  dashboardRoute: "/dashboard/broadcasts",
  title: "Broadcasts",
  description:
    "Send a marketing campaign to a snapshot audience. Draft, preview, launch (irreversible), and track delivery live.",
  chapters: [
    {
      id: "intro",
      title: "Broadcasts",
      steps: [
        {
          id: "broadcastsOverview",
          caption:
            "Here is the Broadcasts list. Each row is one campaign with a color-coded status badge — draft, queued, sending, paused_quota, completed, cancelled — plus recipient counts and the row's available actions.",
          duration: 7000,
          scene: "broadcastsOverview",
        },
        {
          id: "createBroadcast",
          caption:
            "Click \"New broadcast\" to draft a campaign. You set the name, subject, HTML body, and audience (All contacts or a Specific group). The unsubscribe footer is auto-appended if missing. Saving creates a draft — nothing is sent yet.",
          duration: 7500,
          scene: "createBroadcast",
          typedText: "Monthly product update",
        },
        {
          id: "previewAudience",
          caption:
            "Before launching, click Preview on a draft. Nixify runs a DB-side aggregation and reports Total · Eligible · Unknown · Unsubscribed · Suppressed. Preview is free — no sends, no quota. Eligibility is re-checked at send time, so the live send may differ.",
          duration: 7500,
          scene: "previewAudience",
        },
        {
          id: "launchDecision",
          caption:
            "Click Launch when you're ready. This is irreversible. Nixify snapshots the audience (INSERT...SELECT), freezes the content, and checks the review threshold. Over 1000 recipients → review_pending. Otherwise the broadcast moves to queued.",
          duration: 8000,
          scene: "launchDecision",
        },
        {
          id: "inFlightProgress",
          caption:
            "Once queued, a background worker claims batches of recipients and dispatches them. Each recipient is re-checked for consent at dispatch time — unsubscribed or newly-suppressed contacts are skipped, not sent. Counts update live as sends complete.",
          duration: 7500,
          scene: "inFlightProgress",
        },
        {
          id: "completedOrCancelled",
          caption:
            "A broadcast ends in one of two terminal states: completed (all recipients processed — sent, skipped, or failed) or cancelled (you clicked Cancel while it was queued, sending, or paused_quota). Terminal broadcasts cannot be edited or relaunched.",
          duration: 7000,
          scene: "completedOrCancelled",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "Read the broadcasts list",
      body: "The Broadcasts page lists every campaign in your account. Each row shows the name, a color-coded status badge (draft, queued, sending, completed, cancelled, and so on), the subject line, and the recipient breakdown: Total · Sent · Skipped · Failed · Pending. Status drives the action buttons on the right — draft rows expose Preview and Launch; cancellable rows expose Cancel.",
    },
    {
      title: "Draft a new broadcast",
      body: "Click \"New broadcast\". The dialog requires a name, a subject, an HTML body, and an audience (All contacts or a Specific group). The subject accepts variables like {{contact.name}} and {{contact.email}}. An unsubscribe footer is automatically appended to the HTML body if you don't include one. Saving persists a draft — nothing is queued and nothing is sent.",
    },
    {
      title: "Preview the audience before launching",
      body: "On a draft row, click Preview. Nixify runs a DB-side aggregation and reports five numbers: Total, Eligible, Unknown, Unsubscribed, and Suppressed. Eligible = subscribed and not currently suppressed. Preview is free — it consumes no quota and writes no recipient rows. The numbers reflect current consent state; consent is re-checked at send time, so the actual send set may differ if a contact unsubscribes between preview and dispatch.",
    },
    {
      title: "Launch (irreversible)",
      body: "Click Launch to start the broadcast. This is irreversible. The launch endpoint atomically snapshots the audience via INSERT...SELECT (no full ID array in Node memory), freezes the content, and checks the review threshold of 1000 recipients. Over threshold → review_pending (admin approval required). Under threshold → queued. The draft status is the only status from which launch is allowed; once queued, the content cannot be edited.",
    },
    {
      title: "Cancel while in flight",
      body: "If a broadcast is in review_pending, queued, sending, or paused_quota, you can click Cancel. Cancel is idempotent — calling it on an already-cancelled broadcast is a no-op. Terminal statuses (completed, cancelled, rejected, failed) cannot be cancelled. Cancel stops further dispatch but does not undo sends that already landed in recipient inboxes.",
    },
    {
      title: "Track the lifecycle to terminal",
      body: "Every broadcast reaches one of three terminal statuses: completed (all recipients processed — sum of sent + skipped + failed), cancelled (you stopped it), or failed (system-level failure, e.g. provider outage). The recipient counts are derived from BroadcastRecipient rows — they are not retry-sensitive counters. Skipped recipients consume no quota. Failed recipients are tagged with a safe error code (provider_error, quota_error, provider_outcome_unknown, and so on) — never raw provider stack traces.",
    },
  ],
  whyWhen: [
    {
      title: "When to use a broadcast vs an automation",
      body: "Use a broadcast when you want to send a one-shot marketing campaign to a snapshot audience — a monthly newsletter, a product launch, a promo. Use an automation when the send should fire automatically in response to a user event (e.g. OTP verified → welcome email). Broadcasts are pull-triggered by a human click; automations are push-triggered by an event.",
    },
    {
      title: "Why the launch is irreversible",
      body: "Launch atomically snapshots the audience and freezes the content. The snapshot is the recipient list at the moment of launch — it does not change as contacts subscribe, unsubscribe, or get suppressed afterwards. The freeze prevents bait-and-switch: the version you previewed is the version that gets sent. Allowing a draft to be re-edited after launch would break that contract.",
    },
    {
      title: "Why consent is re-checked at send time",
      body: "The audience snapshot captures WHO will be considered. Consent and suppression are NOT snapshotted — they are re-checked immediately before provider dispatch via getMarketingEligibility(). This means a contact who unsubscribes between launch and dispatch is skipped, not sent. This is required for CAN-SPAM / GDPR compliance — consent must be honored as of the actual send, not as of when you clicked Launch.",
    },
  ],
  mistakes: [
    {
      title: "Expecting the launch to be undoable",
      body: "Launch is irreversible. Once you click it, the audience is snapshotted and the content is frozen. The only way to stop further sends is Cancel — and Cancel does not undo sends that already landed. Preview the audience first; verify the content first; only then launch.",
    },
    {
      title: "Trusting the preview count as the exact send count",
      body: "Preview reports eligibility at the moment of preview. Between preview and launch, contacts may subscribe, unsubscribe, or get suppressed. Between launch and dispatch, consent is re-checked. The actual sent count is almost always lower than the preview eligible count. Plan for the gap.",
    },
    {
      title: "Forgetting the unsubscribe footer",
      body: "The dashboard auto-appends an unsubscribe footer if your HTML body doesn't include one — but relying on the auto-append is fragile. Best practice is to include the {{unsubscribe_url}} link explicitly in your design. The auto-append is a safety net, not a primary mechanism.",
    },
    {
      title: "Editing a draft after the team has reviewed it",
      body: "Content is frozen at launch — but the draft phase has no such lock. If a teammate previews a draft and gives the green light, then you edit the HTML body before clicking Launch, the launched content will be the edited version — not the version your teammate approved. Treat the draft as mutable up until launch; after launch it's immutable.",
    },
    {
      title: "Expecting Cancel to claw back sent emails",
      body: "Cancel stops further dispatch. It does not recall emails already delivered to recipient inboxes. Once a recipient is in `sent` state, the email is in their inbox — Cancel cannot reach it. Use Cancel early; the longer you wait, the more recipients have already received the message.",
    },
  ],
  proTips: [
    {
      title: "Preview before every launch — always",
      body: "Preview is free, fast, and gives you the exact Total / Eligible / Unknown / Unsubscribed / Suppressed breakdown. It catches audience mistakes before they cost you quota or hurt your sender reputation. Make it a habit: no Preview, no Launch.",
    },
    {
      title: "Use a Specific group for large-audience tests",
      body: "If you want to test a broadcast on a small slice before going wide, create a Contact Group with a few internal testers, draft the broadcast with audience = Specific group, and launch. The snapshot is small, the send is contained, and you can verify the rendered email and the unsubscribe footer before sending to everyone.",
    },
    {
      title: "Watch the review_pending path",
      body: "Broadcasts with more than 1000 recipients go through admin review (review_pending). Plan around it: if you have a time-sensitive promo, launch a day early so the admin has time to approve. Once approved, the broadcast moves to queued and starts dispatching normally.",
    },
    {
      title: "Treat skipped as a feature, not a bug",
      body: "Skipped means a recipient was in the audience snapshot but was not eligible at send time (unsubscribed, suppressed, or contact deleted). This is the system honoring consent in real time. A high skipped count on a fresh broadcast usually means your audience has gone stale — clean it up before the next send.",
    },
  ],
  troubleshooting: [
    {
      title: "Broadcasts not available",
      body: "If you see \"Broadcasts not available\", your plan does not include the Contacts + Broadcast Emails capabilities. Broadcasts depend on both. Upgrade your plan to gain access. The 403 response has code = feature_not_available.",
    },
    {
      title: "Launch failed with validation_failed",
      body: "The launch endpoint validates the content one more time before transitioning out of draft. If the subject is empty, the HTML body is empty, or the HTML exceeds 500 KB, you'll get a 400 with code = validation_failed. Fix the content in the draft and try again.",
    },
    {
      title: "Launch returned review_pending",
      body: "The recipient count exceeded the review threshold of 1000. The broadcast is now in review_pending with a \"Review pending\" badge. An admin must approve it before it moves to queued. This is by design — large sends get a human-in-the-loop check.",
    },
    {
      title: "Cancel button is missing",
      body: "Cancel only appears on rows in review_pending, queued, sending, or paused_quota. If the row is in draft, completed, cancelled, rejected, or failed, there is no Cancel button — draft rows have Preview + Launch instead; terminal rows have no actions.",
    },
    {
      title: "Sent count is lower than eligible",
      body: "This is expected. Eligible = subscribed + not suppressed at preview time. Between preview and dispatch, some contacts may have unsubscribed or been suppressed. Those contacts are skipped at send time. The skipped count on the row reflects this — it is not an error, it is consent being honored in real time.",
    },
    {
      title: "Broadcast stuck in sending",
      body: "If a broadcast has been in sending for a long time with no progress, a worker may have crashed mid-batch. Stale processing recipients are auto-recovered (back to pending) within 10 minutes. Stale dispatching recipients — which may have called the provider — are transitioned to terminal failed with errorCode = provider_outcome_unknown after 30 minutes. Either way, the broadcast will reach a terminal state.",
    },
  ],
  checklist: [
    { label: "Broadcast is in draft status (the only launchable state)" },
    { label: "Audience preview shows eligible > 0" },
    { label: "Subject and HTML body are non-empty and under size limits" },
    { label: "HTML body includes {{unsubscribe_url}} or relies on auto-append" },
    { label: "Variables {{contact.name}} and {{contact.email}} resolve in preview" },
    { label: "Recipient count is under 1000 (or you've planned for review_pending)" },
  ],
  whatNext:
    "After launching, watch the row's stats update live as the background worker dispatches. Use Sent Emails to inspect individual deliveries, Suppressions to see which contacts were skipped and why, and Templates to reuse the broadcast's content as a versioned template for the next campaign.",
  related: [
    { label: "Broadcasts dashboard", href: "/dashboard/broadcasts" },
    { label: "Templates guide", href: "/guide/templates" },
    { label: "Contacts guide", href: "/guide/contacts" },
  ],

  /* ─── Stage copy ──────────────────────────────────────────────────────── */
  stage: {
    dir: "ltr",
    locale: "en",

    header: {
      title: "Broadcasts",
      subtitle:
        "Marketing campaigns. Only explicitly subscribed, non-suppressed contacts can receive broadcasts.",
      create: "New broadcast",
    },

    card: {
      title: "Broadcasts",
      subtitle:
        "Marketing campaigns. Only explicitly subscribed, non-suppressed contacts can receive broadcasts.",
    },

    statusLabels: {
      draft: "draft",
      review_pending: "review pending",
      queued: "queued",
      sending: "sending",
      paused_quota: "paused quota",
      completed: "completed",
      cancelled: "cancelled",
      rejected: "rejected",
      failed: "failed",
    },
    reviewPendingBadge: "Review pending",

    stats: {
      total: "Total",
      sent: "Sent",
      skipped: "Skipped",
      failed: "Failed",
      pending: "Pending",
      audience: "Audience",
    },

    actions: {
      preview: "Preview",
      launch: "Launch",
      cancel: "Cancel",
      launching: "Launching…",
      cancelling: "Cancelling…",
    },

    empty: {
      title: "No broadcasts yet",
      description: "Create one above.",
    },

    pagination: {
      pageOf: (page, total) => `Page ${page} · ${total} total`,
      prev: "Prev",
      next: "Next",
    },

    notAvailable: {
      title: "Broadcasts not available",
      description:
        "Broadcasts are part of the Contacts capability, which is not available on your current plan.",
      cta: "View Plans",
    },

    createDialog: {
      title: "New broadcast",
      description:
        "Create a draft broadcast. You can preview the audience and launch when ready. Every recipient will receive an unsubscribe footer automatically.",
      nameLabel: "Name",
      namePlaceholder: "Monthly newsletter",
      subjectLabel: "Subject",
      subjectPlaceholder: "Hello {{contact.name}}!",
      variablesHelp:
        "Variables: {{contact.name}}, {{contact.email}}, {{unsubscribe_url}}",
      htmlLabel: "HTML content",
      htmlPlaceholder:
        "<p>Hello {{contact.name}}!</p>\n<p>Welcome to our newsletter.</p>",
      htmlHelp:
        "An unsubscribe footer is automatically appended if not present.",
      audienceLabel: "Audience",
      audienceHelp:
        "Only subscribed, non-suppressed contacts will receive the broadcast.",
      allContacts: "All contacts",
      specificGroup: "Specific group",
      cancel: "Cancel",
      submit: "Create draft",
      creating: "Creating...",
    },

    previewBanner: {
      title: "Audience preview",
      rowLabel: (label, count) => `${label}: ${count}`,
      labels: {
        total: "Total",
        eligible: "Eligible",
        unknown: "Unknown",
        unsubscribed: "Unsubscribed",
        suppressed: "Suppressed",
      },
      note: "Preview eligibility reflects current consent state. Consent is re-checked at send time.",
      dismiss: "Dismiss",
    },

    launchBanner: {
      titleLaunched: "Broadcast launched",
      titleReview: "Broadcast submitted for admin review",
      bodyReview: "Recipient count exceeds review threshold.",
      recipientCountLabel: (n) => `${n} recipients`,
      dismiss: "Dismiss",
    },

    cancelBanner: {
      title: "Broadcast cancelled",
      dismiss: "Dismiss",
    },

    /* Seed broadcasts shown in the simulated list. NEVER fetched from the
     * API. Numbers chosen to exercise every visible status + the
     * cancellable path + the review-pending path. */
    broadcasts: [
      {
        id: 1,
        broadcastId: "bc_monthly_2026_09",
        name: "Monthly product update",
        subject: "Hello {{contact.name}} — what's new in September",
        status: "draft",
        reviewPending: false,
        audienceType: "all_contacts",
        audienceLabel: "All contacts",
        totalRecipients: 0,
        sentCount: 0,
        skippedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        createdAtRelative: "just now",
      },
      {
        id: 2,
        broadcastId: "bc_welcome_series_03",
        name: "Welcome series — onboarding email 3",
        subject: "{{contact.name}}, here's how to get started",
        status: "queued",
        reviewPending: false,
        audienceType: "group",
        audienceLabel: "New signups (last 7 days)",
        totalRecipients: 482,
        sentCount: 0,
        skippedCount: 0,
        failedCount: 0,
        pendingCount: 482,
        createdAtRelative: "2 minutes ago",
      },
      {
        id: 3,
        broadcastId: "bc_summer_promo_2026",
        name: "Summer promo — 48h flash sale",
        subject: "48 hours only — 30% off for {{contact.name}}",
        status: "sending",
        reviewPending: false,
        audienceType: "all_contacts",
        audienceLabel: "All contacts",
        totalRecipients: 1284,
        sentCount: 612,
        skippedCount: 41,
        failedCount: 3,
        pendingCount: 628,
        createdAtRelative: "8 minutes ago",
      },
      {
        id: 4,
        broadcastId: "bc_q2_newsletter",
        name: "Q2 newsletter — year in review",
        subject: "Q2 recap — what {{contact.name}} missed",
        status: "completed",
        reviewPending: false,
        audienceType: "all_contacts",
        audienceLabel: "All contacts",
        totalRecipients: 938,
        sentCount: 871,
        skippedCount: 60,
        failedCount: 7,
        pendingCount: 0,
        createdAtRelative: "3 days ago",
      },
      {
        id: 5,
        broadcastId: "bc_blackfriday_dryrun",
        name: "Black Friday teaser (dry-run)",
        subject: "Coming soon — Black Friday deals for {{contact.name}}",
        status: "cancelled",
        reviewPending: false,
        audienceType: "group",
        audienceLabel: "Internal testers",
        totalRecipients: 24,
        sentCount: 12,
        skippedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        createdAtRelative: "5 days ago",
      },
      {
        id: 6,
        broadcastId: "bc_holiday_mega_2026",
        name: "Holiday mega-send 2026",
        subject: "Holiday greetings from the team",
        status: "review_pending",
        reviewPending: true,
        audienceType: "all_contacts",
        audienceLabel: "All contacts",
        totalRecipients: 2150,
        sentCount: 0,
        skippedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        createdAtRelative: "1 hour ago",
      },
    ],

    /* Preview breakdown — used by the previewAudience scene. */
    previewBreakdown: [
      { key: "total", count: 1284, tone: "neutral" },
      { key: "eligible", count: 942, tone: "good" },
      { key: "unknown", count: 187, tone: "warn" },
      { key: "unsubscribed", count: 124, tone: "warn" },
      { key: "suppressed", count: 31, tone: "warn" },
    ],
  },

  /* ─── Creative section copy ──────────────────────────────────────────── */
  creative: {
    /* 1. Broadcast lifecycle — the status state machine */
    lifecycle: {
      heading: "The broadcast lifecycle",
      subheading:
        "Every broadcast moves through a small state machine. Each status drives the row's color badge and which action buttons are visible. Only the draft status can be launched; only cancellable statuses can be cancelled; once terminal, the row stays terminal.",
      statesTitle: "States",
      states: [
        {
          tone: "draft",
          label: "draft",
          desc: "Initial state after Create. Content and audience are editable. Preview is available. Launch is available.",
          cancellable: false,
          terminal: false,
        },
        {
          tone: "review_pending",
          label: "review pending",
          desc: "Launch was clicked with more than 1000 recipients. An admin must approve before the broadcast moves to queued. Cancel is available.",
          cancellable: true,
          terminal: false,
        },
        {
          tone: "queued",
          label: "queued",
          desc: "Audience snapshotted, content frozen, waiting for a background worker to claim the first batch. Cancel is available.",
          cancellable: true,
          terminal: false,
        },
        {
          tone: "sending",
          label: "sending",
          desc: "A worker is actively claiming batches and dispatching to the provider. Counts update live. Cancel is available.",
          cancellable: true,
          terminal: false,
        },
        {
          tone: "paused_quota",
          label: "paused quota",
          desc: "BROADCAST_EMAILS quota exhausted mid-send. The broadcast waits for quota to refill (monthly cycle) or be upgraded. Cancel is available.",
          cancellable: true,
          terminal: false,
        },
        {
          tone: "completed",
          label: "completed",
          desc: "All recipients reached a terminal state (sent, skipped, or failed). No further transitions. No actions available.",
          cancellable: false,
          terminal: true,
        },
        {
          tone: "cancelled",
          label: "cancelled",
          desc: "You clicked Cancel while the broadcast was cancellable. Already-sent emails are not clawed back. No further transitions.",
          cancellable: false,
          terminal: true,
        },
        {
          tone: "rejected",
          label: "rejected",
          desc: "Admin rejected the broadcast during review. No sends. No further transitions.",
          cancellable: false,
          terminal: true,
        },
        {
          tone: "failed",
          label: "failed",
          desc: "System-level failure (e.g. provider outage). Recipients that were dispatched may still have received the email; the failure reflects the broadcast-level state, not individual recipient outcomes.",
          cancellable: false,
          terminal: true,
        },
      ],
      transitionsTitle: "Transitions",
      transitions: [
        {
          label: "Create",
          from: "draft",
          to: "draft",
          desc: "POST /api/dashboard/broadcasts creates a draft. No audience snapshot yet, no quota consumed.",
          sideEffect: "Broadcast row appears in the list with status = draft.",
        },
        {
          label: "Launch (≤ 1000 recipients)",
          from: "draft",
          to: "queued",
          desc: "POST /launch with recipientCount ≤ 1000. Audience snapshotted via INSERT...SELECT, content frozen, CAS draft → queued.",
          sideEffect: "BroadcastRecipient rows created with status = pending. BROADCAST_EMAILS quota not yet consumed.",
        },
        {
          label: "Launch (> 1000 recipients)",
          from: "draft",
          to: "review_pending",
          desc: "POST /launch with recipientCount > 1000. Same snapshot + freeze, but reviewStatus = pending. Awaits admin approval.",
          sideEffect: "Review-pending badge appears next to the status badge. No dispatch until approved.",
        },
        {
          label: "Admin approves",
          from: "review_pending",
          to: "queued",
          desc: "Admin clicks Approve in the admin dashboard. Broadcast moves to queued; worker claims normally.",
          sideEffect: "Review-pending badge disappears. Worker dispatch begins.",
        },
        {
          label: "Worker claims batch",
          from: "queued",
          to: "sending",
          desc: "Background worker claims the first batch of 25 recipients via atomic CAS. Status transitions queued → sending.",
          sideEffect: "Counts start updating. Sent/skipped/failed counts grow as recipients reach terminal states.",
        },
        {
          label: "Quota exhausted",
          from: "sending",
          to: "paused_quota",
          desc: "checkUsage() returns false mid-dispatch. Broadcast pauses. Pending recipients stay pending.",
          sideEffect: "No further dispatch until quota refills. Cancel is still available.",
        },
        {
          label: "All recipients processed",
          from: "sending",
          to: "completed",
          desc: "pendingCount = 0 AND processingCount = 0 AND dispatchingCount = 0. Broadcast transitions to completed.",
          sideEffect: "Final counts are stable. No further transitions. No actions available.",
        },
        {
          label: "Cancel (cancellable)",
          from: "sending",
          to: "cancelled",
          desc: "POST /cancel from the dashboard. Idempotent — calling on an already-cancelled broadcast is a no-op.",
          sideEffect: "Pending recipients are skipped with reason = broadcast_cancelled. Already-sent emails are NOT clawed back.",
        },
      ],
      footnote:
        "Counts are DERIVED from BroadcastRecipient rows (no retry-sensitive counters). Sent + skipped + failed = totalRecipients at terminal. Skipped recipients consume no quota; failed recipients are tagged with a safe error code (provider_error, quota_error, provider_outcome_unknown, and so on) — never raw provider stack traces.",
    },

    /* 2. Pre-send safety checklist */
    preSendChecklist: {
      heading: "Pre-send safety checklist",
      subheading:
        "Run this checklist on every broadcast before clicking Launch. Launch is irreversible — once you click it, the audience is snapshotted and the content is frozen. The checklist catches the mistakes that survive a quick glance but break a real send.",
      checklistTitle: "Run these before Launch",
      items: [
        {
          key: "draft-status",
          label: "Broadcast is in draft status",
          desc: "Only draft rows show the Launch button. If you see Preview + Launch, you're good. If you see Cancel, the broadcast is already in flight.",
          token: "status === draft",
        },
        {
          key: "preview-run",
          label: "Preview shows eligible > 0",
          desc: "POST /preview returns Total / Eligible / Unknown / Unsubscribed / Suppressed. If eligible = 0, the launch will snapshot an empty audience — every recipient will be skipped.",
          token: "POST /preview",
        },
        {
          key: "content-valid",
          label: "Subject and HTML body are non-empty and under limits",
          desc: "Subject ≤ 200 chars, HTML body ≤ 500 KB, text body ≤ 200 KB. The launch endpoint re-validates; if invalid you'll get 400 validation_failed.",
          token: "subject ≤ 200, html ≤ 500KB",
        },
        {
          key: "unsubscribe-footer",
          label: "HTML body includes an unsubscribe link",
          desc: "Best practice: include {{unsubscribe_url}} explicitly in your design. The dashboard auto-appends a footer if missing, but relying on the auto-append is fragile.",
          token: "{{unsubscribe_url}}",
        },
        {
          key: "variables-resolve",
          label: "Variables resolve in preview",
          desc: "Subject and HTML body use {{contact.name}}, {{contact.email}}, {{unsubscribe_url}}. Preview them in the rendered output — a typo like {{contact.nme}} will silently render empty.",
          token: "{{contact.name}}",
        },
        {
          key: "review-threshold",
          label: "Recipient count is under 1000 (or you've planned for review)",
          desc: "Over 1000 → review_pending. If your send is time-sensitive, launch a day early so the admin has time to approve.",
          token: "BROADCAST_REVIEW_THRESHOLD = 1000",
        },
        {
          key: "audience-fresh",
          label: "Audience is not stale (preview shows low unsubscribed/suppressed)",
          desc: "A high skipped count on a previous broadcast usually means your audience has gone stale. Clean it up (or switch to a Specific group) before the next send.",
          token: "skipped / total < 10%",
        },
      ],
      allCheckedTitle: "Ready to launch",
      allCheckedBody:
        "All seven checks pass. Launch is still irreversible, but you've done the due diligence. Click Launch — the audience will be snapshotted, the content frozen, and the broadcast moved to queued (or review_pending if over the threshold).",
      notAllCheckedTitle: "Not ready yet",
      notAllCheckedBody:
        "One or more checks are still failing. Fix them in the draft before launching. Launching now will either fail validation (returning 400) or send to the wrong audience with the wrong content — and you cannot undo it.",
    },

    /* 3. Audience + Template flow */
    audienceTemplateFlow: {
      heading: "How the audience and the content combine",
      subheading:
        "A broadcast is the cartesian product of an audience (who) and content (what). They are independent inputs — you pick the audience from your contacts or a group, you write the content (subject + HTML body), and at launch they are joined and frozen. Understanding the join is the key to understanding why preview numbers and final send numbers can differ.",
      legendTitle: "Color coding",
      legendItems: [
        { label: "UI action", tone: "ui" },
        { label: "State transition", tone: "state" },
        { label: "Downstream side effect", tone: "downstream" },
      ],
      steps: [
        {
          badge: "01",
          title: "Pick an audience",
          body: "In the Create dialog, choose All contacts or a Specific group. The audience is a SQL filter on the Contact table — nothing is materialized yet.",
          token: "audienceType = all_contacts | group",
          tone: "ui",
        },
        {
          badge: "02",
          title: "Write the content",
          body: "Subject + HTML body + optional plain text. Variables {{contact.name}}, {{contact.email}}, {{unsubscribe_url}} are placeholders — they are NOT resolved at draft time.",
          token: "subject, htmlContent, textContent",
          tone: "ui",
        },
        {
          badge: "03",
          title: "Save the draft",
          body: "POST /api/dashboard/broadcasts persists the row with status = draft. No snapshot, no freeze, no quota. The content is editable, the audience is just a SQL filter.",
          token: "POST /api/dashboard/broadcasts",
          tone: "state",
        },
        {
          badge: "04",
          title: "Preview the audience (free, no snapshot)",
          body: "POST /preview runs a DB-side GROUP BY on marketingStatus + suppression. Returns Total / Eligible / Unknown / Unsubscribed / Suppressed. No recipient rows are written.",
          token: "POST /preview",
          tone: "ui",
        },
        {
          badge: "05",
          title: "Launch — snapshot + freeze (irreversible)",
          body: "POST /launch opens a transaction. Audience is snapshotted via INSERT...SELECT into BroadcastRecipient. Content is frozen. Review threshold checked. CAS draft → queued.",
          token: "INSERT...SELECT INTO BroadcastRecipient",
          tone: "state",
        },
        {
          badge: "06",
          title: "Worker claims + dispatches per recipient",
          body: "For each recipient: re-check consent via getMarketingEligibility(). If eligible: render the content (resolve {{var}}), call provider.send(), write Delivery row. If not: skip with reason.",
          token: "getMarketingEligibility()",
          tone: "downstream",
        },
        {
          badge: "07",
          title: "Counts update live; broadcast reaches terminal",
          body: "Sent/skipped/failed grow as recipients reach terminal states. When pending = 0 AND processing = 0 AND dispatching = 0, the broadcast transitions to completed.",
          token: "sent + skipped + failed = totalRecipients",
          tone: "downstream",
        },
      ],
      audienceCard: {
        badge: "Audience",
        title: "Who will receive this",
        body: "The audience is a SQL filter on the Contact table, snapshotted at launch. Each contact becomes a BroadcastRecipient row with status = pending. Variables per recipient come from the contact record.",
        items: ["{{contact.name}}", "{{contact.email}}", "marketingStatus", "suppression state"],
      },
      contentCard: {
        badge: "Content (frozen at launch)",
        title: "What they will receive",
        body: "Subject + HTML body + optional plain text. Frozen at launch — the version you previewed is the version that gets sent. Variables are resolved per-recipient at dispatch time, not at snapshot time.",
        items: ["subject", "htmlContent", "textContent (optional)", "unsubscribe footer (auto-appended if missing)"],
      },
      footnote:
        "Audience + content are independent inputs. The snapshot joins them: each contact in the audience gets a row pointing at the frozen content. Variables ({{contact.name}}, {{contact.email}}) come from the contact; {{unsubscribe_url}} is minted per-recipient. Consent is NOT snapshotted — it's re-checked at dispatch time, so a contact who unsubscribes between launch and dispatch is skipped, not sent.",
    },

    /* 4. Send now vs Schedule */
    sendNowVsSchedule: {
      heading: "Send now vs schedule",
      subheading:
        "The launch endpoint accepts an optional scheduledAt ISO datetime. Send now means scheduledAt: null — the broadcast enters queued and a worker claims immediately. Schedule means scheduledAt: <future ISO> — the broadcast still enters queued, but the worker dispatch is gated until the scheduled time. The dashboard UI does not yet expose a date picker; the schedule path is API-only today.",
      sendNowCard: {
        badge: "Send now",
        title: "scheduledAt: null",
        body: "The default. Launch transitions draft → queued immediately. A background worker claims the first batch within seconds. Use this when timing doesn't matter — newsletters, transactional-feeling promos, anything where \"as soon as possible\" is the goal.",
        icon: "send",
      },
      scheduleCard: {
        badge: "Schedule",
        title: "scheduledAt: 2026-09-22T09:00:00Z",
        body: "Launch still transitions draft → queued immediately, but dispatch is gated until the scheduled time. Use this for time-sensitive promos (Black Friday at midnight, New Year greetings at 00:00). The dashboard does not yet render a date picker — pass scheduledAt in the API request body directly.",
        icon: "clock",
      },
      comparison: [
        {
          dimension: "API field",
          sendNowValue: "scheduledAt: null",
          scheduleValue: "scheduledAt: 2026-09-22T09:00:00Z",
        },
        {
          dimension: "Dashboard button",
          sendNowValue: "Launch (no date picker)",
          scheduleValue: "Launch (no date picker — API only)",
        },
        {
          dimension: "Status after launch",
          sendNowValue: "queued",
          scheduleValue: "queued",
        },
        {
          dimension: "Worker dispatch",
          sendNowValue: "immediate (seconds)",
          scheduleValue: "gated until scheduledAt",
        },
        {
          dimension: "Audience snapshot",
          sendNowValue: "at launch click",
          scheduleValue: "at launch click (snapshot is fresh at click, not at scheduled time)",
        },
        {
          dimension: "Idempotency conflict",
          sendNowValue: "same key + null schedule = OK (replay)",
          scheduleValue: "same key + different schedule = 409 idempotency_conflict",
        },
        {
          dimension: "Cancel window",
          sendNowValue: "short (only while queued/sending)",
          scheduleValue: "long (entire gap between launch click and scheduledAt)",
        },
      ],
      uiExposedNote:
        "Note: the dashboard page.tsx currently sends {} in the launch body — there is no date picker UI. To schedule a broadcast, call the launch API directly with scheduledAt set. The Cancel button still works on a scheduled (queued) broadcast — you can cancel any time before dispatch begins.",
      warningTitle: "Schedule is not a guarantee",
      warningBody:
        "Scheduling a broadcast does not change the snapshot timing — the audience is captured at launch click, not at scheduledAt. If contacts unsubscribe between your launch click and the scheduled time, they will be skipped at dispatch (consent re-check). The snapshot does not refresh. If you need a fresh audience at send time, launch at send time.",
    },
  },
};
