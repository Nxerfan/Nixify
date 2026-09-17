import type { Metadata } from "next";
import { getArticles } from "@/lib/blog/content";
import { resolveServerLocale } from "@/lib/i18n/server-locale";
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
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100">Blog</h1>
        <p className="mt-2 text-sm text-gray-500">
          {locale === "fa" ? "مقالات درباره تأیید ایمیل و پلتفرم Nixify" : "Articles about email verification and the Nixify platform"}
        </p>
      </header>

      <BlogCardList articles={articles} />
    </div>
  );
}
