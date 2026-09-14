/**
 * Events public API (Phase 6).
 */
export {
  ingestEvent,
  EventValidationError,
  IdempotencyConflictError,
  type IngestEventInput,
  type IngestResult,
} from "./service";

export {
  createEventSchema,
  isReservedEventType,
  validateEventData,
  isValidIdempotencyKey,
  MAX_EVENT_TYPE_LENGTH,
  MAX_DATA_BYTES,
  MAX_DATA_DEPTH,
  MAX_DATA_KEYS,
  IDEMPOTENCY_KEY_MIN,
  IDEMPOTENCY_KEY_MAX,
  type CreateEventInput,
} from "./validation";

export {
  hashIdempotencyKey,
  computeRequestFingerprint,
  canonicalize,
} from "./idempotency";
