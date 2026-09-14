/**
 * Events service (Phase 6, sections 8, 11, 16).
 *
 * Owns: validation, normalization, tenant-scoped Contact lookup (no create),
 * idempotency, fingerprinting, event persistence, safe response mapping.
 *
 * Side effects explicitly NOT performed (section 18):
 *   - no email sending
 *   - no MESSAGING_EMAILS / OTP_EMAILS consumption
 *   - no JobQueue automation jobs
 *   - no webhook delivery
 *   - no Contact creation
 *   - no marketing consent changes
 */
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/contacts";
import {
  createEventSchema,
  isReservedEventType,
  validateEventData,
  type CreateEventInput,
} from "./validation";
import {
  hashIdempotencyKey,
  computeRequestFingerprint,
} from "./idempotency";

// ---- Types -----------------------------------------------------------------

export interface IngestEventInput {
  userId: number;            // tenant owner (User.id, from ctx.apiKey.userId)
  type: string;
  email: string;
  data: unknown;
  environment: string;        // "development" | "production" (from API key)
  idempotencyKey: string;     // raw header value (will be hashed)
  requestId?: string;
}

export interface IngestResult {
  eventId: string;
  type: string;
  email: string;
  environment: string;
  createdAt: Date;
  replay: boolean;
  conflict: boolean;
}

// ---- Errors ----------------------------------------------------------------

export class EventValidationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "EventValidationError";
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("Idempotency-Key was used with a different request body.");
    this.name = "IdempotencyConflictError";
  }
}

// ---- The main ingest function ----------------------------------------------

export async function ingestEvent(input: IngestEventInput): Promise<IngestResult> {
  // ---- 1. Validate the request body via zod ----
  const parseResult = createEventSchema.safeParse({
    type: input.type,
    email: input.email,
    data: input.data,
  });
  if (!parseResult.success) {
    const msg = parseResult.error.issues.map((i) => i.message).join("; ");
    throw new EventValidationError("validation_failed", msg);
  }
  const body: CreateEventInput = parseResult.data;

  // ---- 2. Reserved event type check (section 12) ----
  if (isReservedEventType(body.type)) {
    throw new EventValidationError("reserved_event_type", `Event type "${body.type}" is reserved for internal use.`);
  }

  // ---- 3. Validate event data (size, depth, keys — section 14) ----
  const dataError = validateEventData(body.data);
  if (dataError) {
    throw new EventValidationError("validation_failed", dataError);
  }

  // ---- 4. Normalize email ----
  const normalizedEmail = normalizeEmail(body.email);

  // ---- 5. Compute idempotency key hash + request fingerprint ----
  const idempotencyKeyHash = hashIdempotencyKey(input.idempotencyKey);
  const requestFingerprint = computeRequestFingerprint({
    type: body.type,
    email: normalizedEmail,
    environment: input.environment,
    data: body.data,
  });

  // ---- 6. Check for existing event (idempotency) ----
  // First, check if an event with this (userId, idempotencyKeyHash) already exists.
  // If it does: same fingerprint → replay (200); different fingerprint → conflict (409).
  const existing = await db.inboundEvent.findUnique({
    where: { userId_idempotencyKeyHash: { userId: input.userId, idempotencyKeyHash } },
  });
  if (existing) {
    if (existing.requestFingerprint !== requestFingerprint) {
      throw new IdempotencyConflictError();
    }
    return {
      eventId: existing.eventId,
      type: existing.type,
      email: existing.email,
      environment: existing.environment,
      createdAt: existing.createdAt,
      replay: true,
      conflict: false,
    };
  }

  // ---- 7. Look for an existing Contact (section 8) ----
  // Do NOT auto-create. If found, link. If absent, contactId = null.
  const contact = await db.contact.findUnique({
    where: { userId_email: { userId: input.userId, email: normalizedEmail } },
    select: { id: true },
  });

  // ---- 8. Atomic insert (concurrency-safe idempotency) ----
  // The unique constraint (userId, idempotencyKeyHash) is the atomic claim.
  // A concurrent duplicate will hit P2002 — we treat that as a replay.
  try {
    const created = await db.inboundEvent.create({
      data: {
        userId: input.userId,
        contactId: contact?.id ?? null,
        type: body.type,
        email: normalizedEmail,
        environment: input.environment,
        data: body.data as any,
        source: "api_v1",
        requestId: input.requestId ?? null,
        idempotencyKeyHash,
        requestFingerprint,
      },
    });
    return {
      eventId: created.eventId,
      type: created.type,
      email: created.email,
      environment: created.environment,
      createdAt: created.createdAt,
      replay: false,
      conflict: false,
    };
  } catch (e: any) {
    if (e?.code === "P2002") {
      // Concurrent duplicate won the claim — fetch the existing event.
      const raceWinner = await db.inboundEvent.findUnique({
        where: { userId_idempotencyKeyHash: { userId: input.userId, idempotencyKeyHash } },
      });
      if (raceWinner) {
        if (raceWinner.requestFingerprint !== requestFingerprint) {
          throw new IdempotencyConflictError();
        }
        return {
          eventId: raceWinner.eventId,
          type: raceWinner.type,
          email: raceWinner.email,
          environment: raceWinner.environment,
          createdAt: raceWinner.createdAt,
          replay: true,
          conflict: false,
        };
      }
    }
    throw e;
  }
}
