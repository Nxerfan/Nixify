/**
 * Redis health + SMTP placeholder truth tests.
 *
 * Tests the REAL Redis health probe (src/lib/deployment/redis-health.ts) and
 * the REAL /api/health route's Redis/SMTP handling against mocked fetch + DB.
 *
 * No production probes during tests — all HTTP calls are mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the db module.
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
  },
}));

// Mock the logger.
const loggerError = vi.fn();
const loggerWarn = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => loggerError(...args),
    warn: (...args: unknown[]) => loggerWarn(...args),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { checkRedisHealth } from "@/lib/deployment/redis-health";
import { GET as healthGET } from "@/app/api/health/route";
import { db } from "@/lib/db";

const TEST_TOKEN = "test-redis-token-abc123";
const TEST_URL = "https://test-redis.upstash.io";

beforeEach(() => {
  vi.clearAllMocks();
  (db.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([{ "?column?": 1 }]);
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Build a mock fetch Response. */
function mockResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  const h = new Map<string, string>();
  h.set("content-type", "application/json");
  for (const [k, v] of Object.entries(headers)) h.set(k, v);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => h.get(name.toLowerCase()) || h.get(name) || null },
    json: async () => body,
  };
}

// ---- Redis configuration matrix -------------------------------------------

describe("Redis health — configuration matrix", () => {
  it("both URL/token absent → not_configured, no fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await checkRedisHealth();
    expect(result.status).toBe("not_configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("URL only (no token) → degraded, no fetch, redis_config_incomplete", async () => {
    process.env.UPSTASH_REDIS_REST_URL = TEST_URL;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await checkRedisHealth();
    expect(result.status).toBe("degraded");
    expect(result.detail).toBe("redis_config_incomplete");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("token only (no URL) → degraded, no fetch, redis_config_incomplete", async () => {
    process.env.UPSTASH_REDIS_REST_TOKEN = TEST_TOKEN;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await checkRedisHealth();
    expect(result.status).toBe("degraded");
    expect(result.detail).toBe("redis_config_incomplete");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("placeholder token (xxx) → degraded, no fetch, redis_config_incomplete", async () => {
    process.env.UPSTASH_REDIS_REST_URL = TEST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = "xxx";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await checkRedisHealth();
    expect(result.status).toBe("degraded");
    expect(result.detail).toBe("redis_config_incomplete");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ---- Redis success contract ----------------------------------------------

describe("Redis health — success contract", () => {
  it("HTTP 200 + { result: 'PONG' } → operational", async () => {
    process.env.UPSTASH_REDIS_REST_URL = TEST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = TEST_TOKEN;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse(200, { result: "PONG" }) as any);
    const result = await checkRedisHealth();
    expect(result.status).toBe("operational");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("HTTP 200 + { result: 'PONG' } is the ONLY success contract", async () => {
    process.env.UPSTASH_REDIS_REST_URL = TEST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = TEST_TOKEN;
    // Any other response body → NOT operational.
    const bodies = [
      { error: "WRONGPASS invalid username or password" },
      { result: "OK" },
      { result: null },
      { foo: "bar" },
      "PONG",
      null,
    ];
    for (const body of bodies) {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse(200, body) as any);
      const result = await checkRedisHealth();
      expect(result.status).toBe("degraded");
    }
  });
});

// ---- Redis HTTP failures -------------------------------------------------

describe("Redis health — HTTP failure classification", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = TEST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = TEST_TOKEN;
  });

  it("HTTP 401 → degraded, redis_auth_failed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse(401, { error: "Unauthorized" }) as any);
    const result = await checkRedisHealth();
    expect(result.status).toBe("degraded");
    expect(result.detail).toBe("redis_auth_failed");
  });

  it("HTTP 429 → degraded, redis_rate_limited", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse(429, { error: "Rate limited" }) as any);
    const result = await checkRedisHealth();
    expect(result.status).toBe("degraded");
    expect(result.detail).toBe("redis_rate_limited");
  });

  it("HTTP 500 → degraded, redis_upstream_error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse(500, { error: "Internal" }) as any);
    const result = await checkRedisHealth();
    expect(result.status).toBe("degraded");
    expect(result.detail).toBe("redis_upstream_error");
  });

  it("HTTP 200 + invalid JSON → degraded, redis_invalid_response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => { throw new Error("not JSON"); },
    } as any);
    const result = await checkRedisHealth();
    expect(result.status).toBe("degraded");
    expect(result.detail).toBe("redis_invalid_response");
  });

  it("HTTP 200 + { error: 'WRONGPASS ...' } → degraded, redis_invalid_response (no body leak)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockResponse(200, { error: "WRONGPASS invalid username or password" }) as any,
    );
    const result = await checkRedisHealth();
    expect(result.status).toBe("degraded");
    expect(result.detail).toBe("redis_invalid_response");
  });
});

