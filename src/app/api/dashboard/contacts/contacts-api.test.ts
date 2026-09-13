import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Dashboard Contacts API route tests.
 *
 * These tests mock the Contacts service layer and auth helpers to verify
 * route-level behavior WITHOUT a database. They run in the generic CI job.
 *
 * Coverage:
 * - unauthenticated → 401
 * - no CONTACTS entitlement → 403
 * - GET list passes userId to service
 * - POST forces source=dashboard, doesn't accept source from client
 * - POST returns 201 for created, 200 for existing
 * - GET detail returns 404 when service returns null
 * - PATCH only passes name/attributes
 * - PATCH returns 404 when service returns null
 * - DELETE returns 404 when service returns false
 * - mass-assignment protection: userId, source, marketingStatus etc. rejected
 */

// Mock the service module
vi.mock("@/lib/contacts", () => ({
  upsertContact: vi.fn(),
  listContacts: vi.fn(),
  getContactById: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  getContactTimeline: vi.fn(),
  ContactValidationError: class ContactValidationError extends Error {
    constructor(msg: string) { super(msg); this.name = "ContactValidationError"; }
  },
  CONTACT_SOURCES: { API: "api", DASHBOARD: "dashboard", OTP_VERIFIED: "otp_verified", IMPORT: "import" },
  MAX_NAME_LENGTH: 200,
  isValidEmail: vi.fn(() => true),
  normalizeEmail: vi.fn((e: string) => e.trim().toLowerCase()),
}));

// Mock the auth module
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn(),
}));

// Mock the entitlement engine
vi.mock("@/lib/entitlements/engine", () => ({
  canAccess: vi.fn(),
  peekUsage: vi.fn(),
  checkUsage: vi.fn(),
}));

// Mock the entitlement config
vi.mock("@/lib/entitlements/config", () => ({
  FEATURE_KEYS: { CONTACTS: "contacts", OTP_EMAILS: "otp_emails", API_MESSAGES: "api_messages", MESSAGING_EMAILS: "messaging_emails" },
}));

import { GET as listGET, POST as listPOST } from "@/app/api/dashboard/contacts/route";
import { GET as detailGET, PATCH as detailPATCH, DELETE as detailDELETE } from "@/app/api/dashboard/contacts/[id]/route";

const { getAuthenticatedUser } = await import("@/lib/auth/session");
const { canAccess } = await import("@/lib/entitlements/engine");
const {
  upsertContact, listContacts, getContactById, updateContact, deleteContact, getContactTimeline,
} = await import("@/lib/contacts");

function mockReq(url: string, opts?: { method?: string; body?: unknown }) {
  const method = opts?.method ?? "GET";
  const body = opts?.body ? JSON.stringify(opts.body) : undefined;
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body,
  });
}

function mockUser(id: number) {
  return { id, email: `user${id}@test.com`, plan: "PRO" } as any;
}

function mockParams(id: string) {
  return Promise.resolve({ id });
}

