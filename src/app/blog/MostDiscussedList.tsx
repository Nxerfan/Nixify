import { translate } from "@/i18n";
import type { Locale } from "@/lib/i18n/locales";
import { getMostDiscussedArticles } from "@/lib/blog/comments";
import { getArticle } from "@/lib/blog/content";
import { safeDb } from "@/lib/blog/safe-db";

/**
 * Server component — renders the "Most Discussed" sidebar list using REAL
 * visible comment counts from the DB, locale-aware (Blocker 1 — EN and FA
 * threads don't mix). Degrades to empty (hidden) when the DB is unavailable.
 */
export async function MostDiscussedList({ locale }: { locale: Locale }) {
  // Locale-aware: only count comments in this locale's thread.
  const top = await safeDb(() => getMostDiscussedArticles(locale, 5), []);
  if (top.length === 0) return null;

  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
        {translate(locale, "blog.mostDiscussed")}
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
                  {item.commentCount} {translate(locale, "blog.article.comments")}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
