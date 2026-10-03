/**
 * Canonical cron authentication — the ONE shared helper for all production
 * scheduled-worker routes. Used by:
 *   - /api/webhooks/process-queue
 *   - /api/broadcasts/process-queue
 *
 * ─── Fail-closed secret ─────────────────────────────────────────────────────
 *
 * Production must reject requests if `CRON_SECRET` is:
 *   - missing (undefined);
 *   - empty/whitespace;
 *   - a known repository placeholder (`replace-with-32-char-hex-string`).
 *
 * Development (NODE_ENV !== "production") may preserve a no-secret convenience.
 *
 * ─── Credential inputs ─────────────────────────────────────────────────────
 *
 * Accepts EITHER:
 *   - `Authorization: Bearer <CRON_SECRET>`
 *   - `x-cron-secret: <CRON_SECRET>`
 *
 * Uses constant-time comparison. Never logs the secret, the supplied value,
 * or the Authorization header.
 *
 * ─── Error responses ──────────────────────────────────────────────────────
 *
 * Unauthorized → HTTP 401 (generic, no indication of which credential failed).
 * Missing/invalid production config → HTTP 500 (bounded internal config error).
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { safeErrorRep } from "@/lib/log-sanitizer";

/** Known placeholder/insecure CRON_SECRET values that MUST be rejected in production. */
const KNOWN_PLACEHOLDER_SECRETS: readonly string[] = [
  "replace-with-32-char-hex-string",
  "replace-with-different-32-char-hex-string",
  "xxx",
  "change-me",
  "changeme",
];

/** Result of a cron-auth check. */
export type CronAuthResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

/**
 * Verify the CRON_SECRET for a production scheduled-worker request.
 * Returns `{ ok: true }` if authorized, or `{ ok: false, response }` with
 * the appropriate HTTP error response.
 */
export function verifyCronSecret(req: Request): CronAuthResult {
  const expected = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  // Check for missing/empty/placeholder secret.
  if (!expected || expected.trim() === "" || KNOWN_PLACEHOLDER_SECRETS.includes(expected.trim())) {
    if (isProduction) {
      // Fail closed — production requires a valid secret.
      logger.error("cron_secret_not_configured", {
        component: "cron-auth",
        diagnostic: expected ? "placeholder_secret" : "missing_secret",
      });
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: "Server configuration error" },
          { status: 500 },
        ),
      };
    }
    // Dev escape hatch — allow without secret in development.
    return { ok: true };
  }

  // Extract the supplied secret from either supported header.
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearerToken = bearerMatch ? bearerMatch[1].trim() : "";
  const customHeader = req.headers.get("x-cron-secret") ?? "";
  const provided = bearerToken || customHeader;

  // Constant-time comparison.
  if (
    provided.length !== expected.length ||
    !timingSafeEqualString(provided, expected)
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  return { ok: true };
}

/** Constant-time string comparison (safe for ASCII secrets). */
function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
