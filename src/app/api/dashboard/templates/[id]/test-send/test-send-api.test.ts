import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Dashboard Template Test-Send API route tests (Phase 4).
 *
 * These tests mock the messaging service layer + auth + entitlements + the DB
 * so the route can be exercised end-to-end WITHOUT a database. They run in
 * the generic CI job (no TEST_DATABASE_URL required).
 *
 * Mock strategy mirrors src/app/api/dashboard/templates/templates-api.test.ts:
 *   vi.mock("@/lib/messaging", async (importOriginal) => {
 *     const real = await importOriginal();
 *     return { ...real, sendTransactionalEmail: vi.fn(), SmtpEmailProvider: vi.fn() };
 *   })
 * This preserves the REAL zod schema (dashboardTestSendSchema) + the REAL
 * error classes so the route's .safeParse + instanceof checks execute against
 * production code paths. Only the persistence/send function + provider ctor
 * are stubbed.
 *
 * Coverage:
 * - unauthenticated (no session) → 401
 * - no MESSAGING_EMAILS entitlement → 403 feature_not_available
 * - invalid template ID (non-numeric) → 400 validation_failed
 * - template not owned by user (findFirst returns null) → 404 template_not_found
 * - successful send → 201 {message_id, status:"sent", quota_consumed:true}
 * - provider failure (status:"failed") → 502 delivery_failed
 * - quota rejection (status:"rejected") → 402
 * - MessagingValidationError → 400
 * - IdempotencyConflictError → 409
 * - uses authenticated user.id (NOT client-supplied)
 * - does NOT consume API_MESSAGES (only MESSAGING_EMAILS, via the service)
 */

// ---- Mocks (must come BEFORE the route import) ----------------------------

// Preserve real zod schema (dashboardTestSendSchema) + real error classes;
// stub only the persistence/send function + provider ctor.
vi.mock("@/lib/messaging", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/messaging")>();
  return {
    ...real,
    sendTransactionalEmail: vi.fn(),
    SmtpEmailProvider: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/lib/entitlements/engine", () => ({
  canAccess: vi.fn(),
  peekUsage: vi.fn(),
  checkUsage: vi.fn(),
}));

vi.mock("@/lib/entitlements/config", () => ({
  FEATURE_KEYS: {
    CONTACTS: "contacts",
    OTP_EMAILS: "otp_emails",
    API_MESSAGES: "api_messages",
    MESSAGING_EMAILS: "messaging_emails",
  },
}));

// The dashboard route dynamically imports `db` to look up the template. Mock
// it so we don't hit a real Prisma client.
vi.mock("@/lib/db", () => ({
  db: {
    transactionalTemplate: {
      findFirst: vi.fn(),
    },
  },
}));

import { POST } from "@/app/api/dashboard/templates/[id]/test-send/route";

const { getAuthenticatedUser } = await import("@/lib/auth/session");
const { canAccess, checkUsage } = await import("@/lib/entitlements/engine");
const { FEATURE_KEYS } = await import("@/lib/entitlements/config");
const { db } = await import("@/lib/db");
const {
  sendTransactionalEmail,
  MessagingValidationError,
  IdempotencyConflictError,
  MessagingQuotaError,
} = await import("@/lib/messaging");

// ---- helpers ---------------------------------------------------------------

function mockReq(url: string, opts: { method?: string; body?: unknown } = {}) {
  const method = opts.method ?? "POST";
  const body = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
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

function fakeTemplateRow(id = 1, slug = "welcome") {
  return { id, slug, currentVersion: 1 };
}

/** Set up the "everything passes" default mocks. */
function setupHappyPath() {
  vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(55));
  vi.mocked(canAccess).mockResolvedValue({ allowed: true, plan: "PRO" });
  vi.mocked(db.transactionalTemplate.findFirst).mockResolvedValue(fakeTemplateRow(7, "welcome") as any);
  vi.mocked(sendTransactionalEmail).mockResolvedValue({
    messageId: "msg_dashboard_1",
    status: "sent",
    replay: false,
    created: true,
  });
}

/** Default valid body. */
const defaultBody = { to: "user@example.com", variables: { name: "Alice" } };

// ---- tests -----------------------------------------------------------------

