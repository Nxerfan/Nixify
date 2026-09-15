import { describe, it, expect } from "vitest";
import {
  parseTxt,
  parseJson,
  parseXlsx,
  type ParseResult,
} from "./parsers";
import {
  MAX_ROWS,
  MAX_COLUMNS,
  MAX_CELL_LENGTH,
  MAX_ATTRIBUTES,
  MAX_ATTRIBUTE_DEPTH,
  MAX_NAME_LENGTH,
} from "./limits";

/**
 * Import parsers — pure unit tests (Phase 8, section 12).
 *
 * These tests run in the generic CI job — NO database required. The parsers
 * are pure functions: bytes in, structured ParsedRow[] out. They never touch
 * Prisma, never make network calls, never persist anything.
 *
 * Mirrors the no-DB gate pattern of src/lib/validation.test.ts and the
 * parser-shape assertions of src/lib/contacts/validation.test.ts.
 *
 * Coverage (per task spec):
 *
 * parseTxt:
 *   - valid emails parsed + normalized
 *   - blank lines ignored (do not consume row quota)
 *   - malformed emails rejected (status=invalid, errorCode=invalid_email)
 *   - too many rows → excess rows marked invalid (errorCode=too_many_rows)
 *
 * parseJson:
 *   - valid array of objects
 *   - valid { contacts: [...] } envelope
 *   - invalid shape (not array/object) → empty result
 *   - email required (missing → invalid_email)
 *   - name optional
 *   - attributes optional
 *   - dangerous keys (__proto__ / prototype / constructor) rejected
 *     recursively at any depth
 *   - depth limit (MAX_ATTRIBUTE_DEPTH) enforced
 *   - key count limit (MAX_ATTRIBUTES) enforced
 *
 * parseXlsx:
 *   - valid data with email column
 *   - missing email header → empty result
 *   - too many columns (header row width > MAX_COLUMNS) → empty result
 *   - oversized cell (raw cell length > MAX_CELL_LENGTH) → invalid
 *   - formula cells rejected via isFormulaCell callback → invalid
 *
 * All parsers — duplicate handling within the same file:
 *   - duplicate emails within the same file are marked duplicate_file
 *   - first occurrence wins (status=valid), subsequent rows get
 *     status=duplicate_file
 *   - duplicate count is tracked separately from invalid count
 */

// ---- Helpers --------------------------------------------------------------

/** Build a TXT file body with one email per line. */
function txt(...lines: string[]): string {
  return lines.join("\n");
}

/** Build an array-of-objects JSON body. */
function jsonArray(items: unknown[]): string {
  return JSON.stringify(items);
}

/** Build a { contacts: [...] } JSON body. */
function jsonEnvelope(items: unknown[]): string {
  return JSON.stringify({ contacts: items });
}

// ---- parseTxt -------------------------------------------------------------

