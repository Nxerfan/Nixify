/**
 * Events API validation (Phase 6, sections 12, 13, 14).
 *
 * Validates the public POST /api/v1/events request body:
 *   - type: 1-100 chars, allowed chars [a-zA-Z0-9._-:], reserved namespaces rejected
 *   - email: required, normalized (trim+lowercase), RFC-ish validation
 *   - data: required JSON object, max 32KB, max depth 8, max 200 keys, no dangerous keys
 *
 * Idempotency-Key header: 8-128 chars (validated in the route, not here).
 */
import { z } from "zod";

// ---- Limits (section 14) ---------------------------------------------------

export const MAX_EVENT_TYPE_LENGTH = 100;
export const MAX_DATA_BYTES = 32 * 1024; // 32 KB UTF-8
export const MAX_DATA_DEPTH = 8;
export const MAX_DATA_KEYS = 200;
export const IDEMPOTENCY_KEY_MIN = 8;
export const IDEMPOTENCY_KEY_MAX = 128;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- Event type grammar (section 12) ---------------------------------------

const EVENT_TYPE_RE = /^[a-zA-Z0-9._:\-]{1,100}$/;

/**
 * Reserved internal namespaces (section 12). A public caller cannot use these
 * prefixes — they're for Nixify-generated system events in future phases.
 */
const RESERVED_PREFIXES = [
  "otp.",
  "email.",
  "contact.",
  "automation.",
  "system.",
  "nixify.",
];

export function isReservedEventType(type: string): boolean {
  const lower = type.toLowerCase();
  return RESERVED_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

// ---- Zod schema ------------------------------------------------------------

export const createEventSchema = z.object({
  type: z
    .string()
    .trim()
    .min(1, "Event type is required.")
    .max(MAX_EVENT_TYPE_LENGTH, `Event type must be at most ${MAX_EVENT_TYPE_LENGTH} characters.`)
    .regex(EVENT_TYPE_RE, "Event type may only contain letters, numbers, dots, underscores, hyphens, and colons."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email is required.")
    .max(254, "Email must be at most 254 characters.")
    .refine((v) => EMAIL_RE.test(v), "Enter a valid email address."),
  data: z
    .record(z.string(), z.unknown())
    .refine((v) => {
      // data must be a plain object (zod record enforces this). Empty object {} is allowed.
      return typeof v === "object" && !Array.isArray(v);
    }, "Data must be a JSON object."),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

// ---- Data validation (section 14) ------------------------------------------

/**
 * Validate event data depth, size, key count, and dangerous keys.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateEventData(data: unknown): string | null {
  // Check it's a plain object (not array/null/primitive).
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return "Data must be a JSON object.";
  }

  // Check serialized size in UTF-8 bytes.
  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized, "utf8") > MAX_DATA_BYTES) {
    return `Event data exceeds maximum size of ${MAX_DATA_BYTES} bytes.`;
  }

  // Recursive checks: depth, key count, dangerous keys.
  const keyCount = { n: 0 };
  const depthError = checkDepth(data, 0, keyCount);
  if (depthError) return depthError;

  if (keyCount.n > MAX_DATA_KEYS) {
    return `Event data exceeds maximum of ${MAX_DATA_KEYS} object keys.`;
  }

  return null; // valid
}

/**
 * Recursively check nesting depth + dangerous keys. Also counts total keys.
 * Returns an error string if any violation is found, null if OK.
 */
function checkDepth(value: unknown, depth: number, keyCount: { n: number }): string | null {
  if (depth > MAX_DATA_DEPTH) {
    return `Event data nesting depth exceeds maximum of ${MAX_DATA_DEPTH}.`;
  }

  if (value === null || typeof value !== "object") {
    return null; // primitives are fine at any depth
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const err = checkDepth(item, depth + 1, keyCount);
      if (err) return err;
    }
    return null;
  }

  // It's a plain object — check keys.
  for (const key of Object.keys(value as Record<string, unknown>)) {
    keyCount.n += 1;
    // Dangerous keys (prototype pollution vectors).
    if (key === "__proto__" || key === "prototype" || key === "constructor") {
      return `Event data contains a dangerous key: "${key}".`;
    }
    const err = checkDepth((value as Record<string, unknown>)[key], depth + 1, keyCount);
    if (err) return err;
  }

  return null;
}

// ---- Idempotency-Key header validation (section 9) ------------------------

export function isValidIdempotencyKey(key: string): boolean {
  if (typeof key !== "string") return false;
  const len = key.length;
  return len >= IDEMPOTENCY_KEY_MIN && len <= IDEMPOTENCY_KEY_MAX;
}
