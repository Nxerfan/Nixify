/**
 * Log sanitizer — shared redaction + safe-error utilities.
 *
 * Used by the centralized logger (src/lib/logger.ts) AND the health routes
 * (src/app/api/health/route.ts, src/app/api/readyz/route.ts) so that neither
 * duplicates the redaction/error-classification logic. This module has NO
 * dependencies on the logger (avoiding a circular import).
 *
 * Contract:
 *   - Recursive redaction of sensitive keys (case-insensitive) through nested
 *     objects/arrays, replacing values with "[REDACTED]".
 *   - Safe Error serialization: NEVER err.message, never stack, never host/
 *     user/password. Exposes only the safe class name, an optional safe Prisma
 *     error code (P1001 etc.), and a bounded diagnostic category.
 *   - Bounded serialization: handles circular references, BigInt, throwing
 *     getters, and unexpected object shapes without throwing.
 */

/** Replacement value for redacted secrets. */
export const REDACTED = "[REDACTED]";

/**
 * Keys whose values must be redacted. Matched case-insensitively, including
 * nested keys. A key is redacted if its lowercased form equals any of these,
 * OR contains a recognized sensitive substring (e.g. "authorization",
 * "password", "apikey").
 */
const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /^authorization$/i,
  /^cookie$/i,
  /^set-cookie$/i,
  /^password$/i,
  /^pass$/i,
  /^secret$/i,
  /^token$/i,
  /^apikey$/i,
  /^api_key$/i,
  /^accesstoken$/i,
  /^refreshtoken$/i,
  /^jwt$/i,
  /^otp$/i,
  /^code$/i,
  /^smtppass$/i,
  /^databaseurl$/i,
  /^database_url$/i,
  /^connectionstring$/i,
  /^connection_string$/i,
  /^csrf/i,
  /^session$/i,
];

/** Substrings that mark a key as sensitive even within a longer name. */
const SENSITIVE_SUBSTRINGS: readonly string[] = [
  "password",
  "passwd",
  "secret",
  "token",
  "authorization",
  "cookie",
  "privatekey",
  "private_key",
  "smtp_pass",
  "smtppass",
  "database_url",
  "databaseurl",
  "connectionstring",
];

export function isSensitiveKey(key: string): boolean {
  if (typeof key !== "string") return false;
  const lower = key.toLowerCase();
  for (const pat of SENSITIVE_KEY_PATTERNS) {
    if (pat.test(lower)) return true;
  }
  for (const sub of SENSITIVE_SUBSTRINGS) {
    if (lower.includes(sub)) return true;
  }
  return false;
}

/** Pruned set of WeakMap-tracked seen objects to prevent infinite recursion. */
type Seen = WeakMap<object, true>;

/** Max recursion depth — defense against pathological nesting. */
const MAX_DEPTH = 10;

/**
 * Recursively sanitize a value for logging. Redacts sensitive keys, handles
 * circular refs / BigInt / throwing getters. NEVER throws.
 */
export function sanitizeForLog(value: unknown, depth = 0, seen: Seen = new WeakMap()): unknown {
  if (depth > MAX_DEPTH) return "[max_depth]";
  if (value === null || value === undefined) return value;
  const t = typeof value;

  // Primitives: return as-is. BigInt is not JSON-serializable — stringify it.
  if (t === "string" || t === "number" || t === "boolean") return value;
  if (t === "bigint") return value.toString() + "n";
  if (t === "symbol") return value.toString();
  if (t === "function") return "[function]";

  // Error objects: use the safe error representation.
  if (value instanceof Error) return safeErrorRep(value);

  // Objects / arrays.
  if (t === "object") {
    // Guard against circular references.
    if (seen.has(value as object)) return "[circular]";
    seen.set(value as object, true);
    try {
      if (Array.isArray(value)) {
        return value.map((v) => sanitizeForLog(v, depth + 1, seen));
      }
      // Dates serialize fine; leave them to JSON.stringify.
      if (value instanceof Date) return value.toISOString();
      // URL objects: redact the whole thing (may contain credentials).
      if (typeof URL !== "undefined" && value instanceof URL) return REDACTED;
      // Headers / Map: iterate keys safely.
      const out: Record<string, unknown> = {};
      // Use Object.keys (own enumerable) — avoids prototype surprises.
      const keys = safeKeys(value as object);
      for (const k of keys) {
        if (isSensitiveKey(k)) {
          out[k] = REDACTED;
          continue;
        }
        out[k] = sanitizeForLog(safeGet(value as object, k), depth + 1, seen);
      }
      return out;
    } catch {
      return "[unserializable]";
    }
  }
  return String(value);
}

