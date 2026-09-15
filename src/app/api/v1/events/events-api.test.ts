import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * v1 Events API route tests (Phase 6).
 *
 * POST /api/v1/events
 *
 * These tests mock the events service layer + auth (verifyApiKey) +
 * entitlements + the security/IP-gate + the DB request log so the route can
 * be exercised end-to-end WITHOUT a database. They run in the generic CI job
 * (no TEST_DATABASE_URL required).
 *
 * Mock strategy mirrors src/app/api/v1/messages/send/messages-send-api.test.ts:
 *   vi.mock("@/lib/events", async (importOriginal) => {
 *     const real = await importOriginal();
 *     return { ...real, ingestEvent: vi.fn() };
 *   })
 * This preserves the REAL zod schema (createEventSchema), the REAL idempotency-key
 * validator (isValidIdempotencyKey), and the REAL error classes
 * (EventValidationError / IdempotencyConflictError) so the route's .safeParse +
 * instanceof checks execute against the production code paths. Only the
 * persistence/ingest function is stubbed.
 *
 * Coverage:
 * - unauthenticated (no Authorization) → 401 unauthorized
 * - read_only scope → 403 insufficient_scope (real hasScope rejects)
 * - full scope → passes scope gate
 * - null-owner system key (userId=null) → 403 owner_required (checkUsage skipped)
 * - EVENTS_API entitlement denied (canAccess allowed:false) → 403 feature_not_available
 * - missing Idempotency-Key → 400 validation_failed
 * - Idempotency-Key < 8 chars → 400 validation_failed
 * - Idempotency-Key > 128 chars → 400 validation_failed
 * - uses ctx.apiKey.userId (real User.id) NOT ctx.apiKey.keyId (section 5)
 * - environment from API key propagated to service (production / development)
 * - successful first insert → 201 {event_id, type, email, environment, created_at, replay:false, request_id}
 * - idempotent replay (replay:true) → 200 {event_id, ..., replay:true}
 * - IdempotencyConflictError → 409 idempotency_conflict
 * - EventValidationError("reserved_event_type") → 400 reserved_event_type
 * - EventValidationError("validation_failed") → 400 validation_failed
 * - unknown error → 500 internal_error (raw error text NOT leaked)
 * - route does NOT import or call deliverWebhook (structural assertion)
 * - securityBucket="generic" → isIpBlocked called, enforceIpSendLimit NOT (section 19)
 */

// ---- Mocks (must come BEFORE the route import) ----------------------------

// Preserve the REAL zod schema (createEventSchema), the REAL isValidIdempotencyKey,
// the REAL isReservedEventType, and the REAL error classes
// (EventValidationError / IdempotencyConflictError); stub only the ingest
// persistence function.
vi.mock("@/lib/events", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/events")>();
  return {
    ...real,
    ingestEvent: vi.fn(),
  };
});

// Mock the auth module's verifyApiKey while preserving the REAL hasScope +
// newRequestId (the route's scope gate uses real hasScope, so this is the
// critical regression check).
vi.mock("@/lib/dx/api-keys", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/dx/api-keys")>();
  return {
    ...real,
    verifyApiKey: vi.fn(),
  };
});

// Mock the entitlement engine — canAccess is the EVENTS_API non-consuming gate,
// checkUsage is the API_MESSAGES wrapper-level gate.
vi.mock("@/lib/entitlements/engine", () => ({
  canAccess: vi.fn(),
  peekUsage: vi.fn(),
  checkUsage: vi.fn(),
}));

// Mock FEATURE_KEYS so we don't depend on the real plan config loading.
vi.mock("@/lib/entitlements/config", () => ({
  FEATURE_KEYS: {
    CONTACTS: "contacts",
    OTP_EMAILS: "otp_emails",
    API_MESSAGES: "api_messages",
    MESSAGING_EMAILS: "messaging_emails",
    EVENTS_API: "events_api",
    AUTOMATIONS: "automations",
  },
}));

// Mock the security gate — IP-block check is shared, but the per-IP OTP send
// limiter MUST be skipped for the events route (securityBucket="generic").
vi.mock("@/lib/security", () => ({
  isIpBlocked: vi.fn(() => Promise.resolve({ blocked: false })),
  enforceIpSendLimit: vi.fn(),
  enforceIpVerifyLimit: vi.fn(),
}));

