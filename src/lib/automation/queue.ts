/**
 * Durable job queue (Phase 5, sections 3, 14, 15, 16).
 *
 * Database-backed queue for asynchronous post-OTP work. Atomic claiming via
 * conditional updateMany (PostgreSQL-safe). Stale-lock recovery via timeout.
 * Bounded batch processing suitable for Vercel/serverless.
 *
 * Dedupe: (userId, type, dedupeKey) unique constraint. A P2002 on insert means
 * a job with the same dedupe key already exists — the enqueue is a no-op
 * (idempotent). This is the DB-level guarantee, not a findFirst->create race.
 */
import { db } from "@/lib/db";
import { randomUUID } from "crypto";

// ---- Constants ------------------------------------------------------------

/** Jobs older than this in 'processing' state are considered stale (stuck worker). */
export const STALE_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/** Maximum jobs a single processor invocation will claim. */
export const MAX_BATCH_SIZE = 10;

/** Backoff: base delay in ms, doubled per attempt. */
export const BACKOFF_BASE_MS = 5_000; // 5s, 10s, 20s, 40s, 80s

// ---- Types -----------------------------------------------------------------

export type JobType = "otp_verified";
export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface EnqueueInput {
  userId: number;
  type: JobType;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  maxAttempts?: number;
}

export interface QueuedJob {
  id: number;
  jobId: string;
  userId: number;
  type: string;
  status: string;
  payload: unknown;
  dedupeKey: string | null;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  failedAt: Date | null;
}

// ---- Enqueue (idempotent via unique constraint) ----------------------------

/**
 * Enqueue a job. Idempotent: if a job with the same (userId, type, dedupeKey)
 * already exists, the insert hits the unique constraint and this returns the
 * existing job (no duplicate created). This is the DB-level dedupe guarantee.
 */
export async function enqueueJob(input: EnqueueInput): Promise<{ job: QueuedJob; created: boolean }> {
  try {
    const created = await db.jobQueue.create({
      data: {
        jobId: randomUUID(),
        userId: input.userId,
        type: input.type,
        status: "pending",
        payload: input.payload as any,
        dedupeKey: input.dedupeKey ?? null,
        maxAttempts: input.maxAttempts ?? 5,
      },
    });
    return { job: toQueuedJob(created), created: true };
  } catch (e: any) {
    if (e?.code === "P2002") {
      // Duplicate — fetch the existing job. Idempotent enqueue.
      const existing = await db.jobQueue.findFirst({
        where: {
          userId: input.userId,
          type: input.type,
          dedupeKey: input.dedupeKey ?? null,
        },
      });
      if (existing) {
        return { job: toQueuedJob(existing), created: false };
      }
    }
    throw e;
  }
}

// ---- Atomic claim (section 15) --------------------------------------------

/**
 * Claim up to `batchSize` pending jobs atomically.
 *
 * Atomic strategy: for each candidate job, use updateMany with WHERE
 * status='pending' AND availableAt <= NOW() — only one worker can succeed
 * (the one whose updateMany affects 1 row). This is PostgreSQL-safe.
 *
 * Returns the claimed jobs (now in 'processing' state).
 */
export async function claimJobs(
  batchSize: number = MAX_BATCH_SIZE,
  workerId: string = randomUUID(),
): Promise<QueuedJob[]> {
  const limit = Math.min(Math.max(1, batchSize), MAX_BATCH_SIZE);
  const now = new Date();

  // Find candidates (not atomic yet — just candidates).
  const candidates = await db.jobQueue.findMany({
    where: {
      status: "pending",
      availableAt: { lte: now },
    },
    orderBy: { availableAt: "asc" },
    take: limit,
  });

  const claimed: QueuedJob[] = [];
  for (const candidate of candidates) {
    // Atomic claim: only succeeds if the job is still pending.
    // updateMany returns count of affected rows — 1 means we won the claim.
    const result = await db.jobQueue.updateMany({
      where: {
        id: candidate.id,
        status: "pending",
        availableAt: { lte: now },
      },
      data: {
        status: "processing",
        lockedAt: now,
        lockedBy: workerId,
        attempts: { increment: 1 },
      },
    });
    if (result.count === 1) {
      const fresh = await db.jobQueue.findUnique({ where: { id: candidate.id } });
      if (fresh) claimed.push(toQueuedJob(fresh));
    }
    // If count === 0, another worker beat us to it — skip.
  }
  return claimed;
}

// ---- Stale lock recovery (section 16) --------------------------------------

/**
 * Recover stale locks: jobs stuck in 'processing' for longer than the timeout
 * are eligible for retry. They're reset to 'pending' with an updated
 * availableAt (backoff applied). This does NOT immediately reclaim active
 * jobs — only those whose lockedAt is older than the timeout.
 */
