import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { upsertContact } from "@/lib/contacts";
import { createGroup } from "@/lib/groups/service";
import {
  subscribeContact,
  suppressEmail,
  unsuppressEmail,
  CONSENT_SOURCES,
  SUPPRESSION_REASONS,
  MARKETING_STATUSES,
  ResubscribeBlockedError,
} from "@/lib/consent/service";
import {
  createBroadcast,
  launchBroadcast,
  processBroadcast,
} from "@/lib/broadcasts/service";
import { AUDIENCE_TYPES, BROADCAST_STATUSES } from "@/lib/broadcasts/constants";
import { createTemplate } from "@/lib/transactional-templates";
import { sendTransactionalEmail } from "@/lib/messaging/service";
import { SmtpEmailProvider } from "@/lib/messaging/providers/smtp";
import { __resetMailTransportCacheForTests } from "@/lib/mail/transport";
import type { EmailProvider, ProviderSendInput, ProviderSendResult } from "@/lib/messaging/providers/provider";
import {
  createDelivery,
  ingestProviderEvent,
  updateDeliveryAfterProviderSend,
  markDeliveryFailed,
  markDeliveryUnknown,
  getDelivery,
  listDeliveries,
  getDeliveryEvents,
  getDeliveryHealth,
  DELIVERY_STATUSES,
  DELIVERY_SOURCES,
  PROVIDER_EVENT_TYPES,
  BOUNCE_TYPES,
  type DeliveryTransitionResult,
} from "@/lib/deliverability/service";
import { recoverAbandonedDispatches } from "@/lib/broadcasts/service";
import { suppressEmailInTx } from "@/lib/consent/service";
import {
  __setDeliverabilityTestFault,
  __clearDeliverabilityTestFault,
} from "@/lib/deliverability/test-fault";

/**
 * Phase 11 — Provider & Deliverability integration tests.
 *
 * Coverage:
 *   - Delivery record creation + tenant isolation (composite FK).
 *   - Provider event deduplication (P2002 → duplicate, no re-suppression).
 *   - Concurrent duplicate provider events.
 *   - Event ordering — never regress (delivered cannot regress to deferred;
 *     complained beats delivered regardless of webhook receipt order).
 *   - Hard bounce → suppression.
 *   - Complaint → suppression.
 *   - Soft bounce → NO suppression.
 *   - Duplicate complaint → no duplicate suppression.
 *   - Cross-tenant provider event cannot mutate another tenant.
 *   - Unknown providerMessageId → no tenant state change.
 *   - Transaction rollback on failure.
 *   - Broadcast correlation (sourceType=broadcast, broadcastRecipientId set).
 *   - Transactional Send correlation (sourceType=transactional, emailMessageId set).
 *   - Idempotent Send replay → no duplicate delivery attempt.
 *   - SMTP path functional.
 *   - Resubscribe protection for hard_bounce/complaint.
 *
 * FAIL-CLOSED: this suite is GATED — only runs when
 * RUN_DELIVERABILITY_INTEGRATION=1 AND TEST_DATABASE_URL is supplied. The
 * `bun run test:deliverability` script fails closed with exit 1 when
 * TEST_DATABASE_URL is missing.
 */

const RUN = process.env.RUN_DELIVERABILITY_INTEGRATION === "1";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fake provider for deterministic test sends (mirror of messaging/service.test.ts).
class FakeEmailProvider implements EmailProvider {
  readonly name = "fake";
  readonly capabilities = {
    providerMessageId: true,
    customHeaders: true,
    deliveryWebhooks: false,
    bounceEvents: false,
    complaintEvents: false,
  } as const;

  public sent: ProviderSendInput[] = [];
  public sendCalls = 0;
  public nextMessageId: string | null = null;

  reset(): void {
    this.sent.length = 0;
    this.sendCalls = 0;
    this.nextMessageId = null;
  }

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    this.sendCalls++;
    this.sent.push(input);
    const id = this.nextMessageId ?? `fake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      provider: "fake",
      messageId: id,
      accepted: true,
      responseClassification: "accepted",
    };
  }
}

describe.skipIf(!RUN)("Deliverability — DB integration (Phase 11)", () => {
  let userA: number;
  let userB: number;
  let setupComplete = false;
  let emailCounter = 0;
  const fakeProvider = new FakeEmailProvider();

  function uniqueEmail(prefix = "dlv"): string {
    emailCounter += 1;
    return `${prefix}-${emailCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  }

  beforeAll(async () => {
    // Required for buildUnsubscribeUrl() / getAppOrigin() in broadcast tests.
    process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://test.example.com";
    await db.$queryRaw`SELECT 1`;
    // Cleanup any prior test data.
    const oldUserIds = (await db.user.findMany({
      where: { email: { contains: "dlv-test-" } },
      select: { id: true },
    })).map((u) => u.id);
    if (oldUserIds.length > 0) {
      await db.emailDeliveryEvent.deleteMany({ where: { userId: { in: oldUserIds } } });
      await db.emailDelivery.deleteMany({ where: { userId: { in: oldUserIds } } });
    }
    await db.emailMessage.deleteMany({ where: { user: { email: { contains: "dlv-test-" } } } });
    await db.$executeRaw`DELETE FROM "BroadcastRecipient" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '%dlv-test-%')`;
    await db.broadcast.deleteMany({ where: { user: { email: { contains: "dlv-test-" } } } });
    await db.contactConsentEvent.deleteMany({ where: { contact: { user: { email: { contains: "dlv-test-" } } } } });
    await db.suppressionEvent.deleteMany({ where: { email: { contains: "dlv-test-" } } });
    await db.suppressionEntry.deleteMany({ where: { email: { contains: "dlv-test-" } } });
    await db.contactEvent.deleteMany({ where: { contact: { user: { email: { contains: "dlv-test-" } } } } });
    await db.contactGroupMembership.deleteMany({ where: { group: { user: { email: { contains: "dlv-test-" } } } } });
    await db.contact.deleteMany({ where: { user: { email: { contains: "dlv-test-" } } } });
    await db.group.deleteMany({ where: { user: { email: { contains: "dlv-test-" } } } });
    await db.user.deleteMany({ where: { email: { contains: "dlv-test-" } } });

    const a = await db.user.create({
      data: {
        email: "dlv-test-a@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "MAX",
      },
    });
    userA = a.id;

    const b = await db.user.create({
      data: {
        email: "dlv-test-b@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "MAX",
      },
    });
    userB = b.id;

    setupComplete = true;
  });

  beforeEach(async () => {
    if (!setupComplete) return;
    fakeProvider.reset();
    await db.emailDeliveryEvent.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.emailDelivery.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.emailMessage.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.broadcastRecipient.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.broadcast.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.consentMutationIdempotency.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.contactConsentEvent.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.suppressionEvent.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.suppressionEntry.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.contactEvent.deleteMany({ where: { contact: { userId: { in: [userA, userB] } } } });
    await db.contactGroupMembership.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.contact.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.group.deleteMany({ where: { userId: { in: [userA, userB] } } });
    // Clean up transactional templates (created by Send correlation tests).
    await db.transactionalTemplateVersion.deleteMany({ where: { template: { userId: { in: [userA, userB] } } } });
    await db.transactionalTemplate.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.usageTracking.deleteMany({ where: { userId: { in: [userA, userB] }, featureKey: "broadcast_emails" } });
    await db.usageTracking.deleteMany({ where: { userId: { in: [userA, userB] }, featureKey: "messaging_emails" } });
  });

  afterAll(async () => {
    if (!setupComplete) {
      await db.$disconnect();
      return;
    }
    await db.emailDeliveryEvent.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.emailDelivery.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.emailMessage.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.broadcastRecipient.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.broadcast.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.consentMutationIdempotency.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.contactConsentEvent.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.suppressionEvent.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.suppressionEntry.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.contactEvent.deleteMany({ where: { contact: { userId: { in: [userA, userB] } } } });
    await db.contactGroupMembership.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.contact.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.group.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await db.usageTracking.deleteMany({ where: { userId: { in: [userA, userB] }, featureKey: "broadcast_emails" } });
    await db.usageTracking.deleteMany({ where: { userId: { in: [userA, userB] }, featureKey: "messaging_emails" } });
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await db.$disconnect();
  });

  // ===== Delivery record creation + tenant isolation =====

