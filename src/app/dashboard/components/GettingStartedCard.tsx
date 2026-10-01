"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";

interface OnboardingProgress {
  completed: boolean;
  stepApiKeyCreated: boolean;
  stepOtpSent: boolean;
  stepOtpVerified: boolean;
}

/**
 * Lightweight "Getting Started" card for the dashboard home page.
 *
 * Shows ONLY for users who have not completed onboarding. Once completed,
 * the card disappears (no nagging). The route remains accessible at
 * /dashboard/getting-started.
 *
 * Progress is fetched server-side (durable PostgreSQL) — not localStorage.
 */
export function GettingStartedCard() {
  const t = useTranslations();
  const router = useRouter();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/onboarding/progress")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.progress) setProgress(d.progress);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return null; // don't flash a card while loading
  }

  // Don't show the card if onboarding is completed (no nagging).
  if (!progress || progress.completed) {
    return null;
  }

  const steps = [
    progress.stepApiKeyCreated,
    progress.stepOtpSent,
    progress.stepOtpVerified,
  ];
  const completedCount = steps.filter(Boolean).length;

  return (
    <Card className="mb-8 border-emerald-500/30 bg-emerald-500/5">
      <CardContent className="flex items-center justify-between gap-4 p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            {t("dashboard.onboarding.cardTitle")}
          </h2>
          <p className="text-sm text-muted-foreground/70">
            {t("dashboard.onboarding.cardBody")}{" "}
            <span className="font-medium text-foreground">
              {completedCount}/3
            </span>
          </p>
        </div>
        <Button
          onClick={() => router.push("/dashboard/getting-started")}
          className="gap-2 shrink-0"
        >
          {t("dashboard.onboarding.cardCta")}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </Button>
      </CardContent>
    </Card>
  );
}
