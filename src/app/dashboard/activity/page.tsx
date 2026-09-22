"use client";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { Activity, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

export default function ActivityPage() {
  const t = useTranslations();
  return (
    <>
      <AmbientBackground />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground/70 hover:text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("dashboard.activity.backToDashboard")}
        </Link>
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
            <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dashboard.activity.title")}</h1>
            <p className="text-sm text-muted-foreground/70">{t("dashboard.activity.subtitle")}</p>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/40 p-8 text-center backdrop-blur-xl">
          <p className="text-sm text-muted-foreground/70">{t("dashboard.activity.empty")}</p>
        </div>
      </div>
    </>
  );
}
