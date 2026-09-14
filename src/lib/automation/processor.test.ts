import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createTemplate } from "@/lib/transactional-templates";
import { upsertContact } from "@/lib/contacts";
import {
  sendTransactionalEmail,
  MessagingValidationError,
  MessagingQuotaError,
  IdempotencyConflictError,
  type SendResult,
} from "@/lib/messaging";
import { processOtpVerifiedJob } from "@/lib/automation/processor";
import {
  upsertAutomationSetting,
  AUTOMATION_TYPE_OTP_VERIFIED_WELCOME,
} from "@/lib/automation/service";
import type { QueuedJob } from "@/lib/automation/queue";
import type { OtpVerifiedPayload } from "@/lib/automation/processor";

/**
 * Automation Processor — DB integration tests (Phase 5, sections 4, 7, 8,
 * 10, 11, 12, 13).
 *
 * This file is GATED — only runs when RUN_AUTOMATION_INTEGRATION=1 AND a
 * TEST_DATABASE_URL is supplied. Generic `bun run test` skips this file
 * silently. Mirrors the gate pattern of src/lib/messaging/service.test.ts
 * (RUN_MESSAGING_INTEGRATION).
 *
 * The Phase 4 messaging layer (sendTransactionalEmail + SmtpEmailProvider)
 * is MOCKED at the module level — we never make a real SMTP call. The
 * processor.ts internally constructs `new SmtpEmailProvider()`, but since
 * sendTransactionalEmail is mocked, the provider instance is never actually
 * used. SmtpEmailProvider is also mocked so its constructor (which would
 * otherwise call createMailTransport()) is a no-op.
 *
 * Coverage (per task spec):
 *
 * Contact sync (sections 7, 8):
 * - processOtpVerifiedJob on a user with no existing Contact → creates
 *   Contact with source="otp"
 * - processOtpVerifiedJob when Contact already exists → reuses it, does NOT
 *   overwrite name/attributes/marketingStatus/source
 * - processOtpVerifiedJob adds ContactEvent type="otp.verified" with
 *   detail.environment
 * - same job retried → ContactEvent NOT duplicated (idempotent via
 *   requestId = "otp_verified:<otpCodeId>")
 * - Contact normalization: email is lowercased/trimmed
 * - P2002 race on Contact creation → handled (fetches existing, no failure)
 *
 * Automation (sections 10, 11, 12):
 * - automation missing (no AutomationSetting) → job completes, no email sent
 * - automation disabled → job completes, no email sent
 * - automation enabled + compatible template → sendTransactionalEmail called
 *   once with correct variables (email + name if contact has name)
 * - automation enabled + incompatible template (requires vars not in
 *   [email,name]) → job marked FAILED (permanent), no email sent
 * - automation enabled + template deleted → job marked as failed
 * - automation enabled + cross-tenant template → setting.resolveConfig
 *   finds template not owned → compatible=false → job fails
 * - same job retried after successful send → sendTransactionalEmail returns
 *   replay=true → job completes, NO second send
 * - messaging failure (status=failed, errorCode=provider_error) → job
 *   RETRIED (transient)
 * - messaging failure (status=failed, errorCode=configuration_error) → job
 *   FAILED permanently
 * - messaging failure does NOT undo Contact sync or ContactEvent
 * - messaging quota exhaustion (MessagingQuotaError thrown) → job RETRIED
 *   (transient — resets next period)
 *
 * Error classification:
 * - isTransientError called correctly for various error types
 */

// ---- Mocks (hoisted by vitest before imports) -----------------------------
//
// Mock the Phase 4 messaging module so we never make a real SMTP call and
// the SmtpEmailProvider constructor is a no-op (avoids createMailTransport
// env-var lookups). Error classes (MessagingValidationError,
// MessagingQuotaError, IdempotencyConflictError) are preserved via
// `...real` so instanceof checks in processor.ts still work.
vi.mock("@/lib/messaging", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/messaging")>();
  return {
    ...real,
    sendTransactionalEmail: vi.fn(),
    SmtpEmailProvider: vi.fn(),
  };
});

