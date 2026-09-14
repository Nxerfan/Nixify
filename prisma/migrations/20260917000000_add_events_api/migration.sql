-- CreateTable
CREATE TABLE "InboundEvent" (
    "id" SERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "contactId" INTEGER,
    "type" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'api_v1',
    "requestId" TEXT,
    "idempotencyKeyHash" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundEvent_eventId_key" ON "InboundEvent"("eventId");

-- CreateIndex
CREATE INDEX "InboundEvent_userId_createdAt_idx" ON "InboundEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "InboundEvent_userId_type_createdAt_idx" ON "InboundEvent"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "InboundEvent_userId_email_createdAt_idx" ON "InboundEvent"("userId", "email", "createdAt");

-- CreateIndex
CREATE INDEX "InboundEvent_userId_environment_createdAt_idx" ON "InboundEvent"("userId", "environment", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEvent_userId_idempotencyKeyHash_key" ON "InboundEvent"("userId", "idempotencyKeyHash");

-- AddForeignKey
ALTER TABLE "InboundEvent" ADD CONSTRAINT "InboundEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEvent" ADD CONSTRAINT "InboundEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