describe("Dashboard Template Test-Send API (Phase 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Authentication (401) ----------------------------------------------

  it("unauthenticated (no session) → 401", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
    const res = await POST(
      mockReq("/api/dashboard/templates/7/test-send", { method: "POST", body: defaultBody }),
      { params: mockParams("7") },
    );
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe("unauthorized");
    // The DB lookup must NOT run when unauthenticated.
    expect(db.transactionalTemplate.findFirst).not.toHaveBeenCalled();
    // And no send.
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  // ---- Entitlement gate (403 feature_not_available) ----------------------

  it("no MESSAGING_EMAILS entitlement → 403 feature_not_available", async () => {
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(55));
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" });
    const res = await POST(
      mockReq("/api/dashboard/templates/7/test-send", { method: "POST", body: defaultBody }),
      { params: mockParams("7") },
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("feature_not_available");
    // canAccess must be called with MESSAGING_EMAILS (the gate feature key).
    expect(canAccess).toHaveBeenCalledWith(55, FEATURE_KEYS.MESSAGING_EMAILS);
    // The DB lookup must NOT run when the entitlement gate fails.
    expect(db.transactionalTemplate.findFirst).not.toHaveBeenCalled();
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  // ---- Template ID validation (400) --------------------------------------

  it("invalid template ID (non-numeric) → 400 validation_failed", async () => {
    const res = await POST(
      mockReq("/api/dashboard/templates/abc/test-send", { method: "POST", body: defaultBody }),
      { params: mockParams("abc") },
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    // DB lookup must NOT run for an invalid ID.
    expect(db.transactionalTemplate.findFirst).not.toHaveBeenCalled();
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("invalid template ID (zero) → 400 validation_failed", async () => {
    const res = await POST(
      mockReq("/api/dashboard/templates/0/test-send", { method: "POST", body: defaultBody }),
      { params: mockParams("0") },
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    expect(db.transactionalTemplate.findFirst).not.toHaveBeenCalled();
  });

  // ---- Tenant-scoped template lookup (404) -------------------------------

  it("template not owned by user → 404 template_not_found (no existence leakage)", async () => {
    vi.mocked(db.transactionalTemplate.findFirst).mockResolvedValue(null);
    const res = await POST(
      mockReq("/api/dashboard/templates/999/test-send", { method: "POST", body: defaultBody }),
      { params: mockParams("999") },
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe("template_not_found");
    // The lookup must be tenant-scoped: userId from session + path id.
    expect(db.transactionalTemplate.findFirst).toHaveBeenCalledWith({
      where: { id: 999, userId: 55 },
      select: { id: true, slug: true, currentVersion: true },
    });
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  // ---- Successful send (201) ---------------------------------------------

  it("successful send → 201 {message_id, status:'sent', quota_consumed:true}", async () => {
    vi.mocked(sendTransactionalEmail).mockResolvedValue({
      messageId: "msg_dash_ok",
      status: "sent",
      replay: false,
      created: true,
    });
    const res = await POST(
      mockReq("/api/dashboard/templates/7/test-send", { method: "POST", body: defaultBody }),
      { params: mockParams("7") },
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.message_id).toBe("msg_dash_ok");
    expect(data.status).toBe("sent");
    expect(data.quota_consumed).toBe(true);
  });

  // ---- Provider failure (502) --------------------------------------------

  it("provider failure (status:'failed') → 502 delivery_failed", async () => {
    vi.mocked(sendTransactionalEmail).mockResolvedValue({
      messageId: "msg_dash_fail",
      status: "failed",
      replay: false,
      created: true,
      errorCode: "provider_error",
      errorMessage: "SMTP delivery failed",
    });
    const res = await POST(
      mockReq("/api/dashboard/templates/7/test-send", { method: "POST", body: defaultBody }),
      { params: mockParams("7") },
    );
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error.code).toBe("delivery_failed");
  });

  // ---- Quota rejection (402) --------------------------------------------

  it("quota rejection (status:'rejected') → 402 with errorCode", async () => {
    vi.mocked(sendTransactionalEmail).mockResolvedValue({
      messageId: "msg_dash_rejected",
      status: "rejected",
      replay: false,
      created: true,
      errorCode: "quota_exhausted",
      errorMessage: "Monthly messaging quota exceeded.",
    });
    const res = await POST(
      mockReq("/api/dashboard/templates/7/test-send", { method: "POST", body: defaultBody }),
      { params: mockParams("7") },
    );
    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.error.code).toBe("quota_exhausted");
  });

  // ---- Error class handling ----------------------------------------------

  it("MessagingValidationError → 400 with code", async () => {
    vi.mocked(sendTransactionalEmail).mockRejectedValue(
      new MessagingValidationError("missing_template_variables", "Missing required variables: order_id"),
    );
    const res = await POST(
      mockReq("/api/dashboard/templates/7/test-send", { method: "POST", body: defaultBody }),
      { params: mockParams("7") },
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("missing_template_variables");
  });

  it("MessagingQuotaError('rate_limited') → 429 rate_limited", async () => {
    vi.mocked(sendTransactionalEmail).mockRejectedValue(
      new MessagingQuotaError("rate_limited", "Messaging rate limit exceeded."),
    );
    const res = await POST(
      mockReq("/api/dashboard/templates/7/test-send", { method: "POST", body: defaultBody }),
      { params: mockParams("7") },
    );
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error.code).toBe("rate_limited");
  });

  it("IdempotencyConflictError → 409 idempotency_conflict", async () => {
    vi.mocked(sendTransactionalEmail).mockRejectedValue(new IdempotencyConflictError());
    const res = await POST(
      mockReq("/api/dashboard/templates/7/test-send", { method: "POST", body: defaultBody }),
      { params: mockParams("7") },
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error.code).toBe("idempotency_conflict");
  });

  // ---- Uses authenticated user.id ----------------------------------------

  it("uses authenticated user.id (NOT client-supplied) — sendReq.userId === 55", async () => {
    // The session returns user.id=55. The route must pass 55 to the service,
    // NOT any value from the body or path.
    vi.mocked(getAuthenticatedUser).mockResolvedValue(mockUser(55));
    await POST(
      mockReq("/api/dashboard/templates/7/test-send", {
        method: "POST",
        // Client attempts to smuggle a userId — must be ignored (the dashboard
        // test-send body schema only accepts {to, variables}).
        body: { ...defaultBody, userId: 999 },
      }),
      { params: mockParams("7") },
    );
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendTransactionalEmail).mock.calls[0];
    const sendReq = call[0];
    expect(sendReq.userId).toBe(55);
    expect(sendReq.userId).not.toBe(999);
    // Source marker — distinguishes dashboard sends from API sends.
    expect(sendReq.source).toBe("dashboard_test");
    // The template was resolved by ID + tenant-scoped userId.
    expect(db.transactionalTemplate.findFirst).toHaveBeenCalledWith({
      where: { id: 7, userId: 55 },
      select: { id: true, slug: true, currentVersion: true },
    });
  });

  // ---- Does NOT consume API_MESSAGES -------------------------------------

  it("does NOT consume API_MESSAGES — only MESSAGING_EMAILS (via the service)", async () => {
    // The dashboard route does NOT go through withApiKey (it's session-auth),
    // so the API_MESSAGES entitlement check is never performed by the route.
    // The service (mocked here) calls checkUsage(MESSAGING_EMAILS) internally;
    // it never touches API_MESSAGES. This is structural and important: the
    // dashboard test-send button must not silently burn a user's API quota.
    await POST(
      mockReq("/api/dashboard/templates/7/test-send", { method: "POST", body: defaultBody }),
      { params: mockParams("7") },
    );
    // canAccess was called once (the gate) with MESSAGING_EMAILS.
    expect(canAccess).toHaveBeenCalledWith(55, FEATURE_KEYS.MESSAGING_EMAILS);
    // checkUsage must NOT have been called with API_MESSAGES by the route.
    // (The service is mocked, so checkUsage isn't called at all here — but
    // even if the service were real, it would call checkUsage with
    // MESSAGING_EMAILS, never API_MESSAGES.)
    expect(checkUsage).not.toHaveBeenCalledWith(55, FEATURE_KEYS.API_MESSAGES);
    expect(checkUsage).not.toHaveBeenCalledWith(expect.any(Number), FEATURE_KEYS.API_MESSAGES);
  });

  // ---- Synthetic idempotency key (double-click protection) ---------------

  it("synthesizes an idempotency key per-call (double-click protection)", async () => {
    await POST(
      mockReq("/api/dashboard/templates/7/test-send", { method: "POST", body: defaultBody }),
      { params: mockParams("7") },
    );
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
    const sendReq = vi.mocked(sendTransactionalEmail).mock.calls[0][0];
    // The synthetic key is non-empty and reasonably long (contains
    // dashboard_<userId>_<templateId>_<timestamp>_<random>).
    expect(typeof sendReq.idempotencyKey).toBe("string");
    expect(sendReq.idempotencyKey!.length).toBeGreaterThanOrEqual(8);
    expect(sendReq.idempotencyKey).toMatch(/^dashboard_55_7_/);

    // A second call with the same body must produce a DIFFERENT key (so the
    // service treats them as independent sends — double-click doesn't dedupe
    // to a single send).
    await POST(
      mockReq("/api/dashboard/templates/7/test-send", { method: "POST", body: defaultBody }),
      { params: mockParams("7") },
    );
    const sendReq2 = vi.mocked(sendTransactionalEmail).mock.calls[1][0];
    expect(sendReq2.idempotencyKey).not.toBe(sendReq.idempotencyKey);
  });
});
