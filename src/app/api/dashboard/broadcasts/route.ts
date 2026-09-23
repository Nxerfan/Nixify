import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  createBroadcast,
  listBroadcasts,
  BroadcastValidationError,
} from "@/lib/broadcasts/service";
import { AUDIENCE_TYPES } from "@/lib/broadcasts/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(200),
  htmlContent: z.string().min(1),
  textContent: z.string().nullable().optional(),
  audienceType: z.enum(["all_contacts", "group"]),
  targetGroupId: z.number().int().positive().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Login required." } }, { status: 401 });
  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) return NextResponse.json({ error: { code: "feature_not_available", message: "Broadcasts not available." } }, { status: 403 });
  const bcastAccess = await canAccess(user.id, FEATURE_KEYS.BROADCAST_EMAILS);
  if (!bcastAccess.allowed) return NextResponse.json({ error: { code: "feature_not_available", message: "Broadcasts not available." } }, { status: 403 });

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  const status = url.searchParams.get("status") ?? undefined;

  const result = await listBroadcasts(user.id, {
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    status: status || undefined,
  });

  return NextResponse.json({
    broadcasts: result.broadcasts,
    total: result.total,
    page: result.page,
    page_size: result.pageSize,
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Login required." } }, { status: 401 });
  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) return NextResponse.json({ error: { code: "feature_not_available", message: "Broadcasts not available." } }, { status: 403 });
  const bcastAccess = await canAccess(user.id, FEATURE_KEYS.BROADCAST_EMAILS);
  if (!bcastAccess.allowed) return NextResponse.json({ error: { code: "feature_not_available", message: "Broadcasts not available." } }, { status: 403 });

  let body: z.infer<typeof createSchema>;
  try {
    const json = await req.json();
    const result = createSchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
      return NextResponse.json({ error: { code: "validation_failed", message: msg } }, { status: 400 });
    }
    body = result.data;
  } catch {
    return NextResponse.json({ error: { code: "validation_failed", message: "Invalid JSON body." } }, { status: 400 });
  }

  try {
    const broadcast = await createBroadcast({
      userId: user.id,
      name: body.name,
      subject: body.subject,
      htmlContent: body.htmlContent,
      textContent: body.textContent ?? null,
      audienceType: body.audienceType,
      targetGroupId: body.targetGroupId ?? null,
    });
    return NextResponse.json(broadcast, { status: 201 });
  } catch (err) {
    if (err instanceof BroadcastValidationError) {
      return NextResponse.json({ error: { code: "validation_failed", message: err.message } }, { status: 400 });
    }
    console.error("[dashboard/broadcasts] safe_error_code: internal_error");
    return NextResponse.json({ error: { code: "internal_error", message: "Failed to create broadcast." } }, { status: 500 });
  }
}
