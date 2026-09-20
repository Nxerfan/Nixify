"use client";

import { motion } from "framer-motion";
import { Plus, Search, Bell } from "lucide-react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

const EASE = [0.22, 1, 0.36, 1] as const;

interface DashboardHeaderProps {
  name: string;
  onAddWidget: () => void;
  onOpenPalette: () => void;
}

/**
 * Dashboard header — greeting, search trigger, add-widget button,
 * notification bell.
 *
 * The greeting word is sourced from the translation dictionary
 * (`dashboard.overview.welcome`). The user's first name (a proper noun) is
 * rendered as-is. The subtitle (`dashboard.overview.subtitle`) is rendered
 * below the greeting.
 *
 * The action button labels ("Search", "Add Widget") do NOT have translation
 * keys in this phase — they remain canonical English. They will be added in
 * a future phase if Persian translations are required for them.
 */

export function DashboardHeader({ name, onAddWidget, onOpenPalette }: DashboardHeaderProps) {
  const t = useTranslations();
  const greeting = t("dashboard.overview.welcome");
  const firstName = name.split(" ")[0];

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <motion.p
          className="text-sm text-gray-500"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          {greeting},
        </motion.p>
        <motion.h2
          className="text-2xl font-semibold text-gray-100"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4, ease: EASE }}
        >
          {firstName} 👋
        </motion.h2>
        <motion.p
          className="mt-1 text-xs text-gray-600"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: EASE }}
        >
          {t("dashboard.overview.subtitle")}
        </motion.p>
      </div>

      <motion.div
        className="flex items-center gap-2"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: EASE }}
      >
        {/* Search / command palette trigger */}
        <button
          onClick={onOpenPalette}
          className="flex items-center gap-2 rounded-lg border border-gray-800/60 bg-gray-950/50 px-3 py-2 text-sm text-gray-500 transition-all hover:border-emerald-500/30 hover:text-gray-300"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">{t("dashboard.common.searchPlaceholder")}</span>
          <kbd className="hidden rounded border border-gray-700/50 px-1.5 py-0.5 font-mono text-xs text-gray-600 sm:inline">⌘K</kbd>
        </button>

        {/* Notifications */}
        <button className="relative rounded-lg border border-gray-800/60 bg-gray-950/50 p-2 text-gray-400 transition-all hover:border-emerald-500/30 hover:text-gray-200">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </button>

        {/* Add widget */}
        <button
          onClick={onAddWidget}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.25)]"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t("dashboard.common.addWidget")}</span>
        </button>
      </motion.div>
    </div>
  );
}
