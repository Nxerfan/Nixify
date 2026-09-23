/**
 * UX-B: Suppressions guide — English content dictionary.
 *
 * AUDIT-GRADE FACTUAL ACCURACY (re-verified this pass):
 *   Every statement here was verified against:
 *     - src/app/dashboard/suppressions/page.tsx                       (Suppressions UI)
 *     - src/app/api/dashboard/suppressions/route.ts                    (list + create)
 *     - src/app/api/dashboard/suppressions/[suppressionId]/route.ts    (lift)
 *     - src/lib/consent/service.ts                                      (NON_LIFTABLE_BY_RESUBSCRIBE)
 *     - src/i18n/en.ts                                                  (real dashboard labels)
 *
 * Specifically:
 *   - The real Suppressions page renders an email list with reason
 *     badges (REASON_LABELS: unsubscribe / manual / hard_bounce /
 *     complaint), source badges (SOURCE_LABELS: dashboard / api /
 *     unsubscribe / system), an active or lifted state badge (rose for
 *     active, slate for lifted), a created + lifted timestamp line, and
 *     a Lift button (ShieldOff icon) on active rows only.
 *   - The Add dialog accepts only an email and POSTs with
 *     reason = "manual" (hard-coded — the API allows manual|unsubscribe
 *     but the dialog always writes manual).
 *   - The Lift dialog (AlertDialog) shows the email in the title, a
 *     description that explicitly states "Lifting alone does NOT
 *     resubscribe", and an "Also subscribe this contact to marketing
 *     (explicit consent)" checkbox. The confirm button turns emerald
 *     when also_subscribe is checked; rose when unchecked.
 *   - The lift endpoint is POST /api/dashboard/suppressions/{id} with
 *     { also_subscribe?: boolean (default false) }. It is POST (not
 *     DELETE) because lifting is a state transition that produces audit
 *     history, not a destructive delete.
 *   - Consent model (src/lib/consent/service.ts):
 *       * Four suppression reasons: manual, unsubscribe, hard_bounce,
 *         complaint.
 *       * NON_LIFTABLE_BY_RESUBSCRIBE = { hard_bounce, complaint }.
 *         Subscribe throws ResubscribeBlockedError for these.
 *       * manual and unsubscribe ARE liftable by ordinary resubscribe.
 *       * Lift only deactivates the SuppressionEntry. It does NOT
 *         change marketing_status. Pass alsoSubscribe: true to combine
 *         lift + subscribe atomically.
 *   - Eligibility invariant: eligible = marketing_status === subscribed
 *     AND not currently suppressed. A contact can be subscribed AND
 *     suppressed (eligible = false). A contact can be unsubscribed AND
 *     not suppressed (eligible = false — marketing_status gate fails).
 *     The two gates are independent; BOTH must pass.
 *
 * Tokens that must stay LTR (email addresses, reason codes like
 * manual/unsubscribe/hard_bounce/complaint, source codes like
 * dashboard/api/unsubscribe/system, suppression public IDs like
 * sup_abc123, ISO timestamps, NON_LIFTABLE_BY_RESUBSCRIBE, also_subscribe,
 * HTTP method names) are stored as raw strings here and wrapped with
 * <Ltr> at render time in the page component.
 *
 * This dictionary ALSO contains:
 *   - stage: human-facing copy for the simulated SuppressionsStage
 *     product UI (header, badges, dialog copy, seed entries).
 *   - creative: copy for the four creative sections (Reason Anatomy,
 *     Active vs Lifted, Safe-Lifting Decision Tree, Eligibility
 *     Relationship).
 * Both are typed via the shared SuppressionsGuideContent interface so
 * the render components receive resolved content rather than reading
 * locale directly.
 */

import type { SuppressionsGuideContent } from "./suppressions-types";

