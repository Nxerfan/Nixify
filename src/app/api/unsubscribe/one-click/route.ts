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
 * Validation per RFC 8058:
 *   1. Content-Type MUST be application/x-www-form-urlencoded.
 *   2. The body MUST contain a `List-Unsubscribe=One-Click` field.
 *   3. Only then proceed with token verification + unsubscribe.
 *
 * Idempotent, non-enumerating, locale-unprefixed, token-safe.
 * Calls the same central Phase 9 unsubscribe service.
 *
 * All invalid form / invalid token / missing contact cases return the SAME
 * generic message — no enumeration of which contacts exist.
 */
export async function POST(req: NextRequest) {
  // 1. Verify Content-Type is form-encoded.
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/x-www-form-urlencoded")) {
    return new Response(UNSUBSCRIBE_INVALID_MESSAGE, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  // 2. Parse the form body and require `List-Unsubscribe=One-Click` field.
  let form: URLSearchParams;
  try {
    const body = await req.text();
    form = new URLSearchParams(body);
  } catch {
    return new Response(UNSUBSCRIBE_INVALID_MESSAGE, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  // RFC 8058 mandates the body contain `List-Unsubscribe=One-Click` (the field
  // name itself contains an `=` sign). Some mailers send it as a single key.
  // Accept the canonical field exactly.
  const oneClick = form.get("List-Unsubscribe");
  if (oneClick !== "One-Click") {
    return new Response(UNSUBSCRIBE_INVALID_MESSAGE, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  // 3. Token verification.
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

  // 4. Verify contact exists and matches the token claims.
  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: { email: true },
  });
  if (!contact || contact.email !== payload.email) {
    return new Response(UNSUBSCRIBE_INVALID_MESSAGE, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  // 5. Perform the unsubscribe. Idempotent via the JTI idempotency key.
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
