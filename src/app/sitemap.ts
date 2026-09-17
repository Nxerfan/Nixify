/**
 * Phase 16 — sitemap.xml metadata route.
 *
 * Includes ONLY real canonical public pages:
 *   - Static marketing/legal routes (from PUBLIC_MARKETING_ROUTES)
 *   - All published blog article slugs (from the Phase 15 content loader)
 *
 * EXCLUDES (privacy/correctness requirement — tested):
 *   /auth, /login, /signup, /forgot-password, /verify-email, /reset-password
 *   /admin/*, /dashboard/*, /profile/*, /api/*, /unsubscribe
 *
 * Blog URLs derive from `getAllSlugs()` — a newly published source-controlled
 * article automatically appears here. `lastModified` uses the article's
 * `updatedAt` if present, otherwise `publishedAt`.
 *
 * No fabricated change frequencies or priorities (Next.js sitemap supports
 * them but we omit them unless there's a defensible reason).
 */
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site/site-url";
import {
  PUBLIC_MARKETING_ROUTES,
  getPublicBlogRoutes,
} from "@/lib/site/public-routes";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_MARKETING_ROUTES.map(
    (path) => ({
      url: absoluteUrl(path),
      // Static pages have no natural lastModified date in the content model;
      // omit rather than fabricate. Search engines will re-crawl periodically.
    }),
  );

  const blogEntries: MetadataRoute.Sitemap = getPublicBlogRoutes().map(
    (route) => ({
      url: route.url,
      lastModified: route.lastModified,
    }),
  );

  return [...staticEntries, ...blogEntries];
}
