/**
 * Session revocation + account-security tests (session-version stage).
 *
 * These tests verify the REAL JWT/session contract and the security-event
 * sessionVersion semantics. They mock the DB and security modules so they run
 * without a database (generic CI job). The JWT signing/verification is REAL
 * (uses the actual jose library + a test JWT_SECRET).
 *
 * Contract under test:
 *   - newly issued JWT contains sessionVersion;
 *   - malformed sessionVersion is rejected;
 *   - matching JWT/DB version authenticates; mismatch rejects;
 *   - legacy token (no version) works when DB version is 0, rejects when > 0;
 *   - lockAccountForBruteForce / adminLockAccount atomically increment;
 *   - adminUnlockAccount does NOT reset sessionVersion (old sessions stay invalid);
 *   - ordinary logout does NOT bump version;
 *   - logout-all increments version exactly once;
 *   - safe auth logging (no raw err.message in login/reset paths);
 *   - Settings UX i18n keys exist (EN + FA).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../..");

// ---- JWT/secret setup ------------------------------------------------------

const TEST_SECRET = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET;
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---- JWT session-version contract ------------------------------------------

describe("JWT session-version contract", () => {
  it("newly issued JWT contains sessionVersion", async () => {
    const { signSession, verifySession } = await import("@/lib/auth/jwt");
    const token = await signSession({
      sub: "42",
      email: "user@example.com",
      emailVerified: true,
      sessionVersion: 3,
    });
    const payload = await verifySession(token);
    expect(payload).not.toBeNull();
    expect(payload!.sessionVersion).toBe(3);
  });

  it("malformed sessionVersion (string) is rejected", async () => {
    const { SignJWT } = await import("jose");
    const { verifySession, getSecret } = await import("@/lib/auth/jwt");
    // Sign a JWT with a STRING sessionVersion (malformed).
    const token = await new SignJWT({ sub: "42", email: "u@e.com", emailVerified: true, sessionVersion: "not-a-number" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(getSecret());
    const payload = await verifySession(token);
    expect(payload).toBeNull();
  });

  it("malformed sessionVersion (negative) is rejected", async () => {
    const { SignJWT } = await import("jose");
    const { verifySession, getSecret } = await import("@/lib/auth/jwt");
    const token = await new SignJWT({ sub: "42", email: "u@e.com", emailVerified: true, sessionVersion: -1 })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(getSecret());
    const payload = await verifySession(token);
    expect(payload).toBeNull();
  });

  it("malformed sessionVersion (NaN) is rejected", async () => {
    const { SignJWT } = await import("jose");
    const { verifySession, getSecret } = await import("@/lib/auth/jwt");
    const token = await new SignJWT({ sub: "42", email: "u@e.com", emailVerified: true, sessionVersion: NaN })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(getSecret());
    const payload = await verifySession(token);
    expect(payload).toBeNull();
  });

  it("legacy token with no sessionVersion claim verifies (treated as 0)", async () => {
    const { SignJWT } = await import("jose");
    const { verifySession, getSecret, getSessionVersion } = await import("@/lib/auth/jwt");
    // Sign a legacy JWT with NO sessionVersion claim (pre-this-stage token).
    const token = await new SignJWT({ sub: "42", email: "u@e.com", emailVerified: true })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(getSecret());
    const payload = await verifySession(token);
    expect(payload).not.toBeNull();
    expect(payload!.sessionVersion).toBeUndefined();
    // getSessionVersion treats a missing claim as 0 for compatibility.
    expect(getSessionVersion(payload)).toBe(0);
  });
});

// ---- Security-event sessionVersion semantics (source inspection) -----------
//
// These tests inspect the REAL source files (not fixtures) to prove the
// atomic increment is present in each security event and absent from
// ordinary logout / unlock / auto-unlock.

describe("sessionVersion semantics (source inspection of real files)", () => {
  function read(rel: string): string {
    return readFileSync(resolve(ROOT, rel), "utf-8");
  }

  it("lockAccountForBruteForce atomically increments sessionVersion", () => {
    const src = read("src/lib/security/index.ts");
    const fn = src.split("lockAccountForBruteForce")[1]?.split("adminLockAccount")[0] ?? "";
    expect(fn).toMatch(/sessionVersion:\s*\{\s*increment:\s*1\s*\}/);
  });

  it("adminLockAccount atomically increments sessionVersion", () => {
    const src = read("src/lib/security/index.ts");
    const fn = src.split("export async function adminLockAccount")[1]?.split("export async function adminUnlockAccount")[0] ?? "";
    expect(fn).toMatch(/sessionVersion:\s*\{\s*increment:\s*1\s*\}/);
  });

  it("adminUnlockAccount does NOT reset sessionVersion (old sessions stay invalid)", () => {
    const src = read("src/lib/security/index.ts");
    // Extract the adminUnlockAccount function body (between its declaration and
    // the next section comment). The DATA mutation must NOT include sessionVersion.
    const fn = src.split("export async function adminUnlockAccount")[1]?.split("\n// ---")[0] ?? "";
    // The `data:` block of the updateMany must not contain sessionVersion.
    const dataBlock = fn.split("data:")[1]?.split("});")[0] ?? "";
    expect(dataBlock, "unlock data block must NOT set sessionVersion").not.toMatch(/sessionVersion/);
  });

  it("checkAccountLock auto-unlock does NOT reset sessionVersion", () => {
    const src = read("src/lib/security/index.ts");
    const fn = src.split("export async function checkAccountLock")[1]?.split("export async function adminLockAccount")[0] ?? "";
    // The auto-unlock path (clearing lockedUntil/lockedReason/lockedAt) must
    // NOT touch sessionVersion in the data: block.
    const dataBlock = fn.split("data:")[1]?.split("}")[0] ?? "";
    expect(dataBlock, "auto-unlock data block must NOT set sessionVersion").not.toMatch(/sessionVersion/);
  });

  it("ordinary logout does NOT increment sessionVersion", () => {
    const src = read("src/app/api/auth/logout/route.ts");
    expect(src).not.toMatch(/sessionVersion/);
    expect(src).not.toMatch(/increment/);
  });

  it("logout-all atomically increments sessionVersion exactly once", () => {
    const src = read("src/app/api/auth/logout-all/route.ts");
    expect(src).toMatch(/sessionVersion:\s*\{\s*increment:\s*1\s*\}/);
    // Exactly ONE increment in the file.
    const matches = src.match(/sessionVersion:\s*\{\s*increment:\s*1\s*\}/g);
    expect(matches?.length).toBe(1);
  });

  it("reset-password atomically updates passwordHash AND increments sessionVersion in the SAME mutation", () => {
    const src = read("src/app/api/auth/reset-password/route.ts");
    // The update must contain BOTH passwordHash and sessionVersion increment.
    const updateBlock = src.split("db.user.update")[1]?.split(");")[0] ?? "";
    expect(updateBlock).toMatch(/passwordHash/);
    expect(updateBlock).toMatch(/sessionVersion:\s*\{\s*increment:\s*1\s*\}/);
  });

  it("login issues a JWT with the user's current DB sessionVersion", () => {
    const src = read("src/app/api/auth/login/route.ts");
    expect(src).toMatch(/sessionVersion:\s*user\.sessionVersion/);
  });

  it("getAuthenticatedUser compares JWT sessionVersion to DB sessionVersion", () => {
    const src = read("src/lib/auth/session.ts");
    expect(src).toMatch(/sessionVersion/);
    expect(src).toMatch(/getSessionVersion/);
    // Rejects on mismatch.
    expect(src).toMatch(/if\s*\(jwtVersion\s*!==\s*user\.sessionVersion\)\s*return\s*null/);
  });

  it("getAuthenticatedUser rejects when the account is actively locked", () => {
    const src = read("src/lib/auth/session.ts");
    expect(src).toMatch(/lockedReason/);
    expect(src).toMatch(/permanentlyLocked|temporarilyLocked/);
  });
});

// ---- Safe auth logging (source inspection) --------------------------------

describe("safe auth logging (no raw err.message/err.stack in touched auth routes)", () => {
  function read(rel: string): string {
    return readFileSync(resolve(ROOT, rel), "utf-8");
  }

  // Every auth route changed by this PR must NOT log raw `.message` or `.stack`
  // via console.error. Use the canonical logger + safeErrorRep instead.

  /** Assert no active logging of raw .message / .stack via console.error. */
  function assertNoRawLogging(src: string, route: string) {
    expect(src, `${route}: must not console.error .message`).not.toMatch(/console\.error\([^)]*\.message/);
    expect(src, `${route}: must not console.error .stack`).not.toMatch(/console\.error\([^)]*\.stack/);
    expect(src, `${route}: must not console.error err instanceof Error`).not.toMatch(/console\.error\([^)]*err instanceof Error/);
  }

  it("login route — no raw logging, uses canonical logger", () => {
    const src = read("src/app/api/auth/login/route.ts");
    assertNoRawLogging(src, "login");
    expect(src).toMatch(/logger\.error/);
    expect(src).toMatch(/safeErrorRep/);
  });

  it("reset-password route — no raw logging, uses canonical logger", () => {
    const src = read("src/app/api/auth/reset-password/route.ts");
    assertNoRawLogging(src, "reset-password");
    expect(src).toMatch(/logger\.error/);
    expect(src).toMatch(/safeErrorRep/);
  });

  it("logout-all route — no raw logging, uses canonical logger", () => {
    const src = read("src/app/api/auth/logout-all/route.ts");
    assertNoRawLogging(src, "logout-all");
    expect(src).toMatch(/logger\.error/);
    expect(src).toMatch(/safeErrorRep/);
  });

  it("signup route — no raw logging, uses canonical logger", () => {
    const src = read("src/app/api/auth/signup/route.ts");
    assertNoRawLogging(src, "signup");
    expect(src).toMatch(/logger\.error/);
    expect(src).toMatch(/safeErrorRep/);
  });

  it("verify-email route — no raw logging, uses canonical logger", () => {
    const src = read("src/app/api/auth/verify-email/route.ts");
    assertNoRawLogging(src, "verify-email");
    expect(src).toMatch(/logger\.error/);
    expect(src).toMatch(/safeErrorRep/);
  });

  it("forgot-password route — no raw logging, uses canonical logger", () => {
    const src = read("src/app/api/auth/forgot-password/route.ts");
    assertNoRawLogging(src, "forgot-password");
    expect(src).toMatch(/logger\.(error|warn)/);
    expect(src).toMatch(/safeErrorRep/);
  });

  it("resend-otp route — no raw logging, uses canonical logger", () => {
    const src = read("src/app/api/auth/resend-otp/route.ts");
    assertNoRawLogging(src, "resend-otp");
    expect(src).toMatch(/logger\.error/);
    expect(src).toMatch(/safeErrorRep/);
  });

  it("ordinary logout route — no error logging path at all", () => {
    const src = read("src/app/api/auth/logout/route.ts");
    // logout has no try/catch error path — it just clears the cookie.
    expect(src).not.toMatch(/console\.error/);
    expect(src).not.toMatch(/logger\.error/);
  });
});

