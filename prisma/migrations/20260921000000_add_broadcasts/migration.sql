-- ---- Phase 10: Broadcasts -------------------------------------------------
-- Additive migration only. No destructive changes. No DROP, no TRUNCATE.
--
-- Adds:
--   Broadcast (campaign config + status state machine)
--   BroadcastRecipient (per-recipient send records, row-level claiming)
--   BroadcastMutationIdempotency (durable idempotency outcomes for launch/cancel)
--
-- STRUCTURAL TENANT ISOLATION: composite foreign keys enforce parent/child
-- tenant agreement at the DB level.
--
-- Identifier length note: all PostgreSQL identifiers below are < 63 chars
-- (NAMEDATALEN limit). Verified via `length(name) <= 63` for every constraint
-- and index name in this file.

-- Tenant-owned marketing broadcast. Content frozen at launch; audience
-- snapshotted into BroadcastRecipient rows.
CREATE TABLE "Broadcast" (
    "id" SERIAL NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "textContent" TEXT,
    "audienceType" TEXT NOT NULL,
    "targetGroupId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewStatus" TEXT NOT NULL DEFAULT 'not_required',
    "scheduledAt" TIMESTAMP(3),
    "launchedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByAdminId" INTEGER,
    "reviewReason" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Broadcast_broadcastId_key" ON "Broadcast"("broadcastId");
CREATE UNIQUE INDEX "Broadcast_userId_id_key" ON "Broadcast"("userId", "id");
CREATE INDEX "Broadcast_userId_createdAt_idx" ON "Broadcast"("userId", "createdAt");
CREATE INDEX "Broadcast_userId_status_createdAt_idx" ON "Broadcast"("userId", "status", "createdAt");
CREATE INDEX "Broadcast_reviewStatus_status_idx" ON "Broadcast"("reviewStatus", "status");

-- FK: userId → User.id (CASCADE — deleting a user deletes their broadcasts)
ALTER TABLE "Broadcast"
    ADD CONSTRAINT "Broadcast_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: reviewedByAdminId → AdminUser.id (single-column nullable FK, ON DELETE SET NULL).
-- Admin row deletion preserves the broadcast's audit history (reviewedAt remains;
-- only the reviewer link is cleared). Safe because only the nullable column is
-- nullified — `userId` is unaffected.
ALTER TABLE "Broadcast"
    ADD CONSTRAINT "Broadcast_reviewedByAdminId_fkey"
    FOREIGN KEY ("reviewedByAdminId") REFERENCES "AdminUser"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Per-recipient send record. Created at launch via INSERT...SELECT.
-- `contactId` is nullable + ON DELETE SET NULL: contact deletion preserves the
-- recipient row's audit history by nullifying only contactId (userId remains
-- NOT NULL). A null contactId at processRecipient time → skipped with
-- skipReason=contact_not_found.
CREATE TABLE "BroadcastRecipient" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "broadcastId" INTEGER NOT NULL,
    "contactOwnerUserId" INTEGER,
    "contactId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "skipReason" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "providerMessageId" TEXT,
    "attemptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastRecipient_pkey" PRIMARY KEY ("id")
);

-- (broadcastId, contactId) uniqueness. PostgreSQL treats NULLs as distinct in
-- unique indexes, so multiple rows in the same broadcast can have
-- contactId=NULL after contact deletion — audit history is fully preserved.
CREATE UNIQUE INDEX "BroadcastRecipient_broadcastId_contactId_key"
    ON "BroadcastRecipient"("broadcastId", "contactId");
CREATE UNIQUE INDEX "BroadcastRecipient_userId_id_key"
    ON "BroadcastRecipient"("userId", "id");
CREATE INDEX "BroadcastRecipient_broadcastId_status_idx"
    ON "BroadcastRecipient"("broadcastId", "status");
CREATE INDEX "BroadcastRecipient_userId_contactId_idx"
    ON "BroadcastRecipient"("userId", "contactId");
CREATE INDEX "BroadcastRecipient_broadcastId_lockedAt_idx"
    ON "BroadcastRecipient"("broadcastId", "lockedAt");

-- Composite tenant-safe FK: (userId, broadcastId) → Broadcast(userId, id).
-- DB rejects cross-tenant recipient rows.
ALTER TABLE "BroadcastRecipient"
    ADD CONSTRAINT "BroadcastRecipient_userId_broadcastId_fkey"
    FOREIGN KEY ("userId", "broadcastId") REFERENCES "Broadcast"("userId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Composite tenant-safe FK: (contactOwnerUserId, contactId) → Contact(userId, id).
-- Both columns are nullable, so ON DELETE SET NULL nullifies only these two
-- columns (userId remains NOT NULL). This satisfies BOTH requirements:
--   1. Structural tenant isolation: the DB rejects a cross-tenant Contact reference.
--   2. Contact deletion preserves the recipient audit row (contact refs nullified).
-- CHECK constraints enforce: both-null-or-both-present AND contactOwner=userId.
ALTER TABLE "BroadcastRecipient"
    ADD CONSTRAINT "BroadcastRecipient_contactOwnerUserId_contactId_fkey"
    FOREIGN KEY ("contactOwnerUserId", "contactId") REFERENCES "Contact"("userId", "id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK: both contact reference columns are present or both absent.
ALTER TABLE "BroadcastRecipient"
    ADD CONSTRAINT "BroadcastRecipient_contact_ref_consistency"
    CHECK (("contactOwnerUserId" IS NULL) = ("contactId" IS NULL));

-- CHECK: when present, contact owner must match the recipient's userId
-- (structural tenant agreement).
ALTER TABLE "BroadcastRecipient"
    ADD CONSTRAINT "BroadcastRecipient_contact_owner_matches_userId"
    CHECK ("contactOwnerUserId" IS NULL OR "contactOwnerUserId" = "userId");

-- Durable idempotency outcome store for stateful broadcast mutations
-- (launch, cancel). Identity: (userId, operation, idempotencyKeyHash).
-- Conflict detection via requestFingerprint (SHA-256 of canonicalized body).
CREATE TABLE "BroadcastMutationIdempotency" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "targetBroadcastId" TEXT NOT NULL,
    "idempotencyKeyHash" TEXT NOT NULL,
    "requestFingerprint" TEXT,
    "resultStatus" TEXT NOT NULL,
    "resultData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BroadcastMutationIdempotency_pkey" PRIMARY KEY ("id")
);

-- NOTE: index names shortened to avoid PostgreSQL 63-char identifier limit.
CREATE UNIQUE INDEX "bmi_userId_operation_idempotencyKeyHash_key"
    ON "BroadcastMutationIdempotency"("userId", "operation", "idempotencyKeyHash");

CREATE INDEX "bmi_userId_operation_idempotencyKeyHash_idx"
    ON "BroadcastMutationIdempotency"("userId", "operation", "idempotencyKeyHash");

CREATE INDEX "bmi_userId_targetBroadcastId_idx"
    ON "BroadcastMutationIdempotency"("userId", "targetBroadcastId");

-- FK: userId → User.id (CASCADE)
ALTER TABLE "BroadcastMutationIdempotency"
    ADD CONSTRAINT "BroadcastMutationIdempotency_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
