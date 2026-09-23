import { notFound } from "next/navigation";
import { isKnownGuideSlug, GUIDE_SLUGS } from "@/lib/guide/content";
import { ContactsGuideView } from "@/components/guide/views/ContactsGuideView";
import { BrandingGuideView } from "@/components/guide/views/BrandingGuideView";
import { AutomationsGuideView } from "@/components/guide/views/AutomationsGuideView";
import { TemplatesGuideView } from "@/components/guide/views/TemplatesGuideView";
import { BroadcastsGuideView } from "@/components/guide/views/BroadcastsGuideView";
import { SuppressionsGuideView } from "@/components/guide/views/SuppressionsGuideView";
import { EmailsGuideView } from "@/components/guide/views/EmailsGuideView";
import { ApiKeysGuideView } from "@/components/guide/views/ApiKeysGuideView";
import { WebhooksGuideView } from "@/components/guide/views/WebhooksGuideView";
import type { ComponentType } from "react";

/**
 * /guide/[section] — generic guide route.
 *
 * Architecture:
 *   - Server component. Resolves the slug against a typed guide registry.
 *     Unknown slugs call `notFound()`, which renders the nearest
 *     `not-found.tsx` boundary (segment-level or app-root).
 *   - Pre-renders only registered guide slugs via `generateStaticParams`.
 *   - The active locale is supplied by the root layout's `<LocaleProvider>`
 *     (the canonical locale resolver/persistence system, unchanged). The
 *     client view component reads it via `useLocale()`.
 *   - force-dynamic so the locale cookie is respected per-request.
 *
 * This route does NOT do any database reads and does NOT consume any quota.
 * All guide content is bundled; the walkthrough stage uses local demo state
 * only — no real API requests, no real database writes, no mutation.
 */

interface GuidePageProps {
  params: Promise<{ section: string }>;
}

export const dynamic = "force-dynamic";

/** Map of slug → view component. Each view reads locale + renders the guide. */
const GUIDE_VIEWS: Record<string, ComponentType> = {
  contacts: ContactsGuideView,
  branding: BrandingGuideView,
  automations: AutomationsGuideView,
  templates: TemplatesGuideView,
  broadcasts: BroadcastsGuideView,
  suppressions: SuppressionsGuideView,
  emails: EmailsGuideView,
  "api-keys": ApiKeysGuideView,
  webhooks: WebhooksGuideView,
};

export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ section: slug }));
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { section } = await params;

  if (!isKnownGuideSlug(section)) {
    notFound();
  }

  const View = GUIDE_VIEWS[section];
  if (!View) {
    notFound();
  }

  return <View />;
}
