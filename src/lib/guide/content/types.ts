/**
 * UX-B: Canonical guide content model.
 *
 * Reusable, typed content model for dashboard guide pages. Each guide
 * (Contacts today; future guides later) provides:
 *   - route metadata (slug, dashboard back-href, step count, duration)
 *   - chapters + steps (captions, durations, scene keys, typed text)
 *   - written steps
 *   - why/when, mistakes, pro tips, troubleshooting
 *   - checklist items
 *   - "what next" + related links
 *
 * Each guide ships BOTH an `en` and a `fa` dictionary. The /guide/[section]
 * page resolves the active dictionary at render time from the active locale
 * (the canonical locale resolver/persistence system is untouched).
 *
 * Why a typed model rather than `isFa ? "..." : "..."` strings inline:
 *   - One file per locale per guide — easier to translate, easier to review.
 *   - TypeScript catches missing fields between EN and FA at build time.
 *   - Tokens (emails, dates, IDs, source codes) stay LTR via the <Ltr> wrapper
 *     at render time; the content model just stores raw strings.
 *   - Adding a new guide is a self-contained addition: register a slug,
 *     ship two dictionaries, point the registry at them.
 */

import type { WalkthroughChapter } from "@/components/guide/CinematicWalkthrough";

export interface GuideContentSection {
  title: string;
  body: string;
}

export interface GuideContentChecklistItem {
  label: string;
}

export interface GuideContentRelatedLink {
  /** Already-localized display label. */
  label: string;
  /** Either an existing /guide/<slug> route OR a real dashboard URL. */
  href: string;
}

export interface GuideContent {
  /** Stable slug used in the URL: /guide/<slug>. */
  slug: string;
  /** Route key for shared i18n lookups (banner labels, etc.). */
  routeKey: string;
  /** Back-href to the dashboard product page. */
  backHref: string;
  /** Step count for the eyebrow chip. */
  stepCount: number;
  /** Estimated duration in minutes for the eyebrow chip. */
  durationMin: number;
  /** Walkthrough chapters (visual scenes + captions). */
  chapters: WalkthroughChapter[];
  /** Step-by-step written guide. */
  writtenSteps: GuideContentSection[];
  /** Why & when to use this feature. */
  whyWhen: GuideContentSection[];
  /** Common mistakes. */
  mistakes: GuideContentSection[];
  /** Pro tips / best practices. */
  proTips: GuideContentSection[];
  /** Troubleshooting entries. */
  troubleshooting: GuideContentSection[];
  /** Quick checklist items. */
  checklist: GuideContentChecklistItem[];
  /** "What happens next?" paragraph. */
  whatNext: string;
  /** Related feature links (must point to real, shipped routes). */
  related: GuideContentRelatedLink[];
}

/**
 * A registered guide: slug → resolver that returns the content for a locale.
 *
 * The resolver pattern keeps the heavy content dictionaries out of the
 * server-component render path until they're actually needed.
 */
export interface GuideRegistration {
  slug: string;
  /** Returns the localized content for the requested locale. */
  resolve: (locale: "en" | "fa") => GuideContent;
}
