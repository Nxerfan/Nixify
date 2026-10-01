/**
 * @nixify/nodejs — TypeScript type definitions.
 *
 * These types describe the public surface of the SDK. They mirror the v1 REST
 * API contract exactly.
 *
 * This SDK is present in the Nixify repository. npm publication status is not
 * implied — clone the repo or copy the files to use it.
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
  /** Number of retries on 429/5xx with exponential backoff. Default: 2 */
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
  /** Max retry count for 429/5xx. */
  readonly maxRetries: number;

  /**
   * Low-level request helper. Sets Authorization, Content-Type, and
   * (for send/resend) an auto-generated Idempotency-Key that is reused
   * across retry attempts. Implements exponential backoff on 429/5xx.
   * Throws `NixifyError` on non-2xx.
   */
  request<T = unknown>(method: string, path: string, body?: unknown): Promise<T>;

  /** OTP sub-resource. */
  get otp(): OtpResource;
}

export default Nixify;
