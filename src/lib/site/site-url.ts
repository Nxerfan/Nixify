/**
 * Phase 16 — Canonical site origin + absolute URL helper.
 *
 * This is the SINGLE source of truth for absolute public URLs used in
 * metadata (metadataBase, canonical, Open Graph, Twitter), robots.txt,
 * sitemap.xml, llms.txt, and JSON-LD structured data.
 *
 * The canonical production origin is `https://nixify.vercel.app`.
 *
 * ─── Why a helper (not scattered literals) ─────────────────────────────────
 *
 * Scattering `https://nixify.vercel.app` literals across robots.ts,
 * sitemap.ts, llms.txt, and metadata would create four independent sources
 * of truth that could drift. Instead, every discoverability surface calls
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
 *   - Vercel preview deployments (`*.vercel.app` EXCEPT the canonical
 *     `nixify.vercel.app`)
 *
 * If the env value is rejected (or absent), the canonical production origin
 * is returned. This guarantees the canonical URL is ALWAYS the stable
 * production origin, regardless of where the build runs.
 */

/** The canonical production origin. Never changes per-environment. */
export const PRODUCTION_ORIGIN = "https://nixify.vercel.app";

/**
 * Validate that a URL string is an acceptable canonical origin.
 *
 * Accepted: https, non-localhost, non-Vercel-preview (unless it IS the
 * canonical nixify.vercel.app).
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
  // Reject Vercel preview deployments (*.vercel.app except the canonical).
  if (
    parsed.hostname.endsWith(".vercel.app") &&
    parsed.hostname !== "nixify.vercel.app"
  ) {
    return false;
  }
  // Reject if there's a path/query/hash — the origin must be bare.
  if (parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== "") {
    return false;
  }
  return true;
}

/**
 * Resolve the canonical site origin for the current environment.
 *
 * Uses `NEXT_PUBLIC_APP_URL` if it is an acceptable https production origin;
 * otherwise falls back to `PRODUCTION_ORIGIN` (`https://nixify.vercel.app`).
 *
 * @returns A bare origin string with NO trailing slash
 *          (e.g. `"https://nixify.vercel.app"`).
 */
export function getSiteOrigin(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env && isAcceptableOrigin(env)) {
    return env.replace(/\/+$/, "");
  }
  return PRODUCTION_ORIGIN;
}

/**
 * Build an absolute https URL from a path.
 *
 * @param path A site-relative path (e.g. `"/blog"`, `"/blog/welcome-to-nixify"`).
 *             A bare `"/"` produces the site origin with no trailing slash.
 * @returns An absolute URL with NO duplicate slashes and NO trailing slash.
 *          E.g. `"https://nixify.vercel.app/blog"`, `"https://nixify.vercel.app"`.
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
