import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processBroadcast } from "@/lib/broadcasts/service";
import { BROADCAST_STATUSES } from "@/lib/broadcasts/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron processor for broadcasts.
 *
 * Verifies CRON_SECRET, then:
 *   1. Recover stale recipient claims.
 *   2. Select due approved campaigns (queued or paused_quota or sending).
 *   3. Process each campaign (claim batch, send, finalize).
 *
 * Bounded and serverless-safe — processes a limited number of campaigns per
 * invocation. No sleeps.
 */
export async function POST(req: NextRequest) {
  const authErr = verifyCronSecret(req);
  if (authErr) return authErr;

  let processed = 0;
  let campaignsProcessed = 0;
  let campaignsCompleted = 0;

  // Select due approved campaigns (queued or paused_quota or sending).
  // Don't process future-scheduled broadcasts.
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
    if (result.processed === 0) campaignsCompleted++;
  }

  return NextResponse.json({
    ok: true,
    campaignsProcessed,
    recipientsProcessed: processed,
    campaignsCompleted,
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}

function verifyCronSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: { code: "internal_error", message: "CRON_SECRET not configured." } }, { status: 500 });
    }
    // Dev escape hatch.
    return null;
  }
  const authHeader = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");
  const provided = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : headerSecret;
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Invalid cron secret." } }, { status: 401 });
  }
  return null;
}
