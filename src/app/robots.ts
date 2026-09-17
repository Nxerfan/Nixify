/**
 * Phase 16 — robots.txt metadata route.
 *
 * Conservative crawl policy:
 *   - Public marketing/content pages are crawlable.
 *   - Private/internal surfaces are EXCLUDED from crawling:
 *       /api/*             (machine-to-machine)
 *       /admin/*           (admin dashboard — isolated)
 *       /dashboard/*       (user account — private)
 *       /profile/*         (user account — private)
 *       /auth, /login, /signup, /forgot-password, /verify-email,
 *       /reset-password    (auth surfaces — not content)
 *       /unsubscribe       (machine token endpoint)
 *
 * The `allow: "/"` permits crawling of all public paths; the `disallow`
 * entries exclude the private surfaces above. Assets required for rendering
 * public pages (/_next/*, /logo.svg) are NOT disallowed.
 *
 * Sitemap points to the canonical production origin.
 */
import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteOrigin } from "@/lib/site/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard/",
          "/profile/",
          "/auth",
          "/login",
          "/signup",
          "/forgot-password",
          "/verify-email",
          "/reset-password",
          "/unsubscribe",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: getSiteOrigin(),
  };
}
