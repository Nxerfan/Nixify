import { describe, it, expect } from "vitest";
import {
  renderTransactionalTemplate,
  escapeHtml,
  scalarToText,
  extractVariables,
  findMissingVariables,
  sanitizeTemplateHtml,
  validateVariableValues,
  previewSchema,
} from "@/lib/transactional-templates";

/**
 * Transactional Templates — pure unit tests for the rendering + validation
 * layer (Phase 3, sections 11-16, 28).
 *
 * NO DATABASE. NO network. NO env gating. This file runs as part of the
 * generic `bun run test` job and must always pass in any environment.
 *
 * Coverage:
 * - extractVariables: dedup + sort, dotted paths ignored, whitespace tolerated,
 *   invalid names ignored.
 * - findMissingVariables: returns the missing names.
 * - renderTransactionalTemplate: success + missing + escaping + scalar
 *   coercion + subject CR/LF protection + null handling.
 * - escapeHtml: OWASP set (& < > " ').
 * - scalarToText: null/boolean/number/string.
 * - validateVariableValues: scalars accepted, objects/arrays rejected.
 * - sanitizeTemplateHtml: script/iframe/form stripped, on* + javascript:
 *   blocked, email-safe tags preserved.
 * - previewSchema: mode validation (templateId XOR subject+html).
 */

// ---- extractVariables -------------------------------------------------------

describe("extractVariables", () => {
  it("dedupes + sorts variables across subject, html, and text", () => {
    const vars = extractVariables(
      "Welcome {{name}}",
      "Email: {{email}}",
      "{{name}} — {{email}}",
    );
    expect(vars).toEqual(["email", "name"]);
  });

  it("ignores dotted paths like {{user.name}}", () => {
    const vars = extractVariables("Hi {{user.name}} from {{planet}}", undefined, null);
    // user.name is rejected by the grammar — only flat names are extracted.
    expect(vars).toEqual(["planet"]);
  });

  it("ignores invalid names (starts with digit, empty, etc.)", () => {
    const vars = extractVariables(
      "{{1bad}} {{}} {{_underscoreStart}} {{good}}",
    );
    // 1bad: starts with digit — rejected.
    // {} : empty — rejected.
    // _underscoreStart: starts with underscore — rejected by VARIABLE_NAME_RE.
    // good: valid.
    expect(vars).toEqual(["good"]);
  });

  it("tolerates whitespace inside the braces", () => {
    const vars = extractVariables("{{ name }} and {{age}}", "{{name}}", null);
    expect(vars).toEqual(["age", "name"]);
  });

  it("returns an empty array when no variables are present", () => {
    expect(extractVariables("plain text", "<p>no tokens</p>", null)).toEqual([]);
  });

  it("handles null/undefined sources", () => {
    expect(extractVariables(undefined, null, undefined)).toEqual([]);
  });
});

// ---- findMissingVariables ---------------------------------------------------

describe("findMissingVariables", () => {
  it("returns names that are not keys of the provided values", () => {
    const missing = findMissingVariables(
      ["name", "email", "order_id"],
      { name: "Alice" },
    );
    expect(missing.sort()).toEqual(["email", "order_id"]);
  });

  it("returns an empty array when everything is provided", () => {
    expect(
      findMissingVariables(["a", "b"], { a: "1", b: "2" }),
    ).toEqual([]);
  });

  it("treats a value of null as PRESENT (null is a valid scalar)", () => {
    // null is a deliberate value — findMissingVariables should NOT flag it.
    const missing = findMissingVariables(["name"], { name: null });
    expect(missing).toEqual([]);
  });

  it("returns the full list when nothing is provided", () => {
    expect(findMissingVariables(["a", "b", "c"], {})).toEqual(["a", "b", "c"]);
  });
});

// ---- renderTransactionalTemplate -------------------------------------------

