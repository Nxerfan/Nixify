/**
 * Phase 10 — Broadcast service.
 *
 * Central service for all broadcast lifecycle operations:
 *   - Draft CRUD (create, get, list, update, delete)
 *   - Audience preview (DB-side aggregation — no N+1, no unbounded lists)
 *   - Launch (DB-side INSERT...SELECT audience snapshot + freeze content +
 *     review threshold check + Idempotency-Key dedup)
 *   - Cancel (idempotent + Idempotency-Key dedup)
 *   - Recipient claiming (atomic CAS, stale recovery — processing only)
 *   - Dispatch state (processing → dispatching CAS before provider call;
 *     stale dispatching → terminal failed, NEVER auto-requeued)
 *   - Send processing (eligibility re-check + render + provider dispatch)
 *   - Finalization (0 pending + 0 processing + 0 dispatching → completed)
 *
 * INVARIANTS:
 *   1. Audience membership is snapshotted at launch via DB-side INSERT...SELECT.
 *      No full-audience ID array is materialized in Node memory.
 *   2. Consent/suppression is NOT snapshotted — it's re-checked immediately
 *      before provider dispatch via `getMarketingEligibility()`.
 *   3. Counts are DERIVED from BroadcastRecipient rows (no retry-sensitive counters).
 *   4. Content is frozen at launch — no editing after draft status.
 *   5. Structural tenant isolation via composite FK on (userId, broadcastId).
 *   6. BROADCAST_EMAILS quota consumed exactly once per actual provider attempt.
 *      Skipped recipients consume no quota. Idempotent replays consume no second quota.
 *   7. BROADCAST_EMAILS access is enforced centrally in this service (in addition
 *      to CONTACTS at the route boundary). Null-owner/system v1 keys cannot act
 *      as Broadcast tenants.
 *   8. The `dispatching` state is the durable exclusive dispatch marker — only
 *      the worker that wins the `processing → dispatching` CAS may call
 *      `provider.send()`. Stale dispatching rows become terminal `failed` with
 *      errorCode=provider_outcome_unknown; they are NEVER auto-requeued.
 *   9. Contact deletion → recipient row survives (contactId nullable + ON DELETE
 *      SET NULL). processRecipient handles contactId === null → skipped with
 *      contact_not_found.
 */
import { db } from "@/lib/db";
import { randomUUID, createHash } from "crypto";
import {
  BROADCAST_STATUSES,
  REVIEW_STATUSES,
  RECIPIENT_STATUSES,
  SKIP_REASONS,
  AUDIENCE_TYPES,
  CANCELLABLE_STATUSES,
  EDITABLE_STATUSES,
  BROADCAST_BATCH_SIZE,
  BROADCAST_STALE_LOCK_TIMEOUT_MS,
  BROADCAST_DISPATCH_TIMEOUT_MS,
  BROADCAST_REVIEW_THRESHOLD,
  SEND_ERROR_CODES,
  IDEMPOTENCY_KEY_MIN,
  IDEMPOTENCY_KEY_MAX,
  type BroadcastStatus,
  type AudienceType,
} from "./constants";
import {
  validateFullDraft,
  validateBroadcastContent,
  renderBroadcastContent,
  buildUnsubscribeUrl,
  buildListUnsubscribeHeader,
} from "./content";
import { canAccess, checkUsage } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { getMarketingEligibility } from "@/lib/consent/service";
import { mintUnsubscribeToken } from "@/lib/consent/token";
import { SmtpEmailProvider } from "@/lib/messaging/providers/smtp";
import type { EmailProvider } from "@/lib/messaging/providers/provider";

// ---- Types ----------------------------------------------------------------

export interface CreateBroadcastInput {
  userId: number;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string | null;
  audienceType: AudienceType;
  targetGroupId?: number | null;
}

export interface BroadcastSummary {
  id: number;
  broadcastId: string;
  userId: number;
  name: string;
  subject: string;
  audienceType: string;
  targetGroupId: number | null;
  status: string;
  reviewStatus: string;
  scheduledAt: string | null;
  launchedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Derived counts (from BroadcastRecipient rows)
  totalRecipients: number;
  pendingCount: number;
  processingCount: number;
  dispatchingCount: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
}

export interface PreviewResult {
  total: number;
  eligible: number;
  unknown: number;
  unsubscribed: number;
  suppressed: number;
}

export interface LaunchResult {
  launched: boolean;
  broadcastId: string;
  status: string;
  reviewStatus: string;
  recipientCount: number;
  requiresReview: boolean;
}

export class BroadcastValidationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BroadcastValidationError";
  }
}

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

// ---- Capability gate (BROADCAST_EMAILS) -----------------------------------

/**
 * Enforce BROADCAST_EMAILS capability at the service boundary. This is the
 * CENTRAL gate — Dashboard and v1 routes cannot diverge.
 *
 * Null-owner/system v1 keys (userId === null) cannot act as Broadcast tenants.
 * The CONTACTS gate at the route boundary is in ADDITION to this, not a
 * replacement.
 */
async function requireBroadcastAccess(userId: number): Promise<void> {
  const access = await canAccess(userId, FEATURE_KEYS.BROADCAST_EMAILS);
  if (!access.allowed) {
    throw new BroadcastValidationError("Broadcasts not available on your plan.");
  }
}

/**
 * For group audience, also require GROUPS entitlement.
 */
async function requireGroupsAccess(userId: number): Promise<void> {
  const access = await canAccess(userId, FEATURE_KEYS.GROUPS);
  if (!access.allowed) {
    throw new BroadcastValidationError("Groups feature not available on your plan.");
  }
}

// ---- Idempotency helpers --------------------------------------------------

function hashIdempotencyKey(userId: number, operation: string, key: string): string {
  return createHash("sha256").update(`${userId}:${operation}:${key}`).digest("hex");
}

function hashRequestFingerprint(payload: unknown): string {
  // Canonical JSON: stable property order via JSON.stringify (deterministic
  // for primitive key order in V8). Sufficient for detecting same-key-different-body.
  const json = JSON.stringify(payload ?? null);
  return createHash("sha256").update(json).digest("hex");
}

function validateIdempotencyKey(key: string | undefined): string | null {
  if (!key) return null;
  if (key.length < IDEMPOTENCY_KEY_MIN || key.length > IDEMPOTENCY_KEY_MAX) {
    throw new BroadcastValidationError(`Idempotency-Key must be ${IDEMPOTENCY_KEY_MIN}-${IDEMPOTENCY_KEY_MAX} chars.`);
  }
  return key;
}

/**
 * Derive a 64-bit lock key for idempotency serialization.
 * Packs: high 32 bits = userId, low 32 bits = hash(operation + keyHash).
 * Same (userId, operation, keyHash) → same lock key → serialized.
 * Different tenants/operations/keys → independent locks.
 */
function canonicalIdempotencyLockKey(userId: number, operation: string, keyHash: string): bigint {
  const tenant = BigInt(userId) & BigInt("0xffffffff");
  const opHashHex = createHash("sha256").update(`${operation}:${keyHash}`).digest("hex").slice(0, 8);
  const opHash = BigInt(parseInt(opHashHex, 16)) & BigInt("0xffffffff");
  return (tenant << BigInt(32)) | opHash;
}

