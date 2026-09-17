/**
 * Phase 16 — Canonical public-route / discoverability source.
 *
 * This is the SINGLE list of public marketing/content routes that are
 * eligible for sitemap, llms.txt, and other discoverability surfaces.
 *
 * Blog article routes ALWAYS derive from the Phase 15 canonical content
 * loader (`getAllSlugs`). A newly published source-controlled article
 * automatically appears in the sitemap and AI discovery index.
 *
 * PRIVATE / INTERNAL routes are NEVER listed here:
 *   /api/*, /admin/*, /dashboard/*, /profile/*, /auth, /login, /signup,
 *   /forgot-password, /verify-email, /reset-password, /unsubscribe
 *
 * Tests assert that representative private routes are absent from every
 * discoverability surface (privacy/correctness requirement).
 */

import { getAllSlugs, getArticle } from "@/lib/blog/content";
import { absoluteUrl } from "./site-url";

/**
 * Static public marketing/legal routes that truly exist as real pages.
 *
 * Auth pages (/login, /signup, /forgot-password, /verify-email,
 * /reset-password) are deliberately EXCLUDED — they are conversion/auth
 * surfaces, not content, and should not be indexed as canonical content.
 */
export const PUBLIC_MARKETING_ROUTES: readonly string[] = [
  "/",
  "/pricing",
  "/blog",
  "/about",
] as const;

/**
 * Representative private/internal route prefixes that MUST NEVER appear in
 * sitemap, llms.txt, or any discoverability surface. Used by tests.
 */
export const PRIVATE_ROUTE_PREFIXES: readonly string[] = [
  "/api/",
  "/admin/",
  "/dashboard/",
  "/profile/",
] as const;

/**
 * Representative private/auth standalone routes that MUST NEVER appear in
 * discoverability surfaces. Used by tests.
 */
export const PRIVATE_STANDALONE_ROUTES: readonly string[] = [
  "/auth",
  "/login",
  "/signup",
  "/forgot-password",
  "/verify-email",
  "/reset-password",
  "/unsubscribe",
] as const;

/**
 * A public blog article route entry for discoverability surfaces.
 */
export interface PublicBlogRoute {
  /** The article slug (unique across locales). */
  slug: string;
  /** Canonical absolute URL of the article. */
  url: string;
  /** ISO date string for lastModified (updatedAt if present, else publishedAt). */
  lastModified: string;
}

/**
 * Return all canonical blog article routes with absolute URLs + lastModified.
 *
 * Uses the Phase 15 `getAllSlugs()` — the SAME source the article route uses
 * for `generateStaticParams`. The canonical article metadata (for
 * lastModified) is resolved by preferring the English article (the canonical
 * locale that always exists for every slug — the fa index falls back to it).
 */
export function getPublicBlogRoutes(): PublicBlogRoute[] {
  return getAllSlugs().map((slug) => {
    // The English article is canonical (every slug has an en version —
    // the fa index falls back to it). Use its dates for lastModified.
    const article = getArticle(slug, "en") ?? getArticle(slug, "fa");
    const lastModified =
      article?.updatedAt ?? article?.publishedAt ?? new Date().toISOString().slice(0, 10);
    return {
      slug,
      url: absoluteUrl(`/blog/${slug}`),
      lastModified,
    };
  });
}
