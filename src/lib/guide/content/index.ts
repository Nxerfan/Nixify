/**
 * UX-B: Guide registry — all published guides.
 *
 * Each guide is registered with:
 *   - slug: the URL segment (/guide/<slug>)
 *   - metadata: localized title/description, category, dashboard route,
 *     step count, duration (the SINGLE source of truth — GuideBanner reads
 *     from here, not from dashboard page props)
 *   - resolve: a function that returns the localized content for the active locale
 *
 * The /guide landing page reads GUIDE_METADATA to build its card grid.
 * The /guide/[section] route reads isKnownGuideSlug to validate the slug.
 * GuideBanner reads getGuideMetadata(slug) for steps/duration/title/description.
 *
 * LOCALIZATION:
 *   title and description are LocalizedString ({ en, fa }). The landing page
 *   and banner resolve the right language at render time via pickLocalized().
 *   Category labels are also LocalizedString.
 *
 * Adding a new guide:
 *   1. Create <slug>-en.ts and <slug>-fa.ts content dictionaries under
 *      src/lib/guide/content/guides/.
 *   2. Define the guide-specific stage + creative copy types in
 *      src/lib/guide/content/guides/<slug>-types.ts.
 *   3. Import them here and add a registration entry with LOCALIZED metadata.
 *   4. Create a view component in src/components/guide/views/<Slug>GuideView.tsx.
 *   5. Add the view to the VIEWS map in src/app/guide/[section]/page.tsx.
 */

import type {
  GuideContentBase,
  GuideRegistration,
  GuideMetadata,
  GuideCategory,
  GuideCategoryMeta,
  LocalizedString,
} from "./types";
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
  LocalizedString,
} from "./types";

export { pickLocalized } from "./types";

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

/* ─── Category metadata (localized, for the /guide landing page) ─────────── */

export const GUIDE_CATEGORIES: GuideCategoryMeta[] = [
  {
    id: "audience",
    label: {
      en: "Audience",
      fa: "مخاطبان",
    },
    description: {
      en: "Manage the people you send to — contacts, groups, suppressions.",
      fa: "مدیریت افرادی که به آن‌ها ایمیل می‌زنید — مخاطبان، گروه‌ها، عدم‌ارسال‌ها.",
    },
  },
  {
    id: "messaging",
    label: {
      en: "Messaging",
      fa: "پیام‌رسانی",
    },
    description: {
      en: "Send and track emails — broadcasts, templates, sent emails.",
      fa: "ارسال و ردیابی ایمیل — ارسال انبوه، قالب‌ها، ایمیل‌های ارسال‌شده.",
    },
  },
  {
    id: "automation",
    label: {
      en: "Automation",
      fa: "اتوماسیون",
    },
    description: {
      en: "Trigger-based workflows that fire automatically.",
      fa: "گردش‌کارهای مبتنی بر محرک که به‌طور خودکار اجرا می‌شوند.",
    },
  },
  {
    id: "developer",
    label: {
      en: "Developer Tools",
      fa: "ابزار توسعه‌دهنده",
    },
    description: {
      en: "Integrate Nixify with your app — API keys, webhooks.",
      fa: "اتصال Nixify به اپلیکیشن شما — کلیدهای API، وب‌هوک‌ها.",
    },
  },
  {
    id: "delivery",
    label: {
      en: "Delivery & Safety",
      fa: "تحویل و ایمنی",
    },
    description: {
      en: "Understand delivery, suppressions, and email status.",
      fa: "درک تحویل، عدم‌ارسال‌ها و وضعیت ایمیل.",
    },
  },
  {
    id: "customization",
    label: {
      en: "Customization",
      fa: "سفارشی‌سازی",
    },
    description: {
      en: "Brand your emails with custom themes and styling.",
      fa: "برندینگ ایمیل‌هایتان با تم‌های سفارشی و استایل.",
    },
  },
];

/* ─── Guide registrations ──────────────────────────────────────────────────
 * The stepCount and durationMin here are the SINGLE source of truth.
 * GuideBanner reads from here — dashboard pages pass only the slug.
 */