// ---- Draft CRUD -----------------------------------------------------------

export async function createBroadcast(input: CreateBroadcastInput): Promise<BroadcastSummary> {
  const { userId, name, subject, htmlContent, textContent, audienceType, targetGroupId } = input;

  // Central BROADCAST_EMAILS capability gate (in addition to CONTACTS at route).
  await requireBroadcastAccess(userId);
  if (audienceType === AUDIENCE_TYPES.GROUP) {
    await requireGroupsAccess(userId);
  }

  // Full draft-content validation (used by create AND update — same rules).
  const validation = await validateFullDraft(
    { name, subject, htmlContent, textContent, audienceType, targetGroupId },
    {
      userId,
      verifyGroupOwnership: async (gid, uid) => {
        const g = await db.group.findFirst({ where: { id: gid, userId: uid }, select: { id: true } });
        return !!g;
      },
    },
  );
  if (!validation.valid) {
    throw new BroadcastValidationError(validation.error!);
  }

  const broadcast = await db.broadcast.create({
    data: {
      userId,
      name: name.trim(),
      subject,
      htmlContent,
      textContent: textContent ?? null,
      audienceType,
      targetGroupId: targetGroupId ?? null,
      status: BROADCAST_STATUSES.DRAFT,
      reviewStatus: REVIEW_STATUSES.NOT_REQUIRED,
    },
  });

  return toSummary(broadcast, { totalRecipients: 0, pendingCount: 0, processingCount: 0, dispatchingCount: 0, sentCount: 0, skippedCount: 0, failedCount: 0 });
}

export async function getBroadcast(userId: number, broadcastId: string): Promise<BroadcastSummary | null> {
  // Central access gate (read-only access still requires the capability).
  await requireBroadcastAccess(userId);
  const broadcast = await db.broadcast.findFirst({
    where: { broadcastId, userId },
  });
  if (!broadcast) return null;
  return toSummary(broadcast, await deriveCounts(broadcast.id));
}

export async function listBroadcasts(
  userId: number,
  opts: { page?: number; pageSize?: number; status?: string } = {},
): Promise<{ broadcasts: BroadcastSummary[]; total: number; page: number; pageSize: number }> {
  await requireBroadcastAccess(userId);
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));
  const where: Record<string, unknown> = { userId };
  if (opts.status) where.status = opts.status;

  const [rows, total] = await Promise.all([
    db.broadcast.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.broadcast.count({ where }),
  ]);

  const summaries: BroadcastSummary[] = [];
  for (const row of rows) {
    summaries.push(toSummary(row, await deriveCounts(row.id)));
  }
  return { broadcasts: summaries, total, page, pageSize };
}

export async function updateBroadcast(
  userId: number,
  broadcastId: string,
  updates: { name?: string; subject?: string; htmlContent?: string; textContent?: string | null; audienceType?: AudienceType; targetGroupId?: number | null },
): Promise<BroadcastSummary | null> {
  await requireBroadcastAccess(userId);

  const broadcast = await db.broadcast.findFirst({
    where: { broadcastId, userId },
    select: { id: true, status: true, name: true, subject: true, htmlContent: true, textContent: true, audienceType: true, targetGroupId: true },
  });
  if (!broadcast) return null;

  if (!EDITABLE_STATUSES.has(broadcast.status)) {
    throw new BroadcastValidationError("Broadcast content can only be edited while in draft status.");
  }

  // Build the MERGED draft state and validate the entire resulting state.
  const merged: {
    name: string;
    subject: string;
    htmlContent: string;
    textContent: string | null;
    audienceType: string;
    targetGroupId: number | null;
  } = {
    name: updates.name !== undefined ? updates.name.trim() : broadcast.name,
    subject: updates.subject !== undefined ? updates.subject : broadcast.subject,
    htmlContent: updates.htmlContent !== undefined ? updates.htmlContent : broadcast.htmlContent,
    textContent: updates.textContent !== undefined ? updates.textContent : broadcast.textContent,
    audienceType: updates.audienceType !== undefined ? updates.audienceType : broadcast.audienceType,
    targetGroupId:
      updates.targetGroupId !== undefined
        ? updates.targetGroupId ?? null
        : broadcast.targetGroupId,
  };

  // If audienceType=group in the merged state, also require GROUPS access.
  if (merged.audienceType === AUDIENCE_TYPES.GROUP) {
    await requireGroupsAccess(userId);
  }

  const validation = await validateFullDraft(merged, {
    userId,
    verifyGroupOwnership: async (gid, uid) => {
      const g = await db.group.findFirst({ where: { id: gid, userId: uid }, select: { id: true } });
      return !!g;
    },
  });
  if (!validation.valid) {
    throw new BroadcastValidationError(validation.error!);
  }

  // If audienceType=all_contacts, force targetGroupId to null.
  const data: Record<string, unknown> = {
    name: merged.name,
    subject: merged.subject,
    htmlContent: merged.htmlContent,
    textContent: merged.textContent,
    audienceType: merged.audienceType,
    targetGroupId: merged.audienceType === AUDIENCE_TYPES.ALL_CONTACTS ? null : merged.targetGroupId,
  };

  const updated = await db.broadcast.update({
    where: { id: broadcast.id },
    data,
  });
  return toSummary(updated, await deriveCounts(updated.id));
}

export async function deleteBroadcast(userId: number, broadcastId: string): Promise<boolean> {
  await requireBroadcastAccess(userId);
  const broadcast = await db.broadcast.findFirst({
    where: { broadcastId, userId },
    select: { id: true, status: true },
  });
  if (!broadcast) return false;
  if (broadcast.status !== BROADCAST_STATUSES.DRAFT) {
    throw new BroadcastValidationError("Only draft broadcasts can be deleted. Use cancel instead.");
  }
  await db.broadcast.delete({ where: { id: broadcast.id } });
  return true;
}

// ---- Preview (DB-side aggregation) ---------------------------------------

/**
 * Preview the audience for a broadcast WITHOUT mutating any state.
 * Returns derived eligibility counts based on CURRENT contact consent state.
 *
 * DB-SIDE AGGREGATION: no N+1, no unbounded contact ID lists in memory.
 * Uses a single GROUP BY query on Contact.marketingStatus, plus a single
 * suppression count query that joins Contact ↔ SuppressionEntry.
 *
 * NOTE: preview eligibility may differ from send-time eligibility — consent
 * can change between preview and actual send.
 */
