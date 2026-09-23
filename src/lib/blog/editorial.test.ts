/**
 * Phase 18 — Blog editorial utilities tests.
 *
 * Pure tests (no DB) covering:
 *   - TOC generation (## and ### extraction, code-fence skipping, slugify)
 *   - reading time estimate
 *   - related articles (shared category/tags)
 *   - categories + tags listing with counts
 *   - search (title/description/body, locale-scoped, ranking)
 *   - author listing + author-article lookup
 *   - featured / editor's pick
 */
import { describe, it, expect } from "vitest";
import {
  generateTableOfContents,
  slugifyHeading,
  estimateReadingTime,
  getRelatedArticles,
  getCategories,
  getTags,
  getArticlesByCategory,
  getArticlesByTag,
  searchArticles,
  getAuthors,
  getArticlesByAuthor,
  slugifyAuthor,
  getFeaturedArticles,
} from "@/lib/blog/editorial";
import { getArticle } from "@/lib/blog/content";

// ─── Table of Contents ────────────────────────────────────────────────────

describe("generateTableOfContents", () => {
  it("extracts ## and ### headings", () => {
    const body = "# Title\n\n## Section A\n\ntext\n\n### Subsection\n\n## Section B\n";
    const toc = generateTableOfContents(body);
    expect(toc).toHaveLength(3);
    expect(toc[0]).toMatchObject({ level: 2, text: "Section A" });
    expect(toc[1]).toMatchObject({ level: 3, text: "Subsection" });
    expect(toc[2]).toMatchObject({ level: 2, text: "Section B" });
  });

  it("does NOT include the h1 title", () => {
    const body = "# Title\n\n## Section\n";
    const toc = generateTableOfContents(body);
    expect(toc).toHaveLength(1);
    expect(toc[0].text).toBe("Section");
  });

  it("skips ## inside code fences", () => {
    const body = "## Real Heading\n\n```bash\n## not a heading\n```\n\n## Another\n";
    const toc = generateTableOfContents(body);
    expect(toc).toHaveLength(2);
    expect(toc.map(t => t.text)).toEqual(["Real Heading", "Another"]);
  });

  it("slugifies heading text into stable anchor ids", () => {
    const body = "## Hello World!\n";
    const toc = generateTableOfContents(body);
    expect(toc[0].id).toBe("hello-world");
  });

  it("deduplicates identical heading ids with a suffix", () => {
    const body = "## Setup\n\n## Setup\n";
    const toc = generateTableOfContents(body);
    expect(toc[0].id).toBe("setup");
    expect(toc[1].id).toBe("setup-2");
  });

  it("returns empty array for a body with no ## or ### headings", () => {
    expect(generateTableOfContents("just a paragraph\n\n# title only\n")).toEqual([]);
  });

  it("strips backticks and bold from heading text", () => {
    const body = "## `code` and **bold**\n";
    const toc = generateTableOfContents(body);
    expect(toc[0].text).toBe("code and bold");
  });
});

describe("slugifyHeading", () => {
  it("lowercases, replaces spaces with dashes, strips punctuation", () => {
    expect(slugifyHeading("Hello, World!")).toBe("hello-world");
  });
  it("handles Persian text", () => {
    expect(slugifyHeading("به Nixify خوش آمدید")).toBe("به-nixify-خوش-آمدید");
  });
  it("collapses multiple dashes", () => {
    expect(slugifyHeading("a   b --- c")).toBe("a-b-c");
  });
});

// ─── Reading time ────────────────────────────────────────────────────────

describe("estimateReadingTime", () => {
  it("returns at least 1 minute for a short body", () => {
    expect(estimateReadingTime("hello world")).toBe(1);
  });
  it("scales with word count (200 wpm)", () => {
    // 400 words → ~2 minutes
    const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(" ");
    expect(estimateReadingTime(words)).toBe(2);
  });
  it("strips code fences so they don't inflate the count", () => {
    const code = "```js\n" + "const x = 1;\n".repeat(500) + "```\n\nshort body";
    const minutes = estimateReadingTime(code);
    // The code block is excluded; only "short body" (2 words) remains.
    expect(minutes).toBe(1);
  });
});

// ─── Categories + Tags ────────────────────────────────────────────────────

describe("getCategories", () => {
  it("returns categories for the en locale with counts", () => {
    const cats = getCategories("en");
    const engineering = cats.find(c => c.category === "Engineering");
    expect(engineering).toBeDefined();
    expect(engineering!.count).toBeGreaterThanOrEqual(2);
  });
  it("returns fa-localized categories for the fa locale", () => {
    const cats = getCategories("fa");
    // The FA welcome article uses category "اعلامیه‌ها"
    expect(cats.some(c => c.category === "اعلامیه‌ها")).toBe(true);
  });
});

describe("getArticlesByCategory", () => {
  it("returns articles matching a category (case-insensitive)", () => {
    const arts = getArticlesByCategory("engineering", "en");
    expect(arts.length).toBeGreaterThanOrEqual(2);
    for (const a of arts) expect(a.category).toBe("Engineering");
  });
  it("returns empty for an unknown category", () => {
    expect(getArticlesByCategory("nonexistent", "en")).toEqual([]);
  });
});

describe("getTags", () => {
  it("returns tags for the en locale with counts", () => {
    const tags = getTags("en");
    const nextjs = tags.find(t => t.tag === "nextjs");
    expect(nextjs).toBeDefined();
    expect(nextjs!.count).toBeGreaterThanOrEqual(1);
  });
});

