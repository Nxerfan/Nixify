"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { CustomCursor } from "@/app/auth/components/CustomCursor";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Dashboard layout — shared chrome (sidebar, ambient bg, cursor, status bar)
 * wrapping the main content. The sidebar collapses to a hamburger on mobile.
 *
 * Guide banners are placed at the END of each individual dashboard page
 * (not in the layout) via the <GuideBanner /> component.
 */

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <AmbientBackground />
      <CustomCursor />

      <div className="relative flex min-h-screen" style={{ backgroundColor: "transparent" }}>
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
              />
              <motion.div
                className="fixed left-0 top-0 z-50 h-full lg:hidden"
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: "spring", stiffness: 350, damping: 35 }}
              >
                <Sidebar onNavigate={() => setSidebarOpen(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile header bar with hamburger */}
          <div className="flex items-center justify-between border-b border-border p-4 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-border/50 hover:text-foreground"
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span className="text-sm font-medium text-foreground">Nixify</span>
            <div className="w-9" />
          </div>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              {children}
            </motion.div>
          </main>

          {/* Status bar */}
          <StatusBar />
        </div>
      </div>

      {/* Sonner toaster — used by the templates dashboard pages. */}
      <SonnerToaster richColors closeButton position="top-right" />
    </>
  );
}
