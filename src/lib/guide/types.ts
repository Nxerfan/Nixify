/**
 * UX-B: Guide definition types.
 *
 * A Guide is a scripted visual walkthrough for a dashboard section.
 * Each guide has chapters, each chapter has steps, each step has:
 * - a caption (localized)
 * - a demo scene (what to animate on the DemoStage)
 * - optional spotlight target (CSS selector to highlight)
 *
 * The guide system is data-driven: page-specific guides are defined
 * as plain config objects, rendered by the reusable WalkthroughShell.
 */

export type GuideLocale = "en" | "fa";

/** A single step in a chapter. */
export interface GuideStep {
  /** Unique key for i18n lookups, e.g. "broadcast.create.title" */
  id: string;
  /** Duration in ms before auto-advancing (0 = manual). */
  duration?: number;
  /** CSS selector of the element to spotlight (dimmed overlay around it). */
  spotlight?: string;
  /** Demo scene key — maps to a scripted animation on the DemoStage. */
  scene?: string;
  /** Whether the step types text into a demo input. */
  typedText?: string;
  /** Target input selector for typedText. */
  typedTarget?: string;
}

/** A chapter groups related steps. */
export interface GuideChapter {
  id: string;
  steps: GuideStep[];
}

/** A complete guide for a dashboard route. */
export interface GuideDefinition {
  /** Route path this guide belongs to, e.g. "/dashboard/broadcasts". */
  route: string;
  /** Guide chapters in order. */
  chapters: GuideChapter[];
  /** Whether this guide is available. Some routes may not have a guide yet. */
  enabled: boolean;
}

/** Registry of all guides, keyed by route. */
export type GuideRegistry = Record<string, GuideDefinition>;

/**
 * Caption text keys are constructed as:
 *   `guide.{routeKey}.{chapterId}.{stepId}.caption`
 *
 * e.g. guide.broadcasts.create.title.caption
 *
 * This keeps all guide text in the canonical i18n dictionaries.
 */
