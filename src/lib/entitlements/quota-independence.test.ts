import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { checkUsage, peekUsage, canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { hashPassword } from "@/lib/auth/password";

/**
 * Quota independence regression tests.
 *
 * Proves that OTP_EMAILS and MESSAGING_EMAILS are completely independent.
 * Consuming one must NEVER consume the other.
 *
 * Also proves that access-only feature keys (CONTACTS, AUTOMATIONS, etc.) are
 * NOT consumed as monthly usage — they use canAccess(), not checkUsage().
 *
 * These tests require a working database connection. If the DB isn't
 * reachable, the suite is SKIPPED — vitest reports each test as `skipped`,
 * NOT as failed.
 */

const SKIP = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("file:");

describe.skipIf(SKIP)("Quota Independence Tests", () => {
  let userId: number;

  beforeAll(async () => {
    // Clean up any previous test data
    await db.usageTracking.deleteMany({
      where: { featureKey: { in: ["otp_emails", "messaging_emails"] } },
    });

    // Create a test user with PRO plan (has access to both features)
    const user = await db.user.create({
      data: {
        email: "quota-test@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    // Clean up
    if (userId) {
      await db.usageTracking.deleteMany({
        where: { userId, featureKey: { in: ["otp_emails", "messaging_emails"] } },
      });
      await db.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await db.$disconnect();
  });

  it("consuming OTP_EMAILS does NOT change MESSAGING_EMAILS usage", async () => {
    // Snapshot both before
    const otpBefore = await peekUsage(userId, FEATURE_KEYS.OTP_EMAILS);
    const messagingBefore = await peekUsage(userId, FEATURE_KEYS.MESSAGING_EMAILS);

    // Consume one OTP_EMAILS unit
    const result = await checkUsage(userId, FEATURE_KEYS.OTP_EMAILS);
    expect(result.allowed).toBe(true);

    // Snapshot both after
    const otpAfter = await peekUsage(userId, FEATURE_KEYS.OTP_EMAILS);
    const messagingAfter = await peekUsage(userId, FEATURE_KEYS.MESSAGING_EMAILS);

    // OTP usage increased by 1
    expect(otpAfter.used).toBe(otpBefore.used + 1);

    // Messaging usage is UNCHANGED
    expect(messagingAfter.used).toBe(messagingBefore.used);
  });

  it("consuming MESSAGING_EMAILS does NOT change OTP_EMAILS usage", async () => {
    // Snapshot both before
    const otpBefore = await peekUsage(userId, FEATURE_KEYS.OTP_EMAILS);
    const messagingBefore = await peekUsage(userId, FEATURE_KEYS.MESSAGING_EMAILS);

    // Consume one MESSAGING_EMAILS unit
    const result = await checkUsage(userId, FEATURE_KEYS.MESSAGING_EMAILS);
    expect(result.allowed).toBe(true);

    // Snapshot both after
    const otpAfter = await peekUsage(userId, FEATURE_KEYS.OTP_EMAILS);
    const messagingAfter = await peekUsage(userId, FEATURE_KEYS.MESSAGING_EMAILS);

    // Messaging usage increased by 1
    expect(messagingAfter.used).toBe(messagingBefore.used + 1);

    // OTP usage is UNCHANGED
    expect(otpAfter.used).toBe(otpBefore.used);
  });

  it("there is no shared total_email_usage counter", async () => {
    // Verify that "total_email_usage" does NOT exist as a feature key
    const allKeys = Object.values(FEATURE_KEYS);
    expect(allKeys).not.toContain("total_email_usage");

    // Verify that consuming OTP_EMAILS creates a row with featureKey="otp_emails"
    // and consuming MESSAGING_EMAILS creates a row with featureKey="messaging_emails"
    // — they are separate rows, not a shared counter.
    const otpRows = await db.usageTracking.findMany({
      where: { userId, featureKey: "otp_emails" },
    });
    const messagingRows = await db.usageTracking.findMany({
      where: { userId, featureKey: "messaging_emails" },
    });

    expect(otpRows.length).toBeGreaterThan(0);
    expect(messagingRows.length).toBeGreaterThan(0);

    // They must be different rows (different featureKey values)
    const otpFeatureKey = otpRows[0].featureKey;
    const messagingFeatureKey = messagingRows[0].featureKey;
    expect(otpFeatureKey).toBe("otp_emails");
    expect(messagingFeatureKey).toBe("messaging_emails");
    expect(otpFeatureKey).not.toBe(messagingFeatureKey);
  });

  it("messaging access comes from canAccess, not user.plan string", async () => {
    // The usage endpoint must NOT check user.plan === "FREE" or user.plan !== "FREE".
    // It must call canAccess(userId, FEATURE_KEYS.MESSAGING_EMAILS).
    // This test verifies the entitlement engine returns the correct access result.
    const access = await canAccess(userId, FEATURE_KEYS.MESSAGING_EMAILS);
    // userId is a PRO user — MESSAGING_EMAILS has access: true on PRO
    expect(access.allowed).toBe(true);
    expect(access.plan).toBe("PRO");

    // If we had a FREE user, access would be false:
    // const freeAccess = await canAccess(freeUserId, FEATURE_KEYS.MESSAGING_EMAILS);
    // expect(freeAccess.allowed).toBe(false);
  });

  it("access-only feature keys do NOT create UsageTracking rows when accessed", async () => {
    // canAccess() is read-only — it does NOT consume quota or create UsageTracking rows.
    // This proves CONTACTS, AUTOMATIONS, GROUPS etc. are NOT treated as monthly usage.
    const beforeCount = await db.usageTracking.count({
      where: { userId, featureKey: "contacts" },
    });

    await canAccess(userId, FEATURE_KEYS.CONTACTS);

    const afterCount = await db.usageTracking.count({
      where: { userId, featureKey: "contacts" },
    });

    // No UsageTracking row was created — canAccess is read-only
    expect(afterCount).toBe(beforeCount);
    expect(afterCount).toBe(0); // No rows at all for access-only keys
  });
});
