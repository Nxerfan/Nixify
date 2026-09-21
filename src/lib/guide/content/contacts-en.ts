/**
 * UX-B: Contacts guide — English content dictionary.
 *
 * AUDIT-GRADE FACTUAL ACCURACY (re-verified this pass):
 *   Every statement here was verified against:
 *     - src/app/dashboard/contacts/page.tsx              (Contacts list UI)
 *     - src/app/dashboard/contacts/[id]/page.tsx         (Contact detail UI)
 *     - src/app/api/dashboard/contacts/[id]/consent/route.ts
 *     - src/app/api/dashboard/suppressions/route.ts     (manual suppress does NOT unsubscribe)
 *     - src/app/api/dashboard/contacts/[id]/subscribe/route.ts
 *     - src/app/api/dashboard/contacts/[id]/unsubscribe/route.ts
 *     - src/lib/consent/service.ts                       (NON_LIFTABLE_BY_RESUBSCRIBE)
 *
 * Specifically:
 *   - The Contacts LIST table does NOT show marketing status. Its columns are
 *     Name, Email, Source, Created, Updated, Actions.
 *   - The LIST row Actions menu exposes only "View/Edit" and "Delete".
 *     Consent / marketing operations live on the Contact DETAIL page.
 *   - There is no auto-suppression lockout period.
 *   - Manually Suppress does NOT unsubscribe the contact. It only creates an
 *     active suppression entry. marketing_status is unchanged. A contact can
 *     be subscribed AND suppressed at the same time (eligible = false).
 *   - Unsubscribe is different: it sets marketing_status = unsubscribed AND
 *     creates an active suppression entry.
 *   - Lift Suppression only deactivates the suppression entry. It does NOT
 *     subscribe the contact.
 *   - Subscribe lifts ordinary manual/unsubscribe suppressions automatically,
 *     BUT provider-driven suppressions (hard_bounce, complaint) are
 *     NON_LIFTABLE_BY_RESUBSCRIBE and throw ResubscribeBlockedError. Those
 *     require an explicit admin action to lift.
 *
 * Tokens that must stay LTR (emails, source codes, dates) are stored as raw
 * strings here and wrapped with <Ltr> at render time in the page component.
 *
 * This dictionary ALSO contains:
 *   - stage: human-facing copy for the simulated ContactsStage product UI
 *   - creative: copy for the four creative sections (Journey, Manual vs
 *     Import, Consent, Anatomy)
 * Both are typed via the shared GuideContent interface so the render
 * components receive resolved content rather than reading locale directly.
 */

import type { GuideContent } from "./types";

