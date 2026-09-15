/**
 * Phase 10 — Broadcast constants.
 *
 * Statuses, skip reasons, limits, and the review threshold.
 */

// ---- Broadcast statuses ---------------------------------------------------

export const BROADCAST_STATUSES = {
  DRAFT: "draft",
  REVIEW_PENDING: "review_pending",
  QUEUED: "queued",
  SENDING: "sending",
  PAUSED_QUOTA: "paused_quota",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REJECTED: "rejected",
  FAILED: "failed",
} as const;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[keyof typeof BROADCAST_STATUSES];

// Statuses that allow cancellation.
export const CANCELLABLE_STATUSES: ReadonlySet<string> = new Set([
  BROADCAST_STATUSES.REVIEW_PENDING,
  BROADCAST_STATUSES.QUEUED,
  BROADCAST_STATUSES.SENDING,
  BROADCAST_STATUSES.PAUSED_QUOTA,
]);

// Statuses that allow content/audience editing.
export const EDITABLE_STATUSES: ReadonlySet<string> = new Set([
  BROADCAST_STATUSES.DRAFT,
]);

// ---- Review statuses ------------------------------------------------------

export const REVIEW_STATUSES = {
  NOT_REQUIRED: "not_required",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[keyof typeof REVIEW_STATUSES];

// ---- Recipient statuses ---------------------------------------------------

export const RECIPIENT_STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  SENT: "sent",
  SKIPPED: "skipped",
  FAILED: "failed",
} as const;
export type RecipientStatus = (typeof RECIPIENT_STATUSES)[keyof typeof RECIPIENT_STATUSES];

// Canonical skip reasons — safe, bounded classifications.
export const SKIP_REASONS = {
  NOT_SUBSCRIBED: "not_subscribed",
  SUPPRESSED: "suppressed",
  CONTACT_NOT_FOUND: "contact_not_found",
  BROADCAST_CANCELLED: "broadcast_cancelled",
  QUOTA_EXHAUSTED: "quota_exhausted",
} as const;
export type SkipReason = (typeof SKIP_REASONS)[keyof typeof SKIP_REASONS];

// Safe error codes for failed sends (never raw provider stack traces).
export const SEND_ERROR_CODES = {
  PROVIDER_ERROR: "provider_error",
  CONFIGURATION_ERROR: "configuration_error",
  CONTENT_RENDER_ERROR: "content_render_error",
  QUOTA_ERROR: "quota_error",
  UNKNOWN: "unknown_processing_error",
} as const;

// ---- Audience types -------------------------------------------------------

export const AUDIENCE_TYPES = {
  ALL_CONTACTS: "all_contacts",
  GROUP: "group",
} as const;
export type AudienceType = (typeof AUDIENCE_TYPES)[keyof typeof AUDIENCE_TYPES];

// ---- Limits ---------------------------------------------------------------

/** Maximum batch size for per-recipient claiming. Hard safe maximum. */
export const BROADCAST_BATCH_SIZE = 25;

/** Stale lock timeout for recipient processing (10 minutes). */
export const BROADCAST_STALE_LOCK_TIMEOUT_MS = 10 * 60 * 1000;

/** Review threshold: campaigns with more than this many recipients require admin approval. */
export const BROADCAST_REVIEW_THRESHOLD = 1000;

/** Content size limits. */
export const MAX_SUBJECT_LENGTH = 200;
export const MAX_HTML_CONTENT_BYTES = 500_000; // 500KB
export const MAX_TEXT_CONTENT_BYTES = 200_000; // 200KB

/** Idempotency key length bounds (matches transactional Send convention). */
export const IDEMPOTENCY_KEY_MIN = 8;
export const IDEMPOTENCY_KEY_MAX = 128;
