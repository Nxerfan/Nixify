/**
 * Phase 15 — Blog & Content Foundation tests.
 *
 * Coverage:
 *   - Content loading + validation
 *   - Duplicate slug detection
 *   - Article lookup by slug + locale
 *   - Locale fallback behavior
 *   - Index ordering
 *   - Markdown rendering safety
 *
 * Pure tests (no DB, no DOM) — blog content is source-controlled.
 */
import { describe, it, expect } from "vitest";
import { getArticle, getArticles, getAllSlugs } from "@/lib/blog/content";
import ReactMarkdown from "react-markdown";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

describe("Blog content — loading + validation", () => {
  it("getArticle returns article for valid slug + locale", () => {
    const article = getArticle("welcome-to-nixify", "en");
    expect(article).not.toBeNull();
    expect(article!.slug).toBe("welcome-to-nixify");
    expect(article!.locale).toBe("en");
    expect(article!.title).toBeTruthy();
    expect(article!.description).toBeTruthy();
    expect(article!.body).toBeTruthy();
    expect(article!.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("getArticle returns Persian article for fa locale", () => {
    const article = getArticle("welcome-to-nixify", "fa");
    expect(article).not.toBeNull();
    expect(article!.locale).toBe("fa");
    expect(article!.title).toContain("Nixify");
  });

  it("getArticle returns null for unknown slug", () => {
    const article = getArticle("nonexistent-slug", "en");
    expect(article).toBeNull();
  });

  it("getArticle falls back to English when fa locale article doesn't exist", () => {
    // smtp-vs-api-verification only exists in en
    const article = getArticle("smtp-vs-api-verification", "fa");
    expect(article).not.toBeNull();
    expect(article!.locale).toBe("en"); // fallback
    expect(article!.title).toContain("SMTP");
  });
});

describe("Blog index — ordering + completeness", () => {
  it("getArticles returns articles sorted newest first", () => {
    const articles = getArticles("en");
    expect(articles.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < articles.length; i++) {
      expect(articles[i - 1].publishedAt >= articles[i].publishedAt).toBe(true);
    }
  });

  it("getArticles includes all slugs for the locale", () => {
    const enArticles = getArticles("en");
    const enSlugs = enArticles.map(a => a.slug);
    expect(enSlugs).toContain("welcome-to-nixify");
    expect(enSlugs).toContain("smtp-vs-api-verification");
  });

  it("getArticles for fa includes fa articles + en fallbacks for missing slugs", () => {
    const faArticles = getArticles("fa");
    const faSlugs = faArticles.map(a => a.slug);
    expect(faSlugs).toContain("welcome-to-nixify");
    expect(faSlugs).toContain("smtp-vs-api-verification"); // en fallback
  });

  it("getAllSlugs returns unique slugs across all locales", () => {
    const slugs = getAllSlugs();
    const unique = new Set(slugs);
    expect(slugs.length).toBe(unique.size);
  });
});

describe("Blog content — duplicate slug detection", () => {
  it("content loader does not throw (no duplicates in seed content)", () => {
    // The content.ts module validates at import time.
    // If duplicates existed, the import would have thrown.
    // This test verifies the import succeeds.
    expect(getArticle("welcome-to-nixify", "en")).not.toBeNull();
  });
});

describe("Blog rendering — Markdown safety", () => {
  it("ReactMarkdown renders paragraphs", () => {
    const html = renderToStaticMarkup(
      React.createElement(ReactMarkdown, null, "Hello world")
    );
    expect(html).toContain("<p>");
    expect(html).toContain("Hello world");
  });

  it("ReactMarkdown renders code blocks with dir=ltr", () => {
    const md = "```js\nconsole.log('hello');\n```";
    const html = renderToStaticMarkup(
      React.createElement(ReactMarkdown, {
        components: {
          code: ({ children, className }: any) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return React.createElement("code", { dir: "ltr", className: "block" }, children);
            }
            return React.createElement("code", { dir: "ltr" }, children);
          },
          pre: ({ children }: any) => children,
        },
      }, md)
    );
    expect(html).toContain('dir="ltr"');
  });

  it("ReactMarkdown does NOT execute raw HTML script tags", () => {
    const md = '<script>alert("xss")</script>';
    const html = renderToStaticMarkup(
      React.createElement(ReactMarkdown, null, md)
    );
    // react-markdown renders raw HTML as escaped text, not as executable elements
    expect(html).not.toContain("<script>");
    // The content is escaped — "alert" appears as text, not as JS execution
    expect(html).toContain("&lt;script&gt;");
  });

  it("ReactMarkdown renders links safely", () => {
    const md = "[Example](https://example.com)";
    const html = renderToStaticMarkup(
      React.createElement(ReactMarkdown, null, md)
    );
    expect(html).toContain("https://example.com");
    expect(html).toContain("<a");
  });
});

describe("Blog metadata — source of truth", () => {
  it("article metadata comes from the content model, not hardcoded in route", () => {
    const article = getArticle("welcome-to-nixify", "en");
    expect(article!.title).toBe("Welcome to Nixify");
    expect(article!.description).toContain("real OTP email verification");
    expect(article!.publishedAt).toBe("2026-09-01");
  });
});
