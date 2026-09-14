-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" SERIAL NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "templateId" INTEGER,
    "templateVersion" INTEGER,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "source" TEXT NOT NULL,
    "environment" TEXT,
    "requestId" TEXT,
    "idempotencyKeyHash" TEXT,
    "requestFingerprint" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_messageId_key" ON "EmailMessage"("messageId");

-- CreateIndex
CREATE INDEX "EmailMessage_userId_createdAt_idx" ON "EmailMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailMessage_userId_status_createdAt_idx" ON "EmailMessage"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "EmailMessage_toEmail_createdAt_idx" ON "EmailMessage"("toEmail", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_userId_idempotencyKeyHash_key" ON "EmailMessage"("userId", "idempotencyKeyHash");

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TransactionalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
