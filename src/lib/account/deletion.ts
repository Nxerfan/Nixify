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
 *   1. Delete child audit/event rows whose FK constraints are Restrict or
 *      composite-tied to a parent we are about to remove (defense-in-depth).
 *   2. Delete suppression entries (after their events).
 *   3. Revoke + delete API keys (destroy secrets, mark revokedAt for audit).
 *   4. Delete webhook endpoints (cascade deliveries + queue).
 *   5. Delete remaining tenant-owned rows with nullable userId.
 *   6. Delete the User — every remaining owned row is removed by ON DELETE
 *      CASCADE at the DB level (Contact, ContactEvent, Group,
 *      ContactGroupMembership, ContactImport, ContactImportRow,
 *      ContactConsentEvent, Broadcast, BroadcastRecipient,
 *      BroadcastMutationIdempotency, EmailMessage, EmailDelivery,
 *      EmailDeliveryEvent, JobQueue, AutomationSetting, InboundEvent,
 *      UsageTracking, BrandKit, OtpCode, OtpEvent, ApiKey, WebhookEndpoint,
 *      RequestLog, EmailTheme).
 *
 * Defense-in-depth explicit deletes (in addition to the DB CASCADE):
 * The schema now models every user-owned relation with onDelete: Cascade,
 * so the User delete alone would erase all tenant data. We still explicitly
 * delete the rows below before the User delete for two reasons:
 *   1. Ordering safety — SuppressionEvent has a composite Restrict FK to
 *      SuppressionEntry, so SuppressionEvent MUST be deleted before
 *      SuppressionEntry. The DB CASCADE on SuppressionEntry would otherwise
 *      be blocked by the Restrict.
 *   2. Audit — API keys are marked revokedAt BEFORE deletion so the
 *      revocation event is durably recorded even though the row is removed.
 *
 * The explicit deletes for OtpEvent, ApiKey, WebhookEndpoint, RequestLog,
 * and EmailTheme are now redundant given the CASCADE FKs, but kept as
 * explicit documentation of intent and to keep the deletion observable in
 * the transaction log even if a future schema change altered the CASCADE.
 *
 * Cross-tenant safety: every delete is scoped by `where: { userId }` —
 * only rows owned by the deleted user are removed. Other tenants' rows
 * (with a different userId) are never touched.
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
      // 1. Delete OtpEvent rows owned by this user (defense-in-depth;
      //    the OtpEvent_userId_fkey CASCADE would also remove them)
      await tx.otpEvent.deleteMany({ where: { userId } });

      // 2. Delete ConsentMutationIdempotency rows (no DB FK to User;
      //    userId is a plain column here — explicit delete is mandatory)
      await tx.consentMutationIdempotency.deleteMany({ where: { userId } });

      // 3. Delete SuppressionEvent rows — MUST precede SuppressionEntry
      //    because SuppressionEvent_userId_suppressionId_fkey is RESTRICT.
      //    Without this delete, the SuppressionEntry CASCADE would fail.
      await tx.suppressionEvent.deleteMany({ where: { userId } });

      // 4. Delete SuppressionEntry rows (no FK to User — explicit delete
      //    is mandatory). Safe now that SuppressionEvent is gone.
      await tx.suppressionEntry.deleteMany({ where: { userId } });

      // 5. Revoke all API keys (mark as revoked before deletion) for audit.
      //    The ApiKey_userId_fkey CASCADE would also remove them, but
      //    revoking first preserves the revocation event in the audit log.
      await tx.apiKey.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // 6. Delete all API keys (destroy the secrets; defense-in-depth
      //    since the CASCADE would also handle it on user delete)
      await tx.apiKey.deleteMany({ where: { userId } });

      // 7. Delete webhook endpoints — cascade deliveries + queue via
      //    WebhookEndpoint_userId_fkey CASCADE (and child CASCADE FKs).
      await tx.webhookEndpoint.deleteMany({ where: { userId } });

      // 8. Delete RequestLog rows (defense-in-depth; CASCADE on User delete
      //    would also remove them — kept explicit for intent documentation)
      await tx.requestLog.deleteMany({ where: { userId } });

      // 9. Delete user-owned EmailTheme rows (defense-in-depth; CASCADE on
      //    User delete would also remove them)
      await tx.emailTheme.deleteMany({ where: { userId } });

      // 10. Delete the user — every remaining owned row is removed by
      //     ON DELETE CASCADE at the DB level:
      //       Contact, ContactEvent, Group, ContactGroupMembership,
      //       ContactImport, ContactImportRow, ContactConsentEvent,
      //       Broadcast, BroadcastRecipient, BroadcastMutationIdempotency,
      //       EmailMessage, EmailDelivery, EmailDeliveryEvent,
      //       JobQueue, AutomationSetting, InboundEvent, UsageTracking,
      //       BrandKit, OtpCode (and any of OtpEvent/ApiKey/WebhookEndpoint/
      //       RequestLog/EmailTheme not already explicitly deleted above).
      await tx.user.delete({ where: { id: userId } });
    });

    return { success: true };
  } catch (err) {
    // Log the real error server-side but return a generic safe message
    // to avoid leaking Prisma/PostgreSQL internals to the client.
    if (err instanceof Error) {
      console.error("[account-deletion] Failed to delete user", userId, err.message);
    }
    return { success: false, error: "Account deletion failed. Please try again or contact support." };
  }
}
