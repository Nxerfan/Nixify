/**
 * UX-B: Guide registry — all published guides.
 *
 * Each guide is registered with:
 *   - slug: the URL segment (/guide/<slug>)
 *   - metadata: title, description, category, dashboard route, step count, duration
 *   - resolve: a function that returns the localized content for the active locale
 *
 * The /guide landing page reads GUIDE_METADATA to build its card grid.
 * The /guide/[section] route reads isKnownGuideSlug to validate the slug.
 *
 * Adding a new guide:
 *   1. Create <slug>-en.ts and <slug>-fa.ts content dictionaries under
 *      src/lib/guide/content/guides/.
 *   2. Define the guide-specific stage + creative copy types in
 *      src/lib/guide/content/guides/<slug>-types.ts.
 *   3. Import them here and add a registration entry.
 *   4. Create a view component in src/components/guide/views/<Slug>GuideView.tsx.
 *   5. Add the view to the VIEWS map in src/app/guide/[section]/page.tsx.
 */

import type { GuideContentBase, GuideRegistration, GuideMetadata, GuideCategory, GuideCategoryMeta } from "./types";
import { contactsEn } from "./contacts-en";
import { contactsFa } from "./contacts-fa";
import { brandingEn } from "./guides/branding-en";
import { brandingFa } from "./guides/branding-fa";
import { automationsEn } from "./guides/automations-en";
import { automationsFa } from "./guides/automations-fa";
import { templatesEn } from "./guides/templates-en";
import { templatesFa } from "./guides/templates-fa";
import { broadcastsEn } from "./guides/broadcasts-en";
import { broadcastsFa } from "./guides/broadcasts-fa";
import { suppressionsEn } from "./guides/suppressions-en";
import { suppressionsFa } from "./guides/suppressions-fa";
import { emailsEn } from "./guides/emails-en";
import { emailsFa } from "./guides/emails-fa";
import { apiKeysEn } from "./guides/api-keys-en";
import { apiKeysFa } from "./guides/api-keys-fa";
import { webhooksEn } from "./guides/webhooks-en";
import { webhooksFa } from "./guides/webhooks-fa";

export type {
  GuideContentBase,
  GuideRegistration,
  GuideMetadata,
  GuideCategory,
  GuideContentSection,
  GuideContentChecklistItem,
  GuideContentRelatedLink,
  GuideCategoryMeta,
} from "./types";

// Re-export Contacts-specific types for backwards compatibility.
export type {
  ContactsStageCopy,
  ContactsStageSourceLabel,
  JourneyCopy,
  JourneyStepCopy,
  ManualAddCopy,
  ManualVsImportCopy,
  ConsentConceptCard,
  ConsentActionCopy,
  ConsentExplainerCopy,
  AnatomyFieldCopy,
  ContactAnatomyCopy,
  CreativeSectionCopy,
} from "./types";

/* ─── Category metadata (for the /guide landing page) ────────────────────── */

export const GUIDE_CATEGORIES: GuideCategoryMeta[] = [
  {
    id: "audience",
    label: "Audience",
    description: "Manage the people you send to — contacts, groups, suppressions.",
  },
  {
    id: "messaging",
    label: "Messaging",
    description: "Send and track emails — broadcasts, templates, sent emails.",
  },
  {
    id: "automation",
    label: "Automation",
    description: "Trigger-based workflows that fire automatically.",
  },
  {
    id: "developer",
    label: "Developer Tools",
    description: "Integrate Nixify with your app — API keys, webhooks.",
  },
  {
    id: "delivery",
    label: "Delivery & Safety",
    description: "Understand delivery, suppressions, and email status.",
  },
  {
    id: "customization",
    label: "Customization",
    description: "Brand your emails with custom themes and styling.",
  },
];

/* ─── Guide registrations ────────────────────────────────────────────────── */

