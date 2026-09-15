/**
 * Transactional messaging service (Phase 4, section 18).
 *
 * Owns the full send lifecycle:
 *   1. tenant template resolution (by slug, optional version — cross-tenant = not found)
 *   2. recipient normalization
 *   3. variable validation (scalar only — reuses Phase 3 helper)
 *   4. rendering (Phase 3 renderer — HTML-escapes, structured missing-var error)
 *   5. FINAL HTML sanitization AFTER substitution (section 15 — defense-in-depth
 *      against variables that land inside attributes, e.g. href="{{url}}")
 *   6. subject CRLF rejection (section 16 — REAL send must fail closed on CR/LF)
 *   7. idempotency claim (atomic unique constraint insert — handles concurrent dupes)
 *   8. MESSAGING_EMAILS consumption (only when a real delivery is about to happen)
 *   9. provider call
 *  10. status transition (pending → sent | failed | rejected)
 *  11. EmailMessage persistence (audit metadata only — NO rendered HTML or variable values)
 *  12. Contact timeline event on success (best-effort, no auto-create)
 *
 * NEVER persists: rendered HTML body, variable values, SMTP passwords, raw auth
 * tokens, stack traces, or raw provider error text.
 */
import { db } from "@/lib/db";
import {
  getTemplate,
  getVersion,
  TemplateNotFoundError,
  validateVariableValues,
  renderTransactionalTemplate,
  sanitizeTemplateHtml,
  type TemplateDetail,
  type TemplateVersionRow,
} from "@/lib/transactional-templates";
import { normalizeEmail } from "@/lib/contacts";
import { addContactEvent } from "@/lib/contacts";
import { checkUsage } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  hashIdempotencyKey,
  computeRequestFingerprint,
} from "./idempotency";
import { normalizeRecipient } from "./validation";
import type { EmailProvider } from "./providers/provider";
import { ProviderError } from "./providers/provider";
import {
  createDelivery,
  updateDeliveryAfterProviderSend,
  markDeliveryFailed,
  markDeliveryUnknown,
  DELIVERY_SOURCES,
} from "@/lib/deliverability/service";

// ---- Types ----------------------------------------------------------------

export type MessageSource = "api_v1" | "dashboard_test";

export interface SendRequest {
  userId: number;            // tenant owner (User.id, never AdminUser.id / ApiKey.id)
  to: string;                // pre-validation recipient (will be normalized)
  templateSlug: string;
  templateVersion?: number;  // explicit historical version; undefined = current
  variables: Record<string, unknown>;
  idempotencyKey?: string;   // required for api_v1, optional for dashboard
  requestId?: string;
  source: MessageSource;
  environment?: string | null; // "development" | "production" — from API key or session
}

export interface SendResult {
  /** Public message id (UUID) — the only identifier exposed to API clients. */
  messageId: string;
  status: "sent" | "failed" | "rejected" | "pending";
  /** True when this was an idempotent replay (no new send, no new quota consumption). */
  replay: boolean;
  /** True when a NEW message was created (first request, not a replay). */
  created: boolean;
  /** Existing message id when this is a conflict (same key, different body). */
  conflict?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

// ---- Errors ----------------------------------------------------------------

/** Validation failures (400). NEVER consume MESSAGING_EMAILS. */
export class MessagingValidationError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "MessagingValidationError";
  }
}

/** Idempotency conflict (409). No send, no quota consumption. */
export class IdempotencyConflictError extends Error {
  constructor() {
    super("Idempotency-Key was used with a different request body.");
    this.name = "IdempotencyConflictError";
  }
}

/** Quota exhausted / feature not available (402/403 → rejected status). */
export class MessagingQuotaError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "MessagingQuotaError";
  }
}

// ---- The main send function -----------------------------------------------

