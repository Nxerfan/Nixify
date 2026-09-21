/**
 * UX-B: Emails guide — English content dictionary.
 *
 * AUDIT-GRADE FACTUAL ACCURACY (re-verified this pass):
 *   Every statement here was verified against:
 *     - src/app/dashboard/emails/page.tsx                       (placeholder UI)
 *     - src/app/api/dashboard/deliveries/route.ts                (list endpoint)
 *     - src/app/api/dashboard/deliveries/[deliveryId]/route.ts   (detail endpoint)
 *     - src/lib/deliverability/service.ts                       (state machine + never-regress)
 *     - prisma/schema.prisma                                     (EmailDelivery + EmailDeliveryEvent models)
 *     - src/i18n/en.ts                                          (dashboard.emails.* labels)
 *
 * Specifically:
 *   - The real Emails page is a 31-line PLACEHOLDER. It renders a header
 *     (emerald Mail icon tile + "Sent Emails" + subtitle) and ONE empty-
 *     state card with the text "No emails sent yet. Send your first OTP
 *     from the Playground." It does NOT fetch from /api/dashboard/deliveries.
 *   - The Deliverability backend IS real and shipped (Phase 11). The page
 *     just hasn't been wired to it.
 *   - GET /api/dashboard/deliveries returns paginated EmailDelivery rows.
 *     Filters (all optional, query params): sourceType (broadcast |
 *     transactional | otp), status (queued | provider_accepted | delivered
 *     | deferred | bounced | complained | rejected | failed), provider
 *     (smtp), page, pageSize (default 1, 20).
 *   - GET /api/dashboard/deliveries/{deliveryId} returns one row + its
 *     full immutable EmailDeliveryEvent history.
 *   - State machine: queued → provider_accepted → {delivered | deferred |
 *     bounced | complained | rejected}; queued → failed (provider threw
 *     before acceptance); provider.send() succeeded but DB persistence
 *     failed → unknown (NEVER auto-retried; later webhook with newer
 *     occurredAt CAN advance it).
 *   - Terminal states: delivered, bounced, complained, rejected, failed.
 *     Non-terminal intermediate: deferred (transient bounce — retry-eligible).
 *   - NEVER-REGRESS RULES:
 *       delivered → then a delayed `deferred` → stay `delivered`.
 *       complained → then a delayed `delivered` → stay `complained`
 *         (compliance-aware: a complaint means the recipient marked the
 *         email as spam; subsequent delayed "delivered" signals cannot
 *         undo it).
 *       bounced (hard) → terminal, no regression.
 *       The ONLY allowed forward transition OUT of a terminal state is
 *       delivered → complained (complaint is the stronger compliance
 *       signal).
 *   - SUPPRESSION INTEGRATION:
 *       Hard bounce → suppressEmail() with reason hard_bounce.
 *       Complaint → suppressEmail() with reason complaint.
 *       Soft/transient bounce (deferred) → NO suppression.
 *       Delivered, accepted, rejected, failed, unknown → NO suppression.
 *   - SMTP-vs-webhook contract: SMTP has deliveryWebhooks=false. SMTP
 *     deliveries stay in `provider_accepted` indefinitely — this is
 *     correct behavior. ONLY a webhook-capable provider can advance a
 *     delivery to `delivered`.
 *   - SOURCE CORRELATION:
 *       sourceType="broadcast"     → broadcastRecipientId (FK concept).
 *       sourceType="transactional" → emailMessageId (EmailMessage.messageId).
 *       sourceType="otp"           → reserved for future use; current
 *       Dashboard does not pass it. Phase 11 wires broadcast + transactional
 *       only.
 *   - Auth / entitlement:
 *       401 → "Login required." (code = unauthorized).
 *       403 → "Deliverability dashboard not available." (code =
 *       feature_not_available). Requires the CONTACTS feature key.
 *   - EVENT HISTORY IS IMMUTABLE + DEDUPED. Every event ever seen is stored
 *     on EmailDeliveryEvent, deduped by (provider, providerEventId) unique
 *     constraint. Storing ALL events (even ones that don't change
 *     currentStatus) is a compliance requirement — a delayed "delivered"
 *     after a "complained" must NOT silently hide the complaint.
 *   - EVENT ORDERING — `currentStatus` is derived from `occurredAt`
 *     timestamps, NOT webhook receipt time. A `delivered` event that
 *     arrives AFTER a `complained` event but occurred BEFORE it does NOT
 *     regress the state to `delivered`.
 *
 * Tokens that must stay LTR (deliveryId UUIDs, status strings, sourceType
 * codes, provider codes, providerMessageId, ISO timestamps, HTTP method
 * names, {{var}} placeholders, email addresses) are stored as raw strings
 * here and wrapped with <Ltr> at render time in the page component.
 *
 * This dictionary ALSO contains:
 *   - stage: human-facing copy for the simulated EmailsStage product UI
 *     (which mirrors the real placeholder honestly, plus a labeled
 *     "concept preview" of what the page is meant to visualize once it's
 *     wired to the deliverability API)
 *   - creative: copy for the four creative sections (Email lifecycle, Status
 *     interpretation, Delivery timeline, Failed-email troubleshooting)
 * Both are typed via the shared EmailsGuideContent interface so the render
 * components receive resolved content rather than reading locale directly.
 */

import type { EmailsGuideContent } from "./emails-types";

