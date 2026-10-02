import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import {
  ADMIN_COOKIE,
  ADMIN_TTL,
  signAdminToken,
  decodeAdminToken,
  getAdminSecret,
  type AdminTokenPayload,
  type AdminIssuancePayload,
} from "@/lib/auth/admin-token";
import { logger } from "@/lib/logger";
import { safeErrorRep } from "@/lib/log-sanitizer";

/**
 * Admin authentication (separate from user auth — different cookie, different
 * signing secret so a user session can never be elevated to admin).
 *
 * Admin users are stored in AdminUser with a bcrypt password hash. The admin
 * JWT contract REQUIRES `tokenVersion` (no legacy compatibility path for
 * privileged admin sessions — unlike user sessions, a missing tokenVersion is
 * always rejected).
 *
 * ─── Fail-closed secret ─────────────────────────────────────────────────────
 *
 * If `JWT_SECRET` is missing, empty, or a known placeholder, admin auth is
 * DISABLED — `signInAdmin()` returns false, `getAdmin()` returns null. No
 * fallback secret is ever used.
 */

/** Cookie options shared by set + clear. */
const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // allow HTTP in dev for browser testing
  sameSite: "lax" as const,
  path: "/",
  maxAge: ADMIN_TTL,
};

/**
 * Sign in an admin: verify credentials, issue a JWT with the admin's current
 * DB `tokenVersion`, set the admin cookie. Returns true on success, false on
 * any failure (unknown admin, wrong password, secret not configured).
 */
export async function signInAdmin(
  email: string,
  password: string,
): Promise<boolean> {
  // Fail closed: if no valid secret is configured, admin login is disabled.
  if (!getAdminSecret()) return false;
  const admin = await db.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!admin) return false;
  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) return false;
  // Issue a JWT with the admin's CURRENT DB tokenVersion (mandatory — the
  // AdminIssuancePayload type requires it at compile time).
  const token = await signAdminToken({
    sub: admin.id.toString(),
    role: "admin",
    email: admin.email,
    tokenVersion: admin.tokenVersion,
  } satisfies AdminIssuancePayload);
  if (!token) return false; // secret became invalid between the check and signing
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, ADMIN_COOKIE_OPTIONS);
  return true;
}

/** Clear the admin cookie. Does NOT increment tokenVersion (ordinary logout). */
export async function signOutAdmin(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", { ...ADMIN_COOKIE_OPTIONS, maxAge: 0 });
}

/**
 * Authoritative admin auth: decode the JWT, then load the AdminUser row from
 * the DB and reject if:
 *   - the token is missing/malformed/expired (decodeAdminToken returns null);
 *   - the admin row no longer exists (deleted);
 *   - the JWT's tokenVersion differs from `AdminUser.tokenVersion` (revoked).
 *
 * `tokenVersion` is MANDATORY for admin tokens — unlike user sessions, there is
 * NO legacy compatibility path. A token without tokenVersion is rejected by
 * `decodeAdminToken` before reaching the DB check.
 */
export async function getAdmin(): Promise<AdminTokenPayload | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  // decodeAdminToken validates signature, role, sub, AND tokenVersion presence
  // + integer/non-negative. It returns null if the secret is not configured.
  const payload = await decodeAdminToken(token);
  if (!payload) return null;

  // Authoritative DB check: compare the JWT's tokenVersion to the current DB
  // value. A mismatch means the admin's password was changed or sessions were
  // revoked — the token is invalid.
  const admin = await db.adminUser.findUnique({
    where: { id: Number(payload.sub) },
    select: { tokenVersion: true },
  });
  if (!admin) return null; // admin deleted
  if (admin.tokenVersion !== payload.tokenVersion) return null; // revoked

  return payload;
}

/**
 * Seed the admin user from env on first run (idempotent). Only seeds if BOTH
 * `ADMIN_EMAIL` and `ADMIN_PASSWORD` are configured. Does NOT overwrite an
 * existing admin's password — the env values are used ONLY to create the
 * initial admin row. Placeholder `.env.example` values must never be treated as
 * production-safe configuration (the caller is responsible for setting real
 * values in the Vercel/GitHub environment).
 *
 * Safe logging: does NOT emit the raw admin email, password, or hash.
 */
export async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return; // no bootstrap config — skip silently
  const existing = await db.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) return; // idempotent — never overwrite an existing admin's password
  const passwordHash = await hashPassword(password);
  const created = await db.adminUser.create({
    data: { email: email.toLowerCase(), passwordHash, tokenVersion: 0 },
    select: { id: true },
  });
  // Safe logging: bounded metadata only — never the raw admin email, password,
  // or hash. The admin ID is a safe operational identifier.
  logger.info("admin_seeded", {
    component: "auth",
    adminId: created.id,
  });
}

/**
 * Update an admin's password and atomically increment `tokenVersion` to
 * invalidate all existing sessions. Returns true if the update succeeded.
 *
 * The password hash update + tokenVersion increment happen in the SAME
 * `db.adminUser.update` mutation (atomic). `tokenVersion` is NEVER reset —
 * security revocation is forward-only.
 */
export async function updateAdminPassword(
  adminId: number,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const admin = await db.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) return false;
  const ok = await verifyPassword(currentPassword, admin.passwordHash);
  if (!ok) return false;
  const newHash = await hashPassword(newPassword);
  // ATOMIC: update passwordHash AND increment tokenVersion in the SAME
  // mutation. Old sessions become invalid (tokenVersion mismatch).
  await db.adminUser.update({
    where: { id: adminId },
    data: { passwordHash: newHash, tokenVersion: { increment: 1 } },
  });
  return true;
}
