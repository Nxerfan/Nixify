import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  createImport,
  listImports,
  parseTxt,
  parseJson,
  parseXlsx,
  MAX_UPLOAD_SIZE,
  type ImportSummary,
  type ParseResult,
} from "@/lib/imports";
import { getGroup } from "@/lib/groups";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/contacts/imports
 *
 * List the authenticated user's contact imports (paginated, newest first).
 * Session-authenticated. Tenant-scoped by user.id.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const access = await canAccess(user.id, FEATURE_KEYS.CONTACT_IMPORT);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Contact Import is not available on your current account." } },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const pageStr = url.searchParams.get("page") ?? "1";
  const pageSizeStr = url.searchParams.get("pageSize") ?? "20";

  const page = Number(pageStr);
  const pageSize = Number(pageSizeStr);

  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "page must be a positive integer." } },
      { status: 400 },
    );
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "pageSize must be a positive integer (max 50)." } },
      { status: 400 },
    );
  }

  const result = await listImports(user.id, { page, pageSize });

  return NextResponse.json({
    imports: result.imports.map(serializeSummary),
    pagination: {
      page,
      pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / pageSize),
    },
  });
}

/**
 * POST /api/dashboard/contacts/imports
 *
 * Upload + parse a contact file. Accepts multipart/form-data with:
 *   - `file`           (required) the file to import
 *   - `targetGroupId`  (optional) UUID of a group to add imported contacts to
 *
 * Validation:
 *   - Session-authenticated (no API key)
 *   - CONTACT_IMPORT entitlement required
 *   - If targetGroupId is provided: GROUPS entitlement ALSO required, and
 *     the group must exist for the user (404 otherwise).
 *   - File size capped at MAX_UPLOAD_SIZE (5 MiB) BEFORE parsing
 *   - Format detected from content (not extension):
 *       * XLSX if first bytes match PK zip signature
 *       * JSON if first non-whitespace byte is '{' or '['
 *       * TXT fallback
 *   - .xls and .xlsm extensions are rejected.
 *   - Formula cells in XLSX are rejected (the whole file).
 *
 * Returns the ImportSummary with preview counts. The caller must POST
 * /confirm to actually write contacts.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const access = await canAccess(user.id, FEATURE_KEYS.CONTACT_IMPORT);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Contact Import is not available on your current account." } },
      { status: 403 },
    );
  }

  // ---- Parse multipart form ----
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Expected multipart/form-data with a file field." } },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "A 'file' field is required." } },
      { status: 400 },
    );
  }

  // ---- File-size validation BEFORE parsing (defense-in-depth) ----
  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      {
        error: {
          code: "file_too_large",
          message: `File is ${(file.size / 1024 / 1024).toFixed(2)} MiB — max is ${(MAX_UPLOAD_SIZE / 1024 / 1024).toFixed(0)} MiB.`,
        },
      },
      { status: 413 },
    );
  }

  // ---- Optional target group resolution ----
  let targetGroupIdInt: number | null = null;
  const targetGroupIdRaw = form.get("targetGroupId");
  if (targetGroupIdRaw !== null && typeof targetGroupIdRaw === "string" && targetGroupIdRaw.trim().length > 0) {
    // Group targeting also requires GROUPS access (binary gate).
    const groupsAccess = await canAccess(user.id, FEATURE_KEYS.GROUPS);
    if (!groupsAccess.allowed) {
      return NextResponse.json(
        { error: { code: "feature_not_available", message: "Groups is not available on your current account — cannot target a group." } },
        { status: 403 },
      );
    }

    const targetGroup = await getGroup(user.id, targetGroupIdRaw.trim());
    if (!targetGroup) {
      return NextResponse.json(
        { error: { code: "group_not_found", message: "Target group not found." } },
        { status: 404 },
      );
    }
    targetGroupIdInt = targetGroup.id;
  }

  // ---- Read file bytes ----
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // ---- Format detection (content-first) ----
  const originalFilename = file.name || null;
  const extension = originalFilename ? originalFilename.toLowerCase().split(".").pop() ?? "" : "";
  let format: string;
  let parseResult: ParseResult;

  try {
    if (isZipSignature(bytes)) {
      // Reject .xls (legacy BIFF) and .xlsm (macro-enabled) by extension.
      if (extension === "xls") {
        return NextResponse.json(
          { error: { code: "unsupported_format", message: "Legacy .xls files are not supported. Convert to .xlsx." } },
          { status: 400 },
        );
      }
      if (extension === "xlsm") {
        return NextResponse.json(
          { error: { code: "unsupported_format", message: "Macro-enabled .xlsm files are not supported." } },
          { status: 400 },
        );
      }
      format = "xlsx";
      parseResult = await parseXlsxBytes(bytes);
    } else if (looksLikeJson(bytes)) {
      const text = decodeUtf8(bytes);
      format = "json";
      parseResult = parseJson(text);
      if (parseResult.totalRows === 0 && parseResult.rows.length === 0) {
        // JSON parsed but produced no usable rows — likely malformed shape.
        return NextResponse.json(
          { error: { code: "invalid_file", message: "JSON file did not contain a valid contacts array." } },
          { status: 400 },
        );
      }
    } else {
      const text = decodeUtf8(bytes);
      format = "txt";
      parseResult = parseTxt(text);
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: { code: "parse_failed", message: e?.message ?? "Failed to parse the file." } },
      { status: 400 },
    );
  }

  // ---- Stage the import (transactional: ContactImport + ContactImportRow) ----
  try {
    const summary = await createImport({
      userId: user.id,
      format,
      originalFilename,
      parseResult,
      targetGroupId: targetGroupIdInt,
    });

    return NextResponse.json(serializeSummary(summary), { status: 201 });
  } catch (e) {
    console.error("[dashboard/contacts/imports] createImport failed:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to stage import." } },
      { status: 500 },
    );
  }
}

// ---- Helpers ----------------------------------------------------------------

function serializeSummary(s: ImportSummary) {
  return {
    import_id: s.importId,
    status: s.status,
    format: s.format,
    total_rows: s.totalRows,
    valid_rows: s.validRows,
    invalid_rows: s.invalidRows,
    duplicate_rows: s.duplicateRows,
    existing_rows: s.existingRows,
    imported_rows: s.importedRows,
    failed_rows: s.failedRows,
    target_group_id: s.targetGroupId,
    created_at: s.createdAt.toISOString(),
    confirmed_at: s.confirmedAt?.toISOString() ?? null,
    completed_at: s.completedAt?.toISOString() ?? null,
  };
}

/** XLSX files are ZIP containers — first two bytes are "PK" (0x50, 0x4B). */
function isZipSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/**
 * Heuristic JSON detection: starts with `{` or `[` (after optional BOM/whitespace).
 * The actual JSON.parse happens inside parseJson — this is only the format selector.
 */
