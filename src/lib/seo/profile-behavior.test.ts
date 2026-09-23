/**
 * Phase 17 FINAL — Profile runtime behavior tests.
 *
 * These tests prove the profile APIs NO LONGER produce trial state. They test
 * the REAL route handler source code by importing it and verifying the response
 * shape — not just scanning strings.
 *
 * The tests mock the DB + auth layer so they run without a database.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mock state (hoisted) ──────────────────────────────────────────────────
const mockState = vi.hoisted(() => ({
  user: null as null | {
    id: number;
    email: string;
    emailVerified: boolean;
    fullName: string | null;
    phoneNumber: string | null;
    profileCompleted: boolean;
    plan: string;
    trialStartedAt: Date | null;
    trialExpiresAt: Date | null;
  },
  updatedUser: null as null | Record<string, unknown>,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn(async () => mockState.user),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      update: vi.fn(async () => mockState.updatedUser ?? mockState.user),
    },
  },
}));

vi.mock("@/lib/http", () => ({
  parseBody: vi.fn(async (req: unknown, schema: unknown) => {
    // Simulate parsing the body — return valid data
    return [{ fullName: "Test User", phoneNumber: "+1234567890" }, null];
  }),
}));

vi.mock("@/lib/validation", () => ({
  profileCompleteSchema: {},
}));

vi.mock("@/lib/api-response", () => ({
  apiOk: vi.fn((data: unknown) => Response.json(data, { status: 200 })),
  apiError: vi.fn((code: string, message: string, status: number) =>
    Response.json({ error: { code, message } }, { status }),
  ),
  ERROR_CODES: { UNAUTHORIZED: "unauthorized" },
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Phase 17 FINAL — profile/complete has NO trial runtime", () => {
  beforeEach(() => {
    mockState.user = {
      id: 1,
      email: "test@example.com",
      emailVerified: true,
      fullName: null,
      phoneNumber: null,
      profileCompleted: false,
      plan: "FREE",
      trialStartedAt: null,
      trialExpiresAt: null,
    };
    mockState.updatedUser = {
      id: 1,
      email: "test@example.com",
      emailVerified: true,
      fullName: "Test User",
      phoneNumber: "+1234567890",
      profileCompleted: true,
      plan: "FREE",
    };
    vi.clearAllMocks();
  });

  it("POST /api/profile/complete returns 200 for authenticated user", async () => {
    const mod = await import("@/app/api/profile/complete/route");
    const res = await mod.POST(new Request("http://localhost/api/profile/complete", {
      method: "POST",
      body: JSON.stringify({ fullName: "Test User", phoneNumber: "+1234567890" }),
    }));
    expect(res.status).toBe(200);
  });

  it("response does NOT contain trial.active", async () => {
    const mod = await import("@/app/api/profile/complete/route");
    const res = await mod.POST(new Request("http://localhost/api/profile/complete", {
      method: "POST",
      body: JSON.stringify({ fullName: "Test User", phoneNumber: "+1234567890" }),
    }));
    const body = await res.json();
    expect(body.trial).toBeUndefined();
    expect(body.trial?.active).toBeUndefined();
  });

  it("response does NOT contain daysRemaining", async () => {
    const mod = await import("@/app/api/profile/complete/route");
    const res = await mod.POST(new Request("http://localhost/api/profile/complete", {
      method: "POST",
      body: JSON.stringify({ fullName: "Test User", phoneNumber: "+1234567890" }),
    }));
    const body = await res.json();
    expect(body.trial?.daysRemaining).toBeUndefined();
  });

  it("response does NOT contain trialStartedAt or trialExpiresAt in user", async () => {
    const mod = await import("@/app/api/profile/complete/route");
    const res = await mod.POST(new Request("http://localhost/api/profile/complete", {
      method: "POST",
      body: JSON.stringify({ fullName: "Test User", phoneNumber: "+1234567890" }),
    }));
    const body = await res.json();
    expect(body.user?.trialStartedAt).toBeUndefined();
    expect(body.user?.trialExpiresAt).toBeUndefined();
  });

  it("response message does NOT mention 'trial'", async () => {
    const mod = await import("@/app/api/profile/complete/route");
    const res = await mod.POST(new Request("http://localhost/api/profile/complete", {
      method: "POST",
      body: JSON.stringify({ fullName: "Test User", phoneNumber: "+1234567890" }),
    }));
    const body = await res.json();
    expect(body.message?.toLowerCase()).not.toContain("trial");
  });

  it("response includes the user's plan", async () => {
    const mod = await import("@/app/api/profile/complete/route");
    const res = await mod.POST(new Request("http://localhost/api/profile/complete", {
      method: "POST",
      body: JSON.stringify({ fullName: "Test User", phoneNumber: "+1234567890" }),
    }));
    const body = await res.json();
    expect(body.user?.plan).toBe("FREE");
  });
});

describe("Phase 17 FINAL — profile/me has NO trial runtime", () => {
  beforeEach(() => {
    mockState.user = {
      id: 1,
      email: "test@example.com",
      emailVerified: true,
      fullName: "Test User",
      phoneNumber: "+1234567890",
      profileCompleted: true,
      plan: "PRO",
      trialStartedAt: new Date("2026-01-01"), // legacy data — must be inert
      trialExpiresAt: new Date("2026-02-01"), // legacy data — must be inert
    };
    vi.clearAllMocks();
  });

  it("GET /api/profile/me returns 200", async () => {
    const mod = await import("@/app/api/profile/me/route");
    const res = await mod.GET();
    expect(res.status).toBe(200);
  });

  it("response does NOT contain trial state", async () => {
    const mod = await import("@/app/api/profile/me/route");
    const res = await mod.GET();
    const body = await res.json();
    expect(body.trial).toBeUndefined();
  });

  it("response user does NOT contain trialStartedAt", async () => {
    const mod = await import("@/app/api/profile/me/route");
    const res = await mod.GET();
    const body = await res.json();
    expect(body.user?.trialStartedAt).toBeUndefined();
  });

  it("response user does NOT contain trialExpiresAt", async () => {
    const mod = await import("@/app/api/profile/me/route");
    const res = await mod.GET();
    const body = await res.json();
    expect(body.user?.trialExpiresAt).toBeUndefined();
  });

  it("response includes the user's actual plan (not trial-derived)", async () => {
    const mod = await import("@/app/api/profile/me/route");
    const res = await mod.GET();
    const body = await res.json();
    expect(body.user?.plan).toBe("PRO");
  });

  it("legacy trialStartedAt/trialExpiresAt in DB have NO effect on response", async () => {
    // Even though the user has legacy trial timestamps, the API must NOT
    // return them or compute trial state from them.
    const mod = await import("@/app/api/profile/me/route");
    const res = await mod.GET();
    const body = await res.json();
    expect(body.trial).toBeUndefined();
    expect(body.user?.trialStartedAt).toBeUndefined();
    expect(body.user?.trialExpiresAt).toBeUndefined();
  });
});