describe("parseTxt", () => {
  it("parses valid emails and normalizes them (trim + lowercase)", () => {
    const result = parseTxt(txt(
      "Alice@Example.com",
      "bob@example.com",
      "  Carol@Example.org  ", // trimmed
    ));

    expect(result.format).toBe("txt");
    expect(result.totalRows).toBe(3);
    expect(result.validRows).toBe(3);
    expect(result.invalidRows).toBe(0);
    expect(result.duplicateRows).toBe(0);
    expect(result.rows).toHaveLength(3);

    expect(result.rows[0].email).toBe("alice@example.com");
    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[0].rowNumber).toBe(1);
    expect(result.rows[0].name).toBeNull();
    expect(result.rows[0].attributes).toBeNull();

    expect(result.rows[1].email).toBe("bob@example.com");
    expect(result.rows[1].status).toBe("valid");

    // Whitespace-only padding must be stripped before normalization.
    expect(result.rows[2].email).toBe("carol@example.org");
  });

  it("ignores blank lines (they do not consume the row quota)", () => {
    const result = parseTxt(txt(
      "alice@example.com",
      "",
      "   ",
      "\t",
      "bob@example.com",
    ));

    expect(result.totalRows).toBe(2); // only 2 non-blank lines counted
    expect(result.validRows).toBe(2);
    expect(result.invalidRows).toBe(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].email).toBe("alice@example.com");
    expect(result.rows[1].email).toBe("bob@example.com");
  });

  it("rejects malformed emails with errorCode=invalid_email", () => {
    const result = parseTxt(txt(
      "not-an-email",
      "missing@tld",
      "@example.com",
      "ok@example.com",
    ));

    expect(result.totalRows).toBe(4);
    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(3);
    expect(result.rows[0].status).toBe("invalid");
    expect(result.rows[0].errorCode).toBe("invalid_email");
    expect(result.rows[1].status).toBe("invalid");
    expect(result.rows[1].errorCode).toBe("invalid_email");
    expect(result.rows[2].status).toBe("invalid");
    expect(result.rows[2].errorCode).toBe("invalid_email");
    expect(result.rows[3].status).toBe("valid");
    expect(result.rows[3].errorCode).toBeUndefined();
  });

  it("hard-fails when rows exceed MAX_ROWS (returns top-level error)", () => {
    const lines: string[] = [];
    for (let i = 0; i < MAX_ROWS + 5; i++) lines.push(`user${i}@example.com`);
    const result = parseTxt(txt(...lines));
    expect(result.error).toBe("too_many_rows");
    expect(result.rows).toHaveLength(0);
  });

  it("marks duplicate emails within the same file as duplicate_file (first wins)", () => {
    const result = parseTxt(txt(
      "alice@example.com",
      "ALICE@example.com", // duplicate after normalization
      "bob@example.com",
      "alice@example.com", // duplicate again
    ));

    expect(result.totalRows).toBe(4);
    expect(result.validRows).toBe(2);
    expect(result.duplicateRows).toBe(2);
    expect(result.invalidRows).toBe(0);

    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[1].status).toBe("duplicate_file");
    expect(result.rows[1].errorCode).toBe("duplicate_file");
    expect(result.rows[2].status).toBe("valid");
    expect(result.rows[3].status).toBe("duplicate_file");
  });
});

// ---- parseJson ------------------------------------------------------------

