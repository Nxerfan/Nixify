import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { z } from "zod";
import { signInAdmin, seedAdmin } from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** POST /api/admin/login — admin login. */
export async function POST(req: Request) {
  await seedAdmin(); // ensure seeded
  const [data, err] = await parseBody(req as any, schema);
  if (err) return err;
  const ok = await signInAdmin(data.email, data.password);
  if (!ok) {
    return apiError(ERROR_CODES.INVALID_CREDENTIALS, "Invalid admin credentials.", 401);
  }
  return apiOk({ message: "Logged in as admin" });
}
