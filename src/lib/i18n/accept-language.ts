/**
 * Phase 12 — Accept-Language header parser.
 *
 * Deterministic parser honoring q-values. No regex on the whole string — we
 * split the header on commas, then for each entry split on `;`, then read the
 * `q=` parameter if present. This is the algorithm RFC 7231 §5.3.4 describes.
 *
 * Examples:
 *   "fa"                     → ["fa"]
 *   "fa-IR"                  → ["fa"]
 *   "fa;q=0.8,en;q=0.9"      → ["en", "fa"]  (higher q first)
 *   "en-US,en;q=0.9"         → ["en"]        (both normalize to "en", dedup)
 *   "de"                     → []            (unsupported)
 *   null / ""                → []
 *
 * The returned list contains ONLY canonical supported locales (`en` / `fa`),
 * in descending q-value order. Unsupported entries are skipped.
 *
 * IMPORTANT: This is a HINT, not a decision. The canonical server-side resolver
 * (`resolve.ts`) decides which signal wins. Accept-Language is the
 * second-lowest priority signal (just above the `en` fallback) — it NEVER
 * overrides an explicit user choice, URL param, cookie, or Geo hint.
 */

import type { Locale } from "./locales";

interface ParsedEntry {
  locale: Locale;
  q: number;
}

/**
 * Parse a single Accept-Language entry like `"fa-IR;q=0.8"` into a normalized
 * `Locale` + q-value. Returns `null` if the entry's PRIMARY subtag is not a
 * supported locale (e.g. `de`, `fr`, `ar` are NOT supported — we skip them
 * entirely, NOT normalize them to `en`).
 *
 * q-value defaults to 1.0 when absent (per RFC 7231). q-values are clamped to
 * [0, 1]. q=0 entries are explicitly excluded (the client said "I do NOT
 * want this locale") — they are skipped.
 */
function parseEntry(raw: string): ParsedEntry | null {
  const parts = raw.split(";");
  const tagPart = parts[0]?.trim() ?? "";
  if (!tagPart) return null;

  // Extract the PRIMARY subtag (before the first `-` or `_`) and check it
  // against the supported list. We do NOT call normalizeLocale here because
  // normalizeLocale would silently convert an unsupported locale like "de"
  // into the default "en" — that would let `Accept-Language: de` falsely
  // resolve to "en" via the accept_language source. We want it skipped.
  const primary = tagPart.split(/[-_]/)[0]?.toLowerCase() ?? "";
  if (primary !== "en" && primary !== "fa") return null;
  const locale: Locale = primary === "fa" ? "fa" : "en";

  // Read q= parameter if present.
  let q = 1.0;
  for (let i = 1; i < parts.length; i++) {
    const param = parts[i]?.trim() ?? "";
    if (!param) continue;
    const eq = param.indexOf("=");
    if (eq < 0) continue;
    const key = param.slice(0, eq).trim().toLowerCase();
    const value = param.slice(eq + 1).trim();
    if (key === "q") {
      const parsed = Number.parseFloat(value);
      if (!Number.isNaN(parsed)) {
        // Clamp to [0, 1].
        q = Math.min(1, Math.max(0, parsed));
      }
    }
  }

  // q=0 means the client explicitly does NOT want this locale. Skip it.
  if (q <= 0) return null;
  return { locale, q };
}

/**
 * Parse an Accept-Language header into a list of supported locales in
 * descending q-value order. Stable sort: entries with equal q-value keep
 * their original left-to-right order from the header.
 *
 * Returns `[]` for null/empty/unsupported headers.
 */
export function parseAcceptLanguage(header: string | null): Locale[] {
  if (!header) return [];
  const trimmed = header.trim();
  if (!trimmed) return [];

  const entries: ParsedEntry[] = [];
  const seen = new Set<Locale>();

  for (const raw of trimmed.split(",")) {
    const parsed = parseEntry(raw);
    if (!parsed) continue;
    // Dedup: keep the FIRST occurrence (highest q, because we sort stable below
    // and the original header is in descending client preference order).
    if (seen.has(parsed.locale)) continue;
    seen.add(parsed.locale);
    entries.push(parsed);
  }

  // Stable sort by descending q. Array.prototype.sort is stable in modern V8
  // (Node 12+); we still pass an explicit comparator that returns 0 on ties to
  // preserve original order.
  entries.sort((a, b) => b.q - a.q);

  return entries.map((e) => e.locale);
}
