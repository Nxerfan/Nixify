import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/**
 * JWT signing/verification using `jose` (edge-compatible, so the same module is
 * safe to import from `middleware.ts` which runs on the Edge runtime).
 *
 * Token payload: { sub: userId, email, emailVerified, sessionVersion, iat, exp }
 * Expiry: 7 days (§13.2).
 *
 * ─── Session version (session-revocation security) ─────────────────────────
 *
 * `sessionVersion` is a numeric claim that mirrors the user's DB
 * `User.sessionVersion` at the time the JWT was issued. Authoritative
 * server-side auth (`getAuthenticatedUser`) compares the JWT's version to the
 * current DB value: a mismatch invalidates the session.
 *
 * Legacy compatibility: JWTs issued before this stage have no `sessionVersion`
 * claim. `verifySession` treats a missing claim as version 0 for compatibility
 * ONLY — a legacy JWT remains valid while the DB version is 0, but is rejected
 * once any security event bumps the DB version above 0.
 *
 * JWT validation rejects malformed session-version claims (non-integer,
 * negative, NaN). `verifySession` returns null for a malformed token.
 */

const SEVEN_DAYS = 7 * 24 * 60 * 60; // seconds

export interface SessionPayload extends JWTPayload {
  sub: string; // userId as string
  email: string;
  emailVerified: boolean;
  /** Session-version claim (numeric). Absent on legacy JWTs (treated as 0). */
  sessionVersion?: number;
}

/**
 * Issuance payload — what a caller MUST provide to issue a NEW session.
 *
 * `sessionVersion` is REQUIRED here (not optional) so the TypeScript compiler
 * rejects any new-session call site that forgets it. This is the type-level
 * enforcement that prevents the verify-email blocker from recurring: you
 * cannot call `signSession()` / `setSessionCookie()` without a `sessionVersion`.
 *
 * Legacy compatibility (missing claim → treated as 0) belongs ONLY in
 * `verifySession` (which decodes tokens that may predate this stage), NEVER in
 * new issuance.
 */
export interface IssuancePayload {
  sub: string;
  email: string;
  emailVerified: boolean;
  sessionVersion: number;
}

/** @internal Exposed for tests that need to sign legacy/malformed tokens. */
export function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing required env var: JWT_SECRET");
  // Accept either a hex string or raw UTF-8. Hex is recommended (32 bytes).
  if (/^[0-9a-fA-F]+$/.test(secret) && secret.length % 2 === 0 && secret.length >= 32) {
    return Buffer.from(secret, "hex");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: IssuancePayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SEVEN_DAYS}s`)
    .sign(getSecret());
}

/**
 * Verify a session JWT. Returns the payload if valid, or null if the token is
 * missing, expired, or has a malformed sessionVersion claim.
 *
 * A missing `sessionVersion` claim (legacy JWT) is treated as version 0 — this
 * is a compatibility affordance, NOT a security bypass. Authoritative auth
 * (`getAuthenticatedUser`) compares the resolved version to the DB value, so a
 * legacy JWT is rejected once the DB version is bumped above 0.
 */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    // Validate the sessionVersion claim if present. A malformed claim (non-
    // integer, negative, NaN) invalidates the whole token — return null.
    if (payload.sessionVersion !== undefined) {
      const v = payload.sessionVersion;
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
        return null;
      }
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/** Resolve the session-version claim, treating a missing legacy claim as 0. */
export function getSessionVersion(session: SessionPayload | null): number {
  if (!session) return 0;
  if (session.sessionVersion === undefined) return 0;
  return session.sessionVersion;
}

export const SESSION_COOKIE = "mg_session";
export const SESSION_MAX_AGE = SEVEN_DAYS; // seconds
