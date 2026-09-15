import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  verifyUnsubscribeToken,
  UNSUBSCRIBE_INVALID_MESSAGE,
} from "@/lib/consent/token";
import {
  unsubscribeContact,
  CONSENT_SOURCES,
} from "@/lib/consent/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postSchema = z.object({
  token: z.string().min(10).max(4096),
});

/**
 * GET /api/unsubscribe?token=<jwt>
 *
 * Public, stateless, idempotent. Validates the token WITHOUT mutating state.
 *
 * Returns 200 with a masked-email confirmation if the token is valid, OR
 * 200 with the same generic invalid message if the token is invalid/expired.
 * The status code is ALWAYS 200 to avoid leaking whether the contact exists
 * (a 4xx would distinguish "invalid token" from "valid token for missing
 * contact" — both return the same generic message).
 *
 * The endpoint is also locale-unprefixed per Phase 9 spec — no /en/api/...
 * path. It lives at the bare /api/unsubscribe path.
 */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ ok: false, message: UNSUBSCRIBE_INVALID_MESSAGE });
  }
  const result = await verifyUnsubscribeToken(token);
  if (!result.ok) {
    // Always return 200 with the SAME generic message — no enumeration.
    return NextResponse.json({ ok: false, message: UNSUBSCRIBE_INVALID_MESSAGE });
  }
  // Verify the contact still exists + belongs to the token's tenant.
  const userId = Number(result.payload.uid);
  const contactId = Number(result.payload.sub);
  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: { email: true, marketingStatus: true },
  });
  if (!contact || contact.email !== result.payload.email) {
    return NextResponse.json({ ok: false, message: UNSUBSCRIBE_INVALID_MESSAGE });
  }
  // Mask email for display (j**@example.com)
  const [local, domain] = contact.email.split("@");
  const masked = local.length > 1
    ? `${local[0]}${"*".repeat(Math.max(2, local.length - 1))}@${domain}`
    : `*@${domain}`;
  return NextResponse.json({
    ok: true,
    message: "Confirm unsubscribe by sending a POST request with the same token.",
    email_masked: masked,
    currently_marketing_status: contact.marketingStatus,
  });
}

/**
 * POST /api/unsubscribe
 * Body: { "token": "<jwt>" }
 *
 * Public, idempotent, atomic. Performs the unsubscribe:
 *   - Contact.marketingStatus → "unsubscribed"
 *   - SuppressionEntry active=true (reason="unsubscribe")
 *   - ContactConsentEvent appended
 *   - SuppressionEvent appended
 *   - ContactEvent timeline
 *
 * The token's `jti` claim is used as the idempotency key — repeated POSTs
 * with the same token are deduped.
 *
 * Returns 200 on success (including idempotent replays). Returns 200 with
 * the generic invalid message on any failure (token invalid, contact gone,
 * tenant mismatch) — never reveals whether the contact exists.
 */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof postSchema>;
  try {
    const json = await req.json();
    const result = postSchema.safeParse(json);
    if (!result.success) {
      return NextResponse.json({ ok: false, message: UNSUBSCRIBE_INVALID_MESSAGE });
    }
    body = result.data;
  } catch {
    return NextResponse.json({ ok: false, message: UNSUBSCRIBE_INVALID_MESSAGE });
  }

  const verifyResult = await verifyUnsubscribeToken(body.token);
  if (!verifyResult.ok) {
    return NextResponse.json({ ok: false, message: UNSUBSCRIBE_INVALID_MESSAGE });
  }
  const payload = verifyResult.payload;
  const userId = Number(payload.uid);
  const contactId = Number(payload.sub);

  // Verify contact exists + tenant match + email match BEFORE mutating.
  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: { email: true },
  });
  if (!contact || contact.email !== payload.email) {
    return NextResponse.json({ ok: false, message: UNSUBSCRIBE_INVALID_MESSAGE });
  }

  try {
    const result = await unsubscribeContact({
      userId,
      contactId,
      source: CONSENT_SOURCES.UNSUBSCRIBE,
      reason: "user_request",
      // The JWT jti is the idempotency key — repeated clicks on the same
      // email link produce the same hashed key and are deduped.
      idempotencyKey: payload.jti,
      requestId: `unsubscribe:${payload.jti}`,
      requestPayload: { contactId, userId }, // mutable target identity — fingerprint detects key reuse across targets
    });

    if (result.contactNotFound) {
      return NextResponse.json({ ok: false, message: UNSUBSCRIBE_INVALID_MESSAGE });
    }

    return NextResponse.json({
      ok: true,
      status: result.status, // "applied" | "no_op" | "idempotent_replay"
      marketing_status: result.newStatus,
    });
  } catch (err) {
    // Safe error code only — never log raw exception messages, token claims,
    // email, or request body. Per Phase 9 privacy rules.
    console.error("[api/unsubscribe] safe_error_code: internal_error");
    return NextResponse.json({ ok: false, message: UNSUBSCRIBE_INVALID_MESSAGE });
  }
}
