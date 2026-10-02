import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { safeDbDiagnostic, safePrismaCode } from "@/lib/log-sanitizer";

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
    // bounded diagnostic category + the route (utilities shared via
    // src/lib/log-sanitizer.ts to avoid duplication with /api/health).
    // This is a known DB operation — an unclassified failure here IS a
    // database_error (NOT a generic application error).
    const detail = safeDbDiagnostic(err) ?? "database_error";
    const prismaCode = safePrismaCode(err);
    console.error(JSON.stringify({
      level: "error",
      component: "readyz",
      route: "/api/readyz",
      message: "readyz DB check failed",
      diagnostic: detail,
      ...(prismaCode ? { prismaCode } : {}),
    }));
    return apiError(ERROR_CODES.INTERNAL, "Database not reachable", 503);
  }
}
