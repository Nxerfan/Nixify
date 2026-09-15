/**
 * Consent & Suppression — central service layer (Phase 9, audit revision).
 *
 * DESIGN INVARIANTS (per Phase 9 audit):
 *
 * 1. ONE central service for ALL consent/suppression mutations. Routes must
 *    NOT independently mutate Contact.marketing* fields or SuppressionEntry.
 *
 * 2. CANONICAL MUTATION LOCK: every consent/suppression mutation for a given
 *    (userId, normalized email) acquires a transaction-scoped PostgreSQL
 *    advisory lock via `pg_advisory_xact_lock(canonical_key)`. This
 *    serializes concurrent operations on the same target. Different tenants
 *    have independent lock domains. The lock is held for the duration of the
 *    `db.$transaction()` call.
 *
 * 3. NO in-transaction catch-and-continue: a P2002 or any other constraint
 *    error inside `db.$transaction()` invalidates the PostgreSQL transaction.
 *    We NEVER `try/catch` constraint errors inside the tx and continue — we
 *    let them propagate. P2002 from concurrent idempotent inserts is caught
 *    OUTSIDE the tx and resolved by reading the existing event row.
 *
 * 4. IDEMPOTENCY NAMESPACE: idempotency is bound to
 *    `(userId, operation, target, idempotencyKeyHash)`. The same caller key
 *    reused for a DIFFERENT operation or contact does NOT replay an unrelated
 *    prior result. A separate `requestFingerprint` (SHA-256 of the mutable
 *    request payload) detects same-key-different-body conflicts → 409
 *    `idempotency_conflict` at the service boundary (thrown as
 *    `IdempotencyConflictError`).
 *
 * 5. NO-OP SEMANTICS: a same-state repeated request (e.g. subscribe when
 *    already subscribed, no idempotency key) returns `status: "no_op"` and
 *    does NOT create a fake transition event. Only ACTUAL state transitions
 *    append to the immutable audit history. Retries are handled by the
 *    idempotency key — they return `idempotent_replay` and dedupe.
 *
 * 6. STRUCTURAL TENANT ISOLATION: composite FKs
 *    (ContactConsentEvent.userId, contactId) → Contact(userId, id) and
 *    (SuppressionEvent.userId, suppressionId) → SuppressionEntry(userId, id)
 *    enforce tenant agreement at the DB level. Application-level filters are
 *    defense-in-depth, not the primary enforcement.
 *
 * 7. Contact PATCH and other unrelated mutations MUST NOT touch marketing
 *    fields. Only this service's subscribe/unsubscribe operations change
 *    marketingStatus.
 *
 * 8. Transactional Send is NOT gated by marketing eligibility — only future
 *    Phase 10 Broadcast sending will consult getMarketingEligibility.
 */
import { db } from "@/lib/db";
import { normalizeEmail, isValidEmail } from "@/lib/contacts";
import { createHash, randomUUID } from "crypto";

// ---- Canonical state constants --------------------------------------------

export const MARKETING_STATUSES = {
  UNKNOWN: "unknown",
  SUBSCRIBED: "subscribed",
  UNSUBSCRIBED: "unsubscribed",
} as const;
export type MarketingStatus = (typeof MARKETING_STATUSES)[keyof typeof MARKETING_STATUSES];

export const CONSENT_SOURCES = {
  DASHBOARD: "dashboard",
  API: "api",
  UNSUBSCRIBE: "unsubscribe",
  IMPORT: "import",
  SYSTEM: "system",
} as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[keyof typeof CONSENT_SOURCES];

export const CONSENT_OPERATIONS = {
  SUBSCRIBE: "subscribe",
  UNSUBSCRIBE: "unsubscribe",
} as const;
export type ConsentOperation = (typeof CONSENT_OPERATIONS)[keyof typeof CONSENT_OPERATIONS];

export const SUPPRESSION_OPERATIONS = {
  SUPPRESS: "suppress",
  UNSUPPRESS: "unsuppress",
} as const;
export type SuppressionOperation = (typeof SUPPRESSION_OPERATIONS)[keyof typeof SUPPRESSION_OPERATIONS];

export const SUPPRESSION_REASONS = {
  UNSUBSCRIBE: "unsubscribe",
  MANUAL: "manual",
  // Reserved for Phase 11 — NOT written by Phase 9:
  HARD_BOUNCE: "hard_bounce",
  COMPLAINT: "complaint",
} as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[keyof typeof SUPPRESSION_REASONS];

export const SUPPRESSION_ACTIONS = {
  SUPPRESSED: "suppressed",
  LIFTED: "lifted",
} as const;
export type SuppressionAction = (typeof SUPPRESSION_ACTIONS)[keyof typeof SUPPRESSION_ACTIONS];

// Phase 9 only allows these reason values to be written.
const PHASE9_WRITABLE_REASONS: ReadonlySet<string> = new Set([
  SUPPRESSION_REASONS.UNSUBSCRIBE,
  SUPPRESSION_REASONS.MANUAL,
]);

const VALID_CONSENT_SOURCES: ReadonlySet<string> = new Set([
  CONSENT_SOURCES.DASHBOARD,
  CONSENT_SOURCES.API,
  CONSENT_SOURCES.UNSUBSCRIBE,
  CONSENT_SOURCES.SYSTEM,
]);

// ---- Idempotency hashing ---------------------------------------------------

const IDEMPOTENCY_DOMAIN = "nixify:phase9:consent:v1";

/**
 * Hash an idempotency key with a tenant-bound domain separator.
 *
 * The hash is what we store — never the raw key. This prevents a leaked DB
 * row from being usable to replay requests, and ensures cross-tenant
 * collisions are impossible even if two tenants happen to use the same key.
 *
 * NOTE: the (userId, operation, idempotencyKeyHash) tuple is the canonical
 * idempotency namespace. The operation field on the audit row ensures the
 * same caller key cannot replay an unrelated prior operation. The target
 * (contactId/email) is verified to match the existing event before replay.
 */
export function hashIdempotencyKey(userId: number, operation: string, key: string): string {
  return createHash("sha256")
    .update(`${IDEMPOTENCY_DOMAIN}:uid=${userId}:op=${operation}:key=${key}`)
    .digest("hex");
}

/**
 * Hash the mutable request payload to detect same-key-different-body conflicts.
 * The hash is stored as `requestFingerprint`. If a retried request has the
 * same idempotency key but a different fingerprint, we throw
 * IdempotencyConflictError → 409 at the route boundary.
 */
export function hashRequestFingerprint(payload: unknown): string {
  // Stable canonicalization: sort object keys, then JSON-stringify.
  const stable = JSON.stringify(payload, (_k, v) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.keys(v).sort().reduce<Record<string, unknown>>((acc, k) => { acc[k] = (v as Record<string, unknown>)[k]; return acc; }, {})
      : v
  );
  return createHash("sha256").update(stable).digest("hex");
}

// ---- Canonical mutation lock ----------------------------------------------

