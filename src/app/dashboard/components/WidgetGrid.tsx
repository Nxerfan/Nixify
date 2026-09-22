"use client";

import { Reorder, useDragControls } from "framer-motion";
import { GripVertical } from "lucide-react";
import type { WidgetConfig } from "@/hooks/useWidgets";
import { UsageChart } from "./WidgetCards/UsageChart";
import { QuickActions } from "./WidgetCards/QuickActions";
import { RecentActivity } from "./WidgetCards/RecentActivity";
import { ActivityHeatmap } from "./WidgetCards/ActivityHeatmap";
import { LiveFeed } from "./WidgetCards/LiveFeed";
import { TipOfTheDay } from "./WidgetCards/TipOfTheDay";

interface WidgetGridProps {
  widgets: WidgetConfig[];
  onReorder: (widgets: WidgetConfig[]) => void;
  activities: import("@/hooks/useDashboardData").ActivityItem[];
  loading: boolean;
}

const WIDGET_COMPONENTS: Record<string, React.ComponentType<any>> = {
  "usage-chart": UsageChart,
  "quick-actions": QuickActions,
  "recent-activity": RecentActivity,
  "activity-heatmap": ActivityHeatmap,
  "live-feed": LiveFeed,
  "tip-of-the-day": TipOfTheDay,
};

/**
 * Widget grid — renders enabled widgets in a reorderable list using framer-motion's
 * Reorder component. Each widget is wrapped in a drag handle so users can
 * rearrange them. The new order is passed to the parent for persistence.
 *
 * Layout: responsive CSS grid. Widgets span 1 or 2 columns based on their type.
 */

const SPAN_2 = new Set(["recent-activity", "activity-heatmap"]);

export function WidgetGrid({ widgets, onReorder, activities, loading }: WidgetGridProps) {
  return (
    <Reorder.Group
      axis="y"
      values={widgets}
      onReorder={onReorder}
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      as="div"
    >
      {widgets.map((widget) => {
        const Component = WIDGET_COMPONENTS[widget.id];
        if (!Component) return null;
        const span2 = SPAN_2.has(widget.id);

        return (
          <Reorder.Item
            key={widget.id}
            value={widget}
            as="div"
            className={`group relative ${span2 ? "lg:col-span-2" : ""}`}
            whileDrag={{ scale: 1.02, zIndex: 10 }}
          >
            {/* Drag handle */}
            <div className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex items-center gap-1 rounded-full border border-border/50 bg-muted/80 px-2 py-0.5 text-xs text-muted-foreground/70 backdrop-blur">
                <GripVertical className="h-3 w-3" />
                <span>Drag to reorder</span>
              </div>
            </div>

            {/* Render the widget component with appropriate props */}
            {widget.id === "recent-activity" ? (
              <Component activities={activities} loading={loading} />
            ) : (
              <Component />
            )}
          </Reorder.Item>
        );
      })}
    </Reorder.Group>
  );
}
