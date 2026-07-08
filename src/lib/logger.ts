/**
 * Structured logger — production-grade JSON logging.
 * In production, integrates with Axiom/Logtail via the LOGTAIL_TOKEN env var.
 * In development, pretty-prints to console.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("OTP sent", { email, requestId });
 *   logger.error("SMTP failed", { error: err.message });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === "production";
const isLogtailConfigured = !!process.env.LOGTAIL_TOKEN;

/** Logtail/Axiom HTTP ingestion endpoint. */
const LOGTAIL_URL = "https://in.logtail.com/api/v1/json";

async function shipToLogtail(entries: LogEntry[]): Promise<void> {
  if (!isLogtailConfigured) return;
  try {
    await fetch(LOGTAIL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LOGTAIL_TOKEN}`,
      },
      body: JSON.stringify(entries),
      // Fire-and-forget in production — don't block the request.
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Swallow — logging must never break the app.
  }
}

function formatEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: "nixify",
    environment: process.env.NODE_ENV ?? "development",
    ...meta,
  };
}

function prettyPrint(entry: LogEntry): void {
  const color = { debug: "\x1b[36m", info: "\x1b[32m", warn: "\x1b[33m", error: "\x1b[31m" }[entry.level];
  const reset = "\x1b[0m";
  const meta = Object.entries(entry)
    .filter(([k]) => !["level", "message", "timestamp", "service", "environment"].includes(k))
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" ");
  console.log(`${color}[${entry.level.toUpperCase()}]${reset} ${entry.message} ${meta ? `· ${meta}` : ""}`);
}

const buffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  if (buffer.length === 0) return;
  const entries = buffer.splice(0);
  void shipToLogtail(entries);
  flushTimer = null;
}

function scheduleFlush(): void {
  if (flushTimer || !isProduction) return;
  flushTimer = setTimeout(flush, 5000);
  if (buffer.length >= 50) flush();
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry = formatEntry(level, message, meta);

  if (!isProduction) {
    prettyPrint(entry);
    return;
  }

  // Production: buffer + ship to Logtail/Axiom.
  buffer.push(entry);
  scheduleFlush();
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
  /** Flush buffered logs immediately (call on shutdown). */
  flush,
};
