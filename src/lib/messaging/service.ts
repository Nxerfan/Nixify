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
  DELIVERY_STATUSES,
  type DeliveryTransitionResult,
} from "@/lib/deliverability/service";
import { __getDeliverabilityTestFault } from "@/lib/deliverability/test-fault";

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

  // Phase A: Provider call (separate catch scope — BLOCKER #2).
  // Only actual provider/network errors reach this catch. Post-provider
  // DB persistence failures are handled separately below.
  let providerResult;
  try {
    providerResult = await provider.send({
      to: toEmail,
      subject: rendered.subject,
      html: finalHtml,
      text: rendered.text,
    });
  } catch (err) {
    // The provider threw BEFORE any acceptance. The email was not sent.
    let errorCode = "provider_error";
    let errorMessage = "Provider delivery failed.";
    if (err instanceof ProviderError) {
      errorCode = err.classification;
      errorMessage = err.classification === "configuration_error"
        ? "Email provider configuration error."
        : "Email provider delivery failed.";
    }
    // Phase 11 audit — CAS EVIDENCE (no empty catch):
    // Attempt the queued → failed transition and consume the evidence. If the
    // CAS lost (another worker/webhook advanced the state), do NOT pretend the
    // delivery was marked failed — log the canonical state. If the DB write
    // itself threw, log a safe structured error (no raw DB text) and continue
    // — the EmailMessage is still recorded as failed because the provider
    // threw, but the EmailDelivery row state is observably unknown.
    let deliveryFailEvidence: DeliveryTransitionResult | null = null;
    try {
      deliveryFailEvidence = await markDeliveryFailed(req.userId, delivery.id, errorCode);
    } catch (dbErr) {
      // Safe structured logging — no raw DB error text, no swallow.
      console.error("[messaging] safe_error_code: delivery_mark_failed_error", {
        deliveryId: delivery.id,
        errorCode,
      });
    }
    if (deliveryFailEvidence && !deliveryFailEvidence.changed) {
      // CAS lost — another worker/webhook already advanced the delivery.
      // Do NOT overwrite. Log the canonical state for observability.
      console.error("[messaging] safe_error_code: delivery_cas_lost", {
        deliveryId: delivery.id,
        canonicalStatus: deliveryFailEvidence.currentStatus,
      });
    }
    await db.emailMessage.update({
      where: { id: messageRow.id },
      data: { status: "failed", failedAt: new Date(), errorCode, errorMessage },
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

  // Phase B: Post-provider DB persistence (provider ALREADY returned — may be
  // accepted OR rejected). Any DB failure here is persistence ambiguity, NOT a
  // provider failure. The provider side effect is known/possibly committed —
  // do NOT resend.
  let deliveryTransition: DeliveryTransitionResult;
  try {
    deliveryTransition = await updateDeliveryAfterProviderSend(req.userId, delivery.id, {
      accepted: providerResult.accepted,
      messageId: providerResult.messageId,
      responseClassification: providerResult.responseClassification,
    });
  } catch (deliveryPersistErr) {
    // Provider returned but DB persistence of the delivery state threw.
    // This is persistence ambiguity — mark the delivery `unknown` (CAS
    // evidence consumed). Do NOT fall through to `failed` (the provider did
    // not throw). The EmailMessage is NOT marked `sent`.
    console.error("[messaging] safe_error_code: delivery_persistence_error", {
      deliveryId: delivery.id,
    });
    let unknownEvidence: DeliveryTransitionResult | null = null;
    try {
      unknownEvidence = await markDeliveryUnknown(req.userId, delivery.id, "persistence_error");
    } catch (dbErr) {
      console.error("[messaging] safe_error_code: mark_unknown_failed", { deliveryId: delivery.id });
    }
    if (unknownEvidence && !unknownEvidence.changed) {
      // CAS lost — a webhook already advanced the delivery. Log canonical state.
      console.error("[messaging] safe_error_code: unknown_cas_lost", {
        deliveryId: delivery.id,
        canonicalStatus: unknownEvidence.currentStatus,
      });
    }
    // EmailMessage stays non-sent. Record it as failed with a safe error code
    // so the caller sees the ambiguous outcome. Do NOT mark `sent`.
    await db.emailMessage.update({
      where: { id: messageRow.id },
      data: {
        status: "failed",
        failedAt: new Date(),
        errorCode: "persistence_error",
        errorMessage: "Delivery outcome unknown — provider returned but persistence failed.",
      },
    });
    return {
      messageId: messageRow.messageId,
      status: "failed",
      replay: false,
      created: true,
      errorCode: "persistence_error",
      errorMessage: "Delivery outcome unknown — provider returned but persistence failed.",
    };
  }

  // Phase 11 audit — accepted=false must NOT be persisted as sent.
  // A resolved provider promise is NOT the same as provider acceptance.
  // The provider returned a normalized rejection (accepted=false) — the
  // EmailDelivery is already `rejected` (via updateDeliveryAfterProviderSend).
  // Record EmailMessage as `rejected` to match. Do NOT enter the exception
  // path (this is a normalized rejection, not an error). No duplicate call.
  if (providerResult.accepted === false) {
    await db.emailMessage.update({
      where: { id: messageRow.id },
      data: {
        status: "rejected",
        failedAt: new Date(),
        provider: providerResult.provider,
        providerMessageId: providerResult.messageId,
        errorCode: providerResult.responseClassification,
        errorMessage: "Provider rejected the message.",
      },
    });
    return {
      messageId: messageRow.messageId,
      status: "rejected",
      replay: false,
      created: true,
      errorCode: providerResult.responseClassification,
      errorMessage: "Provider rejected the message.",
    };
  }

  // accepted=true — provider accepted the envelope. EmailMessage → sent.
  // The EmailDelivery is already `provider_accepted` (or a webhook advanced it
  // — deliveryTransition.changed tells us which).
  if (!deliveryTransition.changed) {
    // CAS lost — a webhook already advanced the delivery past `queued`.
    // Log the canonical state. The EmailMessage can still be marked sent
    // because the provider DID accept.
    console.error("[messaging] safe_error_code: delivery_cas_lost_on_accept", {
      deliveryId: delivery.id,
      canonicalStatus: deliveryTransition.currentStatus,
    });
  }

  // Phase 11 audit — TEST-ONLY fault injection (see test-fault.ts). Fires
  // AFTER provider acceptance + EmailDelivery persistence, but BEFORE the
  // EmailMessage→sent update. Proves idempotent replay does NOT re-call the
  // provider. Structurally unreachable in production (NODE_ENV guard).
  const fault = __getDeliverabilityTestFault();
  if (fault === "post-provider-emailmessage-persist-fail") {
    throw new Error("test fault: post-provider-emailmessage-persist-fail");
  }

  await db.emailMessage.update({
    where: { id: messageRow.id },
    data: {
      status: "sent",
      provider: providerResult.provider,
      providerMessageId: providerResult.messageId,
      sentAt: new Date(),
    },
  });

  // Contact timeline (best-effort telemetry).
  await recordContactEvent(req.userId, toEmail, {
    templateId: detail.id,
    templateVersion: versionRow.version,
    messageId: messageRow.messageId,
  }).catch(() => {
    // Acceptable per reliability protocol §4.1 (telemetry, not correctness).
  });

  return {
    messageId: messageRow.messageId,
    status: "sent",
    replay: false,
    created: true,
  };
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
