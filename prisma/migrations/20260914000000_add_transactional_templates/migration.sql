-- CreateTable
CREATE TABLE "TransactionalTemplate" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionalTemplateVersion" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT,
    "variables" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionalTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionalTemplate_userId_updatedAt_idx" ON "TransactionalTemplate"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionalTemplate_userId_slug_key" ON "TransactionalTemplate"("userId", "slug");

-- CreateIndex
CREATE INDEX "TransactionalTemplateVersion_templateId_createdAt_idx" ON "TransactionalTemplateVersion"("templateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionalTemplateVersion_templateId_version_key" ON "TransactionalTemplateVersion"("templateId", "version");

-- AddForeignKey
ALTER TABLE "TransactionalTemplate" ADD CONSTRAINT "TransactionalTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionalTemplateVersion" ADD CONSTRAINT "TransactionalTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TransactionalTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
