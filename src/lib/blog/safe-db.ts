/**
 * Phase 18 — graceful DB degradation helper.
 *
 * Blog homepage sections (Most Viewed, Most Discussed, view counts, comment
 * counts) depend on the DB. During `next build` (no DATABASE_URL) or in
 * environments where the DB is unreachable, these calls would throw and break
 * the whole page. This helper wraps DB calls so they return a safe fallback
 * (empty array / 0 / empty Map) on any error, and logs the failure once.
 *
 * This keeps the blog homepage rendering even when metrics are unavailable —
 * the editorial sections (featured, latest, categories, tags, authors) are
 * source-controlled and always render.
 */
import { db } from "@/lib/db";

let warned = false;

/**
 * Run a DB-backed function and return `fallback` on any error.
 *
 * @param fn     The async function that uses `db`.
 * @param fallback The value to return if `fn` throws.
 */
export async function safeDb<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!warned) {
      warned = true;
      console.warn(
        "[blog] DB-backed metrics unavailable — falling back to empty. " +
          "Subsequent failures are silent. Cause:",
        err instanceof Error ? err.message : String(err).slice(0, 200),
      );
    }
    return fallback;
  }
}

/** Reset the warn flag — used by tests to isolate scenarios. */
export function resetSafeDbWarned(): void {
  warned = false;
}

export { db };
