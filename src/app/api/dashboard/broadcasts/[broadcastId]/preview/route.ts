import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { previewBroadcast } from "@/lib/broadcasts/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ broadcastId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Login required." } }, { status: 401 });
  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) return NextResponse.json({ error: { code: "feature_not_available" } }, { status: 403 });
  const bcastAccess = await canAccess(user.id, FEATURE_KEYS.BROADCAST_EMAILS);
  if (!bcastAccess.allowed) return NextResponse.json({ error: { code: "feature_not_available" } }, { status: 403 });

  const { broadcastId } = await params;
  const preview = await previewBroadcast(user.id, broadcastId);
  if (!preview) return NextResponse.json({ error: { code: "broadcast_not_found", message: "Broadcast not found." } }, { status: 404 });

  return NextResponse.json({
    total: preview.total,
    eligible: preview.eligible,
    unknown: preview.unknown,
    unsubscribed: preview.unsubscribed,
    suppressed: preview.suppressed,
    note: "Preview eligibility reflects current consent state. Consent is re-checked at send time.",
  });
}
