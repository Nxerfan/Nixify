-- ---- Phase 9: Consent & Suppression -------------------------------------
-- Additive migration only. No destructive changes. No DROP, no TRUNCATE, no
-- ALTER TYPE. Existing Contact.marketing* fields (added in Phase 1) are
-- preserved unchanged — Phase 9 reads/writes them via the central consent
-- service, but the columns themselves are untouched.

-- Immutable, tenant-owned audit trail of every marketing-consent transition.
-- One row per state transition. Never updated — only appended.
CREATE TABLE "ContactConsentEvent" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "idempotencyKeyHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactConsentEvent_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on eventId (public opaque UUID per event).
CREATE UNIQUE INDEX "ContactConsentEvent_eventId_key" ON "ContactConsentEvent"("eventId");

-- Per-tenant idempotency: (userId, idempotencyKeyHash). PostgreSQL treats
-- NULLs as distinct in unique indexes, so multiple NULL rows are allowed
-- (one per distinct non-idempotent call) while a specific non-NULL key
-- can appear at most once per tenant.
CREATE UNIQUE INDEX "ContactConsentEvent_userId_idempotencyKeyHash_key"
    ON "ContactConsentEvent"("userId", "idempotencyKeyHash");

CREATE INDEX "ContactConsentEvent_userId_contactId_createdAt_idx"
    ON "ContactConsentEvent"("userId", "contactId", "createdAt");
CREATE INDEX "ContactConsentEvent_userId_idempotencyKeyHash_idx"
    ON "ContactConsentEvent"("userId", "idempotencyKeyHash");
CREATE INDEX "ContactConsentEvent_contactId_createdAt_idx"
    ON "ContactConsentEvent"("contactId", "createdAt");

-- FK: contactId → Contact.id (CASCADE — if a contact is deleted, its consent
-- history is deleted with it. Tenants who need permanent records should
-- export consent events before deleting contacts.)
ALTER TABLE "ContactConsentEvent"
    ADD CONSTRAINT "ContactConsentEvent_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
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

-- At most one current suppression per (tenant, normalized email).
CREATE UNIQUE INDEX "SuppressionEntry_userId_email_key"
    ON "SuppressionEntry"("userId", "email");

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
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "idempotencyKeyHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuppressionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SuppressionEvent_eventId_key"
    ON "SuppressionEvent"("eventId");

CREATE UNIQUE INDEX "SuppressionEvent_userId_idempotencyKeyHash_key"
    ON "SuppressionEvent"("userId", "idempotencyKeyHash");

CREATE INDEX "SuppressionEvent_userId_email_createdAt_idx"
    ON "SuppressionEvent"("userId", "email", "createdAt");
CREATE INDEX "SuppressionEvent_userId_idempotencyKeyHash_idx"
    ON "SuppressionEvent"("userId", "idempotencyKeyHash");
CREATE INDEX "SuppressionEvent_suppressionId_createdAt_idx"
    ON "SuppressionEvent"("suppressionId", "createdAt");

-- FK: suppressionId → SuppressionEntry.id (SET NULL — if a current-state
-- suppression row is deleted, the audit row's suppressionId becomes NULL
-- but the audit row itself survives.)
ALTER TABLE "SuppressionEvent"
    ADD CONSTRAINT "SuppressionEvent_suppressionId_fkey"
    FOREIGN KEY ("suppressionId") REFERENCES "SuppressionEntry"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