const REGISTRATIONS: Record<string, GuideRegistration> = {
  contacts: {
    slug: "contacts",
    metadata: {
      slug: "contacts",
      routeKey: "contacts",
      category: "audience",
      dashboardRoute: "/dashboard/contacts",
      title: {
        en: "Contacts",
        fa: "مخاطبان",
      },
      description: {
        en: "Add, search, inspect, and manage every contact in your account.",
        fa: "افزودن، جستجو، بررسی و مدیریت همهٔ مخاطبان حساب شما.",
      },
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
      title: {
        en: "Branding",
        fa: "برندینگ",
      },
      description: {
        en: "Design your email appearance — colors, header, footer, and live preview.",
        fa: "طراحی ظاهر ایمیل شما — رنگ‌ها، سربرگ، پاورقی و پیش‌نمایش زنده.",
      },
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
      title: {
        en: "Automations",
        fa: "اتوماسیون",
      },
      description: {
        en: "Trigger-based automation rules that fire actions when events occur.",
        fa: "قوانین اتوماسیون مبتنی بر محرک که هنگام وقوع رویدادها اجرا می‌شوند.",
      },
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
      title: {
        en: "Templates",
        fa: "قالب‌ها",
      },
      description: {
        en: "Create reusable transactional email templates with variables, versioning, and live preview.",
        fa: "ایجاد قالب‌های ایمیل تراکنشی قابل‌استفاده مجدد با متغیرها، نسخه‌بندی و پیش‌نمایش زنده.",
      },
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
      title: {
        en: "Broadcasts",
        fa: "ارسال انبوه",
      },
      description: {
        en: "Send a marketing campaign to a snapshot audience. Draft, preview, launch (irreversible), and track delivery live.",
        fa: "ارسال کمپین بازاریابی به مخاطبان لحظه‌ای. پیش‌نویس، پیش‌نمایش، راه‌اندازی (غیرقابل‌بازگشت) و ردیابی زنده تحویل.",
      },
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
      title: {
        en: "Suppressions",
        fa: "عدم‌ارسال‌ها",
      },
      description: {
        en: "Manage marketing suppressions: add manual entries, lift active ones, and understand why hard_bounce and complaint cannot be lifted by ordinary resubscribe.",
        fa: "مدیریت عدم‌ارسال‌های بازاریابی: افزودن ورودی دستی، رفع فعال‌ها، و درک اینکه چرا hard_bounce و complaint با اشتراک معمولی قابل رفع نیستند.",
      },
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
      title: {
        en: "Sent Emails",
        fa: "ایمیل‌های ارسال‌شده",
      },
      description: {
        en: "Track every email Nixify has delivered on your behalf. The dashboard page is a placeholder today; this guide teaches the concept of email delivery tracking honestly.",
        fa: "ردیابی هر ایمیلی که Nixify از طرف شما ارسال کرده است. صفحهٔ داشبورد در حال حاضر یک نگه‌دارنده است؛ این راهنما مفهوم ردیابی تحویل ایمیل را صادقانه آموزش می‌دهد.",
      },
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
      title: {
        en: "API Keys",
        fa: "کلیدهای API",
      },
      description: {
        en: "Generate, monitor, and revoke programmatic access keys. The full key is shown ONCE at creation — Nixify stores only its SHA-256 hash and a 12-char prefix.",
        fa: "تولید، پایش و ابطال کلیدهای دسترسی برنامه‌نویسی. کلید کامل فقط یک‌بار هنگام ایجاد نمایش داده می‌شود — Nixify فقط هش SHA-256 و پیشوند ۱۲ کاراکتری آن را ذخیره می‌کند.",
      },
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
      title: {
        en: "Webhooks",
        fa: "وب‌هوک‌ها",
      },
      description: {
        en: "Register signed webhook endpoints, inspect deliveries, and replay events. Every delivery is HMAC-SHA256 signed with a per-endpoint secret shown ONCE at creation.",
        fa: "ثبت نقاط انتهایی وب‌هوک امضا‌شده، بررسی تحویل‌ها و پخش مجدد رویدادها. هر تحویل با HMAC-SHA256 با یک راز اختصاصی امضا می‌شود که فقط یک‌بار هنگام ایجاد نمایش داده می‌شود.",
      },
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