/**
 * Stable 64-bit canonical mutation key derived from (userId, normalized email).
 *
 * PostgreSQL has TWO `pg_advisory_xact_lock` overloads:
 *   - pg_advisory_xact_lock(key bigint) — single 64-bit key
 *   - pg_advisory_xact_lock(key1 integer, key2 integer) — two 32-bit keys
 * Passing two bigints matches NEITHER overload (PostgreSQL does not
 * auto-cast bigint → integer for function resolution). We use the single-
 * bigint overload and pack (tenant, email) into one 64-bit key:
 *   high 32 bits = userId (tenant isolation — different tenants → different
 *                  high halves → independent lock domains)
 *   low 32 bits  = first 8 hex chars of SHA-256(normalizedEmail) as uint32
 *                  (same email → same low half regardless of caller)
 */
function canonicalLockKey(userId: number, normalizedEmail: string): bigint {
  const tenant = BigInt(userId) & BigInt("0xffffffff"); // low 32 bits of userId
  const emailHex = createHash("sha256").update(normalizedEmail).digest("hex").slice(0, 8);
  const email = BigInt(parseInt(emailHex, 16)) & BigInt("0xffffffff");
  // Pack: high 32 bits = tenant, low 32 bits = email hash.
  return (tenant << BigInt(32)) | email;
}

/**
 * Acquire a transaction-scoped advisory lock for the canonical (userId, email)
 * mutation target. The lock is automatically released when the transaction
 * commits or rolls back.
 *
 * This serializes concurrent consent/suppression operations on the same
 * (tenant, email) pair, ensuring the post-lock state read is fresh and the
 * history transition chain is coherent.
 *
 * Uses $executeRawUnsafe with a parameterized query — passing the bigint as
 * a string avoids Prisma's BigInt serialization quirks. The cast to ::bigint
 * is explicit so PostgreSQL resolves the function overload unambiguously.
 */
async function acquireCanonicalLock(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  userId: number,
  normalizedEmail: string,
): Promise<void> {
  const key = canonicalLockKey(userId, normalizedEmail);
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock($1::bigint)", key.toString());
}

// ---- Public types ---------------------------------------------------------

export interface ConsentOperationOptions {
  userId: number;
  contactId: number;
  source: ConsentSource;
  reason?: string;
  /** Optional caller-supplied idempotency key. When set, the operation is deduped per (userId, operation, contact, key). */
  idempotencyKey?: string;
  /** Optional request ID for timeline correlation. */
  requestId?: string;
  /** Optional request payload for fingerprint conflict detection. */
  requestPayload?: unknown;
}

export interface ConsentResult {
  /**
   * - "applied": actual state transition occurred (history appended).
   * - "no_op": target state already current AND no idempotency key — no audit row created.
   * - "idempotent_replay": idempotency key matched a prior operation — same eventId returned, no new history.
   */
  status: "applied" | "no_op" | "idempotent_replay";
  /** Previous marketingStatus (null if contact not found). */
  previousStatus: MarketingStatus | null;
  /** New marketingStatus (null if contact not found). */
  newStatus: MarketingStatus | null;
  /** Public UUID of the ContactConsentEvent row (null if no event was created). */
  eventId: string | null;
  /** True if the contact was not found. */
  contactNotFound: boolean;
}

export interface SuppressOptions {
  userId: number;
  /** Email to suppress. Will be normalized. */
  email: string;
  reason: SuppressionReason;
  source: ConsentSource;
  /** If provided, also transition this contact's marketing status to unsubscribed. */
  contactId?: number;
  idempotencyKey?: string;
  requestId?: string;
  requestPayload?: unknown;
}

export interface SuppressResult {
  status: "applied" | "no_op" | "idempotent_replay";
  suppressionId: string | null;
  email: string;
  active: boolean;
  eventId: string | null;
  contactNotFound: boolean;
}

export interface UnsuppressOptions {
  userId: number;
  email: string;
  source: ConsentSource;
  /**
   * If true, this becomes an EXPLICIT subscribe action — routes through
   * subscribeContact for the full atomic transition (lifts suppression AND
   * sets marketingStatus=subscribed). Defaults to false — lifting alone
   * does NOT change marketingStatus.
   */
  alsoSubscribe?: boolean;
  idempotencyKey?: string;
  requestId?: string;
  requestPayload?: unknown;
}

export interface UnsuppressResult {
  status: "applied" | "no_op" | "idempotent_replay" | "not_suppressed";
  email: string;
  active: boolean;
  eventId: string | null;
}

export type MarketingEligibility =
  | { eligible: true; contactId: number; email: string }
  | {
      eligible: false;
      reason: "contact_not_found" | "not_subscribed" | "suppressed";
      contactId: number | null;
      email: string | null;
    };

/**
 * Thrown when a retried request carries the same idempotency key but a
 * different mutable payload than the original. Route handlers should map this
 * to a 409 `idempotency_conflict` response.
 */
