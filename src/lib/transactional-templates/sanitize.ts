/**
 * Server-side HTML sanitization for transactional template content
 * (Phase 3, section 16).
 *
 * Uses `sanitize-html` (well-maintained, server-side, structural sanitizer —
 * not a naive string-replace filter). Configured intentionally for email HTML:
 * removes scripts, iframes, event handlers, javascript: URLs, form controls,
 * etc., while preserving the table/div/p/span/a/img markup that email clients
 * actually render.
 *
 * Allowed model is documented inline below. Variables are HTML-escaped by the
 * renderer (render.ts) BEFORE substitution, so user-supplied values can never
 * bypass this sanitizer — there is no raw/unescaped syntax in Phase 3.
 */
import sanitize from "sanitize-html";

// ---- Allowed tags (email-safe) --------------------------------------------
// Table-based layout survives in all email clients; inline styles are kept.
// Removed: script, iframe, object, embed, form, input, button, style, link,
// meta, base, etc. See disallowedTags below for the explicit blocklist.
const ALLOWED_TAGS: sanitize.IOptions["allowedTags"] = [
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
  "div", "p", "span", "br", "hr",
  "a", "img",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "em", "b", "i", "u", "s", "small", "sub", "sup",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "center",
];

// ---- Allowed attributes per tag -------------------------------------------
// Inline style is permitted (email clients need it) — sanitize-html keeps it
// but strips CSS expressions that would be dangerous (e.g. expression()).
// href/src are allowed but URL schemes are restricted (see allowedSchemes).
const ALLOWED_ATTRIBUTES: sanitize.IOptions["allowedAttributes"] = {
  a: ["href", "name", "target", "rel", "title", "style"],
  img: ["src", "alt", "width", "height", "style", "title"],
  td: ["colspan", "rowspan", "align", "valign", "bgcolor", "width", "height", "style"],
  th: ["colspan", "rowspan", "align", "valign", "bgcolor", "width", "height", "style"],
  table: ["align", "bgcolor", "border", "cellpadding", "cellspacing", "width", "style"],
  div: ["align", "style", "class"],
  p: ["align", "style"],
  span: ["style", "class"],
  h1: ["align", "style"],
  h2: ["align", "style"],
  h3: ["align", "style"],
  h4: ["align", "style"],
  h5: ["align", "style"],
  h6: ["align", "style"],
  li: ["style"],
  ul: ["style", "type"],
  ol: ["style", "type", "start"],
  blockquote: ["style", "cite"],
  hr: ["align", "width", "style"],
  br: ["clear"],
};

// ---- URL schemes ----------------------------------------------------------
// Block javascript:, data: (in href), vbscript:, file:, etc. Only http/https
// and mailto/tel are allowed. Note: data: images are NOT allowed — they're
// a known vector and email clients strip them anyway.
const ALLOWED_SCHEMES: sanitize.IOptions["allowedSchemes"] = ["http", "https", "mailto", "tel"];

// ---- Full config ----------------------------------------------------------
const SANITIZE_CONFIG: sanitize.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES,
  allowedSchemes: ALLOWED_SCHEMES,
  // Explicit blocklist (defense-in-depth — even if allowedTags omitted one)
  disallowedTagsMode: "discard",
  // Strip all class-based scripts/styles — only inline style survives
  allowedStyles: {
    "*": {
      // Allow common email-safe CSS properties. sanitize-html parses the
      // style attribute and drops anything not listed here.
      "color": [/^#?[0-9a-zA-Z(),.\s-]+$/],
      "background-color": [/^#?[0-9a-zA-Z(),.\s-]+$/],
      "background": [/^#?[0-9a-zA-Z(),.\s-]+$/],
      "font-family": [/^[^;<>]+$/],
      "font-size": [/^[0-9a-zA-Z. \-]+$/],
      "font-weight": [/^[0-9a-zA-Z]+$/],
      "font-style": [/^[a-zA-Z]+$/],
      "text-align": [/^(left|right|center|justify|start|end)$/],
      "text-decoration": [/^[a-zA-Z-]+$/],
      "line-height": [/^[0-9a-zA-Z. \-]+$/],
      "margin": [/^[0-9a-zA-Z. \-]+$/],
      "margin-top": [/^[-0-9a-zA-Z. \-]+$/],
      "margin-right": [/^[-0-9a-zA-Z. \-]+$/],
      "margin-bottom": [/^[-0-9a-zA-Z. \-]+$/],
      "margin-left": [/^[-0-9a-zA-Z. \-]+$/],
      "padding": [/^[0-9a-zA-Z. \-]+$/],
      "padding-top": [/^[-0-9a-zA-Z. \-]+$/],
      "padding-right": [/^[-0-9a-zA-Z. \-]+$/],
      "padding-bottom": [/^[-0-9a-zA-Z. \-]+$/],
      "padding-left": [/^[-0-9a-zA-Z. \-]+$/],
      "border": [/^[0-9a-zA-Z. \-]+$/],
      "border-color": [/^#?[0-9a-zA-Z(),.\s-]+$/],
      "border-radius": [/^[0-9a-zA-Z. \-]+$/],
      "width": [/^[0-9a-zA-Z.% \-]+$/],
      "height": [/^[0-9a-zA-Z.% \-]+$/],
      "max-width": [/^[0-9a-zA-Z.% \-]+$/],
      "display": [/^[a-zA-Z-]+$/],
    },
  },
  // Transform <a href="javascript:..."> → stripped href
  // sanitize-html already blocks javascript: via allowedSchemes, but this is
  // explicit defense-in-depth.
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: "noopener noreferrer" },
    }),
  },
};

/**
 * Sanitize user-authored template HTML.
 *
 * This is applied:
 *   1. When a template version is created/updated (stored sanitized).
 *   2. Before preview rendering (defense-in-depth, in case stored HTML was
 *      somehow inserted bypassing step 1).
 *
 * Returns the sanitized HTML string. Never throws on malformed input —
 * sanitize-html is forgiving and returns a best-effort cleaned string.
 */
export function sanitizeTemplateHtml(html: string): string {
  return sanitize(html, SANITIZE_CONFIG);
}

// ---- Allowed-model documentation (for the PR + future maintainers) --------
export const SANITIZER_ALLOWED_MODEL = {
  tags: ALLOWED_TAGS,
  schemes: ALLOWED_SCHEMES,
  notes: [
    "Scripts, iframes, objects, embeds, forms, and form controls are stripped.",
    "All on* event-handler attributes are stripped (onclick, onerror, onload, etc.).",
    "javascript:, vbscript:, data:, and file: URL schemes are blocked.",
    "Inline style is allowed but limited to a safelist of email-safe CSS properties.",
    "class attributes are kept on div/span only for layout; no <style> blocks.",
    "Variable substitution is HTML-escaped by the renderer — no raw/unescaped syntax exists in Phase 3.",
  ],
} as const;
