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

export function parseTxt(content: string): ParseResult {
  const lines = content.split(/\r?\n/);
  const rows: ParsedRow[] = [];
  const seenEmails = new Set<string>();
  let totalRows = 0, validRows = 0, invalidRows = 0, duplicateRows = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    totalRows++;
    if (totalRows > MAX_ROWS) return { format: "txt", rows: [], totalRows, validRows, invalidRows, duplicateRows, error: "too_many_rows" };
    if (trimmed.length > MAX_CELL_LENGTH) { rows.push({ rowNumber: totalRows, email: trimmed.slice(0, 50), name: null, attributes: null, status: "invalid", errorCode: "cell_too_long" }); invalidRows++; continue; }
    const email = normalizeEmail(trimmed);
    if (!isValidEmail(email)) { rows.push({ rowNumber: totalRows, email: trimmed.slice(0, 100), name: null, attributes: null, status: "invalid", errorCode: "invalid_email" }); invalidRows++; continue; }
    if (seenEmails.has(email)) { rows.push({ rowNumber: totalRows, email, name: null, attributes: null, status: "duplicate_file", errorCode: "duplicate_file" }); duplicateRows++; continue; }
    seenEmails.add(email);
    rows.push({ rowNumber: totalRows, email, name: null, attributes: null, status: "valid" });
    validRows++;
  }
  return { format: "txt", rows, totalRows, validRows, invalidRows, duplicateRows };
}

export function parseJson(content: string): ParseResult {
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { return { format: "json", rows: [], totalRows: 0, validRows: 0, invalidRows: 0, duplicateRows: 0, error: "invalid_json" }; }
  let contacts: unknown[];
  if (Array.isArray(parsed)) contacts = parsed;
  else if (typeof parsed === "object" && parsed !== null && Array.isArray((parsed as any).contacts)) contacts = (parsed as any).contacts;
  else return { format: "json", rows: [], totalRows: 0, validRows: 0, invalidRows: 0, duplicateRows: 0, error: "invalid_json" };
  if (contacts.length > MAX_ROWS) return { format: "json", rows: [], totalRows: contacts.length, validRows: 0, invalidRows: 0, duplicateRows: 0, error: "too_many_rows" };

  const rows: ParsedRow[] = [];
  const seenEmails = new Set<string>();
  let validRows = 0, invalidRows = 0, duplicateRows = 0;

  for (let i = 0; i < contacts.length; i++) {
    const rowNumber = i + 1;
    const entry = contacts[i];
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) { rows.push({ rowNumber, email: "", name: null, attributes: null, status: "invalid", errorCode: "invalid_row_shape" }); invalidRows++; continue; }
    const obj = entry as Record<string, unknown>;
    const rawEmail = typeof obj.email === "string" ? obj.email : "";
    if (rawEmail.length > MAX_CELL_LENGTH) { rows.push({ rowNumber, email: rawEmail.slice(0, 50), name: null, attributes: null, status: "invalid", errorCode: "cell_too_long" }); invalidRows++; continue; }
    const email = normalizeEmail(rawEmail);
    if (!isValidEmail(email)) { rows.push({ rowNumber, email: rawEmail.slice(0, 100), name: null, attributes: null, status: "invalid", errorCode: "invalid_email" }); invalidRows++; continue; }
    if (seenEmails.has(email)) { rows.push({ rowNumber, email, name: null, attributes: null, status: "duplicate_file", errorCode: "duplicate_file" }); duplicateRows++; continue; }
    const name = typeof obj.name === "string" ? obj.name.slice(0, MAX_NAME_LENGTH) : null;
    let attributes: Record<string, unknown> | null = null;
    if (obj.attributes !== undefined && obj.attributes !== null) {
      if (typeof obj.attributes !== "object" || Array.isArray(obj.attributes)) { rows.push({ rowNumber, email, name, attributes: null, status: "invalid", errorCode: "invalid_attributes" }); invalidRows++; continue; }
      const attrResult = validateAttributes(obj.attributes as Record<string, unknown>, 0);
      if (attrResult.error) { rows.push({ rowNumber, email, name, attributes: null, status: "invalid", errorCode: attrResult.error }); invalidRows++; continue; }
      attributes = attrResult.value;
    }
    seenEmails.add(email);
    rows.push({ rowNumber, email, name, attributes, status: "valid" });
    validRows++;
  }
  return { format: "json", rows, totalRows: contacts.length, validRows, invalidRows, duplicateRows };
}

