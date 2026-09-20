"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import { getGuideForRoute } from "@/lib/guide/registry";
import { WalkthroughShell } from "./WalkthroughShell";

/**
 * GuideLauncher — the entry point for contextual guidance on a dashboard page.
 *
 * Renders a "Guide this section" button. When clicked, opens the
 * WalkthroughShell with the guide for the current route.
 *
 * Usage:
 *   <GuideLauncher pathname="/dashboard/broadcasts" />
 *
 * The GuideLauncher reads the guide definition from the registry and
 * passes it to the WalkthroughShell. If no guide exists for the route,
 * the launcher is not rendered.
 *
 * The button is designed to be unobtrusive but discoverable:
 * - Small pill button with a Sparkles icon
 * - Positioned at the top-right of the page content
 * - Accessible via keyboard
 */
export function GuideLauncher({ pathname }: { pathname: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  const guide = getGuideForRoute(pathname);

  if (!guide || !guide.enabled) return null;

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:border-emerald-500/30 hover:bg-emerald-500/10"
        aria-label={t("guide.launchButton")}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>{t("guide.launchButton")}</span>
      </button>

      <WalkthroughShell guide={guide} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