export async function recoverStaleLocks(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_LOCK_TIMEOUT_MS);
  // Find stale processing jobs.
  const stale = await db.jobQueue.findMany({
    where: {
      status: "processing",
      lockedAt: { lt: cutoff },
    },
    select: { id: true, attempts: true, maxAttempts: true },
  });

  let recovered = 0;
  for (const job of stale) {
    if (job.attempts >= job.maxAttempts) {
      // Exceeded max attempts — mark as failed permanently.
      await db.jobQueue.updateMany({
        where: { id: job.id, status: "processing" },
        data: {
          status: "failed",
          failedAt: new Date(),
          lastError: "Max attempts exceeded (stale lock recovery)",
        },
      });
    } else {
      // Reset to pending with backoff.
      const backoff = BACKOFF_BASE_MS * Math.pow(2, job.attempts - 1);
      await db.jobQueue.updateMany({
        where: { id: job.id, status: "processing" },
        data: {
          status: "pending",
          lockedAt: null,
          lockedBy: null,
          availableAt: new Date(Date.now() + backoff),
        },
      });
      recovered++;
    }
  }
  return recovered;
}

// ---- Job lifecycle ---------------------------------------------------------

/** Mark a job as completed. */
export async function completeJob(jobId: string): Promise<void> {
  await db.jobQueue.updateMany({
    where: { jobId, status: "processing" },
    data: {
      status: "completed",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
}

/**
 * Mark a job as failed (permanent). Used for non-transient errors where retry
 * would not help (e.g. template missing, incompatible variables, invalid config).
 */
export async function failJob(jobId: string, error: string): Promise<void> {
  await db.jobQueue.updateMany({
    where: { jobId, status: "processing" },
    data: {
      status: "failed",
      failedAt: new Date(),
      lastError: error.slice(0, 500), // safe-length truncation
      lockedAt: null,
      lockedBy: null,
    },
  });
}

/**
 * Retry a job with exponential backoff. Transient failures only.
 * If attempts >= maxAttempts, mark as failed permanently.
 */
export async function retryJob(jobId: string, error: string): Promise<void> {
  const job = await db.jobQueue.findUnique({ where: { jobId } });
  if (!job) return;

  if (job.attempts >= job.maxAttempts) {
    await failJob(jobId, `Max attempts reached. Last error: ${error}`);
    return;
  }

  const backoff = BACKOFF_BASE_MS * Math.pow(2, job.attempts - 1);
  await db.jobQueue.updateMany({
    where: { jobId, status: "processing" },
    data: {
      status: "pending",
      lockedAt: null,
      lockedBy: null,
      availableAt: new Date(Date.now() + backoff),
      lastError: error.slice(0, 500),
    },
  });
}

// ---- Helper ---------------------------------------------------------------

function toQueuedJob(j: {
  id: number; jobId: string; userId: number; type: string; status: string;
  payload: unknown; dedupeKey: string | null; attempts: number; maxAttempts: number;
  availableAt: Date; lockedAt: Date | null; lockedBy: string | null;
  lastError: string | null; createdAt: Date; updatedAt: Date;
  completedAt: Date | null; failedAt: Date | null;
}): QueuedJob {
  return {
    id: j.id, jobId: j.jobId, userId: j.userId, type: j.type, status: j.status,
    payload: j.payload, dedupeKey: j.dedupeKey, attempts: j.attempts,
    maxAttempts: j.maxAttempts, availableAt: j.availableAt, lockedAt: j.lockedAt,
    lockedBy: j.lockedBy, lastError: j.lastError, createdAt: j.createdAt,
    updatedAt: j.updatedAt, completedAt: j.completedAt, failedAt: j.failedAt,
  };
}

// ---- Error classification (section 13) ------------------------------------

/**
 * Classify an error as transient (retry) or permanent (fail).
 * Transient: provider errors, DB connectivity, temporary processing failures.
 * Permanent: template missing, incompatible variables, feature not available,
 *            invalid automation configuration.
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Permanent failures — configuration issues, not transient.
    if (msg.includes("template_not_found")) return false;
    if (msg.includes("missing_template_variables")) return false;
    if (msg.includes("feature_not_available")) return false;
    if (msg.includes("invalid_subject")) return false;
    if (msg.includes("validation_failed")) return false;
    if (msg.includes("configuration_error")) return false;
    if (msg.includes("automation configuration invalid")) return false;
    // Everything else is transient (provider_error, DB errors, network).
    return true;
  }
  return true; // unknown errors default to transient (retry)
}
