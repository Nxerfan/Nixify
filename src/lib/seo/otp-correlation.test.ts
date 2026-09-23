/**
 * Phase 17 FINAL — OTP correlation identity tests.
 *
 * These tests prove the verify route returns the OTP correlation ID
 * (`otp_request_id`) from the EXACT OTP row that `consumeOtp()` evaluated —
 * NOT from a separate independent DB lookup that could cross environments or
 * race with a newly-issued OTP.
 *
 * The previous bug: `latestRequestId(email, purpose)` did NOT scope by
 * environment, so a production verify could return a development OTP ID.
 * These tests would have caught that.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mock state (hoisted) ──────────────────────────────────────────────────
const mockState = vi.hoisted(() => ({
  // What consumeOtp will return
  consumeResult: null as null | {
    ok: boolean;
    decision: string;
    requestId?: string;
    userId?: number;
    retryAfterSeconds?: number;
  },
  // What a hypothetical independent latestRequestId lookup would return (the WRONG one)
  wrongLookupId: "wrong-otp-id",
  // Whether the route called latestRequestId independently
  latestRequestIdCalled: false,
}));

vi.mock("@/lib/otp/verifier", () => ({
  consumeOtp: vi.fn(async () => mockState.consumeResult),
}));

vi.mock("@/lib/dx/webhooks", () => ({
  deliverWebhook: vi.fn(async (_event: unknown, _userId?: number | null) => {}) as any,
}));

vi.mock("@/lib/dx/sandbox", () => ({
  getSandboxSimulation: vi.fn(() => "none"),
}));

vi.mock("@/lib/dx/request-context", () => ({
  withApiKey: vi.fn((_scope: string, handler: any) => handler),
  okResponse: vi.fn((requestId: string, data: unknown) => {
    const body = { ...(data as Record<string, unknown>), request_id: requestId };
    return Response.json(body, { status: 200, headers: { "X-Request-Id": requestId } });
  }),
  errorResponse: vi.fn((requestId: string, status: number, code: string, message: string) => {
    return Response.json(
      { error: { code, message }, request_id: requestId },
      { status, headers: { "X-Request-Id": requestId } },
    );
  }),
  withRateLimitHeaders: vi.fn((res: any) => res),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUser: vi.fn(async () => null),
}));

vi.mock("@/lib/db", () => ({
  db: {
    otpCode: {
      findFirst: vi.fn(async () => {
        mockState.latestRequestIdCalled = true;
        return { requestId: mockState.wrongLookupId };
      }),
    },
  },
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Phase 17 FINAL — verify route uses consumeOtp requestId (not independent lookup)", () => {
  beforeEach(() => {
    mockState.consumeResult = null;
    mockState.wrongLookupId = "wrong-otp-id";
    mockState.latestRequestIdCalled = false;
    vi.clearAllMocks();
  });

  it("valid verify returns otp_request_id from consumeOtp result, not independent lookup", async () => {
    mockState.consumeResult = {
      ok: true,
      decision: "valid",
      requestId: "correct-otp-id",
    };

    const mod = await import("@/app/api/v1/otp/verify/route");
    const ctx = { requestId: "api-trace-123", apiKey: { environment: "production", keyId: 1, userId: null }, ip: null };
    const req = new Request("https://example.com/api/v1/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", code: "123456", purpose: "signup" }),
    });

    const res = await (mod.POST as any)(ctx, req);
    const body = await res.json();

    expect(body.otp_request_id).toBe("correct-otp-id");
    expect(body.otp_request_id).not.toBe("wrong-otp-id");
    // The independent latestRequestId lookup MUST NOT have been called
    expect(mockState.latestRequestIdCalled).toBe(false);
  });

  it("mismatch verify returns otp_request_id from consumeOtp result", async () => {
    mockState.consumeResult = {
      ok: false,
      decision: "mismatch",
      requestId: "mismatched-otp-id",
    };

    const mod = await import("@/app/api/v1/otp/verify/route");
    const ctx = { requestId: "api-trace-456", apiKey: { environment: "production", keyId: 1, userId: null }, ip: null };
    const req = new Request("https://example.com/api/v1/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", code: "000000", purpose: "signup" }),
    });

    const res = await (mod.POST as any)(ctx, req);
    // Error response doesn't include otp_request_id, but the webhook must use the correct ID.
    // Verify the webhook was called with the correct requestId.
    const webhooks = await import("@/lib/dx/webhooks");
    const webhookCall = (webhooks.deliverWebhook as any).mock.calls[0];
    expect(webhookCall[0]).toMatchObject({ requestId: "mismatched-otp-id" });
    expect(mockState.latestRequestIdCalled).toBe(false);
  });

  it("expired verify returns otp_request_id from consumeOtp result in webhook", async () => {
    mockState.consumeResult = {
      ok: false,
      decision: "expired",
      requestId: "expired-otp-id",
    };

    const mod = await import("@/app/api/v1/otp/verify/route");
    const ctx = { requestId: "api-trace-789", apiKey: { environment: "production", keyId: 1, userId: null }, ip: null };
    const req = new Request("https://example.com/api/v1/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", code: "123456", purpose: "signup" }),
    });

    await (mod.POST as any)(ctx, req);

    const webhooks = await import("@/lib/dx/webhooks");
    const webhookCall = (webhooks.deliverWebhook as any).mock.calls[0];
    expect(webhookCall[0]).toMatchObject({
      type: "otp.expired",
      requestId: "expired-otp-id",
    });
    expect(mockState.latestRequestIdCalled).toBe(false);
  });

  it("otp.verified webhook uses the exact requestId from consumeOtp", async () => {
    mockState.consumeResult = {
      ok: true,
      decision: "valid",
      requestId: "verified-otp-id",
    };

    const mod = await import("@/app/api/v1/otp/verify/route");
    const ctx = { requestId: "api-trace-webhook", apiKey: { environment: "production", keyId: 1, userId: null }, ip: null };
    const req = new Request("https://example.com/api/v1/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", code: "123456", purpose: "signup" }),
    });

    await (mod.POST as any)(ctx, req);

    const webhooks = await import("@/lib/dx/webhooks");
    const webhookCall = (webhooks.deliverWebhook as any).mock.calls[0];
    expect(webhookCall[0]).toMatchObject({
      type: "otp.verified",
      requestId: "verified-otp-id",
    });
  });

  it("ctx.requestId never masquerades as otp_request_id", async () => {
    // Even when consumeOtp returns no requestId (not_found), the response
    // must NOT use ctx.requestId as otp_request_id.
    mockState.consumeResult = {
      ok: false,
      decision: "not_found",
      requestId: undefined,
    };

    const mod = await import("@/app/api/v1/otp/verify/route");
    const ctx = { requestId: "api-trace-id", apiKey: { environment: "production", keyId: 1, userId: null }, ip: null };
    const req = new Request("https://example.com/api/v1/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email: "nobody@example.com", code: "123456", purpose: "signup" }),
    });

    const res = await (mod.POST as any)(ctx, req);
    const body = await res.json();

    // request_id = API trace ID (correct)
    expect(body.request_id).toBe("api-trace-id");
    // otp_request_id must NOT be the API trace ID
    expect(body.otp_request_id).not.toBe("api-trace-id");
  });

  it("race-safety: a newer OTP inserted between lookup and consume cannot cause ID drift", async () => {
    // Simulate: consumeOtp returns the OTP it evaluated ("consume-selected-id"),
    // but an independent lookup would have returned a DIFFERENT ("wrong-otp-id") OTP.
    // The route MUST return "consume-selected-id", proving it does NOT rely on
    // an independent lookup.
    mockState.consumeResult = {
      ok: true,
      decision: "valid",
      requestId: "consume-selected-id",
    };
    mockState.wrongLookupId = "wrong-otp-id-from-independent-lookup";

    const mod = await import("@/app/api/v1/otp/verify/route");
    const ctx = { requestId: "api-trace-race", apiKey: { environment: "production", keyId: 1, userId: null }, ip: null };
    const req = new Request("https://example.com/api/v1/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", code: "123456", purpose: "signup" }),
    });

    const res = await (mod.POST as any)(ctx, req);
    const body = await res.json();

    expect(body.otp_request_id).toBe("consume-selected-id");
    expect(body.otp_request_id).not.toBe("wrong-otp-id-from-independent-lookup");
    expect(mockState.latestRequestIdCalled).toBe(false);
  });
});

// ─── Cross-environment test (architectural proof) ─────────────────────────

describe("Phase 17 FINAL — cross-environment OTP correlation safety", () => {
  it("production verify returns production OTP ID, not development OTP ID", async () => {
    // consumeOtp with environment="production" returns the PRODUCTION OTP's requestId.
    // An independent unscoped lookup would have returned the dev OTP (created later).
    mockState.consumeResult = {
      ok: true,
      decision: "valid",
      requestId: "prod-otp-id",
    };
    mockState.wrongLookupId = "dev-otp-id"; // what the OLD bug would have returned

    const mod = await import("@/app/api/v1/otp/verify/route");
    const ctx = {
      requestId: "api-trace-prod",
      apiKey: { environment: "production", keyId: 1, userId: null },
      ip: null,
    };
    const req = new Request("https://example.com/api/v1/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", code: "123456", purpose: "signup" }),
    });

    const res = await (mod.POST as any)(ctx, req);
    const body = await res.json();

    expect(body.otp_request_id).toBe("prod-otp-id");
    expect(body.otp_request_id).not.toBe("dev-otp-id");
  });

  it("development verify returns development OTP ID, not production OTP ID", async () => {
    mockState.consumeResult = {
      ok: true,
      decision: "valid",
      requestId: "dev-otp-id",
    };
    mockState.wrongLookupId = "prod-otp-id";

    const mod = await import("@/app/api/v1/otp/verify/route");
    const ctx = {
      requestId: "api-trace-dev",
      apiKey: { environment: "development", keyId: 1, userId: null },
      ip: null,
    };
    const req = new Request("https://example.com/api/v1/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", code: "123456", purpose: "signup" }),
    });

    const res = await (mod.POST as any)(ctx, req);
    const body = await res.json();

    expect(body.otp_request_id).toBe("dev-otp-id");
    expect(body.otp_request_id).not.toBe("prod-otp-id");
  });
});
