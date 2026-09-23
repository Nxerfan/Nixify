import type { Metadata } from "next";
import { getArticlesByTag } from "@/lib/blog/editorial";
import { resolveServerLocale } from "@/lib/i18n/server-locale";
import { translate } from "@/i18n";
import { LOCALE_HTML_DIR } from "@/lib/i18n/locales";
import { BlogCardList } from "../../BlogCardList";

interface PageProps {
  params: Promise<{ tag: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params;
  const locale = await resolveServerLocale();
  const label = decodeURIComponent(tag);
  return {
    title: `${translate(locale, "blog.tag.title")}: ${label}`,
    description: translate(locale, "blog.subtitle"),
    alternates: { canonical: `/blog/tag/${tag}` },
  };
}

export default async function TagPage({ params }: PageProps) {
  const { tag } = await params;
  const locale = await resolveServerLocale();
  const dir = LOCALE_HTML_DIR[locale];
  const label = decodeURIComponent(tag);
  const articles = getArticlesByTag(label, locale);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12" dir={dir}>
      <header className="mb-8">
        <p className="text-xs text-muted-foreground/50">{translate(locale, "blog.tag.title")}</p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">#{label}</h1>
      </header>

      {articles.length > 0 ? (
        <BlogCardList articles={articles} />
      ) : (
        <p className="text-sm text-muted-foreground/60">{translate(locale, "blog.tag.noArticles")}</p>
      )}
    </div>
  );
}
