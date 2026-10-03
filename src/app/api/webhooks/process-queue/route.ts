import { NextResponse } from "next/server";
import { processWebhookQueue } from "@/lib/dx/webhooks";
import { verifyCronSecret } from "@/lib/security/cron-auth";
import { logger } from "@/lib/logger";
import { safeErrorRep } from "@/lib/log-sanitizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/process-queue
 *
 * Processes pending webhook delivery retries from the WebhookQueue table.
 * Intended to be called by an external cron service (cron-job.org) every
 * 1 minute — Vercel Cron is NOT used.
 *
 * Authentication: shared secret in `CRON_SECRET`. Accepts EITHER:
 *   - `Authorization: Bearer <CRON_SECRET>`, OR
 *   - `x-cron-secret: <CRON_SECRET>`
 *
 * Uses the canonical cron-auth helper (src/lib/security/cron-auth.ts) shared
 * with /api/broadcasts/process-queue. Production fails closed if CRON_SECRET
 * is missing/placeholder. Development allows without secret.
 */
export async function POST(req: Request) {
  const auth = verifyCronSecret(req);
  if (!auth.ok) return auth.response;

  try {
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
    logger.error("webhook_queue_processing_failed", {
      component: "webhook-queue",
      route: "/api/webhooks/process-queue",
      error: safeErrorRep(err),
    });
    return NextResponse.json(
      { success: false, error: "Queue processing failed" },
      { status: 500 },
    );
  }
}

// GET alias for external cron services that send GET by default.
// Uses the same canonical CRON_SECRET authentication as POST.
export async function GET(req: Request) {
  return POST(req);
}
