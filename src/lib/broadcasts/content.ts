/**
 * Phase 10 — Broadcast content safety.
 *
 * Reuses the Phase 3 transactional-template sanitization (`sanitizeTemplateHtml`)
 * and the flat-`{{var}}` rendering (`renderTransactionalTemplate`) — both are
 * pure, deterministic, and HTML-escape all variable values before substitution.
 *
 * Adds broadcast-specific safety:
 *   - Subject CR/LF injection rejection
 *   - Bounded subject/body sizes
 *   - Mandatory unsubscribe footer (auto-appended if not present)
 *   - Per-recipient variable substitution including {{unsubscribe_url}}
 *   - Final sanitization AFTER variable substitution (defense-in-depth)
 */
import { sanitizeTemplateHtml, renderTransactionalTemplate, escapeHtml } from "@/lib/transactional-templates";
import {
  MAX_SUBJECT_LENGTH,
  MAX_HTML_CONTENT_BYTES,
  MAX_TEXT_CONTENT_BYTES,
} from "./constants";

// ---- Canonical unsubscribe footer ----------------------------------------

const UNSUBSCRIBE_ELEMENT_MARKER = "data-unsubscribe";

/**
 * The standard HTML unsubscribe footer. Appended to every broadcast HTML body
 * that does not already contain a `data-unsubscribe` marker.
 *
 * The `{{unsubscribe_url}}` variable is substituted per-recipient at render time.
 */
const HTML_UNSUBSCRIBE_FOOTER = `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center;" ${UNSUBSCRIBE_ELEMENT_MARKER}>
  <p>You received this email because you subscribed to our marketing emails.</p>
  <p><a href="{{unsubscribe_url}}" style="color:#6b7280;">Unsubscribe</a></p>
</div>
`;

const TEXT_UNSUBSCRIBE_FOOTER = `\n\n---\nYou received this email because you subscribed to our marketing emails.\nUnsubscribe: {{unsubscribe_url}}\n`;

// ---- Validation -----------------------------------------------------------

export interface ContentValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate broadcast content BEFORE launch. Rejects:
 *   - Subject containing CR/LF (header injection)
 *   - Subject exceeding MAX_SUBJECT_LENGTH
 *   - HTML exceeding MAX_HTML_CONTENT_BYTES
 *   - Text exceeding MAX_TEXT_CONTENT_BYTES
 */
export function validateBroadcastContent(opts: {
  subject: string;
  htmlContent: string;
  textContent?: string | null;
}): ContentValidationResult {
  const { subject, htmlContent, textContent } = opts;

  if (!subject || subject.trim().length === 0) {
    return { valid: false, error: "Subject is required." };
  }

  // Reject CR/LF in subject — prevents header injection.
  if (/\r|\n/.test(subject)) {
    return { valid: false, error: "Subject must not contain newlines." };
  }

  if (subject.length > MAX_SUBJECT_LENGTH) {
    return { valid: false, error: `Subject exceeds ${MAX_SUBJECT_LENGTH} characters.` };
  }

  if (!htmlContent || htmlContent.trim().length === 0) {
    return { valid: false, error: "HTML content is required." };
  }

  if (Buffer.byteLength(htmlContent, "utf8") > MAX_HTML_CONTENT_BYTES) {
    return { valid: false, error: `HTML content exceeds ${MAX_HTML_CONTENT_BYTES} bytes.` };
  }

  if (textContent && Buffer.byteLength(textContent, "utf8") > MAX_TEXT_CONTENT_BYTES) {
    return { valid: false, error: `Text content exceeds ${MAX_TEXT_CONTENT_BYTES} bytes.` };
  }

  return { valid: true };
}

// ---- Footer enforcement ---------------------------------------------------

/**
 * Ensure the HTML body contains an unsubscribe mechanism. If the canonical
 * `data-unsubscribe` marker is not present, append the standard footer.
 *
 * The campaign author CANNOT remove compliance by deleting a variable — the
 * footer is always present in the final rendered output.
 */
