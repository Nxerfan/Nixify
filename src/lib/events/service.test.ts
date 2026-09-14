import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { upsertContact } from "@/lib/contacts";
import {
  ingestEvent,
  EventValidationError,
  IdempotencyConflictError,
  type IngestEventInput,
} from "@/lib/events/service";

/**
 * Events Service — DB integration tests (Phase 6).
 *
 * This file is GATED — only runs when RUN_EVENTS_INTEGRATION=1 AND a
 * TEST_DATABASE_URL is supplied. The (future) `test:events` script will set
 * both. Generic `bun run test` skips this file silently (no DB available).
 * Mirrors the gate pattern of src/lib/messaging/service.test.ts
 * (RUN_MESSAGING_INTEGRATION) and src/lib/automation/processor.test.ts
 * (RUN_AUTOMATION_INTEGRATION).
 *
 * The events service has NO external side effects (no SMTP, no automation,
 * no webhooks) — so unlike messaging/automation, no provider mock is needed.
 * The only module mocked here is `@/lib/dx/webhooks` (deliverWebhook), purely
 * as a defensive guard against future regressions (the events service must
 * NEVER trigger webhook delivery — section 18).
 *
 * Coverage (per task spec):
 *
 * Persistence:
 * - successful ingest persists InboundEvent with correct fields (eventId UUID,
 *   type, email normalized, environment, data, source="api_v1",
 *   idempotencyKeyHash, requestFingerprint)
 * - normalized email stored (uppercase input → lowercase stored)
 * - API-key environment stored (development/production preserved)
 * - event public UUID generated (matches UUID v4 format)
 * - existing Contact linked (contactId set when Contact matches userId+email)
 * - missing Contact → contactId = null (NO auto-create)
 * - Contact fields remain unchanged (name, attributes, source, marketingStatus)
 * - data stored exactly as provided (canonical JSON semantics)
 *
 * Idempotency:
 * - same Idempotency-Key + same request → one event, second call returns
 *   replay=true, same event_id
 * - same key + same semantic object with DIFFERENT JSON key ordering in data
 *   → replay (fingerprint is order-independent)
 * - same key + different event type → IdempotencyConflictError
 * - same key + different email → IdempotencyConflictError
 * - same key + different data → IdempotencyConflictError
 * - concurrent duplicates (Promise.all of 2 ingestEvent calls with same
 *   key+body) → exactly ONE InboundEvent row, both callers get the same
 *   event_id, one created + one replay
 * - same event body + DIFFERENT idempotency keys → two legitimate events
 *   (both created, different event_ids)
 * - plaintext Idempotency-Key NEVER stored (idempotencyKeyHash is a 64-char
 *   hex SHA-256, NOT the plaintext key)
 *
 * Validation (service-level, not route):
 * - valid custom event type accepted ("order.completed", "user.signup",
 *   "custom.event")
 * - reserved event type rejected (otp./email./contact./automation./system./
 *   nixify. prefixes) → EventValidationError("reserved_event_type")
 * - invalid type rejected (whitespace-only, too long, illegal chars)
 * - invalid email rejected (no @, empty)
 * - data must be object (null/array/string/number/boolean rejected)
 * - empty object {} accepted
 * - oversized data rejected (>32KB)
 * - excessive nesting rejected (depth > 8)
 * - dangerous keys rejected recursively (__proto__/prototype/constructor,
 *   even nested)
 *
 * Side effects (assert NONE happen):
 * - no EmailMessage created
 * - no JobQueue automation job created
 * - no ContactEvent created
 * - no Contact created (no auto-create)
 * - no webhook delivery (deliverWebhook not called, no WebhookDelivery row)
 */

// ---- Mocks (hoisted by vitest before imports) -----------------------------
//
// Mock the webhooks module purely as a defensive regression guard. The events
// service MUST NOT trigger webhook delivery (section 18). If a future change
// adds `import { deliverWebhook } from "@/lib/dx/webhooks"` to the service,
// the spy below would catch it — but even without an import, asserting
// `not.toHaveBeenCalled()` documents the contract.
vi.mock("@/lib/dx/webhooks", () => ({
  deliverWebhook: vi.fn(),
}));

import { deliverWebhook } from "@/lib/dx/webhooks";

