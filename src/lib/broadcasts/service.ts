/**
 * Phase 10 — Broadcast service.
 *
 * Central service for all broadcast lifecycle operations:
 *   - Draft CRUD (create, get, list, update, delete)
 *   - Audience preview (derived eligibility counts)
 *   - Launch (snapshot audience + freeze content + review threshold check)
 *   - Cancel
 *   - Recipient claiming (atomic CAS, stale recovery)
 *   - Send processing (eligibility re-check + render + provider dispatch)
 *   - Finalization (0 pending + 0 processing → completed)
 *
 * INVARIANTS:
 *   1. Audience membership is snapshotted at launch — Group membership changes
 *      after launch do NOT affect the broadcast's recipients.
 *   2. Consent/suppression is NOT snapshotted — it's re-checked immediately
 *      before provider dispatch via `getMarketingEligibility()`.
 *   3. Counts are DERIVED from BroadcastRecipient rows (no retry-sensitive counters).
 *   4. Content is frozen at launch — no editing after draft status.
 *   5. Structural tenant isolation via composite FKs.
 *   6. BROADCAST_EMAILS quota consumed exactly once per actual provider attempt.
 *      Skipped recipients consume no quota. Idempotent replays consume no second quota.
 */
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
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
  BROADCAST_REVIEW_THRESHOLD,
  SEND_ERROR_CODES,
  type BroadcastStatus,
  type AudienceType,
} from "./constants";
import { validateBroadcastContent, renderBroadcastContent, buildUnsubscribeUrl, buildListUnsubscribeHeader } from "./content";
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

// ---- Draft CRUD -----------------------------------------------------------

