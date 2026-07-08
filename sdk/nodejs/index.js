/**
 * @mailguard/nodejs — Official Node.js SDK for the MailGuard OTP platform.
 *
 * CommonJS module — works without a build step. Requires Node 18+ (uses the
 * built-in global `fetch`, `AbortController`, and `crypto.randomUUID`).
 *
 * Quick start:
 *   const { MailGuard } = require("@mailguard/nodejs");
 *   const mg = new MailGuard("mg_live_xxx", { baseUrl: "https://api.mailguard.dev" });
 *   const { request_id, expires_at } = await mg.otp.send({ email: "user@example.com" });
 *   await mg.otp.verify({ email: "user@example.com", code: "123456" });
 *
 * Errors: any non-2xx response throws a `MailGuardError` with `code`, `status`,
 * `requestId`, and `docUrl` populated from the API error shape:
 *   { error: { code, message, doc_url }, request_id }
 */

"use strict";

const { randomUUID } = require("crypto");

// ---- Defaults ---------------------------------------------------------------

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const BACKOFF_MS = [500, 1_000, 2_000]; // exponential backoff schedule

// ---- Errors -----------------------------------------------------------------

/**
 * Error thrown for any non-2xx API response. Constructed from the API error
 * shape `{ error: { code, message, doc_url }, request_id }`. Network failures
 * and timeouts also surface as `MailGuardError` with code `"network_error"` or
 * `"timeout"`.
 */
class MailGuardError extends Error {
  /**
   * @param {string} message  Human-readable error message.
   * @param {object} opts
   * @param {string} [opts.code]      Machine-readable error code from the API.
   * @param {number} [opts.status]    HTTP status code (0 for network failures).
   * @param {string} [opts.requestId] The X-Request-Id from the response.
   * @param {string} [opts.docUrl]    Doc URL for the error code.
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "MailGuardError";
    this.code = opts.code ?? "unknown_error";
    this.status = opts.status ?? 0;
    this.requestId = opts.requestId ?? null;
    this.docUrl = opts.docUrl ?? null;
  }
}

// ---- SDK --------------------------------------------------------------------

/**
 * MailGuard SDK client.
 *
 * Options:
 *   - baseUrl:     API base URL (default: http://localhost:3000)
 *   - timeout:     per-request timeout in ms (default: 30000)
 *   - maxRetries:  number of retries on 429/5xx (default: 2)
 *   - logger:      { log, info, warn, error } or any function — receives one
 *                  object per request: { method, path, status, durationMs,
 *                  attempt, requestId?, error? }
 */
class MailGuard {
  /**
   * @param {string} apiKey  MailGuard API key (mg_live_* or mg_test_*)
   * @param {object} [options]
   * @param {string} [options.baseUrl]
   * @param {number} [options.timeout]
   * @param {number} [options.maxRetries]
   * @param {object|function} [options.logger]
   */
  constructor(apiKey, options = {}) {
    if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
      throw new MailGuardError("API key is required. Pass a non-empty string (mg_live_* or mg_test_*).", {
        code: "invalid_api_key",
        status: 0,
      });
    }
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.logger = normalizeLogger(options.logger);
  }

