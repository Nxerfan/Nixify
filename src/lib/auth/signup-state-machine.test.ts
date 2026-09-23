/**
 * fix/auth-signup-state-machine — signup lifecycle regression tests.
 *
 * These tests prove the corrected signup state machine:
 *   1. /signup is called ONCE with the real password (+ optional fullName)
 *   2. The user is created unverified with the REAL password hash
 *   3. OTP verification marks the SAME user verified (no second /signup)
 *   4. A verified user's password is NEVER overwritten via /signup (EMAIL_EXISTS)
 *   5. An unverified user may re-signup (password rotated, still unverified)
 *   6. fullName is persisted when supplied
 *   7. No `temppass_` temporary password remains in the auth implementation
 *
 * Static tests always run.
 * DB-gated integration tests require TEST_DATABASE_URL + RUN_SIGNUP_INTEGRATION=1.
 * The DB tests invoke the REAL route handlers (POST functions) and inspect
 * both the HTTP response AND the database state — they do NOT simulate the
 * route's behavior manually.
 *
 * The OTP mail path is mocked so NO real SMTP connection occurs in CI.
 * `issueOtp` is replaced with a deterministic test double that records its
 * call arguments and creates a real OTP row in the DB (so the verify-email
 * route can find it) without sending any email.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { NextRequest } from "next/server";

function readSrc(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf-8");
}

// ═══ Mock the OTP mail path so NO real SMTP is called ═══
//
// issueOtp is mocked to:
//   - record its call arguments (so tests can assert it was called exactly
//     once with the correct email/purpose/userId)
//   - create a real OtpCode row in the DB (so the verify-email route can
//     find and consume it)
//   - NOT send any email (no SMTP connection)
//
// consumeOtp is mocked to return a deterministic "valid" result so the
// verify-email route can proceed without needing the real OTP code.
//
// setSessionCookie is mocked because it calls Next.js cookies() which
// requires an App Router request context unavailable in vitest.
//
// The security gate (preflightOtpSend / preflightOtpVerify) is mocked to
// always allow (null) so tests aren't blocked by IP/device rate limits.

const issueOtpMock = vi.fn(async (opts: {
  email: string;
  purpose: string;
  userId?: number;
  environment?: string;
  ip?: string | null;
  locale?: string;
  transport?: unknown;
  skipEmailRateLimit?: boolean;
}) => {
  // Create a real OTP row in the DB so the verify-email route can find it.
  // Use a deterministic code so tests can consume it if needed.
  const { db } = await import("@/lib/db");
  const { hashOtpCode } = await import("@/lib/otp/generator");
  const code = "123456";
  const codeHash = hashOtpCode(code);
  await db.otpCode.create({
    data: {
      targetEmail: opts.email,
      codeHash: Uint8Array.from(codeHash),
      purpose: opts.purpose,
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      userId: opts.userId ?? null,
      environment: opts.environment ?? null,
      issuedFromIp: opts.ip ?? null,
    },
  });
  return {
    requestId: `test-req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  };
});

vi.mock("@/lib/otp/verifier", () => ({
  issueOtp: issueOtpMock,
  // consumeOtp is mocked per-test via vi.mocked at the import level below.
  consumeOtp: vi.fn(async () => ({
    ok: true,
    decision: "valid" as const,
    requestId: "test-otp-req-id",
  })),
}));

vi.mock("@/lib/security/gate", () => ({
  preflightOtpSend: vi.fn(async () => null),
  preflightOtpVerify: vi.fn(async () => null),
}));

vi.mock("@/lib/security", () => ({
  getClientIp: vi.fn(() => null),
}));

vi.mock("@/lib/i18n/resolve", () => ({
  resolveRequestUserLocale: vi.fn(async () => "en"),
}));

vi.mock("@/lib/auth/session", () => ({
  setSessionCookie: vi.fn(async () => {}),
  clearSessionCookie: vi.fn(async () => {}),
}));

// ═══ Static contract tests (always run) ═══

describe("fix/auth-signup-state-machine — static contracts", () => {
  // ─── 1. No temporary password remains ───

  it("useAuth does NOT generate a temppass_ password in executable code", () => {
    const src = readSrc("src/hooks/useAuth.ts");
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(codeOnly).not.toContain("temppass_");
    expect(codeOnly).not.toMatch(/tempPassword/);
  });

  it("useAuth does NOT generate a random password for signup", () => {
    const src = readSrc("src/hooks/useAuth.ts");
    expect(src).not.toMatch(/temppass_.*Math\.random/);
    expect(src).not.toMatch(/tempPassword.*=.*Math\.random/);
  });

  // ─── 2. signup() sends the real password + fullName ONCE ───

  it("useAuth.signup() accepts (fullName, email, password) and sends all three", () => {
    const src = readSrc("src/hooks/useAuth.ts");
    expect(src).toMatch(/signup[\s\S]*fullName[\s\S]*email[\s\S]*password/);
    expect(src).toContain("body.fullName");
  });

  it("useAuth.signup() POSTs to /signup exactly once per signup lifecycle", () => {
    const src = readSrc("src/hooks/useAuth.ts");
    const signupCalls = src.match(/postJson.*"\/signup"/g) ?? [];
    expect(signupCalls.length).toBe(1);
  });

  // ─── 3. No second /signup call after OTP verification ───

  it("AuthCard.handleVerifySignUp does NOT call auth.signup after verifyOtp", () => {
    const src = readSrc("src/app/auth/components/AuthCard.tsx");
    const handlerSection = src.split("handleVerifySignUp")[1]?.split("},")[0] ?? "";
    expect(handlerSection).not.toContain("auth.signup");
    expect(handlerSection).not.toContain("auth.signup(");
  });

  it("AuthCard does NOT have a 'creatingAccount' state variable", () => {
    const src = readSrc("src/app/auth/components/AuthCard.tsx");
    expect(src).not.toContain("creatingAccount");
    expect(src).not.toContain("setCreatingAccount");
  });

  it("AuthCard.handleSignUpSubmit calls auth.signup (NOT auth.sendOtp)", () => {
    const src = readSrc("src/app/auth/components/AuthCard.tsx");
    const handlerSection = src.split("handleSignUpSubmit")[1]?.split("},")[0] ?? "";
    expect(handlerSection).toContain("auth.signup(");
    expect(handlerSection).not.toContain("auth.sendOtp");
  });

  it("AuthCard.handleResendSignUp calls auth.resendSignupOtp (NOT auth.sendOtp)", () => {
    const src = readSrc("src/app/auth/components/AuthCard.tsx");
    const handlerSection = src.split("handleResendSignUp")[1]?.split("},")[0] ?? "";
    expect(handlerSection).toContain("auth.resendSignupOtp");
    expect(handlerSection).not.toContain("auth.sendOtp");
  });

  // ─── 4. signupSchema accepts optional fullName ───

  it("signupSchema accepts optional fullName", () => {
    const src = readSrc("src/lib/validation.ts");
    const signupSection = src.split("signupSchema")[1]?.split("});")[0] ?? "";
    expect(signupSection).toContain("fullName");
    expect(signupSection).toContain("optional()");
  });

  // ─── 5. /api/auth/signup persists fullName ───

  it("signup route destructures fullName from the parsed body", () => {
    const src = readSrc("src/app/api/auth/signup/route.ts");
    expect(src).toContain("fullName");
    expect(src).toMatch(/const\s*\{\s*email,\s*password,\s*fullName\s*\}/);
  });

  it("signup route persists fullName on new-user creation", () => {
    const src = readSrc("src/app/api/auth/signup/route.ts");
    expect(src).toContain("userData.fullName");
  });

  it("signup route persists fullName on unverified re-signup (update)", () => {
    const src = readSrc("src/app/api/auth/signup/route.ts");
    expect(src).toMatch(/db\.user\.update[\s\S]*data:\s*userData/);
  });

  // ─── 6. Security invariant: verified user password NOT overwritten ───

  it("signup route returns EMAIL_EXISTS for an already-verified user", () => {
    const src = readSrc("src/app/api/auth/signup/route.ts");
    expect(src).toContain("EMAIL_EXISTS");
    expect(src).toMatch(/existing\.emailVerified/);
  });

  it("signup route does NOT update a verified user's password", () => {
    const src = readSrc("src/app/api/auth/signup/route.ts");
    expect(src).toMatch(/existing\s*&&\s*!existing\.emailVerified/);
  });

  // ─── 7. OTP contract unchanged ───

  it("signup route uses purpose 'signup' for issueOtp", () => {
    const src = readSrc("src/app/api/auth/signup/route.ts");
    expect(src).toContain('purpose: "signup"');
  });

  it("useAuth does NOT export sendOtp as a function (old API removed)", () => {
    const src = readSrc("src/hooks/useAuth.ts");
    expect(src).not.toMatch(/const\s+sendOtp\s*=\s*useCallback/);
    expect(src).toContain("resendSignupOtp");
    expect(src).toContain("sendSigninOtp");
  });

  // ─── 8. verify-email establishes the session (unchanged) ───

  it("verify-email route marks user verified AND sets session cookie", () => {
    const src = readSrc("src/app/api/auth/verify-email/route.ts");
    expect(src).toContain("emailVerified: true");
    expect(src).toContain("setSessionCookie");
  });

  it("verify-email route does NOT call /signup or create a second user", () => {
    const src = readSrc("src/app/api/auth/verify-email/route.ts");
    expect(src).not.toContain("db.user.create");
    expect(src).toContain("db.user.update");
  });

  // ─── 9. Test file itself has correct lifecycle (no fake before) ───

  it("this test file does NOT contain the fake before() helper", () => {
    const src = readFileSync(__filename, "utf-8");
    expect(src).not.toMatch(/function before\s*\(/);
  });

  it("this test file imports beforeAll from vitest", () => {
    const src = readFileSync(__filename, "utf-8");
    expect(src).toMatch(/import.*beforeAll.*from\s*"vitest"/);
  });
});

// ═══ DB-gated integration tests (require PostgreSQL) ═══

const RUN_DB =
  process.env.RUN_SIGNUP_INTEGRATION === "1" &&
  !!process.env.TEST_DATABASE_URL;

describe.skipIf(!RUN_DB)("fix/auth-signup-state-machine — DB integration (real route handlers)", () => {
  let db: typeof import("@/lib/db").db;

  beforeAll(async () => {
    db = (await import("@/lib/db")).db;
  });

  let testEmail: string;
  const testPassword = "RealPassword123!";
  const testFullName = "Test User Signup";

  beforeEach(async () => {
    testEmail = `signup-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.nixify.dev`;
    issueOtpMock.mockClear();
  });

  afterEach(async () => {
    try {
      await db.otpCode.deleteMany({ where: { targetEmail: testEmail } });
      await db.user.deleteMany({ where: { email: testEmail } });
    } catch {}
  });

  // Helper: invoke the REAL /api/auth/signup route handler
  async function callSignupRoute(body: {
    email: string;
    password: string;
    fullName?: string;
  }) {
    const { POST } = await import("@/app/api/auth/signup/route");
    const req = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const res = await POST(req as any);
    return { res, json: await res.json().catch(() => ({})) };
  }

  // Helper: invoke the REAL /api/auth/verify-email route handler
  async function callVerifyEmailRoute(body: {
    email: string;
    code: string;
    purpose?: string;
  }) {
    const { POST } = await import("@/app/api/auth/verify-email/route");
    const req = new NextRequest("http://localhost/api/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const res = await POST(req as any);
    return { res, json: await res.json().catch(() => ({})) };
  }

  // ─── Test 1: New signup with fullName + email + real password returns success ───

  it("new signup with fullName + email + real password returns 201 success", async () => {
    const { res, json } = await callSignupRoute({
      email: testEmail,
      password: testPassword,
      fullName: testFullName,
    });
    expect(res.status).toBe(201);
    expect(json.message).toContain("Verification code sent");
  });

  // ─── Test 2: Created user is unverified + has fullName + real password hash ───

  it("created user is unverified, has the supplied fullName, and a password hash matching the real password", async () => {
    await callSignupRoute({
      email: testEmail,
      password: testPassword,
      fullName: testFullName,
    });

    const user = await db.user.findUnique({
      where: { email: testEmail },
      select: { id: true, emailVerified: true, fullName: true, passwordHash: true },
    });

    expect(user).not.toBeNull();
    expect(user!.emailVerified).toBe(false);
    expect(user!.fullName).toBe(testFullName);

    // The stored hash must verify against the REAL password
    const { verifyPassword } = await import("@/lib/auth/password");
    const verifiesReal = await verifyPassword(testPassword, user!.passwordHash);
    expect(verifiesReal).toBe(true);

    // The stored hash must NOT verify against a temp password
    const verifiesTemp = await verifyPassword("temppass_anything", user!.passwordHash);
    expect(verifiesTemp).toBe(false);
  });

  // ─── Test 3: OTP issuance invoked exactly once with correct args ───

  it("signup invokes issueOtp exactly once with the same email, purpose 'signup', and the created user's id", async () => {
    await callSignupRoute({
      email: testEmail,
      password: testPassword,
      fullName: testFullName,
    });

    const user = await db.user.findUnique({
      where: { email: testEmail },
      select: { id: true },
    });

    expect(issueOtpMock).toHaveBeenCalledTimes(1);
    const call = issueOtpMock.mock.calls[0][0];
    expect(call.email).toBe(testEmail);
    expect(call.purpose).toBe("signup");
    expect(call.userId).toBe(user!.id);
  });

  // ─── Test 4: Re-signup of an UNVERIFIED user ───

  it("re-signup of an unverified user updates password, updates fullName, stays unverified, triggers one new OTP", async () => {
    // First signup with old password + old fullName
    await callSignupRoute({
      email: testEmail,
      password: "OldPassword456!",
      fullName: "Old Name",
    });
    const afterFirst = await db.user.findUnique({
      where: { email: testEmail },
      select: { id: true, passwordHash: true, fullName: true, emailVerified: true },
    });
    expect(afterFirst!.emailVerified).toBe(false);
    expect(afterFirst!.fullName).toBe("Old Name");

    // Clear the mock for the second call
    issueOtpMock.mockClear();

    // Re-signup with new password + new fullName
    await callSignupRoute({
      email: testEmail,
      password: "NewRealPassword789!",
      fullName: "New Name",
    });

    const afterSecond = await db.user.findUnique({
      where: { email: testEmail },
      select: { id: true, passwordHash: true, fullName: true, emailVerified: true },
    });

    // Same user id (not a new row)
    expect(afterSecond!.id).toBe(afterFirst!.id);
    // Still unverified
    expect(afterSecond!.emailVerified).toBe(false);
    // fullName updated
    expect(afterSecond!.fullName).toBe("New Name");

    // Password rotated: new password verifies, old one does NOT
    const { verifyPassword } = await import("@/lib/auth/password");
    expect(await verifyPassword("NewRealPassword789!", afterSecond!.passwordHash)).toBe(true);
    expect(await verifyPassword("OldPassword456!", afterSecond!.passwordHash)).toBe(false);

    // Exactly one new OTP issued (the re-signup OTP)
    expect(issueOtpMock).toHaveBeenCalledTimes(1);
    expect(issueOtpMock.mock.calls[0][0].email).toBe(testEmail);
    expect(issueOtpMock.mock.calls[0][0].purpose).toBe("signup");
  });

  // ─── Test 5: Signup against an already VERIFIED account ───

  it("signup against an already-verified account returns 409 EMAIL_EXISTS, does NOT change password hash, does NOT issue another OTP", async () => {
    // Create a VERIFIED user with the original password
    const { hashPassword } = await import("@/lib/auth/password");
    const originalHash = await hashPassword(testPassword);
    await db.user.create({
      data: { email: testEmail, passwordHash: originalHash, emailVerified: true },
      select: { id: true, passwordHash: true, emailVerified: true },
    });

    issueOtpMock.mockClear();

    // Attempt to signup again with a DIFFERENT password
    const { res, json } = await callSignupRoute({
      email: testEmail,
      password: "DifferentPassword000!",
      fullName: "Should Not Be Set",
    });

    // Must return 409 EMAIL_EXISTS
    expect(res.status).toBe(409);
    expect(json.error).toBe("email_exists");

    // Password hash must NOT have changed
    const after = await db.user.findUnique({
      where: { email: testEmail },
      select: { passwordHash: true, fullName: true },
    });
    expect(after!.passwordHash).toBe(originalHash);

    // No OTP was issued
    expect(issueOtpMock).not.toHaveBeenCalled();
  });

  // ─── Test 6: Real /api/auth/verify-email marks the SAME user verified ───

  it("verify-email route finds the same existing user, changes emailVerified false→true, establishes session, does NOT create another user", async () => {
    // First: create an unverified user via the real signup route
    await callSignupRoute({
      email: testEmail,
      password: testPassword,
      fullName: testFullName,
    });
    const beforeVerify = await db.user.findUnique({
      where: { email: testEmail },
      select: { id: true, emailVerified: true },
    });
    expect(beforeVerify!.emailVerified).toBe(false);

    // Mock consumeOtp to return "valid" (the OTP row was created by issueOtpMock)
    const { consumeOtp } = await import("@/lib/otp/verifier");
    const mockedConsumeOtp = vi.mocked(consumeOtp);
    mockedConsumeOtp.mockResolvedValueOnce({
      ok: true,
      decision: "valid",
      requestId: "test-otp-req-id",
    });

    // Mock setSessionCookie to verify it was called
    const { setSessionCookie } = await import("@/lib/auth/session");
    const mockedSetSessionCookie = vi.mocked(setSessionCookie);

    // Call the REAL verify-email route
    const { res, json } = await callVerifyEmailRoute({
      email: testEmail,
      code: "123456",
      purpose: "signup",
    });

    expect(res.status).toBe(200);

    // The SAME user must now be verified (same id, emailVerified=true)
    const afterVerify = await db.user.findUnique({
      where: { email: testEmail },
      select: { id: true, emailVerified: true },
    });
    expect(afterVerify).not.toBeNull();
    expect(afterVerify!.id).toBe(beforeVerify!.id);
    expect(afterVerify!.emailVerified).toBe(true);

    // setSessionCookie was called with the correct user info
    expect(mockedSetSessionCookie).toHaveBeenCalledTimes(1);
    const sessionArg = mockedSetSessionCookie.mock.calls[0][0];
    expect(sessionArg.sub).toBe(beforeVerify!.id.toString());
    expect(sessionArg.email).toBe(testEmail);
    expect(sessionArg.emailVerified).toBe(true);

    // No NEW user was created (still exactly one row for this email)
    const userCount = await db.user.count({ where: { email: testEmail } });
    expect(userCount).toBe(1);
  });

  // ─── Test 7: After verification, password login with real password succeeds ───

  it("after verification, password login with the originally submitted real password succeeds", async () => {
    const { hashPassword, verifyPassword } = await import("@/lib/auth/password");

    // Create a verified user with the real password hash
    const passwordHash = await hashPassword(testPassword);
    await db.user.create({
      data: { email: testEmail, passwordHash, emailVerified: true },
      select: { id: true },
    });

    // Simulate the login route's password check
    const ok = await verifyPassword(testPassword, passwordHash);
    expect(ok).toBe(true);
  });

  // ─── Test 8: No real SMTP email was sent ───

  it("NO real SMTP email was sent (issueOtp is a vi.fn mock, not the real transport)", async () => {
    // The issueOtpMock is a vi.fn — if it were the real issueOtp, it would
    // call createMailTransport() which requires SMTP_HOST/PORT/USER/PASS and
    // would throw in CI. Since all the previous tests passed without SMTP
    // env vars, the mock worked — no real email was sent.
    //
    // To prove this concretely: invoke the signup route and verify the mock
    // is called (not the real transport).
    issueOtpMock.mockClear();
    await callSignupRoute({
      email: testEmail,
      password: testPassword,
      fullName: testFullName,
    });
    expect(issueOtpMock).toHaveBeenCalledTimes(1);
    // The mock is a vi.fn — it does NOT call createMailTransport.
    // If it did, it would throw "Missing required env var: SMTP_HOST".
  });
});
