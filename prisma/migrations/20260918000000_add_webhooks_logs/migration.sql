-- Phase 7: Webhooks & Logs
-- Additive migration: new columns + indexes. No destructive operations.

-- RequestLog: add tenant ownership (userId + environment)
ALTER TABLE "RequestLog" ADD COLUMN "userId" INTEGER;
ALTER TABLE "RequestLog" ADD COLUMN "environment" TEXT;

-- CreateIndex
CREATE INDEX "RequestLog_userId_createdAt_idx" ON "RequestLog"("userId", "createdAt");

-- WebhookDelivery: add public UUID + dedupeKey + replayOfId
ALTER TABLE "WebhookDelivery" ADD COLUMN "deliveryId" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "WebhookDelivery" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "WebhookDelivery" ADD COLUMN "replayOfId" INTEGER;

-- CreateIndex (unique deliveryId)
CREATE UNIQUE INDEX "WebhookDelivery_deliveryId_key" ON "WebhookDelivery"("deliveryId");

-- CreateIndex (dedupeKey — allows NULLs, enforces uniqueness when set)
CREATE UNIQUE INDEX "WebhookDelivery_dedupeKey_key" ON "WebhookDelivery"("dedupeKey");

-- CreateIndex (dedupeKey lookup)
CREATE INDEX "WebhookDelivery_dedupeKey_idx" ON "WebhookDelivery"("dedupeKey");

-- WebhookQueue: add atomic-claim locking fields + safe error + completion timestamps
ALTER TABLE "WebhookQueue" ADD COLUMN "lockedAt" TIMESTAMP(3);
ALTER TABLE "WebhookQueue" ADD COLUMN "lockedBy" TEXT;
ALTER TABLE "WebhookQueue" ADD COLUMN "lastError" TEXT;
ALTER TABLE "WebhookQueue" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "WebhookQueue" ADD COLUMN "failedAt" TIMESTAMP(3);