describe("renderTransactionalTemplate", () => {
  it("substitutes string/number/boolean/null values into subject, html, and text", () => {
    const result = renderTransactionalTemplate({
      subject: "Hi {{name}}, your order #{{order_id}} is {{status}}",
      html: "<p>Welcome {{name}}</p><p>Order: #{{order_id}}</p><p>Status: {{status}}</p><p>Note: {{note}}</p>",
      text: "Hi {{name}} — order #{{order_id}} is {{status}}. Note: {{note}}",
      variables: ["name", "order_id", "status", "note"],
      values: {
        name: "Alice",
        order_id: 12345,
        status: true,
        note: null,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return; // type-narrow

    expect(result.subject).toBe("Hi Alice, your order #12345 is true");
    expect(result.html).toBe(
      "<p>Welcome Alice</p><p>Order: #12345</p><p>Status: true</p><p>Note: </p>",
    );
    expect(result.text).toBe("Hi Alice — order #12345 is true. Note: ");
  });

  it("returns a structured missing-variables error when a required var is absent", () => {
    const result = renderTransactionalTemplate({
      subject: "Hi {{name}}",
      html: "<p>{{name}} ({{email}})</p>",
      text: "{{name}} {{email}}",
      variables: ["name", "email"],
      values: { name: "Alice" }, // email missing
    });

    expect(result.ok).toBe(false);
    if (result.ok) return; // type-narrow
    expect(result.code).toBe("missing_template_variables");
    expect(result.missing).toEqual(["email"]); // sorted
  });

  it("returns missing variables sorted (multiple missing)", () => {
    const result = renderTransactionalTemplate({
      subject: "{{zeta}} {{alpha}} {{middle}}",
      html: "{{zeta}}",
      text: null,
      variables: ["zeta", "alpha", "middle"],
      values: {},
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Sorted alphabetically, regardless of insertion order.
    expect(result.missing).toEqual(["alpha", "middle", "zeta"]);
  });

  it("HTML-escapes variable values — a <script> payload renders as text, not a tag", () => {
    const payload = "<script>alert(1)</script>";
    const result = renderTransactionalTemplate({
      subject: "Hi {{name}}",
      html: "<p>{{name}}</p>",
      text: "{{name}}",
      variables: ["name"],
      values: { name: payload },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The literal escaped form is present...
    expect(result.html).toContain("&lt;script&gt;");
    // ...and the raw <script> tag is NOT present anywhere in the output.
    expect(result.html).not.toContain("<script>");
    expect(result.html).not.toContain("</script>");
  });

  it("renders numbers as their string form", () => {
    const result = renderTransactionalTemplate({
      subject: "{{count}} items",
      html: "<p>{{count}}</p>",
      text: "{{count}}",
      variables: ["count"],
      values: { count: 42 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.subject).toBe("42 items");
    expect(result.html).toBe("<p>42</p>");
    expect(result.text).toBe("42");
  });

  it("renders booleans as the strings \"true\" / \"false\"", () => {
    const r1 = renderTransactionalTemplate({
      subject: "{{flag}}",
      html: "{{flag}}",
      text: "{{flag}}",
      variables: ["flag"],
      values: { flag: true },
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.subject).toBe("true");
    expect(r1.html).toBe("true");
    expect(r1.text).toBe("true");

    const r2 = renderTransactionalTemplate({
      subject: "{{flag}}",
      html: "{{flag}}",
      text: "{{flag}}",
      variables: ["flag"],
      values: { flag: false },
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.subject).toBe("false");
  });

  it("renders null values as an empty string in subject, html, and text", () => {
    const result = renderTransactionalTemplate({
      subject: "Hi {{name}}!",
      html: "<p>{{name}}</p>",
      text: "Hi {{name}}!",
      variables: ["name"],
      values: { name: null },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.subject).toBe("Hi !");
    expect(result.html).toBe("<p></p>");
    expect(result.text).toBe("Hi !");
  });

  it("subject CR/LF protection — variable values with newlines are flattened", () => {
    const result = renderTransactionalTemplate({
      subject: "Hello {{name}}!",
      html: "<p>{{name}}</p>",
      text: null,
      variables: ["name"],
      values: { name: "line1\r\nline2\nline3\ralone" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The rendered subject must contain NO carriage returns or line feeds.
    expect(result.subject.includes("\r")).toBe(false);
    expect(result.subject.includes("\n")).toBe(false);
    // The HTML, however, keeps them as-is (HTML is not subject to header
    // injection — values are still escaped, just not newline-stripped).
    expect(result.html).toContain("line1\r\nline2\nline3\ralone");
  });

  it("subject CR/LF protection — CR/LF embedded in the subject TEMPLATE itself are stripped", () => {
    const result = renderTransactionalTemplate({
      subject: "Line 1\r\nLine 2 {{name}}",
      html: "<p>{{name}}</p>",
      text: null,
      variables: ["name"],
      values: { name: "Alice" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.subject.includes("\r")).toBe(false);
    expect(result.subject.includes("\n")).toBe(false);
  });

  it("leaves unknown tokens as-is (defense in depth)", () => {
    // If the variables list disagrees with the content (shouldn't happen —
    // extractVariables is authoritative at write time), unknown tokens are
    // not silently dropped, they are left in place.
    const result = renderTransactionalTemplate({
      subject: "{{known}} {{unknown}}",
      html: "<p>{{known}} {{unknown}}</p>",
      text: null,
      variables: ["known"],
      values: { known: "x" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.subject).toBe("x {{unknown}}");
    expect(result.html).toBe("<p>x {{unknown}}</p>");
  });

  it("handles null text input — text result is null", () => {
    const result = renderTransactionalTemplate({
      subject: "{{name}}",
      html: "<p>{{name}}</p>",
      text: null,
      variables: ["name"],
      values: { name: "Alice" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBeNull();
  });
});

// ---- escapeHtml -------------------------------------------------------------

describe("escapeHtml", () => {
  it("escapes the OWASP set: & < > \" '", () => {
    expect(escapeHtml(`a & b < c > d " e ' f`)).toBe(
      "a &amp; b &lt; c &gt; d &quot; e &#x27; f",
    );
  });

  it("escapes & first so it does not double-encode other entities", () => {
    // The & in "&lt;" must not be re-encoded — escapeHtml must encode the
    // literal & in the input ONCE, then leave < > " ' for their own passes.
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml("&")).toBe("&amp;");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;"); // input has literal &lt; not a tag
  });

  it("escapes each special char even when repeated", () => {
    expect(escapeHtml("<<<")).toBe("&lt;&lt;&lt;");
    expect(escapeHtml('"""')).toBe("&quot;&quot;&quot;");
  });

  it("returns an empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });
});

// ---- scalarToText -----------------------------------------------------------

describe("scalarToText", () => {
  it("null → empty string", () => {
    expect(scalarToText(null)).toBe("");
  });

  it("true → \"true\"", () => {
    expect(scalarToText(true)).toBe("true");
  });

  it("false → \"false\"", () => {
    expect(scalarToText(false)).toBe("false");
  });

  it("42 → \"42\"", () => {
    expect(scalarToText(42)).toBe("42");
  });

  it("0 → \"0\" (not empty)", () => {
    expect(scalarToText(0)).toBe("0");
  });

  it("\"abc\" → \"abc\" (unchanged)", () => {
    expect(scalarToText("abc")).toBe("abc");
  });

  it("negative number renders with the minus sign", () => {
    expect(scalarToText(-7)).toBe("-7");
  });
});

// ---- validateVariableValues -------------------------------------------------

describe("validateVariableValues", () => {
  it("accepts string values", () => {
    const r = validateVariableValues({ a: "hello" });
    expect(r.valid).toBe(true);
    if (!r.valid) return;
    expect(r.value).toEqual({ a: "hello" });
  });

  it("accepts number values", () => {
    const r = validateVariableValues({ a: 42, b: 0, c: -1 });
    expect(r.valid).toBe(true);
    if (!r.valid) return;
    expect(r.value).toEqual({ a: 42, b: 0, c: -1 });
  });

  it("accepts boolean values", () => {
    const r = validateVariableValues({ a: true, b: false });
    expect(r.valid).toBe(true);
    if (!r.valid) return;
    expect(r.value).toEqual({ a: true, b: false });
  });

  it("accepts null values", () => {
    const r = validateVariableValues({ a: null });
    expect(r.valid).toBe(true);
    if (!r.valid) return;
    expect(r.value).toEqual({ a: null });
  });

  it("accepts a mix of all four scalar types", () => {
    const r = validateVariableValues({
      s: "str",
      n: 1,
      b: true,
      nil: null,
    });
    expect(r.valid).toBe(true);
  });

  it("REJECTS an object value with a structured error", () => {
    const r = validateVariableValues({ a: { b: 1 } });
    expect(r.valid).toBe(false);
    if (r.valid) return;
    expect(r.error).toContain("a");
    expect(r.error).toMatch(/string, number, boolean, or null/);
  });

  it("REJECTS an array value with a structured error", () => {
    const r = validateVariableValues({ a: [1, 2] });
    expect(r.valid).toBe(false);
    if (r.valid) return;
    expect(r.error).toContain("a");
  });

  it("rejects the first non-scalar value it encounters", () => {
    const r = validateVariableValues({ good: "ok", bad: { x: 1 } });
    expect(r.valid).toBe(false);
    if (r.valid) return;
    expect(r.error).toContain("bad");
  });
});

// ---- sanitizeTemplateHtml ---------------------------------------------------

describe("sanitizeTemplateHtml", () => {
  it("strips <script> tags entirely", () => {
    const out = sanitizeTemplateHtml('<p>hello</p><script>alert(1)</script>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("<p>hello</p>");
  });

  it("strips inline <script> with attributes", () => {
    const out = sanitizeTemplateHtml(
      '<div>x</div><script type="text/javascript">evil()</script>',
    );
    expect(out).not.toContain("<script");
    expect(out).not.toContain("evil()");
    expect(out).toContain("<div>x</div>");
  });

  it("strips on* event-handler attributes (onclick, onerror, onload)", () => {
    const out = sanitizeTemplateHtml(
      '<p onclick="alert(1)" onerror="boom()">click</p>',
    );
    expect(out.toLowerCase()).not.toContain("onclick");
    expect(out.toLowerCase()).not.toContain("onerror");
    expect(out).toContain("click");
  });

  it("strips on* attributes even when mixed with allowed attrs", () => {
    const out = sanitizeTemplateHtml(
      '<a href="https://example.com" onclick="evil()">link</a>',
    );
    expect(out.toLowerCase()).not.toContain("onclick");
    expect(out).toContain("https://example.com");
  });

  it("blocks javascript: URLs in href", () => {
    const out = sanitizeTemplateHtml(
      '<a href="javascript:alert(1)">click me</a>',
    );
    // The javascript: scheme must not survive.
    expect(out.toLowerCase()).not.toContain("javascript:");
    expect(out).toContain("click me");
  });

  it("blocks javascript: URLs in src (img)", () => {
    const out = sanitizeTemplateHtml(
      '<img src="javascript:alert(1)" alt="x">',
    );
    expect(out.toLowerCase()).not.toContain("javascript:");
  });

  it("preserves email-safe table HTML", () => {
    const html = '<table><tr><td>cell</td></tr></table>';
    expect(sanitizeTemplateHtml(html)).toContain("<table>");
    expect(sanitizeTemplateHtml(html)).toContain("<tr>");
    expect(sanitizeTemplateHtml(html)).toContain("<td>cell</td>");
  });

  it("preserves div, p, a (with safe href), and img tags", () => {
    const html =
      '<div class="x"><p>Hi</p><a href="https://example.com">link</a><img src="https://example.com/i.png" alt="img"></div>';
    const out = sanitizeTemplateHtml(html);
    expect(out).toContain("<div");
    expect(out).toContain("<p>Hi</p>");
    expect(out).toContain("https://example.com");
    expect(out).toContain("<img");
  });

  it("removes <iframe> tags", () => {
    const out = sanitizeTemplateHtml('<p>ok</p><iframe src="https://evil"></iframe>');
    expect(out.toLowerCase()).not.toContain("<iframe");
    expect(out.toLowerCase()).not.toContain("</iframe");
    expect(out).toContain("<p>ok</p>");
  });

  it("removes <form> tags and form controls", () => {
    const out = sanitizeTemplateHtml(
      '<form action="https://evil"><input name="x"><button>go</button></form>',
    );
    expect(out.toLowerCase()).not.toContain("<form");
    expect(out.toLowerCase()).not.toContain("<input");
    expect(out.toLowerCase()).not.toContain("<button");
  });

  it("removes <object> and <embed> tags", () => {
    const out = sanitizeTemplateHtml(
      '<object data="https://evil/x.swf"></object><embed src="https://evil/y.swf">',
    );
    expect(out.toLowerCase()).not.toContain("<object");
    expect(out.toLowerCase()).not.toContain("<embed");
  });

  it("strips <style> blocks (no CSS injection)", () => {
    const out = sanitizeTemplateHtml('<style>body{background:url(javascript:alert(1))}</style><p>ok</p>');
    expect(out.toLowerCase()).not.toContain("<style");
    expect(out.toLowerCase()).not.toContain("</style");
    expect(out).toContain("<p>ok</p>");
  });

  it("allows inline style with safe CSS properties only", () => {
    const out = sanitizeTemplateHtml('<p style="color: red; font-size: 14px;">x</p>');
    // sanitize-html re-serializes inline styles; whitespace around the colon
    // may be normalized. Assert the key-value pairs survive, not the exact
    // spacing.
    expect(out).toContain("color:");
    expect(out).toContain("red");
    expect(out).toContain("font-size:");
    expect(out).toContain("14px");
    // Dangerous CSS (e.g. expression()) would be dropped — assert the safe
    // properties do survive.
    expect(out).toContain("<p");
    expect(out).toContain(">x</p>");
  });

  it("is idempotent (double-sanitizing gives the same output)", () => {
    const html = '<div><p>Hi</p><script>x</script><a href="javascript:1">y</a></div>';
    const once = sanitizeTemplateHtml(html);
    const twice = sanitizeTemplateHtml(once);
    expect(twice).toBe(once);
  });
});

// ---- previewSchema ----------------------------------------------------------

describe("previewSchema", () => {
  it("accepts { templateId } mode", () => {
    const r = previewSchema.safeParse({ templateId: 1, variables: {} });
    expect(r.success).toBe(true);
  });

  it("accepts { templateId, version } mode", () => {
    const r = previewSchema.safeParse({ templateId: 1, version: 3, variables: {} });
    expect(r.success).toBe(true);
  });

  it("accepts inline { subject, html } mode", () => {
    const r = previewSchema.safeParse({
      subject: "Hi {{name}}",
      html: "<p>{{name}}</p>",
      variables: { name: "Alice" },
    });
    expect(r.success).toBe(true);
  });

  it("accepts inline { subject, html, text } mode", () => {
    const r = previewSchema.safeParse({
      subject: "Hi {{name}}",
      html: "<p>{{name}}</p>",
      text: "Hi {{name}}",
      variables: {},
    });
    expect(r.success).toBe(true);
  });

  it("accepts BOTH templateId AND inline content (both modes set)", () => {
    const r = previewSchema.safeParse({
      templateId: 1,
      subject: "Hi",
      html: "<p>Hi</p>",
      variables: {},
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty object — neither mode provided", () => {
    const r = previewSchema.safeParse({ variables: {} });
    expect(r.success).toBe(false);
  });

  it("rejects { subject } alone (no html)", () => {
    const r = previewSchema.safeParse({
      subject: "Hi {{name}}",
      variables: {},
    });
    expect(r.success).toBe(false);
  });

  it("rejects { html } alone (no subject)", () => {
    const r = previewSchema.safeParse({
      html: "<p>{{name}}</p>",
      variables: {},
    });
    expect(r.success).toBe(false);
  });

  it("applies the variables default when omitted", () => {
    const r = previewSchema.safeParse({
      subject: "Hi",
      html: "<p>Hi</p>",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.variables).toEqual({});
  });

  it("rejects a non-positive templateId", () => {
    const r = previewSchema.safeParse({ templateId: -1, variables: {} });
    expect(r.success).toBe(false);
  });

  it("rejects a non-integer templateId", () => {
    const r = previewSchema.safeParse({ templateId: 1.5, variables: {} });
    expect(r.success).toBe(false);
  });
});
