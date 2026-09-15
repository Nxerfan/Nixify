import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  getBroadcast,
  updateBroadcast,
  deleteBroadcast,
  listRecipients,
  BroadcastValidationError,
} from "@/lib/broadcasts/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  htmlContent: z.string().min(1).optional(),
  textContent: z.string().nullable().optional(),
  audienceType: z.enum(["all_contacts", "group"]).optional(),
  targetGroupId: z.number().int().positive().nullable().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ broadcastId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Login required." } }, { status: 401 });
  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) return NextResponse.json({ error: { code: "feature_not_available" } }, { status: 403 });
  const bcastAccess = await canAccess(user.id, FEATURE_KEYS.BROADCAST_EMAILS);
  if (!bcastAccess.allowed) return NextResponse.json({ error: { code: "feature_not_available" } }, { status: 403 });

  const { broadcastId } = await params;
  const broadcast = await getBroadcast(user.id, broadcastId);
  if (!broadcast) return NextResponse.json({ error: { code: "broadcast_not_found", message: "Broadcast not found." } }, { status: 404 });
  return NextResponse.json(broadcast);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ broadcastId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Login required." } }, { status: 401 });
  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) return NextResponse.json({ error: { code: "feature_not_available" } }, { status: 403 });
  const bcastAccess = await canAccess(user.id, FEATURE_KEYS.BROADCAST_EMAILS);
  if (!bcastAccess.allowed) return NextResponse.json({ error: { code: "feature_not_available" } }, { status: 403 });

  const { broadcastId } = await params;
  let body: z.infer<typeof updateSchema>;
  try {
    const json = await req.json();
    const result = updateSchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
      return NextResponse.json({ error: { code: "validation_failed", message: msg } }, { status: 400 });
    }
    body = result.data;
  } catch {
    return NextResponse.json({ error: { code: "validation_failed", message: "Invalid JSON body." } }, { status: 400 });
  }

  try {
    const broadcast = await updateBroadcast(user.id, broadcastId, body);
    if (!broadcast) return NextResponse.json({ error: { code: "broadcast_not_found", message: "Broadcast not found." } }, { status: 404 });
    return NextResponse.json(broadcast);
  } catch (err) {
    if (err instanceof BroadcastValidationError) {
      return NextResponse.json({ error: { code: "validation_failed", message: err.message } }, { status: 400 });
    }
    console.error("[dashboard/broadcasts/patch] safe_error_code: internal_error");
    return NextResponse.json({ error: { code: "internal_error", message: "Failed to update broadcast." } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ broadcastId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Login required." } }, { status: 401 });
  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) return NextResponse.json({ error: { code: "feature_not_available" } }, { status: 403 });
  const bcastAccess = await canAccess(user.id, FEATURE_KEYS.BROADCAST_EMAILS);
  if (!bcastAccess.allowed) return NextResponse.json({ error: { code: "feature_not_available" } }, { status: 403 });

  const { broadcastId } = await params;
  try {
    const deleted = await deleteBroadcast(user.id, broadcastId);
    if (!deleted) return NextResponse.json({ error: { code: "broadcast_not_found", message: "Broadcast not found." } }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    if (err instanceof BroadcastValidationError) {
      return NextResponse.json({ error: { code: "validation_failed", message: err.message } }, { status: 400 });
    }
    console.error("[dashboard/broadcasts/delete] safe_error_code: internal_error");
    return NextResponse.json({ error: { code: "internal_error", message: "Failed to delete broadcast." } }, { status: 500 });
  }
}
