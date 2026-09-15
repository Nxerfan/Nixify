/**
 * Centralized provider factory (Phase 11).
 *
 * Single source of truth for "which provider is active right now?". Routes
 * and services MUST call `getEmailProvider()` — they MUST NOT instantiate a
 * concrete provider class directly from request data. This prevents:
 *
 *   - Arbitrary provider selection from request body / query params
 *     (a request must NOT be able to pick "resend" vs "smtp" — that's a
 *      deployment-level config decision, not a per-request decision).
 *   - Drift between the provider used for sending and the provider name
 *      persisted on EmailDelivery rows.
 *
 * Configuration: read from environment variables. Currently only SMTP is
 * supported. When a real ESP (Resend/SES/SendGrid) is added, this factory
 * will select it based on `EMAIL_PROVIDER` and return the configured
 * instance. Until then, any other value throws — fail-closed.
 *
 * Tests do NOT use this factory — they inject a `FakeEmailProvider` directly
 * into `sendTransactionalEmail()` / `processBroadcast()` for determinism.
 */

import { SmtpEmailProvider } from "./smtp";
import type { EmailProvider } from "./provider";

/**
 * Active provider name. Read once at module load. Changing the env var
 * requires a process restart (no hot-reload of provider config) — this is
 * intentional: a partially-reloaded provider config would mix providers in
 * the same worker pool, which is unsafe.
 *
 * Values:
 *   - "smtp" (default) — local/dev, Gmail SMTP, any SMTP relay.
 *   - (future) "resend" | "ses" | "sendgrid"
 */
const ACTIVE_PROVIDER = (process.env.EMAIL_PROVIDER ?? "smtp").toLowerCase();

const ALLOWED_PROVIDERS = new Set(["smtp"]);

let cachedProvider: EmailProvider | null = null;

/**
 * Returns the configured EmailProvider singleton. The same instance is reused
 * across requests within a single Node process — provider clients (SMTP pool,
 * HTTP clients) are expensive to construct and SHOULD be reused.
 *
 * Throws if `EMAIL_PROVIDER` is set to an unknown value — fail-closed.
 */
export function getEmailProvider(): EmailProvider {
  if (cachedProvider) return cachedProvider;

  if (!ALLOWED_PROVIDERS.has(ACTIVE_PROVIDER)) {
    throw new Error(
      `Unknown EMAIL_PROVIDER='${ACTIVE_PROVIDER}'. Supported: smtp.`,
    );
  }

  if (ACTIVE_PROVIDER === "smtp") {
    cachedProvider = new SmtpEmailProvider();
    return cachedProvider;
  }

  // Unreachable — the ALLOWED_PROVIDERS check above rejects unknown values.
  throw new Error(`Provider '${ACTIVE_PROVIDER}' is not implemented.`);
}

/**
 * Returns the configured provider NAME without instantiating the provider.
 * Used by code paths that need the provider name for audit logging but do
 * NOT need to send (e.g. creating an EmailDelivery row before dispatch).
 */
export function getActiveProviderName(): string {
  if (!ALLOWED_PROVIDERS.has(ACTIVE_PROVIDER)) {
    throw new Error(
      `Unknown EMAIL_PROVIDER='${ACTIVE_PROVIDER}'. Supported: smtp.`,
    );
  }
  return ACTIVE_PROVIDER;
}
