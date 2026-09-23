import type { Metadata } from "next";
import { getArticles } from "@/lib/blog/content";
import {
  getCategories,
  getTags,
  getFeaturedArticles,
  getAuthors,
} from "@/lib/blog/editorial";
import { resolveServerLocale } from "@/lib/i18n/server-locale";
import { buildBlogIndexMetadata } from "@/lib/seo/metadata";
import { translate } from "@/i18n";
import { BlogHeader } from "./BlogHeader";
import { BlogCardList } from "./BlogCardList";
import { BlogSearchBox } from "./BlogSearchBox";
import { MostViewedList } from "./MostViewedList";
import { MostDiscussedList } from "./MostDiscussedList";

/**
 * Phase 18 — `/blog` homepage.
 *
 * Rich editorial homepage with:
 *   - localized heading + subtitle (BlogHeader)
 *   - search box (navigates to /blog/search?q=)
 *   - Editor's Pick (featured editorial flag — NOT popularity)
 *   - Latest Articles
 *   - Most Viewed (REAL view metrics from the DB)
 *   - Most Discussed (REAL comment counts from the DB)
 *   - Categories
 *   - Tags
 *
 * DB-backed sections (Most Viewed, Most Discussed) degrade gracefully to
 * empty when the DB is unavailable (e.g. during build without DATABASE_URL).
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  return buildBlogIndexMetadata(locale);
}

export default async function BlogPage() {
  const locale = await resolveServerLocale();
  const articles = getArticles(locale);
  const featured = getFeaturedArticles(locale, 1);
  const categories = getCategories(locale);
  const tags = getTags(locale);
  const authors = getAuthors(locale);

  const featuredSlugs = featured.map(f => f.slug);
  const latest = articles.filter(a => !featuredSlugs.includes(a.slug)).slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <BlogHeader locale={locale} />

      <div className="mt-6 mb-10">
        <BlogSearchBox />
      </div>

      {/* Editor's Pick — editorial flag, NOT popularity */}
      {featured.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <span aria-hidden>★</span>
            {translate(locale, "blog.featured")}
          </h2>
          <BlogCardList articles={featured} />
        </section>
      )}

      <div className="grid gap-10 md:grid-cols-[1fr_18rem]">
        <div>
          {/* Latest Articles */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {translate(locale, "blog.latestArticles")}
            </h2>
            <BlogCardList articles={latest} />
          </section>
        </div>

        {/* Sidebar: Most Viewed, Most Discussed, Categories, Tags */}
        <aside className="space-y-8">
          <MostViewedList locale={locale} />
          <MostDiscussedList locale={locale} />

          {categories.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
                {translate(locale, "blog.categories")}
              </h3>
              <ul className="space-y-1.5">
                {categories.map(c => (
                  <li key={c.category}>
                    <a
                      href={`/blog/category/${encodeURIComponent(c.category.toLowerCase())}`}
                      className="text-sm text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
                    >
                      {c.category} <span className="text-muted-foreground/50">({c.count})</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tags.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
                {translate(locale, "blog.tags")}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {tags.map(t => (
                  <li key={t.tag}>
                    <a
                      href={`/blog/tag/${encodeURIComponent(t.tag.toLowerCase())}`}
                      className="inline-block rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground hover:border-emerald-500/30 hover:text-emerald-600 dark:hover:text-emerald-400"
                    >
                      {t.tag} <span className="text-muted-foreground/50">({t.count})</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {authors.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
                {translate(locale, "blog.authors")}
              </h3>
              <ul className="space-y-1.5">
                {authors.map(a => (
                  <li key={a.slug}>
                    <a
                      href={`/blog/author/${a.slug}`}
                      className="text-sm text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
                    >
                      {a.name} <span className="text-muted-foreground/50">({a.articleCount})</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
