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
const { db } = await import("@/lib/db");

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
 *  the end of the security gate so we can assert which enforceIp* ran.
 *  Returns a FRESH NextResponse per call (a shared response body can only be
 *  read once). */
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

// ---- v1 request correlation + safe logging (observability stage) ---------
//
// These tests lock in the production-observability contract:
//   - an unexpected handler error returns a safe `internal_error` response;
//   - the response still includes the SAME server-generated request_id;
//   - X-Request-Id matches;
//   - the structured log includes requestId + component;
//   - raw exception message / Authorization / API key are ABSENT from the log;
//   - RequestLog persistence failure does NOT change a successful API response;
//   - persistence failure emits ONE bounded warning (no raw DB exception text).

describe("withApiKey v1 request correlation + safe logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyApiKey).mockResolvedValue(prodKey());
    vi.mocked(checkUsage).mockResolvedValue(allowedUsage() as any);
    vi.mocked(isIpBlocked).mockResolvedValue({ blocked: false });
    vi.mocked(enforceIpSendLimit).mockResolvedValue({ allowed: true } as any);
    vi.mocked(enforceIpVerifyLimit).mockResolvedValue({ allowed: true } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("unexpected handler error returns safe `internal_error` with the same server-generated request_id", async () => {
    // The handler throws — withApiKey must catch and return a 500 internal_error.
    const throwingHandler = vi.fn(async () => {
      throw new Error("internal boom with secret host=ep-leak.neon.tech password=hunter2");
    });
    const wrapped = withApiKey("full", throwingHandler, { securityBucket: "generic" });
    const res = await wrapped(makeReq("/api/v1/contacts"));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error.code).toBe("internal_error");
    expect(data.error.message).toBe("An unexpected error occurred.");
    // The response body's request_id is the server-generated one.
    expect(data.request_id).toBeTruthy();
    // X-Request-Id header matches the body request_id.
    expect(res.headers.get("X-Request-Id")).toBe(data.request_id);
    // The raw exception message must NOT leak into the response.
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("ep-leak.neon.tech");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("internal boom");
  });

  it("X-Request-Id is always set and is server-generated (not caller-supplied)", async () => {
    // A caller may try to supply their own X-Request-Id; it must be ignored —
    // the server generates the canonical correlation ID.
    const reqWithCallerId = new NextRequest("http://localhost/api/v1/test", {
      method: "POST",
      headers: {
        Authorization: "Bearer mg_live_testkey",
        "x-forwarded-for": "203.0.113.42",
        "X-Request-Id": "attacker-supplied-id",
      },
    });
    const wrapped = withApiKey("full", okHandler, { securityBucket: "generic" });
    const res = await wrapped(reqWithCallerId);
    const serverId = res.headers.get("X-Request-Id");
    expect(serverId).toBeTruthy();
    expect(serverId).not.toBe("attacker-supplied-id");
    // The handler's response body doesn't include request_id (okHandler returns
    // { ok: true }), but the header is the canonical correlation ID.
    expect(res.headers.get("X-Request-Id")).toBe(serverId);
  });

  it("separates runtime environment from API-key environment (dev key + NODE_ENV=production)", async () => {
    // A development/sandbox API key (environment="development") used while
    // NODE_ENV=production. The canonical `environment` field must remain
    // "production" (runtime), and `apiEnvironment` must be "development"
    // (the API key's environment) — neither overwriting the other.
    const prevNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    vi.resetModules();
    const lines: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: unknown) => {
      const s = typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
      s.split("\n").forEach((l) => l.trim() && lines.push(l));
      return true;
    }) as typeof process.stderr.write;
    try {
      // Use a dev/sandbox API key.
      vi.mocked(verifyApiKey).mockResolvedValue(prodKey({ environment: "development" }));
      const throwingHandler = vi.fn(async () => {
        throw new Error("induced failure for env-separation test");
      });
      const { withApiKey: freshWithApiKey } = await import("@/lib/dx/request-context");
      const wrapped = freshWithApiKey("full", throwingHandler, { securityBucket: "generic" });
      await wrapped(makeReq("/api/v1/contacts"));
    } finally {
      process.stderr.write = origWrite;
      (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
    }
    const errorLine = lines.find((l) => l.includes("v1_request_failed"));
    expect(errorLine, "a v1_request_failed structured log must have been emitted").toBeTruthy();
    const entry = JSON.parse(errorLine!);
    // Canonical runtime environment is production (from NODE_ENV).
    expect(entry.environment).toBe("production");
    // The API-key environment is development (from the sandbox key).
    expect(entry.apiEnvironment).toBe("development");
    // The two are distinct.
    expect(entry.environment).not.toBe(entry.apiEnvironment);
  });

  it("structured log on handler error includes requestId + component, excludes raw exception + Authorization + API key", async () => {
    // Capture stderr (logger.error writes there in production).
    const prevNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    vi.resetModules();
    const lines: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: unknown) => {
      const s = typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
      s.split("\n").forEach((l) => l.trim() && lines.push(l));
      return true;
    }) as typeof process.stderr.write;
    try {
      // Re-import so the logger picks up NODE_ENV=production.
      const { withApiKey: freshWithApiKey } = await import("@/lib/dx/request-context");
      const throwingHandler = vi.fn(async () => {
        throw new Error("secret host=ep-leak.neon.tech password=hunter2");
      });
      const wrapped = freshWithApiKey("full", throwingHandler, { securityBucket: "generic" });
      const res = await wrapped(makeReq("/api/v1/contacts"));
      expect(res.status).toBe(500);
    } finally {
      process.stderr.write = origWrite;
      (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
    }

    // Find the structured error log line.
    const errorLine = lines.find((l) => l.includes("v1_request_failed"));
    expect(errorLine, "a v1_request_failed structured log must have been emitted").toBeTruthy();
    const entry = JSON.parse(errorLine!);
    expect(entry.component).toBe("v1_api");
    expect(entry.requestId).toBeTruthy();
    expect(entry.message).toBe("v1_request_failed");
    expect(entry.method).toBe("POST");
    expect(entry.path).toBe("/api/v1/contacts");
    expect(entry.apiKeyId).toBe(99);
    expect(entry.environment).toBe("production");
    // The error field is a bounded SafeErrorRep — no raw message.
    expect(entry.error.name).toBeTruthy();
    expect(entry.error.diagnostic).toBeTruthy();
    expect(entry.error.message).toBeUndefined();
    expect(entry.error.stack).toBeUndefined();

    // NOTHING in the log line may contain the raw exception secrets.
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain("ep-leak.neon.tech");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("secret host");
    // Authorization header value must not leak.
    expect(serialized).not.toContain("mg_live_testkey");
    // The raw Authorization key/value must be redacted if present at all.
    expect(serialized).not.toMatch(/"authorization"\s*:\s*"Bearer/);
  });

  it("RequestLog persistence failure does NOT change a successful API response", async () => {
    // The handler succeeds; RequestLog.create rejects. The response must still
    // be the successful handler response (200 with { ok: true }).
    vi.mocked(db.requestLog.create).mockRejectedValueOnce(
      Object.assign(new Error("connection refused at db.internal.host:5432 user=admin"), { code: "P1001" }),
    );
    const wrapped = withApiKey("full", okHandler, { securityBucket: "generic" });
    const res = await wrapped(makeReq("/api/v1/contacts"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    // X-Request-Id header is still present (canonical correlation).
    expect(res.headers.get("X-Request-Id")).toBeTruthy();
  });

  it("RequestLog persistence failure emits ONE bounded warning with no raw DB exception text", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    vi.resetModules();
    const lines: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: unknown) => {
      const s = typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk);
      s.split("\n").forEach((l) => l.trim() && lines.push(l));
      return true;
    }) as typeof process.stderr.write;
    try {
      vi.resetModules();
      const { db: freshDb } = await import("@/lib/db");
      vi.mocked(freshDb.requestLog.create).mockRejectedValueOnce(
        Object.assign(new Error("connection refused at db.internal.host:5432 user=admin password=leak"), { code: "P1001" }),
      );
      const { withApiKey: freshWithApiKey } = await import("@/lib/dx/request-context");
      const wrapped = freshWithApiKey("full", okHandler, { securityBucket: "generic" });
      await wrapped(makeReq("/api/v1/contacts"));
    } finally {
      process.stderr.write = origWrite;
      (process.env as Record<string, string | undefined>).NODE_ENV = prevNodeEnv;
    }

    const warnLine = lines.find((l) => l.includes("requestlog_persist_failed"));
    expect(warnLine, "a requestlog_persist_failed warning must have been emitted").toBeTruthy();
    const entry = JSON.parse(warnLine!);
    expect(entry.level).toBe("warn");
    expect(entry.message).toBe("requestlog_persist_failed");
    expect(entry.component).toBe("v1_api");
    expect(entry.requestId).toBeTruthy();
    // The error field is a bounded SafeErrorRep — no raw DB exception text.
    expect(entry.error.diagnostic).toBe("database_unreachable");
    expect(entry.error.prismaCode).toBe("P1001");
    expect(entry.error.message).toBeUndefined();
    expect(entry.error.stack).toBeUndefined();

    // NOTHING in the warning may contain raw DB exception fragments.
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain("db.internal.host");
    expect(serialized).not.toContain("leak");
    expect(serialized).not.toContain("admin");
    expect(serialized).not.toContain("connection refused");
    // Exactly ONE warning (no recursive logging loop).
    const warnCount = lines.filter((l) => l.includes("requestlog_persist_failed")).length;
    expect(warnCount).toBe(1);
  });
});
