/**
 * Unsubscribe tokens (Phase 9) — OPAQUE via authenticated encryption.
 *
 * DESIGN — encrypted (not just signed), purpose-bound, tenant/contact-bound,
 * tamper-resistant, stateless:
 *
 * 1. ENCRYPTED (not just signed): The token is a compact JWE (JSON Web
 *    Encryption) produced with `jose`'s `EncryptJWT` using `alg=dir`,
 *    `enc=A256GCM`. The ciphertext is opaque — anyone possessing the link
 *    cannot base64-decode it to read internal IDs or email. This is a strict
 *    upgrade from a signed JWS/JWT, which is integrity-protected but whose
 *    payload is publicly readable.
 *
 * 2. PURPOSE-BOUND: The `purpose` claim is set to "unsubscribe". A token
 *    minted for a different purpose is rejected even if it decrypts
 *    successfully under the same key.
 *
 * 3. CRYPTOGRAPHIC DOMAIN SEPARATION: The encryption key is derived from the
 *    root `JWT_SECRET` via HKDF-SHA-256 with the explicit context string
 *    `nixify:unsubscribe:v1`. This means the same root secret produces a
 *    different unsubscribe key — a session JWT signing key and the unsubscribe
 *    encryption key are cryptographically separated even if they share a
 *    root. The raw session JWT signing key is NEVER used directly for token
 *    encryption.
 *
 * 4. TENANT-BOUND: The `uid` (userId) claim ties the token to a specific
 *    tenant. The unsubscribe handler verifies the token's userId matches the
 *    contact's userId before performing any mutation.
 *
 * 5. CONTACT-BOUND: The `sub` (contactId) and `email` claims tie the token to
 *    a specific contact. The handler verifies the contact exists, belongs to
 *    the tenant, and has the matching email.
 *
 * 6. STATELESS: No database session required — verification is purely
 *    cryptographic.
 *
 * 7. NO CONTACT ENUMERATION: An invalid/tampered/wrong-purpose token returns
 *    the SAME generic error as a valid token for a non-existent contact.
 *
 * 8. IDEMPOTENT: The `jti` (JWT ID) claim is used as the idempotency key for
 *    the unsubscribe operation. Repeated clicks on the same link are deduped
 *    by the (userId, operation, idempotencyKeyHash) unique constraint.
 *
 * SECURITY:
 * - Tokens never expose: email, userId, contactId via base64 decoding.
 * - Tokens expire after 90 days (generous to allow delayed clicks).
 * - The raw token is NEVER logged, NEVER persisted in the DB, NEVER returned
 *   in API responses except the one-time minting call.
 */
import { EncryptJWT, jwtDecrypt, type JWTPayload } from "jose";
import { createHmac } from "crypto";

const UNSUBSCRIBE_PURPOSE = "unsubscribe";
const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;
const KEY_CONTEXT = "nixify:unsubscribe:v1";

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

/**
 * Derive a dedicated 256-bit encryption key for unsubscribe tokens from the
 * root `JWT_SECRET` using HKDF-SHA-256 with explicit domain separation.
 *
 * The root secret is NEVER used directly for token encryption. This means:
 *   - A leak of the unsubscribe encryption key does not compromise session JWTs.
 *   - A leak of the session JWT signing key does not compromise unsubscribe tokens.
 *   - Future phases can derive additional purpose-bound keys
 *     (e.g. `nixify:password_reset:v1`) from the same root with isolation.
 */
function deriveUnsubscribeKey(): Uint8Array {
  const rootSecret = process.env.JWT_SECRET;
  if (!rootSecret) throw new Error("Missing required env var: JWT_SECRET");

  // Accept either a hex string or raw UTF-8. Hex is recommended (32 bytes).
  let rootKey: Uint8Array;
  if (/^[0-9a-fA-F]+$/.test(rootSecret) && rootSecret.length % 2 === 0 && rootSecret.length >= 32) {
    rootKey = Buffer.from(rootSecret, "hex");
  } else {
    rootKey = new TextEncoder().encode(rootSecret);
  }

  // HKDF-SHA-256 extract+expand to derive a 32-byte (256-bit) key.
  // extract: PRK = HMAC-SHA-256(salt="", IKM=rootKey)
  // expand:  OKM = HMAC-SHA-256(PRK, context_bytes | 0x01)
  const prk = createHmac("sha256", Buffer.alloc(0)).update(Buffer.from(rootKey)).digest();
  const info = Buffer.concat([
    new TextEncoder().encode(KEY_CONTEXT),
    Buffer.from([0x01]),
  ]);
  const okm = createHmac("sha256", prk).update(info).digest(); // 32 bytes
  return okm;
}

/**
 * Mint a new unsubscribe token for a contact.
 *
 * Returns the compact JWE string. The caller (future Phase 10 Broadcast) is
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
  const key = deriveUnsubscribeKey();
  return new EncryptJWT({
    purpose: UNSUBSCRIBE_PURPOSE,
    uid: String(userId),
    sub: String(contactId),
    email,
    jti,
  })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${NINETY_DAYS_SECONDS}s`)
    .encrypt(key);
}

export type VerifyUnsubscribeTokenResult =
  | { ok: true; payload: UnsubscribeTokenPayload }
  | { ok: false; reason: "invalid" | "expired" | "wrong_purpose" };

/**
 * Verify (decrypt) an unsubscribe token. Returns a discriminated union:
 *   - { ok: true, payload } — valid token, payload contains userId/contactId/email/jti
 *   - { ok: false, reason } — invalid token. The reason is for INTERNAL LOGGING
 *     ONLY — never expose it to the end user (would leak whether the contact
 *     exists). Public responses always return the same generic error.
 *
 * Verification checks:
 *   1. Ciphertext decrypts successfully under the derived unsubscribe key.
 *   2. Token is not expired.
 *   3. `purpose` claim === "unsubscribe" (rejects tokens minted for other
 *      purposes even if they happen to be encrypted with the same key —
 *      defense-in-depth against future key-reuse mistakes).
 */
export async function verifyUnsubscribeToken(token: string): Promise<VerifyUnsubscribeTokenResult> {
  try {
    const key = deriveUnsubscribeKey();
    const { payload } = await jwtDecrypt(token, key, {
      clockTolerance: "60s",
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
    // jose throws JWTClaimValidationFailed for exp, JWEDecryptionFailed for
    // tampered ciphertext, JWSSignatureVerificationFailed for wrong key, etc.
    // Map them to safe internal reasons — NEVER expose to the end user.
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

/**
 * Test helper: returns true if the token string exposes any of the given
 * plaintext patterns via simple base64 inspection. Used by the confidentiality
 * test to PROVE the token is opaque.
 */
export function tokenExposesPlaintext(token: string, patterns: string[]): boolean {
  // A JWE has 5 parts separated by dots: header.encrypted_key.iv.ciphertext.tag
  // The header is base64url-encoded JSON, but contains only alg/enc — NOT the
  // payload claims. The payload is the ciphertext (encrypted).
  // Try base64-decoding each part and look for the patterns.
  for (const part of token.split(".")) {
    let decoded: string;
    try {
      // base64url → base64
      const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      decoded = Buffer.from(b64, "base64").toString("utf8");
    } catch {
      continue;
    }
    for (const p of patterns) {
      if (decoded.includes(p)) return true;
    }
  }
  return false;
}