// ---- Gate: skip silently when RUN_AUTOMATION_INTEGRATION is not set ------

const RUN = process.env.RUN_AUTOMATION_INTEGRATION === "1";

describe.skipIf(!RUN)("Automation Processor — DB integration", () => {
  let userA: number;
  let userB: number;
  let setupComplete = false;
  let otpCounter = 10_000;

  beforeAll(async () => {
    await db.$queryRaw`SELECT 1`;

    // Clean up any leftover test data from previous runs.
    await db.emailMessage.deleteMany({
      where: { user: { email: { contains: "proc-test-" } } },
    });
    await db.contactEvent.deleteMany({
      where: { contact: { user: { email: { contains: "proc-test-" } } } },
    });
    await db.contact.deleteMany({
      where: { user: { email: { contains: "proc-test-" } } },
    });
    await db.automationSetting.deleteMany({
      where: { user: { email: { contains: "proc-test-" } } },
    });
    await db.jobQueue.deleteMany({
      where: { user: { email: { contains: "proc-test-" } } },
    });
    await db.transactionalTemplateVersion.deleteMany({
      where: { template: { user: { email: { contains: "proc-test-" } } } },
    });
    await db.transactionalTemplate.deleteMany({
      where: { user: { email: { contains: "proc-test-" } } },
    });
    await db.user.deleteMany({
      where: { email: { contains: "proc-test-" } },
    });

    const a = await db.user.create({
      data: {
        email: "proc-test-a@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userA = a.id;

    const b = await db.user.create({
      data: {
        email: "proc-test-b@nixify-test.com",
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

    // Reset the messaging mock between tests.
    vi.mocked(sendTransactionalEmail).mockReset();

    // Clean tables between tests so dedupeKey hashes, Contact fixtures,
    // and AutomationSetting state don't bleed across tests.
    await db.emailMessage.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contactEvent.deleteMany({
      where: { contact: { userId: { in: [userA, userB] } } },
    });
    await db.contact.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.automationSetting.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.jobQueue.deleteMany({
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
    await db.emailMessage.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contactEvent.deleteMany({
      where: { contact: { userId: { in: [userA, userB] } } },
    });
    await db.contact.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.automationSetting.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.jobQueue.deleteMany({
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

  // ---- Helpers -----------------------------------------------------------

  /** Build a valid OtpVerifiedPayload. Each call uses a fresh otpCodeId. */
  function buildPayload(opts: {
    email: string;
    userId?: number;
    environment?: string | null;
    purpose?: string;
  }): OtpVerifiedPayload {
    otpCounter += 1;
    return {
      otpCodeId: otpCounter,
      userId: opts.userId ?? userA,
      email: opts.email,
      environment: opts.environment !== undefined ? opts.environment : "production",
      purpose: opts.purpose ?? "signup",
    };
  }

  /**
   * Insert a JobQueue row in 'processing' state matching what claimJobs would
   * have produced. The processor expects the job to already be in
   * 'processing' state when processOtpVerifiedJob is invoked.
   */
  async function makeProcessingJob(
    payload: OtpVerifiedPayload,
  ): Promise<{ row: Awaited<ReturnType<typeof db.jobQueue.create>>; queuedJob: QueuedJob }> {
    const row = await db.jobQueue.create({
      data: {
        jobId: randomUUID(),
        userId: payload.userId,
        type: "otp_verified",
        status: "processing",
        payload: payload as any,
        dedupeKey: `otp_verified:${payload.otpCodeId}`,
        attempts: 1,
        maxAttempts: 5,
        lockedAt: new Date(),
        lockedBy: "test-worker",
      },
    });
    return { row, queuedJob: row as unknown as QueuedJob };
  }

  /** Reset a completed/failed job back to 'processing' for retry-style tests. */
  async function resetToProcessing(jobId: number): Promise<void> {
    await db.jobQueue.update({
      where: { id: jobId },
      data: {
        status: "processing",
        completedAt: null,
        failedAt: null,
        lastError: null,
        lockedAt: new Date(),
        lockedBy: "test-worker-retry",
      },
    });
  }

  /** Default successful send result. */
  function sentResult(messageId: string = "msg-" + randomUUID()): SendResult {
    return { messageId, status: "sent", replay: false, created: true };
  }

  /** Create a compatible template requiring only {{email}} or {{name}}. */
  async function createCompatibleTemplate(opts: {
    userId?: number;
    slug?: string;
    subject?: string;
    html?: string;
  } = {}): Promise<{ id: number; slug: string }> {
    const userId = opts.userId ?? userA;
    const slug = opts.slug ?? "welcome-" + randomUUID().slice(0, 8);
    const created = await createTemplate(userId, {
      name: "Welcome Email",
      slug,
      subject: opts.subject ?? "Hi {{email}}!",
      html: opts.html ?? "<p>Welcome {{email}}</p>",
    });
    return { id: created.template.id, slug };
  }

  // ---- Contact sync: section 7 ------------------------------------------

  it("processOtpVerifiedJob on a user with no existing Contact → creates Contact with source=otp", async () => {
    const payload = buildPayload({ email: "newcontact@example.com" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    const contact = await db.contact.findUnique({
      where: { userId_email: { userId: userA, email: "newcontact@example.com" } },
    });
    expect(contact).not.toBeNull();
    expect(contact!.source).toBe("otp");
    expect(contact!.email).toBe("newcontact@example.com");
    expect(contact!.name).toBeNull();
    expect(contact!.marketingStatus).toBe("unknown"); // default

    // Job completes (no automation setting → no email).
    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("completed");
  });

  it("processOtpVerifiedJob when Contact already exists → reuses it, does NOT overwrite name/attributes/marketingStatus/source", async () => {
    const email = "existing@example.com";
    // Pre-create a Contact with rich fields via the contacts service.
    await upsertContact(userA, {
      email,
      name: "Alice Original",
      attributes: { plan: "pro", signup_date: "2026-01-01" },
    });
    // Manually upgrade marketingStatus (the service default is "unknown").
    await db.contact.update({
      where: { userId_email: { userId: userA, email } },
      data: {
        marketingStatus: "subscribed",
        marketingConsentSource: "dashboard",
        marketingConsentAt: new Date(),
      },
    });

    const before = await db.contact.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(before!.source).toBe("api");
    expect(before!.marketingStatus).toBe("subscribed");

    const payload = buildPayload({ email });
    const { queuedJob } = await makeProcessingJob(payload);
    await processOtpVerifiedJob(queuedJob);

    const after = await db.contact.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(after!.id).toBe(before!.id);
    expect(after!.name).toBe("Alice Original"); // preserved
    expect(after!.source).toBe("api"); // NOT overwritten with "otp"
    expect(after!.marketingStatus).toBe("subscribed"); // preserved
    expect(after!.marketingConsentSource).toBe("dashboard"); // preserved
    expect(after!.attributes).toEqual({
      plan: "pro",
      signup_date: "2026-01-01",
    }); // preserved
  });

  it("processOtpVerifiedJob adds ContactEvent type=otp.verified with detail.environment", async () => {
    const email = "event@example.com";
    const payload = buildPayload({ email, environment: "production" });
    const { queuedJob } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    const contact = await db.contact.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(contact).not.toBeNull();

    const events = await db.contactEvent.findMany({
      where: { contactId: contact!.id, type: "otp.verified" },
    });
    expect(events.length).toBe(1);
    const detail = events[0].detail as Record<string, unknown>;
    expect(detail.environment).toBe("production");
    expect(events[0].requestId).toBe(`otp_verified:${payload.otpCodeId}`);
  });

  it("processOtpVerifiedJob adds ContactEvent with detail.environment=null when environment is null", async () => {
    const email = "event-null@example.com";
    const payload = buildPayload({ email, environment: null });
    const { queuedJob } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    const contact = await db.contact.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    const events = await db.contactEvent.findMany({
      where: { contactId: contact!.id, type: "otp.verified" },
    });
    expect(events.length).toBe(1);
    const detail = events[0].detail as Record<string, unknown> | null;
    // The processor passes { environment: null } — JSON persists as null.
    expect(detail).not.toBeNull();
    expect((detail as Record<string, unknown>).environment).toBeNull();
  });

  it("same job retried → ContactEvent NOT duplicated (idempotent via requestId = otp_verified:<otpCodeId>)", async () => {
    const email = "idem-event@example.com";
    const payload = buildPayload({ email });
    const { queuedJob, row } = await makeProcessingJob(payload);

    // First processing run.
    await processOtpVerifiedJob(queuedJob);
    // Reset the job (simulating a retry — e.g. transient failure recovery).
    await resetToProcessing(row.id);
    // Second processing run with the same otpCodeId.
    await processOtpVerifiedJob(queuedJob);

    const contact = await db.contact.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(contact).not.toBeNull();

    // Exactly ONE otp.verified event — the second run was a no-op for events.
    const events = await db.contactEvent.findMany({
      where: { contactId: contact!.id, type: "otp.verified" },
    });
    expect(events.length).toBe(1);
  });

  it("Contact normalization: email is lowercased and trimmed", async () => {
    const email = "  MixedCase@Example.COM  ";
    const payload = buildPayload({ email });
    const { queuedJob } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    const contact = await db.contact.findUnique({
      where: {
        userId_email: {
          userId: userA,
          email: "mixedcase@example.com",
        },
      },
    });
    expect(contact).not.toBeNull();
    expect(contact!.email).toBe("mixedcase@example.com");
  });

  it("P2002 race on Contact creation → handled (fetches existing, no failure)", async () => {
    // Two jobs for the same email processed concurrently → second hits P2002
    // on Contact.create. The processor must handle this gracefully (fetch
    // the existing Contact and continue) rather than failing the job.
    const email = "race@example.com";
    const payload1 = buildPayload({ email });
    const payload2 = buildPayload({ email });
    const job1 = await makeProcessingJob(payload1);
    const job2 = await makeProcessingJob(payload2);

    await Promise.all([
      processOtpVerifiedJob(job1.queuedJob),
      processOtpVerifiedJob(job2.queuedJob),
    ]);

    // Exactly ONE Contact exists (the race was handled).
    const contacts = await db.contact.findMany({
      where: { userId: userA, email },
    });
    expect(contacts.length).toBe(1);

    // Both jobs completed successfully (no automation setting → no email).
    const fresh1 = await db.jobQueue.findUnique({ where: { id: job1.row.id } });
    const fresh2 = await db.jobQueue.findUnique({ where: { id: job2.row.id } });
    expect(fresh1!.status).toBe("completed");
    expect(fresh2!.status).toBe("completed");
  });

  // ---- Automation: sections 10, 11, 12 ----------------------------------

  it("automation missing (no AutomationSetting) → job completes successfully, no email sent", async () => {
    // No AutomationSetting created for userA.
    const payload = buildPayload({ email: "noauto@example.com" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    expect(vi.mocked(sendTransactionalEmail)).not.toHaveBeenCalled();
    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("completed");
    expect(fresh!.completedAt).toBeInstanceOf(Date);
  });

  it("automation disabled (enabled=false) → job completes successfully, no email sent", async () => {
    const tmpl = await createCompatibleTemplate({ slug: "auto-disabled-tmpl" });
    await upsertAutomationSetting(userA, {
      enabled: false,
      templateId: tmpl.id,
    });

    const payload = buildPayload({ email: "disabled@example.com" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    expect(vi.mocked(sendTransactionalEmail)).not.toHaveBeenCalled();
    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("completed");
  });

  it("automation enabled + compatible template → sendTransactionalEmail called once with correct variables (email only, no name)", async () => {
    const tmpl = await createCompatibleTemplate({
      slug: "compat-email-only",
      subject: "Welcome {{email}}",
      html: "<p>Hi {{email}}</p>",
    });
    await upsertAutomationSetting(userA, {
      enabled: true,
      templateId: tmpl.id,
    });

    vi.mocked(sendTransactionalEmail).mockResolvedValue(sentResult());

    const email = "welcome@example.com";
    const payload = buildPayload({ email, environment: "production" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    expect(vi.mocked(sendTransactionalEmail)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendTransactionalEmail).mock.calls[0][0];
    expect(call.userId).toBe(userA);
    expect(call.to).toBe(email);
    expect(call.templateSlug).toBe(tmpl.slug);
    expect(call.variables).toEqual({ email }); // only email — Contact has no name
    expect(call.idempotencyKey).toBe(
      `automation:otp_verified_welcome:${payload.otpCodeId}`,
    );
    expect(call.source).toBe("api_v1");
    expect(call.environment).toBe("production");

    // Job completed after a successful send.
    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("completed");
  });

  it("automation enabled + contact has name → variables include both email and name", async () => {
    const tmpl = await createCompatibleTemplate({
      slug: "compat-named",
      subject: "Hi {{name}}!",
      html: "<p>Welcome {{name}}</p>",
    });
    await upsertAutomationSetting(userA, {
      enabled: true,
      templateId: tmpl.id,
    });

    vi.mocked(sendTransactionalEmail).mockResolvedValue(sentResult());

    const email = "named@example.com";
    // Pre-create a Contact with a name (the processor should pick this up
    // and include it in the variables).
    await upsertContact(userA, { email, name: "Bob Builder" });

    const payload = buildPayload({ email });
    const { queuedJob } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    expect(vi.mocked(sendTransactionalEmail)).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendTransactionalEmail).mock.calls[0][0];
    expect(call.variables).toEqual({ email, name: "Bob Builder" });
  });

  it("automation enabled + incompatible template (requires {{order_id}}) → job FAILED, no email sent", async () => {
    // Template requires a variable NOT in built-in [email, name].
    const created = await createTemplate(userA, {
      name: "Incompatible",
      slug: "incompat-" + randomUUID().slice(0, 8),
      subject: "Order {{order_id}}",
      html: "<p>Order #{{order_id}}</p>",
    });
    await upsertAutomationSetting(userA, {
      enabled: true,
      templateId: created.template.id,
    });

    const payload = buildPayload({ email: "incompat@example.com" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    expect(vi.mocked(sendTransactionalEmail)).not.toHaveBeenCalled();
    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("failed");
    expect(fresh!.failedAt).toBeInstanceOf(Date);
    expect(fresh!.lastError).toContain("automation_incompatible");
    expect(fresh!.lastError).toContain("order_id");
  });

  it("automation enabled + template deleted → job marked as failed", async () => {
    const tmpl = await createCompatibleTemplate({
      slug: "will-delete-" + randomUUID().slice(0, 8),
    });
    await upsertAutomationSetting(userA, {
      enabled: true,
      templateId: tmpl.id,
    });

    // Delete the template. The schema's onDelete:SetNull cascade will null
    // out AutomationSetting.templateId. The processor then sees
    // setting.templateId === null and fails the job with "no template
    // configured".
    await db.transactionalTemplate.delete({ where: { id: tmpl.id } });

    const payload = buildPayload({ email: "deleted@example.com" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    expect(vi.mocked(sendTransactionalEmail)).not.toHaveBeenCalled();
    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("failed");
    expect(fresh!.lastError).toContain("no template configured");
  });

  it("automation enabled + cross-tenant template → setting.resolveConfig finds template not owned → compatible=false → job fails", async () => {
    // Create a template owned by userB.
    const tmpl = await createCompatibleTemplate({
      userId: userB,
      slug: "b-private-" + randomUUID().slice(0, 8),
    });

    // Manually insert an AutomationSetting for userA pointing to userB's
    // template (bypass upsertAutomationSetting's tenant validation).
    await db.automationSetting.create({
      data: {
        userId: userA,
        type: AUTOMATION_TYPE_OTP_VERIFIED_WELCOME,
        enabled: true,
        templateId: tmpl.id,
      },
    });

    const payload = buildPayload({ email: "cross-tenant@example.com" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    // resolveConfig calls getTemplate(userA, userB's templateId) → null
    // (cross-tenant) → compatible=false → failJob.
    expect(vi.mocked(sendTransactionalEmail)).not.toHaveBeenCalled();
    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("failed");
  });

  it("automation enabled + no template configured (templateId=null) → job failed", async () => {
    // Enabled but templateId is null.
    await upsertAutomationSetting(userA, {
      enabled: true,
      templateId: null,
    });

    const payload = buildPayload({ email: "notmpl@example.com" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    expect(vi.mocked(sendTransactionalEmail)).not.toHaveBeenCalled();
    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("failed");
    expect(fresh!.lastError).toContain("no template configured");
  });

  // ---- Messaging idempotency on retry -----------------------------------

  it("same job retried after a successful send → replay=true → job completes, NO second send", async () => {
    const tmpl = await createCompatibleTemplate({
      slug: "replay-" + randomUUID().slice(0, 8),
    });
    await upsertAutomationSetting(userA, {
      enabled: true,
      templateId: tmpl.id,
    });

    const messageId = "msg-replay-" + randomUUID();
    // First call: real send. Second call: Phase 4 idempotency replay.
    vi.mocked(sendTransactionalEmail)
      .mockResolvedValueOnce({
        messageId,
        status: "sent",
        replay: false,
        created: true,
      })
      .mockResolvedValueOnce({
        messageId,
        status: "sent",
        replay: true,
        created: false,
      });

    const email = "replay@example.com";
    const payload = buildPayload({ email });
    const { queuedJob, row } = await makeProcessingJob(payload);

    // First processing — real send + complete.
    await processOtpVerifiedJob(queuedJob);
    const after1 = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(after1!.status).toBe("completed");

    // Simulate retry: reset job back to processing.
    await resetToProcessing(row.id);

    // Second processing — replay (no new send, no quota consumption).
    await processOtpVerifiedJob(queuedJob);

    // Exactly 2 calls to sendTransactionalEmail — one per job invocation.
    expect(vi.mocked(sendTransactionalEmail)).toHaveBeenCalledTimes(2);

    // Both calls used the SAME deterministic idempotency key (derived from
    // otpCodeId) — that's how Phase 4 knows it's a replay.
    const key1 = vi.mocked(sendTransactionalEmail).mock.calls[0][0].idempotencyKey;
    const key2 = vi.mocked(sendTransactionalEmail).mock.calls[1][0].idempotencyKey;
    expect(key1).toBe(key2);
    expect(key1).toBe(`automation:otp_verified_welcome:${payload.otpCodeId}`);

    // Job is completed after the replay.
    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("completed");
  });

  // ---- Messaging failure handling ---------------------------------------

  it("messaging failure (status=failed, errorCode=provider_error) → job RETRIED (transient)", async () => {
    const tmpl = await createCompatibleTemplate({
      slug: "provider-fail-" + randomUUID().slice(0, 8),
    });
    await upsertAutomationSetting(userA, {
      enabled: true,
      templateId: tmpl.id,
    });

    vi.mocked(sendTransactionalEmail).mockResolvedValue({
      messageId: "msg-fail-provider",
      status: "failed",
      replay: false,
      created: true,
      errorCode: "provider_error",
      errorMessage: "Email provider delivery failed.",
    });

    const payload = buildPayload({ email: "providerfail@example.com" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("pending"); // retried with backoff
    expect(fresh!.availableAt.getTime()).toBeGreaterThan(Date.now()); // backoff applied
    expect(fresh!.lockedAt).toBeNull();
    expect(fresh!.lockedBy).toBeNull();
    expect(fresh!.lastError).toContain("provider_error");
    expect(fresh!.failedAt).toBeNull();
  });

  it("messaging failure (status=failed, errorCode=configuration_error) → job FAILED permanently", async () => {
    const tmpl = await createCompatibleTemplate({
      slug: "config-fail-" + randomUUID().slice(0, 8),
    });
    await upsertAutomationSetting(userA, {
      enabled: true,
      templateId: tmpl.id,
    });

    vi.mocked(sendTransactionalEmail).mockResolvedValue({
      messageId: "msg-fail-config",
      status: "failed",
      replay: false,
      created: true,
      errorCode: "configuration_error",
      errorMessage: "Email provider configuration error.",
    });

    const payload = buildPayload({ email: "configfail@example.com" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("failed");
    expect(fresh!.failedAt).toBeInstanceOf(Date);
    expect(fresh!.lastError).toContain("configuration_error");
  });

  it("messaging failure (status=rejected, errorCode=quota_exhausted) → job RETRIED (transient)", async () => {
    const tmpl = await createCompatibleTemplate({
      slug: "quota-fail-" + randomUUID().slice(0, 8),
    });
    await upsertAutomationSetting(userA, {
      enabled: true,
      templateId: tmpl.id,
    });

    // The service returns status="rejected" + errorCode="quota_exhausted"
    // when the messaging service persists a quota-denied row. The processor
    // classifies quota_exhausted as transient → retryJob.
    vi.mocked(sendTransactionalEmail).mockResolvedValue({
      messageId: "msg-quota",
      status: "rejected",
      replay: false,
      created: true,
      errorCode: "quota_exhausted",
      errorMessage: "Quota exhausted.",
    });

    const payload = buildPayload({ email: "quotafail@example.com" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("pending"); // retried
    expect(fresh!.lastError).toContain("quota_exhausted");
  });

  it("messaging failure does NOT undo Contact sync or ContactEvent (they remain)", async () => {
    const tmpl = await createCompatibleTemplate({
      slug: "no-undo-" + randomUUID().slice(0, 8),
    });
    await upsertAutomationSetting(userA, {
      enabled: true,
      templateId: tmpl.id,
    });

    vi.mocked(sendTransactionalEmail).mockResolvedValue({
      messageId: "msg-fail-no-undo",
      status: "failed",
      replay: false,
      created: true,
      errorCode: "provider_error",
      errorMessage: "Email provider delivery failed.",
    });

    const email = "noundo@example.com";
    const payload = buildPayload({ email });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    // Contact still exists (was created BEFORE the messaging failure).
    const contact = await db.contact.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(contact).not.toBeNull();
    expect(contact!.source).toBe("otp");

    // ContactEvent("otp.verified") still exists — not rolled back.
    const events = await db.contactEvent.findMany({
      where: { contactId: contact!.id, type: "otp.verified" },
    });
    expect(events.length).toBe(1);

    // Job is retried (pending) — NOT completed, NOT failed.
    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("pending");
  });

  it("messaging quota exhaustion (MessagingQuotaError thrown) → job RETRIED (transient — resets next period)", async () => {
    const tmpl = await createCompatibleTemplate({
      slug: "quota-thrown-" + randomUUID().slice(0, 8),
    });
    await upsertAutomationSetting(userA, {
      enabled: true,
      templateId: tmpl.id,
    });

    // The messaging service THROWS MessagingQuotaError (not returns) when
    // checkUsage denies. The processor catches it and routes to retryJob.
    vi.mocked(sendTransactionalEmail).mockRejectedValue(
      new MessagingQuotaError("quota_exhausted", "MESSAGING_EMAILS quota exhausted."),
    );

    const payload = buildPayload({ email: "quota-thrown@example.com" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("pending"); // retried
    expect(fresh!.lastError).toContain("quota_exhausted");
    expect(fresh!.lastError).toContain("quota_exhausted");
    expect(fresh!.failedAt).toBeNull();
  });

  // ---- Error classification --------------------------------------------

  it("unknown transient error (generic Error) → job RETRIED via isTransientError=true path", async () => {
    const tmpl = await createCompatibleTemplate({
      slug: "transient-" + randomUUID().slice(0, 8),
    });
    await upsertAutomationSetting(userA, {
      enabled: true,
      templateId: tmpl.id,
    });

    // A generic Error (not MessagingValidationError/QuotaError/Conflict)
    // whose message does NOT contain a permanent marker → isTransientError
    // returns true → retryJob.
    vi.mocked(sendTransactionalEmail).mockRejectedValue(
      new Error("DB connection lost"),
    );

    const payload = buildPayload({ email: "transient@example.com" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("pending"); // retried
    expect(fresh!.lastError).toContain("database_error");
  });

  it("permanent error (message contains 'template_not_found') → job FAILED via isTransientError=false path", async () => {
    const tmpl = await createCompatibleTemplate({
      slug: "perm-" + randomUUID().slice(0, 8),
    });
    await upsertAutomationSetting(userA, {
      enabled: true,
      templateId: tmpl.id,
    });

    // A generic Error whose message contains "template_not_found" —
    // isTransientError returns false → failJob.
    vi.mocked(sendTransactionalEmail).mockRejectedValue(
      new Error("template_not_found: bad slug"),
    );

    const payload = buildPayload({ email: "perm@example.com" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("failed");
    expect(fresh!.failedAt).toBeInstanceOf(Date);
  });

  it("MessagingValidationError thrown → job FAILED permanently (validation failures don't retry)", async () => {
    const tmpl = await createCompatibleTemplate({
      slug: "val-err-" + randomUUID().slice(0, 8),
    });
    await upsertAutomationSetting(userA, {
      enabled: true,
      templateId: tmpl.id,
    });

    vi.mocked(sendTransactionalEmail).mockRejectedValue(
      new MessagingValidationError(
        "missing_template_variables",
        "Template requires variable 'name' which was not provided.",
      ),
    );

    const payload = buildPayload({ email: "valerr@example.com" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("failed");
    expect(fresh!.lastError).toContain("validation_error");
    expect(fresh!.lastError).toContain("missing_template_variables");
  });

  it("IdempotencyConflictError thrown → job FAILED permanently (automation config changed mid-flight)", async () => {
    const tmpl = await createCompatibleTemplate({
      slug: "idem-conflict-" + randomUUID().slice(0, 8),
    });
    await upsertAutomationSetting(userA, {
      enabled: true,
      templateId: tmpl.id,
    });

    vi.mocked(sendTransactionalEmail).mockRejectedValue(
      new IdempotencyConflictError(),
    );

    const payload = buildPayload({ email: "idem-conflict@example.com" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("failed");
    expect(fresh!.lastError).toContain("configuration_error");
  });

  // ---- Combined: Contact sync happens even when automation fails --------

  it("automation permanent failure still leaves Contact + ContactEvent in place", async () => {
    // Incompatible template → permanent failure. But the Contact sync +
    // ContactEvent from the earlier steps of processOtpVerifiedJob must
    // remain (they happen BEFORE the automation send).
    const created = await createTemplate(userA, {
      name: "Incompat Combined",
      slug: "incompat-combined-" + randomUUID().slice(0, 8),
      subject: "Order {{order_id}}",
      html: "<p>{{order_id}}</p>",
    });
    await upsertAutomationSetting(userA, {
      enabled: true,
      templateId: created.template.id,
    });

    const email = "combined@example.com";
    const payload = buildPayload({ email, environment: "production" });
    const { queuedJob, row } = await makeProcessingJob(payload);

    await processOtpVerifiedJob(queuedJob);

    // Job is failed (permanent config failure).
    const fresh = await db.jobQueue.findUnique({ where: { id: row.id } });
    expect(fresh!.status).toBe("failed");

    // But Contact was still created.
    const contact = await db.contact.findUnique({
      where: { userId_email: { userId: userA, email } },
    });
    expect(contact).not.toBeNull();
    expect(contact!.source).toBe("otp");

    // And ContactEvent("otp.verified") was still recorded.
    const events = await db.contactEvent.findMany({
      where: { contactId: contact!.id, type: "otp.verified" },
    });
    expect(events.length).toBe(1);

    // And sendTransactionalEmail was NEVER called (the failure was caught
    // before the send step).
    expect(vi.mocked(sendTransactionalEmail)).not.toHaveBeenCalled();
  });
});
