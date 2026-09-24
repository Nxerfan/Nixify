"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "@/lib/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/locales";
import { Ltr } from "@/lib/i18n/Ltr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  Rocket,
  KeyRound,
  Send,
  ShieldCheck,
  PartyPopper,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingProgress {
  stepApiKeyCreated: boolean;
  stepOtpSent: boolean;
  stepOtpVerified: boolean;
  completedAt: string | null;
  completed: boolean;
}

type StepId = "welcome" | "api-key" | "send-otp" | "verify-otp" | "completion";

const STEPS: { id: StepId; icon: typeof Rocket }[] = [
  { id: "welcome", icon: Rocket },
  { id: "api-key", icon: KeyRound },
  { id: "send-otp", icon: Send },
  { id: "verify-otp", icon: ShieldCheck },
  { id: "completion", icon: PartyPopper },
];

/**
 * Phase 19 — Developer onboarding flow.
 *
 * 5-step guided activation:
 *   1. Welcome
 *   2. Create first API key (sandbox mg_test_)
 *   3. Send first sandbox OTP
 *   4. Verify sandbox OTP
 *   5. Completion / next steps
 *
 * Progress is tracked server-side (durable PostgreSQL). The flow self-heals:
 * each progress fetch reconciles cached flags against real state. A step is
 * marked complete ONLY when its real precondition is met — clicking a button
 * does not advance progress.
 *
 * Accessibility:
 *   - Semantic step navigation with `aria-current="step"`.
 *   - Keyboard support: arrow keys move between steps; Enter activates.
 *   - Visible focus rings on all interactive elements.
 *   - Clear validation errors with `role="alert"`.
 *   - Accessible progress state via `aria-label` on the step list.
 *   - No color-only status indication (icons + text labels).
 *
 * EN/FA: full localization. Technical values (API keys, OTP codes, URLs) are
 * wrapped in <Ltr> so they render LTR inside RTL Persian text.
 */