export async function previewBroadcast(userId: number, broadcastId: string): Promise<PreviewResult | null> {
  await requireBroadcastAccess(userId);
  const broadcast = await db.broadcast.findFirst({
    where: { broadcastId, userId },
    select: { id: true, audienceType: true, targetGroupId: true },
  });
  if (!broadcast) return null;

  // DB-side GROUP BY marketingStatus. For group audience, join ContactGroupMembership.
  // We use $queryRawUnsafe with parameterized queries — never string interpolation.
  const groupBySql = broadcast.audienceType === AUDIENCE_TYPES.GROUP
    ? `SELECT c."marketingStatus" AS "marketingStatus", COUNT(*)::int AS cnt FROM "Contact" c
        INNER JOIN "ContactGroupMembership" m ON m."contactId" = c."id" AND m."userId" = c."userId"
        WHERE c."userId" = $1 AND m."groupId" = $2
        GROUP BY c."marketingStatus"`
    : `SELECT "marketingStatus", COUNT(*)::int AS cnt FROM "Contact"
        WHERE "userId" = $1
        GROUP BY "marketingStatus"`;

  const statusRows: { marketingStatus: string; cnt: number }[] = broadcast.audienceType === AUDIENCE_TYPES.GROUP
    ? await db.$queryRawUnsafe(groupBySql, userId, broadcast.targetGroupId)
    : await db.$queryRawUnsafe(groupBySql, userId);

  let total = 0;
  let subscribedCount = 0;
  let unsubscribed = 0;
  let unknown = 0;       // unknown + any other
  for (const row of statusRows) {
    total += row.cnt;
    if (row.marketingStatus === "subscribed") subscribedCount += row.cnt;
    else if (row.marketingStatus === "unsubscribed") unsubscribed += row.cnt;
    else unknown += row.cnt;
  }

  // DB-side count of active suppressions joined to the audience.
  const suppressionSql = broadcast.audienceType === AUDIENCE_TYPES.GROUP
    ? `SELECT COUNT(DISTINCT se."email")::int AS cnt FROM "SuppressionEntry" se
        INNER JOIN "Contact" c ON c."email" = se."email" AND c."userId" = se."userId"
        INNER JOIN "ContactGroupMembership" m ON m."contactId" = c."id" AND m."userId" = c."userId"
        WHERE c."userId" = $1 AND m."groupId" = $2 AND se."active" = true AND c."marketingStatus" = 'subscribed' `
    : `SELECT COUNT(DISTINCT se."email")::int AS cnt FROM "SuppressionEntry" se
        INNER JOIN "Contact" c ON c."email" = se."email" AND c."userId" = se."userId"
        WHERE c."userId" = $1 AND se."active" = true AND c."marketingStatus" = 'subscribed' `;

  const supRows: { cnt: number }[] = broadcast.audienceType === AUDIENCE_TYPES.GROUP
    ? await db.$queryRawUnsafe(suppressionSql, userId, broadcast.targetGroupId)
    : await db.$queryRawUnsafe(suppressionSql, userId);
  const suppressed = supRows[0]?.cnt ?? 0;

  // MUTUAL EXCLUSION: suppressed contacts are subtracted from eligible.
  // A subscribed + suppressed contact is counted as suppressed, NOT eligible.
  // Categories are mutually exclusive: total = eligible + suppressed + unsubscribed + unknown.
  const eligible = Math.max(0, subscribedCount - suppressed);

  return { total, eligible, unknown, unsubscribed, suppressed };
}

// ---- Launch (DB-side INSERT...SELECT snapshot + freeze) -------------------

/**
 * Launch a broadcast: snapshot the audience (DB-side INSERT...SELECT), freeze
 * content, check review threshold, and transition to queued (or review_pending
 * if over threshold).
 *
 * Idempotent: if called again with the same broadcastId and the broadcast is
 * already launched/snapshotted, returns the existing state without re-snapshotting.
 *
 * Idempotency-Key: if provided, durably dedupes across retries. Same key +
 * different schedule → IdempotencyConflictError (409).
 */
