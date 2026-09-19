/**
 * Phase 16 — /llms.txt AI discoverability index.
 *
 * A plain-text index for answer engines / AI assistants. Contains a concise
 * factual description plus canonical links to important public resources.
 *
 * URL + link sources derive from the SAME canonical helpers used by sitemap
 * and robots (no duplicate discoverability sources). Blog article links derive
 * from the Phase 15 content loader.
 *
 * NEVER exposes: private routes, admin routes, API secrets, internal docs,
 * engineering worklogs, repository internals, or user/account data.
 *
 * Content-Type is `text/plain; charset=utf-8`.
 */
import { NextResponse } from "next/server";
import { getSiteOrigin, absoluteUrl } from "@/lib/site/site-url";
import {
  PUBLIC_MARKETING_ROUTES,
  getPublicBlogRoutes,
} from "@/lib/site/public-routes";

export const dynamic = "force-static";

export function GET(): NextResponse {
  const lines: string[] = [];

  // Title
  lines.push("# Nixify");
  lines.push("");
  // Concise factual description (no unsupported marketing claims)
  lines.push(
    "> Nixify is an email OTP verification platform. It delivers real one-time-password verification over SMTP and includes plan-based entitlements, webhooks, and email theming. A Free plan is available."
  );
  lines.push("");

  // Canonical public links
  lines.push("## Public pages");
  for (const path of PUBLIC_MARKETING_ROUTES) {
    lines.push(`- [${labelForRoute(path)}](${absoluteUrl(path)})`);
  }
  lines.push("");

  // Blog articles
  const blogRoutes = getPublicBlogRoutes();
  if (blogRoutes.length > 0) {
    lines.push("## Blog articles");
    for (const route of blogRoutes) {
      lines.push(`- [${route.slug}](${route.url})`);
    }
    lines.push("");
  }

  // Canonical site origin
  lines.push(`Canonical site: ${getSiteOrigin()}`);

  const body = lines.join("\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

/** Human-readable label for a static public route in llms.txt. */
function labelForRoute(path: string): string {
  switch (path) {
    case "/":
      return "Nixify — Homepage";
    case "/pricing":
      return "Pricing";
    case "/blog":
      return "Blog";
    case "/about":
      return "About";
    case "/docs":
      return "API Documentation";
    case "/privacy":
      return "Privacy Policy";
    case "/terms":
      return "Terms of Service";
    default:
      return path;
  }
}