export class IdempotencyConflictError extends Error {
  constructor(message = "Idempotency key reused with conflicting request payload.") {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

// ---- Internal: idempotency record helpers --------------------------------

/**
 * Durable idempotency outcome record lookup.
 *
 * Decoupled from transition-event tables so that a NO-OP request can be
 * durably replayed. A retry with the same key (even after the contact's
 * state has changed) replays the ORIGINAL outcome — it does NOT re-evaluate
 * and potentially apply a transition that the original request did not apply.
 *
 * The unique namespace is (userId, operation, idempotencyKeyHash). The
 * target (targetType + targetKey) is verified before replay to prevent
 * cross-target key reuse. The requestFingerprint is verified to detect
 * same-key-different-payload conflicts.
 *
 * Returns null when:
 *   - no idempotencyKeyHash was supplied (no dedup requested), OR
 *   - no prior record exists for this (userId, operation, idempotencyKeyHash).
 */
async function findExistingIdempotency(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  userId: number,
  operation: string,
  idempotencyKeyHash: string | null,
  expectedTargetType: string,
  expectedTargetKey: string,
): Promise<{
  requestFingerprint: string | null;
  resultStatus: string;
  resultEventId: string | null;
  resultSuppressionId: string | null;
} | null> {
  if (!idempotencyKeyHash) return null;
  const existing = await tx.consentMutationIdempotency.findUnique({
    where: { userId_operation_idempotencyKeyHash: { userId, operation, idempotencyKeyHash } },
    select: {
      requestFingerprint: true,
      resultStatus: true,
      resultEventId: true,
      resultSuppressionId: true,
      targetType: true,
      targetKey: true,
    },
  });
  if (!existing) return null;
  // Verify the target matches — same key reused for a different target is a conflict.
  if (existing.targetType !== expectedTargetType || existing.targetKey !== expectedTargetKey) {
    throw new IdempotencyConflictError(
      `Idempotency key already used for a different ${expectedTargetType} target.`,
    );
  }
  return {
    requestFingerprint: existing.requestFingerprint,
    resultStatus: existing.resultStatus,
    resultEventId: existing.resultEventId,
    resultSuppressionId: existing.resultSuppressionId,
  };
}

/**
 * Persist a durable idempotency outcome record. Called after the mutation
 * (or no-op) has been decided but BEFORE the transaction commits, so the
 * outcome record and any state mutation commit atomically.
 *
 * If the (userId, operation, idempotencyKeyHash) tuple already exists (race
 * with a concurrent insert), P2002 propagates out of the transaction and is
 * caught by the outer try/catch — which then re-reads and returns the
 * existing outcome.
 */
async function persistIdempotencyOutcome(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  opts: {
    userId: number;
    operation: string;
    targetType: string;
    targetKey: string;
    idempotencyKeyHash: string;
    requestFingerprint: string | null;
    resultStatus: string; // "applied" | "no_op" | "not_suppressed"
    resultEventId?: string | null;
    resultSuppressionId?: string | null;
  },
): Promise<void> {
  await tx.consentMutationIdempotency.create({
    data: {
      userId: opts.userId,
      operation: opts.operation,
      targetType: opts.targetType,
      targetKey: opts.targetKey,
      idempotencyKeyHash: opts.idempotencyKeyHash,
      requestFingerprint: opts.requestFingerprint,
      resultStatus: opts.resultStatus,
      resultEventId: opts.resultEventId ?? null,
      resultSuppressionId: opts.resultSuppressionId ?? null,
    },
    select: { id: true },
  });
}

/**
 * Verify a request fingerprint matches the stored one. Throws IdempotencyConflictError
 * if the fingerprints disagree (same key, different mutable payload).
 */
function verifyFingerprint(
  stored: string | null,
  incoming: string | null,
): void {
  if (stored !== null && incoming !== null && stored !== incoming) {
    throw new IdempotencyConflictError(
      "Idempotency key reused with conflicting request payload.",
    );
  }
  // If either is null, we don't enforce (one of the calls didn't supply a payload).
  // The DB row was created on the first call; the retry just returns the stored result.
}

// ---- Target encoding helpers ---------------------------------------------

const TARGET_TYPE_CONTACT = "contact";
const TARGET_TYPE_EMAIL = "email";

function contactTargetKey(contactId: number): string {
  return String(contactId);
}

// ---- Public service functions --------------------------------------------

/**
 * Explicitly subscribe a Contact to marketing.
 *
 * Atomic transition (all in one transaction with canonical lock held):
 *   - Acquire pg_advisory_xact_lock(userId, emailKey)
 *   - Re-read Contact state AFTER lock acquisition (no stale snapshot)
 *   - Idempotency check: if (userId, "subscribe", idempotencyKeyHash) exists, verify fingerprint + return idempotent_replay
 *   - If marketingStatus === "subscribed" AND no idempotency key → return no_op (NO fake transition event)
 *   - If marketingStatus === "subscribed" AND idempotency key → append audit row (first time we've seen this key)
 *   - Update Contact: marketingStatus→subscribed, marketingConsentSource→source, marketingConsentAt→now
 *   - Lift any active suppression (Phase 9 only writes unsubscribe/manual — both safe to lift on explicit subscribe)
 *   - Append ContactConsentEvent(subscribed) row
 *   - Append SuppressionEvent(lifted) row IF a suppression was lifted
 *   - Append ContactEvent timeline "contact.subscribed"
 *
 * P2002 from a concurrent insert races us — caught OUTSIDE the tx.
 */
export async function subscribeContact(opts: ConsentOperationOptions): Promise<ConsentResult> {
  const { userId, contactId, source, reason, idempotencyKey, requestId, requestPayload } = opts;
  if (!VALID_CONSENT_SOURCES.has(source)) {
    throw new Error(`Invalid consent source: ${source}`);
  }

  const operation = CONSENT_OPERATIONS.SUBSCRIBE;
  const idempotencyKeyHash = idempotencyKey ? hashIdempotencyKey(userId, operation, idempotencyKey) : null;
  const requestFingerprint = requestPayload !== undefined ? hashRequestFingerprint(requestPayload) : null;

  try {
    return await db.$transaction(async (tx) => {
      // 1. Resolve Contact to get email (pre-lock read — for lock acquisition).
      const contact = await tx.contact.findFirst({
        where: { id: contactId, userId },
        select: { id: true, email: true, marketingStatus: true },
      });
      if (!contact) {
        return {
          status: "no_op" as const,
          previousStatus: null,
          newStatus: null,
          eventId: null,
          contactNotFound: true,
        };
      }

      // 2. Acquire canonical lock for (userId, email).
      await acquireCanonicalLock(tx, userId, contact.email);

      // 3. Re-read Contact AFTER lock (fresh state — no stale snapshot).
      const fresh = await tx.contact.findFirst({
        where: { id: contactId, userId },
        select: { id: true, email: true, marketingStatus: true },
      });
      if (!fresh) {
        return {
          status: "no_op" as const,
          previousStatus: null,
          newStatus: null,
          eventId: null,
          contactNotFound: true,
        };
      }
      const previousStatus = fresh.marketingStatus as MarketingStatus;

      // 4. Durable idempotency check (inside tx, after lock — serializable).
      //    Uses the dedicated ConsentMutationIdempotency table so a no_op
      //    outcome can be durably replayed without creating a fake transition.
      const existingIdem = await findExistingIdempotency(
        tx, userId, operation, idempotencyKeyHash,
        TARGET_TYPE_CONTACT, contactTargetKey(contactId),
      );
      if (existingIdem) {
        verifyFingerprint(existingIdem.requestFingerprint, requestFingerprint);
        // Replay the ORIGINAL outcome — even if the contact's state has since
        // changed. The original request was a no_op / applied, and a retry must
        // NOT re-evaluate and potentially apply a different transition.
        if (existingIdem.resultEventId === null) {
          // Original was a no_op — return the current state but mark as replay.
          return {
            status: "idempotent_replay" as const,
            previousStatus,
            newStatus: previousStatus, // unchanged — original was a no_op
            eventId: null,
            contactNotFound: false,
          };
        }
        // Original was an applied transition — return the stored eventId.
        return {
          status: "idempotent_replay" as const,
          previousStatus,
          newStatus: MARKETING_STATUSES.SUBSCRIBED,
          eventId: existingIdem.resultEventId,
          contactNotFound: false,
        };
      }

      // 5. No-op semantics: already subscribed → NO state mutation, NO fake
      //    transition event, REGARDLESS of whether an idempotency key is present.
      //    The idempotency key (if supplied) is persisted to the durable
      //    idempotency table with resultStatus="no_op" so a retry replays the
      //    no_op rather than re-evaluating against the (possibly changed) state.
      if (previousStatus === MARKETING_STATUSES.SUBSCRIBED) {
        if (idempotencyKeyHash) {
          await persistIdempotencyOutcome(tx, {
            userId, operation,
            targetType: TARGET_TYPE_CONTACT,
            targetKey: contactTargetKey(contactId),
            idempotencyKeyHash,
            requestFingerprint,
            resultStatus: "no_op",
            resultEventId: null,
          });
        }
        return {
          status: "no_op" as const,
          previousStatus,
          newStatus: MARKETING_STATUSES.SUBSCRIBED,
          eventId: null,
          contactNotFound: false,
        };
      }

      // 6. Apply the mutation (real transition: previousStatus !== subscribed).
      const now = new Date();
      await tx.contact.update({
        where: { id: contact.id },
        data: {
          marketingStatus: MARKETING_STATUSES.SUBSCRIBED,
          marketingConsentSource: source,
          marketingConsentAt: now,
        },
      });

      // 7. Lift any active suppression as a side effect of explicit subscribe.
      // Phase 9 only writes "unsubscribe" / "manual" suppressions, both safe
      // to lift here. Phase 11 hard_bounce/complaint will need separate logic.
      const currentSuppression = await tx.suppressionEntry.findUnique({
        where: { userId_email: { userId, email: contact.email } },
        select: { id: true, active: true, reason: true, suppressionId: true },
      });
      let liftedSuppressionId: string | null = null;
      if (currentSuppression && currentSuppression.active) {
        await tx.suppressionEntry.update({
          where: { id: currentSuppression.id },
          data: { active: false, liftedAt: now, source },
        });
        liftedSuppressionId = currentSuppression.suppressionId;
        // Append SuppressionEvent("lifted") via createMany(skipDuplicates:true)
        // — conflict-safe without in-tx try/catch.
        await tx.suppressionEvent.createMany({
          data: [{
            userId,
            suppressionId: currentSuppression.id,
            email: contact.email,
            operation: SUPPRESSION_OPERATIONS.UNSUPPRESS,
            action: SUPPRESSION_ACTIONS.LIFTED,
            reason: currentSuppression.reason,
            source,
            idempotencyKeyHash: idempotencyKeyHash ? `${idempotencyKeyHash}:lift` : null,
            requestFingerprint: null, // the lift is a deterministic side effect, not independently idempotent
          }],
          skipDuplicates: true,
        });
      }

      // 8. Append immutable ConsentEvent. P2002 (if a concurrent insert races
      //    us) propagates out of the tx and is caught by the outer try/catch.
      const consentEvent = await tx.contactConsentEvent.create({
        data: {
          userId,
          contactId: contact.id,
          operation,
          previousStatus,
          newStatus: MARKETING_STATUSES.SUBSCRIBED,
          source,
          reason: reason ?? null,
          idempotencyKeyHash,
          requestFingerprint,
        },
        select: { eventId: true },
      });

      // 8b. Persist durable idempotency outcome (resultStatus="applied").
      if (idempotencyKeyHash) {
        await persistIdempotencyOutcome(tx, {
          userId, operation,
          targetType: TARGET_TYPE_CONTACT,
          targetKey: contactTargetKey(contactId),
          idempotencyKeyHash,
          requestFingerprint,
          resultStatus: "applied",
          resultEventId: consentEvent.eventId,
          resultSuppressionId: liftedSuppressionId,
        });
      }

      // 9. Timeline event (idempotent via createMany skipDuplicates when key set).
      const timelineDedupeKey = idempotencyKeyHash
        ? `subscribe:${userId}:${contact.id}:${idempotencyKeyHash}`
        : null;
      await tx.contactEvent.createMany({
        data: [{
          contactId: contact.id,
          type: "contact.subscribed",
          detail: { source, previousStatus, reason: reason ?? null } as any,
          requestId: requestId ?? null,
          dedupeKey: timelineDedupeKey,
        }],
        skipDuplicates: true,
      });

      return {
        status: "applied" as const,
        previousStatus,
        newStatus: MARKETING_STATUSES.SUBSCRIBED,
        eventId: consentEvent.eventId,
        contactNotFound: false,
      };
    });
  } catch (err: any) {
    if (err instanceof IdempotencyConflictError) throw err;
    if (err?.code === "P2002" && idempotencyKeyHash) {
      // Race: a concurrent insert with the same idempotencyKeyHash won.
      // Fetch the existing idempotency outcome and return idempotent_replay.
      const existingIdem = await db.consentMutationIdempotency.findUnique({
        where: { userId_operation_idempotencyKeyHash: { userId, operation, idempotencyKeyHash } },
        select: {
          requestFingerprint: true, resultStatus: true, resultEventId: true,
          targetType: true, targetKey: true,
        },
      });
      if (existingIdem) {
        if (existingIdem.targetType !== TARGET_TYPE_CONTACT || existingIdem.targetKey !== contactTargetKey(contactId)) {
          throw new IdempotencyConflictError("Idempotency key already used for a different contact target.");
        }
        verifyFingerprint(existingIdem.requestFingerprint, requestFingerprint);
        // Re-read current contact state for the returned previousStatus.
        const fresh = await db.contact.findFirst({
          where: { id: contactId, userId },
          select: { marketingStatus: true },
        });
        const currentStatus = (fresh?.marketingStatus ?? MARKETING_STATUSES.UNKNOWN) as MarketingStatus;
        if (existingIdem.resultEventId === null) {
          return {
            status: "idempotent_replay",
            previousStatus: currentStatus,
            newStatus: currentStatus,
            eventId: null,
            contactNotFound: false,
          };
        }
        return {
          status: "idempotent_replay",
          previousStatus: currentStatus,
          newStatus: MARKETING_STATUSES.SUBSCRIBED,
          eventId: existingIdem.resultEventId,
          contactNotFound: false,
        };
      }
    }
    throw err;
  }
}

/**
 * Explicitly unsubscribe a Contact from marketing.
 *
 * Atomic transition (all in one transaction with canonical lock held):
 *   - Acquire pg_advisory_xact_lock(userId, emailKey)
 *   - Re-read Contact state AFTER lock acquisition
 *   - Idempotency check + fingerprint verify
 *   - If already unsubscribed AND no idempotency key → no_op
 *   - Update Contact: marketingStatus→unsubscribed
 *   - Upsert SuppressionEntry active=true (reason=unsubscribe)
 *   - Append ContactConsentEvent(unsubscribed)
 *   - Append SuppressionEvent(suppressed)
 *   - Append ContactEvent timeline "contact.unsubscribed"
 */
export async function unsubscribeContact(opts: ConsentOperationOptions): Promise<ConsentResult> {
  const { userId, contactId, source, reason, idempotencyKey, requestId, requestPayload } = opts;
  if (!VALID_CONSENT_SOURCES.has(source)) {
    throw new Error(`Invalid consent source: ${source}`);
  }

  const operation = CONSENT_OPERATIONS.UNSUBSCRIBE;
  const idempotencyKeyHash = idempotencyKey ? hashIdempotencyKey(userId, operation, idempotencyKey) : null;
  const requestFingerprint = requestPayload !== undefined ? hashRequestFingerprint(requestPayload) : null;

  try {
    return await db.$transaction(async (tx) => {
      const contact = await tx.contact.findFirst({
        where: { id: contactId, userId },
        select: { id: true, email: true, marketingStatus: true },
      });
      if (!contact) {
        return {
          status: "no_op" as const,
          previousStatus: null,
          newStatus: null,
          eventId: null,
          contactNotFound: true,
        };
      }

      await acquireCanonicalLock(tx, userId, contact.email);

      const fresh = await tx.contact.findFirst({
        where: { id: contactId, userId },
        select: { id: true, email: true, marketingStatus: true },
      });
      if (!fresh) {
        return {
          status: "no_op" as const,
          previousStatus: null,
          newStatus: null,
          eventId: null,
          contactNotFound: true,
        };
      }
      const previousStatus = fresh.marketingStatus as MarketingStatus;

      const existingIdem = await findExistingIdempotency(
        tx, userId, operation, idempotencyKeyHash,
        TARGET_TYPE_CONTACT, contactTargetKey(contactId),
      );
      if (existingIdem) {
        verifyFingerprint(existingIdem.requestFingerprint, requestFingerprint);
        if (existingIdem.resultEventId === null) {
          return {
            status: "idempotent_replay" as const,
            previousStatus,
            newStatus: previousStatus,
            eventId: null,
            contactNotFound: false,
          };
        }
        return {
          status: "idempotent_replay" as const,
          previousStatus,
          newStatus: MARKETING_STATUSES.UNSUBSCRIBED,
          eventId: existingIdem.resultEventId,
          contactNotFound: false,
        };
      }

      // No-op: already unsubscribed → NO state mutation, NO fake transition.
      if (previousStatus === MARKETING_STATUSES.UNSUBSCRIBED) {
        if (idempotencyKeyHash) {
          await persistIdempotencyOutcome(tx, {
            userId, operation,
            targetType: TARGET_TYPE_CONTACT,
            targetKey: contactTargetKey(contactId),
            idempotencyKeyHash,
            requestFingerprint,
            resultStatus: "no_op",
            resultEventId: null,
          });
        }
        return {
          status: "no_op" as const,
          previousStatus,
          newStatus: MARKETING_STATUSES.UNSUBSCRIBED,
          eventId: null,
          contactNotFound: false,
        };
      }

      const now = new Date();
      await tx.contact.update({
        where: { id: contact.id },
        data: {
          marketingStatus: MARKETING_STATUSES.UNSUBSCRIBED,
          marketingConsentSource: source,
          marketingConsentAt: now,
        },
      });

      // Upsert current-state suppression entry.
      const suppression = await tx.suppressionEntry.upsert({
        where: { userId_email: { userId, email: contact.email } },
        create: {
          userId,
          email: contact.email,
          reason: SUPPRESSION_REASONS.UNSUBSCRIBE,
          source,
          active: true,
        },
        update: {
          reason: SUPPRESSION_REASONS.UNSUBSCRIBE,
          source,
          active: true,
          liftedAt: null,
        },
        select: { id: true, suppressionId: true },
      });

      const consentEvent = await tx.contactConsentEvent.create({
        data: {
          userId,
          contactId: contact.id,
          operation,
          previousStatus,
          newStatus: MARKETING_STATUSES.UNSUBSCRIBED,
          source,
          reason: reason ?? null,
          idempotencyKeyHash,
          requestFingerprint,
        },
        select: { eventId: true },
      });

      // Append SuppressionEvent("suppressed") — skipDuplicates for conflict-safety.
      await tx.suppressionEvent.createMany({
        data: [{
          userId,
          suppressionId: suppression.id,
          email: contact.email,
          operation: SUPPRESSION_OPERATIONS.SUPPRESS,
          action: SUPPRESSION_ACTIONS.SUPPRESSED,
          reason: SUPPRESSION_REASONS.UNSUBSCRIBE,
          source,
          idempotencyKeyHash: idempotencyKeyHash ? `${idempotencyKeyHash}:suppress` : null,
          requestFingerprint: null,
        }],
        skipDuplicates: true,
      });

      // Persist durable idempotency outcome (resultStatus="applied").
      if (idempotencyKeyHash) {
        await persistIdempotencyOutcome(tx, {
          userId, operation,
          targetType: TARGET_TYPE_CONTACT,
          targetKey: contactTargetKey(contactId),
          idempotencyKeyHash,
          requestFingerprint,
          resultStatus: "applied",
          resultEventId: consentEvent.eventId,
          resultSuppressionId: suppression.suppressionId,
        });
      }

      const timelineDedupeKey = idempotencyKeyHash
        ? `unsubscribe:${userId}:${contact.id}:${idempotencyKeyHash}`
        : null;
      await tx.contactEvent.createMany({
        data: [{
          contactId: contact.id,
          type: "contact.unsubscribed",
          detail: { source, previousStatus, reason: reason ?? null } as any,
          requestId: requestId ?? null,
          dedupeKey: timelineDedupeKey,
        }],
        skipDuplicates: true,
      });

      return {
        status: "applied" as const,
        previousStatus,
        newStatus: MARKETING_STATUSES.UNSUBSCRIBED,
        eventId: consentEvent.eventId,
        contactNotFound: false,
      };
    });
  } catch (err: any) {
    if (err instanceof IdempotencyConflictError) throw err;
    if (err?.code === "P2002" && idempotencyKeyHash) {
      const existingIdem = await db.consentMutationIdempotency.findUnique({
        where: { userId_operation_idempotencyKeyHash: { userId, operation, idempotencyKeyHash } },
        select: {
          requestFingerprint: true, resultStatus: true, resultEventId: true,
          targetType: true, targetKey: true,
        },
      });
      if (existingIdem) {
        if (existingIdem.targetType !== TARGET_TYPE_CONTACT || existingIdem.targetKey !== contactTargetKey(contactId)) {
          throw new IdempotencyConflictError("Idempotency key already used for a different contact target.");
        }
        verifyFingerprint(existingIdem.requestFingerprint, requestFingerprint);
        const fresh = await db.contact.findFirst({
          where: { id: contactId, userId },
          select: { marketingStatus: true },
        });
        const currentStatus = (fresh?.marketingStatus ?? MARKETING_STATUSES.UNKNOWN) as MarketingStatus;
        if (existingIdem.resultEventId === null) {
          return {
            status: "idempotent_replay",
            previousStatus: currentStatus,
            newStatus: currentStatus,
            eventId: null,
            contactNotFound: false,
          };
        }
        return {
          status: "idempotent_replay",
          previousStatus: currentStatus,
          newStatus: MARKETING_STATUSES.UNSUBSCRIBED,
          eventId: existingIdem.resultEventId,
          contactNotFound: false,
        };
      }
    }
    throw err;
  }
}

/**
 * Suppress an email at the tenant level. Optionally also unsubscribe the
 * matching Contact (if contactId is provided and belongs to the tenant).
 *
 * When contactId is provided, routes through unsubscribeContact for the
 * atomic ConsentEvent + SuppressionEvent pair (preserves consent history).
 * When no contactId is provided, performs an email-only suppression with
 * its own audit history.
 */
export async function suppressEmail(opts: SuppressOptions): Promise<SuppressResult> {
  const { userId, email, reason, source, contactId, idempotencyKey, requestId, requestPayload } = opts;
  if (!PHASE9_WRITABLE_REASONS.has(reason)) {
    throw new Error(`Phase 9 cannot write suppression reason: ${reason}`);
  }
  if (!VALID_CONSENT_SOURCES.has(source)) {
    throw new Error(`Invalid suppression source: ${source}`);
  }
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    throw new Error("Invalid email.");
  }

  const idempotencyKeyHash = idempotencyKey
    ? hashIdempotencyKey(userId, SUPPRESSION_OPERATIONS.SUPPRESS, idempotencyKey)
    : null;
  const requestFingerprint = requestPayload !== undefined ? hashRequestFingerprint(requestPayload) : null;

  // If a contactId was provided, route through unsubscribeContact.
  if (contactId !== undefined) {
    const consent = await unsubscribeContact({
      userId,
      contactId,
      source,
      reason,
      idempotencyKey,
      requestId,
      requestPayload,
    });
    if (consent.contactNotFound) {
      return {
        status: "no_op",
        suppressionId: null,
        email: normalized,
        active: false,
        eventId: null,
        contactNotFound: true,
      };
    }
    const entry = await db.suppressionEntry.findUnique({
      where: { userId_email: { userId, email: normalized } },
      select: { suppressionId: true, active: true },
    });
    return {
      status: consent.status === "idempotent_replay" ? "idempotent_replay" : "applied",
      suppressionId: entry?.suppressionId ?? null,
      email: normalized,
      active: entry?.active ?? false,
      eventId: consent.eventId,
      contactNotFound: false,
    };
  }

  // Email-only suppression.
  try {
    return await db.$transaction(async (tx) => {
      await acquireCanonicalLock(tx, userId, normalized);

      // Durable idempotency check.
      const existingIdem = await findExistingIdempotency(
        tx, userId, SUPPRESSION_OPERATIONS.SUPPRESS, idempotencyKeyHash,
        TARGET_TYPE_EMAIL, normalized,
      );
      if (existingIdem) {
        verifyFingerprint(existingIdem.requestFingerprint, requestFingerprint);
        const entry = await tx.suppressionEntry.findUnique({
          where: { userId_email: { userId, email: normalized } },
          select: { suppressionId: true, active: true },
        });
        return {
          status: "idempotent_replay" as const,
          suppressionId: existingIdem.resultSuppressionId ?? entry?.suppressionId ?? null,
          email: normalized,
          active: entry?.active ?? false,
          eventId: existingIdem.resultEventId,
          contactNotFound: false,
        };
      }

      // No-op: already suppressed with same effective reason → NO state mutation,
      // NO fake transition event. Idempotency key (if supplied) persisted to
      // the durable idempotency table with resultStatus="no_op".
      const currentEntry = await tx.suppressionEntry.findUnique({
        where: { userId_email: { userId, email: normalized } },
        select: { id: true, active: true, reason: true, suppressionId: true },
      });
      if (currentEntry && currentEntry.active && currentEntry.reason === reason) {
        if (idempotencyKeyHash) {
          await persistIdempotencyOutcome(tx, {
            userId, operation: SUPPRESSION_OPERATIONS.SUPPRESS,
            targetType: TARGET_TYPE_EMAIL,
            targetKey: normalized,
            idempotencyKeyHash,
            requestFingerprint,
            resultStatus: "no_op",
            resultEventId: null,
            resultSuppressionId: currentEntry.suppressionId,
          });
        }
        return {
          status: "no_op" as const,
          suppressionId: currentEntry.suppressionId,
          email: normalized,
          active: true,
          eventId: null,
          contactNotFound: false,
        };
      }

      const entry = await tx.suppressionEntry.upsert({
        where: { userId_email: { userId, email: normalized } },
        create: {
          userId,
          email: normalized,
          reason,
          source,
          active: true,
        },
        update: {
          reason,
          source,
          active: true,
          liftedAt: null,
        },
        select: { id: true, suppressionId: true, active: true },
      });

      const event = await tx.suppressionEvent.create({
        data: {
          userId,
          suppressionId: entry.id,
          email: normalized,
          operation: SUPPRESSION_OPERATIONS.SUPPRESS,
          action: SUPPRESSION_ACTIONS.SUPPRESSED,
          reason,
          source,
          idempotencyKeyHash,
          requestFingerprint,
        },
        select: { eventId: true },
      });

      // Persist durable idempotency outcome (resultStatus="applied").
      if (idempotencyKeyHash) {
        await persistIdempotencyOutcome(tx, {
          userId, operation: SUPPRESSION_OPERATIONS.SUPPRESS,
          targetType: TARGET_TYPE_EMAIL,
          targetKey: normalized,
          idempotencyKeyHash,
          requestFingerprint,
          resultStatus: "applied",
          resultEventId: event.eventId,
          resultSuppressionId: entry.suppressionId,
        });
      }

      return {
        status: "applied" as const,
        suppressionId: entry.suppressionId,
        email: normalized,
        active: true,
        eventId: event.eventId,
        contactNotFound: false,
      };
    });
  } catch (err: any) {
    if (err instanceof IdempotencyConflictError) throw err;
    if (err?.code === "P2002" && idempotencyKeyHash) {
      const existingIdem = await db.consentMutationIdempotency.findUnique({
        where: { userId_operation_idempotencyKeyHash: { userId, operation: SUPPRESSION_OPERATIONS.SUPPRESS, idempotencyKeyHash } },
        select: {
          requestFingerprint: true, resultStatus: true, resultEventId: true,
          resultSuppressionId: true, targetType: true, targetKey: true,
        },
      });
      if (existingIdem) {
        if (existingIdem.targetType !== TARGET_TYPE_EMAIL || existingIdem.targetKey !== normalized) {
          throw new IdempotencyConflictError("Idempotency key already used for a different email target.");
        }
        verifyFingerprint(existingIdem.requestFingerprint, requestFingerprint);
        const entry = await db.suppressionEntry.findUnique({
          where: { userId_email: { userId, email: normalized } },
          select: { suppressionId: true, active: true },
        });
        return {
          status: "idempotent_replay",
          suppressionId: existingIdem.resultSuppressionId ?? entry?.suppressionId ?? null,
          email: normalized,
          active: entry?.active ?? false,
          eventId: existingIdem.resultEventId,
          contactNotFound: false,
        };
      }
    }
    throw err;
  }
}

/**
 * Lift a suppression. By default this ONLY lifts the suppression — it does
 * NOT subscribe the contact. To resubscribe, pass `alsoSubscribe: true`
 * (which routes through subscribeContact for the explicit consent action).
 *
 * `alsoSubscribe: true` is the ONLY way to combine lift + subscribe. An
 * ordinary lift call CANNOT silently subscribe.
 */
export async function unsuppressEmail(opts: UnsuppressOptions): Promise<UnsuppressResult> {
  const { userId, email, source, alsoSubscribe, idempotencyKey, requestId, requestPayload } = opts;
  if (!VALID_CONSENT_SOURCES.has(source)) {
    throw new Error(`Invalid suppression source: ${source}`);
  }
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    throw new Error("Invalid email.");
  }

