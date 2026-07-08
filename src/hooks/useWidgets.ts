"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Widget management hook. Tracks which widgets are enabled + their order.
 * Persists to localStorage (and would POST to /api/dashboard/widgets/configure
 * in production). Provides toggle + reorder operations.
 */

export interface WidgetConfig {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  enabled: boolean;
  order: number;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "usage-chart", name: "Usage Chart", description: "OTP volume over the last 7 days", icon: "BarChart3", enabled: true, order: 0 },
  { id: "quick-actions", name: "Quick Actions", description: "Common tasks and shortcuts", icon: "Zap", enabled: true, order: 1 },
  { id: "recent-activity", name: "Recent Activity", description: "Latest sign-ins and signups", icon: "Activity", enabled: true, order: 2 },
  { id: "activity-heatmap", name: "Activity Heatmap", description: "7-day OTP usage heatmap", icon: "Grid3x3", enabled: true, order: 3 },
  { id: "live-feed", name: "Live Feed", description: "Real-time event stream", icon: "Radio", enabled: false, order: 4 },
  { id: "tip-of-the-day", name: "Tip of the Day", description: "Helpful usage suggestions", icon: "Lightbulb", enabled: true, order: 5 },
  { id: "announcements", name: "Announcements", description: "Platform updates and news", icon: "Megaphone", enabled: false, order: 6 },
];

const STORAGE_KEY = "mg_dashboard_widgets";

export function useWidgets() {
  // Lazy initializer: reads from localStorage on the client (SSR-safe).
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    if (typeof window === "undefined") return DEFAULT_WIDGETS;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });

  // Persist to localStorage whenever widgets change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    } catch {
      // ignore quota errors
    }
  }, [widgets]);

  const toggleWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)));
  }, []);

  const reorderWidgets = useCallback((newOrder: WidgetConfig[]) => {
    setWidgets(newOrder.map((w, i) => ({ ...w, order: i })));
  }, []);

  const enabledWidgets = widgets.filter((w) => w.enabled).sort((a, b) => a.order - b.order);
  const availableWidgets = widgets.filter((w) => !w.enabled);

  return { widgets, enabledWidgets, availableWidgets, toggleWidget, reorderWidgets, loaded: true };
}
