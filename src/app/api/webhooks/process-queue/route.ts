import { NextResponse } from "next/server";
import { processWebhookQueue } from "@/lib/dx/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/process-queue
 *
 * Processes pending webhook delivery retries from the WebhookQueue table.
 * Intended to be called by Vercel Cron every 1 minute:
 *
 *   vercel.json:
 *   {
 *     "crons": [{ "path": "/api/webhooks/process-queue", "schedule": "* * * * *" }]
 *   }
 *
 * Can also be called manually (e.g., by an admin) to force-process.
 * Protected by CRON_SECRET shared-secret authentication. The caller must
 * provide the secret in the X-Cron-Secret header (or Authorization header
 * as a fallback). Vercel Cron jobs can be configured with request headers
 * via the "headers" field in vercel.json.
 */

/** Verify the CRON_SECRET from the request headers. */
function verifyCronSecret(
  req: Request,
): { ok: true } | { ok: false; response: NextResponse } {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "CRON_SECRET not configured on server" },
        { status: 500 },
      ),
    };
  }
  const provided =
    req.headers.get("x-cron-secret") ?? req.headers.get("authorization") ?? "";
  if (provided !== expected) {
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

export async function POST(req: Request) {
  const auth = verifyCronSecret(req);
  if (!auth.ok) return auth.response;

  try {
    const result = await processWebhookQueue();
    return NextResponse.json({
      success: true,
      ...result,
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
