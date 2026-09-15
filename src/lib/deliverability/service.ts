/**
 * Deliverability service — central EmailDelivery state machine (Phase 11).
 *
 * DESIGN INVARIANTS:
 *
 * 1. ONE central service for ALL EmailDelivery mutations. Routes and other
 *    services MUST NOT mutate EmailDelivery rows directly — they call
 *    createDelivery / ingestProviderEvent / getDelivery / listDeliveries.
 *
 * 2. EMAIL DELIVERY STATE MACHINE — every EmailDelivery row progresses
 *    through these states (stored on `currentStatus`):
 *
 *      queued                       (initial — created before/around dispatch)
 *        ↓
 *      provider_accepted            (provider.send() resolved with accepted=true)
 *        ↓ ↓ ↓ ↓ ↓
 *      delivered | deferred | bounced | complained | rejected
 *
 *      queued → failed              (provider call threw before acceptance)
 *
 *    Terminal states: delivered, bounced, complained, rejected, failed.
 *    Non-terminal intermediate: deferred (transient bounce — retry-eligible).
 *
 * 3. SMTP ACCEPTANCE ≠ INBOX DELIVERY. `provider_accepted` means the upstream
 *    MTA accepted the envelope. ONLY a real webhook from a webhook-capable
 *    provider can advance to `delivered`. SMTP has `deliveryWebhooks=false`,
 *    so SMTP deliveries stay in `provider_accepted` — this is correct.
 *
 * 4. EVENT HISTORY IS IMMUTABLE + DEDUPED. Every event ever seen is stored
 *    on EmailDeliveryEvent, deduped by `(provider, providerEventId)` unique
 *    constraint. Storing ALL events (even ones that don't change
 *    currentStatus) is a compliance requirement — a delayed "delivered"
 *    after a "complained" must NOT silently hide the complaint.
 *
 * 5. EVENT ORDERING — `currentStatus` is derived from `occurredAt`
 *    timestamps, NOT webhook receipt time. A `delivered` event that arrives
 *    AFTER a `complained` event but occurred BEFORE it does NOT regress the
 *    state to `delivered`. Conversely, a `complained` event with an
 *    `occurredAt` LATER than a prior `delivered` updates the state to
 *    `complained` (compliance-aware: complaints win).
 *
 *    NEVER REGRESS RULES:
 *      - delivered → then an old delayed `deferred` → stay `delivered`.
 *      - complained → then an old delayed `delivered` → stay `complained`
 *        (compliance-aware: a complaint received means the user marked the
 *        email as spam; subsequent delayed "delivered" signals cannot undo
 *        that suppression either).
 *      - bounced (hard) → terminal, no regression.
 *
 * 6. SUPPRESSION INTEGRATION — hard bounce and complaint trigger
 *    `suppressEmail()` from the consent service. Soft/transient bounces do
 *    NOT trigger suppression — they're recorded as events but the delivery
 *    stays in `deferred` (or eventually `failed` if it gives up).
 *
 * 7. CROSS-TENANT ISOLATION — every read/write is tenant-scoped via
 *    composite FK `(userId, deliveryId) → EmailDelivery(userId, id)`. A
 *    cross-tenant providerEventId with the same provider+providerEventId
 *    (from another tenant) cannot mutate this tenant's delivery state
 *    because the lookup is keyed on (provider, providerEventId) which is
 *    globally unique — but the resolved delivery's userId is verified
 *    before mutation. Unknown providerMessageId → no tenant state change.
 *
 * 8. SOURCE CORRELATION — EmailDelivery rows link back to their origin:
 *      - sourceType="broadcast"     → broadcastRecipientId (FK concept)
 *      - sourceType="transactional" → emailMessageId (EmailMessage.messageId)
 *      - sourceType="otp"           → sourceId (future)
 *
 *    These are nullable because Phase 11 only wires broadcast + transactional.
 *
 * 9. IDEMPOTENT EVENT INGEST — `ingestProviderEvent` is safe to call
 *    concurrently. Two simultaneous POSTs of the same (provider,
 *    providerEventId) → one event row, one state mutation. P2002 from the
 *    unique constraint is caught OUTSIDE the tx and resolved by re-reading.
 */

import { db } from "@/lib/db";
import { suppressEmailInTx, CONSENT_SOURCES, SUPPRESSION_REASONS } from "@/lib/consent/service";
import { randomUUID } from "crypto";

// ---- Constants ------------------------------------------------------------

export const DELIVERY_STATUSES = {
  QUEUED: "queued",
  PROVIDER_ACCEPTED: "provider_accepted",
  DELIVERED: "delivered",
  DEFERRED: "deferred",
  BOUNCED: "bounced",
  COMPLAINED: "complained",
  REJECTED: "rejected",
  FAILED: "failed",
  // Phase 11 audit: provider.send() succeeded but DB persistence of the
  // delivery state failed. Distinct from `failed` (provider threw before
  // acceptance) — the external email MAY have been delivered. `unknown` is
  // NEVER auto-retried; broadcast stale recovery skips unknown recipients.
  UNKNOWN: "unknown",
} as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[keyof typeof DELIVERY_STATUSES];

