import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  enqueueJob,
  claimJobs,
  recoverStaleLocks,
  completeJob,
  failJob,
  retryJob,
  isTransientError,
  STALE_LOCK_TIMEOUT_MS,
  MAX_BATCH_SIZE,
  BACKOFF_BASE_MS,
  type QueuedJob,
} from "@/lib/automation/queue";

/**
 * Automation Job Queue — DB integration tests (Phase 5, sections 3, 14, 15,
 * 16, 13).
 *
 * This file is GATED — only runs when RUN_AUTOMATION_INTEGRATION=1 AND a
 * TEST_DATABASE_URL is supplied. The (future) `test:automation` script will
 * set both. Generic `bun run test` skips this file silently (no DB
 * available). Mirrors the gate pattern of
 * src/lib/transactional-templates/service.test.ts (RUN_TEMPLATE_INTEGRATION)
 * and src/lib/messaging/service.test.ts (RUN_MESSAGING_INTEGRATION).
 *
 * Coverage (per task spec):
 * - enqueueJob creates a pending job with correct fields
 * - enqueueJob with same dedupeKey → idempotent (created=false, returns
 *   existing, no duplicate row)
 * - enqueueJob with different dedupeKey → creates new job
 * - enqueueJob default maxAttempts = 5; explicit override honored
 * - claimJobs: claims pending jobs, marks processing, sets lockedAt+lockedBy,
 *   increments attempts
 * - claimJobs atomic under concurrent workers (no double execution)
 * - claimJobs respects availableAt (future-availableAt jobs not claimed)
 * - claimJobs does not claim completed/failed/processing jobs
 * - claimJobs bounded batch size (claimJobs(5) on 10 jobs → ≤5 claimed)
 * - claimJobs clamps batchSize to MAX_BATCH_SIZE
 * - completeJob marks completed, clears lock
 * - failJob marks failed permanently, sets failedAt + lastError, clears lock
 * - failJob truncates lastError to 500 chars
 * - retryJob increments attempts? NO — claimJobs increments attempts; retryJob
 *   only resets to pending with backoff
 * - retryJob when attempts >= maxAttempts → marks as failed (not retried)
 * - recoverStaleLocks: stale processing job → reset to pending with backoff
 * - recoverStaleLocks: active (recent) processing jobs NOT touched
 * - recoverStaleLocks: stale job with attempts >= maxAttempts → failed
 * - isTransientError: permanent vs transient classification
 * - dedupe constraint works concurrently: Promise.all of 2 enqueues with
 *   same dedupeKey → only 1 job created
 */

// Gate: skip silently when RUN_AUTOMATION_INTEGRATION is not set (generic runs).
const RUN = process.env.RUN_AUTOMATION_INTEGRATION === "1";

