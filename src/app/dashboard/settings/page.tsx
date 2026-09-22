"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft, User, Palette, Globe, Shield, CreditCard,
  Check, Sun, Moon, Monitor, Loader2, Mail, Phone, BadgeCheck,
  AlertCircle, ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTranslations, useLocale } from "@/lib/i18n/LocaleProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Ltr } from "@/lib/i18n/Ltr";
import { GuideBanner } from "@/components/guide/GuideBanner";
import { dispatchProfileUpdated } from "@/lib/profile-events";

/**
 * Settings page — a premium account control center.
 *
 * Sections:
 *   1. Account & Profile (real data, editable name/phone)
 *   2. Appearance (Light/Dark/System theme cards)
 *   3. Language (EN/FA via canonical LocaleSwitcher)
 *   4. Security (verified email + password reset link)
 *   5. Plan & Account Status (real plan, read-only)
 *
 * Navigation: section sidebar on desktop, stacked on mobile.
 */

type SectionId = "account" | "appearance" | "language" | "security" | "plan";

interface ProfileData {
  id: number;
  email: string;
  emailVerified: boolean;
  fullName: string | null;
  phoneNumber: string | null;
  plan: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const t = useTranslations();
  const { locale, dir } = useLocale();
  const isRTL = dir === "rtl";
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;
  const prefersReducedMotion = useReducedMotion();

  const [activeSection, setActiveSection] = React.useState<SectionId>("account");

