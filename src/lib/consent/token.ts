/**
 * Unsubscribe tokens (Phase 9).
 *
 * DESIGN — signed, opaque, purpose-bound, tenant/contact-bound, tamper-resistant:
 *
 * 1. Signed: HS256 JWT via `jose`. Tampering with the payload invalidates the
 *    signature → verification fails → safe generic error.
 * 2. Purpose-bound: the `purpose` claim is set to `"unsubscribe"`. A token
 *    minted for a different purpose (e.g. a session token) is rejected even
 *    if the signature is valid.
 * 3. Tenant-bound: the `uid` (userId) claim ties the token to a specific
 *    tenant. The unsubscribe handler verifies the token's userId matches
 *    the contact's userId before performing any mutation.
 * 4. Contact-bound: the `sub` (contactId) and `email` claims tie the token
 *    to a specific contact. The handler verifies the contact exists, belongs
 *    to the tenant, and has the matching email.
 * 5. No database session required: stateless verification.
 * 6. No contact enumeration: an invalid/tampered/wrong-purpose token returns
 *    the SAME generic error as a valid token for a non-existent contact.
 *    The handler never reveals whether the email/contact exists.
 * 7. Idempotent: the `jti` (JWT ID) claim is used as the idempotency key for
 *    the unsubscribe operation. Repeated clicks on the same link are deduped
 *    by the (userId, idempotencyKeyHash) unique constraint.
 *
 * SECURITY:
 * - Tokens are signed with `JWT_SECRET` (same as session tokens) but
 *   domain-separated via the `purpose` claim. A session token presented as
 *   an unsubscribe token is rejected because `purpose !== "unsubscribe"`.
 * - Tokens expire after 90 days (generous to allow delayed clicks).
 * - The raw token is NEVER logged, NEVER persisted in the DB, NEVER returned
 *   in API responses except the one-time minting call.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const UNSUBSCRIBE_PURPOSE = "unsubscribe";
const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

export interface UnsubscribeTokenPayload extends JWTPayload {
  /** Purpose domain-separator — MUST equal "unsubscribe". */
  purpose: typeof UNSUBSCRIBE_PURPOSE;
  /** Tenant ID (User.id) as a string. */
  uid: string;
  /** Contact ID as `sub` (JWT convention). */
  sub: string;
  /** Normalized contact email. */
  email: string;
  /** Unique JWT ID — used as idempotency key for the unsubscribe operation. */
  jti: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing required env var: JWT_SECRET");
  if (/^[0-9a-fA-F]+$/.test(secret) && secret.length % 2 === 0 && secret.length >= 32) {
    return Buffer.from(secret, "hex");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Mint a new unsubscribe token for a contact.
 *
 * Returns the signed JWT string. The caller (future Phase 10 Broadcast) is
 * responsible for embedding it in the `List-Unsubscribe` header or email body
 * link. Phase 9 only mints tokens via the test helper and dashboard; no
 * marketing email is sent yet.
 */
export async function mintUnsubscribeToken(opts: {
  userId: number;
  contactId: number;
  email: string;
}): Promise<string> {
  const { userId, contactId, email } = opts;
  const jti = crypto.randomUUID();
  return new SignJWT({
    purpose: UNSUBSCRIBE_PURPOSE,
    uid: String(userId),
    sub: String(contactId),
    email,
    jti,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${NINETY_DAYS_SECONDS}s`)
    .sign(getSecret());
}

export type VerifyUnsubscribeTokenResult =
  | { ok: true; payload: UnsubscribeTokenPayload }
  | { ok: false; reason: "invalid" | "expired" | "wrong_purpose" };

/**
 * Verify an unsubscribe token. Returns a discriminated union:
 *   - { ok: true, payload } — valid token, payload contains userId/contactId/email/jti
 *   - { ok: false, reason } — invalid token. The reason is for INTERNAL LOGGING
 *     ONLY — never expose it to the end user (would leak whether the contact
 *     exists). Public responses always return the same generic error.
 *
 * Verification checks:
 *   1. Signature is valid (HS256 with JWT_SECRET).
 *   2. Token is not expired.
 *   3. `purpose` claim === "unsubscribe" (rejects session/admin tokens even
 *      if they happen to be signed with the same secret).
 */
export async function verifyUnsubscribeToken(token: string): Promise<VerifyUnsubscribeTokenResult> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });
    const p = payload as UnsubscribeTokenPayload;
    if (p.purpose !== UNSUBSCRIBE_PURPOSE) {
      return { ok: false, reason: "wrong_purpose" };
    }
    if (!p.uid || !p.sub || !p.email || !p.jti) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, payload: p };
  } catch (err: any) {
    if (err?.code === "ERR_JWT_EXPIRED") return { ok: false, reason: "expired" };
    return { ok: false, reason: "invalid" };
  }
}

/**
 * Public constant returned to the end user on any unsubscribe failure.
 * NEVER distinguishes between "token invalid", "contact not found",
 * "wrong tenant", etc. — same generic message for all.
 */
export const UNSUBSCRIBE_INVALID_MESSAGE = "The unsubscribe link is invalid or has expired.";
