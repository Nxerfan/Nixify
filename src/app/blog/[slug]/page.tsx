import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticle, getAllSlugs } from "@/lib/blog/content";
import { resolveServerLocale } from "@/lib/i18n/server-locale";
import { buildArticleMetadata } from "@/lib/seo/metadata";
import { buildArticleJsonLd } from "@/lib/seo/json-ld";
import { JsonLd } from "@/components/seo/JsonLd";
import ReactMarkdown from "react-markdown";
import { LOCALE_HTML_DIR } from "@/lib/i18n/locales";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  // Metadata uses the SAME shared canonical server locale resolver as the
  // article rendering below — metadata locale === article render locale.
  const locale = await resolveServerLocale();
  return buildArticleMetadata(slug, locale);
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  // Article locale === application locale. There is no blog-specific resolver;
  // this is the SAME shared canonical server resolver used by the root layout.
  const locale = await resolveServerLocale();
  const article = getArticle(slug, locale);

  if (!article) {
    notFound();
  }

  const dir = LOCALE_HTML_DIR[article.locale];

  return (
    <article
      className="mx-auto max-w-3xl px-4 py-12"
      dir={dir}
      lang={article.locale}
    >
      {/* Structured data: BlogPosting derived from the canonical article
          object. headline=title, description=description, datePublished=
          publishedAt, dateModified=updatedAt ?? publishedAt, inLanguage=
          article.locale (the actual fallback article locale), author only
          when real. No fake ratings/reviews. */}
      <JsonLd data={buildArticleJsonLd(article)} />

      <header className="mb-8">
        <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
          {article.category && <span>{article.category}</span>}
          {article.category && <span>·</span>}
          <time>{article.publishedAt}</time>
          {article.author && (
            <>
              <span>·</span>
              <span>{article.author}</span>
            </>
          )}
        </div>
        <h1 className="mt-2 text-3xl font-bold text-foreground">{article.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground/70">{article.description}</p>
      </header>

      <div className="prose prose-invert max-w-none">
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">{children}</h2>,
            h2: ({ children }) => <h2 className="text-xl font-bold text-foreground mt-6 mb-3">{children}</h2>,
            h3: ({ children }) => <h3 className="text-lg font-semibold text-foreground mt-5 mb-2">{children}</h3>,
            p: ({ children }) => <p className="text-muted-foreground leading-relaxed mb-4">{children}</p>,
            a: ({ href, children }) => (
              <a href={href} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:text-emerald-300 underline" target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
            ul: ({ children }) => <ul className="list-disc list-inside text-muted-foreground mb-4 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside text-muted-foreground mb-4 space-y-1">{children}</ol>,
            code: ({ children, className }) => {
              const isBlock = className?.includes("language-");
              if (isBlock) {
                return (
                  <code className="block bg-muted rounded-lg p-4 overflow-x-auto text-sm font-mono text-muted-foreground mb-4" dir="ltr">
                    {children}
                  </code>
                );
              }
              return <code className="bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-emerald-700 dark:text-emerald-300" dir="ltr">{children}</code>;
            },
            pre: ({ children }) => <>{children}</>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-emerald-500/30 pl-4 italic text-muted-foreground/70 mb-4">{children}</blockquote>
            ),
          }}
        >
          {article.body}
        </ReactMarkdown>
      </div>

      <footer className="mt-12 border-t border-border/60 pt-6">
        <a href="/blog" className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:text-emerald-300">
          ← {article.locale === "fa" ? "بازگشت به وبلاگ" : "Back to blog"}
        </a>
      </footer>
    </article>
  );
}
