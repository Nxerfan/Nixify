import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { safeDbDiagnostic, safePrismaCode } from "@/lib/log-sanitizer";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 200 if the DB is reachable (simple SELECT 1).
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return apiOk({ status: "ready", database: "ok" });
  } catch (err) {
    // SECURITY: do NOT log the raw err.message — it can contain hostnames,
    // connection-string fragments, or credential-adjacent text. Log only a
    // bounded diagnostic category + the route via the canonical logger
    // (shared utilities in src/lib/log-sanitizer.ts). This is a known DB
    // operation — an unclassified failure here IS a database_error.
    const detail = safeDbDiagnostic(err) ?? "database_error";
    const prismaCode = safePrismaCode(err);
    logger.error("readyz DB check failed", {
      component: "readyz",
      route: "/api/readyz",
      diagnostic: detail,
      ...(prismaCode ? { prismaCode } : {}),
    });
    return apiError(ERROR_CODES.INTERNAL, "Database not reachable", 503);
  }
}
