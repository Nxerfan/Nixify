/**
 * Phase 18 — Blog editorial utilities.
 *
 * Pure helpers for the full blog platform:
 *   - table of contents generation from Markdown headings
 *   - reading-time estimate
 *   - related-articles selection (shared category or tags)
 *   - categories list
 *   - tags list
 *   - search (title + description + body, locale-scoped)
 *   - author list + author-article lookup
 *
 * All functions are pure (no DB, no I/O) and operate on the source-controlled
 * article corpus. They are independently unit-testable.
 */

import type { BlogArticle, BlogIndexEntry, BlogLocale } from "./types";
import { ALL_ARTICLES, getArticle, getArticles } from "./content";

// ─── Table of Contents ───────────────────────────────────────────────────

export interface TocItem {
  /** Heading level (2 or 3 — h1 is the title, not included in TOC). */
  level: 2 | 3;
  /** Slugified anchor id, stable across renders. */
  id: string;
  /** Heading text (plain). */
  text: string;
}

/**
 * Generate a table of contents from a Markdown body by extracting `## ` and
 * `### ` headings. `# ` (h1) is the article title and is NOT included.
 *
 * Code-fenced blocks are skipped so `##` inside a code block is not picked up
 * as a heading.
 *
 * Anchor ids are slugified: lowercase, non-alphanumeric runs → `-`, trimmed.
 * Duplicate ids get a `-2`, `-3` suffix (rare but handled).
 */
export function generateTableOfContents(body: string): TocItem[] {
  const items: TocItem[] = [];
  const seenIds = new Map<string, number>();
  let inFence = false;

  for (const line of body.split("\n")) {
    // Toggle code-fence state on ``` lines (optionally with a language tag).
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // Match ## or ### headings (NOT # or ####+).
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const level = (m[1].length === 2 ? 2 : 3) as 2 | 3;
    const text = m[2].replace(/`/g, "").replace(/\*\*/g, "").trim();
    if (!text) continue;
    const baseId = slugifyHeading(text);
    // Deduplicate ids.
    const count = seenIds.get(baseId) ?? 0;
    seenIds.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`;
    items.push({ level, id, text });
  }
  return items;
}

/** Slugify a heading into a URL-safe anchor id. */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Reading time ────────────────────────────────────────────────────────

/** Words-per-minute reading speed used for the estimate. */
const READING_WPM = 200;

/**
 * Estimate reading time in minutes for a Markdown body.
 *
 * Strips Markdown syntax (code fences, inline code, link URLs, heading
 * markers) before counting words so code-heavy articles aren't over-estimated.
 * Returns at least 1 minute for any non-empty body.
 */
export function estimateReadingTime(body: string): number {
  const prose = body
    // Remove code fences (```...```)
    .replace(/```[\s\S]*?```/g, " ")
    // Remove inline code
    .replace(/`[^`]*`/g, " ")
    // Remove link URLs, keep link text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Remove heading markers
    .replace(/^#{1,6}\s+/gm, "")
    // Remove image syntax
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  const words = prose.split(/\s+/).filter(Boolean).length;
  const minutes = Math.ceil(words / READING_WPM);
  return Math.max(1, minutes);
}

// ─── Categories ───────────────────────────────────────────────────────────

export interface CategoryCount {
  category: string;
  count: number;
}

/**
 * List all categories for a locale with article counts, sorted by count desc
 * then category asc. Categories come from `article.category` (optional field).
 */
export function getCategories(locale: BlogLocale): CategoryCount[] {
  const articles = ALL_ARTICLES.filter(a => a.locale === locale && a.category);
  const counts = new Map<string, number>();
  for (const a of articles) {
    const c = a.category!;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

/** Get all articles in a category for a locale, sorted newest first. */
export function getArticlesByCategory(
  category: string,
  locale: BlogLocale,
): BlogIndexEntry[] {
  // Case-insensitive category match (so "Engineering" matches "engineering").
  const lower = category.toLowerCase();
  return ALL_ARTICLES.filter(
    a => a.locale === locale && a.category && a.category.toLowerCase() === lower,
  )
    .map(toIndexEntry)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

// ─── Tags ────────────────────────────────────────────────────────────────

export interface TagCount {
  tag: string;
  count: number;
}

/** List all tags for a locale with article counts, sorted by count desc then tag asc. */
export function getTags(locale: BlogLocale): TagCount[] {
  const articles = ALL_ARTICLES.filter(a => a.locale === locale && a.tags && a.tags.length);
  const counts = new Map<string, number>();
  for (const a of articles) {
    for (const t of a.tags!) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Get all articles with a tag for a locale, sorted newest first. */
export function getArticlesByTag(
  tag: string,
  locale: BlogLocale,
): BlogIndexEntry[] {
  const lower = tag.toLowerCase();
  return ALL_ARTICLES.filter(
    a => a.locale === locale && a.tags && a.tags.some(t => t.toLowerCase() === lower),
  )
    .map(toIndexEntry)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

// ─── Search ───────────────────────────────────────────────────────────────

export interface SearchResult extends BlogIndexEntry {
  /** Snippet of the match context (for display). */
  snippet: string;
}

/**
 * Search articles for a locale by query string. Matches title, description,
 * and body (case-insensitive). Returns results sorted by relevance:
 *   1. title matches first
 *   2. description matches second
 *   3. body matches third
 *
 * Empty query returns an empty array (search pages with no query show a
 * prompt, not all articles).
 */
export function searchArticles(
  query: string,
  locale: BlogLocale,
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  const articles = ALL_ARTICLES.filter(a => a.locale === locale);

  const scored: Array<{ result: SearchResult; score: number }> = [];
  for (const a of articles) {
    const title = a.title.toLowerCase();
    const desc = a.description.toLowerCase();
    const body = a.body.toLowerCase();
    let score = 0;
    // All tokens must match somewhere, OR the whole query is a substring.
    const allMatch = tokens.every(
      t => title.includes(t) || desc.includes(t) || body.includes(t),
    );
    const substring = title.includes(q) || desc.includes(q) || body.includes(q);
    if (!allMatch && !substring) continue;

    for (const t of tokens) {
      if (title.includes(t)) score += 10;
      if (desc.includes(t)) score += 5;
      if (body.includes(t)) score += 1;
    }
    if (substring) score += 3;

    scored.push({ result: { ...toIndexEntry(a), snippet: makeSnippet(a.body, q) }, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .map(s => s.result);
}

/** Build a short snippet around the first match of `q` in `body`. */
function makeSnippet(body: string, q: string): string {
  const lower = body.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) {
    // No body match — use description-like prefix.
    const clean = body.replace(/```[\s\S]*?```/g, " ").replace(/[#`*]/g, "").trim();
    return clean.slice(0, 160) + (clean.length > 160 ? "…" : "");
  }
  const start = Math.max(0, idx - 80);
  const end = Math.min(body.length, idx + q.length + 80);
  const snippet = body
    .slice(start, end)
    .replace(/```/g, "")
    .replace(/[#`*]/g, "")
    .trim();
  return (start > 0 ? "…" : "") + snippet + (end < body.length ? "…" : "");
}

