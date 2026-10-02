import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — production health check.
 * Checks: database, SMTP config, Redis (if configured).
 * Returns 200 if operational, 503 if any critical service is down.
 */

interface ServiceStatus {
  status: "operational" | "degraded" | "down";
  latencyMs?: number;
  // Bounded, safe diagnostic for the PUBLIC response. NEVER the raw DB
  // exception message (which can contain hostnames, connection-string
  // fragments, Prisma internals, or credential-adjacent text). The full
  // error is logged server-side only (see logger.error below).
  detail?: string;
}

/**
 * Map a raw DB error to a bounded, safe public diagnostic string.
 * Returns undefined when the error class is unknown — fail closed by saying
 * nothing specific rather than echoing internal exception text.
 */
function safeDbDiagnostic(err: unknown): string | undefined {
  if (!(err instanceof Error)) return undefined;
  const msg = err.message || "";
  // Prisma connection errors carry known codes; surface only the category,
  // never the message body (which may include host/port/credentials context).
  // P1001 = can't reach database server; P1002 = timed out; P1003 = does not exist.
  if (/P1001|P1002|P1003/.test(msg)) return "database_unreachable";
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT/.test(msg)) return "database_connection_failed";
  if (/authentication|auth failed|password/i.test(msg)) return "database_auth_failed";
  return "database_error";
}

export async function GET() {
  const start = Date.now();
  const services: Record<string, ServiceStatus> = {};

  // Database
  try {
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    services.database = { status: "operational", latencyMs: Date.now() - dbStart };
  } catch (err) {
    // SECURITY: the raw error message (err.message) can contain hostnames,
    // connection-string fragments, or Prisma internals. It MUST NOT appear in
    // the public response. Surface only a bounded diagnostic category; log
    // the full error server-side for operators.
    const detail = safeDbDiagnostic(err);
    services.database = { status: "down", detail };
    logger.error("Health: DB down", {
      // Full error retained for server-side logs only — never serialized into
      // the public JSON response below.
      error: err instanceof Error ? err.message : "Unknown",
      detail,
    });
  }

  // SMTP (config check only)
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  services.smtp = {
    status: smtpUser && smtpPass && smtpPass !== "your_16_char_app_password" ? "operational" : "degraded",
    detail: !smtpUser ? "SMTP_USER not set" : !smtpPass ? "SMTP_PASS not set" : undefined,
  };

  // Redis (if configured)
  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const rStart = Date.now();
      await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
        signal: AbortSignal.timeout(2000),
      });
      services.redis = { status: "operational", latencyMs: Date.now() - rStart };
    } catch {
      services.redis = { status: "degraded", detail: "Redis unreachable" };
    }
  }

  const allDown = Object.values(services).some((s) => s.status === "down");
  const anyDegraded = Object.values(services).some((s) => s.status === "degraded");
  const overall = allDown ? "down" : anyDegraded ? "degraded" : "operational";

  return NextResponse.json(
    {
      success: overall !== "down",
      data: { status: overall, services, uptime: process.uptime(), timestamp: new Date().toISOString() },
      error: null,
      timestamp: new Date().toISOString(),
    },
    { status: overall === "down" ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
