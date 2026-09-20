"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, LayoutDashboard, Activity, Plus, Settings, Mail, Download } from "lucide-react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

const EASE = [0.22, 1, 0.36, 1] as const;

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAddWidget: () => void;
}

interface Command {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  action: () => void;
}

/**
 * Command Palette — Cmd+K overlay for quick navigation + actions.
 * Features: fuzzy search, keyboard navigation (up/down/enter), animated
 * entrance/exit, and a list of contextual commands.
 */

export function CommandPalette({ open, onClose, onAddWidget }: CommandPaletteProps) {
  const t = useTranslations();
  const commands: Command[] = [
    { id: "goto-dashboard", label: "Go to Dashboard", icon: LayoutDashboard, action: onClose },
    { id: "goto-activity", label: "View Activity", icon: Activity, action: onClose },
    { id: "goto-settings", label: "Go to Settings", icon: Settings, action: onClose },
    { id: "add-widget", label: t("dashboard.common.addWidget"), icon: Plus, shortcut: "A", action: () => { onAddWidget(); onClose(); } },
    { id: "send-test", label: "Send Test OTP", icon: Mail, action: onClose },
    { id: "export-data", label: "Export Data", icon: Download, action: onClose },
  ];

  // Keyboard navigation handler (always active; only acts when open)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <PaletteContent commands={commands} onClose={onClose} />
      )}
    </AnimatePresence>
  );
}

/** Inner content component — remounts on each open, naturally resetting state. */
function PaletteContent({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));

  // Keyboard navigation (up/down/enter)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[selectedIndex];
        if (cmd) cmd.action();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selectedIndex]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-gray-800/60 bg-gray-950/90 backdrop-blur-2xl"
        initial={{ opacity: 0, scale: 0.98, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -10 }}
        transition={{ duration: 0.2, ease: EASE }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-gray-800/50 px-4 py-3">
          <Search className="h-4 w-4 text-gray-500" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent text-sm text-gray-100 placeholder:text-gray-600 outline-none"
          />
          <kbd className="rounded border border-gray-700/50 px-1.5 py-0.5 font-mono text-xs text-gray-600">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-600">No results found.</p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => cmd.action()}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  i === selectedIndex ? "bg-emerald-500/10 text-emerald-300" : "text-gray-300 hover:bg-gray-800/30"
                }`}
              >
                <cmd.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-sm">{cmd.label}</span>
                {cmd.shortcut && (
                  <kbd className="rounded border border-gray-700/50 px-1.5 py-0.5 font-mono text-xs text-gray-600">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-800/50 px-4 py-2 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-gray-700/50 px-1 py-0.5">↑</kbd>
            <kbd className="rounded border border-gray-700/50 px-1 py-0.5">↓</kbd>
            to navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-gray-700/50 px-1 py-0.5">↵</kbd>
            to select
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
