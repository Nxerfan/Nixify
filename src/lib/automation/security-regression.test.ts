/**
 * Phase 5 security/correctness regression tests.
 *
 * Covers the 5 fixes required before Phase 5 merge:
 * 1. Development OTP in production → zero real email sends
 * 2. AUTOMATIONS entitlement lost at execution time → no send
 * 3. CONTACTS entitlement unavailable → no Contact/Event/send, OTP unaffected
 * 4. ContactEvent DB-enforced idempotency (concurrent insertion → exactly one)
 * 5. Raw internal error text is never persisted in JobQueue.lastError
 *
 * These are pure unit tests (no DB) — they mock the service layer + DB +
 * entitlements + messaging. They run in the generic `bun run test` job.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock entitlements engine — canAccess is non-consuming.
vi.mock("@/lib/entitlements/engine", () => ({
  canAccess: vi.fn().mockResolvedValue({ allowed: true, plan: "PRO" }),
  getUserPlan: vi.fn().mockResolvedValue("PRO"),
  checkUsage: vi.fn(),
  peekUsage: vi.fn(),
}));

// Preserve real entitlements config constants.
vi.mock("@/lib/entitlements/config", async (importOriginal) => {
  return await (importOriginal as any)();
});

// Mock the DB — the processor uses db.contact.findUnique/create,
// db.contactEvent.create (with dedupeKey), db.transactionalTemplate.findFirst.
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

// Mock the contacts service.
vi.mock("@/lib/contacts", () => ({
  addContactEvent: vi.fn(),
  normalizeEmail: vi.fn((e: string) => e.trim().toLowerCase()),
  upsertContact: vi.fn(),
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
  validateAttributes: vi.fn(() => ({})),
  MAX_ATTRIBUTES_BYTES: 10240,
}));

// Mock messaging — preserve real error classes, stub the service + provider.
vi.mock("@/lib/messaging", async (importOriginal) => {
  const real = await (importOriginal as any)();
  return {
    ...real,
    sendTransactionalEmail: vi.fn(),
    SmtpEmailProvider: vi.fn(),
  };
});

// Mock automation service — preserve real constants, stub getAutomationSetting.
vi.mock("@/lib/automation/service", async (importOriginal) => {
  const real = await (importOriginal as any)();
  return {
    ...real,
    getAutomationSetting: vi.fn(),
  };
});

// Mock automation queue — preserve real isTransientError/classifyError/safeErrorForPersistence,
// stub the persistence functions.
vi.mock("@/lib/automation/queue", async (importOriginal) => {
  const real = await (importOriginal as any)();
  return {
    ...real,
    completeJob: vi.fn(),
    failJob: vi.fn(),
    retryJob: vi.fn(),
  };
});

import { processOtpVerifiedJob, type OtpVerifiedPayload } from "@/lib/automation/processor";
import { completeJob, failJob, retryJob, classifyError, safeErrorForPersistence } from "@/lib/automation/queue";
import { getAutomationSetting } from "@/lib/automation/service";
import { sendTransactionalEmail } from "@/lib/messaging";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { db } from "@/lib/db";

const mockedComplete = vi.mocked(completeJob);
const mockedFail = vi.mocked(failJob);
const mockedRetry = vi.mocked(retryJob);
const mockedGetSetting = vi.mocked(getAutomationSetting);
const mockedSend = vi.mocked(sendTransactionalEmail);
const mockedCanAccess = vi.mocked(canAccess);
const mockedContactFindUnique = vi.mocked(db.contact.findUnique);
const mockedContactCreate = vi.mocked(db.contact.create);
const mockedEventCreate = vi.mocked(db.contactEvent.create);
const mockedTemplateFindFirst = vi.mocked(db.transactionalTemplate.findFirst);

// ---- Helpers ---------------------------------------------------------------

function makeJob(env: string | null = "production"): QueuedJobLike {
  return {
    id: 1,
    jobId: "job_abc",
    userId: 42,
    type: "otp_verified",
    status: "processing",
    payload: {
      otpCodeId: 12345,
      userId: 42,
      email: "user@test.com",
      environment: env,
      purpose: "signup",
    } as OtpVerifiedPayload,
    dedupeKey: "otp_verified:12345",
    attempts: 1,
    maxAttempts: 5,
    availableAt: new Date(),
    lockedAt: new Date(),
    lockedBy: "test-worker",
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
    failedAt: null,
  } as any;
}

interface QueuedJobLike {
  id: number; jobId: string; userId: number; type: string; status: string;
  payload: unknown; dedupeKey: string | null; attempts: number; maxAttempts: number;
  availableAt: Date; lockedAt: Date | null; lockedBy: string | null;
  lastError: string | null; createdAt: Date; updatedAt: Date;
  completedAt: Date | null; failedAt: Date | null;
}

function makeContact() {
  return {
    id: 5, userId: 42, email: "user@test.com", name: null,
    attributes: {}, source: "otp", marketingStatus: "unknown",
    marketingConsentSource: null, marketingConsentAt: null,
    createdAt: new Date(), updatedAt: new Date(),
  };
}

function makeSetting(enabled = true, compatible = true) {
  return {
    id: 1, userId: 42, type: "otp_verified_welcome", enabled,
    templateId: compatible ? 10 : null, templateVariables: compatible ? ["email"] : ["order_id"],
    compatible, createdAt: new Date(), updatedAt: new Date(),
  };
}

function setupHappyPath() {
  mockedCanAccess.mockResolvedValue({ allowed: true, plan: "PRO" } as any);
  mockedContactFindUnique.mockResolvedValue(makeContact() as any);
  mockedContactCreate.mockResolvedValue(makeContact() as any);
  mockedEventCreate.mockResolvedValue({ id: 1 } as any);
  mockedGetSetting.mockResolvedValue(makeSetting() as any);
  mockedTemplateFindFirst.mockResolvedValue({ slug: "welcome" } as any);
  mockedSend.mockResolvedValue({
    messageId: "msg_1", status: "sent", replay: false, created: true,
  } as any);
  mockedComplete.mockResolvedValue(undefined);
  mockedFail.mockResolvedValue(undefined);
  mockedRetry.mockResolvedValue(undefined);
}

// ---- Tests -----------------------------------------------------------------

describe("Phase 5 security/correctness regression tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
    // Default: NODE_ENV is NOT production (so the dev-env check doesn't trigger)
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // ---- Fix 1: Development OTP in production → zero real email sends ----

  it("development OTP in production → zero provider calls, zero MESSAGING_EMAILS consumption", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const job = makeJob("development"); // OTP verified with a dev key

    await processOtpVerifiedJob(job);

    // Contact sync + ContactEvent still happen (permitted).
    expect(mockedContactFindUnique).toHaveBeenCalledTimes(1);
    expect(mockedEventCreate).toHaveBeenCalledTimes(1);
    // NO sendTransactionalEmail call — no real email.
    expect(mockedSend).not.toHaveBeenCalled();
    // NO EmailMessage would be created (sendTransactionalEmail is never called).
    // Job completes safely as a deliberate no-send.
    expect(mockedComplete).toHaveBeenCalledTimes(1);
    expect(mockedFail).not.toHaveBeenCalled();
    expect(mockedRetry).not.toHaveBeenCalled();
  });

  it("production OTP in production → normal automation send", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const job = makeJob("production");

    await processOtpVerifiedJob(job);

    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(mockedComplete).toHaveBeenCalledTimes(1);
  });

  it("null environment (legacy/web-auth) in production → normal automation send (preserved)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const job = makeJob(null); // web-auth flow — not classified as a test key

    await processOtpVerifiedJob(job);

    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(mockedComplete).toHaveBeenCalledTimes(1);
  });

  it("development OTP in non-production → normal send (dev console transport)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const job = makeJob("development");

    await processOtpVerifiedJob(job);

    // In dev, a dev-key OTP can send (console transport, not real internet email).
    expect(mockedSend).toHaveBeenCalledTimes(1);
  });

  // ---- Fix 2: AUTOMATIONS entitlement lost at execution time ----

  it("AUTOMATIONS entitlement lost → no send, no MESSAGING_EMAILS, job completes safely", async () => {
    // First canAccess call (CONTACTS) returns allowed, second (AUTOMATIONS) returns denied.
    mockedCanAccess
      .mockResolvedValueOnce({ allowed: true, plan: "PRO" } as any)   // CONTACTS
      .mockResolvedValueOnce({ allowed: false, plan: "FREE", reason: "not_available_on_plan" } as any); // AUTOMATIONS

    const job = makeJob("production");
    await processOtpVerifiedJob(job);

    // Contact sync + ContactEvent still done (CONTACTS was allowed).
    expect(mockedContactFindUnique).toHaveBeenCalledTimes(1);
    expect(mockedEventCreate).toHaveBeenCalledTimes(1);
    // NO send — AUTOMATIONS entitlement lost.
    expect(mockedSend).not.toHaveBeenCalled();
    // Job completes safely — no retry, no fail.
    expect(mockedComplete).toHaveBeenCalledTimes(1);
    expect(mockedFail).not.toHaveBeenCalled();
    expect(mockedRetry).not.toHaveBeenCalled();
  });

  // ---- Fix 3: CONTACTS entitlement unavailable ----

  it("CONTACTS entitlement unavailable → no Contact, no ContactEvent, no send, OTP unaffected", async () => {
    // First canAccess (CONTACTS) returns denied.
    mockedCanAccess
      .mockResolvedValueOnce({ allowed: false, plan: "FREE", reason: "not_available_on_plan" } as any);

    const job = makeJob("production");
    await processOtpVerifiedJob(job);

    // NO Contact sync, NO ContactEvent, NO send.
    expect(mockedContactFindUnique).not.toHaveBeenCalled();
    expect(mockedContactCreate).not.toHaveBeenCalled();
    expect(mockedEventCreate).not.toHaveBeenCalled();
    expect(mockedSend).not.toHaveBeenCalled();
    // Job completes safely — OTP verification is unaffected.
    expect(mockedComplete).toHaveBeenCalledTimes(1);
    expect(mockedFail).not.toHaveBeenCalled();
    expect(mockedRetry).not.toHaveBeenCalled();
  });

  // ---- Fix 4: ContactEvent DB-enforced idempotency ----

  it("ContactEvent create with P2002 → treated as already recorded (idempotent)", async () => {
    // The unique dedupeKey constraint fires — a concurrent/stale worker already inserted.
    mockedEventCreate.mockRejectedValue({ code: "P2002" } as any);

    const job = makeJob("production");
    await processOtpVerifiedJob(job);

    // The processor attempted the atomic insert (create), caught P2002, continued.
    expect(mockedEventCreate).toHaveBeenCalledTimes(1);
    // No addContactEvent (the legacy findFirst->create path is gone).
    // The rest of the flow proceeds (automation check + send).
    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(mockedComplete).toHaveBeenCalledTimes(1);
  });

  it("ContactEvent dedupeKey is deterministic: otp_verified:<userId>:<otpCodeId>", async () => {
    const job = makeJob("production");
    await processOtpVerifiedJob(job);

    const createCall = mockedEventCreate.mock.calls[0][0];
    expect(createCall.data.dedupeKey).toBe("otp_verified:42:12345");
  });

  // ---- Fix 5: Raw internal error text is never persisted ----

  it("raw Prisma error text is NOT persisted — safe classification only", async () => {
    // Simulate a Prisma error with sensitive connection details.
    const sensitiveError = new Error(
      'PrismaClientKnownRequestError: Invalid `db.contact.findUnique()` invocation: connection refused to postgresql://nixify_test:SuperSecretPassword@db.abc123.neon.tech:5432/nixify?schema=public'
    );
    mockedContactFindUnique.mockRejectedValue(sensitiveError);

    const job = makeJob("production");
    await processOtpVerifiedJob(job);

    // The error was classified safely — failJob or retryJob received a safe string.
    const persistedError = mockedFail.mock.calls[0]?.[1] ?? mockedRetry.mock.calls[0]?.[1] ?? "";
    // The raw error text MUST NOT appear in the persisted string.
    expect(persistedError).not.toContain("SuperSecretPassword");
    expect(persistedError).not.toContain("nixify_test");
    expect(persistedError).not.toContain("db.abc123.neon.tech");
    expect(persistedError).not.toContain("postgresql://");
    // The persisted string IS a safe classification.
    expect(persistedError).toMatch(/^(database_error|provider_error|quota_exhausted|rate_limited|configuration_error|validation_error|template_not_found|automation_incompatible|unknown_processing_error)/);
  });

  it("raw SMTP credential error text is NOT persisted", async () => {
    // Simulate an SMTP error leaking credentials.
    const smtpError = new Error("EAUTH: Invalid login: user=smtp@gmail.com pass=app-password-12345");
    mockedSend.mockRejectedValue(smtpError);

    const job = makeJob("production");
    await processOtpVerifiedJob(job);

    const persistedError = mockedRetry.mock.calls[0]?.[1] ?? mockedFail.mock.calls[0]?.[1] ?? "";
    expect(persistedError).not.toContain("app-password-12345");
    expect(persistedError).not.toContain("smtp@gmail.com");
    expect(persistedError).toMatch(/^(provider_error|database_error|unknown_processing_error)/);
  });

  // ---- classifyError + safeErrorForPersistence direct tests ----

  it("classifyError maps known errors to safe classifications", () => {
    expect(classifyError(new Error("template_not_found: slug 'welcome'"))).toBe("template_not_found");
    expect(classifyError(new Error("missing_template_variables: name"))).toBe("automation_incompatible");
    expect(classifyError(new Error("feature_not_available"))).toBe("feature_not_available");
    expect(classifyError(new Error("configuration_error: SMTP"))).toBe("configuration_error");
    expect(classifyError(new Error("quota_exhausted"))).toBe("quota_exhausted");
    expect(classifyError(new Error("rate_limited"))).toBe("rate_limited");
    expect(classifyError(new Error("provider_error: SMTP timeout"))).toBe("provider_error");
    expect(classifyError(new Error("Prisma connection refused"))).toBe("database_error");
    expect(classifyError(new Error("completely unknown thing"))).toBe("unknown_processing_error");
    expect(classifyError("string error with quota")).toBe("quota_exhausted");
    expect(classifyError(null)).toBe("unknown_processing_error");
    expect(classifyError(undefined)).toBe("unknown_processing_error");
  });

  it("safeErrorForPersistence never includes raw error text", () => {
    const sensitive = new Error("connection to postgresql://user:secret@host:5432 failed");
    const safe = safeErrorForPersistence(sensitive, "test context");
    expect(safe).not.toContain("secret");
    expect(safe).not.toContain("postgresql://");
    expect(safe).not.toContain("host:5432");
    expect(safe).toMatch(/^database_error \[test context\]$/);
  });

  // ---- Existing behavior preserved (regression) ----

  it("automation disabled → completeJob, no send", async () => {
    mockedGetSetting.mockResolvedValue(makeSetting(false) as any);
    const job = makeJob("production");
    await processOtpVerifiedJob(job);
    expect(mockedSend).not.toHaveBeenCalled();
    expect(mockedComplete).toHaveBeenCalledTimes(1);
  });

  it("automation enabled + compatible → sends exactly once", async () => {
    const job = makeJob("production");
    await processOtpVerifiedJob(job);
    expect(mockedSend).toHaveBeenCalledTimes(1);
    expect(mockedComplete).toHaveBeenCalledTimes(1);
  });

  it("automation enabled + incompatible → failJob (permanent, no send)", async () => {
    mockedGetSetting.mockResolvedValue(makeSetting(true, false) as any);
    const job = makeJob("production");
    await processOtpVerifiedJob(job);
    expect(mockedSend).not.toHaveBeenCalled();
    expect(mockedFail).toHaveBeenCalledTimes(1);
    // Safe classification persisted.
    const failMsg = mockedFail.mock.calls[0][1];
    // When templateId is null AND compatible is false, the processor hits the
    // "no template configured" check first → configuration_error.
    expect(failMsg).toMatch(/^(automation_incompatible|configuration_error)/);
  });
});
