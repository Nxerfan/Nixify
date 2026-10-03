/**
 * Service-aware provider factory.
 *
 * Single source of truth for "which provider is active for this service?".
 * Routes and services MUST call `getEmailProviderForService(service)` —
 * they MUST NOT instantiate a concrete provider class directly.
 *
 * ─── Service-aware resolution ──────────────────────────────────────────────
 *
 *   getEmailProviderForService("transactional") → SmtpEmailProvider
 *   getEmailProviderForService("broadcast")     → SmtpEmailProvider
 *
 * OTP uses the MailTransport layer (createMailTransportForService("otp"))
 * during this phase — that's its mature path. Both layers resolve through
 * the same canonical service/config model.
 *
 * ─── MAIL_TRANSPORT vs EMAIL_PROVIDER ──────────────────────────────────────
 *
 *   EMAIL_PROVIDER decides provider technology (smtp, future ses, etc.).
 *   MAIL_TRANSPORT is the low-level SMTP transport implementation selector.
 *   Business services never select either directly.
 *
 * ─── Phase 1 behavior ─────────────────────────────────────────────────────
 *
 *   transactional → smtp (current SMTP credentials)
 *   broadcast     → smtp (current SMTP credentials)
 *   otp           → smtp transport (current SMTP credentials, via MailTransport)
 *
 * Unknown configured provider values fail closed. No silent fallback.
 *
 * ─── No module-load env freezing ──────────────────────────────────────────
 *
 * Configuration is read at call time (not module load time) so tests can
 * set env vars after import without hitting stale cached values. Cached
 * provider INSTANCES are fine (SMTP pool reuse), but the provider NAME and
 * config are resolved per-call.
 */

import { SmtpEmailProvider } from "./smtp";
import type { EmailProvider } from "./provider";
import type { EmailService } from "./service-types";

const ALLOWED_PROVIDERS = new Set(["smtp"]);

// Per-service cache: Map<service, EmailProvider>. Allows future
// service-specific provider configuration without one service's cache
// leaking to another.
const providerCache = new Map<EmailService, EmailProvider>();

/**
 * Returns the configured EmailProvider for the given service.
 * The same instance is reused per-service within a single process.
 *
 * Throws if `EMAIL_PROVIDER` is set to an unknown value — fail-closed.
 */
export function getEmailProviderForService(service: EmailService): EmailProvider {
  const cached = providerCache.get(service);
  if (cached) return cached;

  // Read at call time — do NOT freeze at module load.
  const providerName = (process.env.EMAIL_PROVIDER ?? "smtp").toLowerCase();

  if (!ALLOWED_PROVIDERS.has(providerName)) {
    throw new Error(
      `Unknown EMAIL_PROVIDER='${providerName}'. Supported: smtp.`,
    );
  }

  let provider: EmailProvider;
  if (providerName === "smtp") {
    // Pass the service so SmtpEmailProvider resolves the correct
    // service-aware transport (not a hardcoded "transactional" default).
    provider = new SmtpEmailProvider(service);
  } else {
    // Unreachable — ALLOWED_PROVIDERS check rejects unknown values.
    throw new Error(`Provider '${providerName}' is not implemented.`);
  }

  providerCache.set(service, provider);
  return provider;
}

/**
 * Returns the configured provider NAME without instantiating.
 * Used by code paths that need the provider name for audit logging.
 */
export function getActiveProviderName(): string {
  const providerName = (process.env.EMAIL_PROVIDER ?? "smtp").toLowerCase();
  if (!ALLOWED_PROVIDERS.has(providerName)) {
    throw new Error(
      `Unknown EMAIL_PROVIDER='${providerName}'. Supported: smtp.`,
    );
  }
  return providerName;
}

/**
 * Legacy backward-compatible entry point. Delegates to
 * `getEmailProviderForService("transactional")` since the legacy callers
 * were all transactional/messaging paths.
 */
export function getEmailProvider(): EmailProvider {
  return getEmailProviderForService("transactional");
}

/** Test hook: reset the per-service provider cache. */
export function __resetProviderCacheForTests(): void {
  providerCache.clear();
}
