/**
 * Behavioral regression: /api/auth/resend-otp login eligibility (requirement #4).
 *
 * Proves that login OTP issuance respects account eligibility safely:
 *   - nonexistent account + login → soft 200, no issueOtp
 *   - unverified account + login → SAME soft 200, no issueOtp
 *   - verified account + login → issueOtp exactly once with purpose: "login"
 *
 * The public response for nonexistent and unverified login requests must be
 * indistinguishable. issueOtp() must NOT be called for ineligible accounts.
 *
 * Signup resend behavior is preserved (unverified signup → OTP issued;
 * verified signup → "already verified" soft 200).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ─────────────────────────────────────────────────────────────────

const issueOtpMock = vi.fn();

vi.mock("@/lib/otp/verifier", () => ({
  issueOtp: issueOtpMock,
}));

vi.mock("@/lib/security/gate", () => ({
  preflightOtpSend: vi.fn(async () => null),
}));

vi.mock("@/lib/security", () => ({
  getClientIp: vi.fn(() => null),
}));

vi.mock("@/lib/i18n/resolve", () => ({
  resolveRequestUserLocale: vi.fn(async () => "en"),
}));

const dbState = {
  user: null as null | { id: number; emailVerified: boolean },
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
  return new NextRequest("https://example.com/api/auth/resend-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  dbState.user = { id: 1, emailVerified: true };
  issueOtpMock.mockResolvedValue({
    requestId: "test-req",
    code: "123456",
    expiresAt: new Date(Date.now() + 600000),
  });
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("POST /api/auth/resend-otp — login eligibility (BLOCKER)", () => {
  it("login + nonexistent account → soft 200, no issueOtp", async () => {
    dbState.user = null;
    const { POST } = await import("@/app/api/auth/resend-otp/route");
    const res = await POST(makeRequest({ email: "nobody@example.com", purpose: "login" }));
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(issueOtpMock).not.toHaveBeenCalled();
  });

  it("login + unverified account → SAME soft 200, no issueOtp", async () => {
    dbState.user = { id: 2, emailVerified: false };
    const { POST } = await import("@/app/api/auth/resend-otp/route");
    const res = await POST(makeRequest({ email: "unverified@example.com", purpose: "login" }));
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(issueOtpMock).not.toHaveBeenCalled();
  });

  it("login + verified account → issueOtp exactly once with purpose: 'login'", async () => {
    dbState.user = { id: 3, emailVerified: true };
    const { POST } = await import("@/app/api/auth/resend-otp/route");
    const res = await POST(makeRequest({ email: "verified@example.com", purpose: "login" }));

    expect(res.status).toBe(200);
    expect(issueOtpMock).toHaveBeenCalledTimes(1);
    const call = issueOtpMock.mock.calls[0][0];
    expect(call.purpose).toBe("login");
    expect(call.userId).toBe(3);
    expect(call.email).toBe("verified@example.com");
  });

  it("login + nonexistent / login + unverified responses are INDISTINGUISHABLE", async () => {
    // Case 1: nonexistent
    dbState.user = null;
    const { POST } = await import("@/app/api/auth/resend-otp/route");
    const nonexistentRes = await POST(makeRequest({ email: "nobody@example.com", purpose: "login" }));
    const nonexistentBody = await nonexistentRes.json();

    // Case 2: unverified
    dbState.user = { id: 2, emailVerified: false };
    const unverifiedRes = await POST(makeRequest({ email: "unverified@example.com", purpose: "login" }));
    const unverifiedBody = await unverifiedRes.json();

    // Same status + same body.
    expect(nonexistentRes.status).toBe(unverifiedRes.status);
    expect(nonexistentRes.status).toBe(200);
    expect(nonexistentBody).toEqual(unverifiedBody);

    // issueOtp must NOT have been called for either case.
    expect(issueOtpMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/resend-otp — signup behavior preserved", () => {
  it("signup + unverified account → issueOtp with purpose: 'signup'", async () => {
    dbState.user = { id: 4, emailVerified: false };
    const { POST } = await import("@/app/api/auth/resend-otp/route");
    const res = await POST(makeRequest({ email: "signup@example.com", purpose: "signup" }));

    expect(res.status).toBe(200);
    expect(issueOtpMock).toHaveBeenCalledTimes(1);
    const call = issueOtpMock.mock.calls[0][0];
    expect(call.purpose).toBe("signup");
  });

  it("signup + verified account → soft 200 'already verified', no issueOtp", async () => {
    dbState.user = { id: 5, emailVerified: true };
    const { POST } = await import("@/app/api/auth/resend-otp/route");
    const res = await POST(makeRequest({ email: "verified@example.com", purpose: "signup" }));
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(issueOtpMock).not.toHaveBeenCalled();
  });
});
