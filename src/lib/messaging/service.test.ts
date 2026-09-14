import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  createTemplate,
  updateTemplate,
} from "@/lib/transactional-templates";
import { upsertContact } from "@/lib/contacts";
import {
  sendTransactionalEmail,
  MessagingValidationError,
  IdempotencyConflictError,
  MessagingQuotaError,
  type SendRequest,
} from "@/lib/messaging/service";
import type { EmailProvider, ProviderSendInput, ProviderSendResult } from "@/lib/messaging/providers/provider";
import { ProviderError } from "@/lib/messaging/providers/provider";

/**
 * Messaging Service — DB integration tests (Phase 4, sections 5-21).
 *
 * This file is GATED — only runs when RUN_MESSAGING_INTEGRATION=1 AND a
 * TEST_DATABASE_URL is supplied. The (future) `test:messaging` script will
 * set both. Generic `bun run test` skips this file silently (no DB
 * available). Mirrors the gate pattern of
 * src/lib/transactional-templates/service.test.ts (RUN_TEMPLATE_INTEGRATION)
 * and src/lib/contacts/contacts.test.ts (RUN_CONTACT_INTEGRATION).
 *
 * Coverage (per task spec):
 * - successful send persists EmailMessage with status="sent", provider set,
 *   providerMessageId set, sentAt set, source="api_v1"
 * - tenant ownership: user A's send resolves A's template; user B cannot
 *   send A's template (template_not_found, no existence leakage)
 * - current template version send (omit templateVersion → uses currentVersion)
 * - explicit historical version send (templateVersion=1 when currentVersion=2
 *   → renders v1 content)
 * - cross-tenant template denied (user B's slug lookup for A's slug →
 *   template_not_found)
 * - provider success → status="sent"
 * - provider failure → status="failed", errorCode="provider_error",
 *   errorMessage="Email provider delivery failed."
 * - provider configuration_error → errorCode="configuration_error"
 * - quota denial → status="rejected", errorCode="quota_exhausted"
 * - no rendered HTML body persisted (EmailMessage has no html column)
 * - no variable values persisted (no variables column)
 * - existing Contact gets email.sent event with detail.templateId +
 *   detail.templateVersion
 * - nonexistent Contact is NOT auto-created
 * - provider failure does NOT expose raw error text
 *
 * Idempotency:
 * - same Idempotency-Key + same body → sends once, replay returns existing,
 *   NO second provider call
 * - replay does NOT consume another MESSAGING_EMAILS (checkUsage called once)
 * - concurrent duplicate calls (Promise.all of 2) → exactly ONE provider.send,
 *   one EmailMessage row, both callers get a valid result
 * - same key + different body → IdempotencyConflictError
 * - pending duplicate → replay=true, status="pending", no second send
 */

// ---- Mocks (hoisted by vitest before imports) -----------------------------
//
// Mock the entitlements engine so we can control checkUsage's return value
// per-test (e.g. allowed=true for normal sends, allowed=false for quota-
// denial tests). The mock preserves real getUserPlan/canAccess/peekUsage so
// other code paths (if exercised) still work against the real DB.
vi.mock("@/lib/entitlements/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/entitlements/engine")>();
  return {
    ...actual,
    checkUsage: vi.fn(),
  };
});

import { checkUsage } from "@/lib/entitlements/engine";

// ---- Gate: skip silently when RUN_MESSAGING_INTEGRATION is not set --------

const RUN = process.env.RUN_MESSAGING_INTEGRATION === "1";

// ---- FakeEmailProvider (NEVER makes a real SMTP call) --------------------

type FakeMode = "success" | "provider_error" | "configuration_error" | "throw_generic";

class FakeEmailProvider implements EmailProvider {
  /** All send() calls recorded, in order. */
  readonly calls: ProviderSendInput[] = [];
  mode: FakeMode = "success";
  /** Optional override of the returned messageId (default: deterministic). */
  nextMessageId: string | null = null;

  reset(mode: FakeMode = "success"): void {
    this.calls.length = 0;
    this.mode = mode;
    this.nextMessageId = null;
  }

  callCount(): number {
    return this.calls.length;
  }

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    this.calls.push(input);
    if (this.mode === "success") {
      const id = this.nextMessageId ?? `fake-msg-${this.calls.length}-${Date.now()}`;
      return { provider: "fake-smtp", messageId: id };
    }
    if (this.mode === "provider_error") {
      throw new ProviderError("provider_error", "Fake provider delivery failed.");
    }
    if (this.mode === "configuration_error") {
      throw new ProviderError("configuration_error", "Fake provider config error.");
    }
    // throw_generic — simulate an unknown error type (NOT a ProviderError).
    // This tests that the service maps unknown errors to the safe generic
    // string and never persists the raw error.message.
    throw new Error("RAW_SECRET_SMTP_LEAKED_DATA_12345");
  }
}

