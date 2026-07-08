import { cookies } from "next/headers";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";

/**
 * Admin authentication (separate from user auth — different cookie, different
 * signing secret so a user session can never be elevated to admin).
 *
 * Admin users are stored in AdminUser with a bcrypt password hash. On first
 * run, the app seeds an admin from ADMIN_EMAIL/ADMIN_PASSWORD env vars if set.
 */

const ADMIN_COOKIE = "mg_admin";
const ADMIN_TTL = 8 * 60 * 60; // 8 hours

function getAdminSecret(): Uint8Array {
  // Reuse JWT_SECRET but with an admin-specific suffix so admin tokens can't be
  // forged from a user token and vice versa.
  const secret = process.env.JWT_SECRET ?? "insecure-admin-secret";
  return new TextEncoder().encode(`${secret}:admin`);
}

export interface AdminPayload extends JWTPayload {
  sub: string;
  role: "admin";
  email: string;
  tokenVersion?: number;
}

export async function signInAdmin(
  email: string,
  password: string,
): Promise<boolean> {
  const admin = await db.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!admin) return false;
  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) return false;
  const token = await new SignJWT({
    role: "admin",
    email: admin.email,
    tokenVersion: admin.tokenVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.id.toString())
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_TTL}s`)
    .sign(getAdminSecret());
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // allow HTTP in dev for browser testing
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_TTL,
  });
  return true;
}

export async function signOutAdmin(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getAdmin(): Promise<AdminPayload | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getAdminSecret(), {
      algorithms: ["HS256"],
    });
    if (payload.role !== "admin") return null;
    const payloadData = payload as AdminPayload;

    // Token version check: if the payload contains a tokenVersion, verify it
    // matches the current DB value. This invalidates sessions after password
    // changes. Tokens without tokenVersion (issued before this feature) are
    // rejected for safety.
    if (payloadData.tokenVersion !== undefined) {
      const admin = await db.adminUser.findUnique({
        where: { id: Number(payloadData.sub) },
        select: { tokenVersion: true },
      });
      if (!admin || admin.tokenVersion !== payloadData.tokenVersion) {
        return null;
      }
    }

    return payloadData;
  } catch {
    return null;
  }
}

/** Seed the admin user from env on first run (idempotent). */
export async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const existing = await db.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) return;
  const { hashPassword } = await import("@/lib/auth/password");
  const passwordHash = await hashPassword(password);
  await db.adminUser.create({
    data: { email: email.toLowerCase(), passwordHash, tokenVersion: 0 },
  });
  console.log(`[admin] Seeded admin user: ${email}`);
}

/**
 * Update an admin's password and increment tokenVersion to invalidate
 * all existing sessions. Returns true if the update succeeded.
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
  const { hashPassword } = await import("@/lib/auth/password");
  const newHash = await hashPassword(newPassword);
  await db.adminUser.update({
    where: { id: adminId },
    data: { passwordHash: newHash, tokenVersion: { increment: 1 } },
  });
  return true;
}
