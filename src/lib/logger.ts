/**
 * Nixify canonical production logger.
 *
 * ─── Architecture (this stage) ────────────────────────────────────────────
 *
 * Production logs are written IMMEDIATELY to stdout/stderr as structured JSON.
 * There is NO in-memory buffer and NO flush timer — a serverless invocation
 * may finish before an arbitrary timer fires, so logs must exist the moment
 * they are emitted. The hosting runtime (Vercel) captures stdout/stderr and
 * the operator may drain them to an external log sink operationally; that
 * is NOT the application's correctness concern.
 *
 * ─── No bespoke remote shipper ─────────────────────────────────────────────
 *
 * The previous implementation buffered logs and shipped them to a hard-coded
 * third-party HTTP ingestion endpoint gated on a vendor token env var. That was
 * unreliable (fire-and-forget on a 5s timer in a serverless runtime) and
 * misleading (the comments claimed support for two vendors while implementing
 * only one hard-coded endpoint). The bespoke shipper has been REMOVED.
 *
 * Nixify itself implements ONLY structured JSON logging to stdout/stderr. It
 * does NOT integrate with Axiom, Logtail, Sentry, or any third-party
 * observability vendor. An operator may drain Vercel's captured logs to such a
 * service externally — that is an operational configuration outside application
 * correctness.
 *
 * ─── Safety contract ──────────────────────────────────────────────────────
 *
 *   - All metadata passes through the shared recursive redactor
 *     (src/lib/log-sanitizer.ts) before output. Sensitive keys
 *     (authorization, cookie, password, secret, token, apiKey, otp, code,
 *     DATABASE_URL, etc.) are replaced with "[REDACTED]", including in nested
 *     objects/arrays.
 *   - Error objects are serialized via safeErrorRep — NEVER err.message,
 *     NEVER stack, NEVER host/user/password. Only the safe class name, a
 *     bounded diagnostic category, and an optional safe Prisma error code.
 *   - The logger NEVER throws: circular refs, BigInt, throwing getters, and
 *     unexpected object shapes are handled by a bounded serializer.
 *   - PII policy: do not log raw email/phone/OTP/password. Prefer
 *     userId/requestId/apiKeyId/otp_request_id identifiers.
 *
 * ─── Development ───────────────────────────────────────────────────────────
 *
 * Development (NODE_ENV !== "production") pretty-prints the ALREADY-sanitized
 * entry. The SAME redaction contract applies in development — secrets are not
 * exposed locally merely because NODE_ENV is not production.
 */

import {
  sanitizeForLog,
  safeErrorRep,
  isSensitiveKey,
  REDACTED,
  type SafeErrorRep,
} from "@/lib/log-sanitizer";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: "nixify";
  environment: string;
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === "production";

/**
 * Normalize a caller's metadata map into a safe, serializable record.
 * - Sensitive keys are recursively redacted (top-level AND nested).
 * - Error instances become bounded SafeErrorRep objects.
 * - The whole thing is then JSON-safe.
 */
function sanitizeMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    // Top-level sensitive keys are redacted directly (don't recurse into the
    // value — the whole value is replaced, even if it's an object).
    if (isSensitiveKey(k)) {
      out[k] = REDACTED;
      continue;
    }
    if (v instanceof Error) {
      // Explicit caller hint for a bounded diagnostic may come via a sibling
      // key; otherwise safeErrorRep classifies by error class.
      out[k] = safeErrorRep(v);
    } else {
      out[k] = sanitizeForLog(v);
    }
  }
  return out;
}

/** Canonical logger fields that MUST NOT be overridable by caller metadata. */
const CANONICAL_KEYS = new Set(["level", "message", "timestamp", "service", "environment"]);

function buildEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
  // Spread SANITIZED metadata FIRST, then write canonical fields LAST so they
  // CANNOT be overwritten by caller metadata. A caller that passes
  // { level: "info", message: "spoofed", service: "other" } must NOT affect the
  // emitted level/message/service/timestamp/environment.
  const sanitized = sanitizeMeta(meta);
  // Belt-and-suspenders: also strip canonical keys from the sanitized metadata
  // so they cannot survive into the entry even before the canonical writes.
  for (const k of CANONICAL_KEYS) {
    if (k in sanitized) delete (sanitized as Record<string, unknown>)[k];
  }
  return {
    ...sanitized,
    level,
    message,
    timestamp: new Date().toISOString(),
    service: "nixify",
    environment: process.env.NODE_ENV ?? "development",
  };
}

/** Production: write structured JSON to stdout/stderr IMMEDIATELY (no buffer). */
function emitProduction(entry: LogEntry): void {
  // NEVER throw from logging. JSON.stringify on a pre-sanitized entry is safe,
  // but guard anyway against any unexpected failure.
  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    line = JSON.stringify({
      level: entry.level,
      message: entry.message,
      timestamp: entry.timestamp,
      service: "nixify",
      environment: entry.environment,
      error: "[log_serialization_failed]",
    });
  }
  // Errors and warnings → stderr; info/debug → stdout. Runtime captures both.
  const stream = entry.level === "error" || entry.level === "warn" ? process.stderr : process.stdout;
  try {
    stream.write(line + "\n");
  } catch {
    // If even stream.write fails (rare in serverless), fall back to console.
    // console.* are themselves safe and captured by the runtime.
    if (entry.level === "error") console.error(line);
    else console.log(line);
  }
}

const COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};
const RESET = "\x1b[0m";
const RESERVED_KEYS = new Set(["level", "message", "timestamp", "service", "environment"]);

/** Development: pretty-print the ALREADY-sanitized entry. */
function prettyPrint(entry: LogEntry): void {
  const color = COLORS[entry.level];
  const meta = Object.entries(entry)
    .filter(([k]) => !RESERVED_KEYS.has(k))
    .map(([k, v]) => {
      const vs = typeof v === "string" ? v : safeStringify(v);
      return `${k}=${vs}`;
    })
    .join(" ");
  const line = `${color}[${entry.level.toUpperCase()}]${RESET} ${entry.message}${meta ? ` · ${meta}` : ""}`;
  const stream = entry.level === "error" || entry.level === "warn" ? console.error : console.log;
  stream(line);
}

/** Safe JSON.stringify that never throws (handles BigInt/circular post-sanitization). */
function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  // The logger MUST NEVER throw. Wrap the entire path in try/catch.
  try {
    const entry = buildEntry(level, message, meta);
    if (isProduction) {
      emitProduction(entry);
    } else {
      prettyPrint(entry);
    }
  } catch {
    // Last-resort: a plain console message so we never break the caller.
    try {
      console.error("[logger_internal_failure]", level, message);
    } catch {
      /* nothing more we can do */
    }
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};

/** Re-exported for tests / type-only consumers. */
export type { SafeErrorRep };
