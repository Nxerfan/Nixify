"use client";

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Play, Pause, ChevronLeft, ChevronRight, RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useTranslations, useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * CinematicWalkthrough — the ultra-premium visual walkthrough player.
 *
 * Design language:
 *   - Floating glass-morphism stage with layered shadows + glow ring
 *   - Cinematic 16:9 stage with smooth cross-fade transitions
 *   - Floating control bar with glass blur
 *   - Premium step indicator with animated progress fill
 *   - Elegant subtitle with gradient backdrop
 *   - Smooth micro-interactions (hover, active, focus)
 *   - Full RTL support
 *   - Reduced-motion fallback
 *   - Keyboard/focus accessibility
 *
 * The walkthrough is purely visual — simulated/demo state only.
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

  useEffect(() => {
    if (!isPlaying || !current) return;
    const dur = current.stepData.duration ?? 5000;
    timerRef.current = setTimeout(() => goNext(), dur);
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
  const currentChapterSteps = current.chapterData.steps;
  const stepDuration = current.stepData.duration ?? 5000;
  const stepProgress = isPlaying ? (elapsed / stepDuration) * 100 : 0;

  return (
    <div className="space-y-4" dir={dir}>
      {/* ═══ Cinematic Stage — floating glass-morphism ═══ */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0.1 : 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        {/* Glow ring behind the stage */}
        <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-br from-emerald-500/20 via-transparent to-emerald-500/10 blur-sm" aria-hidden />
        
        {/* Stage container */}
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl shadow-black/50 ring-1 ring-border/30">
          {/* Top gradient overlay with chapter/step indicator */}
          <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/70 via-black/30 to-transparent">
            {/* Left: chapter/step */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {t("guide.chapter")} {chapterIdx + 1}
              </span>
              <span className="text-white/30">/</span>
              <span className="text-white/50">{chapters.length}</span>
              <span className="mx-1 text-white/20">·</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {t("guide.step")} {stepIdx + 1}
              </span>
              <span className="text-white/30">/</span>
              <span className="text-white/50">{currentChapterSteps.length}</span>
            </div>

            {/* Right: step progress dots — premium */}
            <div className="flex items-center gap-1.5">
              {currentChapterSteps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStepIdx(i)}
                  className="group/dot relative h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === stepIdx ? 32 : 6,
                    background: i < stepIdx
                      ? "rgba(16, 185, 129, 0.5)"
                      : i === stepIdx
                        ? "rgb(16, 185, 129)"
                        : "rgba(255, 255, 255, 0.2)",
                  }}
                  aria-label={`${t("guide.step")} ${i + 1}`}
                >
                  {i === stepIdx && isPlaying && !prefersReducedMotion && (
                    <motion.span
                      className="absolute inset-0 rounded-full bg-emerald-300/50"
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

          {/* Scene render area */}
          <div className="aspect-video w-full" style={{ minHeight: 400 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${chapterIdx}-${stepIdx}`}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.01 }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.5, ease: [0.22, 1, 0.36, 1] }}
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

          {/* Bottom: subtitle bar with premium gradient backdrop */}
          <div className="relative">
            <div className="absolute inset-x-0 -top-12 h-12 bg-gradient-to-t from-card via-card/80 to-transparent pointer-events-none" />
            <div className="relative border-t border-border/40 bg-card/80 px-6 py-4 backdrop-blur-xl">
              <div className="flex items-start gap-3">
                {/* Step number — glowing badge */}
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
                  {stepIdx + 1}
                </span>
                <p
                  className="flex-1 text-sm leading-relaxed text-foreground sm:text-[15px]"
                  aria-live="assertive"
                >
                  {current.stepData.caption}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ Floating Control Bar — glass-morphism ═══ */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0.1 : 0.4, delay: prefersReducedMotion ? 0 : 0.15 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        {/* Play/Pause — premium pill button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(p => !p)}
            className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30 active:scale-95"
            aria-label={isPlaying ? t("guide.pause") : t("guide.play")}
          >
            {/* Shine effect */}
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" aria-hidden />
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            <span className="hidden sm:inline">{isPlaying ? t("guide.pause") : t("guide.play")}</span>
          </button>

          {/* Navigation cluster */}
          <div className="flex items-center gap-1">
            <button
              onClick={goPrev}
              disabled={globalIdx === 0}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card/40 text-muted-foreground backdrop-blur-sm transition-all hover:border-emerald-500/30 hover:bg-card/60 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed active:scale-90"
              aria-label={t("guide.previous")}
            >
              <PrevArrow className="h-4 w-4" />
            </button>
            <button
              onClick={goNext}
              disabled={globalIdx === totalSteps - 1}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card/40 text-muted-foreground backdrop-blur-sm transition-all hover:border-emerald-500/30 hover:bg-card/60 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed active:scale-90"
              aria-label={t("guide.next")}
            >
              <NextArrow className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setChapterIdx(0); setStepIdx(0); setIsPlaying(true); }}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card/40 text-muted-foreground backdrop-blur-sm transition-all hover:border-emerald-500/30 hover:bg-card/60 hover:text-foreground active:scale-90"
              aria-label={t("guide.replay")}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Premium progress bar */}
        <div className="flex flex-1 items-center gap-3">
          <div className="group flex-1">
            <div className="relative h-2 overflow-hidden rounded-full bg-border/50">
              {/* Track background */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-border/30 to-border/10" />
              {/* Progress fill */}
              <motion.div
                className="relative h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Glow on the progress fill */}
                <div className="absolute inset-0 rounded-full bg-emerald-400/50 blur-sm" aria-hidden />
              </motion.div>
            </div>
          </div>
          <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
            {String(globalIdx + 1).padStart(2, '0')}
            <span className="text-muted-foreground/50"> / {String(totalSteps).padStart(2, '0')}</span>
          </span>
        </div>

        {/* Back link — subtle */}
        <Link
          href={backHref}
          className="hidden items-center gap-1.5 rounded-xl border border-border/60 px-4 py-2.5 text-sm text-muted-foreground backdrop-blur-sm transition-all hover:border-emerald-500/30 hover:bg-card/40 hover:text-foreground active:scale-95 sm:flex"
        >
          {backLabel}
        </Link>
      </motion.div>
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
