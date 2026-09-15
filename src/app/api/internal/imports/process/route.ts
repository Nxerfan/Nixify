import { NextResponse } from "next/server";
import { processImports } from "@/lib/imports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/imports/process
 *
 * Bounded contact-import processor. Claims one queued import per
 * invocation, processes a bounded batch of staged rows (100 by default),
 * and finalizes the import when all rows reach a terminal state.
 *
 * Protected by CRON_SECRET. Intended to be called by an external cron
 * service (e.g. cron-job.org, Vercel Cron) every 1-2 minutes. NOT
 * publicly accessible.
 *
 * Bounded:
 *   - One import claimed per invocation (atomic compare-and-swap).
 *   - 100 rows processed per batch (PROCESSOR_BATCH_SIZE).
 *   - Stale-lock recovery: imports stuck in `processing` for more than
 *     IMPORT_STALE_LOCK_TIMEOUT_MS (5 min) are reset to `queued`.
 *   - P2002-safe Contact creation (try-create, on-conflict fetch existing).
 *   - Idempotent group membership (P2002 → skip).
 *
 * Response shape mirrors /api/internal/jobs/process for consistency.
 */
export async function POST(req: Request) {
  // ---- CRON_SECRET verification ----
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "CRON_SECRET not configured on server" },
        { status: 500 },
      );
    }
    console.warn("[import-processor] CRON_SECRET not set — allowing in dev mode.");
  } else {
    const authHeader = req.headers.get("authorization");
    const xCronHeader = req.headers.get("x-cron-secret");
    const provided = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : xCronHeader;
    if (provided !== expected) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
  }

  try {
    const result = await processImports();

    return NextResponse.json({
      success: true,
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
      recovered_stale: result.recovered,
    });
  } catch (err) {
    console.error(
      "[import-processor] error:",
      err instanceof Error ? err.message : "unknown",
    );
    return NextResponse.json(
      { success: false, error: "Processor invocation failed." },
      { status: 500 },
    );
  }
}