export async function launchBroadcast(
  userId: number,
  broadcastId: string,
  opts: { scheduledAt?: Date | null; idempotencyKey?: string } = {},
): Promise<LaunchResult> {
  await requireBroadcastAccess(userId);

  const idempotencyKey = validateIdempotencyKey(opts.idempotencyKey);
  const keyHash = idempotencyKey ? hashIdempotencyKey(userId, "launch", idempotencyKey) : null;
  const fingerprint = idempotencyKey ? hashRequestFingerprint({ scheduledAt: opts.scheduledAt ?? null }) : null;

  // Pre-check for replay (outside transaction — fast path).
  if (keyHash) {
    const existing = await db.broadcastMutationIdempotency.findUnique({
      where: { userId_operation_idempotencyKeyHash: { userId, operation: "launch", idempotencyKeyHash: keyHash } },
    });
    if (existing) {
      if (existing.targetBroadcastId !== broadcastId) {
        throw new IdempotencyConflictError("Idempotency key reused for a different broadcast.");
      }
      if (existing.requestFingerprint && existing.requestFingerprint !== fingerprint) {
        throw new IdempotencyConflictError("Idempotency key reused with conflicting schedule.");
      }
      // Replay the original outcome.
      const data = existing.resultData as { status?: string; reviewStatus?: string; recipientCount?: number; requiresReview?: boolean; launched?: boolean } | null;
      return {
        launched: data?.launched ?? false,
        broadcastId,
        status: data?.status ?? BROADCAST_STATUSES.QUEUED,
        reviewStatus: data?.reviewStatus ?? REVIEW_STATUSES.NOT_REQUIRED,
        recipientCount: data?.recipientCount ?? 0,
        requiresReview: data?.requiresReview ?? false,
      };
    }
  }

  const broadcast = await db.broadcast.findFirst({
    where: { broadcastId, userId },
    select: { id: true, status: true, audienceType: true, targetGroupId: true, subject: true, htmlContent: true, textContent: true },
  });
  if (!broadcast) {
    throw new BroadcastValidationError("Broadcast not found.");
  }

  // Idempotent: already launched (no idempotency key or key not seen before).
  if (broadcast.status !== BROADCAST_STATUSES.DRAFT) {
    const current = await getBroadcast(userId, broadcastId);
    return {
      launched: false,
      broadcastId,
      status: current?.status ?? broadcast.status,
      reviewStatus: current?.reviewStatus ?? REVIEW_STATUSES.NOT_REQUIRED,
      recipientCount: current?.totalRecipients ?? 0,
      requiresReview: current?.reviewStatus === REVIEW_STATUSES.PENDING,
    };
  }

  // Validate content one more time before launch.
  const contentValidation = validateBroadcastContent({
    subject: broadcast.subject,
    htmlContent: broadcast.htmlContent,
    textContent: broadcast.textContent,
  });
  if (!contentValidation.valid) {
    throw new BroadcastValidationError(contentValidation.error!);
  }

  // DB-side INSERT...SELECT snapshot inside the launch transaction.
  // No full-audience ID array in Node memory. We then count the actual
  // inserted rows for the review threshold check.
  const reviewThreshold = BROADCAST_REVIEW_THRESHOLD;
  const now = new Date();

  try {
    await db.$transaction(async (tx) => {
      // Acquire advisory lock for concurrent idempotency serialization.
      // This ensures two simultaneous calls with the SAME new key are serialized:
      // the first wins the CAS + persists the idempotency record; the second
      // sees the existing record inside the transaction and replays.
      if (keyHash) {
        // Derive a 64-bit lock key from (userId, "launch", keyHash).
        // Use a hash to fit in a single bigint.
        const lockKey = canonicalIdempotencyLockKey(userId, "launch", keyHash);
        await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock($1::bigint)", lockKey.toString());

        // Re-check idempotency INSIDE the transaction (after lock acquisition).
        const existingInside = await tx.broadcastMutationIdempotency.findUnique({
          where: { userId_operation_idempotencyKeyHash: { userId, operation: "launch", idempotencyKeyHash: keyHash } },
        });
        if (existingInside) {
          if (existingInside.targetBroadcastId !== broadcastId) {
            throw new IdempotencyConflictError("Idempotency key reused for a different broadcast.");
          }
          if (existingInside.requestFingerprint && existingInside.requestFingerprint !== fingerprint) {
            throw new IdempotencyConflictError("Idempotency key reused with conflicting schedule.");
          }
          // Replay — the other transaction already launched.
          const data = existingInside.resultData as { status?: string; reviewStatus?: string; recipientCount?: number; requiresReview?: boolean; launched?: boolean } | null;
          return {
            launched: data?.launched ?? false,
            broadcastId,
            status: data?.status ?? BROADCAST_STATUSES.QUEUED,
            reviewStatus: data?.reviewStatus ?? REVIEW_STATUSES.NOT_REQUIRED,
            recipientCount: data?.recipientCount ?? 0,
            requiresReview: data?.requiresReview ?? false,
          };
        }
      }

      // CAS: only transition draft → queued/review_pending.
      const claimed = await tx.broadcast.updateMany({
        where: { id: broadcast.id, status: BROADCAST_STATUSES.DRAFT },
        data: {
          // Tentatively queued — we'll downgrade to review_pending if the count
          // turns out to exceed the threshold.
          status: BROADCAST_STATUSES.QUEUED,
          reviewStatus: REVIEW_STATUSES.NOT_REQUIRED,
          launchedAt: now,
          scheduledAt: opts.scheduledAt ?? null,
        },
      });
      if (claimed.count === 0) {
        throw new BroadcastValidationError("Broadcast is no longer in draft status (concurrent launch).");
      }

      // DB-side audience snapshot via INSERT...SELECT...ON CONFLICT DO NOTHING.
      if (broadcast.audienceType === AUDIENCE_TYPES.ALL_CONTACTS) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "BroadcastRecipient" ("userId", "broadcastId", "contactOwnerUserId", "contactId", "status", "createdAt", "updatedAt")
           SELECT $1, $2, "userId", "id", 'pending', NOW(), NOW() FROM "Contact"
           WHERE "userId" = $1
           ON CONFLICT DO NOTHING`,
          userId,
          broadcast.id,
        );
      } else if (broadcast.audienceType === AUDIENCE_TYPES.GROUP && broadcast.targetGroupId) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "BroadcastRecipient" ("userId", "broadcastId", "contactOwnerUserId", "contactId", "status", "createdAt", "updatedAt")
           SELECT $1, $2, m."userId", m."contactId", 'pending', NOW(), NOW()
           FROM "ContactGroupMembership" m
           INNER JOIN "Contact" c ON c."id" = m."contactId" AND c."userId" = m."userId"
           WHERE m."userId" = $1 AND m."groupId" = $3
           ON CONFLICT DO NOTHING`,
          userId,
          broadcast.id,
          broadcast.targetGroupId,
        );
      }

      // Count the actual inserted rows for the review threshold check.
      const recipientCount = await tx.broadcastRecipient.count({ where: { broadcastId: broadcast.id } });
      const requiresReview = recipientCount > reviewThreshold;

      if (requiresReview) {
        await tx.broadcast.update({
          where: { id: broadcast.id },
          data: {
            status: BROADCAST_STATUSES.REVIEW_PENDING,
            reviewStatus: REVIEW_STATUSES.PENDING,
          },
        });
      }

      // Persist the idempotency outcome (same transaction — atomic with state change).
      if (idempotencyKey) {
        const keyHash = hashIdempotencyKey(userId, "launch", idempotencyKey);
        const fingerprint = hashRequestFingerprint({ scheduledAt: opts.scheduledAt ?? null });
        try {
          await tx.broadcastMutationIdempotency.create({
            data: {
              userId,
              operation: "launch",
              targetBroadcastId: broadcastId,
              idempotencyKeyHash: keyHash,
              requestFingerprint: fingerprint,
              resultStatus: "applied",
              resultData: {
                launched: true,
                status: requiresReview ? BROADCAST_STATUSES.REVIEW_PENDING : BROADCAST_STATUSES.QUEUED,
                reviewStatus: requiresReview ? REVIEW_STATUSES.PENDING : REVIEW_STATUSES.NOT_REQUIRED,
                recipientCount,
                requiresReview,
              },
            },
          });
        } catch (err: any) {
          // P2002 — concurrent same-key insert races us. The tx is now dead,
          // so we let the error propagate OUT of $transaction; we'll handle
          // it below by reading the existing record.
          if (err?.code === "P2002") throw err;
          throw err;
        }
      }
    });
  } catch (err: any) {
    if (err?.code === "P2002" && idempotencyKey) {
      // Concurrent idempotency insert race — read the existing record.
      const keyHash = hashIdempotencyKey(userId, "launch", idempotencyKey);
      const existing = await db.broadcastMutationIdempotency.findUnique({
        where: { userId_operation_idempotencyKeyHash: { userId, operation: "launch", idempotencyKeyHash: keyHash } },
      });
      if (existing) {
        if (existing.targetBroadcastId !== broadcastId) {
          throw new IdempotencyConflictError("Idempotency key reused for a different broadcast.");
        }
        const data = existing.resultData as { status?: string; reviewStatus?: string; recipientCount?: number; requiresReview?: boolean; launched?: boolean } | null;
        return {
          launched: data?.launched ?? false,
          broadcastId,
          status: data?.status ?? BROADCAST_STATUSES.QUEUED,
          reviewStatus: data?.reviewStatus ?? REVIEW_STATUSES.NOT_REQUIRED,
          recipientCount: data?.recipientCount ?? 0,
          requiresReview: data?.requiresReview ?? false,
        };
      }
    }
    throw err;
  }

  // Read back the final state to return accurate counts.
  const finalBroadcast = await db.broadcast.findFirst({
    where: { id: broadcast.id },
    select: { status: true, reviewStatus: true },
  });
  const finalCount = await db.broadcastRecipient.count({ where: { broadcastId: broadcast.id } });
  const requiresReview = finalCount > reviewThreshold;

  return {
    launched: true,
    broadcastId,
    status: finalBroadcast?.status ?? (requiresReview ? BROADCAST_STATUSES.REVIEW_PENDING : BROADCAST_STATUSES.QUEUED),
    reviewStatus: finalBroadcast?.reviewStatus ?? (requiresReview ? REVIEW_STATUSES.PENDING : REVIEW_STATUSES.NOT_REQUIRED),
    recipientCount: finalCount,
    requiresReview,
  };
}

// ---- Cancel (idempotent) --------------------------------------------------

/**
 * Cancel a broadcast. Idempotent — cancelling an already-cancelled broadcast
 * is a no-op.
 *
 * Cancellable statuses: review_pending, queued, sending, paused_quota.
 * Already-terminal statuses (completed, cancelled, rejected, failed) return
 * the current state without error.
 *
 * Idempotency-Key: if provided, durably dedupes across retries.
 */
