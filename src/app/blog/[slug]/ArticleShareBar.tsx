"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Client share bar — "Copy link" button that copies the canonical article URL
 * to the clipboard. Shows a transient "Copied!" confirmation.
 *
 * The URL is built from `window.location.href` so it always reflects the
 * canonical /blog/<slug> path (the article page is the canonical route).
 */
export function ArticleShareBar({ locale }: { locale: Locale }) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      // Copy the canonical URL (without query/hash).
      const url = window.location.origin + window.location.pathname;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API may be unavailable (e.g. non-secure context) — silently
      // ignore; the button still announces intent.
    }
  }

  return (
    <div className="mt-4 flex items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:border-emerald-500/30 hover:text-emerald-600 dark:hover:text-emerald-400"
        aria-label={t("blog.article.copyLink")}
      >
        <span aria-hidden>🔗</span>
        {copied ? t("blog.article.copied") : t("blog.article.copyLink")}
      </button>
    </div>
  );
}