function looksLikeJson(bytes: Uint8Array): boolean {
  let i = 0;
  // Skip UTF-8 BOM if present.
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    i = 3;
  }
  for (; i < Math.min(bytes.length, 16); i++) {
    const b = bytes[i];
    if (b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d) continue; // whitespace
    return b === 0x7b || b === 0x5b; // '{' or '['
  }
  return false;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/**
 * Parse an XLSX file using SheetJS. Only the first worksheet is read.
 * Formula cells are rejected — if any formula cell exists in the worksheet
 * (any cell with `.f` set or `.t === "f"`), the file is rejected with a
 * `formula_cell` error. We do NOT evaluate formulas.
 */
async function parseXlsxBytes(bytes: Uint8Array): Promise<ParseResult> {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: "array", cellFormula: true, cellNF: false, cellText: false });
  } catch {
    throw new Error("File is not a valid XLSX workbook.");
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("XLSX file contains no worksheets.");
  }

  // Read only the first worksheet.
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error("First worksheet is empty.");
  }

  // Reject formula cells — strict (whole-file rejection).
  if (hasFormulaCells(sheet)) {
    throw new Error("Spreadsheet contains formula cells, which are not allowed.");
  }

  // Build array-of-arrays (header: 1) using raw underlying values.
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  return parseXlsx(rows);
}

/** Scan the worksheet cell range for any formula cell. */
function hasFormulaCells(sheet: XLSX.WorkSheet): boolean {
  if (!sheet["!ref"]) return false;
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr] as XLSX.CellObject | undefined;
      if (cell && cell.f !== undefined) {
        return true;
      }
    }
  }
  return false;
}