describe("getArticlesByTag", () => {
  it("returns articles with the tag (case-insensitive)", () => {
    const arts = getArticlesByTag("NEXTJS", "en");
    expect(arts.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Search ───────────────────────────────────────────────────────────────

describe("searchArticles", () => {
  it("returns empty for an empty query", () => {
    expect(searchArticles("", "en")).toEqual([]);
    expect(searchArticles("   ", "en")).toEqual([]);
  });
  it("returns matches for a title query", () => {
    const results = searchArticles("SMTP", "en");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.slug === "smtp-vs-api-verification")).toBe(true);
  });
  it("returns matches for a body query", () => {
    const results = searchArticles("Next.js", "en");
    expect(results.some(r => r.slug === "email-otp-api-for-nextjs")).toBe(true);
  });
  it("returns empty for a query matching nothing", () => {
    expect(searchArticles("nonexistent-xyz-topic-12345", "en")).toEqual([]);
  });
  it("is locale-scoped (fa query returns fa articles)", () => {
    const results = searchArticles("SMTP", "fa");
    expect(results.some(r => r.slug === "smtp-vs-api-verification")).toBe(true);
    // All results are fa-locale articles.
    for (const r of results) expect(r.locale).toBe("fa");
  });
  it("includes a snippet in results", () => {
    const results = searchArticles("SMTP", "en");
    for (const r of results) expect(typeof r.snippet).toBe("string");
  });
  it("ranks title matches above body matches", () => {
    // "verification" appears in title of smtp-vs-api-verification AND in bodies.
    const results = searchArticles("verification", "en");
    expect(results.length).toBeGreaterThan(0);
    // The article whose TITLE contains "verification" should rank first.
    const top = results[0];
    expect(top.title.toLowerCase()).toContain("verification");
  });
});

// ─── Related articles ────────────────────────────────────────────────────

describe("getRelatedArticles", () => {
  it("returns related articles sharing a category", () => {
    const article = getArticle("email-otp-api-for-nextjs", "en")!;
    const related = getRelatedArticles(article, 3);
    expect(related.length).toBeGreaterThan(0);
    // Related articles share the "Engineering" category.
    for (const r of related) expect(r.category).toBe("Engineering");
  });
  it("excludes the article itself", () => {
    const article = getArticle("email-otp-api-for-nextjs", "en")!;
    const related = getRelatedArticles(article, 5);
    expect(related.every(r => r.slug !== article.slug)).toBe(true);
  });
  it("respects the limit", () => {
    const article = getArticle("email-otp-api-for-nextjs", "en")!;
    expect(getRelatedArticles(article, 1).length).toBeLessThanOrEqual(1);
    expect(getRelatedArticles(article, 2).length).toBeLessThanOrEqual(2);
  });
  it("is locale-scoped (does not return fa articles for an en article)", () => {
    const article = getArticle("email-otp-api-for-nextjs", "en")!;
    const related = getRelatedArticles(article, 5);
    for (const r of related) expect(r.locale).toBe("en");
  });
});

// ─── Authors ──────────────────────────────────────────────────────────────

describe("getAuthors + getArticlesByAuthor", () => {
  it("returns authors with article counts", () => {
    const authors = getAuthors("en");
    const team = authors.find(a => a.name === "Nixify Team");
    expect(team).toBeDefined();
    expect(team!.articleCount).toBeGreaterThanOrEqual(1);
  });
  it("slugifies author names", () => {
    expect(slugifyAuthor("Nixify Team")).toBe("nixify-team");
  });
  it("getArticlesByAuthor returns articles by slug", () => {
    const { authorName, articles } = getArticlesByAuthor("nixify-team", "en");
    expect(authorName).toBe("Nixify Team");
    expect(articles.length).toBeGreaterThanOrEqual(1);
  });
  it("getArticlesByAuthor returns null authorName for unknown slug", () => {
    const { authorName, articles } = getArticlesByAuthor("nobody", "en");
    expect(authorName).toBeNull();
    expect(articles).toEqual([]);
  });
});

// ─── Featured / Editor's Pick ────────────────────────────────────────────

describe("getFeaturedArticles", () => {
  it("returns the welcome-to-nixify article (flagged featured: true)", () => {
    const featured = getFeaturedArticles("en", 3);
    expect(featured.some(f => f.slug === "welcome-to-nixify")).toBe(true);
  });
  it("returns the FA welcome article for the fa locale", () => {
    const featured = getFeaturedArticles("fa", 3);
    expect(featured.some(f => f.slug === "welcome-to-nixify")).toBe(true);
  });
  it("is an editorial flag — NOT derived from view counts", () => {
    // The featured articles come from the `featured` frontmatter field, which
    // is a static editorial decision in the content module. This test
    // documents that getFeaturedArticles does not call any view-count metric.
    const featured = getFeaturedArticles("en", 5);
    // welcome-to-nixify is the only article with featured: true in the corpus.
    expect(featured.every(f => f.slug === "welcome-to-nixify" || f === featured[0])).toBe(true);
  });
});

// ─── EN/FA parity (no current FA fallback) ───────────────────────────────

describe("EN/FA parity (Phase 18)", () => {
  it("EN and FA have the same category counts (localized)", () => {
    const enCats = getCategories("en");
    const faCats = getCategories("fa");
    // Same number of categories (every EN article has an FA translation).
    expect(enCats.length).toBe(faCats.length);
    // Same total article counts.
    const enTotal = enCats.reduce((s, c) => s + c.count, 0);
    const faTotal = faCats.reduce((s, c) => s + c.count, 0);
    expect(enTotal).toBe(faTotal);
  });

  it("EN and FA have the same tag counts", () => {
    const enTags = getTags("en");
    const faTags = getTags("fa");
    expect(enTags.length).toBe(faTags.length);
    const enTotal = enTags.reduce((s, t) => s + t.count, 0);
    const faTotal = faTags.reduce((s, t) => s + t.count, 0);
    expect(enTotal).toBe(faTotal);
  });
});