// ---- Gate: skip silently when RUN_EVENTS_INTEGRATION is not set -----------

const RUN = process.env.RUN_EVENTS_INTEGRATION === "1";

// UUID v4 strict regex (Prisma @default(uuid()) uses crypto.randomUUID()).
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// SHA-256 hex (64 lowercase hex chars).
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

describe.skipIf(!RUN)("Events Service — DB integration", () => {
  let userA: number;
  let userB: number;
  let setupComplete = false;

  // Shared sentinel for idempotency-key uniqueness across tests.
  let keyCounter = 0;
  function uniqueKey(prefix: string): string {
    keyCounter += 1;
    return `${prefix}-${keyCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  beforeAll(async () => {
    // Verify DB connectivity.
    await db.$queryRaw`SELECT 1`;

    // Clean up any leftover test data from previous runs.
    await db.inboundEvent.deleteMany({
      where: { user: { email: { contains: "events-test-" } } },
    });
    await db.emailMessage.deleteMany({
      where: { user: { email: { contains: "events-test-" } } },
    });
    await db.contactEvent.deleteMany({
      where: { contact: { user: { email: { contains: "events-test-" } } } },
    });
    await db.jobQueue.deleteMany({
      where: { user: { email: { contains: "events-test-" } } },
    });
    await db.contact.deleteMany({
      where: { user: { email: { contains: "events-test-" } } },
    });
    await db.user.deleteMany({
      where: { email: { contains: "events-test-" } },
    });

    // Create two test users with plan="PRO" so EVENTS_API access=true.
    // (Even though the service itself does not call canAccess — the route
    // does — these fixtures mirror the messaging/automation tests and can
    // be reused in route-level tests later.)
    const a = await db.user.create({
      data: {
        email: "events-test-a@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userA = a.id;

    const b = await db.user.create({
      data: {
        email: "events-test-b@nixify-test.com",
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

    // Reset the deliverWebhook spy between tests.
    vi.mocked(deliverWebhook).mockReset();

    // Clean tables between tests so idempotency-key hashes don't collide
    // across tests and Contact fixtures don't bleed.
    await db.inboundEvent.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.emailMessage.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contactEvent.deleteMany({
      where: { contact: { userId: { in: [userA, userB] } } },
    });
    await db.jobQueue.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contact.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
  });

  afterAll(async () => {
    if (!setupComplete) {
      await db.$disconnect();
      return;
    }
    // Clean up everything we created.
    await db.inboundEvent.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.emailMessage.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contactEvent.deleteMany({
      where: { contact: { userId: { in: [userA, userB] } } },
    });
    await db.jobQueue.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contact.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await db.$disconnect();
  });

  // ---- Helpers ------------------------------------------------------------

  /** Build a valid IngestEventInput with a fresh idempotency key. */
  function buildIngest(opts: Partial<IngestEventInput> = {}): IngestEventInput {
    return {
      userId: opts.userId ?? userA,
      type: opts.type ?? "order.completed",
      email: opts.email ?? "alice@example.com",
      data: opts.data ?? { amount: 42, currency: "USD" },
      environment: opts.environment ?? "production",
      idempotencyKey: opts.idempotencyKey ?? uniqueKey("test-key"),
      requestId: opts.requestId ?? "req-test-1",
    };
  }

  // ===== Persistence =======================================================

  it("successful ingest persists InboundEvent with correct fields (eventId UUID, type, email normalized, environment, data, source=api_v1, idempotencyKeyHash, requestFingerprint)", async () => {
    const input = buildIngest({
      type: "order.completed",
      email: "Alice@Example.com",
      data: { amount: 42, currency: "USD" },
      environment: "production",
      requestId: "req-abc-123",
    });
    const result = await ingestEvent(input);

    expect(result.replay).toBe(false);
    expect(result.conflict).toBe(false);
    expect(result.eventId).toMatch(UUID_V4_RE);
    expect(result.type).toBe("order.completed");
    expect(result.email).toBe("alice@example.com");
    expect(result.environment).toBe("production");

    // Verify the persisted row.
    const row = await db.inboundEvent.findFirst({
      where: { userId: userA, eventId: result.eventId },
    });
    expect(row).not.toBeNull();
    expect(row!.eventId).toBe(result.eventId);
    expect(row!.eventId).toMatch(UUID_V4_RE);
    expect(row!.userId).toBe(userA);
    expect(row!.contactId).toBeNull(); // no Contact exists for this email
    expect(row!.type).toBe("order.completed");
    expect(row!.email).toBe("alice@example.com"); // normalized
    expect(row!.environment).toBe("production");
    expect(row!.source).toBe("api_v1");
    expect(row!.requestId).toBe("req-abc-123");
    expect(row!.idempotencyKeyHash).toMatch(SHA256_HEX_RE);
    expect(row!.requestFingerprint).toMatch(SHA256_HEX_RE);
    expect(row!.data).toEqual({ amount: 42, currency: "USD" });
    expect(row!.createdAt).toBeInstanceOf(Date);
  });

  it("normalized email stored (uppercase input → lowercase stored)", async () => {
    const result = await ingestEvent(buildIngest({
      email: "BOB.SMITH@EXAMPLE.COM",
      type: "user.signup",
    }));

    const row = await db.inboundEvent.findFirst({
      where: { userId: userA, eventId: result.eventId },
    });
    expect(row!.email).toBe("bob.smith@example.com");
    expect(result.email).toBe("bob.smith@example.com");
  });

  it("API-key environment stored (development and production preserved)", async () => {
    // development
    const devResult = await ingestEvent(buildIngest({
      environment: "development",
      type: "dev.event",
      email: "dev@example.com",
    }));
    expect(devResult.environment).toBe("development");
    const devRow = await db.inboundEvent.findFirst({
      where: { userId: userA, eventId: devResult.eventId },
    });
    expect(devRow!.environment).toBe("development");

    // production
    const prodResult = await ingestEvent(buildIngest({
      environment: "production",
      type: "prod.event",
      email: "prod@example.com",
    }));
    expect(prodResult.environment).toBe("production");
    const prodRow = await db.inboundEvent.findFirst({
      where: { userId: userA, eventId: prodResult.eventId },
    });
    expect(prodRow!.environment).toBe("production");
  });

  it("event public UUID generated (matches UUID v4 format)", async () => {
    // Generate a few events and assert each eventId is a UUID v4.
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await ingestEvent(buildIngest({
        type: "bulk.event",
        email: `bulk-${i}@example.com`,
      }));
      expect(r.eventId).toMatch(UUID_V4_RE);
      ids.push(r.eventId);
    }
    // All generated UUIDs are unique.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("existing Contact linked (contactId set when Contact matches userId+email)", async () => {
    const email = "linked@example.com";
    const contactResult = await upsertContact(userA, {
      email,
      name: "Linked User",
      attributes: { plan: "pro" },
    });
    expect(contactResult.created).toBe(true);
    const contactId = contactResult.contact.id;

    const result = await ingestEvent(buildIngest({
      email,
      type: "user.signup",
    }));

    const row = await db.inboundEvent.findFirst({
      where: { userId: userA, eventId: result.eventId },
    });
    expect(row!.contactId).toBe(contactId);
  });

  it("missing Contact → contactId = null (NO auto-create)", async () => {
    const email = "stranger@example.com";
    // Verify no Contact exists beforehand.
    const beforeCount = await db.contact.count({
      where: { userId: userA, email },
    });
    expect(beforeCount).toBe(0);

    const result = await ingestEvent(buildIngest({
      email,
      type: "user.signup",
    }));

    const row = await db.inboundEvent.findFirst({
      where: { userId: userA, eventId: result.eventId },
    });
    expect(row!.contactId).toBeNull();

    // Verify NO Contact was auto-created as a side effect.
    const afterCount = await db.contact.count({
      where: { userId: userA, email },
    });
    expect(afterCount).toBe(0);
  });

  it("Contact fields remain unchanged (name, attributes, source, marketingStatus — ingest does NOT modify them)", async () => {
    const email = "stable@example.com";
    const created = await upsertContact(userA, {
      email,
      name: "Stable Name",
      attributes: { tier: "gold", region: "eu" },
      source: "dashboard",
    });
    const contactBefore = await db.contact.findUnique({
      where: { id: created.contact.id },
    });
    expect(contactBefore).not.toBeNull();

    // Ingest an event for this contact.
    await ingestEvent(buildIngest({
      email,
      type: "order.completed",
      data: { amount: 100 },
    }));

    const contactAfter = await db.contact.findUnique({
      where: { id: created.contact.id },
    });
    expect(contactAfter!.name).toBe(contactBefore!.name);
    expect(contactAfter!.attributes).toEqual(contactBefore!.attributes);
    expect(contactAfter!.source).toBe(contactBefore!.source);
    expect(contactAfter!.marketingStatus).toBe(contactBefore!.marketingStatus);
    expect(contactAfter!.marketingConsentSource).toBe(contactBefore!.marketingConsentSource);
    expect(contactAfter!.marketingConsentAt).toEqual(contactBefore!.marketingConsentAt);
    expect(contactAfter!.updatedAt).toEqual(contactBefore!.updatedAt);
  });

  it("data stored exactly as provided (canonical JSON semantics)", async () => {
    const data = {
      orderId: "ord_123",
      items: [
        { sku: "ABC", qty: 2, price: 9.99 },
        { sku: "XYZ", qty: 1, price: 49.99 },
      ],
      customer: { name: "Alice", email: "alice@example.com" },
      tags: ["vip", "repeat"],
      metadata: { source: "web", campaign: "spring2026" },
    };
    const result = await ingestEvent(buildIngest({
      type: "order.completed",
      data,
    }));

    const row = await db.inboundEvent.findFirst({
      where: { userId: userA, eventId: result.eventId },
    });
    expect(row!.data).toEqual(data);

    // The data is stored as a JSON object — deep equality, not reference
    // equality. Verify nested values are preserved exactly.
    const stored = row!.data as Record<string, unknown>;
    expect(stored.orderId).toBe("ord_123");
    expect(Array.isArray(stored.items)).toBe(true);
    expect((stored.items as Array<unknown>).length).toBe(2);
    expect(stored.customer).toEqual({ name: "Alice", email: "alice@example.com" });
    expect(stored.tags).toEqual(["vip", "repeat"]);
  });

  // ===== Idempotency =======================================================

  it("same Idempotency-Key + same request → one event, second call returns replay=true, same event_id", async () => {
    const key = uniqueKey("replay-key");
    const input = buildIngest({
      idempotencyKey: key,
      type: "order.completed",
      email: "alice@example.com",
      data: { amount: 42 },
    });

    const r1 = await ingestEvent(input);
    expect(r1.replay).toBe(false);

    const r2 = await ingestEvent(input);
    expect(r2.replay).toBe(true);
    expect(r2.eventId).toBe(r1.eventId);

    // Exactly ONE InboundEvent row exists.
    const rows = await db.inboundEvent.findMany({
      where: { userId: userA, type: "order.completed" },
    });
    expect(rows.length).toBe(1);
  });

  it("same key + same semantic object with DIFFERENT JSON key ordering in data → replay (fingerprint is order-independent)", async () => {
    const key = uniqueKey("order-indep");
    const baseInput = {
      userId: userA,
      type: "order.completed",
      email: "alice@example.com",
      environment: "production",
      idempotencyKey: key,
      requestId: "req-order",
    } as const;

    // First call: {a:1,b:2}
    const r1 = await ingestEvent({
      ...baseInput,
      data: { a: 1, b: 2 },
    });
    expect(r1.replay).toBe(false);

    // Second call: same key, same semantic content but keys in DIFFERENT order.
    // The fingerprint is order-independent (canonicalize sorts keys), so this
    // must be a REPLAY, not a conflict.
    const r2 = await ingestEvent({
      ...baseInput,
      data: { b: 2, a: 1 },
    });
    expect(r2.replay).toBe(true);
    expect(r2.eventId).toBe(r1.eventId);

    // Exactly ONE row.
    const rows = await db.inboundEvent.findMany({
      where: { userId: userA, type: "order.completed" },
    });
    expect(rows.length).toBe(1);
  });

  it("same key + different event type → IdempotencyConflictError", async () => {
    const key = uniqueKey("conflict-type");

    const r1 = await ingestEvent(buildIngest({
      idempotencyKey: key,
      type: "order.completed",
      email: "alice@example.com",
    }));
    expect(r1.replay).toBe(false);

    // Same key, DIFFERENT type → different fingerprint → conflict.
    await expect(
      ingestEvent(buildIngest({
        idempotencyKey: key,
        type: "order.refunded", // different type
        email: "alice@example.com",
      })),
    ).rejects.toThrow(IdempotencyConflictError);

    // Only the FIRST event exists.
    const allRows = await db.inboundEvent.findMany({
      where: { userId: userA, email: "alice@example.com" },
    });
    expect(allRows.length).toBe(1);
    expect(allRows[0].type).toBe("order.completed");
  });

  it("same key + different email → IdempotencyConflictError", async () => {
    const key = uniqueKey("conflict-email");

    const r1 = await ingestEvent(buildIngest({
      idempotencyKey: key,
      type: "order.completed",
      email: "alice@example.com",
    }));
    expect(r1.replay).toBe(false);

    await expect(
      ingestEvent(buildIngest({
        idempotencyKey: key,
        type: "order.completed",
        email: "bob@example.com", // different email
      })),
    ).rejects.toThrow(IdempotencyConflictError);

    const allRows = await db.inboundEvent.findMany({
      where: { userId: userA, type: "order.completed" },
    });
    expect(allRows.length).toBe(1);
    expect(allRows[0].email).toBe("alice@example.com");
  });

  it("same key + different data → IdempotencyConflictError", async () => {
    const key = uniqueKey("conflict-data");

    const r1 = await ingestEvent(buildIngest({
      idempotencyKey: key,
      type: "order.completed",
      email: "alice@example.com",
      data: { amount: 42 },
    }));
    expect(r1.replay).toBe(false);

    await expect(
      ingestEvent(buildIngest({
        idempotencyKey: key,
        type: "order.completed",
        email: "alice@example.com",
        data: { amount: 999 }, // different data → different fingerprint
      })),
    ).rejects.toThrow(IdempotencyConflictError);

    const allRows = await db.inboundEvent.findMany({
      where: { userId: userA, type: "order.completed" },
    });
    expect(allRows.length).toBe(1);
    const stored = allRows[0].data as Record<string, unknown>;
    expect(stored.amount).toBe(42);
  });

  it("concurrent duplicates (Promise.all of 2 ingestEvent calls with same key+body) → exactly ONE InboundEvent row, both callers get the same event_id, one created + one replay", async () => {
    const key = uniqueKey("concurrent-key");
    const input: IngestEventInput = {
      userId: userA,
      type: "order.completed",
      email: "alice@example.com",
      data: { amount: 42 },
      environment: "production",
      idempotencyKey: key,
      requestId: "req-concurrent",
    };

    // Fire two concurrent ingests with the SAME key + same body.
    // The unique constraint (userId, idempotencyKeyHash) is the atomic claim.
    // One will win the insert; the other will hit P2002 and replay.
    const [r1, r2] = await Promise.all([
      ingestEvent(input),
      ingestEvent(input),
    ]);

    // Both calls succeed (no rejection). Exactly one created, one replay.
    const createdResults = [r1, r2].filter((r) => !r.replay);
    const replayResults = [r1, r2].filter((r) => r.replay);
    expect(createdResults.length).toBe(1);
    expect(replayResults.length).toBe(1);

    // Both callers get the same event_id (the existing row).
    expect(r1.eventId).toBe(r2.eventId);

    // Exactly ONE InboundEvent row in the DB.
    const rows = await db.inboundEvent.findMany({
      where: { userId: userA, type: "order.completed" },
    });
    expect(rows.length).toBe(1);
    expect(rows[0].eventId).toBe(r1.eventId);
  });

  it("same event body + DIFFERENT idempotency keys → two legitimate events (both created, different event_ids)", async () => {
    const key1 = uniqueKey("distinct-1");
    const key2 = uniqueKey("distinct-2");

    const sharedBody = {
      userId: userA,
      type: "order.completed",
      email: "alice@example.com",
      data: { amount: 42 },
      environment: "production",
    } as const;

    const r1 = await ingestEvent({ ...sharedBody, idempotencyKey: key1 });
    const r2 = await ingestEvent({ ...sharedBody, idempotencyKey: key2 });

    expect(r1.replay).toBe(false);
    expect(r2.replay).toBe(false);
    expect(r1.eventId).not.toBe(r2.eventId);
    expect(r1.eventId).toMatch(UUID_V4_RE);
    expect(r2.eventId).toMatch(UUID_V4_RE);

    // Two distinct InboundEvent rows.
    const rows = await db.inboundEvent.findMany({
      where: { userId: userA, type: "order.completed" },
    });
    expect(rows.length).toBe(2);
    const eventIds = rows.map((r) => r.eventId);
    expect(eventIds).toContain(r1.eventId);
    expect(eventIds).toContain(r2.eventId);
  });

  it("plaintext Idempotency-Key NEVER stored (idempotencyKeyHash is a 64-char hex SHA-256, NOT the plaintext key)", async () => {
    const plaintextKey = uniqueKey("secret-plaintext-key");
    const result = await ingestEvent(buildIngest({
      idempotencyKey: plaintextKey,
    }));

    const row = await db.inboundEvent.findFirst({
      where: { userId: userA, eventId: result.eventId },
    });

    // idempotencyKeyHash is a 64-char lowercase hex SHA-256.
    expect(row!.idempotencyKeyHash).toMatch(SHA256_HEX_RE);
    expect(row!.idempotencyKeyHash).toHaveLength(64);

    // The plaintext key must NEVER appear in ANY column of the row.
    for (const [key, val] of Object.entries(row as Record<string, unknown>)) {
      if (typeof val === "string") {
        expect(val).not.toContain(plaintextKey);
      }
    }
  });

  // ===== Validation (service-level) ========================================

  it("valid custom event type accepted (e.g. order.completed, user.signup, custom.event)", async () => {
    const types = ["order.completed", "user.signup", "custom.event", "click", "a:b.c-d"];
    for (const type of types) {
      const r = await ingestEvent(buildIngest({
        type,
        email: `valid-${type.replace(/[^a-z0-9]/gi, "-")}@example.com`,
        idempotencyKey: uniqueKey(`valid-${type}`),
      }));
      expect(r.replay).toBe(false);
      expect(r.type).toBe(type);

      const row = await db.inboundEvent.findFirst({
        where: { userId: userA, eventId: r.eventId },
      });
      expect(row!.type).toBe(type);
    }
  });

  it("reserved event type rejected (otp.verified, email.sent, contact.created, automation.welcome, system.init, nixify.internal) → EventValidationError(reserved_event_type)", async () => {
    const reserved = [
      "otp.verified",
      "email.sent",
      "contact.created",
      "automation.welcome",
      "system.init",
      "nixify.internal",
    ];
    for (const type of reserved) {
      await expect(
        ingestEvent(buildIngest({
          type,
          idempotencyKey: uniqueKey(`reserved-${type}`),
        })),
      ).rejects.toMatchObject({
        name: "EventValidationError",
        code: "reserved_event_type",
      });
    }

    // No InboundEvent was created for any of the reserved types.
    const rows = await db.inboundEvent.findMany({
      where: { userId: userA, type: { in: reserved } },
    });
    expect(rows.length).toBe(0);
  });

  it("invalid type rejected (whitespace-only, too long, illegal chars)", async () => {
    // Whitespace-only — after zod's .trim() it's empty → min(1) fails.
    await expect(
      ingestEvent(buildIngest({ type: "    " })),
    ).rejects.toMatchObject({
      name: "EventValidationError",
      code: "validation_failed",
    });

    // Too long — 101 chars exceeds MAX_EVENT_TYPE_LENGTH (100).
    await expect(
      ingestEvent(buildIngest({ type: "a".repeat(101) })),
    ).rejects.toMatchObject({
      name: "EventValidationError",
      code: "validation_failed",
    });

    // Illegal chars — spaces are not allowed by the regex.
    await expect(
      ingestEvent(buildIngest({ type: "type with spaces" })),
    ).rejects.toMatchObject({
      name: "EventValidationError",
      code: "validation_failed",
    });

    // Illegal chars — `@` not in [a-zA-Z0-9._:-].
    await expect(
      ingestEvent(buildIngest({ type: "type@with@at" })),
    ).rejects.toMatchObject({
      name: "EventValidationError",
      code: "validation_failed",
    });

    // No InboundEvent created for any invalid type.
    const rows = await db.inboundEvent.findMany({
      where: {
        userId: userA,
        type: { in: ["    ", "a".repeat(101), "type with spaces", "type@with@at"] },
      },
    });
    expect(rows.length).toBe(0);
  });

  it("invalid email rejected (no @, empty)", async () => {
    // No @ — fails the EMAIL_RE refine.
    await expect(
      ingestEvent(buildIngest({ email: "notanemail" })),
    ).rejects.toMatchObject({
      name: "EventValidationError",
      code: "validation_failed",
    });

    // Empty — fails zod min(1).
    await expect(
      ingestEvent(buildIngest({ email: "" })),
    ).rejects.toMatchObject({
      name: "EventValidationError",
      code: "validation_failed",
    });

    // Missing domain TLD — fails EMAIL_RE (no `.` after @).
    await expect(
      ingestEvent(buildIngest({ email: "alice@example" })),
    ).rejects.toMatchObject({
      name: "EventValidationError",
      code: "validation_failed",
    });

    // No InboundEvent created with an invalid email.
    const rows = await db.inboundEvent.findMany({
      where: { userId: userA, email: { in: ["notanemail", "", "alice@example"] } },
    });
    expect(rows.length).toBe(0);
  });

  it("data must be object (null rejected, array rejected, string rejected, number rejected, boolean rejected)", async () => {
    const invalidValues: unknown[] = [null, [1, 2, 3], "not-an-object", 42, true];
    for (const data of invalidValues) {
      await expect(
        ingestEvent(buildIngest({
          data,
          idempotencyKey: uniqueKey(`invalid-data-${typeof data}`),
        })),
      ).rejects.toMatchObject({
        name: "EventValidationError",
        code: "validation_failed",
      });
    }
    // No InboundEvent created.
    const rows = await db.inboundEvent.findMany({
      where: { userId: userA, type: "order.completed" },
    });
    expect(rows.length).toBe(0);
  });

  it("empty object {} accepted", async () => {
    const r = await ingestEvent(buildIngest({
      data: {},
      idempotencyKey: uniqueKey("empty-data"),
    }));
    expect(r.replay).toBe(false);

    const row = await db.inboundEvent.findFirst({
      where: { userId: userA, eventId: r.eventId },
    });
    expect(row!.data).toEqual({});
  });

  it("oversized data rejected (>32KB)", async () => {
    // 33,000 chars of "x" → serialized form > 32,768 bytes (32 KiB).
    const bigString = "x".repeat(33_000);
    const data = { big: bigString };

    await expect(
      ingestEvent(buildIngest({
        data,
        idempotencyKey: uniqueKey("oversized"),
      })),
    ).rejects.toMatchObject({
      name: "EventValidationError",
      code: "validation_failed",
    });

    // No InboundEvent created.
    const rows = await db.inboundEvent.findMany({
      where: { userId: userA, type: "order.completed" },
    });
    expect(rows.length).toBe(0);
  });

  it("excessive nesting rejected (depth > 8)", async () => {
    // Build an object nested 10 levels deep. The MAX_DATA_DEPTH is 8 — the
    // check fires when entering depth 9 (top-level is depth 0).
    function buildDeepData(levels: number): Record<string, unknown> {
      let obj: unknown = "deep_value";
      for (let i = 0; i < levels; i++) {
        obj = { nested: obj };
      }
      return obj as Record<string, unknown>;
    }

    await expect(
      ingestEvent(buildIngest({
        data: buildDeepData(10),
        idempotencyKey: uniqueKey("deep-nest"),
      })),
    ).rejects.toMatchObject({
      name: "EventValidationError",
      code: "validation_failed",
    });

    // No InboundEvent created.
    const rows = await db.inboundEvent.findMany({
      where: { userId: userA, type: "order.completed" },
    });
    expect(rows.length).toBe(0);
  });

  it("dangerous keys rejected recursively (__proto__, prototype, constructor — even nested)", async () => {
    // Top-level dangerous keys.
    await expect(
      ingestEvent(buildIngest({
        data: { __proto__: "x" },
        idempotencyKey: uniqueKey("proto-top"),
      })),
    ).rejects.toMatchObject({
      name: "EventValidationError",
      code: "validation_failed",
    });

    await expect(
      ingestEvent(buildIngest({
        data: { prototype: "x" },
        idempotencyKey: uniqueKey("proto-proto"),
      })),
    ).rejects.toMatchObject({
      name: "EventValidationError",
      code: "validation_failed",
    });

    await expect(
      ingestEvent(buildIngest({
        data: { constructor: "x" },
        idempotencyKey: uniqueKey("proto-ctor"),
      })),
    ).rejects.toMatchObject({
      name: "EventValidationError",
      code: "validation_failed",
    });

    // Nested dangerous key.
    await expect(
      ingestEvent(buildIngest({
        data: { a: { b: { __proto__: "leak" } } },
        idempotencyKey: uniqueKey("proto-nested"),
      })),
    ).rejects.toMatchObject({
      name: "EventValidationError",
      code: "validation_failed",
    });

    // No InboundEvent created.
    const rows = await db.inboundEvent.findMany({
      where: { userId: userA, type: "order.completed" },
    });
    expect(rows.length).toBe(0);
  });

  // ===== Side effects (assert NONE happen) =================================

  it("no EmailMessage created (assert db.emailMessage.count === 0 after ingest)", async () => {
    const before = await db.emailMessage.count({ where: { userId: userA } });
    expect(before).toBe(0);

    await ingestEvent(buildIngest({
      email: "side-effect@example.com",
      type: "order.completed",
    }));

    const after = await db.emailMessage.count({ where: { userId: userA } });
    expect(after).toBe(0);
  });

  it("no JobQueue automation job created (assert db.jobQueue.count === 0)", async () => {
    const before = await db.jobQueue.count({ where: { userId: userA } });
    expect(before).toBe(0);

    await ingestEvent(buildIngest({
      email: "side-effect@example.com",
      type: "order.completed",
    }));

    const after = await db.jobQueue.count({ where: { userId: userA } });
    expect(after).toBe(0);
  });

  it("no ContactEvent created by ingest (existing ContactEvents from Contact creation are OK)", async () => {
    // Even when a Contact EXISTS for the email, ingest must NOT append a
    // ContactEvent (that's a Phase 4/5 concern, not Phase 6).
    const email = "with-contact@example.com";
    await upsertContact(userA, { email, name: "With Contact" });

    // Count ContactEvents AFTER Contact creation (upsertContact creates a
    // contact.created event — that's expected). The ingest must NOT add more.
    const beforeIngest = await db.contactEvent.count({
      where: { contact: { userId: userA } },
    });

    await ingestEvent(buildIngest({
      email,
      type: "order.completed",
    }));

    const after = await db.contactEvent.count({
      where: { contact: { userId: userA } },
    });
    // Ingest must NOT have created any new ContactEvent.
    expect(after).toBe(beforeIngest);
  });

  it("no Contact created (assert no new Contact rows — only pre-existing ones)", async () => {
    // Pre-create one Contact that should remain the only Contact.
    const email = "preexisting@example.com";
    await upsertContact(userA, { email, name: "Preexisting" });
    const beforeCount = await db.contact.count({ where: { userId: userA } });
    expect(beforeCount).toBe(1);

    // Ingest an event for a DIFFERENT email — no Contact should be created.
    await ingestEvent(buildIngest({
      email: "stranger@example.com",
      type: "order.completed",
    }));

    // Also ingest an event for the EXISTING email — must not duplicate.
    await ingestEvent(buildIngest({
      email: "preexisting@example.com",
      type: "user.signup",
      idempotencyKey: uniqueKey("hit-existing"),
    }));

    const afterCount = await db.contact.count({ where: { userId: userA } });
    expect(afterCount).toBe(1);

    // And the pre-existing Contact is unchanged.
    const contact = await db.contact.findFirst({
      where: { userId: userA, email },
    });
    expect(contact!.name).toBe("Preexisting");
  });

  it("no webhook delivery (deliverWebhook not called + no WebhookDelivery row)", async () => {
    const beforeDeliveries = await db.webhookDelivery.count();
    const beforeEndpoints = await db.webhookEndpoint.count({
      where: { userId: userA },
    });
    expect(beforeEndpoints).toBe(0);

    await ingestEvent(buildIngest({
      email: "webhook-test@example.com",
      type: "order.completed",
    }));

    // The deliverWebhook spy was never called.
    expect(vi.mocked(deliverWebhook)).not.toHaveBeenCalled();

    // No WebhookDelivery row was created.
    const afterDeliveries = await db.webhookDelivery.count();
    expect(afterDeliveries).toBe(beforeDeliveries);
  });
});
