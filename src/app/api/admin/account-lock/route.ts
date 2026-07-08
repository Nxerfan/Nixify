import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";
import { adminLockAccount, adminUnlockAccount } from "@/lib/security";
import { z } from "zod";
import { parseBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  action: z.enum(["lock", "unlock"]),
});

/** GET /api/admin/account-lock?email=... — view lock status. */
export async function GET(req: Request) {
  if (!(await getAdmin())) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  if (!email) return apiError(ERROR_CODES.VALIDATION_FAILED, "Missing ?email=", 400);
  const user = await db.user.findUnique({
    where: { email },
    select: { email: true, lockedReason: true, lockedUntil: true, lockedAt: true },
  });
  if (!user) return apiError(ERROR_CODES.NOT_FOUND, "User not found.", 404);
  const now = new Date();
  const isActive = user.lockedUntil && user.lockedUntil > now;
  const isPermanent = !user.lockedUntil && !!user.lockedReason;
  return apiOk({
    email: user.email,
    locked: !!isActive || isPermanent,
    reason: user.lockedReason,
    until: user.lockedUntil,
    at: user.lockedAt,
  });
}

/** POST /api/admin/account-lock — lock or unlock an account manually. */
export async function POST(req: Request) {
  if (!(await getAdmin())) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const [data, err] = await parseBody(req as any, schema);
  if (err) return err;
  if (data.action === "lock") {
    await adminLockAccount(data.email);
    return apiOk({ message: `Account ${data.email} locked.` });
  } else {
    await adminUnlockAccount(data.email);
    return apiOk({ message: `Account ${data.email} unlocked.` });
  }
}
