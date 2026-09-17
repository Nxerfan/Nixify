import type { Metadata } from "next";
import { getArticles } from "@/lib/blog/content";
import type { BlogLocale } from "@/lib/blog/types";
import { resolveLocaleFromHeaders } from "@/lib/blog/locale";

export const metadata: Metadata = {
  title: "Blog — Nixify",
  description: "Articles about email verification, OTP delivery, and the Nixify platform.",
};

export default async function BlogPage() {
  const locale = await resolveLocaleFromHeaders();
  const articles = getArticles(locale);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100">Blog</h1>
        <p className="mt-2 text-sm text-gray-500">
          {locale === "fa" ? "مقالات درباره تأیید ایمیل و پلتفرم Nixify" : "Articles about email verification and the Nixify platform"}
        </p>
      </header>

      <ul className="space-y-6">
        {articles.map((article) => (
          <li key={`${article.locale}-${article.slug}`}>
            <a
              href={`/blog/${article.slug}`}
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
        ))}
      </ul>
    </div>
  );
}
