import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/admin";
import { listPendingReviews } from "@/lib/broadcasts/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await getAdmin())) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Admin login required." } }, { status: 401 });
  }

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");

  const result = await listPendingReviews({
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
  });

  return NextResponse.json({
    broadcasts: result.broadcasts,
    total: result.total,
    page: result.page,
    page_size: result.pageSize,
  });
}
