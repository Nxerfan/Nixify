import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  unsubscribeContact,
  newIdempotencyKey,
  CONSENT_SOURCES,
  IdempotencyConflictError,
} from "@/lib/consent/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

/**
 * POST /api/dashboard/contacts/:id/unsubscribe
 *
 * Explicitly unsubscribe a contact from marketing. Atomic side effects:
 *   - Contact.marketingStatus → "unsubscribed"
 *   - Contact.marketingConsentSource → "dashboard"
 *   - SuppressionEntry active=true (upsert, idempotent per tenant+email)
 *   - ContactConsentEvent(unsubscribed) appended
 *   - SuppressionEvent(suppressed) appended
 *   - ContactEvent timeline "contact.unsubscribed"
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

  const { id: idStr } = await params;
  const contactId = Number(idStr);
  if (!Number.isInteger(contactId) || contactId <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid contact ID." } },
      { status: 400 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const json = await req.json().catch(() => ({}));
    const result = bodySchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
      return NextResponse.json(
        { error: { code: "validation_failed", message: msg } },
        { status: 400 },
      );
    }
    body = result.data;
  } catch {
    body = {};
  }

  const idempotencyKey = newIdempotencyKey();

  try {
    const result = await unsubscribeContact({
      userId: user.id,
      contactId,
      source: CONSENT_SOURCES.DASHBOARD,
      reason: body.reason,
      idempotencyKey,
      requestPayload: { reason: body.reason ?? null },
    });

    if (result.contactNotFound) {
      return NextResponse.json(
        { error: { code: "contact_not_found", message: "Contact not found." } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      contact_id: contactId,
      marketing_status: result.newStatus,
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
    console.error("[dashboard/unsubscribe] safe_error_code: internal_error");
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to unsubscribe contact." } },
      { status: 500 },
    );
  }
}
