"use client";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { Settings, ArrowLeft, Globe } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export default function SettingsPage() {
  const t = useTranslations();

  return (
    <>
      <AmbientBackground />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{t("common.buttons.back")}</span>
        </Link>
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
            <Settings className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-100">{t("dashboard.settings.title")}</h1>
            <p className="text-sm text-gray-500">{t("dashboard.settings.subtitle")}</p>
          </div>
        </div>

        {/* Language preference card */}
        <section
          aria-labelledby="locale-pref-heading"
          className="mb-6 rounded-xl border border-gray-800/40 bg-gray-950/40 p-6 backdrop-blur-xl"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15 shrink-0">
              <Globe className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h2
                id="locale-pref-heading"
                className="text-base font-semibold text-gray-100"
              >
                {t("dashboard.settings.localePreference")}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {t("dashboard.settings.localePreferenceHelp")}
              </p>
              <div className="mt-4">
                <LocaleSwitcher />
              </div>
            </div>
          </div>
        </section>

        <div className="rounded-xl border border-gray-800/40 bg-gray-950/40 p-8 text-center backdrop-blur-xl">
          <p className="text-sm text-gray-500">{t("dashboard.settings.subtitle")}</p>
        </div>
      </div>
    </>
  );
}
