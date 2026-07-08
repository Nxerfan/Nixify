import { apiOk } from "@/lib/api-response";
import { clearSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout — clears the auth cookie (§13.2).
 */
export async function POST() {
  await clearSessionCookie();
  return apiOk({ message: "Logged out" });
}
