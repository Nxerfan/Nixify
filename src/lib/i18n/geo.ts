/**
 * Phase 12 — Trusted Geo hint (Iran → Persian locale).
 *
 * FIRST-VISIT HINT ONLY.
 *
 * This function inspects ONLY the canonical Vercel platform header
 * `x-vercel-ip-country` for a country code. It returns `true` if the country
 * is `IR` (Iran), suggesting the visitor may prefer the Persian locale.
 *
 * SECURITY INVARIANTS (do not break these):
 *   1. NEVER trusts a browser-supplied country field, query param, body
 *      field, or any header that the client can forge (e.g. `X-Forwarded-...`
 *      is NOT trusted unless it is the canonical Vercel header set by the
 *      platform itself).
 *   2. NEVER persists the raw IP address to any DB column, log, or cache.
 *   3. NEVER logs the raw IP address (not even to debug logs).
 *   4. Returns `false` when the header is absent — this is the case in
 *      development, in non-Vercel deployments, and for any request that did
 *      not traverse the Vercel edge. We fail closed toward `en` rather than
 *      guessing.
 *   5. The Geo hint is the LOWEST-priority signal that can主动选择a locale.
 *      It NEVER overrides:
 *        - an authenticated user's `preferredLocale`,
 *        - an explicit `?locale=fa` URL param,
 *        - an explicit `mg_locale` cookie,
 *      See `resolve.ts` for the exact precedence order. Geo only wins when
 *      all higher-priority signals are absent.
 */

import type { Locale } from "./locales";

/**
 * Read the trusted Vercel geo-country hint. Returns `true` if the visitor's
 * country (as observed by Vercel's edge) is Iran (`IR`).
 *
 * The return value is intentionally a boolean rather than a `Locale` so that
 * the caller (`resolve.ts`) does not accidentally leak this signal into other
 * countries. We only support one geo→locale mapping today: IR → fa. Any
 * future mapping must be added explicitly here.
 */
export function getGeoPersianHint(req: Request): boolean {
  const country = req.headers.get("x-vercel-ip-country");
  if (!country) return false;
  // Vercel uses ISO 3166-1 alpha-2 codes, uppercase.
  return country.toUpperCase() === "IR";
}

/**
 * Resolve the geo hint to a locale, or `null` if no hint is available.
 * Convenience wrapper used by `resolve.ts`.
 */
export function getGeoLocale(req: Request): Locale | null {
  return getGeoPersianHint(req) ? "fa" : null;
}
