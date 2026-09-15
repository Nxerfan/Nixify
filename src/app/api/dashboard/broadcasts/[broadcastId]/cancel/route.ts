import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { cancelBroadcast, BroadcastValidationError, IdempotencyConflictError } from "@/lib/broadcasts/service";

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
  // Dashboard auto-generates the idempotency key for each cancel click.
  const idempotencyKey = randomUUID();
  try {
    const result = await cancelBroadcast(user.id, broadcastId, { idempotencyKey });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof IdempotencyConflictError) return NextResponse.json({ error: { code: "idempotency_conflict", message: err.message } }, { status: 409 });
    if (err instanceof BroadcastValidationError) {
      return NextResponse.json({ error: { code: "validation_failed", message: err.message } }, { status: 400 });
    }
    console.error("[dashboard/broadcasts/cancel] safe_error_code: internal_error");
    return NextResponse.json({ error: { code: "internal_error", message: "Failed to cancel broadcast." } }, { status: 500 });
  }
}
