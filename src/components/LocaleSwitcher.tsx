"use client";

/**
 * Phase 12 — LocaleSwitcher component.
 *
 * A small dropdown menu with two options: "English" and "فارسی".
 *
 * For AUTHENTICATED users: PATCHes `/api/dashboard/preferences/locale` and
 * updates the LocaleProvider. The choice is persisted on the User row +
 * the `mg_locale` cookie (both set by the API).
 *
 * For UNAUTHENTICATED users: POSTs to `/api/locale` which sets the
 * `mg_locale` cookie. The provider is updated; the next full page load will
 * resolve the locale from the cookie server-side.
 *
 * Keyboard accessible:
 *   - The trigger button has `aria-label` + `aria-haspopup="menu"`.
 *   - The dropdown supports arrow-key navigation (shadcn/ui default).
 *   - The current locale is marked `aria-current="true"`.
 *   - Screen-reader text via `sr-only` describes the menu's purpose.
 *
 * Service names (Verify / Send / Broadcast / etc.) are NOT translated — only
 * UI shell strings use the translation dictionary.
 */

import * as React from "react";
import { Languages, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useLocale, useTranslations } from "@/lib/i18n/LocaleProvider";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/locales";

const LOCALE_LABELS: Record<Locale, { english: string; native: string }> = {
  en: { english: "English", native: "English" },
  fa: { english: "Persian", native: "فارسی" },
};

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  const t = useTranslations();
  const { toast } = useToast();
  const [pending, setPending] = React.useState<Locale | null>(null);

  async function applyLocale(next: Locale) {
    if (next === locale || pending) return;
    setPending(next);
    try {
      // Try the authenticated endpoint first. If it returns 401, fall back to
      // the unauthenticated cookie-set endpoint. This keeps the component
      // simple for callers who don't know whether the user is logged in.
      const authedRes = await fetch("/api/dashboard/preferences/locale", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      if (authedRes.status === 401) {
        // Unauthenticated — use the cookie-set endpoint.
        const unauthRes = await fetch("/api/locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: next }),
        });
        if (!unauthRes.ok) {
          throw new Error(`Locale update failed: ${unauthRes.status}`);
        }
      } else if (!authedRes.ok) {
        throw new Error(`Locale update failed: ${authedRes.status}`);
      }

      // Update the client-side provider. The HTML lang/dir will be updated
      // by the provider's effect.
      setLocale(next);
    } catch {
      toast({
        title: t("errors.generic"),
        description: t("errors.networkError"),
        variant: "destructive",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={t("locale.switcher.changeLanguage")}
          aria-haspopup="menu"
          disabled={pending !== null}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Languages className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="sr-only">{t("locale.switcher.title")}</span>
          <span aria-hidden="true" className="text-sm font-medium">
            {LOCALE_LABELS[locale].native}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[10rem]"
        role="menu"
        aria-label={t("locale.switcher.title")}
      >
        <DropdownMenuLabel>{t("locale.switcher.changeLanguage")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LOCALES.map((loc) => {
          const labels = LOCALE_LABELS[loc];
          const isActive = loc === locale;
          return (
            <DropdownMenuItem
              key={loc}
              role="menuitemradio"
              aria-checked={isActive}
              aria-current={isActive ? "true" : undefined}
              onSelect={(e) => {
                e.preventDefault();
                void applyLocale(loc);
              }}
              className="flex items-center justify-between gap-2 cursor-pointer"
            >
              <span className="flex flex-col items-start">
                <span className="text-sm">{labels.native}</span>
                <span className="text-xs text-muted-foreground">{labels.english}</span>
              </span>
              {isActive && <Check className="h-4 w-4" aria-hidden="true" />}
              {pending === loc && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LocaleSwitcher;
