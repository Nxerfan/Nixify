"use client";

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Play, Pause, ChevronLeft, ChevronRight, RotateCcw, Maximize2,
} from "lucide-react";
import Link from "next/link";
import { useTranslations, useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * CinematicWalkthrough — the premium visual walkthrough player.
 *
 * Redesigned for exceptional product quality. This player feels like a
 * high-end interactive product film built directly from the real Nixify UI.
 *
 * Design principles:
 *   - Large immersive stage with cinematic 16:9 aspect ratio
 *   - Smooth cross-fade scene transitions (not jarring cuts)
 *   - Elegant progress visualization with step dots
 *   - Floating glass-morphism control bar
 *   - Premium subtitle presentation with gradient backdrop
 *   - Better sync between visual action and subtitle
 *   - Chapter navigation with visual chapter strip
 *   - Better mobile player layout (stacked controls)
 *   - Full RTL support (arrows flip, layout mirrors)
 *   - Reduced-motion fallback (instant transitions, no Y movement)
 *   - Keyboard/focus accessibility (scoped, aria-live)
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
  caption: string;
  duration?: number;
  scene: string;
  typedText?: string;
}

export interface SceneRenderContext {
  scene: string;
  typedText: string;
  isPlaying: boolean;
  prefersReducedMotion: boolean;
}

export type SceneRenderer = (ctx: SceneRenderContext) => React.ReactNode;

interface CinematicWalkthroughProps {
  chapters: WalkthroughChapter[];
  routeKey: string;
  backHref: string;
  backLabel: string;
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
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Auto-advance with elapsed time tracking
  useEffect(() => {
    if (!isPlaying || !current) return;
    const dur = current.stepData.duration ?? 5000;

    timerRef.current = setTimeout(() => goNext(), dur);

    // Track elapsed time for the scrubber (update every 50ms for smoothness)
    if (!prefersReducedMotion) {
      elapsedRef.current = setInterval(() => {
        setElapsed(e => Math.min(e + 50, dur));
      }, 50);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [isPlaying, chapterIdx, stepIdx, goNext, current, prefersReducedMotion]);

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
    }, 45);
    return () => clearInterval(interval);
  }, [current?.stepData.typedText, chapterIdx, stepIdx, prefersReducedMotion]);

  // Keyboard nav — scoped to NOT hijack inputs, textareas, selects, buttons, links
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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

  // Step progress for the current chapter (dots)
  const currentChapterSteps = current.chapterData.steps;
  const stepDuration = current.stepData.duration ?? 5000;
  const stepProgress = isPlaying ? (elapsed / stepDuration) * 100 : 0;

  return (
    <div className="space-y-3" dir={dir}>
      {/* ─── Cinematic Stage ───────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card/80 shadow-2xl shadow-black/40">
        {/* Top overlay: chapter/step indicator + step dots */}
        <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
          {/* Left: chapter/step indicator */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {t("guide.chapter")} {chapterIdx + 1}/{chapters.length}
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground">
              {t("guide.step")} {stepIdx + 1}/{currentChapterSteps.length}
            </span>
          </div>

          {/* Right: step progress dots */}
          <div className="flex items-center gap-1.5">
            {currentChapterSteps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStepIdx(i)}
                className="group/dot relative h-1.5 rounded-full transition-all"
                style={{
                  width: i === stepIdx ? 24 : 6,
                  background: i < stepIdx
                    ? "rgb(16 185 129 / 0.6)"
                    : i === stepIdx
                      ? "rgb(16 185 129)"
                      : "rgb(75 85 99 / 0.5)",
                }}
                aria-label={`${t("guide.step")} ${i + 1}`}
              >
                {i === stepIdx && isPlaying && !prefersReducedMotion && (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-emerald-300/40"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: stepProgress / 100 }}
                    transition={{ duration: 0.05, ease: "linear" }}
                    style={{ transformOrigin: isRTL ? "right" : "left" }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Scene render area — larger, more immersive */}
        <div className="aspect-video w-full" style={{ minHeight: 380 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${chapterIdx}-${stepIdx}`}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="h-full w-full"
            >
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
                    <ScenePlaceholder scene={current.stepData.scene} typedText={typedText} />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom gradient + subtitle bar */}
        <div className="relative">
          {/* Gradient backdrop for subtitle legibility */}
          <div className="absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-gray-950/80 to-transparent pointer-events-none" />
          <div className="border-t border-border/60 bg-card/60 px-6 py-4 backdrop-blur-md">
            <div className="flex items-start gap-3">
              {/* Step number badge */}
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {stepIdx + 1}
              </span>
              <p
                className="flex-1 text-sm leading-relaxed text-foreground sm:text-base"
                aria-live="assertive"
              >
                {current.stepData.caption}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Control Bar ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Primary controls */}
        <div className="flex items-center gap-2">
          {/* Play/Pause — prominent */}
          <button
            onClick={() => setIsPlaying(p => !p)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95"
            aria-label={isPlaying ? t("guide.pause") : t("guide.play")}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span className="hidden sm:inline">{isPlaying ? t("guide.pause") : t("guide.play")}</span>
          </button>

          {/* Prev/Next — icon-only with hover bg */}
          <div className="flex items-center gap-1">
            <button
              onClick={goPrev}
              disabled={globalIdx === 0}
              className="rounded-xl border border-border p-2.5 text-muted-foreground transition-all hover:bg-border/40 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed active:scale-95"
              aria-label={t("guide.previous")}
            >
              <PrevArrow className="h-4 w-4" />
            </button>

            <button
              onClick={goNext}
              disabled={globalIdx === totalSteps - 1}
              className="rounded-xl border border-border p-2.5 text-muted-foreground transition-all hover:bg-border/40 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed active:scale-95"
              aria-label={t("guide.next")}
            >
              <NextArrow className="h-4 w-4" />
            </button>

            {/* Replay */}
            <button
              onClick={() => { setChapterIdx(0); setStepIdx(0); setIsPlaying(true); }}
              className="rounded-xl border border-border p-2.5 text-muted-foreground transition-all hover:bg-border/40 hover:text-foreground active:scale-95"
              aria-label={t("guide.replay")}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress bar — with step count */}
        <div className="flex flex-1 items-center gap-3">
          <div className="flex-1">
            <div className="h-1 overflow-hidden rounded-full bg-border/60">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
          <span className="text-[10px] font-medium tabular-nums text-muted-foreground/70">
            {globalIdx + 1}/{totalSteps}
          </span>
        </div>

        {/* Back to product — right-aligned, subtle */}
        <Link
          href={backHref}
          className="hidden items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground transition-all hover:bg-border/40 hover:text-foreground active:scale-95 sm:flex"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}

/**
 * Scene placeholder — fallback for guides that haven't shipped a real stage.
 */
function ScenePlaceholder({ scene, typedText }: { scene: string; typedText: string }) {
  return (
    <div className="space-y-2">
      {scene.includes("create") || scene.includes("add") ? (
        <>
          <div className="h-8 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground/70">
            {typedText || "..."}
            {typedText && <span className="ml-0.5 animate-pulse">|</span>}
          </div>
          <div className="h-8 rounded-lg bg-emerald-600/20 px-3 py-2 text-center text-xs text-emerald-700 dark:text-emerald-300">
            Create
          </div>
        </>
      ) : (
        <div className="space-y-1.5">
          <div className="h-3 rounded bg-border/40 w-3/4" />
          <div className="h-3 rounded bg-border/40 w-1/2" />
          <div className="h-3 rounded bg-emerald-500/20 w-2/3" />
        </div>
      )}
    </div>
  );
}
