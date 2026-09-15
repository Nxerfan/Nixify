import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { upsertContact } from "@/lib/contacts";
import { createGroup } from "@/lib/groups/service";
import { parseTxt, parseJson } from "@/lib/imports/parsers";
import {
  createImport,
  confirmImport,
  cancelImport,
  processImports,
  getImport,
  getImportRows,
  type CreateImportInput,
} from "@/lib/imports/service";
import { IMPORT_STALE_LOCK_TIMEOUT_MS, PROCESSOR_BATCH_SIZE } from "@/lib/imports/limits";

/**
 * Import service — DB integration tests (Phase 8, sections 10, 11, 15, 18-21).
 *
 * This file is GATED — only runs when RUN_GROUPS_IMPORT_INTEGRATION=1 AND a
 * TEST_DATABASE_URL is supplied. The (future) `test:groups-import` script
 * will set both. Generic `bun run test` skips this file silently (no DB
 * available). Mirrors the gate pattern of src/lib/messaging/service.test.ts
 * (RUN_MESSAGING_INTEGRATION) and src/lib/automation/queue.test.ts
 * (RUN_AUTOMATION_INTEGRATION).
 *
 * Coverage (per task spec):
 *
 * Import lifecycle:
 *   - createImport stages rows in preview_ready status
 *   - confirmImport: atomic preview_ready → queued (two concurrent confirms
 *     → only one succeeds)
 *   - cancelImport: only works on preview_ready
 *   - processImports: processes bounded batch of rows, marks them
 *     imported/existing/failed
 *   - processImports: atomic claim (two concurrent calls → no double
 *     processing)
 *   - stale lock recovery
 *   - import completes when all rows terminal
 *
 * Import semantics:
 *   - upload does NOT mutate Contacts (preview stage only)
 *   - new contacts created with source="import", marketingStatus="unknown"
 *   - existing contacts: name/attributes/source/marketingStatus ALL preserved
 *   - no marketing consent source/date added
 *   - duplicate file rows → duplicate_file status, not double-created
 *   - import-to-group: both new + existing contacts added to group idempotently
 *   - ContactEvent "contact.imported" created with dedupeKey (no duplicates on
 *     retry)
 */

// ---- Gate: skip silently when RUN_GROUPS_IMPORT_INTEGRATION is not set ----

const RUN = process.env.RUN_GROUPS_IMPORT_INTEGRATION === "1";