export async function cancelBroadcast(
  userId: number,
  broadcastId: string,
  opts: { idempotencyKey?: string } = {},
): Promise<{ cancelled: boolean; broadcastId: string; status: string }> {
  await requireBroadcastAccess(userId);

  const idempotencyKey = validateIdempotencyKey(opts.idempotencyKey);

  if (idempotencyKey) {
    const keyHash = hashIdempotencyKey(userId, "cancel", idempotencyKey);
    const fingerprint = hashRequestFingerprint({});
    const existing = await db.broadcastMutationIdempotency.findUnique({
      where: { userId_operation_idempotencyKeyHash: { userId, operation: "cancel", idempotencyKeyHash: keyHash } },
    });
    if (existing) {
      if (existing.targetBroadcastId !== broadcastId) {
        throw new IdempotencyConflictError("Idempotency key reused for a different broadcast.");
      }
      // Ignore requestFingerprint for cancel — payload is empty.
      const data = existing.resultData as { cancelled?: boolean; status?: string } | null;
      return { cancelled: data?.cancelled ?? false, broadcastId, status: data?.status ?? BROADCAST_STATUSES.CANCELLED };
    }
  }

  const broadcast = await db.broadcast.findFirst({
    where: { broadcastId, userId },
    select: { id: true, status: true },
  });
  if (!broadcast) {
    throw new BroadcastValidationError("Broadcast not found.");
  }

  if (!CANCELLABLE_STATUSES.has(broadcast.status)) {
    // Idempotent: already terminal. Persist the no-op if idempotency key present.
    if (idempotencyKey) {
      await persistCancelIdempotency(userId, broadcastId, idempotencyKey, false, broadcast.status);
    }
    return { cancelled: false, broadcastId, status: broadcast.status };
  }

  const now = new Date();
  const result = await db.broadcast.updateMany({
    where: { id: broadcast.id, status: { in: [...CANCELLABLE_STATUSES] } },
    data: {
      status: BROADCAST_STATUSES.CANCELLED,
      cancelledAt: now,
    },
  });

  const cancelled = result.count === 1;
  const newStatus = cancelled ? BROADCAST_STATUSES.CANCELLED : broadcast.status;

  if (idempotencyKey) {
    await persistCancelIdempotency(userId, broadcastId, idempotencyKey, cancelled, newStatus);
  }

  return { cancelled, broadcastId, status: newStatus };
}

async function persistCancelIdempotency(userId: number, broadcastId: string, idempotencyKey: string, cancelled: boolean, status: string): Promise<void> {
  const keyHash = hashIdempotencyKey(userId, "cancel", idempotencyKey);
  try {
    await db.broadcastMutationIdempotency.create({
      data: {
        userId,
        operation: "cancel",
        targetBroadcastId: broadcastId,
        idempotencyKeyHash: keyHash,
        requestFingerprint: hashRequestFingerprint({}),
        resultStatus: "applied",
        resultData: { cancelled, status },
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      // Concurrent insert races us — treat as replay (no-op).
      return;
    }
    throw err;
  }
}

// ---- Recipient claiming (atomic CAS) --------------------------------------

/**
 * Atomically claim a batch of pending recipients for processing.
 * Uses CAS (updateMany WHERE status=pending) + row-level locking.
 *
 * Only successfully claimed rows may be processed. Stale locks are recovered
 * by `recoverStaleRecipients()` (processing only — NOT dispatching).
 */
export async function claimRecipientBatch(broadcastId: number, workerId: string, batchSize: number = BROADCAST_BATCH_SIZE): Promise<number[]> {
  const candidates = await db.broadcastRecipient.findMany({
    where: { broadcastId, status: RECIPIENT_STATUSES.PENDING },
    orderBy: { id: "asc" },
    take: batchSize,
    select: { id: true },
  });

  const claimedIds: number[] = [];
  const now = new Date();
  for (const candidate of candidates) {
    const result = await db.broadcastRecipient.updateMany({
      where: { id: candidate.id, status: RECIPIENT_STATUSES.PENDING },
      data: {
        status: RECIPIENT_STATUSES.PROCESSING,
        lockedAt: now,
        lockedBy: workerId,
      },
    });
    if (result.count === 1) {
      claimedIds.push(candidate.id);
    }
  }
  return claimedIds;
}

/**
 * Recover stale PROCESSING claims: processing → pending WHERE lockedAt < cutoff.
 * A stale worker must NEVER overwrite a newer worker's terminal result.
 *
 * This function ONLY recovers `processing` rows — it MUST NOT recover
 * `dispatching` rows. Dispatching rows have entered the durable exclusive
 * dispatch state and may have called the provider — auto-requeue could
 * double-send. Stale dispatching rows are handled by recoverAbandonedDispatches().
 */
export async function recoverStaleRecipients(): Promise<number> {
  const cutoff = new Date(Date.now() - BROADCAST_STALE_LOCK_TIMEOUT_MS);
  const stale = await db.broadcastRecipient.findMany({
    where: { status: RECIPIENT_STATUSES.PROCESSING, lockedAt: { lt: cutoff } },
    select: { id: true },
  });
  let recovered = 0;
  for (const row of stale) {
    const result = await db.broadcastRecipient.updateMany({
      where: { id: row.id, status: RECIPIENT_STATUSES.PROCESSING, lockedAt: { lt: cutoff } },
      data: {
        status: RECIPIENT_STATUSES.PENDING,
        lockedAt: null,
        lockedBy: null,
      },
    });
    if (result.count === 1) recovered++;
  }
  return recovered;
}

/**
 * Recover abandoned DISPATCHING rows: dispatching → failed WHERE lockedAt <
 * dispatchTimeout. NEVER auto-requeue — the outcome is ambiguous (provider
 * may have been called). Transition to terminal `failed` with
 * errorCode=provider_outcome_unknown.
 *
 * This function is SEPARATE from recoverStaleRecipients() and uses a longer
 * timeout (30 min) to give even slow providers time to complete.
 */
export async function recoverAbandonedDispatches(): Promise<number> {
  const cutoff = new Date(Date.now() - BROADCAST_DISPATCH_TIMEOUT_MS);
  const stale = await db.broadcastRecipient.findMany({
    where: { status: RECIPIENT_STATUSES.DISPATCHING, lockedAt: { lt: cutoff } },
    select: { id: true },
  });
  let recovered = 0;
  const now = new Date();
  for (const row of stale) {
    const result = await db.broadcastRecipient.updateMany({
      where: { id: row.id, status: RECIPIENT_STATUSES.DISPATCHING, lockedAt: { lt: cutoff } },
      data: {
        status: RECIPIENT_STATUSES.FAILED,
        errorCode: SEND_ERROR_CODES.PROVIDER_OUTCOME_UNKNOWN,
        attemptedAt: now,
        failedAt: now,
        // Leave lockedBy/lockedAt intact for audit — the row is now terminal.
      },
    });
    if (result.count === 1) recovered++;
  }
  return recovered;
}

// ---- Send processing ------------------------------------------------------

export interface ProcessResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  quotaPaused: boolean;
  /**
   * True iff the broadcast transitioned to `completed` during this invocation.
   * Cron accounting counts this flag, NOT `processed === 0`.
   */
  finalized: boolean;
}

/**
 * Process a single broadcast: claim a batch, send each recipient, finalize.
 *
 * Per-recipient flow:
 *   1. Verify parent broadcast not cancelled.
 *   2. Re-read Contact (may have been deleted → contactId null).
 *   3. Check Phase 9 marketing eligibility (subscribed AND not suppressed).
 *   4. Generate per-recipient unsubscribe token (JWE).
 *   5. Render content with per-recipient variables.
 *   6. CAS processing → dispatching WHERE lockedBy=workerId (durable exclusive dispatch).
 *   7. Reserve BROADCAST_EMAILS quota (atomic CAS) — AFTER dispatching CAS but
 *      BEFORE provider call.
 *      - If quota denied with reason=quota_exhausted → pause broadcast +
 *        transition dispatching → pending (no external attempt occurred).
 *      - If quota denied with reason=rate_limited → recipient stays pending,
 *        broadcast stays in `sending` state.
 *      - DB/entitlement errors → terminal `failed` with safe error code.
 *   8. Dispatch via provider abstraction.
 *   9. Terminal CAS: dispatching → sent|skipped|failed WHERE lockedBy=workerId.
 *
 * Quota: skipped recipients consume NO quota. A real provider attempt
 * consumes exactly 1. Idempotent replays consume no second quota.
 */
export async function processBroadcast(broadcastId: number, provider?: EmailProvider): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, sent: 0, skipped: 0, failed: 0, quotaPaused: false, finalized: false };

  // Recover stale processing rows (NOT dispatching — those are ambiguous).
  await recoverStaleRecipients();
  // Recover abandoned dispatching rows (terminal failed, no auto-requeue).
  await recoverAbandonedDispatches();

  const workerId = randomUUID();
  const broadcast = await db.broadcast.findUnique({
    where: { id: broadcastId },
    select: { id: true, userId: true, status: true, scheduledAt: true, subject: true, htmlContent: true, textContent: true },
  });
  if (!broadcast) return result;

  // Don't process cancelled broadcasts.
  if (broadcast.status === BROADCAST_STATUSES.CANCELLED) return result;

  // Don't process review_pending or rejected broadcasts.
  if (broadcast.status === BROADCAST_STATUSES.REVIEW_PENDING || broadcast.status === BROADCAST_STATUSES.REJECTED) return result;

  // Don't process future-scheduled broadcasts.
  if (broadcast.scheduledAt && broadcast.scheduledAt.getTime() > Date.now()) return result;

  // Transition queued → sending (CAS).
  if (broadcast.status === BROADCAST_STATUSES.QUEUED || broadcast.status === BROADCAST_STATUSES.PAUSED_QUOTA) {
    await db.broadcast.updateMany({
      where: { id: broadcast.id, status: { in: [BROADCAST_STATUSES.QUEUED, BROADCAST_STATUSES.PAUSED_QUOTA] } },
      data: { status: BROADCAST_STATUSES.SENDING, startedAt: new Date() },
    });
  }

  // Claim a batch.
  const recipientIds = await claimRecipientBatch(broadcast.id, workerId, BROADCAST_BATCH_SIZE);
  if (recipientIds.length === 0) {
    // Maybe finalize.
    result.finalized = await tryFinalizeBroadcast(broadcast.id, workerId);
    return result;
  }

  const emailProvider = provider ?? new SmtpEmailProvider();

  for (const recipientId of recipientIds) {
    result.processed++;
    await processRecipient(broadcast, recipientId, workerId, emailProvider, result);
  }

  // Try to finalize after the batch.
  result.finalized = await tryFinalizeBroadcast(broadcast.id, workerId);

  return result;
}

