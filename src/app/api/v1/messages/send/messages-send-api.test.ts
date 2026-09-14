import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * v1 Messages Send API route tests (Phase 4).
 *
 * These tests mock the messaging service layer + auth (verifyApiKey) +
 * entitlements + the security/IP-gate + the DB request log so the route can be
 * exercised end-to-end WITHOUT a database. They run in the generic CI job
 * (no TEST_DATABASE_URL required).
 *
 * Mock strategy mirrors src/app/api/dashboard/templates/templates-api.test.ts:
 *   vi.mock("@/lib/messaging", async (importOriginal) => {
 *     const real = await importOriginal();
 *     return { ...real, sendTransactionalEmail: vi.fn(), SmtpEmailProvider: vi.fn() };
 *   })
 * This preserves the REAL zod schema (sendV1Schema), the REAL idempotency-key
 * validator (isValidIdempotencyKey), and the REAL error classes
 * (MessagingValidationError / IdempotencyConflictError / MessagingQuotaError)
 * so the route's .safeParse + instanceof checks execute against the production
 * code paths. Only the persistence/send function + provider ctor are stubbed.
 *
 * Coverage:
 * - unauthenticated (no Authorization) → 401 unauthorized
 * - read_only scope → 403 insufficient_scope (real hasScope rejects)
 * - full scope → passes scope gate
 * - null-owner system key (userId=null) → 403 owner_required
 * - production + development key (NODE_ENV=production) → 403 live_key_required
 * - production + production key → proceeds
 * - missing Idempotency-Key → 400 validation_failed
 * - Idempotency-Key < 8 chars → 400 validation_failed
 * - Idempotency-Key > 128 chars → 400 validation_failed
 * - invalid recipient (no @) → 400 validation_failed (real zod runs)
 * - missing template_slug → 400 validation_failed (real zod runs)
 * - successful first-time send → 201 {message_id, status:"sent"}
 * - idempotent replay of sent → 200
 * - idempotent replay of pending → 202
 * - provider failure (status:"failed") → 502 delivery_failed (no raw error text)
 * - IdempotencyConflictError → 409 idempotency_conflict
 * - MessagingQuotaError("quota_exhausted") → 402 quota_exhausted
 * - MessagingQuotaError("rate_limited") → 429 rate_limited
 * - MessagingValidationError("missing_template_variables") → 400
 * - MessagingValidationError("template_not_found") → 400
 * - MessagingValidationError("invalid_subject") → 400
 * - uses ctx.apiKey.userId (real User.id) NOT ctx.apiKey.keyId (section 5)
 * - securityBucket="generic" → isIpBlocked runs, enforceIpSendLimit does NOT (section 19)
 */

// ---- Mocks (must come BEFORE the route import) ----------------------------

// Preserve real zod schema (sendV1Schema) + real isValidIdempotencyKey + real
// error classes; stub only the persistence/send function + provider ctor.
vi.mock("@/lib/messaging", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/messaging")>();
  return {
    ...real,
    sendTransactionalEmail: vi.fn(),
    SmtpEmailProvider: vi.fn(),
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

// Mock the entitlement engine — the withApiKey wrapper calls checkUsage for
// API_MESSAGES, and the service calls checkUsage for MESSAGING_EMAILS (but
// the service is mocked, so only the wrapper's call happens).
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
  },
}));

// Mock the security gate — IP-block check is shared, but the per-IP OTP send
// limiter MUST be skipped for the messaging route (securityBucket="generic").
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

import { POST } from "@/app/api/v1/messages/send/route";

const { verifyApiKey, hasScope } = await import("@/lib/dx/api-keys");
const { checkUsage } = await import("@/lib/entitlements/engine");
const { isIpBlocked, enforceIpSendLimit, enforceIpVerifyLimit } = await import("@/lib/security");
const {
  sendTransactionalEmail,
  MessagingValidationError,
  IdempotencyConflictError,
  MessagingQuotaError,
} = await import("@/lib/messaging");

