import type { Metadata } from "next";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { ShieldCheck, Zap, Globe, Lock } from "lucide-react";
import { resolveServerLocale } from "@/lib/i18n/server-locale";
import { translate } from "@/i18n";
import { absoluteUrl } from "@/lib/site/site-url";

/**
 * Phase 18 (fa-localization) — About page metadata is now locale-aware.
 *
 * `generateMetadata` resolves the locale through the SAME shared
 * `resolveServerLocale()` used by the root layout, then builds the title
 * from the canonical translation dictionaries (`about.title`) via the pure
 * `translate()` function — NOT hardcoded here. The root layout's title
 * template (`%s — Nixify`) appends the site name automatically, so the
 * about title renders as "About Nixify — Nixify" (en) or
 * "درباره Nixify — Nixify" (fa).
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const title = translate(locale, "about.title");
  const description = translate(locale, "about.subtitle");
  return {
    title,
    description,
    alternates: {
      canonical: "/about",
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl("/about"),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function AboutPage() {
  // About locale === application locale. Same shared canonical server resolver
  // as the root layout (src/app/layout.tsx) so the page never diverges from
  // <html lang dir>.
  const locale = await resolveServerLocale();

  const title = translate(locale, "about.title");
  const subtitle = translate(locale, "about.subtitle");
  const missionTitle = translate(locale, "about.mission.title");
  const missionText = translate(locale, "about.mission.text");
  const buildTitle = translate(locale, "about.build.title");
  const buildText = translate(locale, "about.build.text");
  const stackTitle = translate(locale, "about.stack.title");
  const stackText = translate(locale, "about.stack.text");
  const securityTitle = translate(locale, "about.security.title");
  const securityText = translate(locale, "about.security.text");

  return (
    <>
      <AmbientBackground />
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-28 sm:px-6">
        <h1 className="text-4xl font-bold text-foreground">{title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{subtitle}</p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-muted/40 p-6 backdrop-blur-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{missionTitle}</h3>
            <p className="mt-2 text-sm text-muted-foreground/70">{missionText}</p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/40 p-6 backdrop-blur-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
              <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{buildTitle}</h3>
            <p className="mt-2 text-sm text-muted-foreground/70">{buildText}</p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/40 p-6 backdrop-blur-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
              <Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{stackTitle}</h3>
            <p className="mt-2 text-sm text-muted-foreground/70" dir="ltr">
              {stackText}
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/40 p-6 backdrop-blur-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
              <Lock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{securityTitle}</h3>
            <p className="mt-2 text-sm text-muted-foreground/70" dir="ltr">
              {securityText}
            </p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground/50">
            &copy; 2026 Nixify. {translate(locale, "footer.allRightsReserved")}.
          </p>
        </div>
      </div>
    </>
  );
}
