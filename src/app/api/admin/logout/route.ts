import { apiOk } from "@/lib/api-response";
import { signOutAdmin } from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/logout — clears the admin cookie. */
export async function POST() {
  await signOutAdmin();
  return apiOk({ message: "Logged out" });
}