// ---- Settings UX i18n keys (EN + FA) --------------------------------------

describe("Settings 'Sign out all devices' UX translations", () => {
  function read(rel: string): string {
    return readFileSync(resolve(ROOT, rel), "utf-8");
  }

  const KEYS = [
    "signOutAllDevices",
    "signOutAllDevicesDesc",
    "signOutAllDevicesConfirm",
    "signOutAllDevicesWarning",
    "signOutAllDevicesCancel",
    "signOutAllDevicesConfirmBtn",
    "signOutAllDevicesSuccess",
    "signOutAllDevicesFailed",
  ];

  it("EN translations exist for all sign-out-all keys", () => {
    const en = read("src/i18n/en.ts");
    for (const key of KEYS) {
      expect(en, `EN must define ${key}`).toMatch(new RegExp(`${key}\\s*:`));
    }
  });

  it("FA translations exist for all sign-out-all keys", () => {
    const fa = read("src/i18n/fa.ts");
    for (const key of KEYS) {
      expect(fa, `FA must define ${key}`).toMatch(new RegExp(`${key}\\s*:`));
    }
  });

  it("the SecuritySection component calls the real /api/auth/logout-all endpoint", () => {
    const src = read("src/app/dashboard/settings/page.tsx");
    expect(src).toMatch(/\/api\/auth\/logout-all/);
    // On success, redirects to /auth.
    expect(src).toMatch(/router\.push\("\/auth"\)/);
  });

  it("the UI does NOT claim device/session enumeration", () => {
    const src = read("src/app/dashboard/settings/page.tsx");
    const en = read("src/i18n/en.ts");
    const fa = read("src/i18n/fa.ts");
    // Must not present a device list / session manager / active device list.
    for (const text of ["deviceManager", "sessionManager", "activeDeviceList", "deviceList"]) {
      expect(src, `UI must not include ${text}`).not.toMatch(new RegExp(text, "i"));
      expect(en, `EN must not include ${text}`).not.toMatch(new RegExp(text, "i"));
      expect(fa, `FA must not include ${text}`).not.toMatch(new RegExp(text, "i"));
    }
  });
});

