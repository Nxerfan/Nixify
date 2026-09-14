/**
 * Transactional Template validation (Phase 3).
 *
 * Centralizes all input validation + size limits so both the service layer
 * and the HTTP route layer use the same rules. Plain zod + a few helpers —
 * no DB access here.
 *
 * Variable syntax: FLAT {{name}} only. No dotted paths, no helpers, no
 * triple-brace raw HTML. See variables.ts for the extraction grammar.
 */
import { z } from "zod";

// ---- Metadata limits (section 8) ------------------------------------------

export const MAX_NAME_LENGTH = 120;
export const MAX_SLUG_LENGTH = 80;
export const MAX_DESCRIPTION_LENGTH = 500;

// ---- Content limits (section 9) --------------------------------------------

export const MAX_SUBJECT_LENGTH = 200;
export const MAX_HTML_BYTES = 100 * 1024; // 100 KB UTF-8
export const MAX_TEXT_BYTES = 50 * 1024; // 50 KB UTF-8

// ---- Slug grammar (section 8) ---------------------------------------------

/**
 * Slug must be lowercase letters/numbers/hyphens, start with a letter,
 * max 80 chars. Tenant-unique (userId, slug) — same slug allowed for
 * different users.
 */
export const SLUG_RE = /^[a-z][a-z0-9-]{0,79}$/;

/**
 * Variable name grammar (section 10): flat names only.
 * Must start with a letter, then letters/digits/underscore, max 64 chars.
 * No dotted paths ({{user.name}}), no helpers, no expressions.
 */
export const VARIABLE_NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

// ---- Zod schemas -----------------------------------------------------------

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required.")
  .max(MAX_SLUG_LENGTH, `Slug must be at most ${MAX_SLUG_LENGTH} characters.`)
  .regex(SLUG_RE, "Slug must be lowercase letters, numbers, and hyphens, starting with a letter.");

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(MAX_NAME_LENGTH, `Name must be at most ${MAX_NAME_LENGTH} characters.`);

export const descriptionSchema = z
  .string()
  .trim()
  .max(MAX_DESCRIPTION_LENGTH, `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const subjectSchema = z
  .string()
  .trim()
  .min(1, "Subject is required.")
  .max(MAX_SUBJECT_LENGTH, `Subject must be at most ${MAX_SUBJECT_LENGTH} characters.`);

export const htmlSchema = z
  .string()
  .min(1, "HTML content is required.")
  .refine((v) => Buffer.byteLength(v, "utf8") <= MAX_HTML_BYTES, `HTML must be at most ${MAX_HTML_BYTES} bytes.`);

export const textSchema = z
  .string()
  .refine((v) => Buffer.byteLength(v, "utf8") <= MAX_TEXT_BYTES, `Text must be at most ${MAX_TEXT_BYTES} bytes.`)
  .optional()
  .or(z.literal("").transform(() => undefined));

/** Create-template body (section 22). */
export const createTemplateSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  description: descriptionSchema,
  subject: subjectSchema,
  html: htmlSchema,
  text: textSchema,
});

/** Patch-template body (section 23). Metadata + content are both optional. */
export const patchTemplateSchema = z
  .object({
    name: nameSchema.optional(),
    description: descriptionSchema,
    subject: subjectSchema.optional(),
    html: htmlSchema.optional(),
    text: textSchema,
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.description !== undefined ||
      v.subject !== undefined ||
      v.html !== undefined ||
      v.text !== undefined,
    "At least one field must be provided.",
  );

/** Preview body (section 28). Either a templateId (render stored version) or
 * inline content (render ad-hoc). variables supplies the values. */
export const previewSchema = z
  .object({
    templateId: z.number().int().positive().optional(),
    version: z.number().int().positive().optional(),
    // Inline content (used when no templateId — ad-hoc preview)
    subject: subjectSchema.optional(),
    html: htmlSchema.optional(),
    text: textSchema.optional(),
    variables: z.record(z.string(), z.unknown()).default({}),
  })
  .refine(
    (v) => v.templateId !== undefined || (v.subject !== undefined && v.html !== undefined),
    "Either templateId or both subject+html must be provided.",
  );

// ---- Types ----------------------------------------------------------------

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type PatchTemplateInput = z.infer<typeof patchTemplateSchema>;
export type PreviewInput = z.infer<typeof previewSchema>;

// ---- Helpers ---------------------------------------------------------------

/**
 * Validate that a variable values map contains ONLY safe scalar values
 * (section 13): string | number | boolean | null. Reject objects/arrays.
 */
export function validateVariableValues(
  values: Record<string, unknown>,
):
  | { valid: true; value: Record<string, string | number | boolean | null> }
  | { valid: false; error: string } {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, val] of Object.entries(values)) {
    if (val === null) {
      out[key] = null;
      continue;
    }
    const t = typeof val;
    if (t === "string" || t === "number" || t === "boolean") {
      out[key] = val as string | number | boolean;
      continue;
    }
    return {
      valid: false,
      error: `Variable "${key}" must be a string, number, boolean, or null (objects and arrays are not allowed).`,
    };
  }
  return { valid: true, value: out };
}
