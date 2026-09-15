import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyUnsubscribeToken, UNSUBSCRIBE_INVALID_MESSAGE } from "@/lib/consent/token";
import { unsubscribeContact, CONSENT_SOURCES } from "@/lib/consent/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/unsubscribe/one-click?token=<opaque-jwe>
 *
 * RFC 8058 one-click unsubscribe. Accepts a form-encoded request (NOT JSON).
 * The mail client sends this when the user clicks the "Unsubscribe" button
 * in their email client.
 *
 * Idempotent, non-enumerating, locale-unprefixed, token-safe.
 * Calls the same central Phase 9 unsubscribe service.
 */
export async function POST(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return new Response(UNSUBSCRIBE_INVALID_MESSAGE, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  const verifyResult = await verifyUnsubscribeToken(token);
  if (!verifyResult.ok) {
    return new Response(UNSUBSCRIBE_INVALID_MESSAGE, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  const payload = verifyResult.payload;
  const userId = Number(payload.uid);
  const contactId = Number(payload.sub);

  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: { email: true },
  });
  if (!contact || contact.email !== payload.email) {
    return new Response(UNSUBSCRIBE_INVALID_MESSAGE, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  try {
    const result = await unsubscribeContact({
      userId,
      contactId,
      source: CONSENT_SOURCES.UNSUBSCRIBE,
      reason: "one_click_unsubscribe",
      idempotencyKey: payload.jti,
      requestId: `one-click:${payload.jti}`,
      requestPayload: { contactId, userId },
    });

    if (result.contactNotFound) {
      return new Response(UNSUBSCRIBE_INVALID_MESSAGE, { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    return new Response("You have been unsubscribed.", { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch {
    console.error("[api/unsubscribe/one-click] safe_error_code: internal_error");
    return new Response(UNSUBSCRIBE_INVALID_MESSAGE, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
}
