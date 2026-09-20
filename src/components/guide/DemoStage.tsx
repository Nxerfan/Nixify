"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { GuideLocale } from "@/lib/guide/types";

/**
 * DemoStage — a compact animated visual that demonstrates the workflow
 * for the current guide step.
 *
 * Each scene is a small simulated UI fragment that animates to show
 * what happens during that step. It uses fake/demo data only — never
 * real API calls or real mutations.
 *
 * Scenes are keyed by the `scene` string from the GuideStep.
 * New scenes can be added by extending the scene renderers below.
 *
 * The DemoStage is intentionally compact (256px wide on desktop)
 * to fit beside the caption without overwhelming the layout.
 */
export function DemoStage({
  scene,
  typedText,
  locale,
}: {
  scene?: string;
  typedText: string;
  locale: GuideLocale;
}) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border border-gray-800/60 bg-gray-950/60">
      <AnimatePresence mode="wait">
        <motion.div
          key={scene}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="h-full w-full"
        >
          {renderScene(scene, typedText, locale)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function renderScene(scene: string | undefined, typedText: string, locale: GuideLocale): React.ReactNode {
  if (!scene) return <div className="flex h-full items-center justify-center text-xs text-gray-600" />;

  const isFa = locale === "fa";
  const placeholder = isFa ? "نمونه" : "Demo";

  // Generic scenes that apply to many guides
  switch (scene) {
    case "welcome":
    case "intro":
    case "whatIs":
      return (
        <div className="flex h-full items-center justify-center p-3">
          <div className="text-center">
            <div className="mb-2 flex justify-center">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20" />
            </div>
            <p className="text-[10px] text-gray-500">{placeholder}</p>
          </div>
        </div>
      );

    case "createKey":
    case "createBroadcast":
    case "createTemplate":
    case "createGroup":
    case "createRule":
    case "createEndpoint":
    case "addContact":
    case "addSuppression":
      return (
        <div className="flex h-full flex-col justify-center p-3 gap-2">
          <div className="h-6 rounded bg-gray-800/40 px-2 py-1 text-[10px] text-gray-400 flex items-center">
            {typedText || (isFa ? "نام را وارد کنید…" : "Enter name…")}
            {typedText && <span className="ml-0.5 animate-pulse">|</span>}
          </div>
          <div className="h-6 rounded bg-emerald-600/20 px-2 py-1 text-[10px] text-emerald-300 flex items-center justify-center">
            {isFa ? "ایجاد" : "Create"}
          </div>
        </div>
      );

    case "copySecret":
      return (
        <div className="flex h-full items-center justify-center p-3">
          <div className="text-center">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
              <code className="text-[10px] text-emerald-300" dir="ltr">mg_test_••••••</code>
            </div>
            <p className="mt-1 text-[10px] text-gray-500">{isFa ? "یک‌بار نمایش" : "Shown once"}</p>
          </div>
        </div>
      );

    case "selectEndpoint":
    case "selectAudience":
    case "selectTemplate":
      return (
        <div className="flex h-full flex-col justify-center p-3 gap-1">
          <div className="flex items-center gap-1.5 rounded px-2 py-1 text-[10px] text-gray-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {isFa ? "انتخاب شده" : "Selected"}
          </div>
          <div className="flex items-center gap-1.5 rounded px-2 py-1 text-[10px] text-gray-600">
            <span className="h-2 w-2 rounded-full bg-gray-600" />
            {isFa ? "گزینه دیگر" : "Another option"}
          </div>
        </div>
      );

    case "sendRequest":
    case "schedule":
    case "confirmImport":
      return (
        <div className="flex h-full items-center justify-center p-3">
          <motion.div
            className="rounded-lg bg-emerald-600 px-4 py-2 text-[10px] font-medium text-white"
            animate={{ scale: [1, 0.95, 1] }}
            transition={{ duration: 0.3, repeat: 1 }}
          >
            {isFa ? "ارسال" : "Send"}
          </motion.div>
        </div>
      );

    case "viewResponse":
    case "complete":
    case "logDetails":
    case "errorDetails":
    case "templatePreview":
    case "previewStage":
    case "livePreview":
      return (
        <div className="flex h-full flex-col p-3 gap-1">
          <div className="h-2 rounded bg-gray-800/40 w-3/4" />
          <div className="h-2 rounded bg-gray-800/40 w-1/2" />
          <div className="h-2 rounded bg-emerald-500/20 w-2/3" />
        </div>
      );

    default:
      // Generic animated scene
      return (
        <div className="flex h-full items-center justify-center p-3">
          <motion.div
            className="h-8 w-8 rounded-full border-2 border-emerald-400/30"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <div className="absolute top-0 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-emerald-400" />
          </motion.div>
        </div>
      );
  }
}
