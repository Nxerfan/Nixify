/**
 * Phase 16 — SEO, AEO & AI Discoverability test suite.
 *
 * Tests the REAL production helpers and route handlers (not mock duplicates):
 *   - canonical site origin / absolute URL helper
 *   - localhost / preview-Vercel canonical leakage prevention
 *   - root metadata (no stale trial claims)
 *   - blog index metadata (en + fa)
 *   - article canonical metadata derives from canonical article model
 *   - article en/fa metadata correctness
 *   - English fallback article metadata correctness
 *   - robots public crawl behavior + private/API exclusions
 *   - sitemap contains homepage/pricing/blog + every published blog slug
 *   - sitemap excludes auth/admin/dashboard/API routes + no duplicates
 *   - llms.txt content type + canonical public links + private route exclusion
 *   - structured Article data matches real article fields
 *   - no fabricated rating/review fields in structured data
 *
 * Pure tests (no DB, no DOM) — all discoverability surfaces are source-controlled.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getSiteOrigin,
  absoluteUrl,
  PRODUCTION_ORIGIN,
} from "@/lib/site/site-url";
import {
  PUBLIC_MARKETING_ROUTES,
  PRIVATE_ROUTE_PREFIXES,
  PRIVATE_STANDALONE_ROUTES,
  getPublicBlogRoutes,
} from "@/lib/site/public-routes";
import { getAllSlugs, getArticle } from "@/lib/blog/content";
import {
  buildBlogIndexMetadata,
  buildArticleMetadata,
} from "@/lib/seo/metadata";
import {
  buildWebSiteJsonLd,
  buildOrganizationJsonLd,
  buildArticleJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { translate } from "@/i18n";

// Type-safe view of Metadata union types for test assertions.
type OgView = { type?: string; title?: string; description?: string; url?: string; publishedTime?: string; modifiedTime?: string };
type TwitterView = { card?: string; title?: string; description?: string };
type RobotsView = { index?: boolean; follow?: boolean };

// ─── Canonical site origin ─────────────────────────────────────────────────

describe("Phase 16 — canonical site origin", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("PRODUCTION_ORIGIN is https://nixify.ir", () => {
    expect(PRODUCTION_ORIGIN).toBe("https://nixify.ir");
  });

  it("getSiteOrigin returns the production origin when env is unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getSiteOrigin()).toBe(PRODUCTION_ORIGIN);
  });

  it("getSiteOrigin rejects http://localhost (no localhost canonical leakage)", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(getSiteOrigin()).toBe(PRODUCTION_ORIGIN);
  });

  it("getSiteOrigin rejects http://127.0.0.1", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://127.0.0.1:3000";
    expect(getSiteOrigin()).toBe(PRODUCTION_ORIGIN);
  });

  it("getSiteOrigin rejects ALL Vercel preview/deployment URLs (*.vercel.app)", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://nixify-git-feat-abc.vercel.app";
    expect(getSiteOrigin()).toBe(PRODUCTION_ORIGIN);
  });

  it("getSiteOrigin rejects the legacy nixify.vercel.app production URL (non-canonical alias)", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://nixify.vercel.app";
    expect(getSiteOrigin()).toBe(PRODUCTION_ORIGIN);
  });

  it("getSiteOrigin rejects non-https origins", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://example.com";
    expect(getSiteOrigin()).toBe(PRODUCTION_ORIGIN);
  });

  it("getSiteOrigin accepts a valid https production-like URL (for testing)", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://test.example.com";
    expect(getSiteOrigin()).toBe("https://test.example.com");
  });

  it("getSiteOrigin returns origin with NO trailing slash", () => {
    expect(getSiteOrigin()).not.toMatch(/\/$/);
  });
});

// ─── absoluteUrl ───────────────────────────────────────────────────────────

describe("Phase 16 — absoluteUrl", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("produces an https absolute URL", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(absoluteUrl("/blog")).toBe("https://nixify.ir/blog");
  });

  it("root path produces the site origin", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(absoluteUrl("/")).toBe("https://nixify.ir");
  });

  it("does NOT produce duplicate slashes", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(absoluteUrl("/blog/foo")).toBe("https://nixify.ir/blog/foo");
    expect(absoluteUrl("blog//foo")).toBe("https://nixify.ir/blog/foo");
  });

  it("strips trailing slash (except root)", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(absoluteUrl("/blog/")).toBe("https://nixify.ir/blog");
  });
});

// ─── Root metadata audit (no stale unsupported claims) ────────────────────

describe("Phase 16 — root metadata has no stale unsupported claims", () => {
  let metadata: typeof import("@/lib/seo/root-metadata").rootMetadata;
  beforeEach(async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const mod = await import("@/lib/seo/root-metadata");
    metadata = mod.rootMetadata;
  });

  it("metadataBase is set (resolves relative URLs to canonical origin)", () => {
    expect(metadata.metadataBase).toBeInstanceOf(URL);
    expect(metadata.metadataBase instanceof URL).toBe(true);
    if (metadata.metadataBase instanceof URL) {
      expect(metadata.metadataBase.href).toBe(PRODUCTION_ORIGIN + "/");
    }
  });

  it("has a title template", () => {
    expect(typeof metadata.title).toBe("object");
    expect((metadata.title as { template: string }).template).toBe("%s — Nixify");
    expect((metadata.title as { default: string }).default).toBeTruthy();
  });

  const STALE_CLAIMS = [
    "1-month free trial",
    "1-month",
    "free trial",
    "Free Trial",
    "Zero-cost",
    "zero-cost",
  ];

  for (const claim of STALE_CLAIMS) {
    it(`description does not contain stale claim: "${claim}"`, () => {
      const desc = metadata.description ?? "";
      expect(desc).not.toContain(claim);
    });
  }

  it("openGraph description does not contain 'Free Trial' or 'Zero-cost'", () => {
    const desc = metadata.openGraph?.description ?? "";
    expect(desc).not.toContain("Free Trial");
    expect(desc).not.toContain("Zero-cost");
    expect(desc).not.toContain("zero-cost");
  });

  it("twitter description does not contain 'Free Trial' or 'Zero-cost'", () => {
    const desc = metadata.twitter?.description ?? "";
    expect(desc).not.toContain("Free Trial");
    expect(desc).not.toContain("Zero-cost");
  });

  it("keywords do not include 'free trial'", () => {
    const keywords = (metadata.keywords as string[]) ?? [];
    const joined = keywords.join(",").toLowerCase();
    expect(joined).not.toContain("free trial");
  });
});

// ─── Blog index metadata (en + fa) ─────────────────────────────────────────

describe("Phase 16 — /blog index metadata", () => {
  it("en locale: title from canonical blog.title", () => {
    const meta = buildBlogIndexMetadata("en");
    expect(meta.title).toBe(translate("en", "blog.title"));
  });

  it("en locale: description from canonical blog.subtitle", () => {
    const meta = buildBlogIndexMetadata("en");
    expect(meta.description).toBe(translate("en", "blog.subtitle"));
  });

  it("fa locale: title is canonical Persian 'وبلاگ'", () => {
    const meta = buildBlogIndexMetadata("fa");
    expect(meta.title).toBe("وبلاگ");
  });

  it("fa locale: description is canonical Persian blog.subtitle", () => {
    const meta = buildBlogIndexMetadata("fa");
    expect(meta.description).toBe(translate("fa", "blog.subtitle"));
    expect(meta.description).toContain("مقالات درباره");
  });

  it("fa locale: title is NOT the English 'Blog'", () => {
    const meta = buildBlogIndexMetadata("fa");
    expect(meta.title).not.toBe("Blog");
  });

  it("both locales: canonical alternates set to /blog", () => {
    expect(buildBlogIndexMetadata("en").alternates?.canonical).toBe("/blog");
    expect(buildBlogIndexMetadata("fa").alternates?.canonical).toBe("/blog");
  });

  it("both locales: openGraph type is website", () => {
    expect((buildBlogIndexMetadata("en").openGraph as OgView)?.type).toBe("website");
    expect((buildBlogIndexMetadata("fa").openGraph as OgView)?.type).toBe("website");
  });
});

// ─── Article canonical metadata ────────────────────────────────────────────

describe("Phase 16 — article metadata derives from canonical article model", () => {
  it("title matches the canonical article title", () => {
    const meta = buildArticleMetadata("welcome-to-nixify", "en");
    const article = getArticle("welcome-to-nixify", "en")!;
    expect(meta.title).toBe(article.title);
  });

  it("description matches the canonical article description", () => {
    const meta = buildArticleMetadata("welcome-to-nixify", "en");
    const article = getArticle("welcome-to-nixify", "en")!;
    expect(meta.description).toBe(article.description);
  });

  it("canonical URL is the absolute /blog/<slug> URL", () => {
    const meta = buildArticleMetadata("welcome-to-nixify", "en");
    expect(meta.alternates?.canonical).toBe("/blog/welcome-to-nixify");
  });

  it("openGraph title + description match the article", () => {
    const meta = buildArticleMetadata("welcome-to-nixify", "en");
    const article = getArticle("welcome-to-nixify", "en")!;
    expect((meta.openGraph as OgView)?.title).toBe(article.title);
    expect((meta.openGraph as OgView)?.description).toBe(article.description);
  });

  it("openGraph url is the absolute canonical article URL", () => {
    const meta = buildArticleMetadata("welcome-to-nixify", "en");
    expect((meta.openGraph as OgView)?.url).toBe(absoluteUrl("/blog/welcome-to-nixify"));
  });

  it("openGraph type is article", () => {
    const meta = buildArticleMetadata("welcome-to-nixify", "en");
    expect((meta.openGraph as OgView)?.type).toBe("article");
  });

  it("openGraph publishedTime matches article.publishedAt", () => {
    const meta = buildArticleMetadata("welcome-to-nixify", "en");
    const article = getArticle("welcome-to-nixify", "en")!;
    expect((meta.openGraph as OgView)?.publishedTime).toBe(article.publishedAt);
  });

  it("openGraph modifiedTime falls back to publishedAt when updatedAt absent", () => {
    const meta = buildArticleMetadata("welcome-to-nixify", "en");
    const article = getArticle("welcome-to-nixify", "en")!;
    expect((meta.openGraph as OgView)?.modifiedTime).toBe(
      article.updatedAt ?? article.publishedAt,
    );
  });

  it("twitter card is summary_large_image with article title", () => {
    const meta = buildArticleMetadata("welcome-to-nixify", "en");
    const article = getArticle("welcome-to-nixify", "en")!;
    expect((meta.twitter as TwitterView)?.card).toBe("summary_large_image");
    expect((meta.twitter as TwitterView)?.title).toBe(article.title);
  });

  it("fa locale article metadata is correct for the fa-translated article", () => {
    const meta = buildArticleMetadata("welcome-to-nixify", "fa");
    const article = getArticle("welcome-to-nixify", "fa")!;
    expect(meta.title).toBe(article.title);
    expect(meta.description).toBe(article.description);
  });
});

// ─── English fallback article metadata ────────────────────────────────────

describe("Phase 16 — English fallback article metadata", () => {
  // smtp-vs-api-verification only exists in en. When a Persian user requests
  // it, getArticle falls back to the en article. The metadata MUST describe
  // the actual en fallback article (not the requested fa locale).
  it("fallback article (smtp-vs-api-verification, fa locale) returns en article metadata", () => {
    const meta = buildArticleMetadata("smtp-vs-api-verification", "fa");
    const fallbackArticle = getArticle("smtp-vs-api-verification", "fa")!;
    expect(fallbackArticle.locale).toBe("en"); // confirmed fallback
    expect(meta.title).toBe(fallbackArticle.title);
    expect(meta.description).toBe(fallbackArticle.description);
  });

  it("fallback article openGraph url is the canonical /blog/<slug>", () => {
    const meta = buildArticleMetadata("smtp-vs-api-verification", "fa");
    expect((meta.openGraph as OgView)?.url).toBe(
      absoluteUrl("/blog/smtp-vs-api-verification"),
    );
  });
});

// ─── Unknown slug metadata ─────────────────────────────────────────────────

describe("Phase 16 — unknown slug metadata", () => {
  it("unknown slug returns noindex 'Not Found' (no misleading article metadata)", () => {
    const meta = buildArticleMetadata("nonexistent-slug", "en");
    expect(meta.title).toBe("Not Found");
    expect((meta.robots as RobotsView)?.index).toBe(false);
    expect((meta.robots as RobotsView)?.follow).toBe(false);
    expect(meta.openGraph).toBeUndefined();
  });
});

// ─── robots ────────────────────────────────────────────────────────────────

describe("Phase 16 — robots", () => {
  let robots: Awaited<ReturnType<typeof import("@/app/robots").default>>;
  beforeEach(async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const mod = await import("@/app/robots");
    robots = mod.default();
  });

  it("allows public crawling (allow: /)", () => {
    const rule = robots.rules[0] as { allow: string };
    expect(rule.allow).toBe("/");
  });

  it("disallows /api/", () => {
    const rule = robots.rules[0] as { disallow: string[] };
    expect(rule.disallow).toContain("/api/");
  });

  it("disallows /admin/", () => {
    const rule = robots.rules[0] as { disallow: string[] };
    expect(rule.disallow).toContain("/admin/");
  });

  it("disallows /dashboard/", () => {
    const rule = robots.rules[0] as { disallow: string[] };
    expect(rule.disallow).toContain("/dashboard/");
  });

  it("disallows /profile/", () => {
    const rule = robots.rules[0] as { disallow: string[] };
    expect(rule.disallow).toContain("/profile/");
  });

  it("disallows auth routes (/auth, /login, /signup, etc.)", () => {
    const rule = robots.rules[0] as { disallow: string[] };
    expect(rule.disallow).toContain("/auth");
    expect(rule.disallow).toContain("/login");
    expect(rule.disallow).toContain("/signup");
    expect(rule.disallow).toContain("/forgot-password");
    expect(rule.disallow).toContain("/verify-email");
    expect(rule.disallow).toContain("/reset-password");
  });

  it("disallows /unsubscribe", () => {
    const rule = robots.rules[0] as { disallow: string[] };
    expect(rule.disallow).toContain("/unsubscribe");
  });

  it("sitemap points to the canonical /sitemap.xml", () => {
    expect(robots.sitemap).toBe(absoluteUrl("/sitemap.xml"));
  });
});

// ─── sitemap ──────────────────────────────────────────────────────────────

describe("Phase 16 — sitemap", () => {
  let sitemap: Awaited<ReturnType<typeof import("@/app/sitemap").default>>;
  beforeEach(async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const mod = await import("@/app/sitemap");
    sitemap = mod.default();
  });

  const allUrls = () => sitemap.map((e) => e.url);

  it("contains the homepage", () => {
    expect(allUrls()).toContain(absoluteUrl("/"));
  });

  it("contains /pricing", () => {
    expect(allUrls()).toContain(absoluteUrl("/pricing"));
  });

  it("contains /blog", () => {
    expect(allUrls()).toContain(absoluteUrl("/blog"));
  });

  it("contains /about", () => {
    expect(allUrls()).toContain(absoluteUrl("/about"));
  });

  it("excludes /privacy (placeholder legal page — not for indexing)", () => {
    const urls = allUrls();
    expect(urls).not.toContain(absoluteUrl("/privacy"));
  });

  it("excludes /terms (placeholder legal page — not for indexing)", () => {
    const urls = allUrls();
    expect(urls).not.toContain(absoluteUrl("/terms"));
  });

  it("contains every published canonical blog slug", () => {
    const urls = allUrls();
    for (const slug of getAllSlugs()) {
      expect(urls).toContain(absoluteUrl(`/blog/${slug}`));
    }
  });

  it("excludes auth/admin/dashboard/API routes", () => {
    const urls = allUrls();
    const joined = urls.join(" ");
    for (const prefix of PRIVATE_ROUTE_PREFIXES) {
      expect(joined).not.toContain(prefix);
    }
    for (const route of PRIVATE_STANDALONE_ROUTES) {
      expect(joined).not.toContain(absoluteUrl(route));
    }
  });

  it("has no duplicate URLs", () => {
    const urls = allUrls();
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("blog entries have lastModified", () => {
    const blogEntries = sitemap.filter((e) => e.url.includes("/blog/"));
    for (const entry of blogEntries) {
      expect(entry.lastModified).toBeTruthy();
    }
  });

  it("all URLs are https (no localhost leakage)", () => {
    for (const url of allUrls()) {
      expect(url.startsWith("https://")).toBe(true);
      expect(url).not.toContain("localhost");
    }
  });
});

// ─── llms.txt ────────────────────────────────────────────────────────────

describe("Phase 16 — /llms.txt", () => {
  let response: Response;
  let body: string;
  beforeEach(async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const mod = await import("@/app/llms.txt/route");
    response = mod.GET();
    body = await response.text();
  });

  it("returns 200", () => {
    expect(response.status).toBe(200);
  });

  it("Content-Type is text/plain", () => {
    expect(response.headers.get("content-type")).toContain("text/plain");
  });

  it("contains canonical homepage link", () => {
    expect(body).toContain(absoluteUrl("/"));
  });

  it("contains pricing link", () => {
    expect(body).toContain(absoluteUrl("/pricing"));
  });

  it("contains blog link", () => {
    expect(body).toContain(absoluteUrl("/blog"));
  });

  it("excludes /privacy (placeholder legal page — not for AI discovery)", () => {
    expect(body).not.toContain(absoluteUrl("/privacy"));
  });

  it("excludes /terms (placeholder legal page — not for AI discovery)", () => {
    expect(body).not.toContain(absoluteUrl("/terms"));
  });

  it("contains every published blog article link", () => {
    for (const slug of getAllSlugs()) {
      expect(body).toContain(absoluteUrl(`/blog/${slug}`));
    }
  });

  it("excludes private/internal routes", () => {
    for (const prefix of PRIVATE_ROUTE_PREFIXES) {
      expect(body).not.toContain(prefix);
    }
    for (const route of PRIVATE_STANDALONE_ROUTES) {
      expect(body).not.toContain(absoluteUrl(route));
    }
    // No worklog / repo internals
    expect(body).not.toContain("worklog");
    expect(body).not.toContain("agent-lessons");
    expect(body).not.toContain("node_modules");
  });

  it("does not contain localhost", () => {
    expect(body).not.toContain("localhost");
  });
});

// ─── Structured data (JSON-LD) ───────────────────────────────────────────

describe("Phase 16 — structured data / JSON-LD", () => {
  it("buildWebSiteJsonLd has @type WebSite and canonical url", () => {
    const ld = buildWebSiteJsonLd() as Record<string, unknown>;
    expect(ld["@type"]).toBe("WebSite");
    expect(ld.url).toBe(getSiteOrigin());
    expect(ld.name).toBe("Nixify");
  });

  it("buildOrganizationJsonLd has @type Organization and canonical url", () => {
    const ld = buildOrganizationJsonLd() as Record<string, unknown>;
    expect(ld["@type"]).toBe("Organization");
    expect(ld.url).toBe(getSiteOrigin());
    expect(ld.name).toBe("Nixify");
  });

  it("WebSite JSON-LD contains no aggregateRating/review", () => {
    const ld = buildWebSiteJsonLd() as Record<string, unknown>;
    expect(ld.aggregateRating).toBeUndefined();
    expect(ld.review).toBeUndefined();
  });

  it("Organization JSON-LD contains no aggregateRating/review", () => {
    const ld = buildOrganizationJsonLd() as Record<string, unknown>;
    expect(ld.aggregateRating).toBeUndefined();
    expect(ld.review).toBeUndefined();
  });

  it("buildArticleJsonLd matches real article fields", () => {
    const article = getArticle("welcome-to-nixify", "en")!;
    const ld = buildArticleJsonLd(article) as Record<string, unknown>;
    expect(ld["@type"]).toBe("BlogPosting");
    expect(ld.headline).toBe(article.title);
    expect(ld.description).toBe(article.description);
    expect(ld.datePublished).toBe(article.publishedAt);
    expect(ld.dateModified).toBe(article.updatedAt ?? article.publishedAt);
    expect(ld.url).toBe(absoluteUrl(`/blog/${article.slug}`));
    expect(ld.inLanguage).toBe(article.locale);
  });

  it("article JSON-LD dateModified falls back to publishedAt when updatedAt absent", () => {
    const article = getArticle("welcome-to-nixify", "en")!;
    const ld = buildArticleJsonLd(article) as Record<string, unknown>;
    expect(ld.dateModified).toBe(article.publishedAt);
  });

  it("article JSON-LD inLanguage is the actual article locale (en for fallback)", () => {
    const fallback = getArticle("smtp-vs-api-verification", "fa")!;
    expect(fallback.locale).toBe("en");
    const ld = buildArticleJsonLd(fallback) as Record<string, unknown>;
    expect(ld.inLanguage).toBe("en");
  });

  it("article JSON-LD author is present only when the article has a real author", () => {
    const withAuthor = getArticle("welcome-to-nixify", "en")!;
    const ld = buildArticleJsonLd(withAuthor) as Record<string, unknown>;
    if (withAuthor.author) {
      expect(ld.author).toEqual({ "@type": "Organization", name: withAuthor.author });
    } else {
      expect(ld.author).toBeUndefined();
    }
  });

  it("article JSON-LD contains NO aggregateRating/review/offers", () => {
    const article = getArticle("welcome-to-nixify", "en")!;
    const ld = buildArticleJsonLd(article) as Record<string, unknown>;
    expect(ld.aggregateRating).toBeUndefined();
    expect(ld.review).toBeUndefined();
    expect(ld.offers).toBeUndefined();
  });

  it("serializeJsonLd escapes < to prevent </script> breakout", () => {
    const malicious = { foo: "</script><img src=x onerror=alert(1)>" };
    const serialized = serializeJsonLd(malicious);
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c");
  });
});

// ─── Legal page metadata (noindex placeholder content) ─────────────────────

describe("Phase 16 — legal page metadata (placeholder content not indexed)", () => {
  it("/privacy metadata has robots.index === false", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const mod = await import("@/app/privacy/page");
    const meta = mod.metadata;
    const robots = typeof meta.robots === "object" ? meta.robots as { index?: boolean } : undefined;
    expect(robots?.index).toBe(false);
  });

  it("/privacy metadata has robots.follow === false", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const mod = await import("@/app/privacy/page");
    const meta = mod.metadata;
    const robots = typeof meta.robots === "object" ? meta.robots as { follow?: boolean } : undefined;
    expect(robots?.follow).toBe(false);
  });

  it("/terms metadata has robots.index === false", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const mod = await import("@/app/terms/page");
    const meta = mod.metadata;
    const robots = typeof meta.robots === "object" ? meta.robots as { index?: boolean } : undefined;
    expect(robots?.index).toBe(false);
  });

  it("/terms metadata has robots.follow === false", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const mod = await import("@/app/terms/page");
    const meta = mod.metadata;
    const robots = typeof meta.robots === "object" ? meta.robots as { follow?: boolean } : undefined;
    expect(robots?.follow).toBe(false);
  });
});

// ─── Public routes / no duplicate discoverability sources ─────────────────

describe("Phase 16 — public routes helper", () => {
  it("PUBLIC_MARKETING_ROUTES does not include auth/admin/dashboard/api", () => {
    const joined = PUBLIC_MARKETING_ROUTES.join(",");
    expect(joined).not.toContain("/auth");
    expect(joined).not.toContain("/admin");
    expect(joined).not.toContain("/dashboard");
    expect(joined).not.toContain("/api");
    expect(joined).not.toContain("/login");
    expect(joined).not.toContain("/signup");
  });

  it("getPublicBlogRoutes returns every published slug", () => {
    const routes = getPublicBlogRoutes();
    const slugs = routes.map((r) => r.slug);
    for (const slug of getAllSlugs()) {
      expect(slugs).toContain(slug);
    }
  });

  it("getPublicBlogRoutes URLs are absolute https", () => {
    for (const route of getPublicBlogRoutes()) {
      expect(route.url.startsWith("https://")).toBe(true);
      expect(route.url).not.toContain("localhost");
    }
  });
});
