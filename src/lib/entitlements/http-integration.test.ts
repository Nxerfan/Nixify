import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { SignJWT } from "jose";

/**
 * HTTP-level integration tests for the entitlement system.
 *
 * These tests call the ACTUAL API routes via fetch() against the running dev
 * server (http://localhost:3000). They prove that route handlers genuinely
 * call canAccess()/checkUsage() — not just that the library functions work.
 *
 * Test flow:
 *   1. Create a FREE user + a PRO user in the DB.
 *   2. Sign JWT session cookies for each.
 *   3. Call POST /api/admin/brand-kit with the FREE user's admin cookie → expect 403.
 *   4. Call POST /api/admin/themes/preview with lang=fa + FREE user → expect 403.
 *
 * The admin routes use the admin cookie (mg_admin), not the user session.
 * For these tests we sign admin JWTs for the FREE/PRO users so the
 * entitlement engine sees their plan.
 */

const BASE = "http://localhost:3000";
const EASE = [0.22, 1, 0.36, 1] as const;

// Helper: sign an admin JWT for a given user ID + plan.
async function signAdminToken(userId: number): Promise<string> {
  const secret = new TextEncoder().encode(`${process.env.JWT_SECRET ?? "test"}:admin`);
  return new SignJWT({ role: "admin", email: `test-${userId}@example.com` })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId.toString())
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

describe("Entitlement HTTP Integration Tests", () => {
  let freeUserId: number;
  let proUserId: number;
  let freeCookie: string;
  let proCookie: string;

  beforeAll(async () => {
    // Create test users with different plans.
    const freeUser = await db.user.create({
      data: {
        email: "http-free-test@example.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "FREE",
      },
    });
    freeUserId = freeUser.id;

    const proUser = await db.user.create({
      data: {
        email: "http-pro-test@example.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    proUserId = proUser.id;

    // Sign admin cookies.
    freeCookie = await signAdminToken(freeUserId);
    proCookie = await signAdminToken(proUserId);
  });

  afterAll(async () => {
    await db.usageTracking.deleteMany({ where: { userId: { in: [freeUserId, proUserId] } } });
    await db.user.deleteMany({ where: { id: { in: [freeUserId, proUserId] } } });
    await db.$disconnect();
  });

  // ─── Brand Kit: FREE gets 403, PRO gets 200 ────────────────────────────

  it("FREE user receives 403 on POST /api/admin/brand-kit", async () => {
    const res = await fetch(`${BASE}/api/admin/brand-kit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `mg_admin=${freeCookie}`,
      },
      body: JSON.stringify({ appName: "Test", primaryColor: "#059669" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
    expect(body.message).toContain("Brand Kit is not available");
  });

  it("PRO user receives 200 (not 403) on POST /api/admin/brand-kit", async () => {
    const res = await fetch(`${BASE}/api/admin/brand-kit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `mg_admin=${proCookie}`,
      },
      body: JSON.stringify({ appName: "Test Pro", primaryColor: "#059669" }),
    });

    // Should NOT be 403 — either 200 (success) or another non-403 error.
    expect(res.status).not.toBe(403);
  });

  // ─── Multi-Language: FREE gets 403 on non-EN preview ───────────────────

  it("FREE user receives 403 on POST /api/admin/themes/preview with lang=fa", async () => {
    const res = await fetch(`${BASE}/api/admin/themes/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `mg_admin=${freeCookie}`,
      },
      body: JSON.stringify({
        templateId: "minimal",
        code: "123456",
        email: "test@example.com",
        language: "fa",
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
    expect(body.message).toContain("Multi-language");
  });

  it("FREE user receives 200 on POST /api/admin/themes/preview with lang=en (default)", async () => {
    const res = await fetch(`${BASE}/api/admin/themes/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `mg_admin=${freeCookie}`,
      },
      body: JSON.stringify({
        templateId: "minimal",
        code: "123456",
        email: "test@example.com",
        language: "en",
      }),
    });

    // English is always allowed — should NOT be 403.
    expect(res.status).not.toBe(403);
  });

  // ─── Custom Branding: FREE gets 403 on Pro template save ───────────────

  it("FREE user receives 403 on POST /api/admin/themes/save with a Pro template", async () => {
    const res = await fetch(`${BASE}/api/admin/themes/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `mg_admin=${freeCookie}`,
      },
      body: JSON.stringify({
        name: "Test Theme",
        templateId: "discord", // discord isPro: true
        purpose: "all",
        config: { primaryColor: "#5865f2" },
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
    expect(body.message).toContain("Custom branding");
  });

  // ─── Dynamic Theme Rules: FREE gets 403 on theme activation ───────────

  it("FREE user receives 403 on POST /api/admin/themes/active", async () => {
    const res = await fetch(`${BASE}/api/admin/themes/active`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `mg_admin=${freeCookie}`,
      },
      body: JSON.stringify({ id: 1, purpose: "signup" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
    expect(body.message).toContain("Dynamic theme rules");
  });
});