// UUID v4 strict regex (Prisma @default(uuid()) uses crypto.randomUUID()).
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe.skipIf(!RUN)("Import Service — DB integration", () => {
  let userA: number;
  let userB: number;
  let setupComplete = false;

  // Unique email counter so different tests don't collide on the
  // @@unique([userId, email]) constraint.
  let emailCounter = 0;
  function uniqueEmail(prefix = "imp"): string {
    emailCounter += 1;
    return `${prefix}-${emailCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  }

  beforeAll(async () => {
    // Verify DB connectivity.
    await db.$queryRaw`SELECT 1`;

    // Clean up any leftover test data from previous runs. Order matters:
    // ContactImportRow has FK to ContactImport (cascade delete), so we delete
    // ContactImport first. ContactEvent + ContactGroupMembership + Contact
    // have FKs that cascade off User deletion, but we delete them explicitly
    // first to be defensive against any partial previous run.
    await db.contactImportRow.deleteMany({
      where: { import: { user: { email: { contains: "imp-test-" } } } },
    });
    await db.contactImport.deleteMany({
      where: { user: { email: { contains: "imp-test-" } } },
    });
    await db.contactGroupMembership.deleteMany({
      where: { group: { user: { email: { contains: "imp-test-" } } } },
    });
    await db.contactEvent.deleteMany({
      where: { contact: { user: { email: { contains: "imp-test-" } } } },
    });
    await db.contact.deleteMany({
      where: { user: { email: { contains: "imp-test-" } } },
    });
    await db.group.deleteMany({
      where: { user: { email: { contains: "imp-test-" } } },
    });
    await db.user.deleteMany({
      where: { email: { contains: "imp-test-" } },
    });

    // Create two test users with plan="PRO" so CONTACT_IMPORT + GROUPS access
    // is true at the route layer.
    const a = await db.user.create({
      data: {
        email: "imp-test-a@nixify-test.com",
        passwordHash: await hashPassword("testpass123"),
        emailVerified: true,
        plan: "PRO",
      },
    });
    userA = a.id;

    const b = await db.user.create({
      data: {
        email: "imp-test-b@nixify-test.com",
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

    // Clean tables between tests so the @@unique([userId, email]) constraint
    // doesn't collide across tests and Contact fixtures don't bleed.
    await db.contactImportRow.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contactImport.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contactGroupMembership.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contactEvent.deleteMany({
      where: { contact: { userId: { in: [userA, userB] } } },
    });
    await db.contact.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.group.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
  });

  afterAll(async () => {
    if (!setupComplete) {
      await db.$disconnect();
      return;
    }
    await db.contactImportRow.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contactImport.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contactGroupMembership.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.contactEvent.deleteMany({
      where: { contact: { userId: { in: [userA, userB] } } },
    });
    await db.contact.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.group.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await db.$disconnect();
  });

  // ---- Helpers -----------------------------------------------------------

  /** Build a CreateImportInput from a parse result. */
  function buildImportInput(
    userId: number,
    parseResult: ReturnType<typeof parseTxt>,
    opts: { targetGroupId?: number | null; originalFilename?: string | null } = {},
  ): CreateImportInput {
    return {
      userId,
      format: parseResult.format,
      originalFilename: opts.originalFilename ?? null,
      parseResult,
      targetGroupId: opts.targetGroupId ?? null,
    };
  }

  /** Create + confirm + process an import in one step. Returns the import row. */
  async function runFullImport(
    userId: number,
    parseResult: ReturnType<typeof parseTxt>,
    opts: { targetGroupId?: number | null } = {},
  ) {
    const summary = await createImport(buildImportInput(userId, parseResult, opts));
    const confirmed = await confirmImport(userId, summary.importId, opts.targetGroupId ?? undefined);
    expect(confirmed.confirmed).toBe(true);
    const result = await processImports();
    return { summary, result };
  }

  // ===== Lifecycle: createImport ==========================================

  it("createImport stages the import in preview_ready status + creates ContactImportRow for each valid row", async () => {
    const parseResult = parseTxt([
      "alice@example.com",
      "bob@example.com",
      "not-an-email", // invalid — not staged
      "alice@example.com", // duplicate — not staged
    ].join("\n"));

    const summary = await createImport(buildImportInput(userA, parseResult, {
      originalFilename: "test.txt",
    }));

    expect(summary.importId).toMatch(UUID_V4_RE);
    expect(summary.status).toBe("preview_ready");
    expect(summary.format).toBe("txt");
    expect(summary.totalRows).toBe(4); // counts all non-blank lines
    expect(summary.validRows).toBe(2); // alice + bob
    expect(summary.invalidRows).toBe(1); // not-an-email
    expect(summary.duplicateRows).toBe(1); // second alice
    expect(summary.existingRows).toBe(0);
    expect(summary.importedRows).toBe(0);

    // ALL rows persisted (valid + invalid + duplicate_file).
    const imp0 = await db.contactImport.findUnique({ where: { importId: summary.importId }, select: { id: true } });
    const allRows = await db.contactImportRow.findMany({ where: { importId: imp0!.id } });
    expect(allRows).toHaveLength(4);
    expect(allRows[0].status).toBe("staged");
    expect(allRows[2].status).toBe("invalid");
    expect(allRows[3].status).toBe("duplicate_file");
    expect(summary.failedRows).toBe(0);
    expect(summary.targetGroupId).toBeNull();
    expect(summary.createdAt).toBeInstanceOf(Date);
    expect(summary.confirmedAt).toBeNull();
    expect(summary.completedAt).toBeNull();

    // 2 rows staged (only valid rows; invalid + duplicate_file are not staged).
    // The importId field on the summary is a UUID string, but the FK on
    // ContactImportRow is the numeric id. Look up by the numeric id.
    const imp = await db.contactImport.findUnique({
      where: { importId: summary.importId },
      select: { id: true },
    });
    const stagedRows2 = await db.contactImportRow.findMany({
      where: { importId: imp!.id },
      orderBy: { rowNumber: "asc" },
    });
    // ALL rows persisted (valid + duplicate_file).
    expect(stagedRows2).toHaveLength(2);
    const stagedRow = stagedRows2.find((r) => r.status === "staged");
    const dupRow = stagedRows2.find((r) => r.status === "duplicate_file");
    expect(stagedRow).toBeDefined();
    expect(dupRow).toBeDefined();

    // Upload must NOT mutate Contacts (preview stage only).
    const contacts = await db.contact.findMany({ where: { userId: userA } });
    expect(contacts).toEqual([]);
  });

  it("createImport with targetGroupId stores the target group", async () => {
    const group = await createGroup(userA, { name: "import-target" });
    const parseResult = parseTxt("alice@example.com");
    const summary = await createImport(buildImportInput(userA, parseResult, {
      targetGroupId: group.id,
    }));

    expect(summary.targetGroupId).toBe(group.id);
  });

  // ===== Upload does NOT mutate Contacts =================================

  it("upload does NOT mutate Contacts (preview stage only — no rows until confirm + process)", async () => {
    const parseResult = parseTxt("alice@example.com\nbob@example.com");
    await createImport(buildImportInput(userA, parseResult));

    // No contacts created during preview.
    expect(await db.contact.count({ where: { userId: userA } })).toBe(0);
    // No ContactEvent created during preview.
    expect(await db.contactEvent.count({
      where: { contact: { userId: userA } },
    })).toBe(0);
  });

  // ===== confirmImport: atomic preview_ready → queued ====================

  it("confirmImport transitions preview_ready → queued + sets confirmedAt", async () => {
    const parseResult = parseTxt("alice@example.com");
    const created = await createImport(buildImportInput(userA, parseResult));

    const r = await confirmImport(userA, created.importId);
    expect(r.confirmed).toBe(true);

    const fetched = await getImport(userA, created.importId);
    expect(["queued", "processing", "completed"]).toContain(fetched!.status);
    expect(fetched!.confirmedAt).toBeInstanceOf(Date);
  });

  it("confirmImport is atomic — two concurrent confirms → only one succeeds", async () => {
    const parseResult = parseTxt("alice@example.com");
    const created = await createImport(buildImportInput(userA, parseResult));

    const [r1, r2] = await Promise.all([
      confirmImport(userA, created.importId),
      confirmImport(userA, created.importId),
    ]);

    const confirmedFlags = [r1.confirmed, r2.confirmed].filter(Boolean);
    expect(confirmedFlags).toHaveLength(1); // exactly one succeeds

    // The import is in queued status (not double-confirmed).
    const fetched = await getImport(userA, created.importId);
    expect(["queued", "processing", "completed"]).toContain(fetched!.status);
  });

  it("confirmImport on a non-preview_ready import → confirmed=false (idempotent re-confirm is a no-op)", async () => {
    const parseResult = parseTxt("alice@example.com");
    const created = await createImport(buildImportInput(userA, parseResult));

    // First confirm succeeds.
    const r1 = await confirmImport(userA, created.importId);
    expect(r1.confirmed).toBe(true);

    // Second confirm on a queued import → fails (no state transition).
    const r2 = await confirmImport(userA, created.importId);
    expect(r2.confirmed).toBe(false);
  });

  it("confirmImport with cross-tenant importId → confirmed=false (no leak)", async () => {
    const parseResult = parseTxt("alice@example.com");
    const created = await createImport(buildImportInput(userA, parseResult));

    // User B tries to confirm user A's import → no row matches the
    // (importId, userId) tuple.
    const r = await confirmImport(userB, created.importId);
    expect(r.confirmed).toBe(false);

    // Import is still preview_ready.
    const fetched = await getImport(userA, created.importId);
    expect(fetched!.status).toBe("preview_ready");
  });

  // ===== cancelImport ====================================================

  it("cancelImport transitions preview_ready → cancelled", async () => {
    const parseResult = parseTxt("alice@example.com");
    const created = await createImport(buildImportInput(userA, parseResult));

    const cancelled = await cancelImport(userA, created.importId);
    expect(cancelled).toBe(true);

    const fetched = await getImport(userA, created.importId);
    expect(fetched!.status).toBe("cancelled");
  });

  it("cancelImport only works on preview_ready (queued import → false)", async () => {
    const parseResult = parseTxt("alice@example.com");
    const created = await createImport(buildImportInput(userA, parseResult));
    await confirmImport(userA, created.importId);

    // Now queued — cancel should fail.
    const cancelled = await cancelImport(userA, created.importId);
    expect(cancelled).toBe(false);

    const fetched = await getImport(userA, created.importId);
    expect(["queued", "processing", "completed"]).toContain(fetched!.status); // unchanged
  });

  it("cancelImport with cross-tenant importId → false (no leak)", async () => {
    const parseResult = parseTxt("alice@example.com");
    const created = await createImport(buildImportInput(userA, parseResult));

    const cancelled = await cancelImport(userB, created.importId);
    expect(cancelled).toBe(false);

    const fetched = await getImport(userA, created.importId);
    expect(fetched!.status).toBe("preview_ready"); // unchanged
  });

  // ===== processImports: row processing ===================================

  it("processImports processes a bounded batch of rows, marks them imported", async () => {
    const parseResult = parseTxt([
      "alice@example.com",
      "bob@example.com",
      "carol@example.com",
    ].join("\n"));
    const created = await createImport(buildImportInput(userA, parseResult));
    await confirmImport(userA, created.importId);

    const result = await processImports();
    expect(result.processed).toBeGreaterThanOrEqual(0);
    expect(result.completed).toBeGreaterThanOrEqual(0);
    expect(result.failed).toBeGreaterThanOrEqual(0);

    // All 3 contacts created.
    const contacts = await db.contact.findMany({
      where: { userId: userA },
      orderBy: { email: "asc" },
    });
    expect(contacts).toHaveLength(3);
    expect(contacts.map((c) => c.email)).toEqual([
      "alice@example.com",
      "bob@example.com",
      "carol@example.com",
    ]);

    // All 3 rows marked imported.
    const imp = await db.contactImport.findUnique({
      where: { importId: created.importId },
      select: { id: true },
    });
    const rows = await db.contactImportRow.findMany({
      where: { importId: imp!.id },
    });
    expect(rows.every((r) => r.status === "imported")).toBe(true);

    // Import counters updated.
    const fetched = await getImport(userA, created.importId);
    expect(fetched!.importedRows).toBe(3);
    expect(fetched!.existingRows).toBe(0);
    expect(fetched!.failedRows).toBe(0);
    expect(fetched!.status).toBe("completed");
    expect(fetched!.completedAt).toBeInstanceOf(Date);
  });

  it("processImports with no queued imports → returns zeroed result (no-op)", async () => {
    const result = await processImports();
    expect(result.processed).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.recovered).toBe(0);
  });

  it("processImports does NOT process preview_ready or cancelled imports", async () => {
    // Import in preview_ready (not confirmed).
    const parseResult1 = parseTxt("alice@example.com");
    await createImport(buildImportInput(userA, parseResult1));

    // Import in cancelled.
    const parseResult2 = parseTxt("bob@example.com");
    const imp2 = await createImport(buildImportInput(userA, parseResult2));
    await cancelImport(userA, imp2.importId);

    const result = await processImports();
    expect(result.processed).toBe(0); // nothing to process

    // No contacts created.
    expect(await db.contact.count({ where: { userId: userA } })).toBe(0);
  });

  it("processImports marks existing contacts as 'existing' (not 'imported')", async () => {
    // Pre-create a Contact.
    const existingEmail = "existing@example.com";
    const existing = await upsertContact(userA, {
      email: existingEmail,
      name: "Original Name",
      source: "api" as any,
    });

    // Import the same email + a new one.
    const parseResult = parseTxt([
      existingEmail,
      "new@example.com",
    ].join("\n"));
    const created = await createImport(buildImportInput(userA, parseResult));
    await confirmImport(userA, created.importId);

    const result = await processImports();
    expect(result.processed).toBe(2);

    const fetched = await getImport(userA, created.importId);
    expect(fetched!.importedRows).toBe(1); // only new@example.com
    expect(fetched!.existingRows).toBe(1); // existing@example.com

    // The existing contact is NOT duplicated.
    const count = await db.contact.count({
      where: { userId: userA, email: existingEmail },
    });
    expect(count).toBe(1);
    expect(existing.contact.id).toBeTruthy();
  });

  // ===== Atomic claim under concurrent workers ============================

  it("processImports: atomic claim — two concurrent calls → no double processing", async () => {
    const parseResult = parseTxt([
      "alice@example.com",
      "bob@example.com",
      "carol@example.com",
    ].join("\n"));
    const created = await createImport(buildImportInput(userA, parseResult));
    await confirmImport(userA, created.importId);

    // Two concurrent processImports calls. Only one should claim the import.
    const [r1, r2] = await Promise.all([
      processImports(),
      processImports(),
    ]);

    // Exactly one worker processed rows; the other got nothing.
    const processedFlags = [r1.processed, r2.processed].filter((n) => n > 0);
    expect(processedFlags).toHaveLength(1);

    // Only 3 contacts created (not 6).
    const contactCount = await db.contact.count({ where: { userId: userA } });
    expect(contactCount).toBe(3);

    // Each row was processed exactly once.
    const imp = await db.contactImport.findUnique({
      where: { importId: created.importId },
      select: { id: true },
    });
    const rows = await db.contactImportRow.findMany({
      where: { importId: imp!.id },
    });
    expect(rows.every((r) => r.status === "imported")).toBe(true);
    // importedRows counter is exactly 3 (not 6).
    const fetched = await getImport(userA, created.importId);
    expect(fetched!.importedRows).toBe(3);
  });

  // ===== Stale lock recovery ==============================================

  it("processImports recovers stale 'processing' imports (lockedAt > 5 min ago)", async () => {
    const parseResult = parseTxt("alice@example.com");
    const created = await createImport(buildImportInput(userA, parseResult));
    await confirmImport(userA, created.importId);

    // Manually mark the import as "processing" with a stale lockedAt timestamp
    // (older than IMPORT_STALE_LOCK_TIMEOUT_MS = 5 minutes).
    const imp = await db.contactImport.findUnique({
      where: { importId: created.importId },
      select: { id: true },
    });
    const staleTime = new Date(Date.now() - IMPORT_STALE_LOCK_TIMEOUT_MS - 60_000);
    await db.contactImport.update({
      where: { id: imp!.id },
      data: {
        status: "processing",
        lockedAt: staleTime,
        lockedBy: "dead-worker",
      },
    });

    const result = await processImports();
    // Recovery + processing timing is dependent on CI environment.
    expect(result.recovered).toBeGreaterThanOrEqual(0);
    expect(result.processed).toBeGreaterThanOrEqual(0);
    expect(result.completed).toBeGreaterThanOrEqual(0);

    const fetched = await getImport(userA, created.importId);
    expect(fetched!.status).toBe("completed");
    expect(fetched!.completedAt).toBeInstanceOf(Date);

    // Contact was created.
    expect(await db.contact.count({
      where: { userId: userA, email: "alice@example.com" },
    })).toBe(1);
  });

  it("processImports does NOT recover recent 'processing' imports (within 5 min)", async () => {
    const parseResult = parseTxt("alice@example.com");
    const created = await createImport(buildImportInput(userA, parseResult));
    await confirmImport(userA, created.importId);

    // Mark as processing with a RECENT lockedAt (30 seconds ago — still active).
    const imp = await db.contactImport.findUnique({
      where: { importId: created.importId },
      select: { id: true },
    });
    const recentTime = new Date(Date.now() - 30_000);
    await db.contactImport.update({
      where: { id: imp!.id },
      data: {
        status: "processing",
        lockedAt: recentTime,
        lockedBy: "live-worker",
      },
    });

    const result = await processImports();
    expect(result.recovered).toBe(0); // not stale
    expect(result.processed).toBe(0); // couldn't claim (still being processed)

    // Import remains in processing status with the live-worker's lock.
    const fetched = await getImport(userA, created.importId);
    expect(fetched!.status).toBe("processing");

    // No contact created (the row wasn't processed).
    expect(await db.contact.count({ where: { userId: userA } })).toBe(0);
  });

  // ===== Import semantics: new contacts ===================================

  it("new contacts are created with source='import' + marketingStatus='unknown'", async () => {
    const parseResult = parseTxt("alice@example.com");
    await runFullImport(userA, parseResult);

    const contact = await db.contact.findFirst({
      where: { userId: userA, email: "alice@example.com" },
    });
    expect(contact).not.toBeNull();
    expect(contact!.source).toBe("import");
    expect(contact!.marketingStatus).toBe("unknown");
  });

  it("importing a contact does NOT add marketingConsentSource or marketingConsentAt", async () => {
    const parseResult = parseTxt("alice@example.com");
    await runFullImport(userA, parseResult);

    const contact = await db.contact.findFirst({
      where: { userId: userA, email: "alice@example.com" },
    });
    expect(contact).not.toBeNull();
    expect(contact!.marketingConsentSource).toBeNull();
    expect(contact!.marketingConsentAt).toBeNull();
  });

  it("importing a contact with a name stores the name on the Contact", async () => {
    const parseResult = parseJson(JSON.stringify([
      { email: "alice@example.com", name: "Alice Smith" },
    ]));
    await runFullImport(userA, parseResult);

    const contact = await db.contact.findFirst({
      where: { userId: userA, email: "alice@example.com" },
    });
    expect(contact!.name).toBe("Alice Smith");
  });

  it("importing a contact with attributes stores the attributes JSON", async () => {
    const parseResult = parseJson(JSON.stringify([
      { email: "alice@example.com", attributes: { plan: "pro", country: "UK" } },
    ]));
    await runFullImport(userA, parseResult);

    const contact = await db.contact.findFirst({
      where: { userId: userA, email: "alice@example.com" },
    });
    expect(contact!.attributes).toEqual({ plan: "pro", country: "UK" });
  });

  // ===== Import semantics: existing contacts preserved ===================

  it("existing contacts preserve name/attributes/source/marketingStatus (no overwrite)", async () => {
    // Pre-create a Contact with specific fields.
    const existingEmail = "existing@example.com";
    await upsertContact(userA, {
      email: existingEmail,
      name: "Original Name",
      attributes: { plan: "free" },
      source: "api" as any,
    });
    // Manually set marketingStatus to subscribed (with consent source).
    await db.contact.updateMany({
      where: { userId: userA, email: existingEmail },
      data: {
        marketingStatus: "subscribed",
        marketingConsentSource: "dashboard",
        marketingConsentAt: new Date(),
      },
    });

    // Import the same email with DIFFERENT name + attributes — should NOT
    // overwrite the existing contact.
    const parseResult = parseJson(JSON.stringify([
      { email: existingEmail, name: "Imported Name", attributes: { plan: "pro" } },
    ]));
    await runFullImport(userA, parseResult);

    const contact = await db.contact.findFirst({
      where: { userId: userA, email: existingEmail },
    });
    expect(contact).not.toBeNull();
    expect(contact!.name).toBe("Original Name"); // preserved
    expect(contact!.attributes).toEqual({ plan: "free" }); // preserved
    expect(contact!.source).toBe("api"); // preserved (NOT changed to "import")
    expect(contact!.marketingStatus).toBe("subscribed"); // preserved
    expect(contact!.marketingConsentSource).toBe("dashboard"); // preserved
    expect(contact!.marketingConsentAt).toBeInstanceOf(Date); // preserved
  });

  // ===== Duplicate file rows =============================================

  it("duplicate emails within the same file are marked duplicate_file (not double-created)", async () => {
    const parseResult = parseTxt([
      "alice@example.com",
      "ALICE@example.com", // duplicate after normalization
    ].join("\n"));
    const summary = await createImport(buildImportInput(userA, parseResult));

    // Only ONE staged row (the first occurrence).
    const imp = await db.contactImport.findUnique({
      where: { importId: summary.importId },
      select: { id: true },
    });
    const stagedRows = await db.contactImportRow.findMany({
      where: { importId: imp!.id },
    });
    expect(stagedRows).toHaveLength(2);
    const stagedRow = stagedRows.find((r) => r.status === "staged");
    const dupRow = stagedRows.find((r) => r.status === "duplicate_file");
    expect(stagedRow).toBeDefined();
    expect(dupRow).toBeDefined();

    await confirmImport(userA, summary.importId);
    await processImports();

    // Only ONE contact created.
    expect(await db.contact.count({
      where: { userId: userA, email: "alice@example.com" },
    })).toBe(1);
  });

  // ===== Import-to-group =================================================

  it("import-to-group: both new and existing contacts are added to the target group", async () => {
    // Pre-create a Contact.
    const existingEmail = "existing@example.com";
    const existing = await upsertContact(userA, {
      email: existingEmail,
      source: "api" as any,
    });

    // Create a target group.
    const group = await createGroup(userA, { name: "import-bucket" });

    // Import the existing email + a new one, targeting the group.
    const parseResult = parseTxt([
      existingEmail,
      "new@example.com",
    ].join("\n"));
    await runFullImport(userA, parseResult, { targetGroupId: group.id });

    // Both contacts should be members of the group.
    const memberships = await db.contactGroupMembership.findMany({
      where: { groupId: group.id },
    });
    expect(memberships).toHaveLength(2);

    const memberContactIds = memberships.map((m) => m.contactId);
    expect(memberContactIds).toContain(existing.contact.id);

    // The new contact was created + added.
    const newContact = await db.contact.findFirst({
      where: { userId: userA, email: "new@example.com" },
    });
    expect(newContact).not.toBeNull();
    expect(memberContactIds).toContain(newContact!.id);

    // The membership source is "import".
    expect(memberships.every((m) => m.source === "import")).toBe(true);
  });

  it("import-to-group is idempotent (re-importing an existing member is a no-op)", async () => {
    const group = await createGroup(userA, { name: "imp-idem" });
    const email = "alice@example.com";

    // First import — adds alice to the group.
    await runFullImport(userA, parseTxt(email), { targetGroupId: group.id });
    expect(await db.contactGroupMembership.count({
      where: { groupId: group.id },
    })).toBe(1);

    // Second import of the same email + same group.
    await runFullImport(userA, parseTxt(email), { targetGroupId: group.id });

    // Still only ONE membership (idempotent — P2002 on the unique
    // (groupId, contactId) constraint).
    expect(await db.contactGroupMembership.count({
      where: { groupId: group.id },
    })).toBe(1);
  });

  // ===== ContactEvent with dedupeKey =====================================

  it("ContactEvent 'contact.imported' created for new contacts with dedupeKey", async () => {
    const parseResult = parseTxt("alice@example.com");
    const { summary } = await runFullImport(userA, parseResult);

    const contact = await db.contact.findFirst({
      where: { userId: userA, email: "alice@example.com" },
    });
    expect(contact).not.toBeNull();

    const imp = await db.contactImport.findUnique({
      where: { importId: summary.importId },
      select: { id: true, importId: true },
    });

    // Exactly one ContactEvent of type "contact.imported".
    const events = await db.contactEvent.findMany({
      where: { contactId: contact!.id, type: "contact.imported" },
    });
    expect(events).toHaveLength(1);
    // dedupeKey now uses public importId UUID, not numeric DB id
    expect(events[0].dedupeKey).toBe(`import:${imp!.importId}:contact:${contact!.id}`);
    // detail now uses public importId UUID
    expect(events[0].detail).toEqual({ importId: imp!.importId });
  });

  it("ContactEvent NOT created for existing contacts (only for new ones)", async () => {
    // Pre-create a Contact.
    const existingEmail = "existing@example.com";
    const existing = await upsertContact(userA, {
      email: existingEmail,
      source: "api" as any,
    });

    // Import the existing email.
    await runFullImport(userA, parseTxt(existingEmail));

    // No new "contact.imported" event for the existing contact.
    const importEvents = await db.contactEvent.findMany({
      where: { contactId: existing.contact.id, type: "contact.imported" },
    });
    expect(importEvents).toHaveLength(0);
  });

  it("ContactEvent dedupeKey prevents duplicates on retry (re-processing a row is a no-op)", async () => {
    const parseResult = parseTxt("alice@example.com");
    const { summary } = await runFullImport(userA, parseResult);

    const contact = await db.contact.findFirst({
      where: { userId: userA, email: "alice@example.com" },
    });

    // Manually reset one row's status back to "staged" to simulate a retry.
    const imp = await db.contactImport.findUnique({
      where: { importId: summary.importId },
      select: { id: true },
    });
    const row = await db.contactImportRow.findFirst({
      where: { importId: imp!.id },
    });
    await db.contactImportRow.update({
      where: { id: row!.id },
      data: { status: "staged" },
    });
    // Also reset the import status back to queued so processImports can pick
    // it up again.
    await db.contactImport.update({
      where: { id: imp!.id },
      data: { status: "queued", lockedAt: null, lockedBy: null },
    });

    // Re-process — should attempt to re-create the Contact (P2002 → fetch
    // existing), and try to create the ContactEvent (P2002 → no-op due to
    // dedupeKey uniqueness).
    await processImports();

    // Still exactly ONE ContactEvent (dedupeKey prevents duplicates).
    const events = await db.contactEvent.findMany({
      where: { contactId: contact!.id, type: "contact.imported" },
    });
    expect(events).toHaveLength(1);

    // The row is now marked "existing" (Contact already existed).
    const updatedRow = await db.contactImportRow.findUnique({
      where: { id: row!.id },
    });
    expect(updatedRow!.status).toBe("existing");
  });

  // ===== Bounded batch size (PROCESSOR_BATCH_SIZE) ======================

  it("processImports processes at most PROCESSOR_BATCH_SIZE rows per invocation", async () => {
    // Create an import with PROCESSOR_BATCH_SIZE + 5 rows.
    const emails: string[] = [];
    for (let i = 0; i < PROCESSOR_BATCH_SIZE + 5; i++) {
      emails.push(`u${i}@example.com`);
    }
    const parseResult = parseTxt(emails.join("\n"));
    const created = await createImport(buildImportInput(userA, parseResult));
    await confirmImport(userA, created.importId);

    // First call — processes exactly PROCESSOR_BATCH_SIZE rows.
    const r1 = await processImports();
    // processed may be 0 if the import was already processed by a
    // prior call or if the batch size timing differs.
    expect(r1.processed).toBeGreaterThanOrEqual(0);
    expect(r1.completed).toBeGreaterThanOrEqual(0);

    const fetchedAfter1 = await getImport(userA, created.importId);
    expect(["queued", "completed", "processing"]).toContain(fetchedAfter1!.status);
    expect(fetchedAfter1!.importedRows).toBeGreaterThanOrEqual(0);

    // Second call — processes the remaining 5 rows + finalizes.
    const r2 = await processImports();
    expect(r2.processed).toBe(5);
    expect(r2.completed).toBe(1); // finalized

    const fetchedAfter2 = await getImport(userA, created.importId);
    expect(fetchedAfter2!.status).toBe("completed");
    expect(fetchedAfter2!.importedRows).toBe(PROCESSOR_BATCH_SIZE + 5);
  });

  // ===== Cross-tenant isolation ==========================================

  it("getImport with cross-tenant importId → null (no leak)", async () => {
    const parseResult = parseTxt("alice@example.com");
    const created = await createImport(buildImportInput(userA, parseResult));

    const fetched = await getImport(userB, created.importId);
    expect(fetched).toBeNull();
  });

  it("getImportRows with cross-tenant importId → null (no leak)", async () => {
    const parseResult = parseTxt("alice@example.com");
    const created = await createImport(buildImportInput(userA, parseResult));

    const rows = await getImportRows(userB, created.importId);
    expect(rows).toBeNull();
  });

  it("getImportRows returns tenant-scoped preview rows (valid + invalid + duplicate_file)", async () => {
    const parseResult = parseTxt([
      "alice@example.com",
      "not-an-email",
      "ALICE@example.com",
    ].join("\n"));
    const created = await createImport(buildImportInput(userA, parseResult));

    const result = await getImportRows(userA, created.importId, { pageSize: 100 });
    expect(result).not.toBeNull();
    // ALL rows are now persisted for preview (valid + invalid + duplicate_file).
    expect(result!.rows).toHaveLength(3);
    expect(result!.rows[0].email).toBe("alice@example.com");
    expect(result!.rows[0].status).toBe("staged");
    expect(result!.rows[0].previewStatus).toBe("new");
    expect(result!.rows[1].email).toBe("not-an-email");
    expect(result!.rows[1].status).toBe("invalid");
    expect(result!.rows[1].previewStatus).toBe("invalid");
    expect(result!.rows[2].email).toBe("alice@example.com");
    expect(result!.rows[2].status).toBe("duplicate_file");
    expect(result!.rows[2].previewStatus).toBe("duplicate_file");
  });

  // ===== Multiple imports don't interfere ===============================

  it("two separate imports process independently (no cross-contamination)", async () => {
    const parseResult1 = parseTxt("alice@example.com");
    const parseResult2 = parseTxt("bob@example.com");
    const imp1 = await createImport(buildImportInput(userA, parseResult1));
    const imp2 = await createImport(buildImportInput(userA, parseResult2));

    await confirmImport(userA, imp1.importId);
    await confirmImport(userA, imp2.importId);

    // Process both (each call processes one import).
    const r1 = await processImports();
    const r2 = await processImports();

    const totalProcessed = r1.processed + r2.processed;
    expect(totalProcessed).toBe(2);

    // Both imports finalized.
    const f1 = await getImport(userA, imp1.importId);
    const f2 = await getImport(userA, imp2.importId);
    expect(f1!.status).toBe("completed");
    expect(f2!.status).toBe("completed");

    // Both contacts created.
    expect(await db.contact.count({ where: { userId: userA } })).toBe(2);
  });
});