  // If alsoSubscribe is set, this is an EXPLICIT consent action — route
  // through subscribeContact which acquires the canonical lock and performs
  // the full atomic transition (subscribe + lift suppression).
  if (alsoSubscribe) {
    const contact = await db.contact.findUnique({
      where: { userId_email: { userId, email: normalized } },
      select: { id: true },
    });
    if (!contact) {
      // No contact — still lift any suppression that might exist.
      return liftOnly(userId, normalized, source, idempotencyKey, requestId, requestPayload);
    }
    const consent = await subscribeContact({
      userId,
      contactId: contact.id,
      source,
      idempotencyKey,
      requestId,
      requestPayload,
    });
    return {
      status: consent.status === "idempotent_replay" ? "idempotent_replay" : "applied",
      email: normalized,
      active: false, // subscribeContact lifted it
      eventId: consent.eventId,
    };
  }

  return liftOnly(userId, normalized, source, idempotencyKey, requestId, requestPayload);
}

async function liftOnly(
  userId: number,
  normalizedEmail: string,
  source: ConsentSource,
  idempotencyKey: string | undefined,
  requestId?: string,
  requestPayload?: unknown,
): Promise<UnsuppressResult> {
  const idempotencyKeyHash = idempotencyKey
    ? hashIdempotencyKey(userId, SUPPRESSION_OPERATIONS.UNSUPPRESS, idempotencyKey)
    : null;
  const requestFingerprint = requestPayload !== undefined ? hashRequestFingerprint(requestPayload) : null;

  try {
    return await db.$transaction(async (tx) => {
      await acquireCanonicalLock(tx, userId, normalizedEmail);

      const existingIdem = await findExistingIdempotency(
        tx, userId, SUPPRESSION_OPERATIONS.UNSUPPRESS, idempotencyKeyHash,
        TARGET_TYPE_EMAIL, normalizedEmail,
      );
      if (existingIdem) {
        verifyFingerprint(existingIdem.requestFingerprint, requestFingerprint);
        const entry = await tx.suppressionEntry.findUnique({
          where: { userId_email: { userId, email: normalizedEmail } },
          select: { active: true },
        });
        // Replay original outcome. If original was not_suppressed (resultEventId null),
        // return not_suppressed; otherwise return idempotent_replay with the stored eventId.
        if (existingIdem.resultEventId === null) {
          return {
            status: "idempotent_replay" as const,
            email: normalizedEmail,
            active: entry?.active ?? false,
            eventId: null,
          };
        }
        return {
          status: "idempotent_replay" as const,
          email: normalizedEmail,
          active: entry?.active ?? false,
          eventId: existingIdem.resultEventId,
        };
      }

      const entry = await tx.suppressionEntry.findUnique({
        where: { userId_email: { userId, email: normalizedEmail } },
        select: { id: true, active: true, reason: true, suppressionId: true },
      });
      if (!entry || !entry.active) {
        // No active suppression — no_op (do NOT create a fake "lift" event).
        // Persist the no_op outcome to the durable idempotency table so a retry
        // replays the not_suppressed result rather than re-evaluating.
        if (idempotencyKeyHash) {
          await persistIdempotencyOutcome(tx, {
            userId, operation: SUPPRESSION_OPERATIONS.UNSUPPRESS,
            targetType: TARGET_TYPE_EMAIL,
            targetKey: normalizedEmail,
            idempotencyKeyHash,
            requestFingerprint,
            resultStatus: "not_suppressed",
            resultEventId: null,
            resultSuppressionId: entry?.suppressionId ?? null,
          });
        }
        return {
          status: "not_suppressed" as const,
          email: normalizedEmail,
          active: false,
          eventId: null,
        };
      }

      const now = new Date();
      await tx.suppressionEntry.update({
        where: { id: entry.id },
        data: { active: false, liftedAt: now, source },
      });

      const event = await tx.suppressionEvent.create({
        data: {
          userId,
          suppressionId: entry.id,
          email: normalizedEmail,
          operation: SUPPRESSION_OPERATIONS.UNSUPPRESS,
          action: SUPPRESSION_ACTIONS.LIFTED,
          reason: entry.reason,
          source,
          idempotencyKeyHash,
          requestFingerprint,
        },
        select: { eventId: true },
      });

      // Persist durable idempotency outcome (resultStatus="applied").
      if (idempotencyKeyHash) {
        await persistIdempotencyOutcome(tx, {
          userId, operation: SUPPRESSION_OPERATIONS.UNSUPPRESS,
          targetType: TARGET_TYPE_EMAIL,
          targetKey: normalizedEmail,
          idempotencyKeyHash,
          requestFingerprint,
          resultStatus: "applied",
          resultEventId: event.eventId,
          resultSuppressionId: entry.suppressionId,
        });
      }

      // Optional timeline event for the matching contact.
      const contact = await tx.contact.findUnique({
        where: { userId_email: { userId, email: normalizedEmail } },
        select: { id: true },
      });
      if (contact) {
        await tx.contactEvent.createMany({
          data: [{
            contactId: contact.id,
            type: "contact.unsuppressed",
            detail: { source, reason: entry.reason } as any,
            requestId: requestId ?? null,
            dedupeKey: idempotencyKeyHash
              ? `unsuppress:${userId}:${contact.id}:${idempotencyKeyHash}`
              : null,
          }],
          skipDuplicates: true,
        });
      }

      return {
        status: "applied" as const,
        email: normalizedEmail,
        active: false,
        eventId: event.eventId,
      };
    });
  } catch (err: any) {
    if (err instanceof IdempotencyConflictError) throw err;
    if (err?.code === "P2002" && idempotencyKeyHash) {
      const existingIdem = await db.consentMutationIdempotency.findUnique({
        where: { userId_operation_idempotencyKeyHash: { userId, operation: SUPPRESSION_OPERATIONS.UNSUPPRESS, idempotencyKeyHash } },
        select: {
          requestFingerprint: true, resultStatus: true, resultEventId: true,
          targetType: true, targetKey: true,
        },
      });
      if (existingIdem) {
        if (existingIdem.targetType !== TARGET_TYPE_EMAIL || existingIdem.targetKey !== normalizedEmail) {
          throw new IdempotencyConflictError("Idempotency key already used for a different email target.");
        }
        verifyFingerprint(existingIdem.requestFingerprint, requestFingerprint);
        return {
          status: "idempotent_replay",
          email: normalizedEmail,
          active: false,
          eventId: existingIdem.resultEventId,
        };
      }
    }
    throw err;
  }
}

