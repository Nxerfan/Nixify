/**
 * Email normalization — shared across all Contact operations.
 *
 * Trims whitespace and lowercases the email address.
 * Does NOT perform validation (caller validates first).
 * Does NOT transform beyond case/whitespace.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validate an email address. Checks:
 * - Non-empty string
 * - Matches RFC-ish pattern
 * - Max 254 characters (RFC 5321)
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string" || email.length > 254) return false;
  return EMAIL_RE.test(email);
}

/**
 * Maximum name length — prevents oversized strings in the DB.
 */
export const MAX_NAME_LENGTH = 200;

/**
 * Maximum attributes JSON size in UTF-8 bytes.
 * Prevents users from stuffing megabytes of arbitrary JSON into one Contact.
 * 10KB is generous for key/value attributes like { "plan": "pro", "country": "UK" }.
 */
export const MAX_ATTRIBUTES_BYTES = 10_000;

/**
 * Validate attributes — must be a JSON object (not array/primitive/string).
 * Returns { valid: true, value: object } or { valid: false, error: string }.
 * Measures size in UTF-8 bytes (not JS char count) to handle multibyte correctly.
 */
export function validateAttributes(
  attributes: unknown,
): { valid: true; value: Record<string, unknown> } | { valid: false; error: string } {
  // Allow null/undefined → default empty object
  if (attributes == null) return { valid: true, value: {} };

  // Must be a plain object (not array, not string, not number)
  if (typeof attributes !== "object" || Array.isArray(attributes)) {
    return { valid: false, error: "Attributes must be a JSON object (not array or primitive)." };
  }

  // Check serialized size in UTF-8 bytes (not char count — handles multibyte)
  const serialized = JSON.stringify(attributes);
  if (Buffer.byteLength(serialized, "utf8") > MAX_ATTRIBUTES_BYTES) {
    return {
      valid: false,
      error: `Attributes payload exceeds maximum size of ${MAX_ATTRIBUTES_BYTES} bytes.`,
    };
  }

  return { valid: true, value: attributes as Record<string, unknown> };
}

/**
 * Allowed contact sources. API callers cannot set these — they are internal provenance.
 */
export const CONTACT_SOURCES = {
  API: "api",
  DASHBOARD: "dashboard",
  OTP_VERIFIED: "otp_verified",
  IMPORT: "import",
} as const;

export type ContactSource = (typeof CONTACT_SOURCES)[keyof typeof CONTACT_SOURCES];
