import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// The SDK is CommonJS (module.exports). Under ESM, use createRequire to get the
// CJS namespace so we can assert on the exact runtime export shape.
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// ---- Mock fetch helper -----------------------------------------------------

/**
 * Create a mock fetch that returns canned responses in sequence.
 * Each response: { status, body, headers }
 * `mock.calls` records every outbound request so tests can assert the EXACT
 * number of network calls (idempotency proof).
 */
function mockFetch(responses) {
  const calls = [];
  const mock = vi.fn(async (url, init) => {
    calls.push({ url, init, headers: init?.headers || {} });
    const resp = responses[calls.length - 1] || responses[responses.length - 1];
    const headers = new Map();
    // Auto-set content-type to application/json if the response has a body
    // and no explicit content-type was provided.
    if (resp.body && !resp.headers?.["content-type"] && !resp.headers?.["Content-Type"]) {
      headers.set("content-type", "application/json");
    }
    if (resp.headers) {
      for (const [k, v] of Object.entries(resp.headers)) headers.set(k, v);
    }
    return {
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      headers: {
        get: (name) => headers.get(name.toLowerCase()) || headers.get(name) || null,
      },
      json: async () => resp.body,
    };
  });
  mock.calls = calls;
  return mock;
}

/** Mock fetch that throws a network error on every call. */
function networkErrorFetch(message = "Network error") {
  const calls = [];
  const mock = vi.fn(async (url, init) => {
    calls.push({ url, init, headers: init?.headers || {} });
    throw new TypeError(message);
  });
  mock.calls = calls;
  return mock;
}

/** Mock fetch that throws an AbortError on every call (simulates timeout). */
function timeoutFetch() {
  const calls = [];
  const mock = vi.fn(async (url, init) => {
    calls.push({ url, init, headers: init?.headers || {} });
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    throw err;
  });
  mock.calls = calls;
  return mock;
}

// ---- Tests ------------------------------------------------------------------