  const sections: { id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "account", label: t("dashboard.settings.account"), icon: User },
    { id: "appearance", label: t("dashboard.settings.appearance"), icon: Palette },
    { id: "language", label: t("dashboard.settings.language"), icon: Globe },
    { id: "security", label: t("dashboard.settings.security"), icon: Shield },
    { id: "plan", label: t("dashboard.settings.plan"), icon: CreditCard },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8" dir={dir}>
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
          <BackArrow className="mr-1 h-4 w-4" /> {t("dashboard.nav.dashboard")}
        </Button>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t("dashboard.settings.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("dashboard.settings.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        {/* Section sidebar (desktop) */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            {sections.map((s) => {
              const Icon = s.icon;
              const isActive = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{s.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Mobile section tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 lg:hidden">
          {sections.map((s) => {
            const Icon = s.icon;
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground bg-muted/50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeSection === "account" && <AccountSection />}
          {activeSection === "appearance" && <AppearanceSection />}
          {activeSection === "language" && <LanguageSection />}
          {activeSection === "security" && <SecuritySection />}
          {activeSection === "plan" && <PlanSection />}
        </div>
      </div>

      {/* Guide banner */}
      <GuideBanner guideSlug="settings" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Account & Profile Section
 * ════════════════════════════════════════════════════════════════════════ */

function AccountSection() {
  const t = useTranslations();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [profile, setProfile] = React.useState<ProfileData | null>(null);
  const [fullName, setFullName] = React.useState("");
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/me");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        const u = data.user;
        setProfile(u);
        setFullName(u.fullName || "");
        setPhoneNumber(u.phoneNumber || "");
      } catch {
        if (!cancelled) toast({ title: t("dashboard.settings.profileLoadFailed"), variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast, t]);

  // Track dirty state — derived, not stored (avoids setState-in-effect)
  const dirty = React.useMemo(() => {
    if (!profile) return false;
    return fullName !== (profile.fullName || "") || phoneNumber !== (profile.phoneNumber || "");
  }, [fullName, phoneNumber, profile]);

  async function handleSave() {
    if (!dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phoneNumber }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfile(data.user);
      toast({ title: t("dashboard.settings.profileSaved") });
        dispatchProfileUpdated();
    } catch {
      toast({ title: t("dashboard.settings.profileSaveFailed"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>{t("dashboard.settings.account")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-emerald-500" />
          {t("dashboard.settings.account")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("dashboard.settings.accountDesc")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Full name */}
        <div className="space-y-1.5">
          <Label htmlFor="fullName">{t("dashboard.settings.fullName")}</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={100}
            disabled={saving}
          />
        </div>

        {/* Email (read-only) */}
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("dashboard.settings.email")}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="email"
              value={profile?.email || ""}
              readOnly
              disabled
              className="flex-1"
            />
            {profile?.emailVerified ? (
              <Badge variant="outline" className="shrink-0 gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                <BadgeCheck className="h-3 w-3" />
                {t("dashboard.settings.emailVerified")}
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0 gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3 w-3" />
                {t("dashboard.settings.emailNotVerified")}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("dashboard.settings.emailImmutable")}</p>
        </div>

        {/* Phone number */}
        <div className="space-y-1.5">
          <Label htmlFor="phoneNumber">{t("dashboard.settings.phoneNumber")}</Label>
          <Input
            id="phoneNumber"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder={t("dashboard.settings.phoneNumberPlaceholder")}
            maxLength={20}
            disabled={saving}
          />
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {saving ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                {t("dashboard.settings.saving")}
              </>
            ) : (
              t("dashboard.settings.saveProfile")
            )}
          </Button>
          {dirty && !saving && (
            <span className="text-xs text-amber-500">{t("dashboard.settings.unsavedChanges")}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Appearance Section (Light / Dark / System)
 * ════════════════════════════════════════════════════════════════════════ */

function AppearanceSection() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);


  // The mounted pattern is the documented next-themes approach for avoiding hydration mismatch.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const themes = [
    { id: "light", label: t("dashboard.settings.themeLight"), desc: t("dashboard.settings.themeLightDesc"), icon: Sun },
    { id: "dark", label: t("dashboard.settings.themeDark"), desc: t("dashboard.settings.themeDarkDesc"), icon: Moon },
    { id: "system", label: t("dashboard.settings.themeSystem"), desc: t("dashboard.settings.themeSystemDesc"), icon: Monitor },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-emerald-500" />
          {t("dashboard.settings.appearance")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("dashboard.settings.appearanceDesc")}</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {themes.map((th) => {
            const Icon = th.icon;
            const isActive = mounted && theme === th.id;
            return (
              <button
                key={th.id}
                onClick={() => setTheme(th.id)}
                className={`group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
                  isActive
                    ? "border-emerald-500 bg-emerald-500/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                {/* Preview swatch */}
                <div className="mb-3 flex gap-1.5">
                  <div className={`h-8 w-8 rounded ${th.id === "light" ? "bg-white border border-gray-300" : th.id === "dark" ? "bg-muted" : "bg-gradient-to-br from-white to-gray-900 border border-gray-300"}`} />
                  <div className="flex-1 space-y-1">
                    <div className={`h-2 w-full rounded ${th.id === "light" ? "bg-gray-200" : th.id === "dark" ? "bg-gray-700" : "bg-gradient-to-r from-gray-200 to-gray-700"}`} />
                    <div className={`h-2 w-2/3 rounded ${th.id === "light" ? "bg-gray-200" : th.id === "dark" ? "bg-gray-700" : "bg-gradient-to-r from-gray-200 to-gray-700"}`} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${isActive ? "text-emerald-500" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                    {th.label}
                  </span>
                  {isActive && (
                    <Check className="ml-auto h-4 w-4 text-emerald-500" />
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{th.desc}</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Language Section
 * ════════════════════════════════════════════════════════════════════════ */

function LanguageSection() {
  const t = useTranslations();
  const { locale } = useLocale();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-emerald-500" />
          {t("dashboard.settings.language")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("dashboard.settings.languageDesc")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current language display */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {locale === "fa" ? t("dashboard.settings.persian") : t("dashboard.settings.english")}
            </p>
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.localePreferenceHelp")}</p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Ltr>{locale === "fa" ? "fa" : "en"}</Ltr>
            {locale === "fa" ? "· RTL" : "· LTR"}
          </Badge>
        </div>
        {/* Locale switcher */}
        <LocaleSwitcher />
      </CardContent>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Security Section
 * ════════════════════════════════════════════════════════════════════════ */

function SecuritySection() {
  const t = useTranslations();
  const { toast } = useToast();
  const [sending, setSending] = React.useState(false);
  const [profile, setProfile] = React.useState<ProfileData | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile/me");
        if (res.ok) {
          const data = await res.json();
          setProfile(data.user);
        }
      } catch {}
    })();
  }, []);

  async function handlePasswordReset() {
    if (!profile?.email) return;
    setSending(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profile.email }),
      });
      if (!res.ok) throw new Error();
      toast({ title: t("dashboard.settings.resetLinkSent") });
    } catch {
      toast({ title: t("dashboard.settings.resetLinkFailed"), variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-500" />
          {t("dashboard.settings.security")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("dashboard.settings.securityDesc")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email verification status */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{profile?.email}</p>
            <p className="text-xs text-muted-foreground">{t("dashboard.settings.email")}</p>
          </div>
          {profile?.emailVerified ? (
            <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="h-3 w-3" />
              {t("dashboard.settings.emailVerifiedBadge")}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" />
              {t("dashboard.settings.emailNotVerifiedBadge")}
            </Badge>
          )}
        </div>

        {/* Password reset */}
        <div className="rounded-lg border border-border p-4">
          <div className="mb-2 flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-500" />
            <h4 className="text-sm font-semibold text-foreground">{t("dashboard.settings.passwordSecurity")}</h4>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">{t("dashboard.settings.passwordSecurityDesc")}</p>
          <Button
            onClick={handlePasswordReset}
            disabled={sending || !profile}
            variant="outline"
          >
            {sending ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                {t("dashboard.settings.saving")}
              </>
            ) : (
              t("dashboard.settings.sendResetLink")
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Plan & Account Status Section
 * ════════════════════════════════════════════════════════════════════════ */

function PlanSection() {
  const t = useTranslations();
  const { toast } = useToast();
  const [profile, setProfile] = React.useState<ProfileData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);

  const loadProfile = React.useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/profile/me");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfile(data.user);
    } catch {
      setLoadError(true);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => { loadProfile(); }, [loadProfile]);

  const planLabel = (plan: string) => {
    if (plan === "PRO") return t("dashboard.settings.planPro");
    if (plan === "MAX") return t("dashboard.settings.planMax");
    return t("dashboard.settings.planFree");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-emerald-500" />
          {t("dashboard.settings.plan")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("dashboard.settings.planDesc")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : loadError ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-sm text-amber-700 dark:text-amber-300">{t("dashboard.settings.profileLoadFailed")}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => loadProfile()}
            >
              {t("dashboard.settings.retry")}
            </Button>
          </div>
        ) : profile ? (
          <>
            {/* Current plan card — only rendered after a successful profile response */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">{t("dashboard.settings.currentPlan")}</p>
                <p className="text-lg font-bold text-foreground">{planLabel(profile.plan)}</p>
              </div>
              <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                <BadgeCheck className="h-3 w-3" />
                {t("dashboard.settings.planStatusActive")}
              </Badge>
            </div>

            {/* Pricing link */}
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
            >
              {t("dashboard.settings.viewPricing")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
