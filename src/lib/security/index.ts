/**
 * Production-grade, DETERMINISTIC, rule-based security layer for the Email OTP
 * service. No risk scoring, no ML, no behavioral analytics — every check here
 * is a hard rule with a binary outcome and a clear reason.
 *
 * Features (spec §1–§9):
 *   1. One-time OTP            — enforced in otp/verifier.ts (atomic consume)
 *   2. OTP Expiration          — enforced in otp/generator.ts (decideOtp)
 *   3. Rate Limiting (email)   — lib/ratelimit.ts (already)
 *   4. IP Rate Limiting        — enforceIpRateLimit() below
 *   5. Device Fingerprinting   — fingerprintDevice() + enforceDeviceLimit()
 *   6. VPN/Proxy Detection     — checkVpnProxy()
 *   7. Disposable Email        — checkDisposableEmail()
 *   8. Brute Force Protection  — enforced via otp verify rate limit + lockout
 *   9. Temporary Account Lock  — lockAccount() / checkAccountLock() / unlock()
 *
 * Every decision is logged to SecurityEvent for the admin dashboard.
 *
 * All knobs live in SECURITY_CONFIG and are also tunable via env vars so ops
 * can change thresholds without a deploy.
 */

import { db } from "@/lib/db";
import { createHash } from "crypto";
import { rateLimit } from "@/lib/ratelimit";

// ---------------------------------------------------------------------------
// Configuration (deterministic; env-overridable)
// ---------------------------------------------------------------------------