// ─── Related articles ────────────────────────────────────────────────────

/**
 * Get related articles for a given article (same locale). Scores by shared
 * category (weight 3) and shared tags (weight 1 per shared tag). Excludes the
 * article itself. Returns up to `limit` results (default 3), sorted by score
 * desc then publishedAt desc.
 */
export function getRelatedArticles(
  article: BlogArticle,
  limit = 3,
): BlogIndexEntry[] {
  const candidates = ALL_ARTICLES.filter(
    a => a.locale === article.locale && a.slug !== article.slug,
  );
  const scored = candidates.map(a => {
    let score = 0;
    if (article.category && a.category === article.category) score += 3;
    if (article.tags && a.tags) {
      for (const t of article.tags) {
        if (a.tags.includes(t)) score += 1;
      }
    }
    return { entry: toIndexEntry(a), score };
  });
  return scored
    .filter(s => s.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.entry.publishedAt.localeCompare(a.entry.publishedAt),
    )
    .slice(0, limit)
    .map(s => s.entry);
}

// ─── Authors ─────────────────────────────────────────────────────────────

export interface AuthorInfo {
  /** Display name (from article.author). */
  name: string;
  /** URL-safe slug for the author page. */
  slug: string;
  /** Number of articles by this author (across the locale). */
  articleCount: number;
}

/**
 * List all authors for a locale with article counts. An author is any distinct
 * `article.author` value. Sorted by article count desc then name asc.
 */
export function getAuthors(locale: BlogLocale): AuthorInfo[] {
  const articles = ALL_ARTICLES.filter(a => a.locale === locale && a.author);
  const counts = new Map<string, number>();
  for (const a of articles) {
    counts.set(a.author!, (counts.get(a.author!) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, slug: slugifyAuthor(name), articleCount: count }))
    .sort((a, b) => b.articleCount - a.articleCount || a.name.localeCompare(b.name));
}

/** Get articles by an author slug (matches the slugified author name). */
export function getArticlesByAuthor(
  authorSlug: string,
  locale: BlogLocale,
): { authorName: string | null; articles: BlogIndexEntry[] } {
  const authors = getAuthors(locale);
  const author = authors.find(a => a.slug === authorSlug);
  if (!author) return { authorName: null, articles: [] };
  const articles = ALL_ARTICLES.filter(
    a => a.locale === locale && a.author === author.name,
  )
    .map(toIndexEntry)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { authorName: author.name, articles };
}

/** Slugify an author name into a URL-safe slug. */
export function slugifyAuthor(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Featured / Editor's Pick ────────────────────────────────────────────

/**
 * Editor's Pick — articles flagged as featured via the `featured` frontmatter
 * field. This is an editorial flag, NOT a popularity metric. Returns the
 * featured articles for a locale, sorted newest first. If none are flagged,
 * returns the most recent article as a default pick.
 *
 * NOTE: The current BlogArticle type does not have a `featured` field, so this
 * function reads from an extension. See `types.ts` for the optional field.
 */
export function getFeaturedArticles(locale: BlogLocale, limit = 3): BlogIndexEntry[] {
  const featured = ALL_ARTICLES.filter(
    a => a.locale === locale && (a as BlogArticle & { featured?: boolean }).featured,
  );
  if (featured.length > 0) {
    return featured.map(toIndexEntry).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, limit);
  }
  // Default: most recent article is the featured pick.
  return getArticles(locale).slice(0, 1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function toIndexEntry(a: BlogArticle): BlogIndexEntry {
  return {
    slug: a.slug,
    locale: a.locale,
    title: a.title,
    description: a.description,
    publishedAt: a.publishedAt,
    updatedAt: a.updatedAt,
    category: a.category,
  };
}
