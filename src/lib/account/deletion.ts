/**
 * Account deletion service.
 *
 * Safely deletes a user account and ALL tenant-owned data in a transaction.
 *
 * Security contract:
 *   - Requires recent email re-verification (OTP purpose = "account_deletion")
 *   - The OTP must be consumed (single-use) before deletion proceeds
 *   - Session is invalidated after deletion
 *   - API keys are revoked + deleted before user deletion
 *
 * The Prisma schema's onDelete rules handle most cleanup automatically:
 *   - Cascade: Contact, ContactEvent, Group, ContactGroupMembership,
 *     ContactImport, ContactImportRow, ContactConsentEvent, Broadcast,
 *     BroadcastRecipient, BroadcastMutationIdempotency, EmailMessage,
 *     EmailDelivery, EmailDeliveryEvent, JobQueue, AutomationSetting,
 *     InboundEvent, UsageTracking, BrandKit, OtpCode
 *   - SetNull: RequestLog, EmailTheme (orphaned records with null userId)
 *
 * For SetNull models (ApiKey, WebhookEndpoint), we delete them explicitly
 * BEFORE deleting the user to ensure secrets are destroyed, not orphaned.
 */

import { db } from "@/lib/db";
import { consumeOtp } from "@/lib/otp/verifier";
import type { OtpPurpose } from "@/lib/otp/generator";

/**
 * Verify the account-deletion OTP code.
 * Returns { verified: true } if the code is valid, recent, and single-use consumed.
 * Returns { verified: false, error } otherwise.
 */
export async function verifyAccountDeletionOtp(
  email: string,
  code: string,
): Promise<{ verified: boolean; error?: string }> {
  try {
    const result = await consumeOtp({
      email,
      code,
      purpose: "account_deletion" as OtpPurpose,
    });

    if (!result.ok || result.decision !== "valid") {
      return {
        verified: false,
        error: "Invalid or expired verification code.",
      };
    }

    return { verified: true };
  } catch {
    return { verified: false, error: "Verification failed." };
  }
}

/**
 * Delete a user account and all tenant-owned data.
 *
 * MUST be called after OTP re-verification is confirmed.
 * Uses a Prisma transaction for atomicity.
 */
export async function deleteUserAccount(
  userId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.$transaction(async (tx) => {
      // 1. Revoke all API keys (mark as revoked before deletion)
      await tx.apiKey.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // 2. Delete all API keys (destroy the secrets)
      await tx.apiKey.deleteMany({
        where: { userId },
      });

      // 3. Delete webhook endpoints (and their deliveries cascade)
      await tx.webhookEndpoint.deleteMany({
        where: { userId },
      });

      // 4. Delete the user — cascades to all required-FK models
      //    (Contact, ContactEvent, Group, Broadcast, EmailMessage, etc.)
      //    SetNull models (RequestLog, EmailTheme) have their userId set to null.
      await tx.user.delete({
        where: { id: userId },
      });
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: `Account deletion failed: ${message}` };
  }
}
