-- Phase 11: Provider & Deliverability
--
-- BLOCKER #4 — Structural FKs for source correlations:
--   - Composite FK (emailMessageOwnerUserId, emailMessageId) → EmailMessage(userId, messageId)
--     ON DELETE SET NULL (both columns nullable, per the Phase 10 lesson on
--     retention-on-delete vs. tenant-safe composite ownership).
--   - Composite FK (broadcastRecipientOwnerUserId, broadcastRecipientId) →
--     BroadcastRecipient(userId, id) ON DELETE SET NULL (both nullable).
--   - Partial unique indexes on (userId, emailMessageId) and (userId,
--     broadcastRecipientId) for source-correlation deduplication when non-null.
--
-- BLOCKER #5 — DB CHECK constraints:
--   - sourceType IN ('transactional', 'broadcast')
--   - currentStatus IN ('queued', 'provider_accepted', 'delivered', 'deferred',
--                       'bounced', 'complained', 'rejected', 'failed', 'unknown')
--   - EmailDeliveryEvent.type IN ('accepted', 'delivered', 'deferred',
--                                  'bounced', 'complained', 'rejected')
--   - providerEventId NOT NULL (was nullable in initial migration).

CREATE TABLE "EmailDelivery" (
    "id" SERIAL NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "emailMessageId" TEXT,
    -- Phase 11 audit: nullable owner column for composite FK (Phase 10 pattern).
    -- The NOT NULL "userId" column is the immutable tenant owner; the nullable
    -- "emailMessageOwnerUserId" is the FK column that can be safely nulled by
    -- ON DELETE SET NULL when the parent EmailMessage is deleted.
    "emailMessageOwnerUserId" INTEGER,
    "broadcastRecipientId" INTEGER,
    -- Phase 11 audit: nullable owner column for composite FK (Phase 10 pattern).
    "broadcastRecipientOwnerUserId" INTEGER,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "currentStatus" TEXT NOT NULL DEFAULT 'queued',
    "lastProviderEventAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id"),
    -- BLOCKER #5 — CHECK constraints inline on the CREATE TABLE.
    CONSTRAINT "EmailDelivery_sourceType_check"
      CHECK ("sourceType" IN ('transactional', 'broadcast')),
    CONSTRAINT "EmailDelivery_currentStatus_check"
      CHECK ("currentStatus" IN (
        'queued', 'provider_accepted', 'delivered', 'deferred',
        'bounced', 'complained', 'rejected', 'failed', 'unknown'
      ))
);
CREATE UNIQUE INDEX "EmailDelivery_deliveryId_key" ON "EmailDelivery"("deliveryId");
CREATE UNIQUE INDEX "EmailDelivery_userId_id_key" ON "EmailDelivery"("userId", "id");
CREATE UNIQUE INDEX "EmailDelivery_provider_providerMessageId_key" ON "EmailDelivery"("provider", "providerMessageId");
CREATE INDEX "EmailDelivery_userId_createdAt_idx" ON "EmailDelivery"("userId", "createdAt");
CREATE INDEX "EmailDelivery_userId_currentStatus_idx" ON "EmailDelivery"("userId", "currentStatus");
CREATE INDEX "EmailDelivery_userId_sourceType_createdAt_idx" ON "EmailDelivery"("userId", "sourceType", "createdAt");
CREATE INDEX "EmailDelivery_userId_broadcastRecipientId_idx" ON "EmailDelivery"("userId", "broadcastRecipientId");
CREATE INDEX "EmailDelivery_userId_emailMessageId_idx" ON "EmailDelivery"("userId", "emailMessageId");

-- BLOCKER #4 — PARTIAL UNIQUE INDEXES for source-correlation deduplication.
-- At most ONE EmailDelivery row per (userId, emailMessageId) when non-null.
-- Multiple rows with NULL emailMessageId / broadcastRecipientId are allowed
-- (Postgres treats NULLs as distinct under UNIQUE). The WHERE clause makes
-- the index partial — it does not bloat with NULL-only rows.
CREATE UNIQUE INDEX "EmailDelivery_userId_emailMessageId_uniq"
  ON "EmailDelivery"("userId", "emailMessageId")
  WHERE "emailMessageId" IS NOT NULL;
CREATE UNIQUE INDEX "EmailDelivery_userId_broadcastRecipientId_uniq"
  ON "EmailDelivery"("userId", "broadcastRecipientId")
  WHERE "broadcastRecipientId" IS NOT NULL;

ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BLOCKER #4 — Composite FK to EmailMessage(userId, messageId).
-- EmailMessage.messageId is already globally @unique, but PostgreSQL requires
-- the EXACT referenced tuple to be unique for a composite FK. This redundant
-- composite unique index satisfies that requirement.
CREATE UNIQUE INDEX "EmailMessage_userId_messageId_key" ON "EmailMessage"("userId", "messageId");
ALTER TABLE "EmailDelivery"
  ADD CONSTRAINT "EmailDelivery_emOwnerUserId_emailMessageId_fkey"
  FOREIGN KEY ("emailMessageOwnerUserId", "emailMessageId")
  REFERENCES "EmailMessage"("userId", "messageId")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- BLOCKER #4 — Composite FK to BroadcastRecipient(userId, id).
-- BroadcastRecipient already has @@unique([userId, id]) — the target tuple
-- is unique, so no extra index is needed.
ALTER TABLE "EmailDelivery"
  ADD CONSTRAINT "EmailDelivery_brOwnerUserId_broadcastRecipientId_fkey"
  FOREIGN KEY ("broadcastRecipientOwnerUserId", "broadcastRecipientId")
  REFERENCES "BroadcastRecipient"("userId", "id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EmailDeliveryEvent" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "deliveryId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    -- BLOCKER #5: providerEventId NOT NULL. Deduplication requires every event
    -- to have a provider-assigned identifier.
    "providerEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "safeMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailDeliveryEvent_pkey" PRIMARY KEY ("id"),
    -- BLOCKER #5 — CHECK constraint on event type.
    CONSTRAINT "EmailDeliveryEvent_type_check"
      CHECK ("type" IN ('accepted', 'delivered', 'deferred', 'bounced', 'complained', 'rejected'))
);
CREATE UNIQUE INDEX "EmailDeliveryEvent_eventId_key" ON "EmailDeliveryEvent"("eventId");
CREATE UNIQUE INDEX "EmailDeliveryEvent_provider_providerEventId_key" ON "EmailDeliveryEvent"("provider", "providerEventId");
CREATE INDEX "EmailDeliveryEvent_userId_deliveryId_occurredAt_idx" ON "EmailDeliveryEvent"("userId", "deliveryId", "occurredAt");
CREATE INDEX "EmailDeliveryEvent_userId_type_createdAt_idx" ON "EmailDeliveryEvent"("userId", "type", "createdAt");
ALTER TABLE "EmailDeliveryEvent" ADD CONSTRAINT "EmailDeliveryEvent_userId_deliveryId_fkey" FOREIGN KEY ("userId", "deliveryId") REFERENCES "EmailDelivery"("userId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
