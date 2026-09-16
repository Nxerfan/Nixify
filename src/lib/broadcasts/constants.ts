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

/**
 * Recipient state machine (with durable exclusive dispatch):
 *
 *   pending → processing → dispatching → sent | skipped | failed
 *
 * - pending:     queued for any worker to claim.
 * - processing:  claimed by a worker via CAS (lockedBy=workerId). NO external
 *                I/O has occurred yet. Safe to stale-recover → pending.
 * - dispatching: durable exclusive dispatch state established via CAS
 *                (processing → dispatching WHERE lockedBy=workerId). ONLY
 *                this worker may call provider.send(). NEVER auto-requeued —
 *                stale dispatching rows become terminal `failed` with
 *                errorCode=provider_outcome_unknown after a safe timeout.
 * - sent/skipped/failed: terminal. Terminal CAS verifies lockedBy=workerId.
 *
 * The `dispatching` status is just another string value in the `status` column
 * — no schema change needed.
 */
export const RECIPIENT_STATUSES = {
  PENDING: "pending",
  PROCESSING: "processing",
  DISPATCHING: "dispatching",
  SENT: "sent",
  SKIPPED: "skipped",
  FAILED: "failed",
} as const;
export type RecipientStatus = (typeof RECIPIENT_STATUSES)[keyof typeof RECIPIENT_STATUSES];

/**
 * Statuses that are safe to stale-recover (no external I/O yet).
 * recoverStaleRecipients() ONLY recovers `processing` rows → `pending`.
 * It MUST NOT recover `dispatching` rows — those have entered the durable
 * exclusive dispatch state and may have called the provider. Stale
 * dispatching rows are handled by recoverAbandonedDispatches() → terminal
 * `failed` with errorCode=provider_outcome_unknown.
 */
export const RECOVERABLE_STATUSES: ReadonlySet<string> = new Set([
  RECIPIENT_STATUSES.PROCESSING,
]);

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
  PROVIDER_OUTCOME_UNKNOWN: "provider_outcome_unknown",
  // Phase 11 audit — accepted=false: the provider returned a normalized
  // rejection (promise resolved, but accepted=false). Distinct from
  // provider_error (the provider threw). The recipient MUST NOT become `sent`.
  PROVIDER_REJECTED: "provider_rejected",
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

/** Stale lock timeout for recipient PROCESSING (no external I/O yet). 10 min. */
export const BROADCAST_STALE_LOCK_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Dispatch timeout: stale DISPATCHING rows older than this are transitioned
 * to terminal `failed` with errorCode=provider_outcome_unknown.
 *
 * 30 minutes is generous enough that even a slow SMTP provider completes, but
 * short enough that a truly crashed worker's recipients don't hang forever.
 * Stale dispatching rows are NEVER auto-requeued to pending — they may have
 * already initiated provider.send() and the outcome is ambiguous.
 */
export const BROADCAST_DISPATCH_TIMEOUT_MS = 30 * 60 * 1000;

/** Review threshold: campaigns with more than this many recipients require admin approval. */
export const BROADCAST_REVIEW_THRESHOLD = 1000;

/** Content size limits. */
export const MAX_SUBJECT_LENGTH = 200;
export const MAX_HTML_CONTENT_BYTES = 500_000; // 500KB
export const MAX_TEXT_CONTENT_BYTES = 200_000; // 200KB

/** Idempotency key length bounds (matches transactional Send convention). */
export const IDEMPOTENCY_KEY_MIN = 8;
export const IDEMPOTENCY_KEY_MAX = 128;
