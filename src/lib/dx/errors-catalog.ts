/**
 * Error Explorer — the full catalog of API error codes with causes, fixes, and
 * doc links. Used by the /dashboard/errors page and embedded in API responses
 * via the `error_code` field.
 *
 * Every error in the v1 API returns:
 *   { "error": { "code": "...", "message": "...", "doc_url": "/dashboard/errors#code" } }
 */

export interface ErrorEntry {
  code: string;
  httpStatus: number;
  title: string;
  description: string;
  causes: string[];
  fixes: string[];
}

export const ERRORS_CATALOG: ErrorEntry[] = [
  {
    code: "validation_failed",
    httpStatus: 400,
    title: "Validation Failed",
    description: "The request body or parameters failed validation.",
    causes: [
      "Missing required field (email, code, password)",
      "Invalid email format",
      "OTP code is not exactly 6 digits",
      "Password is shorter than 8 characters",
    ],
    fixes: [
      "Check the `message` field for the specific field that failed",
      "Ensure email is a valid RFC 5322 address",
      "OTP codes must be exactly 6 numeric digits",
    ],
  },
  {
    code: "unauthorized",
    httpStatus: 401,
    title: "Unauthorized",
    description: "No valid API key was provided.",
    causes: [
      "Missing Authorization header",
      "API key has an invalid format (must start with mg_live_ or mg_test_)",
      "API key does not exist",
    ],
    fixes: [
      "Create an API key in the dashboard at /admin/api-keys",
      "Send it as: Authorization: Bearer mg_live_xxx",
    ],
  },
  {
    code: "key_revoked",
    httpStatus: 401,
    title: "API Key Revoked",
    description: "The API key has been revoked and can no longer be used.",
    causes: ["An admin revoked the key", "The key was rotated and the old one revoked"],
    fixes: ["Generate a new API key", "Update your application's environment variables"],
  },
  {
    code: "key_expired",
    httpStatus: 401,
    title: "API Key Expired",
    description: "The API key has passed its expiration date.",
    causes: ["The key was created with an expiry that has now passed"],
    fixes: ["Generate a new API key", "For long-lived keys, omit the expiration"],
  },
  {
    code: "insufficient_scope",
    httpStatus: 403,
    title: "Insufficient Scope",
    description: "The API key does not have permission for this action.",
    causes: ["A read-only key was used for a write operation", "The key's scopes don't include the required action"],
    fixes: ["Use a key with `full` scope or the specific required scope", "Update the key's scopes in the dashboard"],
  },
  {
    code: "rate_limited",
    httpStatus: 429,
    title: "Rate Limited",
    description: "Too many requests in the time window.",
    causes: ["Exceeded 3 OTP sends per email per minute", "Exceeded 10 OTP sends per email per hour", "Exceeded IP-level rate limit"],
    fixes: ["Wait for the Retry-After header duration before retrying", "Implement exponential backoff in your client"],
  },
  {
    code: "locked",
    httpStatus: 423,
    title: "Locked",
    description: "Too many failed verification attempts.",
    causes: ["5 incorrect OTP attempts on a single code", "10 cumulative failed verifies (brute-force lockout)"],
    fixes: ["Wait 15 minutes for the per-code lockout to expire", "Wait 30 minutes for the account lockout to expire", "An admin can manually unlock the account"],
  },
  {
    code: "code_mismatch",
    httpStatus: 400,
    title: "Code Mismatch",
    description: "The OTP code did not match the stored code.",
    causes: ["User typed the wrong code", "Code was for a different email or purpose"],
    fixes: ["Ask the user to re-enter the code", "Request a new code via the resend endpoint"],
  },
  {
    code: "expired",
    httpStatus: 410,
    title: "OTP Expired",
    description: "The OTP code has expired (10-minute TTL).",
    causes: ["More than 10 minutes passed since the code was issued"],
    fixes: ["Request a new code via POST /api/v1/otp/resend"],
  },
  {
    code: "already_used",
    httpStatus: 409,
    title: "OTP Already Used",
    description: "This OTP code has already been consumed (single-use).",
    causes: ["The code was already verified successfully", "A concurrent request consumed it first"],
    fixes: ["Request a new code if you need to verify again"],
  },
  {
    code: "disposable_email",
    httpStatus: 422,
    title: "Disposable Email Rejected",
    description: "The email domain is on the disposable-email blocklist.",
    causes: ["The domain (e.g. mailinator.com) is blocked"],
    fixes: ["Use a real email address", "An admin can allowlist a domain in the dashboard"],
  },
  {
    code: "ip_blocked",
    httpStatus: 403,
    title: "IP Blocked",
    description: "The client IP has been temporarily suspended.",
    causes: ["Too many rate-limit violations from this IP", "Admin manually blocked the IP"],
    fixes: ["Wait for the block to expire", "Contact support if you believe this is an error"],
  },
  {
    code: "not_found",
    httpStatus: 404,
    title: "Not Found",
    description: "The requested resource was not found.",
    causes: ["No active OTP found for this email", "Account does not exist"],
    fixes: ["Request a new OTP first", "Check the email address spelling"],
  },
  {
    code: "internal_error",
    httpStatus: 500,
    title: "Internal Server Error",
    description: "An unexpected error occurred.",
    causes: ["SMTP connection failure", "Database error", "Unexpected server bug"],
    fixes: ["Retry with exponential backoff", "Check server logs", "Contact support with the request ID"],
  },
];

export function findError(code: string): ErrorEntry | undefined {
  return ERRORS_CATALOG.find((e) => e.code === code);
}
