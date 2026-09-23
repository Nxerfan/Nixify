/**
 * Messaging provider abstraction (Phase 4, section 10 — extended in Phase 11).
 *
 * The messaging service talks ONLY to the `EmailProvider` interface. The SMTP
 * adapter wraps the existing OTP `MailTransport` — it does NOT replace it.
 * This boundary makes it possible for Phase 11 to add a real ESP (Resend/SES/
 * SendGrid) by adding one new file + one entry in `factory.ts`, without
 * touching the messaging service.
 *
 * Tests inject a `FakeEmailProvider` — no real SMTP/network call ever happens
 * in automated tests.
 *
 * ---- Phase 11 — Provider v2 interface -------------------------------------
 *
 * The v2 interface adds two capabilities:
 *
 * 1. `name` and `capabilities` — a static declaration of what the provider
 *    supports. Callers (delivery service, dashboard, suppression automation)
 *    branch on capabilities WITHOUT inspecting the provider class. For
 *    example, the suppression automation only fires for `bounceEvents` /
 *    `complaintEvents` providers. The SMTP provider declares both as `false`
 *    — there are no SMTP delivery webhooks, so suppression via bounce is
 *    not applicable on that path.
 *
 * 2. `accepted` + `responseClassification` on every send result. The SMTP
 *    provider returns `accepted: true` whenever nodemailer resolved the
 *    envelope (the message was queued for delivery to the upstream MTA).
 *    This is distinct from "delivered to inbox" — `provider_accepted`
 *    is the state the EmailDelivery row transitions to, and only a future
 *    webhook (delivery/bounce/complaint) can advance or regress it.
 *
 *    `responseClassification` is a coarse-grained, SAFE bucket string
 *    persisted on the EmailDelivery row (e.g. "accepted", "rejected_policy",
 *    "rejected_invalid_recipient", "provider_error"). Raw SMTP error text
 *    NEVER leaks into this field — see `SmtpEmailProvider.classifyResult`.
 */

export interface ProviderSendInput {
  to: string;
  subject: string;
  html: string;
  text: string | null;
  /** Optional custom headers (e.g. List-Unsubscribe for marketing broadcasts). */
  headers?: Record<string, string>;
}

/**
 * Coarse-grained classification of the provider's send response. Persisted
 * on the EmailDelivery row to power dashboards and operational alerts.
 *
 *   - "accepted"                — provider queued the message (200/250-class).
 *   - "rejected_policy"          — provider refused for a policy reason
 *                                  (suppressed destination, content block).
 *   - "rejected_invalid_recipient"— provider refused for a malformed/unknown
 *                                  recipient (e.g. SMTP 5.1.1 no such user).
 *   - "provider_error"           — transient provider failure (4xx SMTP,
 *                                  connection timeout).
 *   - "configuration_error"      — auth/host config wrong (mapped from EAUTHE/
 *                                  ECONNTIMEOUT/ENOTFOUND/ECONNREFUSED).
 *
 * Only safe, coarse-grained values are persisted. Raw provider error text is
 * NEVER persisted on EmailDelivery.lastErrorCode — only the classification
 * (or a fine-grained but safe SMTP enhanced status code, when available).
 */
export type ProviderResponseClassification =
  | "accepted"
  | "rejected_policy"
  | "rejected_invalid_recipient"
  | "provider_error"
  | "configuration_error";

export interface ProviderSendResult {
  /** Provider name for audit, e.g. "smtp" or "resend". */
  provider: string;
  /** Provider-issued message id (for correlation). Null when not available. */
  messageId: string | null;
  /** True iff the provider accepted the message (queued for delivery). */
  accepted: boolean;
  /** Safe coarse-grained classification — persisted on EmailDelivery. */
  responseClassification: ProviderResponseClassification;
}

/**
 * Static capability declaration. The delivery service and suppression
 * automation branch on these flags WITHOUT inspecting the provider class.
 *
 *   - `providerMessageId` — does the provider return a correlation ID we can
 *     store and match against inbound webhooks? SMTP returns a messageId from
 *     nodemailer, so this is `true`.
 *   - `customHeaders` — does the provider accept arbitrary headers (e.g.
 *     List-Unsubscribe)? SMTP/Nodemailer: yes.
 *   - `deliveryWebhooks` — does the provider post delivery/bounce/complaint
 *     events to our webhook endpoint? SMTP: NO — there is no upstream
 *     feedback loop. Real ESPs (Resend/SES/SendGrid) would set this `true`.
 *   - `bounceEvents` — does the provider emit hard/soft bounce events?
 *     SMTP: false (no webhook path).
 *   - `complaintEvents` — does the provider emit complaint/FBL events?
 *     SMTP: false.
 *
 * When `deliveryWebhooks` is false, the EmailDelivery row stays in
 * `provider_accepted` forever (no webhook will ever advance it). That's
 * correct — SMTP acceptance is the last signal we get for that path.
 */
export interface ProviderCapabilities {
  providerMessageId: boolean;
  customHeaders: boolean;
  deliveryWebhooks: boolean;
  bounceEvents: boolean;
  complaintEvents: boolean;
}

export interface EmailProvider {
  name: string;
  capabilities: ProviderCapabilities;
  send(input: ProviderSendInput): Promise<ProviderSendResult>;
}

/**
 * Classified provider error. The messaging service maps raw provider errors
 * into these two safe buckets before persisting or returning to the client —
 * raw SMTP errors, stack traces, and credentials NEVER leak to the API
 * response, DB, RequestLog, ContactEvent, or production console output.
 */
export class ProviderError extends Error {
  classification: "provider_error" | "configuration_error";
  constructor(
    classification: "provider_error" | "configuration_error",
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
    this.classification = classification;
  }
}
