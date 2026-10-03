/**
 * Service-aware email provider architecture — canonical types + configuration.
 *
 * ─── Architecture overview ──────────────────────────────────────────────────
 *
 *   Service != Provider != SMTP Account
 *
 *   Service:
 *     otp | transactional | broadcast
 *     (the business workload)
 *
 *   Provider technology:
 *     smtp | (future: ses, resend, etc.)
 *     (how email is sent)
 *
 *   Provider account / credential:
 *     one concrete SMTP account/configuration
 *     (the actual host/port/user/pass/from)
 *
 *   Future OTP pools will contain multiple provider accounts under the OTP
 *   service policy. Business logic never selects credentials directly.
 *
 * ─── Phase 1 contract ─────────────────────────────────────────────────────
 *
 *   OTP           → service-aware SMTP config → current SMTP_* credentials
 *   Transactional → service-aware EmailProvider → current SMTP_* credentials
 *   Broadcast     → service-aware EmailProvider → current SMTP_* credentials
 *
 * All three services resolve to the SAME existing SMTP account. No provider
 * pool, no multiple SMTP accounts, no failover, no SES. The service parameter
 * is the extension point for later phases.
 *
 * ─── MAIL_TRANSPORT vs EMAIL_PROVIDER ──────────────────────────────────────
 *
 *   EMAIL_PROVIDER decides provider technology (smtp, future ses, etc.).
 *   MAIL_TRANSPORT is the low-level SMTP transport implementation selector
 *   (gmail=real SMTP, console=dev-only).
 *   Business services never select either directly — they resolve through
 *   the service-aware factory.
 */

/**
 * Canonical email service identifier. Represents the business workload, NOT
 * the concrete provider. Business logic uses this to resolve the correct
 * provider/configuration boundary.
 */
export type EmailService = "otp" | "transactional" | "broadcast";

/**
 * Explicit, validated SMTP account configuration. A concrete SMTP transport
 * is constructible from this object without reading global env vars — this is
 * required for the future OTP provider pool where multiple SMTP accounts
 * coexist in the same process.
 */
export interface SmtpAccountConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
  dkim?: {
    domainName: string;
    keySelector: string;
    privateKey: string;
  } | null;
}

/**
 * Load SMTP configuration for a specific email service.
 *
 * Phase 1: ALL three services resolve to the existing legacy env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, MAIL_REPLY_TO,
 *   DKIM_DOMAIN, DKIM_SELECTOR, DKIM_PRIVATE_KEY
 *
 * The service parameter is deliberately present even though all services
 * currently resolve to the same credentials — it is the extension point for
 * future phases (service-specific provider pools, multiple SMTP accounts, etc.).
 *
 * Throws if required env vars are missing (fail-closed).
 */
export function loadSmtpConfig(_service: EmailService): SmtpAccountConfig {
  // Phase 1: all services use the same legacy SMTP_* configuration.
  // The _service parameter is intentionally unused — it exists so the
  // function signature is ready for Phase 2+ without changing call sites.
  const host = required("SMTP_HOST");
  const port = Number(required("SMTP_PORT"));
  const user = required("SMTP_USER");
  const pass = required("SMTP_PASS");
  const from = required("SMTP_FROM");
  const replyTo = process.env.MAIL_REPLY_TO || user || from;

  // DKIM — optional. Loaded from env.
  const dkimDomain = process.env.DKIM_DOMAIN;
  const dkimSelector = process.env.DKIM_SELECTOR;
  const dkimRawKey = process.env.DKIM_PRIVATE_KEY;
  let dkim: SmtpAccountConfig["dkim"] = null;
  if (dkimDomain && dkimSelector && dkimRawKey) {
    const privateKey = dkimRawKey.includes("\\n")
      ? dkimRawKey.replace(/\\n/g, "\n")
      : dkimRawKey;
    dkim = { domainName: dkimDomain, keySelector: dkimSelector, privateKey };
  }

  return { host, port, user, pass, from, replyTo, dkim };
}

/**
 * Validate that the SMTP configuration for the given service is usable.
 * Delegates to the SAME canonical `loadSmtpConfig(service)` used by real
 * transport construction — so validation and sending can NEVER diverge.
 *
 * Called before OTP DB mutations to prevent orphan rows. Does not construct
 * a transport; only resolves + discards the config (which throws on missing
 * required env vars).
 */
export function assertSmtpConfig(service: EmailService): void {
  loadSmtpConfig(service);
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