/**
 * Centralized marketing eligibility check. Authoritative for future Phase 10
 * Broadcast sending. Phase 9 does NOT enforce this on transactional Send.
 *
 * Rule:
 *   Contact.marketingStatus === "subscribed"
 *   AND no active suppression exists for (userId, normalized email)
 */
export async function getMarketingEligibility(
  userId: number,
  contactId: number,
): Promise<MarketingEligibility> {
  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: { id: true, email: true, marketingStatus: true },
  });
  if (!contact) {
    return { eligible: false, reason: "contact_not_found", contactId: null, email: null };
  }
  if (contact.marketingStatus !== MARKETING_STATUSES.SUBSCRIBED) {
    return {
      eligible: false,
      reason: "not_subscribed",
      contactId: contact.id,
      email: contact.email,
    };
  }
  const suppression = await db.suppressionEntry.findUnique({
    where: { userId_email: { userId, email: contact.email } },
    select: { active: true },
  });
  if (suppression?.active) {
    return {
      eligible: false,
      reason: "suppressed",
      contactId: contact.id,
      email: contact.email,
    };
  }
  return { eligible: true, contactId: contact.id, email: contact.email };
}

/**
 * Eligibility check by email (used by future Broadcast sending).
 */
export async function getMarketingEligibilityByEmail(
  userId: number,
  email: string,
): Promise<MarketingEligibility> {
  const normalized = normalizeEmail(email);
  const contact = await db.contact.findUnique({
    where: { userId_email: { userId, email: normalized } },
    select: { id: true, email: true, marketingStatus: true },
  });
  if (!contact) {
    return { eligible: false, reason: "contact_not_found", contactId: null, email: null };
  }
  if (contact.marketingStatus !== MARKETING_STATUSES.SUBSCRIBED) {
    return {
      eligible: false,
      reason: "not_subscribed",
      contactId: contact.id,
      email: contact.email,
    };
  }
  const suppression = await db.suppressionEntry.findUnique({
    where: { userId_email: { userId, email: contact.email } },
    select: { active: true },
  });
  if (suppression?.active) {
    return {
      eligible: false,
      reason: "suppressed",
      contactId: contact.id,
      email: contact.email,
    };
  }
  return { eligible: true, contactId: contact.id, email: contact.email };
}

