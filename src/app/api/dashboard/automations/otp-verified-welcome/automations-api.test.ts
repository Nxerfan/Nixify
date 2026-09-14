import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Dashboard Automations API route tests (Phase 5).
 *
 * GET/PUT /api/dashboard/automations/otp-verified-welcome
 *
 * These tests mock the automation service layer + auth + entitlements to verify
 * route-level behavior WITHOUT a database. They run in the generic CI job
 * (no TEST_DATABASE_URL required).
 *
 * Mock strategy mirrors src/app/api/dashboard/templates/templates-api.test.ts:
 *   vi.mock("@/lib/automation", async (importOriginal) => {
 *     const real = await importOriginal();
 *     return { ...real, getAutomationSetting: vi.fn(), upsertAutomationSetting: vi.fn() };
 *   })
 * This preserves the REAL zod schema (upsertSchema, defined inline in route.ts),
 * the REAL AutomationConfigError class, and the REAL AUTOMATION_TYPE_OTP_VERIFIED_WELCOME
 * constant so the route's safeParse + instanceof checks execute against production
 * code paths. Only the persistence functions are stubbed as controllable mocks.
 *
 * Coverage:
 * - unauthenticated GET → 401
 * - unauthenticated PUT → 401
 * - no AUTOMATIONS entitlement → 403 feature_not_available (GET + PUT)
 * - GET returns config (enabled:true, templateId:5) → 200 with correct shape
 * - GET when no setting exists → returns defaults (enabled:false, template_id:null,
 *   compatible:null)
 * - PUT with valid body {enabled:true, templateId:5} → calls upsertAutomationSetting
 *   with correct args, returns 200
 * - PUT with invalid body (missing enabled) → 400 validation_failed
 * - PUT with cross-tenant template (upsertAutomationSetting throws
 *   AutomationConfigError("template_not_found")) → 400 template_not_found
 * - PUT passes authenticated user.id (NOT from body) — mass-assignment protection
 */

// ---- Mocks (must come BEFORE the route import) ----------------------------

// Preserve the REAL AutomationConfigError + AUTOMATION_TYPE_OTP_VERIFIED_WELCOME +
// BUILT_IN_VARIABLES; stub only the persistence functions.
vi.mock("@/lib/automation", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/automation")>();
  return {
    ...real,
    getAutomationSetting: vi.fn(),
    upsertAutomationSetting: vi.fn(),
  };
});

// Mock the auth module.
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn(),
}));

// Mock the entitlement engine — canAccess is the non-consuming gate.
vi.mock("@/lib/entitlements/engine", () => ({
  canAccess: vi.fn(),
  peekUsage: vi.fn(),
  checkUsage: vi.fn(),
}));

// Mock FEATURE_KEYS — include AUTOMATIONS so the route's lookup matches.
vi.mock("@/lib/entitlements/config", () => ({
  FEATURE_KEYS: {
    CONTACTS: "contacts",
    OTP_EMAILS: "otp_emails",
    API_MESSAGES: "api_messages",
    MESSAGING_EMAILS: "messaging_emails",
    EMAIL_TEMPLATES: "email_templates",
    AUTOMATIONS: "automations",
  },
}));

import { GET, PUT } from "@/app/api/dashboard/automations/otp-verified-welcome/route";

const { getAuthenticatedUser } = await import("@/lib/auth/session");
const { canAccess } = await import("@/lib/entitlements/engine");
const {
  getAutomationSetting,
  upsertAutomationSetting,
  AutomationConfigError,
  AUTOMATION_TYPE_OTP_VERIFIED_WELCOME,
} = await import("@/lib/automation");

// ---- helpers --------------------------------------------------------------

function mockReq(opts: { method?: "GET" | "PUT"; body?: unknown } = {}) {
  const method = opts.method ?? "GET";
  const body = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
  return new NextRequest(
    "http://localhost/api/dashboard/automations/otp-verified-welcome",
    {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body,
    },
  );
}

function mockUser(id: number) {
  return { id, email: `user${id}@test.com`, plan: "PRO" } as any;
}

function mockSettingRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    userId: 42,
    type: AUTOMATION_TYPE_OTP_VERIFIED_WELCOME,
    enabled: true,
    templateId: 5,
    templateVariables: ["email"],
    compatible: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-09-16T00:00:00Z"),
    ...overrides,
  };
}

/** Set up the "everything passes" default mocks for GET + PUT. */
function setupHappyPath() {
  vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(42));
  vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" } as any);
  vi.mocked(getAutomationSetting).mockResolvedValue(mockSettingRow() as any);
  vi.mocked(upsertAutomationSetting).mockResolvedValue(mockSettingRow() as any);
}

// ---- tests -----------------------------------------------------------------

describe("Dashboard Automations API — otp-verified-welcome (Phase 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Authentication (401) ----------------------------------------------

  it("unauthenticated GET → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe("unauthorized");
  });

  it("unauthenticated PUT → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await PUT(mockReq({ method: "PUT", body: { enabled: true } }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe("unauthorized");
  });

  // ---- Entitlement gate (403) --------------------------------------------

  it("no AUTOMATIONS entitlement → GET 403 feature_not_available", async () => {
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" } as any);
    const res = await GET();
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("feature_not_available");
    // Service must NOT be called when the gate denies access.
    expect(getAutomationSetting).not.toHaveBeenCalled();
  });

  it("no AUTOMATIONS entitlement → PUT 403 feature_not_available", async () => {
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" } as any);
    const res = await PUT(mockReq({ method: "PUT", body: { enabled: true } }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("feature_not_available");
    expect(upsertAutomationSetting).not.toHaveBeenCalled();
  });

  // ---- GET returns config -------------------------------------------------

  it("GET returns config → 200 with correct shape", async () => {
    vi.mocked(getAutomationSetting).mockResolvedValue(mockSettingRow({
      enabled: true,
      templateId: 5,
      templateVariables: ["email"],
      compatible: true,
    }) as any);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.type).toBe(AUTOMATION_TYPE_OTP_VERIFIED_WELCOME);
    expect(data.enabled).toBe(true);
    expect(data.template_id).toBe(5);
    expect(data.template_variables).toEqual(["email"]);
    expect(data.compatible).toBe(true);
    expect(data.built_in_variables).toEqual(["email", "name"]);
    expect(data.updated_at).toBe("2026-09-16T00:00:00.000Z");
  });

  it("GET when no setting exists → returns defaults", async () => {
    // Service returns null — the route applies defaults.
    vi.mocked(getAutomationSetting).mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.type).toBe(AUTOMATION_TYPE_OTP_VERIFIED_WELCOME);
    expect(data.enabled).toBe(false);
    expect(data.template_id).toBeNull();
    expect(data.template_variables).toBeNull();
    expect(data.compatible).toBeNull();
    expect(data.built_in_variables).toEqual(["email", "name"]);
    expect(data.updated_at).toBeNull();
  });

  it("GET passes authenticated user.id to getAutomationSetting", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(33));
    await GET();
    expect(getAutomationSetting).toHaveBeenCalledWith(
      33,
      AUTOMATION_TYPE_OTP_VERIFIED_WELCOME,
    );
  });

  // ---- PUT valid body -----------------------------------------------------

  it("PUT with valid body {enabled:true, templateId:5} → 200, calls upsert with correct args", async () => {
    const res = await PUT(mockReq({
      method: "PUT",
      body: { enabled: true, templateId: 5 },
    }));
    expect(res.status).toBe(200);

    // upsertAutomationSetting(user.id, {enabled, templateId}, type)
    expect(upsertAutomationSetting).toHaveBeenCalledWith(
      42,
      { enabled: true, templateId: 5 },
      AUTOMATION_TYPE_OTP_VERIFIED_WELCOME,
    );

    const data = await res.json();
    expect(data.type).toBe(AUTOMATION_TYPE_OTP_VERIFIED_WELCOME);
    expect(data.enabled).toBe(true);
    expect(data.template_id).toBe(5);
    expect(data.built_in_variables).toEqual(["email", "name"]);
  });

  it("PUT with valid body {enabled:false} (no templateId) → 200, passes templateId:null", async () => {
    vi.mocked(upsertAutomationSetting).mockResolvedValue(mockSettingRow({
      enabled: false, templateId: null,
    }) as any);

    const res = await PUT(mockReq({
      method: "PUT",
      body: { enabled: false },
    }));
    expect(res.status).toBe(200);

    // The route must convert "missing templateId" to null, not undefined.
    expect(upsertAutomationSetting).toHaveBeenCalledWith(
      42,
      { enabled: false, templateId: null },
      AUTOMATION_TYPE_OTP_VERIFIED_WELCOME,
    );
  });

  // ---- PUT validation failures (400) --------------------------------------

  it("PUT with invalid body (missing enabled) → 400 validation_failed", async () => {
    // Real zod schema runs (upsertSchema requires `enabled: boolean`).
    const res = await PUT(mockReq({
      method: "PUT",
      body: { templateId: 5 }, // missing enabled
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    // Service must NOT be called when validation fails.
    expect(upsertAutomationSetting).not.toHaveBeenCalled();
  });

  it("PUT with invalid body (enabled is string, not boolean) → 400 validation_failed", async () => {
    const res = await PUT(mockReq({
      method: "PUT",
      body: { enabled: "true" }, // wrong type
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    expect(upsertAutomationSetting).not.toHaveBeenCalled();
  });

  it("PUT with templateId=0 → 400 validation_failed (zod positive())", async () => {
    const res = await PUT(mockReq({
      method: "PUT",
      body: { enabled: true, templateId: 0 },
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    expect(upsertAutomationSetting).not.toHaveBeenCalled();
  });

  it("PUT with templateId negative → 400 validation_failed", async () => {
    const res = await PUT(mockReq({
      method: "PUT",
      body: { enabled: true, templateId: -1 },
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    expect(upsertAutomationSetting).not.toHaveBeenCalled();
  });

  // ---- PUT cross-tenant template rejection (400) -------------------------

  it("PUT with cross-tenant template → 400 template_not_found", async () => {
    // Service detects the template doesn't belong to this user + throws
    // AutomationConfigError("template_not_found", ...). The route must catch
    // it via instanceof and return a 400 with the safe code.
    vi.mocked(upsertAutomationSetting).mockRejectedValue(
      new AutomationConfigError(
        "template_not_found",
        "Template not found or not owned by your account.",
      ),
    );

    const res = await PUT(mockReq({
      method: "PUT",
      body: { enabled: true, templateId: 999 },
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("template_not_found");
    expect(data.error.message).toMatch(/template/i);
  });

  it("PUT with cross-tenant template → 400 does NOT leak the error class name", async () => {
    vi.mocked(upsertAutomationSetting).mockRejectedValue(
      new AutomationConfigError("template_not_found", "Template not found."),
    );
    const res = await PUT(mockReq({
      method: "PUT",
      body: { enabled: true, templateId: 999 },
    }));
    const data = await res.json();
    // The response body must not leak the raw Error stack or class name.
    const body = JSON.stringify(data);
    expect(body).not.toMatch(/AutomationConfigError/);
    expect(body).not.toMatch(/at /); // no stack frames
  });

  // ---- Mass-assignment protection ----------------------------------------

  it("PUT passes authenticated user.id (NOT from body) — mass-assignment protection", async () => {
    // The body schema does NOT include userId. Even if the client sends one,
    // zod strips it. The route must always use the session user.id.
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(42));

    await PUT(mockReq({
      method: "PUT",
      body: { enabled: true, templateId: 5, userId: 999 }, // userId from client
    }));

    // upsertAutomationSetting must be called with 42 (session user.id), never 999.
    expect(upsertAutomationSetting).toHaveBeenCalledWith(
      42,
      expect.anything(),
      AUTOMATION_TYPE_OTP_VERIFIED_WELCOME,
    );
    const call = vi.mocked(upsertAutomationSetting).mock.calls[0];
    expect(call[0]).toBe(42);
    expect(call[0]).not.toBe(999);
    // The input object must NOT carry userId either.
    expect(call[1]).not.toHaveProperty("userId");
  });
});