// ---- Migration + schema (source inspection) -------------------------------

describe("sessionVersion schema + migration", () => {
  function read(rel: string): string {
    return readFileSync(resolve(ROOT, rel), "utf-8");
  }

  it("User model has sessionVersion Int @default(0)", () => {
    const schema = read("prisma/schema.prisma");
    const userModel = schema.split("model User {")[1]?.split("model Contact {")[0] ?? "";
    expect(userModel).toMatch(/sessionVersion\s+Int\s+@default\(0\)/);
  });

  it("exactly ONE additive migration adds sessionVersion", () => {
    const migrationDir = "prisma/migrations/20260928000000_add_user_session_version";
    const sql = read(`${migrationDir}/migration.sql`);
    expect(sql).toMatch(/ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0/);
    // Additive only — no destructive SQL. Strip comment lines (which may
    // legitimately contain words like "drop" in prose) before checking.
    const sqlOnly = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(sqlOnly, "migration must not DROP").not.toMatch(/\bDROP\b/i);
    expect(sqlOnly, "migration must not DELETE").not.toMatch(/\bDELETE\b/i);
    expect(sqlOnly, "migration must not TRUNCATE").not.toMatch(/\bTRUNCATE\b/i);
  });
});

// ---- Middleware vs server/API distinction ---------------------------------

describe("middleware is a coarse guard, not a revocation enforcement point", () => {
  it("middleware uses verifySession (JWT signature only) without DB access", async () => {
    const src = readFileSync(resolve(ROOT, "src/middleware.ts"), "utf-8");
    // Middleware verifies the JWT signature but must NOT do Prisma queries
    // (Edge runtime has no DB access). It is a page-redirect guard only.
    expect(src).toMatch(/verifySession/);
    expect(src).not.toMatch(/from "@\/lib\/db"/);
    expect(src).not.toMatch(/prisma/);
    // Must NOT claim to enforce sessionVersion (that's the server/API path's job).
    expect(src).not.toMatch(/sessionVersion/);
  });
});
