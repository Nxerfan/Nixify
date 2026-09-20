"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Play, Pause, ChevronLeft, ChevronRight, RotateCcw,
} from "lucide-react";
import { useTranslations, useLocale } from "@/lib/i18n/LocaleProvider";
import type { GuideDefinition, GuideChapter, GuideStep } from "@/lib/guide/types";
import { Spotlight } from "./Spotlight";
import { DemoStage } from "./DemoStage";

/**
 * WalkthroughShell — the reusable visual walkthrough player.
 *
 * Renders an immersive guide surface with:
 * - animated DemoStage showing simulated workflow
 * - synchronized localized captions
 * - spotlight overlay highlighting real UI elements
 * - progress bar + chapter indicator
 * - Play/Pause/Next/Previous/Replay controls
 *
 * State management is internal — the parent only passes the GuideDefinition
 * and open/close callbacks.
 *
 * Accessibility:
 * - keyboard navigation (Space=play/pause, ArrowLeft/Right=prev/next, Esc=close)
 * - aria-live for caption changes
 * - prefers-reduced-motion respected via framer-motion
 */

interface WalkthroughShellProps {
  guide: GuideDefinition;
  open: boolean;
  onClose: () => void;
}

interface FlatStep {
  chapterIndex: number;
  stepIndex: number;
  chapter: GuideChapter;
  step: GuideStep;
  globalIndex: number;
  totalSteps: number;
}

