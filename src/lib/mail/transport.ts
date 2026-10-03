import nodemailer from "nodemailer";
import type { SmtpAccountConfig } from "@/lib/messaging/providers/service-types";

/**
 * Mail transport abstraction.
 *
 * The application only ever talks to the `MailTransport` interface. The
 * concrete implementation is selected by `createMailTransport()` /
 * `createMailTransportForService()` based on the `MAIL_TRANSPORT` env var:
 *
 *   - "gmail" (default, production): `SmtpMailTransport` — real SMTP delivery.
 *     Reads SMTP_HOST/PORT/USER/PASS/FROM so the exact same code targets
 *     any SMTP relay by changing env vars only.
 *   - "console" (dev only): `ConsoleMailTransport` — prints to stdout.
 *     Never runs in production.
 *
 * Tests inject a fake transport via dependency injection.
 *
 * ─── Architecture ──────────────────────────────────────────────────────────
 *
 *   EmailProvider (provider technology selector: smtp, future ses)
 *     └── SmtpEmailProvider (adapter to MailTransport)
 *          └── MailTransport (low-level SMTP implementation)
 *               └── SmtpMailTransport (concrete SMTP via nodemailer)
 *
 * ─── Deliverability ────────────────────────────────────────────────────────
 *
 * Every outgoing message includes:
 *   - Reply-To (defaults to SMTP_USER)
 *   - List-Unsubscribe (mailto one-click)
 *   - Auto-Submitted: auto-generated (RFC 3834)
 *   - X-Auto-Response-Suppress: All
 *
 * When DKIM_DOMAIN / DKIM_SELECTOR / DKIM_PRIVATE_KEY are set, messages are
 * DKIM-signed.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
}

export interface MailTransport {
  send(message: MailMessage): Promise<{ messageId: string }>;
}

export interface MailSender {
  send(to: string, subject: string, text: string, html: string): Promise<{ messageId: string }>;
}

/**
 * Real SMTP transport. Constructible from an explicit `SmtpAccountConfig`
 * (required for future multi-account provider pools) or from env vars
 * (backward-compatible legacy path).
 *
 * Formerly named `GmailSmtpTransport` — renamed to `SmtpMailTransport`
 * because the implementation is ordinary SMTP, not Gmail-specific. A
 * compatibility alias is exported below.
 */
export class SmtpMailTransport implements MailTransport, MailSender {
  private transporter: nodemailer.Transporter;
  private readonly config: SmtpAccountConfig;

  constructor(config?: SmtpAccountConfig) {
    // If no explicit config is provided, read from env (legacy path).
    // This preserves backward compatibility with all existing call sites.
    this.config = config ?? loadLegacySmtpConfig();
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.port === 465,
      auth: { user: this.config.user, pass: this.config.pass },
      requireTLS: true,
    });
  }

  async send(arg: MailMessage | string, subject?: string, text?: string, html?: string) {
    const message: MailMessage =
      typeof arg === "string"
        ? { to: arg, subject: subject ?? "", text: text ?? "", html: html ?? "" }
        : arg;

    const defaultHeaders = {
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
      "List-Unsubscribe": `<mailto:${extractEmail(this.config.replyTo ?? this.config.from)}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
    const mailOptions: nodemailer.SendMailOptions = {
      from: this.config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: this.config.replyTo ?? this.config.user,
      headers: { ...defaultHeaders, ...(message.headers ?? {}) },
    };

    if (this.config.dkim) {
      mailOptions.dkim = {
        domainName: this.config.dkim.domainName,
        keySelector: this.config.dkim.keySelector,
        privateKey: this.config.dkim.privateKey,
      };
    }

    const info = await this.transporter.sendMail(mailOptions);
    return { messageId: info.messageId };
  }
}

/**
 * Development-only transport. Writes the full email to stdout.
 * NEVER selected in production.
 */
export class ConsoleMailTransport implements MailTransport, MailSender {
  async send(arg: MailMessage | string, subject?: string, text?: string, html?: string) {
    const message: MailMessage =
      typeof arg === "string"
        ? { to: arg, subject: subject ?? "", text: text ?? "", html: html ?? "" }
        : arg;
    console.log(
      [
        "--------------------  DEV MAIL (console transport)  --------------------",
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        "---- text/plain ----",
        message.text,
        "-----------------------------------------------------------------------",
      ].join("\n"),
    );
    return { messageId: `console-${Date.now()}` };
  }
}

/** Compatibility alias for the renamed class (was GmailSmtpTransport). */
export const GmailSmtpTransport = SmtpMailTransport;

// ---- Service-aware transport cache ----------------------------------------

const transportCache = new Map<string, MailTransport>();

/**
 * Returns the application mail transport for a specific email service.
 *
 * The cache is keyed by service so future service-specific configuration
 * (OTP provider pool, etc.) can coexist without one service's cache
 * leaking to another.
 *
 * Phase 1: all services resolve to the same SMTP config, but the cache
 * is still per-service to preserve the isolation boundary.
 */
export function createMailTransportForService(service: string): MailTransport {
  const cached = transportCache.get(service);
  if (cached) return cached;

  const choice = (process.env.MAIL_TRANSPORT ?? "gmail").toLowerCase();
  let transport: MailTransport;
  if (choice === "console") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "MAIL_TRANSPORT=console is not permitted in production. Set SMTP_* and use the gmail transport.",
      );
    }
    transport = new ConsoleMailTransport();
  } else {
    // Phase 1: all services use the same legacy SMTP config.
    transport = new SmtpMailTransport();
  }

  transportCache.set(service, transport);
  return transport;
}

/**
 * Legacy entry point — resolves to the default (non-service-aware) transport.
 * Preserved for backward compatibility with existing call sites that don't
 * yet pass a service. Internally delegates to `createMailTransportForService`
 * with a synthetic key so the cache behavior is consistent.
 */
export function createMailTransport(): MailTransport {
  return createMailTransportForService("default");
}

/**
 * Validate ALL required mail env vars without constructing the transport.
 * Called before any DB writes in issueOtp() so that missing env vars are
 * detected early — before orphaned OTP rows are created.
 */
export function assertMailConfig(): void {
  required("SMTP_HOST");
  required("SMTP_PORT");
  required("SMTP_USER");
  required("SMTP_PASS");
  required("SMTP_FROM");
}

/** Test/utility hook to reset the cached transport (used by tests). */
export function __resetMailTransportCacheForTests() {
  transportCache.clear();
}

// ---- Helpers ---------------------------------------------------------------

function loadLegacySmtpConfig(): SmtpAccountConfig {
  return {
    host: required("SMTP_HOST"),
    port: Number(required("SMTP_PORT")),
    user: required("SMTP_USER"),
    pass: required("SMTP_PASS"),
    from: required("SMTP_FROM"),
    replyTo: process.env.MAIL_REPLY_TO || required("SMTP_USER"),
    dkim: loadDkimConfig(),
  };
}

interface DkimConfig {
  domainName: string;
  keySelector: string;
  privateKey: string;
}

function loadDkimConfig(): DkimConfig | null {
  const domainName = process.env.DKIM_DOMAIN;
  const keySelector = process.env.DKIM_SELECTOR;
  const rawKey = process.env.DKIM_PRIVATE_KEY;
  if (!domainName || !keySelector || !rawKey) return null;
  const privateKey = rawKey.includes("\\n")
    ? rawKey.replace(/\\n/g, "\n")
    : rawKey;
  return { domainName, keySelector, privateKey };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function extractEmail(fromField: string): string {
  const m = fromField.match(/<([^>]+)>/);
  return m ? m[1] : fromField.trim();
}
