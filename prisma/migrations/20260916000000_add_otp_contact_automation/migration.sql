-- CreateTable
CREATE TABLE "JobQueue" (
    "id" SERIAL NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "JobQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationSetting" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "templateId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobQueue_jobId_key" ON "JobQueue"("jobId");

-- CreateIndex
CREATE INDEX "JobQueue_status_availableAt_idx" ON "JobQueue"("status", "availableAt");

-- CreateIndex
CREATE INDEX "JobQueue_userId_createdAt_idx" ON "JobQueue"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobQueue_userId_type_dedupeKey_key" ON "JobQueue"("userId", "type", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationSetting_userId_type_key" ON "AutomationSetting"("userId", "type");

-- AddForeignKey
ALTER TABLE "JobQueue" ADD CONSTRAINT "JobQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationSetting" ADD CONSTRAINT "AutomationSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationSetting" ADD CONSTRAINT "AutomationSetting_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TransactionalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