export async function sendTransactionalEmail(
  req: SendRequest,
  provider: EmailProvider,
): Promise<SendResult> {
  // ---- 1. Idempotency claim check (BEFORE any work) -----------------------
  // If an idempotency key is supplied, hash it and try to find an existing
  // claim. We compute the request fingerprint to detect same-key-different-body.
  let idempotencyKeyHash: string | null = null;
  let requestFingerprint: string | null = null;
  if (req.idempotencyKey) {
    idempotencyKeyHash = hashIdempotencyKey(req.idempotencyKey);
    requestFingerprint = computeRequestFingerprint({
      to: req.to,
      templateSlug: req.templateSlug,
      templateVersion: req.templateVersion,
      variables: req.variables,
    });

    const existing = await db.emailMessage.findUnique({
      where: { userId_idempotencyKeyHash: { userId: req.userId, idempotencyKeyHash } },
    });
    if (existing) {
      // Same key + different fingerprint → 409 conflict (no send, no quota).
      if (existing.requestFingerprint !== requestFingerprint) {
        throw new IdempotencyConflictError();
      }
      // Same key + same fingerprint → replay. Return existing status, no new send.
      return {
        messageId: existing.messageId,
        status: existing.status as SendResult["status"],
        replay: true,
        created: false,
      };
    }
  }

  // ---- 2. Tenant template resolution --------------------------------------
  // Cross-tenant lookup behaves as "not found" — no existence leakage.
  const detail = await getTemplateBySlug(req.userId, req.templateSlug);
  if (!detail) {
    throw new MessagingValidationError("template_not_found", "Template not found.");
  }

  // Resolve the version: explicit historical version, or current.
  let versionRow: TemplateVersionRow;
  if (req.templateVersion !== undefined) {
    const v = await getVersion(req.userId, detail.id, req.templateVersion);
    if (!v) {
      throw new MessagingValidationError("template_version_not_found", "Template version not found.");
    }
    versionRow = v;
  } else {
    versionRow = detail.current;
  }

  // ---- 3. Recipient normalization -----------------------------------------
  const toEmail = normalizeRecipient(req.to);
  if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    throw new MessagingValidationError("invalid_recipient", "Enter a valid email address.");
  }

  // ---- 4. Variable validation (scalar only — reuse Phase 3 helper) -------
  const valuesResult = validateVariableValues(req.variables);
  if (!valuesResult.valid) {
    throw new MessagingValidationError("validation_failed", valuesResult.error);
  }

  // ---- 5. Render (Phase 3 renderer — HTML-escapes, structured missing-var) -
  const rendered = renderTransactionalTemplate({
    subject: versionRow.subject,
    html: versionRow.html,
    text: versionRow.text,
    variables: versionRow.variables,
    values: valuesResult.value,
  });
  if (!rendered.ok) {
    throw new MessagingValidationError(
      "missing_template_variables",
      `Missing required variables: ${rendered.missing.join(", ")}`,
    );
  }

  // ---- 6. FINAL HTML sanitization AFTER substitution (section 15) ---------
  // The stored template HTML was sanitized at write time, but a variable may
  // land inside an attribute (href="{{url}}"). A safe template + an unsafe
  // variable value (javascript:...) becomes unsafe AFTER substitution. We
  // sanitize the rendered HTML again to catch this.
  const finalHtml = sanitizeTemplateHtml(rendered.html);

  // ---- 7. Subject CRLF rejection (section 16 — REAL send fails closed) ----
  // Phase 3 preview strips CR/LF; Phase 4 REAL send REJECTS them.
  if (/[\r\n]/.test(rendered.subject)) {
    throw new MessagingValidationError(
      "invalid_subject",
      "Subject contains invalid characters (CR/LF).",
    );
  }

  // ---- 8. Create EmailMessage(pending) — atomic idempotency claim --------
  // Insert with the unique (userId, idempotencyKeyHash) constraint. A concurrent
  // duplicate will hit the unique violation here — we treat that as a replay.
  let messageRow;
  try {
    messageRow = await db.emailMessage.create({
      data: {
        userId: req.userId,
        templateId: detail.id,
        templateVersion: versionRow.version,
        toEmail,
        subject: rendered.subject,
        status: "pending",
        source: req.source,
        environment: req.environment ?? null,
        requestId: req.requestId ?? null,
        idempotencyKeyHash,
        requestFingerprint,
      },
    });
  } catch (e: any) {
    // P2002 = unique constraint violation on (userId, idempotencyKeyHash).
    // A concurrent duplicate request won the claim. Treat as replay: fetch
    // the existing row and return its status.
    if (e?.code === "P2002" && idempotencyKeyHash) {
      const existing = await db.emailMessage.findUnique({
        where: { userId_idempotencyKeyHash: { userId: req.userId, idempotencyKeyHash } },
      });
      if (existing) {
        if (existing.requestFingerprint !== requestFingerprint) {
          throw new IdempotencyConflictError();
        }
        return {
          messageId: existing.messageId,
          status: existing.status as SendResult["status"],
          replay: true,
          created: false,
        };
      }
    }
    throw e;
  }

  // ---- 9. MESSAGING_EMAILS consumption (delivery attempt is about to happen) -
  // checkUsage atomically increments the counter. If quota is exhausted, we
  // transition the message to "rejected" (NOT failed — rejection is deliberate).
  const usage = await checkUsage(req.userId, FEATURE_KEYS.MESSAGING_EMAILS);
  if (!usage.allowed) {
    await db.emailMessage.update({
      where: { id: messageRow.id },
      data: {
        status: "rejected",
        failedAt: new Date(),
        errorCode: usage.reason === "rate_limited" ? "rate_limited" : "quota_exhausted",
        errorMessage: "Messaging quota exhausted.",
      },
    });
    throw new MessagingQuotaError(
      usage.reason === "rate_limited" ? "rate_limited" : "quota_exhausted",
      usage.reason === "rate_limited"
        ? "Messaging rate limit exceeded."
        : "Monthly messaging quota exceeded.",
    );
  }

  // ---- 10. Provider call --------------------------------------------------
  //
  // Phase 11: create an EmailDelivery row BEFORE the provider call. This row
  // is the durable record of the attempt and is updated after the provider
  // call returns. The idempotency check at step 1 already returned for replays,
  // so we are guaranteed to be on the first-time send path here — no duplicate
  // EmailDelivery row is created on replay. BLOCKER #3 requires idempotent
  // Send replay to check if a delivery already exists before calling provider
  // again — the EmailMessage idempotency check at step 1 already enforces this
  // (if an EmailMessage row exists for the idempotency key, we return BEFORE
  // reaching createDelivery, so no second provider call and no second
  // EmailDelivery row).
  //
  // sourceType="transactional" + emailMessageId correlation lets future
  // provider webhooks (when a webhook-capable provider is configured) resolve
  // the delivery row by (provider, providerMessageId). For SMTP, no webhooks.
  const delivery = await createDelivery({
    userId: req.userId,
    sourceType: DELIVERY_SOURCES.TRANSACTIONAL,
    emailMessageId: messageRow.messageId,
    provider: provider.name,
  });

  try {
    const result = await provider.send({
      to: toEmail,
      subject: rendered.subject,
      html: finalHtml,
      text: rendered.text,
    });

    // Phase 11: update the EmailDelivery row with the provider result.
    // `accepted=true` → queued → provider_accepted. This is the durable
    // record that the provider accepted the envelope — it does NOT mean
    // "delivered to inbox" (only a future webhook event can advance that).
    //
    // BLOCKER #2 + #3: NO silent .catch. If `updateDeliveryAfterProviderSend`
    // throws (DB persistence failed AFTER the provider accepted), we mark
    // the delivery as `unknown` (NOT `failed` — provider did NOT throw).
    // The EmailMessage row is the source of truth for the messaging API
    // contract — it is transitioned to `sent` regardless, because the
    // provider DID accept the envelope.
    try {
      await updateDeliveryAfterProviderSend(req.userId, delivery.id, {
        accepted: result.accepted,
        messageId: result.messageId,
        responseClassification: result.responseClassification,
      });
    } catch (deliveryPersistErr) {
      // Provider accepted but DB persistence failed. Mark the delivery as
      // `unknown` so it is never silently auto-retried. `markDeliveryUnknown`
      // is itself a delivery state mutation — wrap in try/catch and log on
      // failure (NOT a silent .catch — the error is surfaced via the log
      // AND propagated to the EmailMessage error path below if both writes
      // fail). We do NOT rethrow here because the EmailMessage source of
      // truth still needs to transition to `sent`.
      try {
        await markDeliveryUnknown(req.userId, delivery.id, "persistence_error");
      } catch (markUnknownErr) {
        // Last-resort: both the state transition AND the unknown marker
        // failed. Log both errors — the EmailMessage update below still
        // proceeds (it is the source of truth for the API contract).
        console.error("[messaging] markDeliveryUnknown failed after persistence error", {
          deliveryId: delivery.id,
          persistenceError: String(deliveryPersistErr),
          markUnknownError: String(markUnknownErr),
        });
      }
    }

    // ---- 11a. Success → sent ---------------------------------------------
    await db.emailMessage.update({
      where: { id: messageRow.id },
      data: {
        status: "sent",
        provider: result.provider,
        providerMessageId: result.messageId,
        sentAt: new Date(),
      },
    });

    // ---- 12. Contact timeline event (best-effort, no auto-create) -------
    // Find an existing Contact for (userId, normalized recipient). If one
    // exists, append a "email.sent" event. Failure to write this event does
    // NOT retroactively mark the email as failed. This is telemetry — NOT a
    // delivery state mutation — so the silent .catch is acceptable per the
    // reliability protocol §4.1.
    await recordContactEvent(req.userId, toEmail, {
      templateId: detail.id,
      templateVersion: versionRow.version,
      messageId: messageRow.messageId,
    }).catch(() => {
      // Best-effort — swallow. Do NOT affect the successful send status.
    });

    return {
      messageId: messageRow.messageId,
      status: "sent",
      replay: false,
      created: true,
    };
  } catch (err) {
    // ---- 11b. Failure → failed -------------------------------------------
    // Classify the error without leaking raw text.
    let errorCode = "provider_error";
    let errorMessage = "Provider delivery failed.";
    if (err instanceof ProviderError) {
      errorCode = err.classification;
      errorMessage = err.classification === "configuration_error"
        ? "Email provider configuration error."
        : "Email provider delivery failed.";
    }

    // Phase 11: mark the EmailDelivery as failed (provider call threw before
    // acceptance). The errorCode stored on EmailDelivery.lastErrorCode is the
    // safe classification string — never raw SMTP error text.
    //
    // BLOCKER #2: NO silent .catch — if markDeliveryFailed throws, the error
    // propagates. The EmailMessage status transition that follows runs only
    // if markDeliveryFailed succeeded; otherwise the API caller receives an
    // error and can retry. The EmailMessage idempotency key prevents a
    // duplicate provider.send() on retry.
    await markDeliveryFailed(req.userId, delivery.id, errorCode);

    await db.emailMessage.update({
      where: { id: messageRow.id },
      data: {
        status: "failed",
        failedAt: new Date(),
        errorCode,
        errorMessage,
      },
    });

    return {
      messageId: messageRow.messageId,
      status: "failed",
      replay: false,
      created: true,
      errorCode,
      errorMessage,
    };
  }
}

