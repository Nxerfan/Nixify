import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { verifyApiKey, hasScope, newRequestId, type VerifiedKey } from "./api-keys";

/**
 * v1 API request context — handles API key auth, request ID generation, and
 * request logging. Every v1 route handler wraps its logic in `withApiKey()`.
 */

export interface ApiContext {
  requestId: string;
  apiKey: VerifiedKey;
  ip: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // epoch seconds
}

/**
 * Security bucket selector (Phase 4, section 19).
 *
 *   - "otp_send"   → per-IP OTP send limiter (legacy default for non-otp:verify scopes)
 *   - "otp_verify" → per-IP OTP verify limiter (used by otp:verify routes)
 *   - "generic"    → IP-block check only, NO OTP-specific per-email/IP send limiter
 *
 * Existing OTP routes pass either "otp_send" or "otp_verify" (or rely on the
 * legacy default which treated any non-otp:verify scope as otp_send). Messaging
 * routes pass "generic" so they don't accidentally hit the OTP send limiter.
 *
 * BACKWARD COMPATIBILITY: when `opts` is omitted, the legacy behavior is
 * preserved exactly — `requiredScope === "otp:verify"` uses the verify limiter,
 * everything else uses the send limiter. This means no existing call site
 * changes behavior.
 */
type SecurityBucket = "otp_send" | "otp_verify" | "generic";

/** Extract the bearer token from the Authorization header. */
export function extractBearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export function getClientIpV1(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Wraps a v1 route handler with API key auth + request ID + request logging.
 * Returns a NextResponse (error) if auth fails, or calls the handler with the
 * verified context.
 *
 * `opts.securityBucket` (Phase 4) controls which per-IP rate limiter applies.
 * Defaults to legacy behavior (otp:verify → verify limiter; else send limiter)
 * so existing call sites are unchanged. Messaging routes pass "generic".
 */
export function withApiKey(
  requiredScope: string,
  handler: (ctx: ApiContext, req: NextRequest) => Promise<NextResponse>,
  opts?: { securityBucket?: SecurityBucket },
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const start = Date.now();
    const requestId = newRequestId();
    const ip = getClientIpV1(req);

    // Auth.
    const token = extractBearer(req);
    if (!token) {
      return errorResponse(requestId, 401, "unauthorized", "Missing Authorization header. Use: Bearer mg_live_xxx", req);
    }
    const apiKey = await verifyApiKey(token, ip);
    if (!apiKey.ok) {
      const code = apiKey.reason === "revoked" ? "key_revoked" : apiKey.reason === "expired" ? "key_expired" : "unauthorized";
      const msg = apiKey.reason === "revoked" ? "API key has been revoked." : apiKey.reason === "expired" ? "API key has expired." : "Invalid API key.";
      return errorResponse(requestId, 401, code, msg, req, apiKey.keyId);
    }

    // Scope check.
    if (!hasScope(apiKey.scopes!, requiredScope)) {
      return errorResponse(requestId, 403, "insufficient_scope", `This action requires the '${requiredScope}' scope.`, req, apiKey.keyId);
    }

    // Entitlement check — verify the API key owner's plan allows this request.
    // Uses the entitlement engine to check both access and volume quota.
    // When the key has no owning user (system/dev key, userId=null) we SKIP the
    // entitlement check — these keys are admin-managed and not bound to a plan.
    // (Resolving a plan would require a fallback user; using MAX by default
    // would silently grant unlimited quota to system keys, which is unsafe.)
    const { checkUsage } = await import("@/lib/entitlements/engine");
    const { FEATURE_KEYS } = await import("@/lib/entitlements/config");
    let entitlement: {
      allowed: boolean;
      remaining?: number | "unlimited";
      resetAt?: Date | null;
      reason?: string;
    };
    if (apiKey.userId) {
      entitlement = await checkUsage(apiKey.userId, FEATURE_KEYS.API_MESSAGES);
    } else {
      // System key (no owner) — allow, but flag as unlimited so we don't lie in headers.
      entitlement = { allowed: true, remaining: "unlimited", resetAt: null };
    }
    if (!entitlement.allowed) {
      const status = entitlement.reason === "rate_limited" ? 429 : 402;
      const code = entitlement.reason === "rate_limited" ? "rate_limited"
        : entitlement.reason === "quota_exhausted" ? "quota_exceeded"
        : "feature_not_available";
      const msg = entitlement.reason === "rate_limited"
        ? "Rate limit exceeded. Please slow down."
        : entitlement.reason === "quota_exhausted"
          ? `Monthly quota exceeded. Resets on ${entitlement.resetAt?.toLocaleDateString() ?? "next billing cycle"}.`
          : "This feature is not available on your current plan.";
      const res = errorResponse(requestId, status, code, msg, req, apiKey.keyId);
      if (entitlement.resetAt) {
        res.headers.set("X-RateLimit-Reset", String(Math.floor(entitlement.resetAt.getTime() / 1000)));
      }
      res.headers.set("X-Quota-Remaining", entitlement.remaining === "unlimited" ? "unlimited" : String(entitlement.remaining));
      return res;
    }

    // Security gate (Fix 14): IP-block + per-IP rate limit. These checks are
    // shared with the web-auth routes via lib/security, but we run them inline
    // here because v1 routes use ApiContext (not the preflight gate). We do NOT
    // run disposable-email or VPN/proxy checks — API users send to their own
    // users (not disposable inboxes they're testing) and traffic is
    // server-to-server (datacenter IPs are normal for API callers).
    if (ip && ip !== "unknown") {
      const { isIpBlocked, enforceIpSendLimit, enforceIpVerifyLimit } =
        await import("@/lib/security");
      const ipBlocked = await isIpBlocked(ip);
      if (ipBlocked.blocked) {
        return errorResponse(
          requestId,
          403,
          "ip_blocked",
          "Access from your IP has been temporarily suspended.",
          req,
          apiKey.keyId,
        );
      }
      // Per-IP rate limit — choose the bucket based on the securityBucket option.
      // Phase 4 adds "generic" so messaging routes skip the OTP-specific send limiter.
      // Legacy default preserves the original behavior: otp:verify → verify limiter,
      // everything else → send limiter.
      const bucket: SecurityBucket = opts?.securityBucket
        ?? (requiredScope === "otp:verify" ? "otp_verify" : "otp_send");
      let ipDecision;
      if (bucket === "otp_verify") {
        ipDecision = await enforceIpVerifyLimit(ip);
      } else if (bucket === "otp_send") {
        ipDecision = await enforceIpSendLimit(ip);
      } else {
        // generic — IP-block check only (already done above), no per-email OTP limiter.
        ipDecision = { allowed: true } as const;
      }
      if (!ipDecision.allowed) {
        const res = errorResponse(
          requestId,
          ipDecision.code === "ip_blocked" ? 403 : 429,
          ipDecision.code === "ip_blocked" ? "ip_blocked" : "rate_limited",
          ipDecision.message,
          req,
          apiKey.keyId,
        );
        if (ipDecision.retryAfterSeconds) {
          res.headers.set("Retry-After", String(ipDecision.retryAfterSeconds));
        }
        return res;
      }
    }

    // Call the handler.
    let res: NextResponse;
    try {
      res = await handler({ requestId, apiKey, ip }, req);
    } catch (err) {
      console.error(`[v1] ${requestId} error:`, err instanceof Error ? err.message : "unknown");
      res = errorResponse(requestId, 500, "internal_error", "An unexpected error occurred.", req, apiKey.keyId);
    }

    // Inject standard headers.
    res.headers.set("X-Request-Id", requestId);
    res.headers.set("X-Api-Version", "1");
    // Quota headers on successful responses.
    if (res.status < 400 && entitlement.remaining !== undefined) {
      res.headers.set("X-Quota-Remaining", entitlement.remaining === "unlimited" ? "unlimited" : String(entitlement.remaining));
    }

    // Log the request (best-effort).
    const durationMs = Date.now() - start;
    db.requestLog.create({
      data: {
        requestId,
        apiKeyId: apiKey.keyId,
        // Phase 7: explicit tenant ownership + environment on every v1 request.
        userId: apiKey.userId ?? null,
        environment: apiKey.environment ?? null,
        method: req.method,
        path: new URL(req.url).pathname,
        status: res.status,
        durationMs,
        ip,
        userAgent: req.headers.get("user-agent") ?? null,
        error: res.status >= 400 ? "error" : null,
      },
    }).catch(() => {});

    return res;
  };
}