async function processRecipient(
  broadcast: { id: number; userId: number; subject: string; htmlContent: string; textContent: string | null },
  recipientId: number,
  workerId: string,
  provider: EmailProvider,
  result: ProcessResult,
): Promise<void> {
  const recipient = await db.broadcastRecipient.findUnique({
    where: { id: recipientId },
    select: { id: true, userId: true, broadcastId: true, contactId: true, contactOwnerUserId: true, status: true, lockedBy: true },
  });
  if (!recipient || recipient.status !== RECIPIENT_STATUSES.PROCESSING || recipient.lockedBy !== workerId) {
    return; // Lost ownership — stale worker.
  }

  // Re-check parent broadcast state.
  const parent = await db.broadcast.findUnique({
    where: { id: broadcast.id },
    select: { status: true },
  });
  if (parent?.status === BROADCAST_STATUSES.CANCELLED) {
    const won = await markRecipientSkipped(recipientId, workerId, SKIP_REASONS.BROADCAST_CANCELLED);
    if (won) result.skipped++;
    return;
  }

  // Re-read Contact (may have been deleted → contactId null).
  if (recipient.contactId === null) {
    const won2 = await markRecipientSkipped(recipientId, workerId, SKIP_REASONS.CONTACT_NOT_FOUND);
    if (won2) result.skipped++;
    return;
  }
  // Handle null contactId (Contact was deleted after snapshot).
  // The composite FK nullified (contactOwnerUserId, contactId) on Contact deletion.
  if (recipient.contactId === null || recipient.contactOwnerUserId === null) {
    const won = await markRecipientSkipped(recipientId, workerId, SKIP_REASONS.CONTACT_NOT_FOUND);
    if (won) result.skipped++;
    return;
  }

  const contact = await db.contact.findFirst({
    where: { id: recipient.contactId, userId: recipient.contactOwnerUserId },
    select: { id: true, email: true, name: true },
  });
  if (!contact) {
    const won = await markRecipientSkipped(recipientId, workerId, SKIP_REASONS.CONTACT_NOT_FOUND);
    if (won) result.skipped++;
    return;
  }

  // Check Phase 9 marketing eligibility immediately before dispatch.
  const eligibility = await getMarketingEligibility(recipient.userId, recipient.contactId);
  if (!eligibility.eligible) {
    const reason = eligibility.reason === "suppressed" ? SKIP_REASONS.SUPPRESSED : SKIP_REASONS.NOT_SUBSCRIBED;
    const won3 = await markRecipientSkipped(recipientId, workerId, reason);
    if (won3) result.skipped++;
    return;
  }

  // Generate per-recipient unsubscribe token (JWE).
  const token = await mintUnsubscribeToken({
    userId: recipient.userId,
    contactId: contact.id,
    email: contact.email,
  });
  const unsubscribeUrl = buildUnsubscribeUrl(token);
  const listUnsubscribeHeader = buildListUnsubscribeHeader(token);

  // Render content with per-recipient variables + final sanitization.
  const rendered = renderBroadcastContent({
    subject: broadcast.subject,
    htmlContent: broadcast.htmlContent,
    textContent: broadcast.textContent,
    contactId: contact.id,
    contactEmail: contact.email,
    contactName: contact.name,
    unsubscribeUrl,
  });
  if (!rendered.ok) {
    const won4 = await markRecipientFailed(recipientId, workerId, SEND_ERROR_CODES.CONTENT_RENDER_ERROR);
    if (won4) result.failed++;
    return;
  }

  // Reserve BROADCAST_EMAILS quota (atomic CAS) AFTER the dispatching CAS but
  // BEFORE the provider call.
  //
  // Order rationale:
  //   1. CAS processing → dispatching WHERE lockedBy=workerId (durable exclusive
  //      dispatch state). ONLY the winner of this CAS may proceed.
  //   2. checkUsage() (atomic CAS — consumes quota if allowed). If the winner
  //      is denied quota, it transitions dispatching → pending safely (no
  //      external attempt occurred).
  //   3. provider.send() — only if both 1 and 2 succeed.
  //
  // Stale-worker safety:
  //   - The dispatching CAS uniquely assigns the recipient to one worker. A
  //     stale worker CANNOT re-enter dispatching (the row is already there).
  //   - recoverStaleRecipients() does NOT touch dispatching rows.
  //   - recoverAbandonedDispatches() transitions stale dispatching → terminal
  //     `failed` with errorCode=provider_outcome_unknown — never to pending.
  //
  // Quota correctness:
  //   - Only the dispatching winner consumes quota (the loser doesn't even
  //     reach the checkUsage call).
  //   - If quota is denied AFTER the CAS, the winner transitions dispatching →
  //     pending safely (no provider call) — the recipient is re-claimable
  //     when quota resets.

  // CAS processing → dispatching WHERE lockedBy=workerId (durable exclusive dispatch).
  // ONLY the worker that wins this CAS may call provider.send().
  const dispatchingCas = await db.broadcastRecipient.updateMany({
    where: { id: recipientId, status: RECIPIENT_STATUSES.PROCESSING, lockedBy: workerId },
    data: {
      status: RECIPIENT_STATUSES.DISPATCHING,
    },
  });
  if (dispatchingCas.count !== 1) {
    // Lost the CAS — another worker already took over, or row is no longer in
    // processing state. This worker must NOT consume quota or call provider.send().
    return;
  }

  // We are now the exclusive dispatcher. Consume quota.
  const usage = await checkUsage(recipient.userId, FEATURE_KEYS.BROADCAST_EMAILS);
  if (!usage.allowed) {
    if (usage.reason === "quota_exhausted") {
      // Quota exhausted — pause the broadcast, transition dispatching → pending
      // (no provider call has happened, so safe to re-queue).
      await db.broadcast.updateMany({
        where: { id: broadcast.id, status: BROADCAST_STATUSES.SENDING },
        data: { status: BROADCAST_STATUSES.PAUSED_QUOTA },
      });
      await db.broadcastRecipient.updateMany({
        where: { id: recipientId, status: RECIPIENT_STATUSES.DISPATCHING, lockedBy: workerId },
        data: {
          status: RECIPIENT_STATUSES.PENDING,
          lockedAt: null,
          lockedBy: null,
        },
      });
      result.quotaPaused = true;
      return;
    }
    if (usage.reason === "rate_limited") {
      // Rate limited — recipient stays pending, broadcast stays in `sending` state.
      // No provider call, no quota consumed (rate limit is checked before quota
      // consume in checkUsage()).
      await db.broadcastRecipient.updateMany({
        where: { id: recipientId, status: RECIPIENT_STATUSES.DISPATCHING, lockedBy: workerId },
        data: {
          status: RECIPIENT_STATUSES.PENDING,
          lockedAt: null,
          lockedBy: null,
        },
      });
      return;
    }
    // DB/entitlement error — terminal `failed` with safe error code.
    await markRecipientFailedFromDispatching(recipientId, workerId, SEND_ERROR_CODES.QUOTA_ERROR);
    result.failed++;
    return;
  }

  // Dispatch via provider. Stale from here → recoverAbandonedDispatches.
  const now = new Date();
  try {
    const sendResult = await provider.send({
      to: contact.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      headers: {
        "List-Unsubscribe": listUnsubscribeHeader,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    // Terminal CAS: dispatching → sent WHERE lockedBy=workerId.
    await db.broadcastRecipient.updateMany({
      where: { id: recipientId, status: RECIPIENT_STATUSES.DISPATCHING, lockedBy: workerId },
      data: {
        status: RECIPIENT_STATUSES.SENT,
        providerMessageId: sendResult.messageId ?? null,
        attemptedAt: now,
        sentAt: now,
        lockedAt: null,
        lockedBy: null,
      },
    });
    result.sent++;
  } catch (err: any) {
    const errorCode = classifySendError(err);
    await markRecipientFailedFromDispatching(recipientId, workerId, errorCode);
    result.failed++;
  }
}

function classifySendError(err: any): string {
  const msg = err?.message ?? "";
  if (msg.includes("configuration") || msg.includes("EAUTH") || msg.includes("EENVELOPE")) {
    return SEND_ERROR_CODES.CONFIGURATION_ERROR;
  }
  if (msg.includes("timeout") || msg.includes("ECONNECTION")) {
    return SEND_ERROR_CODES.PROVIDER_ERROR;
  }
  return SEND_ERROR_CODES.PROVIDER_ERROR;
}

async function markRecipientSkipped(recipientId: number, workerId: string, reason: string): Promise<boolean> {
  const now = new Date();
  const result = await db.broadcastRecipient.updateMany({
    where: { id: recipientId, status: RECIPIENT_STATUSES.PROCESSING, lockedBy: workerId },
    data: {
      status: RECIPIENT_STATUSES.SKIPPED,
      skipReason: reason,
      attemptedAt: now,
      lockedAt: null,
      lockedBy: null,
    },
  });
  return result.count === 1;
}

async function markRecipientFailed(recipientId: number, workerId: string, errorCode: string): Promise<boolean> {
  const now = new Date();
  const result = await db.broadcastRecipient.updateMany({
    where: { id: recipientId, status: RECIPIENT_STATUSES.PROCESSING, lockedBy: workerId },
    data: {
      status: RECIPIENT_STATUSES.FAILED,
      errorCode,
      attemptedAt: now,
      failedAt: now,
      lockedAt: null,
      lockedBy: null,
    },
  });
  return result.count === 1;
}

/**
 * Terminal CAS from dispatching state (provider threw). Verifies lockedBy=workerId.
 */
async function markRecipientFailedFromDispatching(recipientId: number, workerId: string, errorCode: string): Promise<void> {
  const now = new Date();
  await db.broadcastRecipient.updateMany({
    where: { id: recipientId, status: RECIPIENT_STATUSES.DISPATCHING, lockedBy: workerId },
    data: {
      status: RECIPIENT_STATUSES.FAILED,
      errorCode,
      attemptedAt: now,
      failedAt: now,
      lockedAt: null,
      lockedBy: null,
    },
  });
}

// ---- Finalization ---------------------------------------------------------

/**
 * Finalize a broadcast: transition sending → completed ONLY when there are
 * 0 pending, 0 processing, AND 0 dispatching recipient rows remaining.
 *
 * A campaign may be completed with some failed/skipped recipients — that's
 * reflected in derived counts.
 *
 * Returns true iff the broadcast transitioned to `completed` during this call.
 */
export async function tryFinalizeBroadcast(broadcastId: number, _workerId: string): Promise<boolean> {
  const nonTerminal = await db.broadcastRecipient.count({
    where: {
      broadcastId,
      status: { in: [RECIPIENT_STATUSES.PENDING, RECIPIENT_STATUSES.PROCESSING, RECIPIENT_STATUSES.DISPATCHING] },
    },
  });
  if (nonTerminal > 0) return false;

  const result = await db.broadcast.updateMany({
    where: { id: broadcastId, status: BROADCAST_STATUSES.SENDING },
    data: {
      status: BROADCAST_STATUSES.COMPLETED,
      completedAt: new Date(),
    },
  });
  return result.count === 1;
}

// ---- Derived counts -------------------------------------------------------

async function deriveCounts(broadcastId: number): Promise<{
  totalRecipients: number;
  pendingCount: number;
  processingCount: number;
  dispatchingCount: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
}> {
  const [total, pending, processing, dispatching, sent, skipped, failed] = await Promise.all([
    db.broadcastRecipient.count({ where: { broadcastId } }),
    db.broadcastRecipient.count({ where: { broadcastId, status: RECIPIENT_STATUSES.PENDING } }),
    db.broadcastRecipient.count({ where: { broadcastId, status: RECIPIENT_STATUSES.PROCESSING } }),
    db.broadcastRecipient.count({ where: { broadcastId, status: RECIPIENT_STATUSES.DISPATCHING } }),
    db.broadcastRecipient.count({ where: { broadcastId, status: RECIPIENT_STATUSES.SENT } }),
    db.broadcastRecipient.count({ where: { broadcastId, status: RECIPIENT_STATUSES.SKIPPED } }),
    db.broadcastRecipient.count({ where: { broadcastId, status: RECIPIENT_STATUSES.FAILED } }),
  ]);
  return {
    totalRecipients: total,
    pendingCount: pending,
    processingCount: processing,
    dispatchingCount: dispatching,
    sentCount: sent,
    skippedCount: skipped,
    failedCount: failed,
  };
}

// ---- Recipient listing (handles deleted contacts) -------------------------

export interface RecipientRow {
  id: number;
  contactId: number | null;
  contactEmail: string | null;
  contactName: string | null;
  status: string;
  skipReason: string | null;
  errorCode: string | null;
  attemptedAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
}

export async function listRecipients(
  userId: number,
  broadcastId: string,
  opts: { page?: number; pageSize?: number; status?: string } = {},
): Promise<{ recipients: RecipientRow[]; total: number; page: number; pageSize: number } | null> {
  await requireBroadcastAccess(userId);
  const broadcast = await db.broadcast.findFirst({
    where: { broadcastId, userId },
    select: { id: true },
  });
  if (!broadcast) return null;

  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  const where: Record<string, unknown> = { broadcastId: broadcast.id };
  if (opts.status) where.status = opts.status;

  const [rows, total] = await Promise.all([
    db.broadcastRecipient.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { contact: { select: { email: true, name: true } } },
    }),
    db.broadcastRecipient.count({ where }),
  ]);

  return {
    recipients: rows.map((r) => ({
      id: r.id,
      contactId: r.contactId,
      // contact may be null when the contact was deleted (contactId is now
      // null after ON DELETE SET NULL).
      contactEmail: r.contact?.email ?? null,
      contactName: r.contact?.name ?? null,
      status: r.status,
      skipReason: r.skipReason,
      errorCode: r.errorCode,
      attemptedAt: r.attemptedAt?.toISOString() ?? null,
      sentAt: r.sentAt?.toISOString() ?? null,
      failedAt: r.failedAt?.toISOString() ?? null,
    })),
    total,
    page,
    pageSize,
  };
}

// ---- Admin review ---------------------------------------------------------

/**
 * Admin: list broadcasts pending review.
 * Returns broadcasts with reviewStatus=pending across ALL tenants.
 */
export async function listPendingReviews(opts: { page?: number; pageSize?: number } = {}): Promise<{ broadcasts: BroadcastSummary[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));
  const where = { reviewStatus: REVIEW_STATUSES.PENDING, status: BROADCAST_STATUSES.REVIEW_PENDING };

  const [rows, total] = await Promise.all([
    db.broadcast.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.broadcast.count({ where }),
  ]);

  const summaries: BroadcastSummary[] = [];
  for (const row of rows) {
    summaries.push(toSummary(row, await deriveCounts(row.id)));
  }
  return { broadcasts: summaries, total, page, pageSize };
}

