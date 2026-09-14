/**
 * Messaging provider abstraction (Phase 4, section 10).
 *
 * The messaging service talks ONLY to the `EmailProvider` interface. The SMTP
 * adapter wraps the existing OTP `MailTransport` — it does NOT replace it.
 * This boundary makes it possible for Phase 11 to add a real ESP (Resend/SES/
 * SendGrid) by adding one new file, without touching the messaging service.
 *
 * Tests inject a `FakeEmailProvider` — no real SMTP/network call ever happens
 * in automated tests.
 */

export interface ProviderSendInput {
  to: string;
  subject: string;
  html: string;
  text: string | null;
}

export interface ProviderSendResult {
  /** Provider name for audit, e.g. "smtp" or "resend". */
  provider: string;
  /** Provider-issued message id (for correlation). */
  messageId: string;
}

export interface EmailProvider {
  send(input: ProviderSendInput): Promise<ProviderSendResult>;
}

/**
 * Classified provider error. The messaging service maps raw provider errors
 * into these two safe buckets before persisting or returning to the client —
 * raw SMTP errors, stack traces, and credentials NEVER leak to the API
 * response, DB, RequestLog, ContactEvent, or production console output.
 */
export class ProviderError extends Error {
  constructor(
    public readonly classification: "provider_error" | "configuration_error",
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
