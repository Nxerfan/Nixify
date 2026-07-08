import { NextRequest } from "next/server";
import { apiError, ERROR_CODES } from "@/lib/api-response";
import {
  checkDisposableEmail,
  checkVpnProxy,
  enforceDeviceSendLimit,
  enforceIpSendLimit,
  fingerprintDevice,
  getClientIp,
  SECURITY_CONFIG,
  type SecurityDecision,
} from "@/lib/security";

/**
 * Shared pre-flight security gate for any route that issues an OTP
 * (signup / resend-otp / forgot-password).
 *
 * Runs every deterministic check in order of cheapest-first:
 *   1. IP block + IP send rate limit (§4)
 *   2. VPN / proxy / datacenter policy (§6)
 *   3. Disposable-email blocklist (§7)
 *   4. Device fingerprint send limit (§5)
 *
 * Returns null when allowed, or a NextResponse when the request must be
 * rejected. The caller returns the response directly.
 */
export async function preflightOtpSend(
  req: NextRequest,
  email: string,
): Promise<Response | null> {
  const ip = getClientIp(req);

  // §4 — IP block + rate limit
  const ipDecision = await enforceIpSendLimit(ip);
  if (!ipDecision.allowed) return decisionToResponse(ipDecision);

  // §6 — VPN / proxy
  const vpn = await checkVpnProxy(ip);
  if (vpn.decision) return decisionToResponse(vpn.decision);

  // §7 — Disposable email
  if (SECURITY_CONFIG.DISPOSABLE_ENABLED) {
    const disp = await checkDisposableEmail(email);
    if (disp.disposable) {
      return apiError(
        ERROR_CODES.DISPOSABLE_EMAIL,
        "Disposable email addresses are not allowed. Please use a real email.",
        422,
      );
    }
  }

  // §5 — Device fingerprint
  const fp = fingerprintDevice(req);
  const devDecision = await enforceDeviceSendLimit(fp, { email, ip });
  if (!devDecision.allowed) return decisionToResponse(devDecision);

  return null;
}

/**
 * Pre-flight for OTP VERIFY routes: IP block + IP verify rate limit.
 * (Disposable/VPN/device checks apply to sending, not verifying.)
 */
export async function preflightOtpVerify(req: NextRequest): Promise<Response | null> {
  const ip = getClientIp(req);
  const { enforceIpVerifyLimit } = await import("@/lib/security");
  const ipDecision = await enforceIpVerifyLimit(ip);
  if (!ipDecision.allowed) return decisionToResponse(ipDecision);
  return null;
}

function decisionToResponse(d: SecurityDecision): Response {
  if (d.allowed) return new Response(null, { status: 204 });
  const headers: Record<string, string> = {};
  if (d.retryAfterSeconds) headers["Retry-After"] = String(d.retryAfterSeconds);
  const code =
    d.code === "ip_blocked" ? ERROR_CODES.IP_BLOCKED :
    d.code === "ip_rate_limited" ? ERROR_CODES.RATE_LIMITED :
    d.code === "device_limit_exceeded" ? ERROR_CODES.DEVICE_LIMIT_EXCEEDED :
    d.code === "vpn_blocked" ? ERROR_CODES.VPN_BLOCKED :
    d.code === "account_locked" ? ERROR_CODES.ACCOUNT_LOCKED :
    ERROR_CODES.FORBIDDEN;
  return apiError(code, d.message, d.httpStatus);
}
