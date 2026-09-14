import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * withApiKey securityBucket selection regression tests (Phase 4).
 *
 * Pure unit tests — NO database. They mock @/lib/security, @/lib/db,
 * @/lib/dx/api-keys (preserving real hasScope + newRequestId), and the
 * entitlements engine so withApiKey can be exercised end-to-end WITHOUT a
 * database. They run in the generic CI job (no TEST_DATABASE_URL required).
 *
 * These tests exist to lock in two critical properties of the Phase 4
 * securityBucket refactor:
 *
 *   1. LEGACY DEFAULT (opts omitted) is unchanged:
 *      - requiredScope === "otp:verify" → enforceIpVerifyLimit (NOT send limiter)
 *      - any other scope             → enforceIpSendLimit  (NOT verify limiter)
 *      This protects the existing OTP routes (which all omit opts) from
 *      silently switching buckets.
 *
 *   2. PHASE 4 "generic" BUCKET skips the OTP-specific send limiter:
 *      - isIpBlocked IS called (IP-block check is shared)
 *      - enforceIpSendLimit is NOT called (no per-IP OTP send limit)
 *      - enforceIpVerifyLimit is NOT called
 *      This protects the messaging route from being rate-limited by the OTP
 *      per-IP send limiter (which would inappropriately throttle transactional
 *      email sends under the OTP budget).
 *
 *   3. EXPLICIT "otp_verify" / "otp_send" buckets override the scope-inferred
 *      default (so a route can choose its limiter regardless of its scope).
 *
 * The existing src/lib/dx/scope.test.ts already locks in hasScope() behavior
 * (full/read_only/otp:send/otp:verify). These tests complement it by locking
 * in the securityBucket selection that happens INSIDE withApiKey AFTER
 * hasScope passes.
 */

// ---- Mocks (must come BEFORE the request-context import) -------------------

vi.mock("@/lib/security", () => ({
  isIpBlocked: vi.fn(() => Promise.resolve({ blocked: false })),
  enforceIpSendLimit: vi.fn(() => Promise.resolve({ allowed: true })),
  enforceIpVerifyLimit: vi.fn(() => Promise.resolve({ allowed: true })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    requestLog: { create: vi.fn(() => Promise.resolve()) },
  },
}));

// Preserve the REAL hasScope + newRequestId — the scope gate uses real
// hasScope so its behavior is the production code path.
vi.mock("@/lib/dx/api-keys", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/dx/api-keys")>();
  return {
    ...real,
    verifyApiKey: vi.fn(),
  };
});

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

import { withApiKey } from "@/lib/dx/request-context";

const { verifyApiKey, hasScope } = await import("@/lib/dx/api-keys");
const { checkUsage } = await import("@/lib/entitlements/engine");
const {
  isIpBlocked,
  enforceIpSendLimit,
  enforceIpVerifyLimit,
} = await import("@/lib/security");

// ---- helpers ---------------------------------------------------------------

/** Build a NextRequest with a bearer token + an x-forwarded-for IP (so the
 *  security gate runs — without an IP, the gate is skipped because ip="unknown"). */
function makeReq(scope = "/api/v1/test") {
  return new NextRequest(`http://localhost${scope}`, {
    method: "POST",
    headers: {
      Authorization: "Bearer mg_live_testkey",
      "x-forwarded-for": "203.0.113.42",
    },
  });
}

/** A handler that always succeeds — its only job is to let withApiKey reach
 *  the end of the security gate so we can assert which enforceIp* ran. */
const okHandler = vi.fn(async () => NextResponse.json({ ok: true }));

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

function allowedUsage() {
  return {
    allowed: true,
    remaining: 100,
    resetAt: null,
    plan: "PRO" as const,
  };
}

// ---- tests -----------------------------------------------------------------