describe("Nixify SDK", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Task 2 — Export contract (runtime === TypeScript declarations)
  // ==========================================================================

  describe("export contract", () => {
    it("exports named { Nixify, NixifyError } via require", () => {
      const mod = require("../index.js");
      expect(mod.Nixify).toBeInstanceOf(Function);
      expect(mod.NixifyError).toBeInstanceOf(Function);
      // constructor sanity
      const n = new mod.Nixify("mg_live_x");
      expect(n).toBeInstanceOf(mod.Nixify);
      const err = new mod.NixifyError("boom");
      expect(err).toBeInstanceOf(mod.NixifyError);
      expect(err).toBeInstanceOf(Error);
    });

    it("does NOT ship a default export (no module.exports.default)", () => {
      const mod = require("../index.js");
      // The runtime exports named exports only. A default export that is an
      // object { Nixify, NixifyError } would be a misleading, divergent shape.
      expect(mod.default).toBeUndefined();
    });

    it("Nixify and NixifyError are NOT re-exported as a wrapper object", () => {
      const mod = require("../index.js");
      // Guard against regressions like module.exports.default = { Nixify, ... }
      expect(typeof mod.Nixify).toBe("function");
      expect(typeof mod.NixifyError).toBe("function");
      expect(mod.Nixify.name).toBe("Nixify");
      expect(mod.NixifyError.name).toBe("NixifyError");
    });

    it("CJS namespace has exactly the two public exports (no surprise keys)", () => {
      const mod = require("../index.js");
      const ownKeys = Object.keys(mod).sort();
      expect(ownKeys).toEqual(["Nixify", "NixifyError"]);
    });

    it("ESM interop: named imports resolve off the CJS namespace", async () => {
      // Simulate `import { Nixify } from "../index.js"` by reading the CJS
      // namespace the way Node's ESM loader exposes named exports.
      const mod = require("../index.js");
      const { Nixify, NixifyError } = mod;
      expect(Nixify).toBe(mod.Nixify);
      expect(NixifyError).toBe(mod.NixifyError);
    });
  });

  // ==========================================================================
  // Default config + base URL
  // ==========================================================================

  it("default base URL is https://nixify.ir", () => {
    const { Nixify } = require("../index.js");
    const nixify = new Nixify("mg_live_test123");
    expect(nixify.baseUrl).toBe("https://nixify.ir");
  });

  it("custom baseUrl overrides default", () => {
    const { Nixify } = require("../index.js");
    const nixify = new Nixify("mg_live_test123", { baseUrl: "http://localhost:3000" });
    expect(nixify.baseUrl).toBe("http://localhost:3000");
  });

  it("trailing slashes are normalized", () => {
    const { Nixify } = require("../index.js");
    const nixify = new Nixify("mg_live_test123", { baseUrl: "https://nixify.ir/" });
    expect(nixify.baseUrl).toBe("https://nixify.ir");
    const nixify2 = new Nixify("mg_live_test123", { baseUrl: "https://nixify.ir//" });
    expect(nixify2.baseUrl).toBe("https://nixify.ir");
  });

  it("rejects an empty/non-string API key", () => {
    const { Nixify, NixifyError } = require("../index.js");
    expect(() => new Nixify("")).toThrow(NixifyError);
    expect(() => new Nixify(null)).toThrow(NixifyError);
    expect(() => new Nixify(123)).toThrow(NixifyError);
  });

  // ==========================================================================
  // Authorization header
  // ==========================================================================

  it("sets Authorization header with Bearer token", async () => {
    const { Nixify } = require("../index.js");
    const mock = mockFetch([{ status: 200, body: { otp_request_id: "otp-1", request_id: "req-1", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey");
    await nixify.otp.send({ email: "user@example.com" });

    expect(mock.calls[0].headers["Authorization"]).toBe("Bearer mg_live_mykey");
  });

  // ==========================================================================
  // Send / verify / resend happy paths
  // ==========================================================================

  it("send request posts to /api/v1/otp/send with email", async () => {
    const { Nixify } = require("../index.js");
    const mock = mockFetch([{ status: 200, body: { otp_request_id: "otp-1", request_id: "req-1", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey");
    const result = await nixify.otp.send({ email: "user@example.com" });

    expect(mock.calls[0].url).toBe("https://nixify.ir/api/v1/otp/send");
    expect(mock.calls[0].init.method).toBe("POST");
    expect(JSON.parse(mock.calls[0].init.body)).toEqual({ email: "user@example.com" });
    expect(result.otp_request_id).toBe("otp-1");
    expect(result.request_id).toBe("req-1");
    expect(result.message).toBe("OTP sent");
    expect(result.expires_at).toBe("2026-01-01T00:00:00Z");
  });

  it("send with purpose sends it in body", async () => {
    const { Nixify } = require("../index.js");
    const mock = mockFetch([{ status: 200, body: { otp_request_id: "otp-1", request_id: "req-1", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey");
    await nixify.otp.send({ email: "user@example.com", purpose: "login" });

    expect(JSON.parse(mock.calls[0].init.body)).toEqual({ email: "user@example.com", purpose: "login" });
  });

  it("send response includes sandbox code for mg_test_ keys", async () => {
    const { Nixify } = require("../index.js");
    const mock = mockFetch([{ status: 200, body: { otp_request_id: "otp-1", request_id: "req-1", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z", code: "123456" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_test_mykey");
    const result = await nixify.otp.send({ email: "user@example.com" });

    expect(result.code).toBe("123456");
  });

  it("verify request posts to /api/v1/otp/verify with email + code", async () => {
    const { Nixify } = require("../index.js");
    const mock = mockFetch([{ status: 200, body: { verified: true, request_id: "req-1", otp_request_id: "otp-1" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey");
    const result = await nixify.otp.verify({ email: "user@example.com", code: "123456" });

    expect(mock.calls[0].url).toBe("https://nixify.ir/api/v1/otp/verify");
    expect(JSON.parse(mock.calls[0].init.body)).toEqual({ email: "user@example.com", code: "123456" });
    expect(result.verified).toBe(true);
    expect(result.request_id).toBe("req-1");
    expect(result.otp_request_id).toBe("otp-1");
  });

  it("verify with purpose sends it in body", async () => {
    const { Nixify } = require("../index.js");
    const mock = mockFetch([{ status: 200, body: { verified: true, request_id: "req-1", otp_request_id: "otp-1" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey");
    await nixify.otp.verify({ email: "user@example.com", code: "123456", purpose: "reset" });

    expect(JSON.parse(mock.calls[0].init.body)).toEqual({ email: "user@example.com", code: "123456", purpose: "reset" });
  });

  it("resend request posts to /api/v1/otp/resend with email + purpose", async () => {
    const { Nixify } = require("../index.js");
    const mock = mockFetch([{ status: 200, body: { otp_request_id: "otp-2", request_id: "req-2", message: "OTP resent", expires_at: "2026-01-01T00:00:00Z" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey");
    const result = await nixify.otp.resend({ email: "user@example.com", purpose: "signup" });

    expect(mock.calls[0].url).toBe("https://nixify.ir/api/v1/otp/resend");
    expect(JSON.parse(mock.calls[0].init.body)).toEqual({ email: "user@example.com", purpose: "signup" });
    expect(result.otp_request_id).toBe("otp-2");
  });

  it("send response distinguishes request_id (trace) from otp_request_id (correlation)", async () => {
    const { Nixify } = require("../index.js");
    const mock = mockFetch([{ status: 200, body: { otp_request_id: "otp-abc", request_id: "req-xyz", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey");
    const result = await nixify.otp.send({ email: "user@example.com" });

    expect(result.otp_request_id).toBe("otp-abc");
    expect(result.request_id).toBe("req-xyz");
    expect(result.otp_request_id).not.toBe(result.request_id);
  });

  // ==========================================================================
  // Task 1 — NO Idempotency-Key header is ever sent
  // (the API does not dedupe by it; sending it would be a false guarantee)
  // ==========================================================================

  describe("Idempotency-Key is NEVER sent (no false idempotency guarantee)", () => {
    it("send does NOT send an Idempotency-Key header", async () => {
      const { Nixify } = require("../index.js");
      const mock = mockFetch([{ status: 200, body: { otp_request_id: "otp-1", request_id: "req-1", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" } }]);
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey");
      await nixify.otp.send({ email: "user@example.com" });

      expect(mock.calls[0].headers["Idempotency-Key"]).toBeUndefined();
    });

    it("resend does NOT send an Idempotency-Key header", async () => {
      const { Nixify } = require("../index.js");
      const mock = mockFetch([{ status: 200, body: { otp_request_id: "otp-1", request_id: "req-1", message: "OTP resent", expires_at: "2026-01-01T00:00:00Z" } }]);
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey");
      await nixify.otp.resend({ email: "user@example.com", purpose: "signup" });

      expect(mock.calls[0].headers["Idempotency-Key"]).toBeUndefined();
    });

    it("verify does NOT send an Idempotency-Key header", async () => {
      const { Nixify } = require("../index.js");
      const mock = mockFetch([{ status: 200, body: { verified: true, request_id: "r1", otp_request_id: "otp-1" } }]);
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey");
      await nixify.otp.verify({ email: "user@example.com", code: "123456" });

      expect(mock.calls[0].headers["Idempotency-Key"]).toBeUndefined();
    });

    it("no randomUUID import / no Idempotency-Key even on a retried 429 send", async () => {
      const { Nixify } = require("../index.js");
      const responses = [
        { status: 429, body: { error: { code: "rate_limited", message: "Too many requests" }, request_id: "r1" }, headers: { "Retry-After": "0.001", "X-Request-Id": "r1" } },
        { status: 200, body: { otp_request_id: "otp-1", request_id: "r2", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" }, headers: { "X-Request-Id": "r2" } },
      ];
      const mock = mockFetch(responses);
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey", { maxRetries: 2 });
      await nixify.otp.send({ email: "user@example.com" });

      // Retried (429), but STILL no Idempotency-Key on either attempt.
      expect(mock.calls).toHaveLength(2);
      expect(mock.calls[0].headers["Idempotency-Key"]).toBeUndefined();
      expect(mock.calls[1].headers["Idempotency-Key"]).toBeUndefined();
    });
  });

  // ==========================================================================
  // API error parsing
  // ==========================================================================

  it("API error response is parsed into NixifyError with code + message + doc_url", async () => {
    const { Nixify, NixifyError } = require("../index.js");
    const mock = mockFetch([{
      status: 401,
      body: { error: { code: "unauthorized", message: "Invalid API key.", doc_url: "/docs#error-unauthorized" }, request_id: "req-err" },
      headers: { "X-Request-Id": "req-err" },
    }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_bad");
    try {
      await nixify.otp.send({ email: "user@example.com" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NixifyError);
      expect(err.code).toBe("unauthorized");
      expect(err.status).toBe(401);
      expect(err.message).toBe("Invalid API key.");
      expect(err.requestId).toBe("req-err");
      expect(err.docUrl).toBe("/docs#error-unauthorized");
    }
  });

  it("malformed non-JSON response is handled safely", async () => {
    const { Nixify, NixifyError } = require("../index.js");
    const mock = vi.fn(async () => ({
      ok: false,
      status: 502,
      headers: { get: () => "text/html" },
      json: async () => { throw new Error("not JSON"); },
    }));
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey");
    try {
      await nixify.otp.send({ email: "user@example.com" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NixifyError);
      expect(err.status).toBe(502);
      expect(err.code).toBe("http_error");
    }
    // 502 is 5xx → NOT retried → exactly one outbound call.
    expect(mock).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // Task 1 — Conservative retry matrix
  // ==========================================================================

  describe("retry matrix", () => {
    // ---- 429: the ONLY retried outcome ----

    it("429 retries and honors Retry-After header", async () => {
      const { Nixify } = require("../index.js");
      const responses = [
        { status: 429, body: { error: { code: "rate_limited", message: "Too many requests" }, request_id: "r1" }, headers: { "Retry-After": "0.001", "X-Request-Id": "r1" } },
        { status: 200, body: { otp_request_id: "otp-1", request_id: "r2", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" }, headers: { "X-Request-Id": "r2" } },
      ];
      const mock = mockFetch(responses);
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey", { maxRetries: 2 });
      const result = await nixify.otp.send({ email: "user@example.com" });

      expect(mock.calls).toHaveLength(2);
      expect(result.otp_request_id).toBe("otp-1");
    });

    it("429 falls back to backoff when Retry-After is absent", async () => {
      const { Nixify } = require("../index.js");
      const responses = [
        { status: 429, body: { error: { code: "rate_limited", message: "Too many requests" }, request_id: "r1" }, headers: { "X-Request-Id": "r1" } },
        { status: 200, body: { otp_request_id: "otp-1", request_id: "r2", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" }, headers: { "X-Request-Id": "r2" } },
      ];
      const mock = mockFetch(responses);
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey", { maxRetries: 2 });
      const result = await nixify.otp.send({ email: "user@example.com" });

      expect(mock.calls).toHaveLength(2);
      expect(result.otp_request_id).toBe("otp-1");
    });

    it("429 stops retrying after maxRetries is exhausted", async () => {
      const { Nixify, NixifyError } = require("../index.js");
      const mock = mockFetch([
        { status: 429, body: { error: { code: "rate_limited", message: "slow down" }, request_id: "r1" }, headers: { "Retry-After": "0.001", "X-Request-Id": "r1" } },
        { status: 429, body: { error: { code: "rate_limited", message: "slow down" }, request_id: "r2" }, headers: { "Retry-After": "0.001", "X-Request-Id": "r2" } },
        { status: 429, body: { error: { code: "rate_limited", message: "slow down" }, request_id: "r3" }, headers: { "Retry-After": "0.001", "X-Request-Id": "r3" } },
      ]);
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey", { maxRetries: 2 });
      try {
        await nixify.otp.send({ email: "user@example.com" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(NixifyError);
        expect(err.code).toBe("rate_limited");
        expect(err.status).toBe(429);
      }
      // 1 initial + 2 retries = 3 outbound calls.
      expect(mock.calls).toHaveLength(3);
    });

    // ---- ordinary 4xx: never retried ----

    it("400 is not retried", async () => {
      const { Nixify } = require("../index.js");
      const mock = mockFetch([{
        status: 400,
        body: { error: { code: "validation_failed", message: "Invalid email" }, request_id: "r1" },
        headers: { "X-Request-Id": "r1" },
      }]);
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey", { maxRetries: 2 });
      try {
        await nixify.otp.send({ email: "bad" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err.code).toBe("validation_failed");
      }
      expect(mock.calls).toHaveLength(1);
    });

    it("401 is not retried", async () => {
      const { Nixify } = require("../index.js");
      const mock = mockFetch([{
        status: 401,
        body: { error: { code: "unauthorized", message: "Invalid API key." }, request_id: "r1" },
        headers: { "X-Request-Id": "r1" },
      }]);
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_bad", { maxRetries: 2 });
      try {
        await nixify.otp.send({ email: "user@example.com" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err.code).toBe("unauthorized");
      }
      expect(mock.calls).toHaveLength(1);
    });

    // ---- 5xx: NOT retried on OTP mutations (ambiguous server state) ----

    it("send 5xx is NOT retried (exactly ONE outbound request)", async () => {
      const { Nixify, NixifyError } = require("../index.js");
      const mock = mockFetch([{
        status: 503,
        body: { error: { code: "internal_error", message: "Service unavailable" }, request_id: "r1" },
        headers: { "X-Request-Id": "r1" },
      }]);
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey", { maxRetries: 2 });
      try {
        await nixify.otp.send({ email: "user@example.com" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(NixifyError);
        expect(err.status).toBe(503);
        expect(err.code).toBe("internal_error");
      }
      // PROOF: ambiguous OTP mutation produced exactly ONE outbound request.
      expect(mock.calls).toHaveLength(1);
    });

    it("resend 5xx is NOT retried (exactly ONE outbound request)", async () => {
      const { Nixify, NixifyError } = require("../index.js");
      const mock = mockFetch([{
        status: 500,
        body: { error: { code: "internal_error", message: "boom" }, request_id: "r1" },
        headers: { "X-Request-Id": "r1" },
      }]);
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey", { maxRetries: 2 });
      try {
        await nixify.otp.resend({ email: "user@example.com", purpose: "signup" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(NixifyError);
        expect(err.status).toBe(500);
      }
      expect(mock.calls).toHaveLength(1);
    });

    it("verify 5xx is NOT retried and FAILS CLOSED (exactly ONE outbound request)", async () => {
      const { Nixify, NixifyError } = require("../index.js");
      const mock = mockFetch([{
        status: 502,
        body: { error: { code: "internal_error", message: "Bad gateway" }, request_id: "r1" },
        headers: { "X-Request-Id": "r1" },
      }]);
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey", { maxRetries: 2 });
      try {
        await nixify.otp.verify({ email: "user@example.com", code: "123456" });
        expect.fail("should have thrown");
      } catch (err) {
        // Fail-closed: throws NixifyError, never resolves to { verified: false }.
        expect(err).toBeInstanceOf(NixifyError);
        expect(err.status).toBe(502);
      }
      expect(mock.calls).toHaveLength(1);
    });

    it("504 Gateway Timeout is NOT retried (ambiguous OTP mutation)", async () => {
      const { Nixify } = require("../index.js");
      const mock = mockFetch([{
        status: 504,
        body: { error: { code: "gateway_timeout", message: "upstream timeout" }, request_id: "r1" },
        headers: { "X-Request-Id": "r1" },
      }]);
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey", { maxRetries: 2 });
      try {
        await nixify.otp.send({ email: "user@example.com" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err.status).toBe(504);
      }
      expect(mock.calls).toHaveLength(1);
    });

    // ---- network error: NOT retried (we don't know if the request landed) ----

    it("send network error is NOT retried (exactly ONE outbound request)", async () => {
      const { Nixify, NixifyError } = require("../index.js");
      const mock = networkErrorFetch("ECONNRESET");
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey", { maxRetries: 2 });
      try {
        await nixify.otp.send({ email: "user@example.com" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(NixifyError);
        expect(err.code).toBe("network_error");
        expect(err.status).toBe(0);
      }
      expect(mock.calls).toHaveLength(1);
    });

    it("resend network error is NOT retried (exactly ONE outbound request)", async () => {
      const { Nixify } = require("../index.js");
      const mock = networkErrorFetch("ECONNRESET");
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey", { maxRetries: 2 });
      try {
        await nixify.otp.resend({ email: "user@example.com", purpose: "signup" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err.code).toBe("network_error");
      }
      expect(mock.calls).toHaveLength(1);
    });

    it("verify network error is NOT retried and FAILS CLOSED (exactly ONE outbound request)", async () => {
      const { Nixify, NixifyError } = require("../index.js");
      const mock = networkErrorFetch("ECONNRESET");
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey", { maxRetries: 2 });
      try {
        await nixify.otp.verify({ email: "user@example.com", code: "123456" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(NixifyError);
        expect(err.code).toBe("network_error");
      }
      expect(mock.calls).toHaveLength(1);
    });

    // ---- timeout: NOT retried (ambiguous server state) ----

    it("send timeout is NOT retried (exactly ONE outbound request)", async () => {
      const { Nixify, NixifyError } = require("../index.js");
      const mock = timeoutFetch();
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey", { timeout: 100, maxRetries: 2 });
      try {
        await nixify.otp.send({ email: "user@example.com" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(NixifyError);
        expect(err.code).toBe("timeout");
        expect(err.status).toBe(0);
      }
      expect(mock.calls).toHaveLength(1);
    });

    it("resend timeout is NOT retried (exactly ONE outbound request)", async () => {
      const { Nixify } = require("../index.js");
      const mock = timeoutFetch();
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey", { timeout: 100, maxRetries: 2 });
      try {
        await nixify.otp.resend({ email: "user@example.com", purpose: "signup" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err.code).toBe("timeout");
      }
      expect(mock.calls).toHaveLength(1);
    });

    it("verify timeout is NOT retried and FAILS CLOSED (exactly ONE outbound request)", async () => {
      const { Nixify, NixifyError } = require("../index.js");
      const mock = timeoutFetch();
      globalThis.fetch = mock;

      const nixify = new Nixify("mg_live_mykey", { timeout: 100, maxRetries: 2 });
      try {
        await nixify.otp.verify({ email: "user@example.com", code: "123456" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(NixifyError);
        expect(err.code).toBe("timeout");
      }
      expect(mock.calls).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Security: API key never leaks
  // ==========================================================================

  it("API key is never included in logger output", async () => {
    const { Nixify } = require("../index.js");
    const logEntries = [];
    const logger = (entry) => logEntries.push(entry);
    const mock = mockFetch([{ status: 200, body: { otp_request_id: "otp-1", request_id: "r1", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_SECRET_KEY_DO_NOT_LEAK", { logger });
    await nixify.otp.send({ email: "user@example.com" });

    const allLogs = JSON.stringify(logEntries);
    expect(allLogs).not.toContain("mg_live_SECRET_KEY_DO_NOT_LEAK");
    expect(allLogs).not.toContain("SECRET_KEY");
  });

  it("API key is never in NixifyError properties", async () => {
    const { Nixify } = require("../index.js");
    const mock = mockFetch([{
      status: 401,
      body: { error: { code: "unauthorized", message: "Invalid API key.", doc_url: "/docs#error-unauthorized" }, request_id: "r1" },
      headers: { "X-Request-Id": "r1" },
    }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_SECRET_KEY");
    try {
      await nixify.otp.send({ email: "user@example.com" });
    } catch (err) {
      const errStr = JSON.stringify({ code: err.code, status: err.status, message: err.message, requestId: err.requestId, docUrl: err.docUrl });
      expect(errStr).not.toContain("mg_live_SECRET_KEY");
      expect(errStr).not.toContain("SECRET_KEY");
    }
  });

  it("logger entries contain method/path/status/attempt (never the API key)", async () => {
    const { Nixify } = require("../index.js");
    const logEntries = [];
    const logger = (entry) => logEntries.push(entry);
    const mock = mockFetch([{ status: 200, body: { otp_request_id: "otp-1", request_id: "r1", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey", { logger });
    await nixify.otp.send({ email: "user@example.com" });

    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].method).toBe("POST");
    expect(logEntries[0].path).toBe("/api/v1/otp/send");
    expect(logEntries[0].status).toBe(200);
    expect(logEntries[0].attempt).toBe(0);
  });
});
