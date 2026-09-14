/**
 * Transactional template renderer (Phase 3, sections 12-15, 18).
 *
 * Pure, deterministic function. Does NOT send email. Takes raw (already
 * sanitized) content + a values map, returns rendered {subject, html, text}.
 *
 * Safety rules enforced here:
 *   - Missing variables → structured error (section 12). NEVER silently
 *     substitute an empty string for an unknown variable.
 *   - All variable values substituted into HTML are HTML-escaped (section 14).
 *     No raw/unescaped syntax exists.
 *   - Subject CR/LF protection (section 15): rendered subjects cannot contain
 *     \r or \n — prevents email-header injection.
 *   - Scalar values only (string|number|boolean|null); objects/arrays rejected
 *     upstream by validateVariableValues.
 */
import { findMissingVariables } from "./variables";

const TOKEN_RE = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

// ---- Result types ----------------------------------------------------------

export interface RenderSuccess {
  ok: true;
  subject: string;
  html: string;
  text: string | null;
}

export interface MissingVariablesError {
  ok: false;
  code: "missing_template_variables";
  missing: string[];
}

export type RenderResult = RenderSuccess | MissingVariablesError;

// ---- HTML escaping ---------------------------------------------------------

/**
 * Escape a string for safe insertion into HTML text content.
 * Replaces & < > " ' — the OWASP-recommended set. Used for ALL variable
 * substitutions into HTML. There is no unescaped path in Phase 3.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Convert a scalar variable value to its text representation (section 13).
 * null → empty string, boolean → "true"/"false", number → string, string → as-is.
 */
export function scalarToText(value: string | number | boolean | null): string {
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

/**
 * Escape a value for use inside a subject line.
 * HTML-escaping is NOT applied to subjects (subjects are not HTML), but
 * CR/LF are stripped to prevent header injection (section 15).
 */
function escapeSubjectValue(value: string): string {
  // Strip CR and LF — a rendered subject must be a single line.
  return value.replace(/[\r\n]+/g, " ");
}

// ---- Render ---------------------------------------------------------------

export interface RenderInput {
  subject: string;
  html: string;
  text: string | null;
  /** Required variable names (from extractVariables). */
  variables: string[];
  /** Supplied scalar values (already validated as string|number|boolean|null). */
  values: Record<string, string | number | boolean | null>;
}

/**
 * Render a template. Returns a structured error if any required variable is
 * missing from `values`. Otherwise returns the fully substituted subject/html/text.
 *
 * Deterministic: same input always produces same output (variable names are
 * matched exactly; no random ordering, no partial substitution).
 */
export function renderTransactionalTemplate(input: RenderInput): RenderResult {
  // 1. Fail fast on missing variables (section 12).
  const missing = findMissingVariables(input.variables, input.values);
  if (missing.length > 0) {
    return {
      ok: false,
      code: "missing_template_variables",
      missing: missing.sort(),
    };
  }

  // 2. Substitute. HTML-escaped for html; text-escaped for text; subject gets
  //    CR/LF-stripped values.
  const renderField = (src: string, escaper: (s: string) => string): string => {
    return src.replace(TOKEN_RE, (full, name: string) => {
      if (!input.variables.includes(name)) {
        // Not a recognized variable — leave the token as-is. This happens only
        // when the stored variables list and the content disagree, which the
        // extractor prevents at write time. Defense-in-depth: don't drop.
        return full;
      }
      const val = input.values[name];
      return escaper(scalarToText(val));
    });
  };

  const renderedHtml = renderField(input.html, escapeHtml);
  const renderedText = input.text ? renderField(input.text, (s) => s) : null;
  let renderedSubject = renderField(input.subject, escapeSubjectValue);

  // 3. Final subject safety: strip any CR/LF that survived (e.g. from a
  //    template that literally contained a newline in the subject string).
  renderedSubject = renderedSubject.replace(/[\r\n]+/g, " ").trim();

  return {
    ok: true,
    subject: renderedSubject,
    html: renderedHtml,
    text: renderedText,
  };
}