export function ensureUnsubscribeFooter(html: string): string {
  if (html.includes(UNSUBSCRIBE_ELEMENT_MARKER)) {
    return html; // Author already included an unsubscribe element.
  }
  // Append before </body> if present, otherwise at the end.
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${HTML_UNSUBSCRIBE_FOOTER}</body>`);
  }
  return html + HTML_UNSUBSCRIBE_FOOTER;
}

/**
 * Ensure the text body contains an unsubscribe URL.
 */
export function ensureTextUnsubscribeFooter(text: string): string {
  if (text.includes("{{unsubscribe_url}}")) {
    return text; // Author already included the variable.
  }
  return text + TEXT_UNSUBSCRIBE_FOOTER;
}

// ---- Per-recipient rendering ----------------------------------------------

export interface RenderInput {
  subject: string;
  htmlContent: string;
  textContent?: string | null;
  contactId: number;
  contactEmail: string;
  contactName: string | null;
  unsubscribeUrl: string;
}

export interface RenderResult {
  ok: true;
  subject: string;
  html: string;
  text: string;
}
export interface RenderFailure {
  ok: false;
  error: string;
}

/**
 * Render broadcast content for a single recipient.
 *
 * Flow:
 *   1. Ensure unsubscribe footer is present in HTML + text.
 *   2. Substitute per-recipient variables: {{contact.email}}, {{contact.name}}, {{unsubscribe_url}}.
 *   3. Final sanitization AFTER substitution (defense-in-depth against variables
 *      landing inside attributes — e.g. href="{{unsubscribe_url}}").
 *
 * Variable values are HTML-escaped by `renderTransactionalTemplate` before
 * substitution into HTML. No arbitrary code/expression evaluation.
 */
export function renderBroadcastContent(input: RenderInput): RenderResult | RenderFailure {
  const { subject, htmlContent, textContent, contactId, contactEmail, contactName, unsubscribeUrl } = input;

  // 1. Ensure unsubscribe footer.
  const htmlWithFooter = ensureUnsubscribeFooter(htmlContent);
  const textWithFooter = textContent ? ensureTextUnsubscribeFooter(textContent) : ensureTextUnsubscribeFooter("");

  // 2. Substitute per-recipient variables.
  // The existing flat-`{{var}}` grammar uses [A-Za-z][A-Za-z0-9_]* (no dots).
  // We use underscore-separated names: contact_email, contact_name, unsubscribe_url.
  const variables = ["contact_email", "contact_name", "unsubscribe_url"];
  const values: Record<string, string | number | boolean | null> = {
    contact_email: contactEmail,
    contact_name: contactName ?? "",
    unsubscribe_url: unsubscribeUrl,
  };

  const rendered = renderTransactionalTemplate({
    subject,
    html: htmlWithFooter,
    text: textWithFooter,
    variables,
    values,
  });

  if (!rendered.ok) {
    return {
      ok: false,
      error: `Missing template variables: ${rendered.missing.join(", ")}`,
    };
  }

  // 3. Final sanitization AFTER substitution — defense-in-depth.
  const finalHtml = sanitizeTemplateHtml(rendered.html);

  return {
    ok: true,
    subject: rendered.subject,
    html: finalHtml,
    text: rendered.text ?? "",
  };
}

// ---- Unsubscribe URL generation -------------------------------------------

/**
 * Generate the canonical unsubscribe URL for a recipient.
 *
 * The URL points to the public unsubscribe page. The token is a Phase 9 JWE
 * (opaque, encrypted, purpose-bound, tenant/contact-bound).
 *
 * The base URL is read from `NEXT_PUBLIC_APP_URL` env var. If unset, a
 * relative path is used (sufficient for same-origin one-click POST).
 */
export function buildUnsubscribeUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return `${base}/unsubscribe?token=${token}`;
}

/**
 * Generate the List-Unsubscribe header value for a recipient.
 * Format: `<https://.../api/unsubscribe/one-click?token=...>`
 *
 * Per RFC 8058, this enables one-click unsubscribe in mail clients.
 */
export function buildListUnsubscribeHeader(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return `<${base}/api/unsubscribe/one-click?token=${token}>`;
}

// ---- Subject CR/LF check (for route-level validation) ---------------------

/**
 * Reject subjects containing CR or LF characters. Exported separately for
 * route-level validation before content is stored.
 */
export function subjectHasCrlf(subject: string): boolean {
  return /\r|\n/.test(subject);
}