/**
 * Admin: approve a pending broadcast. Transitions review_pending → queued.
 * Does NOT mutate campaign content/audience.
 *
 * The adminId MUST be a real AdminUser.id (FK enforced at DB level).
 */
export async function approveBroadcast(broadcastId: string, adminId: number): Promise<{ approved: boolean; broadcastId: string; status: string }> {
  const now = new Date();
  const result = await db.broadcast.updateMany({
    where: { broadcastId, reviewStatus: REVIEW_STATUSES.PENDING, status: BROADCAST_STATUSES.REVIEW_PENDING },
    data: {
      reviewStatus: REVIEW_STATUSES.APPROVED,
      reviewedAt: now,
      reviewedByAdminId: adminId,
      status: BROADCAST_STATUSES.QUEUED,
    },
  });
  if (result.count === 0) {
    return { approved: false, broadcastId, status: "not_pending" };
  }
  return { approved: true, broadcastId, status: BROADCAST_STATUSES.QUEUED };
}

/**
 * Admin: reject a pending broadcast. Transitions review_pending → rejected.
 * Prevents send.
 *
 * The adminId MUST be a real AdminUser.id (FK enforced at DB level).
 */
export async function rejectBroadcast(broadcastId: string, adminId: number, reason: string): Promise<{ rejected: boolean; broadcastId: string; status: string }> {
  const now = new Date();
  const result = await db.broadcast.updateMany({
    where: { broadcastId, reviewStatus: REVIEW_STATUSES.PENDING, status: BROADCAST_STATUSES.REVIEW_PENDING },
    data: {
      reviewStatus: REVIEW_STATUSES.REJECTED,
      reviewedAt: now,
      reviewedByAdminId: adminId,
      reviewReason: reason.slice(0, 500),
      status: BROADCAST_STATUSES.REJECTED,
    },
  });
  if (result.count === 0) {
    return { rejected: false, broadcastId, status: "not_pending" };
  }
  return { rejected: true, broadcastId, status: BROADCAST_STATUSES.REJECTED };
}

