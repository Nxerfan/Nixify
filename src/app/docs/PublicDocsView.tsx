"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { DocsShell } from "@/components/docs/DocsShell";
import { DocsContent } from "@/components/docs/DocsContent";
import { getDocsNavGroups, getQuickLinks, getDocsTitle } from "@/lib/docs/content";

/**
 * PublicDocsView — the public /docs page view.
 *
 * Uses the shared DocsShell + DocsContent. No authentication required.
 * Reads the active locale from LocaleProvider and renders in EN or FA.
 */
export function PublicDocsView() {
  const { locale } = useLocale();
  const navGroups = getDocsNavGroups(locale);
  const quickLinks = getQuickLinks(locale);
  const { title, subtitle } = getDocsTitle(locale);

  return (
    <DocsShell
      navGroups={navGroups}
      quickLinks={quickLinks}
      title={title}
      subtitle={subtitle}
      isDashboard={false}
    >
      <DocsContent />
    </DocsShell>
  );
}
