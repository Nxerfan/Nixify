"use client";

import { useLocale, useTranslations } from "@/lib/i18n/LocaleProvider";
import { DocsShell } from "@/components/docs/DocsShell";
import { DocsContent } from "@/components/docs/DocsContent";
import { getDocsNavGroups, getQuickLinks, getDocsTitle } from "@/lib/docs/content";

/**
 * Dashboard Docs page (/dashboard/docs).
 *
 * Uses the SAME shared DocsShell + DocsContent as the public /docs page.
 * The only difference is the dashboard chrome (back-to-dashboard link).
 *
 * No content drift — both pages render the same structured documentation.
 */

export default function DashboardDocsPage() {
  const { locale } = useLocale();
  const t = useTranslations();
  const navGroups = getDocsNavGroups(locale);
  const quickLinks = getQuickLinks(locale);
  const { title, subtitle } = getDocsTitle(locale);

  return (
    <DocsShell
      navGroups={navGroups}
      quickLinks={quickLinks}
      title={title}
      subtitle={subtitle}
      isDashboard={true}
      backHref="/dashboard"
      backLabel={t("dashboard.nav.dashboard")}
    >
      <DocsContent />
    </DocsShell>
  );
}
