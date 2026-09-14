/**
 * SMTP provider adapter (Phase 4, sections 10-11).
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
 */
import { createMailTransport, type MailTransport } from "@/lib/mail/transport";
import {
  type EmailProvider,
  type ProviderSendInput,
  type ProviderSendResult,
  ProviderError,
} from "./provider";

export class SmtpEmailProvider implements EmailProvider {
  constructor(private readonly transport: MailTransport = createMailTransport()) {}

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    try {
      const result = await this.transport.send({
        to: input.to,
        subject: input.subject,
        // Phase 4 section 17: null text becomes "" — no HTML-to-text system.
        text: input.text ?? "",
        html: input.html,
      });
      return {
        provider: "smtp",
        messageId: result.messageId,
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
      throw new ProviderError(
        isConfig ? "configuration_error" : "provider_error",
        isConfig ? "SMTP configuration error" : "SMTP delivery failed",
      );
    }
  }
}