export default function GettingStartedPage() {
  const router = useRouter();
  const t = useTranslations();
  const { locale, dir } = useLocale();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [activeStep, setActiveStep] = useState<StepId>("welcome");
  const [loading, setLoading] = useState(true);
  const stepListRef = useRef<HTMLOListElement>(null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  const fetchProgress = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/progress");
      if (res.status === 401) {
        router.push("/login?next=/dashboard/getting-started");
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setProgress(data.progress);
      // Auto-advance to the first incomplete step.
      if (!data.progress.completed) {
        if (!data.progress.stepApiKeyCreated) setActiveStep("api-key");
        else if (!data.progress.stepOtpSent) setActiveStep("send-otp");
        else if (!data.progress.stepOtpVerified) setActiveStep("verify-otp");
        else setActiveStep("completion");
      } else {
        setActiveStep("completion");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProgress();
  }, [fetchProgress]);

  // Keyboard navigation for the step list (arrow keys + Home/End).
  const handleStepKeydown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(idx + 1, STEPS.length - 1);
      stepRefs.current[next]?.focus();
      setActiveStep(STEPS[next].id);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(idx - 1, 0);
      stepRefs.current[prev]?.focus();
      setActiveStep(STEPS[prev].id);
    } else if (e.key === "Home") {
      e.preventDefault();
      stepRefs.current[0]?.focus();
      setActiveStep(STEPS[0].id);
    } else if (e.key === "End") {
      e.preventDefault();
      stepRefs.current[STEPS.length - 1]?.focus();
      setActiveStep(STEPS[STEPS.length - 1].id);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label={t("common.buttons.loading")} />
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Unable to load onboarding progress.</p>
      </div>
    );
  }

  const stepStatus = (step: StepId): "completed" | "inProgress" | "notStarted" => {
    if (step === "welcome" || step === "completion") {
      return step === "completion" && progress.completed ? "completed" : "notStarted";
    }
    const flag =
      step === "api-key" ? progress.stepApiKeyCreated :
      step === "send-otp" ? progress.stepOtpSent :
      step === "verify-otp" ? progress.stepOtpVerified : false;
    if (flag) return "completed";
    if (STEPS.findIndex((s) => s.id === step) === STEPS.findIndex((s) => s.id === activeStep)) return "inProgress";
    return "notStarted";
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8" dir={dir}>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{t("dashboard.onboarding.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground/70">{t("dashboard.onboarding.subtitle")}</p>
      </header>

      {/* Semantic step navigation with accessible progress state */}
      <nav aria-label={t("dashboard.onboarding.title")}>
        <ol
          ref={stepListRef}
          className="mb-8 flex flex-wrap gap-2"
          role="list"
          aria-label={`${t("dashboard.onboarding.step")} 1 ${t("dashboard.onboarding.of")} ${STEPS.length}`}
        >
          {STEPS.map((step, idx) => {
            const status = stepStatus(step.id);
            const Icon = step.icon;
            const StepIcon = status === "completed" ? CheckCircle2 : Circle;
            const isCurrent = activeStep === step.id;
            return (
              <li key={step.id} ref={(el) => { stepRefs.current[idx] = el; }}>
                <button
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  onKeyDown={(e) => handleStepKeydown(e, idx)}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`${t("dashboard.onboarding.step")} ${idx + 1}: ${t(`dashboard.onboarding.${step.id === "api-key" ? "apiKeyTitle" : step.id === "send-otp" ? "otpSendTitle" : step.id === "verify-otp" ? "otpVerifyTitle" : step.id === "welcome" ? "welcomeTitle" : "completionTitle"}`)} — ${status === "completed" ? t("dashboard.onboarding.completed") : status === "inProgress" ? t("dashboard.onboarding.inProgress") : t("dashboard.onboarding.notStarted")}`}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isCurrent
                      ? "border-emerald-500/40 bg-emerald-500/5 text-foreground"
                      : "border-border/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <StepIcon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      status === "completed" && "text-emerald-600 dark:text-emerald-400",
                    )}
                    aria-hidden
                  />
                  <span className="hidden sm:inline">
                    {t(`dashboard.onboarding.${step.id === "api-key" ? "apiKeyTitle" : step.id === "send-otp" ? "otpSendTitle" : step.id === "verify-otp" ? "otpVerifyTitle" : step.id === "welcome" ? "welcomeTitle" : "completionTitle"}`)}
                  </span>
                  <span className="sm:hidden">{idx + 1}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step content */}
      {activeStep === "welcome" && (
        <WelcomeStep onNext={() => setActiveStep("api-key")} />
      )}
      {activeStep === "api-key" && (
        <ApiKeyStep
          locale={locale}
          alreadyComplete={progress.stepApiKeyCreated}
          onProgressUpdate={setProgress}
          onNext={() => setActiveStep("send-otp")}
          onBack={() => setActiveStep("welcome")}
        />
      )}
      {activeStep === "send-otp" && (
        <SendOtpStep
          locale={locale}
          alreadyComplete={progress.stepOtpSent}
          onProgressUpdate={setProgress}
          onNext={() => setActiveStep("verify-otp")}
          onBack={() => setActiveStep("api-key")}
        />
      )}
      {activeStep === "verify-otp" && (
        <VerifyOtpStep
          locale={locale}
          alreadyComplete={progress.stepOtpVerified}
          onProgressUpdate={setProgress}
          onNext={() => setActiveStep("completion")}
          onBack={() => setActiveStep("send-otp")}
        />
      )}
      {activeStep === "completion" && (
        <CompletionStep onDone={() => router.push("/dashboard")} />
      )}

      <div className="mt-8 text-center">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
          {t("dashboard.onboarding.skipToDashboard")}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const t = useTranslations();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          {t("dashboard.onboarding.welcomeTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("dashboard.onboarding.welcomeBody")}
        </p>
        <Button onClick={onNext} className="gap-2">
          {t("dashboard.onboarding.continue")}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Step 2: API key ──────────────────────────────────────────────────────

function ApiKeyStep({
  locale,
  alreadyComplete,
  onProgressUpdate,
  onNext,
  onBack,
}: {
  locale: Locale;
  alreadyComplete: boolean;
  onProgressUpdate: (p: OnboardingProgress) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const t = useTranslations();
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState(alreadyComplete);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/create-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: t("dashboard.onboarding.apiKeyName") }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(t("dashboard.onboarding.apiKeyQuotaError"));
        return;
      }
      if (data.key) {
        setNewKey(data.key);
      } else if (data.existing) {
        setExisting(true);
      }
      if (data.progress) onProgressUpdate(data.progress);
    } catch {
      setError(t("dashboard.onboarding.apiKeyQuotaError"));
    } finally {
      setCreating(false);
    }
  }

  async function handleCopy() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          {t("dashboard.onboarding.apiKeyTitle")}
        </CardTitle>
        <CardDescription>{t("dashboard.onboarding.apiKeyBody")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {error}
          </div>
        )}

        {newKey ? (
          <div className="space-y-3">
            <Label>{t("dashboard.onboarding.apiKeyCreated")}</Label>
            <code dir="ltr" className="block rounded-md border border-border/60 bg-muted px-3 py-2 font-mono text-xs break-all">
              <Ltr>{newKey}</Ltr>
            </code>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                {copied ? t("dashboard.onboarding.apiKeyCopied") : t("dashboard.onboarding.apiKeyCopyButton")}
              </Button>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("dashboard.onboarding.apiKeyCopyWarning")}
            </p>
            <Button onClick={onNext} className="gap-2">
              {t("dashboard.onboarding.apiKeyDoneButton")}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </Button>
          </div>
        ) : existing ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              {t("dashboard.onboarding.apiKeyExisting")}
            </p>
            <Button onClick={onNext} className="gap-2">
              {t("dashboard.onboarding.next")}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </Button>
          </div>
        ) : (
          <Button onClick={handleCreate} disabled={creating} className="gap-2">
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <KeyRound className="h-4 w-4" aria-hidden />
            )}
            {creating ? t("dashboard.onboarding.apiKeyCreating") : t("dashboard.onboarding.apiKeyCreateButton")}
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {t("dashboard.onboarding.back")}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Step 3: Send OTP ─────────────────────────────────────────────────────

