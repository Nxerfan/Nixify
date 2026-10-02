/**
 * Admin token cryptography — the ONE edge-safe source of truth for admin JWT
 * signing/verification. Shared by `src/lib/auth/admin.ts` (server) and
 * `src/middleware.ts` (Edge) so they CANNOT diverge on secret derivation.
 *
 * Edge-safe: NO Prisma import, NO `next/headers` import. Only `jose` (which
 * works on both Edge and Node runtimes) and `process.env`.
 *
 * ─── Fail-closed secret ─────────────────────────────────────────────────────
 *
 * Admin signing/verification MUST NEVER use a public fallback secret. If
 * `JWT_SECRET` is missing, empty, or a known placeholder value, `getAdminSecret()`
 * returns `null` — callers MUST treat this as "admin auth disabled" (fail
 * closed). Do NOT throw a secret-containing error to the client; do NOT log
 * the secret.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/** Admin cookie name. */
export const ADMIN_COOKIE = "mg_admin";

/** Admin session TTL: 8 hours. */
export const ADMIN_TTL = 8 * 60 * 60; // seconds

/** Admin JWT algorithm. */
export const ADMIN_JWT_ALG = "HS256";

/**
 * Known placeholder/insecure values that MUST NEVER be accepted as the admin
 * signing secret in production. These are checked against `JWT_SECRET` so an
 * accidental `.env.example` copy or a development default cannot authenticate
 * a privileged admin session.
 */
const KNOWN_INSECURE_SECRETS: readonly string[] = [
  "insecure",
  "insecure-admin-secret",
  "replace-with-32-char-hex-string",
  "replace-with-different-32-char-hex-string",
  "test-jwt-secret-32-bytes-hex-placeholder!!",
  "sukhan-dev-secret-DO-NOT-USE-IN-PRODUCTION-a7f3b2c1",
];

/** True if the value is a known placeholder/insecure secret. */
function isInsecureSecret(value: string): boolean {
  return KNOWN_INSECURE_SECRETS.includes(value);
}

/**
 * Derive the admin signing secret from `JWT_SECRET`. Returns `null` if the
 * secret is missing, empty, or a known insecure placeholder — callers MUST
 * treat null as "admin auth disabled" (fail closed).
 *
 * The admin secret is `JWT_SECRET` + `:admin` suffix so admin tokens cannot be
 * forged from a user token and vice versa, even though both derive from the
 * same env var.
 */
export function getAdminSecret(): Uint8Array | null {
  const raw = process.env.JWT_SECRET;
  if (!raw || raw.trim() === "" || isInsecureSecret(raw)) {
    return null;
  }
  return new TextEncoder().encode(`${raw}:admin`);
}

/**
 * Decode + structurally validate an admin JWT WITHOUT a DB lookup. Used by
 * middleware (Edge, no Prisma) as a coarse page-redirect guard.
 *
 * Validates:
 *   - signature (via the admin secret);
 *   - `role === "admin"`;
 *   - `sub` is a non-empty string;
 *   - `tokenVersion` is present and is a valid non-negative integer.
 *
 * Does NOT compare `tokenVersion` to the DB — that DB comparison is the job of
 * authoritative server/API `getAdmin()`. Middleware cannot do it (Edge runtime
 * has no DB access).
 *
 * Returns the decoded payload if structurally valid + signature passes, or
 * `null` if the token is missing, malformed, expired, fails signature, or
 * lacks a valid `tokenVersion`.
 */
export async function decodeAdminToken(token: string | undefined): Promise<AdminTokenPayload | null> {
  if (!token) return null;
  const secret = getAdminSecret();
  if (!secret) return null; // fail closed — no secret configured
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ADMIN_JWT_ALG] });
    if (payload.role !== "admin") return null;
    if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;
    // Admin tokens MUST have a tokenVersion — NO legacy compatibility path for
    // privileged admin sessions (unlike user sessions). A missing, non-number,
    // non-integer, or negative tokenVersion is rejected.
    if (typeof payload.tokenVersion !== "number" || !Number.isInteger(payload.tokenVersion) || payload.tokenVersion < 0) {
      return null;
    }
    return payload as AdminTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Verified/decoded admin token payload (what `decodeAdminToken` returns).
 * `tokenVersion` is required here (unlike the raw JWTPayload).
 */
export interface AdminTokenPayload extends JWTPayload {
  sub: string;
  role: "admin";
  email: string;
  tokenVersion: number;
}

/**
 * Issuance payload — what a caller MUST provide to sign a NEW admin session.
 * `tokenVersion` is REQUIRED at the type level so the compiler rejects any
 * issuance call site that forgets it.
 */
export interface AdminIssuancePayload {
  sub: string;
  role: "admin";
  email: string;
  tokenVersion: number;
}

/** Sign a new admin JWT. Requires a valid secret (returns null if fail-closed). */
export async function signAdminToken(payload: AdminIssuancePayload): Promise<string | null> {
  const secret = getAdminSecret();
  if (!secret) return null; // fail closed
  return new SignJWT({ role: payload.role, email: payload.email, tokenVersion: payload.tokenVersion })
    .setProtectedHeader({ alg: ADMIN_JWT_ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_TTL}s`)
    .sign(secret);
}
