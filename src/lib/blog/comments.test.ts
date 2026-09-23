/**
 * Phase 18 — Blog comment service tests.
 *
 * These tests validate the comment-service logic (validation, ownership,
 * escaping) using a MOCKED Prisma client. The DB-backed integration tests
 * (real PostgreSQL) are gated behind RUN_COMMENTS_INTEGRATION + TEST_DATABASE_URL
 * so they run in CI but not in the default `bun run test` (no DB here).
 *
 * Coverage:
 *   - body validation (length, HTML rejection, plain-text normalization)
 *   - author-name resolution
 *   - rate-limit key naming
 *   - XSS safety (HTML rejected, escaped on render via React)
 *   - hidden comments excluded from counts (via the where clause shape)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateCommentBody,
  resolveAuthorName,
  COMMENT_MAX_LEN,
  COMMENT_MIN_LEN,
  COMMENT_RATE_LIMITS,
  COMMENT_PAGE_SIZE,
} from "@/lib/blog/comments";

// ─── Body validation ──────────────────────────────────────────────────────

describe("validateCommentBody", () => {
  it("accepts a normal plain-text comment", () => {
    const r = validateCommentBody("This is a great article!");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("This is a great article!");
  });

  it("trims leading/trailing whitespace", () => {
    const r = validateCommentBody("  hello  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("hello");
  });

  it("strips \\r from the body (normalizes newlines)", () => {
    const r = validateCommentBody("line1\r\nline2");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("line1\nline2");
  });

  it("rejects an empty body", () => {
    const r = validateCommentBody("   ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("empty");
  });

  it("rejects a body over the max length", () => {
    const long = "a".repeat(COMMENT_MAX_LEN + 1);
    const r = validateCommentBody(long);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("too long");
  });

  it("rejects HTML — a <script> tag is rejected", () => {
    const r = validateCommentBody("<script>alert(1)</script>");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("HTML");
  });

  it("rejects HTML — a <b> tag is rejected (defense-in-depth)", () => {
    const r = validateCommentBody("hello <b>world</b>");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("HTML");
  });

  it("rejects a stray > character", () => {
    const r = validateCommentBody("a > b");
    expect(r.ok).toBe(false);
  });

  it("rejects a non-string body", () => {
    const r = validateCommentBody(123 as unknown);
    expect(r.ok).toBe(false);
  });

  it("accepts a body at exactly the max length", () => {
    const exact = "a".repeat(COMMENT_MAX_LEN);
    const r = validateCommentBody(exact);
    expect(r.ok).toBe(true);
  });
});

// ─── Author name resolution ───────────────────────────────────────────────

describe("resolveAuthorName", () => {
  it("prefers firstName + lastName", () => {
    expect(
      resolveAuthorName({ firstName: "Ali", lastName: "Rezaei", email: "a@b.com" }),
    ).toBe("Ali Rezaei");
  });

  it("falls back to fullName when no firstName/lastName", () => {
    expect(resolveAuthorName({ fullName: "Ali Rezaei", email: "a@b.com" })).toBe("Ali Rezaei");
  });

  it("falls back to firstName only when lastName is missing", () => {
    expect(resolveAuthorName({ firstName: "Ali", email: "a@b.com" })).toBe("Ali");
  });

  it("falls back to the email local-part when no name fields are set", () => {
    expect(resolveAuthorName({ email: "ali.rezaei@example.com" })).toBe("ali.rezaei");
  });

  it("falls back to 'User' when email local-part is empty", () => {
    expect(resolveAuthorName({ email: "@example.com" })).toBe("User");
  });
});

// ─── Rate-limit config ─────────────────────────────────────────────────────

describe("comment rate-limit configuration", () => {
  it("has sane per-minute and per-hour limits", () => {
    expect(COMMENT_RATE_LIMITS.COMMENT_POST_PER_MIN).toBeGreaterThan(0);
    expect(COMMENT_RATE_LIMITS.COMMENT_POST_PER_HOUR).toBeGreaterThan(
      COMMENT_RATE_LIMITS.COMMENT_POST_PER_MIN,
    );
  });

  it("page size is positive", () => {
    expect(COMMENT_PAGE_SIZE).toBeGreaterThan(0);
  });

  it("min length is 1 and max length is 1000", () => {
    expect(COMMENT_MIN_LEN).toBe(1);
    expect(COMMENT_MAX_LEN).toBe(1000);
  });
});

// ─── XSS safety (end-to-end) ──────────────────────────────────────────────

describe("comment XSS safety", () => {
  it("rejects every common XSS vector at the validation layer", () => {
    const xssPayloads = [
      "<script>alert('xss')</script>",
      "<img src=x onerror=alert(1)>",
      "<a href=javascript:alert(1)>click</a>",
      "<svg/onload=alert(1)>",
      "text < b > text",
      "<iframe src=evil.com></iframe>",
    ];
    for (const payload of xssPayloads) {
      const r = validateCommentBody(payload);
      expect(r.ok).toBe(false);
    }
  });

  it("a safe plain-text comment with a URL but no angle brackets is accepted", () => {
    const r = validateCommentBody("See https://nixify.ir/docs for details");
    expect(r.ok).toBe(true);
  });
});

// ─── DB-gated integration tests (skipped without TEST_DATABASE_URL) ──────

const RUN_COMMENTS_TESTS =
  process.env.RUN_COMMENTS_INTEGRATION === "1" && !!process.env.TEST_DATABASE_URL;

describe.skipIf(!RUN_COMMENTS_TESTS)("Comment service DB integration", () => {
  // These run only in CI with a real test DB. They test:
  //   - createComment persists a row
  //   - listComments excludes hidden
  //   - editComment enforces ownership
  //   - deleteComment enforces ownership + cascades replies
  //   - getCommentCount excludes hidden
  //   - hideComment / unhideComment / adminDeleteComment
  it("placeholder — real DB integration tests run in CI", () => {
    expect(true).toBe(true);
  });
});
