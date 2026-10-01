import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// The SDK is CommonJS (module.exports). Under ESM, the named exports are
// on the default export. Use createRequire to get the CJS namespace.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Nixify, NixifyError } = require("../index.js");

// ---- Mock fetch helper -----------------------------------------------------

/**
 * Create a mock fetch that returns canned responses in sequence.
 * Each response: { status, body, headers }
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

  // ---- Default base URL ----

  it("default base URL is https://nixify.ir", () => {
    const nixify = new Nixify("mg_live_test123");
    expect(nixify.baseUrl).toBe("https://nixify.ir");
  });

  it("custom baseUrl overrides default", () => {
    const nixify = new Nixify("mg_live_test123", { baseUrl: "http://localhost:3000" });
    expect(nixify.baseUrl).toBe("http://localhost:3000");
  });

  it("trailing slashes are normalized", () => {
    const nixify = new Nixify("mg_live_test123", { baseUrl: "https://nixify.ir/" });
    expect(nixify.baseUrl).toBe("https://nixify.ir");
    const nixify2 = new Nixify("mg_live_test123", { baseUrl: "https://nixify.ir//" });
    expect(nixify2.baseUrl).toBe("https://nixify.ir");
  });

  // ---- Authorization header ----

  it("sets Authorization header with Bearer token", async () => {
    const mock = mockFetch([{ status: 200, body: { otp_request_id: "otp-1", request_id: "req-1", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey");
    await nixify.otp.send({ email: "user@example.com" });

    expect(mock.calls[0].headers["Authorization"]).toBe("Bearer mg_live_mykey");
  });

  // ---- Send request ----

  it("send request posts to /api/v1/otp/send with email", async () => {
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
    const mock = mockFetch([{ status: 200, body: { otp_request_id: "otp-1", request_id: "req-1", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey");
    await nixify.otp.send({ email: "user@example.com", purpose: "login" });

    expect(JSON.parse(mock.calls[0].init.body)).toEqual({ email: "user@example.com", purpose: "login" });
  });

  it("send response includes sandbox code for mg_test_ keys", async () => {
    const mock = mockFetch([{ status: 200, body: { otp_request_id: "otp-1", request_id: "req-1", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z", code: "123456" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_test_mykey");
    const result = await nixify.otp.send({ email: "user@example.com" });

    expect(result.code).toBe("123456");
  });

  // ---- Verify request + purpose ----

  it("verify request posts to /api/v1/otp/verify with email + code", async () => {
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
    const mock = mockFetch([{ status: 200, body: { verified: true, request_id: "req-1", otp_request_id: "otp-1" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey");
    await nixify.otp.verify({ email: "user@example.com", code: "123456", purpose: "reset" });

    expect(JSON.parse(mock.calls[0].init.body)).toEqual({ email: "user@example.com", code: "123456", purpose: "reset" });
  });

  it("verify response includes otp_request_id (not just request_id)", async () => {
    const mock = mockFetch([{ status: 200, body: { verified: true, request_id: "trace-123", otp_request_id: "otp-456" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey");
    const result = await nixify.otp.verify({ email: "user@example.com", code: "123456" });

    expect(result.request_id).toBe("trace-123");
    expect(result.otp_request_id).toBe("otp-456");
    expect(result.request_id).not.toBe(result.otp_request_id);
  });

  // ---- Resend request ----

  it("resend request posts to /api/v1/otp/resend with email + purpose", async () => {
    const mock = mockFetch([{ status: 200, body: { otp_request_id: "otp-2", request_id: "req-2", message: "OTP resent", expires_at: "2026-01-01T00:00:00Z" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey");
    const result = await nixify.otp.resend({ email: "user@example.com", purpose: "signup" });

    expect(mock.calls[0].url).toBe("https://nixify.ir/api/v1/otp/resend");
    expect(JSON.parse(mock.calls[0].init.body)).toEqual({ email: "user@example.com", purpose: "signup" });
    expect(result.otp_request_id).toBe("otp-2");
    expect(result.request_id).toBe("req-2");
    expect(result.message).toBe("OTP resent");
  });

  // ---- send response: request_id vs otp_request_id ----

  it("send response distinguishes request_id (trace) from otp_request_id (correlation)", async () => {
    const mock = mockFetch([{ status: 200, body: { otp_request_id: "otp-abc", request_id: "req-xyz", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey");
    const result = await nixify.otp.send({ email: "user@example.com" });

    expect(result.otp_request_id).toBe("otp-abc");
    expect(result.request_id).toBe("req-xyz");
    expect(result.otp_request_id).not.toBe(result.request_id);
  });

  // ---- API error parsing ----

  it("API error response is parsed into NixifyError with code + message + doc_url", async () => {
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

  // ---- Malformed/non-JSON error ----

  it("malformed non-JSON response is handled safely", async () => {
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
  });

  // ---- Timeout ----

  it("timeout throws NixifyError with code 'timeout'", async () => {
    const mock = vi.fn(async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    });
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey", { timeout: 100 });
    try {
      await nixify.otp.send({ email: "user@example.com" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(NixifyError);
      expect(err.code).toBe("timeout");
      expect(err.status).toBe(0);
    }
  });

  // ---- 429 retry + Retry-After ----

  it("429 retries and honors Retry-After header", async () => {
    const responses = [
      { status: 429, body: { error: { code: "rate_limited", message: "Too many requests" }, request_id: "r1" }, headers: { "Retry-After": "0.01", "X-Request-Id": "r1" } },
      { status: 200, body: { otp_request_id: "otp-1", request_id: "r2", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" }, headers: { "X-Request-Id": "r2" } },
    ];
    const mock = mockFetch(responses);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey", { maxRetries: 2 });
    const result = await nixify.otp.send({ email: "user@example.com" });

    expect(mock.calls).toHaveLength(2);
    expect(result.otp_request_id).toBe("otp-1");
  });

  // ---- 5xx retry ----

  it("5xx retries with backoff", async () => {
    const responses = [
      { status: 503, body: { error: { code: "internal_error", message: "Service unavailable" }, request_id: "r1" }, headers: { "X-Request-Id": "r1" } },
      { status: 200, body: { otp_request_id: "otp-1", request_id: "r2", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" }, headers: { "X-Request-Id": "r2" } },
    ];
    const mock = mockFetch(responses);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey", { maxRetries: 2 });
    const result = await nixify.otp.send({ email: "user@example.com" });

    expect(mock.calls).toHaveLength(2);
    expect(result.otp_request_id).toBe("otp-1");
  });

  // ---- No retry on 4xx (except 429) ----

  it("400 is not retried", async () => {
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

  // ---- Same Idempotency-Key reused across retries ----

  it("same Idempotency-Key is reused across retry attempts for send", async () => {
    const responses = [
      { status: 503, body: { error: { code: "internal_error", message: "Service unavailable" }, request_id: "r1" }, headers: { "X-Request-Id": "r1" } },
      { status: 200, body: { otp_request_id: "otp-1", request_id: "r2", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" }, headers: { "X-Request-Id": "r2" } },
    ];
    const mock = mockFetch(responses);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey", { maxRetries: 2 });
    await nixify.otp.send({ email: "user@example.com" });

    const key1 = mock.calls[0].headers["Idempotency-Key"];
    const key2 = mock.calls[1].headers["Idempotency-Key"];
    expect(key1).toBeDefined();
    expect(key2).toBeDefined();
    expect(key1).toBe(key2); // SAME key reused
  });

  it("same Idempotency-Key is reused across retry attempts for resend", async () => {
    const responses = [
      { status: 503, body: { error: { code: "internal_error", message: "Service unavailable" }, request_id: "r1" }, headers: { "X-Request-Id": "r1" } },
      { status: 200, body: { otp_request_id: "otp-1", request_id: "r2", message: "OTP resent", expires_at: "2026-01-01T00:00:00Z" }, headers: { "X-Request-Id": "r2" } },
    ];
    const mock = mockFetch(responses);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey", { maxRetries: 2 });
    await nixify.otp.resend({ email: "user@example.com", purpose: "signup" });

    const key1 = mock.calls[0].headers["Idempotency-Key"];
    const key2 = mock.calls[1].headers["Idempotency-Key"];
    expect(key1).toBe(key2);
  });

  it("verify does NOT send Idempotency-Key", async () => {
    const mock = mockFetch([{ status: 200, body: { verified: true, request_id: "r1", otp_request_id: "otp-1" } }]);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey");
    await nixify.otp.verify({ email: "user@example.com", code: "123456" });

    expect(mock.calls[0].headers["Idempotency-Key"]).toBeUndefined();
  });

  // ---- Separate SDK calls get different idempotency keys ----

  it("separate SDK calls get different idempotency keys", async () => {
    const responses = [
      { status: 200, body: { otp_request_id: "otp-1", request_id: "r1", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" }, headers: { "X-Request-Id": "r1" } },
      { status: 200, body: { otp_request_id: "otp-2", request_id: "r2", message: "OTP sent", expires_at: "2026-01-01T00:00:00Z" }, headers: { "X-Request-Id": "r2" } },
    ];
    const mock = mockFetch(responses);
    globalThis.fetch = mock;

    const nixify = new Nixify("mg_live_mykey");
    await nixify.otp.send({ email: "user1@example.com" });
    await nixify.otp.send({ email: "user2@example.com" });

    const key1 = mock.calls[0].headers["Idempotency-Key"];
    const key2 = mock.calls[1].headers["Idempotency-Key"];
    expect(key1).toBeDefined();
    expect(key2).toBeDefined();
    expect(key1).not.toBe(key2); // DIFFERENT keys
  });

  // ---- API key never in logger output ----

  it("API key is never included in logger output", async () => {
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
});