export const DELIVERY_SOURCES = {
  BROADCAST: "broadcast",
  TRANSACTIONAL: "transactional",
  OTP: "otp",
} as const;
export type DeliverySourceType = (typeof DELIVERY_SOURCES)[keyof typeof DELIVERY_SOURCES];

export const PROVIDER_EVENT_TYPES = {
  DELIVERED: "delivered",
  DEFERRED: "deferred",
  BOUNCED: "bounced",
  COMPLAINED: "complained",
  REJECTED: "rejected",
} as const;
export type ProviderEventType = (typeof PROVIDER_EVENT_TYPES)[keyof typeof PROVIDER_EVENT_TYPES];

/** Bounce subtypes that drive suppression decisions. */
export const BOUNCE_TYPES = {
  HARD: "hard",
  SOFT: "soft",
} as const;
export type BounceType = (typeof BOUNCE_TYPES)[keyof typeof BOUNCE_TYPES];

// All terminal states — once entered, no further state mutation.
// `unknown` is treated as terminal w.r.t. auto-retry (NEVER re-sent) but a
// later webhook event with a newer occurredAt can still advance it to a
// concrete terminal state (delivered, bounced, complained). The transition
// matrix below encodes the precedence rules explicitly.
const TERMINAL_STATUSES: ReadonlySet<DeliveryStatus> = new Set<DeliveryStatus>([
  DELIVERY_STATUSES.DELIVERED,
  DELIVERY_STATUSES.BOUNCED,
  DELIVERY_STATUSES.COMPLAINED,
  DELIVERY_STATUSES.REJECTED,
  DELIVERY_STATUSES.FAILED,
  // NOTE: UNKNOWN is NOT terminal — a newer webhook event CAN advance it
  // to delivered/bounced/complained/rejected. This allows recovery from
  // ambiguous persistence failures when the provider later reports the
  // actual outcome.
]);

// Per-state timestamps. Cleared when regressing (we don't currently regress
// except in the well-defined complaint-wins case, where the prior `delivered`
// timestamp is preserved on the event history but the row's `currentStatus`
// moves to `complained`).
const STATUS_TO_TIMESTAMP_FIELD: Record<DeliveryStatus, keyof {
  acceptedAt: Date | null;
  deliveredAt: Date | null;
  bouncedAt: Date | null;
  complainedAt: Date | null;
  rejectedAt: Date | null;
  failedAt: Date | null;
}> = {
  [DELIVERY_STATUSES.QUEUED]: "acceptedAt",
  [DELIVERY_STATUSES.PROVIDER_ACCEPTED]: "acceptedAt",
  [DELIVERY_STATUSES.DELIVERED]: "deliveredAt",
  [DELIVERY_STATUSES.DEFERRED]: "acceptedAt",
  [DELIVERY_STATUSES.BOUNCED]: "bouncedAt",
  [DELIVERY_STATUSES.COMPLAINED]: "complainedAt",
  [DELIVERY_STATUSES.REJECTED]: "rejectedAt",
  [DELIVERY_STATUSES.FAILED]: "failedAt",
  [DELIVERY_STATUSES.UNKNOWN]: "acceptedAt",
};

// ---- Public types ---------------------------------------------------------

export interface CreateDeliveryInput {
  userId: number;
  sourceType: DeliverySourceType;
  /** Optional: EmailMessage.messageId for transactional source. */
  emailMessageId?: string | null;
  /** Optional: BroadcastRecipient.id for broadcast source. */
  broadcastRecipientId?: number | null;
  /** Optional opaque source id (for OTP/future sources). */
  sourceId?: string | null;
  provider: string;
  /** Optional pre-known providerMessageId (rare — usually set after send). */
  providerMessageId?: string | null;
}

export interface CreateDeliveryResult {
  id: number;
  deliveryId: string;
  currentStatus: DeliveryStatus;
}

export interface IngestProviderEventInput {
  /**
   * Tenant that owns the target delivery. Required so a cross-tenant event
   * with a providerMessageId that happens to collide across tenants cannot
   * mutate the wrong tenant — we filter by userId on every read.
   */
  userId: number;
  provider: string;
  /**
   * Either providerMessageId (to resolve the delivery row by
   * (provider, providerMessageId)) OR deliveryId (public UUID).
   * At least one must be set. providerMessageId is the normal webhook path.
   */
  providerMessageId?: string | null;
  deliveryId?: string | null;
  /** Provider's own event id — used for idempotent dedup. Required. */
  providerEventId: string;
  type: ProviderEventType;
  occurredAt: Date;
  /**
   * For bounce events: "hard" or "soft". Hard triggers suppression.
   * For other event types, null.
   */
  bounceType?: BounceType | null;
  /**
   * Safe metadata persisted as JSONB. NEVER include raw provider payload —
   * only coarse-grained, sanitized fields (e.g. { smtp_response_class: "5.x" }).
   */
  safeMetadata?: Record<string, unknown> | null;
}

