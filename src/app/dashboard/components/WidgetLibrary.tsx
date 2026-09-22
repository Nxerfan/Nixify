"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";
import type { WidgetConfig } from "@/hooks/useWidgets";

const EASE = [0.22, 1, 0.36, 1] as const;

interface WidgetLibraryProps {
  open: boolean;
  onClose: () => void;
  availableWidgets: WidgetConfig[];
  enabledWidgets: WidgetConfig[];
  onToggle: (id: string) => void;
}

/**
 * Widget Library — a slide-in panel showing all available widgets with toggle
 * switches. Users can enable/disable widgets; enabled ones appear in the grid.
 */

export function WidgetLibrary({
  open,
  onClose,
  availableWidgets,
  enabledWidgets,
  onToggle,
}: WidgetLibraryProps) {
  const allWidgets = [...enabledWidgets, ...availableWidgets].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 z-50 h-full w-80 overflow-y-auto border-l border-border p-5"
            style={{ backgroundColor: "#060907" }}
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Widget Library</h2>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:bg-border/50 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {allWidgets.map((widget, i) => (
                <motion.div
                  key={widget.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 p-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3, ease: EASE }}
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="truncate text-sm font-medium text-foreground">{widget.name}</p>
                    <p className="truncate text-xs text-muted-foreground/50">{widget.description}</p>
                  </div>
                  <button
                    onClick={() => onToggle(widget.id)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      widget.enabled ? "bg-emerald-600" : "bg-gray-700"
                    }`}
                    aria-label={`Toggle ${widget.name}`}
                  >
                    <motion.div
                      className="absolute top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white"
                      animate={{ left: widget.enabled ? "22px" : "2px" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    >
                      {widget.enabled && <Check className="h-3 w-3 text-emerald-600" />}
                    </motion.div>
                  </button>
                </motion.div>
              ))}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground/50">
              {enabledWidgets.length} of {allWidgets.length} widgets enabled
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
