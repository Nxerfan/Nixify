/**
 * Account deletion service.
 *
 * Safely deletes a user account and ALL tenant-owned data in a transaction.
 *
 * Security contract:
 *   - Requires recent email re-verification (OTP purpose = "account_deletion")
 *   - The OTP must be consumed (single-use) before deletion proceeds
 *   - Session is invalidated after deletion
 *   - API keys are revoked and deleted before user deletion
 *
 * Deletion order (within a Prisma transaction):
 *   1. Delete child audit/event rows that have FK constraints
 *   2. Delete suppression entries (after their events)
 *   3. Revoke + delete API keys (destroy secrets)
 *   4. Delete webhook endpoints (cascade deliveries + queue)
 *   5. Delete remaining tenant-owned rows with nullable userId
 *   6. Delete the User (cascades to all required-FK models)
 *
 * Models deleted explicitly (not relying on cascade):
 *   - OtpEvent (userId nullable, no cascade from User)
 *   - SuppressionEvent (composite FK to SuppressionEntry, Restrict)
 *   - SuppressionEntry (userId required, but Restrict from SuppressionEvent)
 *   - ConsentMutationIdempotency (userId required, no cascade)
 *   - ApiKey (userId nullable → would SetNull, but we want DELETE)
 *   - WebhookEndpoint (userId nullable → would SetNull, but we want DELETE)
 *   - RequestLog (userId nullable → we DELETE to honor "all data deleted")
 *   - EmailTheme (userId nullable → we DELETE user-owned themes)
 */

import { db } from "@/lib/db";
import { consumeOtp } from "@/lib/otp/verifier";
import type { OtpPurpose } from "@/lib/otp/generator";

/**
 * Verify the account-deletion OTP code.
 * Returns { verified: true } if the code is valid, recent, and single-use consumed.
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
      // 1. Delete OtpEvent rows owned by this user
      await tx.otpEvent.deleteMany({ where: { userId } });

      // 2. Delete ConsentMutationIdempotency rows
      await tx.consentMutationIdempotency.deleteMany({ where: { userId } });

      // 3. Delete SuppressionEvent rows (must be before SuppressionEntry)
      await tx.suppressionEvent.deleteMany({ where: { userId } });

      // 4. Delete SuppressionEntry rows (now safe — no Restrict FKs remain)
      await tx.suppressionEntry.deleteMany({ where: { userId } });

      // 5. Revoke all API keys (mark as revoked before deletion)
      await tx.apiKey.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // 6. Delete all API keys (destroy the secrets)
      await tx.apiKey.deleteMany({ where: { userId } });

      // 7. Delete webhook endpoints (cascade deliveries + queue)
      await tx.webhookEndpoint.deleteMany({ where: { userId } });

      // 8. Delete RequestLog rows (would otherwise be SetNull)
      await tx.requestLog.deleteMany({ where: { userId } });

      // 9. Delete user-owned EmailTheme rows (would otherwise be SetNull)
      await tx.emailTheme.deleteMany({ where: { userId } });

      // 10. Delete the user — cascades to all required-FK models:
      //     Contact, ContactEvent, Group, ContactGroupMembership,
      //     ContactImport, ContactImportRow, ContactConsentEvent,
      //     Broadcast, BroadcastRecipient, BroadcastMutationIdempotency,
      //     EmailMessage, EmailDelivery, EmailDeliveryEvent,
      //     JobQueue, AutomationSetting, InboundEvent, UsageTracking,
      //     BrandKit, OtpCode
      await tx.user.delete({ where: { id: userId } });
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: `Account deletion failed: ${message}` };
  }
}
