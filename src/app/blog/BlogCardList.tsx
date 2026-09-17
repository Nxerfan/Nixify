/**
 * Phase 15 — Blog card list (presentational).
 *
 * Extracted from `src/app/blog/page.tsx` so the per-card `lang` / `dir`
 * rendering is independently unit-testable (the blog page is an async server
 * component that resolves the locale; this component is a pure function of the
 * articles list it receives).
 *
 * ─── Direction / language boundary (BLOCKER #2) ───────────────────────────
 *
 * `getArticles("fa")` intentionally includes English fallback articles when a
 * Persian translation is unavailable — that fallback policy is correct.
 * However, when the application locale is `fa`, the root document is RTL, so an
 * English fallback card would otherwise inherit RTL presentation.
 *
 * Each card derives `lang` and `dir` from `article.locale` via the canonical
 * `LOCALE_HTML_DIR` map:
 *
 *   fa article  → lang="fa" dir="rtl"
 *   en fallback → lang="en" dir="ltr"
 *
 * This gives each card its own correct language/direction boundary without
 * forcing the whole Persian blog index to LTR — only the actual fallback
 * content is bounded.
 */
import { LOCALE_HTML_DIR } from "@/lib/i18n/locales";
import type { BlogIndexEntry } from "@/lib/blog/types";

export function BlogCardList({ articles }: { articles: BlogIndexEntry[] }) {
  return (
    <ul className="space-y-6">
      {articles.map((article) => {
        const dir = LOCALE_HTML_DIR[article.locale];
        return (
          <li key={`${article.locale}-${article.slug}`}>
            <a
              href={`/blog/${article.slug}`}
              lang={article.locale}
              dir={dir}
              className="block rounded-xl border border-gray-800/40 bg-gray-950/40 p-6 transition hover:border-emerald-500/20 hover:bg-gray-900/40"
            >
              <div className="flex items-center gap-2 text-xs text-gray-600">
                {article.category && <span>{article.category}</span>}
                <span>·</span>
                <time>{article.publishedAt}</time>
              </div>
              <h2 className="mt-2 text-lg font-semibold text-gray-100">
                {article.title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">{article.description}</p>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
