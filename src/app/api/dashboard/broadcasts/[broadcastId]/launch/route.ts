import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { launchBroadcast, BroadcastValidationError, IdempotencyConflictError } from "@/lib/broadcasts/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const launchSchema = z.object({
  scheduledAt: z.string().datetime().nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ broadcastId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Login required." } }, { status: 401 });
  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) return NextResponse.json({ error: { code: "feature_not_available" } }, { status: 403 });
  const bcastAccess = await canAccess(user.id, FEATURE_KEYS.BROADCAST_EMAILS);
  if (!bcastAccess.allowed) return NextResponse.json({ error: { code: "feature_not_available" } }, { status: 403 });

  const { broadcastId } = await params;
  let body: z.infer<typeof launchSchema> = {};
  try {
    const json = await req.json().catch(() => ({}));
    const result = launchSchema.safeParse(json);
    if (result.success) body = result.data;
  } catch {
    /* empty body is fine */
  }

  // Dashboard auto-generates the idempotency key for each launch click so the
  // same browser click is durable across retries.
  const idempotencyKey = randomUUID();

  try {
    const result = await launchBroadcast(user.id, broadcastId, {
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      idempotencyKey,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof IdempotencyConflictError) return NextResponse.json({ error: { code: "idempotency_conflict", message: err.message } }, { status: 409 });
    if (err instanceof BroadcastValidationError) {
      return NextResponse.json({ error: { code: "validation_failed", message: err.message } }, { status: 400 });
    }
    console.error("[dashboard/broadcasts/launch] safe_error_code: internal_error");
    return NextResponse.json({ error: { code: "internal_error", message: "Failed to launch broadcast." } }, { status: 500 });
  }
}
