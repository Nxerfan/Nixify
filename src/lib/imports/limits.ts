/**
 * Import limits and constants (Phase 8, section 13).
 */
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MiB
export const MAX_ROWS = 10_000;
export const MAX_COLUMNS = 50;
export const MAX_CELL_LENGTH = 2 * 1024; // 2 KiB per cell
export const MAX_ATTRIBUTES = 50;
export const MAX_ATTRIBUTE_DEPTH = 4;
export const MAX_ATTRIBUTE_KEY_LENGTH = 100;
export const MAX_NAME_LENGTH = 200;
export const PREVIEW_SAMPLE_SIZE = 100;
export const PROCESSOR_BATCH_SIZE = 100;
export const IMPORT_STALE_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 min
export const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