// Mock the DB so the best-effort requestLog.create doesn't hit a real Prisma
// client (which would warn/error in the test env).
vi.mock("@/lib/db", () => ({
  db: {
    requestLog: { create: vi.fn(() => Promise.resolve()) },
  },
}));

import { POST } from "@/app/api/v1/events/route";

const { verifyApiKey, hasScope } = await import("@/lib/dx/api-keys");
const { checkUsage, canAccess } = await import("@/lib/entitlements/engine");
const { isIpBlocked, enforceIpSendLimit, enforceIpVerifyLimit } = await import("@/lib/security");
const {
  ingestEvent,
  EventValidationError,
  IdempotencyConflictError,
} = await import("@/lib/events");

// Read the route source once so we can assert structural invariants (e.g. the
// route must NOT import or call deliverWebhook — section 18).
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTE_SOURCE = readFileSync(resolve(__dirname, "./route.ts"), "utf8");

// ---- helpers ---------------------------------------------------------------

/**
 * Build a NextRequest for POST /api/v1/events.
 *
 * Defaults:
 *   - Authorization: "Bearer mg_live_test"
 *   - Idempotency-Key: "abc12345" (8 chars — minimum valid)
 *   - x-forwarded-for set so the security gate runs (otherwise ip="unknown"
 *     skips the gate entirely and we can't assert isIpBlocked was called).
 *   - Content-Type: application/json
 */
function v1Req(opts: {
  auth?: string | null;        // null = omit Authorization header
  idempotencyKey?: string | null; // null = omit Idempotency-Key header
  body?: unknown;
  ip?: string | null;          // null = no x-forwarded-for
} = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.auth !== null) {
    headers["Authorization"] = opts.auth ?? "Bearer mg_live_test";
  }
  const idem = opts.idempotencyKey === undefined ? "abc12345" : opts.idempotencyKey;
  if (idem !== null) {
    headers["Idempotency-Key"] = idem;
  }
  if (opts.ip !== null) {
    headers["x-forwarded-for"] = opts.ip ?? "203.0.113.42";
  }
  const body = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
  return new NextRequest("http://localhost/api/v1/events", {
    method: "POST",
    headers,
    body,
  });
}

/** Default verified key: user-owned, production, full scope. */
function prodKey(overrides: Partial<{
  keyId: number;
  userId: number | null;
  environment: string;
  scopes: string;
}> = {}) {
  return {
    ok: true as const,
    keyId: 99,
    userId: 42,
    environment: "production",
    scopes: "full",
    ...overrides,
  };
}

/** Default allowed usage for API_MESSAGES (wrapper-level gate). */
function allowedUsage() {
  return {
    allowed: true,
    remaining: 100,
    resetAt: null,
    plan: "PRO" as const,
  };
}

/** Default allowed access for EVENTS_API (route-level gate). */
function allowedAccess() {
  return {
    allowed: true,
    plan: "PRO" as const,
  };
}

/** Default valid body — matches the example in the task spec. */
const defaultBody = {
  type: "order.completed",
  email: "a@b.com",
  data: { x: 1 },
};

/** Default successful first-insert result. */
function firstInsertResult() {
  return {
    eventId: "evt_abc123",
    type: "order.completed",
    email: "a@b.com",
    environment: "production",
    createdAt: new Date("2026-09-17T00:00:00Z"),
    replay: false,
    conflict: false,
  };
}

/** Default successful replay result (200). */
function replayResult() {
  return {
    eventId: "evt_existing",
    type: "order.completed",
    email: "a@b.com",
    environment: "production",
    createdAt: new Date("2026-09-16T00:00:00Z"),
    replay: true,
    conflict: false,
  };
}

/** Set up the "everything passes" default mocks. */
function setupHappyPath() {
  vi.mocked(verifyApiKey).mockResolvedValue(prodKey());
  vi.mocked(checkUsage).mockResolvedValue(allowedUsage() as any);
  vi.mocked(canAccess).mockResolvedValue(allowedAccess() as any);
  vi.mocked(isIpBlocked).mockResolvedValue({ blocked: false });
  vi.mocked(ingestEvent).mockResolvedValue(firstInsertResult());
}

// ---- tests -----------------------------------------------------------------

