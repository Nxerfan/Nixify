/**
 * Events idempotency (Phase 6, sections 9, 10, 11).
 *
 * Idempotency-Key header → SHA-256 (never plaintext).
 * Request fingerprint → SHA-256 of canonicalized request body.
 *
 * Canonicalization: recursively sort object keys so that {"a":1,"b":2} and
 * {"b":2,"a":1} produce the same fingerprint. Arrays preserve element order.
 */
import { createHash } from "crypto";

/** SHA-256 of the raw Idempotency-Key header value (NEVER store plaintext). */
export function hashIdempotencyKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Canonicalize a value for deterministic fingerprinting.
 * Objects: keys sorted recursively. Arrays: element order preserved.
 * Primitives: returned as-is.
 */
export function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    result[key] = canonicalize(obj[key]);
  }
  return result;
}

/**
 * Compute a deterministic request fingerprint from the semantic request.
 * Covers: normalized type, normalized email, environment, canonical data.
 */
export function computeRequestFingerprint(input: {
  type: string;
  email: string;
  environment: string;
  data: unknown;
}): string {
  const canonical = canonicalize({
    type: input.type.trim(),
    email: input.email.trim().toLowerCase(),
    environment: input.environment,
    data: input.data,
  });
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
