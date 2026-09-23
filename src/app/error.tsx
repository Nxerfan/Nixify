"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Route-level error boundary — catches errors in any route segment below it.
 * Shows a premium-styled error page with retry + home actions.
 */

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    // Log to console (production logger would ship to Sentry/Axiom).
    console.error("[error-boundary]", error.message, error.digest);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ backgroundColor: "#0A0F0D" }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="w-full max-w-md text-center"
      >
        <motion.div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
        >
          <AlertTriangle className="h-8 w-8 text-amber-400" />
        </motion.div>

        <h1 className="text-2xl font-bold text-foreground">{t("errors.boundary.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground/70">
          {t("errors.boundary.subtitle")}
        </p>

        {error.digest && (
          <p className="mt-4 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground/50" dir="ltr">
            {t("errors.boundary.errorId")} {error.digest}
          </p>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.25)]"
          >
            <RefreshCw className="h-4 w-4" />
            {t("errors.boundary.tryAgain")}
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-border/40 hover:text-white"
          >
            <Home className="h-4 w-4" />
            {t("errors.boundary.home")}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
