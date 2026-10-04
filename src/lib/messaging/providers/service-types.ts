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
 * ─── Phase 2 contract ─────────────────────────────────────────────────────
 *
 *   Each service MAY have its own service-specific SMTP configuration block.
 *   If no service-specific block is present, the legacy shared SMTP_*
 *   configuration is used as a fully backward-compatible fallback.
 *
 *   OTP           → OTP_SMTP_* if present, else SMTP_*
 *   Transactional → TRANSACTIONAL_SMTP_* if present, else SMTP_*
 *   Broadcast     → BROADCAST_SMTP_* if present, else SMTP_*
 *
 *   Block-level precedence: if ANY service-specific variable is set, the
 *   entire service-specific block is required (all core fields). Partial
 *   blocks fail closed — they do NOT fall back field-by-field to legacy.
 *
 *   No provider pool, no multiple accounts per service, no failover, no SES.
 *
 * ─── MAIL_TRANSPORT vs EMAIL_PROVIDER ──────────────────────────────────────
 *
 *   EMAIL_PROVIDER decides provider technology (smtp, future ses, etc.).
 *   MAIL_TRANSPORT is the low-level SMTP transport implementation selector
 *   (smtp=real SMTP, gmail=historical alias for SMTP, console=dev-only).
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

/** The uppercase prefix for each service's env var block. */
const SERVICE_PREFIX: Record<EmailService, string> = {
  otp: "OTP",
  transactional: "TRANSACTIONAL",
  broadcast: "BROADCAST",
};

/**
 * Check whether ANY service-specific configuration variable is DEFINED for
 * the given service. Uses explicit existence semantics (`!== undefined`),
 * NOT truthiness — an empty string still activates the block.
 *
 * If at least one is present, the service-specific block is considered
 * "activated" and all core fields are required.
 */
function hasServiceSpecificConfig(service: EmailService): boolean {
  const p = SERVICE_PREFIX[service];
  const names = [
    `${p}_SMTP_HOST`,
    `${p}_SMTP_PORT`,
    `${p}_SMTP_USER`,
    `${p}_SMTP_PASS`,
    `${p}_SMTP_FROM`,
    `${p}_MAIL_REPLY_TO`,
    `${p}_DKIM_DOMAIN`,
    `${p}_DKIM_SELECTOR`,
    `${p}_DKIM_PRIVATE_KEY`,
  ];
  return names.some((name) => process.env[name] !== undefined);
}

/**
 * Load service-specific SMTP configuration. All core fields are required;
 * DKIM is an optional atomic group (all-or-nothing). Does NOT fall back
 * field-by-field to legacy env vars.
 */
function loadServiceSpecificConfig(service: EmailService): SmtpAccountConfig {
  const p = SERVICE_PREFIX[service];
  const host = required(`${p}_SMTP_HOST`);
  const portStr = required(`${p}_SMTP_PORT`);
  const port = validatePort(portStr, `${p}_SMTP_PORT`);
  const user = required(`${p}_SMTP_USER`);
  const pass = required(`${p}_SMTP_PASS`);
  const from = required(`${p}_SMTP_FROM`);
  // replyTo: service-specific only — do NOT inherit global MAIL_REPLY_TO.
  const replyTo = process.env[`${p}_MAIL_REPLY_TO`] || user;

  const dkimDomain = process.env[`${p}_DKIM_DOMAIN`];
  const dkimSelector = process.env[`${p}_DKIM_SELECTOR`];
  const dkimRawKey = process.env[`${p}_DKIM_PRIVATE_KEY`];
  const dkim = resolveServiceDkim(dkimDomain, dkimSelector, dkimRawKey);

  return { host, port, user, pass, from, replyTo, dkim };
}

/**
 * Load legacy shared SMTP configuration (the existing SMTP_* variables).
 * This is the backward-compatible fallback when no service-specific block
 * is present.
 *
 * Legacy DKIM behavior (preserved from Phase 1):
 *   - all three DKIM vars set → DKIM enabled;
 *   - otherwise → DKIM disabled (null), NO throw.
 * This is intentionally permissive for backward compatibility.
 */
