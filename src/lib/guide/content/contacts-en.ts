/**
 * UX-B: Contacts guide — English content dictionary.
 *
 * AUDIT-GRADE FACTUAL ACCURACY:
 *   Every statement here was verified against:
 *     - src/app/dashboard/contacts/page.tsx        (Contacts list UI)
 *     - src/app/dashboard/contacts/[id]/page.tsx   (Contact detail UI)
 *     - src/app/api/dashboard/contacts/[id]/consent/route.ts (consent model)
 *     - src/lib/consent/service.ts                  (suppression/eligibility)
 *
 * Specifically:
 *   - The Contacts LIST table does NOT show marketing status. Its columns are
 *     Name, Email, Source, Created, Updated, Actions. Do not teach otherwise.
 *   - The LIST row Actions menu exposes only "View/Edit" and "Delete".
 *     Consent / marketing operations live on the Contact DETAIL page.
 *   - There is no auto-suppression lockout period. The user can change consent
 *     at any time; the system records the change in the audit history.
 *
 * Tokens that must stay LTR (emails, source codes, dates) are stored as raw
 * strings here and wrapped with <Ltr> at render time in the page component.
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
            "On the detail page, consent actions are explicit: Subscribe, Unsubscribe, Manually Suppress, and Lift Suppression. Each action is recorded in the audit history. Importing a contact never auto-subscribes them — you must explicitly subscribe.",
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
      body: "On the contact detail page, the Consent & Marketing card shows the current marketing_status, suppression state, and eligibility. You can Subscribe, Unsubscribe, Manually Suppress, or Lift Suppression. Each action is recorded in the audit history. Importing a contact never subscribes them; you must explicitly subscribe here.",
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
      title: "Deleting a contact to \"stop\" their emails",
      body: "Deleting a contact permanently destroys their timeline and attributes. If you only want to stop marketing emails, open the contact and Unsubscribe or Manually Suppress instead — that preserves history and is reversible.",
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
};
