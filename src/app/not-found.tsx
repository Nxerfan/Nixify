"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Home, FileQuestion } from "lucide-react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * 404 page — premium styled, matches the dark-green theme.
 */

export default function NotFound() {
  const t = useTranslations();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ backgroundColor: "#0A0F0D" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="text-center"
      >
        <motion.div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
        >
          <FileQuestion className="h-8 w-8 text-emerald-400" />
        </motion.div>

        <h1 className="text-6xl font-bold text-gray-100">{t("errors.notFound.title")}</h1>
        <p className="mt-3 text-sm text-gray-500">
          {t("errors.notFound.subtitle")}
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.25)]"
        >
          <Home className="h-4 w-4" />
          {t("errors.notFound.backToHome")}
        </Link>
      </motion.div>
    </div>
  );
}
