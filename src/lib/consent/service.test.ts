import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { upsertContact } from "@/lib/contacts";
import { createGroup } from "@/lib/groups/service";
import {
  subscribeContact,
  unsubscribeContact,
  suppressEmail,
  unsuppressEmail,
  unsuppressByPublicId,
  getMarketingEligibility,
  getMarketingEligibilityByEmail,
  getConsentSummary,
  getConsentHistory,
  verifyConsentHistoryChain,
  listSuppressions,
  getSuppressionByPublicId,
  hashIdempotencyKey,
  hashRequestFingerprint,
  IdempotencyConflictError,
  CONSENT_SOURCES,
  SUPPRESSION_REASONS,
  MARKETING_STATUSES,
  CONSENT_OPERATIONS,
  SUPPRESSION_OPERATIONS,
} from "@/lib/consent/service";
import {
  mintUnsubscribeToken,
  verifyUnsubscribeToken,
  tokenExposesPlaintext,
  UNSUBSCRIBE_INVALID_MESSAGE,
} from "@/lib/consent/token";
import { GET as unsubscribeGET, POST as unsubscribePOST } from "@/app/api/unsubscribe/route";

/**
 * Phase 9 — Consent & Suppression integration tests (audit revision).
 *
 * Coverage per audit feedback:
 *   - Consent transitions (applied/no_op/idempotent_replay).
 *   - Idempotency NAMESPACE: same key, different operation/target → NO wrong replay.
 *   - Idempotency CONFLICT: same key, conflicting payload → 409 thrown.
 *   - No-op semantics: same-state request, no idempotency key → NO audit row.
 *   - Canonical mutation lock: serialized concurrent operations on same target.
 *   - Consent history transition-chain coherence (event[n].prev == event[n-1].new).
 *   - Suppression history/current-state consistency.
 *   - Structural cross-tenant FK rejection (DB-level).
 *   - Opaque unsubscribe token (JWE — no plaintext exposure via base64).
 *   - Real public unsubscribe GET/POST no-enumeration route tests.
 *
 * FAIL-CLOSED: this suite is GATED — only runs when RUN_CONSENT_SUPPRESSION_INTEGRATION=1
 * AND TEST_DATABASE_URL is supplied. The script `bun run test:consent-suppression`
 * fails closed with exit 1 when TEST_DATABASE_URL is missing.
 */

