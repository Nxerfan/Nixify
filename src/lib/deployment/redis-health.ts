/**
 * Redis health probe — bounded, safe dependency check for the optional
 * Upstash Redis REST integration.
 *
 * Used by /api/health. NOT used by /api/readyz or /api/healthz (Redis is
 * non-critical — Nixify's rate limiting is DB-backed).
 *
 * ─── Configuration matrix ──────────────────────────────────────────────────
 *
 *   - BOTH absent (URL + token undefined)  → "not_configured" (skip; no fetch)
 *   - URL set, token absent                → "degraded" / "redis_config_incomplete"
 *   - token set, URL absent                → "degraded" / "redis_config_incomplete"
 *   - Both configured                       → perform the actual PING probe
 *
 * ─── Success contract ─────────────────────────────────────────────────────
 *
 * Redis is operational ONLY when:
 *   1. the HTTP request completes without timeout/network error;
 *   2. HTTP status is 2xx;
 *   3. the response body is valid JSON;
 *   4. the response contains `{ "result": "PONG" }`.
 *
 * Any other outcome (401, 429, 5xx, non-JSON, unexpected result, timeout,
 * network failure) is classified into a bounded diagnostic category.
 *
 * ─── Security ──────────────────────────────────────────────────────────────
 *
 * NEVER exposes or logs:
 *   - the Redis REST token;
 *   - the Authorization header;
 *   - raw upstream response body text;
 *   - raw fetch error messages;
 *   - the full URL (may contain deployment identifiers);
 *   - stack traces.
 */

export interface RedisHealthResult {
  /** "operational" only on a successful authenticated PONG. */
  status: "operational" | "degraded" | "not_configured";
  latencyMs?: number;
  /** Bounded diagnostic category — never raw error/URL/token text. */
  detail?: string;
}

/** Known placeholder SMTP values from .env.example — also checked for Redis. */
const KNOWN_PLACEHOLDER_TOKENS: readonly string[] = ["xxx", "replace-with-32-char-hex-string"];

/**
 * Check Redis health via the Upstash REST API. Returns a bounded result.
 * Does NOT throw. Does NOT log (the caller decides whether to log).
 */
export async function checkRedisHealth(): Promise<RedisHealthResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Configuration matrix.
  const hasUrl = url && url.trim() !== "";
  const hasToken = token && token.trim() !== "";

  // Both absent → not configured. Do NOT fetch. Do NOT degrade overall health.
  if (!hasUrl && !hasToken) {
    return { status: "not_configured" };
  }

  // Partial config → degraded. Do NOT fetch (would send "Bearer undefined").
  if (!hasUrl || !hasToken) {
    return { status: "degraded", detail: "redis_config_incomplete" };
  }

  // Reject known placeholder tokens.
  if (typeof token === "string" && KNOWN_PLACEHOLDER_TOKENS.includes(token.trim())) {
    return { status: "degraded", detail: "redis_config_incomplete" };
  }

  // Both configured — perform the actual bounded health probe.
  const start = Date.now();
  try {
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2000),
    });
    const latencyMs = Date.now() - start;

    // Non-2xx responses → degraded with a bounded HTTP-status-based diagnostic.
    if (!res.ok) {
      if (res.status === 401) {
        return { status: "degraded", detail: "redis_auth_failed", latencyMs };
      }
      if (res.status === 429) {
        return { status: "degraded", detail: "redis_rate_limited", latencyMs };
      }
      return { status: "degraded", detail: "redis_upstream_error", latencyMs };
    }

    // 2xx — validate the response body is the expected Upstash PONG.
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { status: "degraded", detail: "redis_invalid_response", latencyMs };
    }

    // Upstash REST successful command response: { "result": "PONG" }.
    // A WRONGPASS or other auth error returns { "error": "..." } — do NOT
    // expose the error string; classify as invalid_response.
    const result = (json as { result?: unknown })?.result;
    if (result === "PONG") {
      return { status: "operational", latencyMs };
    }

    return { status: "degraded", detail: "redis_invalid_response", latencyMs };
  } catch (err) {
    // Classify network/timeout/fetch failures without exposing raw text.
    const errMsg = err instanceof Error ? err.message : "";
    if (err instanceof Error && (err.name === "AbortError" || errMsg.includes("aborted"))) {
      return { status: "degraded", detail: "redis_timeout" };
    }
    return { status: "degraded", detail: "redis_unreachable" };
  }
}
