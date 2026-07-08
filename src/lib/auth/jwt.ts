import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/**
 * JWT signing/verification using `jose` (edge-compatible, so the same module is
 * safe to import from `middleware.ts` which runs on the Edge runtime).
 *
 * Token payload: { sub: userId, email, emailVerified, iat, exp }
 * Expiry: 7 days (§13.2).
 */

const SEVEN_DAYS = 7 * 24 * 60 * 60; // seconds

export interface SessionPayload extends JWTPayload {
  sub: string; // userId as string
  email: string;
  emailVerified: boolean;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing required env var: JWT_SECRET");
  // Accept either a hex string or raw UTF-8. Hex is recommended (32 bytes).
  if (/^[0-9a-fA-F]+$/.test(secret) && secret.length % 2 === 0 && secret.length >= 32) {
    return Buffer.from(secret, "hex");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: Omit<SessionPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SEVEN_DAYS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "mg_session";
export const SESSION_MAX_AGE = SEVEN_DAYS; // seconds