export const suppressionsEn: SuppressionsGuideContent = {
  slug: "suppressions",
  routeKey: "suppressions",
  backHref: "/dashboard/suppressions",
  stepCount: 6,
  durationMin: 4,
  category: "audience",
  dashboardRoute: "/dashboard/suppressions",
  title: "Suppressions",
  description:
    "Manage marketing suppressions: add manual entries, lift active ones, and understand why hard_bounce and complaint cannot be lifted by ordinary resubscribe.",
  chapters: [
    {
      id: "intro",
      title: "Suppressions",
      steps: [
        {
          id: "suppressionsOverview",
          caption:
            "Here is the Suppressions list. Each row is one email with a reason badge (Manual, Unsubscribe, Hard bounce, Complaint), a source badge, an Active or Lifted state badge, and a Lift button on active rows only.",
          duration: 7000,
          scene: "suppressionsOverview",
        },
        {
          id: "createSuppression",
          caption:
            "Click \"Suppress email\" to add a manual suppression. The dialog takes only an email — reason defaults to manual. Saving writes a SuppressionEntry; it does NOT unsubscribe the contact. Existing transactional messages are unaffected.",
          duration: 7500,
          scene: "createSuppression",
          typedText: "spammer@example.com",
        },
        {
          id: "liftConfirmation",
          caption:
            "On an active row, click Lift. The confirmation dialog deactivates the suppression entry. Lifting alone does NOT resubscribe the contact — the contact's marketing_status is unchanged.",
          duration: 7500,
          scene: "liftConfirmation",
        },
        {
          id: "alsoSubscribeChecked",
          caption:
            "Tick \"Also subscribe this contact to marketing\" to combine lift + subscribe in one atomic action. The confirm button turns emerald. Use this when the recipient has explicitly asked to receive marketing again and the suppression reason is manual or unsubscribe.",
          duration: 7500,
          scene: "alsoSubscribeChecked",
        },
        {
          id: "nonLiftableReview",
          caption:
            "Hard bounce and complaint suppressions are NON_LIFTABLE_BY_RESUBSCRIBE. They represent provider-driven signals — the recipient's mailbox provider told us to stop sending. The dashboard can still lift the entry, but an ordinary Subscribe call from elsewhere will be rejected.",
          duration: 8000,
          scene: "nonLiftableReview",
        },
        {
          id: "liftedState",
          caption:
            "After a lift, the row's state badge switches to Lifted, the Lift button disappears, and a Lifted timestamp joins the Created timestamp. The audit history retains the lifted event — lifting is a state transition, not a delete.",
          duration: 7000,
          scene: "liftedState",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "Read the suppressions list",
      body: "The Suppressions page lists every suppression entry in your account. Each row shows the email, a reason badge (Manual, Unsubscribe, Hard bounce, or Complaint), a source badge (Dashboard, API, Unsubscribe link, or System), an Active or Lifted state badge, and a timestamp line. Active rows show a Lift button; lifted rows show no action.",
    },
    {
      title: "Search and filter",
      body: "Use the search box to filter by email. The toggle button switches between \"Showing active only\" (default — only entries with active = true) and \"Showing all\" (every entry, including lifted). Filtering is client-driven: every search hit re-queries the API with the activeOnly and search parameters.",
    },
    {
      title: "Add a manual suppression",
      body: "Click \"Suppress email\" to open the Add dialog. Enter an email and confirm. The dialog POSTs with reason = manual (hard-coded — the API accepts manual or unsubscribe, but the dashboard always writes manual for an operator-initiated suppression). Saving creates a SuppressionEntry with active = true. It does NOT change the contact's marketing_status — a subscribed contact stays subscribed but becomes not eligible for marketing (eligible = false while suppressed).",
    },
    {
      title: "Lift a suppression",
      body: "On an active row, click Lift. The confirmation dialog deactivates the entry: active flips to false, liftedAt is set, and a SuppressionEvent(lifted) row is appended to the audit history. Lifting alone does NOT subscribe the contact. The button uses POST (not DELETE) because lifting is a state transition that produces audit history, not a destructive delete.",
    },
    {
      title: "Lift + subscribe atomically",
      body: "Tick \"Also subscribe this contact to marketing (explicit consent)\" to combine lift + subscribe in one atomic call. The endpoint POST /api/dashboard/suppressions/{id} receives { also_subscribe: true }. The consent service acquires its canonical mutation lock, lifts the suppression, and sets marketing_status = subscribed in the same transaction. Use this when the recipient has explicitly asked to receive marketing again and the reason is manual or unsubscribe.",
    },
    {
      title: "Respect non-liftable reasons",
      body: "Hard bounce and complaint suppressions are NON_LIFTABLE_BY_RESUBSCRIBE. They represent provider-driven signals (recipient's mailbox provider told us to stop sending). The dashboard's Lift button still works on them — but an ordinary Subscribe call from elsewhere (Contacts page, API, automation) will be rejected with a ResubscribeBlockedError. Lifting them requires an explicit, out-of-band decision, not a routine resubscribe click.",
    },
  ],
  whyWhen: [
    {
      title: "When to use a manual suppression",
      body: "Use a manual suppression when you need to stop sending marketing to an address without deleting the contact. Common cases: a recipient asked you to stop sending but did not click your unsubscribe link; a customer churned and you want to suppress them in your CRM; an internal team member is testing and you want to silence their address. The contact stays in your list, fully inspectable; only their eligibility for marketing is revoked.",
    },
    {
      title: "Why lifting does not auto-subscribe",
      body: "Lift deactivates the suppression entry. Subscribe sets marketing_status = subscribed. These are different operations producing different audit events. Combining them silently on every lift would erase the distinction between \"I no longer want this email suppressed\" and \"I want to subscribe this contact\" — which is exactly the distinction CAN-SPAM and GDPR care about. The checkbox makes the consent explicit and auditable.",
    },
    {
      title: "Why hard_bounce and complaint are not liftable by resubscribe",
      body: "A hard bounce means the recipient's mailbox provider rejected the message permanently (address doesn't exist, mailbox disabled). A complaint means the recipient clicked \"Mark as spam\" in their mailbox. Both are provider-driven signals that the recipient's mailbox does not want your mail. Re-subscribing a contact with one of these active suppressions would simply produce another bounce or complaint — damaging your sender reputation and risking provider-level throttling. The system rejects the resubscribe and leaves the suppression active.",
    },
  ],
  mistakes: [
    {
      title: "Confusing \"Suppress\" with \"Unsubscribe\"",
      body: "Suppressing an email writes a SuppressionEntry with reason = manual. It does NOT change marketing_status. Unsubscribing sets marketing_status = unsubscribed AND writes a SuppressionEntry with reason = unsubscribe. A subscribed contact can be suppressed (eligible = false) without being unsubscribed. The two are independent gates; suppressing alone does not flip marketing_status.",
    },
    {
      title: "Expecting Lift to auto-subscribe",
      body: "Lift deactivates the suppression entry only. marketing_status is unchanged. If you lift a suppression on a contact whose marketing_status = unsubscribed, they are still unsubscribed — eligible remains false. To re-enable marketing, tick the \"Also subscribe\" checkbox in the lift dialog (atomic lift + subscribe), or separately subscribe the contact after the lift.",
    },
    {
      title: "Trying to resubscribe a hard_bounce or complaint",
      body: "An ordinary Subscribe call on a contact with an active hard_bounce or complaint suppression is rejected with ResubscribeBlockedError. The suppression stays active. The dashboard's Lift button is the explicit out-of-band path — use it deliberately, not casually. If a recipient genuinely wants back in after a bounce, fix the underlying address (typo, deleted mailbox) before lifting.",
    },
    {
      title: "Treating lifted suppressions as deleted",
      body: "Lifting deactivates the entry; it does not delete it. The audit history retains the lifted event with its timestamp. The row stays in the list (visible when \"Showing all\" is selected). If you need a clean slate, the right path is to never re-suppress a lifted entry — let the audit history stand.",
    },
    {
      title: "Assuming the Add dialog lets you pick the reason",
      body: "The dialog takes only an email. The dashboard hard-codes reason = manual in the POST body. The API accepts manual or unsubscribe, but to write an unsubscribe suppression through the dashboard UI you would unsubscribe the contact from the Contacts page (which sets marketing_status = unsubscribed AND writes the suppression). The dialog's purpose is manual suppressions only.",
    },
  ],
  proTips: [
    {
      title: "Use \"Showing all\" before lifting",
      body: "Before lifting a suppression, switch the filter to \"Showing all\" and search for the email. If you see a lifted entry already, the contact may have been re-suppressed and re-lifted multiple times — the audit history is the source of truth, not just the latest active state.",
    },
    {
      title: "Prefer lift + subscribe over lift-then-subscribe",
      body: "When you want to re-enable marketing for a contact, tick \"Also subscribe\" in the lift dialog rather than lifting then subscribing separately. The atomic path holds the canonical mutation lock for the whole transition and writes a single coherent audit chain. Two separate calls can race with other consent operations on the same contact.",
    },
    {
      title: "Investigate hard_bounce before lifting",
      body: "A hard_bounce suppression usually means the address is wrong or gone. Before lifting, check whether the contact's email is a typo (common — .con instead of .com), a recycled address, or a closed mailbox. Lifting a genuine hard bounce will produce another bounce on the next send, hurting your sender reputation.",
    },
    {
      title: "Treat complaint suppressions as sacred",
      body: "A complaint means the recipient clicked \"Mark as spam\" — that is a stronger signal than an unsubscribe. Do not lift a complaint suppression lightly. If you genuinely must (e.g. a recipient who complained then re-engaged via a confirmed double opt-in), document the reason and lift deliberately.",
    },
  ],
  troubleshooting: [
    {
      title: "Suppressions not available",
      body: "If you see \"Contacts not available\", your plan does not include the Contacts capability. Suppression management is part of Contacts — both the list page and the API surface check the same entitlement. Upgrade your plan to gain access. The 403 response has code = feature_not_available.",
    },
    {
      title: "Subscribe was rejected with ResubscribeBlockedError",
      body: "The contact had an active hard_bounce or complaint suppression. These are NON_LIFTABLE_BY_RESUBSCRIBE — the consent service throws rather than silently lifting the suppression. To re-enable marketing for this contact, lift the suppression explicitly via the dashboard's Lift button (or POST /api/dashboard/suppressions/{id} from the API). Fix the underlying address issue first if the reason was hard_bounce.",
    },
    {
      title: "Lifted row still shows no Lift button",
      body: "Lifted rows have active = false; the Lift button is only shown when active = true. To re-suppress a lifted email, use the \"Suppress email\" button at the top — it writes a fresh manual SuppressionEntry. The lifted entry stays in the audit history; it does not flip back to active.",
    },
    {
      title: "Lift button is missing on a row",
      body: "The Lift button appears only on active rows. If the row's state badge is \"Lifted\" (slate, not rose), the suppression is already deactivated — there is no action available. If the state badge is \"Active\" but no Lift button is visible, refresh the page; the row state may have changed since the list was loaded.",
    },
    {
      title: "Also-subscribe did not change marketing_status",
      body: "If you ticked \"Also subscribe\" but the contact's marketing_status is still unsubscribed, the contact may not exist in your account (suppressions are tenant-scoped by email; the contact record is a separate row). Lift + subscribe creates a contact row if none exists and sets marketing_status = subscribed. Verify via the Contacts page by searching the email.",
    },
    {
      title: "Search returns no results but the email is suppressed",
      body: "Check the filter toggle. If \"Showing active only\" is selected, lifted entries are hidden even if they match the search. Switch to \"Showing all\" and re-run the search. The activeOnly=true query parameter is honored server-side.",
    },
  ],
  checklist: [
    { label: "Row's reason badge matches the expected suppression reason (Manual / Unsubscribe / Hard bounce / Complaint)" },
    { label: "Active row has a Lift button; lifted row has no action" },
    { label: "Add dialog only accepts an email — reason defaults to manual" },
    { label: "Lift dialog's \"Also subscribe\" checkbox defaults to unchecked (lift ≠ subscribe)" },
    { label: "hard_bounce and complaint suppressions are NON_LIFTABLE_BY_RESUBSCRIBE" },
    { label: "Lifted rows show a Lifted timestamp next to the Created timestamp" },
  ],
  whatNext:
    "After lifting a suppression, watch the contact's marketing eligibility recover on the Contacts page (eligible = true when marketing_status = subscribed AND not currently suppressed). Use Sent Emails to inspect individual deliveries and verify the contact is now receiving marketing. Use the audit history (via the consent service log) to trace the full transition chain.",
  related: [
    { label: "Suppressions dashboard", href: "/dashboard/suppressions" },
    { label: "Contacts guide", href: "/guide/contacts" },
    { label: "Broadcasts guide", href: "/guide/broadcasts" },
  ],

  /* ─── Stage copy ──────────────────────────────────────────────────────── */
  stage: {
    dir: "ltr",
    locale: "en",

    header: {
      title: "Suppressions",
      addSuppression: "Suppress email",
    },

    card: {
      title: "Suppressions",
      subtitle:
        "Marketing suppression list. Suppressed emails are excluded from marketing eligibility.",
    },

    search: {
      placeholder: "Search by email…",
    },

    filter: {
      showingActiveOnly: "Showing active only",
      showingAll: "Showing all",
    },

    reasonLabels: {
      manual: "Manual",
      unsubscribe: "Unsubscribe",
      hard_bounce: "Hard bounce",
      complaint: "Complaint",
    },

    sourceLabels: {
      dashboard: "Dashboard",
      api: "API",
      unsubscribe: "Unsubscribe link",
      system: "System",
    },
    sourcePrefix: "Source",

    state: {
      active: "Active",
      lifted: "Lifted",
    },

    timestamps: {
      created: (when) => `Created ${when}`,
      lifted: (when) => `Lifted ${when}`,
      joined: (created, lifted) =>
        lifted
          ? `Created ${created} · Lifted ${lifted}`
          : `Created ${created}`,
    },

    actions: {
      lift: "Lift",
      noAction: "—",
    },

    empty: "No suppressions found. Add one above or change the filter.",

    pagination: {
      pageOf: (page, total) => `Page ${page} · ${total} total`,
      prev: "Prev",
      next: "Next",
    },

    notAvailable: {
      title: "Contacts not available",
      description:
        "Suppression management is part of the Contacts capability, which is not available on your current plan.",
      cta: "View Plans",
    },

    addDialog: {
      title: "Add manual suppression",
      description:
        "Suppress an email from marketing. The contact matching this email (if any) will also be unsubscribed. Existing transactional messages are not affected.",
      emailLabel: "Email",
      emailPlaceholder: "user@example.com",
      cancel: "Cancel",
      submit: "Suppress",
      submitting: "Suppressing…",
    },

    liftDialog: {
      title: (email) => `Lift suppression for ${email}?`,
      description:
        "This deactivates the suppression entry. Lifting alone does NOT resubscribe the contact — to also explicitly subscribe, check the box below. The contact will then become eligible for marketing messages.",
      alsoSubscribeLabel:
        "Also subscribe this contact to marketing (explicit consent)",
      cancel: "Cancel",
      confirmLiftOnly: "Lift suppression",
      confirmLiftAndSubscribe: "Lift + subscribe",
      submitting: "Lifting…",
      footnote:
        "POST /api/dashboard/suppressions/{suppressionId} with also_subscribe (default false). Atomic under the canonical mutation lock.",
      nonLiftableWarningTitle: "Provider-driven suppression",
      nonLiftableWarningBody:
        "This entry's reason is hard_bounce or complaint — NON_LIFTABLE_BY_RESUBSCRIBE. An ordinary Subscribe call elsewhere will be rejected; only an explicit Lift here will deactivate it.",
    },

    /* Seed suppressions — local demo data only. NEVER fetched from the
     * API. The set covers every reason code (manual, unsubscribe,
     * hard_bounce, complaint), every source (dashboard, api,
     * unsubscribe, system), both active and lifted states, and one
     * hard_bounce + one complaint row to exercise the non-liftable
     * teaching. */
    entries: [
      {
        id: 1,
        suppressionId: "sup_manual_spammer",
        email: "spammer@example.com",
        reason: "manual",
        source: "dashboard",
        active: true,
        createdAtRelative: "2 hours ago",
        liftedAtRelative: null,
      },
      {
        id: 2,
        suppressionId: "sup_unsub_alice",
        email: "alice@example.com",
        reason: "unsubscribe",
        source: "unsubscribe",
        active: true,
        createdAtRelative: "1 day ago",
        liftedAtRelative: null,
      },
      {
        id: 3,
        suppressionId: "sup_bounce_bob",
        email: "bob@closed-mailbox.test",
        reason: "hard_bounce",
        source: "system",
        active: true,
        createdAtRelative: "3 days ago",
        liftedAtRelative: null,
      },
      {
        id: 4,
        suppressionId: "sup_complaint_carol",
        email: "carol@example.org",
        reason: "complaint",
        source: "system",
        active: true,
        createdAtRelative: "5 days ago",
        liftedAtRelative: null,
      },
      {
        id: 5,
        suppressionId: "sup_manual_eve",
        email: "eve@example.com",
        reason: "manual",
        source: "api",
        active: false,
        createdAtRelative: "8 days ago",
        liftedAtRelative: "6 days ago",
      },
      {
        id: 6,
        suppressionId: "sup_unsub_dan",
        email: "dan@example.com",
        reason: "unsubscribe",
        source: "dashboard",
        active: false,
        createdAtRelative: "12 days ago",
        liftedAtRelative: "10 days ago",
      },
    ],
  },

  /* ─── Creative section copy ──────────────────────────────────────────── */
  creative: {
    /* 1. Suppression reason anatomy — the four reason codes decoded */
    reasonAnatomy: {
      heading: "The four suppression reasons, decoded",
      subheading:
        "Every suppression entry carries a reason code. The reason tells you who wrote the suppression, whether it can be lifted by an ordinary resubscribe, and what would happen if you tried. Four reasons exist in the canonical model — two are operator-driven and liftable; two are provider-driven and not liftable by resubscribe.",
      tableTitle: "Reason reference",
      columns: {
        reason: "Reason",
        label: "Badge label",
        trigger: "What triggers it",
        writtenBy: "Who writes it",
        liftable: "Liftable by resubscribe?",
      },
      rows: [
        {
          reason: "manual",
          label: "Manual",
          trigger:
            "Operator clicks \"Suppress email\" in the dashboard, or POST /api/dashboard/suppressions is called with reason = manual.",
          writtenBy: "Dashboard (or API, with reason = manual)",
          liftableByResubscribe: true,
          tone: "liftable",
        },
        {
          reason: "unsubscribe",
          label: "Unsubscribe",
          trigger:
            "Contact clicks the unsubscribe link in a marketing email, or the operator unsubscribes them from the Contacts page. Writes marketing_status = unsubscribed AND a suppression entry with reason = unsubscribe.",
          writtenBy: "Unsubscribe link (or Dashboard unsubscribe action)",
          liftableByResubscribe: true,
          tone: "liftable",
        },
        {
          reason: "hard_bounce",
          label: "Hard bounce",
          trigger:
            "Recipient's mailbox provider returned a permanent failure (550 — address does not exist, mailbox disabled, domain invalid). Written by the system in response to a provider bounce event.",
          writtenBy: "System (provider bounce event)",
          liftableByResubscribe: false,
          tone: "non-liftable",
        },
        {
          reason: "complaint",
          label: "Complaint",
          trigger:
            "Recipient clicked \"Mark as spam\" in their mailbox (a feedback-loop signal from the provider). Written by the system in response to a complaint event.",
          writtenBy: "System (provider complaint event)",
          liftableByResubscribe: false,
          tone: "non-liftable",
        },
      ],
      legendTitle: "Tone",
      legendLiftable: "Liftable by ordinary resubscribe (manual, unsubscribe)",
      legendNonLiftable:
        "NON_LIFTABLE_BY_RESUBSCRIBE (hard_bounce, complaint) — explicit Lift required",
      footnote:
        "NON_LIFTABLE_BY_RESUBSCRIBE is defined in src/lib/consent/service.ts as a ReadonlySet containing hard_bounce and complaint. subscribeContact() throws ResubscribeBlockedError for these. Lift (via the dashboard or POST /api/dashboard/suppressions/{id}) is the only path that deactivates them.",
    },

    /* 2. Active vs Lifted — the two states side-by-side */
    activeVsLifted: {
      heading: "Active vs Lifted — the two states",
      subheading:
        "A suppression entry has exactly two states: active (eligible for marketing = false) and lifted (eligible for marketing = depends on marketing_status). The state is independent of marketing_status — both must pass for eligibility. Lifting is a state transition that produces audit history; it is not a delete.",
      activeCard: {
        badge: "Active",
        title: "active: true",
        body: "The entry is currently in effect. Any contact with this email (subscribed, unsubscribed, or unknown marketing_status) is excluded from marketing. The row shows a rose \"Active\" badge and a Lift button.",
        effects: [
          "Eligible for marketing = false (regardless of marketing_status)",
          "Excluded from broadcast audiences",
          "Lift button visible in the dashboard",
          "Subscribe (when reason is hard_bounce or complaint) is rejected with ResubscribeBlockedError",
        ],
      },
      liftedCard: {
        badge: "Lifted",
        title: "active: false, liftedAt: set",
        body: "The entry has been deactivated via the Lift action. The audit history retains the lifted event with its timestamp. The row shows a slate \"Lifted\" badge and no action button. Re-suppressing the email creates a fresh entry; it does not flip this one back to active.",
        effects: [
          "Eligible for marketing = (marketing_status === subscribed)",
          "Included in broadcast audiences again (if subscribed)",
          "No Lift button on the row",
          "liftedAt timestamp joined to the createdAt timestamp",
        ],
      },
      comparison: [
        {
          dimension: "Eligible for marketing?",
          activeValue: "No (always)",
          liftedValue: "Only if marketing_status = subscribed",
        },
        {
          dimension: "State badge",
          activeValue: "Active (rose)",
          liftedValue: "Lifted (slate)",
        },
        {
          dimension: "Row action",
          activeValue: "Lift button",
          liftedValue: "No action",
        },
        {
          dimension: "Audit history",
          activeValue: "Suppress event recorded",
          liftedValue: "Suppress + Lifted events recorded",
        },
        {
          dimension: "Re-suppression path",
          activeValue: "No-op (already active)",
          liftedValue: "Create a fresh entry via Suppress email",
        },
        {
          dimension: "Subscribe call",
          activeValue:
            "Rejected for hard_bounce/complaint; succeeds (and lifts) for manual/unsubscribe",
          liftedValue: "Succeeds (no suppression to lift)",
        },
      ],
      warningTitle: "Lift is a state transition, not a delete",
      warningBody:
        "Lifting deactivates the entry; it does not remove it. The audit history retains the lifted event with its timestamp. The row stays in the list (visible when \"Showing all\" is selected). This is required for compliance — every consent change must be auditable, including the end of a suppression.",
    },

    /* 3. Safe-lifting decision tree */
    safeLiftingDecisionTree: {
      heading: "The safe-lifting decision tree",
      subheading:
        "Before you click Lift, run this decision tree. It tells you whether the lift is safe, whether you should also subscribe, and whether an ordinary Subscribe from elsewhere would have worked. The decision hinges on the suppression's reason code and the contact's current marketing_status.",
      rootQuestion:
        "What is the suppression's reason code? (Look at the row's reason badge.)",
      branches: [
        {
          key: "manual-or-unsubscribe",
          question: "Reason is manual or unsubscribe?",
          outcome:
            "Liftable. An ordinary Subscribe call from elsewhere would have lifted this suppression as a side effect — but the explicit Lift path is clearer and produces a cleaner audit trail.",
          recommendation:
            "Lift via the dashboard. Tick \"Also subscribe\" only if the contact has explicitly asked to receive marketing again.",
          tone: "safe",
          token: "manual | unsubscribe",
        },
        {
          key: "hard-bounce",
          question: "Reason is hard_bounce?",
          outcome:
            "NON_LIFTABLE_BY_RESUBSCRIBE. The recipient's mailbox provider rejected the message permanently. Re-subscribing would produce another bounce and damage your sender reputation.",
          recommendation:
            "Investigate the address (typo? recycled? closed mailbox?). Fix it first. Then Lift explicitly via the dashboard — do not rely on Subscribe.",
          tone: "blocked",
          token: "hard_bounce",
        },
        {
          key: "complaint",
          question: "Reason is complaint?",
          outcome:
            "NON_LIFTABLE_BY_RESUBSCRIBE. The recipient clicked \"Mark as spam\" — a stronger signal than an unsubscribe. Re-subscribing risks further complaints and provider throttling.",
          recommendation:
            "Do not lift lightly. If you must (e.g. recipient re-engaged via confirmed double opt-in), document the reason and Lift explicitly.",
          tone: "blocked",
          token: "complaint",
        },
        {
          key: "already-lifted",
          question: "Row's state badge is Lifted?",
          outcome:
            "No action available. The suppression is already deactivated. Re-suppressing the email creates a fresh entry; it does not flip this one back to active.",
          recommendation:
            "If you want to re-suppress, use \"Suppress email\" at the top — it writes a new manual SuppressionEntry.",
          tone: "caution",
        },
      ],
      liftOnlyPath: {
        badge: "Lift only",
        title: "also_subscribe: false",
        body: "Deactivates the suppression entry only. marketing_status is unchanged. Use this when the contact should no longer be suppressed but should not be auto-subscribed — e.g. they unsubscribed separately and you are just clearing a stale manual suppression.",
        apiCall: "POST /api/dashboard/suppressions/{id} { also_subscribe: false }",
      },
      liftAndSubscribePath: {
        badge: "Lift + subscribe",
        title: "also_subscribe: true",
        body: "Deactivates the suppression AND sets marketing_status = subscribed in one atomic transaction. Use this when the contact has explicitly asked to receive marketing again (e.g. re-engaged via a confirmed double opt-in).",
        apiCall: "POST /api/dashboard/suppressions/{id} { also_subscribe: true }",
      },
      warningTitle: "Never auto-subscribe on the back of a lift",
      warningBody:
        "Lift ≠ subscribe. The two operations produce different audit events and answer different questions (\"should this email be suppressed?\" vs \"does this contact want marketing?\"). The checkbox makes the consent explicit. If you find yourself wanting to always tick it, ask whether you actually want a Subscribe action — and whether you have explicit consent for it.",
    },

    /* 4. Eligibility relationship — how suppression + marketing_status combine */
    eligibilityRelationship: {
      heading: "How suppression and marketing_status combine",
      subheading:
        "Marketing eligibility is gated by TWO independent checks: marketing_status === subscribed AND not currently suppressed. Both must pass. A contact can be subscribed AND suppressed (eligible = false). A contact can be unsubscribed AND not suppressed (eligible = false — marketing_status gate fails). The two gates are independent; the matrix below enumerates every combination.",
      conceptCards: [
        {
          label: "marketing_status",
          value: "subscribed | unsubscribed | unknown",
          desc: "The contact's own consent to receive marketing. Set by Subscribe (→ subscribed), Unsubscribe (→ unsubscribed), or never set (→ unknown). Imported contacts start as unknown — importing or adding never subscribes them.",
        },
        {
          label: "suppressed",
          value: "active: true | active: false",
          desc: "Whether an active SuppressionEntry exists for this email. Independent of marketing_status — a subscribed contact can be suppressed (Manually Suppress writes a suppression without touching marketing_status).",
        },
        {
          label: "eligible",
          value: "true | false",
          desc: "Derived: true only when marketing_status = subscribed AND no active suppression. This is the gate broadcast sending and marketing messages check before dispatch.",
        },
      ],
      matrixTitle: "The eligibility matrix",
      matrixSubtitle:
        "All 6 combinations of (marketing_status, suppressed) → eligible. marketing_status and suppressed are INDEPENDENT — Manually Suppress does not change marketing_status.",
      marketingCol: "marketing_status",
      suppressedCol: "suppressed (active)",
      eligibleCol: "Eligible?",
      eligibleYes: "Yes",
      eligibleNo: "No",
      matrix: [
        { marketingStatus: "subscribed", suppressed: false, eligible: true },
        { marketingStatus: "subscribed", suppressed: true, eligible: false },
        { marketingStatus: "unsubscribed", suppressed: false, eligible: false },
        { marketingStatus: "unsubscribed", suppressed: true, eligible: false },
        { marketingStatus: "unknown", suppressed: false, eligible: false },
        { marketingStatus: "unknown", suppressed: true, eligible: false },
      ],
      ruleTitle: "The two-gate rule",
      ruleBody:
        "Eligibility is true if and only if marketing_status === subscribed AND no active suppression exists for the email. The dashboard Lift action only deactivates the suppression gate. To pass both gates, also subscribe (or have the contact already subscribed).",
      nonLiftableNote:
        "hard_bounce and complaint are NON_LIFTABLE_BY_RESUBSCRIBE — Subscribe is rejected rather than silently lifting the suppression. Use the explicit Lift action to clear them. This protects the recipient and your sender reputation.",
    },
  },
};
