/**
 * Import service (Phase 8, sections 10, 11, 15, 18, 19, 20, 21).
 *
 * Staged, durable contact import with explicit state machine:
 *   parsing → preview_ready → queued → processing → completed | failed
 *   preview_ready → cancelled
 *
 * Upload/parse NEVER mutates Contacts. Only confirm transitions staged data
 * into actual Contact writes. The processor handles durable row-by-row
 * import with atomic claiming, stale-lock recovery, and P2002-safe Contact
 * creation.
 *
 * CRITICAL: Importing contacts NEVER grants marketing consent. New contacts
 * are created with marketingStatus="unknown". Existing contacts preserve all
 * fields (name, attributes, source, marketingStatus).
 */
import { db } from "@/lib/db";
import { normalizeEmail, addContactEvent } from "@/lib/contacts";
import { type ParseResult, type ParsedRow } from "./parsers";
import { PROCESSOR_BATCH_SIZE, IMPORT_STALE_LOCK_TIMEOUT_MS, PREVIEW_SAMPLE_SIZE } from "./limits";

// ---- Types -----------------------------------------------------------------

export interface CreateImportInput {
  userId: number;
  format: string;
  originalFilename: string | null;
  parseResult: ParseResult;
  targetGroupId?: number | null;
}

export interface ImportSummary {
  importId: string;
  status: string;
  format: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  existingRows: number;
  importedRows: number;
  failedRows: number;
  targetGroupId: number | null;
  createdAt: Date;
  confirmedAt: Date | null;
  completedAt: Date | null;
}

export interface ImportPreviewRow {
  rowNumber: number;
  email: string;
  name: string | null;
  status: string;
  errorCode: string | null;
}

// ---- Create (upload + parse) -----------------------------------------------

export async function createImport(input: CreateImportInput): Promise<ImportSummary> {
  const { userId, format, originalFilename, parseResult, targetGroupId } = input;

  // Create the import record + staged rows in a single transaction.
  const imp = await db.$transaction(async (tx) => {
    const created = await tx.contactImport.create({
      data: {
        userId,
        originalFilename,
        format,
        status: "preview_ready",
        targetGroupId: targetGroupId ?? null,
        totalRows: parseResult.totalRows,
        validRows: parseResult.validRows,
        invalidRows: parseResult.invalidRows,
        duplicateRows: parseResult.duplicateRows,
      },
    });

    // Stage all valid rows (not invalid, not duplicate_file — those are
    // marked but don't need processing).
    const stagedRows = parseResult.rows
      .filter((r) => r.status === "valid")
      .map((r) => ({
        importId: created.id,
        userId,
        rowNumber: r.rowNumber,
        email: r.email,
        name: r.name,
        attributes: (r.attributes ?? null) as any,
        status: "staged" as const,
      }));

    if (stagedRows.length > 0) {
      await tx.contactImportRow.createMany({ data: stagedRows });
    }

    return created;
  });

  return toSummary(imp);
}

// ---- List + detail + preview -----------------------------------------------

export async function listImports(
  userId: number,
  opts: { page?: number; pageSize?: number } = {},
): Promise<{ imports: ImportSummary[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));

  const [imports, total] = await Promise.all([
    db.contactImport.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.contactImport.count({ where: { userId } }),
  ]);

  return { imports: imports.map(toSummary), total };
}

export async function getImport(userId: number, importId: string): Promise<ImportSummary | null> {
  const imp = await db.contactImport.findFirst({ where: { importId, userId } });
  if (!imp) return null;
  return toSummary(imp);
}