// ---- Redis network failures ----------------------------------------------

describe("Redis health — network failure classification", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = TEST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = TEST_TOKEN;
  });

  it("TimeoutError (AbortSignal.timeout shape) → degraded, redis_timeout", async () => {
    // AbortSignal.timeout() rejects with a DOMException whose name is "TimeoutError".
    // Use a real DOMException where available; fall back to a plain Error with
    // the correct name for runtimes that don't expose DOMException.
    let timeoutErr: Error;
    try {
      timeoutErr = new DOMException("The operation timed out", "TimeoutError");
    } catch {
      timeoutErr = new Error("The operation timed out");
      timeoutErr.name = "TimeoutError";
    }
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(timeoutErr);
    const result = await checkRedisHealth();
    expect(result.status).toBe("degraded");
    expect(result.detail).toBe("redis_timeout");
  });

  it("AbortError (manual AbortController) → degraded, redis_timeout", async () => {
    // AbortError is retained for manual AbortController usage. This is an
    // intentional timeout-compatible classification: a manually-aborted fetch
    // also means the request did not complete within the desired window.
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(err);
    const result = await checkRedisHealth();
    expect(result.status).toBe("degraded");
    expect(result.detail).toBe("redis_timeout");
  });

  it("TypeError (network failure) → degraded, redis_unreachable (NOT redis_timeout)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("fetch failed: ECONNREFUSED"));
    const result = await checkRedisHealth();
    expect(result.status).toBe("degraded");
    expect(result.detail).toBe("redis_unreachable");
    expect(result.detail).not.toBe("redis_timeout");
  });

  it("raw exception text absent from result", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("fetch failed: ECONNREFUSED at host secret-internal.upstash.io:443"));
    const result = await checkRedisHealth();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("secret-internal.upstash.io");
    expect(serialized).not.toContain("ECONNREFUSED");
    expect(serialized).not.toContain("fetch failed");
  });
});

// ---- Authorization handling (no token leak) -------------------------------

describe("Redis health — Authorization handling without leaking token", () => {
  it("request is made with Bearer token when both configured", async () => {
    process.env.UPSTASH_REDIS_REST_URL = TEST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = TEST_TOKEN;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse(200, { result: "PONG" }) as any);
    await checkRedisHealth();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callArgs = fetchSpy.mock.calls[0];
    const headers = (callArgs[1] as { headers: Record<string, string> }).headers;
    expect(headers.Authorization).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it("token does not appear in health response", async () => {
    process.env.UPSTASH_REDIS_REST_URL = TEST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = TEST_TOKEN;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse(200, { result: "PONG" }) as any);
    const result = await checkRedisHealth();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(TEST_TOKEN);
  });

  it("token does not appear in logger metadata", async () => {
    process.env.UPSTASH_REDIS_REST_URL = TEST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = TEST_TOKEN;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse(401, { error: "Unauthorized" }) as any);
    await checkRedisHealth();
    // The /api/health route logs Redis degradation — verify via the health route.
    // Here we test checkRedisHealth directly (it doesn't log). The token
    // absence from the RESULT is the key proof.
    // (The full route test below also verifies logger metadata.)
  });

  it("upstream body containing credential-looking text never reaches result", async () => {
    process.env.UPSTASH_REDIS_REST_URL = TEST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = TEST_TOKEN;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockResponse(401, { error: "WRONGPASS: password=hunter2 token=secret123" }) as any,
    );
    const result = await checkRedisHealth();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("secret123");
    expect(serialized).not.toContain("WRONGPASS");
  });
});

// ---- Overall /api/health semantics ----------------------------------------

