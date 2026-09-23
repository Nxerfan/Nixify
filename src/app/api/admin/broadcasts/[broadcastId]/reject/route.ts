import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/auth/admin";
import { rejectBroadcast } from "@/lib/broadcasts/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rejectSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ broadcastId: string }> }) {
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Admin login required." } }, { status: 401 });
  }

  const { broadcastId } = await params;
  let body: z.infer<typeof rejectSchema>;
  try {
    const json = await req.json();
    const result = rejectSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json({ error: { code: "validation_failed", message: "Reason is required (1-500 chars)." } }, { status: 400 });
    }
    body = result.data;
  } catch {
    return NextResponse.json({ error: { code: "validation_failed", message: "Invalid JSON body." } }, { status: 400 });
  }

  const result = await rejectBroadcast(broadcastId, Number(admin.sub), body.reason);
  return NextResponse.json(result);
}