export interface IngestProviderEventResult {
  /** "applied" — new event recorded, state may or may not have changed. */
  status: "applied" | "duplicate" | "unknown_delivery";
  /** Whether currentStatus was changed by this event. */
  stateChanged: boolean;
  /** New currentStatus if stateChanged=true; else null. */
  newStatus: DeliveryStatus | null;
  /** Whether suppression was applied (hard bounce or complaint). */
  suppressionApplied: boolean;
  /**
   * Email that was suppressed (if any). Used for tests/observability —
   * callers should NOT use this to re-trigger suppression (that would
   * double-write the SuppressionEvent).
   */
  suppressedEmail: string | null;
  /** Event ID of the recorded event (null on duplicate or unknown_delivery). */
  eventId: string | null;
}

export interface DeliveryDetail {
  id: number;
  deliveryId: string;
  userId: number;
  sourceType: string;
  sourceId: string | null;
  emailMessageId: string | null;
  broadcastRecipientId: number | null;
  provider: string;
  providerMessageId: string | null;
  currentStatus: DeliveryStatus;
  lastProviderEventAt: Date | null;
  acceptedAt: Date | null;
  deliveredAt: Date | null;
  bouncedAt: Date | null;
  complainedAt: Date | null;
  rejectedAt: Date | null;
  failedAt: Date | null;
  lastErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  events: DeliveryEventDetail[];
}

export interface DeliveryEventDetail {
  eventId: string;
  provider: string;
  providerEventId: string | null;
  type: string;
  occurredAt: Date;
  safeMetadata: unknown;
  createdAt: Date;
}

