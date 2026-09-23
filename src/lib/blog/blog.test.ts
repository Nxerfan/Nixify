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
 *   - Per-article lang/dir on the blog index (BLOCKER #2 regression)
 *
 * Pure tests (no DB, no DOM) — blog content is source-controlled.
 */
import { describe, it, expect } from "vitest";
import { getArticle, getArticles, getAllSlugs } from "@/lib/blog/content";
import { BlogCardList } from "@/app/blog/BlogCardList";
import { BlogHeader } from "@/app/blog/BlogHeader";
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

  it("getArticle returns null for unknown slug in fa too", () => {
    const article = getArticle("nonexistent-slug", "fa");
    expect(article).toBeNull();
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

  it("getArticles for fa includes ALL slugs (no English fallback needed — full FA parity)", () => {
    // Phase 18: every EN slug now has an FA translation, so the fa index
    // contains only fa-locale articles. No English fallback cards appear.
    const faArticles = getArticles("fa");
    const faSlugs = faArticles.map(a => a.slug);
    expect(faSlugs).toContain("welcome-to-nixify");
    expect(faSlugs).toContain("smtp-vs-api-verification");
    expect(faSlugs).toContain("email-otp-api-for-nextjs");
    expect(faSlugs).toContain("nixify-vs-building-email-otp-yourself");
    // Every fa index card is actually fa-locale (no en fallback).
    for (const a of faArticles) {
      expect(a.locale).toBe("fa");
    }
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

// ─── Phase 18 — EN/FA slug parity (no current FA fallback) ─────────────
//
// Every EN slug now has an FA translation, so the fa index contains only
// fa-locale articles. The per-card lang/dir boundary is still enforced (every
// fa card is lang="fa" dir="rtl", every en card is lang="en" dir="ltr") — this
// is now even cleaner because no mixed-direction fallback cards appear.

describe("Blog index — EN/FA slug parity (Phase 18)", () => {
  it("EN slug set === FA slug set (every EN article has an FA translation)", () => {
    const enSlugs = new Set(getArticles("en").map(a => a.slug));
    const faSlugs = new Set(getArticles("fa").map(a => a.slug));
    expect(enSlugs).toEqual(faSlugs);
  });

  it("fa index has NO English fallback cards (all fa-locale)", () => {
    const faArticles = getArticles("fa");
    for (const a of faArticles) {
      expect(a.locale).toBe("fa");
    }
  });

  it("getArticle returns the FA article (not en fallback) for every slug", () => {
    const enSlugs = getArticles("en").map(a => a.slug);
    for (const slug of enSlugs) {
      const faArticle = getArticle(slug, "fa");
      expect(faArticle).not.toBeNull();
      expect(faArticle!.locale).toBe("fa");
    }
  });
});

describe("Blog index — per-article lang/dir (BLOCKER #2)", () => {
  it("renders the fa welcome-to-nixify card as lang=fa dir=rtl inside the fa index", () => {
    const faArticles = getArticles("fa");
    const html = renderToStaticMarkup(
      React.createElement(BlogCardList, { articles: faArticles })
    );

    // The Persian article (welcome-to-nixify) has a fa translation, so its
    // card must carry lang="fa" dir="rtl".
    const faAnchor = extractAnchor(html, "/blog/welcome-to-nixify");
    expect(faAnchor).not.toBeNull();
    expect(faAnchor).toContain('lang="fa"');
    expect(faAnchor).toContain('dir="rtl"');
  });

  it("every fa index card is lang=fa dir=rtl (no en fallback in fa index)", () => {
    const faArticles = getArticles("fa");
    const html = renderToStaticMarkup(
      React.createElement(BlogCardList, { articles: faArticles })
    );
    for (const article of faArticles) {
      const anchor = extractAnchor(html, `/blog/${article.slug}`);
      expect(anchor).not.toBeNull();
      expect(anchor).toContain('lang="fa"');
      expect(anchor).toContain('dir="rtl"');
    }
  });

  it("en index renders all cards as lang=en dir=ltr", () => {
    const enArticles = getArticles("en");
    const html = renderToStaticMarkup(
      React.createElement(BlogCardList, { articles: enArticles })
    );
    // Every card in the en index is English → LTR.
    for (const article of enArticles) {
      const anchor = extractAnchor(html, `/blog/${article.slug}`);
      expect(anchor).not.toBeNull();
      expect(anchor).toContain('lang="en"');
      expect(anchor).toContain('dir="ltr"');
    }
  });
});

/**
 * Extract the first `<a ...>...</a>` substring from `html` whose href attribute
 * equals `href`. Used to isolate a single blog card's anchor element so its
 * `lang` / `dir` attributes can be asserted without matching other cards.
 *
 * Naive but sufficient for the static markup produced by `renderToStaticMarkup`
 * (well-formed, no nested anchors).
 */
function extractAnchor(html: string, href: string): string | null {
  // Match `<a` followed by attributes (non-greedy up to the first `>`), then
  // the anchor's inner content up to `</a>`.
  const re = /<a\b[^>]*>[\s\S]*?<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[0].includes(`href="${href}"`)) {
      return m[0];
    }
  }
  return null;
}

// ─── BLOCKER — /blog heading uses canonical translations ─────────────────────
//
// The blog index previously hardcoded `<h1>Blog</h1>` and manually branched
// the subtitle, ignoring the canonical `blog.title` / `blog.subtitle`
// translation entries. For `locale=fa` this produced a visible defect:
// `<html lang="fa" dir="rtl">` from the root layout while the blog heading
// read "Blog" (English) instead of "وبلاگ".
//
// These tests render the ACTUAL `BlogHeader` production component (the real
// presentation path used by `/blog`) for both locales and assert the
// canonical translated strings appear in the rendered output — proving the
// page consumes the dictionaries, not just that the dictionaries exist.

describe("Blog index heading — canonical translations (BLOCKER)", () => {
  it("en locale renders the canonical blog.title 'Blog'", () => {
    const html = renderToStaticMarkup(
      React.createElement(BlogHeader, { locale: "en" })
    );
    expect(html).toContain("<h1");
    expect(html).toContain(">Blog<");
  });

  it("en locale renders the canonical blog.subtitle", () => {
    const html = renderToStaticMarkup(
      React.createElement(BlogHeader, { locale: "en" })
    );
    expect(html).toContain(
      "Articles about email verification, OTP delivery, and the Nixify platform."
    );
  });

  it("fa locale renders the canonical blog.title 'وبلاگ' (NOT 'Blog')", () => {
    const html = renderToStaticMarkup(
      React.createElement(BlogHeader, { locale: "fa" })
    );
    expect(html).toContain("<h1");
    expect(html).toContain("وبلاگ");
    // The English heading must NOT leak into the fa render.
    expect(html).not.toContain(">Blog<");
  });

  it("fa locale renders the canonical Persian blog.subtitle", () => {
    const html = renderToStaticMarkup(
      React.createElement(BlogHeader, { locale: "fa" })
    );
    expect(html).toContain(
      "مقالات درباره تأیید ایمیل، تحویل OTP و پلتفرم Nixify."
    );
  });

  it("fa heading does NOT contain the English substring 'Blog' anywhere", () => {
    // Catches a regression where the heading might render "Blog" + "وبلاگ"
    // or fall back to English without the fa string.
    const html = renderToStaticMarkup(
      React.createElement(BlogHeader, { locale: "fa" })
    );
    expect(html).not.toContain("Blog");
    expect(html).toContain("وبلاگ");
  });
});
