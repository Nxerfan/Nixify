/**
 * Phase 16 — Metadata builders for blog routes.
 *
 * Pure functions that build `Metadata` objects from a resolved locale + the
 * canonical blog content. Extracted from the async route handlers so they are
 * independently testable WITHOUT mocking `next/headers` / `db` / auth.
 *
 * The route handlers call `resolveServerLocale()` (the shared canonical
 * resolver) then pass the locale to these pure builders.
 */

import type { Metadata } from "next";
import { translate } from "@/i18n";
import type { Locale } from "@/lib/i18n/locales";
import { getArticle, getAllSlugs } from "@/lib/blog/content";
import { absoluteUrl } from "@/lib/site/site-url";

/**
 * Build the `/blog` index metadata for a resolved locale.
 *
 * Title + description come from the canonical translation dictionaries
 * (`blog.title` / `blog.subtitle`) via the pure `translate()` function —
 * NOT hardcoded. The root layout's title template (`%s — Nixify`) appends
 * the site name automatically.
 *
 * @param locale The resolved application locale (from `resolveServerLocale()`).
 */
export function buildBlogIndexMetadata(locale: Locale): Metadata {
  const title = translate(locale, "blog.title");
  const description = translate(locale, "blog.subtitle");
  return {
    title,
    description,
    alternates: {
      canonical: "/blog",
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl("/blog"),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/**
 * Build the `/blog/[slug]` article metadata for a resolved locale + slug.
 *
 * Derives EVERY field from the canonical article object. For an unknown slug,
 * returns a minimal "Not Found" metadata with NO article metadata (no
 * misleading article metadata for nonexistent articles).
 *
 * For an English fallback article shown to a Persian user (e.g.
 * `smtp-vs-api-verification` which only has an `en` version), the metadata
 * accurately describes the ACTUAL fallback article — `inLanguage` is the
 * article's real locale (`en`), not the requested presentation locale (`fa`).
 * This is correct: the metadata describes the content the user will actually
 * see, not the locale they requested.
 *
 * @param slug   The article slug from the URL.
 * @param locale The resolved application locale (from `resolveServerLocale()`).
 */
export function buildArticleMetadata(
  slug: string,
  locale: Locale,
): Metadata {
  const article = getArticle(slug, locale);
  if (!article) {
    // Unknown slug — no article metadata. The page will call notFound().
    return {
      title: "Not Found",
      robots: { index: false, follow: false },
    };
  }

  const canonicalUrl = absoluteUrl(`/blog/${slug}`);
  const publishedTime = article.publishedAt;
  const modifiedTime = article.updatedAt ?? article.publishedAt;

  return {
    title: article.title,
    description: article.description,
    alternates: {
      canonical: `/blog/${slug}`,
    },
    openGraph: {
      title: article.title,
      description: article.description,
      url: canonicalUrl,
      type: "article",
      publishedTime,
      modifiedTime,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
    },
  };
}

/**
 * Return the list of slugs that should produce article metadata.
 * Used by tests to verify every published slug gets valid metadata.
 */
export function getAllArticleSlugs(): string[] {
  return getAllSlugs();
}
