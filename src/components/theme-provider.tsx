"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * ThemeProvider — wraps next-themes for app-wide theme support.
 *
 * Supports three modes:
 *   - Light  (class not set on <html>)
 *   - Dark   (class="dark" on <html>)
 *   - System (follows prefers-color-scheme)
 *
 * defaultTheme="dark" preserves the existing Nixify dark experience for
 * users who have never explicitly chosen a theme. This avoids a jarring
 * switch to light mode for existing users after the UX-C update.
 *
 * enableSystem allows the "System" option in Settings to actually follow
 * the OS/browser preference.
 *
 * disableTransitionOnChange prevents a flash of unstyled content during
 * theme switches.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
