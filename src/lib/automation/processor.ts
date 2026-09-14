/**
 * Job processor (Phase 5, sections 4, 7, 8, 10, 11, 12, 13).
 *
 * Processes one orchestration job type: "otp_verified". Executes in order:
 *   1. Upsert Contact (idempotent, preserves existing fields)
 *   2. Write ContactEvent("otp.verified") — idempotent (no duplicates on retry)
 *   3. Inspect automation configuration
 *   4. If enabled + compatible, invoke Phase 4 sendTransactionalEmail
 *   5. Complete the job
 *
 * Failure semantics (section 12):
 *   - OTP verification remains successful regardless of what happens here.
 *   - Contact sync + ContactEvent are idempotent — retries don't duplicate.
 *   - Messaging idempotency (Phase 4) prevents duplicate email delivery on retry.
 *   - Transient failures (provider errors) → retry with backoff.
 *   - Permanent failures (template missing, incompatible vars) → fail job immediately.
 */
import { db } from "@/lib/db";
import { upsertContact, addContactEvent, normalizeEmail } from "@/lib/contacts";
import { sendTransactionalEmail, SmtpEmailProvider, MessagingValidationError, MessagingQuotaError, IdempotencyConflictError } from "@/lib/messaging";
import {
  getAutomationSetting,
  AUTOMATION_TYPE_OTP_VERIFIED_WELCOME,
  BUILT_IN_VARIABLES,
} from "./service";
import {
  completeJob,
  failJob,
  retryJob,
  isTransientError,
  type QueuedJob,
} from "./queue";

// ---- OtpVerified payload ---------------------------------------------------

export interface OtpVerifiedPayload {
  otpCodeId: number;
  userId: number;
  email: string;
  environment: string | null;
  purpose: string;
}

// ---- Process one job -------------------------------------------------------

export async function processOtpVerifiedJob(job: QueuedJob): Promise<void> {
  const payload = job.payload as OtpVerifiedPayload;
  const { userId, email, environment } = payload;

  try {
    // ---- 1. Upsert Contact (idempotent) ----
    // source="otp" for new contacts. Existing contacts are preserved — we
    // do NOT overwrite name, attributes, marketing consent, or source.
    const contactResult = await upsertContactWithRaceHandling(userId, email, "otp");

    // ---- 2. Write ContactEvent("otp.verified") — idempotent ----
    // Durable event idempotency: use the ContactEvent requestId field as a
    // dedupe key (the stable OTP verification identity). If the event already
    // exists (re-execution of the same job), skip — no duplicate.
    await addOtpVerifiedEventIdempotent(
      userId,
      contactResult.contact.id,
      payload.otpCodeId,
      environment,
    );

    // ---- 3. Inspect automation configuration ----
    const setting = await getAutomationSetting(
      userId,
      AUTOMATION_TYPE_OTP_VERIFIED_WELCOME,
    );

    // If automation is missing or disabled → job completes successfully
    // after Contact synchronization. No email sent.
    if (!setting || !setting.enabled) {
      await completeJob(job.jobId);
      return;
    }

    // If no template configured → permanent config failure.
    if (setting.templateId == null) {
      await failJob(job.jobId, "Automation enabled but no template configured.");
      return;
    }

    // If the selected template requires variables the automation cannot
    // provide → permanent config failure (section 11 — do NOT send malformed email).
    if (setting.compatible === false) {
      await failJob(
        job.jobId,
        "Template requires variables the automation cannot provide: " +
          (setting.templateVariables ?? []).join(", "),
      );
      return;
    }

    // ---- 4. Invoke Phase 4 messaging service ----
    // Derive a deterministic idempotency key from the OTP verification identity
    // so retries can't duplicate the email delivery.
    const idempotencyKey = `automation:otp_verified_welcome:${payload.otpCodeId}`;

    // Build the built-in variables. email is always provided. name only if
    // the Contact has a non-empty name.
    const variables: Record<string, unknown> = { email };
    if (contactResult.contact.name && contactResult.contact.name.trim() !== "") {
      variables.name = contactResult.contact.name;
    }

    // Reuse Phase 4's sendTransactionalEmail — it handles template/version
    // resolution, sanitization, subject safety, MESSAGING_EMAILS quota,
    // provider call, EmailMessage persistence, and messaging idempotency.
    const sendResult = await sendTransactionalEmail(
      {
        userId,
        to: email,
        templateSlug: await getTemplateSlug(userId, setting.templateId),
        variables,
        idempotencyKey,
        source: "api_v1", // automation sends through the same path as v1
        environment: environment ?? undefined,
      },
      new SmtpEmailProvider(),
    );

    // The send either succeeded, was a replay (idempotent — no double send),
    // or failed (status=failed/rejected). In all cases, the job completes —
    // Phase 4 messaging idempotency handles retries at the message level.
    if (sendResult.status === "sent" || sendResult.replay) {
      await completeJob(job.jobId);
      return;
    }

    // Send failed — classify the error.
    const errorCode = sendResult.errorCode ?? "provider_error";
    const errorMsg = sendResult.errorMessage ?? "Send failed";

    // Permanent failures (configuration) → fail the job immediately.
    // Transient failures (provider errors) → retry with backoff.
    if (isTransientMessagingError(errorCode)) {
      await retryJob(job.jobId, `Messaging failure: ${errorCode} — ${errorMsg}`);
    } else {
      await failJob(job.jobId, `Messaging permanent failure: ${errorCode} — ${errorMsg}`);
    }
  } catch (err) {
    // Classify the thrown error.
    if (err instanceof MessagingValidationError) {
      // Permanent — validation failures don't retry.
      await failJob(job.jobId, `Validation error: ${err.code} — ${err.message}`);
    } else if (err instanceof MessagingQuotaError) {
      // Quota exhaustion is transient (resets next billing period) → retry.
      await retryJob(job.jobId, `Quota exhausted: ${err.code} — ${err.message}`);
    } else if (err instanceof IdempotencyConflictError) {
      // Same idempotency key with different body — permanent config issue.
      await failJob(job.jobId, "Idempotency conflict — automation config changed mid-flight.");
    } else if (isTransientError(err)) {
      await retryJob(job.jobId, err instanceof Error ? err.message : "Transient processing error");
    } else {
      await failJob(job.jobId, err instanceof Error ? err.message : "Permanent failure");
    }
  }
}

