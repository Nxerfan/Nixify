-- Phase 11: Provider & Deliverability
CREATE TABLE "EmailDelivery" (
    "id" SERIAL NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "emailMessageId" TEXT,
    "broadcastRecipientId" INTEGER,
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
    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailDelivery_deliveryId_key" ON "EmailDelivery"("deliveryId");
CREATE UNIQUE INDEX "EmailDelivery_userId_id_key" ON "EmailDelivery"("userId", "id");
CREATE UNIQUE INDEX "EmailDelivery_provider_providerMessageId_key" ON "EmailDelivery"("provider", "providerMessageId");
CREATE INDEX "EmailDelivery_userId_createdAt_idx" ON "EmailDelivery"("userId", "createdAt");
CREATE INDEX "EmailDelivery_userId_currentStatus_idx" ON "EmailDelivery"("userId", "currentStatus");
CREATE INDEX "EmailDelivery_userId_sourceType_createdAt_idx" ON "EmailDelivery"("userId", "sourceType", "createdAt");
CREATE INDEX "EmailDelivery_userId_broadcastRecipientId_idx" ON "EmailDelivery"("userId", "broadcastRecipientId");
CREATE INDEX "EmailDelivery_userId_emailMessageId_idx" ON "EmailDelivery"("userId", "emailMessageId");
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EmailDeliveryEvent" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "deliveryId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "safeMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailDeliveryEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailDeliveryEvent_eventId_key" ON "EmailDeliveryEvent"("eventId");
CREATE UNIQUE INDEX "EmailDeliveryEvent_provider_providerEventId_key" ON "EmailDeliveryEvent"("provider", "providerEventId");
CREATE INDEX "EmailDeliveryEvent_userId_deliveryId_occurredAt_idx" ON "EmailDeliveryEvent"("userId", "deliveryId", "occurredAt");
CREATE INDEX "EmailDeliveryEvent_userId_type_createdAt_idx" ON "EmailDeliveryEvent"("userId", "type", "createdAt");
ALTER TABLE "EmailDeliveryEvent" ADD CONSTRAINT "EmailDeliveryEvent_userId_deliveryId_fkey" FOREIGN KEY ("userId", "deliveryId") REFERENCES "EmailDelivery"("userId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
