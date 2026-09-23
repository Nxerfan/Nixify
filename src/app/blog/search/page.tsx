import type { Metadata } from "next";
import { searchArticles } from "@/lib/blog/editorial";
import { resolveServerLocale } from "@/lib/i18n/server-locale";
import { translate } from "@/i18n";
import { LOCALE_HTML_DIR } from "@/lib/i18n/locales";
import { BlogCardList } from "../BlogCardList";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

/**
 * Phase 18 — /blog/search?q=…
 *
 * Search results page. Search-result pages should normally be `noindex` (per
 * the spec) so search engines don't index transient query results.
 */
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const locale = await resolveServerLocale();
  const title = translate(locale, "blog.search.title");
  return {
    title: q ? `${title}: ${q}` : title,
    description: translate(locale, "blog.subtitle"),
    // Search result pages should not be indexed.
    robots: { index: false, follow: true },
    alternates: { canonical: "/blog/search" },
  };
}

export default async function BlogSearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const locale = await resolveServerLocale();
  const dir = LOCALE_HTML_DIR[locale];
  const query = q?.trim() ?? "";
  const results = query ? searchArticles(query, locale) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12" dir={dir}>
      <h1 className="text-3xl font-bold text-foreground">{translate(locale, "blog.search.title")}</h1>

      {/* Search form — mirrors the homepage box so users can refine here. */}
      <form action="/blog/search" method="get" className="mt-6 flex gap-2 max-w-xl">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={translate(locale, "blog.search.placeholder")}
          aria-label={translate(locale, "blog.search.title")}
          className="flex-1 rounded-lg border border-border/60 bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          {translate(locale, "blog.search.submit")}
        </button>
      </form>

      <div className="mt-8">
        {query ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {results.length} {translate(locale, "blog.search.results")} “{query}”
            </p>
            {results.length > 0 ? (
              <BlogCardList articles={results} />
            ) : (
              <p className="text-sm text-muted-foreground/60">{translate(locale, "blog.search.noResults")}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground/60">{translate(locale, "blog.search.noQuery")}</p>
        )}
      </div>
    </div>
  );
}