describe("parseJson", () => {
  it("parses a valid array of contact objects", () => {
    const result = parseJson(jsonArray([
      { email: "alice@example.com", name: "Alice" },
      { email: "bob@example.com", name: "Bob", attributes: { plan: "pro" } },
    ]));

    expect(result.format).toBe("json");
    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(2);
    expect(result.invalidRows).toBe(0);

    expect(result.rows[0].email).toBe("alice@example.com");
    expect(result.rows[0].name).toBe("Alice");
    expect(result.rows[0].attributes).toBeNull();

    expect(result.rows[1].email).toBe("bob@example.com");
    expect(result.rows[1].name).toBe("Bob");
    expect(result.rows[1].attributes).toEqual({ plan: "pro" });
  });

  it("parses a { contacts: [...] } envelope", () => {
    const result = parseJson(jsonEnvelope([
      { email: "alice@example.com" },
      { email: "bob@example.com" },
    ]));

    expect(result.validRows).toBe(2);
    expect(result.rows[0].email).toBe("alice@example.com");
    expect(result.rows[1].email).toBe("bob@example.com");
  });

  it("returns an empty result for invalid top-level shape (not array/object)", () => {
    const cases = [
      '"just a string"',
      "42",
      "true",
      "null",
      "{}", // object without `contacts` array
      '{ "contacts": "not-an-array" }',
    ];
    for (const c of cases) {
      const result = parseJson(c);
      expect(result.rows).toEqual([]);
      expect(result.totalRows).toBe(0);
      expect(result.validRows).toBe(0);
    }
  });

  it("returns an empty result for malformed JSON", () => {
    const result = parseJson("{ this is not valid json");
    expect(result.rows).toEqual([]);
    expect(result.totalRows).toBe(0);
  });

  it("requires email on every entry (missing or empty → invalid_email)", () => {
    const result = parseJson(jsonArray([
      { name: "No Email" }, // missing email
      { email: "" }, // empty email
      { email: "valid@example.com" },
    ]));

    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(2);
    expect(result.rows[0].status).toBe("invalid");
    expect(result.rows[0].errorCode).toBe("invalid_email");
    expect(result.rows[1].status).toBe("invalid");
    expect(result.rows[1].errorCode).toBe("invalid_email");
    expect(result.rows[2].status).toBe("valid");
  });

  it("treats name as optional (omitted → null, present → trimmed & capped)", () => {
    const result = parseJson(jsonArray([
      { email: "a@example.com" }, // no name
      { email: "b@example.com", name: "Bob" },
      { email: "c@example.com", name: 42 }, // non-string name → null
    ]));

    expect(result.rows[0].name).toBeNull();
    expect(result.rows[1].name).toBe("Bob");
    expect(result.rows[2].name).toBeNull(); // non-string is treated as null
  });

  it("treats attributes as optional (omitted → null)", () => {
    const result = parseJson(jsonArray([
      { email: "a@example.com" }, // no attributes
      { email: "b@example.com", attributes: { plan: "pro" } },
    ]));

    expect(result.rows[0].attributes).toBeNull();
    expect(result.rows[1].attributes).toEqual({ plan: "pro" });
  });

  it("rejects non-object attributes (array/string) with errorCode=invalid_attributes", () => {
    const result = parseJson(jsonArray([
      { email: "a@example.com", attributes: ["not", "an", "object"] },
      { email: "b@example.com", attributes: "string-not-object" },
      { email: "c@example.com", attributes: 42 },
    ]));

    expect(result.validRows).toBe(0);
    expect(result.invalidRows).toBe(3);
    for (const row of result.rows) {
      expect(row.status).toBe("invalid");
      expect(row.errorCode).toBe("invalid_attributes");
    }
  });

  it("rejects dangerous keys recursively at any depth", () => {
    // IMPORTANT: use JSON.parse to construct attributes containing __proto__ as
    // an OWN property. JavaScript object literals treat `__proto__` as a setter
    // (prototype mutation, not an own property), so the validator wouldn't see
    // the key. JSON.parse uses Object.defineProperty which creates real own
    // properties. `prototype` and `constructor` are normal keys and don't need
    // this treatment, but using JSON.parse for all of them keeps the test
    // consistent and matches how the parser actually receives parsed JSON.
    const cases: Array<{ label: string; attrs: unknown }> = [
      { label: "__proto__ at top level",
        attrs: JSON.parse('{"__proto__": {"poisoned": true}}') },
      { label: "prototype at top level",
        attrs: JSON.parse('{"prototype": {"x": 1}}') },
      { label: "constructor at top level",
        attrs: JSON.parse('{"constructor": "foo"}') },
      { label: "__proto__ nested one level deep",
        attrs: JSON.parse('{"outer": {"__proto__": {"poisoned": true}}}') },
      { label: "prototype nested two levels deep",
        attrs: JSON.parse('{"a": {"b": {"prototype": "x"}}}') },
      { label: "constructor nested three levels deep",
        attrs: JSON.parse('{"a": {"b": {"c": {"constructor": "x"}}}}') },
    ];

    for (const c of cases) {
      const result = parseJson(jsonArray([
        { email: "a@example.com", attributes: c.attrs },
      ]));
      expect(result.validRows, `case: ${c.label}`).toBe(0);
      expect(result.invalidRows, `case: ${c.label}`).toBe(1);
      expect(result.rows[0].status, `case: ${c.label}`).toBe("invalid");
      expect(result.rows[0].errorCode, `case: ${c.label}`).toBe("dangerous_key");
    }
  });

  it("enforces MAX_ATTRIBUTE_DEPTH (depth > 4 → attribute_depth_exceeded)", () => {
    // 6 levels of nested objects → recursion reaches depth=5, exceeds limit.
    //   root(0) → a(1) → b(2) → c(3) → d(4) → e(5) ← triggers error here.
    const deep = { a: { b: { c: { d: { e: { f: "too deep" } } } } } };
    const result = parseJson(jsonArray([
      { email: "deep@example.com", attributes: deep },
    ]));

    expect(result.validRows).toBe(0);
    expect(result.invalidRows).toBe(1);
    expect(result.rows[0].status).toBe("invalid");
    expect(result.rows[0].errorCode).toBe("attribute_depth_exceeded");
  });

  it("accepts attributes at exactly the depth limit (5 nested objects, depth=4)", () => {
    // 5 levels of nested objects → recursion reaches depth=4, which passes.
    //   root(0) → a(1) → b(2) → c(3) → d(4) → e(string) ← no further recurse.
    const ok = { a: { b: { c: { d: { e: "ok" } } } } };
    const result = parseJson(jsonArray([
      { email: "ok@example.com", attributes: ok },
    ]));

    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(0);
    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[0].attributes).toEqual(ok);
  });

  it("enforces MAX_ATTRIBUTES (more than 50 keys → too_many_attributes)", () => {
    const tooMany: Record<string, unknown> = {};
    for (let i = 0; i < MAX_ATTRIBUTES + 1; i++) {
      tooMany[`k${i}`] = i;
    }
    const result = parseJson(jsonArray([
      { email: "many@example.com", attributes: tooMany },
    ]));

    expect(result.validRows).toBe(0);
    expect(result.invalidRows).toBe(1);
    expect(result.rows[0].errorCode).toBe("too_many_attributes");
  });

  it("caps name at MAX_NAME_LENGTH characters", () => {
    const longName = "x".repeat(MAX_NAME_LENGTH + 100);
    const result = parseJson(jsonArray([
      { email: "a@example.com", name: longName },
    ]));

    expect(result.validRows).toBe(1);
    expect(result.rows[0].name).toHaveLength(MAX_NAME_LENGTH);
  });

  it("marks duplicate emails within the same JSON as duplicate_file (first wins)", () => {
    const result = parseJson(jsonArray([
      { email: "alice@example.com" },
      { email: "ALICE@example.com" }, // duplicate after normalization
      { email: "bob@example.com" },
      { email: "alice@example.com" }, // duplicate again
    ]));

    expect(result.validRows).toBe(2);
    expect(result.duplicateRows).toBe(2);
    expect(result.invalidRows).toBe(0);
    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[1].status).toBe("duplicate_file");
    expect(result.rows[2].status).toBe("valid");
    expect(result.rows[3].status).toBe("duplicate_file");
  });

  it("rejects non-object entries in the array (string/number/null/array)", () => {
    const result = parseJson(jsonArray([
      "just a string",
      42,
      null,
      ["array", "of", "strings"],
      { email: "valid@example.com" },
    ]));

    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(4);
    for (let i = 0; i < 4; i++) {
      expect(result.rows[i].status).toBe("invalid");
      expect(result.rows[i].errorCode).toBe("invalid_row_shape");
    }
  });

  it("hard-fails when entries exceed MAX_ROWS (returns top-level error)", () => {
    const items: { email: string }[] = [];
    for (let i = 0; i < MAX_ROWS + 5; i++) items.push({ email: `u${i}@example.com` });
    const result = parseJson(jsonArray(items));
    expect(result.error).toBe("too_many_rows");
    expect(result.rows).toHaveLength(0);
    expect(result.totalRows).toBe(MAX_ROWS + 5);
  });
});