/** Build a standard error response with the consistent shape. */
export function errorResponse(
  requestId: string,
  status: number,
  code: string,
  message: string,
  _req: NextRequest,
  apiKeyId?: number,
): NextResponse {
  const body = {
    error: { code, message, doc_url: `/admin/errors#${code}` },
    request_id: requestId,
  };
  const res = NextResponse.json(body, { status });
  res.headers.set("X-Request-Id", requestId);
  res.headers.set("X-Api-Version", "1");
  return res;
}

/** Build a standard success response with request ID. */
export function okResponse(requestId: string, data: unknown, status = 200): NextResponse {
  const body = { ...(data as Record<string, unknown>), request_id: requestId };
  const res = NextResponse.json(body, { status });
  res.headers.set("X-Request-Id", requestId);
  res.headers.set("X-Api-Version", "1");
  return res;
}

/** Add rate-limit headers to a response. */
export function withRateLimitHeaders(res: NextResponse, info: RateLimitInfo): NextResponse {
  res.headers.set("X-RateLimit-Limit", String(info.limit));
  res.headers.set("X-RateLimit-Remaining", String(info.remaining));
  res.headers.set("X-RateLimit-Reset", String(info.reset));
  return res;
}

/** Idempotency: hash the Idempotency-Key + body to detect replays. */
export function idempotencyKey(req: NextRequest, body: unknown): string | null {
  const key = req.headers.get("idempotency-key");
  if (!key) return null;
  return createHash("sha256").update(key + JSON.stringify(body)).digest("hex");
}
