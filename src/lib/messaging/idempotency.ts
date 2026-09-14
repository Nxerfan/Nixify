/**
 * Idempotency (Phase 4, sections 13-14).
 *
 * The Idempotency-Key header is hashed (SHA-256) — never stored plaintext. A
 * separate request fingerprint (also SHA-256) is computed over the canonicalized
 * semantic request so we can detect same-key-different-body conflicts.
 *
 * Canonicalization is deterministic: keys are sorted, recipient is normalized
 * (lowercased/trimmed), and the variable map is sorted by key. This means two
 * requests with the same semantic content but different key orders in JSON
 * produce the same fingerprint (and so are treated as replays, not conflicts).
 */
import { createHash } from "crypto";

/** Canonicalize the request for fingerprinting. Deterministic ordering. */
export function canonicalizeRequest(input: {
  to: string;
  templateSlug: string;
  templateVersion?: number;
  variables: Record<string, unknown>;
}): string {
  const normalizedTo = (input.to || "").trim().toLowerCase();
  const slug = input.templateSlug;
  const version = input.templateVersion ?? null;
  // Sort variable keys for stable fingerprinting.
  const sortedVars: Record<string, unknown> = {};
  for (const k of Object.keys(input.variables).sort()) {
    sortedVars[k] = input.variables[k];
  }
  return JSON.stringify({ to: normalizedTo, slug, version, vars: sortedVars });
}

/** SHA-256 of the raw Idempotency-Key header value (NEVER store plaintext). */
export function hashIdempotencyKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** SHA-256 of the canonicalized request (for conflict detection). */
export function computeRequestFingerprint(input: {
  to: string;
  templateSlug: string;
  templateVersion?: number;
  variables: Record<string, unknown>;
}): string {
  return createHash("sha256").update(canonicalizeRequest(input)).digest("hex");
}
