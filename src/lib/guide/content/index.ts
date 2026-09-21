/**
 * UX-B: Guide registry — slug → resolver that returns localized content.
 *
 * Adding a new guide:
 *   1. Create <slug>-en.ts and <slug>-fa.ts dictionaries in this folder.
 *   2. Register the slug below with a resolver that switches on locale.
 *   3. The /guide/[section]/page.tsx route will pick it up automatically.
 *
 * Unknown slugs fall through to Next.js `notFound()` (see the route file).
 */

import type { GuideContent, GuideRegistration } from "./types";
import { contactsEn } from "./contacts-en";
import { contactsFa } from "./contacts-fa";

export type { GuideContent, GuideRegistration, GuideContentSection } from "./types";

const REGISTRATIONS: Record<string, GuideRegistration> = {
  contacts: {
    slug: "contacts",
    resolve: (locale) => (locale === "fa" ? contactsFa : contactsEn),
  },
};

/** All currently-registered guide slugs, in stable order. */
export const GUIDE_SLUGS: readonly string[] = Object.keys(REGISTRATIONS);

/** True iff a guide with this slug is registered. */
export function isKnownGuideSlug(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(REGISTRATIONS, slug);
}

/**
 * Resolve localized guide content for a slug + locale.
 * Returns `undefined` if the slug is unknown (caller should 404).
 */
export function resolveGuideContent(
  slug: string,
  locale: "en" | "fa",
): GuideContent | undefined {
  const reg = REGISTRATIONS[slug];
  if (!reg) return undefined;
  return reg.resolve(locale);
}
