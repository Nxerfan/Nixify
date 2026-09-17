import type { Metadata } from "next";
import { getArticles } from "@/lib/blog/content";
import { resolveServerLocale } from "@/lib/i18n/server-locale";
import { BlogHeader } from "./BlogHeader";
import { BlogCardList } from "./BlogCardList";

export const metadata: Metadata = {
  title: "Blog — Nixify",
  description: "Articles about email verification, OTP delivery, and the Nixify platform.",
};

export default async function BlogPage() {
  // Blog locale === application locale. There is no blog-specific resolver;
  // this is the SAME shared canonical server resolver used by the root layout
  // (src/app/layout.tsx) so the blog can never diverge from <html lang dir>.
  const locale = await resolveServerLocale();
  const articles = getArticles(locale);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Heading + subtitle come from the canonical translation dictionaries
          (blog.title / blog.subtitle) via the pure translate() function —
          NOT hardcoded here. See BlogHeader.tsx. */}
      <BlogHeader locale={locale} />
      <BlogCardList articles={articles} />
    </div>
  );
}