export interface DeliveryListEntry {
  id: number;
  deliveryId: string;
  sourceType: string;
  sourceId: string | null;
  emailMessageId: string | null;
  broadcastRecipientId: number | null;
  provider: string;
  providerMessageId: string | null;
  currentStatus: DeliveryStatus;
  lastErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryHealthSummary {
  /** Window in hours covered by the summary. */
  windowHours: number;
  /** Total deliveries created in the window. */
  total: number;
  accepted: number;
  delivered: number;
  bounced: number;
  complained: number;
  rejected: number;
  failed: number;
  deferred: number;
  /** Deliveries in `unknown` state (provider may have sent, persistence failed). */
  unknown: number;
  /** Provider webhook events received in the window. */
  webhookEvents: number;
  /** Provider distribution — count by provider name. */
  byProvider: Record<string, number>;
  /** Source distribution — count by sourceType. */
  bySource: Record<string, number>;
}

// ---- Helpers --------------------------------------------------------------

/**
 * Resolve a target delivery by either providerMessageId (preferred — that's
 * how webhooks identify the message) OR public deliveryId (UUID).
 *
 * Always filters by userId — a cross-tenant providerMessageId collision is
 * prevented at the unique-index level ((provider, providerMessageId) is
 * globally unique), but defense-in-depth.
 */
async function resolveDelivery(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  userId: number,
  provider: string,
  opts: { providerMessageId?: string | null; deliveryId?: string | null },
): Promise<{ id: number; userId: number; currentStatus: DeliveryStatus; providerMessageId: string | null; acceptedAt: Date | null } | null> {
  if (opts.providerMessageId) {
    const row = await tx.emailDelivery.findUnique({
      where: { provider_providerMessageId: { provider, providerMessageId: opts.providerMessageId } },
      select: { id: true, userId: true, currentStatus: true, providerMessageId: true, acceptedAt: true },
    });
    if (!row || row.userId !== userId) return null;
    return { id: row.id, userId: row.userId, currentStatus: row.currentStatus as DeliveryStatus, providerMessageId: row.providerMessageId, acceptedAt: row.acceptedAt };
  }
  if (opts.deliveryId) {
    const row = await tx.emailDelivery.findUnique({
      where: { deliveryId: opts.deliveryId },
      select: { id: true, userId: true, currentStatus: true, providerMessageId: true, acceptedAt: true },
    });
    if (!row || row.userId !== userId) return null;
    return { id: row.id, userId: row.userId, currentStatus: row.currentStatus as DeliveryStatus, providerMessageId: row.providerMessageId, acceptedAt: row.acceptedAt };
  }
  return null;
}

/**
 * Compute the new currentStatus given the current state and an incoming
 * event type + occurredAt. Implements the NEVER REGRESS rules.
 *
 * BLOCKER #6 — DETERMINISTIC EVENT ORDERING:
 *   - The incoming event's `occurredAt` is compared against the delivery's
 *     `lastProviderEventAt` (the max occurredAt across prior stored events,
 *     falling back to `acceptedAt`). If the incoming event is OLDER than the
 *     last event, it is stored in the immutable event history (compliance
 *     requirement) but does NOT transition `currentStatus`.
 *   - Terminal states (delivered, bounced, complained, rejected, failed,
 *     unknown) cannot be regressed by older non-terminal events.
 *   - Explicit precedence matrix:
 *       * complained beats delivered (when occurredAt is at-or-after last).
 *       * complained cannot be overwritten by delivered.
 *       * bounced (hard) cannot be overwritten by deferred.
 *       * All other terminal → non-terminal/terminal transitions are blocked.
 *   - The `unknown` state (persistence-failure marker) is treated as
 *     terminal w.r.t. ingestion ordering — only a NEWER event advances it
 *     to a concrete terminal state.
 */
function computeNewStatus(
  current: DeliveryStatus,
  incoming: ProviderEventType,
  currentLastEventAt: Date | null,
  incomingOccurredAt: Date,
  incomingBounceType: BounceType | null,
): { newStatus: DeliveryStatus; shouldTransition: boolean } {
  // Map incoming event type → target status.
  // bounce events with type="soft" → DEFERRED (transient)
  // bounce events with type="hard" → BOUNCED (terminal)
  let targetStatus: DeliveryStatus;
  if (incoming === PROVIDER_EVENT_TYPES.DELIVERED) {
    targetStatus = DELIVERY_STATUSES.DELIVERED;
  } else if (incoming === PROVIDER_EVENT_TYPES.DEFERRED) {
    targetStatus = DELIVERY_STATUSES.DEFERRED;
  } else if (incoming === PROVIDER_EVENT_TYPES.BOUNCED) {
    targetStatus = incomingBounceType === BOUNCE_TYPES.HARD
      ? DELIVERY_STATUSES.BOUNCED
      : DELIVERY_STATUSES.DEFERRED;
  } else if (incoming === PROVIDER_EVENT_TYPES.COMPLAINED) {
    targetStatus = DELIVERY_STATUSES.COMPLAINED;
  } else if (incoming === PROVIDER_EVENT_TYPES.REJECTED) {
    targetStatus = DELIVERY_STATUSES.REJECTED;
  } else {
    return { newStatus: current, shouldTransition: false };
  }

  // Same status — no transition.
  if (targetStatus === current) {
    return { newStatus: current, shouldTransition: false };
  }

  // DETERMINISTIC ORDERING: if the incoming event is OLDER than the last
  // recorded provider event (or the delivery's acceptedAt when no events
  // exist yet), store the event but DO NOT transition currentStatus. This
  // is the never-regress rule for out-of-order webhook delivery.
  if (currentLastEventAt && incomingOccurredAt.getTime() < currentLastEventAt.getTime()) {
    return { newStatus: current, shouldTransition: false };
  }

  // If current is non-terminal, always transition (incoming is at-or-after last).
  if (!TERMINAL_STATUSES.has(current)) {
    return { newStatus: targetStatus, shouldTransition: true };
  }

  // Current is terminal. Apply the explicit precedence matrix.
  //
  // Allowed forward transitions out of terminal:
  //   delivered → complained (compliance-aware: complaint is the stronger
  //               signal — recipient marked the email as spam).
  //
  // Blocked transitions:
  //   complained → delivered (complaint MUST NOT be undone by a delayed
  //                delivered signal).
  //   bounced (hard) → deferred (a hard bounce is terminal — a delayed
  //                    transient signal cannot regress it).
  //   All other terminal → non-terminal/terminal transitions.
  if (current === DELIVERY_STATUSES.DELIVERED && targetStatus === DELIVERY_STATUSES.COMPLAINED) {
    return { newStatus: DELIVERY_STATUSES.COMPLAINED, shouldTransition: true };
  }

  // Otherwise: terminal current state NEVER regresses.
  // (delivered → then old delayed deferred → stay delivered;
  //  bounced → then old delivered → stay bounced;
  //  complained → then delayed delivered → stay complained;
  //  unknown → then older non-terminal → stay unknown.)
  return { newStatus: current, shouldTransition: false };
}

// ---- Public service functions --------------------------------------------

/**
 * Create a new EmailDelivery row in `queued` state. Called by the broadcast
 * service and the transactional messaging service BEFORE provider dispatch.
 *
 * The row is created with `currentStatus=queued`. The same caller will
 * update it to `provider_accepted` (via `updateDeliveryAfterProviderSend`)
 * once `provider.send()` returns successfully.
 *
 * If `providerMessageId` is supplied here (rare — usually set after send),
 * the (provider, providerMessageId) unique constraint is honored.
 *
 * Idempotent: if called twice with the same (sourceType, sourceId, broadcastRecipientId,
 * emailMessageId) the unique constraints (none currently for these) mean
 * we WILL create two rows. Callers MUST NOT call createDelivery twice for
 * the same logical send. The transactional send path dedupes at the
 * EmailMessage level (idempotency key) BEFORE calling createDelivery.
 */
export async function createDelivery(opts: CreateDeliveryInput): Promise<CreateDeliveryResult> {
  const delivery = await db.emailDelivery.create({
    data: {
      deliveryId: randomUUID(),
      userId: opts.userId,
      sourceType: opts.sourceType,
      sourceId: opts.sourceId ?? null,
      emailMessageId: opts.emailMessageId ?? null,
      // BLOCKER #4: populate the composite-FK owner columns. When the
      // source correlation column is set, the owner column must equal the
      // parent's userId (same tenant) so the composite FK enforces tenant
      // agreement at the DB level. When the correlation column is null,
      // the owner column is also null (FK is skipped — both columns null).
      emailMessageOwnerUserId: opts.emailMessageId ? opts.userId : null,
      broadcastRecipientId: opts.broadcastRecipientId ?? null,
      broadcastRecipientOwnerUserId: opts.broadcastRecipientId ? opts.userId : null,
      provider: opts.provider,
      providerMessageId: opts.providerMessageId ?? null,
      currentStatus: DELIVERY_STATUSES.QUEUED,
    },
    select: { id: true, deliveryId: true, currentStatus: true },
  });
  return {
    id: delivery.id,
    deliveryId: delivery.deliveryId,
    currentStatus: delivery.currentStatus as DeliveryStatus,
  };
}

/**
 * Update a delivery row after the provider.send() call returned.
 *
 *   - accepted=true → CAS queued → provider_accepted, set acceptedAt +
 *     providerMessageId (if available).
 *   - accepted=false → CAS queued → rejected (provider refused), set
 *     rejectedAt + lastErrorCode = responseClassification.
 *
 * Called by broadcast service and transactional messaging service AFTER the
 * provider call returns. NOT for webhook ingestion — that's
 * `ingestProviderEvent`.
 *
 * BLOCKER #7 — CAS-BASED DELIVERY UPDATES:
 *   Uses `updateMany` with `WHERE currentStatus = QUEUED` and checks
 *   `count === 1`. If count === 0, the state is no longer queued (likely
 *   advanced by an out-of-band webhook) — we DO NOT regress the state, but
 *   we still record the providerMessageId and acceptedAt metadata via a
 *   SEPARATE updateMany with `WHERE providerMessageId = null` (this is
 *   metadata backfill, NOT a state transition).
 *
 * Throws on DB error — callers MUST handle (no silent .catch). The
 * transactional messaging service treats this throw as "provider.send()
 * succeeded but DB persistence failed" → calls `markDeliveryUnknown()`
 * instead of `markDeliveryFailed()`.
 */
export async function updateDeliveryAfterProviderSend(
  userId: number,
  deliveryId: number,
  result: {
    accepted: boolean;
    messageId: string | null;
    responseClassification: string;
  },
): Promise<void> {
  const now = new Date();

  if (result.accepted) {
    // CAS: queued → provider_accepted.
    const cas = await db.emailDelivery.updateMany({
      where: {
        userId,
        id: deliveryId,
        currentStatus: DELIVERY_STATUSES.QUEUED,
      },
      data: {
        currentStatus: DELIVERY_STATUSES.PROVIDER_ACCEPTED,
        providerMessageId: result.messageId ?? undefined,
        acceptedAt: now,
        lastProviderEventAt: now,
      },
    });

    if (cas.count === 0) {
      // State is no longer queued (webhook already advanced it, or it's
      // already terminal). Best-effort backfill of providerMessageId /
      // acceptedAt where missing — NOT a state transition.
      await db.emailDelivery.updateMany({
        where: {
          userId,
          id: deliveryId,
          providerMessageId: null,
        },
        data: {
          providerMessageId: result.messageId ?? null,
          acceptedAt: now,
          lastProviderEventAt: now,
        },
      });
    }
    return;
  }

  // CAS: queued → rejected.
  const cas = await db.emailDelivery.updateMany({
    where: {
      userId,
      id: deliveryId,
      currentStatus: DELIVERY_STATUSES.QUEUED,
    },
    data: {
      currentStatus: DELIVERY_STATUSES.REJECTED,
      rejectedAt: now,
      lastErrorCode: result.responseClassification,
      lastProviderEventAt: now,
    },
  });

  if (cas.count === 0) {
    // No longer queued — record the error code if missing (audit).
    await db.emailDelivery.updateMany({
      where: {
        userId,
        id: deliveryId,
        lastErrorCode: null,
      },
      data: {
        lastErrorCode: result.responseClassification,
        lastProviderEventAt: now,
      },
    });
  }
}

/**
 * Mark a delivery as `failed` (provider call threw before any acceptance).
 * Called by the broadcast / messaging service when provider.send() throws.
 *
 * BLOCKER #7 — CAS-BASED DELIVERY UPDATES:
 *   Uses `updateMany` with `WHERE currentStatus = QUEUED` and checks
 *   `count === 1`. If count === 0, the state is no longer queued (likely
 *   advanced by a webhook) — we do NOT regress.
 *
 * Throws on DB error — callers MUST handle (no silent .catch).
 */
export async function markDeliveryFailed(
  userId: number,
  deliveryId: number,
  errorCode: string,
): Promise<void> {
  const now = new Date();
  await db.emailDelivery.updateMany({
    where: {
      userId,
      id: deliveryId,
      currentStatus: DELIVERY_STATUSES.QUEUED,
    },
    data: {
      currentStatus: DELIVERY_STATUSES.FAILED,
      failedAt: now,
      lastErrorCode: errorCode,
      lastProviderEventAt: now,
    },
  });
}

/**
 * Mark a delivery as `unknown` (BLOCKER #3).
 *
 * Used when `provider.send()` succeeded but the subsequent DB persistence
 * (state transition via `updateDeliveryAfterProviderSend` or another write)
 * threw. The external email MAY have been delivered — we cannot treat this
 * as `failed` (which means "provider error before acceptance"). The `unknown`
 * state signals "provider accepted but durable outcome unknown".
 *
 * Semantics:
 *   - CAS: queued → unknown (only if still queued; never regresses other states).
 *   - The `unknown` state is NEVER auto-retried.
 *   - Broadcast stale recovery skips `unknown` delivery recipients (an
 *     abandoned dispatch whose EmailDelivery is `unknown` is NOT failed).
 *   - Idempotent Send replay checks if a delivery already exists before
 *     calling provider again — see sendTransactionalEmail.
 *
 * Throws on DB error — callers MUST handle.
 */
export async function markDeliveryUnknown(
  userId: number,
  deliveryId: number,
  errorCode: string,
): Promise<void> {
  const now = new Date();
  await db.emailDelivery.updateMany({
    where: {
      userId,
      id: deliveryId,
      currentStatus: DELIVERY_STATUSES.QUEUED,
    },
    data: {
      currentStatus: DELIVERY_STATUSES.UNKNOWN,
      lastErrorCode: errorCode,
      lastProviderEventAt: now,
    },
  });
}

/**
 * Ingest a provider webhook event (or test harness event).
 *
 * Atomic flow inside a single transaction:
 *   1. Resolve target delivery by (provider, providerMessageId) OR deliveryId,
 *      filtered by userId. Unknown → return status="unknown_delivery", no
 *      state change.
 *   2. Insert EmailDeliveryEvent with (provider, providerEventId) unique
 *      constraint. P2002 → duplicate → return status="duplicate".
 *   3. Compute new currentStatus (NEVER REGRESS rules — see computeNewStatus).
 *   4. If state changed, update EmailDelivery row.
 *   5. If hard bounce → suppressEmailInTx({ reason: "hard_bounce", source: "system" }).
 *      If complaint → suppressEmailInTx({ reason: "complaint", source: "system" }).
 *      Soft/transient bounce → NO suppression.
 *
 * BLOCKER #1 — NESTED TRANSACTION FIX:
 *   The suppression call goes through `suppressEmailInTx(tx, opts)` which
 *   accepts the SAME transaction client. This ensures the event + state
 *   transition + suppression all commit/roll back atomically. The public
 *   `suppressEmail()` wrapper opens its OWN transaction and is forbidden
 *   here.
 *
 * P2002 (duplicate providerEventId) is caught OUTSIDE the tx and resolved by
 * re-reading — the original event's outcome is returned, not a re-suppression.
 */
export async function ingestProviderEvent(opts: IngestProviderEventInput): Promise<IngestProviderEventResult> {
  if (!opts.providerMessageId && !opts.deliveryId) {
    return {
      status: "unknown_delivery",
      stateChanged: false,
      newStatus: null,
      suppressionApplied: false,
      suppressedEmail: null,
      eventId: null,
    };
  }

  try {
    return await db.$transaction(async (tx) => {
      // 1. Resolve target delivery (tenant-scoped).
      const delivery = await resolveDelivery(
        tx,
        opts.userId,
        opts.provider,
        { providerMessageId: opts.providerMessageId ?? null, deliveryId: opts.deliveryId ?? null },
      );
      if (!delivery) {
        return {
          status: "unknown_delivery" as const,
          stateChanged: false,
          suppressionApplied: false,
          suppressedEmail: null,
          eventId: null,
          newStatus: null,
        };
      }

      // 2. Insert event with (provider, providerEventId) unique constraint.
      //    P2002 → propagates out of tx → caught by outer try/catch.
      const event = await tx.emailDeliveryEvent.create({
        data: {
          eventId: randomUUID(),
          userId: opts.userId,
          deliveryId: delivery.id,
          provider: opts.provider,
          providerEventId: opts.providerEventId,
          type: opts.type,
          occurredAt: opts.occurredAt,
          safeMetadata: (opts.safeMetadata ?? null) as any,
        },
        select: { eventId: true },
      });

      // 3. Compute the prior-max occurredAt BEFORE we count the just-inserted
      //    event. We compute this AFTER insert but EXCLUDE the new event's id.
      const priorMax = await tx.emailDeliveryEvent.aggregate({
        where: {
          userId: opts.userId,
          deliveryId: delivery.id,
          eventId: { not: event.eventId },
        },
        _max: { occurredAt: true },
      });
      const currentLastEventAt = priorMax._max.occurredAt;  // Only compare against prior provider events, NOT acceptedAt.

      const { newStatus, shouldTransition } = computeNewStatus(
        delivery.currentStatus,
        opts.type,
        currentLastEventAt,
        opts.occurredAt,
        opts.bounceType ?? null,
      );

      // 4. Update delivery row if state changed.
      let suppressedEmail: string | null = null;
      let suppressionApplied = false;

      if (shouldTransition) {
        const timestampField = STATUS_TO_TIMESTAMP_FIELD[newStatus];
        const updateData: Record<string, unknown> = {
          currentStatus: newStatus,
          lastProviderEventAt: opts.occurredAt,
          [timestampField]: opts.occurredAt,
        };
        if (newStatus === DELIVERY_STATUSES.BOUNCED || newStatus === DELIVERY_STATUSES.REJECTED || newStatus === DELIVERY_STATUSES.FAILED) {
          updateData.lastErrorCode = opts.bounceType ? `bounce_${opts.bounceType}` : opts.type;
        }
        await tx.emailDelivery.update({
          where: { id: delivery.id },
          data: updateData,
        });

        // 5. Apply suppression for hard bounce or complaint. Use
        //    suppressEmailInTx so the suppression commits/rolls back with
        //    the delivery event transaction (BLOCKER #1).
        if (newStatus === DELIVERY_STATUSES.BOUNCED && opts.bounceType === BOUNCE_TYPES.HARD) {
          const email = await lookupDeliveryEmail(tx, opts.userId, delivery.id);
          if (email) {
            await suppressEmailInTx(tx, {
              userId: opts.userId,
              email,
              reason: SUPPRESSION_REASONS.HARD_BOUNCE,
              source: CONSENT_SOURCES.SYSTEM,
            });
            suppressedEmail = email;
            suppressionApplied = true;
          }
        } else if (newStatus === DELIVERY_STATUSES.COMPLAINED) {
          const email = await lookupDeliveryEmail(tx, opts.userId, delivery.id);
          if (email) {
            await suppressEmailInTx(tx, {
              userId: opts.userId,
              email,
              reason: SUPPRESSION_REASONS.COMPLAINT,
              source: CONSENT_SOURCES.SYSTEM,
            });
            suppressedEmail = email;
            suppressionApplied = true;
          }
        }
      }

      return {
        status: "applied" as const,
        stateChanged: shouldTransition,
        newStatus: shouldTransition ? newStatus : null,
        suppressionApplied,
        suppressedEmail,
        eventId: event.eventId,
      };
    });
  } catch (err: any) {
    // P2002 from the EmailDeliveryEvent unique (provider, providerEventId) —
    // duplicate webhook delivery. Re-read the existing event and return
    // status="duplicate" — NO re-suppression.
    if (err?.code === "P2002") {
      const existing = await db.emailDeliveryEvent.findUnique({
        where: { provider_providerEventId: { provider: opts.provider, providerEventId: opts.providerEventId } },
        select: { eventId: true, userId: true, deliveryId: true, type: true },
      });
      if (existing && existing.userId === opts.userId) {
        return {
          status: "duplicate",
          stateChanged: false,
          newStatus: null,
          suppressionApplied: false,
          suppressedEmail: null,
          eventId: existing.eventId,
        };
      }
      // Existing event belongs to a different tenant — treat as unknown for
      // this caller (defense-in-depth; the unique constraint prevented the
      // duplicate write, but we don't leak cross-tenant event existence).
      return {
        status: "unknown_delivery",
        stateChanged: false,
        newStatus: null,
        suppressionApplied: false,
        suppressedEmail: null,
        eventId: null,
      };
    }
    throw err;
  }
}

/**
 * Helper: get the email address for a delivery by following the source
 * correlation (broadcast → BroadcastRecipient.contactId → Contact.email;
 * transactional → EmailMessage.toEmail).
 *
 * Used inside ingestProviderEvent to know which email to suppress.
 */
async function lookupDeliveryEmail(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  userId: number,
  deliveryId: number,
): Promise<string | null> {
  const delivery = await tx.emailDelivery.findUnique({
    where: { userId_id: { userId, id: deliveryId } },
    select: {
      sourceType: true,
      broadcastRecipientId: true,
      emailMessageId: true,
    },
  });
  if (!delivery) return null;

  if (delivery.sourceType === DELIVERY_SOURCES.BROADCAST && delivery.broadcastRecipientId) {
    const recipient = await tx.broadcastRecipient.findUnique({
      where: { id: delivery.broadcastRecipientId },
      select: { contactId: true, contactOwnerUserId: true },
    });
    if (!recipient || recipient.contactId === null || recipient.contactOwnerUserId === null) return null;
    const contact = await tx.contact.findFirst({
      where: { id: recipient.contactId, userId: recipient.contactOwnerUserId },
      select: { email: true },
    });
    return contact?.email ?? null;
  }
  if (delivery.sourceType === DELIVERY_SOURCES.TRANSACTIONAL && delivery.emailMessageId) {
    // EmailMessage.messageId is globally unique (UUID). Look up by messageId
    // alone — verifies userId for tenant isolation after read.
    const msg = await tx.emailMessage.findUnique({
      where: { messageId: delivery.emailMessageId },
      select: { toEmail: true, userId: true },
    });
    if (!msg || msg.userId !== userId) return null;
    return msg.toEmail;
  }
  return null;
}

/**
 * Read a single delivery by its public UUID, including its full event
 * history. Tenant-scoped — returns null if the delivery belongs to a
 * different user.
 */
export async function getDelivery(userId: number, deliveryId: string): Promise<DeliveryDetail | null> {
  const delivery = await db.emailDelivery.findUnique({
    where: { deliveryId },
    include: {
      events: {
        orderBy: { occurredAt: "asc" },
      },
    },
  });
  if (!delivery || delivery.userId !== userId) return null;
  return toDeliveryDetail(delivery);
}

/**
 * Paginated list of deliveries with filters. Tenant-scoped.
 */
export async function listDeliveries(
  userId: number,
  opts: {
    page?: number;
    pageSize?: number;
    sourceType?: string;
    status?: string;
    provider?: string;
  } = {},
): Promise<{ deliveries: DeliveryListEntry[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));

