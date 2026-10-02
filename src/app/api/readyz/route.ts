import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";

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
    // bounded diagnostic category + the route, consistent with /api/health.
    const detail = safeDbDiagnostic(err);
    const prismaCode = safePrismaCode(err);
    console.error(JSON.stringify({
      level: "error",
      component: "readyz",
      route: "/api/readyz",
      message: "readyz DB check failed",
      diagnostic: detail ?? "database_error",
      ...(prismaCode ? { prismaCode } : {}),
    }));
    return apiError(ERROR_CODES.INTERNAL, "Database not reachable", 503);
  }
}

/** Bounded, safe diagnostic category (no raw exception text). */
function safeDbDiagnostic(err: unknown): string | undefined {
  if (!(err instanceof Error)) return undefined;
  const msg = err.message || "";
  if (/P1001|P1002|P1003/.test(msg)) return "database_unreachable";
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT/.test(msg)) return "database_connection_failed";
  if (/authentication|auth failed|password/i.test(msg)) return "database_auth_failed";
  return "database_error";
}

/** Extract a known-safe Prisma error code (e.g. P1001) without the message body. */
function safePrismaCode(err: unknown): string | undefined {
  if (!(err instanceof Error)) return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" && /^P[0-9]{3,4}$/.test(code)) return code;
  const msg = err.message || "";
  const match = msg.match(/\b(P[0-9]{3,4})\b/);
  return match ? match[1] : undefined;
}
