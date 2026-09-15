-- ---- Phase 10: Broadcasts -------------------------------------------------
-- Additive migration only. No destructive changes. No DROP, no TRUNCATE.
--
-- Adds:
--   Broadcast (campaign config + status state machine)
--   BroadcastRecipient (per-recipient send records, row-level claiming)
--
-- STRUCTURAL TENANT ISOLATION: composite foreign keys enforce parent/child
-- tenant agreement at the DB level.

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

-- Per-recipient send record. Created at launch via INSERT...SELECT.
CREATE TABLE "BroadcastRecipient" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "broadcastId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "skipReason" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "providerMessageId" TEXT,
    "emailMessageId" TEXT,
    "attemptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastRecipient_pkey" PRIMARY KEY ("id")
);

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

-- Composite tenant-safe FK: (userId, contactId) → Contact(userId, id).
-- DB rejects cross-tenant recipient references. ON DELETE CASCADE: if a
-- contact is deleted, its recipient rows are deleted (audit trail respects
-- Contact deletion privacy semantics).
ALTER TABLE "BroadcastRecipient"
    ADD CONSTRAINT "BroadcastRecipient_userId_contactId_fkey"
    FOREIGN KEY ("userId", "contactId") REFERENCES "Contact"("userId", "id")
    ON DELETE CASCADE ON UPDATE CASCADE;
