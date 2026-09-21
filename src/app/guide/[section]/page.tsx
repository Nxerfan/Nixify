import { notFound } from "next/navigation";
import { isKnownGuideSlug, GUIDE_SLUGS } from "@/lib/guide/content";
import { ContactsGuideView } from "@/components/guide/views/ContactsGuideView";

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
 *
 * This route is `force-dynamic` so that the root layout's server-side locale
 * resolution (cookie / Accept-Language / Geo) actually runs per request. With
 * `force-static` the cookie would be ignored at build time and the page would
 * always render in the default locale. Keeping the route dynamic preserves
 * the canonical locale resolver/persistence system without modification.
 *
 * This route does NOT do any database reads and does NOT consume any quota.
 * All guide content is bundled; the walkthrough stage uses local demo state
 * only — no real API requests, no real database writes, no contact mutation.
 */

interface GuidePageProps {
  params: Promise<{ section: string }>;
}

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ section: slug }));
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { section } = await params;

  if (!isKnownGuideSlug(section)) {
    notFound();
  }

  // Each registered slug gets its own dedicated client view component so the
  // route stays type-safe and the view can render the slug-specific stage and
  // creative sections.
  if (section === "contacts") {
    return <ContactsGuideView />;
  }

  // Future guides: add their view components here.
  notFound();
}
