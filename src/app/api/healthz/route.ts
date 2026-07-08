import { apiOk } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 200 if the process is up.
export async function GET() {
  return apiOk({ status: "ok", timestamp: new Date().toISOString() });
}