// ---- Helpers --------------------------------------------------------------

function toSummary(
  broadcast: any,
  counts: {
    totalRecipients: number;
    pendingCount: number;
    processingCount: number;
    dispatchingCount: number;
    sentCount: number;
    skippedCount: number;
    failedCount: number;
  },
): BroadcastSummary {
  return {
    id: broadcast.id,
    broadcastId: broadcast.broadcastId,
    userId: broadcast.userId,
    name: broadcast.name,
    subject: broadcast.subject,
    audienceType: broadcast.audienceType,
    targetGroupId: broadcast.targetGroupId,
    status: broadcast.status,
    reviewStatus: broadcast.reviewStatus,
    scheduledAt: broadcast.scheduledAt?.toISOString() ?? null,
    launchedAt: broadcast.launchedAt?.toISOString() ?? null,
    startedAt: broadcast.startedAt?.toISOString() ?? null,
    completedAt: broadcast.completedAt?.toISOString() ?? null,
    cancelledAt: broadcast.cancelledAt?.toISOString() ?? null,
    createdAt: broadcast.createdAt.toISOString(),
    updatedAt: broadcast.updatedAt.toISOString(),
    totalRecipients: counts.totalRecipients,
    pendingCount: counts.pendingCount,
    processingCount: counts.processingCount,
    dispatchingCount: counts.dispatchingCount,
    sentCount: counts.sentCount,
    skippedCount: counts.skippedCount,
    failedCount: counts.failedCount,
  };
}