// ---- Read helpers (for dashboard + v1 GET endpoints) ----------------------

export interface ConsentSummary {
  contactId: number;
  marketingStatus: MarketingStatus;
  marketingConsentSource: string | null;
  marketingConsentAt: Date | null;
  suppressed: boolean;
  suppressionReason: string | null;
  suppressionSource: string | null;
  suppressionLiftedAt: Date | null;
  eligible: boolean;
}

export async function getConsentSummary(
  userId: number,
  contactId: number,
): Promise<ConsentSummary | null> {
  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: {
      id: true,
      marketingStatus: true,
      marketingConsentSource: true,
      marketingConsentAt: true,
      email: true,
    },
  });
  if (!contact) return null;

  const suppression = await db.suppressionEntry.findUnique({
    where: { userId_email: { userId, email: contact.email } },
    select: { active: true, reason: true, source: true, liftedAt: true },
  });

  const eligible =
    contact.marketingStatus === MARKETING_STATUSES.SUBSCRIBED && !(suppression?.active ?? false);

  return {
    contactId: contact.id,
    marketingStatus: contact.marketingStatus as MarketingStatus,
    marketingConsentSource: contact.marketingConsentSource,
    marketingConsentAt: contact.marketingConsentAt,
    suppressed: suppression?.active ?? false,
    suppressionReason: suppression?.reason ?? null,
    suppressionSource: suppression?.source ?? null,
    suppressionLiftedAt: suppression?.liftedAt ?? null,
    eligible,
  };
}

