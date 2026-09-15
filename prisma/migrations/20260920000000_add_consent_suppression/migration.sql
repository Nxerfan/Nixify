-- ---- Phase 9: Consent & Suppression -------------------------------------
-- Additive migration only. No destructive changes. No DROP, no TRUNCATE, no
-- ALTER TYPE. Existing Contact.marketing* fields (added in Phase 1) are
-- preserved unchanged — Phase 9 reads/writes them via the central consent
-- service, but the columns themselves are untouched.
--
-- IDEMPOTENCY NAMESPACE: (userId, operation, idempotencyKeyHash). NULL
-- idempotencyKeyHash is allowed (PostgreSQL treats each NULL as distinct) so
-- calls without an idempotency key still produce distinct audit rows.
--
-- STRUCTURAL TENANT ISOLATION: composite foreign keys enforce parent/child
-- tenant agreement at the DB level — a ConsentEvent row whose userId
-- disagrees with its Contact's userId is rejected by the FK constraint.

-- Immutable, tenant-owned audit trail of every marketing-consent transition.
-- One row per ACTUAL state transition. Never updated — only appended.
CREATE TABLE "ContactConsentEvent" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "idempotencyKeyHash" TEXT,
    "requestFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactConsentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactConsentEvent_eventId_key" ON "ContactConsentEvent"("eventId");

-- Per-tenant + per-operation + per-key idempotency. A retried request with the
-- same (userId, operation, idempotencyKeyHash) tuple is deduped. Different
-- operations or different callers with the same key are NOT replayed against
-- each other.
CREATE UNIQUE INDEX "ContactConsentEvent_userId_operation_idempotencyKeyHash_key"
    ON "ContactConsentEvent"("userId", "operation", "idempotencyKeyHash");

CREATE INDEX "ContactConsentEvent_userId_contactId_createdAt_idx"
    ON "ContactConsentEvent"("userId", "contactId", "createdAt");
CREATE INDEX "ContactConsentEvent_userId_operation_idempotencyKeyHash_idx"
    ON "ContactConsentEvent"("userId", "operation", "idempotencyKeyHash");
CREATE INDEX "ContactConsentEvent_contactId_createdAt_idx"
    ON "ContactConsentEvent"("contactId", "createdAt");

-- Composite tenant-safe FK: (userId, contactId) -> Contact(userId, id).
-- The database itself rejects a row whose userId disagrees with its Contact's
-- userId. Application-level filters are defense-in-depth.
ALTER TABLE "ContactConsentEvent"
    ADD CONSTRAINT "ContactConsentEvent_userId_contactId_fkey"
    FOREIGN KEY ("userId", "contactId") REFERENCES "Contact"("userId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Current-state, tenant-scoped suppression. At most one active row per
-- (userId, normalized email).
CREATE TABLE "SuppressionEntry" (
    "id" SERIAL NOT NULL,
    "suppressionId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "liftedAt" TIMESTAMP(3),

    CONSTRAINT "SuppressionEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SuppressionEntry_suppressionId_key"
    ON "SuppressionEntry"("suppressionId");
CREATE UNIQUE INDEX "SuppressionEntry_userId_email_key"
    ON "SuppressionEntry"("userId", "email");
-- Composite unique key enables tenant-safe composite FK from SuppressionEvent.
CREATE UNIQUE INDEX "SuppressionEntry_userId_id_key"
    ON "SuppressionEntry"("userId", "id");

CREATE INDEX "SuppressionEntry_userId_email_idx"
    ON "SuppressionEntry"("userId", "email");
CREATE INDEX "SuppressionEntry_userId_active_idx"
    ON "SuppressionEntry"("userId", "active");
CREATE INDEX "SuppressionEntry_userId_reason_idx"
    ON "SuppressionEntry"("userId", "reason");

-- Immutable audit of every suppression transition. Survives SuppressionEntry
-- deletion/lift so a full transition log is always available.
CREATE TABLE "SuppressionEvent" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "suppressionId" INTEGER,
    "email" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "idempotencyKeyHash" TEXT,
    "requestFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuppressionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SuppressionEvent_eventId_key"
    ON "SuppressionEvent"("eventId");

CREATE UNIQUE INDEX "SuppressionEvent_userId_operation_idempotencyKeyHash_key"
    ON "SuppressionEvent"("userId", "operation", "idempotencyKeyHash");

CREATE INDEX "SuppressionEvent_userId_email_createdAt_idx"
    ON "SuppressionEvent"("userId", "email", "createdAt");
CREATE INDEX "SuppressionEvent_userId_operation_idempotencyKeyHash_idx"
    ON "SuppressionEvent"("userId", "operation", "idempotencyKeyHash");
CREATE INDEX "SuppressionEvent_suppressionId_createdAt_idx"
    ON "SuppressionEvent"("suppressionId", "createdAt");

-- Composite tenant-safe FK: (userId, suppressionId) -> SuppressionEntry(userId, id).
-- Database itself rejects cross-tenant event->entry references.
ALTER TABLE "SuppressionEvent"
    ADD CONSTRAINT "SuppressionEvent_userId_suppressionId_fkey"
    FOREIGN KEY ("userId", "suppressionId") REFERENCES "SuppressionEntry"("userId", "id")
    ON DELETE SET NULL ON UPDATE CASCADE;