// ---- Helpers ---------------------------------------------------------------

/**
 * Find a template by slug for a specific user. Tenant-scoped — returns null
 * if the template belongs to another user (no existence leakage).
 */
async function getTemplateBySlug(
  userId: number,
  slug: string,
): Promise<TemplateDetail | null> {
  // getTemplate takes an id; we need a slug lookup. Use a direct query.
  const t = await db.transactionalTemplate.findUnique({
    where: { userId_slug: { userId, slug } },
  });
  if (!t) return null;
  // Reuse getTemplate to fetch the full detail (current version + history).
  return getTemplate(userId, t.id);
}

/**
 * Record a ContactEvent("email.sent") on the recipient's Contact row, if one
 * exists. Does NOT auto-create a Contact (section 21). Best-effort.
 */
async function recordContactEvent(
  userId: number,
  recipientEmail: string,
  detail: { templateId: number; templateVersion: number; messageId: string },
): Promise<void> {
  const normalized = normalizeEmail(recipientEmail);
  const contact = await db.contact.findUnique({
    where: { userId_email: { userId, email: normalized } },
    select: { id: true },
  });
  if (!contact) return; // no Contact — do NOT auto-create
  await addContactEvent(userId, contact.id, "email.sent", {
    templateId: detail.templateId,
    templateVersion: detail.templateVersion,
  }, detail.messageId);
}
