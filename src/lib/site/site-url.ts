/**
 * Phase 16 — Canonical site origin + absolute URL helper.
 *
 * This is the SINGLE source of truth for absolute public URLs used in
 * metadata (metadataBase, canonical, Open Graph, Twitter), robots.txt,
 * sitemap.xml, llms.txt, and JSON-LD structured data.
 *
 * The canonical production origin is `https://nixify.ir`.
 *
 * ─── Why a helper (not scattered literals) ─────────────────────────────────
 *
 * Scattering `https://nixify.ir` literals across robots.ts, sitemap.ts,
 * llms.txt, and metadata would create four independent sources of truth
 * that could drift. Instead, every discoverability surface calls
 * `getSiteOrigin()` / `absoluteUrl(path)` from this one module.
 *
 * ─── localhost / preview leakage prevention ────────────────────────────────
 *
 * `NEXT_PUBLIC_APP_URL` may be set to a localhost or Vercel-preview URL in
 * dev / CI. Those MUST NEVER become the canonical origin in production
 * metadata (a preview URL becoming canonical would hijack search indexing).
 *
 * The helper validates the env value and REJECTS:
 *   - non-https origins (http://localhost, http://...)
 *   - localhost / 127.0.0.1 hostnames
 *   - ALL Vercel deployments (`*.vercel.app`), including the legacy
 *     `nixify.vercel.app` production URL — the canonical origin is now
 *     `nixify.ir`, and the Vercel-app URL is treated as a non-canonical
 *     deployment alias. This guarantees preview deployments (and the legacy
 *     Vercel production URL) never become canonical.
 *
 * If the env value is rejected (or absent), the canonical production origin
 * (`https://nixify.ir`) is returned. This guarantees the canonical URL is
 * ALWAYS the stable production origin, regardless of where the build runs.
 *
 * ─── Preview deployments ───────────────────────────────────────────────────
 *
 * Preview deployments continue to work (they serve the app and can be browsed),
 * but they MUST NEVER become canonical: their URLs are rejected here, so all
 * metadata/sitemap/robots/llms.txt canonical links point to `nixify.ir`
 * regardless of deployment environment.
 */

/** The canonical production origin. Never changes per-environment. */
export const PRODUCTION_ORIGIN = "https://nixify.ir";

/**
 * Validate that a URL string is an acceptable canonical origin.
 *
 * Accepted: https, non-localhost, non-Vercel-deployment.
 * Rejected: all `*.vercel.app` (including the legacy `nixify.vercel.app`),
 * localhost, http, and any URL with a path/query/hash.
 */
function isAcceptableOrigin(raw: string): boolean {
  if (typeof raw !== "string" || raw.trim() === "") return false;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  // Must be https (no http://localhost leakage).
  if (parsed.protocol !== "https:") return false;
  // Reject loopback.
  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
    return false;
  }
  // Reject ALL Vercel deployments (*.vercel.app). The canonical origin is
  // nixify.ir; the legacy nixify.vercel.app and all preview URLs are
  // non-canonical deployment aliases and must never appear as the canonical
  // origin in metadata/sitemap/robots/llms.txt.
  if (parsed.hostname.endsWith(".vercel.app")) {
    return false;
  }
  // Reject if there's a path/query/hash — the origin must be bare.
  if (parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== "") {
    return false;
  }
  return true;
}

/**
 * Resolve the canonical site origin.
 *
 * Post-Roadmap B: the canonical origin is ALWAYS `https://nixify.ir`.
 * Arbitrary `NEXT_PUBLIC_APP_URL` values are NO LONGER accepted as canonical
 * — this guarantees every public canonical/discoverability URL (metadata,
 * sitemap, robots, llms.txt, JSON-LD, docs, README) resolves to nixify.ir
 * regardless of where the build runs. Preview deployments still work (they
 * serve the app) but never become canonical.
 *
 * `NEXT_PUBLIC_APP_URL` is still used by `src/lib/broadcasts/content.ts`
 * for INTERNAL unsubscribe link generation (not canonical discoverability),
 * which is a separate concern.
 *
 * @returns The canonical origin string with NO trailing slash
 *          (always `"https://nixify.ir"`).
 */
export function getSiteOrigin(): string {
  return PRODUCTION_ORIGIN;
}

/**
 * Build an absolute https URL from a path.
 *
 * @param path A site-relative path (e.g. `"/blog"`, `"/blog/welcome-to-nixify"`).
 *             A bare `"/"` produces the site origin with no trailing slash.
 * @returns An absolute URL with NO duplicate slashes and NO trailing slash.
 *          E.g. `"https://nixify.ir/blog"`, `"https://nixify.ir"`.
 */
export function absoluteUrl(path: string): string {
  const origin = getSiteOrigin();
  // Normalize: ensure path starts with "/".
  let normalized = path || "/";
  if (!normalized.startsWith("/")) normalized = "/" + normalized;
  // Collapse duplicate slashes in the path (e.g. "//blog//foo" → "/blog/foo").
  normalized = normalized.replace(/\/{2,}/g, "/");
  // For the root path, return the bare origin (no trailing slash).
  if (normalized === "/") return origin;
  // Strip trailing slash for non-root paths.
  normalized = normalized.replace(/\/+$/, "");
  return origin + normalized;
}
