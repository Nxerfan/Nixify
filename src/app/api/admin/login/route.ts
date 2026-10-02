import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { z } from "zod";
import { signInAdmin, seedAdmin } from "@/lib/auth/admin";
import { rateLimit, type RateLimitResult } from "@/lib/ratelimit";
import { getClientIp } from "@/lib/security";
import { logger } from "@/lib/logger";
import { safeErrorRep } from "@/lib/log-sanitizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Admin login rate-limit policy (database-backed, deterministic).
 *
 * TWO independent buckets:
 *   1. Per IP — limits repeated admin-login attempts from one IP regardless of
 *      which email is tried. Prevents distributed password spraying.
 *   2. Per normalized email — limits repeated attempts against one admin
 *      identifier regardless of source IP. Prevents targeted brute-force
 *      against a known admin email.
 *
 * Both buckets are consumed BEFORE credential verification so a throttled
 * response never reveals whether the email exists or whether the password was
 * correct. The response is a generic 429 with a Retry-After header.
 *
 * Defaults: 10 attempts per 10 minutes per bucket. This is generous enough
 * that a legitimate operator who mis-types a few times is not locked out, but
 * tight enough to make automated brute-force impractical.
 */
const ADMIN_LOGIN_PER_IP = Number(process.env.ADMIN_LOGIN_PER_IP) || 10;
const ADMIN_LOGIN_PER_EMAIL = Number(process.env.ADMIN_LOGIN_PER_EMAIL) || 10;
const ADMIN_LOGIN_WINDOW_MS = Number(process.env.ADMIN_LOGIN_WINDOW_MS) || 10 * 60 * 1000; // 10 min

/** Check both buckets; returns the first failing result, or null if allowed. */
async function checkAdminLoginRateLimit(ip: string, normalizedEmail: string): Promise<RateLimitResult | null> {
  const perIp = await rateLimit(`admin_login_ip:${ip}`, ADMIN_LOGIN_PER_IP, ADMIN_LOGIN_WINDOW_MS);
  if (!perIp.allowed) return perIp;
  const perEmail = await rateLimit(`admin_login_email:${normalizedEmail}`, ADMIN_LOGIN_PER_EMAIL, ADMIN_LOGIN_WINDOW_MS);
  if (!perEmail.allowed) return perEmail;
  return null;
}

/** Generic throttled response — does NOT reveal whether the email exists. */
function throttledResponse(retryAfterSeconds: number) {
  const res = apiError(
    ERROR_CODES.RATE_LIMITED,
    "Too many admin login attempts. Please try again later.",
    429,
  );
  res.headers.set("Retry-After", String(retryAfterSeconds));
  return res;
}

/** POST /api/admin/login — admin login with brute-force protection. */
export async function POST(req: Request) {
  try {
    // 1. Parse + validate the request body FIRST. A malformed request must
    //    never trigger admin bootstrap/creation work.
    const [data, err] = await parseBody(req as any, schema);
    if (err) return err;

    // 2. Normalize email + resolve IP.
    const { email, password } = data;
    const normalizedEmail = email.toLowerCase().trim();
    const ip = getClientIp(req as any);

    // 3. Apply BOTH admin-login rate-limit buckets BEFORE any credential
    //    verification or bootstrap. A throttled request must never reveal
    //    whether the email exists, and must never trigger admin creation.
    const limited = await checkAdminLoginRateLimit(ip, normalizedEmail);
    if (limited) return throttledResponse(limited.retryAfterSeconds);

    // 4. Safe idempotent bootstrap — only runs for a valid, non-throttled
    //    request. seedAdmin() rejects placeholder/insecure config and throws
    //    a controlled failure if bootstrap config is present but unsafe.
    //    If the throw occurs, the catch block returns a generic 500.
    await seedAdmin();

    // 5. Verify credentials.
    const ok = await signInAdmin(normalizedEmail, password);
    if (!ok) {
      // Generic error for unknown email AND wrong password — no enumeration.
      return apiError(ERROR_CODES.INVALID_CREDENTIALS, "Invalid admin credentials.", 401);
    }
    return apiOk({ message: "Logged in as admin" });
  } catch (err) {
    // Safe logging: bounded safeErrorRep — never raw err.message, password,
    // ADMIN_PASSWORD, JWT, cookie, or credential-adjacent text.
    logger.error("admin_login_failed", {
      component: "auth",
      route: "/api/admin/login",
      error: safeErrorRep(err),
    });
    return apiError(ERROR_CODES.INTERNAL, "Something went wrong. Please try again.", 500);
  }
}
