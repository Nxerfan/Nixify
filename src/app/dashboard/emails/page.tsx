"use client";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import { GuideBanner } from "@/components/guide/GuideBanner";

export default function EmailsPage() {
  const t = useTranslations();
  return (
    <>
      <AmbientBackground />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300">
          <ArrowLeft className="h-4 w-4" /> {t("dashboard.emails.backToDashboard")}
        </Link>
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
            <Mail className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-100">{t("dashboard.emails.title")}</h1>
            <p className="text-sm text-gray-500">{t("dashboard.emails.subtitle")}</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-800/40 bg-gray-950/40 p-8 text-center backdrop-blur-xl">
          <p className="text-sm text-gray-500">{t("dashboard.emails.empty")}</p>
        </div>
      </div>
      <GuideBanner guideSlug="emails" />

    </>
  );
}