// ---- Helpers ---------------------------------------------------------------

/**
 * Upsert Contact with P2002 race handling (section 7).
 * If the unique constraint fires (concurrent creation), fetch the existing
 * Contact and return it — do NOT fail the job.
 */
async function upsertContactWithRaceHandling(
  userId: number,
  email: string,
  source: string,
) {
  try {
    return await upsertContact(userId, { email, source: source as any });
  } catch (e: any) {
    if (e?.code === "P2002") {
      // Concurrent creation — fetch the existing contact.
      const existing = await db.contact.findUnique({
        where: { userId_email: { userId, email: normalizeEmail(email) } },
      });
      if (existing) {
        return {
          contact: {
            id: existing.id,
            userId: existing.userId,
            email: existing.email,
            name: existing.name,
            attributes: existing.attributes,
            source: existing.source,
            marketingStatus: existing.marketingStatus,
            marketingConsentSource: existing.marketingConsentSource,
            marketingConsentAt: existing.marketingConsentAt,
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt,
          },
          created: false,
          changed: false,
        };
      }
    }
    throw e;
  }
}

/**
 * Add ContactEvent("otp.verified") idempotently (section 8).
 * Durable event idempotency: use the OTP code id as the requestId correlation.
 * If an event with the same requestId already exists, skip — no duplicate.
 */
async function addOtpVerifiedEventIdempotent(
  userId: number,
  contactId: number,
  otpCodeId: number,
  environment: string | null,
): Promise<void> {
  const requestId = `otp_verified:${otpCodeId}`;
  // Check if the event already exists (idempotent on retry).
  const existing = await db.contactEvent.findFirst({
    where: { contactId, type: "otp.verified", requestId },
    select: { id: true },
  });
  if (existing) return; // already written — no duplicate

  await addContactEvent(userId, contactId, "otp.verified", { environment }, requestId);
}

/** Resolve the slug for a template by id (tenant-scoped). */
async function getTemplateSlug(userId: number, templateId: number): Promise<string> {
  const tmpl = await db.transactionalTemplate.findFirst({
    where: { id: templateId, userId },
    select: { slug: true },
  });
  if (!tmpl) throw new Error("template_not_found");
  return tmpl.slug;
}

/** Classify a messaging error code as transient or permanent. */
function isTransientMessagingError(errorCode: string): boolean {
  // provider_error → transient (retry). configuration_error → permanent.
  // quota_exhausted → transient (resets next period). rate_limited → transient.
  if (errorCode === "provider_error") return true;
  if (errorCode === "quota_exhausted") return true;
  if (errorCode === "rate_limited") return true;
  // configuration_error, validation_failed, missing_template_variables,
  // invalid_subject, template_not_found → permanent.
  return false;
}
