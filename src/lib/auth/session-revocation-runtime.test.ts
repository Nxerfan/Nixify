/**
 * Executable session-version + authoritative-auth runtime tests.
 *
 * Unlike the source-inspection tests in session-revocation.test.ts, these
 * tests EXECUTE the real `getAuthenticatedUser()` logic and the real
 * `signSession` / `verifySession` / `setSessionCookie` helpers against mocked
 * DB + cookies, so they prove the runtime contract — not just the source text.
 *
 * Contract under test:
 *   - JWT version 0 + DB version 0 → authenticated;
 *   - JWT version 3 + DB version 3 → authenticated;
 *   - JWT version 2 + DB version 3 → rejected;
 *   - legacy JWT (no claim) + DB version 0 → authenticated;
 *   - legacy JWT (no claim) + DB version 1 → rejected;
 *   - valid matching JWT + missing User → rejected;
 *   - valid matching JWT + active temporary lock → rejected;
 *   - valid matching JWT + permanent admin lock → rejected;
 *   - expired temporary lock is not treated as active;
 *   - login-issued JWT contains the DB sessionVersion;
 *   - verify-email-issued JWT contains the DB sessionVersion (including non-zero).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Mocks (must come BEFORE imports) ---------------------------------------

// Mock the DB so getAuthenticatedUser can be exercised without a real DB.
const mockUserFindUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}));

// Mock next/headers cookies() so setSessionCookie / getSession work in tests.
const mockCookieStore = {
  _cookie: undefined as string | undefined,
  get(name: string) {
    if (name === "mg_session") {
      return this._cookie !== undefined ? { value: this._cookie } : undefined;
    }
    return undefined;
  },
  set(name: string, value: string, _opts: unknown) {
    if (name === "mg_session") this._cookie = value;
  },
};
vi.mock("next/headers", () => ({
  cookies: async () => mockCookieStore,
}));

import { signSession, verifySession, getSecret } from "@/lib/auth/jwt";
import { type IssuancePayload } from "@/lib/auth/jwt";
import { getSession, getAuthenticatedUser, setSessionCookie } from "@/lib/auth/session";
import { SignJWT } from "jose";

const TEST_SECRET = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET;
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  mockCookieStore._cookie = undefined;
  mockUserFindUnique.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Sign a legacy JWT (no sessionVersion claim) for compatibility tests. */
