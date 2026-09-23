import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/admin";
import { approveBroadcast } from "@/lib/broadcasts/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ broadcastId: string }> }) {
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Admin login required." } }, { status: 401 });
  }

  const { broadcastId } = await params;
  const result = await approveBroadcast(broadcastId, Number(admin.sub));
  return NextResponse.json(result);
}
