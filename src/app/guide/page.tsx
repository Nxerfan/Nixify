import { GUIDE_METADATA, GUIDE_CATEGORIES } from "@/lib/guide/content";
import { GuideLanding } from "@/components/guide/landing/GuideLanding";

/**
 * /guide — premium learning hub.
 *
 * Lists all published guides organized by category, with a hero, featured
 * guide, learning path, task-oriented entry points, and a docs bridge.
 *
 * The page is a server component that reads the guide metadata from the
 * registry and passes it to the client-side GuideLanding component (which
 * reads the active locale from LocaleProvider for EN/FA rendering).
 *
 * No database reads, no API calls, no quota consumption.
 */

export const dynamic = "force-dynamic";

export default function GuideLandingPage() {
  return <GuideLanding guides={GUIDE_METADATA} categories={GUIDE_CATEGORIES} />;
}