export async function getImportRows(
  userId: number,
  importId: string,
  opts: { page?: number; pageSize?: number; status?: string } = {},
): Promise<{ rows: ImportPreviewRow[]; total: number } | null> {
  const imp = await db.contactImport.findFirst({
    where: { importId, userId },
    select: { id: true },
  });
  if (!imp) return null;

  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(PREVIEW_SAMPLE_SIZE, Math.max(1, opts.pageSize ?? PREVIEW_SAMPLE_SIZE));
  const where: Record<string, unknown> = { importId: imp.id };
  if (opts.status) where.status = opts.status;

  const [rows, total] = await Promise.all([
    db.contactImportRow.findMany({
      where,
      orderBy: { rowNumber: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.contactImportRow.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      rowNumber: r.rowNumber,
      email: r.email,
      name: r.name,
      status: r.status,
      errorCode: r.errorCode,
    })),
    total,
  };
}

// ---- Confirm (atomic state transition) --------------------------------------

export async function confirmImport(
  userId: number,
  importId: string,
  targetGroupId?: number | null,
): Promise<{ confirmed: boolean; importId: string }> {
  // Atomic conditional transition: preview_ready → queued.
  // Two simultaneous confirmations must not create two import runs.
  const result = await db.contactImport.updateMany({
    where: { importId, userId, status: "preview_ready" },
    data: {
      status: "queued",
      confirmedAt: new Date(),
      targetGroupId: targetGroupId ?? undefined,
    },
  });

  if (result.count === 0) {
    return { confirmed: false, importId };
  }
  return { confirmed: true, importId };
}

// ---- Cancel / delete --------------------------------------------------------

export async function cancelImport(userId: number, importId: string): Promise<boolean> {
  // Only allow cancel if preview_ready (not yet processing).
  const result = await db.contactImport.updateMany({
    where: { importId, userId, status: "preview_ready" },
    data: { status: "cancelled" },
  });
  return result.count > 0;
}

// ---- Processor (durable, bounded, atomic) -----------------------------------

export async function processImports(): Promise<{ processed: number; completed: number; failed: number; recovered: number }> {
  const result = { processed: 0, completed: 0, failed: 0, recovered: 0 };

  // 1. Recover stale processing imports (worker died mid-import).
  result.recovered = await recoverStaleImports();

  // 2. Claim queued imports (atomic).
  const workerId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const importToProcess = await claimQueuedImport(workerId);
  if (!importToProcess) return result;

  // 3. Process a bounded batch of rows.
  const rows = await db.contactImportRow.findMany({
    where: { importId: importToProcess.id, status: "staged" },
    orderBy: { rowNumber: "asc" },
    take: PROCESSOR_BATCH_SIZE,
  });

  for (const row of rows) {
    result.processed++;
    await processRow(importToProcess, row);
  }

  // 4. Check if all rows are terminal → mark import completed.
  const remaining = await db.contactImportRow.count({
    where: { importId: importToProcess.id, status: "staged" },
  });

  if (remaining === 0) {
    // All rows terminal — finalize.
    await finalizeImport(importToProcess.id);
    result.completed++;
  }

  // 5. Release the lock (set back to processing → it's still processing
  // if there are remaining rows, but the lock is released for the next
  // invocation).
  await db.contactImport.updateMany({
    where: { id: importToProcess.id, status: "processing", lockedBy: workerId },
    data: { status: "queued", lockedAt: null, lockedBy: null },
  }).catch(() => {});

  return result;
}

// ---- Internal: process a single row ----------------------------------------

async function processRow(
  imp: { id: number; userId: number; targetGroupId: number | null },
  row: { id: number; importId: number; userId: number; rowNumber: number; email: string; name: string | null; attributes: unknown },
): Promise<void> {
  try {
    const normalizedEmail = normalizeEmail(row.email);

    // P2002-safe Contact creation: try create, on conflict fetch existing.
    let contactId: number;
    let isNew = false;

    try {
      const created = await db.contact.create({
        data: {
          userId: imp.userId,
          email: normalizedEmail,
          name: row.name ?? null,
          attributes: (row.attributes as any) ?? {},
          source: "import",
          marketingStatus: "unknown", // CRITICAL: never subscribe by import
        },
      });
      contactId = created.id;
      isNew = true;
    } catch (e: any) {
      if (e?.code === "P2002") {
        // Contact already exists — fetch it. Do NOT overwrite any fields.
        const existing = await db.contact.findUnique({
          where: { userId_email: { userId: imp.userId, email: normalizedEmail } },
          select: { id: true },
        });
        if (!existing) {
          // Race condition: row was deleted between conflict and fetch.
          await markRowFailed(row.id, "contact_not_found");
          return;
        }
        contactId = existing.id;
      } else {
        throw e;
      }
    }

    // Optionally add to target group (idempotent).
    if (imp.targetGroupId) {
      try {
        await db.contactGroupMembership.create({
          data: { userId: imp.userId, groupId: imp.targetGroupId, contactId, source: "import" },
        });
      } catch (e: any) {
        if (e?.code !== "P2002") throw e; // already a member — idempotent skip
      }
    }

    // Mark the row as imported or existing.
    await db.contactImportRow.update({
      where: { id: row.id },
      data: { status: isNew ? "imported" : "existing" },
    });

    // Add ContactEvent (contact.imported) — idempotent via dedupeKey.
    if (isNew) {
      try {
        await db.contactEvent.create({
          data: {
            contactId,
            type: "contact.imported",
            detail: { importId: imp.id } as any,
            dedupeKey: `import:${imp.id}:contact:${contactId}`,
          },
        });
      } catch (e: any) {
        if (e?.code !== "P2002") throw e; // dedupe — skip
      }
    }

    // Update import counters.
    await db.contactImport.update({
      where: { id: imp.id },
      data: isNew
        ? { importedRows: { increment: 1 } }
        : { existingRows: { increment: 1 } },
    }).catch(() => {});
  } catch (err) {
    // Safe error classification — never persist raw error text.
    const errorCode = err instanceof Error && err.message.includes("validation")
      ? "validation_error"
      : "processing_error";
    await markRowFailed(row.id, errorCode);
  }
}

async function markRowFailed(rowId: number, errorCode: string): Promise<void> {
  await db.contactImportRow.update({
    where: { id: rowId },
    data: { status: "failed", errorCode },
  }).catch(() => {});
  await db.contactImport.update({
    where: { id: (await db.contactImportRow.findUnique({ where: { id: rowId }, select: { importId: true } }))?.importId },
    data: { failedRows: { increment: 1 } },
  }).catch(() => {});
}

async function finalizeImport(importId: number): Promise<void> {
  await db.contactImport.update({
    where: { id: importId },
    data: { status: "completed", completedAt: new Date(), lockedAt: null, lockedBy: null },
  }).catch(() => {});
}

async function claimQueuedImport(workerId: string) {
  // Atomic claim: only one worker can transition queued → processing.
  const candidates = await db.contactImport.findMany({
    where: { status: "queued" },
    orderBy: { confirmedAt: "asc" },
    take: 1,
  });

  for (const candidate of candidates) {
    const result = await db.contactImport.updateMany({
      where: { id: candidate.id, status: "queued" },
      data: { status: "processing", lockedAt: new Date(), lockedBy: workerId },
    });
    if (result.count === 1) {
      return db.contactImport.findUnique({ where: { id: candidate.id } });
    }
  }
  return null;
}

async function recoverStaleImports(): Promise<number> {
  const cutoff = new Date(Date.now() - IMPORT_STALE_LOCK_TIMEOUT_MS);
  const stale = await db.contactImport.findMany({
    where: { status: "processing", lockedAt: { lt: cutoff } },
    select: { id: true },
  });

  let recovered = 0;
  for (const imp of stale) {
    // Compare-and-swap: only reset if still stale.
    const result = await db.contactImport.updateMany({
      where: { id: imp.id, status: "processing", lockedAt: { lt: cutoff } },
      data: { status: "queued", lockedAt: null, lockedBy: null },
    });
    if (result.count === 1) recovered++;
  }
  return recovered;
}

// ---- Helper ----------------------------------------------------------------

function toSummary(imp: {
  importId: string; status: string; format: string; totalRows: number;
  validRows: number; invalidRows: number; duplicateRows: number;
  existingRows: number; importedRows: number; failedRows: number;
  targetGroupId: number | null; createdAt: Date; confirmedAt: Date | null; completedAt: Date | null;
}): ImportSummary {
  return {
    importId: imp.importId,
    status: imp.status,
    format: imp.format,
    totalRows: imp.totalRows,
    validRows: imp.validRows,
    invalidRows: imp.invalidRows,
    duplicateRows: imp.duplicateRows,
    existingRows: imp.existingRows,
    importedRows: imp.importedRows,
    failedRows: imp.failedRows,
    targetGroupId: imp.targetGroupId,
    createdAt: imp.createdAt,
    confirmedAt: imp.confirmedAt,
    completedAt: imp.completedAt,
  };
}