// ---- Test suite ------------------------------------------------------------

describe.skipIf(!RUN)("Messaging Service — DB integration", () => {
  let userA: number;
  let userB: number;
  let setupComplete = false;
  const fakeProvider = new FakeEmailProvider();

  // Shared sentinel for idempotency-key uniqueness across tests.
  let keyCounter = 0;
  function uniqueKey(prefix: string): string {
    keyCounter += 1;
    return `${prefix}-${keyCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  beforeAll(async () => {
    // Verify DB connectivity.
    await db.$queryRaw`SELECT 1`;

    // Clean up any leftover test data from previous runs.
    await db.emailMessage.deleteMany({
      where: { user: { email: { contains: "messaging-test-" } } },
    });
    await db.contactEvent.deleteMany({
      where: { contact: { user: { email: { contains: "messaging-test-" } } } },
    });
    await db.contact.deleteMany({
      where: { user: { email: { contains: "messaging-test-" } } },
    });
    await db.transactionalTemplateVersion.deleteMany({
      where: { template: { user: { email: { contains: "messaging-test-" } } } },
    });
    await db.transactionalTemplate.deleteMany({
      where: { user: { email: { contains: "messaging-test-" } } },
    });
    await db.user.deleteMany({
      where: { email: { contains: "messaging-test-" } },
    });

    // Create two test users with plan="PRO" so MESSAGING_EMAILS access=true.
    // (Even though we mock checkUsage, the route layer does call canAccess
    // separately — these fixtures can be reused in route tests later.)
    const a = await db.user.create({
      data: {
        email: "messaging-test-a@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userA = a.id;

    const b = await db.user.create({
      data: {
        email: "messaging-test-b@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userB = b.id;

    setupComplete = true;
  });

  beforeEach(async () => {
    if (!setupComplete) return;

    // Reset the fake provider between tests.
    fakeProvider.reset("success");

    // Reset the checkUsage mock to the default "allowed" state.
    vi.mocked(checkUsage).mockReset();
    vi.mocked(checkUsage).mockResolvedValue({
      allowed: true,
      remaining: 9999,
      resetAt: null,
      plan: "PRO",
    });

    // Clean tables between tests so idempotency-key hashes don't collide
    // across tests and Contact fixtures don't bleed.
    await db.emailMessage.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contactEvent.deleteMany({
      where: { contact: { userId: { in: [userA, userB] } } },
    });
    await db.contact.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.transactionalTemplateVersion.deleteMany({
      where: { template: { userId: { in: [userA, userB] } } },
    });
    await db.transactionalTemplate.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
  });

  afterAll(async () => {
    if (!setupComplete) {
      await db.$disconnect();
      return;
    }
    // Clean up everything we created.
    await db.emailMessage.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contactEvent.deleteMany({
      where: { contact: { userId: { in: [userA, userB] } } },
    });
    await db.contact.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.transactionalTemplateVersion.deleteMany({
      where: { template: { userId: { in: [userA, userB] } } },
    });
    await db.transactionalTemplate.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await db.$disconnect();
  });

  // ---- Helpers ------------------------------------------------------------

  /** Build a SendRequest for user A with a fresh idempotency key. */
  function buildSend(opts: Partial<SendRequest> & { userId?: number } = {}): SendRequest {
    return {
      userId: opts.userId ?? userA,
      to: opts.to ?? "recipient@example.com",
      templateSlug: opts.templateSlug ?? "welcome",
      templateVersion: opts.templateVersion,
      variables: opts.variables ?? { name: "Alice" },
      idempotencyKey: opts.idempotencyKey ?? uniqueKey("test-key"),
      requestId: opts.requestId ?? "req-test-1",
      source: opts.source ?? "api_v1",
      environment: opts.environment ?? "production",
    };
  }

  /** Create a simple template for user A. Returns the parent template id + slug. */
  async function createWelcomeTemplate(opts: {
    userId?: number;
    slug?: string;
    subject?: string;
    html?: string;
  } = {}): Promise<{ id: number; slug: string; version: number }> {
    const userId = opts.userId ?? userA;
    const slug = opts.slug ?? "welcome";
    const created = await createTemplate(userId, {
      name: "Welcome Email",
      slug,
      subject: opts.subject ?? "Hi {{name}}!",
      html: opts.html ?? "<p>Welcome {{name}}</p>",
    });
    return { id: created.template.id, slug, version: created.version.version };
  }

  // ---- Successful send ----------------------------------------------------

  it("successful send persists EmailMessage with status=sent, provider set, providerMessageId set, sentAt set, source=api_v1", async () => {
    const tmpl = await createWelcomeTemplate();
    const result = await sendTransactionalEmail(buildSend({
      templateSlug: tmpl.slug,
      idempotencyKey: uniqueKey("ok"),
    }), fakeProvider);

    expect(result.status).toBe("sent");
    expect(result.replay).toBe(false);
    expect(result.created).toBe(true);
    expect(result.messageId).toMatch(/^[0-9a-f-]{36}$/i);

    // Verify the persisted row.
    const row = await db.emailMessage.findUnique({
      where: { messageId: result.messageId },
    });
    expect(row).not.toBeNull();
    expect(row!.userId).toBe(userA);
    expect(row!.status).toBe("sent");
    expect(row!.provider).toBe("fake-smtp");
    expect(row!.providerMessageId).toBeTruthy();
    expect(row!.sentAt).toBeInstanceOf(Date);
    expect(row!.source).toBe("api_v1");
    expect(row!.templateId).toBe(tmpl.id);
    expect(row!.templateVersion).toBe(1);
    expect(row!.toEmail).toBe("recipient@example.com");
    expect(row!.subject).toBe("Hi Alice!");
    expect(row!.errorCode).toBeNull();
    expect(row!.errorMessage).toBeNull();
    expect(row!.idempotencyKeyHash).toBeTruthy();
    expect(row!.requestFingerprint).toBeTruthy();
    expect(row!.environment).toBe("production");

    // The fake provider should have been called exactly once.
    expect(fakeProvider.callCount()).toBe(1);
    expect(fakeProvider.calls[0].to).toBe("recipient@example.com");
    expect(fakeProvider.calls[0].subject).toBe("Hi Alice!");
    expect(fakeProvider.calls[0].html).toContain("Alice");
  });

  // ---- Current version send (omitted templateVersion) -------------------

  it("omitting templateVersion sends the current version (currentVersion=1)", async () => {
    const tmpl = await createWelcomeTemplate({ slug: "current-v1" });
    const result = await sendTransactionalEmail(buildSend({
      templateSlug: tmpl.slug,
    }), fakeProvider);

    expect(result.status).toBe("sent");
    const row = await db.emailMessage.findUnique({ where: { messageId: result.messageId } });
    expect(row!.templateVersion).toBe(1); // currentVersion is 1
  });

  // ---- Explicit historical version send ----------------------------------

  it("explicit templateVersion=1 when currentVersion=2 renders v1 content", async () => {
    // Create v1, then update to v2.
    const tmpl = await createWelcomeTemplate({
      slug: "historical",
      subject: "v1 subject {{name}}",
      html: "<p>v1: {{name}}</p>",
    });
    await updateTemplate(userA, tmpl.id, {
      subject: "v2 subject {{name}}",
      html: "<p>v2: {{name}}</p>",
    });

    // Send with templateVersion=1 explicitly.
    const result = await sendTransactionalEmail(buildSend({
      templateSlug: tmpl.slug,
      templateVersion: 1,
    }), fakeProvider);

    expect(result.status).toBe("sent");
    const row = await db.emailMessage.findUnique({ where: { messageId: result.messageId } });
    expect(row!.templateVersion).toBe(1);
    // The persisted subject is the v1 subject, rendered with the variable.
    expect(row!.subject).toBe("v1 subject Alice");
    // The fake provider received v1's rendered HTML.
    expect(fakeProvider.calls[0].html).toContain("v1:");
    expect(fakeProvider.calls[0].html).not.toContain("v2:");
  });

  it("explicit templateVersion=2 when currentVersion=2 renders v2 content", async () => {
    const tmpl = await createWelcomeTemplate({
      slug: "explicit-v2",
      subject: "v1 {{name}}",
      html: "<p>v1: {{name}}</p>",
    });
    await updateTemplate(userA, tmpl.id, {
      subject: "v2 {{name}}",
      html: "<p>v2: {{name}}</p>",
    });

    const result = await sendTransactionalEmail(buildSend({
      templateSlug: tmpl.slug,
      templateVersion: 2,
    }), fakeProvider);

    expect(result.status).toBe("sent");
    const row = await db.emailMessage.findUnique({ where: { messageId: result.messageId } });
    expect(row!.templateVersion).toBe(2);
    expect(row!.subject).toBe("v2 Alice");
    expect(fakeProvider.calls[0].html).toContain("v2:");
  });

  it("omitting templateVersion when currentVersion=2 sends v2 (the current)", async () => {
    const tmpl = await createWelcomeTemplate({
      slug: "omit-version",
      subject: "v1 {{name}}",
      html: "<p>v1: {{name}}</p>",
    });
    await updateTemplate(userA, tmpl.id, {
      subject: "v2 {{name}}",
      html: "<p>v2: {{name}}</p>",
    });

    const result = await sendTransactionalEmail(buildSend({
      templateSlug: tmpl.slug,
    }), fakeProvider);

    expect(result.status).toBe("sent");
    const row = await db.emailMessage.findUnique({ where: { messageId: result.messageId } });
    expect(row!.templateVersion).toBe(2);
    expect(row!.subject).toBe("v2 Alice");
  });

  // ---- Tenant isolation ---------------------------------------------------

  it("user A's send resolves A's template (no leak across tenants)", async () => {
    const tmpl = await createWelcomeTemplate({ userId: userA, slug: "a-only" });
    const result = await sendTransactionalEmail(buildSend({
      userId: userA,
      templateSlug: tmpl.slug,
    }), fakeProvider);
    expect(result.status).toBe("sent");
    expect(result.created).toBe(true);
  });

  it("user B cannot send user A's template (template_not_found — no existence leakage)", async () => {
    // A owns the template.
    await createWelcomeTemplate({ userId: userA, slug: "private-to-a" });

    // B tries to send with that slug.
    await expect(
      sendTransactionalEmail(buildSend({
        userId: userB,
        templateSlug: "private-to-a",
      }), fakeProvider),
    ).rejects.toThrow(MessagingValidationError);

    // The error code is template_not_found.
    await expect(
      sendTransactionalEmail(buildSend({
        userId: userB,
        templateSlug: "private-to-a",
        idempotencyKey: uniqueKey("cross-tenant"),
      }), fakeProvider),
    ).rejects.toMatchObject({ code: "template_not_found" });

    // The fake provider was NEVER called — the service rejected before
    // reaching the provider step.
    expect(fakeProvider.callCount()).toBe(0);
  });

  it("cross-tenant slug lookup returns null (no row created, no EmailMessage persisted)", async () => {
    await createWelcomeTemplate({ userId: userA, slug: "a-private-slug" });
    try {
      await sendTransactionalEmail(buildSend({
        userId: userB,
        templateSlug: "a-private-slug",
      }), fakeProvider);
    } catch {
      // expected — MessagingValidationError
    }
    // No EmailMessage row for user B with this slug-based request.
    const rows = await db.emailMessage.findMany({
      where: { userId: userB, subject: { contains: "Alice" } },
    });
    expect(rows.length).toBe(0);
  });

  // ---- Provider success/failure paths ------------------------------------

  it("provider success → status=sent, provider + providerMessageId set", async () => {
    fakeProvider.mode = "success";
    fakeProvider.nextMessageId = "custom-msg-id-123";
    const tmpl = await createWelcomeTemplate({ slug: "success" });
    const result = await sendTransactionalEmail(buildSend({
      templateSlug: tmpl.slug,
    }), fakeProvider);

    expect(result.status).toBe("sent");
    const row = await db.emailMessage.findUnique({ where: { messageId: result.messageId } });
    expect(row!.status).toBe("sent");
    expect(row!.provider).toBe("fake-smtp");
    expect(row!.providerMessageId).toBe("custom-msg-id-123");
    expect(row!.sentAt).toBeInstanceOf(Date);
    expect(row!.failedAt).toBeNull();
  });

  it("provider failure (ProviderError provider_error) → status=failed, errorCode=provider_error, errorMessage=safe generic string", async () => {
    fakeProvider.mode = "provider_error";
    const tmpl = await createWelcomeTemplate({ slug: "p-fail" });
    const result = await sendTransactionalEmail(buildSend({
      templateSlug: tmpl.slug,
    }), fakeProvider);

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("provider_error");
    expect(result.errorMessage).toBe("Email provider delivery failed.");

    const row = await db.emailMessage.findUnique({ where: { messageId: result.messageId } });
    expect(row!.status).toBe("failed");
    expect(row!.errorCode).toBe("provider_error");
    expect(row!.errorMessage).toBe("Email provider delivery failed.");
    expect(row!.failedAt).toBeInstanceOf(Date);
    expect(row!.sentAt).toBeNull();
  });

  it("provider configuration_error → errorCode=configuration_error, errorMessage=config string", async () => {
    fakeProvider.mode = "configuration_error";
    const tmpl = await createWelcomeTemplate({ slug: "p-config" });
    const result = await sendTransactionalEmail(buildSend({
      templateSlug: tmpl.slug,
    }), fakeProvider);

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("configuration_error");
    expect(result.errorMessage).toBe("Email provider configuration error.");

    const row = await db.emailMessage.findUnique({ where: { messageId: result.messageId } });
    expect(row!.errorCode).toBe("configuration_error");
    expect(row!.errorMessage).toBe("Email provider configuration error.");
  });

  it("provider throws generic Error → errorCode=provider_error, raw error text NOT persisted", async () => {
    // A non-ProviderError error (e.g. network blip, null deref). The service
    // must map this to the safe generic provider_error message and NEVER
    // persist the raw Error.message.
    fakeProvider.mode = "throw_generic";
    const tmpl = await createWelcomeTemplate({ slug: "p-generic" });
    const result = await sendTransactionalEmail(buildSend({
      templateSlug: tmpl.slug,
    }), fakeProvider);

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("provider_error");
    // The raw Error.message ("RAW_SECRET_SMTP_LEAKED_DATA_12345") must NOT
    // appear anywhere in the returned errorMessage or the persisted row.
    expect(result.errorMessage).not.toContain("RAW_SECRET");
    expect(result.errorMessage).not.toContain("LEAKED");

    const row = await db.emailMessage.findUnique({ where: { messageId: result.messageId } });
    expect(row!.errorMessage).not.toContain("RAW_SECRET");
    expect(row!.errorMessage).not.toContain("LEAKED");
    expect(row!.errorCode).toBe("provider_error");
  });

  // ---- Quota denial -------------------------------------------------------

  it("quota denial → status=rejected, errorCode=quota_exhausted, MessagingQuotaError thrown", async () => {
    vi.mocked(checkUsage).mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 86_400_000),
      plan: "PRO",
      reason: "quota_exhausted",
    });

    const tmpl = await createWelcomeTemplate({ slug: "quota-denied" });
    await expect(
      sendTransactionalEmail(buildSend({
        templateSlug: tmpl.slug,
      }), fakeProvider),
    ).rejects.toThrow(MessagingQuotaError);

    // The service persists the row as "rejected" with errorCode=quota_exhausted.
    const rows = await db.emailMessage.findMany({
      where: { userId: userA, templateId: tmpl.id },
    });
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe("rejected");
    expect(rows[0].errorCode).toBe("quota_exhausted");
    expect(rows[0].failedAt).toBeInstanceOf(Date);
    expect(rows[0].sentAt).toBeNull();

    // The fake provider was NEVER called — quota denial happens BEFORE
    // provider.send().
    expect(fakeProvider.callCount()).toBe(0);
  });

  it("rate-limited → status=rejected, errorCode=rate_limited", async () => {
    vi.mocked(checkUsage).mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60_000),
      plan: "PRO",
      reason: "rate_limited",
    });

    const tmpl = await createWelcomeTemplate({ slug: "rate-limited" });
    await expect(
      sendTransactionalEmail(buildSend({
        templateSlug: tmpl.slug,
      }), fakeProvider),
    ).rejects.toMatchObject({ name: "MessagingQuotaError", code: "rate_limited" });

    const row = await db.emailMessage.findFirst({
      where: { userId: userA, templateId: tmpl.id },
    });
    expect(row!.status).toBe("rejected");
    expect(row!.errorCode).toBe("rate_limited");
  });

  // ---- No rendered HTML / variables persisted ----------------------------

  it("NO rendered HTML body persisted on EmailMessage (model has no html column)", async () => {
    const tmpl = await createWelcomeTemplate({
      slug: "no-html-persist",
      html: "<p>Big HTML body with {{name}} that should NOT be persisted</p>",
    });
    const result = await sendTransactionalEmail(buildSend({
      templateSlug: tmpl.slug,
    }), fakeProvider);

    const row = await db.emailMessage.findUnique({
      where: { messageId: result.messageId },
    });
    expect(row).not.toBeNull();
    // The Prisma EmailMessage model has NO html / body / text field.
    // Verify by checking that none of those keys appear in the row.
    const keys = Object.keys(row as object);
    expect(keys).not.toContain("html");
    expect(keys).not.toContain("body");
    expect(keys).not.toContain("text");
    expect(keys).not.toContain("renderedHtml");
    expect(keys).not.toContain("renderedBody");
    // The subject IS persisted (it's part of the audit metadata) — the
    // rendered SUBJECT, not the rendered HTML body. Default subject is
    // "Hi {{name}}!" -> "Hi Alice!" with the default variables {name:"Alice"}.
    expect(row!.subject).toBe("Hi Alice!");
    // The rendered HTML body must NOT be persisted anywhere on the row.
    // Iterate every column value and assert the HTML body string never appears.
    const htmlBody = "Big HTML body with Alice that should NOT be persisted";
    for (const [key, val] of Object.entries(row as Record<string, unknown>)) {
      if (typeof val === "string") {
        expect(val).not.toContain(htmlBody);
      }
    }
    // Also assert the raw <p> tag from the HTML never leaked into subject.
    expect(row!.subject).not.toContain("<p>");
    expect(row!.subject).not.toContain("</p>");
  });

  it("NO variable values persisted on EmailMessage (no variables column)", async () => {
    const tmpl = await createWelcomeTemplate({ slug: "no-vars-persist" });
    const result = await sendTransactionalEmail(buildSend({
      templateSlug: tmpl.slug,
      variables: { name: "SuperSecretCustomerName" },
    }), fakeProvider);

    const row = await db.emailMessage.findUnique({
      where: { messageId: result.messageId },
    });
    expect(row).not.toBeNull();
    const keys = Object.keys(row as object);
    expect(keys).not.toContain("variables");
    expect(keys).not.toContain("vars");
    expect(keys).not.toContain("values");
    expect(keys).not.toContain("context");
    // The variable VALUE ("SuperSecretCustomerName") should NOT appear in
    // any persisted column. It's in the rendered subject (which IS persisted)
    // but only if the template's subject references {{name}}. Our default
    // template subject is "Hi {{name}}!" — so the rendered subject DOES
    // contain "SuperSecretCustomerName". That's by design: the rendered
    // subject is audit metadata. The variable VALUES MAP itself is not
    // persisted.
    // We assert the variable values map is not directly stored.
    expect((row as any).variables).toBeUndefined();
    expect((row as any).values).toBeUndefined();
  });

  // ---- Contact timeline integration --------------------------------------

  it("existing Contact gets an email.sent event with detail.templateId and detail.templateVersion", async () => {
    const tmpl = await createWelcomeTemplate({ slug: "contact-event" });
    // Pre-create a Contact for the recipient.
    const recipientEmail = "alice-recipient@example.com";
    const contactResult = await upsertContact(userA, {
      email: recipientEmail,
      name: "Alice Recipient",
    });
    expect(contactResult.created).toBe(true);

    const result = await sendTransactionalEmail(buildSend({
      templateSlug: tmpl.slug,
      to: recipientEmail,
    }), fakeProvider);
    expect(result.status).toBe("sent");

    // A ContactEvent("email.sent") should have been appended.
    const events = await db.contactEvent.findMany({
      where: { contactId: contactResult.contact.id },
      orderBy: { createdAt: "desc" },
    });
    const sentEvent = events.find((e) => e.type === "email.sent");
    expect(sentEvent).toBeDefined();
    const detail = sentEvent!.detail as Record<string, unknown>;
    expect(detail.templateId).toBe(tmpl.id);
    expect(detail.templateVersion).toBe(1);
    expect(sentEvent!.requestId).toBe(result.messageId);
  });

  it("nonexistent Contact is NOT auto-created and NO ContactEvent is created (best-effort)", async () => {
    const tmpl = await createWelcomeTemplate({ slug: "no-auto-create" });
    // No Contact exists for this recipient.
    const recipientEmail = "stranger@example.com";
    const beforeContacts = await db.contact.count({
      where: { userId: userA, email: recipientEmail },
    });
    expect(beforeContacts).toBe(0);

    const result = await sendTransactionalEmail(buildSend({
      templateSlug: tmpl.slug,
      to: recipientEmail,
    }), fakeProvider);
    expect(result.status).toBe("sent");

    // No new Contact row was created.
    const afterContacts = await db.contact.count({
      where: { userId: userA, email: recipientEmail },
    });
    expect(afterContacts).toBe(0);

    // No ContactEvent rows at all for this user.
    const events = await db.contactEvent.findMany({
      where: { contact: { userId: userA } },
    });
    const sentEvents = events.filter((e) => e.type === "email.sent");
    expect(sentEvents.length).toBe(0);
  });

  // ---- Idempotency: same key + same body → replay ------------------------

  it("same Idempotency-Key + same body → sends once, second call returns replay=true, NO second provider call", async () => {
    const tmpl = await createWelcomeTemplate({ slug: "idem-replay" });
    const key = uniqueKey("replay-key");
    const sendReq = (overrides: Partial<SendRequest> = {}): SendRequest => buildSend({
      templateSlug: tmpl.slug,
      idempotencyKey: key,
      ...overrides,
    });

    const r1 = await sendTransactionalEmail(sendReq(), fakeProvider);
    expect(r1.status).toBe("sent");
    expect(r1.created).toBe(true);
    expect(r1.replay).toBe(false);

    const r2 = await sendTransactionalEmail(sendReq(), fakeProvider);
    expect(r2.status).toBe("sent");
    expect(r2.replay).toBe(true);
    expect(r2.created).toBe(false);
    expect(r2.messageId).toBe(r1.messageId);

    // The fake provider was called exactly ONCE — the replay did not call it.
    expect(fakeProvider.callCount()).toBe(1);

    // Only ONE EmailMessage row exists in the DB.
    const rows = await db.emailMessage.findMany({
      where: { userId: userA, templateId: tmpl.id },
    });
    expect(rows.length).toBe(1);
  });

  it("replay does NOT consume another MESSAGING_EMAILS (checkUsage called once total)", async () => {
    const tmpl = await createWelcomeTemplate({ slug: "idem-no-double-consume" });
    const key = uniqueKey("no-double-consume");
    const sendReq = () => buildSend({
      templateSlug: tmpl.slug,
      idempotencyKey: key,
    });

    await sendTransactionalEmail(sendReq(), fakeProvider);
    await sendTransactionalEmail(sendReq(), fakeProvider);

    // checkUsage should have been called EXACTLY ONCE — the replay short-
    // circuits before the checkUsage step.
    expect(vi.mocked(checkUsage)).toHaveBeenCalledTimes(1);
  });

  // ---- Idempotency: concurrent duplicate calls ---------------------------

  it("concurrent duplicate calls (Promise.all of 2) → exactly ONE provider.send, one EmailMessage row, both callers get a valid result", async () => {
    const tmpl = await createWelcomeTemplate({ slug: "idem-concurrent" });
    const key = uniqueKey("concurrent-key");
    const sendReq = () => buildSend({
      templateSlug: tmpl.slug,
      idempotencyKey: key,
    });

    const [r1, r2] = await Promise.all([
      sendTransactionalEmail(sendReq(), fakeProvider),
      sendTransactionalEmail(sendReq(), fakeProvider),
    ]);

    // Both calls should succeed — no rejection. Exactly one created, one replay.
    const createdResults = [r1, r2].filter((r) => r.created);
    const replayResults = [r1, r2].filter((r) => r.replay);
    expect(createdResults.length).toBe(1);
    expect(replayResults.length).toBe(1);

    // Both should return the same messageId (the existing row).
    expect(r1.messageId).toBe(r2.messageId);
    // In a concurrent scenario, the replay caller may read the row while the
    // winner is still in "pending" state (before it updates to "sent"). Both
    // "sent" and "pending" are valid concurrent results — the critical
    // invariants are: 1 created + 1 replay, same messageId, exactly 1 provider
    // call, exactly 1 row, and the final row status is "sent".
    for (const r of [r1, r2]) {
      expect(["sent", "pending"]).toContain(r.status);
    }

    // Exactly ONE provider call.
    expect(fakeProvider.callCount()).toBe(1);

    // Exactly ONE EmailMessage row in the DB.
    const rows = await db.emailMessage.findMany({
      where: { userId: userA, templateId: tmpl.id },
    });
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe("sent");
  });

  // ---- Idempotency: same key + different body → conflict -----------------

  it("same Idempotency-Key + different body → IdempotencyConflictError", async () => {
    const tmpl = await createWelcomeTemplate({ slug: "idem-conflict" });
    const key = uniqueKey("conflict-key");

    // First send with name=Alice.
    const r1 = await sendTransactionalEmail(buildSend({
      templateSlug: tmpl.slug,
      idempotencyKey: key,
      variables: { name: "Alice" },
      to: "alice@example.com",
    }), fakeProvider);
    expect(r1.status).toBe("sent");

    // Second send with the SAME key but a DIFFERENT body (different recipient).
    await expect(
      sendTransactionalEmail(buildSend({
        templateSlug: tmpl.slug,
        idempotencyKey: key,
        variables: { name: "Bob" },
        to: "bob@example.com",
      }), fakeProvider),
    ).rejects.toThrow(IdempotencyConflictError);

    // The fake provider was called exactly once — the conflict did NOT
    // trigger a second send.
    expect(fakeProvider.callCount()).toBe(1);

    // Only the FIRST message exists in the DB.
    const rows = await db.emailMessage.findMany({
      where: { userId: userA, templateId: tmpl.id },
    });
    expect(rows.length).toBe(1);
    expect(rows[0].toEmail).toBe("alice@example.com");
  });

  it("same Idempotency-Key + different variable VALUES → IdempotencyConflictError", async () => {
    const tmpl = await createWelcomeTemplate({ slug: "idem-conflict-vars" });
    const key = uniqueKey("conflict-vars");

    const r1 = await sendTransactionalEmail(buildSend({
      templateSlug: tmpl.slug,
      idempotencyKey: key,
      variables: { name: "Alice" },
    }), fakeProvider);
    expect(r1.status).toBe("sent");

    // Same key, different variable VALUE (different fingerprint).
    await expect(
      sendTransactionalEmail(buildSend({
        templateSlug: tmpl.slug,
        idempotencyKey: key,
        variables: { name: "Eve" },
      }), fakeProvider),
    ).rejects.toThrow(IdempotencyConflictError);

    expect(fakeProvider.callCount()).toBe(1);
  });

  // ---- Idempotency: pending duplicate ------------------------------------

  it("pending duplicate (a message stuck in pending) → returns replay=true, status=pending, no second send", async () => {
    const tmpl = await createWelcomeTemplate({ slug: "idem-pending" });
    const key = uniqueKey("pending-key");

    // Manually insert a pending EmailMessage row simulating an in-flight send.
    // This mimics the situation where the first call's provider.send() hasn't
    // completed yet (so the row is still in "pending" state) and the second
    // call comes in.
    const existingRow = await db.emailMessage.create({
      data: {
        userId: userA,
        templateId: tmpl.id,
        templateVersion: 1,
        toEmail: "recipient@example.com",
        subject: "Hi Alice!",
        status: "pending",
        source: "api_v1",
        environment: "production",
        requestId: "req-first",
        // The service computes these from the request — we replicate the
        // computation here so the fingerprint matches the second call.
        idempotencyKeyHash: (await import("@/lib/messaging/idempotency")).hashIdempotencyKey(key),
        requestFingerprint: (await import("@/lib/messaging/idempotency")).computeRequestFingerprint({
          to: "recipient@example.com",
          templateSlug: tmpl.slug,
          variables: { name: "Alice" },
        }),
      },
    });

    // Second call with the SAME key + same body should replay the existing
    // pending row — NO provider.send call.
    const r2 = await sendTransactionalEmail(buildSend({
      templateSlug: tmpl.slug,
      idempotencyKey: key,
      variables: { name: "Alice" },
    }), fakeProvider);

    expect(r2.replay).toBe(true);
    expect(r2.created).toBe(false);
    expect(r2.status).toBe("pending");
    expect(r2.messageId).toBe(existingRow.messageId);

    // The fake provider was NEVER called — the replay short-circuits.
    expect(fakeProvider.callCount()).toBe(0);
    // checkUsage was NEVER called — replay doesn't consume quota.
    expect(vi.mocked(checkUsage)).toHaveBeenCalledTimes(0);

    // The existing row is UNCHANGED.
    const unchangedRow = await db.emailMessage.findUnique({
      where: { id: existingRow.id },
    });
    expect(unchangedRow!.status).toBe("pending");
  });

  // ---- Idempotency: no idempotency key (dashboard test-send path) ---------

  it("send WITHOUT an idempotency key skips the idempotency claim (dashboard test-send path)", async () => {
    const tmpl = await createWelcomeTemplate({ slug: "no-idem-key" });
    // Build the SendRequest explicitly WITHOUT buildSend, so no default
    // idempotency key is applied. buildSend() uses `?? uniqueKey(...)` which
    // would turn `undefined` into a real key and defeat the purpose of this
    // test. The dashboard test-send route synthesizes a key at the route
    // layer; the service itself must handle a truly-absent key by leaving
    // idempotencyKeyHash null.
    const result = await sendTransactionalEmail({
      userId: userA,
      to: "recipient@example.com",
      templateSlug: tmpl.slug,
      variables: { name: "Alice" },
      // idempotencyKey intentionally OMITTED (not undefined-via-default)
      requestId: "req-no-key",
      source: "dashboard_test",
      environment: "production",
    }, fakeProvider);

    expect(result.status).toBe("sent");
    expect(result.created).toBe(true);
    expect(result.replay).toBe(false);

    const row = await db.emailMessage.findUnique({ where: { messageId: result.messageId } });
    expect(row!.source).toBe("dashboard_test");
    // No idempotencyKeyHash persisted when no key is provided.
    expect(row!.idempotencyKeyHash).toBeNull();
    expect(row!.requestFingerprint).toBeNull();
  });

  // ---- Missing variable → MessagingValidationError before provider call --

  it("missing required template variable → MessagingValidationError(missing_template_variables), provider NOT called", async () => {
    const tmpl = await createWelcomeTemplate({ slug: "missing-var" });
    // The template requires {{name}} but we provide an empty variables map.
    await expect(
      sendTransactionalEmail(buildSend({
        templateSlug: tmpl.slug,
        variables: {},
      }), fakeProvider),
    ).rejects.toMatchObject({
      name: "MessagingValidationError",
      code: "missing_template_variables",
    });

    // The fake provider was NEVER called.
    expect(fakeProvider.callCount()).toBe(0);

    // No EmailMessage row persisted (the error happens before the create).
    const rows = await db.emailMessage.findMany({
      where: { userId: userA, templateId: tmpl.id },
    });
    expect(rows.length).toBe(0);
  });

  // ---- Invalid recipient validation --------------------------------------

  it("invalid recipient email → MessagingValidationError(invalid_recipient), provider NOT called", async () => {
    const tmpl = await createWelcomeTemplate({ slug: "invalid-recipient" });
    await expect(
      sendTransactionalEmail(buildSend({
        templateSlug: tmpl.slug,
        to: "not-an-email",
      }), fakeProvider),
    ).rejects.toMatchObject({
      name: "MessagingValidationError",
      code: "invalid_recipient",
    });
    expect(fakeProvider.callCount()).toBe(0);
  });

  // ---- Non-scalar variable rejected --------------------------------------

  it("object variable value → MessagingValidationError(validation_failed), provider NOT called", async () => {
    const tmpl = await createWelcomeTemplate({ slug: "obj-var" });
    await expect(
      sendTransactionalEmail(buildSend({
        templateSlug: tmpl.slug,
        variables: { name: { nested: "object" } },
      }), fakeProvider),
    ).rejects.toMatchObject({
      name: "MessagingValidationError",
      code: "validation_failed",
    });
    expect(fakeProvider.callCount()).toBe(0);
  });
});
