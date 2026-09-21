"use client";

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Play, Pause, ChevronLeft, ChevronRight, RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useTranslations, useLocale } from "@/lib/i18n/LocaleProvider";
import type { GuideStep } from "@/lib/guide/types";

/**
 * CinematicWalkthrough — the premium visual walkthrough player.
 *
 * Features:
 * - Large visual stage showing the feature-specific DemoScene
 * - Synchronized localized subtitles
 * - Play/Pause/Previous/Next/Replay controls
 * - Chapter/step progress bar
 * - Timeline scrubber
 * - Keyboard navigation (Space, Arrows, Escape)
 * - prefers-reduced-motion runtime handling
 * - RTL-aware layout and arrow direction
 *
 * The walkthrough is purely visual — it uses simulated/demo state only
 * and never calls real APIs or mutates production data.
 */

export interface WalkthroughChapter {
  id: string;
  title: string;
  steps: WalkthroughStep[];
}

export interface WalkthroughStep {
  id: string;
  caption: string;       // Full localized caption text
  duration?: number;     // Auto-advance ms (0 = manual)
  scene: string;        // Scene renderer key
  typedText?: string;   // Text to visually type
}

/**
 * Render context handed to a route-specific scene renderer.
 *
 * Route-specific stages consume this to render the right simulated UI
 * fragment for the current step. The `typedText` field carries the typing
 * animation payload (already animated by the shell) so the stage can show
 * the in-progress string without re-implementing the typing logic.
 */
export interface SceneRenderContext {
  scene: string;
  typedText: string;
  isPlaying: boolean;
  prefersReducedMotion: boolean;
}

/**
 * Optional scene renderer. If provided, it fully replaces the generic
 * placeholder for every step. Returning null/undefined falls back to the
 * placeholder for that specific step (useful during incremental migration).
 */
export type SceneRenderer = (ctx: SceneRenderContext) => React.ReactNode;

interface CinematicWalkthroughProps {
  chapters: WalkthroughChapter[];
  routeKey: string;       // For i18n key construction
  backHref: string;       // Return to product link
  backLabel: string;     // Return CTA text
  /**
   * Optional route-specific scene renderer. When provided, the walkthrough
   * delegates stage rendering to this callback instead of the generic
   * placeholder. The callback receives the active scene key + typing text.
   */
  renderScene?: SceneRenderer;
}

