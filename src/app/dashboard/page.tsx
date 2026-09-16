"use client";

import { useState, useEffect } from "react";
import { DashboardHeader } from "./components/DashboardHeader";
import { StatsGrid } from "./components/StatsGrid";
import { WidgetGrid } from "./components/WidgetGrid";
import { WidgetLibrary } from "./components/WidgetLibrary";
import { CommandPalette } from "./components/CommandPalette";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useWidgets } from "@/hooks/useWidgets";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

/**
 * Main dashboard page — assembles the header, stats grid, widget grid,
 * widget library panel, and command palette into a cohesive experience.
 *
 * Visible strings (overview title/subtitle, empty widget state, widget
 * count summary) are sourced from the translation dictionary via
 * `useTranslations()`.
 *
 * Keyboard shortcuts:
 *   Cmd+K / Ctrl+K → open command palette
 *   A              → open widget library (when palette is closed)
 */

export default function DashboardV2Page() {
  const { stats, activity, profile, loading } = useDashboardData();
  const { enabledWidgets, availableWidgets, toggleWidget, reorderWidgets, loaded } = useWidgets();
  const [widgetLibOpen, setWidgetLibOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const t = useTranslations();

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-8">
      <h1 className="sr-only">{t("dashboard.overview.title")}</h1>
      <DashboardHeader
        name={profile?.name ?? "User"}
        onAddWidget={() => setWidgetLibOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      {/* Stats grid */}
      <div className="mt-8">
        <StatsGrid stats={stats} loading={loading} />
      </div>

      {/* Section label */}
      <div className="mb-4 mt-10 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-400">{t("dashboard.overview.yourWidgets")}</h2>
        <span className="text-xs text-gray-600">
          {enabledWidgets.length} {t("common.status.active")}
        </span>
      </div>

      {/* Widget grid */}
      {loaded && enabledWidgets.length > 0 ? (
        <WidgetGrid
          widgets={enabledWidgets}
          onReorder={reorderWidgets}
          activities={activity}
          loading={loading}
        />
      ) : (
        <div className="rounded-xl border border-gray-800/40 bg-gray-950/40 p-12 text-center backdrop-blur-xl">
          <p className="text-sm text-gray-500">{t("dashboard.overview.noWidgets")}</p>
          <button
            onClick={() => setWidgetLibOpen(true)}
            className="mt-2 text-sm text-emerald-400 hover:text-emerald-300"
          >
            {t("dashboard.overview.addFirstWidget")}
          </button>
        </div>
      )}

      {/* Widget library panel */}
      <WidgetLibrary
        open={widgetLibOpen}
        onClose={() => setWidgetLibOpen(false)}
        availableWidgets={availableWidgets}
        enabledWidgets={enabledWidgets}
        onToggle={toggleWidget}
      />

      {/* Command palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAddWidget={() => setWidgetLibOpen(true)}
      />
    </div>
  );
}
