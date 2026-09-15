import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  listSuppressions,
  suppressEmail,
  newIdempotencyKey,
  CONSENT_SOURCES,
  SUPPRESSION_REASONS,
  IdempotencyConflictError,
} from "@/lib/consent/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  email: z.string().trim().max(254).min(3),
  reason: z.enum(["unsubscribe", "manual"]).default("manual"),
});

/**
 * GET /api/dashboard/suppressions?page=1&pageSize=20&activeOnly=true&search=foo
 *
 * Returns the current-state suppression list for the session user.
 * Tenant-scoped — only the user's own suppressions are returned.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }
  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Contacts is not available on your current account." } },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  const activeOnly = url.searchParams.get("activeOnly") === "true";
  const search = url.searchParams.get("search") ?? undefined;

  const result = await listSuppressions(user.id, {
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    activeOnly,
    search: search || undefined,
  });

  return NextResponse.json({
    suppressions: result.suppressions.map((s) => ({
      id: s.id,
      suppression_id: s.suppressionId,
      email: s.email,
      reason: s.reason,
      source: s.source,
      active: s.active,
      created_at: s.createdAt.toISOString(),
      updated_at: s.updatedAt.toISOString(),
      lifted_at: s.liftedAt?.toISOString() ?? null,
    })),
    total: result.total,
    page: result.page,
    page_size: result.pageSize,
  });
}

/**
 * POST /api/dashboard/suppressions
 *
 * Suppress an email at the tenant level. Body:
 *   { email, reason?: "manual"|"unsubscribe" (default "manual") }
 *
 * Does NOT unsubscribe a contact — pass the contactId to the contact unsubscribe
 * endpoint for that. This route only writes a SuppressionEntry.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }
  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Contacts is not available on your current account." } },
      { status: 403 },
    );
  }

  let body: z.infer<typeof createSchema>;
  try {
    const json = await req.json();
    const result = createSchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
      return NextResponse.json(
        { error: { code: "validation_failed", message: msg } },
        { status: 400 },
      );
    }
    body = result.data;
  } catch {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  try {
    const result = await suppressEmail({
      userId: user.id,
      email: body.email,
      reason: body.reason === "unsubscribe" ? SUPPRESSION_REASONS.UNSUBSCRIBE : SUPPRESSION_REASONS.MANUAL,
      source: CONSENT_SOURCES.DASHBOARD,
      idempotencyKey: newIdempotencyKey(),
      requestPayload: { email: body.email, reason: body.reason },
    });

    return NextResponse.json({
      suppression_id: result.suppressionId,
      email: result.email,
      active: result.active,
      status: result.status,
      event_id: result.eventId,
    }, { status: 201 });
  } catch (err) {
    if (err instanceof IdempotencyConflictError) {
      return NextResponse.json(
        { error: { code: "idempotency_conflict", message: "Idempotency key reused with conflicting request payload." } },
        { status: 409 },
      );
    }
    const msg = err instanceof Error ? err.message : "Failed to suppress email.";
    const code = msg.includes("Invalid email") ? "validation_failed" : "internal_error";
    if (code === "internal_error") {
      console.error("[dashboard/suppressions] safe_error_code: internal_error");
    }
    return NextResponse.json(
      { error: { code, message: code === "validation_failed" ? msg : "Failed to suppress email." } },
      { status: code === "validation_failed" ? 400 : 500 },
    );
  }
}
