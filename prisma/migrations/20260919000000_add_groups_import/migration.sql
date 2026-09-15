-- Phase 8: Groups & Contact Import
-- Additive migration: new tables + indexes + foreign keys. No destructive operations.

-- CreateTable: Group
CREATE TABLE "Group" (
    "id" SERIAL NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_groupId_key" ON "Group"("groupId");
CREATE INDEX "Group_userId_updatedAt_idx" ON "Group"("userId", "updatedAt");
CREATE UNIQUE INDEX "Group_userId_normalizedName_key" ON "Group"("userId", "normalizedName");

-- AddForeignKey: Group → User
ALTER TABLE "Group" ADD CONSTRAINT "Group_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ContactGroupMembership
CREATE TABLE "ContactGroupMembership" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "contactId" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactGroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactGroupMembership_groupId_contactId_key" ON "ContactGroupMembership"("groupId", "contactId");
CREATE INDEX "ContactGroupMembership_userId_groupId_idx" ON "ContactGroupMembership"("userId", "groupId");
CREATE INDEX "ContactGroupMembership_userId_contactId_idx" ON "ContactGroupMembership"("userId", "contactId");

-- AddForeignKey: ContactGroupMembership → Group (composite: userId + groupId)
ALTER TABLE "ContactGroupMembership" ADD CONSTRAINT "ContactGroupMembership_userId_groupId_fkey" FOREIGN KEY ("userId", "groupId") REFERENCES "Group"("userId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ContactGroupMembership → Contact (composite: userId + contactId)
ALTER TABLE "ContactGroupMembership" ADD CONSTRAINT "ContactGroupMembership_userId_contactId_fkey" FOREIGN KEY ("userId", "contactId") REFERENCES "Contact"("userId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ContactImport
CREATE TABLE "ContactImport" (
    "id" SERIAL NOT NULL,
    "importId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "originalFilename" TEXT,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'parsing',
    "targetGroupId" INTEGER,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "existingRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    CONSTRAINT "ContactImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactImport_importId_key" ON "ContactImport"("importId");
CREATE INDEX "ContactImport_userId_createdAt_idx" ON "ContactImport"("userId", "createdAt");
CREATE INDEX "ContactImport_status_createdAt_idx" ON "ContactImport"("status", "createdAt");

-- AddForeignKey: ContactImport → User
ALTER TABLE "ContactImport" ADD CONSTRAINT "ContactImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ContactImport → Group (composite: userId + targetGroupId, ON DELETE SET NULL)
ALTER TABLE "ContactImport" ADD CONSTRAINT "ContactImport_userId_targetGroupId_fkey" FOREIGN KEY ("userId", "targetGroupId") REFERENCES "Group"("userId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: ContactImportRow
CREATE TABLE "ContactImportRow" (
    "id" SERIAL NOT NULL,
    "importId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "attributes" JSONB,
    "status" TEXT NOT NULL DEFAULT 'staged',
    "errorCode" TEXT,
    CONSTRAINT "ContactImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactImportRow_importId_rowNumber_idx" ON "ContactImportRow"("importId", "rowNumber");
CREATE INDEX "ContactImportRow_importId_status_idx" ON "ContactImportRow"("importId", "status");
CREATE INDEX "ContactImportRow_userId_email_idx" ON "ContactImportRow"("userId", "email");

-- AddForeignKey: ContactImportRow → ContactImport
ALTER TABLE "ContactImportRow" ADD CONSTRAINT "ContactImportRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ContactImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 8 (revised): Add composite unique constraints for Prisma composite FK references.
-- These are needed so Prisma can reference (userId, id) on Group and Contact.
CREATE UNIQUE INDEX "Group_userId_id_key" ON "Group"("userId", "id");
CREATE UNIQUE INDEX "Contact_userId_id_key" ON "Contact"("userId", "id");
