"use client";

/**
 * Phase 12 — LocaleProvider (client-side React context).
 *
 * Holds the resolved locale (passed from the server component layout) and
 * exposes a bound `t(key)` function via React context.
 *
 * HYDRATION INVARIANT:
 *   The locale is resolved on the SERVER (via `headers()` / `cookies()` in
 *   `src/app/layout.tsx`) and passed as a prop. The client provider receives
 *   the SAME value as the initial render — no client-side re-detection on
 *   first paint. This avoids server/client hydration mismatch.
 *
 *   The provider DOES allow programmatic updates (e.g. when the user clicks
 *   the LocaleSwitcher and the new locale comes back from the API). The
 *   update flow is:
 *     1. User clicks switcher → PATCH /api/dashboard/preferences/locale (or
 *        POST /api/locale for unauth) → returns the new locale.
 *     2. The switcher calls `setLocale(newLocale)` on the provider.
 *     3. The provider re-renders with the new locale. The `useTranslations()`
 *        hook returns a new bound `t` function that translates in the new
 *        locale.
 *     4. The HTML `lang` / `dir` attributes are updated by a small effect
 *        that mutates `document.documentElement`.
 *
 *   We do NOT reload the page on locale change — the React tree updates in
 *   place. The next full page load will resolve the locale from the cookie /
 *   DB preference (server-side) and the new initial value will match what the
 *   client already has.
 */

import * as React from "react";
import { translate } from "@/i18n";
import {
  isSupportedLocale,
  LOCALE_HTML_DIR,
  type Locale,
} from "@/lib/i18n/locales";

interface LocaleContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (next: Locale) => void;
  t: (key: string) => string;
}

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

export interface LocaleProviderProps {
  locale: Locale;
  children: React.ReactNode;
}

export function LocaleProvider({ locale: initialLocale, children }: LocaleProviderProps) {
  // Guard against an invalid locale being passed in (defense-in-depth — the
  // server should already have validated, but a misconfigured deployment
  // could pass a string that isn't a canonical Locale).
  const safeInitial: Locale = isSupportedLocale(initialLocale) ? initialLocale : "en";
  const [locale, setLocaleState] = React.useState<Locale>(safeInitial);

  // If the server-resolved locale changes (e.g. user navigated to a new page
  // and the server resolved a different locale from a fresh cookie), sync
  // the client state. This keeps server and client in lockstep without
  // requiring a full reload.
  // React to genuine authoritative `initialLocale` PROP changes only.
  // Do NOT include `locale` in the deps — that would re-trigger the effect
  // every time the user selects a new locale (via setLocale), which would
  // revert the local state back to `initialLocale` and undo the user's
  // choice. The effect depends ONLY on the authoritative prop.
  React.useEffect(() => {
    if (isSupportedLocale(initialLocale)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync of authoritative prop to local state (Phase 12 BLOCKER #1 fix); effect deps are [initialLocale] only so it does NOT cascade
      setLocaleState(initialLocale);
    }
  }, [initialLocale]);

  // Reflect the locale + dir onto <html> so CSS `[dir="rtl"]` selectors work
  // without a full reload, and so screen readers announce the right language.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    html.lang = locale;
    html.dir = LOCALE_HTML_DIR[locale];
  }, [locale]);

  const setLocale = React.useCallback((next: Locale) => {
    if (isSupportedLocale(next)) {
      setLocaleState(next);
    }
  }, []);

  const t = React.useCallback(
    (key: string) => translate(locale, key),
    [locale],
  );

  const value = React.useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir: LOCALE_HTML_DIR[locale],
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = React.useContext(LocaleContext);
  if (!ctx) {
    // Defensive default — should never happen because the root layout wraps
    // the app in <LocaleProvider>. Returning a sensible default keeps
    // components from crashing if they're rendered outside the provider
    // (e.g. in an isolated test).
    return {
      locale: "en",
      dir: "ltr",
      setLocale: () => {},
      t: (key: string) => translate("en", key),
    };
  }
  return ctx;
}

export function useTranslations(): (key: string) => string {
  const { t } = useLocale();
  return t;
}

export default LocaleProvider;
