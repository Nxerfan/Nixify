/**
 * Phase 16 — Structured data (JSON-LD) builders.
 *
 * Pure functions that produce structured-data objects from real source data.
 * Used by the root layout (WebSite + Organization) and the article page
 * (BlogPosting/Article).
 *
 * ─── Safety ───────────────────────────────────────────────────────────────
 *
 * The serialized JSON-LD is rendered via `<script type="application/ld+json">`
 * using `JSON.stringify`. The `<` character is escaped to `\\u003c` to
 * prevent `</script>` breakout. The data sources are:
 *   - the canonical site URL helper (no user input)
 *   - the source-controlled blog article objects (no user input)
 *
 * No user-controlled arbitrary JSON is ever serialized.
 *
 * ─── What is NOT added ────────────────────────────────────────────────────
 *
 * Per the Phase 16 spec, we do NOT add: Review, AggregateRating, Product
 * rating, fake offers, fake support contacts, or FAQ schema for content not
 * visibly present. Only real, visible fields are serialized.
 */

import type { BlogArticle } from "@/lib/blog/types";
import { getSiteOrigin, absoluteUrl } from "@/lib/site/site-url";

/**
 * WebSite structured data — represents the website itself.
 *
 * Used on the root layout. The `url` is the canonical site origin.
 */
export function buildWebSiteJsonLd(): object {
  const origin = getSiteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Nixify",
    url: origin,
    description:
      "Email OTP verification platform — real OTP delivery, atomic single-use verification, webhooks, email theming, and plan-based entitlements.",
  };
}

/**
 * Organization structured data — represents the publishing organization.
 *
 * Used on the root layout. Only real, factual fields. No fabricated contact
 * points, logo URLs that don't exist, or social profiles that don't exist.
 */
export function buildOrganizationJsonLd(): object {
  const origin = getSiteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Nixify",
    url: origin,
  };
}

/**
 * BlogPosting structured data for a single article.
 *
 * Derives EVERY field from the canonical article object (source-controlled
 * content from `content/blog/{en,fa}/*.ts`). No fabricated fields.
 *
 *   headline        = article.title
 *   description     = article.description
 *   datePublished   = article.publishedAt
 *   dateModified    = article.updatedAt ?? article.publishedAt
 *   url             = canonical article URL
 *   inLanguage     = article.locale (the ACTUAL rendered article locale,
 *                     which may be "en" for an English fallback shown to a
 *                     Persian user — the metadata accurately describes the
 *                     fallback article, not the requested locale)
 *   author          = article.author ONLY when present (real, project-defined)
 *
 * No Review, no AggregateRating, no fake offers.
 */
export function buildArticleJsonLd(article: BlogArticle): object {
  const url = absoluteUrl(`/blog/${article.slug}`);
  const dateModified = article.updatedAt ?? article.publishedAt;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified,
    url,
    inLanguage: article.locale,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };
  // Author ONLY when a real author exists in the article model.
  if (article.author) {
    data.author = {
      "@type": "Organization",
      name: article.author,
    };
  }
  return data;
}

/**
 * Safely serialize a JSON-LD object for rendering inside a
 * `<script type="application/ld+json">` tag.
 *
 * Escapes `<` → `\\u003c` to prevent `</script>` breakout (a known XSS
 * vector when user-influenced strings are interpolated into script tags).
 * The data sources here are source-controlled, but this defense-in-depth
 * guard is still applied.
 */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
