import type { Metadata } from "next";
import { getArticlesByAuthor } from "@/lib/blog/editorial";
import { resolveServerLocale } from "@/lib/i18n/server-locale";
import { translate } from "@/i18n";
import { LOCALE_HTML_DIR } from "@/lib/i18n/locales";
import { BlogCardList } from "../../BlogCardList";

interface PageProps {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { name } = await params;
  const locale = await resolveServerLocale();
  return {
    title: `${translate(locale, "blog.articlesBy")} ${decodeURIComponent(name)}`,
    description: translate(locale, "blog.subtitle"),
    alternates: { canonical: `/blog/author/${name}` },
  };
}

export default async function AuthorPage({ params }: PageProps) {
  const { name } = await params;
  const locale = await resolveServerLocale();
  const dir = LOCALE_HTML_DIR[locale];
  const { authorName, articles } = getArticlesByAuthor(name, locale);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12" dir={dir}>
      <header className="mb-8">
        <p className="text-xs text-muted-foreground/50">{translate(locale, "blog.author.title")}</p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">
          {authorName ?? translate(locale, "blog.author.unknown")}
        </h1>
        {authorName && (
          <p className="mt-2 text-sm text-muted-foreground/70">
            {articles.length}
          </p>
        )}
      </header>

      {articles.length > 0 ? (
        <BlogCardList articles={articles} />
      ) : (
        <p className="text-sm text-muted-foreground/60">{translate(locale, "blog.author.noArticles")}</p>
      )}
    </div>
  );
}
