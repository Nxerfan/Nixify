import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Dashboard Webhook + Logs route tests (Phase 7).
 *
 * PURE UNIT tests — no DB. All persistence + auth + entitlements + SSRF +
 * webhook-service calls are mocked. Verifies route-level behavior:
 * authentication, tenant isolation, safe secret handling, and that no
 * sensitive fields (secret / signature / payload / Authorization header)
 * leak into responses.
 *
 * Mock strategy mirrors src/app/api/dashboard/contacts/contacts-api.test.ts:
 *   vi.mock("@/lib/db", () => ({ db: { ... } }))
 *   vi.mock("@/lib/auth/session", () => ({ getAuthenticatedUser: vi.fn() }))
 *   vi.mock("@/lib/entitlements/engine", () => ({ canAccess: vi.fn(), ... }))
 *   vi.mock("@/lib/dx/ssrf", () => ({ validateWebhookDestination: vi.fn() }))
 *   vi.mock("@/lib/dx/webhooks", () => ({
 *     generateWebhookSecret: vi.fn(),
 *     scheduleTestDelivery: vi.fn(),
 *     scheduleReplayDelivery: vi.fn(),
 *   }))
 *
 * Coverage (per task spec):
 * - unauthenticated → 401 (all routes)
 * - tenant isolation: user A cannot GET/DELETE/PATCH user B's endpoint → 404
 * - POST create: URL validated (SSRF), secret returned once, entitlement checked
 * - rotate-secret: returns new secret once
 * - test delivery: scheduleTestDelivery called with correct userId
 * - replay: scheduleReplayDelivery called with correct userId
 * - deliveries list: no secret/signature/payload exposed
 * - logs requests: tenant-scoped (userId filter), no Authorization header exposed
 * - logs events: data NOT in list, IS in detail, cross-tenant 404
 * - logs webhooks: no secret/signature exposed
 */

// ---- Mocks (must come BEFORE the route imports) ---------------------------

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/entitlements/engine", () => ({
  canAccess: vi.fn(),
  checkUsage: vi.fn(),
  peekUsage: vi.fn(),
}));

vi.mock("@/lib/entitlements/config", () => ({
  FEATURE_KEYS: {
    CONTACTS: "contacts",
    OTP_EMAILS: "otp_emails",
    API_MESSAGES: "api_messages",
    MESSAGING_EMAILS: "messaging_emails",
    WEBHOOK_ENDPOINTS: "webhook_endpoints",
    WEBHOOK_RETRIES: "webhook_retries",
    EVENTS_API: "events_api",
  },
  // Mirror FEATURE_LIMITS so POST /webhooks capacity check has data to read.
  FEATURE_LIMITS: {
    webhook_endpoints: {
      FREE: { access: false, quota: 0, ratePerMin: Infinity },
      PRO: { access: true, quota: 3, ratePerMin: Infinity },
      MAX: { access: true, quota: 25, ratePerMin: Infinity },
    },
  },
}));

vi.mock("@/lib/dx/ssrf", () => ({
  validateWebhookDestination: vi.fn(),
  SAFE_FETCH_OPTIONS: { redirect: "error", signal: AbortSignal.timeout(10_000) },
}));

vi.mock("@/lib/dx/webhooks", () => ({
  generateWebhookSecret: vi.fn(),
  scheduleTestDelivery: vi.fn(),
  scheduleReplayDelivery: vi.fn(),
}));

