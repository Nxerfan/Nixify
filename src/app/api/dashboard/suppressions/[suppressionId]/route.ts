import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  unsuppressByPublicId,
  getSuppressionByPublicId,
  newIdempotencyKey,
  CONSENT_SOURCES,
  IdempotencyConflictError,
} from "@/lib/consent/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const liftSchema = z.object({
  also_subscribe: z.boolean().default(false),
});

/**
 * GET /api/dashboard/suppressions/:suppressionId
 *
 * Returns a single suppression entry. Tenant-scoped — returns 404 if the
 * entry doesn't exist or belongs to a different user.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ suppressionId: string }> },
) {
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

  const { suppressionId } = await params;
  const entry = await getSuppressionByPublicId(user.id, suppressionId);
  if (!entry) {
    return NextResponse.json(
      { error: { code: "suppression_not_found", message: "Suppression entry not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: entry.id,
    suppression_id: entry.suppressionId,
    email: entry.email,
    reason: entry.reason,
    source: entry.source,
    active: entry.active,
    created_at: entry.createdAt.toISOString(),
    updated_at: entry.updatedAt.toISOString(),
    lifted_at: entry.liftedAt?.toISOString() ?? null,
  });
}

/**
 * POST /api/dashboard/suppressions/:suppressionId/lift
 *
 * Lift (deactivate) a suppression entry. Body:
 *   { also_subscribe?: boolean (default false) }
 *
 * By default this ONLY lifts — it does NOT resubscribe. Pass `also_subscribe: true`
 * to also perform an explicit subscribe action on the matching contact.
 *
 * Note: this route uses POST (not DELETE) because lifting is a state
 * transition that produces audit history, not a destructive delete.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ suppressionId: string }> },
) {
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

  const { suppressionId } = await params;

  let body: z.infer<typeof liftSchema>;
  try {
    const json = await req.json().catch(() => ({}));
    const result = liftSchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
      return NextResponse.json(
        { error: { code: "validation_failed", message: msg } },
        { status: 400 },
      );
    }
    body = result.data;
  } catch {
    body = { also_subscribe: false };
  }

  try {
    const result = await unsuppressByPublicId(user.id, suppressionId, CONSENT_SOURCES.DASHBOARD, {
      alsoSubscribe: body.also_subscribe,
      idempotencyKey: newIdempotencyKey(),
      requestPayload: { also_subscribe: body.also_subscribe },
    });

    if (result.status === "not_suppressed") {
      return NextResponse.json(
        { error: { code: "suppression_not_found", message: "Suppression entry not found or already lifted." } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      suppression_id: suppressionId,
      email: result.email,
      active: result.active,
      status: result.status,
      event_id: result.eventId,
    });
  } catch (err) {
    if (err instanceof IdempotencyConflictError) {
      return NextResponse.json(
        { error: { code: "idempotency_conflict", message: "Idempotency key reused with conflicting request payload." } },
        { status: 409 },
      );
    }
    console.error("[dashboard/suppressions/lift] safe_error_code: internal_error");
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to lift suppression." } },
      { status: 500 },
    );
  }
}
