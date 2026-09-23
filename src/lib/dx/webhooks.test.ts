import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  scheduleUserWebhookDeliveries,
  scheduleSystemWebhookDeliveries,
  scheduleTestDelivery,
  scheduleReplayDelivery,
  processWebhookQueue,
  classifyFetchError,
  signWebhook,
  verifyWebhookSignature,
  generateWebhookSecret,
  endpointMatchesEvent,
  normalizeSubscriptions,
  deliverWebhook,
  type WebhookEvent,
} from "@/lib/dx/webhooks";

/**
 * Phase 7 Webhook system — DB integration tests.
 *
 * This file is GATED — only runs when RUN_WEBHOOKS_INTEGRATION=1 AND a
 * TEST_DATABASE_URL is supplied. Generic `bun run test` skips this file
 * silently (no DB available). Mirrors the gate pattern of
 * src/lib/messaging/service.test.ts (RUN_MESSAGING_INTEGRATION).
 *
 * Coverage (per task spec):
 * ### Tenant isolation (section 3, 36):
 * - scheduleUserWebhookDeliveries(userA, event) creates deliveries ONLY on
 *   userA's endpoints (not userB's, not system endpoints)
 * - scheduleSystemWebhookDeliveries(event) creates deliveries ONLY on
 *   userId=null system endpoints (not tenant endpoints)
 * - deliverWebhook(event, userA) does NOT target userB's endpoints or system
 * - deliverWebhook(event, undefined) targets ONLY system endpoints (NOT all
 *   endpoints — the old fan-out bug is fixed)
 *
 * ### Event dispatch (sections 5, 8, 9):
 * - matching endpoint → delivery + queue created
 * - non-matching endpoint → NO delivery
 * - wildcard endpoint → receives the event
 * - idempotent replay → NO duplicate delivery (dedupeKey enforced)
 * - concurrent identical events → exactly 1 delivery per matching endpoint
 *
 * ### Queue (sections 12, 13, 14):
 * - processWebhookQueue claims pending jobs atomically
 * - stale lock recovery (5-min timeout)
 * - active lock NOT stolen
 * - max attempts respected → marked failed
 * - successful delivery → status="done" / delivery.status="delivered"
 * - failed delivery → safe error classification persisted
 *
 * ### Secrets/signatures (sections 16, 17):
 * - generateWebhookSecret format
 * - signWebhook format
 * - verifyWebhookSignature (correct, wrong, expired)
 * - scheduleReplayDelivery creates NEW delivery with fresh signature
 * - delivery.deliveryId is a UUID
 *
 * ### Safe error persistence (section 20):
 * - classifyFetchError coverage
 * - processWebhookQueue persists ONLY safe classification (never raw error
 *   text — verified with a deliberately sensitive error message)
 *
 * DB SETUP: mirror messaging service.test.ts. Create User + WebhookEndpoint
 * fixtures. Clean tables between tests. Use email prefix "wh-test-".
 *
 * `fetch` is mocked globally via vi.stubGlobal("fetch", vi.fn()) to avoid
 * real network calls. SSRF dns.lookup uses public URLs only — no DNS mocking
 * needed for the DB tests (we use https://example.com / 1.1.1.1 literals).
 */

// ---- Gate: skip silently when RUN_WEBHOOKS_INTEGRATION is not set --------

const RUN = process.env.RUN_WEBHOOKS_INTEGRATION === "1";

// ---- Test suite -----------------------------------------------------------