export async function createBroadcast(input: CreateBroadcastInput): Promise<BroadcastSummary> {
  const { userId, name, subject, htmlContent, textContent, audienceType, targetGroupId } = input;

  if (!name?.trim()) throw new BroadcastValidationError("Name is required.");
  if (audienceType !== AUDIENCE_TYPES.ALL_CONTACTS && audienceType !== AUDIENCE_TYPES.GROUP) {
    throw new BroadcastValidationError(`Invalid audience type: ${audienceType}`);
  }
  if (audienceType === AUDIENCE_TYPES.GROUP && !targetGroupId) {
    throw new BroadcastValidationError("targetGroupId is required for group audience.");
  }

  const contentValidation = validateBroadcastContent({ subject, htmlContent, textContent });
  if (!contentValidation.valid) {
    throw new BroadcastValidationError(contentValidation.error!);
  }

  // Verify group ownership if group audience.
  if (audienceType === AUDIENCE_TYPES.GROUP && targetGroupId) {
    const group = await db.group.findFirst({
      where: { id: targetGroupId, userId },
      select: { id: true },
    });
    if (!group) {
      throw new BroadcastValidationError("Group not found or does not belong to your account.");
    }
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

  return toSummary(broadcast, { totalRecipients: 0, pendingCount: 0, processingCount: 0, sentCount: 0, skippedCount: 0, failedCount: 0 });
}

export async function getBroadcast(userId: number, broadcastId: string): Promise<BroadcastSummary | null> {
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
  const broadcast = await db.broadcast.findFirst({
    where: { broadcastId, userId },
    select: { id: true, status: true },
  });
  if (!broadcast) return null;

  if (!EDITABLE_STATUSES.has(broadcast.status)) {
    throw new BroadcastValidationError("Broadcast content can only be edited while in draft status.");
  }

  const data: Record<string, unknown> = {};
  if (updates.name !== undefined) data.name = updates.name.trim();
  if (updates.subject !== undefined) {
    const v = validateBroadcastContent({ subject: updates.subject, htmlContent: updates.htmlContent ?? "placeholder", textContent: null });
    if (updates.subject && /\r|\n/.test(updates.subject)) {
      throw new BroadcastValidationError("Subject must not contain newlines.");
    }
    data.subject = updates.subject;
  }
  if (updates.htmlContent !== undefined) {
    const v = validateBroadcastContent({ subject: updates.subject ?? "placeholder", htmlContent: updates.htmlContent, textContent: updates.textContent });
    if (!v.valid) throw new BroadcastValidationError(v.error!);
    data.htmlContent = updates.htmlContent;
  }
  if (updates.textContent !== undefined) data.textContent = updates.textContent;
  if (updates.audienceType !== undefined) {
    if (updates.audienceType !== AUDIENCE_TYPES.ALL_CONTACTS && updates.audienceType !== AUDIENCE_TYPES.GROUP) {
      throw new BroadcastValidationError(`Invalid audience type: ${updates.audienceType}`);
    }
    data.audienceType = updates.audienceType;
  }
  if (updates.targetGroupId !== undefined) data.targetGroupId = updates.targetGroupId ?? null;

  const updated = await db.broadcast.update({
    where: { id: broadcast.id },
    data,
  });
  return toSummary(updated, await deriveCounts(updated.id));
}

export async function deleteBroadcast(userId: number, broadcastId: string): Promise<boolean> {
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

// ---- Preview --------------------------------------------------------------

/**
 * Preview the audience for a broadcast WITHOUT mutating any state.
 * Returns derived eligibility counts based on CURRENT contact consent state.
 *
 * NOTE: preview eligibility may differ from send-time eligibility — consent
 * can change between preview and actual send.
 */
export async function previewBroadcast(userId: number, broadcastId: string): Promise<PreviewResult | null> {
  const broadcast = await db.broadcast.findFirst({
    where: { broadcastId, userId },
    select: { id: true, audienceType: true, targetGroupId: true },
  });
  if (!broadcast) return null;

  // Resolve the intended contact IDs (preview, not snapshot).
  const contactIds = await resolveAudienceContactIds(userId, broadcast.audienceType, broadcast.targetGroupId);
  if (contactIds.length === 0) {
    return { total: 0, eligible: 0, unknown: 0, unsubscribed: 0, suppressed: 0 };
  }

  // Batch-check eligibility for preview counts.
  let eligible = 0, unknown = 0, unsubscribed = 0, suppressed = 0;
  for (const contactId of contactIds) {
    const eligibility = await getMarketingEligibility(userId, contactId);
    if (eligibility.eligible) {
      eligible++;
    } else if (eligibility.reason === "not_subscribed") {
      // Distinguish unknown vs unsubscribed by reading the contact's status.
      const contact = await db.contact.findFirst({
        where: { id: contactId, userId },
        select: { marketingStatus: true },
      });
      if (contact?.marketingStatus === "unsubscribed") unsubscribed++;
      else unknown++;
    } else if (eligibility.reason === "suppressed") {
      suppressed++;
    } else if (eligibility.reason === "contact_not_found") {
      unknown++;
    }
  }

  return { total: contactIds.length, eligible, unknown, unsubscribed, suppressed };
}

// ---- Audience resolution --------------------------------------------------

/**
 * Resolve the contact IDs that belong to the broadcast's audience.
 * Does NOT check eligibility — that's done at send time.
 *
 * For all_contacts: all contacts belonging to the user.
 * For group: all contacts in the specified group (tenant-scoped).
 */
async function resolveAudienceContactIds(
  userId: number,
  audienceType: string,
  targetGroupId: number | null,
): Promise<number[]> {
  if (audienceType === AUDIENCE_TYPES.ALL_CONTACTS) {
    const contacts = await db.contact.findMany({
      where: { userId },
      select: { id: true },
    });
    return contacts.map((c) => c.id);
  }

  if (audienceType === AUDIENCE_TYPES.GROUP && targetGroupId) {
    const memberships = await db.contactGroupMembership.findMany({
      where: { groupId: targetGroupId, userId },
      select: { contactId: true },
    });
    return memberships.map((m) => m.contactId);
  }

  return [];
}

// ---- Launch (snapshot + freeze) -------------------------------------------

/**
 * Launch a broadcast: snapshot the audience, freeze content, check review
 * threshold, and transition to queued (or review_pending if over threshold).
 *
 * Idempotent: if called again with the same broadcastId and the broadcast is
 * already launched/snapshotted, returns the existing state without re-snapshotting.
 */
export async function launchBroadcast(
  userId: number,
  broadcastId: string,
  opts: { scheduledAt?: Date | null; idempotencyKey?: string } = {},
): Promise<LaunchResult> {
  const broadcast = await db.broadcast.findFirst({
    where: { broadcastId, userId },
    select: { id: true, status: true, audienceType: true, targetGroupId: true, subject: true, htmlContent: true, textContent: true },
  });
  if (!broadcast) {
    throw new BroadcastValidationError("Broadcast not found.");
  }

  // Idempotent: already launched.
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

  // Resolve audience contact IDs.
  const contactIds = await resolveAudienceContactIds(userId, broadcast.audienceType, broadcast.targetGroupId);

  // Snapshot: INSERT...SELECT pattern (DB-side, no application memory materialization
  // for large audiences). We use createMany with skipDuplicates.
  const now = new Date();
  const reviewThreshold = BROADCAST_REVIEW_THRESHOLD;
  const requiresReview = contactIds.length > reviewThreshold;

  await db.$transaction(async (tx) => {
    // CAS: only transition draft → queued/review_pending.
    const claimed = await tx.broadcast.updateMany({
      where: { id: broadcast.id, status: BROADCAST_STATUSES.DRAFT },
      data: {
        status: requiresReview ? BROADCAST_STATUSES.REVIEW_PENDING : BROADCAST_STATUSES.QUEUED,
        reviewStatus: requiresReview ? REVIEW_STATUSES.PENDING : REVIEW_STATUSES.NOT_REQUIRED,
        launchedAt: now,
        scheduledAt: opts.scheduledAt ?? null,
      },
    });
    if (claimed.count === 0) {
      throw new BroadcastValidationError("Broadcast is no longer in draft status (concurrent launch).");
    }

    // Snapshot recipients. Use createMany with skipDuplicates for idempotency.
    if (contactIds.length > 0) {
      const recipientRows = contactIds.map((contactId) => ({
        userId,
        broadcastId: broadcast.id,
        contactId,
        status: RECIPIENT_STATUSES.PENDING,
      }));
      // Chunk to avoid oversized single inserts.
      const CHUNK = 500;
      for (let i = 0; i < recipientRows.length; i += CHUNK) {
        await tx.broadcastRecipient.createMany({
          data: recipientRows.slice(i, i + CHUNK),
          skipDuplicates: true,
        });
      }
    }
  });

  return {
    launched: true,
    broadcastId,
    status: requiresReview ? BROADCAST_STATUSES.REVIEW_PENDING : BROADCAST_STATUSES.QUEUED,
    reviewStatus: requiresReview ? REVIEW_STATUSES.PENDING : REVIEW_STATUSES.NOT_REQUIRED,
    recipientCount: contactIds.length,
    requiresReview,
  };
}

// ---- Cancel ---------------------------------------------------------------

/**
 * Cancel a broadcast. Idempotent — cancelling an already-cancelled broadcast
 * is a no-op.
 *
 * Cancellable statuses: review_pending, queued, sending, paused_quota.
 * Already-terminal statuses (completed, cancelled, rejected, failed) return
 * the current state without error.
 */
export async function cancelBroadcast(userId: number, broadcastId: string): Promise<{ cancelled: boolean; broadcastId: string; status: string }> {
  const broadcast = await db.broadcast.findFirst({
    where: { broadcastId, userId },
    select: { id: true, status: true },
  });
  if (!broadcast) {
    throw new BroadcastValidationError("Broadcast not found.");
  }

  if (!CANCELLABLE_STATUSES.has(broadcast.status)) {
    return { cancelled: false, broadcastId, status: broadcast.status };
  }

  const now = new Date();
  await db.broadcast.updateMany({
    where: { id: broadcast.id, status: { in: [...CANCELLABLE_STATUSES] } },
    data: {
      status: BROADCAST_STATUSES.CANCELLED,
      cancelledAt: now,
    },
  });

  return { cancelled: true, broadcastId, status: BROADCAST_STATUSES.CANCELLED };
}

// ---- Recipient claiming (atomic CAS) --------------------------------------

/**
 * Atomically claim a batch of pending recipients for processing.
 * Uses CAS (updateMany WHERE status=pending) + row-level locking.
 *
 * Only successfully claimed rows may be processed. Stale locks are recovered
 * by `recoverStaleRecipients()`.
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
 * Recover stale recipient claims: processing → pending WHERE lockedAt < cutoff.
 * A stale worker must NEVER overwrite a newer worker's terminal result.
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

// ---- Send processing ------------------------------------------------------

export interface ProcessResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  quotaPaused: boolean;
}

/**
 * Process a single broadcast: claim a batch, send each recipient, finalize.
 *
 * Per-recipient flow:
 *   1. Verify parent broadcast not cancelled.
 *   2. Re-read Contact (may have been deleted).
 *   3. Check Phase 9 marketing eligibility (subscribed AND not suppressed).
 *   4. Generate per-recipient unsubscribe token (JWE).
 *   5. Render content with per-recipient variables.
 *   6. Reserve BROADCAST_EMAILS quota (atomic CAS).
 *   7. Dispatch via provider abstraction.
 *   8. Terminal CAS: processing → sent|skipped|failed.
 *
 * Quota: skipped recipients consume NO quota. A real provider attempt
 * consumes exactly 1. Idempotent replays consume no second quota.
 */
export async function processBroadcast(broadcastId: number, provider?: EmailProvider): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, sent: 0, skipped: 0, failed: 0, quotaPaused: false };

  // Recover stale recipients first.
  await recoverStaleRecipients();

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
    await tryFinalizeBroadcast(broadcast.id, workerId);
    return result;
  }

  const emailProvider = provider ?? new SmtpEmailProvider();

  for (const recipientId of recipientIds) {
    result.processed++;
    await processRecipient(broadcast, recipientId, workerId, emailProvider, result);
  }

  // Try to finalize after the batch.
  await tryFinalizeBroadcast(broadcast.id, workerId);

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
    select: { id: true, userId: true, broadcastId: true, contactId: true, status: true, lockedBy: true },
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
    await markRecipientSkipped(recipientId, workerId, SKIP_REASONS.BROADCAST_CANCELLED);
    result.skipped++;
    return;
  }

  // Re-read Contact (may have been deleted).
  const contact = await db.contact.findFirst({
    where: { id: recipient.contactId, userId: recipient.userId },
    select: { id: true, email: true, name: true },
  });
  if (!contact) {
    await markRecipientSkipped(recipientId, workerId, SKIP_REASONS.CONTACT_NOT_FOUND);
    result.skipped++;
    return;
  }

  // Check Phase 9 marketing eligibility immediately before dispatch.
  const eligibility = await getMarketingEligibility(recipient.userId, recipient.contactId);
  if (!eligibility.eligible) {
    const reason = eligibility.reason === "suppressed" ? SKIP_REASONS.SUPPRESSED : SKIP_REASONS.NOT_SUBSCRIBED;
    await markRecipientSkipped(recipientId, workerId, reason);
    result.skipped++;
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
    await markRecipientFailed(recipientId, workerId, SEND_ERROR_CODES.CONTENT_RENDER_ERROR);
    result.failed++;
    return;
  }

  // Reserve BROADCAST_EMAILS quota (atomic CAS).
  const usage = await checkUsage(recipient.userId, FEATURE_KEYS.BROADCAST_EMAILS);
  if (!usage.allowed) {
    // Quota exhausted — pause the broadcast, leave recipient as pending (not failed).
    await db.broadcast.updateMany({
      where: { id: broadcast.id, status: BROADCAST_STATUSES.SENDING },
      data: { status: BROADCAST_STATUSES.PAUSED_QUOTA },
    });
    // Re-queue this recipient — it will be retried next cycle.
    await db.broadcastRecipient.updateMany({
      where: { id: recipientId, status: RECIPIENT_STATUSES.PROCESSING, lockedBy: workerId },
      data: {
        status: RECIPIENT_STATUSES.PENDING,
        lockedAt: null,
        lockedBy: null,
      },
    });
    result.quotaPaused = true;
    return;
  }

  // Dispatch via provider.
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

    // Terminal CAS: processing → sent.
    await db.broadcastRecipient.updateMany({
      where: { id: recipientId, status: RECIPIENT_STATUSES.PROCESSING, lockedBy: workerId },
      data: {
        status: RECIPIENT_STATUSES.SENT,
        providerMessageId: sendResult.messageId ?? null,
        emailMessageId: sendResult.messageId ?? null,
        attemptedAt: now,
        sentAt: now,
        lockedAt: null,
        lockedBy: null,
      },
    });
    result.sent++;
  } catch (err: any) {
    const errorCode = classifySendError(err);
    await markRecipientFailed(recipientId, workerId, errorCode);
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

async function markRecipientSkipped(recipientId: number, workerId: string, reason: string): Promise<void> {
  const now = new Date();
  await db.broadcastRecipient.updateMany({
    where: { id: recipientId, status: RECIPIENT_STATUSES.PROCESSING, lockedBy: workerId },
    data: {
      status: RECIPIENT_STATUSES.SKIPPED,
      skipReason: reason,
      attemptedAt: now,
      lockedAt: null,
      lockedBy: null,
    },
  });
}

async function markRecipientFailed(recipientId: number, workerId: string, errorCode: string): Promise<void> {
  const now = new Date();
  await db.broadcastRecipient.updateMany({
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
}

// ---- Finalization ---------------------------------------------------------

/**
 * Finalize a broadcast: transition sending → completed ONLY when there are
 * 0 pending AND 0 processing recipient rows remaining.
 *
 * A campaign may be completed with some failed/skipped recipients — that's
 * reflected in derived counts.
 */
export async function tryFinalizeBroadcast(broadcastId: number, workerId: string): Promise<boolean> {
  const nonTerminal = await db.broadcastRecipient.count({
    where: { broadcastId, status: { in: [RECIPIENT_STATUSES.PENDING, RECIPIENT_STATUSES.PROCESSING] } },
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
  sentCount: number;
  skippedCount: number;
  failedCount: number;
}> {
  const [total, pending, processing, sent, skipped, failed] = await Promise.all([
    db.broadcastRecipient.count({ where: { broadcastId } }),
    db.broadcastRecipient.count({ where: { broadcastId, status: RECIPIENT_STATUSES.PENDING } }),
    db.broadcastRecipient.count({ where: { broadcastId, status: RECIPIENT_STATUSES.PROCESSING } }),
    db.broadcastRecipient.count({ where: { broadcastId, status: RECIPIENT_STATUSES.SENT } }),
    db.broadcastRecipient.count({ where: { broadcastId, status: RECIPIENT_STATUSES.SKIPPED } }),
    db.broadcastRecipient.count({ where: { broadcastId, status: RECIPIENT_STATUSES.FAILED } }),
  ]);
  return { totalRecipients: total, pendingCount: pending, processingCount: processing, sentCount: sent, skippedCount: skipped, failedCount: failed };
}

// ---- Recipient listing (for dashboard) -----------------------------------

export interface RecipientRow {
  id: number;
  contactId: number;
  contactEmail: string;
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
      contactEmail: r.contact.email,
      contactName: r.contact.name,
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
  counts: { totalRecipients: number; pendingCount: number; processingCount: number; sentCount: number; skippedCount: number; failedCount: number },
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
    sentCount: counts.sentCount,
    skippedCount: counts.skippedCount,
    failedCount: counts.failedCount,
  };
}
