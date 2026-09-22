-- Additive migration: add firstName and lastName to User
-- Existing fullName is preserved (no destructive change)
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

-- ============================================================================
-- FK deletion-semantics audit & alignment (BLOCKER 1: schema ↔ migration drift)
-- ============================================================================
-- This migration brings every user-owned FK touched by account deletion
-- into agreement with prisma/schema.prisma. The single source of truth:
--
--   * NOT NULL `userId` (owned row)        → ON DELETE CASCADE
--   * nullable `userId` (NULL = legacy)    → ON DELETE CASCADE
--     (PostgreSQL leaves userId=NULL rows alone; only matching rows are
--      removed — system/legacy rows are preserved, owned rows are erased)
--
-- Schema and migration MUST use the same rule for every FK listed below.
-- Pre-existing FKs (created by earlier migrations) are dropped + re-added
-- so this migration is safe to apply on a database with any prior state.
-- ============================================================================

-- ---- NOT NULL userId models (owned by the user; CASCADE) -------------------

-- OtpCode.userId was created with ON DELETE SET NULL by 0_init.
-- Schema: OtpCode.user onDelete: Cascade → align to CASCADE.
ALTER TABLE "OtpCode" DROP CONSTRAINT IF EXISTS "OtpCode_userId_fkey";
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Contact.userId was RESTRICT (created by 20260913184834_add_contacts).
-- Schema: Contact.user onDelete: Cascade → align to CASCADE.
ALTER TABLE "Contact" DROP CONSTRAINT IF EXISTS "Contact_userId_fkey";
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TransactionalTemplate.userId was RESTRICT (20260914000000).
-- Schema: TransactionalTemplate.user onDelete: Cascade → align to CASCADE.
ALTER TABLE "TransactionalTemplate" DROP CONSTRAINT IF EXISTS "TransactionalTemplate_userId_fkey";
ALTER TABLE "TransactionalTemplate" ADD CONSTRAINT "TransactionalTemplate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EmailMessage.userId was RESTRICT (20260915000000).
-- Schema: EmailMessage.user onDelete: Cascade → align to CASCADE.
ALTER TABLE "EmailMessage" DROP CONSTRAINT IF EXISTS "EmailMessage_userId_fkey";
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- JobQueue.userId was RESTRICT (20260916000000).
-- Schema: JobQueue.user onDelete: Cascade → align to CASCADE.
ALTER TABLE "JobQueue" DROP CONSTRAINT IF EXISTS "JobQueue_userId_fkey";
ALTER TABLE "JobQueue" ADD CONSTRAINT "JobQueue_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AutomationSetting.userId was RESTRICT (20260916000000).
-- Schema: AutomationSetting.user onDelete: Cascade → align to CASCADE.
ALTER TABLE "AutomationSetting" DROP CONSTRAINT IF EXISTS "AutomationSetting_userId_fkey";
ALTER TABLE "AutomationSetting" ADD CONSTRAINT "AutomationSetting_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- InboundEvent.userId was RESTRICT (20260917000000).
-- Schema: InboundEvent.user onDelete: Cascade → align to CASCADE.
ALTER TABLE "InboundEvent" DROP CONSTRAINT IF EXISTS "InboundEvent_userId_fkey";
ALTER TABLE "InboundEvent" ADD CONSTRAINT "InboundEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UsageTracking.userId had NO FK before (0_init did not create one).
-- Schema: UsageTracking.user onDelete: Cascade → create CASCADE FK.
ALTER TABLE "UsageTracking" DROP CONSTRAINT IF EXISTS "UsageTracking_userId_fkey";
ALTER TABLE "UsageTracking" ADD CONSTRAINT "UsageTracking_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BrandKit.userId had NO FK before (0_init did not create one).
-- Schema: BrandKit.user onDelete: Cascade → create CASCADE FK.
ALTER TABLE "BrandKit" DROP CONSTRAINT IF EXISTS "BrandKit_userId_fkey";
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- nullable userId models (NULL = legacy/system; CASCADE on owned rows) --
-- Schema: all five have `User?` with onDelete: Cascade. PostgreSQL's
-- behavior on a nullable FK with CASCADE: rows where userId IS NULL are
-- untouched; rows with a non-null userId are removed when the User is
-- deleted. This matches the ownership contract exactly:
--   - user-owned rows  → erased on account deletion
--   - legacy/system rows (userId = NULL) → preserved
-- ----------------------------------------------------------------------------

-- OtpEvent.userId had NO FK before — schema declares the relation now.
-- Create CASCADE FK to match the schema declaration.
ALTER TABLE "OtpEvent" DROP CONSTRAINT IF EXISTS "OtpEvent_userId_fkey";
ALTER TABLE "OtpEvent" ADD CONSTRAINT "OtpEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ApiKey.userId was created WITHOUT an FK (0_init). An earlier iteration of
-- this migration created it as SET NULL — that diverges from the schema's
-- onDelete: Cascade. Align to CASCADE.
ALTER TABLE "ApiKey" DROP CONSTRAINT IF EXISTS "ApiKey_userId_fkey";
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WebhookEndpoint.userId was created WITHOUT an FK (0_init). An earlier
-- iteration of this migration created it as SET NULL — diverges from the
-- schema's onDelete: Cascade. Align to CASCADE.
ALTER TABLE "WebhookEndpoint" DROP CONSTRAINT IF EXISTS "WebhookEndpoint_userId_fkey";
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RequestLog.userId was created WITHOUT an FK (0_init). An earlier iteration
-- of this migration created it as SET NULL — diverges from the schema's
-- onDelete: Cascade. Align to CASCADE.
ALTER TABLE "RequestLog" DROP CONSTRAINT IF EXISTS "RequestLog_userId_fkey";
ALTER TABLE "RequestLog" ADD CONSTRAINT "RequestLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EmailTheme.userId was created WITHOUT an FK (0_init). An earlier iteration
-- of this migration created it as SET NULL — diverges from the schema's
-- onDelete: Cascade. Align to CASCADE.
ALTER TABLE "EmailTheme" DROP CONSTRAINT IF EXISTS "EmailTheme_userId_fkey";
ALTER TABLE "EmailTheme" ADD CONSTRAINT "EmailTheme_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---- Webhook child cascades (already correct in schema; aligning migration) --

-- WebhookDelivery.endpointId was RESTRICT in 0_init. Schema: Cascade.
ALTER TABLE "WebhookDelivery" DROP CONSTRAINT IF EXISTS "WebhookDelivery_endpointId_fkey";
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey"
  FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WebhookQueue.endpointId was RESTRICT in 0_init. Schema: Cascade.
-- Account deletion cascades WebhookEndpoint → WebhookQueue, so queued
-- jobs are removed when their owning endpoint is deleted.
ALTER TABLE "WebhookQueue" DROP CONSTRAINT IF EXISTS "WebhookQueue_endpointId_fkey";
ALTER TABLE "WebhookQueue" ADD CONSTRAINT "WebhookQueue_endpointId_fkey"
  FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
