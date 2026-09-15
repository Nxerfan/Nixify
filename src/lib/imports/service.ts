import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/contacts";
import { type ParseResult } from "./parsers";
import { PROCESSOR_BATCH_SIZE, IMPORT_STALE_LOCK_TIMEOUT_MS, PREVIEW_SAMPLE_SIZE } from "./limits";
import { randomUUID } from "crypto";

export interface CreateImportInput { userId: number; format: string; originalFilename: string | null; parseResult: ParseResult; targetGroupId?: number | null; }
export interface ImportSummary { importId: string; status: string; format: string; totalRows: number; validRows: number; invalidRows: number; duplicateRows: number; existingRows: number; importedRows: number; failedRows: number; newContacts: number; existingContacts: number; targetGroupId: number | null; createdAt: Date; confirmedAt: Date | null; completedAt: Date | null; }
export interface ImportPreviewRow { rowNumber: number; email: string; name: string | null; status: string; previewStatus: string | null; errorCode: string | null; }

export async function createImport(input: CreateImportInput): Promise<ImportSummary> {
  const { userId, format, originalFilename, parseResult, targetGroupId } = input;
  if (parseResult.error) {
    const imp = await db.contactImport.create({ data: { userId, originalFilename, format, status: "failed", totalRows: parseResult.totalRows, validRows: parseResult.validRows, invalidRows: parseResult.invalidRows, duplicateRows: parseResult.duplicateRows, targetGroupId: targetGroupId ?? null, lastError: parseResult.error, failedAt: new Date() } });
    return toSummary(imp, 0, 0);
  }
  // Check existing contacts in bounded chunks for valid rows only.
  const validEmails = parseResult.rows.filter((r) => r.status === "valid").map((r) => normalizeEmail(r.email));
  const existingEmailSet = new Set<string>();
  for (let i = 0; i < validEmails.length; i += 500) {
    const chunk = validEmails.slice(i, i + 500);
    const found = await db.contact.findMany({ where: { userId, email: { in: chunk } }, select: { email: true } });
    for (const f of found) existingEmailSet.add(f.email);
  }
  const newCount = validEmails.length - existingEmailSet.size;
  const existingCount = existingEmailSet.size;

  const imp = await db.$transaction(async (tx) => {
    const created = await tx.contactImport.create({ data: { userId, originalFilename, format, status: "preview_ready", targetGroupId: targetGroupId ?? null, totalRows: parseResult.totalRows, validRows: parseResult.validRows, invalidRows: parseResult.invalidRows, duplicateRows: parseResult.duplicateRows, existingRows: existingCount } });
    // Persist ALL rows (valid, invalid, duplicate_file) for preview.
    const allRows = parseResult.rows.map((r) => {
      const normalizedEmail = normalizeEmail(r.email);
      let previewStatus: string;
      let rowStatus: string;
      if (r.status === "valid") {
        previewStatus = existingEmailSet.has(normalizedEmail) ? "existing" : "new";
        rowStatus = "staged";
      } else {
        previewStatus = r.status; // "invalid" or "duplicate_file"
        rowStatus = r.status; // terminal — never enters processing
      }
      return { importId: created.id, userId, rowNumber: r.rowNumber, email: r.email.slice(0, 254), name: r.name, attributes: (r.attributes ?? null) as any, status: rowStatus, previewStatus, errorCode: r.errorCode ?? null };
    });
    if (allRows.length > 0) await tx.contactImportRow.createMany({ data: allRows });
    return created;
  });
  return toSummary(imp, newCount, existingCount);
}

export async function listImports(userId: number, opts: { page?: number; pageSize?: number } = {}): Promise<{ imports: ImportSummary[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));
  const [imports, total] = await Promise.all([
    db.contactImport.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.contactImport.count({ where: { userId } }),
  ]);
  const summaries: ImportSummary[] = [];
  for (const imp of imports) {
    const preview = await derivePreviewCounts(imp.id);
    summaries.push(toSummary(imp, preview.newContacts, preview.existingContacts));
  }
  return { imports: summaries, total };
}

export async function getImport(userId: number, importId: string): Promise<ImportSummary | null> {
  const imp = await db.contactImport.findFirst({ where: { importId, userId } });
  if (!imp) return null;
  const counts = await deriveCounts(imp.id);
  const preview = await derivePreviewCounts(imp.id);
  return toSummary(imp, preview.newContacts, preview.existingContacts);
}

