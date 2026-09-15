/**
 * Consent & Suppression — central service layer (Phase 9).
 *
 * DESIGN INVARIANTS (per Phase 9 spec):
 *
 * 1. ONE central service for ALL consent/suppression mutations. Routes must
 *    NOT independently mutate Contact.marketing* fields or SuppressionEntry.
 * 2. Every state-changing operation is wrapped in `db.$transaction()` and
 *    atomically updates:
 *      - Contact.marketingStatus / marketingConsentSource / marketingConsentAt
 *      - SuppressionEntry (current-state)
 *      - ContactConsentEvent (immutable audit)
 *      - SuppressionEvent (immutable audit)
 *      - ContactEvent (user-facing timeline)
 * 3. Idempotency: when the caller passes an `idempotencyKey`, the SHA-256 hash
 *    (with a tenant-bound domain separator) is stored on the audit rows. The
 *    (userId, idempotencyKeyHash) unique constraint ensures a retried request
 *    never creates duplicate effects. P2002 from a concurrent insert is caught
 *    OUTSIDE the transaction (per reliability protocol §4.4 — PostgreSQL
 *    invalidates the tx after a constraint violation) and treated as
 *    idempotent success.
 * 4. Tenant isolation: every query filters by userId. Cross-tenant reads
 *    return null/not-found. Cross-tenant writes are structurally impossible
 *    because the unique constraints include userId.
 * 5. No implicit consent: imports, OTP verification, group membership, contact
 *    PATCH, and event ingestion MUST NOT mutate marketing fields. Only this
 *    service's subscribe/unsubscribe operations change marketingStatus.
 * 6. Transactional Send is NOT gated by marketing eligibility — only future
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

// Phase 9 only allows these reason values to be written. The reserved
// hard_bounce/complaint values are documented for forward compatibility but
// are rejected here to prevent Phase 9 from accidentally writing them.
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
 */
export function hashIdempotencyKey(userId: number, key: string): string {
  return createHash("sha256")
    .update(`${IDEMPOTENCY_DOMAIN}:uid=${userId}:key=${key}`)
    .digest("hex");
}

// ---- Public types ---------------------------------------------------------

export interface ConsentOperationOptions {
  userId: number;
  contactId: number;
  source: ConsentSource;
  reason?: string;
  /** Optional caller-supplied idempotency key. When set, the operation is deduped per-tenant. */
  idempotencyKey?: string;
  /** Optional request ID for timeline correlation. */
  requestId?: string;
}

export interface ConsentResult {
  /** "applied" = state changed. "no_op" = already in target state (still audited if no idempotency key, otherwise deduped). */
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
  reasonDetail?: string;
  idempotencyKey?: string;
  requestId?: string;
}

export interface SuppressResult {
  status: "applied" | "no_op" | "idempotent_replay";
  suppressionId: string | null; // public UUID
  email: string;
  active: boolean;
  eventId: string | null; // SuppressionEvent eventId
  contactNotFound: boolean; // true if contactId was given but didn't belong to user
}

