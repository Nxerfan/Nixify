/**
 * Nixify Node.js SDK — TypeScript type definitions.
 *
 * These types describe the public surface of the SDK. They mirror the v1 REST
 * API contract exactly and stay in lock-step with the CJS runtime in index.js.
 *
 * Availability: this SDK ships inside the Nixify repository
 * (https://github.com/Nxerfan/Nixify) under sdk/nodejs/. It is NOT published
 * to npm. See sdk/nodejs/README.md for local usage.
 *
 * Public contract: CommonJS named exports only — `Nixify` and `NixifyError`.
 * There is no default export (kept identical across the CJS runtime, Node ESM
 * interop, and these declarations).
 */

// ---- Errors -----------------------------------------------------------------

export interface NixifyErrorOptions {
  code?: string;
  status?: number;
  requestId?: string | null;
  docUrl?: string | null;
}

export class NixifyError extends Error {
  /** Machine-readable error code from the API (e.g. "unauthorized"). */
  readonly code: string;
  /** HTTP status code (0 for network/timeout errors). */
  readonly status: number;
  /** The X-Request-Id / request_id from the response, if available. */
  readonly requestId: string | null;
  /** Doc URL for the error code, if the API provided one. */
  readonly docUrl: string | null;

  constructor(message: string, opts?: NixifyErrorOptions);
}

// ---- Common types -----------------------------------------------------------

export type OtpPurpose = "signup" | "login" | "reset";

export interface NixifyOptions {
  /** API base URL. Default: https://nixify.ir */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Default: 30000 */
  timeout?: number;
  /**
   * Number of retries on HTTP 429 only (honoring Retry-After). 5xx, network
   * errors, timeouts, and non-429 4xx are never retried automatically.
   * Default: 2
   */
  maxRetries?: number;
  /**
   * Logger — either a function `(entry: LogEntry) => void` or an object with
   * `info` / `log` / `debug`. Default: noop.
   * The API key is NEVER included in log entries.
   */
  logger?:
    | ((entry: LogEntry) => void)
    | { info?: (e: LogEntry) => void; log?: (e: LogEntry) => void; debug?: (e: LogEntry) => void };
}

export interface LogEntry {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  attempt: number;
  requestId?: string | null;
  error?: NixifyError;
  willRetry?: boolean;
}

// ---- Request / response types ----------------------------------------------

export interface OtpSendParams {
  email: string;
  purpose?: OtpPurpose;
}

export interface OtpSendResponse {
  /** OTP correlation ID — identifies the exact OTP row. */
  otp_request_id: string;
  /** API trace ID — identifies the HTTP request. */
  request_id: string;
  message: string;
  expires_at: string;
  /** Returned ONLY in sandbox/development mode (mg_test_* keys). */
  code?: string;
}

export interface OtpVerifyParams {
  email: string;
  code: string;
  purpose?: OtpPurpose;
}

export interface OtpVerifyResponse {
  verified: boolean;
  /** API trace ID — identifies the HTTP request. */
  request_id: string;
  /** OTP correlation ID — identifies the exact OTP row that was consumed. */
  otp_request_id: string;
}

export interface OtpResendParams {
  email: string;
  purpose: OtpPurpose;
}

export type OtpResendResponse = OtpSendResponse;

// ---- Client class -----------------------------------------------------------

export interface OtpResource {
  send(params: OtpSendParams): Promise<OtpSendResponse>;
  verify(params: OtpVerifyParams): Promise<OtpVerifyResponse>;
  resend(params: OtpResendParams): Promise<OtpResendResponse>;
}

export class Nixify {
  constructor(apiKey: string, options?: NixifyOptions);

  /** The configured API key (read-only). */
  readonly apiKey: string;
  /** The configured base URL (no trailing slash). Default: https://nixify.ir */
  readonly baseUrl: string;
  /** Per-request timeout in ms. */
  readonly timeout: number;
  /** Max retry count for HTTP 429 only. */
  readonly maxRetries: number;

  /**
   * Low-level request helper. Sets Authorization, Content-Type, and
   * User-Agent. No Idempotency-Key is sent — the Nixify OTP API does not
   * implement server-side deduplication on /otp/send or /otp/resend, so
   * retries are conservative (429 only, honoring Retry-After). 5xx, network
   * errors, and timeouts are never retried automatically. Throws
   * `NixifyError` on non-2xx.
   */
  request<T = unknown>(method: string, path: string, body?: unknown): Promise<T>;

  /** OTP sub-resource. */
  get otp(): OtpResource;
}

// ---- Public contract: named exports only (no default export) --------------
// `export default` is intentionally OMITTED so the TypeScript declarations
// and the CJS runtime (module.exports = { Nixify, NixifyError }) describe the
// exact same surface. Import like:
//   import { Nixify, NixifyError } from "./nixify-sdk";