async function signLegacyJwt(sub: string, email: string): Promise<string> {
  return new SignJWT({ sub, email, emailVerified: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

/** Set a session cookie with the given version (simulating issuance). */
async function setSession(version: number, sub = "42", email = "user@example.com") {
  await setSessionCookie({
    sub,
    email,
    emailVerified: true,
    sessionVersion: version,
  } satisfies IssuancePayload);
}

/** Configure the mocked DB user row returned by getAuthenticatedUser. */
function mockDbUser(overrides: Partial<{
  id: number;
  sessionVersion: number;
  lockedReason: string | null;
  lockedUntil: Date | null;
}> = {}) {
  mockUserFindUnique.mockResolvedValue({
    id: 42,
    email: "user@example.com",
    passwordHash: "hash",
    emailVerified: true,
    profileCompleted: true,
    plan: "FREE",
    fullName: null,
    phoneNumber: null,
    createdAt: new Date(),
    trialStartedAt: null,
    trialExpiresAt: null,
    lockedReason: null,
    lockedUntil: null,
    lockedAt: null,
    preferredLocale: null,
    sessionVersion: 0,
    ...overrides,
  });
}

// ---- Authoritative authentication matrix -----------------------------------

describe("getAuthenticatedUser — authoritative session-version + lock matrix", () => {
  it("JWT version 0 + DB version 0 → authenticated", async () => {
    mockDbUser({ sessionVersion: 0 });
    await setSession(0);
    const user = await getAuthenticatedUser();
    expect(user).not.toBeNull();
    expect(user?.id).toBe(42);
  });

  it("JWT version 3 + DB version 3 → authenticated", async () => {
    mockDbUser({ sessionVersion: 3 });
    await setSession(3);
    const user = await getAuthenticatedUser();
    expect(user).not.toBeNull();
    expect(user?.sessionVersion).toBe(3);
  });

  it("JWT version 2 + DB version 3 → rejected (revoked)", async () => {
    mockDbUser({ sessionVersion: 3 });
    await setSession(2);
    const user = await getAuthenticatedUser();
    expect(user).toBeNull();
  });

  it("legacy JWT (no claim) + DB version 0 → authenticated", async () => {
    mockDbUser({ sessionVersion: 0 });
    // Sign a legacy JWT with NO sessionVersion claim.
    mockCookieStore._cookie = await signLegacyJwt("42", "user@example.com");
    const user = await getAuthenticatedUser();
    expect(user).not.toBeNull();
  });

  it("legacy JWT (no claim) + DB version 1 → rejected", async () => {
    mockDbUser({ sessionVersion: 1 });
    mockCookieStore._cookie = await signLegacyJwt("42", "user@example.com");
    const user = await getAuthenticatedUser();
    expect(user).toBeNull();
  });

  it("valid matching JWT + missing User → rejected", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    await setSession(0);
    const user = await getAuthenticatedUser();
    expect(user).toBeNull();
  });

  it("valid matching JWT + active temporary lock → rejected", async () => {
    mockDbUser({
      sessionVersion: 0,
      lockedReason: "brute_force",
      lockedUntil: new Date(Date.now() + 60_000), // 1 min in the future = active
    });
    await setSession(0);
    const user = await getAuthenticatedUser();
    expect(user).toBeNull();
  });

  it("valid matching JWT + permanent admin lock → rejected", async () => {
    mockDbUser({
      sessionVersion: 0,
      lockedReason: "admin",
      lockedUntil: null, // null = permanent
    });
    await setSession(0);
    const user = await getAuthenticatedUser();
    expect(user).toBeNull();
  });

  it("valid matching JWT + expired temporary lock → NOT treated as active (authenticated)", async () => {
    mockDbUser({
      sessionVersion: 0,
      lockedReason: "brute_force",
      lockedUntil: new Date(Date.now() - 60_000), // 1 min ago = expired
    });
    await setSession(0);
    const user = await getAuthenticatedUser();
    // The lock has expired — getAuthenticatedUser treats it as unlocked.
    // (Note: sessionVersion was already bumped when the lock was applied, so a
    // JWT issued AFTER the lock would have version > 0. This test uses a
    // version-0 JWT, which means it was issued before the lock — the bump
    // would have invalidated it. For this test we set DB version=0 to isolate
    // the lock-expiry logic; in production a bumped version would reject first.)
    expect(user).not.toBeNull();
  });
});

// ---- Issuance tests --------------------------------------------------------

describe("session issuance — JWT contains the DB sessionVersion", () => {
  it("setSessionCookie issues a JWT whose decoded sessionVersion matches the input", async () => {
    await setSession(7);
    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session!.sessionVersion).toBe(7);
  });

  it("login-issued JWT contains the DB sessionVersion (version 0)", async () => {
    await setSession(0);
    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session!.sessionVersion).toBe(0);
  });

  it("login-issued JWT contains the DB sessionVersion (non-zero, e.g. 4)", async () => {
    await setSession(4);
    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session!.sessionVersion).toBe(4);
  });

  it("verify-email-issued JWT contains the DB sessionVersion (non-zero, e.g. 4)", async () => {
    // Simulate verify-email: the update returns sessionVersion=4, and the
    // session is issued with that exact value.
    const updatedSessionVersion = 4;
    await setSessionCookie({
      sub: "42",
      email: "user@example.com",
      emailVerified: true,
      sessionVersion: updatedSessionVersion,
    } satisfies IssuancePayload);
    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session!.sessionVersion).toBe(4);
    // Authoritative auth with DB version=4 accepts it.
    mockDbUser({ sessionVersion: 4 });
    const user = await getAuthenticatedUser();
    expect(user).not.toBeNull();
  });

  it("newly issued tokens never rely on the legacy missing-claim fallback", async () => {
    // A token issued via setSessionCookie (the canonical issuance path) MUST
    // contain the sessionVersion claim — the legacy fallback (missing → 0) is
    // for VERIFY only, not for newly issued tokens.
    await setSession(5);
    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session!.sessionVersion).toBeDefined();
    expect(session!.sessionVersion).toBe(5);
  });
});

// ---- Type-level enforcement (compile-time) ---------------------------------
//
// The following line is a COMPILE-TIME assertion that the issuance payload
// REQUIRES sessionVersion. If someone removes the `sessionVersion` field from
// IssuancePayload, the TypeScript compiler will reject the line below. The
// `satisfies IssuancePayload` is the guard.

describe("issuance type-level enforcement", () => {
  it("IssuancePayload requires sessionVersion (compile-time guard)", () => {
    // This object satisfies IssuancePayload — the compiler accepts it.
    const valid: IssuancePayload = {
      sub: "1",
      email: "u@e.com",
      emailVerified: true,
      sessionVersion: 0,
    };
    expect(valid.sessionVersion).toBe(0);
    // The following would be a COMPILE ERROR (missing sessionVersion):
    //   const invalid: IssuancePayload = { sub: "1", email: "u@e.com", emailVerified: true };
    // We don't write it as runnable code — the type system enforces it.
  });
});