describe("withApiKey securityBucket selection (Phase 4 regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    okHandler.mockClear();
    okHandler.mockResolvedValue(NextResponse.json({ ok: true }));
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey());
    vi.mocked(checkUsage).mockResolvedValue(allowedUsage() as any);
    vi.mocked(isIpBlocked).mockResolvedValue({ blocked: false });
    vi.mocked(enforceIpSendLimit).mockResolvedValue({ allowed: true } as any);
    vi.mocked(enforceIpVerifyLimit).mockResolvedValue({ allowed: true } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Legacy default: opts omitted (existing OTP routes) ----------------

  it("legacy default (opts omitted) — scope 'otp:verify' uses enforceIpVerifyLimit (NOT send limiter)", async () => {
    // Existing OTP verify routes call withApiKey("otp:verify", handler) with
    // NO opts. The legacy default must route them through the verify limiter.
    const wrapped = withApiKey("otp:verify", okHandler);
    await wrapped(makeReq("/api/v1/otp/verify"));
    expect(enforceIpVerifyLimit).toHaveBeenCalledTimes(1);
    expect(enforceIpSendLimit).not.toHaveBeenCalled();
    expect(okHandler).toHaveBeenCalledTimes(1);
  });

  it("legacy default (opts omitted) — scope 'otp:send' uses enforceIpSendLimit (NOT verify limiter)", async () => {
    // Existing OTP send routes call withApiKey("otp:send", handler) with NO
    // opts. The legacy default must route them through the send limiter.
    const wrapped = withApiKey("otp:send", okHandler);
    await wrapped(makeReq("/api/v1/otp/send"));
    expect(enforceIpSendLimit).toHaveBeenCalledTimes(1);
    expect(enforceIpVerifyLimit).not.toHaveBeenCalled();
    expect(okHandler).toHaveBeenCalledTimes(1);
  });

  it("legacy default (opts omitted) — scope 'full' uses enforceIpSendLimit (everything non-otp:verify goes through the send limiter)", async () => {
    // A full-scope route (e.g. /api/v1/contacts) historically used the send
    // limiter. The refactor must NOT change this — non-otp:verify scopes use
    // the send limiter by default.
    const wrapped = withApiKey("full", okHandler);
    await wrapped(makeReq("/api/v1/contacts"));
    expect(enforceIpSendLimit).toHaveBeenCalledTimes(1);
    expect(enforceIpVerifyLimit).not.toHaveBeenCalled();
    expect(okHandler).toHaveBeenCalledTimes(1);
  });

  // ---- Phase 4: explicit "generic" bucket (messaging routes) ------------

  it("securityBucket='generic' — isIpBlocked called, neither OTP limiter called", async () => {
    // The messaging route passes { securityBucket: "generic" }. This skips
    // the OTP-specific per-IP send limiter entirely (transactional email
    // sends must NOT burn the OTP per-IP send budget) while keeping the
    // shared IP-block check.
    const wrapped = withApiKey("full", okHandler, { securityBucket: "generic" });
    await wrapped(makeReq("/api/v1/messages/send"));
    // IP-block check ALWAYS runs (shared security/abuse protection).
    expect(isIpBlocked).toHaveBeenCalledTimes(1);
    // The OTP send limiter MUST be skipped for the generic bucket.
    expect(enforceIpSendLimit).not.toHaveBeenCalled();
    // The OTP verify limiter MUST also be skipped.
    expect(enforceIpVerifyLimit).not.toHaveBeenCalled();
    // And the handler must still run (the security gate passed).
    expect(okHandler).toHaveBeenCalledTimes(1);
  });

  it("securityBucket='generic' still respects IP block (403 ip_blocked, handler not called)", async () => {
    // Even with the generic bucket, an IP that's been auto-blocked must be
    // rejected — the IP-block check is the floor of protection that always
    // runs regardless of bucket.
    vi.mocked(isIpBlocked).mockResolvedValueOnce({ blocked: true, reason: "auto_rate_limit" });
    const wrapped = withApiKey("full", okHandler, { securityBucket: "generic" });
    const res = await wrapped(makeReq("/api/v1/messages/send"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("ip_blocked");
    // Handler must NOT have run (gate short-circuits before it).
    expect(okHandler).not.toHaveBeenCalled();
    // And neither OTP limiter was called (the IP block short-circuits first).
    expect(enforceIpSendLimit).not.toHaveBeenCalled();
    expect(enforceIpVerifyLimit).not.toHaveBeenCalled();
  });

  // ---- Explicit bucket overrides the scope-inferred default --------------

  it("securityBucket='otp_verify' (explicit) overrides scope inference — full scope routes through verify limiter", async () => {
    // A route could explicitly request the verify limiter even with a
    // non-otp:verify scope. The explicit option takes precedence.
    const wrapped = withApiKey("full", okHandler, { securityBucket: "otp_verify" });
    await wrapped(makeReq("/api/v1/some/route"));
    expect(enforceIpVerifyLimit).toHaveBeenCalledTimes(1);
    expect(enforceIpSendLimit).not.toHaveBeenCalled();
  });

  it("securityBucket='otp_send' (explicit) overrides scope inference — otp:verify scope routes through send limiter", async () => {
    // The reverse: a route could explicitly request the send limiter even
    // though its scope is otp:verify (which would default to the verify
    // limiter). The explicit option wins.
    const wrapped = withApiKey("otp:verify", okHandler, { securityBucket: "otp_send" });
    await wrapped(makeReq("/api/v1/some/route"));
    expect(enforceIpSendLimit).toHaveBeenCalledTimes(1);
    expect(enforceIpVerifyLimit).not.toHaveBeenCalled();
  });

  // ---- Regression: scope gate behavior is unchanged ----------------------

  it("scope gate still rejects read_only for full-scope route (hasScope regression)", async () => {
    // Lock in hasScope behavior so the scope gate isn't accidentally widened.
    expect(hasScope("full", "full")).toBe(true);
    expect(hasScope("read_only", "full")).toBe(false);
    expect(hasScope("read_only", "otp:send")).toBe(false);
    expect(hasScope("read_only", "otp:verify")).toBe(false);

    vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ scopes: "read_only" }));
    const wrapped = withApiKey("full", okHandler, { securityBucket: "generic" });
    const res = await wrapped(makeReq("/api/v1/messages/send"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("insufficient_scope");
    // The security gate must NOT run when the scope gate already rejected.
    expect(isIpBlocked).not.toHaveBeenCalled();
    expect(enforceIpSendLimit).not.toHaveBeenCalled();
    expect(enforceIpVerifyLimit).not.toHaveBeenCalled();
    expect(okHandler).not.toHaveBeenCalled();
  });

  // ---- Regression: verify-limiter failure still produces 429 -----------

  it("securityBucket='otp_send' — verify limiter denial yields 429 rate_limited", async () => {
    vi.mocked(enforceIpSendLimit).mockResolvedValueOnce({
      allowed: false,
      code: "rate_limited",
      message: "Too many requests.",
      retryAfterSeconds: 60,
    } as any);
    const wrapped = withApiKey("full", okHandler); // legacy default → send limiter
    const res = await wrapped(makeReq("/api/v1/contacts"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    const data = await res.json();
    expect(data.error.code).toBe("rate_limited");
    expect(okHandler).not.toHaveBeenCalled();
  });
});
