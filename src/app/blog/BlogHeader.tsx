/**
 * Phase 15 — Blog index header (presentational).
 *
 * Extracted from `src/app/blog/page.tsx` so the localized heading + subtitle
 * are independently unit-testable (the blog page is an async server component
 * that resolves the locale; this component is a pure function of the locale it
 * receives).
 *
 * BLOCKER fix: the heading + subtitle are sourced from the CANONICAL
 * translation dictionaries (`blog.title` / `blog.subtitle`) via the pure
 * `translate()` function — NOT hardcoded in the page. This reuses the existing
 * Phase 12 translation architecture; no second locale resolver, no duplicated
 * strings.
 */
import { translate } from "@/i18n";
import type { Locale } from "@/lib/i18n/locales";

export function BlogHeader({ locale }: { locale: Locale }) {
  const title = translate(locale, "blog.title");
  const subtitle = translate(locale, "blog.subtitle");

  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold text-gray-100">{title}</h1>
      <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
    </header>
  );
}