export function WalkthroughShell({ guide, open, onClose }: WalkthroughShellProps) {
  const t = useTranslations();
  const { locale, dir } = useLocale();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [typedText, setTypedText] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flatten all steps for global progress
  const flatSteps: FlatStep[] = [];
  let globalIdx = 0;
  for (let ci = 0; ci < guide.chapters.length; ci++) {
    for (let si = 0; si < guide.chapters[ci].steps.length; si++) {
      flatSteps.push({
        chapterIndex: ci,
        stepIndex: si,
        chapter: guide.chapters[ci],
        step: guide.chapters[ci].steps[si],
        globalIndex: globalIdx++,
        totalSteps: 0, // filled below
      });
    }
  }
  flatSteps.forEach((s) => (s.totalSteps = flatSteps.length));

  const current = flatSteps.find(
    (s) => s.chapterIndex === currentChapter && s.stepIndex === currentStep,
  );
  const totalSteps = flatSteps.length;
  const globalIndex = current?.globalIndex ?? 0;

  // Caption key: guide.{routeKey}.{chapterId}.{stepId}.caption
  const routeKey = guide.route.replace(/^\/dashboard\//, "").replace(/\//g, ".");
  const captionKey = current
    ? `guide.${routeKey}.${current.chapter.id}.${current.step.id}.caption`
    : "";

  const goNext = useCallback(() => {
    const chapter = guide.chapters[currentChapter];
    if (currentStep < chapter.steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else if (currentChapter < guide.chapters.length - 1) {
      setCurrentChapter((c) => c + 1);
      setCurrentStep(0);
    } else {
      setIsPlaying(false); // End of guide
    }
  }, [currentChapter, currentStep, guide]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    } else if (currentChapter > 0) {
      const prevChapter = guide.chapters[currentChapter - 1];
      setCurrentChapter((c) => c - 1);
      setCurrentStep(prevChapter.steps.length - 1);
    }
  }, [currentChapter, currentStep, guide]);

  // Auto-advance timer
  useEffect(() => {
    if (!isPlaying || !current) return;
    const duration = current.step.duration ?? 4000;
    timerRef.current = setTimeout(() => {
      goNext();
    }, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentChapter, currentStep, goNext]);

  // Typed text animation
  useEffect(() => {
    if (!current?.step.typedText) {
      // Use a microtask to avoid synchronous setState in effect
      Promise.resolve().then(() => setTypedText(""));
      return;
    }
    Promise.resolve().then(() => setTypedText(""));
    let i = 0;
    const text = current.step.typedText;
    const interval = setInterval(() => {
      if (i < text.length) {
        setTypedText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [current?.step.typedText, currentChapter, currentStep]);

  const replay = useCallback(() => {
    setCurrentChapter(0);
    setCurrentStep(0);
    setIsPlaying(true);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === "ArrowRight" && dir !== "rtl") goNext();
      else if (e.key === "ArrowLeft" && dir !== "rtl") goPrev();
      else if (e.key === "ArrowRight" && dir === "rtl") goPrev();
      else if (e.key === "ArrowLeft" && dir === "rtl") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, goNext, goPrev, dir]);

  if (!open || !current) return null;

  const progress = ((globalIndex + 1) / totalSteps) * 100;
  const isRTL = dir === "rtl";

  return (
    <>
      {/* Spotlight overlay */}
      {current.step.spotlight && (
        <Spotlight selector={current.step.spotlight} />
      )}

      {/* Guide surface */}
      <AnimatePresence>
        <motion.div
          className="fixed inset-x-0 bottom-0 z-50"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          role="dialog"
          aria-label={t("guide.aria.walkthrough")}
          aria-live="polite"
        >
          <div
            className="mx-auto max-w-5xl border-t border-emerald-500/20 bg-[#060907]/95 backdrop-blur-xl"
            style={{ direction: dir }}
          >
            {/* Progress bar */}
            <div className="h-1 bg-gray-800/40">
              <motion.div
                className="h-full bg-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Content */}
            <div className="flex items-start gap-4 p-4 sm:p-6">
              {/* Demo stage */}
              <div className="hidden sm:block w-64 shrink-0">
                <DemoStage
                  scene={current.step.scene}
                  typedText={typedText}
                  locale={locale}
                />
              </div>

              {/* Caption + controls */}
              <div className="flex-1 min-w-0">
                {/* Chapter indicator */}
                <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-medium text-emerald-400">
                    {t("guide.chapter")} {currentChapter + 1}/{guide.chapters.length}
                  </span>
                  <span>·</span>
                  <span>{t("guide.step")} {currentStep + 1}/{current.chapter.steps.length}</span>
                </div>

                {/* Caption */}
                <p
                  className="text-sm leading-relaxed text-gray-200 sm:text-base"
                  aria-live="assertive"
                >
                  {t(captionKey)}
                </p>

                {/* Mobile demo stage */}
                <div className="mt-3 sm:hidden">
                  <DemoStage
                    scene={current.step.scene}
                    typedText={typedText}
                    locale={locale}
                  />
                </div>

                {/* Controls */}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying((p) => !p)}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500"
                    aria-label={isPlaying ? t("guide.pause") : t("guide.play")}
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{isPlaying ? t("guide.pause") : t("guide.play")}</span>
                  </button>

                  <button
                    onClick={goPrev}
                    disabled={globalIndex === 0}
                    className="flex items-center gap-1 rounded-lg border border-gray-800/60 px-2.5 py-1.5 text-xs text-gray-400 transition hover:bg-gray-800/40 disabled:opacity-30"
                    aria-label={t("guide.previous")}
                  >
                    {isRTL ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                  </button>

                  <button
                    onClick={goNext}
                    disabled={globalIndex === totalSteps - 1}
                    className="flex items-center gap-1 rounded-lg border border-gray-800/60 px-2.5 py-1.5 text-xs text-gray-400 transition hover:bg-gray-800/40 disabled:opacity-30"
                    aria-label={t("guide.next")}
                  >
                    {isRTL ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>

                  <button
                    onClick={replay}
                    className="flex items-center gap-1 rounded-lg border border-gray-800/60 px-2.5 py-1.5 text-xs text-gray-400 transition hover:bg-gray-800/40"
                    aria-label={t("guide.replay")}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>

                  <div className="flex-1" />

                  <button
                    onClick={onClose}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 transition hover:text-gray-200"
                    aria-label={t("guide.close")}
                  >
                    <X className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t("guide.close")}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
