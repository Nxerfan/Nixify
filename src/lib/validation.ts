import { z } from "zod";

/**
 * Shared request validation schemas (zod). Phone numbers are validated with an
 * E.164-ish check: optional leading `+`, 7–15 digits. We store the raw string;
 * we never log it.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: "Enter a valid email address" })
  .max(254);

export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(128, { message: "Password is too long" });

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, { message: "Code must be exactly 6 digits" });

export const otpPurposeSchema = z.enum(["signup", "login", "reset"]);

export const phoneNumberSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{7,15}$/, {
    message: "Enter a valid phone number (optional +, 7–15 digits)",
  });

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Full name is required" })
  .max(100, { message: "Full name is too long" });

/**
 * First-party signup schema.
 *
 * Accepts an optional `fullName` (the SignUpForm collects it, and it's
 * persisted on the User row when supplied). The public v1 API
 * (`POST /api/v1/otp/send`) does NOT use this schema — it has its own
 * zod schema that only accepts `email` + `purpose`. This is intentionally
 * a first-party-only extension.
 *
 * `password` is the REAL user-submitted password — never a temporary
 * placeholder. The signup state machine calls /signup exactly ONCE with
 * the real password; OTP verification marks the SAME user verified and
 * establishes the session. There is no second /signup call.
 */
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  purpose: otpPurposeSchema.optional(),
});

export const resendOtpSchema = z.object({
  email: emailSchema,
  purpose: otpPurposeSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  newPassword: passwordSchema,
});

export const profileCompleteSchema = z.object({
  fullName: fullNameSchema,
  phoneNumber: phoneNumberSchema,
});
