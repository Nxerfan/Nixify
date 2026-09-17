/**
 * Phase 15 — Blog content loader.
 *
 * Loads all blog articles from content/blog/{en,fa}/*.ts at build time.
 * Provides typed access to articles by slug + locale.
 *
 * No database, no runtime fetching. All content is source-controlled.
 */

import type { BlogArticle, BlogIndexEntry, BlogLocale } from "./types";

// Import all article modules
import enWelcome from "@/../content/blog/en/welcome-to-nixify";
import enSmtp from "@/../content/blog/en/smtp-vs-api-verification";
import faWelcome from "@/../content/blog/fa/welcome-to-nixify";

const ALL_ARTICLES: BlogArticle[] = [
  enWelcome,
  enSmtp,
  faWelcome,
];

// Build lookup maps
const bySlugLocale = new Map<string, BlogArticle>();
const seen = new Set<string>();

for (const article of ALL_ARTICLES) {
  const key = `${article.locale}:${article.slug}`;
  if (seen.has(key)) {
    throw new Error(
      `Duplicate blog slug: locale="${article.locale}" slug="${article.slug}". ` +
      `Each (locale, slug) pair must be unique.`
    );
  }
  seen.add(key);

  // Validate required fields
  if (!article.slug || !article.title || !article.description || !article.body || !article.publishedAt) {
    throw new Error(
      `Invalid blog article: locale="${article.locale}" slug="${article.slug}". ` +
      `Required fields: slug, locale, title, description, publishedAt, body.`
    );
  }
  if (article.locale !== "en" && article.locale !== "fa") {
    throw new Error(
      `Invalid blog article locale: "${article.locale}" (slug="${article.slug}"). ` +
      `Supported locales: en, fa.`
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(article.publishedAt)) {
    throw new Error(
      `Invalid publishedAt date: "${article.publishedAt}" (slug="${article.slug}"). ` +
      `Must be YYYY-MM-DD format.`
    );
  }

  bySlugLocale.set(key, article);
}

/**
 * Get a single article by slug and locale.
 * Falls back to English if the requested locale does not have the article.
 */
export function getArticle(slug: string, locale: BlogLocale): BlogArticle | null {
  const key = `${locale}:${slug}`;
  const article = bySlugLocale.get(key);
  if (article) return article;

  // Fallback to English
  const fallback = bySlugLocale.get(`en:${slug}`);
  return fallback ?? null;
}

/**
 * Get all published articles for a locale, sorted newest first.
 * If locale doesn't have enough articles, English fallbacks are included
 * only for slugs that don't exist in the requested locale.
 */
export function getArticles(locale: BlogLocale): BlogIndexEntry[] {
  const localeArticles = ALL_ARTICLES.filter(a => a.locale === locale);
  const localeSlugs = new Set(localeArticles.map(a => a.slug));

  // Add English articles whose slug doesn't exist in the requested locale
  const fallbacks = ALL_ARTICLES.filter(
    a => a.locale === "en" && !localeSlugs.has(a.slug)
  );

  const all = [...localeArticles, ...fallbacks];
  return all
    .map(a => ({
      slug: a.slug,
      locale: a.locale,
      title: a.title,
      description: a.description,
      publishedAt: a.publishedAt,
      updatedAt: a.updatedAt,
      category: a.category,
    }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/**
 * Get all unique slugs across all locales.
 */
export function getAllSlugs(): string[] {
  const slugs = new Set(ALL_ARTICLES.map(a => a.slug));
  return Array.from(slugs);
}
