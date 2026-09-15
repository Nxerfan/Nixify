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
 *   - Mandatory SYSTEM-CONTROLLED unsubscribe footer (author cannot bypass)
 *   - Per-recipient variable substitution including {{unsubscribe_url}}
 *   - Final sanitization AFTER variable substitution (defense-in-depth)
 *   - Full draft-content validation (used by create + update)
 *   - Absolute HTTPS unsubscribe URL helper (fail-closed in production)
 */
import { sanitizeTemplateHtml, renderTransactionalTemplate } from "@/lib/transactional-templates";
import {
  MAX_SUBJECT_LENGTH,
  MAX_HTML_CONTENT_BYTES,
  MAX_TEXT_CONTENT_BYTES,
} from "./constants";

// ---- Canonical unsubscribe footer ----------------------------------------

/**
 * The system-controlled canonical unsubscribe footer.
 *
 * ALWAYS appended to broadcast HTML — the campaign author CANNOT remove this
 * compliance mechanism by deleting a variable or by including their own
 * `data-unsubscribe` marker. Any author-provided `data-unsubscribe` markers
 * are stripped from the author content BEFORE the system footer is appended.
 *
 * The `{{unsubscribe_url}}` variable is substituted per-recipient at render
 * time. The footer is added after sanitization of author content (so author
 * HTML cannot escape the footer's enclosure) and before final sanitization
 * (so the footer itself is also sanitized — defense-in-depth).
 */
