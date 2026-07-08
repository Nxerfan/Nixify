/**
 * @mailguard/nodejs — TypeScript type definitions.
 *
 * These types describe the public surface of the SDK. They mirror the v1 REST
 * API contract exactly.
 */

// ---- Errors -----------------------------------------------------------------

export interface MailGuardErrorOptions {
  code?: string;
  status?: number;
  requestId?: string | null;
  docUrl?: string | null;
}

export class MailGuardError extends Error {
  /** Machine-readable error code from the API (e.g. "unauthorized"). */
  readonly code: string;
  /** HTTP status code (0 for network/timeout errors). */
  readonly status: number;
  /** The X-Request-Id from the response, if available. */
  readonly requestId: string | null;
  /** Doc URL for the error code, if the API provided one. */
  readonly docUrl: string | null;

  constructor(message: string, opts?: MailGuardErrorOptions);
}

// ---- Common types -----------------------------------------------------------

export type OtpPurpose = "signup" | "login" | "reset";

export interface MailGuardOptions {
  /** API base URL. Default: http://localhost:3000 */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Default: 30000 */
  timeout?: number;
  /** Number of retries on 429/5xx with exponential backoff. Default: 2 */
  maxRetries?: number;
  /**
   * Logger — either a function `(entry: LogEntry) => void` or an object with
   * `info` / `log` / `debug`. Default: noop.
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
  error?: MailGuardError;
  willRetry?: boolean;
}

// ---- Request / response types ----------------------------------------------

export interface OtpSendParams {
  email: string;
  purpose?: OtpPurpose;
}

export interface OtpSendResponse {
  request_id: string;
  message: string;
  expires_at: string;
  /** Returned ONLY in sandbox/development mode (mg_test_* keys). */
  code?: string;
}

export interface OtpVerifyParams {
  email: string;
  code: string;
}

export interface OtpVerifyResponse {
  verified: boolean;
  request_id: string;
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

export class MailGuard {
  constructor(apiKey: string, options?: MailGuardOptions);

  /** The configured API key (read-only). */
  readonly apiKey: string;
  /** The configured base URL (no trailing slash). */
  readonly baseUrl: string;
  /** Per-request timeout in ms. */
  readonly timeout: number;
  /** Max retry count for 429/5xx. */
  readonly maxRetries: number;

  /**
   * Low-level request helper. Sets Authorization, Content-Type, and
   * (for send/resend) an auto-generated Idempotency-Key. Implements
   * exponential backoff on 429/5xx. Throws `MailGuardError` on non-2xx.
   */
  request<T = unknown>(method: string, path: string, body?: unknown): Promise<T>;

  /** OTP sub-resource. */
  get otp(): OtpResource;
}

export default MailGuard;
