import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { db } from "@/lib/db";
import { getConsentSummary, getConsentHistory } from "@/lib/consent/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/contacts/:id/consent
 *
 * Returns the current marketing consent state + suppression state + eligibility
 * for a contact. Tenant-scoped — returns 404 if the contact doesn't belong to
 * the session user.
 *
 * Dashboard routes do NOT consume API_MESSAGES. Consent/suppression state is
 * part of the Contacts capability and uses existing CONTACTS entitlement.
 */
export async function GET(
  _req: NextRequest,
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

  const summary = await getConsentSummary(user.id, contactId);
  if (!summary) {
    return NextResponse.json(
      { error: { code: "contact_not_found", message: "Contact not found." } },
      { status: 404 },
    );
  }

  // Look up the suppression entry's public ID (so the dashboard UI can call
  // the suppression lift endpoint by suppressionId).
  const contact = await db.contact.findFirst({
    where: { id: contactId, userId: user.id },
    select: { email: true },
  });
  const suppressionEntry = contact
    ? await db.suppressionEntry.findUnique({
        where: { userId_email: { userId: user.id, email: contact.email } },
        select: { suppressionId: true },
      })
    : null;

  const { events } = await getConsentHistory(user.id, contactId, { limit: 20 });

  return NextResponse.json({
    contact_id: summary.contactId,
    marketing_status: summary.marketingStatus,
    marketing_consent_source: summary.marketingConsentSource,
    marketing_consent_at: summary.marketingConsentAt?.toISOString() ?? null,
    suppressed: summary.suppressed,
    suppression_id: suppressionEntry?.suppressionId ?? null,
    suppression_reason: summary.suppressionReason,
    suppression_source: summary.suppressionSource,
    suppression_lifted_at: summary.suppressionLiftedAt?.toISOString() ?? null,
    eligible: summary.eligible,
    history: events.map((e) => ({
      event_id: e.eventId,
      previous_status: e.previousStatus,
      new_status: e.newStatus,
      source: e.source,
      reason: e.reason,
      created_at: e.createdAt.toISOString(),
    })),
  });
}