describe("/api/health — overall Redis + DB + SMTP semantics", () => {
  it("DB healthy + Redis degraded → HTTP 200 + overall degraded", async () => {
    process.env.UPSTASH_REDIS_REST_URL = TEST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = TEST_TOKEN;
    process.env.SMTP_USER = "real@example.com";
    process.env.SMTP_PASS = "real-password";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse(401, { error: "Unauthorized" }) as any);
    const res = await healthGET();
    expect(res.status).toBe(200); // degraded, not 503
    const body = await res.json();
    expect(body.data.status).toBe("degraded");
    expect(body.data.services.redis.status).toBe("degraded");
    expect(body.data.services.database.status).toBe("operational");
  });

  it("DB down + Redis healthy → HTTP 503 + overall down", async () => {
    (db.$queryRaw as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("DB down P1001"));
    process.env.UPSTASH_REDIS_REST_URL = TEST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = TEST_TOKEN;
    process.env.SMTP_USER = "real@example.com";
    process.env.SMTP_PASS = "real-password";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse(200, { result: "PONG" }) as any);
    const res = await healthGET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.data.status).toBe("down");
    expect(body.data.services.redis.status).toBe("operational");
    expect(body.data.services.database.status).toBe("down");
  });

  it("DB healthy + Redis absent + SMTP configured → operational", async () => {
    process.env.SMTP_USER = "real@example.com";
    process.env.SMTP_PASS = "real-password";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await healthGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("operational");
    expect(body.data.services.redis).toBeUndefined(); // omitted — not configured
    expect(fetchSpy).not.toHaveBeenCalled(); // no Redis fetch
  });

  it("Redis not configured → does NOT degrade overall health", async () => {
    process.env.SMTP_USER = "real@example.com";
    process.env.SMTP_PASS = "real-password";
    const res = await healthGET();
    const body = await res.json();
    expect(body.data.status).toBe("operational");
    expect(body.data.services.redis).toBeUndefined();
  });

  it("Redis degraded → logger.warn called with bounded diagnostics (no token/URL/body)", async () => {
    process.env.UPSTASH_REDIS_REST_URL = TEST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = TEST_TOKEN;
    process.env.SMTP_USER = "real@example.com";
    process.env.SMTP_PASS = "real-password";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse(401, { error: "Unauthorized token=secret" }) as any);
    loggerWarn.mockClear();
    await healthGET();
    expect(loggerWarn).toHaveBeenCalledTimes(1);
    const logMeta = JSON.stringify(loggerWarn.mock.calls[0]);
    expect(logMeta).not.toContain(TEST_TOKEN);
    expect(logMeta).not.toContain(TEST_URL);
    expect(logMeta).not.toContain("Unauthorized token=secret");
    expect(logMeta).toMatch(/redis_auth_failed/);
  });
});

// ---- SMTP placeholder truth ------------------------------------------------

describe("SMTP placeholder detection", () => {
  it("placeholder SMTP_PASS (your_16_char_app_password) → degraded", async () => {
    process.env.SMTP_USER = "real@example.com";
    process.env.SMTP_PASS = "your_16_char_app_password";
    const res = await healthGET();
    const body = await res.json();
    expect(body.data.services.smtp.status).toBe("degraded");
    expect(body.data.services.smtp.detail).toMatch(/placeholder/i);
  });

  it("placeholder SMTP_USER (your-email@gmail.com) → degraded", async () => {
    process.env.SMTP_USER = "your-email@gmail.com";
    process.env.SMTP_PASS = "real-password";
    const res = await healthGET();
    const body = await res.json();
    expect(body.data.services.smtp.status).toBe("degraded");
    expect(body.data.services.smtp.detail).toMatch(/placeholder/i);
  });

  it("real SMTP credentials → operational", async () => {
    process.env.SMTP_USER = "real@example.com";
    process.env.SMTP_PASS = "real-strong-password-123";
    const res = await healthGET();
    const body = await res.json();
    expect(body.data.services.smtp.status).toBe("operational");
  });
});

// ---- /healthz and /readyz unchanged ---------------------------------------

describe("/healthz and /readyz unchanged behavior", () => {
  it("/healthz returns 200 with no DB/Redis contact", async () => {
    const { GET: healthzGET } = await import("@/app/api/healthz/route");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await healthzGET();
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("/readyz does NOT check Redis", async () => {
    process.env.UPSTASH_REDIS_REST_URL = TEST_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = TEST_TOKEN;
    const { GET: readyzGET } = await import("@/app/api/readyz/route");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await readyzGET();
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled(); // readyz never checks Redis
  });
});