export const contactsEn: GuideContent = {
  slug: "contacts",
  routeKey: "contacts",
  backHref: "/dashboard/contacts",
  stepCount: 6,
  durationMin: 4,
  chapters: [
    {
      id: "intro",
      title: "Contacts",
      steps: [
        {
          id: "contactsOverview",
          caption:
            "Here you see every contact in your account. Each row shows the contact's name, email, source badge, created and updated dates, and an actions menu.",
          duration: 6500,
          scene: "contactsOverview",
        },
        {
          id: "addContact",
          caption:
            "To add a contact, click \"Add Contact\". Enter the email (required), an optional name, and any optional attribute key/value pairs. Saving writes the contact to your account and the new row appears in the table.",
          duration: 7500,
          scene: "addContact",
          typedText: "sara@example.com",
        },
        {
          id: "searchFilter",
          caption:
            "Type into the search bar to filter contacts by email or name. Results update live after a short debounce. Use pagination to move through large lists.",
          duration: 6000,
          scene: "searchFilter",
          typedText: "sara",
        },
        {
          id: "actionsMenu",
          caption:
            "Each row's actions menu exposes two operations: \"View/Edit\" opens the contact detail page, and \"Delete\" removes the contact permanently. Marketing and consent operations are not on the list — they live on the contact detail page.",
          duration: 7000,
          scene: "actionsMenu",
        },
        {
          id: "contactDetail",
          caption:
            "Opening a contact takes you to the detail page. There you can edit the name and attributes, see the source, read the marketing status, manage consent (subscribe / unsubscribe / suppress / lift), and review the contact's timeline.",
          duration: 7500,
          scene: "contactDetail",
        },
        {
          id: "consentActions",
          caption:
            "On the detail page, consent actions are explicit: Subscribe, Unsubscribe, Manually Suppress, and Lift Suppression. Manually Suppress does NOT unsubscribe — it only blocks marketing eligibility. Each action is recorded in the audit history.",
          duration: 7000,
          scene: "consentActions",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "Read the contacts table",
      body: "The Contacts page lists every contact in your account. The columns are exactly: Name, Email, Source, Created, Updated, and Actions. Marketing status is intentionally not shown here — it lives on the contact detail page so the list stays scannable.",
    },
    {
      title: "Add a new contact",
      body: "Click \"Add Contact\". The dialog requires an email. Name is optional. You can add any number of attribute key/value pairs (for example, plan: pro). Saving persists the contact and the row appears in the table.",
    },
    {
      title: "Search and paginate",
      body: "The search box filters by email or name. Results update after a short debounce. Pagination controls at the bottom move you through the full list when there are more contacts than fit on one page.",
    },
    {
      title: "Open a contact's detail page",
      body: "Click any row (or pick \"View/Edit\" from the actions menu) to open the contact detail page. The detail page is where you edit name and attributes, and where consent and marketing operations live.",
    },
    {
      title: "Understand the actions menu",
      body: "The list row actions menu exposes only two operations: \"View/Edit\" and \"Delete\". Deleting a contact is permanent and also removes their contact timeline. To change marketing consent, open the contact detail page — the list does not expose consent operations.",
    },
    {
      title: "Manage consent on the detail page",
      body: "On the contact detail page, the Consent & Marketing card shows the current marketing_status, suppression state, and eligibility. You can Subscribe, Unsubscribe, Manually Suppress, or Lift Suppression. Manually Suppress only creates a suppression entry — it does NOT change marketing_status. Unsubscribe is different: it sets marketing_status = unsubscribed AND creates a suppression entry. Each action is recorded in the audit history.",
    },
  ],
  whyWhen: [
    {
      title: "When to use Contacts",
      body: "Use Contacts whenever you need a single source of truth for the people you might email — added manually, imported in bulk, or created automatically when a user verifies an OTP. Contacts is the registry that broadcasts, automations, and transactional messages all read from.",
    },
    {
      title: "List vs Detail",
      body: "The Contacts list is for scanning, searching, and quick actions. The contact detail page is where you edit fields and manage consent. If you find yourself wanting to change marketing status from the list, you're looking in the wrong place — open the contact first.",
    },
    {
      title: "What is a contact source?",
      body: "Source records how the contact was created: API (created via the v1 API), Dashboard (added manually here), Import (added via the CSV importer), or OTP Verified (created automatically when a user completed OTP verification). Source is read-only.",
    },
  ],
  mistakes: [
    {
      title: "Looking for marketing status on the list",
      body: "The list intentionally does not show marketing status — it lives on the contact detail page. If you don't see a status column, open the contact to inspect and manage it.",
    },
    {
      title: "Expecting consent actions on the list row menu",
      body: "The list row actions menu exposes only \"View/Edit\" and \"Delete\". Subscribe, Unsubscribe, Suppress, and Lift all live on the contact detail page. Don't expect to change consent from the list — it isn't there.",
    },
    {
      title: "Assuming imported contacts are subscribed",
      body: "Importing a contact creates them with marketing_status = unknown. They are not subscribed. If you intend to market to them, you must explicitly Subscribe them on the contact detail page (or your import must include a marketing-confirmation step that the user consented to).",
    },
    {
      title: "Confusing Manually Suppress with Unsubscribe",
      body: "Manually Suppress only creates a suppression entry — it does NOT change marketing_status. A contact can be subscribed AND suppressed at the same time (eligible = false because suppression blocks marketing). Unsubscribe is different: it sets marketing_status = unsubscribed AND creates a suppression entry.",
    },
    {
      title: "Expecting Subscribe to lift a hard_bounce or complaint suppression",
      body: "Provider-driven suppressions (hard_bounce, complaint) are NON_LIFTABLE_BY_RESUBSCRIBE. Clicking Subscribe will NOT lift them — the operation is rejected and the suppression stays active. Those suppressions require an explicit admin action to lift, not a routine resubscribe.",
    },
  ],
  proTips: [
    {
      title: "Use search before pagination",
      body: "If you're looking for one specific contact, type part of their email or name into the search bar. That's almost always faster than paging through the list.",
    },
    {
      title: "Edit attributes on the detail page",
      body: "Attributes (custom key/value pairs) are edited on the contact detail page, not the list. Add as many as you need — they're preserved as-is when values are unchanged, even if the original was not a string.",
    },
    {
      title: "Lift does not subscribe",
      body: "Lifting a suppression only deactivates the suppression entry — it does NOT subscribe the contact. To resume marketing, lift first, then explicitly Subscribe.",
    },
  ],
  troubleshooting: [
    {
      title: "New contact doesn't appear in the list",
      body: "Refresh the page. If the contact still doesn't appear, the create call may have returned an error — check the toast notification. The most common cause is an invalid email address or an email that already exists for your account (in which case the existing contact was updated, not duplicated).",
    },
    {
      title: "Search returns no results",
      body: "Search matches substrings of email or name. If you got zero results, shorten your query, or check whether the contact is on a different page — search is across the whole account, not just the current page.",
    },
    {
      title: "Cannot change a contact's marketing status",
      body: "Marketing status can only be changed from the contact detail page, not from the list. Open the contact, then use Subscribe, Unsubscribe, Manually Suppress, or Lift Suppression in the Consent & Marketing card. There is no system-imposed lockout period — if the button is disabled, it's because the contact is already in that state.",
    },
    {
      title: "Subscribe was rejected for a hard_bounce or complaint suppression",
      body: "Provider-driven suppressions (hard_bounce, complaint) are NON_LIFTABLE_BY_RESUBSCRIBE — an ordinary Subscribe will NOT lift them. The operation is rejected so the suppression stays active. To lift these, an explicit admin action is required (delete the contact and manually lift the suppression). This protects the recipient: their mailbox provider told us to stop sending.",
    },
    {
      title: "Imported contacts didn't receive my broadcast",
      body: "Importing a contact never subscribes them. To send marketing to imported contacts, you must explicitly Subscribe each one (or confirm you had their consent out-of-band and bulk-subscribe). A contact must be both subscribed AND not suppressed to be eligible for marketing.",
    },
  ],
  checklist: [
    { label: "Read the contacts list table" },
    { label: "Add a contact with an email" },
    { label: "Use search to filter results" },
    { label: "Open a contact detail page" },
    { label: "Locate the consent actions on the detail page" },
    { label: "Understand that list actions only has View/Edit and Delete" },
    { label: "Understand that Manually Suppress does NOT unsubscribe" },
  ],
  whatNext:
    "Once you're comfortable with Contacts, the natural next step is the Contacts Import feature (Dashboard → Contacts → Import) for adding many contacts at once from a CSV file. Suppressions, broadcasts, and groups each have their own dashboard pages — explore them directly from the sidebar.",
  related: [
    {
      label: "Open Contacts in the dashboard",
      href: "/dashboard/contacts",
    },
    {
      label: "Import contacts (CSV)",
      href: "/dashboard/contacts/import",
    },
    {
      label: "Manage suppressions",
      href: "/dashboard/suppressions",
    },
  ],

  /* ─── Stage copy (simulated Contacts product UI, English) ──────────────── */
  stage: {
    dir: "ltr",
    locale: "en",
    header: {
      title: "Contacts",
      subtitle: "Manage your account contacts",
      addContact: "Add Contact",
    },
    search: {
      placeholder: "Search by email or name",
      countPlural: (n) => `${n} contacts`,
      countSingular: (n) => `${n} contact`,
    },
    table: {
      name: "Name",
      email: "Email",
      source: "Source",
      created: "Created",
      updated: "Updated",
      actions: "Actions",
      rowActionsAria: "Row actions",
      noMatches: (q) => `No contacts match "${q}".`,
    },
    actionsMenu: {
      viewEdit: "View/Edit",
      delete: "Delete",
    },
    pagination: {
      pageOf: (page, total) => `Page ${page} of ${total}`,
      prev: "Prev",
      next: "Next",
    },
    createDialog: {
      title: "Add Contact",
      description: "Email is required. Name and attributes are optional.",
      emailLabel: "Email",
      nameOptional: "Name (optional)",
      attributesOptional: "Attributes (optional)",
      keyPlaceholder: "key",
      valuePlaceholder: "value",
      cancel: "Cancel",
      submit: "Add Contact",
    },
    detail: {
      backToContacts: "Contacts",
      emailImmutable: "immutable",
      sourceLabel: "Source",
      updatedLabel: "Updated",
      consentTitle: "Consent & Marketing",
      timelineTitle: "Timeline",
      suppressed: "Suppressed",
      notSuppressed: "Not suppressed",
      eligibleForMarketing: "Eligible for marketing",
      importNote:
        "Importing a contact does not subscribe them. Each action is recorded in the audit history.",
      subscribe: "Subscribe",
      unsubscribe: "Unsubscribe",
      manuallySuppress: "Suppress manually",
      liftSuppression: "Lift suppression",
      idLabel: "ID",
      createdLabel: "Created",
      timelineCreated: "Contact created",
      timelineUpdated: "Contact updated",
      timelineSubscribed: "Subscribed to marketing",
      timelineSuppressed: "Manually suppressed",
    },
    sourceLabels: [
      { code: "api", label: "API" },
      { code: "dashboard", label: "Dashboard" },
      { code: "otp_verified", label: "OTP Verified" },
      { code: "import", label: "Import" },
    ],
    marketingStatusLabels: {
      subscribed: "Subscribed",
      unsubscribed: "Unsubscribed",
      unknown: "Unknown",
    },
  },

  /* ─── Creative-section copy (English) ─────────────────────────────────── */
  creative: {
    journey: {
      heading: "A Contact's Journey",
      subheading:
        "A realistic path from creation to use in related product workflows. Each step maps to a real surface in the product.",
      legendTitle: "Legend",
      legendItems: [
        { label: "UI surface", tone: "ui" },
        { label: "State change", tone: "state" },
        { label: "Downstream effect", tone: "downstream" },
      ],
      steps: [
        {
          badge: "1. Created / Imported",
          title: "A new contact is created",
          body:
            "Via manual add, CSV import, an API call, or a user completing OTP verification, a Contact row is created with marketing_status = unknown.",
          surface: "/dashboard/contacts",
          sideEffect: "Row appears in the list; source is recorded.",
        },
        {
          badge: "2. Inspected / Updated",
          title: "User opens the contact",
          body:
            "Clicking the row (or choosing \"View/Edit\" from the actions menu) opens the contact detail page. Name and attributes are editable.",
          surface: "/dashboard/contacts/[id]",
          sideEffect: "Attributes are saved; timeline is updated.",
        },
        {
          badge: "3. Consent state",
          title: "User manages marketing consent",
          body:
            "Subscribe, Unsubscribe, Manually Suppress, or Lift Suppression. Manually Suppress does NOT unsubscribe — it only creates a suppression entry. Each action is recorded in the audit history. Importing or adding never subscribes.",
          surface: "Consent & Marketing card",
          sideEffect:
            "marketing_status and suppressed change independently; eligible is recomputed as subscribed AND not suppressed.",
        },
        {
          badge: "4. Used by downstream workflows",
          title: "Contact is read by other product surfaces",
          body:
            "Broadcasts target subscribed, non-suppressed contacts. Automations fire on contact events. Transactional emails are not affected by marketing status. Provider-driven suppressions (hard_bounce, complaint) cannot be lifted by an ordinary Subscribe.",
          surface: "Broadcasts · Automations · Transactional",
          sideEffect: "Marketing send occurs only for an eligible contact.",
        },
      ],
    },

    manualVsImport: {
      heading: "Manual Add vs Import",
      subheading:
        "Both paths create real contacts in Nixify, but the use cases, the data they create, and what to expect afterward differ.",
      sourceLabel: "source",
      marketingStatusLabel: "marketing_status",
      manual: {
        badge: "Manual",
        title: "Add via the \"Add Contact\" button",
        whenTitle: "When it's appropriate",
        whenBody:
          "When you're interactively adding one or a handful of contacts — for example, manual testing, completing a specific user's onboarding, or exercising an automation. Email is required; name and attributes are optional.",
        createsTitle: "What data it creates",
        creates: [
          "One Contact row with email, optional name, and attributes",
          "source = Dashboard",
          "marketing_status = unknown (not subscribed)",
          "A contact.created timeline event",
        ],
        afterTitle: "What to expect afterward",
        afterBody:
          "The contact appears in the list immediately. To send marketing, you must explicitly Subscribe them on the contact detail page — manual add does not subscribe.",
      },
      import: {
        badge: "Import",
        title: "Add via the CSV importer",
        whenTitle: "When it's appropriate",
        whenBody:
          "When you're adding many contacts at once from a CSV file. Preview and validation happen before final confirmation.",
        createsTitle: "What data it creates",
        creates: [
          "Multiple Contact rows (one per valid CSV row)",
          "source = Import",
          "marketing_status = unknown for each",
          "A contact.imported timeline event",
        ],
        afterTitle: "What to expect afterward",
        afterBody:
          "Contacts appear in the list with source = Import. As with manual add, importing does not subscribe — if you intend to market to them, you must explicitly Subscribe each one.",
      },
    },

    consent: {
      heading: "Marketing & Consent Status",
      subheading:
        "Nixify's real consent model has three separate concepts: marketing_status, suppressed, and eligible. Their combination determines whether a contact can receive marketing email.",
      conceptCards: [
        {
          label: "marketing_status",
          value: "unknown | subscribed | unsubscribed",
          desc: "The explicit marketing consent state. Importing or adding a contact leaves this unknown.",
        },
        {
          label: "suppressed",
          value: "true | false",
          desc: "Whether the email is on the suppression list. Separate from marketing_status. A subscribed contact can be suppressed (eligible = false).",
        },
        {
          label: "eligible",
          value: "marketing_status = subscribed AND NOT suppressed",
          desc: "The computed flag — marketing sends occur only for eligible contacts.",
        },
      ],
      matrixTitle: "Combination matrix",
      matrixSubtitle:
        "Each combination of marketing_status and suppressed yields a specific eligible outcome. marketing_status and suppressed are INDEPENDENT — Manually Suppress does not change marketing_status.",
      marketingCol: "marketing_status",
      suppressedCol: "suppressed",
      eligibleCol: "eligible",
      eligibleYes: "Yes",
      eligibleNo: "No",
      actionsTitle: "Explicit consent actions",
      actions: [
        {
          icon: "subscribe",
          label: "Subscribe",
          desc: "Sets marketing_status to subscribed and lifts any active manual/unsubscribe suppression.",
          also:
            "Provider-driven suppressions (hard_bounce, complaint) are NON_LIFTABLE_BY_RESUBSCRIBE — Subscribe is rejected and the suppression stays active.",
        },
        {
          icon: "unsubscribe",
          label: "Unsubscribe",
          desc: "Sets marketing_status to unsubscribed AND creates an active suppression entry.",
          also: "Result: not eligible (suppressed + unsubscribed).",
        },
        {
          icon: "suppress",
          label: "Manually Suppress",
          desc: "Creates an active suppression entry with reason = manual. Does NOT change marketing_status. A subscribed contact stays subscribed but becomes not eligible.",
          also: "Result: eligible = false (suppression blocks marketing eligibility).",
        },
        {
          icon: "lift",
          label: "Lift Suppression",
          desc: "Deactivates the suppression entry only. Does NOT subscribe — marketing_status is unchanged.",
          also:
            "If the contact was previously subscribed, they become eligible again. If previously unsubscribed, they stay not eligible.",
        },
      ],
      importNote:
        "Importing or adding a contact never subscribes them. marketing_status starts unknown; to market to them you must explicitly Subscribe.",
      nonLiftableNote:
        "Provider-driven suppressions (hard_bounce, complaint) cannot be lifted by an ordinary Subscribe. They require an explicit admin action. This protects the recipient — their mailbox provider told us to stop sending.",
    },

    anatomy: {
      heading: "Contact Anatomy",
      subheading:
        "Every contact is a set of real fields visible on the contact detail page. Hover or tap each field to learn what it means.",
      annotationsTitle: "Fields",
      selectHint: "Click a field for details",
      annotations: [
        {
          field: "name",
          label: "Name",
          desc: "Optional display name. Editable on the detail page. If empty, the first character of the email is used as the avatar.",
          icon: "name",
          value: "Sara Ahmadi",
        },
        {
          field: "email",
          label: "Email",
          desc: "The contact's primary identifier. Read-only — it cannot be changed after creation. Transactional and marketing emails are sent to this address.",
          icon: "email",
          value: "sara@example.com",
        },
        {
          field: "source",
          label: "Source",
          desc: "How the contact was created: API, Dashboard, OTP Verified, or Import. Read-only.",
          icon: "source",
          value: "Dashboard",
        },
        {
          field: "attributes",
          label: "Attributes",
          desc: "Custom key/value pairs. Editable on the detail page. Original non-string types are preserved when unchanged.",
          icon: "attributes",
          value: "plan: pro, region: emea",
        },
        {
          field: "created_at / updated_at",
          label: "Timestamps",
          desc: "created_at is set on creation. updated_at changes with each edit or consent change. Read-only.",
          icon: "dates",
          value: "2026-08-12 / 2026-09-18",
        },
        {
          field: "consent state",
          label: "Consent state",
          desc: "marketing_status, suppressed, and eligible — three INDEPENDENT concepts. Manually Suppress does NOT change marketing_status. Managed via the Consent & Marketing card.",
          icon: "consent",
          value: "subscribed · not suppressed · eligible",
        },
        {
          field: "timeline",
          label: "Timeline",
          desc: "Recent contact events — created, updated, subscribed, unsubscribed, suppressed, and emails sent.",
          icon: "timeline",
          value: "contact.created · contact.updated · contact.subscribed",
        },
        {
          field: "id",
          label: "ID",
          desc: "The contact's internal ID. Appears in the detail page URL and is used for API references.",
          icon: "id",
          value: "1",
        },
      ],
    },
  },
};
