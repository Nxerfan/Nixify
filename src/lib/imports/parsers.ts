/**
 * Import parsers (Phase 8, section 12).
 *
 * Parses uploaded files into normalized rows for staging. Supports TXT, JSON,
 * and XLSX formats. All parsing is bounded by limits from limits.ts.
 *
 * Security:
 *   - No raw file bytes persisted — only normalized staged fields.
 *   - Dangerous keys (__proto__, prototype, constructor) rejected recursively.
 *   - Formula cells in XLSX are rejected, not evaluated.
 *   - Bounded memory: rows/columns/cells capped.
 */
import { MAX_ROWS, MAX_COLUMNS, MAX_CELL_LENGTH, MAX_ATTRIBUTES, MAX_ATTRIBUTE_DEPTH, MAX_NAME_LENGTH, DANGEROUS_KEYS } from "./limits";
import { normalizeEmail, isValidEmail } from "@/lib/contacts";

export interface ParsedRow {
  rowNumber: number;
  email: string;
  name: string | null;
  attributes: Record<string, unknown> | null;
  status: "valid" | "invalid" | "duplicate_file";
  errorCode?: string;
}

export interface ParseResult {
  format: string;
  rows: ParsedRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  error?: string;
}

// ---- TXT parser (section 12) ------------------------------------------------

export function parseTxt(content: string): ParseResult {
  const lines = content.split(/\r?\n/);
  const rows: ParsedRow[] = [];
  const seenEmails = new Set<string>();
  let totalRows = 0;
  let validRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue; // ignore blank lines
    totalRows++;
    if (totalRows > MAX_ROWS) {
      return { format: "txt", rows: [], totalRows, validRows, invalidRows, duplicateRows, error: "too_many_rows" };
      continue;
    }

    const email = normalizeEmail(trimmed);
    if (!isValidEmail(email)) {
      rows.push({ rowNumber: totalRows, email: trimmed, name: null, attributes: null, status: "invalid", errorCode: "invalid_email" });
      invalidRows++;
      continue;
    }

    if (seenEmails.has(email)) {
      rows.push({ rowNumber: totalRows, email, name: null, attributes: null, status: "duplicate_file", errorCode: "duplicate_file" });
      duplicateRows++;
      continue;
    }

    seenEmails.add(email);
    rows.push({ rowNumber: totalRows, email, name: null, attributes: null, status: "valid" });
    validRows++;
  }

  return { format: "txt", rows, totalRows, validRows, invalidRows, duplicateRows };
}

// ---- JSON parser (section 12) ----------------------------------------------

export function parseJson(content: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { format: "json", rows: [], totalRows: 0, validRows: 0, invalidRows: 0, duplicateRows: 0 };
  }

  // Accept either an array or { contacts: [...] }
  let contacts: unknown[];
  if (Array.isArray(parsed)) {
    contacts = parsed;
  } else if (typeof parsed === "object" && parsed !== null && Array.isArray((parsed as any).contacts)) {
    contacts = (parsed as any).contacts;
  } else {
    return { format: "json", rows: [], totalRows: 0, validRows: 0, invalidRows: 0, duplicateRows: 0 };
  }

  const rows: ParsedRow[] = [];
  const seenEmails = new Set<string>();
  let validRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;

  for (let i = 0; i < contacts.length; i++) {
    const rowNumber = i + 1;
    if (rowNumber > MAX_ROWS) return { format: "json", rows: [], totalRows: contacts.length, validRows, invalidRows, duplicateRows, error: "too_many_rows" };

    const entry = contacts[i];
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      rows.push({ rowNumber, email: "", name: null, attributes: null, status: "invalid", errorCode: "invalid_row_shape" });
      invalidRows++;
      continue;
    }

    const obj = entry as Record<string, unknown>;
    const rawEmail = typeof obj.email === "string" ? obj.email : "";
    const email = normalizeEmail(rawEmail);

    if (!isValidEmail(email)) {
      rows.push({ rowNumber, email: rawEmail, name: null, attributes: null, status: "invalid", errorCode: "invalid_email" });
      invalidRows++;
      continue;
    }

    if (seenEmails.has(email)) {
      rows.push({ rowNumber, email, name: null, attributes: null, status: "duplicate_file", errorCode: "duplicate_file" });
      duplicateRows++;
      continue;
    }

    const name = typeof obj.name === "string" ? obj.name.slice(0, MAX_NAME_LENGTH) : null;
    let attributes: Record<string, unknown> | null = null;
    if (obj.attributes !== undefined && obj.attributes !== null) {
      if (typeof obj.attributes !== "object" || Array.isArray(obj.attributes)) {
        rows.push({ rowNumber, email, name, attributes: null, status: "invalid", errorCode: "invalid_attributes" });
        invalidRows++;
        continue;
      }
      const attrResult = validateAttributes(obj.attributes as Record<string, unknown>, 0);
      if (attrResult.error) {
        rows.push({ rowNumber, email, name, attributes: null, status: "invalid", errorCode: attrResult.error });
        invalidRows++;
        continue;
      }
      attributes = attrResult.value;
    }

    seenEmails.add(email);
    rows.push({ rowNumber, email, name, attributes, status: "valid" });
    validRows++;
  }

  return { format: "json", rows, totalRows: contacts.length, validRows, invalidRows, duplicateRows };
}

