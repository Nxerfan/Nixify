/**
 * Job processor (Phase 5, sections 4, 7, 8, 10, 11, 12, 13).
 *
 * Processes one orchestration job type: "otp_verified". Executes in order:
 *   1. Check CONTACTS entitlement → if denied, skip Contact sync + event + automation
 *   2. Find-or-create Contact (idempotent, preserves existing fields)
 *   3. Write ContactEvent("otp.verified") — DB-enforced idempotent via dedupeKey unique constraint
 *   4. Check AUTOMATIONS entitlement → if denied, complete job (no send)
 *   5. Check environment safety → if dev OTP in production, complete job (no send)
 *   6. Inspect automation configuration
 *   7. If enabled + compatible, invoke Phase 4 sendTransactionalEmail
 *   8. Complete the job
 *
 * Failure semantics:
 *   - OTP verification remains successful regardless of what happens here.
 *   - Contact sync + ContactEvent are idempotent — retries don't duplicate.
 *   - Messaging idempotency (Phase 4) prevents duplicate email delivery on retry.
 *   - Transient failures (provider errors) → retry with backoff.
 *   - Permanent failures (template missing, incompatible vars) → fail job immediately.
 *   - All persisted errors are safe classifications — raw exception text NEVER stored.
 */
import { db } from "@/lib/db";
import { addContactEvent, normalizeEmail } from "@/lib/contacts";
import { sendTransactionalEmail, SmtpEmailProvider, MessagingValidationError, MessagingQuotaError, IdempotencyConflictError } from "@/lib/messaging";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
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
  classifyError,
  safeErrorForPersistence,
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
    // ---- 1. Check CONTACTS entitlement (non-consuming) ----
    // If Contacts access is unavailable, skip Contact sync + event + automation
    // entirely. OTP remains successful. Job completes safely.
    const contactsAccess = await canAccess(userId, FEATURE_KEYS.CONTACTS);
    if (!contactsAccess.allowed) {
      // No Contact, no ContactEvent, no welcome automation. Safe completion.
      await completeJob(job.jobId);
      return;
    }

    // ---- 2. Find-or-create Contact (idempotent, preserves existing fields) ----
    const contactResult = await findOrCreateContact(userId, email);

    // ---- 3. Write ContactEvent("otp.verified") — DB-enforced idempotent ----
    // Uses a unique dedupeKey column. P2002 means the event already exists.
    await addOtpVerifiedEventIdempotent(
      userId,
      contactResult.contact.id,
      payload.otpCodeId,
      environment,
    );

    // ---- 4. Check AUTOMATIONS entitlement at execution time (non-consuming) ----
    // A user may have enabled automation and later lost/downgraded the entitlement.
    const automationsAccess = await canAccess(userId, FEATURE_KEYS.AUTOMATIONS);
    if (!automationsAccess.allowed) {
      // No send, no MESSAGING_EMAILS consumption. Contact sync + event remain.
      await completeJob(job.jobId);
      return;
    }

    // ---- 5. Environment safety (section 1 of the fix spec) ----
    // In production, a development/test OTP must NEVER cause a real internet email.
    // environment === null (legacy/web-auth) is preserved as-is (allowed).
    if (
      process.env.NODE_ENV === "production" &&
      environment === "development"
    ) {
      // Contact sync + ContactEvent already done (permitted). No send.
      // Do NOT call sendTransactionalEmail, do NOT instantiate SmtpEmailProvider,
      // do NOT create an EmailMessage, do NOT consume MESSAGING_EMAILS.
      await completeJob(job.jobId);
      return;
    }

    // ---- 6. Inspect automation configuration ----
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
      await failJob(job.jobId, "configuration_error [automation enabled but no template configured]");
      return;
    }

    // If the selected template requires variables the automation cannot
    // provide → permanent config failure (do NOT send malformed email).
    if (setting.compatible === false) {
      await failJob(
        job.jobId,
        "automation_incompatible [template requires variables the automation cannot provide]",
      );
      return;
    }

    // ---- 7. Invoke Phase 4 messaging service ----
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
        source: "api_v1",
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

    // Send failed — classify the error using safe classifications.
    const errorCode = sendResult.errorCode ?? "provider_error";
    const safeError = safeErrorForPersistence(new Error(errorCode), `messaging ${errorCode}`);

    // Permanent failures (configuration) → fail the job immediately.
    // Transient failures (provider errors) → retry with backoff.
    if (isTransientMessagingError(errorCode)) {
      await retryJob(job.jobId, safeError);
    } else {
      await failJob(job.jobId, safeError);
    }
  } catch (err) {
    // Classify the thrown error using safe classifications — NEVER persist raw text.
    const safe = safeErrorForPersistence(err, "processor");
    const transient = isTransientError(err);

    if (err instanceof MessagingValidationError) {
      // Permanent — validation failures don't retry.
      await failJob(job.jobId, `validation_error [${err.code}]`);
    } else if (err instanceof MessagingQuotaError) {
      // Quota exhaustion is transient (resets next billing period) → retry.
      await retryJob(job.jobId, `quota_exhausted [${err.code}]`);
    } else if (err instanceof IdempotencyConflictError) {
      // Same idempotency key with different body — permanent config issue.
      await failJob(job.jobId, "configuration_error [idempotency conflict]");
    } else if (transient) {
      await retryJob(job.jobId, safe);
    } else {
      await failJob(job.jobId, safe);
    }
  }
}

