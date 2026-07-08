"use client";

import { motion } from "framer-motion";
import { Zap, Mail, UserPlus, Key, Download, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EASE = [0.22, 1, 0.36, 1] as const;

const ACTIONS = [
  { label: "Send Test OTP", icon: Mail, color: "#34d399" },
  { label: "Invite User", icon: UserPlus, color: "#2dd4bf" },
  { label: "Copy API Key", icon: Key, color: "#6ee7b7" },
  { label: "Export Data", icon: Download, color: "#14b8a6" },
];

/**
 * Quick Actions widget — buttons for common tasks. Each button has a hover
 * glow + scale micro-interaction. "Copy API Key" copies a dummy key to clipboard.
 */

export function QuickActions() {
  const { toast } = useToast();

  const handleClick = (label: string) => {
    if (label === "Copy API Key") {
      navigator.clipboard.writeText("mg_live_demo_key_000000000000").catch(() => {});
      toast({ title: "Copied!", description: "API key copied to clipboard." });
    } else {
      toast({ title: label, description: "Action triggered (demo)." });
    }
  };

  return (
    <div className="rounded-xl border border-gray-800/40 bg-gray-950/40 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-medium text-gray-200">Quick Actions</h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((action, i) => (
          <motion.button
            key={action.label}
            onClick={() => handleClick(action.label)}
            className="flex items-center gap-2 rounded-lg border border-gray-800/40 bg-gray-900/30 px-3 py-2.5 text-sm text-gray-300 transition-colors hover:border-emerald-500/30 hover:bg-gray-800/40"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3, ease: EASE }}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            <action.icon className="h-4 w-4" style={{ color: action.color }} />
            <span className="truncate">{action.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
