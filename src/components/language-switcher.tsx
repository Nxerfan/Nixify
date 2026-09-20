"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Public site language switcher.
 *
 * Uses the existing canonical locale system (LocaleProvider context) and
 * persists the user's choice via the `/api/locale` cookie endpoint + the
 * `mg_locale` first-party cookie. The server-side `resolveServerLocale()`
 * reads this cookie on the next page load.
 *
 * Desktop: a compact globe icon button with a dropdown.
 * Mobile: rendered inside the mobile menu (the parent controls placement).
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function changeLocale(next: Locale) {
    setLocale(next);
    setOpen(false);
    // Persist to the mg_locale cookie via the public locale API so the
    // server-side resolver picks it up on the next full page load.
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
    } catch {
      // best-effort — the in-memory locale update still works for this session
    }
  }

  const options: { value: Locale; label: string; flag: string }[] = [
    { value: "en", label: "English", flag: "EN" },
    { value: "fa", label: "فارسی", flag: "FA" },
  ];

  const current = options.find((o) => o.value === locale) ?? options[0];

  if (compact) {
    // Compact mode — for mobile menu: render as a row of buttons.
    return (
      <div className="flex items-center gap-2 py-2">
        <Globe className="h-4 w-4 text-gray-500" />
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => changeLocale(opt.value)}
            className={`rounded-md px-2.5 py-1 text-sm transition-colors ${
              locale === opt.value
                ? "bg-emerald-500/10 text-emerald-300 font-medium"
                : "text-gray-400 hover:bg-gray-800/40 hover:text-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-gray-400 transition-colors hover:bg-gray-800/40 hover:text-gray-100"
        aria-label="Language switcher"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{current.flag}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-xl border border-gray-800/60 bg-[#060907]/95 p-1 backdrop-blur-xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => changeLocale(opt.value)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                locale === opt.value
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "text-gray-400 hover:bg-gray-800/40 hover:text-gray-200"
              }`}
            >
              <span>{opt.label}</span>
              {locale === opt.value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
