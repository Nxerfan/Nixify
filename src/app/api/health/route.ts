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
  // fragments, Prisma internals, or credential-adjacent text). The raw error
  // is NOT shipped through the application logger either — only a bounded
  // diagnostic category + an optional safe Prisma error code are logged.
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

/**
 * Extract a known-safe Prisma error code from a thrown error, WITHOUT
 * including the message body. Prisma error codes (P1001, P2002, etc.) are
 * stable, documented identifiers that carry no host/credential context, so
 * they are safe to log. Returns undefined for non-Prisma errors.
 */
function safePrismaCode(err: unknown): string | undefined {
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
    // connection-string fragments, Prisma internals, or credential-adjacent
    // text. It MUST NOT appear in the public response AND MUST NOT be shipped
    // through the application logger (which may forward to a remote logging
    // provider). Log ONLY bounded operational metadata: the diagnostic
    // category, an optional safe Prisma error code, and the route/component.
    const detail = safeDbDiagnostic(err);
    const prismaCode = safePrismaCode(err);
    services.database = { status: "down", detail };
    logger.error("Health: DB down", {
      // Bounded, safe metadata ONLY — never err.message, never stack, never
      // hostname / username / password / connection-string fragments.
      component: "health",
      route: "/api/health",
      diagnostic: detail ?? "database_error",
      ...(prismaCode ? { prismaCode } : {}),
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
