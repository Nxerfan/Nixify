"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  Check,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  Lock,
} from "lucide-react";
import { AnalyticsDashboard } from "@/app/admin/analytics/AnalyticsDashboard";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

type Plan = "FREE" | "PRO" | "MAX" | "ADMIN";

const PRO_FEATURES = [
  "Verification success/failure trends over time",
  "Traffic heatmap by hour × day of week",
  "Error reports with last occurrence",
  "CSV exports for offline analysis",
];

/**
 * /dashboard/analytics — user-facing analytics entry point.
 *
 * Plan detection flow:
 *   1. GET /api/profile/me → if 200, read user.plan.
 *   2. If 401 (no user session), probe /api/admin/analytics/overview — if it
 *      returns 200, the visitor is an admin (no user session), so treat as
 *      ADMIN (render the dashboard). Otherwise redirect to /auth.
 *
 * Rendering:
 *   - FREE → upgrade CTA card.
 *   - PRO / MAX / ADMIN → embedded AnalyticsDashboard (Choice 2 from the spec,
 *     keeps the user inside the dashboard layout with the sidebar).
 */
export default function DashboardAnalyticsPage() {
  const router = useRouter();
  const t = useTranslations();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const r = await fetch("/api/profile/me");
        if (cancelled) return;

        if (r.status === 401) {
          // No user session — fall back to admin-cookie probe.
          const adminProbe = await fetch(
            "/api/admin/analytics/overview?range=7d",
          );
          if (cancelled) return;
          if (adminProbe.ok) {
            setPlan("ADMIN");
          } else {
            router.push("/auth");
          }
          return;
        }

        if (r.ok) {
          const data = await r.json();
          const p: string = data?.user?.plan ?? "FREE";
          if (cancelled) return;
          if (p === "PRO") setPlan("PRO");
          else if (p === "MAX") setPlan("MAX");
          else setPlan("FREE");
          return;
        }

        // Unexpected status — try admin probe before giving up.
        const adminProbe = await fetch(
          "/api/admin/analytics/overview?range=7d",
        );
        if (cancelled) return;
        if (adminProbe.ok) {
          setPlan("ADMIN");
        } else {
          router.push("/auth");
        }
      } catch {
        if (cancelled) return;
        setError(t("dashboard.analytics.verifyError"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Loading state — centered spinner.
  if (plan === null && error === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  // Network error state.
  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-rose-500">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link href="/dashboard">{t("dashboard.analytics.backToDashboard")}</Link>
        </Button>
      </div>
    );
  }

  // FREE → upgrade CTA.
  if (plan === "FREE") {
    return <UpgradeCta />;
  }

  // PRO / MAX / ADMIN → embedded analytics dashboard. Keep the user inside
  // the dashboard layout (no jump to /admin). On session expiry, send
  // them to /auth (not /admin/login).
  return (
    <AnalyticsDashboard
      unauthorizedRedirect="/auth"
      backHref="/dashboard"
      showHeader={true}
    />
  );
}

/**
 * UpgradeCta — shown when a FREE user lands on /dashboard/analytics.
 * Centered max-w-2xl Card with a BarChart3 hero icon, a 4-item feature list,
 * and two CTAs (Upgrade to PRO → /pricing, Back to dashboard → /dashboard).
 */
function UpgradeCta() {
  const t = useTranslations();
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center px-4 py-12">
      <Card className="w-full border-gray-800/50 bg-gray-950/60 p-8 backdrop-blur-xl sm:p-12">
        <CardHeader className="items-center text-center">
          {/* Hero icon — emerald-tinted circle */}
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <BarChart3 className="h-8 w-8 text-emerald-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-100">
            {t("dashboard.analytics.isProFeature")}
          </CardTitle>
          <CardDescription className="mt-2 text-gray-400">
            {t("dashboard.analytics.upgradeDescription")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Feature list */}
          <ul className="space-y-3">
            {PRO_FEATURES.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-3 text-sm text-gray-300"
              >
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <Check className="h-3 w-3" />
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {/* Preview pills (teaser of what they'd see) */}
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-800/50 pt-6 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-900/60 px-3 py-1 ring-1 ring-gray-800/60">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> {t("dashboard.analytics.trends")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-900/60 px-3 py-1 ring-1 ring-gray-800/60">
              <BarChart3 className="h-3.5 w-3.5 text-emerald-400" /> {t("dashboard.analytics.heatmap")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-900/60 px-3 py-1 ring-1 ring-gray-800/60">
              <Lock className="h-3.5 w-3.5 text-emerald-400" /> {t("dashboard.analytics.reports")}
            </span>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              asChild
              className="bg-emerald-600 text-white shadow-[0_0_0_0_rgba(16,185,129,0)] transition-all hover:bg-emerald-500 hover:shadow-[0_0_24px_-4px_rgba(16,185,129,0.6)]"
            >
              <Link href="/pricing">
                {t("dashboard.analytics.upgradeToPro")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800/40 hover:text-gray-100"
            >
              <Link href="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t("dashboard.analytics.backToDashboard")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
