"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

/**
 * Dark/light theme toggle button.
 *
 * Uses `useSyncExternalStore` to subscribe to next-themes' resolved theme
 * without triggering the set-state-in-effect lint rule (the standard mounted
 * pattern would). Returns a stable snapshot once the client has hydrated.
 */
const emptySubscribe = () => () => {};

function useResolvedTheme(): string | undefined {
  return useSyncExternalStore(
    emptySubscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light", // server snapshot
  );
}

export function ThemeToggle() {
  const { setTheme } = useTheme();
  const resolved = useResolvedTheme();
  const isDark = resolved === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
