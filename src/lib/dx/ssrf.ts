/**
 * SSRF protection for webhook destinations (Phase 7, section 18).
 *
 * Webhook URLs are server-side outbound HTTP destinations. This module
 * validates that a URL is safe to fetch BEFORE any network call is made.
 *
 * Checks:
 *   - parse with URL
 *   - require HTTPS in production (HTTP allowed in dev for testing)
 *   - reject username/password credentials in URL
 *   - reject localhost, loopback, private, link-local, multicast, reserved
 *   - reject cloud metadata destinations (169.254.169.254, fd00:ec2::254)
 *   - DNS-resolve hostnames and validate ALL returned A/AAAA addresses
 *   - disable redirect following (redirect: "error")
 *
 * This is a security boundary — never bypass it.
 */
import { lookup } from "dns/promises";
import { isIP } from "net";

export type SsrfCheckResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

/**
 * Validate a webhook destination URL. Returns {ok: true} if safe, or
 * {ok: false, code, message} if the URL must be rejected.
 *
 * In production: requires HTTPS, rejects HTTP.
 * In development: allows HTTP for local testing (but still rejects private IPs).
 */
export async function validateWebhookDestination(
  urlString: string,
): Promise<SsrfCheckResult> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { ok: false, code: "invalid_url", message: "Invalid URL format." };
  }

  // Protocol check
  if (parsed.protocol !== "https:") {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, code: "http_not_allowed", message: "HTTPS is required in production." };
    }
    // Dev only: allow HTTP for local testing
    if (parsed.protocol !== "http:") {
      return { ok: false, code: "invalid_protocol", message: "Only HTTP/HTTPS protocols are allowed." };
    }
  }

  // Reject credentials in URL
  if (parsed.username || parsed.password) {
    return { ok: false, code: "credentials_in_url", message: "URL must not contain credentials." };
  }

  const rawHostname = parsed.hostname;

  // Reject localhost / bare hostnames that resolve to loopback
  if (rawHostname === "localhost" || rawHostname.endsWith(".localhost")) {
    return { ok: false, code: "ssrf_blocked", message: "Localhost destinations are not allowed." };
  }

  // Strip IPv6 brackets — new URL("[::1]") returns hostname="[::1]", but
  // net.isIP needs the bare form "::1" to recognize it as IPv6.
  const hostname = rawHostname.startsWith("[") && rawHostname.endsWith("]")
    ? rawHostname.slice(1, -1)
    : rawHostname;

  // Check if the hostname is an IP literal
  const ipVersion = isIP(hostname);
  if (ipVersion > 0) {
    // It's an IP — validate it directly
    const ipResult = isPublicIp(hostname);
    if (!ipResult.ok) return ipResult;
  } else {
    // It's a hostname — DNS-resolve and validate ALL returned addresses
    try {
      const addresses = await lookup(hostname, { all: true });
      if (addresses.length === 0) {
        return { ok: false, code: "dns_unresolved", message: "Hostname did not resolve to any address." };
      }
      for (const addr of addresses) {
        const ipResult = isPublicIp(addr.address);
        if (!ipResult.ok) return ipResult;
      }
    } catch {
      return { ok: false, code: "dns_error", message: "DNS resolution failed." };
    }
  }

  return { ok: true };
}

/**
 * Check if an IP address is a public, non-internal address.
 * Rejects: loopback, private, link-local, multicast, reserved, cloud metadata.
 */
function isPublicIp(ip: string): SsrfCheckResult {
  // Cloud metadata endpoints
  if (ip === "169.254.169.254" || ip === "fd00:ec2::254") {
    return { ok: false, code: "ssrf_blocked", message: "Cloud metadata destinations are not allowed." };
  }

  // IPv4 checks
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [_, a, b] = v4.map(Number) as number[];
    // 0.0.0.0/8 — "this network"
    if (a === 0) return ssrfBlocked();
    // 10.0.0.0/8 — private
    if (a === 10) return ssrfBlocked();
    // 127.0.0.0/8 — loopback
    if (a === 127) return ssrfBlocked();
    // 169.254.0.0/16 — link-local (includes 169.254.169.254 metadata)
    if (a === 169 && b === 254) return ssrfBlocked();
    // 172.16.0.0/12 — private
    if (a === 172 && b >= 16 && b <= 31) return ssrfBlocked();
    // 192.168.0.0/16 — private
    if (a === 192 && b === 168) return ssrfBlocked();
    // 224.0.0.0/4 — multicast
    if (a >= 224 && a <= 239) return ssrfBlocked();
    // 240.0.0.0/4 — reserved
    if (a >= 240) return ssrfBlocked();
    // 100.64.0.0/10 — CGNAT
    if (a === 100 && b >= 64 && b <= 127) return ssrfBlocked();
    return { ok: true };
  }

  // IPv6 checks
  if (ip.includes(":")) {
    const lower = ip.toLowerCase();
    // ::1 — loopback
    if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return ssrfBlocked();
    // fe80::/10 — link-local
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return ssrfBlocked();
    // fc00::/7 — unique local (private)
    if (lower.startsWith("fc") || lower.startsWith("fd")) return ssrfBlocked();
    // ff00::/8 — multicast
    if (lower.startsWith("ff")) return ssrfBlocked();
    // :: — unspecified
    if (lower === "::") return ssrfBlocked();
    return { ok: true };
  }

  return { ok: false, code: "ssrf_blocked", message: "Unrecognized address format." };
}

function ssrfBlocked(): SsrfCheckResult {
  return { ok: false, code: "ssrf_blocked", message: "Private/internal destinations are not allowed." };
}

/**
 * Fetch options for safe webhook delivery.
 * Disables redirect following — a 3xx response must NOT allow the server
 * to redirect into a private network.
 */
export const SAFE_FETCH_OPTIONS = {
  redirect: "error" as const,
  signal: AbortSignal.timeout(10_000), // 10s max (section 19)
};