export interface SuppressionListEntry {
  id: number;
  suppressionId: string;
  email: string;
  reason: string;
  source: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  liftedAt: Date | null;
}

export async function listSuppressions(
  userId: number,
  opts: {
    page?: number;
    pageSize?: number;
    activeOnly?: boolean;
    search?: string;
  } = {},
): Promise<{ suppressions: SuppressionListEntry[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  const search = opts.search?.trim().toLowerCase();

  const where: Record<string, unknown> = { userId };
  if (opts.activeOnly) where.active = true;
  if (search) where.email = { contains: search };

  const [rows, total] = await Promise.all([
    db.suppressionEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.suppressionEntry.count({ where }),
  ]);

  return {
    suppressions: rows.map((r) => ({
      id: r.id,
      suppressionId: r.suppressionId,
      email: r.email,
      reason: r.reason,
      source: r.source,
      active: r.active,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      liftedAt: r.liftedAt,
    })),
    total,
    page,
    pageSize,
  };
}

export async function getSuppressionByPublicId(
  userId: number,
  suppressionId: string,
): Promise<SuppressionListEntry | null> {
  const entry = await db.suppressionEntry.findFirst({
    where: { suppressionId, userId },
  });
  if (!entry) return null;
  return {
    id: entry.id,
    suppressionId: entry.suppressionId,
    email: entry.email,
    reason: entry.reason,
    source: entry.source,
    active: entry.active,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    liftedAt: entry.liftedAt,
  };
}

/**
 * Lift a suppression by its public suppressionId. Tenant-scoped — returns
 * `not_suppressed` if the entry doesn't exist or doesn't belong to the user.
 *
 * By default this ONLY lifts — it does NOT resubscribe. Pass `alsoSubscribe:
 * true` to also perform an explicit subscribe action on the matching contact.
 */
export async function unsuppressByPublicId(
  userId: number,
  suppressionId: string,
  source: ConsentSource,
  opts: { alsoSubscribe?: boolean; idempotencyKey?: string; requestId?: string; requestPayload?: unknown } = {},
): Promise<UnsuppressResult> {
  const entry = await db.suppressionEntry.findFirst({
    where: { suppressionId, userId },
    select: { email: true, active: true },
  });
  if (!entry) {
    return {
      status: "not_suppressed",
      email: "",
      active: false,
      eventId: null,
    };
  }
  return unsuppressEmail({
    userId,
    email: entry.email,
    source,
    alsoSubscribe: opts.alsoSubscribe,
    idempotencyKey: opts.idempotencyKey,
    requestId: opts.requestId,
    requestPayload: opts.requestPayload,
  });
}

// ---- Audit history reads --------------------------------------------------

export interface ConsentHistoryEntry {
  eventId: string;
  contactId: number;
  operation: string;
  previousStatus: string;
  newStatus: string;
  source: string;
  reason: string | null;
  createdAt: Date;
}

export async function getConsentHistory(
  userId: number,
  contactId: number,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ events: ConsentHistoryEntry[]; total: number }> {
  // Verify ownership first.
  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: { id: true },
  });
  if (!contact) return { events: [], total: 0 };

  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
  const offset = Math.max(0, opts.offset ?? 0);

  const [rows, total] = await Promise.all([
    db.contactConsentEvent.findMany({
      where: { userId, contactId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.contactConsentEvent.count({ where: { userId, contactId } }),
  ]);

  return {
    events: rows.map((r) => ({
      eventId: r.eventId,
      contactId: r.contactId,
      operation: r.operation,
      previousStatus: r.previousStatus,
      newStatus: r.newStatus,
      source: r.source,
      reason: r.reason,
      createdAt: r.createdAt,
    })),
    total,
  };
}

/**
 * Verify the consent history transition chain for a contact is coherent:
 * for events ordered by createdAt asc, event[n].previousStatus === event[n-1].newStatus.
 * Used by tests to assert the serializability invariant.
 */
export async function verifyConsentHistoryChain(
  userId: number,
  contactId: number,
): Promise<{ coherent: boolean; events: ConsentHistoryEntry[] }> {
  const contact = await db.contact.findFirst({
    where: { id: contactId, userId },
    select: { id: true, marketingStatus: true },
  });
  if (!contact) return { coherent: false, events: [] };

  const rows = await db.contactConsentEvent.findMany({
    where: { userId, contactId },
    orderBy: { createdAt: "asc" },
  });

  let coherent = true;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].previousStatus !== rows[i - 1].newStatus) {
      coherent = false;
      break;
    }
  }
  // Final Contact state must equal last event's newStatus.
  if (rows.length > 0 && rows[rows.length - 1].newStatus !== contact.marketingStatus) {
    coherent = false;
  }

  return {
    coherent,
    events: rows.map((r) => ({
      eventId: r.eventId,
      contactId: r.contactId,
      operation: r.operation,
      previousStatus: r.previousStatus,
      newStatus: r.newStatus,
      source: r.source,
      reason: r.reason,
      createdAt: r.createdAt,
    })),
  };
}

// ---- Convenience: generate a fresh idempotency key for callers that don't have one ----
export function newIdempotencyKey(): string {
  return randomUUID();
}