function loadLegacyConfig(): SmtpAccountConfig {
  const host = required("SMTP_HOST");
  const portStr = required("SMTP_PORT");
  const port = validatePort(portStr, "SMTP_PORT");
  const user = required("SMTP_USER");
  const pass = required("SMTP_PASS");
  const from = required("SMTP_FROM");
  const replyTo = process.env.MAIL_REPLY_TO || user || from;

  // Legacy DKIM: permissive — partial config is silently ignored (null).
  const dkimDomain = process.env.DKIM_DOMAIN;
  const dkimSelector = process.env.DKIM_SELECTOR;
  const dkimRawKey = process.env.DKIM_PRIVATE_KEY;
  const dkim = resolveLegacyDkim(dkimDomain, dkimSelector, dkimRawKey);

  return { host, port, user, pass, from, replyTo, dkim };
}

/**
 * Resolve DKIM for the LEGACY shared configuration.
 * Permissive (backward-compatible):
 *   - all three set → DKIM enabled;
 *   - otherwise → null (DKIM disabled, no throw).
 */
function resolveLegacyDkim(
  domain: string | undefined,
  selector: string | undefined,
  rawKey: string | undefined,
): SmtpAccountConfig["dkim"] {
  if (!domain || !selector || !rawKey) return null;
  const privateKey = rawKey.includes("\\n")
    ? rawKey.replace(/\\n/g, "\n")
    : rawKey;
  return { domainName: domain, keySelector: selector, privateKey };
}

/**
 * Resolve DKIM for a SERVICE-SPECIFIC configuration block.
 * Strict (atomic):
 *   - none set → null (DKIM disabled);
 *   - all three set → DKIM enabled;
 *   - partially set → fail closed (throws).
 * Does NOT borrow missing fields from the shared DKIM configuration.
 */
function resolveServiceDkim(
  domain: string | undefined,
  selector: string | undefined,
  rawKey: string | undefined,
): SmtpAccountConfig["dkim"] {
  const hasDomain = domain !== undefined;
  const hasSelector = selector !== undefined;
  const hasKey = rawKey !== undefined;
  if (!hasDomain && !hasSelector && !hasKey) return null;
  if (!hasDomain || !hasSelector || !hasKey) {
    throw new Error(
      "Service-specific DKIM configuration is partial — all service-specific DKIM variables must be set together, or all must be absent.",
    );
  }
  const privateKey = rawKey!.includes("\\n")
    ? rawKey!.replace(/\\n/g, "\n")
    : rawKey!;
  return { domainName: domain!, keySelector: selector!, privateKey };
}

/**
 * Validate that a port string is a valid TCP port.
 * Rejects non-numeric, NaN, zero, negative, and >65535 values.
 * Error messages name the env var but NEVER its value.
 */
function validatePort(portStr: string, envVarName: string): number {
  const port = Number(portStr);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid SMTP port in ${envVarName}: must be an integer between 1 and 65535.`,
    );
  }
  return port;
}

/**
 * Load SMTP configuration for a specific email service.
 *
 * Resolution order (block-level precedence, NOT field-by-field mixing):
 *   1. If ANY service-specific env var exists for this service → load the
 *      complete service-specific block (all core fields required, fail
 *      closed if partial).
 *   2. Otherwise → load the legacy shared SMTP_* configuration.
 *
 * This is the SINGLE authoritative configuration resolver. Business code
 * must not read service-specific SMTP env vars directly.
 *
 * Throws if required env vars are missing or invalid (fail-closed).
 */
export function loadSmtpConfig(service: EmailService): SmtpAccountConfig {
  if (hasServiceSpecificConfig(service)) {
    return loadServiceSpecificConfig(service);
  }
  return loadLegacyConfig();
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
