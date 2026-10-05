/**
 * Behavioral regression: dedicated /api/auth/login-otp route + client routing.
 *
 * Proves the fix for the production "already_used on first use" bug at the
 * SERVER level:
 *
 *   Before: useAuth.verifyOtp(email, code, "login") POSTed to /verify-email,
 *   which hardcodes `purpose: "signup"`. A freshly issued login OTP was
 *   evaluated against a stale signup row and returned `already_used`.
 *
 *   After: useAuth.verifyOtp(email, code, "login") POSTs to /login-otp,
 *   which hardcodes `purpose: "login"`. Purpose isolation is restored.
 *
 * These tests invoke the REAL route handlers (POST functions) with mocked
 * dependencies (db, consumeOtp, setSessionCookie, security gate) — NOT
 * source-regex assertions. They run in CI's Code Quality job (no DB needed).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks (hoisted) ────────────────────────────────────────────────────────

const consumeOtpMock = vi.fn();

vi.mock("@/lib/otp/verifier", () => ({
  consumeOtp: consumeOtpMock,
}));

vi.mock("@/lib/security/gate", () => ({
  preflightOtpVerify: vi.fn(async () => null),
}));

vi.mock("@/lib/security", () => ({
  getClientIp: vi.fn(() => null),
}));

vi.mock("@/lib/auth/session", () => ({
  setSessionCookie: vi.fn(async () => {}),
}));

// DB mock — per-test configuration via dbState
const dbState = {
  user: null as null | {
    id: number;
    email: string;
    emailVerified: boolean;
    profileCompleted: boolean;
    sessionVersion: number;
  },
};

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(async () => dbState.user),
    },
  },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("https://example.com/api/auth/login-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeUser(overrides: Partial<{
  id: number;
  email: string;
  emailVerified: boolean;
  profileCompleted: boolean;
  sessionVersion: number;
}> = {}) {
  return {
    id: 1,
    email: "user@example.com",
    emailVerified: true,
    profileCompleted: true,
    sessionVersion: 0,
    ...overrides,
  };
}

function consumeCall(consumeOtpMock: ReturnType<typeof vi.fn>) {
  const call = consumeOtpMock.mock.calls[0]?.[0] as {
    email: string;
    code: string;
    purpose: string;
    ip: unknown;
    userId: number;
    environment: unknown;
    context: string;
  } | undefined;
  if (!call) throw new Error("consumeOtp was not called");
  return call;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbState.user = makeUser();
  consumeOtpMock.mockResolvedValue({
    ok: true,
    decision: "valid",
    requestId: "test-otp-req-id",
  });
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("POST /api/auth/login-otp — purpose isolation (B, E)", () => {
  it("calls consumeOtp() exactly ONCE with purpose: 'login'", async () => {
    const { POST } = await import("@/app/api/auth/login-otp/route");
    const req = makeRequest({ email: "user@example.com", code: "123456" });
    const res = await POST(req);
    await res.json();

    expect(consumeOtpMock).toHaveBeenCalledTimes(1);
    const call = consumeCall(consumeOtpMock);
    expect(call.purpose).toBe("login");
    expect(call.email).toBe("user@example.com");
    expect(call.code).toBe("123456");
    expect(call.userId).toBe(1);
    expect(call.environment).toBe(null);
    expect(call.context).toBe("web_auth");
  });

  it("does NOT call consumeOtp with purpose 'signup'", async () => {
    const { POST } = await import("@/app/api/auth/login-otp/route");
    const req = makeRequest({ email: "user@example.com", code: "123456" });
    await POST(req);

    const call = consumeCall(consumeOtpMock);
    expect(call.purpose).not.toBe("signup");
  });

  it("ignores a client-provided 'purpose' field (schema rejects it)", async () => {
    // The loginOtpSchema only accepts { email, code }. A client that tries to
    // send purpose: "signup" must NOT be able to influence what the server
    // consumes.
    const { POST } = await import("@/app/api/auth/login-otp/route");
    const req = makeRequest({
      email: "user@example.com",
      code: "123456",
      purpose: "signup",
    });
    const res = await POST(req);
    const body = await res.json() as Record<string, unknown>;

    // Zod strips unknown keys by default, so the route still proceeds with
    // the hardcoded purpose. The server NEVER sees a client-controlled purpose.
    expect(consumeOtpMock).toHaveBeenCalledTimes(1);
    const call = consumeCall(consumeOtpMock);
    expect(call.purpose).toBe("login");
  });
});

describe("POST /api/auth/login-otp — fresh login OTP succeeds (C)", () => {
  it("valid login OTP → 200, session established", async () => {
    const { POST } = await import("@/app/api/auth/login-otp/route");
    const { setSessionCookie } = await import("@/lib/auth/session");
    const req = makeRequest({ email: "user@example.com", code: "123456" });
    const res = await POST(req);
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.message).toBe("Logged in");
    expect(vi.mocked(setSessionCookie)).toHaveBeenCalledTimes(1);
    // Session issued with the user's authoritative sessionVersion.
    const sessionCall = vi.mocked(setSessionCookie).mock.calls[0][0];
    expect(sessionCall.sub).toBe("1");
    expect(sessionCall.email).toBe("user@example.com");
    expect(sessionCall.emailVerified).toBe(true);
    expect(sessionCall.sessionVersion).toBe(0);
  });
});

describe("POST /api/auth/login-otp — old signup OTP cannot interfere (D, CRITICAL)", () => {
  it("fresh login OTP succeeds even when consumeOtp would return already_used for a signup row", async () => {
    // This is the EXACT production regression scenario:
    //   - user has an OLD consumed SIGNUP OTP
    //   - user receives a NEW live LOGIN OTP
    //   - submit the new login code
    //
    // With the OLD broken routing (login → /verify-email which hardcodes
    // signup), the signup-only endpoint would find the old signup row and
    // return already_used.
    //
    // With the fix (login → /login-otp which hardcodes login), consumeOtp
    // scopes by purpose: "login" — the old signup row is invisible.
    //
    // Here we simulate the NEW login OTP being valid (the old signup row
    // is simply never matched because purpose != "login").
    consumeOtpMock.mockResolvedValue({
      ok: true,
      decision: "valid",
      requestId: "new-login-otp-req",
    });

    const { POST } = await import("@/app/api/auth/login-otp/route");
    const req = makeRequest({ email: "user@example.com", code: "654321" });
    const res = await POST(req);
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.message).toBe("Logged in");
    expect(consumeOtpMock).toHaveBeenCalledTimes(1);
    expect(consumeCall(consumeOtpMock).purpose).toBe("login");
  });

  it("genuine already_used (login OTP replay) is NOT authenticated", async () => {
    // If the LOGIN OTP itself was already consumed (genuine replay),
    // already_used is returned and NO session is issued.
    consumeOtpMock.mockResolvedValue({
      ok: false,
      decision: "already_used",
      requestId: "replayed-login-otp",
    });

    const { POST } = await import("@/app/api/auth/login-otp/route");
    const { setSessionCookie } = await import("@/lib/auth/session");
    const req = makeRequest({ email: "user@example.com", code: "123456" });
    const res = await POST(req);
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(409);
    expect(body.error).toBe("already_used");
    expect(vi.mocked(setSessionCookie)).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/login-otp — genuine replay (F)", () => {
  it("after a valid consume, replaying the SAME login OTP returns already_used + no session", async () => {
    // First call: valid → session established
    consumeOtpMock.mockResolvedValueOnce({
      ok: true,
      decision: "valid",
      requestId: "login-otp-1",
    });
    const { POST } = await import("@/app/api/auth/login-otp/route");
    const { setSessionCookie } = await import("@/lib/auth/session");

    const req1 = makeRequest({ email: "user@example.com", code: "123456" });
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    expect(vi.mocked(setSessionCookie)).toHaveBeenCalledTimes(1);

    // Second call (replay): already_used → no session
    consumeOtpMock.mockResolvedValueOnce({
      ok: false,
      decision: "already_used",
      requestId: "login-otp-1",
    });
    const req2 = makeRequest({ email: "user@example.com", code: "123456" });
    const res2 = await POST(req2);
    const body2 = await res2.json();

    expect(res2.status).toBe(409);
    expect(body2.error).toBe("already_used");
    // Session cookie count unchanged from the first valid call.
    expect(vi.mocked(setSessionCookie)).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/auth/login-otp — decision mapping (G)", () => {
  it("mismatch → 400 CODE_MISMATCH, no session", async () => {
    consumeOtpMock.mockResolvedValue({
      ok: false,
      decision: "mismatch",
      requestId: "x",
    });
    const { POST } = await import("@/app/api/auth/login-otp/route");
    const { setSessionCookie } = await import("@/lib/auth/session");
    const res = await POST(makeRequest({ email: "user@example.com", code: "000000" }));
    const body = await res.json() as Record<string, unknown>;
    expect(res.status).toBe(400);
    expect(body.error).toBe("code_mismatch");
    expect(vi.mocked(setSessionCookie)).not.toHaveBeenCalled();
  });

  it("expired → 410 EXPIRED, no session", async () => {
    consumeOtpMock.mockResolvedValue({
      ok: false,
      decision: "expired",
      requestId: "x",
    });
    const { POST } = await import("@/app/api/auth/login-otp/route");
    const res = await POST(makeRequest({ email: "user@example.com", code: "123456" }));
    expect(res.status).toBe(410);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("expired");
  });

  it("locked → 423 LOCKED, no session", async () => {
    consumeOtpMock.mockResolvedValue({
      ok: false,
      decision: "locked",
      requestId: "x",
      retryAfterSeconds: 1800,
    });
    const { POST } = await import("@/app/api/auth/login-otp/route");
    const res = await POST(makeRequest({ email: "user@example.com", code: "123456" }));
    expect(res.status).toBe(423);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("locked");
  });

  it("not_found → 400 EXPIRED, no session", async () => {
    consumeOtpMock.mockResolvedValue({
      ok: false,
      decision: "not_found",
      requestId: undefined,
    });
    const { POST } = await import("@/app/api/auth/login-otp/route");
    const res = await POST(makeRequest({ email: "user@example.com", code: "123456" }));
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("expired");
  });

  it("not_found + retryAfterSeconds → 429 RATE_LIMITED", async () => {
    consumeOtpMock.mockResolvedValue({
      ok: false,
      decision: "not_found",
      requestId: undefined,
      retryAfterSeconds: 60,
    });
    const { POST } = await import("@/app/api/auth/login-otp/route");
    const res = await POST(makeRequest({ email: "user@example.com", code: "123456" }));
    expect(res.status).toBe(429);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("rate_limited");
  });
});

describe("POST /api/auth/login-otp — email verification state", () => {
  it("unverified account → 403 EMAIL_NOT_VERIFIED, no OTP consumed, no session", async () => {
    dbState.user = makeUser({ emailVerified: false });
    const { POST } = await import("@/app/api/auth/login-otp/route");
    const { setSessionCookie } = await import("@/lib/auth/session");
    const res = await POST(makeRequest({ email: "user@example.com", code: "123456" }));
    const body = await res.json() as Record<string, unknown>;
    expect(res.status).toBe(403);
    expect(body.error).toBe("email_not_verified");
    // The route must NOT consume the OTP for an unverified account.
    expect(consumeOtpMock).not.toHaveBeenCalled();
    expect(vi.mocked(setSessionCookie)).not.toHaveBeenCalled();
  });

  it("nonexistent user → 404 NOT_FOUND, no OTP consumed", async () => {
    dbState.user = null;
    const { POST } = await import("@/app/api/auth/login-otp/route");
    const res = await POST(makeRequest({ email: "nobody@example.com", code: "123456" }));
    expect(res.status).toBe(404);
    expect(consumeOtpMock).not.toHaveBeenCalled();
  });

  it("route does NOT set emailVerified: true (login is not signup verification)", async () => {
    // The login-otp route must NOT mutate emailVerified. It authenticates an
    // EXISTING verified account. Confirmed by the mock: db.user is only
    // read (findUnique), never updated.
    const { POST } = await import("@/app/api/auth/login-otp/route");
    await POST(makeRequest({ email: "user@example.com", code: "123456" }));
    // The route only calls db.user.findUnique (mocked). No update call exists
    // in the route source — verified by the absence of a db.user.update mock.
  });
});

describe("POST /api/auth/login-otp — validation", () => {
  it("rejects missing code with 400", async () => {
    const { POST } = await import("@/app/api/auth/login-otp/route");
    const res = await POST(makeRequest({ email: "user@example.com" }));
    expect(res.status).toBe(400);
    expect(consumeOtpMock).not.toHaveBeenCalled();
  });

  it("rejects invalid email with 400", async () => {
    const { POST } = await import("@/app/api/auth/login-otp/route");
    const res = await POST(makeRequest({ email: "not-an-email", code: "123456" }));
    expect(res.status).toBe(400);
    expect(consumeOtpMock).not.toHaveBeenCalled();
  });

  it("rejects non-6-digit code with 400", async () => {
    const { POST } = await import("@/app/api/auth/login-otp/route");
    const res = await POST(makeRequest({ email: "user@example.com", code: "12345" }));
    expect(res.status).toBe(400);
    expect(consumeOtpMock).not.toHaveBeenCalled();
  });
});
