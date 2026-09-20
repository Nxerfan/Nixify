"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import { CONSENT_KEY, setConsent } from "@/lib/consent";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * GDPR/CCPA cookie consent banner.
 * Shows on first visit, persists choice in localStorage.
 * Has "Accept" and "Decline" + link to Privacy Policy.
 *
 * Uses `setConsent()` from `@/lib/consent` so that the analytics consent
 * (`<ConsentAnalytics />`) updates in the SAME tab immediately (the native
 * `storage` event only fires in other tabs).
 */
export function CookieConsent() {
  const t = useTranslations();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      // Small delay so it doesn't flash on page load.
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleChoice = (choice: "accepted" | "declined") => {
    setConsent(choice);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <div className="flex flex-col gap-4 rounded-2xl border border-emerald-500/15 bg-[#060907]/95 p-5 backdrop-blur-xl sm:flex-row sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/15">
              <Cookie className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-300">
                {t("cookieConsent.message")}{" "}
                <Link href="/privacy" className="text-emerald-400 underline-offset-2 hover:underline">
                  {t("cookieConsent.privacyPolicy")}
                </Link>{" "}
                {t("cookieConsent.forDetails")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleChoice("declined")}
                className="text-gray-400 hover:text-gray-200"
              >
                {t("cookieConsent.decline")}
              </Button>
              <Button
                size="sm"
                onClick={() => handleChoice("accepted")}
                className="bg-emerald-600 text-white hover:bg-emerald-500"
              >
                {t("cookieConsent.accept")}
              </Button>
            </div>
            <button
              onClick={() => handleChoice("declined")}
              className="absolute right-2 top-2 text-gray-600 hover:text-gray-400 sm:hidden"
              aria-label={t("cookieConsent.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