export function parseXlsx(rows: unknown[][], options?: { isFormulaCell?: (cell: unknown) => boolean }): ParseResult {
  if (rows.length === 0) return { format: "xlsx", rows: [], totalRows: 0, validRows: 0, invalidRows: 0, duplicateRows: 0 };
  const totalDataRows = rows.length - 1;
  if (totalDataRows > MAX_ROWS) return { format: "xlsx", rows: [], totalRows: totalDataRows, validRows: 0, invalidRows: 0, duplicateRows: 0, error: "too_many_rows" };
  if (rows[0].length > MAX_COLUMNS) return { format: "xlsx", rows: [], totalRows: totalDataRows, validRows: 0, invalidRows: 0, duplicateRows: 0, error: "too_many_columns" };
  const headers = rows[0].map((h) => String(h ?? "").trim().toLowerCase());
  const emailCol = headers.indexOf("email");
  if (emailCol === -1) return { format: "xlsx", rows: [], totalRows: totalDataRows, validRows: 0, invalidRows: 0, duplicateRows: 0, error: "missing_email_header" };
  const nameCol = headers.indexOf("name");
  const attrCols = headers.map((h, idx) => ({ header: h, idx })).filter((c) => c.idx !== emailCol && c.idx !== nameCol && c.header.length > 0);
  const parsedRows: ParsedRow[] = [];
  const seenEmails = new Set<string>();
  let validRows = 0, invalidRows = 0, duplicateRows = 0;
  const dataRows = rows.slice(1);

  for (let i = 0; i < dataRows.length; i++) {
    const rowNumber = i + 1;
    const row = dataRows[i];
    if (options?.isFormulaCell) {
      let hasFormula = false;
      for (const cell of row) { if (options.isFormulaCell(cell)) { hasFormula = true; break; } }
      if (hasFormula) { parsedRows.push({ rowNumber, email: "", name: null, attributes: null, status: "invalid", errorCode: "formula_cell" }); invalidRows++; continue; }
    }
    const rawEmail = String(row[emailCol] ?? "").trim();
    if (rawEmail.length > MAX_CELL_LENGTH) { parsedRows.push({ rowNumber, email: rawEmail.slice(0, 50), name: null, attributes: null, status: "invalid", errorCode: "cell_too_long" }); invalidRows++; continue; }
    const email = normalizeEmail(rawEmail);
    if (!isValidEmail(email)) { parsedRows.push({ rowNumber, email: rawEmail.slice(0, 100), name: null, attributes: null, status: "invalid", errorCode: "invalid_email" }); invalidRows++; continue; }
    if (seenEmails.has(email)) { parsedRows.push({ rowNumber, email, name: null, attributes: null, status: "duplicate_file", errorCode: "duplicate_file" }); duplicateRows++; continue; }
    const rawName = nameCol >= 0 ? String(row[nameCol] ?? "").trim() : null;
    const name = rawName && rawName.length > 0 ? rawName.slice(0, MAX_NAME_LENGTH) : null;
    let attributes: Record<string, unknown> | null = null;
    if (attrCols.length > 0) {
      attributes = {};
      for (const col of attrCols) { const val = row[col.idx]; if (val !== undefined && val !== null && String(val).trim().length > 0) attributes[col.header] = String(val).slice(0, MAX_CELL_LENGTH); }
      if (Object.keys(attributes).length === 0) attributes = null;
    }
    seenEmails.add(email);
    parsedRows.push({ rowNumber, email, name, attributes, status: "valid" });
    validRows++;
  }
  return { format: "xlsx", rows: parsedRows, totalRows: dataRows.length, validRows, invalidRows, duplicateRows };
}

export const MAX_ZIP_ENTRIES = 100;
export const MAX_ZIP_TOTAL_UNCOMPRESSED = 50 * 1024 * 1024;
export const MAX_ZIP_SINGLE_ENTRY = 20 * 1024 * 1024;
export const MAX_ZIP_COMPRESSION_RATIO = 100;

export function preflightZip(buffer: Buffer): string | null {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) return "invalid_zip_signature";
  let entryCount = 0, totalUncompressed = 0, offset = 0;
  while (offset + 30 <= buffer.length) {
    if (buffer[offset] !== 0x50 || buffer[offset + 1] !== 0x4b || buffer[offset + 2] !== 0x03 || buffer[offset + 3] !== 0x04) break;
    entryCount++;
    if (entryCount > MAX_ZIP_ENTRIES) return "too_many_zip_entries";
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    totalUncompressed += uncompressedSize;
    if (uncompressedSize > MAX_ZIP_SINGLE_ENTRY) return "zip_entry_too_large";
    if (totalUncompressed > MAX_ZIP_TOTAL_UNCOMPRESSED) return "zip_total_too_large";
    const compressedSize = buffer.readUInt32LE(offset + 18);
    if (compressedSize > 0 && uncompressedSize / compressedSize > MAX_ZIP_COMPRESSION_RATIO) return "zip_compression_ratio_too_high";
    const filenameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    offset = offset + 30 + filenameLength + extraLength + compressedSize;
    if (offset > buffer.length) break;
  }
  return null;
}

function validateAttributes(attrs: Record<string, unknown>, depth: number): { value: Record<string, unknown> | null; error?: string } {
  if (depth > MAX_ATTRIBUTE_DEPTH) return { value: null, error: "attribute_depth_exceeded" };
  const keys = Object.keys(attrs);
  if (keys.length > MAX_ATTRIBUTES) return { value: null, error: "too_many_attributes" };
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (DANGEROUS_KEYS.has(key)) return { value: null, error: "dangerous_key" };
    const val = attrs[key];
    if (typeof val === "string") { if (val.length > MAX_CELL_LENGTH) return { value: null, error: "cell_too_long" }; result[key] = val; }
    else if (typeof val === "number") result[key] = val;
    else if (typeof val === "boolean") result[key] = val;
    else if (val === null) result[key] = null;
    else if (typeof val === "object" && val !== null && !Array.isArray(val)) { const nested = validateAttributes(val as Record<string, unknown>, depth + 1); if (nested.error) return { value: null, error: nested.error }; result[key] = nested.value; }
    else return { value: null, error: "unsupported_attribute_type" };
  }
  return { value: result };
}
