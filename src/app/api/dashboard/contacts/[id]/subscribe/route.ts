import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { subscribeContact, newIdempotencyKey, CONSENT_SOURCES } from "@/lib/consent/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  reason: z.string().trim().max(200).optional(),
  idempotency_key: z.string().trim().min(8).max(128).optional(),
});

/**
 * POST /api/dashboard/contacts/:id/subscribe
 *
 * Explicitly subscribe a contact to marketing. This is the ONLY way a
 * Contact transitions to marketingStatus="subscribed" via the dashboard.
 *
 * Atomic side effects (per central consent service):
 *   - Contact.marketingStatus → "subscribed"
 *   - Contact.marketingConsentSource → "dashboard"
 *   - Contact.marketingConsentAt → now
 *   - If active suppression exists, it is lifted (active=false, liftedAt=now)
 *   - ContactConsentEvent(subscribed) appended
 *   - SuppressionEvent(lifted) appended (if suppression was lifted)
 *   - ContactEvent timeline "contact.subscribed"
 *
 * Idempotency: pass `idempotency_key` to dedupe retries. Without it, each
 * call creates a fresh audit row (intentional — every admin action is auditable).
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

  try {
    const result = await subscribeContact({
      userId: user.id,
      contactId,
      source: CONSENT_SOURCES.DASHBOARD,
      reason: body.reason,
      idempotencyKey: body.idempotency_key ?? newIdempotencyKey(),
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
    console.error("[dashboard/subscribe] error", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to subscribe contact." } },
      { status: 500 },
    );
  }
}
