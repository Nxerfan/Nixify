/**
 * Sandbox mode — lets developers test the full OTP flow without sending real
 * emails or consuming real quotas.
 *
 * In sandbox:
 *  - OTPs are generated, HMAC-hashed, and stored exactly as in production, but
 *    the "send" step returns the code in the API response (only in dev/test
 *    keys) instead of (or in addition to) emailing it.
 *  - Developers can force simulated errors via headers:
 *      X-Sandbox-Simulate: rate_limited | locked | expired | mismatch | smtp_error
 *  - No real SMTP connection is made.
 *
 * This is a DEV-only feature gated by the API key environment (mg_test_*).
 * Production keys (mg_live_*) cannot use sandbox mode.
 */

export type SandboxSimulation =
  | "rate_limited"
  | "locked"
  | "expired"
  | "mismatch"
  | "smtp_error"
  | "none";

/** Read the X-Sandbox-Simulate header. Only honored for test-environment keys. */
export function getSandboxSimulation(req: Request): SandboxSimulation {
  const h = req.headers.get("x-sandbox-simulate");
  if (!h) return "none";
  const valid: SandboxSimulation[] = ["rate_limited", "locked", "expired", "mismatch", "smtp_error"];
  return (valid as string[]).includes(h) ? (h as SandboxSimulation) : "none";
}

export interface SandboxSendResult {
  /** Whether to proceed with real sending (false in sandbox). */
  skipRealSend: boolean;
  /** The plaintext code — returned to the caller ONLY in sandbox. */
  code: string;
  /** A forced error to simulate, if any. */
  simulate: SandboxSimulation;
}

/** In sandbox, the OTP is generated but NOT emailed — it's returned in the response. */
export const SANDBOX_OTP_RETURNED = true;
