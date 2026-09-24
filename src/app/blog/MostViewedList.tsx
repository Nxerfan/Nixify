import { translate } from "@/i18n";
import type { Locale } from "@/lib/i18n/locales";
import { getMostViewedArticles } from "@/lib/blog/view-metrics";
import { getArticle } from "@/lib/blog/content";
import { safeDb } from "@/lib/blog/safe-db";

/**
 * Server component — renders the "Most Viewed" sidebar list using REAL view
 * counts from the DB. Degrades to empty (hidden) when the DB is unavailable.
 */
export async function MostViewedList({ locale }: { locale: Locale }) {
  const top = await safeDb(() => getMostViewedArticles(5), []);
  if (top.length === 0) return null;

  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
        {translate(locale, "blog.mostViewed")}
      </h3>
      <ol className="space-y-2">
        {top.map((item, i) => {
          const article = getArticle(item.slug, locale);
          if (!article) return null;
          return (
            <li key={item.slug} className="flex gap-2">
              <span className="text-muted-foreground/50 text-sm tabular-nums">{i + 1}.</span>
              <a
                href={`/blog/${item.slug}`}
                className="text-sm text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
              >
                {article.title}
                <span className="block text-xs text-muted-foreground/50">
                  {item.viewCount} {translate(locale, "blog.article.views")}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