describe("v1 Events API (Phase 6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Authentication (401) ----------------------------------------------

  it("missing Authorization header → 401 unauthorized", async () => {
    const res = await POST(v1Req({ auth: null }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe("unauthorized");
    // verifyApiKey must NOT be called when there's no bearer token at all.
    expect(verifyApiKey).not.toHaveBeenCalled();
    // The handler must NOT have run.
    expect(ingestEvent).not.toHaveBeenCalled();
  });

  // ---- Scope gate (403 insufficient_scope) -------------------------------

  it("read_only scope → 403 insufficient_scope (real hasScope rejects)", async () => {
    // Sanity check: hasScope("read_only","full") === false — this is what the
    // route's scope gate relies on. If hasScope regressed to allow read_only
    // for full, this assertion would catch it.
    expect(hasScope("read_only", "full")).toBe(false);

    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ scopes: "read_only" }));
    const res = await POST(v1Req());
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("insufficient_scope");
    // Handler must NOT run — the scope gate stops before it.
    expect(ingestEvent).not.toHaveBeenCalled();
  });

  it("full scope → passes scope gate and proceeds to handler", async () => {
    // Sanity check: hasScope("full","full") === true.
    expect(hasScope("full", "full")).toBe(true);

    // Default setup uses scopes:"full" — should reach the handler and call
    // ingestEvent.
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(201);
    expect(ingestEvent).toHaveBeenCalled();
  });

  // ---- Tenant ownership (403 owner_required) -----------------------------

  it("null-owner system key (apiKey.userId=null) → 403 owner_required", async () => {
    // System key: userId=null. withApiKey SKIPS checkUsage for system keys
    // (allows unlimited), so checkUsage is NOT called. The handler then
    // rejects with owner_required because userId is null.
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ userId: null }));
    // Body + idempotency-key must be valid so we reach the owner check.
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("owner_required");
    // checkUsage must NOT have been called (system key path in wrapper).
    expect(checkUsage).not.toHaveBeenCalled();
    // The ingest must NOT have happened.
    expect(ingestEvent).not.toHaveBeenCalled();
  });

  // ---- EVENTS_API entitlement gate (403 feature_not_available) ----------

  it("EVENTS_API entitlement denied (canAccess allowed:false) → 403 feature_not_available", async () => {
    // Owner is non-null + scope is full + checkUsage passes, so we reach the
    // route's EVENTS_API gate. canAccess returns allowed:false → 403.
    vi.mocked(canAccess).mockResolvedValue({ allowed: false, plan: "FREE" } as any);
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("feature_not_available");
    // Service must NOT be called when the gate denies access.
    expect(ingestEvent).not.toHaveBeenCalled();
  });

  // ---- Idempotency-Key header validation ---------------------------------

  it("missing Idempotency-Key header → 400 validation_failed", async () => {
    const res = await POST(v1Req({ idempotencyKey: null, body: defaultBody }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    expect(data.error.message).toMatch(/Idempotency-Key/i);
    expect(ingestEvent).not.toHaveBeenCalled();
  });

  it("Idempotency-Key too short (< 8 chars) → 400 validation_failed", async () => {
    const res = await POST(v1Req({ idempotencyKey: "short", body: defaultBody }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    expect(data.error.message).toMatch(/8-128/);
    expect(ingestEvent).not.toHaveBeenCalled();
  });

  it("Idempotency-Key too long (> 128 chars) → 400 validation_failed", async () => {
    const longKey = "x".repeat(129);
    const res = await POST(v1Req({ idempotencyKey: longKey, body: defaultBody }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    expect(data.error.message).toMatch(/8-128/);
    expect(ingestEvent).not.toHaveBeenCalled();
  });

  // ---- Section 5: uses ctx.apiKey.userId, NOT ctx.apiKey.keyId ----------

  it("uses ctx.apiKey.userId (NOT ctx.apiKey.keyId) as the tenant owner", async () => {
    // Mock verifyApiKey to return a key with keyId=99 but userId=42. The route
    // must use 42 (the User.id) for the ingest input, NOT 99 (the ApiKey.id).
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ keyId: 99, userId: 42 }));
    await POST(v1Req({ body: defaultBody }));
    expect(ingestEvent).toHaveBeenCalledTimes(1);
    const call = vi.mocked(ingestEvent).mock.calls[0];
    const input = call[0];
    expect(input.userId).toBe(42);
    // Negative assertion: the route must NOT have used the keyId as the userId.
    expect(input.userId).not.toBe(99);
  });

  // ---- Environment propagation (from API key) ----------------------------

  it("production key → environment='production' passed to service", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ environment: "production" }));
    await POST(v1Req({ body: defaultBody }));
    const input = vi.mocked(ingestEvent).mock.calls[0][0];
    expect(input.environment).toBe("production");
  });

  it("development key → environment='development' passed to service", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ environment: "development" }));
    await POST(v1Req({ body: defaultBody }));
    const input = vi.mocked(ingestEvent).mock.calls[0][0];
    expect(input.environment).toBe("development");
  });

  // ---- Response shapes ----------------------------------------------------

  it("successful first insert → 201 {event_id, type, email, environment, created_at, replay:false, request_id}", async () => {
    vi.mocked(ingestEvent).mockResolvedValue(firstInsertResult());
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.event_id).toBe("evt_abc123");
    expect(data.type).toBe("order.completed");
    expect(data.email).toBe("a@b.com");
    expect(data.environment).toBe("production");
    expect(data.created_at).toBe("2026-09-17T00:00:00.000Z");
    expect(data.replay).toBe(false);
    expect(data.request_id).toBeTruthy();
  });

  it("idempotent replay (replay:true) → 200 {event_id, ..., replay:true}", async () => {
    vi.mocked(ingestEvent).mockResolvedValue(replayResult());
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.event_id).toBe("evt_existing");
    expect(data.type).toBe("order.completed");
    expect(data.email).toBe("a@b.com");
    expect(data.environment).toBe("production");
    expect(data.created_at).toBe("2026-09-16T00:00:00.000Z");
    expect(data.replay).toBe(true);
    expect(data.request_id).toBeTruthy();
  });

  // ---- Error class handling ----------------------------------------------

  it("IdempotencyConflictError thrown → 409 idempotency_conflict", async () => {
    vi.mocked(ingestEvent).mockRejectedValue(new IdempotencyConflictError());
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error.code).toBe("idempotency_conflict");
  });

  it("EventValidationError('reserved_event_type') → 400 reserved_event_type", async () => {
    vi.mocked(ingestEvent).mockRejectedValue(
      new EventValidationError(
        "reserved_event_type",
        'Event type "otp.send" is reserved for internal use.',
      ),
    );
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("reserved_event_type");
  });

  it("EventValidationError('validation_failed') → 400 validation_failed", async () => {
    vi.mocked(ingestEvent).mockRejectedValue(
      new EventValidationError("validation_failed", "Email is required."),
    );
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
  });

  it("unknown error → 500 internal_error (no raw error text in response)", async () => {
    // A raw internal error must NOT leak through to the response body. The
    // route catches unknown errors and returns a fixed generic message.
    vi.mocked(ingestEvent).mockRejectedValue(
      new Error("DATABASE_CONNECTION_LOST raw stack trace with credentials in it"),
    );
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error.code).toBe("internal_error");
    const body = JSON.stringify(data);
    expect(body).not.toMatch(/DATABASE_CONNECTION_LOST/);
    expect(body).not.toMatch(/raw stack trace/i);
    expect(body).not.toMatch(/credentials/i);
  });

  // ---- Side effects (route-level) ----------------------------------------

  it("route does NOT import or call deliverWebhook (structural assertion)", () => {
    // The route file must not contain any reference to deliverWebhook or
    // import from the webhooks module. Section 18 forbids side effects.
    expect(ROUTE_SOURCE).not.toMatch(/deliverWebhook/);
    expect(ROUTE_SOURCE).not.toMatch(/from\s+["']@\/lib\/webhooks["']/);
  });

  it("securityBucket='generic' → isIpBlocked called, enforceIpSendLimit NOT called", async () => {
    // The events route passes { securityBucket: "generic" } to withApiKey.
    // That skips the OTP-specific per-IP send limiter (which would
    // inappropriately rate-limit event ingestion), while keeping the IP-block
    // check (security/abuse protection).
    await POST(v1Req({ body: defaultBody }));
    // The IP-block check ALWAYS runs (regardless of bucket).
    expect(isIpBlocked).toHaveBeenCalled();
    // The OTP send limiter MUST NOT run for the generic bucket.
    expect(enforceIpSendLimit).not.toHaveBeenCalled();
    // And the OTP verify limiter obviously doesn't run either.
    expect(enforceIpVerifyLimit).not.toHaveBeenCalled();
  });
});