// ---- Helpers ---------------------------------------------------------------

/**
 * Find or create a Contact (section 7).
 * If the Contact already exists, reuse it WITHOUT modifying any fields —
 * do NOT erase name, do NOT overwrite attributes, do NOT alter marketing
 * consent, do NOT change source.
 *
 * If absent, create a new Contact with source="otp".
 * Concurrent creation is handled via P2002 → fetch existing.
 */
async function findOrCreateContact(
  userId: number,
  email: string,
) {
  const normalized = normalizeEmail(email);
  const existing = await db.contact.findUnique({
    where: { userId_email: { userId, email: normalized } },
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
  try {
    const created = await db.contact.create({
      data: { userId, email: normalized, source: "otp" },
    });
    return {
      contact: {
        id: created.id,
        userId: created.userId,
        email: created.email,
        name: created.name,
        attributes: created.attributes,
        source: created.source,
        marketingStatus: created.marketingStatus,
        marketingConsentSource: created.marketingConsentSource,
        marketingConsentAt: created.marketingConsentAt,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
      created: true,
      changed: true,
    };
  } catch (e: any) {
    if (e?.code === "P2002") {
      const race = await db.contact.findUnique({
        where: { userId_email: { userId, email: normalized } },
      });
      if (race) {
        return {
          contact: {
            id: race.id,
            userId: race.userId,
            email: race.email,
            name: race.name,
            attributes: race.attributes,
            source: race.source,
            marketingStatus: race.marketingStatus,
            marketingConsentSource: race.marketingConsentSource,
            marketingConsentAt: race.marketingConsentAt,
            createdAt: race.createdAt,
            updatedAt: race.updatedAt,
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
 * Add ContactEvent("otp.verified") with DB-enforced idempotency (section 4 of fix spec).
 *
 * Uses the unique `dedupeKey` column. The insert is atomic — a P2002 unique
 * constraint violation means the event already exists (a stale worker or
 * replacement worker already recorded it). On P2002, treat as already-recorded
 * and continue. NO findFirst existence check before the insert.
 *
 * dedupeKey = "otp_verified:<userId>:<otpCodeId>" — deterministic per OTP verification.
 */
async function addOtpVerifiedEventIdempotent(
  userId: number,
  contactId: number,
  otpCodeId: number,
  environment: string | null,
): Promise<void> {
  const dedupeKey = `otp_verified:${userId}:${otpCodeId}`;
  try {
    // Atomic insert. If a stale/concurrent worker already inserted, P2002 fires.
    await db.contactEvent.create({
      data: {
        contactId,
        type: "otp.verified",
        detail: { environment } as any,
        requestId: `otp_verified:${otpCodeId}`,
        dedupeKey,
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      // Event already recorded by a concurrent/stale worker — idempotent success.
      return;
    }
    throw e;
  }
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
  if (errorCode === "provider_error") return true;
  if (errorCode === "quota_exhausted") return true;
  if (errorCode === "rate_limited") return true;
  return false;
}
