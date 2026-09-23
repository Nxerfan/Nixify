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
 * OAI-SearchBot (ChatGPT Search crawler) is explicitly allowed with the SAME
 * disallow list as the wildcard rule. This makes the site eligible for
 * discovery in ChatGPT Search results. See:
 *   https://developers.openai.com/api/docs/bots
 *
 * Sitemap points to the canonical production origin.
 */
import type { MetadataRoute } from "next";
import { absoluteUrl, getSiteOrigin } from "@/lib/site/site-url";

/** Private/internal disallow paths shared by ALL user-agents. */
const DISALLOWED_PATHS = [
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
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
      {
        // OAI-SearchBot — ChatGPT Search crawler.
        // Explicitly allowed so the site is eligible for ChatGPT Search
        // discovery. Same disallow list as the wildcard rule — no private
        // surfaces are exposed.
        // Reference: https://developers.openai.com/api/docs/bots
        userAgent: "OAI-SearchBot",
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: getSiteOrigin(),
  };
}