describe("Dashboard Contacts API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Authentication ----

  it("unauthenticated GET → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await listGET(mockReq("/api/dashboard/contacts"));
    expect(res.status).toBe(401);
  });

  it("unauthenticated POST → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await listPOST(mockReq("/api/dashboard/contacts", { method: "POST", body: { email: "a@b.com" } }));
    expect(res.status).toBe(401);
  });

  // ---- Entitlement ----

  it("no CONTACTS entitlement → 403", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" });
    const res = await listGET(mockReq("/api/dashboard/contacts"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("feature_not_available");
  });

  // ---- GET list ----

  it("GET list passes userId to listContacts", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(42));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(listContacts).mockResolvedValue({ contacts: [], total: 0, page: 1, pageSize: 20 });

    await listGET(mockReq("/api/dashboard/contacts?page=1&pageSize=20"));

    expect(listContacts).toHaveBeenCalledWith(42, expect.objectContaining({ page: 1, pageSize: 20 }));
  });

  it("GET list with search passes search to service", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(listContacts).mockResolvedValue({ contacts: [], total: 0, page: 1, pageSize: 20 });

    await listGET(mockReq("/api/dashboard/contacts?search=alice"));

    expect(listContacts).toHaveBeenCalledWith(1, expect.objectContaining({ search: "alice" }));
  });

  // ---- POST create ----

  it("POST forces source=dashboard, not from client", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(10));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(upsertContact).mockResolvedValue({
      contact: { id: 1, userId: 10, email: "a@b.com", name: null, attributes: {}, source: "dashboard", marketingStatus: "unknown", marketingConsentSource: null, marketingConsentAt: null, createdAt: new Date(), updatedAt: new Date() },
      created: true,
      changed: true,
    });

    await listPOST(mockReq("/api/dashboard/contacts", {
      method: "POST",
      body: { email: "a@b.com", source: "api", marketingStatus: "subscribed" },
    }));

    // source should be "dashboard" regardless of what client sent
    expect(upsertContact).toHaveBeenCalledWith(10, expect.objectContaining({
      source: "dashboard",
    }));
    // client-sent source should NOT be passed
    const call = vi.mocked(upsertContact).mock.calls[0];
    expect(call[1].source).toBe("dashboard");
  });

  it("POST returns 201 for new contact", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(upsertContact).mockResolvedValue({
      contact: { id: 5, userId: 1, email: "new@test.com", name: null, attributes: {}, source: "dashboard", marketingStatus: "unknown", marketingConsentSource: null, marketingConsentAt: null, createdAt: new Date(), updatedAt: new Date() },
      created: true,
      changed: true,
    });

    const res = await listPOST(mockReq("/api/dashboard/contacts", {
      method: "POST",
      body: { email: "new@test.com" },
    }));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe(5);
    expect(data.created).toBe(true);
  });

  it("POST returns 200 for existing contact upsert", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(upsertContact).mockResolvedValue({
      contact: { id: 5, userId: 1, email: "existing@test.com", name: "Bob", attributes: {}, source: "dashboard", marketingStatus: "unknown", marketingConsentSource: null, marketingConsentAt: null, createdAt: new Date(), updatedAt: new Date() },
      created: false,
      changed: true,
    });

    const res = await listPOST(mockReq("/api/dashboard/contacts", {
      method: "POST",
      body: { email: "existing@test.com", name: "Bob" },
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.created).toBe(false);
  });

  it("POST does not accept userId from client", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(7));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(upsertContact).mockResolvedValue({
      contact: { id: 1, userId: 7, email: "a@b.com", name: null, attributes: {}, source: "dashboard", marketingStatus: "unknown", marketingConsentSource: null, marketingConsentAt: null, createdAt: new Date(), updatedAt: new Date() },
      created: true,
      changed: true,
    });

    await listPOST(mockReq("/api/dashboard/contacts", {
      method: "POST",
      body: { email: "a@b.com", userId: 999 },
    }));

    // The route should use user.id (7), not 999
    expect(upsertContact).toHaveBeenCalledWith(7, expect.anything());
    expect(upsertContact).not.toHaveBeenCalledWith(999, expect.anything());
  });

  // ---- GET detail ----

  it("GET detail returns 404 when service returns null", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(getContactById).mockResolvedValue(null);

    const res = await detailGET(mockReq("/api/dashboard/contacts/999"), { params: mockParams("999") });

    expect(res.status).toBe(404);
  });

  it("GET detail uses authenticated userId", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(33));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(getContactById).mockResolvedValue(null);
    vi.mocked(getContactTimeline).mockResolvedValue({ events: [], total: 0 });

    await detailGET(mockReq("/api/dashboard/contacts/1"), { params: mockParams("1") });

    expect(getContactById).toHaveBeenCalledWith(33, 1);
  });

  // ---- PATCH ----

  it("PATCH only passes name and attributes (mass-assignment protection)", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(updateContact).mockResolvedValue({
      id: 1, userId: 1, email: "a@b.com", name: "New Name", attributes: {}, source: "dashboard",
      marketingStatus: "unknown", marketingConsentSource: null, marketingConsentAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    });

    await detailPATCH(
      mockReq("/api/dashboard/contacts/1", {
        method: "PATCH",
        body: { name: "New Name", userId: 999, source: "api", marketingStatus: "subscribed", marketingConsentSource: "hack", marketingConsentAt: "2026-01-01" },
      }),
      { params: mockParams("1") }
    );

    // Only name should be passed, not the forbidden fields
    expect(updateContact).toHaveBeenCalledWith(1, 1, expect.objectContaining({
      name: "New Name",
    }));
    const call = vi.mocked(updateContact).mock.calls[0];
    const updateInput = call[2];
    expect(updateInput).not.toHaveProperty("userId");
    expect(updateInput).not.toHaveProperty("source");
    expect(updateInput).not.toHaveProperty("marketingStatus");
    expect(updateInput).not.toHaveProperty("marketingConsentSource");
    expect(updateInput).not.toHaveProperty("marketingConsentAt");
  });

  it("PATCH returns 404 when service returns null", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(updateContact).mockResolvedValue(null);

    const res = await detailPATCH(
      mockReq("/api/dashboard/contacts/999", { method: "PATCH", body: { name: "Test" } }),
      { params: mockParams("999") }
    );

    expect(res.status).toBe(404);
  });

  it("PATCH passes empty name (allows clearing)", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(updateContact).mockResolvedValue({
      id: 1, userId: 1, email: "a@b.com", name: null, attributes: {}, source: "dashboard",
      marketingStatus: "unknown", marketingConsentSource: null, marketingConsentAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    });

    await detailPATCH(
      mockReq("/api/dashboard/contacts/1", { method: "PATCH", body: { name: "" } }),
      { params: mockParams("1") }
    );

    // Empty string should be passed (not filtered to undefined)
    expect(updateContact).toHaveBeenCalledWith(1, 1, expect.objectContaining({
      name: "",
    }));
  });

  // ---- DELETE ----

  it("DELETE returns 404 when service returns false", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(deleteContact).mockResolvedValue(false);

    const res = await detailDELETE(mockReq("/api/dashboard/contacts/999", { method: "DELETE" }), { params: mockParams("999") });

    expect(res.status).toBe(404);
  });

  it("DELETE uses authenticated userId", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(42));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(deleteContact).mockResolvedValue(true);

    await detailDELETE(mockReq("/api/dashboard/contacts/5", { method: "DELETE" }), { params: mockParams("5") });

    expect(deleteContact).toHaveBeenCalledWith(42, 5);
  });

  it("DELETE returns success when service returns true", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(1));
    vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
    vi.mocked(deleteContact).mockResolvedValue(true);

    const res = await detailDELETE(mockReq("/api/dashboard/contacts/1", { method: "DELETE" }), { params: mockParams("1") });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(true);
  });
});
