-- Additive migration: add firstName and lastName to User
-- Existing fullName is preserved (no destructive change)
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

-- Update OtpCode FK from SET NULL to CASCADE
ALTER TABLE "OtpCode" DROP CONSTRAINT IF EXISTS "OtpCode_userId_fkey";
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update Contact FK from RESTRICT to CASCADE
ALTER TABLE "Contact" DROP CONSTRAINT IF EXISTS "Contact_userId_fkey";
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update TransactionalTemplate FK from RESTRICT to CASCADE
ALTER TABLE "TransactionalTemplate" DROP CONSTRAINT IF EXISTS "TransactionalTemplate_userId_fkey";
ALTER TABLE "TransactionalTemplate" ADD CONSTRAINT "TransactionalTemplate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update EmailMessage FK from RESTRICT to CASCADE
ALTER TABLE "EmailMessage" DROP CONSTRAINT IF EXISTS "EmailMessage_userId_fkey";
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update JobQueue FK from RESTRICT to CASCADE
ALTER TABLE "JobQueue" DROP CONSTRAINT IF EXISTS "JobQueue_userId_fkey";
ALTER TABLE "JobQueue" ADD CONSTRAINT "JobQueue_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update AutomationSetting FK from RESTRICT to CASCADE
ALTER TABLE "AutomationSetting" DROP CONSTRAINT IF EXISTS "AutomationSetting_userId_fkey";
ALTER TABLE "AutomationSetting" ADD CONSTRAINT "AutomationSetting_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update InboundEvent FK from RESTRICT to CASCADE
ALTER TABLE "InboundEvent" DROP CONSTRAINT IF EXISTS "InboundEvent_userId_fkey";
ALTER TABLE "InboundEvent" ADD CONSTRAINT "InboundEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update UsageTracking FK (may not exist in CI — add if not present)
ALTER TABLE "UsageTracking" DROP CONSTRAINT IF EXISTS "UsageTracking_userId_fkey";
ALTER TABLE "UsageTracking" ADD CONSTRAINT "UsageTracking_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update BrandKit FK (may not exist in CI — add if not present)
ALTER TABLE "BrandKit" DROP CONSTRAINT IF EXISTS "BrandKit_userId_fkey";
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add onDelete: SetNull to ApiKey (nullable FK — orphaned records get null userId)
ALTER TABLE "ApiKey" DROP CONSTRAINT IF EXISTS "ApiKey_userId_fkey";
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add onDelete: SetNull to WebhookEndpoint
ALTER TABLE "WebhookEndpoint" DROP CONSTRAINT IF EXISTS "WebhookEndpoint_userId_fkey";
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add onDelete: SetNull to RequestLog
ALTER TABLE "RequestLog" DROP CONSTRAINT IF EXISTS "RequestLog_userId_fkey";
ALTER TABLE "RequestLog" ADD CONSTRAINT "RequestLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add onDelete: SetNull to EmailTheme
ALTER TABLE "EmailTheme" DROP CONSTRAINT IF EXISTS "EmailTheme_userId_fkey";
ALTER TABLE "EmailTheme" ADD CONSTRAINT "EmailTheme_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add onDelete: Cascade to WebhookDelivery.endpointId
ALTER TABLE "WebhookDelivery" DROP CONSTRAINT IF EXISTS "WebhookDelivery_endpointId_fkey";
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey"
  FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
