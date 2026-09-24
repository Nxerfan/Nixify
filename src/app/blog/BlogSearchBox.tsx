"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

/**
 * Client search box for the blog homepage. Navigates to /blog/search?q=…
 * on submit. The search results page is `noindex` (search result pages should
 * normally not be indexed).
 */
export function BlogSearchBox() {
  const [q, setQ] = useState("");
  const router = useRouter();
  const t = useTranslations();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/blog/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 max-w-xl" role="search">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("blog.search.placeholder")}
        aria-label={t("blog.search.title")}
        className="flex-1 rounded-lg border border-border/60 bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      />
      <button
        type="submit"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {t("blog.search.button")}
      </button>
    </form>
  );
}
