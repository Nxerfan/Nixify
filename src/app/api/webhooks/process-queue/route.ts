import { NextResponse } from "next/server";
import { processWebhookQueue } from "@/lib/dx/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/process-queue
 *
 * Processes pending webhook delivery retries from the WebhookQueue table.
 * Intended to be called by an external cron service (cron-job.org) every
 * 1 minute — Vercel Cron is no longer used (see commit 55ffd54).
 *
 * Authentication: shared secret in `CRON_SECRET`. Accepts EITHER:
 *   - `Authorization: Bearer <CRON_SECRET>` (Vercel Cron format), OR
 *   - `x-cron-secret: <CRON_SECRET>` (custom header for cron-job.org)
 *
 * When `CRON_SECRET` is NOT set in the environment, the endpoint logs a warning
 * but still allows the request — this is for local dev where secrets aren't
 * configured. In production, ALWAYS set `CRON_SECRET`.
 */

/** Verify the CRON_SECRET from the request headers. */
function verifyCronSecret(
  req: Request,
): { ok: true } | { ok: false; response: NextResponse } {
  const expected = process.env.CRON_SECRET;

  // Dev escape hatch: if CRON_SECRET is not set, log + allow. This is a
  // deliberate local-dev convenience — in production, the env var MUST be set.
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[webhook-queue] CRON_SECRET is not set — refusing request in production.",
      );
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: "CRON_SECRET not configured on server" },
          { status: 500 },
        ),
      };
    }
    console.warn(
      "[webhook-queue] CRON_SECRET is not set — allowing request (dev mode).",
    );
    return { ok: true };
  }

  // Accept either: Authorization: Bearer <secret> OR x-cron-secret: <secret>
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearerToken = bearerMatch ? bearerMatch[1].trim() : "";
  const customHeader = req.headers.get("x-cron-secret") ?? "";

  // Constant-time comparison to prevent timing attacks on the secret.
  const provided = bearerToken || customHeader;
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

export async function POST(req: Request) {
  const auth = verifyCronSecret(req);
  if (!auth.ok) return auth.response;

  try {
    // Phase 7: processWebhookQueue() returns the full worker-metrics shape:
    //   processed — total jobs attempted in this batch (claimed + processed)
    //   delivered — jobs that succeeded (HTTP 2xx response)
    //   failed — jobs that exhausted retries (terminal failure)
    //   retried — jobs scheduled for a retry after backoff
    //   recovered — stale locks reclaimed (workers that died after claiming)
    // We surface all fields explicitly so the cron monitor + alerts can
    // distinguish "no work" from "all failures" from "all retries".
    const result = await processWebhookQueue();
    return NextResponse.json({
      success: true,
      processed: result.processed,
      delivered: result.delivered,
      failed: result.failed,
      retried: result.retried,
      recovered: result.recovered,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      "[webhook-queue] processing failed:",
      err instanceof Error ? err.message : "unknown",
    );
    return NextResponse.json(
      { success: false, error: "Queue processing failed" },
      { status: 500 },
    );
  }
}

// Also support GET for Vercel Cron (which sends GET by default).
export async function GET(req: Request) {
  return POST(req);
}