// ---- XLSX parser (section 12) ----------------------------------------------

export function parseXlsx(rows: unknown[][], options?: { isFormulaCell?: (cell: unknown) => boolean }): ParseResult {
  // rows: array of arrays, first row is headers.
  // The caller is responsible for extracting rows from the xlsx file — this
  // function receives the already-destructured row data. The `isFormulaCell`
  // option lets the caller flag cells that are formulas (to be rejected).
  if (rows.length === 0) {
    return { format: "xlsx", rows: [], totalRows: 0, validRows: 0, invalidRows: 0, duplicateRows: 0,  };
  }

  if (rows[0].length > MAX_COLUMNS) {
    return { format: "xlsx", rows: [], totalRows: 0, validRows: 0, invalidRows: 0, duplicateRows: 0, error: "too_many_columns" };
  }

  // Find the email column (case-insensitive).
  const headers = rows[0].map((h) => String(h ?? "").trim().toLowerCase());
  const emailCol = headers.indexOf("email");
  if (emailCol === -1) {
    return { format: "xlsx", rows: [], totalRows: 0, validRows: 0, invalidRows: 0, duplicateRows: 0, error: "missing_email_header" };
  }

  const nameCol = headers.indexOf("name");
  // Attribute columns: all columns that aren't email/name.
  const attrCols = headers
    .map((h, idx) => ({ header: h, idx }))
    .filter((c) => c.idx !== emailCol && c.idx !== nameCol && c.header.length > 0);

  const parsedRows: ParsedRow[] = [];
  const seenEmails = new Set<string>();
  let validRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;
  const dataRows = rows.slice(1); // skip header

  for (let i = 0; i < dataRows.length; i++) {
    const rowNumber = i + 1;
    if (rowNumber > MAX_ROWS) return { format: "xlsx", rows: [], totalRows: dataRows.length, validRows, invalidRows, duplicateRows, error: "too_many_rows" };

    const row = dataRows[i];
    // Check for formula cells — reject if found. A single formula cell in
    // any column marks the entire row invalid (formula_cell), and we skip
    // the rest of the parsing for this row. We do NOT evaluate the formula.
    let hasFormulaCell = false;
    if (options?.isFormulaCell) {
      for (const cell of row) {
        if (options.isFormulaCell(cell)) {
          hasFormulaCell = true;
          break;
        }
      }
    }
    if (hasFormulaCell) {
      parsedRows.push({ rowNumber, email: "", name: null, attributes: null, status: "invalid", errorCode: "formula_cell" });
      invalidRows++;
      continue;
    }

    const rawEmail = String(row[emailCol] ?? "").trim();
    if (rawEmail.length > MAX_CELL_LENGTH) {
      parsedRows.push({ rowNumber, email: rawEmail.slice(0, 50), name: null, attributes: null, status: "invalid", errorCode: "cell_too_long" });
      invalidRows++;
      continue;
    }

    const email = normalizeEmail(rawEmail);
    if (!isValidEmail(email)) {
      parsedRows.push({ rowNumber, email: rawEmail, name: null, attributes: null, status: "invalid", errorCode: "invalid_email" });
      invalidRows++;
      continue;
    }

    if (seenEmails.has(email)) {
      parsedRows.push({ rowNumber, email, name: null, attributes: null, status: "duplicate_file", errorCode: "duplicate_file" });
      duplicateRows++;
      continue;
    }

    const rawName = nameCol >= 0 ? String(row[nameCol] ?? "").trim() : null;
    const name = rawName && rawName.length > 0 ? rawName.slice(0, MAX_NAME_LENGTH) : null;

    // Build attributes from extra columns.
    let attributes: Record<string, unknown> | null = null;
    if (attrCols.length > 0) {
      attributes = {};
      for (const col of attrCols) {
        const val = row[col.idx];
        if (val !== undefined && val !== null && String(val).trim().length > 0) {
          const strVal = String(val).slice(0, MAX_CELL_LENGTH);
          attributes[col.header] = strVal;
        }
      }
      if (Object.keys(attributes).length === 0) attributes = null;
    }

    seenEmails.add(email);
    parsedRows.push({ rowNumber, email, name, attributes, status: "valid" });
    validRows++;
  }

  return { format: "xlsx", rows: parsedRows, totalRows: dataRows.length, validRows, invalidRows, duplicateRows };
}

// ---- Attribute validation ---------------------------------------------------

function validateAttributes(
  attrs: Record<string, unknown>,
  depth: number,
): { value: Record<string, unknown> | null; error?: string } {
  if (depth > MAX_ATTRIBUTE_DEPTH) {
    return { value: null, error: "attribute_depth_exceeded" };
  }

  const keys = Object.keys(attrs);
  if (keys.length > MAX_ATTRIBUTES) {
    return { value: null, error: "too_many_attributes" };
  }

  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (DANGEROUS_KEYS.has(key)) {
      return { value: null, error: "dangerous_key" };
    }
    const val = attrs[key];
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      const nested = validateAttributes(val as Record<string, unknown>, depth + 1);
      if (nested.error) return { value: null, error: nested.error };
      result[key] = nested.value;
    } else if (typeof val === "string" || typeof val === "number" || typeof val === "boolean" || val === null) {
      result[key] = val;
    } else {
      // Arrays and other types: stringify as a safe fallback.
      result[key] = String(val);
    }
  }

  return { value: result };
}