/** Object.keys that never throws (handles proxies / throwing accessors). */
function safeKeys(obj: object): string[] {
  try {
    return Object.keys(obj);
  } catch {
    return [];
  }
}

/** Safe property accessor that never throws (handles throwing getters). */
function safeGet(obj: object, key: string): unknown {
  try {
    return (obj as Record<string, unknown>)[key];
  } catch {
    return "[throwing_getter]";
  }
}

/** Bounded diagnostic categories for DB failures. */
export type DbDiagnostic =
  | "database_unreachable"
  | "database_connection_failed"
  | "database_auth_failed"
  | "database_error";

/**
 * Map a raw DB error to a bounded, safe diagnostic category. NEVER exposes
 * the raw message — only classifies it into a safe bucket.
 */
export function safeDbDiagnostic(err: unknown): DbDiagnostic | undefined {
  if (!(err instanceof Error)) return undefined;
  const msg = err.message || "";
  const code = (err as { code?: unknown }).code;
  const codeStr = typeof code === "string" ? code : "";
  // Prisma connection error codes: P1001 can't reach server, P1002 timed out,
  // P1003 database does not exist. Check the .code property FIRST (the message
  // body may also contain credential-adjacent text like "password=" that would
  // otherwise misclassify as an auth error).
  if (/^P100[123]$/.test(codeStr)) return "database_unreachable";
  if (/P1001|P1002|P1003/.test(msg)) return "database_unreachable";
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT/.test(msg)) return "database_connection_failed";
  if (/authentication|auth failed|password/i.test(msg)) return "database_auth_failed";
  return "database_error";
}

/**
 * Extract a known-safe Prisma error code from a thrown error, WITHOUT
 * including the message body. Prisma error codes (P1001, P2002, etc.) are
 * stable, documented identifiers that carry no host/credential context, so
 * they are safe to log. Returns undefined for non-Prisma errors.
 */
export function safePrismaCode(err: unknown): string | undefined {
  if (!(err instanceof Error)) return undefined;
  // Prisma client errors expose `.code` (e.g. "P1001"). Check own properties.
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" && /^P[0-9]{3,4}$/.test(code)) return code;
  // Some Prisma errors embed the code in the message — extract ONLY the code
  // token, never the surrounding message text.
  const msg = err.message || "";
  const match = msg.match(/\b(P[0-9]{3,4})\b/);
  return match ? match[1] : undefined;
}

/**
 * A bounded, safe representation of an Error for logging. NEVER includes
 * err.message, stack, host, user, password, or connection-string fragments.
 */
export interface SafeErrorRep {
  /** The Error class name (e.g. "TypeError", "PrismaClientKnownRequestError"). */
  name: string;
  /** Bounded diagnostic category (e.g. "database_error", "network_error"). */
  diagnostic: string;
  /** Optional safe Prisma error code (e.g. "P1001") — never the message body. */
  prismaCode?: string;
}

/**
 * Build a bounded, safe representation of an Error for logging. NEVER throws.
 * Never includes err.message or stack — callers needing a human-readable
 * diagnostic must pass an explicit bounded `diagnostic` category.
 */
export function safeErrorRep(err: unknown, explicitDiagnostic?: string): SafeErrorRep {
  const name = err instanceof Error ? err.constructor.name || "Error" : "Unknown";
  let diagnostic: string;
  if (explicitDiagnostic) {
    diagnostic = explicitDiagnostic;
  } else if (err instanceof Error) {
    diagnostic = safeDbDiagnostic(err) ?? classifyError(err);
  } else {
    diagnostic = "unknown_error";
  }
  const rep: SafeErrorRep = { name, diagnostic };
  const prismaCode = safePrismaCode(err);
  if (prismaCode) rep.prismaCode = prismaCode;
  return rep;
}

/** Classify a generic Error into a bounded category without its message. */
function classifyError(err: Error): string {
  const name = err.constructor.name || "Error";
  if (/Timeout/i.test(name) || err.name === "AbortError") return "timeout";
  if (/Network|Fetch|Connection/i.test(name)) return "network_error";
  if (/Type|Syntax|Range|Reference/i.test(name)) return `${name.toLowerCase()}`;
  return "error";
}