// ---- helpers ---------------------------------------------------------------

/**
 * Build a NextRequest for POST /api/v1/messages/send.
 *
 * Defaults:
 *   - Authorization: "Bearer mg_live_testkey"
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
    headers["Authorization"] = opts.auth ?? "Bearer mg_live_testkey";
  }
  const idem = opts.idempotencyKey === undefined ? "abc12345" : opts.idempotencyKey;
  if (idem !== null) {
    headers["Idempotency-Key"] = idem;
  }
  if (opts.ip !== null) {
    headers["x-forwarded-for"] = opts.ip ?? "203.0.113.42";
  }
  const body = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
  return new NextRequest("http://localhost/api/v1/messages/send", {
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

/** Default allowed usage for API_MESSAGES. */
function allowedUsage() {
  return {
    allowed: true,
    remaining: 100,
    resetAt: null,
    plan: "PRO" as const,
  };
}

/** Default valid body. */
const defaultBody = {
  to: "user@example.com",
  template_slug: "welcome",
  variables: { name: "Alice" },
};

/** Default successful send result (first-time, sent). */
function sentResult() {
  return {
    messageId: "msg_abc123",
    status: "sent" as const,
    replay: false,
    created: true,
  };
}

/** Set up the "everything passes" default mocks. */
function setupHappyPath() {
  vi.mocked(verifyApiKey).mockResolvedValue(prodKey());
  vi.mocked(checkUsage).mockResolvedValue(allowedUsage() as any);
  vi.mocked(isIpBlocked).mockResolvedValue({ blocked: false });
  vi.mocked(sendTransactionalEmail).mockResolvedValue(sentResult());
}

// ---- tests -----------------------------------------------------------------