export function CinematicWalkthrough({
  chapters,
  routeKey,
  backHref,
  backLabel,
  renderScene,
}: CinematicWalkthroughProps) {
  const t = useTranslations();
  const { dir } = useLocale();
  const prefersReducedMotion = useReducedMotion();
  const [isPlaying, setIsPlaying] = useState(false);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [typedText, setTypedText] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flatten steps for global progress
  const allSteps: { chapter: number; step: number; chapterData: WalkthroughChapter; stepData: WalkthroughStep; global: number }[] = [];
  for (let ci = 0; ci < chapters.length; ci++) {
    for (let si = 0; si < chapters[ci].steps.length; si++) {
      allSteps.push({
        chapter: ci, step: si,
        chapterData: chapters[ci],
        stepData: chapters[ci].steps[si],
        global: allSteps.length,
      });
    }
  }
  const totalSteps = allSteps.length;
  const current = allSteps.find(s => s.chapter === chapterIdx && s.step === stepIdx);
  const globalIdx = current?.global ?? 0;
  const progress = ((globalIdx + 1) / totalSteps) * 100;
  const isRTL = dir === "rtl";

  const goNext = useCallback(() => {
    const ch = chapters[chapterIdx];
    if (stepIdx < ch.steps.length - 1) {
      setStepIdx(s => s + 1);
    } else if (chapterIdx < chapters.length - 1) {
      setChapterIdx(c => c + 1);
      setStepIdx(0);
    } else {
      setIsPlaying(false);
    }
  }, [chapterIdx, stepIdx, chapters]);

  const goPrev = useCallback(() => {
    if (stepIdx > 0) {
      setStepIdx(s => s - 1);
    } else if (chapterIdx > 0) {
      const prevCh = chapters[chapterIdx - 1];
      setChapterIdx(c => c - 1);
      setStepIdx(prevCh.steps.length - 1);
    }
  }, [chapterIdx, stepIdx, chapters]);

  // Auto-advance
  useEffect(() => {
    if (!isPlaying || !current) return;
    const dur = current.stepData.duration ?? 5000;
    timerRef.current = setTimeout(() => goNext(), dur);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, chapterIdx, stepIdx, goNext, current]);

  // Typed text animation (respects reduced motion)
  useEffect(() => {
    if (!current?.stepData.typedText) {
      Promise.resolve().then(() => setTypedText(""));
      return;
    }
    const text = current.stepData.typedText;
    if (prefersReducedMotion) {
      Promise.resolve().then(() => setTypedText(text));
      return;
    }
    Promise.resolve().then(() => setTypedText(""));
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setTypedText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 40);
    return () => clearInterval(interval);
  }, [current?.stepData.typedText, chapterIdx, stepIdx, prefersReducedMotion]);

  // Keyboard nav — scoped to NOT hijack inputs, textareas, selects, buttons, links
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept if focus is inside an interactive element
      const target = e.target as HTMLElement;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" ||
            tag === "button" || tag === "a" || target.isContentEditable ||
            target.getAttribute("role") === "button" || target.getAttribute("role") === "link") {
          return;
        }
      }
      if (e.key === " ") { e.preventDefault(); setIsPlaying(p => !p); }
      else if (e.key === "ArrowRight" && !isRTL) goNext();
      else if (e.key === "ArrowLeft" && !isRTL) goPrev();
      else if (e.key === "ArrowRight" && isRTL) goPrev();
      else if (e.key === "ArrowLeft" && isRTL) goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, isRTL]);

  if (!current) return null;

  const PrevArrow = isRTL ? ChevronRight : ChevronLeft;
  const NextArrow = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-4" dir={dir}>
      {/* Stage */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-800/60 bg-gray-950/60">
        {/* Chapter/step indicator */}
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2 text-xs text-gray-500">
          <span className="font-medium text-emerald-400">
            {t("guide.chapter")} {chapterIdx + 1}/{chapters.length}
          </span>
          <span>·</span>
          <span>{t("guide.step")} {stepIdx + 1}/{current.chapterData.steps.length}</span>
        </div>

        {/* Scene render area */}
        <div className="aspect-video w-full" style={{ minHeight: 320 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${chapterIdx}-${stepIdx}`}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
              className="h-full w-full"
            >
              {/* Route-specific scene if provided; otherwise the generic placeholder. */}
              {renderScene ? (
                renderScene({
                  scene: current.stepData.scene,
                  typedText,
                  isPlaying,
                  prefersReducedMotion: prefersReducedMotion ?? false,
                })
              ) : (
                <div className="flex h-full items-center justify-center p-6">
                  <div className="w-full max-w-md space-y-3">
                    {/* Simulated UI fragment based on scene key */}
                    <ScenePlaceholder scene={current.stepData.scene} typedText={typedText} />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Subtitle bar */}
        <div className="border-t border-gray-800/60 bg-gray-950/80 px-6 py-4 backdrop-blur-sm">
          <p
            className="text-sm leading-relaxed text-gray-200 sm:text-base"
            aria-live="assertive"
          >
            {current.stepData.caption}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsPlaying(p => !p)}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
          aria-label={isPlaying ? t("guide.pause") : t("guide.play")}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          <span>{isPlaying ? t("guide.pause") : t("guide.play")}</span>
        </button>

        <button
          onClick={goPrev}
          disabled={globalIdx === 0}
          className="rounded-xl border border-gray-800/60 p-2.5 text-gray-400 transition hover:bg-gray-800/40 disabled:opacity-30"
          aria-label={t("guide.previous")}
        >
          <PrevArrow className="h-4 w-4" />
        </button>

        <button
          onClick={goNext}
          disabled={globalIdx === totalSteps - 1}
          className="rounded-xl border border-gray-800/60 p-2.5 text-gray-400 transition hover:bg-gray-800/40 disabled:opacity-30"
          aria-label={t("guide.next")}
        >
          <NextArrow className="h-4 w-4" />
        </button>

        <button
          onClick={() => { setChapterIdx(0); setStepIdx(0); setIsPlaying(true); }}
          className="rounded-xl border border-gray-800/60 p-2.5 text-gray-400 transition hover:bg-gray-800/40"
          aria-label={t("guide.replay")}
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        {/* Progress bar */}
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-800/60">
            <motion.div
              className="h-full rounded-full bg-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
            />
          </div>
        </div>

        {/* Back to product */}
        <Link
          href={backHref}
          className="hidden items-center gap-1.5 rounded-xl border border-gray-800/60 px-4 py-2.5 text-sm text-gray-400 transition hover:bg-gray-800/40 hover:text-gray-200 sm:flex"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}

/**
 * Scene placeholder — will be replaced by route-specific scene renderers.
 * For now shows a minimal simulated UI based on the scene key.
 */
function ScenePlaceholder({ scene, typedText }: { scene: string; typedText: string }) {
  return (
    <div className="space-y-2">
      {scene.includes("create") || scene.includes("add") ? (
        <>
          <div className="h-8 rounded-lg border border-gray-800/60 bg-gray-900/40 px-3 py-2 text-xs text-gray-500">
            {typedText || "..."}
            {typedText && <span className="ml-0.5 animate-pulse">|</span>}
          </div>
          <div className="h-8 rounded-lg bg-emerald-600/20 px-3 py-2 text-center text-xs text-emerald-300">
            Create
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <div className="h-3 rounded bg-gray-800/40 w-3/4" />
          <div className="h-3 rounded bg-gray-800/40 w-1/2" />
          <div className="h-3 rounded bg-emerald-500/20 w-2/3" />
        </div>
      )}
    </div>
  );
}
