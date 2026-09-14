/**
 * Variable extraction for transactional templates (Phase 3, section 11).
 *
 * Syntax: flat `{{variable_name}}` only. Grammar is enforced here, not just
 * by regex match — names that don't match VARIABLE_NAME_RE are ignored (they
 * are not valid variables and won't be substituted).
 *
 * Extracts from subject + html + text, returns a deterministic, de-duplicated,
 * sorted list. Stored on each immutable version row.
 *
 * IMPORTANT: This module is intentionally not a template engine. No loops,
 * no conditionals, no helpers, no triple-brace raw HTML. Humanity has enough
 * programming languages already.
 */
import { VARIABLE_NAME_RE } from "./validation";

// Matches {{name}} where name is letters/digits/underscore starting with a
// letter. Whitespace inside the braces is tolerated ({{ name }} → "name").
// We do NOT match {{user.name}} — the grammar rejects dotted paths.
const TOKEN_RE = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

/**
 * Extract referenced variables from one or more content strings.
 * Returns a sorted, de-duplicated array of flat variable names.
 *
 * Example:
 *   extractVariables(["Welcome {{name}}", "Email: {{email}}", "{{name}} — {{email}}"])
 *   => ["email", "name"]
 */
export function extractVariables(...sources: (string | undefined | null)[]): string[] {
  const set = new Set<string>();
  for (const src of sources) {
    if (!src) continue;
    let m: RegExpExecArray | null;
    TOKEN_RE.lastIndex = 0; // reusable regex — reset
    while ((m = TOKEN_RE.exec(src)) !== null) {
      const name = m[1];
      if (VARIABLE_NAME_RE.test(name)) {
        set.add(name);
      }
      // Names that fail VARIABLE_NAME_RE (e.g. empty or invalid) are simply
      // not extracted — they won't be substituted at render time either.
    }
  }
  return Array.from(set).sort();
}

/**
 * Return the set of required variables that are MISSING from the supplied
 * values map. Used by the renderer to fail loudly (section 12) instead of
 * silently substituting empty strings.
 */
export function findMissingVariables(
  required: string[],
  provided: Record<string, unknown>,
): string[] {
  return required.filter((name) => !(name in provided));
}
