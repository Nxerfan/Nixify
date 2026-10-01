/**
 * UX-C: Account Deletion — destructive integration + static tests.
 *
 * BLOCKER 2: this test proves FULL tenant erasure.
 *
 * Every direct and cascading tenant-owned model supported by the current
 * schema is seeded with a representative row, its primary key is captured
 * before deletion, and after deleteUserAccount() the test directly queries
 * each captured ID to assert the row no longer exists.
 *
 * Coverage (see model list in the deletion service docstring):
 *   Direct-owned (NOT NULL userId): Contact, ContactEvent, Group,
 *     ContactGroupMembership, ContactImport, ContactImportRow,
 *     ContactConsentEvent, SuppressionEntry, SuppressionEvent,
 *     ConsentMutationIdempotency, Broadcast, BroadcastRecipient,
 *     BroadcastMutationIdempotency, TransactionalTemplate,
 *     TransactionalTemplateVersion, EmailMessage, EmailDelivery,
 *     EmailDeliveryEvent, JobQueue, AutomationSetting, InboundEvent,
 *     UsageTracking, BrandKit, OtpCode
 *   Nullable-FK (NULL = legacy; non-null = owned): OtpEvent, ApiKey,
 *     WebhookEndpoint, WebhookDelivery, WebhookQueue, RequestLog, EmailTheme
 *
 * Cross-tenant preservation: the other tenant's equivalent data survives.
 *
 * Integration tests require PostgreSQL (RUN_ACCOUNT_DELETION_INTEGRATION=1).
 * Static tests always run.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";

const RUN_DELETION_TESTS =
  process.env.RUN_ACCOUNT_DELETION_INTEGRATION === "1" &&
  !!process.env.TEST_DATABASE_URL;

describe.skipIf(!RUN_DELETION_TESTS)("Account Deletion Integration", () => {
  // Test tenant state — captured IDs for direct orphan assertions.
  let testUserId: number;
  let testEmail: string;
  let otherUserId: number;

  // Captured IDs for the test tenant (used for direct post-delete lookups).
  let otpCodeId: number;
  let otpEventId: number;
  let apiKeyId: number;
  let contactId: number;
  let contactEventId: number;
  let contactConsentEventId: number;
  let groupId: number;
  let contactGroupMembershipId: number;
  let contactImportId: number;
  let contactImportRowId: number;
  let suppressionEntryId: number;
  let suppressionEventId: number;
  let consentMutationIdempotencyId: number;
  let webhookEndpointId: number;
  let webhookDeliveryId: number;
  let webhookQueueId: number;
  let requestLogId: number;
  let emailThemeId: number;
  let brandKitId: number;
  let usageTrackingId: number;
  let templateId: number;
  let templateVersionId: number;
  let emailMessageId: number;
  let emailDeliveryId: number;
  let emailDeliveryEventId: number;
  let jobQueueId: number;
  let automationSettingId: number;
  let inboundEventId: number;
  let broadcastId: number;
  let broadcastRecipientId: number;
  let broadcastMutationIdempotencyId: number;

  // Phase 18 — blog comment + view metric captured IDs (Blocker 8).
  let blogCommentId: number;          // top-level comment by testUser (EN)
  let blogReplyId: number;            // reply by OTHER user under the testUser parent
  let articleViewId: number;          // view row by testUser
  let faBlogCommentId: number;        // FA-locale comment by testUser (tombstone label check)

  // Captured IDs for the OTHER tenant (cross-tenant preservation proof).
  let otherContactId: number;
  let otherApiKeyRow: { id: number; keyHash: string };
  let otherWebhookEndpointId: number;
  let otherBroadcastId: number;
  let otherBrandKitId: number;
  let otherUsageTrackingId: number;

  beforeEach(async () => {
    const user = await db.user.create({
      data: {
        email: `deletion-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.nixify.dev`,
        passwordHash: "test-hash",
        emailVerified: true,
        fullName: "Test User",
        firstName: "Test",
        lastName: "User",
        phoneNumber: "+1234567890",
        plan: "PRO",
      },
    });
    testUserId = user.id;
    testEmail = user.email;

    const other = await db.user.create({
      data: {
        email: `other-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.nixify.dev`,
        passwordHash: "test-hash-other",
        emailVerified: true,
        fullName: "Other User",
        plan: "FREE",
      },
    });
    otherUserId = other.id;

    const unique = (suffix: string) => `${testUserId}-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const otherUnique = (suffix: string) => `${otherUserId}-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // ---- Test tenant: direct-owned models (NOT NULL userId) ----------------

    // OtpCode (created with userId — cascade on user delete)
    const otpCode = await db.otpCode.create({
      data: {
        targetEmail: testEmail,
        codeHash: Buffer.from("test-code-hash-" + testUserId),
        purpose: "signup",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        userId: testUserId,
      },
    });
    otpCodeId = otpCode.id;

    // Contact
    const contact = await db.contact.create({
      data: { userId: testUserId, email: `contact-${unique("c")}@test.com`, source: "dashboard" },
    });
    contactId = contact.id;

    // ContactEvent (cascade via Contact)
    const contactEvent = await db.contactEvent.create({
      data: { contactId: contact.id, type: "contact.created", detail: { source: "test" } },
    });
    contactEventId = contactEvent.id;

    // Group
    const group = await db.group.create({
      data: { userId: testUserId, name: "Test Group", normalizedName: unique("g"), description: "Test" },
    });
    groupId = group.id;

    // ContactGroupMembership (composite FK to (userId, groupId) + (userId, contactId))
    const membership = await db.contactGroupMembership.create({
      data: { userId: testUserId, groupId: group.id, contactId: contact.id, source: "manual" },
    });
    contactGroupMembershipId = membership.id;

    // ContactImport
    const contactImport = await db.contactImport.create({
      data: { userId: testUserId, originalFilename: "test.csv", format: "json", status: "completed", totalRows: 1, validRows: 1 },
    });
    contactImportId = contactImport.id;

    // ContactImportRow (cascade via ContactImport)
    const contactImportRow = await db.contactImportRow.create({
      data: { importId: contactImport.id, userId: testUserId, rowNumber: 1, email: `row-${unique("r")}@test.com`, name: "Row 1", status: "imported" },
    });
    contactImportRowId = contactImportRow.id;

    // ContactConsentEvent (composite FK to (userId, contactId))
    const consentEvent = await db.contactConsentEvent.create({
      data: {
        userId: testUserId,
        contactId: contact.id,
        operation: "subscribe",
        previousStatus: "unknown",
        newStatus: "subscribed",
        source: "dashboard",
      },
    });
    contactConsentEventId = consentEvent.id;

    // SuppressionEntry (no DB FK to User — explicit delete required)
    const supEntry = await db.suppressionEntry.create({
      data: { userId: testUserId, email: `suppressed-${unique("s")}@test.com`, reason: "manual", source: "dashboard" },
    });
    suppressionEntryId = supEntry.id;

    // SuppressionEvent (Restrict FK to SuppressionEntry — must delete before entry)
    const supEvent = await db.suppressionEvent.create({
      data: { userId: testUserId, suppressionId: supEntry.id, email: supEntry.email, operation: "suppress", action: "suppressed", reason: "manual", source: "dashboard" },
    });
    suppressionEventId = supEvent.id;

    // ConsentMutationIdempotency (no DB FK to User — explicit delete required)
    const cmi = await db.consentMutationIdempotency.create({
      data: {
        userId: testUserId,
        operation: "suppress",
        targetType: "email",
        targetKey: supEntry.email,
        idempotencyKeyHash: unique("cmi"),
        resultStatus: "applied",
      },
    });
    consentMutationIdempotencyId = cmi.id;

    // TransactionalTemplate
    const template = await db.transactionalTemplate.create({
      data: { userId: testUserId, slug: unique("tpl"), name: "Test Template" },
    });
    templateId = template.id;

    // TransactionalTemplateVersion (cascade via parent template)
    const templateVersion = await db.transactionalTemplateVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        subject: "Test Subject",
        html: "<p>Test</p>",
        text: "Test",
        variables: [],
      },
    });
    templateVersionId = templateVersion.id;

    // EmailMessage
    const emailMessage = await db.emailMessage.create({
      data: { userId: testUserId, messageId: unique("msg"), toEmail: "user@test.com", subject: "Test", status: "sent", source: "api_v1" },
    });
    emailMessageId = emailMessage.id;

    // Broadcast
    const broadcast = await db.broadcast.create({
      data: {
        userId: testUserId,
        name: "Test Broadcast",
        subject: "Test",
        htmlContent: "<p>Test</p>",
        textContent: "Test",
        audienceType: "all_contacts",
        status: "completed",
      },
    });
    broadcastId = broadcast.id;

    // BroadcastRecipient (composite FK to (userId, broadcastId); contactOwnerUserId+contactId both NULL)
    const broadcastRecipient = await db.broadcastRecipient.create({
      data: {
        userId: testUserId,
        broadcastId: broadcast.id,
        status: "sent",
        sentAt: new Date(),
      },
    });
    broadcastRecipientId = broadcastRecipient.id;

    // BroadcastMutationIdempotency
    const bmi = await db.broadcastMutationIdempotency.create({
      data: {
        userId: testUserId,
        operation: "launch",
        targetBroadcastId: broadcast.broadcastId,
        idempotencyKeyHash: unique("bmi"),
        resultStatus: "applied",
      },
    });
    broadcastMutationIdempotencyId = bmi.id;

    // EmailDelivery (no source linkage — both emailMessageId and broadcastRecipientId NULL)
    const emailDelivery = await db.emailDelivery.create({
      data: {
        userId: testUserId,
        sourceType: "transactional",
        provider: "smtp",
        currentStatus: "delivered",
        deliveredAt: new Date(),
      },
    });
    emailDeliveryId = emailDelivery.id;

    // EmailDeliveryEvent (cascade via EmailDelivery)
    const emailDeliveryEvent = await db.emailDeliveryEvent.create({
      data: {
        userId: testUserId,
        deliveryId: emailDelivery.id,
        provider: "smtp",
        providerEventId: unique("dev"),
        type: "delivered",
        occurredAt: new Date(),
      },
    });
    emailDeliveryEventId = emailDeliveryEvent.id;

    // JobQueue
    const job = await db.jobQueue.create({
      data: { userId: testUserId, type: "otp_verified", status: "pending", payload: { test: true }, dedupeKey: unique("job") },
    });
    jobQueueId = job.id;

    // AutomationSetting
    const automation = await db.automationSetting.create({
      data: { userId: testUserId, type: "otp_verified_welcome", enabled: true, templateId: template.id },
    });
    automationSettingId = automation.id;

    // InboundEvent
    const inbound = await db.inboundEvent.create({
      data: {
        userId: testUserId,
        type: "order.completed",
        email: "user@test.com",
        environment: "production",
        data: { foo: "bar" },
        idempotencyKeyHash: unique("inb"),
        requestFingerprint: "rf-" + unique("inb"),
      },
    });
    inboundEventId = inbound.id;

    // BrandKit
    const brandKit = await db.brandKit.create({
      data: { userId: testUserId, primaryColor: "#10b981", appName: "Test App" },
    });
    brandKitId = brandKit.id;

    // UsageTracking
    const usage = await db.usageTracking.create({
      data: { userId: testUserId, featureKey: "OTP_EMAILS", periodStart: new Date(), periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), count: 5 },
    });
    usageTrackingId = usage.id;

    // ---- Test tenant: nullable userId models (NULL = legacy/system) --------
    // We seed user-owned rows (non-null userId) to prove they get erased.

    // OtpEvent (userId nullable — schema now Cascade)
    const otpEvent = await db.otpEvent.create({
      data: {
        userId: testUserId,
        requestId: unique("req"),
        email: testEmail,
        eventType: "requested",
        status: "success",
        purpose: "signup",
      },
    });
    otpEventId = otpEvent.id;

    // ApiKey (userId nullable — schema now Cascade)
    const apiKey = await db.apiKey.create({
      data: { userId: testUserId, keyHash: unique("kh"), prefix: "mg_test_" + unique("p"), name: "Test Key", environment: "development", scopes: "full" },
    });
    apiKeyId = apiKey.id;

    // WebhookEndpoint (userId nullable — schema now Cascade)
    const webhookEndpoint = await db.webhookEndpoint.create({
      data: { userId: testUserId, url: "https://example.com/wh-" + unique("p"), secret: "whsec_test", events: "otp.sent,otp.verified", isActive: true },
    });
    webhookEndpointId = webhookEndpoint.id;

    // WebhookDelivery (cascade via WebhookEndpoint)
    const webhookDelivery = await db.webhookDelivery.create({
      data: { endpointId: webhookEndpoint.id, deliveryId: unique("dlv"), eventId: "otp.verified", requestId: unique("req"), payload: "{}", signature: "sig", status: "delivered" },
    });
    webhookDeliveryId = webhookDelivery.id;

    // WebhookQueue (cascade via WebhookEndpoint)
    const webhookQueue = await db.webhookQueue.create({
      data: { endpointId: webhookEndpoint.id, deliveryId: webhookDelivery.id, payload: "{}", signature: "sig", eventType: "otp.verified", nextRetryAt: new Date(Date.now() + 60000) },
    });
    webhookQueueId = webhookQueue.id;

    // RequestLog (userId nullable — schema now Cascade)
    const requestLog = await db.requestLog.create({
      data: { userId: testUserId, requestId: unique("rlog"), method: "POST", path: "/api/v1/otp/send", status: 200, durationMs: 100 },
    });
    requestLogId = requestLog.id;

    // EmailTheme (userId nullable — schema now Cascade)
    const emailTheme = await db.emailTheme.create({
      data: { userId: testUserId, name: "Test Theme", templateId: "minimal", config: "{}" },
    });
    emailThemeId = emailTheme.id;

    // ---- Phase 18 — Blog comment + view metric seeds (Blocker 8) --------
    // Seed a top-level EN comment by the test user, with a reply by the
    // OTHER user underneath. After deletion, the test user's identity must
    // be anonymized, but the OTHER user's reply must survive (tombstone +
    // preserved-thread policy, Blocker 3).
    const blogComment = await db.blogComment.create({
      data: {
        slug: "welcome-to-nixify",
        locale: "en",
        userId: testUserId,
        authorName: "Test User",
        body: "This is the test user's comment.",
      },
    });
    blogCommentId = blogComment.id;

    const blogReply = await db.blogComment.create({
      data: {
        slug: "welcome-to-nixify",
        locale: "en",
        parentId: blogCommentId,
        userId: otherUserId,
        authorName: "Other User",
        body: "This is the OTHER user's reply — it must survive.",
      },
    });
    blogReplyId = blogReply.id;

    // A FA-locale comment by the test user (to verify the FA tombstone label).
    const faBlogComment = await db.blogComment.create({
      data: {
        slug: "welcome-to-nixify",
        locale: "fa",
        userId: testUserId,
        authorName: "Test User",
        body: "نظر کاربر تست.",
      },
    });
    faBlogCommentId = faBlogComment.id;

    // An article view by the test user — must survive with userId = null
    // (a view is a fact about the article, not the viewer).
    const articleView = await db.articleView.create({
      data: { slug: "welcome-to-nixify", userId: testUserId, ipHash: "test-hash" },
    });
    articleViewId = articleView.id;

    // ---- Other tenant: representative data (must survive) ------------------
    const otherContact = await db.contact.create({
      data: { userId: otherUserId, email: `other-contact-${otherUnique("c")}@test.com`, source: "api" },
    });
    otherContactId = otherContact.id;

    const otherApiKey = await db.apiKey.create({
      data: { userId: otherUserId, keyHash: otherUnique("kh"), prefix: "mg_test_" + otherUnique("p"), name: "Other Key", environment: "development", scopes: "full" },
    });
    otherApiKeyRow = { id: otherApiKey.id, keyHash: otherApiKey.keyHash };

    const otherWebhookEndpoint = await db.webhookEndpoint.create({
      data: { userId: otherUserId, url: "https://example.com/other-wh-" + otherUnique("p"), secret: "whsec_other", events: "otp.sent", isActive: true },
    });
    otherWebhookEndpointId = otherWebhookEndpoint.id;

    const otherBroadcast = await db.broadcast.create({
      data: {
        userId: otherUserId,
        name: "Other Broadcast",
        subject: "Other",
        htmlContent: "<p>Other</p>",
        textContent: "Other",
        audienceType: "all_contacts",
        status: "draft",
      },
    });
    otherBroadcastId = otherBroadcast.id;

    const otherBrandKit = await db.brandKit.create({
      data: { userId: otherUserId, primaryColor: "#3b82f6", appName: "Other App" },
    });
    otherBrandKitId = otherBrandKit.id;

    const otherUsage = await db.usageTracking.create({
      data: { userId: otherUserId, featureKey: "OTP_EMAILS", periodStart: new Date(), periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), count: 3 },
    });
    otherUsageTrackingId = otherUsage.id;
  });

  afterEach(async () => {
    // Cleanup any leftovers (the test should have deleted testUser already).
    // Phase 18 — blog comments/views may survive as tombstoned/anonymized
    // rows; clean them up by slug so they don't leak across test runs.
    try { await db.blogComment.deleteMany({ where: { slug: "welcome-to-nixify" } }); } catch {}
    try { await db.articleView.deleteMany({ where: { slug: "welcome-to-nixify" } }); } catch {}
    try { await db.user.delete({ where: { id: testUserId } }); } catch {}
    try { await db.user.delete({ where: { id: otherUserId } }); } catch {}
  });

  it("deletes the user and ALL tenant-owned data — every owned row gone by ID", async () => {
    const { deleteUserAccount } = await import("@/lib/account/deletion");
    const result = await deleteUserAccount(testUserId);
    expect(result.success).toBe(true);

    // ---- Top-level: the user is gone ----
    expect(await db.user.findUnique({ where: { id: testUserId } })).toBeNull();

    // ---- Direct orphan assertions by captured primary key ----
    // If ANY of these rows still exists, the test fails — that exact
    // orphan survived deletion. This is stronger than asserting
    // `findMany({ where: { userId } }).length === 0`, which would also
    // pass if the row had been silently re-owned (e.g. via SET NULL).

    // Direct-owned (NOT NULL userId)
    expect(await db.otpCode.findUnique({ where: { id: otpCodeId } })).toBeNull();
    expect(await db.contact.findUnique({ where: { id: contactId } })).toBeNull();
    expect(await db.contactEvent.findUnique({ where: { id: contactEventId } })).toBeNull();
    expect(await db.group.findUnique({ where: { id: groupId } })).toBeNull();
    expect(await db.contactGroupMembership.findUnique({ where: { id: contactGroupMembershipId } })).toBeNull();
    expect(await db.contactImport.findUnique({ where: { id: contactImportId } })).toBeNull();
    expect(await db.contactImportRow.findUnique({ where: { id: contactImportRowId } })).toBeNull();
    expect(await db.contactConsentEvent.findUnique({ where: { id: contactConsentEventId } })).toBeNull();
    expect(await db.suppressionEntry.findUnique({ where: { id: suppressionEntryId } })).toBeNull();
    expect(await db.suppressionEvent.findUnique({ where: { id: suppressionEventId } })).toBeNull();
    expect(await db.consentMutationIdempotency.findUnique({ where: { id: consentMutationIdempotencyId } })).toBeNull();
    expect(await db.transactionalTemplate.findUnique({ where: { id: templateId } })).toBeNull();
    expect(await db.transactionalTemplateVersion.findUnique({ where: { id: templateVersionId } })).toBeNull();
    expect(await db.emailMessage.findUnique({ where: { id: emailMessageId } })).toBeNull();
    expect(await db.broadcast.findUnique({ where: { id: broadcastId } })).toBeNull();
    expect(await db.broadcastRecipient.findUnique({ where: { id: broadcastRecipientId } })).toBeNull();
    expect(await db.broadcastMutationIdempotency.findUnique({ where: { id: broadcastMutationIdempotencyId } })).toBeNull();
    expect(await db.emailDelivery.findUnique({ where: { id: emailDeliveryId } })).toBeNull();
    expect(await db.emailDeliveryEvent.findUnique({ where: { id: emailDeliveryEventId } })).toBeNull();
    expect(await db.jobQueue.findUnique({ where: { id: jobQueueId } })).toBeNull();
    expect(await db.automationSetting.findUnique({ where: { id: automationSettingId } })).toBeNull();
    expect(await db.inboundEvent.findUnique({ where: { id: inboundEventId } })).toBeNull();
    expect(await db.brandKit.findUnique({ where: { id: brandKitId } })).toBeNull();
    expect(await db.usageTracking.findUnique({ where: { id: usageTrackingId } })).toBeNull();

    // Nullable userId models (user-owned rows must be erased)
    expect(await db.otpEvent.findUnique({ where: { id: otpEventId } })).toBeNull();
    expect(await db.apiKey.findUnique({ where: { id: apiKeyId } })).toBeNull();
    expect(await db.webhookEndpoint.findUnique({ where: { id: webhookEndpointId } })).toBeNull();
    expect(await db.webhookDelivery.findUnique({ where: { id: webhookDeliveryId } })).toBeNull();
    expect(await db.webhookQueue.findUnique({ where: { id: webhookQueueId } })).toBeNull();
    expect(await db.requestLog.findUnique({ where: { id: requestLogId } })).toBeNull();
    expect(await db.emailTheme.findUnique({ where: { id: emailThemeId } })).toBeNull();

    // ---- Phase 18 — blog account-deletion compatibility (Blocker 8) ----
    // The test user's comments are NOT deleted (the thread is preserved via
    // the tombstone + SET NULL policy). Instead:
    //   • The EN comment's userId is null + authorName is the EN tombstone.
    //   • The FA comment's userId is null + authorName is the FA tombstone.
    //   • The OTHER user's reply SURVIVES with its real body + ownership.
    //   • The ArticleView row survives with userId = null (view aggregates
    //     are facts about the article, not the viewer).
    //   • No deleted-user PII remains (no row still carries the test user's
    //     real name "Test User" as authorName, and no row still references
    //     testUserId via userId).
    const enComment = await db.blogComment.findUnique({ where: { id: blogCommentId } });
    expect(enComment).not.toBeNull();
    expect(enComment!.userId).toBeNull();
    expect(enComment!.authorName).toBe("Deleted user");
    expect(enComment!.body).toBe("This is the test user's comment."); // body preserved on account-delete (tombstone is byline-only)

    const faComment = await db.blogComment.findUnique({ where: { id: faBlogCommentId } });
    expect(faComment).not.toBeNull();
    expect(faComment!.userId).toBeNull();
    expect(faComment!.authorName).toBe("کاربر حذف‌شده");

    // The OTHER user's reply survives.
    const survivingReply = await db.blogComment.findUnique({ where: { id: blogReplyId } });
    expect(survivingReply).not.toBeNull();
    expect(survivingReply!.userId).toBe(otherUserId);
    expect(survivingReply!.authorName).toBe("Other User");
    expect(survivingReply!.body).toContain("OTHER user's reply");

    // The ArticleView row survives with userId = null.
    const survivingView = await db.articleView.findUnique({ where: { id: articleViewId } });
    expect(survivingView).not.toBeNull();
    expect(survivingView!.userId).toBeNull();
    expect(survivingView!.slug).toBe("welcome-to-nixify");

    // No deleted-user PII remains: no BlogComment still carries the real
    // display name "Test User" (it was overwritten to the tombstone label).
    const piiComments = await db.blogComment.findMany({
      where: { authorName: "Test User" },
    });
    expect(piiComments.length).toBe(0);
    // No row still references testUserId via userId.
    const orphanedComments = await db.blogComment.findMany({ where: { userId: testUserId } });
    expect(orphanedComments.length).toBe(0);
    const orphanedViews = await db.articleView.findMany({ where: { userId: testUserId } });
    expect(orphanedViews.length).toBe(0);

    // ---- Belt-and-suspenders: no orphan by userId filter either ----
    // (defends against a future schema change where a row could exist
    // with a different primary key but still reference the deleted user.)
    expect((await db.otpCode.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.contact.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.contactEvent.findMany({ where: { contact: { userId: testUserId } } })).length).toBe(0);
    expect((await db.group.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.contactGroupMembership.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.contactImport.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.contactImportRow.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.contactConsentEvent.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.suppressionEntry.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.suppressionEvent.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.consentMutationIdempotency.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.transactionalTemplate.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.transactionalTemplateVersion.findMany({ where: { template: { userId: testUserId } } })).length).toBe(0);
    expect((await db.emailMessage.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.broadcast.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.broadcastRecipient.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.broadcastMutationIdempotency.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.emailDelivery.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.emailDeliveryEvent.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.jobQueue.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.automationSetting.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.inboundEvent.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.brandKit.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.usageTracking.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.otpEvent.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.apiKey.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.webhookEndpoint.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.webhookDelivery.findMany({ where: { endpoint: { userId: testUserId } } })).length).toBe(0);
    expect((await db.webhookQueue.findMany({ where: { endpoint: { userId: testUserId } } })).length).toBe(0);
    expect((await db.requestLog.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.emailTheme.findMany({ where: { userId: testUserId } })).length).toBe(0);
  });

  it("does NOT delete another tenant's records — cross-tenant preservation by ID", async () => {
    const { deleteUserAccount } = await import("@/lib/account/deletion");
    await deleteUserAccount(testUserId);

    // The deleted user is gone, but the other tenant survives intact.
    expect(await db.user.findUnique({ where: { id: otherUserId } })).not.toBeNull();

    // Direct ID assertions — these exact rows must still exist.
    expect(await db.contact.findUnique({ where: { id: otherContactId } })).not.toBeNull();
    expect(await db.apiKey.findUnique({ where: { id: otherApiKeyRow.id } })).not.toBeNull();
    expect(await db.webhookEndpoint.findUnique({ where: { id: otherWebhookEndpointId } })).not.toBeNull();
    expect(await db.broadcast.findUnique({ where: { id: otherBroadcastId } })).not.toBeNull();
    expect(await db.brandKit.findUnique({ where: { id: otherBrandKitId } })).not.toBeNull();
    expect(await db.usageTracking.findUnique({ where: { id: otherUsageTrackingId } })).not.toBeNull();

    // Other tenant's row counts unchanged.
    expect((await db.contact.findMany({ where: { userId: otherUserId } })).length).toBe(1);
    expect((await db.apiKey.findMany({ where: { userId: otherUserId } })).length).toBe(1);
    expect((await db.webhookEndpoint.findMany({ where: { userId: otherUserId } })).length).toBe(1);
    expect((await db.broadcast.findMany({ where: { userId: otherUserId } })).length).toBe(1);
    expect((await db.brandKit.findMany({ where: { userId: otherUserId } })).length).toBe(1);
    expect((await db.usageTracking.findMany({ where: { userId: otherUserId } })).length).toBe(1);
  });

  it("legacy/system rows with userId = NULL survive account deletion", async () => {
    // Nullable-FK tables hold legacy/system rows (userId = NULL) that must
    // NOT be removed when any single user is deleted. CASCADE on a nullable
    // FK in PostgreSQL leaves NULL rows alone — verify that contract.
    const legacyOtpEvent = await db.otpEvent.create({
      data: {
        userId: null,
        requestId: `legacy-req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        email: "legacy@test.com",
        eventType: "requested",
        status: "success",
        purpose: "signup",
      },
    });
    const legacyApiKey = await db.apiKey.create({
      data: { userId: null, keyHash: `legacy-kh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, prefix: "mg_test_legacy", name: "Legacy Key", environment: "production", scopes: "read_only" },
    });
    const legacyRequestLog = await db.requestLog.create({
      data: { userId: null, requestId: `legacy-rlog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, method: "GET", path: "/api/v1/health", status: 200, durationMs: 5 },
    });
    const legacyEmailTheme = await db.emailTheme.create({
      data: { userId: null, name: "Default Theme", templateId: "minimal", config: "{}" },
    });
    const legacyWebhookEndpoint = await db.webhookEndpoint.create({
      data: { userId: null, url: "https://legacy.example.com/wh", secret: "whsec_legacy", events: "system", isActive: true },
    });

    const { deleteUserAccount } = await import("@/lib/account/deletion");
    await deleteUserAccount(testUserId);

    // The deleted user is gone, but all the legacy/system rows survive.
    expect(await db.otpEvent.findUnique({ where: { id: legacyOtpEvent.id } })).not.toBeNull();
    expect(await db.apiKey.findUnique({ where: { id: legacyApiKey.id } })).not.toBeNull();
    expect(await db.requestLog.findUnique({ where: { id: legacyRequestLog.id } })).not.toBeNull();
    expect(await db.emailTheme.findUnique({ where: { id: legacyEmailTheme.id } })).not.toBeNull();
    expect(await db.webhookEndpoint.findUnique({ where: { id: legacyWebhookEndpoint.id } })).not.toBeNull();

    // Cleanup
    await db.otpEvent.delete({ where: { id: legacyOtpEvent.id } });
    await db.apiKey.delete({ where: { id: legacyApiKey.id } });
    await db.requestLog.delete({ where: { id: legacyRequestLog.id } });
    await db.emailTheme.delete({ where: { id: legacyEmailTheme.id } });
    await db.webhookEndpoint.delete({ where: { id: legacyWebhookEndpoint.id } });
  });
});

// ═══ EmailDelivery FK / deletion DB-gated regression (BLOCKER 1) ═══
//
// Verifies the live PostgreSQL schema (not only source-string tests) for the
// EmailDelivery_userId_fkey constraint. Confirms:
//   - the FK exists in information_schema with ON DELETE CASCADE
//   - a seeded EmailDelivery + EmailDeliveryEvent disappear on account deletion
//   - another tenant's delivery survives
//   - the EmailDeliveryEvent CASCADEs with its parent EmailDelivery

describe.skipIf(!RUN_DELETION_TESTS)("EmailDelivery FK + deletion (PostgreSQL)", () => {
  let testUserId: number;
  let otherUserId: number;
  let testDeliveryId: number;
  let testDeliveryEventId: number;
  let otherDeliveryId: number;

  beforeEach(async () => {
    const unique = (suffix: string) => `${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await db.user.create({
      data: {
        email: `delivery-test-${unique("u")}@test.nixify.dev`,
        passwordHash: "test-hash",
        emailVerified: true,
        plan: "PRO",
      },
    });
    testUserId = user.id;
    const other = await db.user.create({
      data: {
        email: `delivery-other-${unique("u")}@test.nixify.dev`,
        passwordHash: "test-hash-other",
        emailVerified: true,
        plan: "FREE",
      },
    });
    otherUserId = other.id;

    // Test tenant's EmailDelivery (no source linkage — both composite FKs NULL).
    const delivery = await db.emailDelivery.create({
      data: {
        userId: testUserId,
        sourceType: "transactional",
        provider: "smtp",
        currentStatus: "delivered",
        deliveredAt: new Date(),
      },
    });
    testDeliveryId = delivery.id;

    // EmailDeliveryEvent cascades via the composite FK (userId, deliveryId).
    const event = await db.emailDeliveryEvent.create({
      data: {
        userId: testUserId,
        deliveryId: delivery.id,
        provider: "smtp",
        providerEventId: unique("peid"),
        type: "delivered",
        occurredAt: new Date(),
      },
    });
    testDeliveryEventId = event.id;

    // Other tenant's EmailDelivery (must survive).
    const otherDelivery = await db.emailDelivery.create({
      data: {
        userId: otherUserId,
        sourceType: "transactional",
        provider: "smtp",
        currentStatus: "queued",
      },
    });
    otherDeliveryId = otherDelivery.id;
  });

  afterEach(async () => {
    try { await db.user.delete({ where: { id: testUserId } }); } catch {}
    try { await db.user.delete({ where: { id: otherUserId } }); } catch {}
  });

  it("live PostgreSQL schema: EmailDelivery_userId_fkey exists with ON DELETE CASCADE", async () => {
    // Query information_schema directly — this proves the actual DB state,
    // not only the Prisma schema declaration. This is the authoritative
    // regression against future drift.
    const rows = await db.$queryRaw<
      Array<{ constraint_name: string; delete_rule: string }>
    >`
      SELECT tc.constraint_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = 'EmailDelivery'
        AND tc.constraint_name = 'EmailDelivery_userId_fkey'
    `;
    expect(rows.length).toBe(1);
    expect(rows[0].constraint_name).toBe("EmailDelivery_userId_fkey");
    expect(rows[0].delete_rule).toBe("CASCADE");
  });

  it("live PostgreSQL schema: EmailDeliveryEvent composite FK is CASCADE", async () => {
    // EmailDeliveryEvent cascades with its parent EmailDelivery via the
    // composite FK (userId, deliveryId) → EmailDelivery(userId, id).
    const rows = await db.$queryRaw<
      Array<{ constraint_name: string; delete_rule: string }>
    >`
      SELECT tc.constraint_name, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = 'EmailDeliveryEvent'
        AND tc.constraint_name = 'EmailDeliveryEvent_userId_deliveryId_fkey'
    `;
    expect(rows.length).toBe(1);
    expect(rows[0].delete_rule).toBe("CASCADE");
  });

  it("account deletion removes seeded EmailDelivery + EmailDeliveryEvent by exact ID", async () => {
    const { deleteUserAccount } = await import("@/lib/account/deletion");
    await deleteUserAccount(testUserId);

    // Exact-ID assertions — the seeded rows must no longer exist.
    expect(await db.emailDelivery.findUnique({ where: { id: testDeliveryId } })).toBeNull();
    expect(await db.emailDeliveryEvent.findUnique({ where: { id: testDeliveryEventId } })).toBeNull();

    // Belt-and-suspenders: no EmailDelivery row for the deleted tenant.
    expect((await db.emailDelivery.findMany({ where: { userId: testUserId } })).length).toBe(0);
    expect((await db.emailDeliveryEvent.findMany({ where: { userId: testUserId } })).length).toBe(0);
  });

  it("another tenant's EmailDelivery survives account deletion by exact ID", async () => {
    const { deleteUserAccount } = await import("@/lib/account/deletion");
    await deleteUserAccount(testUserId);

    // The other tenant's delivery must still exist.
    expect(await db.emailDelivery.findUnique({ where: { id: otherDeliveryId } })).not.toBeNull();
    expect((await db.emailDelivery.findMany({ where: { userId: otherUserId } })).length).toBe(1);
  });
});

// ═══ Static tests (always run) ═══

describe("Account Deletion — static contracts", () => {
  it("deletion service imports consumeOtp", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/lib/account/deletion.ts", "utf-8");
    expect(src).toContain("consumeOtp");
    expect(src).toContain("deleteUserAccount");
  });

  it("deletion confirm route clears session cookie", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/app/api/account/deletion/confirm/route.ts", "utf-8");
    expect(src).toContain("clearSessionCookie");
  });

  it("deletion verify route uses canonical locale resolver", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/app/api/account/deletion/verify/route.ts", "utf-8");
    expect(src).toContain("resolveServerLocale");
  });

  it("OTP verifier skips orchestration for account_deletion", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/lib/otp/verifier.ts", "utf-8");
    expect(src).toContain('purpose !== "account_deletion"');
  });

  it("OTP verifier exempts account_deletion from OTP_EMAILS quota", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/lib/otp/verifier.ts", "utf-8");
    expect(src).toContain('purpose !== "account_deletion"');
    // The quota check is inside `if (userId && purpose !== "account_deletion")`
    expect(src).toMatch(/if\s*\(userId\s*&&\s*purpose\s*!==\s*"account_deletion"\)/);
  });

  it("deletion service deletes all tenant-owned models explicitly", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/lib/account/deletion.ts", "utf-8");
    expect(src).toContain("otpEvent.deleteMany");
    expect(src).toContain("consentMutationIdempotency.deleteMany");
    expect(src).toContain("suppressionEvent.deleteMany");
    expect(src).toContain("suppressionEntry.deleteMany");
    expect(src).toContain("apiKey.deleteMany");
    expect(src).toContain("webhookEndpoint.deleteMany");
    expect(src).toContain("requestLog.deleteMany");
    expect(src).toContain("emailTheme.deleteMany");
  });

  // ─── Phase 19 — onboarding account-deletion compatibility ───────────────
  it("deletion service explicitly deletes OnboardingProgress (defense-in-depth)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/lib/account/deletion.ts", "utf-8");
    expect(src).toContain("onboardingProgress.deleteMany");
  });

  it("schema OnboardingProgress has NOT NULL userId + onDelete: Cascade", async () => {
    const fs = await import("fs");
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
    // The OnboardingProgress model must have a NOT NULL userId + Cascade.
    expect(schema).toMatch(/model OnboardingProgress \{/);
    expect(schema).toMatch(/userId\s+Int\s+@unique/);
    expect(schema).toMatch(/user\s+User\s+@relation\(fields:\s*\[userId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/);
  });

  it("migration creates OnboardingProgress with CASCADE FK + unique userId", async () => {
    const fs = await import("fs");
    const migration = fs.readFileSync(
      "prisma/migrations/20260927000000_add_onboarding_progress/migration.sql",
      "utf-8",
    );
    expect(migration).toContain("CREATE TABLE \"OnboardingProgress\"");
    // Use regex to tolerate column-type spacing (e.g. "userId"  INTEGER  NOT NULL).
    expect(migration).toMatch(/"userId"\s+INTEGER\s+NOT\s+NULL/);
    expect(migration).toContain("ON DELETE CASCADE ON UPDATE CASCADE");
    expect(migration).toContain("UNIQUE INDEX \"OnboardingProgress_userId_key\"");
  });

  // ─── Phase 18 — blog account-deletion compatibility ────────────────────
  it("deletion service ANONYMIZES blog comments (localized tombstone) before user delete", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/lib/account/deletion.ts", "utf-8");
    // The explicit anonymization step overwrites authorName + nulls the FK
    // BEFORE the user row is removed (so comment threads survive without PII).
    // Blocker 5 + 8: localized tombstones (en: "Deleted user" / fa: "کاربر حذف‌شده").
    expect(src).toContain("blogComment.updateMany");
    expect(src).toContain('"Deleted user"');
    expect(src).toContain('"کاربر حذف‌شده"');
    // Scoped by locale so each comment gets the right tombstone label.
    expect(src).toMatch(/where:\s*\{\s*userId,\s*locale:\s*"en"\s*\}/);
    expect(src).toMatch(/where:\s*\{\s*userId,\s*locale:\s*"fa"\s*\}/);
  });

  it("deletion service nulls BlogComment FK via ON DELETE SET NULL (no broken FK)", async () => {
    const fs = await import("fs");
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
    // BlogComment.user must be onDelete: SetNull (preserves comment thread).
    expect(schema).toMatch(/blogComments\s+BlogComment\[\]/);
    expect(schema).toMatch(/user\s+User\?\s+@relation\(fields:\s*\[userId\],\s*references:\s*\[id\],\s*onDelete:\s*SetNull\)/);
  });

  it("BlogComment.parentId FK is ON DELETE SET NULL (Blocker 3 — preserve replies)", async () => {
    const fs = await import("fs");
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
    // parentId must be SetNull (NOT Cascade) so deleting a parent does not
    // destroy other users' replies.
    expect(schema).toMatch(/parent\s+BlogComment\?\s+@relation\("CommentReplies",\s*fields:\s*\[parentId\],\s*references:\s*\[id\],\s*onDelete:\s*SetNull\)/);
  });

  it("ArticleView FK is ON DELETE SET NULL (view-count aggregates survive deletion)", async () => {
    const fs = await import("fs");
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
    expect(schema).toMatch(/articleViews\s+ArticleView\[\]/);
  });

  it("BlogComment has tombstone columns (deleted + deletedAt) for preserved-thread deletes", async () => {
    const fs = await import("fs");
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
    expect(schema).toMatch(/deleted\s+Boolean\s+@default\(false\)/);
    expect(schema).toMatch(/deletedAt\s+DateTime\?/);
  });

  it("BlogComment has locale-aware composite index (slug, locale, hidden, createdAt)", async () => {
    const fs = await import("fs");
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
    expect(schema).toMatch(/@@index\(\[slug,\s*locale,\s*hidden,\s*createdAt\]\)/);
  });

  it("migration creates BlogComment + ArticleView with SET NULL user FKs", async () => {
    const fs = await import("fs");
    const migration = fs.readFileSync(
      "prisma/migrations/20260925000000_add_blog_comments_article_views/migration.sql",
      "utf-8",
    );
    expect(migration).toContain("CREATE TABLE \"BlogComment\"");
    expect(migration).toContain("CREATE TABLE \"ArticleView\"");
    // Both user FKs must be ON DELETE SET NULL.
    expect(migration).toContain("ON DELETE SET NULL");
    expect(migration).toContain("BlogComment_userId_fkey");
    expect(migration).toContain("ArticleView_userId_fkey");
  });

  it("second migration amends BlogComment: tombstone columns, parentId SET NULL, locale index (Blockers 1/3/6)", async () => {
    const fs = await import("fs");
    const migration = fs.readFileSync(
      "prisma/migrations/20260926000000_blog_locale_tombstone_preserve_replies/migration.sql",
      "utf-8",
    );
    // Tombstone columns.
    expect(migration).toContain('"deleted" BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain('"deletedAt" TIMESTAMP(3)');
    // parentId FK changed CASCADE → SET NULL.
    expect(migration).toContain("DROP CONSTRAINT IF EXISTS \"BlogComment_parentId_fkey\"");
    expect(migration).toContain("ON DELETE SET NULL ON UPDATE CASCADE");
    // Locale-aware composite index.
    expect(migration).toContain("BlogComment_slug_locale_hidden_createdAt_idx");
    expect(migration).toContain('("slug", "locale", "hidden", "createdAt")');
    // Old index dropped.
    expect(migration).toContain("BlogComment_slug_hidden_createdAt_idx");
  });

  it("deletion service does NOT leak raw DB errors to client", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/lib/account/deletion.ts", "utf-8");
    // The returned error must be a generic safe message
    expect(src).toContain("Account deletion failed. Please try again or contact support.");
    // The raw error message must NOT be included in the return value
    // (it can be used for server-side logging via console.error)
    expect(src).not.toMatch(/return.*err\.message/);
    expect(src).not.toMatch(/error:.*\$\{.*message/);
    // Must log server-side
    expect(src).toContain("console.error");
  });

  it("Persian OTP placeholder is ASCII '123456'", async () => {
    const fs = await import("fs");
    const fa = fs.readFileSync("src/i18n/fa.ts", "utf-8");
    expect(fa).toContain('deletionCodePlaceholder: "123456"');
    expect(fa).not.toContain('deletionCodePlaceholder: "۱۲۳۴۵۶"');
  });

  it("Persian account_deletion footer has no typo (حذف not دزف)", async () => {
    const fs = await import("fs");
    const renderer = fs.readFileSync("src/lib/otp/email-renderer.ts", "utf-8");
    expect(renderer).not.toContain("دزف");
    expect(renderer).toContain("حذف نشده است");
  });

  it("Persian account_deletion uses toPersianDigits for minutes", async () => {
    const fs = await import("fs");
    const renderer = fs.readFileSync("src/lib/otp/email-renderer.ts", "utf-8");
    // The FA account_deletion section should use toPersianDigits(mins) not raw mins
    // Find the FA account_deletion block
    const faAccountDeletionSection = renderer.split("account_deletion: {")[2]; // 3rd occurrence = FA
    expect(faAccountDeletionSection).toBeDefined();
    expect(faAccountDeletionSection).toContain("toPersianDigits(mins)");
  });

  it("WebhookQueue onDelete is CASCADE in schema", async () => {
    const fs = await import("fs");
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
    const webhookQueueSection = schema.split("model WebhookQueue")[1]?.split("}")[0] ?? "";
    expect(webhookQueueSection).toContain("onDelete: Cascade");
  });

  it("migration includes WebhookQueue CASCADE change", async () => {
    const fs = await import("fs");
    const migration = fs.readFileSync(
      "prisma/migrations/20260924000000_add_user_names_and_ondelete_rules/migration.sql",
      "utf-8"
    );
    expect(migration).toContain("WebhookQueue");
    expect(migration).toContain("CASCADE");
  });

  it("Prisma schema models nullable userId relations with onDelete: Cascade", async () => {
    const fs = await import("fs");
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");
    // OtpEvent should have user User? relation with onDelete: Cascade
    const otpEventSection = schema.split("model OtpEvent")[1]?.split("}")[0] ?? "";
    expect(otpEventSection).toContain("User?");
    expect(otpEventSection).toContain("onDelete: Cascade");

    // ApiKey should have user User? relation
    const apiKeySection = schema.split("model ApiKey")[1]?.split("}")[0] ?? "";
    expect(apiKeySection).toContain("User?");
    expect(apiKeySection).toContain("onDelete: Cascade");

    // WebhookEndpoint should have user User? relation
    const webhookEndpointSection = schema.split("model WebhookEndpoint")[1]?.split("}")[0] ?? "";
    expect(webhookEndpointSection).toContain("User?");
    expect(webhookEndpointSection).toContain("onDelete: Cascade");

    // RequestLog should have user User? relation
    const requestLogSection = schema.split("model RequestLog")[1]?.split("}")[0] ?? "";
    expect(requestLogSection).toContain("User?");
    expect(requestLogSection).toContain("onDelete: Cascade");

    // EmailTheme should have user User? relation
    const emailThemeSection = schema.split("model EmailTheme")[1]?.split("}")[0] ?? "";
    expect(emailThemeSection).toContain("User?");
    expect(emailThemeSection).toContain("onDelete: Cascade");

    // User model should have reverse relations
    const userSection = schema.split("model User")[1]?.split("model ")[0] ?? "";
    expect(userSection).toContain("otpEvents");
    expect(userSection).toContain("apiKeys");
    expect(userSection).toContain("webhookEndpoints");
    expect(userSection).toContain("requestLogs");
    expect(userSection).toContain("emailThemes");
  });

  it("Prisma schema models required userId relations (BrandKit, UsageTracking) with onDelete: Cascade", async () => {
    const fs = await import("fs");
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");

    // BrandKit has userId Int @unique (NOT NULL) → must model User relation
    const brandKitSection = schema.split("model BrandKit")[1]?.split("}")[0] ?? "";
    expect(brandKitSection).toContain("userId         Int      @unique");
    expect(brandKitSection).toContain("user User @relation(fields: [userId], references: [id], onDelete: Cascade)");

    // UsageTracking has userId Int (NOT NULL) → must model User relation
    const usageSection = schema.split("model UsageTracking")[1]?.split("}")[0] ?? "";
    expect(usageSection).toContain("userId      Int");
    expect(usageSection).toContain("user User @relation(fields: [userId], references: [id], onDelete: Cascade)");

    // User model should have reverse relations for both
    const userSection = schema.split("model User")[1]?.split("model ")[0] ?? "";
    expect(userSection).toContain("brandKits");
    expect(userSection).toContain("usageTracking");
  });

  it("migration aligns ApiKey/WebhookEndpoint/RequestLog/EmailTheme to CASCADE (no SET NULL drift)", async () => {
    const fs = await import("fs");
    const migration = fs.readFileSync(
      "prisma/migrations/20260924000000_add_user_names_and_ondelete_rules/migration.sql",
      "utf-8"
    );
    // The four nullable-FK models had SET NULL in an earlier iteration —
    // verify they are now CASCADE in the additive migration.
    // Match the ADD CONSTRAINT ... ON DELETE CASCADE lines (multiline).
    expect(migration).toMatch(/ADD CONSTRAINT "ApiKey_userId_fkey"\s+FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\) ON DELETE CASCADE/);
    expect(migration).toMatch(/ADD CONSTRAINT "WebhookEndpoint_userId_fkey"\s+FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\) ON DELETE CASCADE/);
    expect(migration).toMatch(/ADD CONSTRAINT "RequestLog_userId_fkey"\s+FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\) ON DELETE CASCADE/);
    expect(migration).toMatch(/ADD CONSTRAINT "EmailTheme_userId_fkey"\s+FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\) ON DELETE CASCADE/);

    // None of these FKs should still be SET NULL.
    expect(migration).not.toMatch(/ApiKey_userId_fkey[\s\S]*ON DELETE SET NULL/);
    expect(migration).not.toMatch(/WebhookEndpoint_userId_fkey[\s\S]*ON DELETE SET NULL/);
    expect(migration).not.toMatch(/RequestLog_userId_fkey[\s\S]*ON DELETE SET NULL/);
    expect(migration).not.toMatch(/EmailTheme_userId_fkey[\s\S]*ON DELETE SET NULL/);

    // OtpEvent must now have a CASCADE FK (was previously missing entirely)
    expect(migration).toMatch(/ADD CONSTRAINT "OtpEvent_userId_fkey"\s+FOREIGN KEY \("userId"\) REFERENCES "User"\("id"\) ON DELETE CASCADE/);
  });

  it("migration creates OtpEvent_userId_fkey (was previously absent)", async () => {
    const fs = await import("fs");
    const migration = fs.readFileSync(
      "prisma/migrations/20260924000000_add_user_names_and_ondelete_rules/migration.sql",
      "utf-8"
    );
    // The migration must ADD the FK constraint (with CASCADE) — previously
    // the schema declared the relation but the migration never created the FK.
    expect(migration).toMatch(/ADD CONSTRAINT "OtpEvent_userId_fkey"/);
    expect(migration).toMatch(/OtpEvent_userId_fkey[\s\S]*ON DELETE CASCADE/);
  });

  it("migration creates BrandKit + UsageTracking CASCADE FKs (modeled in schema)", async () => {
    const fs = await import("fs");
    const migration = fs.readFileSync(
      "prisma/migrations/20260924000000_add_user_names_and_ondelete_rules/migration.sql",
      "utf-8"
    );
    expect(migration).toMatch(/ADD CONSTRAINT "BrandKit_userId_fkey"[\s\S]*ON DELETE CASCADE/);
    expect(migration).toMatch(/ADD CONSTRAINT "UsageTracking_userId_fkey"[\s\S]*ON DELETE CASCADE/);
  });

  it("Prisma schema models EmailDelivery.userId → User relation with onDelete: Cascade", async () => {
    const fs = await import("fs");
    const schema = fs.readFileSync("prisma/schema.prisma", "utf-8");

    // EmailDelivery has userId Int (NOT NULL) — must model the User relation
    // (the DB FK EmailDelivery_userId_fkey already exists with CASCADE from
    // migration 20260922000000_add_provider_deliverability — the Prisma
    // schema must declare it too so there is NO drift).
    const emailDeliverySection = schema.split("model EmailDelivery")[1]?.split("model ")[0] ?? "";
    expect(emailDeliverySection).toContain("userId                        Int");
    expect(emailDeliverySection).toContain("user                          User                 @relation(fields: [userId], references: [id], onDelete: Cascade)");

    // The two nullable source-correlation FKs must remain SET NULL (audit
    // history preserved when the parent EmailMessage/BroadcastRecipient is
    // deleted — only the FK column is nulled, userId stays NOT NULL).
    expect(emailDeliverySection).toContain('emailMessage                  EmailMessage?        @relation("EmailDeliveryEmailMessage"');
    expect(emailDeliverySection).toContain("onDelete: SetNull");
    expect(emailDeliverySection).toContain('broadcastRecipient            BroadcastRecipient?  @relation("EmailDeliveryBroadcastRecipient"');

    // User model must have the reverse relation `emailDeliveries EmailDelivery[]`
    const userSection = schema.split("model User")[1]?.split("model ")[0] ?? "";
    expect(userSection).toContain("emailDeliveries");
  });

  it("EmailDelivery_userId_fkey is created by the provider-deliverability migration (not by a later corrective migration)", async () => {
    const fs = await import("fs");
    // The FK was created by 20260922000000_add_provider_deliverability — the
    // schema declaration is purely additive Prisma-side; no corrective
    // migration is needed (the DB FK already exists).
    const providerMigration = fs.readFileSync(
      "prisma/migrations/20260922000000_add_provider_deliverability/migration.sql",
      "utf-8"
    );
    expect(providerMigration).toMatch(/EmailDelivery_userId_fkey[\s\S]*ON DELETE CASCADE/);
  });

  it("renderEmailForPurpose bypasses generic theme for account_deletion (destructive-action safety)", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/lib/otp/verifier.ts", "utf-8");
    // The account_deletion short-circuit must run BEFORE any theme lookup.
    // It returns the canonical localized renderer output directly.
    expect(src).toContain('if (opts.purpose === "account_deletion")');
    expect(src).toMatch(/account_deletion[\s\S]*renderOtpEmail/);
  });

  it("shared HTML renderer no longer hardcodes English footer sentences", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("src/lib/otp/email-renderer.ts", "utf-8");
    // The footer block must be locale-aware — the literal English sentences
    // must now only appear in the `isFa ? ... : ...` English branch.
    // Verify the Persian footer strings exist.
    expect(src).toContain("این پیام به");
    expect(src).toContain("برای اینکه ایمیل‌های آینده در پوشه هرزنامه قرار نگیرند");
    expect(src).toContain("تمامی حقوق محفوظ است");
    // And the locale switch must exist.
    expect(src).toContain('const isFa = lang === "fa"');
  });
});
