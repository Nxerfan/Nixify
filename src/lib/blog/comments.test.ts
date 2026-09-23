/**
 * Phase 18 — Blog comment service unit tests (blocker fixes).
 *
 * Pure tests (no DB) covering:
 *   - body validation (length, HTML rejection, plain-text normalization)
 *   - slug validation (real corpus lookup)
 *   - author-name resolution (NO email local-part fallback — Blocker 5)
 *   - tombstone labels (localized)
 *   - rate-limit config
 *   - XSS safety (HTML rejected at validation layer)
 *
 * Real DB integration tests live in comments-integration.test.ts and run
 * only in CI with TEST_DATABASE_URL + RUN_BLOG_INTEGRATION=1.
 */
import { describe, it, expect } from "vitest";
import {
  validateCommentBody,
  resolveAuthorName,
  tombstoneLabel,
  deletedCommentLabel,
  isValidArticleSlug,
  isValidArticleSlugAnyLocale,
  COMMENT_MAX_LEN,
  COMMENT_MIN_LEN,
  COMMENT_RATE_LIMITS,
  COMMENT_PAGE_SIZE,
  REPLIES_MAX_FETCH,
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

// ─── Slug validation (Blocker 2) ───────────────────────────────────────────

describe("slug validation", () => {
  it("isValidArticleSlug accepts a real (slug, locale) pair", () => {
    expect(isValidArticleSlug("welcome-to-nixify", "en")).toBe(true);
    expect(isValidArticleSlug("welcome-to-nixify", "fa")).toBe(true);
    expect(isValidArticleSlug("smtp-vs-api-verification", "en")).toBe(true);
  });

  it("isValidArticleSlug rejects a fabricated slug", () => {
    expect(isValidArticleSlug("this-article-does-not-exist", "en")).toBe(false);
    expect(isValidArticleSlug("fake-slug-12345", "fa")).toBe(false);
  });

  it("isValidArticleSlugAnyLocale accepts a real slug in any locale", () => {
    expect(isValidArticleSlugAnyLocale("welcome-to-nixify")).toBe(true);
  });

  it("isValidArticleSlugAnyLocale rejects a fabricated slug", () => {
    expect(isValidArticleSlugAnyLocale("totally-fabricated-slug")).toBe(false);
  });
});

// ─── Author name resolution (Blocker 5) ────────────────────────────────────

describe("resolveAuthorName (Blocker 5 — no email fallback)", () => {
  it("prefers firstName + lastName", () => {
    expect(resolveAuthorName({ firstName: "Ali", lastName: "Rezaei" }, "en")).toBe("Ali Rezaei");
  });

  it("falls back to fullName when no firstName/lastName", () => {
    expect(resolveAuthorName({ fullName: "Ali Rezaei" }, "en")).toBe("Ali Rezaei");
  });

  it("falls back to firstName only when lastName is missing", () => {
    expect(resolveAuthorName({ firstName: "Ali" }, "en")).toBe("Ali");
  });

  it("returns generic EN 'User' when no public name exists (NOT email local-part)", () => {
    // Blocker 5: MUST NOT fall back to the email local-part.
    expect(resolveAuthorName({}, "en")).toBe("User");
  });

  it("returns generic FA 'کاربر' when no public name exists", () => {
    expect(resolveAuthorName({}, "fa")).toBe("کاربر");
  });

  it("does NOT use the email field even when present", () => {
    // The function signature doesn't even accept `email` — proving the
    // email local-part fallback is impossible.
    // @ts-expect-error — email is intentionally not a valid input.
    expect(resolveAuthorName({ email: "ali@example.com" }, "en")).toBe("User");
  });
});

// ─── Tombstone labels (Blocker 3 + 5) ─────────────────────────────────────

describe("tombstone labels", () => {
  it("tombstoneLabel is localized (en/fa)", () => {
    expect(tombstoneLabel("en")).toBe("Deleted user");
    expect(tombstoneLabel("fa")).toBe("کاربر حذف‌شده");
  });

  it("deletedCommentLabel is localized (en/fa)", () => {
    expect(deletedCommentLabel("en")).toBe("Comment deleted");
    expect(deletedCommentLabel("fa")).toBe("این نظر حذف شده است.");
  });
});

// ─── Rate-limit + pagination config ───────────────────────────────────────

describe("comment rate-limit + pagination config", () => {
  it("has sane per-minute and per-hour limits", () => {
    expect(COMMENT_RATE_LIMITS.COMMENT_POST_PER_MIN).toBeGreaterThan(0);
    expect(COMMENT_RATE_LIMITS.COMMENT_POST_PER_HOUR).toBeGreaterThan(
      COMMENT_RATE_LIMITS.COMMENT_POST_PER_MIN,
    );
  });

  it("page size + reply fetch bound are positive", () => {
    expect(COMMENT_PAGE_SIZE).toBeGreaterThan(0);
    expect(REPLIES_MAX_FETCH).toBeGreaterThan(0);
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