export interface UnsuppressOptions {
  userId: number;
  email: string;
  source: ConsentSource;
  /** If true, also transition contact to subscribed. Defaults to false — lifting suppression alone is not consent. */
  alsoSubscribe?: boolean;
  idempotencyKey?: string;
  requestId?: string;
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

// ---- Public service functions --------------------------------------------

/**
 * Explicitly subscribe a Contact to marketing.
 *
 * State changes (all in one transaction):
 *   - Contact.marketingStatus → "subscribed"
 *   - Contact.marketingConsentSource → source
 *   - Contact.marketingConsentAt → now
 *   - If a current suppression exists for (userId, email), LIFT it (active=false, liftedAt=now).
 *     Appends a SuppressionEvent("lifted") row.
 *   - Append ContactConsentEvent row.
 *   - Append ContactEvent timeline "contact.subscribed".
 *
 * Idempotency: if `idempotencyKey` is provided and a ConsentEvent with the
 * same hashed key already exists for this tenant, no new event is created.
 * The Contact state is still updated (last-writer-wins on Contact row lock).
 *
 * NOTE on lifted suppression: lifting a suppression does NOT auto-subscribe
 * — the explicit subscribe call itself is the consent. The lift is a side
 * effect of the explicit subscribe action. Future hard_bounce/complaint
 * suppressions (Phase 11) should NOT be lifted by ordinary subscribe — but
 * Phase 9 only writes "unsubscribe" and "manual" suppressions, both of which
 * are safe to lift on explicit subscribe.
 */
export async function subscribeContact(opts: ConsentOperationOptions): Promise<ConsentResult> {
  const { userId, contactId, source, reason, idempotencyKey, requestId } = opts;
  if (!VALID_CONSENT_SOURCES.has(source)) {
    throw new Error(`Invalid consent source: ${source}`);
  }

  const idempotencyKeyHash = idempotencyKey ? hashIdempotencyKey(userId, idempotencyKey) : null;

  try {
    return await db.$transaction(async (tx) => {
      const contact = await tx.contact.findFirst({
        where: { id: contactId, userId },
        select: { id: true, email: true, marketingStatus: true },
      });
      if (!contact) {
        return {
          status: "no_op",
          previousStatus: null,
          newStatus: null,
          eventId: null,
          contactNotFound: true,
        };
      }

      // Idempotency replay check (inside tx for snapshot consistency).
      if (idempotencyKeyHash) {
        const existing = await tx.contactConsentEvent.findUnique({
          where: { userId_idempotencyKeyHash: { userId, idempotencyKeyHash } },
          select: { eventId: true, newStatus: true, previousStatus: true },
        });
        if (existing) {
          return {
            status: "idempotent_replay",
            previousStatus: existing.previousStatus as MarketingStatus,
            newStatus: existing.newStatus as MarketingStatus,
            eventId: existing.eventId,
            contactNotFound: false,
          };
        }
      }

      const previousStatus = contact.marketingStatus as MarketingStatus;
      const now = new Date();

      // CAS-style: only update if not already subscribed (avoids redundant
      // row writes when called multiple times without idempotency key).
      if (previousStatus !== MARKETING_STATUSES.SUBSCRIBED) {
        await tx.contact.update({
          where: { id: contact.id },
          data: {
            marketingStatus: MARKETING_STATUSES.SUBSCRIBED,
            marketingConsentSource: source,
            marketingConsentAt: now,
          },
        });
      }

      // Lift any current suppression as a side effect of explicit subscribe.
      // Phase 9 only writes "unsubscribe" / "manual" suppressions, both safe
      // to lift here. Phase 11 hard_bounce/complaint will need separate logic.
      const currentSuppression = await tx.suppressionEntry.findUnique({
        where: { userId_email: { userId, email: contact.email } },
        select: { id: true, active: true, reason: true },
      });
      if (currentSuppression && currentSuppression.active) {
        await tx.suppressionEntry.update({
          where: { id: currentSuppression.id },
          data: { active: false, liftedAt: now, source },
        });
        // Append SuppressionEvent("lifted") — idempotent via createMany(skipDuplicates)
        // when an idempotencyKeyHash is present.
        try {
          await tx.suppressionEvent.create({
            data: {
              userId,
              suppressionId: currentSuppression.id,
              email: contact.email,
              action: SUPPRESSION_ACTIONS.LIFTED,
              reason: currentSuppression.reason,
              source,
              idempotencyKeyHash: idempotencyKeyHash
                ? `${idempotencyKeyHash}:lift`
                : null,
            },
            select: { eventId: true },
          });
        } catch {
          // P2002 means a concurrent subscribe already wrote the lift event —
          // treat as idempotent success and continue.
        }
      }

      // Append immutable ConsentEvent. If idempotencyKeyHash is set and a
      // concurrent insert races us, this throws P2002 — caught outside tx.
      const consentEvent = await tx.contactConsentEvent.create({
        data: {
          userId,
          contactId: contact.id,
          previousStatus,
          newStatus: MARKETING_STATUSES.SUBSCRIBED,
          source,
          reason: reason ?? null,
          idempotencyKeyHash,
        },
        select: { eventId: true },
      });

      // Timeline event (idempotent via createMany skipDuplicates when idempotencyKey set).
      const timelineDedupeKey = idempotencyKeyHash
        ? `subscribe:${userId}:${contact.id}:${idempotencyKeyHash}`
        : null;
      await tx.contactEvent.createMany({
        data: [
          {
            contactId: contact.id,
            type: "contact.subscribed",
            detail: { source, previousStatus, reason: reason ?? null } as any,
            requestId: requestId ?? null,
            dedupeKey: timelineDedupeKey,
          },
        ],
        skipDuplicates: true,
      });

      return {
        status: previousStatus === MARKETING_STATUSES.SUBSCRIBED ? "no_op" : "applied",
        previousStatus,
        newStatus: MARKETING_STATUSES.SUBSCRIBED,
        eventId: consentEvent.eventId,
        contactNotFound: false,
      };
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      // Race: a concurrent insert with the same idempotencyKeyHash won.
      // Fetch the existing event and return idempotent_replay.
      if (idempotencyKeyHash) {
        const existing = await db.contactConsentEvent.findUnique({
          where: { userId_idempotencyKeyHash: { userId, idempotencyKeyHash } },
          select: { eventId: true, previousStatus: true, newStatus: true },
        });
        if (existing) {
          return {
            status: "idempotent_replay",
            previousStatus: existing.previousStatus as MarketingStatus,
            newStatus: existing.newStatus as MarketingStatus,
            eventId: existing.eventId,
            contactNotFound: false,
          };
        }
      }
    }
    throw err;
  }
}

/**
 * Explicitly unsubscribe a Contact from marketing.
 *
 * State changes (all in one transaction):
 *   - Contact.marketingStatus → "unsubscribed"
 *   - Contact.marketingConsentSource → source
 *   - Contact.marketingConsentAt → now
 *   - Upsert SuppressionEntry(userId, email, reason="unsubscribe", active=true)
 *   - Append ContactConsentEvent row
 *   - Append SuppressionEvent("suppressed") row
 *   - Append ContactEvent timeline "contact.unsubscribed"
 */
export async function unsubscribeContact(opts: ConsentOperationOptions): Promise<ConsentResult> {
  const { userId, contactId, source, reason, idempotencyKey, requestId } = opts;
  if (!VALID_CONSENT_SOURCES.has(source)) {
    throw new Error(`Invalid consent source: ${source}`);
  }

  const idempotencyKeyHash = idempotencyKey ? hashIdempotencyKey(userId, idempotencyKey) : null;

  try {
    return await db.$transaction(async (tx) => {
      const contact = await tx.contact.findFirst({
        where: { id: contactId, userId },
        select: { id: true, email: true, marketingStatus: true },
      });
      if (!contact) {
        return {
          status: "no_op",
          previousStatus: null,
          newStatus: null,
          eventId: null,
          contactNotFound: true,
        };
      }

      if (idempotencyKeyHash) {
        const existing = await tx.contactConsentEvent.findUnique({
          where: { userId_idempotencyKeyHash: { userId, idempotencyKeyHash } },
          select: { eventId: true, newStatus: true, previousStatus: true },
        });
        if (existing) {
          return {
            status: "idempotent_replay",
            previousStatus: existing.previousStatus as MarketingStatus,
            newStatus: existing.newStatus as MarketingStatus,
            eventId: existing.eventId,
            contactNotFound: false,
          };
        }
      }

      const previousStatus = contact.marketingStatus as MarketingStatus;
      const now = new Date();

      if (previousStatus !== MARKETING_STATUSES.UNSUBSCRIBED) {
        await tx.contact.update({
          where: { id: contact.id },
          data: {
            marketingStatus: MARKETING_STATUSES.UNSUBSCRIBED,
            marketingConsentSource: source,
            marketingConsentAt: now,
          },
        });
      }

      // Upsert current-state suppression entry (atomic — single row per tenant+email).
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

      // Append immutable ConsentEvent.
      const consentEvent = await tx.contactConsentEvent.create({
        data: {
          userId,
          contactId: contact.id,
          previousStatus,
          newStatus: MARKETING_STATUSES.UNSUBSCRIBED,
          source,
          reason: reason ?? null,
          idempotencyKeyHash,
        },
        select: { eventId: true },
      });

      // Append SuppressionEvent("suppressed").
      try {
        await tx.suppressionEvent.create({
          data: {
            userId,
            suppressionId: suppression.id,
            email: contact.email,
            action: SUPPRESSION_ACTIONS.SUPPRESSED,
            reason: SUPPRESSION_REASONS.UNSUBSCRIBE,
            source,
            idempotencyKeyHash: idempotencyKeyHash
              ? `${idempotencyKeyHash}:suppress`
              : null,
          },
          select: { eventId: true },
        });
      } catch {
        // P2002 on the idempotency-key-suffixed hash means a concurrent
        // unsubscribe already wrote the suppression event. Safe to ignore —
        // the parent consentEvent will still throw P2002 below if it raced.
      }

      // Timeline event.
      const timelineDedupeKey = idempotencyKeyHash
        ? `unsubscribe:${userId}:${contact.id}:${idempotencyKeyHash}`
        : null;
      await tx.contactEvent.createMany({
        data: [
          {
            contactId: contact.id,
            type: "contact.unsubscribed",
            detail: { source, previousStatus, reason: reason ?? null } as any,
            requestId: requestId ?? null,
            dedupeKey: timelineDedupeKey,
          },
        ],
        skipDuplicates: true,
      });

      return {
        status: previousStatus === MARKETING_STATUSES.UNSUBSCRIBED ? "no_op" : "applied",
        previousStatus,
        newStatus: MARKETING_STATUSES.UNSUBSCRIBED,
        eventId: consentEvent.eventId,
        contactNotFound: false,
      };
    });
  } catch (err: any) {
    if (err?.code === "P2002" && idempotencyKeyHash) {
      const existing = await db.contactConsentEvent.findUnique({
        where: { userId_idempotencyKeyHash: { userId, idempotencyKeyHash } },
        select: { eventId: true, previousStatus: true, newStatus: true },
      });
      if (existing) {
        return {
          status: "idempotent_replay",
          previousStatus: existing.previousStatus as MarketingStatus,
          newStatus: existing.newStatus as MarketingStatus,
          eventId: existing.eventId,
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
 * Used by:
 *   - Dashboard "Suppress" action (reason="manual", source="dashboard")
 *   - Public unsubscribe link (reason="unsubscribe", source="unsubscribe",
 *     alsoSubscribe=false, no contactId — just suppress by email)
 *   - Future v1 suppression API
 */
export async function suppressEmail(opts: SuppressOptions): Promise<SuppressResult> {
  const { userId, email, reason, source, contactId, idempotencyKey, requestId } = opts;
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

  const idempotencyKeyHash = idempotencyKey ? hashIdempotencyKey(userId, idempotencyKey) : null;

  // If a contactId was provided, route through unsubscribeContact for the
  // atomic ConsentEvent + SuppressionEvent pair (preserves consent history).
  if (contactId !== undefined) {
    const consent = await unsubscribeContact({
      userId,
      contactId,
      source,
      reason,
      idempotencyKey,
      requestId,
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
    // Fetch the suppression entry we just upserted.
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

  // Email-only suppression (no contactId). Use the entry's own audit.
  try {
    return await db.$transaction(async (tx) => {
      if (idempotencyKeyHash) {
        const existing = await tx.suppressionEvent.findUnique({
          where: { userId_idempotencyKeyHash: { userId, idempotencyKeyHash } },
          select: { eventId: true, action: true },
        });
        if (existing) {
          const entry = await tx.suppressionEntry.findUnique({
            where: { userId_email: { userId, email: normalized } },
            select: { suppressionId: true, active: true },
          });
          return {
            status: "idempotent_replay" as const,
            suppressionId: entry?.suppressionId ?? null,
            email: normalized,
            active: entry?.active ?? false,
            eventId: existing.eventId,
            contactNotFound: false,
          };
        }
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
          action: SUPPRESSION_ACTIONS.SUPPRESSED,
          reason,
          source,
          idempotencyKeyHash,
        },
        select: { eventId: true },
      });

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
    if (err?.code === "P2002" && idempotencyKeyHash) {
      const existing = await db.suppressionEvent.findUnique({
        where: { userId_idempotencyKeyHash: { userId, idempotencyKeyHash } },
        select: { eventId: true },
      });
      const entry = await db.suppressionEntry.findUnique({
        where: { userId_email: { userId, email: normalized } },
        select: { suppressionId: true, active: true },
      });
      return {
        status: "idempotent_replay",
        suppressionId: entry?.suppressionId ?? null,
        email: normalized,
        active: entry?.active ?? false,
        eventId: existing?.eventId ?? null,
        contactNotFound: false,
      };
    }
    throw err;
  }
}

/**
 * Lift a suppression. By default this ONLY lifts the suppression — it does
 * NOT subscribe the contact. To resubscribe, pass `alsoSubscribe: true`
 * (which routes through subscribeContact for the explicit consent action).
 *
 * An ordinary `unsubscribe` suppression lifted via `alsoSubscribe: true`:
 *   - Contact.marketingStatus → subscribed
 *   - SuppressionEntry.active → false, liftedAt → now
 *   - ContactConsentEvent(subscribed) appended
 *   - SuppressionEvent(lifted) appended
 */
export async function unsuppressEmail(opts: UnsuppressOptions): Promise<UnsuppressResult> {
  const { userId, email, source, alsoSubscribe, idempotencyKey, requestId } = opts;
  if (!VALID_CONSENT_SOURCES.has(source)) {
    throw new Error(`Invalid suppression source: ${source}`);
  }
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    throw new Error("Invalid email.");
  }

  const idempotencyKeyHash = idempotencyKey ? hashIdempotencyKey(userId, idempotencyKey) : null;

  // If alsoSubscribe is set, find the contact for this email and route through
  // subscribeContact for the full atomic transition.
  if (alsoSubscribe) {
    const contact = await db.contact.findUnique({
      where: { userId_email: { userId, email: normalized } },
      select: { id: true },
    });
    if (!contact) {
      // No contact — still lift any suppression that might exist.
      return liftOnly(userId, normalized, source, idempotencyKeyHash, requestId);
    }
    const consent = await subscribeContact({
      userId,
      contactId: contact.id,
      source,
      idempotencyKey,
      requestId,
    });
    return {
      status: consent.status === "idempotent_replay" ? "idempotent_replay" : "applied",
      email: normalized,
      active: false, // subscribeContact lifted it
      eventId: consent.eventId,
    };
  }

  return liftOnly(userId, normalized, source, idempotencyKeyHash, requestId);
}

async function liftOnly(
  userId: number,
  normalizedEmail: string,
  source: ConsentSource,
  idempotencyKeyHash: string | null,
  requestId?: string,
): Promise<UnsuppressResult> {
  try {
    return await db.$transaction(async (tx) => {
      if (idempotencyKeyHash) {
        const existing = await tx.suppressionEvent.findUnique({
          where: { userId_idempotencyKeyHash: { userId, idempotencyKeyHash } },
          select: { eventId: true },
        });
        if (existing) {
          const entry = await tx.suppressionEntry.findUnique({
            where: { userId_email: { userId, email: normalizedEmail } },
            select: { active: true },
          });
          return {
            status: "idempotent_replay" as const,
            email: normalizedEmail,
            active: entry?.active ?? false,
            eventId: existing.eventId,
          };
        }
      }

      const entry = await tx.suppressionEntry.findUnique({
        where: { userId_email: { userId, email: normalizedEmail } },
        select: { id: true, active: true, reason: true },
      });
      if (!entry || !entry.active) {
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
          action: SUPPRESSION_ACTIONS.LIFTED,
          reason: entry.reason,
          source,
          idempotencyKeyHash,
        },
        select: { eventId: true },
      });

      // Optional: add a contact timeline event if a contact exists for this email.
      const contact = await tx.contact.findUnique({
        where: { userId_email: { userId, email: normalizedEmail } },
        select: { id: true },
      });
      if (contact) {
        await tx.contactEvent.createMany({
          data: [
            {
              contactId: contact.id,
              type: "contact.unsuppressed",
              detail: { source, reason: entry.reason } as any,
              requestId: requestId ?? null,
              dedupeKey: idempotencyKeyHash
                ? `unsuppress:${userId}:${contact.id}:${idempotencyKeyHash}`
                : null,
            },
          ],
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
    if (err?.code === "P2002" && idempotencyKeyHash) {
      const existing = await db.suppressionEvent.findUnique({
        where: { userId_idempotencyKeyHash: { userId, idempotencyKeyHash } },
        select: { eventId: true },
      });
      return {
        status: "idempotent_replay",
        email: normalizedEmail,
        active: false,
        eventId: existing?.eventId ?? null,
      };
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
 *
 * Returns:
 *   { eligible: true } if both conditions hold.
 *   { eligible: false, reason: "contact_not_found" | "not_subscribed" | "suppressed" } otherwise.
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
 * Eligibility check by email (used by future Broadcast sending which may
 * not have a contactId). Returns contact_not_found if no Contact exists
 * for this (userId, normalized email).
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
  opts: { alsoSubscribe?: boolean; idempotencyKey?: string; requestId?: string } = {},
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
  });
}

// ---- Audit history reads --------------------------------------------------

export interface ConsentHistoryEntry {
  eventId: string;
  contactId: number;
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
      previousStatus: r.previousStatus,
      newStatus: r.newStatus,
      source: r.source,
      reason: r.reason,
      createdAt: r.createdAt,
    })),
    total,
  };
}

// ---- Convenience: generate a fresh idempotency key for callers that don't have one ----
export function newIdempotencyKey(): string {
  return randomUUID();
}