// Mock the DB with granular per-table stubs. Each test sets return values.
vi.mock("@/lib/db", () => ({
  db: {
    webhookEndpoint: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    webhookDelivery: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    requestLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    inboundEvent: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// ---- Route imports -------------------------------------------------------

import { GET as listGET, POST as listPOST } from "@/app/api/dashboard/webhooks/route";
import {
  GET as detailGET,
  PATCH as detailPATCH,
  DELETE as detailDELETE,
} from "@/app/api/dashboard/webhooks/[id]/route";
import { POST as rotateSecretPOST } from "@/app/api/dashboard/webhooks/[id]/rotate-secret/route";
import { POST as testPOST } from "@/app/api/dashboard/webhooks/[id]/test/route";
import { GET as deliveriesGET } from "@/app/api/dashboard/webhooks/[id]/deliveries/route";
import { POST as replayPOST } from "@/app/api/dashboard/webhooks/[id]/deliveries/[deliveryId]/replay/route";
import { GET as logsRequestsGET } from "@/app/api/dashboard/logs/requests/route";
import { GET as logsEventsListGET } from "@/app/api/dashboard/logs/events/route";
import { GET as logsEventsDetailGET } from "@/app/api/dashboard/logs/events/[id]/route";
import { GET as logsWebhooksGET } from "@/app/api/dashboard/logs/webhooks/route";

const { getAuthenticatedUser } = await import("@/lib/auth/session");
const { canAccess } = await import("@/lib/entitlements/engine");
const { validateWebhookDestination } = await import("@/lib/dx/ssrf");
const {
  generateWebhookSecret,
  scheduleTestDelivery,
  scheduleReplayDelivery,
} = await import("@/lib/dx/webhooks");
const { db } = await import("@/lib/db");

// ---- helpers -------------------------------------------------------------

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

function mockParams(id: string): Promise<{ id: string }>;
function mockParams(id: string, deliveryId: string): Promise<{ id: string; deliveryId: string }>;
function mockParams(id: string, deliveryId?: string): any {
  return deliveryId !== undefined
    ? Promise.resolve({ id, deliveryId })
    : Promise.resolve({ id });
}

/** Default happy-path: authenticated user, full entitlements, allowed usage. */
function setupHappyPath(userId = 1) {
  vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(userId));
  vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" } as any);
  vi.mocked(validateWebhookDestination).mockResolvedValue({ ok: true });
  vi.mocked(generateWebhookSecret).mockReturnValue("mg_whsec_generated_secret_value");
}

function fakeEndpointRow(id: number, userId: number) {
  return {
    id,
    userId,
    url: `https://hook${id}.example.com/hook`,
    events: "nixify.event.received",
    secret: "mg_whsec_SUPER_SECRET_NEVER_LEAK",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    createdBy: `user:${userId}`,
  };
}

function fakeDeliveryRow(id: number, endpointId: number) {
  return {
    id,
    deliveryId: `d-${id}-uuid`,
    endpointId,
    eventId: "nixify.event.received",
    requestId: "req-1",
    payload: "RAW_PAYLOAD_NEVER_LEAK",
    signature: "t=123,v1=HMAC_SIGNATURE_NEVER_LEAK",
    status: "delivered",
    responseCode: 200,
    attempts: 1,
    lastError: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    deliveredAt: new Date("2026-01-01T00:00:01Z"),
  };
}

// ---- test suite ----------------------------------------------------------

describe("Dashboard Webhooks + Logs API (Phase 7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Authentication (401 on every route) -------------------------------

  it("unauthenticated GET /webhooks → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await listGET(mockReq("/api/dashboard/webhooks"));
    expect(res.status).toBe(401);
  });

  it("unauthenticated POST /webhooks → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await listPOST(mockReq("/api/dashboard/webhooks", {
      method: "POST",
      body: { url: "https://hook.example.com/x", events: ["*"] },
    }));
    expect(res.status).toBe(401);
  });

  it("unauthenticated GET /webhooks/:id → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await detailGET(mockReq("/api/dashboard/webhooks/1"), {
      params: mockParams("1"),
    });
    expect(res.status).toBe(401);
  });

  it("unauthenticated PATCH /webhooks/:id → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await detailPATCH(
      mockReq("/api/dashboard/webhooks/1", { method: "PATCH", body: { events: ["*"] } }),
      { params: mockParams("1") },
    );
    expect(res.status).toBe(401);
  });

  it("unauthenticated DELETE /webhooks/:id → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await detailDELETE(
      mockReq("/api/dashboard/webhooks/1", { method: "DELETE" }),
      { params: mockParams("1") },
    );
    expect(res.status).toBe(401);
  });

  it("unauthenticated POST /webhooks/:id/rotate-secret → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await rotateSecretPOST(
      mockReq("/api/dashboard/webhooks/1/rotate-secret", { method: "POST" }),
      { params: mockParams("1") },
    );
    expect(res.status).toBe(401);
  });

  it("unauthenticated POST /webhooks/:id/test → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await testPOST(
      mockReq("/api/dashboard/webhooks/1/test", { method: "POST" }),
      { params: mockParams("1") },
    );
    expect(res.status).toBe(401);
  });

  it("unauthenticated GET /webhooks/:id/deliveries → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await deliveriesGET(
      mockReq("/api/dashboard/webhooks/1/deliveries"),
      { params: mockParams("1") },
    );
    expect(res.status).toBe(401);
  });

  it("unauthenticated POST /webhooks/:id/deliveries/:deliveryId/replay → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await replayPOST(
      mockReq("/api/dashboard/webhooks/1/deliveries/d-uuid/replay", { method: "POST" }),
      { params: mockParams("1", "d-uuid") },
    );
    expect(res.status).toBe(401);
  });

  it("unauthenticated GET /logs/requests → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await logsRequestsGET(mockReq("/api/dashboard/logs/requests"));
    expect(res.status).toBe(401);
  });

  it("unauthenticated GET /logs/events → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await logsEventsListGET(mockReq("/api/dashboard/logs/events"));
    expect(res.status).toBe(401);
  });

  it("unauthenticated GET /logs/events/:id → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await logsEventsDetailGET(
      mockReq("/api/dashboard/logs/events/evt-1"),
      { params: mockParams("evt-1") },
    );
    expect(res.status).toBe(401);
  });

  it("unauthenticated GET /logs/webhooks → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await logsWebhooksGET(mockReq("/api/dashboard/logs/webhooks"));
    expect(res.status).toBe(401);
  });

  // ---- Tenant isolation: GET detail / PATCH / DELETE --------------------

  it("GET /webhooks/:id for foreign user's endpoint → 404 (no existence leakage)", async () => {
    // User 1 calls; findFirst with userId=1 filter returns null (endpoint
    // belongs to user 2).
    vi.mocked(db.webhookEndpoint.findFirst).mockResolvedValue(null);
    const res = await detailGET(mockReq("/api/dashboard/webhooks/99"), {
      params: mockParams("99"),
    });
    expect(res.status).toBe(404);
    // findFirst must have been called with userId=1 (the session user).
    const call = vi.mocked(db.webhookEndpoint.findFirst).mock.calls[0];
    expect(call?.[0]?.where).toMatchObject({ id: 99, userId: 1 });
  });

  it("PATCH /webhooks/:id for foreign user's endpoint → 404", async () => {
    vi.mocked(db.webhookEndpoint.findFirst).mockResolvedValue(null);
    const res = await detailPATCH(
      mockReq("/api/dashboard/webhooks/99", { method: "PATCH", body: { events: ["*"] } }),
      { params: mockParams("99") },
    );
    expect(res.status).toBe(404);
    // update must NOT have run when findFirst returned null.
    expect(db.webhookEndpoint.update).not.toHaveBeenCalled();
  });

  it("DELETE /webhooks/:id for foreign user's endpoint → 404", async () => {
    vi.mocked(db.webhookEndpoint.findFirst).mockResolvedValue(null);
    const res = await detailDELETE(
      mockReq("/api/dashboard/webhooks/99", { method: "DELETE" }),
      { params: mockParams("99") },
    );
    expect(res.status).toBe(404);
    // delete / update must NOT be called when findFirst returned null.
    expect(db.webhookEndpoint.update).not.toHaveBeenCalled();
    expect(db.webhookEndpoint.delete).not.toHaveBeenCalled();
  });

  it("GET /webhooks/:id/deliveries for foreign user's endpoint → 404", async () => {
    vi.mocked(db.webhookEndpoint.findFirst).mockResolvedValue(null);
    const res = await deliveriesGET(
      mockReq("/api/dashboard/webhooks/99/deliveries"),
      { params: mockParams("99") },
    );
    expect(res.status).toBe(404);
    // deliveries query must NOT have run.
    expect(db.webhookDelivery.findMany).not.toHaveBeenCalled();
  });

  it("POST /webhooks/:id/rotate-secret for foreign user's endpoint → 404", async () => {
    vi.mocked(db.webhookEndpoint.findFirst).mockResolvedValue(null);
    const res = await rotateSecretPOST(
      mockReq("/api/dashboard/webhooks/99/rotate-secret", { method: "POST" }),
      { params: mockParams("99") },
    );
    expect(res.status).toBe(404);
    // update must NOT have run.
    expect(db.webhookEndpoint.update).not.toHaveBeenCalled();
  });

  it("POST /webhooks/:id/test for foreign user's endpoint → 404", async () => {
    // scheduleTestDelivery throws "endpoint_missing" for foreign endpoint.
    vi.mocked(scheduleTestDelivery).mockRejectedValue(new Error("endpoint_missing"));
    const res = await testPOST(
      mockReq("/api/dashboard/webhooks/99/test", { method: "POST" }),
      { params: mockParams("99") },
    );
    expect(res.status).toBe(404);
    // And it was called with the SESSION user's id, not the foreign one.
    const call = vi.mocked(scheduleTestDelivery).mock.calls[0];
    expect(call?.[0]).toBe(99);   // endpointId
    expect(call?.[1]).toBe(1);     // userId — from session
  });

  it("POST /webhooks/:id/deliveries/:deliveryId/replay for foreign delivery → 404", async () => {
    vi.mocked(scheduleReplayDelivery).mockRejectedValue(new Error("endpoint_missing"));
    const res = await replayPOST(
      mockReq("/api/dashboard/webhooks/1/deliveries/d-foreign/replay", { method: "POST" }),
      { params: mockParams("1", "d-foreign") },
    );
    expect(res.status).toBe(404);
    // And it was called with the SESSION user's id.
    const call = vi.mocked(scheduleReplayDelivery).mock.calls[0];
    expect(call?.[0]).toBe("d-foreign");  // deliveryId
    expect(call?.[1]).toBe(1);             // userId — from session
  });

  it("GET /logs/events/:id for foreign user's event → 404", async () => {
    vi.mocked(db.inboundEvent.findFirst).mockResolvedValue(null);
    const res = await logsEventsDetailGET(
      mockReq("/api/dashboard/logs/events/evt-foreign"),
      { params: mockParams("evt-foreign") },
    );
    expect(res.status).toBe(404);
    // findFirst must filter by both eventId AND userId=1.
    const call = vi.mocked(db.inboundEvent.findFirst).mock.calls[0];
    expect(call?.[0]?.where).toMatchObject({ eventId: "evt-foreign", userId: 1 });
  });

  // ---- POST create: SSRF + secret returned once --------------------------

  it("POST /webhooks validates URL via SSRF (rejects blocked URL → 400)", async () => {
    vi.mocked(validateWebhookDestination).mockResolvedValue({
      ok: false, code: "ssrf_blocked", message: "Private/internal destinations are not allowed.",
    });
    const res = await listPOST(mockReq("/api/dashboard/webhooks", {
      method: "POST",
      body: { url: "https://10.0.0.1/hook", events: ["*"] },
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("ssrf_blocked");
    // create must NOT have run when SSRF fails.
    expect(db.webhookEndpoint.create).not.toHaveBeenCalled();
  });

  it("POST /webhooks checks WEBHOOK_ENDPOINTS entitlement (allowed=true)", async () => {
    vi.mocked(db.webhookEndpoint.create).mockResolvedValue(fakeEndpointRow(1, 1) as any);
    vi.mocked(db.webhookEndpoint.count).mockResolvedValue(0);
    const res = await listPOST(mockReq("/api/dashboard/webhooks", {
      method: "POST",
      body: { url: "https://hook.example.com/x", events: ["*"] },
    }));
    expect(res.status).toBe(201);
    expect(canAccess).toHaveBeenCalledWith(1, "webhook_endpoints");
  });

  it("POST /webhooks returns the secret ONCE in the create response", async () => {
    vi.mocked(generateWebhookSecret).mockReturnValue("mg_whsec_fresh_secret_xyz");
    vi.mocked(db.webhookEndpoint.create).mockResolvedValue(fakeEndpointRow(1, 1) as any);
    vi.mocked(db.webhookEndpoint.count).mockResolvedValue(0);
    const res = await listPOST(mockReq("/api/dashboard/webhooks", {
      method: "POST",
      body: { url: "https://hook.example.com/x", events: ["*"] },
    }));
    const data = await res.json();
    expect(data.secret).toBe("mg_whsec_fresh_secret_xyz");
    // The persisted record must store the secret — but only the response
    // exposes it. Subsequent GET detail must NOT.
    const createCall = vi.mocked(db.webhookEndpoint.create).mock.calls[0];
    expect(createCall?.[0]?.data).toMatchObject({ secret: "mg_whsec_fresh_secret_xyz" });
  });

  it("GET /webhooks (list) does NOT expose secrets", async () => {
    vi.mocked(db.webhookEndpoint.findMany).mockResolvedValue([{
      ...fakeEndpointRow(1, 1),
      deliveries: [],  // include relation — empty array
    }] as any);
    const res = await listGET(mockReq("/api/dashboard/webhooks"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.endpoints).toHaveLength(1);
    // Critical: secret must NOT appear in the response.
    expect(data.endpoints[0].secret).toBeUndefined();
    const body = JSON.stringify(data);
    expect(body).not.toContain("mg_whsec_SUPER_SECRET_NEVER_LEAK");
  });

  it("GET /webhooks/:id does NOT expose the secret", async () => {
    // findFirst with select — select intentionally omits `secret`.
    vi.mocked(db.webhookEndpoint.findFirst).mockResolvedValue({
      id: 1, url: "https://hook.example.com/x",
      events: "nixify.event.received",
      isActive: true, createdAt: new Date("2026-01-01T00:00:00Z"),
    } as any);
    const res = await detailGET(mockReq("/api/dashboard/webhooks/1"), {
      params: mockParams("1"),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.secret).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain("mg_whsec_SUPER_SECRET_NEVER_LEAK");
    // select must NOT have included `secret: true`.
    const call = vi.mocked(db.webhookEndpoint.findFirst).mock.calls[0];
    const select = (call?.[0] as any)?.select;
    expect(select?.secret).toBeFalsy();
  });

  // ---- rotate-secret: returns new secret once ----------------------------

  it("POST /webhooks/:id/rotate-secret returns a new secret ONCE", async () => {
    vi.mocked(generateWebhookSecret).mockReturnValue("mg_whsec_rotated_new_secret");
    vi.mocked(db.webhookEndpoint.findFirst).mockResolvedValue({ id: 1 } as any);
    vi.mocked(db.webhookEndpoint.update).mockResolvedValue(fakeEndpointRow(1, 1) as any);
    const res = await rotateSecretPOST(
      mockReq("/api/dashboard/webhooks/1/rotate-secret", { method: "POST" }),
      { params: mockParams("1") },
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.secret).toBe("mg_whsec_rotated_new_secret");
    // The persisted record must store the new secret.
    const updateCall = vi.mocked(db.webhookEndpoint.update).mock.calls[0];
    expect(updateCall?.[0]?.data).toMatchObject({ secret: "mg_whsec_rotated_new_secret" });
  });

  // ---- test delivery: scheduleTestDelivery called with correct userId ----

  it("POST /webhooks/:id/test calls scheduleTestDelivery(endpointId, userId)", async () => {
    vi.mocked(scheduleTestDelivery).mockResolvedValue({ deliveryId: "test-delivery-uuid" });
    const res = await testPOST(
      mockReq("/api/dashboard/webhooks/5/test", { method: "POST" }),
      { params: mockParams("5") },
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.deliveryId).toBe("test-delivery-uuid");
    // Crucially: scheduleTestDelivery must be called with the SESSION userId
    // (1), NOT the endpoint owner's userId from any client input. The route
    // pulls userId exclusively from getAuthenticatedUser().
    expect(scheduleTestDelivery).toHaveBeenCalledWith(5, 1);
  });

  // ---- replay: scheduleReplayDelivery called with correct userId ---------

  it("POST /webhooks/:id/deliveries/:deliveryId/replay calls scheduleReplayDelivery(deliveryId, userId)", async () => {
    vi.mocked(scheduleReplayDelivery).mockResolvedValue({ deliveryId: "replay-uuid" });
    const res = await replayPOST(
      mockReq("/api/dashboard/webhooks/1/deliveries/d-abc/replay", { method: "POST" }),
      { params: mockParams("1", "d-abc") },
    );
    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.delivery_id).toBe("replay-uuid");
    expect(scheduleReplayDelivery).toHaveBeenCalledWith("d-abc", 1);
  });

  // ---- deliveries list: no secret/signature/payload ----------------------

  it("GET /webhooks/:id/deliveries does NOT expose signature/payload/secret", async () => {
    vi.mocked(db.webhookEndpoint.findFirst).mockResolvedValue({ id: 1 } as any);
    vi.mocked(db.webhookDelivery.count).mockResolvedValue(1);
    vi.mocked(db.webhookDelivery.findMany).mockResolvedValue([fakeDeliveryRow(1, 1)] as any);
    const res = await deliveriesGET(
      mockReq("/api/dashboard/webhooks/1/deliveries"),
      { params: mockParams("1") },
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.deliveries).toHaveLength(1);
    expect(data.deliveries[0].signature).toBeUndefined();
    expect(data.deliveries[0].payload).toBeUndefined();
    expect(data.deliveries[0].secret).toBeUndefined();
    const body = JSON.stringify(data);
    expect(body).not.toContain("RAW_PAYLOAD_NEVER_LEAK");
    expect(body).not.toContain("HMAC_SIGNATURE_NEVER_LEAK");
  });

  // ---- logs/requests: tenant-scoped + no Authorization header exposed ---

  it("GET /logs/requests filters by session userId and never exposes Authorization header", async () => {
    vi.mocked(db.requestLog.count).mockResolvedValue(1);
    vi.mocked(db.requestLog.findMany).mockResolvedValue([
      {
        requestId: "req-1",
        method: "POST",
        path: "/api/v1/otp/send",
        status: 200,
        durationMs: 42,
        ip: "203.0.113.1",
        userAgent: "curl/8",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ] as any);
    const res = await logsRequestsGET(mockReq("/api/dashboard/logs/requests"));
    const data = await res.json();
    expect(res.status).toBe(200);
    // The where clause MUST filter by session userId=1 (never a query param).
    const findManyCall = vi.mocked(db.requestLog.findMany).mock.calls[0];
    expect(findManyCall?.[0]?.where).toMatchObject({ userId: 1 });
    // No Authorization header in the response.
    expect(data.logs[0].authorization).toBeUndefined();
    expect(data.logs[0].auth_header).toBeUndefined();
    expect(data.logs[0].apiKeyId).toBeUndefined();
    expect(JSON.stringify(data)).not.toMatch(/authorization/i);
  });

  // ---- logs/events: data NOT in list, IS in detail, cross-tenant 404 -----

  it("GET /logs/events (list) omits the data field", async () => {
    vi.mocked(db.inboundEvent.count).mockResolvedValue(1);
    vi.mocked(db.inboundEvent.findMany).mockResolvedValue([
      {
        eventId: "evt-1",
        type: "user.signup",
        email: "alice@example.com",
        environment: "production",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ] as any);
    const res = await logsEventsListGET(mockReq("/api/dashboard/logs/events"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.events).toHaveLength(1);
    expect(data.events[0].data).toBeUndefined();
    // The findMany select must NOT have included `data: true`.
    const findManyCall = vi.mocked(db.inboundEvent.findMany).mock.calls[0];
    const select = (findManyCall?.[0] as any)?.select;
    expect(select?.data).toBeFalsy();
  });

  it("GET /logs/events/:id (detail) INCLUDES the data field", async () => {
    vi.mocked(db.inboundEvent.findFirst).mockResolvedValue({
      eventId: "evt-1",
      type: "user.signup",
      email: "alice@example.com",
      environment: "production",
      source: "api_v1",
      requestId: "req-1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      data: { order_id: "ord_123", amount: 99.95 },
    } as any);
    const res = await logsEventsDetailGET(
      mockReq("/api/dashboard/logs/events/evt-1"),
      { params: mockParams("evt-1") },
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data).toEqual({ order_id: "ord_123", amount: 99.95 });
  });

  it("GET /logs/events/:id for foreign user's event → 404 (existence leakage check)", async () => {
    vi.mocked(db.inboundEvent.findFirst).mockResolvedValue(null);
    const res = await logsEventsDetailGET(
      mockReq("/api/dashboard/logs/events/evt-foreign"),
      { params: mockParams("evt-foreign") },
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("event_not_found");
  });

  // ---- logs/webhooks: no secret/signature exposed -----------------------

  it("GET /logs/webhooks does NOT expose secret/signature/payload", async () => {
    vi.mocked(db.webhookDelivery.count).mockResolvedValue(1);
    vi.mocked(db.webhookDelivery.findMany).mockResolvedValue([
      {
        deliveryId: "d-1-uuid",
        endpointId: 1,
        eventId: "nixify.event.received",
        status: "delivered",
        attempts: 1,
        responseCode: 200,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        deliveredAt: new Date("2026-01-01T00:00:01Z"),
        lastError: null,
      },
    ] as any);
    const res = await logsWebhooksGET(mockReq("/api/dashboard/logs/webhooks"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.deliveries).toHaveLength(1);
    expect(data.deliveries[0].signature).toBeUndefined();
    expect(data.deliveries[0].payload).toBeUndefined();
    expect(data.deliveries[0].secret).toBeUndefined();
    // The where clause must scope by the endpoint's userId=1 (tenant filter).
    const findManyCall = vi.mocked(db.webhookDelivery.findMany).mock.calls[0];
    expect(findManyCall?.[0]?.where).toMatchObject({ endpoint: { userId: 1 } });
    // The findMany select must NOT include payload/signature.
    const select = (findManyCall?.[0] as any)?.select;
    expect(select?.payload).toBeFalsy();
    expect(select?.signature).toBeFalsy();
    // Body must not contain any of the sensitive raw values.
    const body = JSON.stringify(data);
    expect(body).not.toContain("RAW_PAYLOAD_NEVER_LEAK");
    expect(body).not.toContain("HMAC_SIGNATURE_NEVER_LEAK");
    expect(body).not.toContain("mg_whsec_SUPER_SECRET_NEVER_LEAK");
  });

  // ---- Entitlement denial (403) -----------------------------------------

  it("POST /webhooks with no WEBHOOK_ENDPOINTS entitlement → 403 feature_not_available", async () => {
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" } as any);
    const res = await listPOST(mockReq("/api/dashboard/webhooks", {
      method: "POST",
      body: { url: "https://hook.example.com/x", events: ["*"] },
    }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("feature_not_available");
    // DB must NOT have been queried when access is denied.
    expect(db.webhookEndpoint.create).not.toHaveBeenCalled();
  });

  it("GET /webhooks/:id/deliveries with no WEBHOOK_ENDPOINTS entitlement → 403", async () => {
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" } as any);
    const res = await deliveriesGET(
      mockReq("/api/dashboard/webhooks/1/deliveries"),
      { params: mockParams("1") },
    );
    expect(res.status).toBe(403);
    expect(db.webhookDelivery.findMany).not.toHaveBeenCalled();
  });

  it("GET /logs/events/:id with no EVENTS_API entitlement → 403", async () => {
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" } as any);
    const res = await logsEventsDetailGET(
      mockReq("/api/dashboard/logs/events/evt-1"),
      { params: mockParams("evt-1") },
    );
    expect(res.status).toBe(403);
    expect(db.inboundEvent.findFirst).not.toHaveBeenCalled();
  });
});
