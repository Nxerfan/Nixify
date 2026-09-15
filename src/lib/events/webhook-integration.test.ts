import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  ingestEvent,
  type IngestEventInput,
} from "@/lib/events/service";

/**
 * Phase 7 — Webhook integration with the Events service.
 *
 * Verifies that POST /api/v1/events (via ingestEvent) schedules
 * nixify.event.received webhook deliveries durably for matching tenant
 * endpoints. NO inline fetch — the request returns immediately and the
 * queue processor handles delivery asynchronously.
 *
 * This file is GATED — only runs when RUN_WEBHOOKS_INTEGRATION=1 AND a
 * TEST_DATABASE_URL is supplied. Generic `bun run test` skips this file
 * silently (no DB available). Mirrors the gate pattern of
 * src/lib/messaging/service.test.ts (RUN_MESSAGING_INTEGRATION).
 *
 * Coverage (per task spec):
 * - InboundEvent with matching endpoint → 1 WebhookDelivery + 1 WebhookQueue
 * - InboundEvent with NO matching endpoint → 0 deliveries
 * - InboundEvent idempotent replay → 0 duplicate deliveries (dedupeKey)
 * - No inline fetch during POST /api/v1/events (mock fetch, assert NOT called)
 * - Concurrent identical events → exactly 1 delivery per endpoint
 *
 * DB SETUP: mirror src/lib/events/service.test.ts. Create User +
 * WebhookEndpoint fixtures. Clean tables between tests. Use email prefix
 * "wh-int-".
 */

// ---- Gate ----------------------------------------------------------------

const RUN = process.env.RUN_WEBHOOKS_INTEGRATION === "1";

// ---- Test suite ----------------------------------------------------------

