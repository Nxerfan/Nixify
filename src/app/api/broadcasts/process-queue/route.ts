import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processBroadcast } from "@/lib/broadcasts/service";
import { BROADCAST_STATUSES } from "@/lib/broadcasts/constants";
import { verifyCronSecret } from "@/lib/security/cron-auth";
import { logger } from "@/lib/logger";
import { safeErrorRep } from "@/lib/log-sanitizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/broadcasts/process-queue
 *
 * Cron processor for broadcasts. Uses the canonical cron-auth helper shared
 * with /api/webhooks/process-queue.
 *
 *   1. Recover stale processing recipients + abandoned dispatches.
 *   2. Select due approved campaigns (queued or paused_quota or sending).
 *   3. Process each campaign (claim batch, send, finalize).
 *
 * Bounded and serverless-safe — processes a limited number of campaigns per
 * invocation. No sleeps.
 */
export async function POST(req: NextRequest) {
  const auth = verifyCronSecret(req);
  if (!auth.ok) return auth.response;

  try {
    let processed = 0;
    let campaignsProcessed = 0;
    let campaignsCompleted = 0;

    // Select due approved campaigns (queued or paused_quota or sending).
    const campaigns = await db.broadcast.findMany({
      where: {
        status: { in: [BROADCAST_STATUSES.QUEUED, BROADCAST_STATUSES.PAUSED_QUOTA, BROADCAST_STATUSES.SENDING] },
        OR: [
          { scheduledAt: null },
          { scheduledAt: { lte: new Date() } },
        ],
      },
      select: { id: true },
      take: 10, // Bounded per invocation.
    });

    for (const campaign of campaigns) {
      const result = await processBroadcast(campaign.id);
      processed += result.processed;
      campaignsProcessed++;
      if (result.finalized) campaignsCompleted++;
    }

    return NextResponse.json({
      ok: true,
      campaignsProcessed,
      recipientsProcessed: processed,
      campaignsCompleted,
    });
  } catch (err) {
    logger.error("broadcast_queue_processing_failed", {
      component: "broadcast-queue",
      route: "/api/broadcasts/process-queue",
      error: safeErrorRep(err),
    });
    return NextResponse.json(
      { ok: false, error: "Broadcast processing failed" },
      { status: 500 },
    );
  }
}

// GET alias — same canonical CRON_SECRET authentication.
export async function GET(req: NextRequest) {
  return POST(req);
}
