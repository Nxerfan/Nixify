import type { Metadata } from "next";
import { getArticlesByCategory } from "@/lib/blog/editorial";
import { resolveServerLocale } from "@/lib/i18n/server-locale";
import { translate } from "@/i18n";
import { LOCALE_HTML_DIR } from "@/lib/i18n/locales";
import { BlogCardList } from "../../BlogCardList";

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const locale = await resolveServerLocale();
  const label = decodeURIComponent(category);
  return {
    title: `${translate(locale, "blog.category.title")}: ${label}`,
    description: translate(locale, "blog.subtitle"),
    alternates: { canonical: `/blog/category/${category}` },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { category } = await params;
  const locale = await resolveServerLocale();
  const dir = LOCALE_HTML_DIR[locale];
  const label = decodeURIComponent(category);
  const articles = getArticlesByCategory(label, locale);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12" dir={dir}>
      <header className="mb-8">
        <p className="text-xs text-muted-foreground/50">{translate(locale, "blog.category.title")}</p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">{label}</h1>
      </header>

      {articles.length > 0 ? (
        <BlogCardList articles={articles} />
      ) : (
        <p className="text-sm text-muted-foreground/60">{translate(locale, "blog.category.noArticles")}</p>
      )}
    </div>
  );
}
