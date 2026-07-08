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
    console.error("readyz DB check failed:", err instanceof Error ? err.message : "unknown");
    return apiError(ERROR_CODES.INTERNAL, "Database not reachable", 503);
  }
}