export async function getImportRows(userId: number, importId: string, opts: { page?: number; pageSize?: number; status?: string } = {}): Promise<{ rows: ImportPreviewRow[]; total: number } | null> {
  const imp = await db.contactImport.findFirst({ where: { importId, userId }, select: { id: true } });
  if (!imp) return null;
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(PREVIEW_SAMPLE_SIZE, Math.max(1, opts.pageSize ?? PREVIEW_SAMPLE_SIZE));
  const where: Record<string, unknown> = { importId: imp.id };
  if (opts.status) where.status = opts.status;
  const [rows, total] = await Promise.all([
    db.contactImportRow.findMany({ where, orderBy: { rowNumber: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.contactImportRow.count({ where }),
  ]);
  return { rows: rows.map((r) => ({ rowNumber: r.rowNumber, email: r.email, name: r.name, status: r.status, previewStatus: r.previewStatus, errorCode: r.errorCode })), total };
}

export async function confirmImport(userId: number, importId: string, targetGroupId?: number | null): Promise<{ confirmed: boolean; importId: string }> {
  const claimed = await db.contactImport.updateMany({
    where: { importId, userId, status: "preview_ready" },
    data: { status: "queued", confirmedAt: new Date(), targetGroupId: targetGroupId ?? undefined },
  });
  if (claimed.count === 0) return { confirmed: false, importId };
  const imp = await db.contactImport.findFirst({ where: { importId, userId }, select: { id: true } });
  if (!imp) return { confirmed: true, importId };
  const stagedCount = await db.contactImportRow.count({ where: { importId: imp.id, status: "staged" } });
  if (stagedCount === 0) {
    await db.contactImport.updateMany({ where: { id: imp.id, status: "queued" }, data: { status: "completed", completedAt: new Date() } });
  }
  return { confirmed: true, importId };
}

export async function cancelImport(userId: number, importId: string): Promise<boolean> {
  const result = await db.contactImport.updateMany({ where: { importId, userId, status: "preview_ready" }, data: { status: "cancelled" } });
  return result.count > 0;
}

export async function processImports(): Promise<{ processed: number; completed: number; failed: number; recovered: number }> {
  const result = { processed: 0, completed: 0, failed: 0, recovered: 0 };

  result.recovered = await recoverStaleImports();
  await recoverStaleRows();
  const workerId = randomUUID();
  const importToProcess = await claimQueuedImport(workerId);
  if (!importToProcess) return result;
  console.log("[DIAG2] importToProcess.id=" + importToProcess.id + " type=" + typeof importToProcess.id);
  const rows = await claimStagedRows(importToProcess.id, workerId, PROCESSOR_BATCH_SIZE);
  if (rows.length === 0) {
    await db.contactImport.updateMany({ where: { id: importToProcess.id, status: "processing", lockedBy: workerId }, data: { status: "queued", lockedAt: null, lockedBy: null } });
    return result;
  }
  console.log("[DIAG2] claimStagedRows returned " + rows.length + " rows");
  for (const row of rows) {
    result.processed++;
    const outcome = await processRow(importToProcess, row, workerId);
    if (outcome === "failed") result.failed++;
  }
  // Finalization: check NO staged AND NO processing rows remain.
  if (await tryFinalizeImport(importToProcess.id, workerId)) result.completed++;
  // Release import lock if more work remains.
  const remainingStaged = await db.contactImportRow.count({ where: { importId: importToProcess.id, status: "staged" } });
  if (remainingStaged > 0) {
    await db.contactImport.updateMany({ where: { id: importToProcess.id, status: "processing", lockedBy: workerId }, data: { status: "queued", lockedAt: null, lockedBy: null } });
  }
  return result;
}

// Row-level atomic claiming via compare-and-swap.
async function claimStagedRows(importId: number, workerId: string, batchSize: number) {
  const candidates = await db.contactImportRow.findMany({ where: { importId, status: "staged" }, orderBy: { rowNumber: "asc" }, take: batchSize });
  const claimed: typeof candidates = [];
  for (const candidate of candidates) {
    const updateResult = await db.contactImportRow.updateMany({ where: { id: candidate.id, status: "staged" }, data: { status: "processing", lockedAt: new Date(), lockedBy: workerId } });
    if (updateResult.count === 1) {
      const fresh = await db.contactImportRow.findUnique({ where: { id: candidate.id } });
      if (fresh) claimed.push(fresh);
    }
  }
  return claimed;
}

// Per-row transactional processing — createMany(skipDuplicates) avoids P2002 in interactive tx.
async function processRow(imp: { id: number; importId: string; userId: number; targetGroupId: number | null }, row: { id: number; email: string; name: string | null; attributes: unknown }, workerId: string): Promise<"imported" | "existing" | "failed" | "lost_ownership"> {
  try {
    let outcome: "imported" | "existing" | "failed" | "lost_ownership" = "failed";
    // Single transaction: verify ownership + create Contact + membership + event + terminal row state.
    await db.$transaction(async (tx) => {
      // CAS: verify we still own this row inside the transaction.
      // Use findFirst (not updateMany with empty data — Prisma rejects empty data).
      const owned = await tx.contactImportRow.updateMany({
        where: { id: row.id, status: "processing", lockedBy: workerId },
        data: { lockedAt: new Date() },
      });
      if (owned.count !== 1) { outcome = "lost_ownership"; return; } // stale worker

      const normalizedEmail = normalizeEmail(row.email);
      let contactId: number;
      let isNew = false;

      // createMany(skipDuplicates) — avoids P2002 in interactive tx.
      const createResult = await tx.contact.createMany({
        data: [{ userId: imp.userId, email: normalizedEmail, name: row.name ?? null, attributes: (row.attributes as any) ?? {}, source: "import", marketingStatus: "unknown" }],
        skipDuplicates: true,
      });
      if (createResult.count === 1) {
        const created = await tx.contact.findUnique({ where: { userId_email: { userId: imp.userId, email: normalizedEmail } }, select: { id: true } });
        if (!created) { await tx.contactImportRow.updateMany({ where: { id: row.id, status: "processing", lockedBy: workerId }, data: { status: "failed", errorCode: "contact_not_found", lockedAt: null, lockedBy: null } }); return; }
        contactId = created.id; isNew = true;
      } else {
        const existing = await tx.contact.findUnique({ where: { userId_email: { userId: imp.userId, email: normalizedEmail } }, select: { id: true } });
        if (!existing) { await tx.contactImportRow.updateMany({ where: { id: row.id, status: "processing", lockedBy: workerId }, data: { status: "failed", errorCode: "contact_not_found", lockedAt: null, lockedBy: null } }); return; }
        contactId = existing.id;
      }

      // Optional group membership (idempotent via createMany skipDuplicates).
      if (imp.targetGroupId) {
        await tx.contactGroupMembership.createMany({
          data: [{ userId: imp.userId, groupId: imp.targetGroupId, contactId, source: "import" }],
          skipDuplicates: true,
        });
      }

      // ContactEvent with dedupeKey (idempotent via createMany skipDuplicates).
      if (isNew) {
        await tx.contactEvent.createMany({
          data: [{ contactId, type: "contact.imported", detail: { importId: imp.importId } as any, dedupeKey: `import:${imp.importId}:contact:${contactId}` }],
          skipDuplicates: true,
        });
      }

      // Terminal row transition — CAS protected by the transaction.
      await tx.contactImportRow.updateMany({
        where: { id: row.id, status: "processing", lockedBy: workerId },
        data: { status: isNew ? "imported" : "existing", lockedAt: null, lockedBy: null },
      });
      outcome = isNew ? "imported" : "existing";
    });
    return outcome;
  } catch (err) {
    const errorCode = err instanceof Error && err.message.includes("validation") ? "validation_error" : "processing_error";
    await markRowFailed(row.id, errorCode, workerId);
    return "failed";
  }
  return "failed"; // unreachable — satisfies TS
}

async function markRowFailed(rowId: number, errorCode: string, workerId: string): Promise<void> {
  // CAS: only fail if we still own the row.
  await db.contactImportRow.updateMany({
    where: { id: rowId, status: "processing", lockedBy: workerId },
    data: { status: "failed", errorCode, lockedAt: null, lockedBy: null },
  });
}

// Finalization: complete ONLY when NO staged AND NO processing rows remain.
async function tryFinalizeImport(importId: number, workerId: string): Promise<boolean> {
  const nonTerminal = await db.contactImportRow.count({ where: { importId, status: { in: ["staged", "processing"] } } });
  if (nonTerminal > 0) return false;
  const result = await db.contactImport.updateMany({ where: { id: importId, status: "processing", lockedBy: workerId }, data: { status: "completed", completedAt: new Date(), lockedAt: null, lockedBy: null } });
  if (result.count === 1) {
    // Derive final counts from terminal row states (no mutable counters).
    const counts = await deriveCounts(importId);
    await db.contactImport.update({ where: { id: importId }, data: { importedRows: counts.imported, existingRows: counts.existing, failedRows: counts.failed } });
    return true;
  }
  return false;
}

// Derive preview counts from previewStatus (stable before/during/after processing).
async function derivePreviewCounts(importId: number): Promise<{ newContacts: number; existingContacts: number }> {
  const [newCount, existingCount] = await Promise.all([
    db.contactImportRow.count({ where: { importId, previewStatus: "new" } }),
    db.contactImportRow.count({ where: { importId, previewStatus: "existing" } }),
  ]);
  return { newContacts: newCount, existingContacts: existingCount };
}

// Derive canonical counts from terminal ContactImportRow states.
async function deriveCounts(importId: number): Promise<{ imported: number; existing: number; failed: number }> {
  const [imported, existing, failed] = await Promise.all([
    db.contactImportRow.count({ where: { importId, status: "imported" } }),
    db.contactImportRow.count({ where: { importId, status: "existing" } }),
    db.contactImportRow.count({ where: { importId, status: "failed" } }),
  ]);
  return { imported, existing, failed };
}

async function claimQueuedImport(workerId: string) {
  const results = await db.$queryRaw<Array<{ id: number; importId: string; userId: number; targetGroupId: number | null }>>`
    WITH processable AS (
      SELECT ci.id, ci."importId", ci."userId", ci."targetGroupId"
      FROM "ContactImport" ci
      WHERE ci.status = 'queued'
        AND EXISTS (
          SELECT 1 FROM "ContactImportRow" cir
          WHERE cir."importId" = ci.id AND cir.status = 'staged'
        )
      ORDER BY ci."confirmedAt" ASC
      LIMIT 1
    )
    UPDATE "ContactImport"
    SET status = 'processing', "lockedAt" = NOW(), "lockedBy" = ${workerId}
    FROM processable
    WHERE "ContactImport".id = processable.id
      AND "ContactImport".status = 'queued'
    RETURNING processable.id, processable."importId", processable."userId", processable."targetGroupId"
  `;
  return results.length > 0 ? results[0] : null;
}

async function recoverStaleImports(): Promise<number> {
  const cutoff = new Date(Date.now() - IMPORT_STALE_LOCK_TIMEOUT_MS);
  const stale = await db.contactImport.findMany({ where: { status: "processing", lockedAt: { lt: cutoff } }, select: { id: true } });
  let recovered = 0;
  for (const imp of stale) {
    const result = await db.contactImport.updateMany({ where: { id: imp.id, status: "processing", lockedAt: { lt: cutoff } }, data: { status: "queued", lockedAt: null, lockedBy: null } });
    if (result.count === 1) recovered++;
  }
  return recovered;
}

// Row-level stale lock recovery with compare-and-swap.
async function recoverStaleRows(): Promise<number> {
  const cutoff = new Date(Date.now() - IMPORT_STALE_LOCK_TIMEOUT_MS);
  const stale = await db.contactImportRow.findMany({ where: { status: "processing", lockedAt: { lt: cutoff } }, select: { id: true } });
  let recovered = 0;
  for (const row of stale) {
    const result = await db.contactImportRow.updateMany({ where: { id: row.id, status: "processing", lockedAt: { lt: cutoff } }, data: { status: "staged", lockedAt: null, lockedBy: null } });
    if (result.count === 1) recovered++;
  }
  return recovered;
}

function toSummary(imp: { importId: string; status: string; format: string; totalRows: number; validRows: number; invalidRows: number; duplicateRows: number; existingRows: number; importedRows: number; failedRows: number; targetGroupId: number | null; createdAt: Date; confirmedAt: Date | null; completedAt: Date | null; }, newContacts?: number, existingContacts?: number): ImportSummary {
  return { importId: imp.importId, status: imp.status, format: imp.format, totalRows: imp.totalRows, validRows: imp.validRows, invalidRows: imp.invalidRows, duplicateRows: imp.duplicateRows, existingRows: imp.existingRows, importedRows: imp.importedRows, failedRows: imp.failedRows, newContacts: newContacts ?? 0, existingContacts: existingContacts ?? imp.existingRows, targetGroupId: imp.targetGroupId, createdAt: imp.createdAt, confirmedAt: imp.confirmedAt, completedAt: imp.completedAt };
}
