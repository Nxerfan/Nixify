/**
 * Shared Settings profile validation schema.
 *
 * Composes the CANONICAL validation schemas from src/lib/validation.ts:
 *   - fullNameSchema (trim, max 100)
 *   - phoneNumberSchema (regex /^\+?[0-9]{7,15}$/)
 *
 * Settings-specific semantics:
 *   - undefined → field omitted (not sent)
 *   - null → explicit clear
 *   - "" or "   " → null (after trim)
 *   - non-empty → must pass canonical validation
 *
 * Uses .strict() to REJECT unknown fields (email, plan, userId, etc.).
 * Unknown fields are REJECTED, not stripped.
 */

import { z } from "zod";

/**
 * Compose the Settings update schema from canonical rules.
 *
 * The canonical fullNameSchema requires non-empty, but Settings
 * needs to allow clearing. We normalize blanks to null BEFORE canonical
 * validation by using a preprocess/transform approach:
 *
 * 1. Trim the input
 * 2. If empty after trim → null (clear)
 * 3. If non-empty → apply canonical fullNameSchema rules (max 100)
 *
 * For phoneNumber:
 * 1. Trim the input
 * 2. If empty after trim → null (clear)
 * 3. If non-empty → apply canonical phoneNumberSchema rules (regex)
 */

// Canonical rules (duplicated here ONLY to avoid circular imports; the
// values are identical to src/lib/validation.ts):
const CANONICAL_FULL_NAME_MAX = 100;
const CANONICAL_PHONE_REGEX = /^\+?[0-9]{7,15}$/;

export const settingsProfileUpdateSchema = z
  .object({
    fullName: z
      .preprocess((v) => {
        if (v === null || v === undefined) return null;
        const trimmed = String(v).trim();
        return trimmed === "" ? null : trimmed;
      }, z.union([
        z.null(),
        z.string().max(CANONICAL_FULL_NAME_MAX, {
          message: "Full name must be 100 characters or fewer",
        }),
      ]))
      .optional(),
    phoneNumber: z
      .preprocess((v) => {
        if (v === null || v === undefined) return null;
        const trimmed = String(v).trim();
        return trimmed === "" ? null : trimmed;
      }, z.union([
        z.null(),
        z.string().regex(CANONICAL_PHONE_REGEX, {
          message: "Enter a valid phone number (optional +, 7–15 digits)",
        }),
      ]))
      .optional(),
  })
  .strict();

export type SettingsProfileUpdate = z.infer<typeof settingsProfileUpdateSchema>;
