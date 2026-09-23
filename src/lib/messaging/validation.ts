/**
 * Messaging validation (Phase 4, section 12).
 *
 * Public v1 send request schema + recipient normalization. The client CANNOT
 * control `from`, `replyTo`, headers, SMTP options, or provider choice — the
 * schema only accepts `to`, `template_slug`, optional `template_version`, and
 * `variables` (scalar values only — validated via the Phase 3 helper).
 */
import { z } from "zod";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Public v1 send body (section 12). */
export const sendV1Schema = z.object({
  to: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Recipient email is required.")
    .max(254, "Recipient email must be at most 254 characters.")
    .refine((v) => EMAIL_RE.test(v), "Enter a valid email address."),
  template_slug: z
    .string()
    .trim()
    .min(1, "template_slug is required.")
    .max(80, "template_slug must be at most 80 characters."),
  template_version: z.number().int().positive().optional(),
  variables: z.record(z.string(), z.unknown()).default({}),
});

/** Dashboard test-send body (section 20). */
export const dashboardTestSendSchema = z.object({
  to: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Recipient email is required.")
    .max(254, "Recipient email must be at most 254 characters.")
    .refine((v) => EMAIL_RE.test(v), "Enter a valid email address."),
  variables: z.record(z.string(), z.unknown()).default({}),
});

/** Normalize recipient: trim + lowercase (same rule as contacts). */
export function normalizeRecipient(email: string): string {
  return email.trim().toLowerCase();
}

/** Idempotency-Key header validation (section 13). */
export const IDEMPOTENCY_KEY_MIN = 8;
export const IDEMPOTENCY_KEY_MAX = 128;

export function isValidIdempotencyKey(key: string): boolean {
  if (typeof key !== "string") return false;
  const len = key.length;
  return len >= IDEMPOTENCY_KEY_MIN && len <= IDEMPOTENCY_KEY_MAX;
}

export type SendV1Input = z.infer<typeof sendV1Schema>;
export type DashboardTestSendInput = z.infer<typeof dashboardTestSendSchema>;