const REGISTRATIONS: Record<string, GuideRegistration> = {
  contacts: {
    slug: "contacts",
    metadata: {
      slug: "contacts",
      routeKey: "contacts",
      category: "audience",
      dashboardRoute: "/dashboard/contacts",
      title: "Contacts",
      description: "Add, search, inspect, and manage every contact in your account.",
      stepCount: 6,
      durationMin: 4,
      published: true,
    },
    resolve: (locale) => (locale === "fa" ? contactsFa : contactsEn),
  },

  branding: {
    slug: "branding",
    metadata: {
      slug: "branding",
      routeKey: "branding",
      category: "customization",
      dashboardRoute: "/dashboard/branding",
      title: "Branding",
      description: "Design your email appearance — colors, header, footer, and live preview.",
      stepCount: 6,
      durationMin: 5,
      published: true,
    },
    resolve: (locale) => (locale === "fa" ? brandingFa : brandingEn),
  },

  automations: {
    slug: "automations",
    metadata: {
      slug: "automations",
      routeKey: "automations",
      category: "automation",
      dashboardRoute: "/dashboard/automations",
      title: "Automations",
      description: "Trigger-based automation rules that fire actions when events occur.",
      stepCount: 5,
      durationMin: 4,
      published: true,
    },
    resolve: (locale) => (locale === "fa" ? automationsFa : automationsEn),
  },

  templates: {
    slug: "templates",
    metadata: {
      slug: "templates",
      routeKey: "templates",
      category: "messaging",
      dashboardRoute: "/dashboard/templates",
      title: "Templates",
      description: "Create reusable transactional email templates with variables, versioning, and live preview.",
      stepCount: 6,
      durationMin: 5,
      published: true,
    },
    resolve: (locale) => (locale === "fa" ? templatesFa : templatesEn),
  },

  broadcasts: {
    slug: "broadcasts",
    metadata: {
      slug: "broadcasts",
      routeKey: "broadcasts",
      category: "messaging",
      dashboardRoute: "/dashboard/broadcasts",
      title: "Broadcasts",
      description: "Send a marketing campaign to a snapshot audience. Draft, preview, launch (irreversible), and track delivery live.",
      stepCount: 6,
      durationMin: 5,
      published: true,
    },
    resolve: (locale) => (locale === "fa" ? broadcastsFa : broadcastsEn),
  },

  suppressions: {
    slug: "suppressions",
    metadata: {
      slug: "suppressions",
      routeKey: "suppressions",
      category: "audience",
      dashboardRoute: "/dashboard/suppressions",
      title: "Suppressions",
      description: "Manage marketing suppressions: add manual entries, lift active ones, and understand why hard_bounce and complaint cannot be lifted by ordinary resubscribe.",
      stepCount: 6,
      durationMin: 4,
      published: true,
    },
    resolve: (locale) => (locale === "fa" ? suppressionsFa : suppressionsEn),
  },

  emails: {
    slug: "emails",
    metadata: {
      slug: "emails",
      routeKey: "emails",
      category: "messaging",
      dashboardRoute: "/dashboard/emails",
      title: "Sent Emails",
      description: "Track every email Nixify has delivered on your behalf — sent, delivered, deferred, bounced, complained, rejected, failed, and the recovery case unknown. The dashboard page is a placeholder today; this guide teaches the concept of email delivery tracking honestly.",
      stepCount: 6,
      durationMin: 5,
      published: true,
    },
    resolve: (locale) => (locale === "fa" ? emailsFa : emailsEn),
  },

  "api-keys": {
    slug: "api-keys",
    metadata: {
      slug: "api-keys",
      routeKey: "api-keys",
      category: "developer",
      dashboardRoute: "/dashboard/api-keys",
      title: "API Keys",
      description: "Generate, monitor, and revoke programmatic access keys. The full key is shown ONCE at creation — Nixify stores only its SHA-256 hash and a 12-char prefix. Learn the test/live distinction, the full vs read_only scope model, and the secure storage checklist.",
      stepCount: 6,
      durationMin: 5,
      published: true,
    },
    resolve: (locale) => (locale === "fa" ? apiKeysFa : apiKeysEn),
  },

  webhooks: {
    slug: "webhooks",
    metadata: {
      slug: "webhooks",
      routeKey: "webhooks",
      category: "developer",
      dashboardRoute: "/dashboard/webhooks",
      title: "Webhooks",
      description: "Register signed webhook endpoints, inspect deliveries, and replay events. Every delivery is HMAC-SHA256 signed with a per-endpoint secret shown ONCE at creation — Nixify never returns the secret again. Learn the durable-only dispatch model, the signing + verification contract, and the retry + replay lifecycle.",
      stepCount: 6,
      durationMin: 5,
      published: true,
    },
    resolve: (locale) => (locale === "fa" ? webhooksFa : webhooksEn),
  },
};

/** All currently-registered guide slugs, in stable order. */
export const GUIDE_SLUGS: readonly string[] = Object.keys(REGISTRATIONS);

/** Metadata for all published guides (for the /guide landing page). */
export const GUIDE_METADATA: GuideMetadata[] = Object.values(REGISTRATIONS)
  .filter((reg) => reg.metadata.published)
  .map((reg) => reg.metadata);

/** True iff a guide with this slug is registered. */
export function isKnownGuideSlug(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(REGISTRATIONS, slug);
}

/** Get metadata for a specific guide slug. */
export function getGuideMetadata(slug: string): GuideMetadata | undefined {
  return REGISTRATIONS[slug]?.metadata;
}

/**
 * Resolve localized guide content for a slug + locale.
 * Returns `undefined` if the slug is unknown (caller should 404).
 */
export function resolveGuideContent(
  slug: string,
  locale: "en" | "fa",
): GuideContentBase | undefined {
  const reg = REGISTRATIONS[slug];
  if (!reg) return undefined;
  return reg.resolve(locale);
}
