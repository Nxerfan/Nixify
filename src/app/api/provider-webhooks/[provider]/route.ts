import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Provider webhook receiver (Phase 11 — STUB).
 *
 * /api/provider-webhooks/:provider
 *
 * This route is a deliberately-permissive stub. It exists so a future
 * webhook-capable provider (Resend/SES/SendGrid) can be wired up by adding
 * a real signature verification + payload parsing + ingestProviderEvent call
 * WITHOUT changing the route shape. Until a provider with
 * `deliveryWebhooks=true` is configured, this route returns 404 for any
 * unknown provider name — there is nothing to ingest.
 *
 * The current SMTP provider declares `deliveryWebhooks=false` (see
 * SmtpEmailProvider.capabilities). No SMTP path will ever produce a webhook.
 *
 * SECURITY: when a real provider is added, this route MUST verify the
 * provider's webhook signature BEFORE calling ingestProviderEvent. Failing
 * closed on signature verification is non-negotiable — an unsigned or
 * mismatched-signature POST MUST be rejected with 401.
 *
 * Supported providers will be declared in the provider factory
 * (`src/lib/messaging/providers/factory.ts`). Currently the only configured
 * provider is "smtp" (deliveryWebhooks=false) — so every POST here 404s.
 */

const KNOWN_WEBHOOK_CAPABLE_PROVIDERS: ReadonlySet<string> = new Set<string>([
  // Future: "resend", "ses", "sendgrid" — when added, declare here AND
  // verify signatures in the handler. SMTP is intentionally NOT here.
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const normalized = (provider ?? "").toLowerCase();

  if (!KNOWN_WEBHOOK_CAPABLE_PROVIDERS.has(normalized)) {
    return NextResponse.json(
      {
        error: {
          code: "unknown_provider",
          message: `No webhook-capable provider '${normalized}' is configured.`,
        },
      },
      { status: 404 },
    );
  }

  // Future: verify signature + parse payload + call ingestProviderEvent.
  // For now, fall through to 404 — the set above is empty.
  return NextResponse.json(
    {
      error: {
        code: "webhook_not_implemented",
        message: `Provider '${normalized}' webhooks are not yet implemented.`,
      },
    },
    { status: 404 },
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  // HEAD/GET probe responses — return 404 so a misconfigured probe can be
  // detected without leaking the existence of webhook endpoints.
  return NextResponse.json(
    {
      error: {
        code: "unknown_provider",
        message: `No webhook endpoint for provider '${provider ?? ""}'.`,
      },
    },
    { status: 404 },
  );
}