const RUN = process.env.RUN_CONSENT_SUPPRESSION_INTEGRATION === "1";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe.skipIf(!RUN)("Consent & Suppression — DB integration (audit revision)", () => {
  let userA: number;
  let userB: number;
  let setupComplete = false;
  let emailCounter = 0;

  function uniqueEmail(prefix = "cs"): string {
    emailCounter += 1;
    return `${prefix}-${emailCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  }

  beforeAll(async () => {
    await db.$queryRaw`SELECT 1`;

    // Clean leftovers by email prefix.
    // ConsentMutationIdempotency has no email column, so we delete by joining
    // on userId from the cs-test- user set. We do this AFTER the user delete
    // below — but to be safe, we also delete by raw SQL here.
    await db.$executeRaw`DELETE FROM "ConsentMutationIdempotency" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%cs-test-%')`;
    await db.contactConsentEvent.deleteMany({
      where: { contact: { user: { email: { contains: "cs-test-" } } } },
    });
    await db.suppressionEvent.deleteMany({
      where: { email: { contains: "cs-test-" } },
    });
    await db.suppressionEntry.deleteMany({
      where: { email: { contains: "cs-test-" } },
    });
    await db.contactEvent.deleteMany({
      where: { contact: { user: { email: { contains: "cs-test-" } } } },
    });
    await db.contactGroupMembership.deleteMany({
      where: { group: { user: { email: { contains: "cs-test-" } } } },
    });
    await db.contact.deleteMany({
      where: { user: { email: { contains: "cs-test-" } } },
    });
    await db.group.deleteMany({
      where: { user: { email: { contains: "cs-test-" } } },
    });
    await db.user.deleteMany({
      where: { email: { contains: "cs-test-" } },
    });

    const a = await db.user.create({
      data: {
        email: "cs-test-a@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userA = a.id;

    const b = await db.user.create({
      data: {
        email: "cs-test-b@nixify-test.com",
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
    await db.consentMutationIdempotency.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contactConsentEvent.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.suppressionEvent.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.suppressionEntry.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contactEvent.deleteMany({
      where: { contact: { userId: { in: [userA, userB] } } },
    });
    await db.contactGroupMembership.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contact.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.group.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
  });

  afterAll(async () => {
    if (!setupComplete) {
      await db.$disconnect();
      return;
    }
    await db.consentMutationIdempotency.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contactConsentEvent.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.suppressionEvent.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.suppressionEntry.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contactEvent.deleteMany({
      where: { contact: { userId: { in: [userA, userB] } } },
    });
    await db.contactGroupMembership.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contact.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.group.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await db.$disconnect();
  });

  // ===== Consent transitions =========================================

  it("unknown → subscribed: explicit subscribe creates consent event + sets source + timestamp", async () => {
    const email = uniqueEmail("cs-sub");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    expect(upsert.contact.marketingStatus).toBe(MARKETING_STATUSES.UNKNOWN);
    expect(upsert.contact.marketingConsentSource).toBeNull();
    expect(upsert.contact.marketingConsentAt).toBeNull();

    const result = await subscribeContact({
      userId: userA,
      contactId,
      source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-sub-1",
      requestPayload: { reason: null },
    });

    expect(result.status).toBe("applied");
    expect(result.previousStatus).toBe(MARKETING_STATUSES.UNKNOWN);
    expect(result.newStatus).toBe(MARKETING_STATUSES.SUBSCRIBED);
    expect(result.eventId).toMatch(UUID_V4_RE);
    expect(result.contactNotFound).toBe(false);

    const fresh = await db.contact.findUnique({ where: { id: contactId } });
    expect(fresh?.marketingStatus).toBe(MARKETING_STATUSES.SUBSCRIBED);
    expect(fresh?.marketingConsentSource).toBe(CONSENT_SOURCES.DASHBOARD);
    expect(fresh?.marketingConsentAt).toBeInstanceOf(Date);

    const history = await getConsentHistory(userA, contactId);
    expect(history.total).toBe(1);
    expect(history.events[0].operation).toBe(CONSENT_OPERATIONS.SUBSCRIBE);
    expect(history.events[0].previousStatus).toBe(MARKETING_STATUSES.UNKNOWN);
    expect(history.events[0].newStatus).toBe(MARKETING_STATUSES.SUBSCRIBED);
    expect(history.events[0].source).toBe(CONSENT_SOURCES.DASHBOARD);
  });

  it("subscribed → unsubscribed: explicit unsubscribe creates consent event + suppression", async () => {
    const email = uniqueEmail("cs-unsub");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API, idempotencyKey: "k-s-1", requestPayload: { reason: null },
    });

    const result = await unsubscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API, idempotencyKey: "k-u-1", requestPayload: { reason: null },
    });

    expect(result.status).toBe("applied");
    expect(result.previousStatus).toBe(MARKETING_STATUSES.SUBSCRIBED);
    expect(result.newStatus).toBe(MARKETING_STATUSES.UNSUBSCRIBED);

    const entry = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(entry).not.toBeNull();
    expect(entry?.active).toBe(true);
    expect(entry?.reason).toBe(SUPPRESSION_REASONS.UNSUBSCRIBE);

    const history = await getConsentHistory(userA, contactId);
    expect(history.total).toBe(2);
    expect(history.events[0].newStatus).toBe(MARKETING_STATUSES.UNSUBSCRIBED);
    expect(history.events[0].operation).toBe(CONSENT_OPERATIONS.UNSUBSCRIBE);
    expect(history.events[1].newStatus).toBe(MARKETING_STATUSES.SUBSCRIBED);
    expect(history.events[1].operation).toBe(CONSENT_OPERATIONS.SUBSCRIBE);
  });

  it("unsubscribed → subscribed: explicit resubscribe lifts suppression", async () => {
    const email = uniqueEmail("cs-resub");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    await unsubscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API, idempotencyKey: "k-u-2", requestPayload: { reason: null },
    });
    const result = await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.DASHBOARD, idempotencyKey: "k-s-2", requestPayload: { reason: null },
    });

    expect(result.status).toBe("applied");
    expect(result.newStatus).toBe(MARKETING_STATUSES.SUBSCRIBED);

    const entry = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(entry?.active).toBe(false);
    expect(entry?.liftedAt).toBeInstanceOf(Date);

    const history = await getConsentHistory(userA, contactId);
    expect(history.total).toBe(2);
    expect(history.events[0].newStatus).toBe(MARKETING_STATUSES.SUBSCRIBED);
    expect(history.events[0].operation).toBe(CONSENT_OPERATIONS.SUBSCRIBE);
    expect(history.events[1].newStatus).toBe(MARKETING_STATUSES.UNSUBSCRIBED);
    expect(history.events[1].operation).toBe(CONSENT_OPERATIONS.UNSUBSCRIBE);
  });

  // ===== Idempotency namespace (audit BLOCKER #6) ====================

  it("repeated subscribe with same idempotency key: idempotent replay, no duplicate history", async () => {
    const email = uniqueEmail("cs-idem-sub");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    const r1 = await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API, idempotencyKey: "k-idem-1", requestPayload: { reason: null },
    });
    const r2 = await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API, idempotencyKey: "k-idem-1", requestPayload: { reason: null },
    });

    expect(r1.status).toBe("applied");
    expect(r2.status).toBe("idempotent_replay");
    expect(r2.eventId).toBe(r1.eventId);

    const history = await getConsentHistory(userA, contactId);
    expect(history.total).toBe(1);
  });

  it("BLOCKER #6: same idempotency key, DIFFERENT contact → NOT wrong replay (target mismatch)", async () => {
    const email1 = uniqueEmail("cs-ns-1");
    const email2 = uniqueEmail("cs-ns-2");
    const upsert1 = await upsertContact(userA, { email: email1, source: "api" });
    const upsert2 = await upsertContact(userA, { email: email2, source: "api" });

    // Subscribe contact 1 with key K.
    const r1 = await subscribeContact({
      userId: userA, contactId: upsert1.contact.id, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-ns-shared", requestPayload: { reason: null },
    });
    expect(r1.status).toBe("applied");
    expect(r1.contactNotFound).toBe(false);

    // Subscribe contact 2 with the SAME key. Must NOT return r1's eventId.
    let r2;
    try {
      r2 = await subscribeContact({
        userId: userA, contactId: upsert2.contact.id, source: CONSENT_SOURCES.API,
        idempotencyKey: "k-ns-shared", requestPayload: { reason: null },
      });
    } catch (err) {
      // The service SHOULD throw IdempotencyConflictError because the key
      // is bound to a different target.
      expect(err).toBeInstanceOf(IdempotencyConflictError);
      return;
    }
    // If we got here without throwing, r2 must NOT be a wrong replay of r1.
    expect(r2.eventId).not.toBe(r1.eventId);
  });

  it("BLOCKER #6: same idempotency key, DIFFERENT operation → NOT wrong replay (operation mismatch)", async () => {
    const email = uniqueEmail("cs-op-mix");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    // Subscribe with key K.
    await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-op-shared", requestPayload: { reason: null },
    });

    // Unsubscribe with the SAME key. The unique namespace is
    // (userId, operation, idempotencyKeyHash), so "unsubscribe" + K is a
    // DIFFERENT namespace than "subscribe" + K — no replay. This MUST succeed
    // as a fresh unsubscribe (not return the subscribe's eventId).
    const r = await unsubscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-op-shared", requestPayload: { reason: null },
    });
    expect(r.status).toBe("applied");
    expect(r.newStatus).toBe(MARKETING_STATUSES.UNSUBSCRIBED);

    const history = await getConsentHistory(userA, contactId);
    expect(history.total).toBe(2);
    // The two events have different eventId (different operations).
    expect(history.events[0].eventId).not.toBe(history.events[1].eventId);
    expect(history.events[0].operation).toBe(CONSENT_OPERATIONS.UNSUBSCRIBE);
    expect(history.events[1].operation).toBe(CONSENT_OPERATIONS.SUBSCRIBE);
  });

  it("BLOCKER #6: same idempotency key, same operation+target, CONFLICTING payload → IdempotencyConflictError", async () => {
    const email = uniqueEmail("cs-conf");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    // First call with payload { reason: "A" }.
    await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-conflict", requestPayload: { reason: "A" },
    });

    // Second call with same key, same target, but different payload { reason: "B" }.
    await expect(
      subscribeContact({
        userId: userA, contactId, source: CONSENT_SOURCES.API,
        idempotencyKey: "k-conflict", requestPayload: { reason: "B" },
      }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  // ===== No-op audit semantics (audit #16) ==========================

  it("BLOCKER #16: same-state repeated request WITHOUT idempotency key → NO fake transition event", async () => {
    const email = uniqueEmail("cs-noop");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    // Subscribe once — creates an event.
    await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-noop-1", requestPayload: { reason: null },
    });

    // Subscribe again WITHOUT an idempotency key. Already subscribed → no_op,
    // and NO new audit row.
    const r = await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      // No idempotencyKey.
      requestPayload: { reason: null },
    });
    expect(r.status).toBe("no_op");
    expect(r.eventId).toBeNull();

    const history = await getConsentHistory(userA, contactId);
    expect(history.total).toBe(1); // Only the first transition.
  });

  it("BLOCKER #17: suppress already-active entry with same reason, no idempotency key → NO fake transition", async () => {
    const email = uniqueEmail("cs-sup-noop");
    await upsertContact(userA, { email, source: "api" });

    await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-sup-noop-1", requestPayload: { email, reason: "manual" },
    });

    // Suppress again WITHOUT idempotency key. Same reason, already active → no_op.
    const r = await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      requestPayload: { email, reason: "manual" },
    });
    expect(r.status).toBe("no_op");

    const events = await db.suppressionEvent.findMany({
      where: { userId: userA, email },
    });
    expect(events.length).toBe(1);
  });

  // ===== Cross-tenant isolation (structural FK) ====================

  it("BLOCKER #12: cross-tenant consent event insert REJECTED by composite FK", async () => {
    const email = uniqueEmail("cs-struct");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    // Attempt to insert a ConsentEvent with userId=userB but contactId=userA's contact.
    // The composite FK (userId, contactId) → Contact(userId, id) MUST reject this.
    await expect(
      db.contactConsentEvent.create({
        data: {
          userId: userB, // WRONG tenant
          contactId, // userA's contact
          operation: CONSENT_OPERATIONS.SUBSCRIBE,
          previousStatus: MARKETING_STATUSES.UNKNOWN,
          newStatus: MARKETING_STATUSES.SUBSCRIBED,
          source: CONSENT_SOURCES.SYSTEM,
        },
      }),
    ).rejects.toThrow();
  });

  it("cross-tenant isolation: userB cannot subscribe userA's contact", async () => {
    const email = uniqueEmail("cs-iso");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    const result = await subscribeContact({
      userId: userB, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-iso-1", requestPayload: { reason: null },
    });

    expect(result.contactNotFound).toBe(true);
    expect(result.eventId).toBeNull();

    const fresh = await db.contact.findUnique({ where: { id: contactId } });
    expect(fresh?.marketingStatus).toBe(MARKETING_STATUSES.UNKNOWN);
    expect(fresh?.marketingConsentSource).toBeNull();
  });

  it("cross-tenant isolation: userB cannot lift userA's suppression by public ID", async () => {
    const email = uniqueEmail("cs-iso-lift");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    await unsubscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-iso-3", requestPayload: { reason: null },
    });
    const entry = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(entry).not.toBeNull();

    const result = await unsuppressByPublicId(userB, entry!.suppressionId, CONSENT_SOURCES.DASHBOARD);
    expect(result.status).toBe("not_suppressed");

    const stillActive = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(stillActive?.active).toBe(true);
  });

  // ===== Suppression model + audit history ========================

  it("manual suppress: creates SuppressionEntry + SuppressionEvent + audit history", async () => {
    const email = uniqueEmail("cs-sup");
    await upsertContact(userA, { email, source: "api" });

    const result = await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-sup-1", requestPayload: { email, reason: "manual" },
    });

    expect(result.status).toBe("applied");
    expect(result.active).toBe(true);
    expect(result.suppressionId).toMatch(UUID_V4_RE);

    const entry = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(entry?.active).toBe(true);
    expect(entry?.reason).toBe(SUPPRESSION_REASONS.MANUAL);

    const events = await db.suppressionEvent.findMany({
      where: { userId: userA, email },
    });
    expect(events.length).toBe(1);
    expect(events[0].operation).toBe(SUPPRESSION_OPERATIONS.SUPPRESS);
    expect(events[0].action).toBe("suppressed");
  });

  it("lift suppression: deactivates entry + preserves audit history", async () => {
    const email = uniqueEmail("cs-lift");
    await upsertContact(userA, { email, source: "api" });

    await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-lift-1", requestPayload: { email, reason: "manual" },
    });
    const result = await unsuppressEmail({
      userId: userA, email, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-lift-2", requestPayload: { email },
    });

    expect(result.status).toBe("applied");
    expect(result.active).toBe(false);

    const entry = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(entry?.active).toBe(false);
    expect(entry?.liftedAt).toBeInstanceOf(Date);

    const events = await db.suppressionEvent.findMany({
      where: { userId: userA, email },
      orderBy: { createdAt: "asc" },
    });
    expect(events.length).toBe(2);
    expect(events[0].operation).toBe(SUPPRESSION_OPERATIONS.SUPPRESS);
    expect(events[0].action).toBe("suppressed");
    expect(events[1].operation).toBe(SUPPRESSION_OPERATIONS.UNSUPPRESS);
    expect(events[1].action).toBe("lifted");
  });

  it("normalized-email uniqueness: case-insensitive emails collapse to one suppression", async () => {
    const email = "MixedCase-Test@Example.COM";
    await upsertContact(userA, { email, source: "api" });

    await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-norm-1", requestPayload: { email, reason: "manual" },
    });
    await suppressEmail({
      userId: userA, email: email.toLowerCase(), reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-norm-2", requestPayload: { email: email.toLowerCase(), reason: "manual" },
    });

    const entries = await db.suppressionEntry.findMany({
      where: { userId: userA },
    });
    const matching = entries.filter((e) => e.email === email.toLowerCase().trim());
    expect(matching.length).toBe(1);
  });

  it("suppressed subscribed Contact is ineligible for marketing", async () => {
    const email = uniqueEmail("cs-ineligible");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-inel-1", requestPayload: { reason: null },
    });
    // Manually suppress — note: suppressEmail with contactId routes through
    // unsubscribeContact which would also change marketingStatus. We bypass
    // that by calling suppressEmail WITHOUT contactId, which only adds the
    // suppression entry without changing the contact's marketingStatus.
    await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-inel-2", requestPayload: { email, reason: "manual" },
    });

    const eligibility = await getMarketingEligibility(userA, contactId);
    expect(eligibility.eligible).toBe(false);
    if (!eligibility.eligible) {
      expect(eligibility.reason).toBe("suppressed");
    }
  });

  // ===== Eligibility matrix ======================================

  it("eligibility: unknown → false (not_subscribed)", async () => {
    const email = uniqueEmail("cs-elig-unknown");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const eligibility = await getMarketingEligibility(userA, upsert.contact.id);
    expect(eligibility.eligible).toBe(false);
    if (!eligibility.eligible) {
      expect(eligibility.reason).toBe("not_subscribed");
    }
  });

  it("eligibility: unsubscribed → false (not_subscribed)", async () => {
    const email = uniqueEmail("cs-elig-unsub");
    const upsert = await upsertContact(userA, { email, source: "api" });
    await unsubscribeContact({
      userId: userA, contactId: upsert.contact.id, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-elig-unsub-1", requestPayload: { reason: null },
    });
    const eligibility = await getMarketingEligibility(userA, upsert.contact.id);
    expect(eligibility.eligible).toBe(false);
    if (!eligibility.eligible) {
      expect(eligibility.reason).toBe("not_subscribed");
    }
  });

  it("eligibility: subscribed → true", async () => {
    const email = uniqueEmail("cs-elig-sub");
    const upsert = await upsertContact(userA, { email, source: "api" });
    await subscribeContact({
      userId: userA, contactId: upsert.contact.id, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-elig-sub-1", requestPayload: { reason: null },
    });
    const eligibility = await getMarketingEligibility(userA, upsert.contact.id);
    expect(eligibility.eligible).toBe(true);
  });

  it("eligibility: subscribed + active suppression → false (suppressed)", async () => {
    const email = uniqueEmail("cs-elig-supp");
    const upsert = await upsertContact(userA, { email, source: "api" });
    await subscribeContact({
      userId: userA, contactId: upsert.contact.id, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-elig-supp-1", requestPayload: { reason: null },
    });
    await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-elig-supp-2", requestPayload: { email, reason: "manual" },
    });
    const eligibility = await getMarketingEligibility(userA, upsert.contact.id);
    expect(eligibility.eligible).toBe(false);
    if (!eligibility.eligible) {
      expect(eligibility.reason).toBe("suppressed");
    }
  });

  it("eligibility: lifted suppression + subscribed → true", async () => {
    const email = uniqueEmail("cs-elig-lift");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;
    await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-elig-lift-1", requestPayload: { reason: null },
    });
    await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-elig-lift-2", requestPayload: { email, reason: "manual" },
    });
    await unsuppressEmail({
      userId: userA, email, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-elig-lift-3", requestPayload: { email },
    });
    const eligibility = await getMarketingEligibility(userA, contactId);
    expect(eligibility.eligible).toBe(true);
  });

  it("eligibility by email: contact_not_found when no contact", async () => {
    const email = uniqueEmail("cs-elig-nf");
    const eligibility = await getMarketingEligibilityByEmail(userA, email);
    expect(eligibility.eligible).toBe(false);
    if (!eligibility.eligible) {
      expect(eligibility.reason).toBe("contact_not_found");
    }
  });

  // ===== Imports regression (Phase 8 invariant) ===================

  it("imported new Contact remains unknown and not eligible", async () => {
    const email = uniqueEmail("cs-imp-unknown");
    const upsert = await upsertContact(userA, { email, source: "import" });
    expect(upsert.contact.source).toBe("import");
    expect(upsert.contact.marketingStatus).toBe(MARKETING_STATUSES.UNKNOWN);
    expect(upsert.contact.marketingConsentSource).toBeNull();
    expect(upsert.contact.marketingConsentAt).toBeNull();

    const eligibility = await getMarketingEligibility(userA, upsert.contact.id);
    expect(eligibility.eligible).toBe(false);
  });

  it("Group membership does not alter consent", async () => {
    const email = uniqueEmail("cs-grp");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    const beforeStatus = upsert.contact.marketingStatus;
    const beforeSource = upsert.contact.marketingConsentSource;
    const beforeAt = upsert.contact.marketingConsentAt;

    const group = await createGroup(userA, { name: "cs-test-group" });
    await db.contactGroupMembership.create({
      data: { userId: userA, groupId: group.id, contactId, source: "manual" },
    });

    const fresh = await db.contact.findUnique({ where: { id: contactId } });
    expect(fresh?.marketingStatus).toBe(beforeStatus);
    expect(fresh?.marketingConsentSource).toBe(beforeSource);
    expect(fresh?.marketingConsentAt).toBe(beforeAt);
  });

  it("contact PATCH (name/attributes) does NOT change marketing fields", async () => {
    const email = uniqueEmail("cs-patch");
    const upsert = await upsertContact(userA, { email, source: "api", name: "Alice", attributes: { role: "user" } });
    const contactId = upsert.contact.id;

    await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-patch-1", requestPayload: { reason: null },
    });
    const before = await db.contact.findUnique({ where: { id: contactId } });
    expect(before?.marketingStatus).toBe(MARKETING_STATUSES.SUBSCRIBED);
    expect(before?.marketingConsentSource).toBe(CONSENT_SOURCES.API);

    await upsertContact(userA, { email, name: "Bob", attributes: { role: "admin" } });

    const after = await db.contact.findUnique({ where: { id: contactId } });
    expect(after?.marketingStatus).toBe(MARKETING_STATUSES.SUBSCRIBED);
    expect(after?.marketingConsentSource).toBe(CONSENT_SOURCES.API);
    expect(after?.marketingConsentAt?.getTime()).toBe(before!.marketingConsentAt!.getTime());
    expect(after?.name).toBe("Bob");
  });

  // ===== Unsubscribe token confidentiality (audit BLOCKER #8, #9) ========

  it("BLOCKER #8/#9: unsubscribe token is OPAQUE — does not expose email/userId/contactId via base64 decode", async () => {
    const email = uniqueEmail("cs-tok-opaque");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const token = await mintUnsubscribeToken({
      userId: userA,
      contactId: upsert.contact.id,
      email,
    });

    // Token is a JWE (5 parts, dot-separated: header.encrypted_key.iv.ciphertext.tag).
    // NONE of the plaintext patterns should appear in any base64-decoded part.
    const exposesEmail = tokenExposesPlaintext(token, [email, email.toUpperCase(), email.toLowerCase()]);
    const exposesUserId = tokenExposesPlaintext(token, [String(userA)]);
    const exposesContactId = tokenExposesPlaintext(token, [String(upsert.contact.id)]);

    expect(exposesEmail).toBe(false);
    expect(exposesUserId).toBe(false);
    expect(exposesContactId).toBe(false);
  });

  it("valid unsubscribe token: verifies and returns the correct payload", async () => {
    const email = uniqueEmail("cs-tok-valid");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const token = await mintUnsubscribeToken({
      userId: userA,
      contactId: upsert.contact.id,
      email,
    });
    const result = await verifyUnsubscribeToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.uid).toBe(String(userA));
      expect(result.payload.sub).toBe(String(upsert.contact.id));
      expect(result.payload.email).toBe(email);
      expect(result.payload.purpose).toBe("unsubscribe");
      expect(result.payload.jti).toMatch(UUID_V4_RE);
    }
  });

  it("repeated valid token + repeated POST: idempotent (same jti = same eventId)", async () => {
    const email = uniqueEmail("cs-tok-rep");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;
    const token = await mintUnsubscribeToken({ userId: userA, contactId, email });

    const verify1 = await verifyUnsubscribeToken(token);
    if (!verify1.ok) throw new Error("token should verify");
    const jti = verify1.payload.jti;

    const r1 = await unsubscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.UNSUBSCRIBE,
      idempotencyKey: jti, requestPayload: { contactId, userId: userA },
    });
    const r2Verify = await verifyUnsubscribeToken(token);
    expect(r2Verify.ok).toBe(true);
    const r2 = await unsubscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.UNSUBSCRIBE,
      idempotencyKey: r2Verify.ok ? r2Verify.payload.jti : "nope",
      requestPayload: { contactId, userId: userA },
    });

    expect(r1.status).toBe("applied");
    expect(r2.status).toBe("idempotent_replay");
    expect(r2.eventId).toBe(r1.eventId);

    const history = await getConsentHistory(userA, contactId);
    expect(history.total).toBe(1);
    expect(history.events[0].newStatus).toBe(MARKETING_STATUSES.UNSUBSCRIBED);
  });

  it("tampered token: verification fails with generic 'invalid'", async () => {
    const email = uniqueEmail("cs-tok-tamper");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const token = await mintUnsubscribeToken({
      userId: userA, contactId: upsert.contact.id, email,
    });
    // Tamper: flip a character in the middle of the ciphertext (part 3 of 5).
    // This deterministically changes a byte in the encrypted payload, which
    // A256GCM authentication MUST reject. We don't tamper at the end because
    // the last character might coincide with the replacement character.
    const parts = token.split(".");
    // Part 3 is the ciphertext (0-indexed: header, encrypted_key, iv, ciphertext, tag).
    const ctPart = parts[3];
    // Flip the first character of the ciphertext to a different valid base64url char.
    const origChar = ctPart[0];
    const replacementChar = origChar === "A" ? "B" : "A";
    parts[3] = replacementChar + ctPart.slice(1);
    const tampered = parts.join(".");
    const result = await verifyUnsubscribeToken(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid");
    }
  });

  it("wrong-purpose token: rejected with 'wrong_purpose'", async () => {
    const email = uniqueEmail("cs-tok-purpose");
    const upsert = await upsertContact(userA, { email, source: "api" });
    // Mint a token WITHOUT the purpose claim (simulating a session token reuse attempt).
    const { EncryptJWT } = await import("jose");
    const { createHmac } = await import("crypto");
    const rootSecret = process.env.JWT_SECRET!;
    const rootKey = /^[0-9a-fA-F]+$/.test(rootSecret) && rootSecret.length >= 32
      ? Buffer.from(rootSecret, "hex")
      : new TextEncoder().encode(rootSecret);
    // Derive the SAME unsubscribe key (so we can verify the only difference is `purpose`).
    const prk = createHmac("sha256", Buffer.alloc(0)).update(Buffer.from(rootKey)).digest();
    const info = Buffer.concat([new TextEncoder().encode("nixify:unsubscribe:v1"), Buffer.from([0x01])]);
    const key = createHmac("sha256", prk).update(info).digest();

    const wrongToken = await new EncryptJWT({
      uid: String(userA),
      sub: String(upsert.contact.id),
      email,
      // NO purpose claim.
    })
      .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .encrypt(key);

    const result = await verifyUnsubscribeToken(wrongToken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("wrong_purpose");
    }
  });

  it("BLOCKER #10: real public GET /api/unsubscribe?token=invalid returns the SAME generic message as a missing token", async () => {
    const req = new NextRequest("http://localhost/api/unsubscribe?token=invalid-tampered-token-string");
    const res = await unsubscribeGET(req);
    const body = await res.json();
    expect(res.status).toBe(200); // Always 200 — never reveal existence via status code.
    expect(body.ok).toBe(false);
    expect(body.message).toBe(UNSUBSCRIBE_INVALID_MESSAGE);
  });

  it("BLOCKER #10: real public GET /api/unsubscribe with no token returns the generic message", async () => {
    const req = new NextRequest("http://localhost/api/unsubscribe");
    const res = await unsubscribeGET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.message).toBe(UNSUBSCRIBE_INVALID_MESSAGE);
  });

  it("BLOCKER #10: real public POST /api/unsubscribe with malformed JSON returns generic message", async () => {
    const req = new NextRequest("http://localhost/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await unsubscribePOST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.message).toBe(UNSUBSCRIBE_INVALID_MESSAGE);
  });

  it("BLOCKER #10: real public POST /api/unsubscribe with valid token for DELETED contact returns generic message", async () => {
    // Mint a token for a contact that doesn't exist.
    const token = await mintUnsubscribeToken({
      userId: userA,
      contactId: 99999999, // doesn't exist
      email: "nope@example.com",
    });
    const req = new NextRequest("http://localhost/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const res = await unsubscribePOST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.message).toBe(UNSUBSCRIBE_INVALID_MESSAGE);
  });

  it("BLOCKER #10: real public POST /api/unsubscribe with valid token performs the unsubscribe", async () => {
    const email = uniqueEmail("cs-pub-endpoint");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const token = await mintUnsubscribeToken({
      userId: userA, contactId: upsert.contact.id, email,
    });
    const req = new NextRequest("http://localhost/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const res = await unsubscribePOST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.marketing_status).toBe(MARKETING_STATUSES.UNSUBSCRIBED);

    const fresh = await db.contact.findUnique({ where: { id: upsert.contact.id } });
    expect(fresh?.marketingStatus).toBe(MARKETING_STATUSES.UNSUBSCRIBED);
  });

  // ===== Concurrency (real invariants, not broad) ============

  it("BLOCKER #5: simultaneous subscribe (same idempotency key) → exactly one applied + one replay, history coherent", async () => {
    const email = uniqueEmail("cs-conc-sub");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    const [r1, r2] = await Promise.all([
      subscribeContact({
        userId: userA, contactId, source: CONSENT_SOURCES.API,
        idempotencyKey: "k-conc-sub", requestPayload: { reason: null },
      }),
      subscribeContact({
        userId: userA, contactId, source: CONSENT_SOURCES.API,
        idempotencyKey: "k-conc-sub", requestPayload: { reason: null },
      }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual(["applied", "idempotent_replay"]);

    const fresh = await db.contact.findUnique({ where: { id: contactId } });
    expect(fresh?.marketingStatus).toBe(MARKETING_STATUSES.SUBSCRIBED);

    const history = await getConsentHistory(userA, contactId);
    expect(history.total).toBe(1);

    // History chain MUST be coherent.
    const chain = await verifyConsentHistoryChain(userA, contactId);
    expect(chain.coherent).toBe(true);
    expect(chain.events.length).toBe(1);
    // Final Contact state MUST equal last event's newStatus.
    expect(chain.events[chain.events.length - 1].newStatus).toBe(MARKETING_STATUSES.SUBSCRIBED);
  });

  it("BLOCKER #5: simultaneous unsubscribe (same idempotency key) → coherent history", async () => {
    const email = uniqueEmail("cs-conc-unsub");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-conc-unsub-prep", requestPayload: { reason: null },
    });

    const [r1, r2] = await Promise.all([
      unsubscribeContact({
        userId: userA, contactId, source: CONSENT_SOURCES.API,
        idempotencyKey: "k-conc-unsub", requestPayload: { reason: null },
      }),
      unsubscribeContact({
        userId: userA, contactId, source: CONSENT_SOURCES.API,
        idempotencyKey: "k-conc-unsub", requestPayload: { reason: null },
      }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual(["applied", "idempotent_replay"]);

    const fresh = await db.contact.findUnique({ where: { id: contactId } });
    expect(fresh?.marketingStatus).toBe(MARKETING_STATUSES.UNSUBSCRIBED);

    const chain = await verifyConsentHistoryChain(userA, contactId);
    expect(chain.coherent).toBe(true);
    expect(chain.events.length).toBe(2);
    // Final state equals last event's newStatus.
    expect(chain.events[chain.events.length - 1].newStatus).toBe(MARKETING_STATUSES.UNSUBSCRIBED);
  });

  it("BLOCKER #5: subscribe vs unsubscribe race (DIFFERENT keys) → history chain is COHERENT + final state matches last event", async () => {
    const email = uniqueEmail("cs-conc-mix");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    // Different keys — both operations run their full transactions, serialized
    // by the canonical mutation lock. Commit order is non-deterministic, but
    // the invariant is: history chain is coherent AND final Contact state
    // matches the last committed event's newStatus.
    const [subResult, unsubResult] = await Promise.all([
      subscribeContact({
        userId: userA, contactId, source: CONSENT_SOURCES.API,
        idempotencyKey: "k-conc-mix-sub", requestPayload: { reason: null },
      }),
      unsubscribeContact({
        userId: userA, contactId, source: CONSENT_SOURCES.API,
        idempotencyKey: "k-conc-mix-unsub", requestPayload: { reason: null },
      }),
    ]);

    // Both produced durable audit events.
    expect(subResult.eventId).not.toBeNull();
    expect(unsubResult.eventId).not.toBeNull();
    expect(subResult.eventId).not.toBe(unsubResult.eventId);

    // History has BOTH transitions.
    const history = await getConsentHistory(userA, contactId);
    expect(history.total).toBe(2);
    const operations = history.events.map((e) => e.operation).sort();
    expect(operations).toEqual([CONSENT_OPERATIONS.SUBSCRIBE, CONSENT_OPERATIONS.UNSUBSCRIBE].sort());

    // History transition chain is coherent.
    const chain = await verifyConsentHistoryChain(userA, contactId);
    expect(chain.coherent).toBe(true);

    // Final Contact state matches the LAST committed event's newStatus.
    const fresh = await db.contact.findUnique({ where: { id: contactId } });
    expect(fresh?.marketingStatus).toBe(chain.events[chain.events.length - 1].newStatus);

    // Suppression state agrees with the effective transition:
    //   - if the last event was unsubscribe → suppression MUST be active.
    //   - if the last event was subscribe → suppression MUST be inactive (lifted).
    const suppression = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    const lastOp = chain.events[chain.events.length - 1].operation;
    if (lastOp === CONSENT_OPERATIONS.UNSUBSCRIBE) {
      expect(suppression?.active).toBe(true);
    } else {
      // Last operation was subscribe → suppression should be inactive.
      if (suppression) {
        expect(suppression.active).toBe(false);
      }
    }
  });

  it("BLOCKER #5: suppress vs unsuppress race → final active state agrees with last action", async () => {
    const email = uniqueEmail("cs-conc-sup");
    await upsertContact(userA, { email, source: "api" });

    // Pre-create suppression so unsuppress has something to lift.
    await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-conc-sup-prep", requestPayload: { email, reason: "manual" },
    });

    // Race: suppress (different key) vs unsuppress.
    await Promise.all([
      suppressEmail({
        userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
        idempotencyKey: "k-conc-sup-race-1", requestPayload: { email, reason: "manual" },
      }),
      unsuppressEmail({
        userId: userA, email, source: CONSENT_SOURCES.DASHBOARD,
        idempotencyKey: "k-conc-sup-race-2", requestPayload: { email },
      }),
    ]);

    // Exactly one SuppressionEntry (unique constraint enforces this).
    const entries = await db.suppressionEntry.findMany({
      where: { userId: userA, email },
    });
    expect(entries.length).toBe(1);

    // Final active state MUST agree with the LAST committed SuppressionEvent action.
    const events = await db.suppressionEvent.findMany({
      where: { userId: userA, email },
      orderBy: { createdAt: "asc" },
    });
    expect(events.length).toBeGreaterThanOrEqual(2);
    const lastAction = events[events.length - 1].action;
    if (lastAction === "suppressed") {
      expect(entries[0].active).toBe(true);
    } else {
      // lifted
      expect(entries[0].active).toBe(false);
    }
  });

  it("BLOCKER #1: no in-tx try/catch swallowing P2002 — concurrent insert races cleanly", async () => {
    const email = uniqueEmail("cs-rollback");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    // First subscribe succeeds.
    const r1 = await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-rollback-1", requestPayload: { reason: null },
    });
    expect(r1.status).toBe("applied");

    // Now manually insert a ConsentMutationIdempotency row with the SAME
    // idempotencyKeyHash to simulate a concurrent insert that already
    // committed (forces P2002 inside the next subscribe call tx). The
    // service should find the existing idempotency record (via
    // findExistingIdempotency inside the tx) and return idempotent_replay
    // WITHOUT leaving a partial mutation.
    const operation = CONSENT_OPERATIONS.SUBSCRIBE;
    const hash = hashIdempotencyKey(userA, operation, "k-rollback-2");
    const fp = hashRequestFingerprint({ reason: null });
    await db.consentMutationIdempotency.create({
      data: {
        userId: userA,
        operation,
        targetType: "contact",
        targetKey: String(contactId),
        idempotencyKeyHash: hash,
        requestFingerprint: fp,
        resultStatus: "applied",
        resultEventId: "simulated-event-id",
      },
    });

    // Now call subscribe with that idempotency key + matching fingerprint.
    const r2 = await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-rollback-2", requestPayload: { reason: null },
    });

    expect(r2.status).toBe("idempotent_replay");
    expect(r2.eventId).toBe("simulated-event-id");
  });

  // ===== Consent summary + audit history reads =================

  it("getConsentSummary returns null for foreign contact", async () => {
    const email = uniqueEmail("cs-sum-foreign");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const summary = await getConsentSummary(userB, upsert.contact.id);
    expect(summary).toBeNull();
  });

  it("getConsentSummary reflects suppression lift + subscribe", async () => {
    const email = uniqueEmail("cs-sum-e2e");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    let summary = await getConsentSummary(userA, contactId);
    expect(summary?.marketingStatus).toBe(MARKETING_STATUSES.UNKNOWN);
    expect(summary?.suppressed).toBe(false);
    expect(summary?.eligible).toBe(false);

    await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-sum-1", requestPayload: { reason: null },
    });
    summary = await getConsentSummary(userA, contactId);
    expect(summary?.marketingStatus).toBe(MARKETING_STATUSES.SUBSCRIBED);
    expect(summary?.suppressed).toBe(false);
    expect(summary?.eligible).toBe(true);

    await unsubscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-sum-2", requestPayload: { reason: null },
    });
    summary = await getConsentSummary(userA, contactId);
    expect(summary?.marketingStatus).toBe(MARKETING_STATUSES.UNSUBSCRIBED);
    expect(summary?.suppressed).toBe(true);
    expect(summary?.eligible).toBe(false);
  });

  it("listSuppressions returns tenant-scoped entries", async () => {
    for (let i = 0; i < 3; i++) {
      const email = uniqueEmail(`cs-list-${i}`);
      await upsertContact(userA, { email, source: "api" });
      await suppressEmail({
        userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
        idempotencyKey: `k-list-${i}-${Date.now()}`, requestPayload: { email, reason: "manual" },
      });
    }
    const bEmail = uniqueEmail("cs-list-b");
    await upsertContact(userB, { email: bEmail, source: "api" });
    await suppressEmail({
      userId: userB, email: bEmail, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-list-b", requestPayload: { email: bEmail, reason: "manual" },
    });

    const result = await listSuppressions(userA, { page: 1, pageSize: 50 });
    expect(result.total).toBe(3);
    for (const s of result.suppressions) {
      expect(s.email).toContain("cs-list-");
    }
  });

  it("getSuppressionByPublicId returns null for cross-tenant", async () => {
    const email = uniqueEmail("cs-get-by-id");
    await upsertContact(userA, { email, source: "api" });
    const sup = await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-get-by-id", requestPayload: { email, reason: "manual" },
    });

    const own = await getSuppressionByPublicId(userA, sup.suppressionId!);
    expect(own).not.toBeNull();
    const foreign = await getSuppressionByPublicId(userB, sup.suppressionId!);
    expect(foreign).toBeNull();
  });

  // ===== Immutable audit semantics (audit #13) =================

  it("BLOCKER #13: immutable history — later transitions do NOT update prior audit rows", async () => {
    const email = uniqueEmail("cs-imm");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-imm-1", requestPayload: { reason: null },
    });
    const afterSub = await getConsentHistory(userA, contactId);
    const firstEventId = afterSub.events[0].eventId;
    const firstCreatedAt = afterSub.events[0].createdAt;
    const firstPrev = afterSub.events[0].previousStatus;
    const firstNew = afterSub.events[0].newStatus;

    // Transition again — history must grow, original row unchanged.
    await unsubscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-imm-2", requestPayload: { reason: null },
    });
    await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-imm-3", requestPayload: { reason: null },
    });

    const finalHistory = await getConsentHistory(userA, contactId);
    expect(finalHistory.total).toBe(3);

    const stillThere = finalHistory.events.find((e) => e.eventId === firstEventId);
    expect(stillThere).toBeDefined();
    expect(stillThere!.createdAt.getTime()).toBe(firstCreatedAt.getTime());
    expect(stillThere!.previousStatus).toBe(firstPrev);
    expect(stillThere!.newStatus).toBe(firstNew);
  });

  // ===== Contact deletion audit semantics (audit #14) ===========

  it("BLOCKER #14: ContactConsentEvent cascades on Contact deletion (intentional GDPR right-to-erasure)", async () => {
    const email = uniqueEmail("cs-del");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-del-1", requestPayload: { reason: null },
    });
    const history = await getConsentHistory(userA, contactId);
    expect(history.total).toBe(1);

    // Delete the contact — consent history should cascade-delete with it.
    await db.contact.delete({ where: { id: contactId } });

    const after = await db.contactConsentEvent.findMany({
      where: { contactId },
    });
    expect(after.length).toBe(0);
  });

  // ===== Durable no-op idempotency (audit v3 BLOCKER #1-4) ===========

  it("BLOCKER #1: already subscribed + fresh Idempotency-Key → no_op, NO fake transition event", async () => {
    const email = uniqueEmail("cs-noop-sub-key");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    // Subscribe once with key K1.
    await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-noop-sub-1", requestPayload: { reason: null },
    });
    const historyAfterFirst = await getConsentHistory(userA, contactId);
    expect(historyAfterFirst.total).toBe(1);

    // Subscribe again with a DIFFERENT fresh key K2. Already subscribed → no_op.
    const r = await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-noop-sub-2", requestPayload: { reason: null },
    });
    expect(r.status).toBe("no_op");
    expect(r.eventId).toBeNull();

    // NO fake transition event was created.
    const historyAfterSecond = await getConsentHistory(userA, contactId);
    expect(historyAfterSecond.total).toBe(1); // unchanged
  });

  it("BLOCKER #3: durable no-op replay — retry after state change replays original no_op", async () => {
    const email = uniqueEmail("cs-noop-replay");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    // 1. Subscribe with K1.
    await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-replay-1", requestPayload: { reason: null },
    });

    // 2. Subscribe again with K2. Already subscribed → no_op (persisted to idempotency table).
    const r2 = await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-replay-2", requestPayload: { reason: null },
    });
    expect(r2.status).toBe("no_op");

    // 3. Now unsubscribe the contact (state changes).
    await unsubscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-replay-3", requestPayload: { reason: null },
    });
    const fresh = await db.contact.findUnique({ where: { id: contactId } });
    expect(fresh?.marketingStatus).toBe(MARKETING_STATUSES.UNSUBSCRIBED);

    // 4. Retry the ORIGINAL subscribe request with K2. MUST replay the no_op
    //    outcome — NOT re-evaluate and subscribe the contact.
    const r4 = await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-replay-2", requestPayload: { reason: null },
    });
    expect(r4.status).toBe("idempotent_replay");
    expect(r4.eventId).toBeNull(); // original was a no_op

    // Contact remains unsubscribed — the retry did NOT subscribe it.
    const stillUnsubscribed = await db.contact.findUnique({ where: { id: contactId } });
    expect(stillUnsubscribed?.marketingStatus).toBe(MARKETING_STATUSES.UNSUBSCRIBED);

    // History has exactly 2 transitions (subscribe + unsubscribe), NOT a 3rd fake one.
    const history = await getConsentHistory(userA, contactId);
    expect(history.total).toBe(2);
  });

  it("BLOCKER #1: already unsubscribed + fresh Idempotency-Key → no_op, NO fake transition", async () => {
    const email = uniqueEmail("cs-noop-unsub-key");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    // Unsubscribe once with K1.
    await unsubscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-noop-unsub-1", requestPayload: { reason: null },
    });
    const historyAfterFirst = await getConsentHistory(userA, contactId);
    expect(historyAfterFirst.total).toBe(1);

    // Unsubscribe again with fresh K2. Already unsubscribed → no_op.
    const r = await unsubscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-noop-unsub-2", requestPayload: { reason: null },
    });
    expect(r.status).toBe("no_op");
    expect(r.eventId).toBeNull();

    const historyAfterSecond = await getConsentHistory(userA, contactId);
    expect(historyAfterSecond.total).toBe(1); // unchanged
  });

  it("BLOCKER #3: unsubscribe durable no-op replay — retry after re-subscribe replays original no_op", async () => {
    const email = uniqueEmail("cs-noop-unsub-replay");
    const upsert = await upsertContact(userA, { email, source: "api" });
    const contactId = upsert.contact.id;

    // 1. Unsubscribe with K1.
    await unsubscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-unsub-replay-1", requestPayload: { reason: null },
    });

    // 2. Unsubscribe again with K2. Already unsubscribed → no_op (persisted).
    const r2 = await unsubscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-unsub-replay-2", requestPayload: { reason: null },
    });
    expect(r2.status).toBe("no_op");

    // 3. Re-subscribe (state changes).
    await subscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-unsub-replay-3", requestPayload: { reason: null },
    });

    // 4. Retry original unsubscribe with K2. MUST replay no_op — NOT re-unsubscribe.
    const r4 = await unsubscribeContact({
      userId: userA, contactId, source: CONSENT_SOURCES.API,
      idempotencyKey: "k-unsub-replay-2", requestPayload: { reason: null },
    });
    expect(r4.status).toBe("idempotent_replay");
    expect(r4.eventId).toBeNull();

    // Contact remains subscribed.
    const fresh = await db.contact.findUnique({ where: { id: contactId } });
    expect(fresh?.marketingStatus).toBe(MARKETING_STATUSES.SUBSCRIBED);
  });

  it("BLOCKER #1: already suppressed (same reason) + fresh Idempotency-Key → no_op, NO fake transition", async () => {
    const email = uniqueEmail("cs-noop-sup-key");
    await upsertContact(userA, { email, source: "api" });

    // Suppress once with K1.
    await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-noop-sup-1", requestPayload: { email, reason: "manual" },
    });
    const eventsAfterFirst = await db.suppressionEvent.findMany({
      where: { userId: userA, email },
    });
    expect(eventsAfterFirst.length).toBe(1);

    // Suppress again with fresh K2. Already suppressed with same reason → no_op.
    const r = await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-noop-sup-2", requestPayload: { email, reason: "manual" },
    });
    expect(r.status).toBe("no_op");
    expect(r.eventId).toBeNull();

    // NO fake suppression transition event.
    const eventsAfterSecond = await db.suppressionEvent.findMany({
      where: { userId: userA, email },
    });
    expect(eventsAfterSecond.length).toBe(1); // unchanged
  });

  it("BLOCKER #3: suppress durable no-op replay — retry after lift replays original no_op", async () => {
    const email = uniqueEmail("cs-noop-sup-replay");
    await upsertContact(userA, { email, source: "api" });

    // 1. Suppress with K1.
    await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-sup-replay-1", requestPayload: { email, reason: "manual" },
    });

    // 2. Suppress again with K2. Already suppressed → no_op (persisted).
    const r2 = await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-sup-replay-2", requestPayload: { email, reason: "manual" },
    });
    expect(r2.status).toBe("no_op");

    // 3. Lift the suppression (state changes).
    await unsuppressEmail({
      userId: userA, email, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-sup-replay-3", requestPayload: { email },
    });

    // 4. Retry original suppress with K2. MUST replay no_op — NOT re-suppress.
    const r4 = await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-sup-replay-2", requestPayload: { email, reason: "manual" },
    });
    expect(r4.status).toBe("idempotent_replay");
    expect(r4.eventId).toBeNull();

    // Suppression remains lifted.
    const entry = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(entry?.active).toBe(false);
  });

  it("BLOCKER #1: unsuppress already-lifted + fresh Idempotency-Key → not_suppressed, NO fake transition", async () => {
    const email = uniqueEmail("cs-noop-lift-key");
    await upsertContact(userA, { email, source: "api" });

    // Suppress + lift first.
    await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-noop-lift-1", requestPayload: { email, reason: "manual" },
    });
    await unsuppressEmail({
      userId: userA, email, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-noop-lift-2", requestPayload: { email },
    });
    const eventsAfterLift = await db.suppressionEvent.findMany({
      where: { userId: userA, email },
    });
    expect(eventsAfterLift.length).toBe(2); // suppress + lift

    // Unsuppress again with fresh K3. Already lifted → not_suppressed.
    const r = await unsuppressEmail({
      userId: userA, email, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-noop-lift-3", requestPayload: { email },
    });
    expect(r.status).toBe("not_suppressed");
    expect(r.eventId).toBeNull();

    // NO fake lift transition event.
    const eventsAfterSecond = await db.suppressionEvent.findMany({
      where: { userId: userA, email },
    });
    expect(eventsAfterSecond.length).toBe(2); // unchanged
  });

  // ===== Suppression FK deletion policy (audit v3 BLOCKER #5-6) =====

  it("BLOCKER #5-6: SuppressionEntry physical delete REJECTED by RESTRICT FK when SuppressionEvent history exists", async () => {
    const email = uniqueEmail("cs-fk-restrict");
    await upsertContact(userA, { email, source: "api" });

    // Create a suppression entry + event.
    await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.MANUAL, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-fk-restrict-1", requestPayload: { email, reason: "manual" },
    });
    const entry = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(entry).not.toBeNull();

    // Attempt to physically DELETE the SuppressionEntry. The RESTRICT FK on
    // SuppressionEvent MUST reject this — audit history cannot be orphaned.
    await expect(
      db.suppressionEntry.delete({ where: { id: entry!.id } }),
    ).rejects.toThrow();

    // The entry still exists (delete was rejected).
    const stillExists = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(stillExists).not.toBeNull();

    // Lift operation works (the intended Phase 9 API path).
    const liftResult = await unsuppressEmail({
      userId: userA, email, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "k-fk-restrict-2", requestPayload: { email },
    });
    expect(liftResult.status).toBe("applied");
    expect(liftResult.active).toBe(false);

    // Audit history preserved — both the suppress and lift events exist.
    const events = await db.suppressionEvent.findMany({
      where: { userId: userA, email },
      orderBy: { createdAt: "asc" },
    });
    expect(events.length).toBe(2);
    expect(events[0].action).toBe("suppressed");
    expect(events[1].action).toBe("lifted");
  });
});
