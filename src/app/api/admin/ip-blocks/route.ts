import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";
import { blockIp, unblockIp } from "@/lib/security";
import { z } from "zod";
import { parseBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/ip-blocks — list active IP blocks. */
export async function GET() {
  if (!(await getAdmin())) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const now = new Date();
  const blocks = await db.ipBlock.findMany({
    where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return apiOk({
    blocks: blocks.map((b) => ({
      id: b.id,
      ip: b.ip,
      reason: b.reason,
      expiresAt: b.expiresAt,
      createdAt: b.createdAt,
      permanent: b.expiresAt === null,
    })),
  });
}

const blockSchema = z.object({
  ip: z.string().min(1),
  reason: z.string().min(1).max(200),
  permanent: z.boolean().default(false),
});

/** POST /api/admin/ip-blocks — manually block an IP. */
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  const [data, err] = await parseBody(req as any, blockSchema);
  if (err) return err;
  await blockIp(data.ip, data.reason, data.permanent, admin.email);
  return apiOk({ message: `IP ${data.ip} blocked.` }, 201);
}

/** DELETE /api/admin/ip-blocks?ip=1.2.3.4 — unblock an IP. */
export async function DELETE(req: Request) {
  if (!(await getAdmin())) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const url = new URL(req.url);
  const ip = url.searchParams.get("ip");
  if (!ip) return apiError(ERROR_CODES.VALIDATION_FAILED, "Missing ?ip=", 400);
  await unblockIp(ip);
  return apiOk({ message: `IP ${ip} unblocked.` });
}
