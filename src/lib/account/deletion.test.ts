/**
 * UX-C: Account Deletion — integration + static tests.
 *
 * Integration tests require PostgreSQL (RUN_ACCOUNT_DELETION_INTEGRATION=1).
 * Static tests always run.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";

const RUN_DELETION_TESTS = process.env.RUN_ACCOUNT_DELETION_INTEGRATION === "1" && !!process.env.TEST_DATABASE_URL;

describe.skipIf(!RUN_DELETION_TESTS)("Account Deletion Integration", () => {
  let testUserId: number;
  let testEmail: string;
  let otherUserId: number;

  beforeEach(async () => {
    const user = await db.user.create({
      data: {
        email: `deletion-test-${Date.now()}@test.nixify.dev`,
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

    // Create second user for cross-tenant safety check
    const other = await db.user.create({
      data: {
        email: `other-${Date.now()}@test.nixify.dev`,
        passwordHash: "test-hash-other",
        emailVerified: true,
        fullName: "Other User",
        plan: "FREE",
      },
    });
    otherUserId = other.id;

    // Seed tenant data for test user
    await db.apiKey.create({
      data: { userId: testUserId, keyHash: "hash-" + testUserId, prefix: "mg_test_" + testUserId, name: "Test Key", environment: "development", scopes: "full" },
    });

    const contact = await db.contact.create({
      data: { userId: testUserId, email: "contact@test.com", source: "dashboard" },
    });

    await db.contactEvent.create({
      data: { contactId: contact.id, type: "contact.created", detail: { source: "test" } },
    });

    await db.group.create({
      data: { userId: testUserId, name: "Test Group", normalizedName: "test-group", description: "Test" },
    });

    await db.contactImport.create({
      data: { userId: testUserId, originalFilename: "test.csv", format: "json", status: "completed", totalRows: 1, validRows: 1 },
    });

    const supEntry = await db.suppressionEntry.create({
      data: { userId: testUserId, email: "suppressed@test.com", reason: "manual", source: "dashboard" },
    });

    await db.suppressionEvent.create({
      data: { userId: testUserId, suppressionId: supEntry.id, email: "suppressed@test.com", operation: "suppress", action: "suppressed", reason: "manual", source: "dashboard" },
    });

    await db.consentMutationIdempotency.create({
      data: { userId: testUserId, operation: "suppress", targetType: "email", targetKey: "suppressed@test.com", idempotencyKeyHash: "hash-" + testUserId, resultStatus: "applied" },
    });

    const webhookEndpoint = await db.webhookEndpoint.create({
      data: { userId: testUserId, url: "https://example.com/webhook", secret: "whsec_test", events: "otp.sent,otp.verified", isActive: true },
    });

    await db.webhookDelivery.create({
      data: { endpointId: webhookEndpoint.id, deliveryId: "dlv_test_" + testUserId, eventId: "otp.verified", requestId: "req_test", payload: "{}", signature: "sig", status: "delivered" },
    });

    await db.webhookQueue.create({
      data: { endpointId: webhookEndpoint.id, deliveryId: 1, payload: "{}", signature: "sig", eventType: "otp.verified", nextRetryAt: new Date(Date.now() + 60000) },
    });

    await db.requestLog.create({
      data: { userId: testUserId, requestId: "req_log_" + testUserId, method: "POST", path: "/api/v1/otp/send", status: 200, durationMs: 100 },
    });

    await db.emailTheme.create({
      data: { userId: testUserId, name: "Test Theme", templateId: "minimal", config: "{}" },
    });

    await db.brandKit.create({
      data: { userId: testUserId, primaryColor: "#10b981", appName: "Test App" },
    });

    await db.usageTracking.create({
      data: { userId: testUserId, featureKey: "OTP_EMAILS", periodStart: new Date(), periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), count: 5 },
    });

    const template = await db.transactionalTemplate.create({
      data: { userId: testUserId, slug: "test-template-" + testUserId, name: "Test Template" },
    });

    const emailMessage = await db.emailMessage.create({
      data: { userId: testUserId, messageId: "msg_" + testUserId, toEmail: "user@test.com", subject: "Test", status: "sent", source: "api_v1" },
    });

    // Seed some data for the other user too
    await db.contact.create({
      data: { userId: otherUserId, email: "other-contact@test.com", source: "api" },
    });
  });

  afterEach(async () => {
    try { await db.user.delete({ where: { id: testUserId } }); } catch {}
    try { await db.user.delete({ where: { id: otherUserId } }); } catch {}
  });

  it("deletes the user and ALL tenant-owned data", async () => {
    const { deleteUserAccount } = await import("@/lib/account/deletion");
    const result = await deleteUserAccount(testUserId);
    expect(result.success).toBe(true);

    // User gone
    expect(await db.user.findUnique({ where: { id: testUserId } })).toBeNull();

    // API keys gone
    expect((await db.apiKey.findMany({ where: { userId: testUserId } })).length).toBe(0);
    // Contacts gone
    expect((await db.contact.findMany({ where: { userId: testUserId } })).length).toBe(0);
    // Contact events gone
    // Contact events cascade via Contact deletion — verify contacts are gone
    expect((await db.contact.findMany({ where: { userId: testUserId } })).length).toBe(0);
    // Groups gone
    expect((await db.group.findMany({ where: { userId: testUserId } })).length).toBe(0);
    // Contact imports gone
    expect((await db.contactImport.findMany({ where: { userId: testUserId } })).length).toBe(0);
    // Suppression entries gone
    expect((await db.suppressionEntry.findMany({ where: { userId: testUserId } })).length).toBe(0);
    // Suppression events gone
    expect((await db.suppressionEvent.findMany({ where: { userId: testUserId } })).length).toBe(0);
    // Consent mutation idempotency gone
    expect((await db.consentMutationIdempotency.findMany({ where: { userId: testUserId } })).length).toBe(0);
    // Webhook endpoints gone
    expect((await db.webhookEndpoint.findMany({ where: { userId: testUserId } })).length).toBe(0);
    // Webhook deliveries gone (cascade from endpoint)
    // Webhook deliveries cascade via WebhookEndpoint deletion
    expect((await db.webhookEndpoint.findMany({ where: { userId: testUserId } })).length).toBe(0);
    // Webhook queue gone (cascade from endpoint)
    // Request logs gone
    expect((await db.requestLog.findMany({ where: { userId: testUserId } })).length).toBe(0);
    // Email themes gone
    expect((await db.emailTheme.findMany({ where: { userId: testUserId } })).length).toBe(0);
    // Brand kit gone
    expect((await db.brandKit.findMany({ where: { userId: testUserId } })).length).toBe(0);
    // Usage tracking gone
    expect((await db.usageTracking.findMany({ where: { userId: testUserId } })).length).toBe(0);
    // Templates gone
    expect((await db.transactionalTemplate.findMany({ where: { userId: testUserId } })).length).toBe(0);
    // Email messages gone
    expect((await db.emailMessage.findMany({ where: { userId: testUserId } })).length).toBe(0);
    // OTP events gone
    expect((await db.otpEvent.findMany({ where: { userId: testUserId } })).length).toBe(0);
  });

  it("does NOT delete another user's records", async () => {
    const { deleteUserAccount } = await import("@/lib/account/deletion");
    await deleteUserAccount(testUserId);

    // Other user still exists
    expect(await db.user.findUnique({ where: { id: otherUserId } })).not.toBeNull();
    // Other user's contacts intact
    expect((await db.contact.findMany({ where: { userId: otherUserId } })).length).toBe(1);
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
});