export const emailsEn: EmailsGuideContent = {
  slug: "emails",
  routeKey: "emails",
  backHref: "/dashboard/emails",
  stepCount: 6,
  durationMin: 5,
  category: "messaging",
  dashboardRoute: "/dashboard/emails",
  title: "Sent Emails",
  description:
    "Track every email Nixify has delivered on your behalf — sent, delivered, deferred, bounced, complained, rejected, failed, and the recovery case unknown. The dashboard page is a placeholder today; this guide teaches the concept of email delivery tracking honestly.",
  chapters: [
    {
      id: "intro",
      title: "Sent Emails",
      steps: [
        {
          id: "emailsOverview",
          caption:
            "Here is the real Sent Emails page today. It's a 31-line placeholder — a header with an emerald Mail icon and the subtitle \"Track every email Nixify has delivered on your behalf,\" plus one centered empty-state card: \"No emails sent yet. Send your first OTP from the Playground.\" There is no list, no filters, no status badges. The page does not fetch from the deliveries API yet.",
          duration: 7500,
          scene: "emailsOverview",
        },
        {
          id: "conceptPreview",
          caption:
            "Behind the placeholder, the deliverability backend is real and shipped. Once the page is wired to GET /api/dashboard/deliveries, it would list every EmailDelivery row Nixify has processed for you — recipient, subject, source, status badge, error code, created time. This scene is a concept preview, not the live UI today — labeled clearly so you know what's real and what's a teaching aid.",
          duration: 8000,
          scene: "conceptPreview",
        },
        {
          id: "deliveryRow",
          caption:
            "Each row carries a color-coded status badge. queued means Nixify created the delivery row but hasn't dispatched it yet. provider_accepted means the upstream SMTP MTA accepted the envelope — NOT that the message reached the inbox. delivered means a webhook-capable provider reported inbox placement. For plain SMTP, deliveries stay in provider_accepted indefinitely; this is correct, not a bug.",
          duration: 8500,
          scene: "deliveryRow",
        },
        {
          id: "eventTimeline",
          caption:
            "Click a row, and the page would open a detail drawer showing the full EmailDeliveryEvent history. Every event ever seen is stored immutably, deduped by (provider, providerEventId). The events are ordered by their occurredAt timestamp — not by webhook receipt time — so an out-of-order webhook cannot regress the visible state.",
          duration: 8000,
          scene: "eventTimeline",
        },
        {
          id: "bounceSuppression",
          caption:
            "Hard bounces and complaints have a side effect: the recipient's email is automatically added to your suppression list (reason = hard_bounce or complaint). Soft / transient bounces (deferred) do NOT suppress — they're recorded as events but the delivery stays retry-eligible. Suppressions are visible in the Suppressions dashboard and, except for the lift-blocked hard_bounce and complaint reasons, can be lifted.",
          duration: 8500,
          scene: "bounceSuppression",
        },
        {
          id: "relatedSources",
          caption:
            "Every delivery traces back to a source. Broadcasts create one EmailDelivery per recipient in the snapshot. Transactional sends (e.g. welcome emails from Automations, or API messages) create one EmailDelivery per message. OTP emails are reserved as a separate source type for future use. The source correlation is structural — broadcastRecipientId or emailMessageId — so a delivery can always be traced back to the campaign or message that produced it.",
          duration: 8000,
          scene: "relatedSources",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "Read the placeholder honestly",
      body: "The Sent Emails page today is a 31-line placeholder. It renders a header (emerald Mail icon tile + \"Sent Emails\" + the subtitle \"Track every email Nixify has delivered on your behalf.\") and one centered empty-state card: \"No emails sent yet. Send your first OTP from the Playground.\" The page does not call /api/dashboard/deliveries. There is no list, no filters, no status badge. Anything that looks like a list in this guide is a concept preview — explicitly labeled — for what the page is meant to visualize once the placeholder is replaced.",
    },
    {
      title: "Understand what the deliverability backend already provides",
      body: "The backend IS real and shipped (Phase 11). GET /api/dashboard/deliveries returns paginated EmailDelivery rows with optional filters: sourceType (broadcast | transactional | otp), status (queued | provider_accepted | delivered | deferred | bounced | complained | rejected | failed), provider (smtp), page, pageSize. GET /api/dashboard/deliveries/{deliveryId} returns one row plus its full immutable EmailDeliveryEvent history. Access requires the CONTACTS feature key; 401 means login required, 403 means feature_not_available.",
    },
    {
      title: "Read a delivery row + its status badge",
      body: "Each EmailDelivery row carries a currentStatus field. queued means the row was created but the provider hasn't been called yet. provider_accepted means provider.send() returned accepted=true — the upstream MTA accepted the envelope. delivered means a webhook-capable provider reported inbox placement. deferred means a soft / transient bounce — retry-eligible. bounced (hard) means permanent failure — terminal. complained means the recipient marked the email as spam — terminal. rejected means the provider refused the message before acceptance — terminal. failed means provider.send() threw before acceptance — terminal. unknown means provider.send() succeeded but DB persistence failed — terminal w.r.t. auto-retry, but a later webhook can still advance it.",
    },
    {
      title: "Inspect the event history (immutable, deduped, ordered)",
      body: "Every event ever seen for a delivery is stored on EmailDeliveryEvent, deduped by the (provider, providerEventId) unique constraint. Even events that don't change currentStatus are stored — a delayed \"delivered\" event after a \"complained\" must NOT silently hide the complaint. Event ordering is by occurredAt (the provider's own timestamp), NOT by webhook receipt time. currentStatus is derived from occurredAt: a delivered event that arrives AFTER a complained event but occurred BEFORE it does NOT regress the state to delivered.",
    },
    {
      title: "Understand the SMTP-vs-webhook contract",
      body: "SMTP acceptance ≠ inbox delivery. The SMTP provider has deliveryWebhooks=false, so SMTP deliveries stay in provider_accepted indefinitely — this is correct behavior, not a stuck state. The upstream MTA accepting the envelope only means it took responsibility for the message; only a webhook-capable provider can advance a delivery to delivered. For the OTP / transactional flows that use SMTP today, the delivery row stops at provider_accepted and that's the expected terminal visible state.",
    },
    {
      title: "Trace a delivery back to its source",
      body: "Every delivery has a sourceType. broadcast deliveries carry a broadcastRecipientId that links back to the broadcast snapshot row. transactional deliveries carry an emailMessageId that links back to the EmailMessage that produced them. otp is a reserved sourceType for future use. The correlation is structural (composite FK on the DB row) — so you can always trace a delivery row back to the exact campaign or message that produced it, even after the parent is deleted (the FK nulls out via ON DELETE SET NULL but the delivery row itself is preserved for compliance).",
    },
  ],
  whyWhen: [
    {
      title: "Why the page is a placeholder today",
      body: "The deliverability backend shipped in Phase 11 as a correctness-critical foundation: the EmailDelivery state machine, the immutable event history, the suppression integration. The dashboard page that surfaces that data to users is the next layer — and it hasn't been wired yet. Rather than ship a half-built UI that misleads, the placeholder honestly says \"No emails sent yet\" until the full UI is ready. The backend is production-grade; the visualization is the gap.",
    },
    {
      title: "Why SMTP deliveries stay in provider_accepted",
      body: "SMTP acceptance means the upstream MTA accepted the envelope (the recipient domain, the recipient mailbox, the message size, the connection). It does NOT mean the message reached the recipient's inbox. Only a webhook-capable provider can tell you that — and SMTP has no webhooks. So for SMTP deliveries, provider_accepted is the deepest terminal visible state. This is correct, not a bug. To see delivered states, switch to a webhook-capable provider (e.g. an ESP that posts back delivery events).",
    },
    {
      title: "Why event history is immutable + deduped",
      body: "Webhook delivery is inherently unreliable: events can arrive out of order, be delivered multiple times, or be delayed by minutes or hours. Storing every event ever seen (deduped by provider + providerEventId) means the event log is a faithful record of what the provider told you, in the order the provider said it happened (by occurredAt). A delayed \"delivered\" event arriving after a \"complained\" event MUST NOT silently hide the complaint — compliance-aware: complaints win. The immutable history is the audit trail.",
    },
    {
      title: "When to consult Sent Emails vs Suppressions",
      body: "Sent Emails (once it ships) is for delivery-level forensics: did the message leave Nixify, did the provider accept it, did the provider report back, what was the last event. Suppressions is for recipient-level decisions: which addresses are blocked, why, and whether the block is liftable. A hard bounce or complaint will appear in BOTH — the Sent Emails row will show status=bounced/complained and a suppression pill, and the Suppressions list will have a new entry with reason=hard_bounce/complaint. Use Sent Emails to investigate; use Suppressions to act.",
    },
  ],
  mistakes: [
    {
      title: "Assuming the page shows real data today",
      body: "It does not. The current page is a placeholder. If you load /dashboard/emails right now, you'll see the header and one empty-state card. There is no list, no status badge, no detail drawer. Anything that looks like a list in this guide is a concept preview — the underlying API exists, the page wiring does not. Don't rely on the page for delivery forensics yet; check the API directly or watch the Suppressions list for hard-bounce / complaint side effects.",
    },
    {
      title: "Reading provider_accepted as \"delivered\"",
      body: "provider_accepted only means the upstream MTA accepted the envelope. It does NOT mean the message reached the recipient's inbox. For SMTP, deliveries stay in provider_accepted forever (no webhook). For webhook-capable providers, a later delivered event will advance the row. Treat provider_accepted as \"the message left Nixify's hands and the upstream took responsibility\" — not as inbox confirmation.",
    },
    {
      title: "Expecting soft bounces to suppress",
      body: "Only HARD bounces and complaints trigger suppression. Soft / transient bounces (deferred) are recorded as events but the delivery stays retry-eligible and the recipient is NOT suppressed. A deferred delivery will typically advance to delivered on retry, or to failed if all retries exhaust. Don't expect a deferred recipient to appear in your Suppressions list — they won't.",
    },
    {
      title: "Trying to manually retry a hard bounce",
      body: "A hard bounce is terminal — the recipient's email doesn't exist, or the domain is invalid, or the mailbox is permanently unreachable. Retrying will produce another hard bounce and waste quota. The correct action is to remove the address from your audience (it's already suppressed automatically) or, for an address you believe was a typo, lift the suppression via the Suppressions dashboard after you've corrected it.",
    },
    {
      title: "Treating unknown as silently failed",
      body: "unknown is a recovery-aware terminal state, not a silent failure. It means provider.send() succeeded (the message likely DID leave Nixify) but the DB persistence of the delivery state failed. The row is NEVER auto-retried (we don't risk double-sends). But a later webhook event with a newer occurredAt CAN advance it to delivered, bounced, complained, or rejected. If you see a row stuck in unknown for a long time, the right action is to investigate the provider side directly — the message probably went out.",
    },
  ],
  proTips: [
    {
      title: "Use the API directly for live forensics today",
      body: "While the page is a placeholder, the deliverability API is fully functional. Hit GET /api/dashboard/deliveries?status=bounced or ?sourceType=broadcast to inspect rows directly. Add &pageSize=50 for a wider view. The response includes deliveryId, currentStatus, lastErrorCode, lastProviderEventAt, and all the per-state timestamps. For deep forensics, GET /api/dashboard/deliveries/{deliveryId} returns the full event history.",
    },
    {
      title: "Filter by status to triage faster",
      body: "When the page ships, the most useful filter is status=bounced,complained — those are the rows with side effects (suppressions). The next most useful is status=failed and status=unknown — those are the rows where the provider threw, or where DB persistence failed after acceptance. deferred is normal and self-resolving on retry; don't triage it unless it's been stuck for many minutes.",
    },
    {
      title: "Cross-reference with Suppressions",
      body: "When you see a row with status=bounced (hard) or complained, that recipient has been added to your suppression list. Open the Suppressions dashboard, find the address, and inspect the reason + suppression source. Hard bounces from a broadcast send will have source=broadcast_bounce; complaints will have source=complaint. The two views are complementary: Sent Emails is the per-delivery audit trail; Suppressions is the per-recipient decision.",
    },
    {
      title: "Plan for the webhook-capable provider upgrade",
      body: "If you need true inbox-delivery confirmation (delivered status), you need a webhook-capable provider. SMTP cannot report back. The Deliverability service is built to ingest webhook events via ingestProviderEvent — switching to an ESP that posts back delivered/bounced/complained events will surface those states automatically. The infrastructure exists; only the provider integration is the gap.",
    },
  ],
  troubleshooting: [
    {
      title: "Page shows the empty-state placeholder",
      body: "This is expected. The Sent Emails page is a placeholder today. There is no list to load. To inspect real delivery data, use GET /api/dashboard/deliveries directly. The page will be replaced with the real UI in a future phase; this guide teaches the concept so you can use the API today and understand the page when it ships.",
    },
    {
      title: "API returns 401 unauthorized",
      body: "Login required. POST /api/auth/login first to obtain a session cookie, then retry. The session cookie is httpOnly + secure + sameSite=lax and is verified by getAuthenticatedUser() on every request. No cookie = 401.",
    },
    {
      title: "API returns 403 feature_not_available",
      body: "The Deliverability dashboard requires the CONTACTS feature key. Your current plan doesn't include it. Upgrade to a plan with Contacts — Broadcast Emails and Sent Emails both depend on the same capability. The 403 response has code = feature_not_available.",
    },
    {
      title: "Delivery stuck in provider_accepted",
      body: "If you're using SMTP, this is correct and expected — SMTP has no delivery webhooks, so the row stays in provider_accepted forever. The message likely did reach the upstream MTA and may have been delivered, but Nixify cannot confirm inbox placement without a webhook. If you need true delivered states, switch to a webhook-capable provider.",
    },
    {
      title: "Delivery in unknown status",
      body: "provider.send() succeeded but the DB write of the resulting state failed (network blip, DB timeout). The row is NEVER auto-retried (we don't risk double-sends). The message probably DID leave Nixify. A later webhook event with a newer occurredAt can still advance it to a concrete terminal state (delivered, bounced, complained, rejected). If you see unknown, wait for a webhook or investigate the provider side directly.",
    },
    {
      title: "Recipient was suppressed but you didn't expect it",
      body: "Check the Sent Emails row (via the API for now): if status=bounced (hard) or complained, the recipient was suppressed automatically. The SuppressionEvent row records the reason (hard_bounce or complaint) and the source. Hard bounces and complaints are LIFT-BLOCKED by design — they can only be lifted by a support request, not by ordinary resubscribe, because re-sending to a known-bad or known-complaining address is a deliverability risk.",
    },
  ],
  checklist: [
    { label: "Understand the page is a placeholder today — no live list yet" },
    { label: "Know the 9 status codes and which are terminal" },
    { label: "Know that provider_accepted ≠ delivered (especially for SMTP)" },
    { label: "Know that only hard bounces + complaints trigger suppression" },
    { label: "Know the event history is immutable, deduped, and ordered by occurredAt" },
    { label: "Know how to use GET /api/dashboard/deliveries directly for forensics" },
  ],
  whatNext:
    "Once the Sent Emails page ships, use it to triage by status — start with bounced and complained (those have suppression side effects), then failed and unknown (those need investigation), then deferred (usually self-resolving). Cross-reference with the Suppressions dashboard for per-recipient decisions. For real-time delivery confirmation, plan a migration to a webhook-capable provider so the delivered state becomes visible.",
  related: [
    { label: "Sent Emails dashboard", href: "/dashboard/emails" },
    { label: "Broadcasts guide", href: "/guide/broadcasts" },
    { label: "Suppressions guide", href: "/guide/suppressions" },
  ],

  /* ─── Stage copy ──────────────────────────────────────────────────────── */
  stage: {
    dir: "ltr",
    locale: "en",

    header: {
      title: "Sent Emails",
      subtitle: "Track every email Nixify has delivered on your behalf.",
      backToDashboard: "Back to Dashboard",
    },

    placeholder: {
      body: "No emails sent yet. Send your first OTP from the Playground.",
      calloutTitle: "Placeholder today",
      calloutBody:
        "This scene mirrors the real /dashboard/emails page exactly as it ships — a 31-line placeholder with one empty-state card. No list, no filters, no API calls. The deliverability backend exists; the page wiring doesn't.",
    },

    concept: {
      tag: "Concept preview — not the real UI today",
      cardTitle: "Sent Emails",
      cardSubtitle:
        "What the page would look like once it's wired to GET /api/dashboard/deliveries. Local demo data only — never fetched.",
      caption:
        "Each row is one EmailDelivery. The status badge drives the row color. Hard bounces and complaints carry a suppression pill — those recipients are also on your Suppressions list.",
    },

    table: {
      recipient: "Recipient",
      subject: "Subject",
      source: "Source",
      status: "Status",
      error: "Error",
      created: "Created",
    },

    statusLabels: {
      queued: "queued",
      provider_accepted: "provider accepted",
      delivered: "delivered",
      deferred: "deferred",
      bounced: "bounced",
      complained: "complained",
      rejected: "rejected",
      failed: "failed",
      unknown: "unknown",
    },

    suppressionPill: "suppressed",

    sourceLabels: {
      broadcast: "Broadcast",
      transactional: "Transactional",
      otp: "OTP",
    },

    filters: {
      sourceType: "Source type",
      status: "Status",
      provider: "Provider",
      all: "All",
      apply: "Apply",
      reset: "Reset",
    },

    noMatches: "No deliveries match your filters.",

    pagination: {
      pageOf: (page, total) => `Page ${page} · ${total} total`,
      prev: "Prev",
      next: "Next",
    },

    eventTimeline: {
      tag: "Concept preview — not the real UI today",
      cardTitle: "Delivery detail",
      cardSubtitle:
        "What the detail drawer would show: the EmailDelivery row + its full immutable EmailDeliveryEvent history, ordered by occurredAt.",
      deliveryIdLabel: "Delivery ID",
      recipientLabel: "Recipient",
      statusLabel: "Status",
      providerLabel: "Provider",
      sourceLabel: "Source",
      historyTitle: "Event history",
      footnote:
        "Immutable + deduped by (provider, providerEventId). Ordered by occurredAt — out-of-order webhooks cannot regress currentStatus. A delayed \"delivered\" arriving after a \"complained\" is stored as an event but does NOT undo the complaint.",
      dismiss: "Dismiss",
    },

    sourcesCard: {
      title: "How emails relate to other surfaces",
      subtitle:
        "Every EmailDelivery traces back to a source — a broadcast, a transactional message, or (reserved for future use) an OTP. The correlation is structural: a composite FK on the row itself.",
      rows: [
        {
          key: "broadcast",
          label: "Broadcasts",
          desc: "One EmailDelivery per recipient in the broadcast snapshot. Linked via broadcastRecipientId.",
          token: "broadcastRecipientId",
          tone: "broadcast",
        },
        {
          key: "transactional",
          label: "Transactional",
          desc: "One EmailDelivery per API message or automation-fired email. Linked via emailMessageId.",
          token: "emailMessageId",
          tone: "transactional",
        },
        {
          key: "otp",
          label: "OTP (reserved)",
          desc: "Reserved sourceType for future OTP-correlated deliveries. Not currently emitted by the dashboard.",
          token: "sourceType: \"otp\"",
          tone: "otp",
        },
      ],
      footnote:
        "The composite FK is (userId, broadcastRecipientId) or (userId, emailMessageId). ON DELETE SET NULL nulls the FK without deleting the delivery — the row is preserved for compliance auditing.",
    },

    /* Seed deliveries shown in the simulated list. NEVER fetched from the
     * API. Numbers chosen to exercise every visible status: queued,
     * provider_accepted, delivered, deferred, bounced, complained,
     * rejected, failed, and unknown. */
    deliveries: [
      {
        id: 1,
        deliveryId: "d-7c3b9f1e-4a2d-4e7b-9c1a-8b4f5e2d3a01",
        recipient: "sara@example.com",
        subject: "MailGuard: Verify your email",
        sourceType: "transactional",
        sourceLabel: "API message",
        provider: "smtp",
        currentStatus: "delivered",
        suppressionApplied: false,
        lastErrorCode: null,
        createdAtRelative: "just now",
        isLive: false,
      },
      {
        id: 2,
        deliveryId: "d-9f4c2a8b-3e1d-4f8a-b5c7-2e9d1a4b6c02",
        recipient: "ali@example.org",
        subject: "September product update",
        sourceType: "broadcast",
        sourceLabel: "Monthly product update",
        provider: "smtp",
        currentStatus: "provider_accepted",
        suppressionApplied: false,
        lastErrorCode: null,
        createdAtRelative: "2 minutes ago",
        isLive: false,
      },
      {
        id: 3,
        deliveryId: "d-2e8a1c5d-7b9f-4e2a-8c1d-5f3b7e9a4c03",
        recipient: "leo@baddomain.xyz",
        subject: "September product update",
        sourceType: "broadcast",
        sourceLabel: "Monthly product update",
        provider: "smtp",
        currentStatus: "bounced",
        suppressionApplied: true,
        lastErrorCode: "smtp_5xx_permanent",
        createdAtRelative: "3 minutes ago",
        isLive: false,
      },
      {
        id: 4,
        deliveryId: "d-5b3d9e2a-1c4f-4b8a-9e5d-2a7c1b3d8e04",
        recipient: "maria@example.com",
        subject: "Welcome, {{first_name}}!",
        sourceType: "transactional",
        sourceLabel: "Automation: welcome series",
        provider: "smtp",
        currentStatus: "queued",
        suppressionApplied: false,
        lastErrorCode: null,
        createdAtRelative: "just now",
        isLive: true,
      },
      {
        id: 5,
        deliveryId: "d-8f1b4c7e-2a5d-4e9b-8c1a-3d6b5e9a2c05",
        recipient: "noah@example.net",
        subject: "Your one-time passcode",
        sourceType: "transactional",
        sourceLabel: "API message",
        provider: "smtp",
        currentStatus: "deferred",
        suppressionApplied: false,
        lastErrorCode: "smtp_4xx_transient",
        createdAtRelative: "5 minutes ago",
        isLive: false,
      },
      {
        id: 6,
        deliveryId: "d-3a7e5b9c-1d4f-4c2a-9e8b-5a3d7c1b9e06",
        recipient: "ana@oldprovider.com",
        subject: "September product update",
        sourceType: "broadcast",
        sourceLabel: "Monthly product update",
        provider: "smtp",
        currentStatus: "complained",
        suppressionApplied: true,
        lastErrorCode: null,
        createdAtRelative: "12 minutes ago",
        isLive: false,
      },
      {
        id: 7,
        deliveryId: "d-6c2a9e1b-4d8f-4a5c-b3e7-9f1a2b5c8d07",
        recipient: "jun@oversize.invalid",
        subject: "September product update",
        sourceType: "broadcast",
        sourceLabel: "Monthly product update",
        provider: "smtp",
        currentStatus: "rejected",
        suppressionApplied: false,
        lastErrorCode: "provider_message_too_large",
        createdAtRelative: "8 minutes ago",
        isLive: false,
      },
      {
        id: 8,
        deliveryId: "d-1d5b8c3a-9e7f-4c2b-a8d1-6c4b2e9a7f08",
        recipient: "kai@example.com",
        subject: "Your one-time passcode",
        sourceType: "transactional",
        sourceLabel: "API message",
        provider: "smtp",
        currentStatus: "failed",
        suppressionApplied: false,
        lastErrorCode: "provider_connection_timeout",
        createdAtRelative: "15 minutes ago",
        isLive: false,
      },
      {
        id: 9,
        deliveryId: "d-4e8a1b6c-3d7f-4a9b-8c5e-1b3a7d9c2e09",
        recipient: "ren@example.com",
        subject: "Welcome, {{first_name}}!",
        sourceType: "transactional",
        sourceLabel: "API message",
        provider: "smtp",
        currentStatus: "unknown",
        suppressionApplied: false,
        lastErrorCode: "db_persistence_failed_post_accept",
        createdAtRelative: "20 minutes ago",
        isLive: false,
      },
    ],

    /* Seed event-history rows for the timeline overlay. NEVER fetched.
     * Ordered by occurredAt ascending. */
    events: [
      {
        id: 1,
        type: "queued",
        desc: "Delivery row created with currentStatus = queued. Provider not yet called.",
        occurredAt: "2026-09-21T08:42:11.000Z",
        token: "queued",
        tone: "neutral",
      },
      {
        id: 2,
        type: "accepted",
        desc: "provider.send() resolved with accepted=true. Upstream MTA accepted the envelope.",
        occurredAt: "2026-09-21T08:42:11.820Z",
        token: "provider_accepted",
        tone: "good",
      },
      {
        id: 3,
        type: "deferred",
        desc: "Soft / transient bounce. Delivery stays retry-eligible. No suppression.",
        occurredAt: "2026-09-21T08:42:48.140Z",
        token: "deferred · bounceType=soft",
        tone: "warn",
      },
      {
        id: 4,
        type: "delivered",
        desc: "Provider reported successful inbox placement (webhook event). currentStatus advances to delivered.",
        occurredAt: "2026-09-21T08:43:02.550Z",
        token: "delivered",
        tone: "good",
      },
      {
        id: 5,
        type: "complained",
        desc: "Recipient marked the email as spam (webhook event). currentStatus advances to complained. Suppression applied with reason = complaint.",
        occurredAt: "2026-09-21T09:14:33.012Z",
        token: "complained · suppressionApplied=true",
        tone: "bad",
      },
    ],
  },

  /* ─── Creative section copy ──────────────────────────────────────────── */
  creative: {
    /* 1. Email lifecycle — the EmailDelivery state machine */
    lifecycle: {
      heading: "Email lifecycle",
      subheading:
        "Every EmailDelivery row progresses through a small state machine. Each status has a badge color, a side effect (suppression? retry?), and a transition rule. The contract is enforced by src/lib/deliverability/service.ts — routes and other services MUST NOT mutate EmailDelivery rows directly.",
      statesTitle: "States",
      states: [
        {
          code: "queued",
          label: "Queued",
          desc: "Initial state. The delivery row was created (by the broadcast service or transactional messaging service) but provider.send() has not been called yet.",
          terminal: false,
          canAdvance: true,
        },
        {
          code: "provider_accepted",
          label: "Provider accepted",
          desc: "provider.send() returned accepted=true. The upstream MTA accepted the envelope. NOT the same as inbox delivery — SMTP has no webhooks, so SMTP deliveries stay here forever.",
          terminal: false,
          canAdvance: true,
        },
        {
          code: "delivered",
          label: "Delivered",
          desc: "A webhook-capable provider reported successful inbox placement. Terminal — except for the explicit delivered → complained override (complaint-wins rule).",
          terminal: true,
          canAdvance: true,
          sideEffect: "Compliance: can still be advanced to complained by a later webhook.",
        },
        {
          code: "deferred",
          label: "Deferred",
          desc: "Soft / transient bounce (e.g. mailbox full, temporary DNS issue). Non-terminal and retry-eligible. Does NOT trigger suppression.",
          terminal: false,
          canAdvance: true,
        },
        {
          code: "bounced",
          label: "Bounced (hard)",
          desc: "Hard bounce — the recipient doesn't exist, the domain is invalid, or the mailbox is permanently unreachable. Terminal. Triggers suppression with reason = hard_bounce.",
          terminal: true,
          canAdvance: false,
          sideEffect: "Suppresses the recipient (hard_bounce).",
        },
        {
          code: "complained",
          label: "Complained",
          desc: "The recipient marked the email as spam (webhook event from the provider). Terminal. Triggers suppression with reason = complaint.",
          terminal: true,
          canAdvance: false,
          sideEffect: "Suppresses the recipient (complaint).",
        },
        {
          code: "rejected",
          label: "Rejected",
          desc: "provider.send() returned accepted=false — the provider refused the message before acceptance (e.g. message too large, policy violation). Terminal. No suppression (the message never reached the recipient).",
          terminal: true,
          canAdvance: false,
        },
        {
          code: "failed",
          label: "Failed",
          desc: "provider.send() threw an exception before acceptance (e.g. connection timeout, auth failure). Terminal. No suppression (the message likely never reached the upstream).",
          terminal: true,
          canAdvance: false,
        },
        {
          code: "unknown",
          label: "Unknown",
          desc: "provider.send() succeeded but DB persistence of the delivery state failed. Treated as terminal w.r.t. auto-retry (NEVER re-sent, to avoid double-sends). A later webhook with a newer occurredAt CAN advance it to a concrete terminal state.",
          terminal: true,
          canAdvance: true,
          sideEffect: "Recovery-aware: a newer webhook event can still resolve it.",
        },
      ],
      transitionsTitle: "Transitions",
      transitions: [
        {
          label: "Provider accepts envelope",
          from: "queued",
          to: "provider_accepted",
          desc: "provider.send() returned accepted=true. CAS update — only one worker wins queued → provider_accepted. Sets acceptedAt + providerMessageId.",
          sideEffect: "LastProviderEventAt is NOT advanced (only webhook events advance it).",
          tone: "normal",
        },
        {
          label: "Webhook: delivered",
          from: "provider_accepted",
          to: "delivered",
          desc: "A webhook-capable provider posted a delivered event with an occurredAt at-or-after the last seen event.",
          sideEffect: "Sets deliveredAt. No suppression.",
          tone: "good",
        },
        {
          label: "Webhook: deferred (soft bounce)",
          from: "provider_accepted",
          to: "deferred",
          desc: "A webhook event with type=deferred OR type=bounced + bounceType=soft. Non-terminal; retry-eligible.",
          sideEffect: "Sets lastProviderEventAt. NO suppression (soft bounces don't suppress).",
          tone: "warn",
        },
        {
          label: "Webhook: hard bounce",
          from: "provider_accepted",
          to: "bounced",
          desc: "A webhook event with type=bounced + bounceType=hard. Permanent failure. Terminal.",
          sideEffect: "Sets bouncedAt. Suppresses the recipient with reason = hard_bounce.",
          tone: "bad",
        },
        {
          label: "Webhook: complaint",
          from: "provider_accepted",
          to: "complained",
          desc: "A webhook event with type=complained. The recipient marked the email as spam. Terminal.",
          sideEffect: "Sets complainedAt. Suppresses the recipient with reason = complaint.",
          tone: "bad",
        },
        {
          label: "Provider rejects the message",
          from: "queued",
          to: "rejected",
          desc: "provider.send() returned accepted=false (e.g. message too large, policy violation). CAS update from queued → rejected. Sets rejectedAt + lastErrorCode.",
          sideEffect: "No suppression (message never reached the recipient).",
          tone: "bad",
        },
        {
          label: "Provider call throws",
          from: "queued",
          to: "failed",
          desc: "provider.send() threw an exception before acceptance (connection timeout, auth failure). CAS update from queued → failed. Sets failedAt + lastErrorCode.",
          sideEffect: "No suppression (message likely never reached the upstream).",
          tone: "bad",
        },
        {
          label: "Complaint wins (override)",
          from: "delivered",
          to: "complained",
          desc: "The ONLY allowed forward transition out of a terminal state. A complaint arrived after a delivered. The complaint is the stronger compliance signal.",
          sideEffect: "Sets complainedAt. Suppresses the recipient with reason = complaint.",
          tone: "bad",
        },
        {
          label: "Recovery from unknown",
          from: "unknown",
          to: "delivered",
          desc: "A later webhook event with a newer occurredAt advances an unknown row to a concrete terminal state (delivered, bounced, complained, or rejected).",
          sideEffect: "Recovers the row's audit trail. Still no auto-retry of the original send.",
          tone: "recovery",
        },
      ],
      footnote:
        "Terminal states (delivered, bounced, complained, rejected, failed) have no further transitions — except the explicit delivered → complained override. unknown is treated as terminal w.r.t. auto-retry but CAN still be advanced by a newer webhook event. The never-regress rules below protect compliance: a delayed \"delivered\" arriving after a \"complained\" is stored as an event but does NOT undo the complaint.",
      smtpNote:
        "SMTP has deliveryWebhooks=false. SMTP deliveries stay in provider_accepted indefinitely — the upstream MTA accepted the envelope, but there's no way for SMTP to confirm inbox placement. This is correct behavior. To see delivered states, switch to a webhook-capable provider.",
    },

    /* 2. Status interpretation — per-status meaning matrix */
    statusInterpretation: {
      heading: "Status interpretation",
      subheading:
        "Each of the 9 status codes has a specific trigger, a side effect, and a possible action. Use this matrix when triaging a delivery row: the status tells you what happened; the side effect tells you what to check next (Suppression list? Retry? Provider logs?).",
      matrixTitle: "Per-status reference",
      matrixSubtitle:
        "Status code (LTR) → human label → what triggered it → side effect → what you can do.",
      colStatus: "Status",
      colTrigger: "What triggers it",
      colSideEffect: "Side effect",
      colAction: "What you can do",
      rows: [
        {
          code: "queued",
          label: "Queued",
          trigger: "createDelivery() called by the broadcast or transactional messaging service.",
          sideEffect: "None. Row is awaiting provider dispatch.",
          action: "Wait — a background worker will claim it within seconds. If stuck for minutes, check worker health.",
          tone: "neutral",
        },
        {
          code: "provider_accepted",
          label: "Provider accepted",
          trigger: "provider.send() returned accepted=true. Upstream MTA accepted the envelope.",
          sideEffect: "acceptedAt + providerMessageId set. lastProviderEventAt NOT set (only webhook events advance it).",
          action: "For SMTP: this is the deepest terminal visible state — there are no webhooks to advance it further. For webhook providers: wait for the delivered / bounced / complained webhook.",
          tone: "good",
        },
        {
          code: "delivered",
          label: "Delivered",
          trigger: "A webhook-capable provider posted a delivered event with occurredAt ≥ last seen.",
          sideEffect: "deliveredAt set. No suppression. CAN still be advanced to complained by a later complaint webhook.",
          action: "Nothing — the message reached the recipient's inbox per the provider. Monitor for a later complaint event.",
          tone: "good",
        },
        {
          code: "deferred",
          label: "Deferred",
          trigger: "A webhook event with type=deferred, OR type=bounced + bounceType=soft (transient).",
          sideEffect: "lastProviderEventAt advanced. NO suppression (soft bounces don't suppress). Retry-eligible.",
          action: "Wait — typically self-resolves on retry to delivered, or advances to failed if all retries exhaust. Don't suppress the recipient.",
          tone: "warn",
        },
        {
          code: "bounced",
          label: "Bounced (hard)",
          trigger: "A webhook event with type=bounced + bounceType=hard. Permanent failure.",
          sideEffect: "bouncedAt set. Suppression applied with reason = hard_bounce. Terminal.",
          action: "Remove the address from your audience (it's already suppressed). Don't retry — you'll just bounce again and waste quota.",
          tone: "bad",
        },
        {
          code: "complained",
          label: "Complained",
          trigger: "A webhook event with type=complained. The recipient marked the email as spam.",
          sideEffect: "complainedAt set. Suppression applied with reason = complaint. Terminal.",
          action: "Honor the suppression — do not retry. Investigate the campaign content / frequency that produced the complaint.",
          tone: "bad",
        },
        {
          code: "rejected",
          label: "Rejected",
          trigger: "provider.send() returned accepted=false (message too large, policy violation, etc.).",
          sideEffect: "rejectedAt + lastErrorCode set. No suppression (message never reached the recipient). Terminal.",
          action: "Inspect lastErrorCode. Fix the message (size, content policy, recipient syntax) and resend as a new delivery.",
          tone: "bad",
        },
        {
          code: "failed",
          label: "Failed",
          trigger: "provider.send() threw an exception before acceptance (connection timeout, auth failure).",
          sideEffect: "failedAt + lastErrorCode set. No suppression (message likely never reached the upstream). Terminal.",
          action: "Inspect lastErrorCode. Likely a transient provider issue — retry the send as a new delivery once the root cause is fixed.",
          tone: "bad",
        },
        {
          code: "unknown",
          label: "Unknown",
          trigger: "provider.send() succeeded but DB persistence of the resulting state failed (network blip, DB timeout).",
          sideEffect: "No suppression. NEVER auto-retried (we don't risk double-sends). A later webhook with newer occurredAt CAN advance it.",
          action: "Don't auto-retry. Wait for a webhook event or investigate the provider side directly — the message probably DID leave Nixify.",
          tone: "recovery",
        },
      ],
      smtpDeliveredNote:
        "For SMTP providers, the delivered state is unreachable — SMTP has no delivery webhooks. SMTP deliveries stay in provider_accepted. To see delivered states, switch to a webhook-capable ESP that posts back delivery events.",
      unknownRecoveryNote:
        "unknown is treated as terminal w.r.t. auto-retry (NEVER re-sent) to avoid double-sends. But a later webhook event with a newer occurredAt CAN still advance it to delivered, bounced, complained, or rejected — recovering the audit trail without re-dispatching the original message.",
      neverRegressNote:
        "Never-regress rules: (1) delivered → then a delayed deferred → stay delivered. (2) complained → then a delayed delivered → stay complained (complaint-wins). (3) bounced (hard) → terminal, no regression. (4) The ONLY allowed forward transition OUT of a terminal state is delivered → complained (compliance override).",
    },

    /* 3. Delivery timeline — EmailDeliveryEvent history + never-regress rules */
    deliveryTimeline: {
      heading: "Delivery timeline",
      subheading:
        "Every event ever seen for a delivery is stored on EmailDeliveryEvent — immutable, deduped, and ordered by occurredAt. The visible currentStatus is derived from this timeline. Understanding how events are stored and ordered explains why a delayed webhook cannot lie about what happened.",
      stepsTitle: "How events are stored",
      steps: [
        {
          badge: "01",
          title: "Event arrives via webhook",
          body: "A provider posts a webhook event to the ingestion endpoint. The event carries provider, providerMessageId (to resolve the delivery row), providerEventId (for dedup), type, occurredAt (the provider's own timestamp), and optional bounceType + safeMetadata.",
          token: "POST /api/dashboard/deliveries/{deliveryId}/events (or webhook URL)",
          tone: "ui",
        },
        {
          badge: "02",
          title: "Dedup by (provider, providerEventId)",
          body: "The unique constraint (provider, providerEventId) is enforced at the DB level. A duplicate webhook (same providerEventId) is caught — the event is recorded once and only once. P2002 from the unique constraint is caught OUTSIDE the transaction and resolved by re-reading.",
          token: "@@unique([provider, providerEventId])",
          tone: "state",
        },
        {
          badge: "03",
          title: "Order by occurredAt, not receipt time",
          body: "Events are ordered by their occurredAt timestamp (the provider's own timestamp), NOT by webhook receipt time. A delivered event that arrives AFTER a complained event but occurred BEFORE it does NOT regress the state to delivered. Webhook delivery is inherently unreliable; occurredAt ordering is the source of truth.",
          token: "occurredAt ASC",
          tone: "state",
        },
        {
          badge: "04",
          title: "currentStatus derivation",
          body: "currentStatus is derived from the latest non-regressable event. If the incoming event is OLDER than the last seen event's occurredAt, it's stored in the history but currentStatus does NOT change (never-regress rule).",
          token: "if (incoming.occurredAt < lastEventAt) → store, don't transition",
          tone: "state",
        },
        {
          badge: "05",
          title: "Side effects fire on transition",
          body: "If currentStatus changes, side effects fire: hard bounce → suppressEmail(reason=hard_bounce); complaint → suppressEmail(reason=complaint). Soft bounces and other states do NOT trigger suppression. The suppression is written inside the same DB transaction.",
          token: "suppressEmailInTx(...)",
          tone: "downstream",
        },
        {
          badge: "06",
          title: "Audit trail preserved",
          body: "Even when an event doesn't change currentStatus (e.g. a delayed delivered arriving after a complained), the event IS stored on EmailDeliveryEvent. The audit trail is faithful — compliance requires it. Suppressing or hiding delayed events would be a compliance violation.",
          token: "store-all-events invariant",
          tone: "downstream",
        },
      ],
      regressTitle: "Never-regress rules",
      regressSubtitle:
        "Webhooks can arrive late, out of order, or duplicated. The never-regress rules protect the visible state from being silently rewritten by stale signals. The rules apply to the currentStatus derivation only — the event history always stores every event seen.",
      regressRules: [
        {
          scenario: "delivered → delayed deferred",
          outcome: "stay delivered",
          rationale: "A delayed soft-bounce signal cannot regress a delivered row back to a retry-eligible state. The message was delivered per the earlier event.",
        },
        {
          scenario: "complained → delayed delivered",
          outcome: "stay complained",
          rationale: "Compliance-aware: a complaint means the recipient marked the email as spam. A delayed \"delivered\" signal cannot undo that suppression. The complaint is the stronger signal.",
        },
        {
          scenario: "bounced (hard) → delayed deferred",
          outcome: "stay bounced",
          rationale: "A hard bounce is terminal — the recipient is permanently unreachable. A delayed transient signal cannot regress it. The recipient stays suppressed.",
        },
        {
          scenario: "delivered → newer complained",
          outcome: "advance to complained",
          rationale: "The ONLY allowed forward transition OUT of a terminal state. A complaint arriving AFTER a delivered, with a newer occurredAt, advances the state. Complaints win.",
        },
      ],
      comparisonTitle: "Event ordering",
      comparison: [
        {
          dimension: "Event arrives BEFORE last seen occurredAt",
          beforeValue: "stored in history, currentStatus unchanged",
          afterValue: "—",
        },
        {
          dimension: "Event arrives AT OR AFTER last seen occurredAt",
          beforeValue: "—",
          afterValue: "stored in history, currentStatus may advance (per never-regress rules)",
        },
        {
          dimension: "Duplicate (provider, providerEventId)",
          beforeValue: "rejected by unique constraint",
          afterValue: "rejected by unique constraint",
        },
      ],
      footnote:
        "Storing every event ever seen — even ones that don't change currentStatus — is a compliance requirement. A delayed \"delivered\" after a \"complained\" must NOT silently hide the complaint. The history is the audit trail; the visible state is the derived summary.",
    },

    /* 4. Failed-email troubleshooting — diagnostic decision flowchart */
    failedTroubleshooting: {
      heading: "Failed-email troubleshooting",
      subheading:
        "When a delivery doesn't reach delivered, the failure mode tells you what to do. Hard bounces and complaints have a side effect (suppression) and are terminal. Soft bounces are retry-eligible. rejected means the provider refused the message before acceptance. failed means the provider call threw. unknown means persistence failed after acceptance. Each path has a specific action.",
      pathsTitle: "Failure paths",
      paths: [
        {
          key: "hard_bounce",
          title: "Hard bounce",
          token: "bounced (hard)",
          symptom: "currentStatus = bounced. lastErrorCode typically = smtp_5xx_permanent. Suppression pill on the row.",
          cause: "The recipient doesn't exist, the domain is invalid, or the mailbox is permanently unreachable. Permanent failure.",
          action: "Don't retry. The recipient is already suppressed with reason = hard_bounce. Remove the address from your audience. For a suspected typo, lift the suppression via the Suppressions dashboard after correcting the address (note: hard_bounce suppressions are lift-blocked by default — they require a support request).",
          tone: "bad",
          suppressionApplied: true,
          retryEligible: false,
        },
        {
          key: "soft_bounce",
          title: "Soft / transient bounce",
          token: "deferred",
          symptom: "currentStatus = deferred. lastErrorCode typically = smtp_4xx_transient. No suppression pill.",
          cause: "Mailbox full, temporary DNS issue, greylisting, rate limit, or other transient condition.",
          action: "Wait — typically self-resolves on retry to delivered, or advances to failed if all retries exhaust. Do NOT suppress the recipient (soft bounces don't suppress). Monitor the row for state changes over the next few minutes.",
          tone: "warn",
          suppressionApplied: false,
          retryEligible: true,
        },
        {
          key: "complaint",
          title: "Complaint",
          token: "complained",
          symptom: "currentStatus = complained. Suppression pill on the row.",
          cause: "The recipient marked the email as spam (webhook event from the provider). This is the strongest negative deliverability signal.",
          action: "Honor the suppression — do not retry. Investigate the campaign content / frequency that produced the complaint. The recipient is suppressed with reason = complaint (lift-blocked by default — support request required). High complaint rates harm your sender reputation.",
          tone: "bad",
          suppressionApplied: true,
          retryEligible: false,
        },
        {
          key: "rejected",
          title: "Rejected by provider",
          token: "rejected",
          symptom: "currentStatus = rejected. lastErrorCode typically = provider_message_too_large or provider_policy_violation. No suppression pill.",
          cause: "provider.send() returned accepted=false — the provider refused the message before acceptance. Common causes: message too large, content policy violation, invalid recipient syntax.",
          action: "Inspect lastErrorCode. Fix the message (size, content, recipient syntax) and resend as a new delivery. The original delivery row stays in rejected state for audit.",
          tone: "bad",
          suppressionApplied: false,
          retryEligible: false,
        },
        {
          key: "failed",
          title: "Provider call threw",
          token: "failed",
          symptom: "currentStatus = failed. lastErrorCode typically = provider_connection_timeout or provider_auth_failure. No suppression pill.",
          cause: "provider.send() threw an exception before acceptance. Connection timeout, auth failure, TLS error, network blip. The message likely never reached the upstream.",
          action: "Inspect lastErrorCode. Likely a transient provider issue — retry the send as a new delivery once the root cause is fixed. The original row stays in failed state for audit.",
          tone: "bad",
          suppressionApplied: false,
          retryEligible: false,
        },
        {
          key: "unknown",
          title: "Persistence failed post-acceptance",
          token: "unknown",
          symptom: "currentStatus = unknown. lastErrorCode typically = db_persistence_failed_post_accept. No suppression pill.",
          cause: "provider.send() succeeded (the message likely DID leave Nixify) but the DB write of the resulting state failed. Distinguished from failed (provider threw before acceptance) — the external email MAY have been delivered.",
          action: "Don't auto-retry (we don't risk double-sends). Wait for a webhook event with a newer occurredAt to advance the state, or investigate the provider side directly. Broadcast stale-recovery skips unknown recipients (no auto-resend).",
          tone: "recovery",
          suppressionApplied: false,
          retryEligible: false,
        },
      ],
      decisionTreeTitle: "Decision flow",
      decisionTree: [
        {
          question: "Is the delivery in a terminal state?",
          yes: "Yes —> identify the terminal state and act on it (see paths above).",
          no: "No —> it's queued, provider_accepted, or deferred. Wait for the next event.",
        },
        {
          question: "Is there a suppression pill on the row?",
          yes: "Yes —> the recipient is on your Suppressions list. Cross-reference the reason (hard_bounce or complaint) and decide whether to lift (typically lift-blocked).",
          no: "No —> the delivery didn't trigger a suppression. The recipient remains eligible for future sends.",
        },
        {
          question: "Is the provider SMTP?",
          yes: "Yes —> provider_accepted is the deepest visible state. There are no webhooks to advance it. Switch to a webhook-capable provider if you need delivered states.",
          no: "No —> a webhook-capable provider is in use. Expect delivered / bounced / complained webhook events to advance the state.",
        },
        {
          question: "Is lastErrorCode set?",
          yes: "Yes —> inspect the code. It's the safe, sanitized error classification (e.g. smtp_5xx_permanent, provider_connection_timeout) — never the raw provider stack trace.",
          no: "No —> the state was reached via a webhook event (delivered, complained, soft-deferred), not via a local provider error.",
        },
      ],
      suppressionFootnote:
        "Hard bounces and complaints produce suppressions that are lift-blocked by default — they require a support request to lift, because re-sending to a known-bad or known-complaining address is a deliverability risk. See the Suppressions guide for the full lift-eligibility matrix.",
      warningTitle: "Never auto-retry a hard bounce",
      warningBody:
        "A hard bounce means the recipient is permanently unreachable. Retrying will produce another hard bounce, waste your messaging quota, and harm your sender reputation. The recipient is already suppressed — leave them suppressed. For a suspected typo, lift the suppression via the Suppressions dashboard after correcting the address.",
    },
  },
};