const HTML_UNSUBSCRIBE_FOOTER = `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center;" data-unsubscribe="system">
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
 * Validate individual broadcast content fields BEFORE launch. Rejects:
 *   - Subject containing CR/LF (header injection)
 *   - Subject exceeding MAX_SUBJECT_LENGTH
 *   - HTML exceeding MAX_HTML_CONTENT_BYTES
 *   - Text exceeding MAX_TEXT_CONTENT_BYTES
 *
 * NOTE: This is a PER-FIELD validator. Use `validateFullDraft` for the merged
 * draft state (which enforces ALL fields non-empty after a partial update).
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

/**
 * Validate the FULL merged draft state (existing + updated fields combined).
 * Used by BOTH `createBroadcast` and `updateBroadcast` to ensure a partial
 * update cannot bypass content-size validation.
 *
 * A text-only update MUST NOT bypass text-size validation.
 * A subject-only update MUST NOT bypass subject-size validation.
 *
 * Checks (against the MERGED state):
 *   - name non-empty + bounded (1..200 chars)
 *   - subject non-empty + no CR/LF + <= MAX_SUBJECT_LENGTH
 *   - htmlContent non-empty + <= MAX_HTML_CONTENT_BYTES
 *   - textContent (if present) <= MAX_TEXT_CONTENT_BYTES
 *   - audienceType is valid
 *   - if audienceType=group: targetGroupId required + verified owned by userId
 */
export interface FullDraftInput {
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string | null;
  audienceType: string;
  targetGroupId?: number | null;
}

export interface FullDraftContext {
  /** If provided, the group is verified to belong to this userId. */
  userId?: number;
  /** Group ownership verifier. Returns true if the group belongs to userId. */
  verifyGroupOwnership?: (groupId: number, userId: number) => Promise<boolean>;
}

export async function validateFullDraft(input: FullDraftInput, ctx: FullDraftContext = {}): Promise<ContentValidationResult> {
  // Name
  if (!input.name || input.name.trim().length === 0) {
    return { valid: false, error: "Name is required." };
  }
  if (input.name.trim().length > 200) {
    return { valid: false, error: "Name exceeds 200 characters." };
  }

  // Subject
  if (!input.subject || input.subject.trim().length === 0) {
    return { valid: false, error: "Subject is required." };
  }
  if (/\r|\n/.test(input.subject)) {
    return { valid: false, error: "Subject must not contain newlines." };
  }
  if (input.subject.length > MAX_SUBJECT_LENGTH) {
    return { valid: false, error: `Subject exceeds ${MAX_SUBJECT_LENGTH} characters.` };
  }

  // HTML
  if (!input.htmlContent || input.htmlContent.trim().length === 0) {
    return { valid: false, error: "HTML content is required." };
  }
  if (Buffer.byteLength(input.htmlContent, "utf8") > MAX_HTML_CONTENT_BYTES) {
    return { valid: false, error: `HTML content exceeds ${MAX_HTML_CONTENT_BYTES} bytes.` };
  }

  // Text (optional but if present must be bounded)
  if (input.textContent && Buffer.byteLength(input.textContent, "utf8") > MAX_TEXT_CONTENT_BYTES) {
    return { valid: false, error: `Text content exceeds ${MAX_TEXT_CONTENT_BYTES} bytes.` };
  }

  // Audience consistency
  if (input.audienceType !== "all_contacts" && input.audienceType !== "group") {
    return { valid: false, error: `Invalid audience type: ${input.audienceType}` };
  }
  if (input.audienceType === "group") {
    if (!input.targetGroupId) {
      return { valid: false, error: "targetGroupId is required for group audience." };
    }
    if (ctx.userId && ctx.verifyGroupOwnership) {
      const owned = await ctx.verifyGroupOwnership(input.targetGroupId, ctx.userId);
      if (!owned) {
        return { valid: false, error: "Group not found or does not belong to your account." };
      }
    }
  } else if (input.audienceType === "all_contacts") {
    if (input.targetGroupId !== undefined && input.targetGroupId !== null) {
      return { valid: false, error: "targetGroupId must be null for all_contacts audience." };
    }
  }

  return { valid: true };
}

// ---- Footer enforcement ---------------------------------------------------

/**
 * Strip any author-provided `data-unsubscribe` markers from the HTML.
 *
 * Authors cannot self-certify compliance by including their own marker. The
 * system footer is ALWAYS appended after stripping. This prevents an author
 * from including a fake `data-unsubscribe` div with no actual unsubscribe
 * link to bypass the footer requirement.
 *
 * We remove the entire element that carries the marker (best-effort regex
 * over HTML — the final sanitization pass that follows will clean up any
 * malformed markup).
 */
function stripAuthorUnsubscribeMarkers(html: string): string {
  // Remove any element carrying the data-unsubscribe attribute (system or
  // author-provided). We then re-append the system footer unconditionally.
  // Match <tag ... data-unsubscribe(="...")...>...</tag> for the most common
  // wrapping elements (div, p, span, a). Use non-greedy matchers.
  return html
    .replace(/<div[^>]*\bdata-unsubscribe\b[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<p[^>]*\bdata-unsubscribe\b[^>]*>[\s\S]*?<\/p>/gi, "")
    .replace(/<span[^>]*\bdata-unsubscribe\b[^>]*>[\s\S]*?<\/span>/gi, "")
    .replace(/<a[^>]*\bdata-unsubscribe\b[^>]*>[\s\S]*?<\/a>/gi, "")
    // Also strip orphan self-closing markers / attribute-only occurrences.
    .replace(/\sdata-unsubscribe(="[^"]*")?/gi, "");
}

/**
 * Ensure the HTML body contains the SYSTEM-CONTROLLED unsubscribe footer.
 *
 * ALWAYS strips any author-provided `data-unsubscribe` markers, then appends
 * the canonical system footer. The author cannot remove compliance by
 * including a fake marker or by deleting the variable.
 */
export function ensureUnsubscribeFooter(html: string): string {
  const stripped = stripAuthorUnsubscribeMarkers(html);
  // Append before </body> if present, otherwise at the end.
  if (/<\/body>/i.test(stripped)) {
    return stripped.replace(/<\/body>/i, `${HTML_UNSUBSCRIBE_FOOTER}</body>`);
  }
  return stripped + HTML_UNSUBSCRIBE_FOOTER;
}

/**
 * Ensure the text body contains an unsubscribe URL.
 *
 * The text footer is appended unconditionally. If the author already
 * included the `{{unsubscribe_url}}` variable, we still append the system
 * footer (so a per-recipient URL is always present in the text part).
 */
export function ensureTextUnsubscribeFooter(text: string): string {
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
 *   1. Strip author-provided `data-unsubscribe` markers.
 *   2. Append the SYSTEM-CONTROLLED unsubscribe footer (always).
 *   3. Substitute per-recipient variables: {{contact_email}}, {{contact_name}}, {{unsubscribe_url}}.
 *   4. Final sanitization AFTER substitution (defense-in-depth against variables
 *      landing inside attributes — e.g. href="{{unsubscribe_url}}").
 *
 * Variable values are HTML-escaped by `renderTransactionalTemplate` before
 * substitution into HTML. No arbitrary code/expression evaluation.
 */
export function renderBroadcastContent(input: RenderInput): RenderResult | RenderFailure {
  const { subject, htmlContent, textContent, contactId, contactEmail, contactName, unsubscribeUrl } = input;

  // 1+2. Ensure system-controlled unsubscribe footer (strips author markers).
  const htmlWithFooter = ensureUnsubscribeFooter(htmlContent);
  const textWithFooter = textContent ? ensureTextUnsubscribeFooter(textContent) : ensureTextUnsubscribeFooter("");

  // 3. Substitute per-recipient variables.
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

  // 4. Final sanitization AFTER substitution — defense-in-depth.
  const finalHtml = sanitizeTemplateHtml(rendered.html);

  return {
    ok: true,
    subject: rendered.subject,
    html: finalHtml,
    text: rendered.text ?? "",
  };
}

// ---- Unsubscribe URL generation (absolute HTTPS, fail-closed) ------------

/**
 * Read and validate the application origin from `NEXT_PUBLIC_APP_URL`.
 *
 * - MUST be a valid URL.
 * - MUST use HTTPS in production.
 * - In production: throw if missing/invalid/non-HTTPS (fail closed).
 * - In dev/test: allow HTTP for localhost (test env sets the env var to a
 *   valid HTTPS URL — see the broadcast CI job).
 *
 * The returned URL has no trailing slash.
 */
export function getAppOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_APP_URL must be set to an HTTPS URL in production.");
    }
    throw new Error("NEXT_PUBLIC_APP_URL must be set (use https://test.example.com in tests).");
  }
  let origin: string;
  try {
    const u = new URL(raw);
    origin = u.origin; // scheme://host[:port]
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL is not a valid URL.");
  }
  if (process.env.NODE_ENV === "production" && !origin.startsWith("https://")) {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
  }
  // Allow HTTP only for localhost in non-production.
  if (origin.startsWith("http://") && !origin.includes("localhost") && process.env.NODE_ENV !== "production") {
    // Tolerate non-HTTPS in dev/test for non-localhost origins, but production
    // is fail-closed (handled above). No-op here.
  }
  if (origin.startsWith("http://") && !origin.includes("localhost") && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
  }
  return origin;
}

/**
 * Generate the canonical unsubscribe URL for a recipient.
 *
 * Uses `new URL()` for construction (not string concatenation) and
 * `encodeURIComponent` for the token query value. The base origin comes from
 * `getAppOrigin()` — fails closed in production if misconfigured.
 */
export function buildUnsubscribeUrl(token: string): string {
  const origin = getAppOrigin();
  const u = new URL("/unsubscribe", origin);
  u.searchParams.set("token", token);
  return u.toString();
}

/**
 * Generate the List-Unsubscribe header value for a recipient.
 * Format: `<https://.../api/unsubscribe/one-click?token=...>`
 *
 * Per RFC 8058, this enables one-click unsubscribe in mail clients.
 * The URL is absolute HTTPS via `getAppOrigin()`.
 */
export function buildListUnsubscribeHeader(token: string): string {
  const origin = getAppOrigin();
  const u = new URL("/api/unsubscribe/one-click", origin);
  u.searchParams.set("token", token);
  return `<${u.toString()}>`;
}

// ---- Subject CR/LF check (for route-level validation) ---------------------

/**
 * Reject subjects containing CR or LF characters. Exported separately for
 * route-level validation before content is stored.
 */
export function subjectHasCrlf(subject: string): boolean {
  return /\r|\n/.test(subject);
}