describe.skipIf(!RUN)("Phase 7 — Events → Webhook integration (DB)", () => {
  let userA: number;
  let setupComplete = false;

  // Unique idempotency-key counter per test.
  let keyCounter = 0;
  function uniqueKey(prefix: string): string {
    keyCounter += 1;
    return `${prefix}-${keyCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  beforeAll(async () => {
    await db.$queryRaw`SELECT 1`;

    // Clean up any leftover test data from previous runs.
    // WebhookEndpoint has no User relation — filter via createdBy marker.
    await db.webhookQueue.deleteMany({
      where: { endpoint: { createdBy: { contains: "wh-int-" } } },
    });
    await db.webhookDelivery.deleteMany({
      where: { endpoint: { createdBy: { contains: "wh-int-" } } },
    });
    await db.webhookEndpoint.deleteMany({
      where: { createdBy: { contains: "wh-int-" } },
    });
    await db.inboundEvent.deleteMany({
      where: { user: { email: { contains: "wh-int-" } } },
    });
    await db.user.deleteMany({
      where: { email: { contains: "wh-int-" } },
    });

    const a = await db.user.create({
      data: {
        email: "wh-int-a@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userA = a.id;

    setupComplete = true;
  });

  beforeEach(async () => {
    if (!setupComplete) return;

    // Stub fetch globally — we want to assert it's NOT called during
    // ingestEvent (the request must NOT make inline network calls — that's
    // the section 11 durable-only dispatch rule).
    vi.stubGlobal("fetch", vi.fn());

    // Clean tables between tests so dedupeKey + idempotency hashes don't
    // collide across tests.
    await db.webhookQueue.deleteMany({
      where: { endpoint: { userId: userA } },
    });
    await db.webhookDelivery.deleteMany({
      where: { endpoint: { userId: userA } },
    });
    await db.webhookEndpoint.deleteMany({
      where: { userId: userA },
    });
    await db.inboundEvent.deleteMany({
      where: { userId: userA },
    });
  });

  afterAll(async () => {
    if (!setupComplete) {
      await db.$disconnect();
      return;
    }
    vi.unstubAllEnvs();
    await db.webhookQueue.deleteMany({
      where: { endpoint: { userId: userA } },
    });
    await db.webhookDelivery.deleteMany({
      where: { endpoint: { userId: userA } },
    });
    await db.webhookEndpoint.deleteMany({
      where: { userId: userA },
    });
    await db.inboundEvent.deleteMany({
      where: { userId: userA },
    });
    await db.user.deleteMany({ where: { id: userA } });
    await db.$disconnect();
  });

  // ---- Helpers -----------------------------------------------------------

  /** Create a webhook endpoint owned by userA subscribing to a specific event. */
  async function createEndpoint(events: string): Promise<{ id: number; secret: string }> {
    const { generateWebhookSecret } = await import("@/lib/dx/webhooks");
    const secret = generateWebhookSecret();
    const ep = await db.webhookEndpoint.create({
      data: {
        userId: userA,
        url: "https://example.com/webhook",
        events,
        secret,
        isActive: true,
        createdBy: `wh-int-user:${userA}`,
      },
    });
    return { id: ep.id, secret };
  }

  function buildInput(opts: Partial<IngestEventInput> = {}): IngestEventInput {
    return {
      userId: userA,
      type: opts.type ?? "user.signup",
      email: opts.email ?? "alice@example.com",
      data: opts.data ?? { name: "Alice" },
      environment: opts.environment ?? "production",
      idempotencyKey: opts.idempotencyKey ?? uniqueKey("wh-int-key"),
      requestId: opts.requestId ?? "req-test-1",
    };
  }

  // ---- Tests -------------------------------------------------------------

  it("InboundEvent with matching endpoint → 1 WebhookDelivery + 1 WebhookQueue created", async () => {
    await createEndpoint("nixify.event.received");

    const result = await ingestEvent(buildInput());

    expect(result.replay).toBe(false);

    // Exactly 1 delivery + 1 queue row were created for the matching endpoint.
    const deliveries = await db.webhookDelivery.findMany({
      where: { endpoint: { userId: userA } },
    });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].eventId).toBe("nixify.event.received");
    expect(deliveries[0].status).toBe("pending");
    expect(deliveries[0].dedupeKey).toMatch(/^inbound_event:/);

    const queueJobs = await db.webhookQueue.findMany({
      where: { endpoint: { userId: userA } },
    });
    expect(queueJobs).toHaveLength(1);
    expect(queueJobs[0].status).toBe("pending");
  });

  it("InboundEvent with NO matching endpoint → 0 deliveries", async () => {
    // Endpoint subscribes to a totally different event.
    await createEndpoint("otp.sent");

    await ingestEvent(buildInput());

    // No deliveries scheduled.
    const deliveries = await db.webhookDelivery.findMany({
      where: { endpoint: { userId: userA } },
    });
    expect(deliveries).toHaveLength(0);

    const queueJobs = await db.webhookQueue.findMany({
      where: { endpoint: { userId: userA } },
    });
    expect(queueJobs).toHaveLength(0);
  });

  it("InboundEvent idempotent replay → 0 duplicate deliveries (dedupeKey enforced)", async () => {
    await createEndpoint("nixify.event.received");

    const input = buildInput();

    // First ingest creates the event + schedules the webhook.
    const r1 = await ingestEvent(input);
    expect(r1.replay).toBe(false);

    // Second ingest with SAME idempotency key + same body → replay (no new event).
    const r2 = await ingestEvent(input);
    expect(r2.replay).toBe(true);
    expect(r2.eventId).toBe(r1.eventId);

    // Exactly ONE delivery — the dedupeKey on WebhookDelivery prevented the
    // duplicate schedule.
    const deliveries = await db.webhookDelivery.findMany({
      where: { endpoint: { userId: userA } },
    });
    expect(deliveries).toHaveLength(1);

    const queueJobs = await db.webhookQueue.findMany({
      where: { endpoint: { userId: userA } },
    });
    expect(queueJobs).toHaveLength(1);
  });

  it("No inline fetch during POST /api/v1/events (mock fetch, assert NOT called during ingestEvent)", async () => {
    // Endpoint exists and matches — webhook delivery SHOULD be scheduled.
    await createEndpoint("nixify.event.received");

    await ingestEvent(buildInput());

    // CRITICAL: the request must NOT make inline HTTP calls. Delivery is
    // strictly async via the queue processor (section 11 durable-only
    // dispatch). The mocked fetch must have ZERO calls.
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Concurrent identical events → exactly 1 delivery per endpoint", async () => {
    await createEndpoint("nixify.event.received");

    const input = buildInput();

    // Fire 2 concurrent ingests with the same idempotency key + body.
    const [r1, r2] = await Promise.all([
      ingestEvent(input),
      ingestEvent(input),
    ]);

    // At most one of them created the event (the other hit P2002 + replayed).
    expect(r1.eventId).toBe(r2.eventId);
    const createdOne = r1.replay === false || r2.replay === false;
    expect(createdOne).toBe(true);

    // Exactly ONE delivery row — concurrent identical events did NOT create
    // duplicates thanks to the dedupeKey on WebhookDelivery.
    const deliveries = await db.webhookDelivery.findMany({
      where: { endpoint: { userId: userA } },
    });
    expect(deliveries).toHaveLength(1);

    const queueJobs = await db.webhookQueue.findMany({
      where: { endpoint: { userId: userA } },
    });
    expect(queueJobs).toHaveLength(1);
  });

  it("Wildcard endpoint (events='*') receives nixify.event.received", async () => {
    await createEndpoint("*");

    await ingestEvent(buildInput());

    const deliveries = await db.webhookDelivery.findMany({
      where: { endpoint: { userId: userA } },
    });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].eventId).toBe("nixify.event.received");
  });
});