function SendOtpStep({
  locale,
  alreadyComplete,
  onProgressUpdate,
  onNext,
  onBack,
}: {
  locale: Locale;
  alreadyComplete: boolean;
  onProgressUpdate: (p: OnboardingProgress) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [sending, setSending] = useState(false);
  const [sandboxCode, setSandboxCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!email.trim() || !apiKey.trim() || sending) return;
    setSending(true);
    setError(null);
    setSandboxCode(null);
    try {
      const res = await fetch("/api/v1/otp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ email: email.trim(), purpose: "signup" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(t("dashboard.onboarding.otpSendError"));
        return;
      }
      // Sandbox mode returns the code in the response.
      if (data.code) {
        setSandboxCode(data.code);
      }
      // Mark the step complete — the real OTP row now exists.
      const markRes = await fetch("/api/onboarding/mark-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "otpSent" }),
      });
      if (markRes.ok) {
        const markData = await markRes.json();
        if (markData.progress) onProgressUpdate(markData.progress);
      }
    } catch {
      setError(t("dashboard.onboarding.otpSendError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          {t("dashboard.onboarding.otpSendTitle")}
        </CardTitle>
        <CardDescription>{t("dashboard.onboarding.otpSendBody")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="onboarding-api-key">{t("dashboard.onboarding.apiKeyCreated")}</Label>
          <Input
            id="onboarding-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="mg_test_…"
            dir="ltr"
            className="font-mono text-xs"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="onboarding-email">{t("dashboard.onboarding.otpSendEmailLabel")}</Label>
          <Input
            id="onboarding-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("dashboard.onboarding.otpSendEmailPlaceholder")}
            dir="ltr"
          />
        </div>

        <Button onClick={handleSend} disabled={sending || !email.trim() || !apiKey.trim()} className="gap-2">
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
          {sending ? t("dashboard.onboarding.otpSending") : t("dashboard.onboarding.otpSendButton")}
        </Button>

        {sandboxCode && (
          <div className="space-y-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
            <p className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              {t("dashboard.onboarding.otpSendSuccess")}
            </p>
            <div>
              <Label>{t("dashboard.onboarding.otpCodeLabel")}</Label>
              <code dir="ltr" className="mt-1 block rounded-md border border-border/60 bg-muted px-3 py-2 font-mono text-lg tracking-widest">
                <Ltr>{sandboxCode}</Ltr>
              </code>
            </div>
            <Button onClick={onNext} className="mt-2 gap-2">
              {t("dashboard.onboarding.next")}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </Button>
          </div>
        )}

        {alreadyComplete && !sandboxCode && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            {t("dashboard.onboarding.completed")}
          </p>
        )}

        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {t("dashboard.onboarding.back")}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Step 4: Verify OTP ───────────────────────────────────────────────────

function VerifyOtpStep({
  locale,
  alreadyComplete,
  onProgressUpdate,
  onNext,
  onBack,
}: {
  locale: Locale;
  alreadyComplete: boolean;
  onProgressUpdate: (p: OnboardingProgress) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const t = useTranslations();
  const [apiKey, setApiKey] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleVerify() {
    if (!apiKey.trim() || !email.trim() || code.length !== 6 || verifying) return;
    setVerifying(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/v1/otp/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ email: email.trim(), code, purpose: "signup" }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        setError(t("dashboard.onboarding.otpVerifyError"));
        return;
      }
      setSuccess(true);
      // Mark the step complete — the OTP row was really consumed.
      const markRes = await fetch("/api/onboarding/mark-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "otpVerified" }),
      });
      if (markRes.ok) {
        const markData = await markRes.json();
        if (markData.progress) onProgressUpdate(markData.progress);
      }
    } catch {
      setError(t("dashboard.onboarding.otpVerifyError"));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          {t("dashboard.onboarding.otpVerifyTitle")}
        </CardTitle>
        <CardDescription>{t("dashboard.onboarding.otpVerifyBody")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-3">
            <p className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              {t("dashboard.onboarding.otpVerifySuccess")}
            </p>
            <Button onClick={onNext} className="gap-2">
              {t("dashboard.onboarding.next")}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="verify-api-key">API key</Label>
              <Input
                id="verify-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="mg_test_…"
                dir="ltr"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="verify-email">{t("dashboard.onboarding.otpSendEmailLabel")}</Label>
              <Input
                id="verify-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("dashboard.onboarding.otpSendEmailPlaceholder")}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="verify-code">{t("dashboard.onboarding.otpVerifyCodeLabel")}</Label>
              <Input
                id="verify-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder={t("dashboard.onboarding.otpVerifyCodePlaceholder")}
                dir="ltr"
                className="font-mono text-lg tracking-widest"
              />
            </div>
            <Button onClick={handleVerify} disabled={verifying || !apiKey.trim() || !email.trim() || code.length !== 6} className="gap-2">
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden />
              )}
              {verifying ? t("dashboard.onboarding.otpVerifying") : t("dashboard.onboarding.otpVerifyButton")}
            </Button>
          </>
        )}

        {alreadyComplete && !success && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            {t("dashboard.onboarding.completed")}
          </p>
        )}

        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {t("dashboard.onboarding.back")}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Step 5: Completion ────────────────────────────────────────────────────

function CompletionStep({ onDone }: { onDone: () => void }) {
  const t = useTranslations();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          {t("dashboard.onboarding.completionTitle")}
        </CardTitle>
        <CardDescription>{t("dashboard.onboarding.completionBody")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <a href="/docs" className="rounded-lg border border-border/60 p-4 transition hover:border-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              {t("dashboard.onboarding.completionDocs")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground/70">{t("dashboard.onboarding.completionDocsDesc")}</p>
          </a>
          <a href="/dashboard/playground" className="rounded-lg border border-border/60 p-4 transition hover:border-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              {t("dashboard.onboarding.completionPlayground")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground/70">{t("dashboard.onboarding.completionPlaygroundDesc")}</p>
          </a>
          <a href="/dashboard/api-keys" className="rounded-lg border border-border/60 p-4 transition hover:border-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              {t("dashboard.onboarding.completionApiKeys")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground/70">{t("dashboard.onboarding.completionApiKeysDesc")}</p>
          </a>
          <a href="/dashboard/api-keys" className="rounded-lg border border-border/60 p-4 transition hover:border-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              {t("dashboard.onboarding.completionProduction")}
            </div>
            <p className="mt-1 text-xs text-muted-foreground/70">{t("dashboard.onboarding.completionProductionDesc")}</p>
          </a>
        </div>
        <Button onClick={onDone} className="gap-2">
          {t("dashboard.onboarding.completionDashboard")}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </Button>
      </CardContent>
    </Card>
  );
}
