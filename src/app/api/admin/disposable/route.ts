import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";
import { setDisposableDomain, removeDisposableDomain } from "@/lib/security";
import { z } from "zod";
import { parseBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/disposable — list block + allow domains. */
export async function GET() {
  if (!(await getAdmin())) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const domains = await db.disposableDomain.findMany({
    orderBy: { domain: "asc" },
    take: 1000,
  });
  return apiOk({
    block: domains.filter((d) => d.listType === "block").map((d) => ({ domain: d.domain, source: d.source })),
    allow: domains.filter((d) => d.listType === "allow").map((d) => ({ domain: d.domain, source: d.source })),
  });
}

const schema = z.object({
  domain: z.string().min(1).max(254),
  listType: z.enum(["block", "allow"]),
});

/** POST /api/admin/disposable — add a domain to block or allow list. */
export async function POST(req: Request) {
  if (!(await getAdmin())) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const [data, err] = await parseBody(req as any, schema);
  if (err) return err;
  await setDisposableDomain(data.domain, data.listType);
  return apiOk({ message: `Domain ${data.domain} added to ${data.listType} list.` }, 201);
}

/** DELETE /api/admin/disposable?domain=... — remove a domain from all lists. */
export async function DELETE(req: Request) {
  if (!(await getAdmin())) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const url = new URL(req.url);
  const domain = url.searchParams.get("domain");
  if (!domain) return apiError(ERROR_CODES.VALIDATION_FAILED, "Missing ?domain=", 400);
  await removeDisposableDomain(domain);
  return apiOk({ message: `Domain ${domain} removed.` });
}
