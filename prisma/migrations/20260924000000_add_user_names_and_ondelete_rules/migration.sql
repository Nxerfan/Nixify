-- Additive migration: add firstName and lastName to User
-- Existing fullName is preserved (no destructive change)
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

-- Add onDelete: Cascade to OtpCode.userId (was implicit Restrict)
ALTER TABLE "OtpCode" DROP CONSTRAINT "OtpCode_userId_fkey";
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Add onDelete: Cascade to Contact.userId (was implicit Restrict)
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_userId_fkey";
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Add onDelete: Cascade to TransactionalTemplate.userId
ALTER TABLE "TransactionalTemplate" DROP CONSTRAINT "TransactionalTemplate_userId_fkey";
ALTER TABLE "TransactionalTemplate" ADD CONSTRAINT "TransactionalTemplate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Add onDelete: Cascade to EmailMessage.userId
ALTER TABLE "EmailMessage" DROP CONSTRAINT "EmailMessage_userId_fkey";
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Add onDelete: Cascade to JobQueue.userId
ALTER TABLE "JobQueue" DROP CONSTRAINT "JobQueue_userId_fkey";
ALTER TABLE "JobQueue" ADD CONSTRAINT "JobQueue_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Add onDelete: Cascade to AutomationSetting.userId
ALTER TABLE "AutomationSetting" DROP CONSTRAINT "AutomationSetting_userId_fkey";
ALTER TABLE "AutomationSetting" ADD CONSTRAINT "AutomationSetting_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Add onDelete: Cascade to InboundEvent.userId
ALTER TABLE "InboundEvent" DROP CONSTRAINT "InboundEvent_userId_fkey";
ALTER TABLE "InboundEvent" ADD CONSTRAINT "InboundEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Add onDelete: Cascade to UsageTracking.userId
ALTER TABLE "UsageTracking" DROP CONSTRAINT "UsageTracking_userId_fkey";
ALTER TABLE "UsageTracking" ADD CONSTRAINT "UsageTracking_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Add onDelete: Cascade to BrandKit.userId
ALTER TABLE "BrandKit" DROP CONSTRAINT "BrandKit_userId_fkey";
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Add onDelete: SetNull to ApiKey.userId (nullable, orphan-safe)
ALTER TABLE "ApiKey" DROP CONSTRAINT "ApiKey_userId_fkey";
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

-- Add onDelete: SetNull to WebhookEndpoint.userId
ALTER TABLE "WebhookEndpoint" DROP CONSTRAINT "WebhookEndpoint_userId_fkey";
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

-- Add onDelete: SetNull to RequestLog.userId
ALTER TABLE "RequestLog" DROP CONSTRAINT "RequestLog_userId_fkey";
ALTER TABLE "RequestLog" ADD CONSTRAINT "RequestLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

-- Add onDelete: SetNull to EmailTheme.userId
ALTER TABLE "EmailTheme" DROP CONSTRAINT "EmailTheme_userId_fkey";
ALTER TABLE "EmailTheme" ADD CONSTRAINT "EmailTheme_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

-- Add onDelete: Cascade to WebhookDelivery.endpointId
ALTER TABLE "WebhookDelivery" DROP CONSTRAINT "WebhookDelivery_endpointId_fkey";
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey"
  FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE;