// ---- parseXlsx ------------------------------------------------------------

describe("parseXlsx", () => {
  it("parses a valid sheet with email column + extra attribute columns", () => {
    const rows = [
      ["email", "name", "plan", "country"],
      ["alice@example.com", "Alice", "pro", "UK"],
      ["bob@example.com", "Bob", "free", "US"],
    ];
    const result = parseXlsx(rows);

    expect(result.format).toBe("xlsx");
    expect(result.totalRows).toBe(2); // excludes header
    expect(result.validRows).toBe(2);
    expect(result.invalidRows).toBe(0);

    expect(result.rows[0].email).toBe("alice@example.com");
    expect(result.rows[0].name).toBe("Alice");
    expect(result.rows[0].attributes).toEqual({ plan: "pro", country: "UK" });

    expect(result.rows[1].email).toBe("bob@example.com");
    expect(result.rows[1].name).toBe("Bob");
    expect(result.rows[1].attributes).toEqual({ plan: "free", country: "US" });
  });

  it("returns error=missing_email_header when there is no email column", () => {
    const rows = [["name", "plan"], ["Alice", "pro"]];
    const result = parseXlsx(rows);
    expect(result.error).toBe("missing_email_header");
    expect(result.rows).toEqual([]);
  });

  it("finds the email column case-insensitively (header 'Email' or 'EMAIL')", () => {
    const upper = parseXlsx([
      ["EMAIL", "Name"],
      ["a@example.com", "A"],
    ]);
    const mixed = parseXlsx([
      ["Email", "Name"],
      ["b@example.com", "B"],
    ]);
    expect(upper.validRows).toBe(1);
    expect(mixed.validRows).toBe(1);
    expect(upper.rows[0].email).toBe("a@example.com");
    expect(mixed.rows[0].email).toBe("b@example.com");
  });

  it("returns error=too_many_columns when there are too many columns", () => {
    const headers = new Array(MAX_COLUMNS + 1).fill(0).map((_, i) => `col${i}`);
    headers[0] = "email";
    const rows = [h[headers, ["a@example.com"]] as unknown as unknown[][];
    const result = parseXlsx(rows);
    expect(result.error).toBe("too_many_columns");
    expect(result.rows).toEqual([]);
  });

  it("accepts exactly MAX_COLUMNS columns", () => {
    const headers = new Array(MAX_COLUMNS).fill(0).map((_, i) =>
      i === 0 ? "email" : i === 1 ? "name" : `col${i}`,
    );
    const dataRow = new Array(MAX_COLUMNS).fill("");
    dataRow[0] = "a@example.com";
    dataRow[1] = "Alice";
    const result = parseXlsx([h[headers, dataRow]);
    expect(result.validRows).toBe(1);
    expect(result.rows[0].email).toBe("a@example.com");
  });

  it("marks a row invalid when the email cell exceeds MAX_CELL_LENGTH", () => {
    const longEmail = "a".repeat(MAX_CELL_LENGTH + 10) + "@example.com";
    const result = parseXlsx([
      ["email", "name"],
      [longEmail, "Alice"],
      ["ok@example.com", "Bob"],
    ]);

    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(1);
    expect(result.rows[0].status).toBe("invalid");
    expect(result.rows[0].errorCode).toBe("cell_too_long");
    expect(result.rows[1].status).toBe("valid");
  });

  it("rejects formula cells via the isFormulaCell callback", () => {
    const rows = [
      ["email", "name"],
      ["=HYPERLINK(\"http://evil\")", "Alice"], // formula in email cell
      ["ok@example.com", "Bob"],
    ];
    const isFormulaCell = (cell: unknown) =>
      typeof cell === "string" && cell.startsWith("=");
    const result = parseXlsx(rows, { isFormulaCell });

    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(1);
    expect(result.rows[0].status).toBe("invalid");
    expect(result.rows[0].errorCode).toBe("formula_cell");
    expect(result.rows[1].status).toBe("valid");
  });

  it("does NOT reject cells when no isFormulaCell callback is provided", () => {
    const rows = [
      ["email"],
      ["=HYPERLINK(\"http://evil\")"], // would be a formula but no callback
    ];
    const result = parseXlsx(rows);
    // Without the callback, the parser sees this as a (malformed) email string.
    expect(result.invalidRows).toBe(1);
    expect(result.rows[0].errorCode).toBe("invalid_email");
  });

  it("marks duplicate emails within the same sheet as duplicate_file", () => {
    const result = parseXlsx([
      ["email", "name"],
      ["alice@example.com", "First"],
      ["ALICE@example.com", "Second"], // duplicate after normalization
      ["bob@example.com", "Bob"],
    ]);

    expect(result.validRows).toBe(2);
    expect(result.duplicateRows).toBe(1);
    expect(result.rows[0].status).toBe("valid");
    expect(result.rows[1].status).toBe("duplicate_file");
    expect(result.rows[2].status).toBe("valid");
  });

  it("returns an empty result for an empty sheet", () => {
    const result = parseXlsx([]);
    expect(result.rows).toEqual([]);
    expect(result.totalRows).toBe(0);
  });

  it("returns zero data rows when only the header is present", () => {
    const result = parseXlsx([["email", "name"]]);
    expect(result.rows).toEqual([]);
    expect(result.totalRows).toBe(0);
    expect(result.validRows).toBe(0);
  });

  it("caps cell values to MAX_CELL_LENGTH when storing as attributes", () => {
    const longValue = "x".repeat(MAX_CELL_LENGTH + 50);
    const result = parseXlsx([
      ["email", "note"],
      ["a@example.com", longValue],
    ]);

    expect(result.validRows).toBe(1);
    expect(result.rows[0].attributes).toBeDefined();
    // The attribute value is capped to MAX_CELL_LENGTH chars.
    expect((result.rows[0].attributes as { note: string }).note).toHaveLength(MAX_CELL_LENGTH);
  });

  it("skips empty attribute values (only stores non-empty extra columns)", () => {
    const result = parseXlsx([
      ["email", "name", "plan", "country"],
      ["a@example.com", "Alice", "", "  "], // empty + whitespace-only
    ]);

    expect(result.rows[0].attributes).toBeNull(); // nothing non-empty → null
  });
});

// ---- Cross-parser consistency -------------------------------------------

describe("All parsers — duplicate handling", () => {
  it("duplicate emails in the same file produce duplicate_file status (not invalid)", () => {
    const txtResult = parseTxt(txt("a@example.com", "A@example.com"));
    const jsonResult = parseJson(jsonArray([
      { email: "a@example.com" },
      { email: "A@example.com" },
    ]));
    const xlsxResult = parseXlsx([
      ["email"],
      ["a@example.com"],
      ["A@example.com"],
    ]);

    for (const r of [txtResult, jsonResult, xlsxResult]) {
      expect(r.validRows).toBe(1);
      expect(r.duplicateRows).toBe(1);
      expect(r.invalidRows).toBe(0);
      expect(r.rows[0].status).toBe("valid");
      expect(r.rows[1].status).toBe("duplicate_file");
      expect(r.rows[1].errorCode).toBe("duplicate_file");
    }
  });

  it("duplicate count is tracked separately from invalid count (no overlap)", () => {
    const result = parseTxt(txt(
      "alice@example.com",
      "alice@example.com", // duplicate (not invalid)
      "not-an-email", // invalid (not duplicate)
      "bob@example.com",
      "alice@example.com", // duplicate again
    ));

    expect(result.validRows).toBe(2);
    expect(result.duplicateRows).toBe(2);
    expect(result.invalidRows).toBe(1);
    expect(result.totalRows).toBe(5);
  });
});

// ---- Compile-time assertions on limits (sanity) ---------------------------

describe("limits sanity", () => {
  it("MAX_ROWS is 10000", () => {
    expect(MAX_ROWS).toBe(10_000);
  });
  it("MAX_COLUMNS is 50", () => {
    expect(MAX_COLUMNS).toBe(50);
  });
  it("MAX_CELL_LENGTH is 2 KiB", () => {
    expect(MAX_CELL_LENGTH).toBe(2 * 1024);
  });
  it("MAX_ATTRIBUTES is 50", () => {
    expect(MAX_ATTRIBUTES).toBe(50);
  });
  it("MAX_ATTRIBUTE_DEPTH is 4", () => {
    expect(MAX_ATTRIBUTE_DEPTH).toBe(4);
  });
  it("MAX_NAME_LENGTH is 200", () => {
    expect(MAX_NAME_LENGTH).toBe(200);
  });

  it("ParseResult type is satisfied by all parser outputs", () => {
    // Compile-time check — the assignment below must type-check.
    const txt_: ParseResult = parseTxt("a@example.com");
    const json_: ParseResult = parseJson("[]");
    const xlsx_: ParseResult = parseXlsx([]);
    expect(txt_.format).toBe("txt");
    expect(json_.format).toBe("json");
    expect(xlsx_.format).toBe("xlsx");
  });
});
