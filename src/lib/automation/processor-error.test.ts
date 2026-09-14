import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Automation processor error classification + processOtpVerifiedJob (Phase 5).
 *
 * Pure unit tests for:
 *   - isTransientError (the queue's error classifier — sections 12, 13).
 *   - processOtpVerifiedJob end-to-end error handling paths (sections 7, 8, 10,
 *     11, 12 — Contact sync + ContactEvent + send + classify).
 *
 * Everything is mocked — no DB, no real messaging, no real contacts service.
 * The real isTransientError function IS exercised (we use importOriginal to
 * preserve it). This runs in the generic CI job.
 *
 * Mock strategy:
 *   vi.mock("@/lib/automation/queue", async (importOriginal) => {
 *     const real = await importOriginal();
 *     return { ...real, completeJob: vi.fn(), failJob: vi.fn(), retryJob: vi.fn() };
 *   })
 * This preserves the REAL isTransientError + STALE_LOCK_TIMEOUT_MS + types
 * (so they can be tested directly) while stubbing the lifecycle mutators
 * the processor calls.
 *
 * Coverage:
 * - isTransientError:
 *     - template_not_found → false (permanent)
 *     - missing_template_variables → false (permanent)
 *     - feature_not_available → false (permanent)
 *     - configuration_error → false (permanent)
 *     - invalid_subject → false (permanent)
 *     - validation_failed → false (permanent)
 *     - generic Error → true (transient)
 *     - provider_error (Error msg) → true (transient)
 *     - non-Error (string/null) → true (default transient)
 * - processOtpVerifiedJob:
 *     - automation missing (null) → completeJob
 *     - automation disabled → completeJob
 *     - enabled + no template → failJob
 *     - enabled + compatible:false → failJob
 *     - enabled + compatible + send succeeds → completeJob
 *     - enabled + compatible + send replay → completeJob
 *     - send returns failed + provider_error → retryJob (transient)
 *     - send returns failed + configuration_error → failJob (permanent)
 *     - send returns failed + rate_limited → retryJob (transient)
 *     - send returns failed + quota_exhausted → retryJob (transient)
 *     - send throws MessagingValidationError("template_not_found") → failJob
 *     - send throws MessagingValidationError("missing_template_variables") → failJob
 *     - send throws MessagingQuotaError → retryJob (transient — resets next period)
 *     - send throws IdempotencyConflictError → failJob (permanent config drift)
 *     - send throws generic Error("provider_error") → retryJob (transient)
 *     - send throws generic Error("template_not_found") → failJob (permanent)
 *     - upsertContact P2002 race → falls back to db.contact.findUnique → continues
 *     - ContactEvent idempotency: existing event → addContactEvent NOT called
 */

// ---- Mocks (must come BEFORE the processor import) -------------------------

// Mock the entitlements engine — canAccess is non-consuming.
// Default: both CONTACTS and AUTOMATIONS allowed.
vi.mock("@/lib/entitlements/engine", () => ({
  canAccess: vi.fn().mockResolvedValue({ allowed: true, plan: "PRO" }),
  getUserPlan: vi.fn().mockResolvedValue("PRO"),
  checkUsage: vi.fn(),
  peekUsage: vi.fn(),
}));

// Mock the entitlements config (real constants).
vi.mock("@/lib/entitlements/config", async (importOriginal) => {
  const real = await importOriginal();
  return real;
});

vi.mock("@/lib/db", () => ({
  db: {
    contact: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    contactEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    transactionalTemplate: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock the contacts service. We stub the persistence functions but provide
// real-ish stubs for the re-exports the processor might touch (normalizeEmail).
vi.mock("@/lib/contacts", () => ({
  upsertContact: vi.fn(),
  addContactEvent: vi.fn(),
  listContacts: vi.fn(),
  getContactById: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  getContactTimeline: vi.fn(),
  ContactValidationError: class ContactValidationError extends Error {
    constructor(msg: string) { super(msg); this.name = "ContactValidationError"; }
  },
  CONTACT_SOURCES: { API: "api", DASHBOARD: "dashboard", OTP_VERIFIED: "otp_verified", IMPORT: "import" },
  MAX_NAME_LENGTH: 200,
  isValidEmail: vi.fn(() => true),
  normalizeEmail: vi.fn((e: string) => e.trim().toLowerCase()),
  validateAttributes: vi.fn(() => ({})),
  MAX_ATTRIBUTES_BYTES: 10240,
}));

// Preserve real error classes + zod schema; stub only sendTransactionalEmail +
// SmtpEmailProvider (the processor calls `new SmtpEmailProvider()`).
vi.mock("@/lib/messaging", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/messaging")>();
  return {
    ...real,
    sendTransactionalEmail: vi.fn(),
    SmtpEmailProvider: vi.fn(),
  };
});

// Preserve real AUTOMATION_TYPE_OTP_VERIFIED_WELCOME + BUILT_IN_VARIABLES +
// AutomationConfigError; stub only getAutomationSetting + upsertAutomationSetting.
vi.mock("@/lib/automation/service", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/automation/service")>();
  return {
    ...real,
    getAutomationSetting: vi.fn(),
    upsertAutomationSetting: vi.fn(),
  };
});

// Preserve the REAL isTransientError + constants + types; stub only the
// lifecycle mutators (completeJob, failJob, retryJob) — the processor calls
// those, but the classifier is exercised directly by the unit tests.
vi.mock("@/lib/automation/queue", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/automation/queue")>();
  return {
    ...real,
    completeJob: vi.fn(),
    failJob: vi.fn(),
    retryJob: vi.fn(),
  };
});

import { processOtpVerifiedJob, type OtpVerifiedPayload } from "@/lib/automation/processor";
import {
  isTransientError,
  completeJob,
  failJob,
  retryJob,
  type QueuedJob,
} from "@/lib/automation/queue";
import { getAutomationSetting } from "@/lib/automation/service";
import { upsertContact, addContactEvent } from "@/lib/contacts";
import {
  sendTransactionalEmail,
  MessagingValidationError,
  MessagingQuotaError,
  IdempotencyConflictError,
} from "@/lib/messaging";
import { db } from "@/lib/db";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";

const mockedComplete = vi.mocked(completeJob);
const mockedFail = vi.mocked(failJob);
const mockedRetry = vi.mocked(retryJob);
const mockedGetSetting = vi.mocked(getAutomationSetting);
const mockedUpsertContact = vi.mocked(upsertContact);
const mockedAddEvent = vi.mocked(addContactEvent);
const mockedSend = vi.mocked(sendTransactionalEmail);
const mockedContactFindUnique = vi.mocked(db.contact.findUnique);
const mockedContactCreate = vi.mocked(db.contact.create);
const mockedEventFindFirst = vi.mocked(db.contactEvent.findFirst);
const mockedTemplateFindFirst = vi.mocked(db.transactionalTemplate.findFirst);
const mockedCanAccess = vi.mocked(canAccess);
const mockedEventCreate = vi.mocked(db.contactEvent.create);

// ---- helpers --------------------------------------------------------------

function makeJob(overrides: Partial<QueuedJob> = {}): QueuedJob {
  const payload: OtpVerifiedPayload = {
    otpCodeId: 100,
    userId: 42,
    email: "user@test.com",
    environment: null,
    purpose: "signup",
  };
  return {
    id: 1,
    jobId: "job_abc",
    userId: 42,
    type: "otp_verified",
    status: "processing",
    payload,
    dedupeKey: "otp_verified:100",
    attempts: 1,
    maxAttempts: 5,
    availableAt: new Date(),
    lockedAt: new Date(),
    lockedBy: "worker-1",
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    failedAt: null,
    ...overrides,
  };
}

function makeContactResult(overrides: {
  contact?: Partial<Record<string, unknown>>;
  created?: boolean;
  changed?: boolean;
} = {}) {
  const contactOverrides = overrides.contact ?? {};
  return {
    contact: {
      id: 5,
      userId: 42,
      email: "user@test.com",
      name: null,
      attributes: {},
      source: "otp",
      marketingStatus: "unknown",
      marketingConsentSource: null,
      marketingConsentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...contactOverrides,
    },
    created: overrides.created ?? true,
    changed: overrides.changed ?? true,
  };
}

function makeSetting(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    userId: 42,
    type: "otp_verified_welcome",
    enabled: true,
    templateId: 5,
    templateVariables: ["email"],
    compatible: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Set up the "everything passes" default mocks for the happy path. */
function setupHappyPath() {
  // Entitlement checks: both CONTACTS and AUTOMATIONS allowed by default.
  mockedCanAccess.mockResolvedValue({ allowed: true, plan: "PRO" } as any);
  // The processor now uses find-or-create (not upsertContact).
  mockedContactFindUnique.mockResolvedValue(makeContactResult().contact as any);
  mockedContactCreate.mockResolvedValue(makeContactResult().contact as any);
  // ContactEvent create: the processor uses db.contactEvent.create with dedupeKey.
  mockedEventCreate.mockResolvedValue({ id: 1 } as any);
  mockedEventFindFirst.mockResolvedValue(null); // no existing event (legacy)
  mockedAddEvent.mockResolvedValue(undefined);
  mockedGetSetting.mockResolvedValue(makeSetting() as any);
  mockedTemplateFindFirst.mockResolvedValue({ slug: "welcome" } as any);
  mockedSend.mockResolvedValue({
    messageId: "msg_1",
    status: "sent",
    replay: false,
    created: true,
  } as any);
  mockedContactFindUnique.mockResolvedValue(null);
  mockedComplete.mockResolvedValue(undefined);
  mockedFail.mockResolvedValue(undefined);
  mockedRetry.mockResolvedValue(undefined);
}

// ---- tests -----------------------------------------------------------------

describe("Automation processor — isTransientError classifier (Phase 5 §13)", () => {
  it("template_not_found → false (permanent)", () => {
    expect(isTransientError(new Error("template_not_found"))).toBe(false);
  });

  it("missing_template_variables → false (permanent)", () => {
    expect(isTransientError(new Error("missing_template_variables: order_id"))).toBe(false);
  });

  it("feature_not_available → false (permanent)", () => {
    expect(isTransientError(new Error("feature_not_available"))).toBe(false);
  });

  it("configuration_error → false (permanent)", () => {
    expect(isTransientError(new Error("configuration_error: bad template"))).toBe(false);
  });

  it("invalid_subject → false (permanent)", () => {
    expect(isTransientError(new Error("invalid_subject"))).toBe(false);
  });

  it("validation_failed → false (permanent)", () => {
    expect(isTransientError(new Error("validation_failed: missing field"))).toBe(false);
  });

  it("automation configuration invalid → false (permanent)", () => {
    expect(isTransientError(new Error("Automation configuration invalid"))).toBe(false);
  });

  it("generic Error → true (transient)", () => {
    expect(isTransientError(new Error("something went wrong"))).toBe(true);
  });

  it("provider_error (Error msg) → true (transient)", () => {
    // provider_error is a generic Error from the messaging layer — retry.
    expect(isTransientError(new Error("provider_error: SMTP timeout"))).toBe(true);
  });

  it("DB connectivity error → true (transient)", () => {
    expect(isTransientError(new Error("Connection terminated unexpectedly"))).toBe(true);
  });

  it("non-Error (string) → classified by content", () => {
    // The new classifier inspects string content for permanent keywords.
    // "provider_error" → transient (true). "template_not_found" → permanent (false).
    expect(isTransientError("provider_error")).toBe(true);
    expect(isTransientError("template_not_found")).toBe(false);
    // Unknown strings default to transient.
    expect(isTransientError("some random transient thing")).toBe(true);
  });

  it("null/undefined → true (default transient)", () => {
    expect(isTransientError(null)).toBe(true);
    expect(isTransientError(undefined)).toBe(true);
  });

  it("subclass of Error with permanent keyword → false", () => {
    class CustomConfigError extends Error {
      constructor(msg: string) { super(msg); this.name = "CustomConfigError"; }
    }
    expect(isTransientError(new CustomConfigError("template_not_found"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("Automation processor — processOtpVerifiedJob (Phase 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  // Reset entitlement defaults for each test.
  mockedCanAccess.mockResolvedValue({ allowed: true, plan: "PRO" } as any);
    setupHappyPath();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Automation configuration paths ------------------------------------

  it("automation missing (null) → completeJob (Contact sync done, no email)", async () => {
    mockedCanAccess.mockResolvedValue({ allowed: true, plan: "PRO" } as any);
    mockedGetSetting.mockResolvedValue(null);

    await processOtpVerifiedJob(makeJob());

    // Contact sync + event were still done — the job isn't a no-op.
    // The processor uses db.contact.findUnique + db.contactEvent.create.
    expect(mockedContactFindUnique).toHaveBeenCalledTimes(1);
    expect(mockedEventCreate).toHaveBeenCalledTimes(1);
    // No email was sent.
    expect(mockedSend).not.toHaveBeenCalled();
    // Job completes — there's nothing to retry.
    expect(mockedComplete).toHaveBeenCalledTimes(1);
    expect(mockedComplete).toHaveBeenCalledWith("job_abc");
    expect(mockedFail).not.toHaveBeenCalled();
    expect(mockedRetry).not.toHaveBeenCalled();
  });

  it("automation disabled (enabled:false) → completeJob", async () => {
    mockedGetSetting.mockResolvedValue(makeSetting({ enabled: false }) as any);

    await processOtpVerifiedJob(makeJob());

    expect(mockedSend).not.toHaveBeenCalled();
    expect(mockedComplete).toHaveBeenCalledTimes(1);
    expect(mockedFail).not.toHaveBeenCalled();
    expect(mockedRetry).not.toHaveBeenCalled();
  });

  it("automation enabled but no template → failJob (permanent config)", async () => {
    mockedGetSetting.mockResolvedValue(makeSetting({
      enabled: true, templateId: null,
    }) as any);

    await processOtpVerifiedJob(makeJob());

    expect(mockedSend).not.toHaveBeenCalled();
    expect(mockedFail).toHaveBeenCalledTimes(1);
    expect(mockedFail).toHaveBeenCalledWith("job_abc", expect.stringMatching(/no template/i));
    expect(mockedComplete).not.toHaveBeenCalled();
    expect(mockedRetry).not.toHaveBeenCalled();
  });

  it("automation enabled + compatible:false → failJob (incompatible variables)", async () => {
    mockedGetSetting.mockResolvedValue(makeSetting({
      enabled: true,
      templateId: 5,
      compatible: false,
      templateVariables: ["order_id"],
    }) as any);

    await processOtpVerifiedJob(makeJob());

    expect(mockedSend).not.toHaveBeenCalled();
    expect(mockedFail).toHaveBeenCalledTimes(1);
    expect(mockedFail).toHaveBeenCalledWith("job_abc", expect.stringMatching(/requires variables/i));
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  // ---- Successful send path ------------------------------------------------

  it("automation enabled + compatible + send succeeds → completeJob", async () => {
    mockedSend.mockResolvedValue({
      messageId: "msg_1",
      status: "sent",
      replay: false,
      created: true,
    } as any);

    await processOtpVerifiedJob(makeJob());

    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(mockedComplete).toHaveBeenCalledTimes(1);
    expect(mockedFail).not.toHaveBeenCalled();
    expect(mockedRetry).not.toHaveBeenCalled();
  });

  it("send returns replay=true → completeJob (Phase 4 idempotency)", async () => {
    // A replay means the same idempotency key was seen before — the email was
    // already delivered. The processor treats this as success (no double-send).
    mockedSend.mockResolvedValue({
      messageId: "msg_existing",
      status: "sent",
      replay: true,
      created: false,
    } as any);

    await processOtpVerifiedJob(makeJob());

    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(mockedComplete).toHaveBeenCalledTimes(1);
    expect(mockedRetry).not.toHaveBeenCalled();
    expect(mockedFail).not.toHaveBeenCalled();
  });

  it("send uses derived idempotency key + correct SendRequest shape", async () => {
    await processOtpVerifiedJob(makeJob());

    expect(mockedSend).toHaveBeenCalledTimes(1);
    const sendReq = mockedSend.mock.calls[0][0];
    // Idempotency key derived from otpCodeId (deterministic — safe for retry).
    expect(sendReq.idempotencyKey).toBe("automation:otp_verified_welcome:100");
    expect(sendReq.userId).toBe(42);
    expect(sendReq.to).toBe("user@test.com");
    expect(sendReq.templateSlug).toBe("welcome");
    expect(sendReq.source).toBe("api_v1");
    // email variable always provided.
    expect(sendReq.variables.email).toBe("user@test.com");
  });

  // ---- Send returned status=failed (classification via errorCode) --------

  it("send returns failed + provider_error → retryJob (transient)", async () => {
    mockedSend.mockResolvedValue({
      messageId: "msg_fail",
      status: "failed",
      replay: false,
      created: true,
      errorCode: "provider_error",
      errorMessage: "SMTP timeout",
    } as any);

    await processOtpVerifiedJob(makeJob());

    expect(mockedRetry).toHaveBeenCalledTimes(1);
    expect(mockedFail).not.toHaveBeenCalled();
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("send returns failed + configuration_error → failJob (permanent)", async () => {
    mockedSend.mockResolvedValue({
      messageId: "msg_fail",
      status: "failed",
      replay: false,
      created: false,
      errorCode: "configuration_error",
      errorMessage: "Template version missing",
    } as any);

    await processOtpVerifiedJob(makeJob());

    expect(mockedFail).toHaveBeenCalledTimes(1);
    expect(mockedRetry).not.toHaveBeenCalled();
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("send returns failed + rate_limited → retryJob (transient)", async () => {
    mockedSend.mockResolvedValue({
      messageId: "msg_fail",
      status: "failed",
      replay: false,
      created: false,
      errorCode: "rate_limited",
      errorMessage: "Too many sends",
    } as any);

    await processOtpVerifiedJob(makeJob());

    expect(mockedRetry).toHaveBeenCalledTimes(1);
    expect(mockedFail).not.toHaveBeenCalled();
  });

  it("send returns failed + quota_exhausted → retryJob (transient)", async () => {
    mockedSend.mockResolvedValue({
      messageId: "msg_fail",
      status: "failed",
      replay: false,
      created: false,
      errorCode: "quota_exhausted",
      errorMessage: "Monthly quota exceeded",
    } as any);

    await processOtpVerifiedJob(makeJob());

    expect(mockedRetry).toHaveBeenCalledTimes(1);
    expect(mockedFail).not.toHaveBeenCalled();
  });

  it("send returns failed + missing_template_variables → failJob (permanent)", async () => {
    mockedSend.mockResolvedValue({
      messageId: "msg_fail",
      status: "failed",
      replay: false,
      created: false,
      errorCode: "missing_template_variables",
      errorMessage: "Missing: order_id",
    } as any);

    await processOtpVerifiedJob(makeJob());

    expect(mockedFail).toHaveBeenCalledTimes(1);
    expect(mockedRetry).not.toHaveBeenCalled();
  });

  // ---- Send throws — classified via instanceof + isTransientError --------

  it("send throws MessagingValidationError(template_not_found) → failJob (permanent)", async () => {
    mockedSend.mockRejectedValue(
      new MessagingValidationError("template_not_found", "Template was deleted"),
    );

    await processOtpVerifiedJob(makeJob());

    expect(mockedFail).toHaveBeenCalledTimes(1);
    expect(mockedRetry).not.toHaveBeenCalled();
  });

  it("send throws MessagingValidationError(missing_template_variables) → failJob", async () => {
    mockedSend.mockRejectedValue(
      new MessagingValidationError("missing_template_variables", "Missing: order_id"),
    );

    await processOtpVerifiedJob(makeJob());

    expect(mockedFail).toHaveBeenCalledTimes(1);
    expect(mockedRetry).not.toHaveBeenCalled();
  });

  it("send throws MessagingValidationError(invalid_subject) → failJob", async () => {
    mockedSend.mockRejectedValue(
      new MessagingValidationError("invalid_subject", "CR/LF in subject"),
    );

    await processOtpVerifiedJob(makeJob());

    expect(mockedFail).toHaveBeenCalledTimes(1);
    expect(mockedRetry).not.toHaveBeenCalled();
  });

  it("send throws MessagingQuotaError → retryJob (transient — resets next period)", async () => {
    mockedSend.mockRejectedValue(
      new MessagingQuotaError("quota_exhausted", "Monthly messaging quota exceeded."),
    );

    await processOtpVerifiedJob(makeJob());

    expect(mockedRetry).toHaveBeenCalledTimes(1);
    expect(mockedFail).not.toHaveBeenCalled();
  });

  it("send throws IdempotencyConflictError → failJob (permanent config drift)", async () => {
    // Same idempotency key with a different body — config changed mid-flight.
    // This is permanent — retrying won't help.
    mockedSend.mockRejectedValue(new IdempotencyConflictError());

    await processOtpVerifiedJob(makeJob());

    expect(mockedFail).toHaveBeenCalledTimes(1);
    expect(mockedFail).toHaveBeenCalledWith("job_abc", expect.stringMatching(/idempotency conflict/i));
    expect(mockedRetry).not.toHaveBeenCalled();
  });

  it("send throws generic Error(provider_error) → retryJob (transient)", async () => {
    mockedSend.mockRejectedValue(new Error("provider_error: SMTP timeout"));

    await processOtpVerifiedJob(makeJob());

    expect(mockedRetry).toHaveBeenCalledTimes(1);
    expect(mockedFail).not.toHaveBeenCalled();
  });

  it("send throws generic Error(template_not_found) → failJob (permanent)", async () => {
    mockedSend.mockRejectedValue(new Error("template_not_found: slug 'welcome'"));

    await processOtpVerifiedJob(makeJob());

    expect(mockedFail).toHaveBeenCalledTimes(1);
    expect(mockedRetry).not.toHaveBeenCalled();
  });

  it("send throws generic Error(DB connectivity) → retryJob (transient)", async () => {
    mockedSend.mockRejectedValue(new Error("Connection terminated during query"));

    await processOtpVerifiedJob(makeJob());

    expect(mockedRetry).toHaveBeenCalledTimes(1);
    expect(mockedFail).not.toHaveBeenCalled();
  });

  // ---- Contact sync idempotency ------------------------------------------

  it("upsertContact P2002 race → falls back to db.contact.findUnique → continues", async () => {
    // Race: two workers tried to create the same contact simultaneously. The
    // processor catches the P2002 and fetches the existing row.
    // The processor now uses findOrCreateContact: findUnique returns null (absent),
    // then db.contact.create throws P2002 (concurrent creation).
    mockedContactFindUnique.mockResolvedValue(null);
    mockedContactCreate.mockRejectedValue({ code: "P2002" } as any);
    // After P2002, the processor fetches the existing contact via findUnique again.
    // The second call should return the contact.
    mockedContactFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(makeContactResult().contact as any);
    mockedContactFindUnique.mockResolvedValue({
      id: 7,
      userId: 42,
      email: "user@test.com",
      name: "Alice",
      attributes: { plan: "PRO" },
      source: "dashboard",
      marketingStatus: "subscribed",
      marketingConsentSource: "signup",
      marketingConsentAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    await processOtpVerifiedJob(makeJob());

    // Looked up the existing contact.
    expect(mockedContactFindUnique).toHaveBeenCalledWith({
      where: { userId_email: { userId: 42, email: "user@test.com" } },
    });
    // The job should still complete — race was handled gracefully.
    expect(mockedComplete).toHaveBeenCalledTimes(1);
    expect(mockedFail).not.toHaveBeenCalled();
  });

  it("ContactEvent existing (P2002 on create) → idempotent, addContactEvent NOT called", async () => {
    // The processor now uses db.contactEvent.create with a unique dedupeKey.
    // A P2002 unique constraint violation means the event already exists
    // (concurrent/stale worker). The processor treats it as idempotent success.
    mockedCanAccess.mockResolvedValue({ allowed: true, plan: "PRO" } as any);
    mockedEventCreate.mockRejectedValue({ code: "P2002" } as any);

    await processOtpVerifiedJob(makeJob());

    // The processor attempted the atomic insert (create), not a findFirst.
    expect(mockedEventCreate).toHaveBeenCalledTimes(1);
    expect(mockedAddEvent).not.toHaveBeenCalled();
    // The rest of the flow proceeds normally (automation check + send).
    expect(mockedComplete).toHaveBeenCalledTimes(1);
  });

  it("uses Contact.name (when present) as the `name` variable", async () => {
    mockedContactFindUnique.mockResolvedValue(makeContactResult({
      contact: { name: "Alice" },
    }).contact as any);

    await processOtpVerifiedJob(makeJob());

    const sendReq = mockedSend.mock.calls[0][0];
    expect(sendReq.variables.name).toBe("Alice");
  });

  it("omits `name` variable when Contact has empty name", async () => {
    mockedContactFindUnique.mockResolvedValue(makeContactResult({
      contact: { name: "  " },
    }).contact as any);

    await processOtpVerifiedJob(makeJob());

    const sendReq = mockedSend.mock.calls[0][0];
    expect(sendReq.variables).not.toHaveProperty("name");
    expect(sendReq.variables.email).toBe("user@test.com");
  });
});