  const where: Record<string, unknown> = { userId };
  if (opts.sourceType) where.sourceType = opts.sourceType;
  if (opts.status) where.currentStatus = opts.status;
  if (opts.provider) where.provider = opts.provider;

  const [rows, total] = await Promise.all([
    db.emailDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        deliveryId: true,
        sourceType: true,
        sourceId: true,
        emailMessageId: true,
        broadcastRecipientId: true,
        provider: true,
        providerMessageId: true,
        currentStatus: true,
        lastErrorCode: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.emailDelivery.count({ where }),
  ]);

  return {
    deliveries: rows.map((r) => ({
      id: r.id,
      deliveryId: r.deliveryId,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      emailMessageId: r.emailMessageId,
      broadcastRecipientId: r.broadcastRecipientId,
      provider: r.provider,
      providerMessageId: r.providerMessageId,
      currentStatus: r.currentStatus as DeliveryStatus,
      lastErrorCode: r.lastErrorCode,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    total,
    page,
    pageSize,
  };
}

/**
 * Event history for a single delivery. Tenant-scoped.
 */
export async function getDeliveryEvents(
  userId: number,
  deliveryId: string,
): Promise<DeliveryEventDetail[] | null> {
  const delivery = await db.emailDelivery.findUnique({
    where: { deliveryId },
    select: { id: true, userId: true },
  });
  if (!delivery || delivery.userId !== userId) return null;

  const events = await db.emailDeliveryEvent.findMany({
    where: { userId, deliveryId: delivery.id },
    orderBy: { occurredAt: "asc" },
  });

  return events.map((e) => ({
    eventId: e.eventId,
    provider: e.provider,
    providerEventId: e.providerEventId,
    type: e.type,
    occurredAt: e.occurredAt,
    safeMetadata: e.safeMetadata,
    createdAt: e.createdAt,
  }));
}

/**
 * Bounded operational health summary for the recent past. Tenant-scoped.
 *
 * The window is bounded (default 24h, max 168h / 7d) to keep the query
 * cheap and the dashboard meaningful. The query is NOT a full-table scan —
 * it uses the (userId, createdAt) and (userId, currentStatus) indexes.
 *
 * BLOCKER #8 — DB-SIDE HEALTH AGGREGATION:
 *   Replaces the prior `findMany` + in-memory counting pattern with a
 *   `groupBy(["currentStatus"]) + _count` query. No unbounded row list is
 *   materialized in application memory — the database performs the
 *   aggregation and returns one row per status value.
 */
export async function getDeliveryHealth(
  userId: number,
  opts: { windowHours?: number } = {},
): Promise<DeliveryHealthSummary> {
  const windowHours = Math.min(168, Math.max(1, opts.windowHours ?? 24));
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const where = { userId, createdAt: { gte: since } };

  const [statusGroups, total, webhookEventCount, byProviderRows, bySourceRows] = await Promise.all([
    db.emailDelivery.groupBy({
      by: ["currentStatus"],
      where,
      _count: true,
    }),
    db.emailDelivery.count({ where }),
    db.emailDeliveryEvent.count({
      where: { userId, createdAt: { gte: since } },
    }),
    db.emailDelivery.groupBy({
      by: ["provider"],
      where,
      _count: true,
    }),
    db.emailDelivery.groupBy({
      by: ["sourceType"],
      where,
      _count: true,
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const g of statusGroups) {
    counts[g.currentStatus] = g._count;
  }

  return {
    windowHours,
    total,
    accepted: counts[DELIVERY_STATUSES.PROVIDER_ACCEPTED] ?? 0,
    delivered: counts[DELIVERY_STATUSES.DELIVERED] ?? 0,
    bounced: counts[DELIVERY_STATUSES.BOUNCED] ?? 0,
    complained: counts[DELIVERY_STATUSES.COMPLAINED] ?? 0,
    rejected: counts[DELIVERY_STATUSES.REJECTED] ?? 0,
    failed: counts[DELIVERY_STATUSES.FAILED] ?? 0,
    deferred: counts[DELIVERY_STATUSES.DEFERRED] ?? 0,
    unknown: counts[DELIVERY_STATUSES.UNKNOWN] ?? 0,
    webhookEvents: webhookEventCount,
    byProvider: Object.fromEntries(byProviderRows.map((r) => [r.provider, r._count])),
    bySource: Object.fromEntries(bySourceRows.map((r) => [r.sourceType, r._count])),
  };
}

// ---- Internal: type narrowing for the result row --------------------------

// Helper to map a Prisma row to the DeliveryDetail shape.
function toDeliveryDetail(row: any): DeliveryDetail {
  return {
    id: row.id,
    deliveryId: row.deliveryId,
    userId: row.userId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    emailMessageId: row.emailMessageId,
    broadcastRecipientId: row.broadcastRecipientId,
    provider: row.provider,
    providerMessageId: row.providerMessageId,
    currentStatus: row.currentStatus as DeliveryStatus,
    lastProviderEventAt: row.lastProviderEventAt,
    acceptedAt: row.acceptedAt,
    deliveredAt: row.deliveredAt,
    bouncedAt: row.bouncedAt,
    complainedAt: row.complainedAt,
    rejectedAt: row.rejectedAt,
    failedAt: row.failedAt,
    lastErrorCode: row.lastErrorCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    events: (row.events ?? []).map((e: any) => ({
      eventId: e.eventId,
      provider: e.provider,
      providerEventId: e.providerEventId,
      type: e.type,
      occurredAt: e.occurredAt,
      safeMetadata: e.safeMetadata,
      createdAt: e.createdAt,
    })),
  };
}
