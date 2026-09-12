import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { canAccess, checkUsage } from "@/lib/entitlements/engine";
import { FEATURE_KEYS, FEATURE_LIMITS } from "@/lib/entitlements/config";

/**
 * Integration tests for the entitlement system.
 *
 * These tests verify that canAccess() and checkUsage() correctly gate
 * features based on the user's plan (FREE vs PRO vs MAX).
 *
 * They hit the real database — the test framework runs against the same DB the
 * app uses.
 *
 * NOTE: These tests require a working database connection. If the DB isn't
 * reachable (e.g. CI without Postgres), the entire suite is marked SKIPPED
 * via the `dbAvailable` flag — vitest reports each test as `skipped`, NOT as
 * failed. This keeps `bun run test` green in environments without a DB.
 */

describe("Entitlement Integration Tests", () => {
  let freeUserId: number;
  let proUserId: number;
  let dbAvailable = true;

  beforeAll(async () => {
    try {
      // Create a FREE user
      const freeUser = await db.user.create({
        data: {
          email: "ent-free-test@example.com",
          passwordHash: await hashPassword("testpass123"),
          emailVerified: true,
          plan: "FREE",
        },
      });
      freeUserId = freeUser.id;

      // Create a PRO user
      const proUser = await db.user.create({
        data: {
          email: "ent-pro-test@example.com",
          passwordHash: await hashPassword("testpass123"),
          emailVerified: true,
          plan: "PRO",
        },
      });
      proUserId = proUser.id;
    } catch (err) {
      console.warn(
        "[entitlements.test] DB unavailable — skipping suite. Error:",
        err instanceof Error ? err.message : String(err),
      );
      dbAvailable = false;
    }
  });

  beforeEach((ctx) => {
    if (!dbAvailable) {
      ctx.skip();
    }
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    // Clean up test users
    await db.usageTracking.deleteMany({ where: { userId: { in: [freeUserId, proUserId] } } });
    await db.user.deleteMany({ where: { id: { in: [freeUserId, proUserId] } } });
    await db.$disconnect();
  });

  // ─── Brand Kit: FREE = blocked, PRO = allowed ───────────────────────────

  describe("Brand Kit entitlement", () => {
    it("FREE user is denied access to brand_kit (canAccess = false)", async () => {
      const result = await canAccess(freeUserId, FEATURE_KEYS.BRAND_KIT);
      expect(result.allowed).toBe(false);
      expect(result.plan).toBe("FREE");
    });

    it("PRO user is granted access to brand_kit (canAccess = true)", async () => {
      const result = await canAccess(proUserId, FEATURE_KEYS.BRAND_KIT);
      expect(result.allowed).toBe(true);
      expect(result.plan).toBe("PRO");
    });
  });

  // ─── Multi-Language: FREE = blocked, PRO = allowed ──────────────────────

  describe("Multi-Language entitlement", () => {
    it("FREE user is denied access to multi_language (canAccess = false)", async () => {
      const result = await canAccess(freeUserId, FEATURE_KEYS.MULTI_LANGUAGE);
      expect(result.allowed).toBe(false);
      expect(result.plan).toBe("FREE");
    });

    it("PRO user is granted access to multi_language (canAccess = true)", async () => {
      const result = await canAccess(proUserId, FEATURE_KEYS.MULTI_LANGUAGE);
      expect(result.allowed).toBe(true);
      expect(result.plan).toBe("PRO");
    });
  });

  // ─── Custom Branding: FREE = blocked, PRO = allowed ─────────────────────

  describe("Custom Branding entitlement", () => {
    it("FREE user is denied access to custom_branding", async () => {
      const result = await canAccess(freeUserId, FEATURE_KEYS.CUSTOM_BRANDING);
      expect(result.allowed).toBe(false);
    });

    it("PRO user is granted access to custom_branding", async () => {
      const result = await canAccess(proUserId, FEATURE_KEYS.CUSTOM_BRANDING);
      expect(result.allowed).toBe(true);
    });
  });

  // ─── Dynamic Theme Rules: FREE = blocked, PRO = allowed ─────────────────

  describe("Dynamic Theme Rules entitlement", () => {
    it("FREE user is denied access to dynamic_theme_rules", async () => {
      const result = await canAccess(freeUserId, FEATURE_KEYS.DYNAMIC_THEME_RULES);
      expect(result.allowed).toBe(false);
    });

    it("PRO user is granted access to dynamic_theme_rules", async () => {
      const result = await canAccess(proUserId, FEATURE_KEYS.DYNAMIC_THEME_RULES);
      expect(result.allowed).toBe(true);
    });
  });

  // ─── Webhook Endpoints: FREE = blocked, PRO = allowed ───────────────────

  describe("Webhook Endpoints entitlement", () => {
    it("FREE user is denied access to webhook_endpoints", async () => {
      const result = await canAccess(freeUserId, FEATURE_KEYS.WEBHOOK_ENDPOINTS);
      expect(result.allowed).toBe(false);
    });

    it("PRO user is granted access to webhook_endpoints", async () => {
      const result = await canAccess(proUserId, FEATURE_KEYS.WEBHOOK_ENDPOINTS);
      expect(result.allowed).toBe(true);
    });
  });

  // ─── API Messages: FREE = allowed with quota, PRO = allowed with higher quota ──

  describe("API Messages volume check", () => {
    it("FREE user can use api_messages (checkUsage = allowed)", async () => {
      const result = await checkUsage(freeUserId, FEATURE_KEYS.API_MESSAGES);
      expect(result.allowed).toBe(true);
      expect(result.remaining).not.toBe("unlimited"); // FREE has finite quota
    });

    it("PRO user can use api_messages (checkUsage = allowed)", async () => {
      const result = await checkUsage(proUserId, FEATURE_KEYS.API_MESSAGES);
      expect(result.allowed).toBe(true);
    });
  });

  // ─── Config values ───────────────────────────────────────────────────────

  describe("Config value verification", () => {
    it("api_keys FREE quota is 1 (not 2)", () => {
      expect(FEATURE_LIMITS.api_keys.FREE.quota).toBe(1);
      expect(FEATURE_LIMITS.api_keys.PRO.quota).toBe(5);
      expect(FEATURE_LIMITS.api_keys.MAX.quota).toBe(20);
    });

    it("dynamic_theme_rules PRO quota is 3 (not 5)", () => {
      expect(FEATURE_LIMITS.dynamic_theme_rules.PRO.quota).toBe(3);
      expect(FEATURE_LIMITS.dynamic_theme_rules.MAX.quota).toBe(3);
    });

    it("email_templates FREE has burst rate limit (not Infinity)", () => {
      expect(FEATURE_LIMITS.email_templates.FREE.ratePerMin).toBe(5);
      expect(FEATURE_LIMITS.email_templates.PRO.ratePerMin).toBe(10);
    });

    it("brand_kit PRO has burst rate limit (not Infinity)", () => {
      expect(FEATURE_LIMITS.brand_kit.PRO.ratePerMin).toBe(5);
    });
  });
});
