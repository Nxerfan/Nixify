/**
 * Messaging public API (Phase 4).
 *
 * Routes import from here. The provider is injected by the caller (the route
 * constructs the SmtpEmailProvider for production use; tests inject a fake).
 */
export {
  sendTransactionalEmail,
  MessagingValidationError,
  IdempotencyConflictError,
  MessagingQuotaError,
  type SendRequest,
  type SendResult,
  type MessageSource,
} from "./service";

export {
  sendV1Schema,
  dashboardTestSendSchema,
  normalizeRecipient,
  isValidIdempotencyKey,
  IDEMPOTENCY_KEY_MIN,
  IDEMPOTENCY_KEY_MAX,
  type SendV1Input,
  type DashboardTestSendInput,
} from "./validation";

export {
  hashIdempotencyKey,
  computeRequestFingerprint,
  canonicalizeRequest,
} from "./idempotency";

export {
  type EmailProvider,
  type ProviderSendInput,
  type ProviderSendResult,
  ProviderError,
} from "./providers/provider";

export { SmtpEmailProvider } from "./providers/smtp";
