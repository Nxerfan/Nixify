import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeDbDiagnostic, safePrismaCode } from "@/lib/log-sanitizer";
import { checkRedisHealth } from "@/lib/deployment/redis-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — production health check.
 * Checks: database, SMTP config, Redis (if configured — optional).
 * Returns 200 if operational or degraded, 503 if any CRITICAL service is down.
 *
 * ─── Critical vs non-critical ──────────────────────────────────────────────
 *
 *   - Database:   CRITICAL. DB down → overall "down", HTTP 503.
 *   - SMTP:       NON-critical (config-only check). Degraded → HTTP 200.
 *   - Redis:      NON-critical (optional dependency). Not configured →
 *                 does NOT degrade health. Degraded → HTTP 200.
 *                 Nixify's rate limiting is DB-backed; Redis is optional.
 *
 * ─── Security ──────────────────────────────────────────────────────────────
 *
 * Public health responses use bounded, safe diagnostics ONLY. Raw exception
 * text, upstream response bodies, tokens, Authorization headers, hostnames,
 * and stack traces are NEVER in the public response OR the logger metadata.
 */

interface ServiceStatus {
  status: "operational" | "degraded" | "down";
  latencyMs?: number;
  detail?: string;
}

/** Known placeholder/example SMTP password values from .env.example. */
const KNOWN_PLACEHOLDER_SMTP_PASSWORDS: readonly string[] = [
  "your_16_char_app_password",
  "your-16-char-app-password",
  "your_16-char-app-password",
];

/** Known placeholder/example SMTP user values from .env.example. */
const KNOWN_PLACEHOLDER_SMTP_USERS: readonly string[] = [
  "your-email@gmail.com",
  "your-email@example.com",
];

export async function GET() {
  const start = Date.now();
  const services: Record<string, ServiceStatus> = {};

  // ---- Database (CRITICAL) ----
  try {
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    services.database = { status: "operational", latencyMs: Date.now() - dbStart };
  } catch (err) {
    const detail = safeDbDiagnostic(err) ?? "database_error";
    const prismaCode = safePrismaCode(err);
    services.database = { status: "down", detail };
    logger.error("Health: DB down", {
      component: "health",
      route: "/api/health",
      diagnostic: detail,
      ...(prismaCode ? { prismaCode } : {}),
    });
  }

  // ---- SMTP (NON-critical — config-only check, no SMTP transaction) ----
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpUserIsPlaceholder = smtpUser && KNOWN_PLACEHOLDER_SMTP_USERS.includes(smtpUser);
  const smtpPassIsPlaceholder = smtpPass && KNOWN_PLACEHOLDER_SMTP_PASSWORDS.includes(smtpPass);
  const smtpConfigured = smtpUser && smtpPass && !smtpUserIsPlaceholder && !smtpPassIsPlaceholder;
  services.smtp = {
    status: smtpConfigured ? "operational" : "degraded",
    detail: !smtpUser ? "SMTP_USER not set" : !smtpPass ? "SMTP_PASS not set"
      : smtpUserIsPlaceholder ? "SMTP_USER placeholder"
      : smtpPassIsPlaceholder ? "SMTP_PASS placeholder"
      : undefined,
  };

  // ---- Redis (NON-critical — optional dependency) ----
  const redisHealth = await checkRedisHealth();
  if (redisHealth.status !== "not_configured") {
    services.redis = {
      status: redisHealth.status,
      latencyMs: redisHealth.latencyMs,
      detail: redisHealth.detail,
    };
    // Log Redis degradation with bounded diagnostics (no token/URL/body).
    if (redisHealth.status === "degraded") {
      logger.warn("Health: Redis degraded", {
        component: "health",
        route: "/api/health",
        diagnostic: redisHealth.detail ?? "redis_error",
        ...(redisHealth.latencyMs !== undefined ? { latencyMs: redisHealth.latencyMs } : {}),
      });
    }
  }
  // If Redis is not_configured, we OMIT services.redis entirely (preserve
  // existing omission behavior — absent Redis does NOT degrade health).

  // ---- Overall status ----
  // DB down → overall "down" (503). Redis/SMTP degraded → overall "degraded" (200).
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