describe.skipIf(!RUN)("Automation Job Queue — DB integration", () => {
  let userA: number;
  let userB: number;
  let setupComplete = false;

  beforeAll(async () => {
    // Verify DB connectivity.
    await db.$queryRaw`SELECT 1`;

    // Clean up any leftover test data from previous runs.
    await db.jobQueue.deleteMany({
      where: { user: { email: { contains: "queue-test-" } } },
    });
    await db.user.deleteMany({
      where: { email: { contains: "queue-test-" } },
    });

    // Create two test users with plan="PRO" so the AUTOMATIONS entitlement
    // gate passes at the route layer (these fixtures can be reused later).
    const a = await db.user.create({
      data: {
        email: "queue-test-a@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userA = a.id;

    const b = await db.user.create({
      data: {
        email: "queue-test-b@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userB = b.id;

    setupComplete = true;
  });

  beforeEach(async () => {
    if (!setupComplete) return;
    // Clean JobQueue between tests so dedupe keys + counts don't bleed.
    await db.jobQueue.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
  });

  afterAll(async () => {
    if (!setupComplete) {
      await db.$disconnect();
      return;
    }
    await db.jobQueue.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await db.$disconnect();
  });

  // ---- Helpers -----------------------------------------------------------

  /** Make a unique dedupe key per test to avoid cross-test collision. */
  let keyCounter = 0;
  function uniqueKey(prefix: string): string {
    keyCounter += 1;
    return `${prefix}-${keyCounter}-${Date.now()}`;
  }

  /** Build a payload matching the OtpVerified shape. */
  function samplePayload(otpCodeId: number): Record<string, unknown> {
    return {
      otpCodeId,
      userId: userA,
      email: `recipient+${otpCodeId}@example.com`,
      environment: "production",
      purpose: "signup",
    };
  }

  // ---- enqueueJob -------------------------------------------------------

  it("enqueueJob creates a pending job with correct fields (status=pending, attempts=0, maxAttempts=5 default)", async () => {
    const dedupe = uniqueKey("create");
    const { job, created } = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(1001),
      dedupeKey: dedupe,
    });

    expect(created).toBe(true);
    expect(job.id).toBeGreaterThan(0);
    expect(job.jobId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(job.userId).toBe(userA);
    expect(job.type).toBe("otp_verified");
    expect(job.status).toBe("pending");
    expect(job.payload).toMatchObject({ otpCodeId: 1001 });
    expect(job.dedupeKey).toBe(dedupe);
    expect(job.attempts).toBe(0);
    expect(job.maxAttempts).toBe(5); // default
    expect(job.availableAt).toBeInstanceOf(Date);
    expect(job.availableAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(job.lockedAt).toBeNull();
    expect(job.lockedBy).toBeNull();
    expect(job.lastError).toBeNull();
    expect(job.completedAt).toBeNull();
    expect(job.failedAt).toBeNull();
    expect(job.createdAt).toBeInstanceOf(Date);
    expect(job.updatedAt).toBeInstanceOf(Date);
  });

  it("enqueueJob honors explicit maxAttempts override", async () => {
    const { job } = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(1002),
      dedupeKey: uniqueKey("max"),
      maxAttempts: 12,
    });
    expect(job.maxAttempts).toBe(12);
  });

  it("enqueueJob allows null dedupeKey (no dedupe)", async () => {
    // Two enqueues with NO dedupeKey both create distinct jobs.
    const r1 = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(1003),
      // dedupeKey omitted
    });
    const r2 = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(1004),
      // dedupeKey omitted
    });
    expect(r1.created).toBe(true);
    expect(r2.created).toBe(true);
    expect(r1.job.jobId).not.toBe(r2.job.jobId);
    expect(r1.job.dedupeKey).toBeNull();
    expect(r2.job.dedupeKey).toBeNull();
  });

  it("enqueueJob with same dedupeKey → idempotent (created=false, returns existing job, no duplicate row)", async () => {
    const dedupe = uniqueKey("idem");
    const r1 = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(1010),
      dedupeKey: dedupe,
    });
    const r2 = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(1010),
      dedupeKey: dedupe,
    });

    expect(r1.created).toBe(true);
    expect(r2.created).toBe(false);
    expect(r2.job.jobId).toBe(r1.job.jobId);
    expect(r2.job.id).toBe(r1.job.id);

    // Only one row exists for this dedupeKey.
    const rows = await db.jobQueue.findMany({
      where: { userId: userA, dedupeKey: dedupe },
    });
    expect(rows.length).toBe(1);
  });

  it("enqueueJob with different dedupeKey → creates new job", async () => {
    const r1 = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(1020),
      dedupeKey: uniqueKey("diff-a"),
    });
    const r2 = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(1021),
      dedupeKey: uniqueKey("diff-b"),
    });

    expect(r1.created).toBe(true);
    expect(r2.created).toBe(true);
    expect(r1.job.jobId).not.toBe(r2.job.jobId);
    expect(r1.job.dedupeKey).not.toBe(r2.job.dedupeKey);
  });

  it("dedupe constraint works concurrently: Promise.all of 2 enqueues with same dedupeKey → only 1 job created", async () => {
    const dedupe = uniqueKey("concurrent");
    const [r1, r2] = await Promise.all([
      enqueueJob({
        userId: userA,
        type: "otp_verified",
        payload: samplePayload(1030),
        dedupeKey: dedupe,
      }),
      enqueueJob({
        userId: userA,
        type: "otp_verified",
        payload: samplePayload(1030),
        dedupeKey: dedupe,
      }),
    ]);

    // Exactly one created, the other returns the existing job.
    const createdFlags = [r1.created, r2.created].filter(Boolean);
    expect(createdFlags.length).toBe(1);

    // Both calls return the same jobId.
    expect(r1.job.jobId).toBe(r2.job.jobId);

    // Only one row in the DB.
    const rows = await db.jobQueue.findMany({
      where: { userId: userA, dedupeKey: dedupe },
    });
    expect(rows.length).toBe(1);
  });

  it("dedupe is scoped per user — same dedupeKey for different users creates distinct jobs", async () => {
    const sharedDedupe = uniqueKey("shared-user");
    const r1 = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(1040),
      dedupeKey: sharedDedupe,
    });
    const r2 = await enqueueJob({
      userId: userB,
      type: "otp_verified",
      payload: samplePayload(1041),
      dedupeKey: sharedDedupe,
    });

    expect(r1.created).toBe(true);
    expect(r2.created).toBe(true);
    expect(r1.job.jobId).not.toBe(r2.job.jobId);
    expect(r1.job.userId).toBe(userA);
    expect(r2.job.userId).toBe(userB);
  });

  // ---- claimJobs --------------------------------------------------------

  it("claimJobs claims pending jobs, marks them processing, sets lockedAt + lockedBy, increments attempts", async () => {
    const enq = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(2001),
      dedupeKey: uniqueKey("claim-basic"),
    });

    const workerId = "worker-basic";
    const claimed = await claimJobs(10, workerId);

    // At least our one job should be claimed.
    expect(claimed.length).toBeGreaterThanOrEqual(1);
    const ourJob = claimed.find((j) => j.id === enq.job.id);
    expect(ourJob).toBeDefined();
    expect(ourJob!.status).toBe("processing");
    expect(ourJob!.lockedBy).toBe(workerId);
    expect(ourJob!.lockedAt).toBeInstanceOf(Date);
    expect(ourJob!.attempts).toBe(1); // incremented from 0 → 1

    // Verify the DB row matches.
    const fresh = await db.jobQueue.findUnique({ where: { id: enq.job.id } });
    expect(fresh!.status).toBe("processing");
    expect(fresh!.lockedBy).toBe(workerId);
    expect(fresh!.lockedAt).toBeInstanceOf(Date);
    expect(fresh!.attempts).toBe(1);
  });

  it("claimJobs atomic under concurrent workers — no job is claimed by two workers", async () => {
    // Create N pending jobs.
    const N = 6;
    const created: QueuedJob[] = [];
    for (let i = 0; i < N; i++) {
      const r = await enqueueJob({
        userId: userA,
        type: "otp_verified",
        payload: samplePayload(2100 + i),
        dedupeKey: uniqueKey(`claim-race-${i}`),
      });
      created.push(r.job);
    }

    // Two workers claim concurrently.
    const [claimedBy1, claimedBy2] = await Promise.all([
      claimJobs(N * 2, "worker-race-1"),
      claimJobs(N * 2, "worker-race-2"),
    ]);

    // Combine claimed IDs from both workers.
    const ids1 = claimedBy1.map((j) => j.id);
    const ids2 = claimedBy2.map((j) => j.id);

    // No job should appear in both workers' claimed lists.
    const overlap = ids1.filter((id) => ids2.includes(id));
    expect(overlap).toEqual([]);

    // Together, they should have claimed exactly N of our jobs (none left
    // pending). Other tests' jobs are cleaned in beforeEach, so the only
    // pending jobs at this point are the N we just enqueued.
    const totalClaimed = ids1.length + ids2.length;
    expect(totalClaimed).toBe(N);

    // Every one of our created jobs should be claimed by exactly one worker.
    for (const job of created) {
      const inWorker1 = ids1.includes(job.id);
      const inWorker2 = ids2.includes(job.id);
      expect(inWorker1 || inWorker2).toBe(true);
      expect(inWorker1 && inWorker2).toBe(false);
    }

    // All claimed jobs are now 'processing' with attempts=1.
    for (const j of [...claimedBy1, ...claimedBy2]) {
      const fresh = await db.jobQueue.findUnique({ where: { id: j.id } });
      expect(fresh!.status).toBe("processing");
      expect(fresh!.attempts).toBe(1);
    }
  });

  it("claimJobs respects availableAt — future-availableAt jobs NOT claimed", async () => {
    // Manually create a job with a future availableAt (enqueueJob always uses now()).
    await db.jobQueue.create({
      data: {
        jobId: randomUUID(),
        userId: userA,
        type: "otp_verified",
        status: "pending",
        payload: samplePayload(2200) as any,
        dedupeKey: uniqueKey("future"),
        availableAt: new Date(Date.now() + 60_000), // 1 min in the future
      },
    });

    const claimed = await claimJobs(10, "worker-future");
    const ourJob = claimed.find(
      (j) => j.dedupeKey !== null && j.dedupeKey.startsWith("future-"),
    );
    expect(ourJob).toBeUndefined();

    // The job is still pending in the DB.
    const rows = await db.jobQueue.findMany({
      where: { userId: userA, status: "pending" },
    });
    expect(rows.length).toBe(1);
    expect(rows[0].availableAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("claimJobs does NOT claim completed jobs", async () => {
    const enq = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(2301),
      dedupeKey: uniqueKey("completed"),
    });
    await db.jobQueue.update({
      where: { id: enq.job.id },
      data: { status: "completed", completedAt: new Date() },
    });

    const claimed = await claimJobs(10, "worker-no-completed");
    expect(claimed.find((j) => j.id === enq.job.id)).toBeUndefined();
  });

  it("claimJobs does NOT claim failed jobs", async () => {
    const enq = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(2302),
      dedupeKey: uniqueKey("failed"),
    });
    await db.jobQueue.update({
      where: { id: enq.job.id },
      data: { status: "failed", failedAt: new Date(), lastError: "boom" },
    });

    const claimed = await claimJobs(10, "worker-no-failed");
    expect(claimed.find((j) => j.id === enq.job.id)).toBeUndefined();
  });

  it("claimJobs does NOT claim already-processing jobs", async () => {
    const enq = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(2303),
      dedupeKey: uniqueKey("already-processing"),
    });
    await db.jobQueue.update({
      where: { id: enq.job.id },
      data: {
        status: "processing",
        attempts: 1,
        lockedAt: new Date(),
        lockedBy: "another-worker",
      },
    });

    const claimed = await claimJobs(10, "worker-no-processing");
    expect(claimed.find((j) => j.id === enq.job.id)).toBeUndefined();
  });

  it("claimJobs bounded batch size — claimJobs(5) on 10 jobs claims at most 5", async () => {
    // Enqueue 10 jobs.
    for (let i = 0; i < 10; i++) {
      await enqueueJob({
        userId: userA,
        type: "otp_verified",
        payload: samplePayload(2400 + i),
        dedupeKey: uniqueKey(`batch-${i}`),
      });
    }

    const claimed = await claimJobs(5, "worker-batch");
    expect(claimed.length).toBe(5);

    // The other 5 should remain pending.
    const pending = await db.jobQueue.count({
      where: { userId: userA, status: "pending" },
    });
    expect(pending).toBe(5);
  });

  it("claimJobs clamps batchSize to MAX_BATCH_SIZE when called with a larger number", async () => {
    // Enqueue MAX_BATCH_SIZE + 5 jobs.
    const total = MAX_BATCH_SIZE + 5;
    for (let i = 0; i < total; i++) {
      await enqueueJob({
        userId: userA,
        type: "otp_verified",
        payload: samplePayload(2500 + i),
        dedupeKey: uniqueKey(`clamp-${i}`),
      });
    }

    // Ask for 100 — should clamp to MAX_BATCH_SIZE.
    const claimed = await claimJobs(100, "worker-clamp");
    expect(claimed.length).toBe(MAX_BATCH_SIZE);

    // The rest remain pending.
    const pending = await db.jobQueue.count({
      where: { userId: userA, status: "pending" },
    });
    expect(pending).toBe(5);
  });

  it("claimJobs clamps batchSize to >=1 when called with 0 or negative", async () => {
    await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(2600),
      dedupeKey: uniqueKey("clamp-zero"),
    });

    // batchSize=0 should be clamped to 1, claiming the one pending job.
    const claimed = await claimJobs(0, "worker-clamp-zero");
    expect(claimed.length).toBe(1);
  });

  it("claimJobs returns empty array when no pending jobs exist", async () => {
    // beforeEach cleared the table; no jobs to claim.
    const claimed = await claimJobs(10, "worker-empty");
    expect(claimed).toEqual([]);
  });

  it("claimJobs uses default workerId when none provided", async () => {
    const enq = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(2700),
      dedupeKey: uniqueKey("default-worker"),
    });

    // No workerId argument — should still claim and set a non-null lockedBy.
    const claimed = await claimJobs(10);
    const ourJob = claimed.find((j) => j.id === enq.job.id);
    expect(ourJob).toBeDefined();
    expect(ourJob!.lockedBy).toBeTruthy();
    expect(ourJob!.lockedBy).toHaveLength(36); // UUID
  });

  // ---- completeJob ------------------------------------------------------

  it("completeJob marks completed, sets completedAt, clears lock", async () => {
    const enq = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(3001),
      dedupeKey: uniqueKey("complete"),
    });
    // Simulate a worker claiming it.
    await db.jobQueue.update({
      where: { id: enq.job.id },
      data: {
        status: "processing",
        attempts: 1,
        lockedAt: new Date(),
        lockedBy: "worker-complete",
        lastError: "previous transient error",
      },
    });

    await completeJob(enq.job.jobId);

    const fresh = await db.jobQueue.findUnique({ where: { id: enq.job.id } });
    expect(fresh!.status).toBe("completed");
    expect(fresh!.completedAt).toBeInstanceOf(Date);
    expect(fresh!.lockedAt).toBeNull();
    expect(fresh!.lockedBy).toBeNull();
    expect(fresh!.lastError).toBeNull(); // cleared on success
    expect(fresh!.failedAt).toBeNull();
  });

  it("completeJob is a no-op when the job is not in 'processing' state (already completed)", async () => {
    const enq = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(3002),
      dedupeKey: uniqueKey("complete-noop"),
    });
    // Leave it pending — completeJob only updates 'processing' jobs.
    await completeJob(enq.job.jobId);

    const fresh = await db.jobQueue.findUnique({ where: { id: enq.job.id } });
    expect(fresh!.status).toBe("pending"); // unchanged
    expect(fresh!.completedAt).toBeNull();
  });

  // ---- failJob ----------------------------------------------------------

  it("failJob marks failed permanently, sets failedAt + lastError, clears lock", async () => {
    const enq = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(3101),
      dedupeKey: uniqueKey("fail"),
    });
    await db.jobQueue.update({
      where: { id: enq.job.id },
      data: {
        status: "processing",
        attempts: 1,
        lockedAt: new Date(),
        lockedBy: "worker-fail",
      },
    });

    await failJob(enq.job.jobId, "template_not_found");

    const fresh = await db.jobQueue.findUnique({ where: { id: enq.job.id } });
    expect(fresh!.status).toBe("failed");
    expect(fresh!.failedAt).toBeInstanceOf(Date);
    expect(fresh!.lastError).toBe("template_not_found");
    expect(fresh!.lockedAt).toBeNull();
    expect(fresh!.lockedBy).toBeNull();
    expect(fresh!.completedAt).toBeNull();
  });

  it("failJob truncates lastError to 500 characters", async () => {
    const enq = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(3102),
      dedupeKey: uniqueKey("fail-trunc"),
    });
    await db.jobQueue.update({
      where: { id: enq.job.id },
      data: { status: "processing", attempts: 1, lockedAt: new Date() },
    });

    const longError = "x".repeat(2000);
    await failJob(enq.job.jobId, longError);

    const fresh = await db.jobQueue.findUnique({ where: { id: enq.job.id } });
    expect(fresh!.status).toBe("failed");
    expect(fresh!.lastError!.length).toBe(500);
  });

  // ---- retryJob ---------------------------------------------------------

  it("retryJob resets to pending, clears lock, sets backoff availableAt, stores lastError", async () => {
    const enq = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(3201),
      dedupeKey: uniqueKey("retry"),
      maxAttempts: 5,
    });
    // Simulate first claim (attempts: 0 → 1).
    await db.jobQueue.update({
      where: { id: enq.job.id },
      data: {
        status: "processing",
        attempts: 1,
        lockedAt: new Date(),
        lockedBy: "worker-retry",
      },
    });

    const before = Date.now();
    await retryJob(enq.job.jobId, "transient provider_error");
    const after = Date.now();

    const fresh = await db.jobQueue.findUnique({ where: { id: enq.job.id } });
    expect(fresh!.status).toBe("pending");
    expect(fresh!.attempts).toBe(1); // retryJob does NOT increment attempts; only claimJobs does.
    expect(fresh!.lockedAt).toBeNull();
    expect(fresh!.lockedBy).toBeNull();
    expect(fresh!.lastError).toBe("transient provider_error");
    expect(fresh!.failedAt).toBeNull();
    expect(fresh!.completedAt).toBeNull();

    // Backoff: BACKOFF_BASE_MS * 2^(attempts-1) = 5000 * 2^0 = 5000ms.
    const minAvailable = before + BACKOFF_BASE_MS - 100; // tolerance
    expect(fresh!.availableAt.getTime()).toBeGreaterThan(minAvailable);
    expect(fresh!.availableAt.getTime()).toBeGreaterThan(after);
  });

  it("retryJob exponential backoff doubles per attempt — attempts=3 → backoff = 4×BACKOFF_BASE_MS", async () => {
    const enq = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(3202),
      dedupeKey: uniqueKey("retry-backoff"),
      maxAttempts: 5,
    });
    // Simulate third claim (attempts: 3).
    await db.jobQueue.update({
      where: { id: enq.job.id },
      data: {
        status: "processing",
        attempts: 3,
        lockedAt: new Date(),
        lockedBy: "worker-retry-3",
      },
    });

    const before = Date.now();
    await retryJob(enq.job.jobId, "transient");
    const fresh = await db.jobQueue.findUnique({ where: { id: enq.job.id } });

    // backoff = BACKOFF_BASE_MS * 2^(3-1) = 5000 * 4 = 20000ms.
    const expectedBackoff = BACKOFF_BASE_MS * Math.pow(2, 3 - 1);
    expect(fresh!.availableAt.getTime()).toBeGreaterThanOrEqual(
      before + expectedBackoff - 500,
    );
  });

  it("retryJob when attempts >= maxAttempts → marks as failed (not retried)", async () => {
    const enq = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(3203),
      dedupeKey: uniqueKey("retry-max"),
      maxAttempts: 3,
    });
    // Simulate third claim, attempts=3, maxAttempts=3.
    await db.jobQueue.update({
      where: { id: enq.job.id },
      data: {
        status: "processing",
        attempts: 3,
        maxAttempts: 3,
        lockedAt: new Date(),
        lockedBy: "worker-retry-max",
      },
    });

    await retryJob(enq.job.jobId, "transient");

    const fresh = await db.jobQueue.findUnique({ where: { id: enq.job.id } });
    expect(fresh!.status).toBe("failed");
    expect(fresh!.failedAt).toBeInstanceOf(Date);
    expect(fresh!.lastError).toContain("unknown_processing_error");
    // After max attempts, retryJob calls failJob with a safe classification.
    // The old "transient" text is replaced by "unknown_processing_error".
    expect(fresh!.lastError).toContain("unknown_processing_error");
    expect(fresh!.lockedAt).toBeNull();
    expect(fresh!.lockedBy).toBeNull();
  });

  it("retryJob when attempts > maxAttempts (exceeded) → also marks as failed", async () => {
    const enq = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(3204),
      dedupeKey: uniqueKey("retry-exceed"),
      maxAttempts: 2,
    });
    await db.jobQueue.update({
      where: { id: enq.job.id },
      data: {
        status: "processing",
        attempts: 5, // way over maxAttempts=2
        lockedAt: new Date(),
      },
    });

    await retryJob(enq.job.jobId, "still failing");
    const fresh = await db.jobQueue.findUnique({ where: { id: enq.job.id } });
    expect(fresh!.status).toBe("failed");
  });

  it("retryJob is a no-op for non-existent jobId (no throw)", async () => {
    // No job with this jobId exists — should return without throwing.
    await expect(retryJob("nonexistent-uuid-" + randomUUID(), "x")).resolves.toBeUndefined();
  });

  // ---- recoverStaleLocks ------------------------------------------------

  it("recoverStaleLocks: stale processing job → reset to pending with backoff, lock cleared", async () => {
    const enq = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(4001),
      dedupeKey: uniqueKey("stale"),
      maxAttempts: 5,
    });
    // Mark as processing with lockedAt older than STALE_LOCK_TIMEOUT_MS.
    const staleTime = new Date(Date.now() - STALE_LOCK_TIMEOUT_MS - 60_000); // 6 min ago
    await db.jobQueue.update({
      where: { id: enq.job.id },
      data: {
        status: "processing",
        attempts: 1,
        lockedAt: staleTime,
        lockedBy: "dead-worker",
      },
    });

    const before = Date.now();
    const recovered = await recoverStaleLocks();
    const after = Date.now();

    // At least our one job should have been recovered.
    expect(recovered).toBeGreaterThanOrEqual(1);

    const fresh = await db.jobQueue.findUnique({ where: { id: enq.job.id } });
    expect(fresh!.status).toBe("pending");
    expect(fresh!.attempts).toBe(1); // not incremented
    expect(fresh!.lockedAt).toBeNull();
    expect(fresh!.lockedBy).toBeNull();
    expect(fresh!.failedAt).toBeNull();
    // Backoff applied: availableAt is in the future.
    expect(fresh!.availableAt.getTime()).toBeGreaterThan(after);
    // Sanity: backoff is at least BACKOFF_BASE_MS * 2^0 = 5000ms.
    expect(fresh!.availableAt.getTime()).toBeGreaterThanOrEqual(
      before + BACKOFF_BASE_MS - 500,
    );
  });

  it("recoverStaleLocks: active (recent) processing jobs NOT touched", async () => {
    // Create one stale + one active processing job.
    const stale = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(4101),
      dedupeKey: uniqueKey("stale-mix"),
      maxAttempts: 5,
    });
    await db.jobQueue.update({
      where: { id: stale.job.id },
      data: {
        status: "processing",
        attempts: 1,
        lockedAt: new Date(Date.now() - STALE_LOCK_TIMEOUT_MS - 60_000),
        lockedBy: "dead-worker",
      },
    });

    const active = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(4102),
      dedupeKey: uniqueKey("active-mix"),
      maxAttempts: 5,
    });
    const recentLock = new Date(Date.now() - 30_000); // 30s ago — still active
    await db.jobQueue.update({
      where: { id: active.job.id },
      data: {
        status: "processing",
        attempts: 1,
        lockedAt: recentLock,
        lockedBy: "live-worker",
      },
    });

    const recovered = await recoverStaleLocks();
    expect(recovered).toBe(1); // only the stale one was recovered

    const freshStale = await db.jobQueue.findUnique({
      where: { id: stale.job.id },
    });
    expect(freshStale!.status).toBe("pending");

    const freshActive = await db.jobQueue.findUnique({
      where: { id: active.job.id },
    });
    expect(freshActive!.status).toBe("processing"); // unchanged
    expect(freshActive!.lockedBy).toBe("live-worker");
    expect(freshActive!.lockedAt).toEqual(recentLock);
  });

  it("recoverStaleLocks: stale job with attempts >= maxAttempts → marked as failed (NOT retried)", async () => {
    const enq = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(4201),
      dedupeKey: uniqueKey("stale-max"),
      maxAttempts: 3,
    });
    await db.jobQueue.update({
      where: { id: enq.job.id },
      data: {
        status: "processing",
        attempts: 3, // === maxAttempts
        maxAttempts: 3,
        lockedAt: new Date(Date.now() - STALE_LOCK_TIMEOUT_MS - 60_000),
        lockedBy: "dead-worker",
      },
    });

    const recovered = await recoverStaleLocks();
    expect(recovered).toBe(0); // stale-but-maxed is NOT counted as "recovered"

    const fresh = await db.jobQueue.findUnique({ where: { id: enq.job.id } });
    expect(fresh!.status).toBe("failed");
    expect(fresh!.failedAt).toBeInstanceOf(Date);
    expect(fresh!.lastError).toContain("unknown_processing_error");
    // Stale lock recovery now persists a safe classification.
    expect(fresh!.lastError).toContain("unknown_processing_error");
  });

  it("recoverStaleLocks: stale job with attempts > maxAttempts → marked as failed", async () => {
    const enq = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(4202),
      dedupeKey: uniqueKey("stale-over-max"),
      maxAttempts: 2,
    });
    await db.jobQueue.update({
      where: { id: enq.job.id },
      data: {
        status: "processing",
        attempts: 5, // over maxAttempts=2
        lockedAt: new Date(Date.now() - STALE_LOCK_TIMEOUT_MS - 60_000),
        lockedBy: "dead-worker",
      },
    });

    await recoverStaleLocks();
    const fresh = await db.jobQueue.findUnique({ where: { id: enq.job.id } });
    expect(fresh!.status).toBe("failed");
  });

  it("recoverStaleLocks returns 0 when there are no stale jobs", async () => {
    // No stale jobs at this point (beforeEach cleaned the table).
    const recovered = await recoverStaleLocks();
    expect(recovered).toBe(0);
  });

  it("recoverStaleLocks: pending jobs are NOT affected (only processing jobs)", async () => {
    const pending = await enqueueJob({
      userId: userA,
      type: "otp_verified",
      payload: samplePayload(4301),
      dedupeKey: uniqueKey("pending-not-stale"),
      maxAttempts: 5,
    });
    // Even with a very old availableAt — pending jobs are not stale-locked.
    await db.jobQueue.update({
      where: { id: pending.job.id },
      data: { availableAt: new Date(Date.now() - 60_000_000) }, // very old
    });

    await recoverStaleLocks();
    const fresh = await db.jobQueue.findUnique({ where: { id: pending.job.id } });
    expect(fresh!.status).toBe("pending"); // unchanged
  });

  // ---- isTransientError -------------------------------------------------

  describe("isTransientError classification", () => {
    it("returns false (permanent) for template_not_found", () => {
      expect(isTransientError(new Error("template_not_found"))).toBe(false);
    });

    it("returns false (permanent) for missing_template_variables", () => {
      expect(isTransientError(new Error("missing_template_variables: name"))).toBe(false);
    });

    it("returns false (permanent) for feature_not_available", () => {
      expect(isTransientError(new Error("feature_not_available"))).toBe(false);
    });

    it("returns false (permanent) for invalid_subject", () => {
      expect(isTransientError(new Error("invalid_subject"))).toBe(false);
    });

    it("returns false (permanent) for validation_failed", () => {
      expect(isTransientError(new Error("validation_failed"))).toBe(false);
    });

    it("returns false (permanent) for configuration_error", () => {
      expect(isTransientError(new Error("configuration_error"))).toBe(false);
    });

    it("returns false (permanent) for 'automation configuration invalid'", () => {
      expect(isTransientError(new Error("automation configuration invalid"))).toBe(false);
    });

    it("returns true (transient) for provider_error", () => {
      expect(isTransientError(new Error("provider_error"))).toBe(true);
    });

    it("returns true (transient) for generic DB errors", () => {
      expect(isTransientError(new Error("connection refused"))).toBe(true);
    });

    it("returns true (transient) for network timeouts", () => {
      expect(isTransientError(new Error("network timeout"))).toBe(true);
    });

    it("returns true (transient) for completely unknown error messages", () => {
      expect(isTransientError(new Error("something completely unexpected"))).toBe(true);
    });

    it("returns true (transient) for non-Error values (undefined)", () => {
      expect(isTransientError(undefined)).toBe(true);
    });

    it("returns true (transient) for non-Error values (string)", () => {
      expect(isTransientError("some string error")).toBe(true);
    });

    it("returns true (transient) for non-Error values (plain object)", () => {
      expect(isTransientError({ code: 500, message: "oops" })).toBe(true);
    });

    it("returns true (transient) for non-Error values (null)", () => {
      expect(isTransientError(null)).toBe(true);
    });

    it("case-insensitive — 'TEMPLATE_NOT_FOUND' is also permanent", () => {
      expect(isTransientError(new Error("TEMPLATE_NOT_FOUND"))).toBe(false);
    });

    it("substring match — 'Error: template_not_found at line 5' is permanent", () => {
      expect(isTransientError(new Error("Error: template_not_found at line 5"))).toBe(false);
    });
  });

  // ---- Constants sanity -------------------------------------------------

  describe("exported constants", () => {
    it("STALE_LOCK_TIMEOUT_MS is 5 minutes", () => {
      expect(STALE_LOCK_TIMEOUT_MS).toBe(5 * 60 * 1000);
    });

    it("MAX_BATCH_SIZE is 10", () => {
      expect(MAX_BATCH_SIZE).toBe(10);
    });

    it("BACKOFF_BASE_MS is 5 seconds", () => {
      expect(BACKOFF_BASE_MS).toBe(5_000);
    });
  });
});
