/**
 * SMTP provider adapter (Phase 4, sections 10-11 — extended in Phase 11).
 *
 * Adapts the existing OTP `MailTransport` to the messaging `EmailProvider`
 * interface. The OTP mail path is untouched — this adapter simply calls the
 * same transport from the messaging side. When `createMailTransport()` returns
 * a `GmailSmtpTransport` (production) or `ConsoleMailTransport` (dev), this
 * adapter delegates to it.
 *
 * Classifies raw nodemailer errors into safe buckets:
 *   - connection/auth errors → configuration_error
 *   - everything else → provider_error
 *
 * Never exposes raw SMTP error text upward — the message is replaced with a
 * safe generic string and only the classification is persisted.
 *
 * ---- Phase 11 — Provider v2 implementation --------------------------------
 *
 * Declares capabilities:
 *   - providerMessageId: true   (nodemailer returns a messageId)
 *   - customHeaders: true        (per-recipient List-Unsubscribe, etc.)
 *   - deliveryWebhooks: false   (SMTP has no upstream feedback loop)
 *   - bounceEvents: false       (no bounce webhook path for SMTP)
 *   - complaintEvents: false     (no FBL webhook path for SMTP)
 *
 * Because `deliveryWebhooks` is false, EmailDelivery rows created via the SMTP
 * path stay in `provider_accepted` after a successful send — there is no
 * webhook to advance them to `delivered` / `bounced` / `complained`. This is
 * documented behavior, not a bug.
 */
import { createMailTransport, type MailTransport } from "@/lib/mail/transport";
import {
  type EmailProvider,
  type ProviderCapabilities,
  type ProviderSendInput,
  type ProviderSendResult,
  type ProviderResponseClassification,
  ProviderError,
} from "./provider";

const SMTP_CAPABILITIES: ProviderCapabilities = {
  providerMessageId: true,
  customHeaders: true,
  deliveryWebhooks: false,
  bounceEvents: false,
  complaintEvents: false,
};

export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  readonly capabilities = SMTP_CAPABILITIES;

  constructor(private readonly transport: MailTransport = createMailTransport()) {}

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    try {
      const result = await this.transport.send({
        to: input.to,
        subject: input.subject,
        // Phase 4 section 17: null text becomes "" — no HTML-to-text system.
        text: input.text ?? "",
        html: input.html,
        // Pass through custom headers (e.g. per-recipient List-Unsubscribe
        // for marketing broadcasts). Default transport headers are merged.
        headers: input.headers,
      });
      return {
        provider: "smtp",
        messageId: result.messageId ?? null,
        accepted: true,
        responseClassification: "accepted" as ProviderResponseClassification,
      };
    } catch (err) {
      // Classify the error WITHOUT leaking the raw message. Nodemailer error
      // codes starting with EAUTHE/EAUTH/ECONNTIMEOUT/ENOTFOUND indicate
      // configuration problems; everything else is a transient provider error.
      const raw = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string } | null)?.code ?? "";
      const isConfig =
        code.startsWith("EAUTH") ||
        code === "ECONNTIMEOUT" ||
        code === "ENOTFOUND" ||
        code === "ECONNREFUSED" ||
        /auth|credential|login/i.test(raw);
      const classification: "provider_error" | "configuration_error" =
        isConfig ? "configuration_error" : "provider_error";
      throw new ProviderError(
        classification,
        isConfig ? "SMTP configuration error" : "SMTP delivery failed",
      );
    }
  }
}