describe("v1 Messages Send API (Phase 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // ---- Authentication (401) ----------------------------------------------

  it("unauthenticated (no Authorization header) → 401 unauthorized", async () => {
    const res = await POST(v1Req({ auth: null }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe("unauthorized");
    // verifyApiKey must NOT be called when there's no bearer token at all.
    expect(verifyApiKey).not.toHaveBeenCalled();
  });

  // ---- Scope gate (403 insufficient_scope) -------------------------------

  it("read_only scope → 403 insufficient_scope (real hasScope rejects)", async () => {
    // Sanity check: hasScope("read_only","full") === false — this is what the
    // route's scope gate relies on. If hasScope regressed to allow read_only
    // for full, this assertion would catch it.
    expect(hasScope("read_only", "full")).toBe(false);

    vi.mocked(verifyApiKey).mockResolvedValue(
      prodKey({ scopes: "read_only" }),
    );
    const res = await POST(v1Req());
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("insufficient_scope");
    // Handler must NOT run — the scope gate stops before it.
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("full scope → passes scope gate and proceeds to handler", async () => {
    // Sanity check: hasScope("full","full") === true.
    expect(hasScope("full", "full")).toBe(true);

    // Default setup uses scopes:"full" — should reach the handler and call
    // sendTransactionalEmail.
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(201);
    expect(sendTransactionalEmail).toHaveBeenCalled();
  });

  // ---- Tenant ownership (403 owner_required) -----------------------------

  it("null-owner system key (apiKey.userId=null) → 403 owner_required", async () => {
    // System key: userId=null. withApiKey SKIPS checkUsage for system keys
    // (allows unlimited), so checkUsage is NOT called. The handler then
    // rejects with owner_required because userId is null.
    vi.mocked(verifyApiKey).mockResolvedValue(
      prodKey({ userId: null }),
    );
    // Body + idempotency-key must be valid so we reach the owner check.
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("owner_required");
    // checkUsage must NOT have been called (system key path).
    expect(checkUsage).not.toHaveBeenCalled();
    // The send must NOT have happened.
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  // ---- Test vs live key (403 live_key_required) --------------------------

  it("production env + development key → 403 live_key_required", async () => {
    // Stub NODE_ENV so the route's production gate fires.
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(verifyApiKey).mockResolvedValue(
      prodKey({ environment: "development" }),
    );
    // Body + idempotency-key + owner all pass so we reach the live-key check.
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("live_key_required");
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("production env + production key → proceeds to send (201)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ environment: "production" }));
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(201);
    expect(sendTransactionalEmail).toHaveBeenCalled();
  });

  // ---- Idempotency-Key header validation ---------------------------------

  it("missing Idempotency-Key header → 400 validation_failed", async () => {
    const res = await POST(v1Req({ idempotencyKey: null, body: defaultBody }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    expect(data.error.message).toMatch(/Idempotency-Key/i);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("Idempotency-Key too short (< 8 chars) → 400 validation_failed", async () => {
    const res = await POST(v1Req({ idempotencyKey: "short", body: defaultBody }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    expect(data.error.message).toMatch(/8-128/);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("Idempotency-Key too long (> 128 chars) → 400 validation_failed", async () => {
    const longKey = "x".repeat(129);
    const res = await POST(v1Req({ idempotencyKey: longKey, body: defaultBody }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    expect(data.error.message).toMatch(/8-128/);
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  // ---- Body validation (real zod schema runs) ----------------------------

  it("invalid recipient (no @) → 400 validation_failed (real zod runs)", async () => {
    const res = await POST(v1Req({
      body: { ...defaultBody, to: "not-an-email" },
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("missing template_slug → 400 validation_failed (real zod runs)", async () => {
    const res = await POST(v1Req({
      body: { to: "user@example.com", variables: {} },
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("validation_failed");
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  // ---- Successful send + idempotent replays ------------------------------

  it("successful first-time send → 201 {message_id, status:'sent'}", async () => {
    vi.mocked(sendTransactionalEmail).mockResolvedValue(sentResult());
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.message_id).toBe("msg_abc123");
    expect(data.status).toBe("sent");
    expect(data.request_id).toBeTruthy();
  });

  it("idempotent replay of sent → 200 {message_id, status:'sent'}", async () => {
    vi.mocked(sendTransactionalEmail).mockResolvedValue({
      messageId: "msg_existing",
      status: "sent",
      replay: true,
      created: false,
    });
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message_id).toBe("msg_existing");
    expect(data.status).toBe("sent");
  });

  it("idempotent replay of pending → 202 {message_id, status:'pending'}", async () => {
    vi.mocked(sendTransactionalEmail).mockResolvedValue({
      messageId: "msg_pending",
      status: "pending",
      replay: true,
      created: false,
    });
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.message_id).toBe("msg_pending");
    expect(data.status).toBe("pending");
  });

  // ---- Provider failure (502) --------------------------------------------

  it("provider failure (status:'failed') → 502 delivery_failed (no raw error text)", async () => {
    vi.mocked(sendTransactionalEmail).mockResolvedValue({
      messageId: "msg_fail",
      status: "failed",
      replay: false,
      created: true,
      errorCode: "provider_error",
      errorMessage: "Some raw SMTP stack trace with credentials in it",
    });
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error.code).toBe("delivery_failed");
    // The route MUST NOT leak the raw error text from the provider. The
    // service classifies errors into safe buckets and the route uses a fixed
    // message string.
    const body = JSON.stringify(data);
    expect(body).not.toMatch(/raw SMTP stack trace/i);
    expect(body).not.toMatch(/credentials/i);
  });

  // ---- Error class handling ----------------------------------------------

  it("IdempotencyConflictError thrown → 409 idempotency_conflict", async () => {
    vi.mocked(sendTransactionalEmail).mockRejectedValue(new IdempotencyConflictError());
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error.code).toBe("idempotency_conflict");
  });

  it("MessagingQuotaError(code='quota_exhausted') → 402 quota_exhausted", async () => {
    vi.mocked(sendTransactionalEmail).mockRejectedValue(
      new MessagingQuotaError("quota_exhausted", "Monthly messaging quota exceeded."),
    );
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.error.code).toBe("quota_exhausted");
  });

  it("MessagingQuotaError(code='rate_limited') → 429 rate_limited", async () => {
    vi.mocked(sendTransactionalEmail).mockRejectedValue(
      new MessagingQuotaError("rate_limited", "Messaging rate limit exceeded."),
    );
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error.code).toBe("rate_limited");
  });

  it("MessagingValidationError('missing_template_variables') → 400 missing_template_variables", async () => {
    vi.mocked(sendTransactionalEmail).mockRejectedValue(
      new MessagingValidationError(
        "missing_template_variables",
        "Missing required variables: order_id",
      ),
    );
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("missing_template_variables");
  });

  it("MessagingValidationError('template_not_found') → 400 template_not_found", async () => {
    vi.mocked(sendTransactionalEmail).mockRejectedValue(
      new MessagingValidationError("template_not_found", "Template not found."),
    );
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("template_not_found");
  });

  it("MessagingValidationError('invalid_subject') → 400 invalid_subject", async () => {
    vi.mocked(sendTransactionalEmail).mockRejectedValue(
      new MessagingValidationError(
        "invalid_subject",
        "Subject contains invalid characters (CR/LF).",
      ),
    );
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("invalid_subject");
  });

  // ---- Section 5: uses ctx.apiKey.userId, NOT ctx.apiKey.keyId ----------

  it("uses ctx.apiKey.userId (real User.id) NOT ctx.apiKey.keyId", async () => {
    // Mock verifyApiKey to return a key with keyId=99 but userId=42. The
    // route must use 42 (the User.id) for the sendReq, NOT 99 (the ApiKey.id).
    vi.mocked(verifyApiKey).mockResolvedValue(
      prodKey({ keyId: 99, userId: 42 }),
    );
    await POST(v1Req({ body: defaultBody }));
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendTransactionalEmail).mock.calls[0];
    const sendReq = call[0];
    expect(sendReq.userId).toBe(42);
    // Negative assertion: the route must NOT have used the keyId as the userId.
    expect(sendReq.userId).not.toBe(99);
    // And the sendReq shape — source is api_v1, environment is production.
    expect(sendReq.source).toBe("api_v1");
    expect(sendReq.environment).toBe("production");
  });

  // ---- Section 19: securityBucket="generic" ------------------------------

  it("securityBucket='generic' → isIpBlocked called, enforceIpSendLimit NOT called", async () => {
    // The messaging route passes { securityBucket: "generic" } to withApiKey.
    // That skips the OTP-specific per-IP send limiter (which would
    // inappropriately rate-limit transactional email sends), while keeping
    // the IP-block check (security/abuse protection).
    await POST(v1Req({ body: defaultBody }));
    // The IP-block check ALWAYS runs (regardless of bucket).
    expect(isIpBlocked).toHaveBeenCalled();
    // The OTP send limiter MUST NOT run for the generic bucket.
    expect(enforceIpSendLimit).not.toHaveBeenCalled();
    // And the OTP verify limiter obviously doesn't run either.
    expect(enforceIpVerifyLimit).not.toHaveBeenCalled();
  });

  it("securityBucket='generic' still respects IP block (403 ip_blocked)", async () => {
    vi.mocked(isIpBlocked).mockResolvedValue({ blocked: true, reason: "auto_rate_limit" });
    const res = await POST(v1Req({ body: defaultBody }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("ip_blocked");
    // The handler must NOT have run.
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
    // And neither OTP limiter was called (the IP block short-circuits first).
    expect(enforceIpSendLimit).not.toHaveBeenCalled();
    expect(enforceIpVerifyLimit).not.toHaveBeenCalled();
  });
});