  /**
   * Internal request helper. Sets Authorization + Content-Type + an
   * auto-generated Idempotency-Key on send/resend (so retries don't double-send).
   * Implements exponential backoff (0.5s, 1s, 2s) on 429/5xx. Honors timeout
   * via AbortController. Throws `MailGuardError` on non-2xx.
   *
   * @param {string} method  HTTP method ("POST", "GET", ...)
   * @param {string} path    Path beginning with "/api/v1/..."
   * @param {object} [body]  JSON-serializable request body.
   * @returns {Promise<object>} Parsed JSON response.
   */
  async request(method, path, body) {
    const url = this.baseUrl + path;
    const isOtpSend = path === "/api/v1/otp/send" || path === "/api/v1/otp/resend";

    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      const start = Date.now();

      // Auto-generate an Idempotency-Key for send/resend so retries are safe.
      const headers = {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "@mailguard/nodejs/1.0.0",
      };
      if (isOtpSend) headers["Idempotency-Key"] = randomUUID();

      let res;
      try {
        res = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        const isAbort = err && (err.name === "AbortError" || controller.signal.aborted);
        const errorObj = isAbort
          ? new MailGuardError(`Request timed out after ${this.timeout}ms`, { code: "timeout", status: 0 })
          : new MailGuardError(err && err.message ? err.message : "Network error", {
              code: "network_error",
              status: 0,
            });
        this._log({ method, path, status: 0, durationMs: Date.now() - start, attempt, error: errorObj });
        // Network errors and timeouts are not retried (timeout already means we
        // don't know if the request reached the server).
        throw errorObj;
      }
      clearTimeout(timer);

      const durationMs = Date.now() - start;
      const requestId = res.headers.get("X-Request-Id");
      const contentType = res.headers.get("content-type") || "";

      // Parse the body. The MailGuard API always returns JSON, but if a proxy
      // returns HTML (e.g. 404 from a misconfigured base URL), we degrade
      // gracefully.
      let json = null;
      if (contentType.includes("application/json")) {
        try {
          json = await res.json();
        } catch {
          json = null;
        }
      }

      // 2xx — success.
      if (res.ok) {
        this._log({ method, path, status: res.status, durationMs, attempt, requestId });
        return json ?? {};
      }

      // Build the error from the API error shape.
      const errShape = (json && json.error) || {};
      const errorObj = new MailGuardError(errShape.message || `HTTP ${res.status}`, {
        code: errShape.code || "http_error",
        status: res.status,
        requestId: requestId || (json && json.request_id) || null,
        docUrl: errShape.doc_url || null,
      });

      // Retry on 429 and 5xx (but only if attempts remain).
      const shouldRetry = (res.status === 429 || res.status >= 500) && attempt < this.maxRetries;
      this._log({ method, path, status: res.status, durationMs, attempt, requestId, error: errorObj, willRetry: shouldRetry });
      if (shouldRetry) {
        lastError = errorObj;
        await sleep(BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1]);
        continue;
      }

      throw errorObj;
    }

    // We only get here if all retries were exhausted.
    throw lastError || new MailGuardError("Request failed after retries", { code: "retries_exhausted", status: 0 });
  }

  /**
   * Log a request via the configured logger. Best-effort — never throws.
   * @private
   */
  _log(entry) {
    try {
      this.logger(entry);
    } catch {
      /* swallow logger errors */
    }
  }

  /** OTP sub-resource: send / verify / resend. */
  get otp() {
    const self = this;
    return {
      /**
       * Send an OTP.
       * @param {object} params
       * @param {string} params.email     Recipient email.
       * @param {("signup"|"login"|"reset")} [params.purpose] Defaults to "signup".
       * @returns {Promise<object>} { request_id, message, expires_at, code? }
       */
      send(params) {
        if (!params || typeof params !== "object") {
          throw new MailGuardError("otp.send requires an object with at least `email`.", { code: "invalid_params", status: 0 });
        }
        return self.request("POST", "/api/v1/otp/send", params);
      },

      /**
       * Verify an OTP code.
       * @param {object} params
       * @param {string} params.email
       * @param {string} params.code  6-digit code.
       * @returns {Promise<object>} { verified, request_id }
       */
      verify(params) {
        if (!params || typeof params !== "object") {
          throw new MailGuardError("otp.verify requires an object with `email` and `code`.", { code: "invalid_params", status: 0 });
        }
        return self.request("POST", "/api/v1/otp/verify", params);
      },

      /**
       * Resend an OTP.
       * @param {object} params
       * @param {string} params.email
       * @param {("signup"|"login"|"reset")} params.purpose  Required for resend.
       * @returns {Promise<object>} { request_id, message, expires_at, code? }
       */
      resend(params) {
        if (!params || typeof params !== "object") {
          throw new MailGuardError("otp.resend requires an object with `email` and `purpose`.", { code: "invalid_params", status: 0 });
        }
        return self.request("POST", "/api/v1/otp/resend", params);
      },
    };
  }
}

// ---- Helpers ----------------------------------------------------------------

/** Coerce the user-provided logger option into a single function. */
function normalizeLogger(logger) {
  if (typeof logger === "function") return logger;
  if (logger && typeof logger === "object") {
    const fn = logger.info || logger.log || logger.debug;
    if (typeof fn === "function") return (entry) => fn.call(logger, entry);
  }
  return () => {}; // noop
}

/** Promise-based sleep. */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Exports ----------------------------------------------------------------

module.exports = { MailGuard, MailGuardError };
module.exports.MailGuard = MailGuard;
module.exports.MailGuardError = MailGuardError;
module.exports.default = { MailGuard, MailGuardError };
