import nodemailer from "nodemailer";

/**
 * Mail transport abstraction (§4 of the spec).
 *
 * The application only ever talks to the `MailTransport` interface. The concrete
 * implementation is selected by `createMailTransport()` below based on the
 * `MAIL_TRANSPORT` env var:
 *
 *   - "gmail"  (default, production): `GmailSmtpTransport` — real SMTP delivery
 *      over Gmail (Architecture A). Reads SMTP_HOST/PORT/USER/PASS/FROM so the
 *      exact same code later targets a self-hosted Postfix relay (Architecture C)
 *      by changing env vars only.
 *   - "console" (dev only): `ConsoleMailTransport` — prints the email to stdout
 *      so a developer without SMTP credentials can still exercise the full flow.
 *      This is a *development* transport; it never runs in production because
 *      `createMailTransport` refuses to select it when NODE_ENV === "production".
 *
 * Tests inject a fake transport via dependency injection (§13.5) — they do not
 * flip an env var inside the transport.
 *
 * ## Deliverability (see docs/EMAIL-DELIVERABILITY.md)
 *
 * Every outgoing message is sent with a set of headers that materially reduce
 * spam-folder placement:
 *   - `Reply-To`            — a monitored address (defaults to SMTP_USER)
 *   - `List-Unsubscribe`    — mailto one-click, so Gmail/Yahoo show an
 *                             Unsubscribe button and treat the sender as legit
 *   - `Auto-Submitted: auto-generated` (RFC 3834) — suppresses auto-responders
 *   - `X-Auto-Response-Suppress: All` — suppresses OOF/vacation replies
 *
 * When `DKIM_DOMAIN` / `DKIM_SELECTOR` / `DKIM_PRIVATE_KEY` are all set, every
 * message is DKIM-signed. This is the single most impactful deliverability fix
 * — but it only helps when the From address is on a domain YOU control (so you
 * can publish the public key in DNS). For `@gmail.com` From addresses, Gmail
 * applies its own DKIM; leave these unset.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Optional custom headers (e.g. per-recipient List-Unsubscribe for broadcasts). */
  headers?: Record<string, string>;
}

export interface MailTransport {
  send(message: MailMessage): Promise<{ messageId: string }>;
}

/** Convenience overload matching the spec signature. */
export interface MailSender {
  send(to: string, subject: string, text: string, html: string): Promise<{ messageId: string }>;
}

/** Optional DKIM configuration parsed from env. `null` when not configured. */
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
  // Env vars can't hold literal newlines, so accept `\n` escape sequences
  // (the conventional way to store a PEM in a single-line env var) and convert
  // them back to real newlines for nodemailer.
  const privateKey = rawKey.includes("\\n")
    ? rawKey.replace(/\\n/g, "\n")
    : rawKey;
  return { domainName, keySelector, privateKey };
}

/**
 * Real SMTP transport. All connection details come from env vars — nothing is
 * hardcoded — so swapping to a self-hosted Postfix relay is a pure config change.
 */
export class GmailSmtpTransport implements MailTransport, MailSender {
  private transporter: nodemailer.Transporter;
  private readonly dkim: DkimConfig | null;

  constructor() {
    const host = required("SMTP_HOST");
    const port = Number(required("SMTP_PORT"));
    const user = required("SMTP_USER");
    const pass = required("SMTP_PASS");
    // Validate SMTP_FROM at construction time (not at send time) so all
    // mail config is validated before any DB writes in issueOtp().
    required("SMTP_FROM");
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      // STARTTLS on 587; nodemailer upgrades automatically when the server
      // advertises it. We require it for opportunistic upgrade.
      requireTLS: true,
    });
    this.dkim = loadDkimConfig();
  }

  async send(arg: MailMessage | string, subject?: string, text?: string, html?: string) {
    const message: MailMessage =
      typeof arg === "string"
        ? { to: arg, subject: subject ?? "", text: text ?? "", html: html ?? "" }
        : arg;
    const from = required("SMTP_FROM");
    const replyTo = process.env.MAIL_REPLY_TO || process.env.SMTP_USER || from;

    // Caller-provided headers take precedence (e.g. per-recipient
    // List-Unsubscribe for marketing broadcasts). Default headers are merged
    // underneath so transactional mail behavior is unchanged when no custom
    // headers are supplied.
    const defaultHeaders = {
      // RFC 3834 — tells auto-responders this is auto-generated, so they
      // should NOT send an OOF/vacation reply. Reduces noise + spam signals.
      "Auto-Submitted": "auto-generated",
      // Microsoft/Exchange-specific: suppress all auto-replies.
      "X-Auto-Response-Suppress": "All",
      // List-Unsubscribe lets Gmail/Yahoo show an Unsubscribe button and
      // treats the sender as a legitimate mailer. Default: mailto target.
      // Broadcast sends override this with a per-recipient https one-click URL.
      "List-Unsubscribe": `<mailto:${extractEmail(replyTo)}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
    const mailOptions: nodemailer.SendMailOptions = {
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo,
      headers: { ...defaultHeaders, ...(message.headers ?? {}) },
    };

    // DKIM-sign the message when configured. Only meaningful for a custom From
    // domain you control (you publish the public key in DNS).
    if (this.dkim) {
      mailOptions.dkim = {
        domainName: this.dkim.domainName,
        keySelector: this.dkim.keySelector,
        privateKey: this.dkim.privateKey,
      };
    }

    const info = await this.transporter.sendMail(mailOptions);
    return { messageId: info.messageId };
  }
}

/**
 * Development-only transport. Writes the full email (including the OTP code) to
 * stdout so the flow can be exercised without SMTP credentials. It is a genuine
 * "delivery" to the developer's console — the OTP is really generated, hashed,
 * and stored exactly as in production; only the last-mile transport differs.
 *
 * NEVER selected in production (see `createMailTransport`).
 */
export class ConsoleMailTransport implements MailTransport, MailSender {
  async send(arg: MailMessage | string, subject?: string, text?: string, html?: string) {
    const message: MailMessage =
      typeof arg === "string"
        ? { to: arg, subject: subject ?? "", text: text ?? "", html: html ?? "" }
        : arg;
    // Intentionally visible in dev logs so a developer can read the code. This
    // transport is dev-only; production uses GmailSmtpTransport which never logs
    // the code.
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

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/** Pull the bare email address out of a "Name <addr>" string. */
function extractEmail(fromField: string): string {
  const m = fromField.match(/<([^>]+)>/);
  return m ? m[1] : fromField.trim();
}

let cached: MailTransport | null = null;

/**
 * Returns the application mail transport. Defaults to the real Gmail SMTP
 * transport. The console transport is only allowed outside production and only
 * when explicitly requested via MAIL_TRANSPORT=console.
 */
export function createMailTransport(): MailTransport {
  if (cached) return cached;
  const choice = (process.env.MAIL_TRANSPORT ?? "gmail").toLowerCase();
  if (choice === "console") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "MAIL_TRANSPORT=console is not permitted in production. Set SMTP_* and use the gmail transport.",
      );
    }
    cached = new ConsoleMailTransport();
  } else {
    cached = new GmailSmtpTransport();
  }
  return cached;
}

/**
 * Validate ALL required mail env vars without constructing the transport.
 * Called before any DB writes in issueOtp() so that missing env vars are
 * detected early — before orphaned OTP rows are created.
 *
 * Throws Error("Missing required env var: SMTP_HOST") etc. if any is missing.
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
  cached = null;
}
