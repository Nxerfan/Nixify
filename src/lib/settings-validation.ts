/**
 * Shared Settings profile validation schema.
 *
 * Reuses the canonical validation rules from src/lib/validation.ts
 * but with Settings-specific semantics:
 *   - Empty/whitespace values → null (clearing allowed)
 *   - Non-empty values must pass canonical validation
 *   - Uses .strict() to reject unknown fields (email, plan, userId, etc.)
 *
 * Both the API route and the behavioral tests import this exact schema
 * so they can never diverge.
 */

import { z } from "zod";

/**
 * The canonical phone regex from src/lib/validation.ts.
 * Optional +, 7–15 digits.
 */
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

/**
 * Settings profile update schema.
 *
 * - fullName: trim, max 100 chars, empty → null (clears the field)
 * - phoneNumber: canonical regex, empty → null (clears the field)
 * - .strict() rejects any other field (email, plan, userId, etc.)
 *
 * Blank normalization happens BEFORE canonical validation:
 *   "" → null, "   " → null (after trim)
 *
 * For non-empty values:
 *   fullName: must be ≤ 100 chars after trim
 *   phoneNumber: must match /^\+?[0-9]{7,15}$/
 */
export const settingsProfileUpdateSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .max(100, { message: "Full name must be 100 characters or fewer" })
      .optional()
      .nullable()
      .transform((v) => (v === null || v === "" ? null : v)),
    phoneNumber: z
      .string()
      .trim()
      .regex(PHONE_REGEX, {
        message: "Enter a valid phone number (optional +, 7–15 digits)",
      })
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null))
      .transform((v) => (v === null || v === "" ? null : v)),
  })
  .strict();

/**
 * Unknown-field policy:
 *
 * The schema uses .strict() which means any field NOT defined above
 * (email, plan, userId, etc.) will cause a validation error and be
 * REJECTED (not silently stripped).
 *
 * This is the safest contract: the API cannot accidentally accept
 * email or plan mutations even if a client sends them.
 */

export type SettingsProfileUpdate = z.infer<typeof settingsProfileUpdateSchema>;
