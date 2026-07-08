"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";
import Link from "next/link";

const EASE = [0.22, 1, 0.36, 1] as const;
const CONSENT_KEY = "mg_cookie_consent";

/**
 * GDPR/CCPA cookie consent banner.
 * Shows on first visit, persists choice in localStorage.
 * Has "Accept" and "Decline" + link to Privacy Policy.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      // Small delay so it doesn't flash on page load.
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  const handleChoice = (choice: "accepted" | "declined") => {
    localStorage.setItem(CONSENT_KEY, choice);
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
                We use cookies to enhance your experience and analyze site traffic.
                See our{" "}
                <Link href="/privacy" className="text-emerald-400 underline-offset-2 hover:underline">
                  Privacy Policy
                </Link>{" "}
                for details.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleChoice("declined")}
                className="text-gray-400 hover:text-gray-200"
              >
                Decline
              </Button>
              <Button
                size="sm"
                onClick={() => handleChoice("accepted")}
                className="bg-emerald-600 text-white hover:bg-emerald-500"
              >
                Accept
              </Button>
            </div>
            <button
              onClick={() => handleChoice("declined")}
              className="absolute right-2 top-2 text-gray-600 hover:text-gray-400 sm:hidden"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
