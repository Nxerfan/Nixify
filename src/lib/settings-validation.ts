/**
 * Shared Settings profile validation schema.
 *
 * IMPORTS and COMPOSES the canonical validation schemas from
 * src/lib/validation.ts — does NOT duplicate the canonical rules.
 *
 * Canonical schemas used:
 *   - fullNameSchema  (trim, min 1, max 100)
 *   - phoneNumberSchema (trim, regex /^\+?[0-9]{7,15}$/)
 *
 * Settings-specific semantics:
 *   - undefined → field omitted (not sent)
 *   - null → explicit clear (stored as null)
 *   - "" or "   " → null (after trim, blank normalizes to null)
 *   - non-empty string → validated by the ACTUAL canonical schema
 *   - non-string values (number, object, array) → REJECTED (never coerced)
 *
 * Uses .strict() to REJECT unknown fields (email, plan, userId, etc.).
 * Unknown fields are REJECTED, not stripped.
 */

import { z } from "zod";
import { fullNameSchema, phoneNumberSchema } from "@/lib/validation";

/**
 * Helper: normalize blank string values to null WITHOUT coercing non-strings.
 *
 * - If the value is a string, trim it. If empty after trim → null.
 *   Otherwise return the trimmed string (canonical schema will validate it).
 * - If the value is null or undefined, return null (preserves "not sent" / "clear").
 * - If the value is NOT a string (number, object, array, boolean), return it
 *   as-is so the canonical z.string() schema REJECTS it.
 */
function normalizeBlankString(v: unknown): unknown {
  if (typeof v === "string") {
    const trimmed = v.trim();
    return trimmed === "" ? null : trimmed;
  }
  // null/undefined/number/object/array — pass through unchanged.
  // z.union([z.null(), canonicalStringSchema]) will reject non-string, non-null.
  if (v === undefined) return undefined;
  return v;
}

/**
 * Settings profile update schema.
 *
 * Composes canonical fullNameSchema and phoneNumberSchema with blank-normalization.
 *
 * For each field:
 *   1. preprocess: if string → trim; if blank → null; if non-string → preserve (will be rejected)
 *   2. z.union([z.null(), canonicalSchema]): null clears; non-null must pass canonical validation
 *   3. .optional(): undefined means "not sent" (field unchanged)
 */
export const settingsProfileUpdateSchema = z
  .object({
    fullName: z
      .preprocess(normalizeBlankString, z.union([z.null(), fullNameSchema]))
      .optional(),
    phoneNumber: z
      .preprocess(normalizeBlankString, z.union([z.null(), phoneNumberSchema]))
      .optional(),
  })
  .strict();

export type SettingsProfileUpdate = z.infer<typeof settingsProfileUpdateSchema>;