describe.skipIf(!RUN)("Phase 7 Webhook system — DB integration", () => {
  let userA: number;
  let userB: number;
  let setupComplete = false;

  // Per-test isolated event types so different endpoints don't collide.
  let eventCounter = 0;
  function nextEvent(): string {
    eventCounter += 1;
    return `nixify.event.received:${eventCounter}`;
  }

  beforeAll(async () => {
    // Verify DB connectivity.
    await db.$queryRaw`SELECT 1`;

    // Clean up any leftover test data from previous runs.
    // WebhookEndpoint has no User relation — filter via createdBy marker.
    await db.webhookQueue.deleteMany({
      where: { endpoint: { createdBy: { contains: "wh-test-" } } },
    });
    await db.webhookDelivery.deleteMany({
      where: { endpoint: { createdBy: { contains: "wh-test-" } } },
    });
    await db.webhookEndpoint.deleteMany({
      where: { createdBy: { contains: "wh-test-" } },
    });
    await db.user.deleteMany({
      where: { email: { contains: "wh-test-" } },
    });
    // Also clean any system endpoints we created (createdBy='wh-test-system').
    await db.webhookQueue.deleteMany({
      where: { endpoint: { createdBy: { contains: "wh-test-system" } } },
    });
    await db.webhookDelivery.deleteMany({
      where: { endpoint: { createdBy: { contains: "wh-test-system" } } },
    });
    await db.webhookEndpoint.deleteMany({
      where: { createdBy: { contains: "wh-test-system" } },
    });

    // Create two test users with plan="PRO" so WEBHOOK_ENDPOINTS access=true.
    const a = await db.user.create({
      data: {
        email: "wh-test-a@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userA = a.id;

    const b = await db.user.create({
      data: {
        email: "wh-test-b@nixify-test.com",
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

    // Reset the global fetch mock between tests.
    vi.stubGlobal("fetch", vi.fn());

    // Clean all webhook rows owned by our test users + system endpoints we
    // created. Same cleanup as the messaging suite.
    await db.webhookQueue.deleteMany({
      where: { endpoint: { userId: { in: [userA, userB] } } },
    });
    await db.webhookDelivery.deleteMany({
      where: { endpoint: { userId: { in: [userA, userB] } } },
    });
    await db.webhookEndpoint.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    // Clean system endpoints we created (createdBy marker).
    await db.webhookQueue.deleteMany({
      where: { endpoint: { createdBy: { contains: "wh-test-system" } } },
    });
    await db.webhookDelivery.deleteMany({
      where: { endpoint: { createdBy: { contains: "wh-test-system" } } },
    });
    await db.webhookEndpoint.deleteMany({
      where: { createdBy: { contains: "wh-test-system" } },
    });
  });

  afterAll(async () => {
    if (!setupComplete) {
      await db.$disconnect();
      return;
    }
    vi.unstubAllEnvs();
    await db.webhookQueue.deleteMany({
      where: { endpoint: { userId: { in: [userA, userB] } } },
    });
    await db.webhookDelivery.deleteMany({
      where: { endpoint: { userId: { in: [userA, userB] } } },
    });
    await db.webhookEndpoint.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.webhookEndpoint.deleteMany({
      where: { createdBy: { contains: "wh-test-system" } },
    });
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await db.$disconnect();
  });

  // ---- Helpers -----------------------------------------------------------

  function makeEvent(type: string = nextEvent()): WebhookEvent {
    return {
      type,
      requestId: `req-${type}-${Date.now()}`,
      email: "alice@example.com",
      timestamp: new Date().toISOString(),
      data: { hello: "world" },
    };
  }

  /** Create a webhook endpoint owned by a user. */
  async function createEndpoint(opts: {
    userId: number | null;
    events: string;
    url?: string;
  }): Promise<{ id: number; secret: string }> {
    const secret = generateWebhookSecret();
    const ep = await db.webhookEndpoint.create({
      data: {
        userId: opts.userId,
        url: opts.url ?? "https://example.com/webhook",
        events: opts.events,
        secret,
        isActive: true,
        createdBy: opts.userId === null ? "wh-test-system" : `wh-test-user:${opts.userId}`,
      },
    });
    return { id: ep.id, secret };
  }

  // ====================================================================
  // SECTION: Tenant isolation (section 3, 36)
  // ====================================================================

  describe("Tenant isolation", () => {
    it("scheduleUserWebhookDeliveries(userA, event) creates deliveries ONLY on userA's endpoints", async () => {
      // userA has one matching endpoint; userB has one matching endpoint; one
      // system endpoint matches too.
      const epA = await createEndpoint({ userId: userA, events: "*" });
      const epB = await createEndpoint({ userId: userB, events: "*" });
      const epSys = await createEndpoint({ userId: null, events: "*" });

      const result = await scheduleUserWebhookDeliveries(userA, makeEvent());
      expect(result.scheduled).toBe(1);

      // Delivery created for epA only.
      const deliveriesForA = await db.webhookDelivery.findMany({
        where: { endpointId: epA.id },
      });
      expect(deliveriesForA).toHaveLength(1);

      // NO delivery for epB (cross-tenant).
      const deliveriesForB = await db.webhookDelivery.findMany({
        where: { endpointId: epB.id },
      });
      expect(deliveriesForB).toHaveLength(0);

      // NO delivery for the system endpoint.
      const deliveriesForSys = await db.webhookDelivery.findMany({
        where: { endpointId: epSys.id },
      });
      expect(deliveriesForSys).toHaveLength(0);
    });

    it("scheduleSystemWebhookDeliveries(event) creates deliveries ONLY on userId=null system endpoints", async () => {
      const epA = await createEndpoint({ userId: userA, events: "*" });
      const epSys = await createEndpoint({ userId: null, events: "*" });

      const result = await scheduleSystemWebhookDeliveries(makeEvent());
      expect(result.scheduled).toBe(1);

      // System endpoint got the delivery.
      const sysDeliveries = await db.webhookDelivery.findMany({
        where: { endpointId: epSys.id },
      });
      expect(sysDeliveries).toHaveLength(1);

      // Tenant endpoint did NOT.
      const tenantDeliveries = await db.webhookDelivery.findMany({
        where: { endpointId: epA.id },
      });
      expect(tenantDeliveries).toHaveLength(0);
    });

    it("deliverWebhook(event, userA) does NOT target userB's endpoints or system endpoints", async () => {
      const epA = await createEndpoint({ userId: userA, events: "*" });
      const epB = await createEndpoint({ userId: userB, events: "*" });
      const epSys = await createEndpoint({ userId: null, events: "*" });

      await deliverWebhook(makeEvent(), userA);

      const dA = await db.webhookDelivery.findMany({ where: { endpointId: epA.id } });
      const dB = await db.webhookDelivery.findMany({ where: { endpointId: epB.id } });
      const dSys = await db.webhookDelivery.findMany({ where: { endpointId: epSys.id } });
      expect(dA).toHaveLength(1);
      expect(dB).toHaveLength(0);
      expect(dSys).toHaveLength(0);
    });

    it("deliverWebhook(event, undefined) targets ONLY system endpoints (NOT all — old fan-out bug fixed)", async () => {
      const epA = await createEndpoint({ userId: userA, events: "*" });
      const epB = await createEndpoint({ userId: userB, events: "*" });
      const epSys = await createEndpoint({ userId: null, events: "*" });

      await deliverWebhook(makeEvent(), undefined);

      const dA = await db.webhookDelivery.findMany({ where: { endpointId: epA.id } });
      const dB = await db.webhookDelivery.findMany({ where: { endpointId: epB.id } });
      const dSys = await db.webhookDelivery.findMany({ where: { endpointId: epSys.id } });
      expect(dA).toHaveLength(0);
      expect(dB).toHaveLength(0);
      expect(dSys).toHaveLength(1);
    });
  });

  // ====================================================================
  // SECTION: Event dispatch (sections 5, 8, 9)
  // ====================================================================

  describe("Event dispatch", () => {
    it("matching endpoint → delivery + queue created", async () => {
      const ev = nextEvent();
      const ep = await createEndpoint({ userId: userA, events: ev });

      const result = await scheduleUserWebhookDeliveries(userA, makeEvent(ev));
      expect(result.scheduled).toBe(1);

      // Delivery row.
      const delivery = await db.webhookDelivery.findFirst({
        where: { endpointId: ep.id },
      });
      expect(delivery).not.toBeNull();
      expect(delivery!.status).toBe("pending");
      expect(delivery!.attempts).toBe(0);
      expect(delivery!.payload).toContain(ev);
      expect(delivery!.signature).toMatch(/^t=\d+,v1=[0-9a-f]+$/);

      // Queue row.
      const queue = await db.webhookQueue.findFirst({
        where: { endpointId: ep.id },
      });
      expect(queue).not.toBeNull();
      expect(queue!.status).toBe("pending");
      expect(queue!.attempts).toBe(0);
    });

    it("non-matching endpoint → NO delivery created", async () => {
      const ev = nextEvent();
      // Endpoint subscribes to a different event type.
      const ep = await createEndpoint({ userId: userA, events: "otp.sent" });

      const result = await scheduleUserWebhookDeliveries(userA, makeEvent(ev));
      expect(result.scheduled).toBe(0);

      const deliveries = await db.webhookDelivery.findMany({
        where: { endpointId: ep.id },
      });
      expect(deliveries).toHaveLength(0);
    });

    it("wildcard endpoint (events='*') receives the event", async () => {
      const ep = await createEndpoint({ userId: userA, events: "*" });

      const result = await scheduleUserWebhookDeliveries(userA, makeEvent());
      expect(result.scheduled).toBe(1);

      const deliveries = await db.webhookDelivery.findMany({
        where: { endpointId: ep.id },
      });
      expect(deliveries).toHaveLength(1);
    });

    it("same InboundEvent (idempotent replay) does NOT create duplicate delivery (dedupeKey enforced)", async () => {
      const ep = await createEndpoint({ userId: userA, events: "*" });
      const ev = makeEvent();
      const dedupeKeyPrefix = "inbound_event:test-event-1";

      // First schedule creates the delivery.
      const r1 = await scheduleUserWebhookDeliveries(userA, ev, dedupeKeyPrefix);
      expect(r1.scheduled).toBe(1);

      // Second schedule with same dedupeKey MUST be a no-op (P2002 caught).
      const r2 = await scheduleUserWebhookDeliveries(userA, ev, dedupeKeyPrefix);
      expect(r2.scheduled).toBe(0); // P2002 suppressed → counted as already scheduled

      // Only ONE delivery row exists.
      const deliveries = await db.webhookDelivery.findMany({
        where: { endpointId: ep.id },
      });
      expect(deliveries).toHaveLength(1);
    });

    it("concurrent identical event requests → exactly 1 delivery per matching endpoint", async () => {
      const ep = await createEndpoint({ userId: userA, events: "*" });
      const ev = makeEvent();
      const dedupeKeyPrefix = "inbound_event:concurrent-test-1";

      // Fire 2 concurrent schedules with the same dedupeKey + payload.
      const [r1, r2] = await Promise.all([
        scheduleUserWebhookDeliveries(userA, ev, dedupeKeyPrefix),
        scheduleUserWebhookDeliveries(userA, ev, dedupeKeyPrefix),
      ]);

      // At most one of them scheduled (the other hit P2002).
      const total = r1.scheduled + r2.scheduled;
      expect(total).toBe(1);

      // Exactly ONE delivery row.
      const deliveries = await db.webhookDelivery.findMany({
        where: { endpointId: ep.id },
      });
      expect(deliveries).toHaveLength(1);
    });
  });

  // ====================================================================
  // SECTION: Queue (sections 12, 13, 14)
  // ====================================================================

  describe("Queue processor", () => {
    it("processWebhookQueue claims pending jobs atomically (2 concurrent calls → no double delivery)", async () => {
      const ep = await createEndpoint({ userId: userA, events: "*" });
      await scheduleUserWebhookDeliveries(userA, makeEvent());

      // Mock fetch to succeed.
      vi.mocked(fetch).mockResolvedValue(
        new Response("ok", { status: 200 }) as any,
      );

      // Run 2 concurrent processors — they should NOT double-deliver.
      const [r1, r2] = await Promise.all([
        processWebhookQueue(),
        processWebhookQueue(),
      ]);

      const totalProcessed = r1.processed + r2.processed;
      expect(totalProcessed).toBe(1); // exactly ONE of them got the job

      // fetch called exactly once (no double delivery).
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("stale lock recovery: job stuck in 'processing' with lockedAt > 5min → reset to pending", async () => {
      const ep = await createEndpoint({ userId: userA, events: "*" });
      const ev = makeEvent();
      await scheduleUserWebhookDeliveries(userA, ev);

      // Manually mark the job as 'processing' with a stale lockedAt (10 min ago).
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      await db.webhookQueue.updateMany({
        where: { endpointId: ep.id },
        data: { status: "processing", lockedAt: tenMinAgo, lockedBy: "dead-worker" },
      });

      // Run the processor — should recover the stale lock + retry.
      // Mock fetch to succeed on the recovery retry.
      vi.mocked(fetch).mockResolvedValue(new Response("ok", { status: 200 }) as any);

      const result = await processWebhookQueue();
      expect(result.recovered).toBe(1);

      // The job should now be either delivered or pending (with a backoff).
      const job = await db.webhookQueue.findFirst({
        where: { endpointId: ep.id },
      });
      expect(job).not.toBeNull();
      // Stale lock recovery resets to pending (and increments attempts). After
      // recovery, the next pass may pick it up again — but we just assert
      // it's NOT still stuck in 'processing' by the dead worker.
      expect(job!.lockedBy).not.toBe("dead-worker");
    });

    it("active lock (recent) NOT stolen by another worker", async () => {
      const ep = await createEndpoint({ userId: userA, events: "*" });
      await scheduleUserWebhookDeliveries(userA, makeEvent());

      // Mark the job as 'processing' with a RECENT lockedAt (1 min ago).
      const oneMinAgo = new Date(Date.now() - 60 * 1000);
      await db.webhookQueue.updateMany({
        where: { endpointId: ep.id },
        data: { status: "processing", lockedAt: oneMinAgo, lockedBy: "active-worker" },
      });

      // Mock fetch — should NOT be called because the job is not stale.
      vi.mocked(fetch).mockResolvedValue(new Response("ok", { status: 200 }) as any);

      const result = await processWebhookQueue();
      expect(result.recovered).toBe(0); // active lock not stolen
      expect(fetch).not.toHaveBeenCalled(); // job NOT picked up

      // The job is still locked by the original worker.
      const job = await db.webhookQueue.findFirst({
        where: { endpointId: ep.id },
      });
      expect(job!.lockedBy).toBe("active-worker");
      expect(job!.status).toBe("processing");
    });

    it("max attempts respected (job.attempts >= maxRetries → marked failed)", async () => {
      const ep = await createEndpoint({ userId: userA, events: "*" });
      await scheduleUserWebhookDeliveries(userA, makeEvent());

      // Push the job past maxRetries manually (set attempts = maxRetries).
      const job = await db.webhookQueue.findFirst({
        where: { endpointId: ep.id },
      });
      expect(job).not.toBeNull();
      await db.webhookQueue.update({
        where: { id: job!.id },
        data: {
          status: "processing",
          attempts: job!.maxRetries, // at the limit
          lockedAt: new Date(Date.now() - 10 * 60 * 1000), // stale → recoverStaleLocks will see this
          lockedBy: "dead-worker",
        },
      });

      // fetch should NOT be called — recovery marks as failed.
      vi.mocked(fetch).mockResolvedValue(new Response("ok", { status: 200 }) as any);

      const result = await processWebhookQueue();
      expect(result.recovered).toBe(0); // recovery didn't re-queue (max attempts)

      // Job marked failed.
      const failed = await db.webhookQueue.findFirst({
        where: { id: job!.id },
      });
      expect(failed!.status).toBe("failed");
      expect(failed!.lastError).toBe("max_attempts_exceeded");

      // Delivery marked failed too.
      const delivery = await db.webhookDelivery.findFirst({
        where: { endpointId: ep.id },
      });
      expect(delivery!.status).toBe("failed");
      expect(delivery!.lastError).toBe("max_attempts_exceeded");
    });

    it("successful delivery → status='done', delivery.status='delivered'", async () => {
      const ep = await createEndpoint({ userId: userA, events: "*" });
      await scheduleUserWebhookDeliveries(userA, makeEvent());

      vi.mocked(fetch).mockResolvedValue(new Response("ok", { status: 200 }) as any);

      await processWebhookQueue();

      const job = await db.webhookQueue.findFirst({ where: { endpointId: ep.id } });
      expect(job!.status).toBe("done");
      expect(job!.completedAt).toBeInstanceOf(Date);

      const delivery = await db.webhookDelivery.findFirst({
        where: { endpointId: ep.id },
      });
      expect(delivery!.status).toBe("delivered");
      expect(delivery!.responseCode).toBe(200);
      expect(delivery!.deliveredAt).toBeInstanceOf(Date);
    });

    it("failed delivery → safe error classification persisted (NOT raw error text)", async () => {
      const ep = await createEndpoint({ userId: userA, events: "*" });
      await scheduleUserWebhookDeliveries(userA, makeEvent());

      // Mock fetch to throw an error with a SENSITIVE message — verify it
      // does NOT get persisted to lastError.
      vi.mocked(fetch).mockRejectedValue(
        new Error("password=secret token=abc123 RAW_CREDENTIAL_LEAK"),
      );

      await processWebhookQueue();

      const job = await db.webhookQueue.findFirst({ where: { endpointId: ep.id } });
      expect(job!.lastError).not.toBeNull();
      // Safe classification only (one of the enum values).
      expect(["network_error", "timeout"]).toContain(job!.lastError);

      // CRITICAL: the raw sensitive error text MUST NOT appear.
      expect(job!.lastError).not.toContain("password=secret");
      expect(job!.lastError).not.toContain("RAW_CREDENTIAL_LEAK");
      expect(job!.lastError).not.toContain("token=abc123");

      const delivery = await db.webhookDelivery.findFirst({
        where: { endpointId: ep.id },
      });
      expect(delivery!.lastError).not.toBeNull();
      expect(["network_error", "timeout"]).toContain(delivery!.lastError);
      expect(delivery!.lastError).not.toContain("password=secret");
      expect(delivery!.lastError).not.toContain("RAW_CREDENTIAL_LEAK");
    });
  });

  // ====================================================================
  // SECTION: Stale-lock concurrency regression (Phase 7 fix)
  // ====================================================================

  describe("Stale-lock concurrency regression", () => {
    it("fresh re-claim must survive an old recovery snapshot", async () => {
      const ep = await createEndpoint({ userId: userA, events: "*" });
      await scheduleUserWebhookDeliveries(userA, makeEvent());

      const job = await db.webhookQueue.findFirst({ where: { endpointId: ep.id } });
      expect(job).not.toBeNull();

      // Set the job to stale processing (simulating a dead worker).
      const staleLockedAt = new Date(Date.now() - 10 * 60 * 1000);
      await db.webhookQueue.update({
        where: { id: job!.id },
        data: {
          status: "processing",
          attempts: 1,
          lockedAt: staleLockedAt,
          lockedBy: "dead-worker",
        },
      });

      // Simulate: recovery A reads the stale job (findMany), then ANOTHER
      // worker claims it with a FRESH lockedAt before recovery A's update runs.
      // First, the fresh claim happens (simulating a new worker picking it up):
      const freshLockedAt = new Date();
      await db.webhookQueue.update({
        where: { id: job!.id },
        data: {
          status: "processing",
          lockedAt: freshLockedAt,
          lockedBy: "fresh-worker",
        },
      });

      // Now the OLD recovery snapshot tries to reset it. The compare-and-swap
      // WHERE clause includes lockedAt: { lt: cutoff } — the freshLockedAt is
      // NOT older than cutoff, so the update should affect 0 rows.
      const result = await processWebhookQueue();
      // Recovery should NOT have reset the fresh claim.
      expect(result.recovered).toBe(0);

      // The job should still be processing with the fresh worker's lock.
      const afterJob = await db.webhookQueue.findFirst({ where: { id: job!.id } });
      expect(afterJob!.status).toBe("processing");
      expect(afterJob!.lockedBy).toBe("fresh-worker");
      // lockedAt should still be the fresh value (not reset to null).
      expect(afterJob!.lockedAt).not.toBeNull();
    });

    it("exhausted transition is atomic with delivery status (compare-and-swap)", async () => {
      const ep = await createEndpoint({ userId: userA, events: "*" });
      await scheduleUserWebhookDeliveries(userA, makeEvent());

      const job = await db.webhookQueue.findFirst({ where: { endpointId: ep.id } });
      expect(job).not.toBeNull();

      // Push to max attempts + stale lock.
      const staleLockedAt = new Date(Date.now() - 10 * 60 * 1000);
      await db.webhookQueue.update({
        where: { id: job!.id },
        data: {
          status: "processing",
          attempts: job!.maxRetries,
          lockedAt: staleLockedAt,
          lockedBy: "dead-worker",
        },
      });

      // Process — recovery should mark both queue + delivery as failed.
      vi.mocked(fetch).mockResolvedValue(new Response("ok", { status: 200 }) as any);
      const result = await processWebhookQueue();
      expect(result.recovered).toBe(0);

      // Both queue and delivery are failed atomically.
      const failedJob = await db.webhookQueue.findFirst({ where: { id: job!.id } });
      expect(failedJob!.status).toBe("failed");
      expect(failedJob!.lastError).toBe("max_attempts_exceeded");

      const delivery = await db.webhookDelivery.findFirst({ where: { endpointId: ep.id } });
      expect(delivery!.status).toBe("failed");
      expect(delivery!.lastError).toBe("max_attempts_exceeded");
    });

    it("concurrent stale recovery: two calls produce one effective transition", async () => {
      const ep = await createEndpoint({ userId: userA, events: "*" });
      await scheduleUserWebhookDeliveries(userA, makeEvent());

      const job = await db.webhookQueue.findFirst({ where: { endpointId: ep.id } });
      expect(job).not.toBeNull();

      // Set stale.
      const staleLockedAt = new Date(Date.now() - 10 * 60 * 1000);
      await db.webhookQueue.update({
        where: { id: job!.id },
        data: {
          status: "processing",
          attempts: 1,
          lockedAt: staleLockedAt,
          lockedBy: "dead-worker",
        },
      });

      // Two concurrent recovery calls. Due to the compare-and-swap, only one
      // should succeed in resetting to pending (count=1). The other gets count=0.
      const [r1, r2] = await Promise.all([
        processWebhookQueue(),
        processWebhookQueue(),
      ]);

      // Exactly one recovery counted (the other got count=0).
      const totalRecovered = r1.recovered + r2.recovered;
      expect(totalRecovered).toBe(1);

      // The job is now pending (reset by the winner), not processing.
      const afterJob = await db.webhookQueue.findFirst({ where: { id: job!.id } });
      expect(afterJob!.status).toBe("pending");
      expect(afterJob!.lockedAt).toBeNull();
      expect(afterJob!.lockedBy).toBeNull();
    });

    it("already-exhausted queue entry cannot be resurrected into another network attempt", async () => {
      const ep = await createEndpoint({ userId: userA, events: "*" });
      await scheduleUserWebhookDeliveries(userA, makeEvent());

      const job = await db.webhookQueue.findFirst({ where: { endpointId: ep.id } });
      expect(job).not.toBeNull();

      // Mark as failed (exhausted).
      await db.webhookQueue.update({
        where: { id: job!.id },
        data: {
          status: "failed",
          attempts: job!.maxRetries,
          lastError: "max_attempts_exceeded",
          failedAt: new Date(),
        },
      });

      // Process — the failed job should NOT be claimed (claimPendingJobs
      // only claims status=pending).
      vi.mocked(fetch).mockResolvedValue(new Response("ok", { status: 200 }) as any);
      const result = await processWebhookQueue();
      expect(result.processed).toBe(0);
      expect(fetch).not.toHaveBeenCalled();

      // Job remains failed.
      const afterJob = await db.webhookQueue.findFirst({ where: { id: job!.id } });
      expect(afterJob!.status).toBe("failed");
    });
  });

  // ====================================================================
  // SECTION: Secrets / signatures (sections 16, 17)
  // ====================================================================

  describe("Secrets + signatures", () => {
    it("generateWebhookSecret returns 'mg_whsec_...' format", () => {
      const secret = generateWebhookSecret();
      expect(secret).toMatch(/^mg_whsec_[A-Za-z0-9_-]+$/);
      expect(secret.length).toBeGreaterThan(20);
    });

    it("signWebhook returns 't=<ts>,v1=<hex>' format", () => {
      const sig = signWebhook("mg_whsec_test_secret", "payload");
      expect(sig).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    });

    it("verifyWebhookSignature: correct secret → true", () => {
      const secret = "mg_whsec_test_secret";
      const payload = "payload";
      const sig = signWebhook(secret, payload);
      expect(verifyWebhookSignature(secret, payload, sig)).toBe(true);
    });

    it("verifyWebhookSignature: wrong secret → false", () => {
      const sig = signWebhook("mg_whsec_correct", "payload");
      expect(verifyWebhookSignature("mg_whsec_wrong", "payload", sig)).toBe(false);
    });

    it("verifyWebhookSignature: expired timestamp → false", () => {
      const secret = "mg_whsec_test_secret";
      const payload = "payload";
      // Sign with a timestamp 10 minutes in the past (past the 5-min tolerance).
      const oldTs = Date.now() - 10 * 60 * 1000;
      const sig = signWebhook(secret, payload, oldTs);
      expect(verifyWebhookSignature(secret, payload, sig)).toBe(false);
    });

    it("scheduleReplayDelivery creates a NEW delivery with a FRESH signature (different from original)", async () => {
      const ep = await createEndpoint({ userId: userA, events: "*" });
      await scheduleUserWebhookDeliveries(userA, makeEvent());

      const original = await db.webhookDelivery.findFirst({
        where: { endpointId: ep.id },
      });
      expect(original).not.toBeNull();

      // Small delay to ensure the replay timestamp differs.
      await new Promise((r) => setTimeout(r, 10));

      const { deliveryId } = await scheduleReplayDelivery(
        original!.deliveryId,
        userA,
      );

      // A NEW delivery was created (separate row from the original).
      const deliveries = await db.webhookDelivery.findMany({
        where: { endpointId: ep.id },
      });
      expect(deliveries).toHaveLength(2);

      const replay = deliveries.find((d) => d.deliveryId === deliveryId);
      expect(replay).toBeDefined();
      // replayOfId points at the original.
      expect(replay!.replayOfId).toBe(original!.id);
      // Signature is DIFFERENT (fresh timestamp) — the t= prefix differs.
      expect(replay!.signature).not.toBe(original!.signature);
      // Payload is the SAME.
      expect(replay!.payload).toBe(original!.payload);
    });

    it("delivery.deliveryId is a UUID (public identifier)", async () => {
      const ep = await createEndpoint({ userId: userA, events: "*" });
      await scheduleUserWebhookDeliveries(userA, makeEvent());

      const delivery = await db.webhookDelivery.findFirst({
        where: { endpointId: ep.id },
      });
      expect(delivery).not.toBeNull();
      // UUID format: 8-4-4-4-12 hex chars.
      expect(delivery!.deliveryId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  // ====================================================================
  // SECTION: Safe error classification (section 20)
  // ====================================================================

  describe("Safe error persistence", () => {
    it("classifyFetchError: timeout error → 'timeout'", () => {
      const err = new Error("Request timed out after 10000ms");
      expect(classifyFetchError(err, null)).toBe("timeout");
    });

    it("classifyFetchError: HTTP 404 → 'http_4xx'", () => {
      // null error + HTTP 404 status.
      expect(classifyFetchError(null, 404)).toBe("http_4xx");
    });

    it("classifyFetchError: HTTP 500 → 'http_5xx'", () => {
      expect(classifyFetchError(null, 500)).toBe("http_5xx");
    });

    it("classifyFetchError: network error → 'network_error'", () => {
      // Generic Error without timeout/abort/ssrf keywords.
      const err = new Error("ECONNREFUSED 1.2.3.4:443");
      expect(classifyFetchError(err, null)).toBe("network_error");
    });

    it("classifyFetchError: SSRF-blocked error → 'ssrf_blocked'", () => {
      const err = new Error("URL is ssrf blocked — private destination");
      expect(classifyFetchError(err, null)).toBe("ssrf_blocked");
    });

    it("processWebhookQueue failure persists ONLY safe classification (never raw error text)", async () => {
      const ep = await createEndpoint({ userId: userA, events: "*" });
      await scheduleUserWebhookDeliveries(userA, makeEvent());

      // Deliberately sensitive error message — verify it does NOT leak.
      vi.mocked(fetch).mockRejectedValue(
        new Error("password=secret api_key=sk_live_xyz RAW_CREDENTIAL_LEAK"),
      );

      await processWebhookQueue();

      const job = await db.webhookQueue.findFirst({ where: { endpointId: ep.id } });
      const delivery = await db.webhookDelivery.findFirst({
        where: { endpointId: ep.id },
      });

      // Safe classification persisted on both rows.
      expect(["network_error", "timeout"]).toContain(job!.lastError);
      expect(["network_error", "timeout"]).toContain(delivery!.lastError);

      // The raw sensitive text MUST NOT appear anywhere in the persisted fields.
      expect(job!.lastError).not.toContain("password");
      expect(job!.lastError).not.toContain("api_key");
      expect(job!.lastError).not.toContain("sk_live");
      expect(job!.lastError).not.toContain("RAW_CREDENTIAL_LEAK");
      expect(delivery!.lastError).not.toContain("password");
      expect(delivery!.lastError).not.toContain("api_key");
      expect(delivery!.lastError).not.toContain("sk_live");
      expect(delivery!.lastError).not.toContain("RAW_CREDENTIAL_LEAK");
    });
  });

  // ====================================================================
  // SECTION: Pure helper functions (no DB) — runs even when gate is on
  // ====================================================================

  describe("Pure helpers", () => {
    it("normalizeSubscriptions trims and removes empties", () => {
      expect(normalizeSubscriptions(" a , b ,, c ")).toEqual(["a", "b", "c"]);
      expect(normalizeSubscriptions("")).toEqual([]);
      expect(normalizeSubscriptions(", ,")).toEqual([]);
    });

    it("endpointMatchesEvent: exact subscription match → true", () => {
      expect(endpointMatchesEvent("nixify.event.received", "nixify.event.received")).toBe(true);
    });

    it("endpointMatchesEvent: wildcard '*' matches any event", () => {
      expect(endpointMatchesEvent("*", "anything.at.all")).toBe(true);
    });

    it("endpointMatchesEvent: non-matching subscription → false", () => {
      expect(endpointMatchesEvent("otp.sent", "nixify.event.received")).toBe(false);
    });
  });
});