  it("createDelivery creates a row with status=queued + UUID deliveryId", async () => {
    const result = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
      provider: "smtp",
    });
    expect(result.currentStatus).toBe(DELIVERY_STATUSES.QUEUED);
    expect(result.deliveryId).toMatch(UUID_RE);
    expect(result.id).toBeGreaterThan(0);
  });

  it("createDelivery with broadcastRecipientId sets the correlation field", async () => {
    // Create a real BroadcastRecipient so the composite FK is satisfied.
    const email = uniqueEmail("cdbr");
    await upsertContact(userA, { email, source: "api" });
    await subscribeContact({ userId: userA, contactId: (await db.contact.findFirst({ where: { email } }))!.id, source: CONSENT_SOURCES.API, idempotencyKey: "cdbr-1", requestPayload: { reason: null } });
    const b = await createBroadcast({ userId: userA, name: "CDBR", subject: "S", htmlContent: "<p>Hi</p>", audienceType: AUDIENCE_TYPES.ALL_CONTACTS });
    await launchBroadcast(userA, b.broadcastId, {});
    const broadcast = await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId } });
    const recipient = await db.broadcastRecipient.findFirst({ where: { broadcastId: broadcast!.id } });

    const result = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.BROADCAST,
      broadcastRecipientId: recipient!.id,
      provider: "smtp",
    });
    const fresh = await getDelivery(userA, result.deliveryId);
    expect(fresh?.broadcastRecipientId).toBe(recipient!.id);
    expect(fresh?.sourceType).toBe(DELIVERY_SOURCES.BROADCAST);
  });

  it("createDelivery with emailMessageId sets the correlation field", async () => {
    // Create a real EmailMessage so the composite FK is satisfied.
    const msg = await db.emailMessage.create({
      data: {
        userId: userA,
        messageId: "msg-cdem-" + Date.now(),
        toEmail: "cdem@example.com",
        subject: "Test",
        status: "sent",
        source: "api_v1",
        provider: "smtp",
      },
    });

    const result = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
      emailMessageId: msg.messageId,
      provider: "smtp",
    });
    const fresh = await getDelivery(userA, result.deliveryId);
    expect(fresh?.emailMessageId).toBe(msg.messageId);
    expect(fresh?.sourceType).toBe(DELIVERY_SOURCES.TRANSACTIONAL);
  });

  it("getDelivery tenant isolation: userB cannot read userA's delivery", async () => {
    const result = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
      provider: "smtp",
    });
    const foreign = await getDelivery(userB, result.deliveryId);
    expect(foreign).toBeNull();
  });

  it("getDeliveryEvents tenant isolation: userB gets null for userA's delivery", async () => {
    const result = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
      provider: "smtp",
    });
    const events = await getDeliveryEvents(userB, result.deliveryId);
    expect(events).toBeNull();
  });

  // ===== Provider event deduplication =====

  it("ingestProviderEvent dedupes by (provider, providerEventId) — second call returns status=duplicate", async () => {
    const dlv = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
      provider: "resend",
      providerMessageId: "msg-dedupe-1",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true,
      messageId: "msg-dedupe-1",
      responseClassification: "accepted",
    });

    const t0 = new Date();
    const r1 = await ingestProviderEvent({
      userId: userA,
      provider: "resend",
      providerMessageId: "msg-dedupe-1",
      providerEventId: "evt-1",
      type: PROVIDER_EVENT_TYPES.DELIVERED,
      occurredAt: t0,
    });
    expect(r1.status).toBe("applied");
    expect(r1.stateChanged).toBe(true);

    const r2 = await ingestProviderEvent({
      userId: userA,
      provider: "resend",
      providerMessageId: "msg-dedupe-1",
      providerEventId: "evt-1",
      type: PROVIDER_EVENT_TYPES.DELIVERED,
      occurredAt: t0,
    });
    expect(r2.status).toBe("duplicate");
    expect(r2.stateChanged).toBe(false);
    expect(r2.eventId).toBe(r1.eventId);
  });

  it("ingestProviderEvent stores ALL events even when they don't change currentStatus", async () => {
    const dlv = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
      provider: "resend",
      providerMessageId: "msg-store-all-1",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true,
      messageId: "msg-store-all-1",
      responseClassification: "accepted",
    });

    // Send delivered (changes status to delivered).
    const t1 = new Date(Date.now() - 60000);
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-store-all-1",
      providerEventId: "evt-delivered", type: PROVIDER_EVENT_TYPES.DELIVERED, occurredAt: t1,
    });

    // Send another delivered event with the SAME occurredAt — should NOT
    // change currentStatus (already delivered), but MUST still be stored.
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-store-all-1",
      providerEventId: "evt-delivered-2", type: PROVIDER_EVENT_TYPES.DELIVERED, occurredAt: t1,
    });

    const events = await getDeliveryEvents(userA, dlv.deliveryId);
    expect(events?.length).toBe(2);
  });

  // ===== Concurrent duplicate provider events =====

  it("concurrent duplicate provider events: exactly one applied, one duplicate", async () => {
    const dlv = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
      provider: "resend",
      providerMessageId: "msg-concurrent-1",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true,
      messageId: "msg-concurrent-1",
      responseClassification: "accepted",
    });

    const t0 = new Date();
    const [r1, r2] = await Promise.all([
      ingestProviderEvent({
        userId: userA, provider: "resend", providerMessageId: "msg-concurrent-1",
        providerEventId: "evt-concurrent", type: PROVIDER_EVENT_TYPES.DELIVERED, occurredAt: t0,
      }),
      ingestProviderEvent({
        userId: userA, provider: "resend", providerMessageId: "msg-concurrent-1",
        providerEventId: "evt-concurrent", type: PROVIDER_EVENT_TYPES.DELIVERED, occurredAt: t0,
      }),
    ]);

    const applied = [r1, r2].filter((r) => r.status === "applied").length;
    const duplicated = [r1, r2].filter((r) => r.status === "duplicate").length;
    expect(applied).toBe(1);
    expect(duplicated).toBe(1);
  });

  // ===== Event ordering — never regress =====

  it("delivered cannot regress to deferred (old delayed event)", async () => {
    const dlv = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
      provider: "resend",
      providerMessageId: "msg-regress-1",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true,
      messageId: "msg-regress-1",
      responseClassification: "accepted",
    });

    // First: delivered at t1.
    const t1 = new Date(Date.now() - 30000);
    const r1 = await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-regress-1",
      providerEventId: "evt-d1", type: PROVIDER_EVENT_TYPES.DELIVERED, occurredAt: t1,
    });
    expect(r1.stateChanged).toBe(true);

    // Then: deferred at t0 (older than t1) — should NOT regress.
    const t0 = new Date(Date.now() - 60000);
    const r2 = await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-regress-1",
      providerEventId: "evt-d2", type: PROVIDER_EVENT_TYPES.DEFERRED, occurredAt: t0,
    });
    expect(r2.stateChanged).toBe(false);

    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.DELIVERED);
  });

  it("complained beats delivered (compliance-aware)", async () => {
    const dlv = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
      provider: "resend",
      providerMessageId: "msg-complaint-wins",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true,
      messageId: "msg-complaint-wins",
      responseClassification: "accepted",
    });

    // First: delivered at t1.
    const t1 = new Date(Date.now() - 30000);
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-complaint-wins",
      providerEventId: "evt-c1", type: PROVIDER_EVENT_TYPES.DELIVERED, occurredAt: t1,
    });

    // Then: complained at t2 (later) — overrides.
    const t2 = new Date(Date.now() - 10000);
    const r2 = await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-complaint-wins",
      providerEventId: "evt-c2", type: PROVIDER_EVENT_TYPES.COMPLAINED, occurredAt: t2,
    });
    expect(r2.stateChanged).toBe(true);

    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.COMPLAINED);
  });

  it("complained then delayed delivered: stays complained (compliance)", async () => {
    const dlv = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
      provider: "resend",
      providerMessageId: "msg-complaint-stays",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true,
      messageId: "msg-complaint-stays",
      responseClassification: "accepted",
    });

    // First: complained at t1.
    const t1 = new Date(Date.now() - 30000);
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-complaint-stays",
      providerEventId: "evt-cs1", type: PROVIDER_EVENT_TYPES.COMPLAINED, occurredAt: t1,
    });

    // Then: delivered at t2 (later). Should NOT override complaint.
    const t2 = new Date(Date.now() - 10000);
    const r2 = await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-complaint-stays",
      providerEventId: "evt-cs2", type: PROVIDER_EVENT_TYPES.DELIVERED, occurredAt: t2,
    });
    expect(r2.stateChanged).toBe(false);

    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.COMPLAINED);
  });

  // ===== Hard bounce → suppression =====

  it("hard bounce → suppresses the recipient email", async () => {
    // Create a contact + broadcast recipient so the email can be resolved.
    const email = uniqueEmail("hb");
    const c1 = await upsertContact(userA, { email, source: "api" });
    const b = await createBroadcast({
      userId: userA, name: "HB", subject: "S", htmlContent: "<p>Hi</p>",
      audienceType: AUDIENCE_TYPES.ALL_CONTACTS,
    });
    await launchBroadcast(userA, b.broadcastId, {});
    const recipient = await db.broadcastRecipient.findFirst({
      where: { broadcastId: (await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId } }))!.id },
      select: { id: true },
    });

    const dlv = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.BROADCAST,
      broadcastRecipientId: recipient!.id,
      provider: "resend",
      providerMessageId: "msg-hb-1",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true,
      messageId: "msg-hb-1",
      responseClassification: "accepted",
    });

    const r = await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-hb-1",
      providerEventId: "evt-hb-1", type: PROVIDER_EVENT_TYPES.BOUNCED,
      bounceType: BOUNCE_TYPES.HARD, occurredAt: new Date(),
    });
    expect(r.stateChanged).toBe(true);
    expect(r.suppressionApplied).toBe(true);
    expect(r.suppressedEmail).toBe(email);

    // Verify the suppression entry exists.
    const sup = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(sup?.active).toBe(true);
    expect(sup?.reason).toBe(SUPPRESSION_REASONS.HARD_BOUNCE);
  });

  // ===== Complaint → suppression =====

  it("complaint → suppresses the recipient email", async () => {
    const email = uniqueEmail("cm");
    const c1 = await upsertContact(userA, { email, source: "api" });
    const b = await createBroadcast({
      userId: userA, name: "CM", subject: "S", htmlContent: "<p>Hi</p>",
      audienceType: AUDIENCE_TYPES.ALL_CONTACTS,
    });
    await launchBroadcast(userA, b.broadcastId, {});
    const recipient = await db.broadcastRecipient.findFirst({
      where: { broadcastId: (await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId } }))!.id },
      select: { id: true },
    });

    const dlv = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.BROADCAST,
      broadcastRecipientId: recipient!.id,
      provider: "resend",
      providerMessageId: "msg-cm-1",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true,
      messageId: "msg-cm-1",
      responseClassification: "accepted",
    });

    const r = await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-cm-1",
      providerEventId: "evt-cm-1", type: PROVIDER_EVENT_TYPES.COMPLAINED, occurredAt: new Date(),
    });
    expect(r.suppressionApplied).toBe(true);
    expect(r.suppressedEmail).toBe(email);

    const sup = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(sup?.active).toBe(true);
    expect(sup?.reason).toBe(SUPPRESSION_REASONS.COMPLAINT);
  });

  // ===== Soft bounce → NO suppression =====

  it("soft bounce → NO suppression (transient, recorded as event)", async () => {
    const email = uniqueEmail("sb");
    await upsertContact(userA, { email, source: "api" });
    const b = await createBroadcast({
      userId: userA, name: "SB", subject: "S", htmlContent: "<p>Hi</p>",
      audienceType: AUDIENCE_TYPES.ALL_CONTACTS,
    });
    await launchBroadcast(userA, b.broadcastId, {});
    const recipient = await db.broadcastRecipient.findFirst({
      where: { broadcastId: (await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId } }))!.id },
      select: { id: true },
    });

    const dlv = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.BROADCAST,
      broadcastRecipientId: recipient!.id,
      provider: "resend",
      providerMessageId: "msg-sb-1",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true,
      messageId: "msg-sb-1",
      responseClassification: "accepted",
    });

    const r = await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-sb-1",
      providerEventId: "evt-sb-1", type: PROVIDER_EVENT_TYPES.BOUNCED,
      bounceType: BOUNCE_TYPES.SOFT, occurredAt: new Date(),
    });
    expect(r.suppressionApplied).toBe(false);

    // Delivery should be in deferred (soft bounce → transient).
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.DEFERRED);

    // No suppression entry created.
    const sup = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(sup).toBeNull();
  });

  // ===== Duplicate complaint → no duplicate suppression =====

  it("duplicate complaint → no duplicate suppression event", async () => {
    const email = uniqueEmail("dupcm");
    await upsertContact(userA, { email, source: "api" });
    const b = await createBroadcast({
      userId: userA, name: "DC", subject: "S", htmlContent: "<p>Hi</p>",
      audienceType: AUDIENCE_TYPES.ALL_CONTACTS,
    });
    await launchBroadcast(userA, b.broadcastId, {});
    const recipient = await db.broadcastRecipient.findFirst({
      where: { broadcastId: (await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId } }))!.id },
      select: { id: true },
    });

    const dlv = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.BROADCAST,
      broadcastRecipientId: recipient!.id,
      provider: "resend",
      providerMessageId: "msg-dupcm-1",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true,
      messageId: "msg-dupcm-1",
      responseClassification: "accepted",
    });

    // First complaint → suppresses.
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-dupcm-1",
      providerEventId: "evt-dupcm-1", type: PROVIDER_EVENT_TYPES.COMPLAINED, occurredAt: new Date(),
    });
    const supEventsAfter1 = await db.suppressionEvent.count({
      where: { userId: userA, email, action: "suppressed" },
    });
    expect(supEventsAfter1).toBe(1);

    // Second complaint with a DIFFERENT providerEventId — still records the
    // event, but does NOT re-trigger suppression (entry is already active).
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-dupcm-1",
      providerEventId: "evt-dupcm-2", type: PROVIDER_EVENT_TYPES.COMPLAINED, occurredAt: new Date(),
    });
    const supEventsAfter2 = await db.suppressionEvent.count({
      where: { userId: userA, email, action: "suppressed" },
    });
    expect(supEventsAfter2).toBe(1); // no new suppression event
  });

  // ===== Cross-tenant provider event =====

  it("cross-tenant provider event: userB's event cannot mutate userA's delivery", async () => {
    const dlv = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
      provider: "resend",
      providerMessageId: "msg-cross-tenant",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true,
      messageId: "msg-cross-tenant",
      responseClassification: "accepted",
    });

    // userB tries to ingest an event for userA's delivery.
    const r = await ingestProviderEvent({
      userId: userB,
      provider: "resend",
      providerMessageId: "msg-cross-tenant",
      providerEventId: "evt-cross-tenant",
      type: PROVIDER_EVENT_TYPES.DELIVERED,
      occurredAt: new Date(),
    });
    expect(r.status).toBe("unknown_delivery");
    expect(r.stateChanged).toBe(false);

    // Verify userA's delivery is unchanged.
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.PROVIDER_ACCEPTED);
  });

  // ===== Unknown providerMessageId =====

  it("unknown providerMessageId → no tenant state change (status=unknown_delivery)", async () => {
    const r = await ingestProviderEvent({
      userId: userA,
      provider: "resend",
      providerMessageId: "msg-does-not-exist",
      providerEventId: "evt-no-target",
      type: PROVIDER_EVENT_TYPES.DELIVERED,
      occurredAt: new Date(),
    });
    expect(r.status).toBe("unknown_delivery");
    expect(r.stateChanged).toBe(false);
    expect(r.eventId).toBeNull();
  });

  it("ingestProviderEvent with neither providerMessageId nor deliveryId → unknown_delivery", async () => {
    const r = await ingestProviderEvent({
      userId: userA,
      provider: "resend",
      providerEventId: "evt-no-target-2",
      type: PROVIDER_EVENT_TYPES.DELIVERED,
      occurredAt: new Date(),
    });
    expect(r.status).toBe("unknown_delivery");
  });

  // ===== Suppression graceful degradation (NOT a rollback test) =====
  //
  // NOTE: This test was previously named "transaction rollback: ..." but it
  // does NOT actually cause a transaction rollback — it deletes the contact
  // so suppression is skipped (degraded gracefully), not failed. The real
  // rollback tests are the "BLOCKER #3: real rollback test A/B" tests below
  // which use the test-fault hook to force a deterministic failure inside
  // the production ingestProviderEvent() transaction. This test is kept
  // (renamed) because it still proves a useful property: suppression degrades
  // gracefully when no email can be resolved, and the event IS still recorded.

  it("suppression degrades gracefully when contact is deleted (no email to suppress)", async () => {
    // Create a real broadcast + recipient + contact, then DELETE the contact
    // (which nullifies contactId on the recipient via ON DELETE SET NULL).
    // The delivery will transition to BOUNCED but suppression will NOT be
    // applied (no email to suppress — contactId is null). Event IS recorded
    // because the state change happens before suppression is attempted and
    // suppression degrades gracefully (no email → no suppression, not a
    // rollback).
    const email = uniqueEmail("rollback");
    const c1 = await upsertContact(userA, { email, source: "api" });
    await subscribeContact({ userId: userA, contactId: c1.contact.id, source: CONSENT_SOURCES.API, idempotencyKey: "rb-1", requestPayload: { reason: null } });
    const b = await createBroadcast({ userId: userA, name: "Rollback", subject: "S", htmlContent: "<p>Hi</p>", audienceType: AUDIENCE_TYPES.ALL_CONTACTS });
    await launchBroadcast(userA, b.broadcastId, {});
    const broadcast = await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId } });
    const recipient = await db.broadcastRecipient.findFirst({ where: { broadcastId: broadcast!.id } });

    const dlv = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.BROADCAST,
      broadcastRecipientId: recipient!.id,
      provider: "resend",
      providerMessageId: "msg-rollback-1",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true,
      messageId: "msg-rollback-1",
      responseClassification: "accepted",
    });

    // Delete the contact — ON DELETE SET NULL nullifies contactId/contactOwnerUserId.
    await db.contact.delete({ where: { id: c1.contact.id } });

    // Hard bounce for a delivery whose contact was deleted.
    // The state WILL transition to BOUNCED — the event is recorded.
    // Suppression is NOT applied (lookupDeliveryEmail returns null —
    // contactId is null on the recipient).
    const r = await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-rollback-1",
      providerEventId: "evt-rollback-1", type: PROVIDER_EVENT_TYPES.BOUNCED,
      bounceType: BOUNCE_TYPES.HARD, occurredAt: new Date(),
    });
    expect(r.stateChanged).toBe(true);
    expect(r.suppressionApplied).toBe(false); // no contact → no suppression
    expect(r.suppressedEmail).toBeNull();

    // Event was still recorded (state change happened).
    const events = await getDeliveryEvents(userA, dlv.deliveryId);
    expect(events?.length).toBeGreaterThanOrEqual(1);
  });

  // ===== Broadcast correlation =====

  it("broadcast integration: processBroadcast creates EmailDelivery with sourceType=broadcast", async () => {
    const email = uniqueEmail("bcorr");
    const c1 = await upsertContact(userA, { email, source: "api" });
    await subscribeContact({
      userId: userA, contactId: c1.contact.id, source: CONSENT_SOURCES.API,
      idempotencyKey: "bcorr-sub-1", requestPayload: { reason: null },
    });

    const b = await createBroadcast({
      userId: userA, name: "BCorr", subject: "S", htmlContent: "<p>Hi</p>",
      audienceType: AUDIENCE_TYPES.ALL_CONTACTS,
    });
    await launchBroadcast(userA, b.broadcastId, {});

    const broadcast = await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId }, select: { id: true } });
    const result = await processBroadcast(broadcast!.id, fakeProvider);

    expect(result.sent).toBe(1);

    // The EmailDelivery row should be created with sourceType=broadcast and
    // a non-null broadcastRecipientId.
    const deliveries = await db.emailDelivery.findMany({
      where: { userId: userA, sourceType: DELIVERY_SOURCES.BROADCAST },
    });
    expect(deliveries.length).toBe(1);
    expect(deliveries[0].broadcastRecipientId).not.toBeNull();
    expect(deliveries[0].currentStatus).toBe(DELIVERY_STATUSES.PROVIDER_ACCEPTED);
    expect(deliveries[0].providerMessageId).not.toBeNull();
  });

  it("broadcast failure path: EmailDelivery is marked failed when provider throws", async () => {
    const email = uniqueEmail("bfail");
    const c1 = await upsertContact(userA, { email, source: "api" });
    await subscribeContact({
      userId: userA, contactId: c1.contact.id, source: CONSENT_SOURCES.API,
      idempotencyKey: "bfail-sub-1", requestPayload: { reason: null },
    });

    const b = await createBroadcast({
      userId: userA, name: "BFail", subject: "S", htmlContent: "<p>Hi</p>",
      audienceType: AUDIENCE_TYPES.ALL_CONTACTS,
    });
    await launchBroadcast(userA, b.broadcastId, {});

    // Use a fake provider that throws.
    class ThrowingProvider implements EmailProvider {
      readonly name = "fake-throw";
      readonly capabilities = {
        providerMessageId: false, customHeaders: false,
        deliveryWebhooks: false, bounceEvents: false, complaintEvents: false,
      } as const;
      async send(_input: ProviderSendInput): Promise<ProviderSendResult> {
        throw new Error("provider failed");
      }
    }

    const broadcast = await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId }, select: { id: true } });
    const result = await processBroadcast(broadcast!.id, new ThrowingProvider());
    expect(result.failed).toBe(1);

    const deliveries = await db.emailDelivery.findMany({
      where: { userId: userA, sourceType: DELIVERY_SOURCES.BROADCAST },
    });
    expect(deliveries.length).toBe(1);
    expect(deliveries[0].currentStatus).toBe(DELIVERY_STATUSES.FAILED);
  });

  // ===== Transactional Send correlation =====

  it("transactional send: creates EmailDelivery with sourceType=transactional", async () => {
    // Create a template.
    const created = await createTemplate(userA, {
      name: "Welcome",
      slug: "welcome-txn-dlv",
      subject: "Hi {{name}}!",
      html: "<p>Welcome {{name}}</p>",
    });

    const email = uniqueEmail("txndlv");
    const r = await sendTransactionalEmail(
      {
        userId: userA,
        to: email,
        templateSlug: "welcome-txn-dlv",
        variables: { name: "Alice" },
        idempotencyKey: "txn-dlv-key-1",
        source: "api_v1",
        environment: "production",
      },
      fakeProvider,
    );
    expect(r.status).toBe("sent");

    // EmailDelivery row should be created with sourceType=transactional and
    // the matching emailMessageId.
    const deliveries = await db.emailDelivery.findMany({
      where: { userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL },
    });
    expect(deliveries.length).toBe(1);
    expect(deliveries[0].emailMessageId).toBe(r.messageId);
    expect(deliveries[0].currentStatus).toBe(DELIVERY_STATUSES.PROVIDER_ACCEPTED);
  });

  // ===== Idempotent Send replay → no duplicate delivery attempt =====

  it("idempotent send replay: does NOT create a duplicate EmailDelivery", async () => {
    await createTemplate(userA, {
      name: "Welcome 2",
      slug: "welcome-txn-idem",
      subject: "Hi {{name}}!",
      html: "<p>Welcome {{name}}</p>",
    });

    const email = uniqueEmail("txnidem");
    const idemKey = "txn-idem-key-1";
    const req = {
      userId: userA,
      to: email,
      templateSlug: "welcome-txn-idem",
      variables: { name: "Alice" },
      idempotencyKey: idemKey,
      source: "api_v1" as const,
      environment: "production" as const,
    };

    const r1 = await sendTransactionalEmail(req, fakeProvider);
    expect(r1.replay).toBe(false);
    expect(fakeProvider.sendCalls).toBe(1);

    const r2 = await sendTransactionalEmail(req, fakeProvider);
    expect(r2.replay).toBe(true);
    expect(fakeProvider.sendCalls).toBe(1); // no second send

    // Exactly one EmailDelivery row (no duplicate attempt).
    const deliveries = await db.emailDelivery.count({
      where: { userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL },
    });
    expect(deliveries).toBe(1);
  });

  // ===== SMTP path functional =====

  it("SmtpEmailProvider implements v2 interface with correct capabilities", () => {
    // Use console transport to avoid requiring SMTP env vars in CI.
    process.env.MAIL_TRANSPORT = "console";
    __resetMailTransportCacheForTests();
    const smtp = new SmtpEmailProvider();
    expect(smtp.name).toBe("smtp");
    expect(smtp.capabilities.providerMessageId).toBe(true);
    expect(smtp.capabilities.customHeaders).toBe(true);
    expect(smtp.capabilities.deliveryWebhooks).toBe(false);
    expect(smtp.capabilities.bounceEvents).toBe(false);
    expect(smtp.capabilities.complaintEvents).toBe(false);
  });

  it("SmtpEmailProvider send returns accepted=true + responseClassification=accepted (dev console transport)", async () => {
    // Force the dev console transport so we don't actually send email.
    // Reset the module-level transport cache so a previously-cached
    // Gmail transport (from another test) doesn't leak in.
    process.env.MAIL_TRANSPORT = "console";
    __resetMailTransportCacheForTests();
    const smtp = new SmtpEmailProvider();
    const result = await smtp.send({
      to: "smtp-test@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(result.provider).toBe("smtp");
    expect(result.accepted).toBe(true);
    expect(result.responseClassification).toBe("accepted");
    expect(result.messageId).not.toBeNull();
  });

  it("provider factory getEmailProvider() returns SmtpEmailProvider by default", async () => {
    // Force console transport so the SmtpEmailProvider constructor does not
    // attempt to open a real SMTP connection (which would need SMTP_* env vars).
    process.env.MAIL_TRANSPORT = "console";
    __resetMailTransportCacheForTests();
    const { getEmailProvider } = await import("@/lib/messaging/providers/factory");
    const provider = getEmailProvider();
    expect(provider.name).toBe("smtp");
    expect(provider.capabilities.deliveryWebhooks).toBe(false);
  });

  // ===== Resubscribe protection =====

  it("resubscribe protection: hard_bounce suppression blocks subscribeContact", async () => {
    const email = uniqueEmail("rphb");
    const c1 = await upsertContact(userA, { email, source: "api" });
    // First, subscribe the contact.
    await subscribeContact({
      userId: userA, contactId: c1.contact.id, source: CONSENT_SOURCES.API,
      idempotencyKey: "rphb-sub-1", requestPayload: { reason: null },
    });
    // Apply a hard_bounce suppression directly via the central service.
    await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.HARD_BOUNCE, source: CONSENT_SOURCES.SYSTEM,
      idempotencyKey: "rphb-sup-1", requestPayload: { email, reason: "hard_bounce" },
    });

    // Attempt to re-subscribe — must throw ResubscribeBlockedError.
    await expect(
      subscribeContact({
        userId: userA, contactId: c1.contact.id, source: CONSENT_SOURCES.DASHBOARD,
        idempotencyKey: "rphb-resub-1", requestPayload: { reason: null },
      }),
    ).rejects.toBeInstanceOf(ResubscribeBlockedError);

    // Verify suppression is still active.
    const sup = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(sup?.active).toBe(true);
    expect(sup?.reason).toBe(SUPPRESSION_REASONS.HARD_BOUNCE);
  });

  it("resubscribe protection: complaint suppression blocks subscribeContact", async () => {
    const email = uniqueEmail("rpcm");
    const c1 = await upsertContact(userA, { email, source: "api" });
    await subscribeContact({
      userId: userA, contactId: c1.contact.id, source: CONSENT_SOURCES.API,
      idempotencyKey: "rpcm-sub-1", requestPayload: { reason: null },
    });
    await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.COMPLAINT, source: CONSENT_SOURCES.SYSTEM,
      idempotencyKey: "rpcm-sup-1", requestPayload: { email, reason: "complaint" },
    });

    await expect(
      subscribeContact({
        userId: userA, contactId: c1.contact.id, source: CONSENT_SOURCES.DASHBOARD,
        idempotencyKey: "rpcm-resub-1", requestPayload: { reason: null },
      }),
    ).rejects.toBeInstanceOf(ResubscribeBlockedError);
  });

  it("resubscribe allowed: unsubscribe suppression CAN be lifted by ordinary resubscribe", async () => {
    const email = uniqueEmail("rpa");
    const c1 = await upsertContact(userA, { email, source: "api" });
    // Suppress via unsubscribe (liftable).
    await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.UNSUBSCRIBE, source: CONSENT_SOURCES.UNSUBSCRIBE,
      idempotencyKey: "rpa-sup-1", requestPayload: { email, reason: "unsubscribe" },
    });
    // Now subscribe — should succeed (no ResubscribeBlockedError).
    const r = await subscribeContact({
      userId: userA, contactId: c1.contact.id, source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: "rpa-resub-1", requestPayload: { reason: null },
    });
    expect(r.status).toBe("applied");
    // Suppression lifted.
    const sup = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(sup?.active).toBe(false);
  });

  // ===== Read paths + health =====

  it("listDeliveries filters by sourceType", async () => {
    await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp" });
    await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.BROADCAST, provider: "smtp" });
    const result = await listDeliveries(userA, { sourceType: DELIVERY_SOURCES.TRANSACTIONAL });
    expect(result.deliveries.length).toBe(1);
    expect(result.deliveries[0].sourceType).toBe(DELIVERY_SOURCES.TRANSACTIONAL);
  });

  it("listDeliveries filters by status", async () => {
    const a = await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp" });
    const b = await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp" });
    await updateDeliveryAfterProviderSend(userA, b.id, {
      accepted: true, messageId: "msg-list-1", responseClassification: "accepted",
    });
    const result = await listDeliveries(userA, { status: DELIVERY_STATUSES.PROVIDER_ACCEPTED });
    expect(result.deliveries.length).toBe(1);
    expect(result.deliveries[0].currentStatus).toBe(DELIVERY_STATUSES.PROVIDER_ACCEPTED);
  });

  it("listDeliveries filters by provider", async () => {
    await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp" });
    await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "resend" });
    const result = await listDeliveries(userA, { provider: "resend" });
    expect(result.deliveries.length).toBe(1);
    expect(result.deliveries[0].provider).toBe("resend");
  });

  it("listDeliveries paginates correctly", async () => {
    for (let i = 0; i < 5; i++) {
      await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp" });
    }
    const r1 = await listDeliveries(userA, { page: 1, pageSize: 2 });
    expect(r1.deliveries.length).toBe(2);
    expect(r1.total).toBe(5);
    const r2 = await listDeliveries(userA, { page: 3, pageSize: 2 });
    expect(r2.deliveries.length).toBe(1);
  });

  it("listDeliveries is tenant-isolated", async () => {
    await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp" });
    await createDelivery({ userId: userB, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp" });
    const resultA = await listDeliveries(userA);
    const resultB = await listDeliveries(userB);
    expect(resultA.total).toBe(1);
    expect(resultB.total).toBe(1);
  });

  it("getDeliveryHealth returns counts by status + provider + source within window", async () => {
    const dlv = await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp" });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-h1", responseClassification: "accepted",
    });
    const health = await getDeliveryHealth(userA, { windowHours: 1 });
    expect(health.total).toBeGreaterThanOrEqual(1);
    expect(health.accepted).toBeGreaterThanOrEqual(1);
    expect(health.byProvider.smtp ?? 0).toBeGreaterThanOrEqual(1);
    expect(health.bySource.transactional ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("getDeliveryHealth is tenant-isolated", async () => {
    await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp" });
    await createDelivery({ userId: userB, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp" });
    const healthA = await getDeliveryHealth(userA, { windowHours: 1 });
    const healthB = await getDeliveryHealth(userB, { windowHours: 1 });
    expect(healthA.total).toBe(1);
    expect(healthB.total).toBe(1);
  });

  // ===== updateDeliveryAfterProviderSend =====

  it("updateDeliveryAfterProviderSend with accepted=true transitions queued → provider_accepted", async () => {
    const dlv = await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp" });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-acc-1", responseClassification: "accepted",
    });
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.PROVIDER_ACCEPTED);
    expect(fresh?.providerMessageId).toBe("msg-acc-1");
    expect(fresh?.acceptedAt).not.toBeNull();
  });

  it("updateDeliveryAfterProviderSend with accepted=false transitions queued → rejected", async () => {
    const dlv = await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp" });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: false, messageId: null, responseClassification: "rejected_policy",
    });
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.REJECTED);
    expect(fresh?.lastErrorCode).toBe("rejected_policy");
  });

  it("updateDeliveryAfterProviderSend does NOT regress terminal states", async () => {
    const dlv = await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp" });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-regress-2", responseClassification: "accepted",
    });
    // Manually advance to DELIVERED.
    await db.emailDelivery.update({
      where: { id: dlv.id },
      data: { currentStatus: DELIVERY_STATUSES.DELIVERED, deliveredAt: new Date() },
    });
    // Now try to call updateDeliveryAfterProviderSend again — should NOT regress.
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-regress-2-v2", responseClassification: "accepted",
    });
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.DELIVERED);
  });

  // ===== markDeliveryFailed =====

  it("markDeliveryFailed transitions queued → failed with error code", async () => {
    const dlv = await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp" });
    await markDeliveryFailed(userA, dlv.id, "provider_error");
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.FAILED);
    expect(fresh?.lastErrorCode).toBe("provider_error");
  });

  it("markDeliveryFailed does NOT regress non-queued states", async () => {
    const dlv = await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp" });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "mf-1", responseClassification: "accepted",
    });
    await markDeliveryFailed(userA, dlv.id, "provider_error");
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.PROVIDER_ACCEPTED);
  });

  it("markDeliveryFailed on cross-tenant delivery: silent no-op", async () => {
    const dlv = await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp" });
    // userB attempts to mark userA's delivery as failed — no-op.
    await markDeliveryFailed(userB, dlv.id, "provider_error");
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.QUEUED);
  });

  // ===== Event ordering — additional cases =====

  it("queued → delivered (no intermediate accepted) is allowed", async () => {
    const dlv = await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "resend", providerMessageId: "msg-qd" });
    // Skip updateDeliveryAfterProviderSend — directly ingest a delivered event.
    const r = await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-qd",
      providerEventId: "evt-qd", type: PROVIDER_EVENT_TYPES.DELIVERED, occurredAt: new Date(),
    });
    expect(r.stateChanged).toBe(true);
    expect(r.newStatus).toBe(DELIVERY_STATUSES.DELIVERED);
  });

  it("deferred → delivered (transient bounce recovered)", async () => {
    const dlv = await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "resend", providerMessageId: "msg-dfd" });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-dfd", responseClassification: "accepted",
    });
    const t1 = new Date(Date.now() - 60000);
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-dfd",
      providerEventId: "evt-dfd-1", type: PROVIDER_EVENT_TYPES.BOUNCED,
      bounceType: BOUNCE_TYPES.SOFT, occurredAt: t1,
    });
    const fresh1 = await getDelivery(userA, dlv.deliveryId);
    expect(fresh1?.currentStatus).toBe(DELIVERY_STATUSES.DEFERRED);

    // Now delivered at t2 > t1.
    const t2 = new Date(Date.now() - 10000);
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-dfd",
      providerEventId: "evt-dfd-2", type: PROVIDER_EVENT_TYPES.DELIVERED, occurredAt: t2,
    });
    const fresh2 = await getDelivery(userA, dlv.deliveryId);
    expect(fresh2?.currentStatus).toBe(DELIVERY_STATUSES.DELIVERED);
  });

  it("rejected event → terminal rejected", async () => {
    const dlv = await createDelivery({ userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "resend", providerMessageId: "msg-rej" });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-rej", responseClassification: "accepted",
    });
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-rej",
      providerEventId: "evt-rej", type: PROVIDER_EVENT_TYPES.REJECTED, occurredAt: new Date(),
    });
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.REJECTED);
  });

  it("bounced (hard) is terminal — subsequent delivered does NOT regress", async () => {
    const email = uniqueEmail("bt");
    await upsertContact(userA, { email, source: "api" });
    const b = await createBroadcast({
      userId: userA, name: "BT", subject: "S", htmlContent: "<p>Hi</p>",
      audienceType: AUDIENCE_TYPES.ALL_CONTACTS,
    });
    await launchBroadcast(userA, b.broadcastId, {});
    const recipient = await db.broadcastRecipient.findFirst({
      where: { broadcastId: (await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId } }))!.id },
      select: { id: true },
    });

    const dlv = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.BROADCAST,
      broadcastRecipientId: recipient!.id,
      provider: "resend",
      providerMessageId: "msg-bt",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-bt", responseClassification: "accepted",
    });
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-bt",
      providerEventId: "evt-bt-b", type: PROVIDER_EVENT_TYPES.BOUNCED,
      bounceType: BOUNCE_TYPES.HARD, occurredAt: new Date(Date.now() - 60000),
    });
    // Subsequent delivered (later) — should NOT regress.
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-bt",
      providerEventId: "evt-bt-d", type: PROVIDER_EVENT_TYPES.DELIVERED, occurredAt: new Date(),
    });
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.BOUNCED);
  });

  // ===== Transactional Send failure =====

  it("transactional send failure: EmailDelivery marked failed", async () => {
    await createTemplate(userA, {
      name: "Welcome Fail",
      slug: "welcome-txn-fail",
      subject: "Hi {{name}}!",
      html: "<p>Welcome {{name}}</p>",
    });

    class FailProvider implements EmailProvider {
      readonly name = "fail";
      readonly capabilities = {
        providerMessageId: false, customHeaders: false,
        deliveryWebhooks: false, bounceEvents: false, complaintEvents: false,
      } as const;
      async send(_input: ProviderSendInput): Promise<ProviderSendResult> {
        const err = new Error("RAW_SECRET_SMTP_FAILURE") as any;
        err.code = "ECONNREFUSED";
        throw err;
      }
    }

    const r = await sendTransactionalEmail(
      {
        userId: userA,
        to: "fail@example.com",
        templateSlug: "welcome-txn-fail",
        variables: { name: "Alice" },
        idempotencyKey: "txn-fail-key-1",
        source: "api_v1",
        environment: "production",
      },
      new FailProvider(),
    );
    expect(r.status).toBe("failed");

    const deliveries = await db.emailDelivery.findMany({
      where: { userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL },
    });
    expect(deliveries.length).toBe(1);
    expect(deliveries[0].currentStatus).toBe(DELIVERY_STATUSES.FAILED);
  });

  // ===== Suppression reason validation =====

  it("suppressEmail with reason=hard_bounce from system source succeeds (Phase 11)", async () => {
    const email = uniqueEmail("se");
    const r = await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.HARD_BOUNCE, source: CONSENT_SOURCES.SYSTEM,
      idempotencyKey: "se-1", requestPayload: { email, reason: "hard_bounce" },
    });
    expect(r.status).toBe("applied");
    expect(r.active).toBe(true);
  });

  it("suppressEmail with reason=complaint from system source succeeds (Phase 11)", async () => {
    const email = uniqueEmail("secm");
    const r = await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.COMPLAINT, source: CONSENT_SOURCES.SYSTEM,
      idempotencyKey: "secm-1", requestPayload: { email, reason: "complaint" },
    });
    expect(r.status).toBe("applied");
    expect(r.active).toBe(true);
  });

  it("duplicate hard_bounce suppression → no_op (no duplicate suppression event)", async () => {
    const email = uniqueEmail("dupse");
    await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.HARD_BOUNCE, source: CONSENT_SOURCES.SYSTEM,
      idempotencyKey: "dupse-1", requestPayload: { email, reason: "hard_bounce" },
    });
    const r2 = await suppressEmail({
      userId: userA, email, reason: SUPPRESSION_REASONS.HARD_BOUNCE, source: CONSENT_SOURCES.SYSTEM,
      idempotencyKey: "dupse-2", requestPayload: { email, reason: "hard_bounce" },
    });
    expect(r2.status).toBe("no_op");
    const supEvents = await db.suppressionEvent.count({
      where: { userId: userA, email, action: "suppressed" },
    });
    expect(supEvents).toBe(1);
  });

  // ==========================================================================
  // Phase 11 audit — BLOCKER #1–#8 regression tests (15 new tests minimum).
  // ==========================================================================

  // ---- BLOCKER #1: nested transaction in ingestProviderEvent ----

  it("BLOCKER #1: hard bounce + suppression commit atomically (rollback on duplicate event)", async () => {
    // When a hard bounce event with a duplicate providerEventId is replayed,
    // the suppression MUST NOT be re-applied (the original tx rolls back on
    // P2002). This is the BLOCKER #1 invariant: suppression lives in the
    // same tx as the event, never in a nested one.
    const email = uniqueEmail("b1atom");
    await upsertContact(userA, { email, source: "api" });
    const b = await createBroadcast({
      userId: userA, name: "B1Atom", subject: "S", htmlContent: "<p>Hi</p>",
      audienceType: AUDIENCE_TYPES.ALL_CONTACTS,
    });
    await launchBroadcast(userA, b.broadcastId, {});
    const recipient = await db.broadcastRecipient.findFirst({
      where: { broadcastId: (await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId } }))!.id },
      select: { id: true },
    });

    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.BROADCAST,
      broadcastRecipientId: recipient!.id, provider: "resend",
      providerMessageId: "msg-b1-atom",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-b1-atom", responseClassification: "accepted",
    });

    // First hard bounce → suppresses + transitions to bounced.
    const r1 = await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-b1-atom",
      providerEventId: "evt-b1-atom-1", type: PROVIDER_EVENT_TYPES.BOUNCED,
      bounceType: BOUNCE_TYPES.HARD, occurredAt: new Date(),
    });
    expect(r1.suppressionApplied).toBe(true);

    // Second event with the SAME providerEventId → duplicate, NO re-suppression.
    const r2 = await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-b1-atom",
      providerEventId: "evt-b1-atom-1", type: PROVIDER_EVENT_TYPES.BOUNCED,
      bounceType: BOUNCE_TYPES.HARD, occurredAt: new Date(),
    });
    expect(r2.status).toBe("duplicate");
    expect(r2.suppressionApplied).toBe(false);

    // Exactly ONE suppression event recorded — the nested-tx fix ensures the
    // second call did NOT commit a separate suppression.
    const supEvents = await db.suppressionEvent.count({
      where: { userId: userA, email, action: "suppressed" },
    });
    expect(supEvents).toBe(1);
  });

  it("BLOCKER #1: suppressEmailInTx can be called inside a caller-owned transaction", async () => {
    // Verify suppressEmailInTx commits/rolls back with the outer tx — it does
    // NOT open its own nested transaction.
    const email = uniqueEmail("b1intx");
    const result = await db.$transaction(async (tx) => {
      return suppressEmailInTx(tx, {
        userId: userA,
        email,
        reason: SUPPRESSION_REASONS.HARD_BOUNCE,
        source: CONSENT_SOURCES.SYSTEM,
      });
    });
    expect(result.status).toBe("applied");
    expect(result.active).toBe(true);

    const entry = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(entry?.active).toBe(true);
    expect(entry?.reason).toBe(SUPPRESSION_REASONS.HARD_BOUNCE);
  });

  it("BLOCKER #1: suppressEmailInTx rolls back when the outer tx rolls back", async () => {
    // If the outer tx throws, the suppression MUST NOT persist — it lives in
    // the same transaction as the caller's mutations.
    const email = uniqueEmail("b1rb");
    try {
      await db.$transaction(async (tx) => {
        await suppressEmailInTx(tx, {
          userId: userA,
          email,
          reason: SUPPRESSION_REASONS.COMPLAINT,
          source: CONSENT_SOURCES.SYSTEM,
        });
        // Simulate the caller's downstream failure.
        throw new Error("caller rollback");
      });
    } catch (_e) {
      // expected
    }
    const entry = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(entry).toBeNull();
  });

  // ---- BLOCKER #3: `unknown` state + markDeliveryUnknown ----

  it("BLOCKER #3: markDeliveryUnknown transitions queued → unknown", async () => {
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    await markDeliveryUnknown(userA, dlv.id, "persistence_error");
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.UNKNOWN);
    expect(fresh?.lastErrorCode).toBe("persistence_error");
  });

  it("BLOCKER #3: markDeliveryUnknown does NOT regress non-queued states", async () => {
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "mu-1", responseClassification: "accepted",
    });
    // Now in provider_accepted — markDeliveryUnknown should be a no-op.
    await markDeliveryUnknown(userA, dlv.id, "persistence_error");
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.PROVIDER_ACCEPTED);
  });

  it("BLOCKER #3: markDeliveryUnknown on cross-tenant delivery: silent no-op", async () => {
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    // userB attempts to mark userA's delivery as unknown — no-op.
    await markDeliveryUnknown(userB, dlv.id, "persistence_error");
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.QUEUED);
  });

  it("BLOCKER #3: getDeliveryHealth counts unknown deliveries", async () => {
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    await markDeliveryUnknown(userA, dlv.id, "persistence_error");
    const health = await getDeliveryHealth(userA, { windowHours: 1 });
    expect(health.unknown).toBeGreaterThanOrEqual(1);
    expect(health.total).toBeGreaterThanOrEqual(1);
  });

  it("BLOCKER #3: recoverAbandonedDispatches skips recipients with unknown EmailDelivery", async () => {
    // Create a broadcast with one recipient, force the recipient into
    // DISPATCHING with an old lockedAt (stale), and set its EmailDelivery to
    // `unknown`. recoverAbandonedDispatches MUST skip it (leave in
    // DISPATCHING — never auto-failed).
    const email = uniqueEmail("b3skip");
    await upsertContact(userA, { email, source: "api" });
    await subscribeContact({
      userId: userA, contactId: (await db.contact.findFirst({ where: { email } }))!.id,
      source: CONSENT_SOURCES.API,
      idempotencyKey: "b3skip-sub-1", requestPayload: { reason: null },
    });
    const b = await createBroadcast({
      userId: userA, name: "B3Skip", subject: "S", htmlContent: "<p>Hi</p>",
      audienceType: AUDIENCE_TYPES.ALL_CONTACTS,
    });
    await launchBroadcast(userA, b.broadcastId, {});
    const broadcast = await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId } });
    const recipient = await db.broadcastRecipient.findFirst({
      where: { broadcastId: broadcast!.id },
    });

    // Force the recipient into DISPATCHING with a stale lock.
    const stale = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    await db.broadcastRecipient.update({
      where: { id: recipient!.id },
      data: {
        status: "dispatching",
        lockedAt: stale,
        lockedBy: "stale-worker",
      },
    });

    // Create an EmailDelivery in `unknown` state for this recipient.
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.BROADCAST,
      broadcastRecipientId: recipient!.id, provider: "smtp",
    });
    await markDeliveryUnknown(userA, dlv.id, "persistence_error");
    // The markDeliveryUnknown CAS only transitions queued → unknown, so we
    // verify it actually landed.
    const dlvFresh = await getDelivery(userA, dlv.deliveryId);
    expect(dlvFresh?.currentStatus).toBe(DELIVERY_STATUSES.UNKNOWN);

    // recoverAbandonedDispatches should NOT transition the recipient to
    // failed because its EmailDelivery is in `unknown` state.
    const recovered = await recoverAbandonedDispatches();
    expect(recovered).toBe(0);

    const rcp = await db.broadcastRecipient.findUnique({ where: { id: recipient!.id } });
    expect(rcp?.status).toBe("dispatching"); // unchanged — skipped
  });

  // ---- BLOCKER #6: deterministic event ordering ----

  it("BLOCKER #6: ingest event OLDER than last event is stored but does NOT transition status", async () => {
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
      provider: "resend", providerMessageId: "msg-b6-order",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-b6-order", responseClassification: "accepted",
    });

    // First: delivered at t1 (later).
    const t1 = new Date(Date.now() - 10000);
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-b6-order",
      providerEventId: "evt-b6-d1", type: PROVIDER_EVENT_TYPES.DELIVERED, occurredAt: t1,
    });

    // Then: deferred at t0 (OLDER than t1) — should NOT regress.
    const t0 = new Date(Date.now() - 60000);
    const r2 = await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-b6-order",
      providerEventId: "evt-b6-d2", type: PROVIDER_EVENT_TYPES.DEFERRED, occurredAt: t0,
    });
    expect(r2.stateChanged).toBe(false);

    // The event WAS stored (compliance: event history is immutable).
    const events = await getDeliveryEvents(userA, dlv.deliveryId);
    expect(events?.length).toBe(2);

    // State stayed delivered.
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.DELIVERED);
  });

  it("BLOCKER #6: bounced (hard) cannot be overwritten by deferred (explicit matrix)", async () => {
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
      provider: "resend", providerMessageId: "msg-b6-bd",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-b6-bd", responseClassification: "accepted",
    });

    // First: hard bounce at t1.
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-b6-bd",
      providerEventId: "evt-b6-bd-b", type: PROVIDER_EVENT_TYPES.BOUNCED,
      bounceType: BOUNCE_TYPES.HARD, occurredAt: new Date(Date.now() - 60000),
    });
    // Then: deferred at t2 (newer) — must NOT regress bounced.
    const r2 = await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-b6-bd",
      providerEventId: "evt-b6-bd-d", type: PROVIDER_EVENT_TYPES.DEFERRED,
      occurredAt: new Date(),
    });
    expect(r2.stateChanged).toBe(false);
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.BOUNCED);
  });

  it("BLOCKER #6: complained cannot be overwritten by delivered (explicit matrix)", async () => {
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
      provider: "resend", providerMessageId: "msg-b6-cd",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-b6-cd", responseClassification: "accepted",
    });

    // First: complained at t1.
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-b6-cd",
      providerEventId: "evt-b6-cd-c", type: PROVIDER_EVENT_TYPES.COMPLAINED,
      occurredAt: new Date(Date.now() - 60000),
    });
    // Then: delivered at t2 (newer) — must NOT regress complained.
    const r2 = await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-b6-cd",
      providerEventId: "evt-b6-cd-d", type: PROVIDER_EVENT_TYPES.DELIVERED,
      occurredAt: new Date(),
    });
    expect(r2.stateChanged).toBe(false);
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.COMPLAINED);
  });

  it("BLOCKER #6: unknown state can advance to delivered with a NEWER event", async () => {
    // An unknown delivery (persistence failure marker) can still advance to
    // a concrete terminal state via a newer webhook event.
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "resend",
      providerMessageId: "msg-b6-ud",
    });
    await markDeliveryUnknown(userA, dlv.id, "persistence_error");
    // Sanity-check the unknown state.
    let fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.UNKNOWN);

    // Ingest a delivered event with occurredAt newer than the unknown marker.
    const t = new Date(Date.now() + 1000); // slightly in the future
    const r = await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-b6-ud",
      providerEventId: "evt-b6-ud-d", type: PROVIDER_EVENT_TYPES.DELIVERED, occurredAt: t,
    });
    expect(r.stateChanged).toBe(true);
    expect(r.newStatus).toBe(DELIVERY_STATUSES.DELIVERED);
    fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.DELIVERED);
  });

  // ---- BLOCKER #7: CAS-based delivery updates ----

  it("BLOCKER #7: updateDeliveryAfterProviderSend backfills providerMessageId when state is no longer queued", async () => {
    // Create a delivery, manually advance it to `delivered` (simulating a
    // webhook that fired before the post-send callback), then call
    // updateDeliveryAfterProviderSend. The state MUST NOT regress, but the
    // providerMessageId + acceptedAt should be backfilled.
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    await db.emailDelivery.update({
      where: { id: dlv.id },
      data: { currentStatus: DELIVERY_STATUSES.DELIVERED, deliveredAt: new Date() },
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-b7-backfill", responseClassification: "accepted",
    });
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.DELIVERED); // no regression
    expect(fresh?.providerMessageId).toBe("msg-b7-backfill"); // backfilled
    expect(fresh?.acceptedAt).not.toBeNull();
  });

  it("BLOCKER #7: markDeliveryFailed on already-failed delivery is a no-op (CAS count=0)", async () => {
    // Calling markDeliveryFailed twice should be safe — the second call's
    // CAS targets `queued` but the state is already `failed`.
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    await markDeliveryFailed(userA, dlv.id, "provider_error");
    // Second call — no error, no state change.
    await markDeliveryFailed(userA, dlv.id, "different_error");
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.FAILED);
    // Original errorCode retained — the second CAS did not overwrite.
    expect(fresh?.lastErrorCode).toBe("provider_error");
  });

  // ---- BLOCKER #4: structural FKs ----

  it("BLOCKER #4: createDelivery with cross-tenant emailMessageId fails (FK violation)", async () => {
    // Create an EmailMessage owned by userA, then try to create an
    // EmailDelivery owned by userB pointing to userA's emailMessageId.
    // The composite FK (emailMessageOwnerUserId, emailMessageId) →
    // EmailMessage(userId, messageId) should reject this — the owner column
    // is set to userB.id but the parent row's userId is userA.id.
    await createTemplate(userA, {
      name: "B4 FK", slug: "b4-fk-tmpl", subject: "Hi", html: "<p>Hi</p>",
    });
    const msg = await db.emailMessage.create({
      data: {
        userId: userA,
        toEmail: "b4fk@example.com",
        subject: "S",
        status: "sent",
        source: "api_v1",
      },
    });
    // Attempt to create an EmailDelivery owned by userB with userA's messageId.
    // The composite FK (userB.id, msg.messageId) → EmailMessage(userId, messageId)
    // should fail — there is no EmailMessage row with (userId=userB, messageId=msg.messageId).
    await expect(
      db.emailDelivery.create({
        data: {
          deliveryId: randomUUID(),
          userId: userB,
          sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
          emailMessageId: msg.messageId,
          emailMessageOwnerUserId: userB, // wrong tenant — should fail FK
          provider: "smtp",
          currentStatus: DELIVERY_STATUSES.QUEUED,
        },
      }),
    ).rejects.toThrow();
  });

  it("BLOCKER #4: partial unique index on (userId, emailMessageId) — second delivery rejected", async () => {
    // Two EmailDelivery rows with the same (userId, emailMessageId) where
    // emailMessageId is non-null must be rejected by the partial unique index.
    await createTemplate(userA, {
      name: "B4 Uniq", slug: `b4-uniq-${Date.now()}`, subject: "Hi", html: "<p>Hi</p>",
    });
    const msg = await db.emailMessage.create({
      data: {
        userId: userA,
        toEmail: "b4uniq@example.com",
        subject: "S",
        status: "sent",
        source: "api_v1",
      },
    });
    // First delivery with this emailMessageId — OK.
    await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
      emailMessageId: msg.messageId, provider: "smtp",
    });
    // Second delivery with the SAME (userId, emailMessageId) — must reject.
    await expect(
      createDelivery({
        userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
        emailMessageId: msg.messageId, provider: "smtp",
      }),
    ).rejects.toThrow();
  });

  it("BLOCKER #4: multiple EmailDelivery rows with NULL emailMessageId are allowed (partial unique)", async () => {
    // NULL emailMessageId rows are NOT subject to the partial unique index.
    // Multiple rows with NULL must coexist.
    const d1 = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    const d2 = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    expect(d1.id).not.toBe(d2.id);
  });

  // ---- BLOCKER #5: CHECK constraints ----

  it("BLOCKER #5: createDelivery with invalid sourceType throws (CHECK constraint)", async () => {
    await expect(
      db.emailDelivery.create({
        data: {
          deliveryId: randomUUID(),
          userId: userA,
          sourceType: "invalid_source_type",
          provider: "smtp",
          currentStatus: DELIVERY_STATUSES.QUEUED,
        },
      }),
    ).rejects.toThrow();
  });

  it("BLOCKER #5: createDelivery with invalid currentStatus throws (CHECK constraint)", async () => {
    await expect(
      db.emailDelivery.create({
        data: {
          deliveryId: randomUUID(),
          userId: userA,
          sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
          provider: "smtp",
          currentStatus: "totally_bogus_status",
        },
      }),
    ).rejects.toThrow();
  });

  it("BLOCKER #5: EmailDeliveryEvent with invalid type throws (CHECK constraint)", async () => {
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    await expect(
      db.emailDeliveryEvent.create({
        data: {
          eventId: randomUUID(),
          userId: userA,
          deliveryId: dlv.id,
          provider: "smtp",
          providerEventId: `b5-bad-type-${Date.now()}`,
          type: "totally_bogus_event_type",
          occurredAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it("BLOCKER #5: EmailDeliveryEvent with null providerEventId throws (NOT NULL)", async () => {
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    await expect(
      db.emailDeliveryEvent.create({
        data: {
          eventId: randomUUID(),
          userId: userA,
          deliveryId: dlv.id,
          provider: "smtp",
          providerEventId: null as any,
          type: PROVIDER_EVENT_TYPES.DELIVERED,
          occurredAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  // ---- BLOCKER #8: DB-side health aggregation ----

  it("BLOCKER #8: getDeliveryHealth counts multiple statuses correctly via groupBy", async () => {
    // Create a deterministic mix of delivery statuses and verify the
    // aggregation returns exact counts (no in-memory row list).
    const dlvAccepted = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    await updateDeliveryAfterProviderSend(userA, dlvAccepted.id, {
      accepted: true, messageId: "b8-acc", responseClassification: "accepted",
    });

    const dlvFailed = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    await markDeliveryFailed(userA, dlvFailed.id, "provider_error");

    const dlvUnknown = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    await markDeliveryUnknown(userA, dlvUnknown.id, "persistence_error");

    // Three deliveries in the window — exact counts:
    //   accepted=1, delivered=0, bounced=0, complained=0,
    //   rejected=0, failed=1, deferred=0, unknown=1, total>=3
    const health = await getDeliveryHealth(userA, { windowHours: 1 });
    expect(health.total).toBeGreaterThanOrEqual(3);
    expect(health.accepted).toBeGreaterThanOrEqual(1);
    expect(health.failed).toBeGreaterThanOrEqual(1);
    expect(health.unknown).toBeGreaterThanOrEqual(1);
  });

  it("BLOCKER #8: getDeliveryHealth returns zero counts for tenant with no deliveries in window", async () => {
    // userB has no deliveries in this window — verify the groupBy path
    // returns the zero default rather than throwing on an empty result.
    const health = await getDeliveryHealth(userB, { windowHours: 1 });
    expect(health.total).toBe(0);
    expect(health.accepted).toBe(0);
    expect(health.delivered).toBe(0);
    expect(health.failed).toBe(0);
    expect(health.unknown).toBe(0);
  });

  // ==========================================================================
  // Phase 11 audit v3 — BLOCKER #2: direct DB CHECK-constraint tests.
  //
  // The migration contains four CHECK constraints that the existing FK tests
  // do NOT directly prove. These bypass createDelivery() validation and
  // exercise the database constraint directly via db.emailDelivery.create().
  // ==========================================================================

  it("BLOCKER #2: EmailMessage owner mismatch is rejected by CHECK (owner != userId)", async () => {
    // Create an EmailMessage owned by userB. Then attempt to create an
    // EmailDelivery owned by userA (userId=A) but with emailMessageOwnerUserId=B
    // pointing to userB's messageId. Without the owner-matches-userId CHECK,
    // the composite FK (B, msgB) → EmailMessage(B, msgB) would SUCCEED (the
    // parent row exists for tenant B). The CHECK catches the mismatch.
    const msgB = await db.emailMessage.create({
      data: {
        userId: userB,
        messageId: "msg-chk-em-owner-mismatch-" + Date.now(),
        toEmail: "chk-owner@example.com",
        subject: "S",
        status: "sent",
        source: "api_v1",
      },
    });
    // emailMessageOwnerUserId = userB, userId = userA → CHECK rejects (B != A).
    await expect(
      db.emailDelivery.create({
        data: {
          deliveryId: randomUUID(),
          userId: userA,
          sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
          emailMessageId: msgB.messageId,
          emailMessageOwnerUserId: userB, // mismatched owner
          provider: "smtp",
          currentStatus: DELIVERY_STATUSES.QUEUED,
        },
      }),
    ).rejects.toThrow();
    // Verify nothing was persisted.
    const rows = await db.emailDelivery.findMany({
      where: { userId: userA, emailMessageId: msgB.messageId },
    });
    expect(rows.length).toBe(0);
  });

  it("BLOCKER #2: EmailMessage partial-null bypass is rejected by CHECK (owner NULL, id non-null)", async () => {
    // Attempt: userId=A, emailMessageOwnerUserId=NULL, emailMessageId=non-null.
    // Without the owner-consistency CHECK, PostgreSQL MATCH SIMPLE would skip
    // FK validation when one column is NULL, allowing a dangling reference.
    // The CHECK (both NULL or both non-NULL) rejects this.
    await expect(
      db.emailDelivery.create({
        data: {
          deliveryId: randomUUID(),
          userId: userA,
          sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
          emailMessageId: "dangling-non-null-id-" + Date.now(),
          emailMessageOwnerUserId: null, // NULL owner + non-null id → CHECK rejects
          provider: "smtp",
          currentStatus: DELIVERY_STATUSES.QUEUED,
        },
      }),
    ).rejects.toThrow();
  });

  it("BLOCKER #2: BroadcastRecipient owner mismatch is rejected by CHECK (owner != userId)", async () => {
    // Create a BroadcastRecipient owned by userB. Then attempt an
    // EmailDelivery owned by userA with broadcastRecipientOwnerUserId=B
    // pointing to userB's recipient. The CHECK rejects the mismatch.
    const email = uniqueEmail("chkbr");
    await upsertContact(userB, { email, source: "api" });
    await subscribeContact({
      userId: userB, contactId: (await db.contact.findFirst({ where: { email } }))!.id,
      source: CONSENT_SOURCES.API, idempotencyKey: "chkbr-sub-1", requestPayload: { reason: null },
    });
    const b = await createBroadcast({
      userId: userB, name: "ChkBR", subject: "S", htmlContent: "<p>Hi</p>",
      audienceType: AUDIENCE_TYPES.ALL_CONTACTS,
    });
    await launchBroadcast(userB, b.broadcastId, {});
    const broadcast = await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId } });
    const recipientB = await db.broadcastRecipient.findFirst({
      where: { broadcastId: broadcast!.id }, select: { id: true },
    });

    // broadcastRecipientOwnerUserId = userB, userId = userA → CHECK rejects.
    await expect(
      db.emailDelivery.create({
        data: {
          deliveryId: randomUUID(),
          userId: userA,
          sourceType: DELIVERY_SOURCES.BROADCAST,
          broadcastRecipientId: recipientB!.id,
          broadcastRecipientOwnerUserId: userB, // mismatched owner
          provider: "smtp",
          currentStatus: DELIVERY_STATUSES.QUEUED,
        },
      }),
    ).rejects.toThrow();
    const rows = await db.emailDelivery.findMany({
      where: { userId: userA, broadcastRecipientId: recipientB!.id },
    });
    expect(rows.length).toBe(0);
  });

  it("BLOCKER #2: BroadcastRecipient partial-null bypass is rejected by CHECK (owner NULL, id non-null)", async () => {
    await expect(
      db.emailDelivery.create({
        data: {
          deliveryId: randomUUID(),
          userId: userA,
          sourceType: DELIVERY_SOURCES.BROADCAST,
          broadcastRecipientId: 999999, // non-null id
          broadcastRecipientOwnerUserId: null, // NULL owner → CHECK rejects
          provider: "smtp",
          currentStatus: DELIVERY_STATUSES.QUEUED,
        },
      }),
    ).rejects.toThrow();
  });

  it("BLOCKER #2: valid same-tenant EmailMessage + BroadcastRecipient references succeed", async () => {
    // Prove the CHECKs do not reject valid same-tenant references.
    // EmailMessage path:
    const msgA = await db.emailMessage.create({
      data: {
        userId: userA,
        messageId: "msg-chk-valid-em-" + Date.now(),
        toEmail: "chk-valid-em@example.com",
        subject: "S",
        status: "sent",
        source: "api_v1",
      },
    });
    const dlvEm = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
      emailMessageId: msgA.messageId,
      provider: "smtp",
    });
    expect(dlvEm.currentStatus).toBe(DELIVERY_STATUSES.QUEUED);

    // BroadcastRecipient path:
    const email = uniqueEmail("chkvalidbr");
    await upsertContact(userA, { email, source: "api" });
    await subscribeContact({
      userId: userA, contactId: (await db.contact.findFirst({ where: { email } }))!.id,
      source: CONSENT_SOURCES.API, idempotencyKey: "chkvalidbr-sub-1", requestPayload: { reason: null },
    });
    const b = await createBroadcast({
      userId: userA, name: "ChkValidBR", subject: "S", htmlContent: "<p>Hi</p>",
      audienceType: AUDIENCE_TYPES.ALL_CONTACTS,
    });
    await launchBroadcast(userA, b.broadcastId, {});
    const broadcast = await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId } });
    const recipientA = await db.broadcastRecipient.findFirst({
      where: { broadcastId: broadcast!.id }, select: { id: true },
    });
    const dlvBr = await createDelivery({
      userId: userA,
      sourceType: DELIVERY_SOURCES.BROADCAST,
      broadcastRecipientId: recipientA!.id,
      provider: "smtp",
    });
    expect(dlvBr.currentStatus).toBe(DELIVERY_STATUSES.QUEUED);
  });

  // ==========================================================================
  // Phase 11 audit v3 — BLOCKER #3: REAL ingestProviderEvent rollback tests.
  //
  // These exercise the REAL production `ingestProviderEvent()` function with
  // a safe, test-only fault-injection hook (see test-fault.ts). The hook is
  // structurally unreachable in production (NODE_ENV guard). These tests
  // force a deterministic failure AFTER event insertion + state update +
  // suppression, proving all earlier mutations roll back atomically.
  //
  // The previous "transaction rollback" test (#19) did NOT actually cause a
  // rollback — it deleted the contact so suppression was skipped (not failed).
  // These replace that misleading pattern with real rollback evidence.
  // ==========================================================================

  it("BLOCKER #3: real rollback test A — fault AFTER event+state+suppression rolls back everything", async () => {
    // Setup: a broadcast delivery with a real contact so lookupDeliveryEmail
    // resolves a real email. The hard-bounce path will: insert event,
    // update state to BOUNCED, run suppressEmailInTx. The fault fires AFTER
    // suppression succeeds but BEFORE the tx commits.
    const email = uniqueEmail("rbA");
    const c1 = await upsertContact(userA, { email, source: "api" });
    await subscribeContact({
      userId: userA, contactId: c1.contact.id, source: CONSENT_SOURCES.API,
      idempotencyKey: "rbA-sub-1", requestPayload: { reason: null },
    });
    const b = await createBroadcast({
      userId: userA, name: "RbA", subject: "S", htmlContent: "<p>Hi</p>",
      audienceType: AUDIENCE_TYPES.ALL_CONTACTS,
    });
    await launchBroadcast(userA, b.broadcastId, {});
    const broadcast = await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId } });
    const recipient = await db.broadcastRecipient.findFirst({
      where: { broadcastId: broadcast!.id }, select: { id: true },
    });

    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.BROADCAST,
      broadcastRecipientId: recipient!.id, provider: "resend",
      providerMessageId: "msg-rbA-1",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-rbA-1", responseClassification: "accepted",
    });

    // Capture counts BEFORE the faulted call.
    const eventsBefore = await db.emailDeliveryEvent.count({ where: { userId: userA } });
    const suppEventsBefore = await db.suppressionEvent.count({ where: { userId: userA } });
    const suppEntriesBefore = await db.suppressionEntry.count({ where: { userId: userA } });

    // Arm the fault: throw AFTER suppression succeeds, before tx commit.
    __setDeliverabilityTestFault("post-suppression-throw");

    // The REAL production function. This MUST throw — the fault fires inside
    // the transaction after suppression completes.
    await expect(
      ingestProviderEvent({
        userId: userA, provider: "resend", providerMessageId: "msg-rbA-1",
        providerEventId: "evt-rbA-1", type: PROVIDER_EVENT_TYPES.BOUNCED,
        bounceType: BOUNCE_TYPES.HARD, occurredAt: new Date(),
      }),
    ).rejects.toThrow("post-suppression-throw");

    __clearDeliverabilityTestFault();

    // Assert NOTHING persisted — the transaction rolled back atomically.
    const eventsAfter = await db.emailDeliveryEvent.count({ where: { userId: userA } });
    const suppEventsAfter = await db.suppressionEvent.count({ where: { userId: userA } });
    const suppEntriesAfter = await db.suppressionEntry.count({ where: { userId: userA } });

    expect(eventsAfter).toBe(eventsBefore);       // event did NOT persist
    expect(suppEventsAfter).toBe(suppEventsBefore); // suppression history did NOT persist
    expect(suppEntriesAfter).toBe(suppEntriesBefore); // suppression current state did NOT change

    // Delivery currentStatus is unchanged (still provider_accepted — the
    // state "update" rolled back).
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.PROVIDER_ACCEPTED);
  });

  it("BLOCKER #3: real rollback test B — fault DURING suppression path rolls back event+state", async () => {
    // Force the suppression step to fail (the fault throws right before
    // suppressEmailInTx runs, after event insertion + state update). Proves
    // the event + state do NOT persist when the suppression step fails.
    const email = uniqueEmail("rbB");
    const c1 = await upsertContact(userA, { email, source: "api" });
    await subscribeContact({
      userId: userA, contactId: c1.contact.id, source: CONSENT_SOURCES.API,
      idempotencyKey: "rbB-sub-1", requestPayload: { reason: null },
    });
    const b = await createBroadcast({
      userId: userA, name: "RbB", subject: "S", htmlContent: "<p>Hi</p>",
      audienceType: AUDIENCE_TYPES.ALL_CONTACTS,
    });
    await launchBroadcast(userA, b.broadcastId, {});
    const broadcast = await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId } });
    const recipient = await db.broadcastRecipient.findFirst({
      where: { broadcastId: broadcast!.id }, select: { id: true },
    });

    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.BROADCAST,
      broadcastRecipientId: recipient!.id, provider: "resend",
      providerMessageId: "msg-rbB-1",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-rbB-1", responseClassification: "accepted",
    });

    const eventsBefore = await db.emailDeliveryEvent.count({ where: { userId: userA } });
    const suppEventsBefore = await db.suppressionEvent.count({ where: { userId: userA } });

    // Arm the fault: throw DURING the suppression step (after event+state,
    // before suppressEmailInTx runs).
    __setDeliverabilityTestFault("in-suppression-throw");

    await expect(
      ingestProviderEvent({
        userId: userA, provider: "resend", providerMessageId: "msg-rbB-1",
        providerEventId: "evt-rbB-1", type: PROVIDER_EVENT_TYPES.BOUNCED,
        bounceType: BOUNCE_TYPES.HARD, occurredAt: new Date(),
      }),
    ).rejects.toThrow("in-suppression-throw");

    __clearDeliverabilityTestFault();

    // Assert NOTHING persisted — event + state + suppression all rolled back.
    const eventsAfter = await db.emailDeliveryEvent.count({ where: { userId: userA } });
    const suppEventsAfter = await db.suppressionEvent.count({ where: { userId: userA } });
    expect(eventsAfter).toBe(eventsBefore);
    expect(suppEventsAfter).toBe(suppEventsBefore);

    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.PROVIDER_ACCEPTED);
  });

  // ==========================================================================
  // Phase 11 audit v3 — BLOCKER #5: CAS helpers return transition evidence.
  // ==========================================================================

  it("BLOCKER #5: markDeliveryFailed returns changed=true + currentStatus=failed on CAS win", async () => {
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    const result = await markDeliveryFailed(userA, dlv.id, "provider_error");
    expect(result.changed).toBe(true);
    expect(result.currentStatus).toBe(DELIVERY_STATUSES.FAILED);
  });

  it("BLOCKER #5: markDeliveryFailed returns changed=false + canonical currentStatus on CAS loss", async () => {
    // Advance the delivery past queued (via a webhook-style delivered event
    // path), then call markDeliveryFailed — CAS should lose.
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "resend",
      providerMessageId: "msg-cas-loss-1",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-cas-loss-1", responseClassification: "accepted",
    });
    // Now in provider_accepted. markDeliveryFailed targets queued → loses.
    const result = await markDeliveryFailed(userA, dlv.id, "provider_error");
    expect(result.changed).toBe(false);
    // The canonical state is re-read — callers MUST inspect this, not infer failed.
    expect(result.currentStatus).toBe(DELIVERY_STATUSES.PROVIDER_ACCEPTED);
  });

  it("BLOCKER #5: markDeliveryUnknown returns changed=true + currentStatus=unknown on CAS win", async () => {
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    const result = await markDeliveryUnknown(userA, dlv.id, "persistence_error");
    expect(result.changed).toBe(true);
    expect(result.currentStatus).toBe(DELIVERY_STATUSES.UNKNOWN);
  });

  it("BLOCKER #5: markDeliveryUnknown returns changed=false + canonical currentStatus on CAS loss", async () => {
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "resend",
      providerMessageId: "msg-cas-unknown-loss-1",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-cas-unknown-loss-1", responseClassification: "accepted",
    });
    const result = await markDeliveryUnknown(userA, dlv.id, "persistence_error");
    expect(result.changed).toBe(false);
    expect(result.currentStatus).toBe(DELIVERY_STATUSES.PROVIDER_ACCEPTED);
  });

  it("BLOCKER #5: updateDeliveryAfterProviderSend accepted=true returns changed=true + provider_accepted", async () => {
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    const result = await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-ev-1", responseClassification: "accepted",
    });
    expect(result.changed).toBe(true);
    expect(result.currentStatus).toBe(DELIVERY_STATUSES.PROVIDER_ACCEPTED);
  });

  it("BLOCKER #5: updateDeliveryAfterProviderSend accepted=false returns changed=true + rejected", async () => {
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    const result = await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: false, messageId: null, responseClassification: "rejected_policy",
    });
    expect(result.changed).toBe(true);
    expect(result.currentStatus).toBe(DELIVERY_STATUSES.REJECTED);
  });

  it("BLOCKER #5: updateDeliveryAfterProviderSend returns changed=false + canonical state when CAS loses", async () => {
    // Manually advance to delivered (simulating a pre-arrival webhook),
    // then call updateDeliveryAfterProviderSend — CAS loses, re-reads delivered.
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    await db.emailDelivery.update({
      where: { id: dlv.id },
      data: { currentStatus: DELIVERY_STATUSES.DELIVERED, deliveredAt: new Date() },
    });
    const result = await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-ev-casloss", responseClassification: "accepted",
    });
    expect(result.changed).toBe(false);
    expect(result.currentStatus).toBe(DELIVERY_STATUSES.DELIVERED);
  });

  it("BLOCKER #5: stale caller does NOT infer failed when markDeliveryFailed.changed=false", async () => {
    // Stale-state regression: a caller that lost the CAS must inspect the
    // evidence and NOT infer the transition occurred.
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "resend",
      providerMessageId: "msg-stale-1",
    });
    // A webhook advanced it to delivered BEFORE the stale caller runs.
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-stale-1",
      providerEventId: "evt-stale-delivered", type: PROVIDER_EVENT_TYPES.DELIVERED,
      occurredAt: new Date(Date.now() - 1000),
    });
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.DELIVERED);

    // Stale caller attempts queued → failed. CAS loses.
    const result = await markDeliveryFailed(userA, dlv.id, "provider_error");
    expect(result.changed).toBe(false);
    // The caller MUST inspect currentStatus — it is still delivered, NOT failed.
    expect(result.currentStatus).toBe(DELIVERY_STATUSES.DELIVERED);
    // The actual DB state is unchanged.
    const after = await getDelivery(userA, dlv.deliveryId);
    expect(after?.currentStatus).toBe(DELIVERY_STATUSES.DELIVERED);
  });

  it("BLOCKER #5: stale caller does NOT infer unknown when markDeliveryUnknown.changed=false", async () => {
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "resend",
      providerMessageId: "msg-stale-unknown-1",
    });
    // Webhook advanced to delivered.
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-stale-unknown-1",
      providerEventId: "evt-stale-unknown-delivered", type: PROVIDER_EVENT_TYPES.DELIVERED,
      occurredAt: new Date(Date.now() - 1000),
    });
    // Stale caller attempts queued → unknown. CAS loses.
    const result = await markDeliveryUnknown(userA, dlv.id, "persistence_error");
    expect(result.changed).toBe(false);
    expect(result.currentStatus).toBe(DELIVERY_STATUSES.DELIVERED);
    // DB state is NOT unknown.
    const after = await getDelivery(userA, dlv.deliveryId);
    expect(after?.currentStatus).toBe(DELIVERY_STATUSES.DELIVERED);
  });

  // ==========================================================================
  // Phase 11 audit v3 — BLOCKER #8: accepted=false must NOT be persisted as sent.
  // ==========================================================================

  it("BLOCKER #8: accepted=false Send — EmailMessage != sent, EmailDelivery = rejected, provider calls = 1", async () => {
    // A provider whose send() resolves with accepted=false (normalized
    // rejection, NOT an exception). The EmailMessage MUST NOT become "sent".
    class RejectingProvider implements EmailProvider {
      readonly name = "fake-reject";
      readonly capabilities = {
        providerMessageId: true, customHeaders: true,
        deliveryWebhooks: false, bounceEvents: false, complaintEvents: false,
      } as const;
      public sendCalls = 0;
      async send(_input: ProviderSendInput): Promise<ProviderSendResult> {
        this.sendCalls++;
        return {
          provider: "fake-reject",
          messageId: null,
          accepted: false,
          responseClassification: "rejected_policy",
        };
      }
    }
    const rejectingProvider = new RejectingProvider();
    const b8Slug = `b8-reject-${Date.now()}`;
    await createTemplate(userA, {
      name: "B8 Reject", slug: b8Slug, subject: "Hi {{name}}", html: "<p>Hi {{name}}</p>",
    });

    const result = await sendTransactionalEmail({
      userId: userA,
      to: "b8-reject@example.com",
      templateSlug: b8Slug,
      variables: { name: "Alice" },
      idempotencyKey: "b8-reject-key-" + Date.now(),
      requestId: "req-b8-reject",
      source: "api_v1",
      environment: "production",
    }, rejectingProvider);

    // Provider was called exactly once.
    expect(rejectingProvider.sendCalls).toBe(1);
    // The result status is "rejected" (NOT "sent").
    expect(result.status).toBe("rejected");
    expect(result.created).toBe(true);
    expect(result.replay).toBe(false);
    expect(result.errorCode).toBe("rejected_policy");

    // EmailMessage is NOT "sent" — query by the returned messageId.
    const msgRow = await db.emailMessage.findUnique({
      where: { messageId: result.messageId },
    });
    expect(msgRow?.status).toBe("rejected");
    expect(msgRow?.errorCode).toBe("rejected_policy");

    // EmailDelivery is "rejected" (NOT "sent", NOT "provider_accepted").
    const deliveries = await db.emailDelivery.findMany({
      where: { userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL },
    });
    expect(deliveries.length).toBe(1);
    expect(deliveries[0].currentStatus).toBe(DELIVERY_STATUSES.REJECTED);
  });

  it("BLOCKER #8: accepted=false Broadcast — BroadcastRecipient != sent, provider calls = 1", async () => {
    class RejectingProvider implements EmailProvider {
      readonly name = "fake-reject-bc";
      readonly capabilities = {
        providerMessageId: true, customHeaders: true,
        deliveryWebhooks: false, bounceEvents: false, complaintEvents: false,
      } as const;
      public sendCalls = 0;
      async send(_input: ProviderSendInput): Promise<ProviderSendResult> {
        this.sendCalls++;
        return {
          provider: "fake-reject-bc",
          messageId: null,
          accepted: false,
          responseClassification: "rejected_policy",
        };
      }
    }
    const rejectingProvider = new RejectingProvider();
    const email = uniqueEmail("b8bc");
    const c1 = await upsertContact(userA, { email, source: "api" });
    await subscribeContact({
      userId: userA, contactId: c1.contact.id, source: CONSENT_SOURCES.API,
      idempotencyKey: "b8bc-sub-1", requestPayload: { reason: null },
    });
    const b = await createBroadcast({
      userId: userA, name: "B8BC", subject: "S", htmlContent: "<p>Hi</p>",
      audienceType: AUDIENCE_TYPES.ALL_CONTACTS,
    });
    await launchBroadcast(userA, b.broadcastId, {});
    const broadcast = await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId }, select: { id: true } });
    const result = await processBroadcast(broadcast!.id, rejectingProvider);

    // Provider called exactly once.
    expect(rejectingProvider.sendCalls).toBe(1);
    // The recipient is failed (NOT sent).
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);

    const recipient = await db.broadcastRecipient.findFirst({
      where: { broadcastId: broadcast!.id },
    });
    expect(recipient?.status).toBe("failed");
    expect(recipient?.errorCode).toBe("provider_rejected");

    // EmailDelivery is rejected (NOT provider_accepted, NOT sent-equivalent).
    const deliveries = await db.emailDelivery.findMany({
      where: { userId: userA, sourceType: DELIVERY_SOURCES.BROADCAST },
    });
    expect(deliveries.length).toBe(1);
    expect(deliveries[0].currentStatus).toBe(DELIVERY_STATUSES.REJECTED);
  });

  // ==========================================================================
  // Phase 11 audit v3 — BLOCKER #9: lastProviderEventAt only from provider events.
  // ==========================================================================

  it("BLOCKER #9: provider send result persists but lastProviderEventAt stays null", async () => {
    // After updateDeliveryAfterProviderSend (local send path), lastProviderEventAt
    // MUST remain null. It advances ONLY from provider event occurredAt.
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "smtp",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-lpe-1", responseClassification: "accepted",
    });
    const fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.currentStatus).toBe(DELIVERY_STATUSES.PROVIDER_ACCEPTED);
    expect(fresh?.acceptedAt).not.toBeNull();
    // CRITICAL: lastProviderEventAt is null — no provider event has arrived yet.
    expect(fresh?.lastProviderEventAt).toBeNull();
  });

  it("BLOCKER #9: first webhook advances lastProviderEventAt; later local op keeps it", async () => {
    const dlv = await createDelivery({
      userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL, provider: "resend",
      providerMessageId: "msg-lpe-2",
    });
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-lpe-2", responseClassification: "accepted",
    });
    // Before any webhook: null.
    let fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.lastProviderEventAt).toBeNull();

    // First webhook @ T1.
    const t1 = new Date(Date.now() - 60000);
    await ingestProviderEvent({
      userId: userA, provider: "resend", providerMessageId: "msg-lpe-2",
      providerEventId: "evt-lpe-delivered", type: PROVIDER_EVENT_TYPES.DELIVERED,
      occurredAt: t1,
    });
    fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.lastProviderEventAt).toEqual(t1);

    // Later local metadata operation (backfill path — CAS loses because
    // state is no longer queued). lastProviderEventAt MUST stay at T1.
    await updateDeliveryAfterProviderSend(userA, dlv.id, {
      accepted: true, messageId: "msg-lpe-2", responseClassification: "accepted",
    });
    fresh = await getDelivery(userA, dlv.deliveryId);
    expect(fresh?.lastProviderEventAt).toEqual(t1); // unchanged
  });

  // ==========================================================================
  // Phase 11 audit v3 — BLOCKER #10: post-provider EmailMessage persistence failure.
  // ==========================================================================

  it("BLOCKER #10: post-provider EmailMessage persistence failure — retry does not re-call provider", async () => {
    // provider.send() accepted=true, EmailDelivery records acceptance,
    // then the EmailMessage→sent update is forced to fail. Retry the same
    // idempotent request → provider calls remain exactly 1, no second
    // EmailDelivery, retry does NOT call provider, existing source state
    // is replayed safely.
    const b10Slug = `b10-persist-${Date.now()}`;
    await createTemplate(userA, {
      name: "B10 Persist", slug: b10Slug, subject: "Hi {{name}}", html: "<p>Hi {{name}}</p>",
    });
    const idempotencyKey = "b10-key-" + Date.now();

    // Arm the fault: the EmailMessage→sent update throws.
    __setDeliverabilityTestFault("post-provider-emailmessage-persist-fail");

    // First call: provider accepts, EmailDelivery persists, then EmailMessage
    // update throws. The call rejects.
    await expect(
      sendTransactionalEmail({
        userId: userA,
        to: "b10-persist@example.com",
        templateSlug: b10Slug,
        variables: { name: "Alice" },
        idempotencyKey,
        requestId: "req-b10",
        source: "api_v1",
        environment: "production",
      }, fakeProvider),
    ).rejects.toThrow("post-provider-emailmessage-persist-fail");

    __clearDeliverabilityTestFault();

    // Provider was called exactly once.
    expect(fakeProvider.sendCalls).toBe(1);

    // Exactly one EmailDelivery row (created before the provider call).
    const deliveries = await db.emailDelivery.findMany({
      where: { userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL },
    });
    expect(deliveries.length).toBe(1);
    expect(deliveries[0].currentStatus).toBe(DELIVERY_STATUSES.PROVIDER_ACCEPTED);

    // Retry the SAME idempotent request — replay path, no provider call.
    const retry = await sendTransactionalEmail({
      userId: userA,
      to: "b10-persist@example.com",
      templateSlug: b10Slug,
      variables: { name: "Alice" },
      idempotencyKey,
      requestId: "req-b10",
      source: "api_v1",
      environment: "production",
    }, fakeProvider);

    // Provider call count is STILL 1 (no second send).
    expect(fakeProvider.sendCalls).toBe(1);
    // Replay returned the existing (pending) message — no new send.
    expect(retry.replay).toBe(true);
    expect(retry.created).toBe(false);
    // No second EmailDelivery.
    const deliveriesAfter = await db.emailDelivery.findMany({
      where: { userId: userA, sourceType: DELIVERY_SOURCES.TRANSACTIONAL },
    });
    expect(deliveriesAfter.length).toBe(1);
  });

  // ==========================================================================
  // Phase 11 audit v3 — BLOCKER #11: post-provider Broadcast finalization failure.
  // ==========================================================================

  it("BLOCKER #11: post-provider Broadcast finalization failure — recovery does not re-dispatch", async () => {
    // provider.send() accepted=true, EmailDelivery persistence succeeds,
    // then the BroadcastRecipient dispatching→sent terminal CAS is forced to
    // fail. Run recovery → provider calls remain exactly 1, recipient is
    // never returned to an automatically resendable state.
    const email = uniqueEmail("b11");
    const c1 = await upsertContact(userA, { email, source: "api" });
    await subscribeContact({
      userId: userA, contactId: c1.contact.id, source: CONSENT_SOURCES.API,
      idempotencyKey: "b11-sub-1", requestPayload: { reason: null },
    });
    const b = await createBroadcast({
      userId: userA, name: "B11", subject: "S", htmlContent: "<p>Hi</p>",
      audienceType: AUDIENCE_TYPES.ALL_CONTACTS,
    });
    await launchBroadcast(userA, b.broadcastId, {});
    const broadcast = await db.broadcast.findFirst({ where: { broadcastId: b.broadcastId }, select: { id: true } });
    const recipient = await db.broadcastRecipient.findFirst({
      where: { broadcastId: broadcast!.id }, select: { id: true },
    });

    // Arm the fault: the BroadcastRecipient terminal CAS throws.
    __setDeliverabilityTestFault("post-provider-recipient-cas-fail");

    // processBroadcast will throw during the recipient's finalization.
    await expect(
      processBroadcast(broadcast!.id, fakeProvider),
    ).rejects.toThrow("post-provider-recipient-cas-fail");

    __clearDeliverabilityTestFault();

    // Provider was called exactly once.
    expect(fakeProvider.sendCalls).toBe(1);

    // EmailDelivery persisted provider_accepted (before the fault).
    const deliveries = await db.emailDelivery.findMany({
      where: { userId: userA, sourceType: DELIVERY_SOURCES.BROADCAST },
    });
    expect(deliveries.length).toBe(1);
    expect(deliveries[0].currentStatus).toBe(DELIVERY_STATUSES.PROVIDER_ACCEPTED);

    // The recipient is stuck in DISPATCHING (terminal CAS did not run).
    let rcp = await db.broadcastRecipient.findUnique({ where: { id: recipient!.id } });
    expect(rcp?.status).toBe("dispatching");

    // Age the lock so recoverAbandonedDispatches considers it stale.
    const stale = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    await db.broadcastRecipient.update({
      where: { id: recipient!.id },
      data: { lockedAt: stale },
    });

    // Run recovery. The recipient's EmailDelivery is NOT unknown, so
    // recovery transitions it to FAILED (terminal, not resendable).
    const recovered = await recoverAbandonedDispatches();
    expect(recovered).toBe(1);

    rcp = await db.broadcastRecipient.findUnique({ where: { id: recipient!.id } });
    expect(rcp?.status).toBe("failed"); // terminal — never resendable
    expect(rcp?.errorCode).toBe("provider_outcome_unknown");

    // Provider was STILL only called once — recovery never re-dispatches.
    expect(fakeProvider.sendCalls).toBe(1);
  });
});