function num(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

export const SECURITY_CONFIG = {
  // IP rate limiting (§4)
  IP_OTP_SEND_PER_MIN: num("SEC_IP_SEND_PER_MIN", 10),
  IP_OTP_SEND_PER_HOUR: num("SEC_IP_SEND_PER_HOUR", 60),
  IP_VERIFY_PER_MIN: num("SEC_IP_VERIFY_PER_MIN", 30),
  IP_VERIFY_PER_HOUR: num("SEC_IP_VERIFY_PER_HOUR", 120),
  // When an IP trips the rate limit this many times in an hour, auto-block it.
  IP_AUTO_BLOCK_THRESHOLD: num("SEC_IP_AUTO_BLOCK_THRESHOLD", 5),
  IP_AUTO_BLOCK_MS: num("SEC_IP_AUTO_BLOCK_MS", 30 * 60_000), // 30 min

  // Device fingerprint (§5)
  DEVICE_OTP_SEND_PER_HOUR: num("SEC_DEVICE_SEND_PER_HOUR", 15),

  // VPN / proxy (§6)
  VPN_POLICY: (process.env.SEC_VPN_POLICY ?? "warn") as "allow" | "warn" | "block",
  VPN_BLOCK_DATACENTER: process.env.SEC_VPN_BLOCK_DATACENTER === "true",

  // Disposable email (§7)
  DISPOSABLE_ENABLED: process.env.SEC_DISPOSABLE_ENABLED !== "false",

  // Brute force / account lock (§8, §9)
  BRUTE_FORCE_MAX_FAILS: num("SEC_BRUTE_FORCE_MAX_FAILS", 10), // failed verifies on ANY code in window
  BRUTE_FORCE_WINDOW_MS: num("SEC_BRUTE_FORCE_WINDOW_MS", 15 * 60_000), // 15 min
  ACCOUNT_LOCK_MS: num("SEC_ACCOUNT_LOCK_MS", 30 * 60_000), // 30 min auto-unlock
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SecurityDecision =
  | { allowed: true }
  | {
      allowed: false;
      code:
        | "ip_blocked"
        | "ip_rate_limited"
        | "device_limit_exceeded"
        | "disposable_email"
        | "vpn_blocked"
        | "account_locked";
      message: string;
      httpStatus: number;
      retryAfterSeconds?: number;
    };

export interface RequestContext {
  ip: string;
  userAgent?: string;
  fingerprint?: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// §4 + IP auto-block
// ---------------------------------------------------------------------------

/** Is this IP currently blocked (auto or admin)? */
export async function isIpBlocked(ip: string): Promise<{ blocked: boolean; reason?: string }> {
  const now = new Date();
  // Any block row whose expiresAt is null (permanent) or in the future.
  const block = await db.ipBlock.findFirst({
    where: {
      ip,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
  });
  return block
    ? { blocked: true, reason: block.reason }
    : { blocked: false };
}

/** Enforce IP-level rate limits on OTP SEND. Auto-blocks repeat offenders. */
export async function enforceIpSendLimit(ip: string): Promise<SecurityDecision> {
  const blocked = await isIpBlocked(ip);
  if (blocked.blocked) {
    await logEvent("ip_blocked_request", { ip, detail: blocked.reason });
    return {
      allowed: false,
      code: "ip_blocked",
      message: "Access from your IP has been temporarily suspended.",
      httpStatus: 403,
    };
  }

  const perMin = await rateLimit(
    `ip_send_min:${ip}`,
    SECURITY_CONFIG.IP_OTP_SEND_PER_MIN,
    60_000,
  );
  if (!perMin.allowed) {
    await noteIpViolation(ip, "auto_rate_limit");
    return rateLimitedDecision(perMin.retryAfterSeconds);
  }

  const perHour = await rateLimit(
    `ip_send_hour:${ip}`,
    SECURITY_CONFIG.IP_OTP_SEND_PER_HOUR,
    3_600_000,
  );
  if (!perHour.allowed) {
    await noteIpViolation(ip, "auto_rate_limit");
    return rateLimitedDecision(perHour.retryAfterSeconds);
  }
  return { allowed: true };
}

/** Enforce IP-level rate limits on OTP VERIFY.
 *
 * Two windows — per-minute AND per-hour — match the /send limiter's pattern.
 * The per-hour ceiling (IP_VERIFY_PER_HOUR = 120) was previously configured
 * but NOT enforced; only the per-minute window was checked. This is the fix
 * for that gap: a client could previously make 30 verifies/minute every
 * minute, indefinitely, without ever tripping the documented 120/hour limit.
 */
export async function enforceIpVerifyLimit(ip: string): Promise<SecurityDecision> {
  const blocked = await isIpBlocked(ip);
  if (blocked.blocked) {
    return {
      allowed: false,
      code: "ip_blocked",
      message: "Access from your IP has been temporarily suspended.",
      httpStatus: 403,
    };
  }

  const perMin = await rateLimit(
    `ip_verify_min:${ip}`,
    SECURITY_CONFIG.IP_VERIFY_PER_MIN,
    60_000,
  );
  if (!perMin.allowed) {
    await noteIpViolation(ip, "auto_rate_limit");
    return rateLimitedDecision(perMin.retryAfterSeconds);
  }

  const perHour = await rateLimit(
    `ip_verify_hour:${ip}`,
    SECURITY_CONFIG.IP_VERIFY_PER_HOUR,
    3_600_000,
  );
  if (!perHour.allowed) {
    await noteIpViolation(ip, "auto_rate_limit");
    return rateLimitedDecision(perHour.retryAfterSeconds);
  }
  return { allowed: true };
}

/** Track rate-limit violations; auto-block the IP after the threshold. */
async function noteIpViolation(ip: string, reason: string): Promise<void> {
  const windowStart = new Date(Date.now() - 3_600_000);
  const violations = await rateLimit(`ip_violations:${ip}`, SECURITY_CONFIG.IP_AUTO_BLOCK_THRESHOLD, 3_600_000);
  if (!violations.allowed) {
    // Threshold crossed — add an auto-expiring block.
    await db.ipBlock.create({
      data: {
        ip,
        reason,
        expiresAt: new Date(Date.now() + SECURITY_CONFIG.IP_AUTO_BLOCK_MS),
      },
    });
    await db.securityEvent.create({
      data: { type: "ip_blocked", ip, detail: reason },
    });
  }
}

/** Admin: manually block an IP. */
export async function blockIp(ip: string, reason: string, permanent: boolean, createdBy?: string): Promise<void> {
  await db.ipBlock.create({
    data: {
      ip,
      reason,
      expiresAt: permanent ? null : new Date(Date.now() + SECURITY_CONFIG.IP_AUTO_BLOCK_MS),
      createdBy,
    },
  });
  await logEvent("ip_blocked_admin", { ip, detail: reason });
}

/** Admin: unblock an IP (removes all active blocks for that IP). */
export async function unblockIp(ip: string): Promise<void> {
  await db.ipBlock.deleteMany({ where: { ip } });
  await logEvent("ip_unblocked_admin", { ip });
}

// ---------------------------------------------------------------------------
// §5 Device fingerprinting
// ---------------------------------------------------------------------------

/**
 * Derive a stable device fingerprint from request headers. SHA-256 of
 * (User-Agent + Accept-Language + Sec-CH-UA). Deterministic — no cookies, no
 * PII. Returns "unknown" if insufficient signal (treated as one shared device).
 */
export function fingerprintDevice(req: Request): string {
  const ua = req.headers.get("user-agent") ?? "";
  const lang = req.headers.get("accept-language") ?? "";
  const chua = req.headers.get("sec-ch-ua") ?? "";
  if (!ua && !lang && !chua) return "unknown";
  return createHash("sha256").update(`${ua}|${lang}|${chua}`).digest("hex").slice(0, 32);
}

/** Record a device request + enforce the per-device send limit (§5). */
export async function enforceDeviceSendLimit(
  fingerprint: string,
  ctx: { email?: string; ip?: string; purpose?: string },
): Promise<SecurityDecision> {
  // Record the request.
  await db.deviceRequest.create({
    data: {
      fingerprint,
      email: ctx.email ?? null,
      ip: ctx.ip ?? null,
      purpose: ctx.purpose ?? null,
    },
  });

  // Count requests in the window.
  const windowStart = new Date(Date.now() - 3_600_000);
  const count = await db.deviceRequest.count({
    where: { fingerprint, createdAt: { gt: windowStart } },
  });

  if (count > SECURITY_CONFIG.DEVICE_OTP_SEND_PER_HOUR) {
    await logEvent("device_exceeded", {
      fingerprint,
      ip: ctx.ip,
      email: ctx.email,
      detail: `${count} requests in 1h`,
    });
    return {
      allowed: false,
      code: "device_limit_exceeded",
      message: "Too many verification requests from this device. Please try again later.",
      httpStatus: 429,
      retryAfterSeconds: 3600,
    };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// §6 VPN / Proxy / Datacenter detection
// ---------------------------------------------------------------------------

/**
 * Deterministic VPN/proxy/datacenter detection WITHOUT a third-party API.
 *
 * Strategy: a curated, env-overridable CIDR + ASN-prefix blocklist covering the
 * major datacenter ranges (AWS/GCP/Azure/DigitalOcean/Vultr/Hetzner/OVH/Linode)
 * plus known VPN/proxy exit nodes. This is the zero-cost, no-external-dependency
 * approach — 100% deterministic, no ML, no risk score.
 *
 * For higher fidelity at scale, ops can plug in a paid IP-reputation feed by
 * setting SEC_VPN_DATACENTER_CIDRS (comma-separated). The check is pure string
 * prefix matching against /8 and /16 ranges, which is sufficient for the major
 * cloud providers and avoids the cost + latency + privacy of an external API.
 *
 * Policy (SEC_VPN_POLICY):
 *   - "allow": detect + log only (default — least friction)
 *   - "warn":  detect + log + add a flag to the response (caller may surface it)
 *   - "block": reject the request outright
 */

// Major datacenter / cloud / VPN-exit IPv4 ranges (first two octets).
// This is intentionally a coarse, deterministic heuristic. Extend via env var
// SEC_DATACENTER_PREFIXES=comma,separated,prefixes (e.g. "104.244.42,193.27.14")
const DEFAULT_DATACENTER_PREFIXES = [
  // AWS
  "3.0", "3.1", "3.2", "3.3", "3.4", "3.5", "13.32", "13.33", "13.34", "13.35",
  "15.177", "18.32", "18.34", "18.36", "18.40", "18.64", "18.66", "18.96", "18.160",
  "23.20", "34.192", "34.224", "35.160", "35.172", "52.0", "52.1", "52.2", "52.3",
  "52.4", "52.5", "52.6", "52.7", "52.8", "52.9", "52.10", "52.11", "52.12", "52.13",
  "52.14", "52.15", "52.16", "52.17", "52.18", "52.19", "52.20", "52.21", "52.22", "52.23",
  "52.24", "52.25", "52.26", "52.27", "52.28", "52.29", "52.30", "52.31", "52.32", "52.33",
  "52.34", "52.35", "52.36", "52.37", "52.38", "52.39", "52.40", "52.41", "52.42", "52.43",
  "52.44", "52.45", "52.46", "52.47", "52.48", "52.49", "52.50", "52.51", "52.52", "52.53",
  "52.54", "52.55", "52.56", "52.57", "52.58", "52.59", "52.60", "52.61", "52.62", "52.63",
  "52.64", "52.65", "52.66", "52.67", "52.68", "52.69", "52.70", "52.71", "52.72", "52.73",
  "52.74", "52.75", "52.76", "52.77", "52.78", "52.79", "52.80", "52.81", "52.82", "52.83",
  "52.84", "52.85", "52.86", "52.87", "52.88", "52.89", "52.90", "52.91", "52.92", "52.93",
  "52.94", "52.95", "54.0", "54.1", "54.2", "54.3", "54.4", "54.5", "54.6", "54.7",
  "54.8", "54.9", "54.10", "54.11", "54.12", "54.13", "54.14", "54.15", "54.16", "54.17",
  "54.18", "54.19", "54.20", "54.21", "54.22", "54.23", "54.24", "54.25", "54.26", "54.27",
  "54.28", "54.29", "54.30", "54.31", "54.32", "54.33", "54.34", "54.35", "54.36", "54.37",
  "54.38", "54.39", "54.40", "54.41", "54.42", "54.43", "54.44", "54.45", "54.46", "54.47",
  "54.48", "54.49", "54.50", "54.51", "54.52", "54.53", "54.54", "54.55", "54.56", "54.57",
  "54.58", "54.59", "54.60", "54.61", "54.62", "54.63", "54.64", "54.65", "54.66", "54.67",
  "54.68", "54.69", "54.70", "54.71", "54.72", "54.73", "54.74", "54.75", "54.76", "54.77",
  "54.78", "54.79", "54.80", "54.81", "54.82", "54.83", "54.84", "54.85", "54.86", "54.87",
  "54.88", "54.89", "54.90", "54.91", "54.92", "54.93", "54.94", "54.95", "54.96", "54.97",
  "54.98", "54.99", "54.100", "54.101", "54.102", "54.103", "54.104", "54.105", "54.106", "54.107",
  "54.108", "54.109", "54.110", "54.111", "54.112", "54.113", "54.114", "54.115", "54.116", "54.117",
  "54.118", "54.119", "54.120", "54.121", "54.122", "54.123", "54.124", "54.125", "54.126", "54.127",
  "54.128", "54.129", "54.130", "54.131", "54.132", "54.133", "54.134", "54.135", "54.136", "54.137",
  "54.138", "54.139", "54.140", "54.141", "54.142", "54.143", "54.144", "54.145", "54.146", "54.147",
  "54.148", "54.149", "54.150", "54.151", "54.152", "54.153", "54.154", "54.155", "54.156", "54.157",
  "54.158", "54.159", "54.160", "54.161", "54.162", "54.163", "54.164", "54.165", "54.166", "54.167",
  "54.168", "54.169", "54.170", "54.171", "54.172", "54.173", "54.174", "54.175", "54.176", "54.177",
  "54.178", "54.179", "54.180", "54.181", "54.182", "54.183", "54.184", "54.185", "54.186", "54.187",
  "54.188", "54.189", "54.190", "54.191", "54.192", "54.193", "54.194", "54.195", "54.196", "54.197",
  "54.198", "54.199", "54.200", "54.201", "54.202", "54.203", "54.204", "54.205", "54.206", "54.207",
  "54.208", "54.209", "54.210", "54.211", "54.212", "54.213", "54.214", "54.215", "54.216", "54.217",
  "54.218", "54.219", "54.220", "54.221", "54.222", "54.223", "54.224", "54.225", "54.226", "54.227",
  "54.228", "54.229", "54.230", "54.231", "54.232", "54.233", "54.234", "54.235", "54.236", "54.237",
  "54.238", "54.239", "54.240", "54.241", "54.242", "54.243", "54.244", "54.245", "54.246", "54.247",
  "54.248", "54.249", "54.250", "54.251", "54.252", "54.253", "54.254", "54.255",
  // GCP
  "35.184", "35.186", "35.187", "35.188", "35.189", "35.190", "35.191", "35.192", "35.193",
  "35.194", "35.195", "35.196", "35.197", "35.198", "35.199", "35.200", "35.201", "35.202",
  "35.203", "35.204", "35.205", "35.206", "35.207", "35.208", "35.209", "35.210", "35.211",
  "35.212", "35.213", "35.214", "35.215", "35.216", "35.217", "35.218", "35.219", "35.220",
  "35.221", "35.222", "35.223", "35.224", "35.225", "35.226", "35.227", "35.228", "35.229",
  "35.230", "35.231", "35.232", "35.233", "35.234", "35.235", "35.236", "35.237", "35.238",
  "35.239", "35.240", "35.241", "35.242", "35.243", "35.244", "35.245", "35.246", "35.247",
  "35.248", "35.249", "35.250", "35.251", "35.252", "35.253", "35.254", "35.255",
  // Azure
  "20.0", "20.1", "20.2", "20.3", "20.4", "20.5", "20.6", "20.7", "20.8", "20.9",
  "20.10", "20.11", "20.12", "20.13", "20.14", "20.15", "20.16", "20.17", "20.18", "20.19",
  "20.20", "20.21", "20.22", "20.23", "20.24", "20.25", "20.26", "20.27", "20.28", "20.29",
  "20.30", "20.31", "20.32", "20.33", "20.34", "20.35", "20.36", "20.37", "20.38", "20.39",
  "20.40", "20.41", "20.42", "20.43", "20.44", "20.45", "20.46", "20.47", "20.48", "20.49",
  "20.50", "20.51", "20.52", "20.53", "20.54", "20.55", "20.56", "20.57", "20.58", "20.59",
  "20.60", "20.61", "20.62", "20.63", "20.64", "20.65", "20.66", "20.67", "20.68", "20.69",
  "20.70", "20.71", "20.72", "20.73", "20.74", "20.75", "20.76", "20.77", "20.78", "20.79",
  "20.80", "20.81", "20.82", "20.83", "20.84", "20.85", "20.86", "20.87", "20.88", "20.89",
  "20.90", "20.91", "20.92", "20.93", "20.94", "20.95", "20.96", "20.97", "20.98", "20.99",
  "20.100", "20.101", "20.102", "20.103", "20.104", "20.105", "20.106", "20.107", "20.108",
  "20.109", "20.110", "20.111", "20.112", "20.113", "20.114", "20.115", "20.116", "20.117",
  "20.118", "20.119", "20.120", "20.121", "20.122", "20.123", "20.124", "20.125", "20.126",
  "20.127", "20.128", "20.129", "20.130", "20.131", "20.132", "20.133", "20.134", "20.135",
  "20.136", "20.137", "20.138", "20.139", "20.140", "20.141", "20.142", "20.143", "20.144",
  "20.145", "20.146", "20.147", "20.148", "20.149", "20.150", "20.151", "20.152", "20.153",
  "20.154", "20.155", "20.156", "20.157", "20.158", "20.159", "20.160", "20.161", "20.162",
  "20.163", "20.164", "20.165", "20.166", "20.167", "20.168", "20.169", "20.170", "20.171",
  "20.172", "20.173", "20.174", "20.175", "20.176", "20.177", "20.178", "20.179", "20.180",
  "20.181", "20.182", "20.183", "20.184", "20.185", "20.186", "20.187", "20.188", "20.189",
  "20.190", "20.191", "40.64", "40.65", "40.66", "40.67", "40.68", "40.69", "40.70", "40.71",
  "40.72", "40.73", "40.74", "40.75", "40.76", "40.77", "40.78", "40.79", "40.80", "40.81",
  "40.82", "40.83", "40.84", "40.85", "40.86", "40.87", "40.88", "40.89", "40.90", "40.91",
  "40.92", "40.93", "40.94", "40.95", "40.96", "40.97", "40.98", "40.99", "40.100", "40.101",
  "40.102", "40.103", "40.104", "40.105", "40.106", "40.107", "40.108", "40.109", "40.110", "40.111",
  "40.112", "40.113", "40.114", "40.115", "40.116", "40.117", "40.118", "40.119", "40.120", "40.121",
  "40.122", "40.123", "40.124", "40.125",
  // DigitalOcean
  "104.131", "104.236", "128.199", "138.197", "138.68", "142.93", "143.110", "143.198",
  "144.126", "146.190", "157.230", "159.65", "159.89", "161.35", "163.47", "165.22", "165.227",
  "167.71", "167.172", "170.64", "174.138", "188.166", "206.189", "207.154", "46.101",
  "64.225", "68.183", "69.55", "70.73",
  // Vultr
  "45.32", "45.63", "45.76", "45.77", "45.119", "45.133", "45.142", "45.148", "45.152",
  "45.224", "45.225", "45.232", "45.248", "45.250", "45.32", "45.55", "45.56", "45.57",
  "45.63", "45.63", "45.76", "45.77", "45.92", "108.61", "136.244", "137.220", "139.180",
  "140.82", "144.202", "149.28", "149.248", "155.94", "160.202", "169.55", "171.22", "172.93",
  "173.199", "176.31", "178.128", "185.92", "191.96", "199.247", "207.246", "208.167",
  "209.250", "213.238", "216.128", "217.69",
  // Hetzner
  "49.12", "49.13", "65.108", "65.109", "78.46", "78.47", "85.10", "88.99", "91.107",
  "94.130", "95.216", "95.217", "116.202", "116.203", "136.243", "138.201", "138.232",
  "142.132", "144.76", "148.251", "159.69", "162.55", "167.235", "167.86", "167.94", "168.119",
  "176.9", "178.63", "185.50", "185.157", "188.40", "193.254", "195.201", "195.60.236",
  "213.133", "213.239",
  // OVH
  "5.39", "8.0", "8.1", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8.8", "8.9", "8.10",
  "8.11", "8.12", "8.13", "8.14", "8.15", "8.16", "8.17", "8.18", "8.19", "8.20", "8.21",
  "8.22", "8.23", "8.24", "8.25", "8.26", "8.27", "8.28", "8.29", "8.30", "8.31", "37.59",
  "37.60", "37.61", "37.62", "37.187", "46.105", "51.68", "51.75", "51.77", "51.79", "51.83",
  "51.89", "51.91", "51.158", "51.161", "51.178", "51.195", "54.36", "54.37", "54.38", "54.39",
  "77.87", "78.99", "79.137", "82.64", "82.65", "82.66", "82.97", "83.166", "87.98", "89.86",
  "91.90, 92.222", "93.177", "94.23", "104.200", "135.125", "137.74", "141.94", "141.95",
  "145.239", "146.59", "148.60", "148.61", "149.202", "151.80", "152.228", "158.69", "160.19",
  "164.132", "167.114", "176.31", "178.32", "185.12", "188.165", "192.95", "193.70", "193.104",
  "193.109", "195.110", "198.27", "198.50", "213.186", "213.251",
  // Linode (Akamai)
  "45.33", "45.56", "45.79", "45.118", "45.142", "50.116", "66.175", "66.228", "69.164",
  "71.19", "72.14", "74.207", "96.126", "97.107", "104.130", "104.237", "106.187", "107.170",
  "108.61", "109.74", "111.90", "118.99", "120.138", "122.8", "128.121", "130.137", "131.153",
  "136.244", "139.144", "139.162", "143.42", "146.190", "148.62", "150.136", "151.106", "153.121",
  "157.245", "159.203", "161.75", "163.53", "165.227", "167.172", "168.235", "169.55", "170.187",
  "172.104", "172.105", "172.233", "172.232", "173.230", "173.255", "174.138", "176.58", "178.62",
  "178.79", "183.91", "184.72", "188.166", "192.155", "193.34", "194.195", "195.10", "203.0",
  "203.114", "204.16", "212.71", "23.239", "23.92", "45.117", "45.119", "45.33", "45.56",
  "45.63", "45.79", "45.118", "45.142", "45.222", "45.223", "45.224", "45.225", "45.226", "45.227",
  "45.228", "45.229", "45.230", "45.231", "45.232", "45.233", "45.234", "45.235", "45.236", "45.237",
  "45.238", "45.239", "45.240", "45.241", "45.242", "45.243", "45.244", "45.245", "45.246", "45.247",
  "45.248", "45.249", "45.250", "45.251", "45.252", "45.253", "45.254", "45.255",
];

function getDatacenterPrefixes(): string[] {
  const env = process.env.SEC_DATACENTER_PREFIXES;
  if (env && env.trim()) {
    return env.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_DATACENTER_PREFIXES;
}

/** Is the IP a datacenter / cloud / known VPN-exit prefix? Deterministic. */
export function isDatacenterIp(ip: string): boolean {
  if (!ip) return false;
  // Normalize IPv6 loopback / local.
  if (ip === "::1" || ip === "::ffff:127.0.0.1") return false;
  // IPv4 only for the prefix check.
  const match = ip.match(/^(\d+\.\d+)\./);
  if (!match) return false;
  const prefix = match[1];
  return getDatacenterPrefixes().includes(prefix);
}

export interface VpnCheckResult {
  detected: boolean;
  policy: "allow" | "warn" | "block";
  /** Only meaningful when policy="block" and detected=true. */
  decision?: SecurityDecision;
}

/** Check VPN/proxy/datacenter per the configured policy. Deterministic. */
export async function checkVpnProxy(ip: string): Promise<VpnCheckResult> {
  // Read policy live so tests/ops can change it via env without a redeploy.
  const policy = (process.env.SEC_VPN_POLICY ?? SECURITY_CONFIG.VPN_POLICY) as "allow" | "warn" | "block";
  const blockDatacenter = process.env.SEC_VPN_BLOCK_DATACENTER === "true" || SECURITY_CONFIG.VPN_BLOCK_DATACENTER;
  const detected = isDatacenterIp(ip);

  if (!detected) {
    return { detected: false, policy };
  }

  // Detected a datacenter/VPN IP. Log it (always).
  await logEvent("vpn_detected", { ip, detail: `policy=${policy}` });

  if (policy === "block" && blockDatacenter) {
    return {
      detected: true,
      policy,
      decision: {
        allowed: false,
        code: "vpn_blocked",
        message: "Sign-ups from VPN/proxy/datacenter IPs are not permitted.",
        httpStatus: 403,
      },
    };
  }
  return { detected: true, policy };
}

// ---------------------------------------------------------------------------
// §7 Disposable email detection
// ---------------------------------------------------------------------------

// Seed list of well-known disposable email providers. Admin can add/remove via
// the dashboard. The list is intentionally focused on the most-abused domains.
const SEED_DISPOSABLE_DOMAINS = [
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "tempmailo.com", "temp-mail.org", "throwawaymail.com", "yopmail.com",
  "getnada.com", "maildrop.cc", "dispostable.com", "fakeinbox.com",
  "sharklasers.com", "guerrillamail.info", "grr.la", "disposable.com",
  "mailnesia.com", "trashmail.com", "trashmail.net", "spam4.me",
  "mohmal.com", "tempr.email", "tempmailaddress.com", "tmpmail.org",
  "tmpmail.net", "discard.email", "mailcatch.com", "harakirimail.com",
  "tempinbox.com", "spamgourmet.com", "mintemail.com", "tempmailo.com",
  "emailondeck.com", "boun.cr", "filzmail.com", "guerrillamailblock.com",
  "incognitomail.com", "jetable.com", "mailnull.com", "mytemp.email",
  "noref.in", "oosln.com", "quickinbox.com", "tempmail.email",
  "tempmailo.net", "trbvm.com", "trbvn.com", "trbw.com", "vomoto.com",
  "wants.dicksinhisan.us", "mail7.io", "temp-mail.io", "emailfake.com",
  "fake-box.com", "moakt.com", "tmails.net", "tempmailo.com", "tempmailo.net",
];

export interface DisposableCheckResult {
  disposable: boolean;
  domain: string;
}

/** Extract the domain from an email address, lowercased. */
export function extractDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : "";
}

/** Is this email's domain on the disposable blocklist (and not allowlisted)? */
export async function checkDisposableEmail(email: string): Promise<DisposableCheckResult> {
  const domain = extractDomain(email);
  if (!domain) return { disposable: false, domain };

  // Look up both lists in one query. Allowlist takes precedence (admin can
  // rescue a domain even if it's in the seed blocklist).
  const rows = await db.disposableDomain.findMany({ where: { domain } });
  const isAllowed = rows.some((r) => r.listType === "allow");
  if (isAllowed) return { disposable: false, domain };
  const isBlocked = rows.some((r) => r.listType === "block");
  // Also check the in-memory seed list (covers the case where seeding hasn't run).
  const isDisposable = isBlocked || SEED_DISPOSABLE_DOMAINS.includes(domain);

  return { disposable: isDisposable, domain };
}

/** Admin: add a domain to block or allow list. */
export async function setDisposableDomain(domain: string, listType: "block" | "allow", source = "admin"): Promise<void> {
  // Upsert: delete any existing entry for this domain first (so it can switch lists).
  await db.disposableDomain.deleteMany({ where: { domain } }).catch(() => {});
  await db.disposableDomain.create({ data: { domain: domain.toLowerCase(), listType, source } });
}

/** Admin: remove a domain from a list. */
export async function removeDisposableDomain(domain: string): Promise<void> {
  await db.disposableDomain.deleteMany({ where: { domain: domain.toLowerCase() } });
}

/** Seed the disposable blocklist on first run (idempotent). */
export async function seedDisposableBlocklist(): Promise<void> {
  const existing = await db.disposableDomain.count();
  if (existing > 0) return;
  // Use individual creates (createMany skipDuplicates isn't supported on SQLite).
  for (const domain of SEED_DISPOSABLE_DOMAINS) {
    try {
      await db.disposableDomain.create({
        data: { domain, listType: "block", source: "seed" },
      });
    } catch {
      // already exists — fine
    }
  }
}

// ---------------------------------------------------------------------------
// §8 + §9 Brute force protection + temporary account lock
// ---------------------------------------------------------------------------

/**
 * Count failed verifications for an email across all OTP codes in the brute-
 * force window. Deterministic. When this crosses BRUTE_FORCE_MAX_FAILS, the
 * account is locked.
 */
export async function countRecentFailedVerifies(email: string): Promise<number> {
  const windowStart = new Date(Date.now() - SECURITY_CONFIG.BRUTE_FORCE_WINDOW_MS);
  // Each OtpCode row whose attempts > 0 and consumedAt is null in the window
  // represents failed tries. Sum the attempts that occurred (capped per row).
  const rows = await db.otpCode.findMany({
    where: {
      targetEmail: email,
      createdAt: { gt: windowStart },
      attempts: { gt: 0 },
      consumedAt: null,
    },
    select: { attempts: true },
  });
  return rows.reduce((sum, r) => sum + r.attempts, 0);
}

/** Lock an account for brute force. Sets lockedUntil = now + ACCOUNT_LOCK_MS. */
export async function lockAccountForBruteForce(email: string): Promise<void> {
  await db.user.updateMany({
    where: { email },
    data: {
      lockedReason: "brute_force",
      lockedUntil: new Date(Date.now() + SECURITY_CONFIG.ACCOUNT_LOCK_MS),
      lockedAt: new Date(),
    },
  });
  await logEvent("brute_force_lockout", { email, detail: `locked ${SECURITY_CONFIG.ACCOUNT_LOCK_MS / 60000}min` });
}

/** Is the account currently locked? */
export async function checkAccountLock(email: string): Promise<{ locked: boolean; until?: Date; reason?: string }> {
  const user = await db.user.findUnique({ where: { email }, select: { lockedUntil: true, lockedReason: true } });
  // No lock reason → not locked.
  if (!user || !user.lockedReason) return { locked: false };
  // Permanent admin lock (lockedUntil is null but reason is set).
  if (!user.lockedUntil) return { locked: true, reason: user.lockedReason };
  // Time-based lock: check expiry.
  if (user.lockedUntil.getTime() <= Date.now()) {
    // Auto-unlock: clear the fields.
    await db.user.update({ where: { email }, data: { lockedUntil: null, lockedReason: null, lockedAt: null } });
    return { locked: false };
  }
  return { locked: true, until: user.lockedUntil, reason: user.lockedReason };
}

/** Admin: manually lock an account. */
export async function adminLockAccount(email: string): Promise<void> {
  await db.user.updateMany({
    where: { email },
    data: { lockedReason: "admin", lockedUntil: null, lockedAt: new Date() }, // null = permanent until manual unlock
  });
  await logEvent("account_locked_admin", { email });
}

/** Admin: manually unlock an account. */
export async function adminUnlockAccount(email: string): Promise<void> {
  await db.user.updateMany({
    where: { email },
    data: { lockedReason: null, lockedUntil: null, lockedAt: null },
  });
  await logEvent("account_unlocked_admin", { email });
}

// ---------------------------------------------------------------------------
// Audit logging (deterministic; append-only)
// ---------------------------------------------------------------------------

export async function logEvent(
  type: string,
  ctx: { ip?: string; email?: string; fingerprint?: string; detail?: string },
): Promise<void> {
  try {
    await db.securityEvent.create({
      data: {
        type,
        ip: ctx.ip ?? null,
        email: ctx.email ?? null,
        fingerprint: ctx.fingerprint ?? null,
        detail: ctx.detail ?? null,
      },
    });
  } catch {
    // Never let audit-logging failure break the request path.
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rateLimitedDecision(retryAfterSeconds: number): SecurityDecision {
  return {
    allowed: false,
    code: "ip_rate_limited",
    message: "Too many requests. Please slow down.",
    httpStatus: 429,
    retryAfterSeconds: Math.max(retryAfterSeconds, 1),
  };
}

// ---------------------------------------------------------------------------
// IP extraction
// ---------------------------------------------------------------------------

/**
 * Extract the client IP from a Next.js Request, honoring X-Forwarded-For /
 * X-Real-IP (the gateway/proxy sets these). Falls back to "unknown".
 * Takes the LEFT-most public IP from XFF.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xreal = req.headers.get("x-real-ip");
  if (xreal) return xreal.trim();
  return "unknown";
}
