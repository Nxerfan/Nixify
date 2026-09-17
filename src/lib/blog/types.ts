/**
 * Phase 15 — Blog content model.
 *
 * Source-controlled content in content/blog/{en,fa}/*.ts
 * No database, no CMS. Each article exports a typed BlogArticle.
 */

export type BlogLocale = "en" | "fa";

export interface BlogArticle {
  /** Stable URL-safe identifier, unique within (locale). */
  slug: string;
  /** Content locale. */
  locale: BlogLocale;
  /** Article title (localized). */
  title: string;
  /** Short description for index/metadata (localized). */
  description: string;
  /** ISO date string (YYYY-MM-DD). */
  publishedAt: string;
  /** Optional ISO date string for content updates. */
  updatedAt?: string;
  /** Optional category for grouping. */
  category?: string;
  /** Optional tags. */
  tags?: string[];
  /** Optional author identity (project-defined, not fabricated). */
  author?: string;
  /** Article body as Markdown (rendered safely at request time). */
  body: string;
}

export interface BlogIndexEntry {
  slug: string;
  locale: BlogLocale;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  category?: string;
}
