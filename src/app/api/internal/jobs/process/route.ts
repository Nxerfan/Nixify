import { NextResponse } from "next/server";
import { claimJobs, recoverStaleLocks, type QueuedJob } from "@/lib/automation";
import { processOtpVerifiedJob } from "@/lib/automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/jobs/process
 *
 * Bounded job queue processor for Phase 5 automation. Processes pending
 * otp_verified jobs: Contact upsert → ContactEvent → welcome email send.
 *
 * Protected by CRON_SECRET. Intended to be called by an external cron service
 * (e.g. cron-job.org) every 1-2 minutes. NOT publicly accessible.
 *
 * Bounded: max 10 jobs per invocation, stale-lock recovery, no double execution.
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
    console.warn("[job-processor] CRON_SECRET not set — allowing in dev mode.");
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

  // ---- Recover stale locks first ----
  const recovered = await recoverStaleLocks();

  // ---- Claim + process a bounded batch ----
  const jobs = await claimJobs(10);
  const results: { jobId: string; status: string; error?: string }[] = [];

  for (const job of jobs) {
    try {
      if (job.type === "otp_verified") {
        await processOtpVerifiedJob(job as QueuedJob);
        results.push({ jobId: job.jobId, status: "processed" });
      } else {
        // Unknown job type — mark as failed permanently.
        results.push({ jobId: job.jobId, status: "unknown_type", error: job.type });
      }
    } catch (err) {
      // Catch-all: if the processor throws unexpectedly, retry (transient).
      results.push({
        jobId: job.jobId,
        status: "error",
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return NextResponse.json({
    success: true,
    recovered_stale: recovered,
    processed: results.length,
    results,
  });
}
