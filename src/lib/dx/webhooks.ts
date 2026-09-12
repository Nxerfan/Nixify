import { createHmac } from "crypto";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";

/**
 * Webhook system — signs + delivers event payloads to registered endpoints.
 *
 * Signing: HMAC-SHA256(secret, payload) sent in the `Nixify-Signature`
 * header as `t=<timestamp>,v1=<hex>`. Recipients verify by recomputing the HMAC
 * with their secret and comparing in constant time.
 *
 * Delivery: NON-BLOCKING. The first attempt is made synchronously. If it
 * fails, a WebhookQueue row is created in the database with nextRetryAt set
 * to NOW() + backoff interval. A cron-triggered endpoint
 * (POST /api/webhooks/process-queue) picks up pending jobs every minute and
 * retries them. This survives Vercel serverless instance recycling — no
 * in-memory timers are used.
 *
 * Retry schedule: 10s, 30s, 90s (exponential backoff, capped at 90s).
 * Max retries: derived from the endpoint owner's WEBHOOK_RETRIES entitlement.
 */

export interface WebhookEvent {
  type: string; // "otp.sent", "otp.verified", "otp.failed", "otp.expired"
  requestId: string;
  email: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/** Generate a webhook signing secret (shown once at creation). */
export function generateWebhookSecret(): string {
  return "mg_whsec_" + randomBytes(24).toString("base64url");
}

/** Sign a payload. Returns the header value: `t=<ts>,v1=<hmac>`. */
export function signWebhook(secret: string, payload: string, timestamp: number = Date.now()): string {
  const signedPayload = `${timestamp}.${payload}`;
  const mac = createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

/** Verify a webhook signature (recipient-side). Constant-time compare. */
export function verifyWebhookSignature(
  secret: string,
  payload: string,
  signatureHeader: string,
  toleranceMs: number = 5 * 60 * 1000,
): boolean {
  const parts = Object.fromEntries(signatureHeader.split(",").map((p) => p.split("=")));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() - t) > toleranceMs) return false;
  const signedPayload = `${t}.${payload}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

/**
 * Deliver a webhook event to all matching active endpoints owned by `userId`
 * (or system endpoints with `userId=null`).
 *
 * Tenant isolation: a user's OTP events only fire webhooks on endpoints they
 * own (or system endpoints). This prevents cross-tenant webhook leakage —
 * User A's `otp.sent` event will NOT trigger User B's webhook endpoint.
 *
 * When `userId` is undefined (e.g. legacy callers or web-auth flows where the
 * owning user is unknown), ALL active endpoints are notified. This preserves
 * backward compatibility but should be replaced with explicit userId plumbing
 * in callers.
 *
 * NON-BLOCKING: creates delivery records, makes the first attempt, then returns.
 * Failed deliveries are enqueued to the WebhookQueue table for cron-based retry.
 */
export async function deliverWebhook(event: WebhookEvent, userId?: number): Promise<void> {
  const where = userId
    ? { isActive: true, OR: [{ userId }, { userId: null }] }
    : { isActive: true };
  const endpoints = await db.webhookEndpoint.findMany({ where });
  const matching = endpoints.filter((e) => {
    const events = e.events.split(",").map((s) => s.trim());
    return events.includes(event.type) || events.includes("*");
  });
  for (const ep of matching) {
    void deliverToEndpoint(ep, event);
  }
}

/**
 * Deliver to a single endpoint. Makes the FIRST attempt synchronously.
 * If it fails, enqueues a WebhookQueue job for cron-based retry.
 * Returns immediately after the first attempt — no blocking.
 */
async function deliverToEndpoint(
  ep: { id: number; url: string; secret: string },
  event: WebhookEvent,
): Promise<void> {
  const payload = JSON.stringify(event);
  const signature = signWebhook(ep.secret, payload);
  const maxRetries = await getMaxRetriesForEndpoint(ep.id);

  // Create the delivery record (for audit + replay UI).
  const delivery = await db.webhookDelivery.create({
    data: {
      endpointId: ep.id,
      eventId: event.type,
      requestId: event.requestId,
      payload,
      signature,
      status: "pending",
      attempts: 0,
    },
  });

  // First attempt — synchronous.
  const result = await singleAttempt(ep.url, payload, signature, event.type);

  if (result.ok) {
    // Success — mark delivered.
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "delivered",
        responseCode: result.status,
        attempts: 1,
        deliveredAt: new Date(),
        lastError: null,
      },
    }).catch(() => {});
  } else {
    // Failure — update delivery record + enqueue retry job.
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "pending",
        responseCode: result.status,
        attempts: 1,
        lastError: `${result.error} (attempt 1/${maxRetries})`,
      },
    }).catch(() => {});

    // Enqueue to WebhookQueue for cron-based retry.
    await db.webhookQueue.create({
      data: {
        endpointId: ep.id,
        deliveryId: delivery.id,
        payload,
        signature,
        eventType: event.type,
        attempts: 1,
        maxRetries,
        nextRetryAt: new Date(Date.now() + 10_000), // first retry in 10s
        status: "pending",
      },
    }).catch(() => {});
  }
}

/**
 * Process pending webhook queue jobs. Called by POST /api/webhooks/process-queue
 * (triggered by Vercel Cron every 1 minute).
 *
 * Fetches pending jobs where nextRetryAt <= NOW(), attempts delivery for each,
 * and either marks done (success) or schedules the next retry (failure with
 * backoff) or marks failed (attempts exhausted).
 */
export async function processWebhookQueue(): Promise<{ processed: number; delivered: number; failed: number; retried: number }> {
  const now = new Date();
  const result = { processed: 0, delivered: 0, failed: 0, retried: 0 };

  // Fetch pending jobs ready for retry.
  const jobs = await db.webhookQueue.findMany({
    where: {
      status: "pending",
      nextRetryAt: { lte: now },
    },
    take: 50, // Process in batches to avoid timeouts.
    orderBy: { nextRetryAt: "asc" },
  });

  for (const job of jobs) {
    result.processed++;

    // Fetch the endpoint URL.
    const endpoint = await db.webhookEndpoint.findUnique({
      where: { id: job.endpointId },
      select: { url: true },
    });
    if (!endpoint) {
      await db.webhookQueue.update({
        where: { id: job.id },
        data: { status: "failed" },
      }).catch(() => {});
      result.failed++;
      continue;
    }

    // Attempt delivery.
    const delivery = await singleAttempt(endpoint.url, job.payload, job.signature, job.eventType);

    if (delivery.ok) {
      // Success — mark queue job done + update delivery record.
      await db.webhookQueue.update({
        where: { id: job.id },
        data: { status: "done", attempts: job.attempts + 1, updatedAt: new Date() },
      }).catch(() => {});

      await db.webhookDelivery.update({
        where: { id: job.deliveryId },
        data: {
          status: "delivered",
          responseCode: delivery.status,
          attempts: job.attempts + 1,
          deliveredAt: new Date(),
          lastError: null,
        },
      }).catch(() => {});

      result.delivered++;
    } else {
      // Failure — increment attempts, schedule next retry or mark failed.
      const nextAttempts = job.attempts + 1;
      const isLast = nextAttempts >= job.maxRetries;

      if (isLast) {
        // Exhausted retries — mark as failed.
        await db.webhookQueue.update({
          where: { id: job.id },
          data: {
            status: "failed",
            attempts: nextAttempts,
            updatedAt: new Date(),
          },
        }).catch(() => {});

        await db.webhookDelivery.update({
          where: { id: job.deliveryId },
          data: {
            status: "failed",
            attempts: nextAttempts,
            lastError: `${delivery.error} (attempt ${nextAttempts}/${job.maxRetries}) — exhausted`,
          },
        }).catch(() => {});

        result.failed++;
      } else {
        // Schedule next retry with exponential backoff.
        const backoffMs = Math.min(10_000 * Math.pow(3, nextAttempts - 1), 90_000);
        await db.webhookQueue.update({
          where: { id: job.id },
          data: {
            attempts: nextAttempts,
            nextRetryAt: new Date(Date.now() + backoffMs),
            updatedAt: new Date(),
          },
        }).catch(() => {});

        await db.webhookDelivery.update({
          where: { id: job.deliveryId },
          data: {
            attempts: nextAttempts,
            lastError: `${delivery.error} (attempt ${nextAttempts}/${job.maxRetries})`,
          },
        }).catch(() => {});

        result.retried++;
      }
    }
  }

  return result;
}

/**
 * Make a single HTTP delivery attempt. Returns a normalized result.
 * Does NOT touch the database — caller handles DB updates.
 */
async function singleAttempt(
  url: string,
  payload: string,
  signature: string,
  eventType: string,
): Promise<{ ok: boolean; status: number; error: string | null }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Nixify-Signature": signature,
        "Nixify-Event": eventType,
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      return { ok: true, status: res.status, error: null };
    }
    return { ok: false, status: res.status, error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : "fetch failed" };
  }
}

/**
 * Resolve the max retry attempts for an endpoint's owner.
 * Uses the endpoint's `userId` (NOT the legacy `AdminUser` lookup) to resolve
 * the owner's plan via the entitlement engine. Falls back to 3 (PRO default)
 * on error or when the endpoint has no owning user (system endpoint).
 */
async function getMaxRetriesForEndpoint(endpointId: number): Promise<number> {
  try {
    const { FEATURE_LIMITS, FEATURE_KEYS } = await import("@/lib/entitlements/config");
    const { getUserPlan } = await import("@/lib/entitlements/engine");

    const endpoint = await db.webhookEndpoint.findUnique({
      where: { id: endpointId },
      select: { userId: true },
    });
    // No endpoint, or system endpoint (no owner) → default to PRO limit (3).
    if (!endpoint || !endpoint.userId) return 3;

    const plan = await getUserPlan(endpoint.userId);
    const limits = FEATURE_LIMITS[FEATURE_KEYS.WEBHOOK_RETRIES][plan];
    return limits.quota || 3;
  } catch {
    return 3;
  }
}

/** Replay a webhook delivery (re-send the same payload). */
export async function replayWebhookDelivery(deliveryId: number): Promise<void> {
  const delivery = await db.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });
  if (!delivery || !delivery.endpoint) return;

  const maxRetries = await getMaxRetriesForEndpoint(delivery.endpoint.id);
  if (delivery.attempts >= maxRetries) {
    await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "failed",
        lastError: `Max retry attempts (${maxRetries}) exhausted — replay blocked`,
      },
    });
    return;
  }

  const result = await singleAttempt(
    delivery.endpoint.url,
    delivery.payload,
    delivery.signature,
    delivery.eventId,
  );

  await db.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: result.ok ? "delivered" : "failed",
      responseCode: result.status || undefined,
      attempts: { increment: 1 },
      lastError: result.ok ? null : result.error,
    },
  });
}
