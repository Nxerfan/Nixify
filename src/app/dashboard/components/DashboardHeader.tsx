"use client";

import { motion } from "framer-motion";
import { Plus, Search, Bell } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface DashboardHeaderProps {
  name: string;
  onAddWidget: () => void;
  onOpenPalette: () => void;
}

/**
 * Dashboard header — time-based greeting, search trigger, add-widget button,
 * notification bell. The greeting changes based on time of day.
 */

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardHeader({ name, onAddWidget, onOpenPalette }: DashboardHeaderProps) {
  const greeting = getGreeting();
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
        <motion.h1
          className="text-2xl font-semibold text-gray-100"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4, ease: EASE }}
        >
          {firstName} 👋
        </motion.h1>
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
          <span className="hidden sm:inline">Search...</span>
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
          <span className="hidden sm:inline">Add Widget</span>
        </button>
      </motion.div>
    </div>
  );
}
