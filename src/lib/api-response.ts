import { NextResponse } from "next/server";

/**
 * Consistent error response shape (§13.7):
 *   { "error": "short_code", "message": "human readable" }
 */
export const ERROR_CODES = {
  VALIDATION_FAILED: "validation_failed",
  RATE_LIMITED: "rate_limited",
  LOCKED: "locked",
  CODE_MISMATCH: "code_mismatch",
  EXPIRED: "expired",
  ALREADY_USED: "already_used",
  UNAUTHORIZED: "unauthorized",
  EMAIL_EXISTS: "email_exists",
  EMAIL_NOT_VERIFIED: "email_not_verified",
  INVALID_CREDENTIALS: "invalid_credentials",
  NOT_FOUND: "not_found",
  PROFILE_INCOMPLETE: "profile_incomplete",
  INTERNAL: "internal_error",
  // Security-layer codes (deterministic, rule-based):
  IP_BLOCKED: "ip_blocked",
  DEVICE_LIMIT_EXCEEDED: "device_limit_exceeded",
  DISPOSABLE_EMAIL: "disposable_email",
  VPN_BLOCKED: "vpn_blocked",
  ACCOUNT_LOCKED: "account_locked",
  FORBIDDEN: "forbidden",
  MAIL_CONFIG_MISSING: "mail_config_missing",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export function apiError(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ error: code, message }, { status });
}

export function apiOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
