"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Sparkles, Copy, Check, Terminal, ShieldCheck, CheckCircle2,
  ArrowRight, ArrowLeft, KeyRound, FileText, AlertTriangle,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import { useToast } from "@/hooks/use-toast";
import { DocsChapter, CodeBlock, Note } from "./DocsShell";

/**
 * BuildWithAI — a premium interactive prompt builder for coding agents.
 *
 * Generates an English agent prompt that tells a coding agent to:
 *   1. Inspect the developer's repository
 *   2. Detect the framework/runtime/package manager
 *   3. Implement the Nixify integration using documented behavior
 *   4. Keep the API key server-side (NIXIFY_API_KEY)
 *   5. Use https://nixify.ir as the production origin
 *   6. Never invent endpoints or product capabilities
 *   7. Add tests, verify build, report changes
 *
 * The generated prompt is ALWAYS English (never translated to Persian).
 * The surrounding UI (buttons, labels, descriptions) follows the active locale.
 *
 * The human's only post-install action: add NIXIFY_API_KEY=<their key> to .env
 */

const INTEGRATION_GOALS = [
  {
    id: "email-otp",
    enLabel: "Email OTP verification",
    faLabel: "تأیید OTP ایمیل",
    promptGoal: "Email OTP verification — integrate Nixify's send/verify/resend OTP endpoints for user authentication",
  },
  {
    id: "contacts",
    enLabel: "Contacts management",
    faLabel: "مدیریت مخاطبان",
    promptGoal: "Contacts management — integrate Nixify's Contacts API for creating, listing, and managing contacts",
  },
  {
    id: "webhooks",
    enLabel: "Webhook event handling",
    faLabel: "مدیریت رویدادهای وب‌هوک",
    promptGoal: "Webhook event handling — set up a webhook endpoint to receive and verify HMAC-SHA256 signed Nixify events",
  },
  {
    id: "broadcasts",
    enLabel: "Broadcast campaigns",
    faLabel: "ارسال انبوه",
    promptGoal: "Broadcast campaigns — integrate Nixify's Broadcasts API for sending marketing campaigns to audiences",
  },
] as const;

function generatePrompt(goalId: string): string {
  const goal = INTEGRATION_GOALS.find(g => g.id === goalId) ?? INTEGRATION_GOALS[0];
  const goalLine = goal.promptGoal;

  return `You are integrating Nixify into this existing application.

Your job is to inspect this repository, understand its current stack and architecture, and implement the requested Nixify integration completely.

Integration goal:
${goalLine}

Requirements:

1. Inspect the repository before changing anything.
   Determine:
   - framework
   - runtime
   - package manager
   - server/client boundaries
   - existing service/API architecture
   - environment-variable conventions
   - testing conventions
   - error-handling conventions

2. Use the current Nixify documentation and API reference as the source of truth.

   Production origin:
   https://nixify.ir

   Do not invent endpoints, request fields, response fields, SDKs, packages, scopes, quotas, or capabilities.

3. Create the Nixify integration using the existing architecture of this repository.

   Prefer a reusable server-side Nixify service/client rather than scattering API calls throughout the application.

4. Authentication must use this server-side environment variable:

   NIXIFY_API_KEY

   Never hardcode the key.
   Never commit a real key.
   Never expose the key to browser/client-side code.
   Never use a public/client-prefixed environment variable for this secret.

5. Add the appropriate entry to .env.example if this repository uses one:

   NIXIFY_API_KEY=

   Do not insert a real secret.

6. Implement the selected integration using only documented Nixify behavior.

   Handle:
   - successful responses
   - documented API errors
   - network failures
   - authentication failures
   - rate limits and quota errors where applicable

   Preserve useful Nixify machine-readable error information and request identifiers when available.

7. Follow this repository's existing coding style and architecture.

   Do not perform unrelated refactors.

8. Keep the implementation production-ready.

   Add:
   - appropriate TypeScript/types when applicable
   - input validation where needed
   - safe server-only secret handling
   - reasonable timeout/error behavior
   - clear boundaries between application logic and the Nixify API client

9. Do not perform destructive production actions while verifying the integration.

   Use mocks, existing test infrastructure, documented sandbox/test behavior, or safe non-mutating validation where appropriate.

10. Add or update meaningful tests for the integration.

11. Run the relevant repository verification commands, including type checking, linting, tests, and production build when available.

12. At completion, report:

   - architecture used
   - files created
   - files changed
   - Nixify endpoints/capabilities integrated
   - tests added
   - verification results
   - any assumptions
   - the exact final environment setup required from the human

The desired final human setup should be minimal.

After your implementation is complete, the developer should only need to configure:

NIXIFY_API_KEY=<their Nixify API key>

in the appropriate server environment and then run/deploy the application normally.

Do not stop at explaining how to integrate Nixify.
Implement the integration in the repository.`;
}

const ENV_SNIPPET = `NIXIFY_API_KEY=`;

export function BuildWithAI() {
  const { locale, dir } = useLocale();
  const isFa = locale === "fa";
  const isRTL = dir === "rtl";
  const prefersReducedMotion = useReducedMotion();
  const { toast } = useToast();
  const [selectedGoal, setSelectedGoal] = React.useState<string>("email-otp");
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);
  const [copiedEnv, setCopiedEnv] = React.useState(false);

  const prompt = React.useMemo(() => generatePrompt(selectedGoal), [selectedGoal]);
  const selectedGoalObj = INTEGRATION_GOALS.find(g => g.id === selectedGoal)!;
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
      toast({ title: isFa ? "پرامپت کپی شد!" : "Prompt copied!" });
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      toast({ title: isFa ? "کپی ناموفق" : "Copy failed", variant: "destructive" });
    }
  }

  async function copyEnv() {
    try {
      await navigator.clipboard.writeText(ENV_SNIPPET);
      setCopiedEnv(true);
      toast({ title: isFa ? "تنظیمات env کپی شد!" : "Env snippet copied!" });
      setTimeout(() => setCopiedEnv(false), 2500);
    } catch {
      toast({ title: isFa ? "کپی ناموفق" : "Copy failed", variant: "destructive" });
    }
  }

  function reset() {
    setSelectedGoal("email-otp");
    setCopiedPrompt(false);
    setCopiedEnv(false);
  }

  const agentChecklist = isFa ? [
    "بازرسی پروژه و تشخیص فریمورک",
    "پیاده‌سازی یکپارچه‌سازی Nixify",
    "افزودن تست‌ها",
    "اجرای typecheck و build",
    "گزارش فایل‌های تغییر یافته",
  ] : [
    "Inspect project & detect framework",
    "Implement Nixify integration",
    "Add tests",
    "Run typecheck & build",
    "Report changed files",
  ];

  return (
    <DocsChapter
      id="build-with-ai"
      icon={Sparkles}
      title={isFa ? "ساخت با هوش مصنوعی" : "Build with AI"}
      description={isFa
        ? "یک پرامپت انگلیسی برای عامل کدنویسی تولید کنید تا Nixify را در پروژه شما پیاده‌سازی کند."
        : "Generate an English agent prompt to implement Nixify in your project."}
    >
      {/* How it works */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 text-emerald-400" />
            <p className="text-xs font-semibold text-foreground">{isFa ? "عامل چه می‌کند" : "What the agent does"}</p>
          </div>
          <ul className="space-y-1">
            {agentChecklist.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-amber-400" />
            <p className="text-xs font-semibold text-foreground">{isFa ? "آنچه شما انجام می‌دهید" : "What you do"}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {isFa
              ? "پس از اتمام عامل، تنها یک کار لازم است:"
              : "After the agent finishes, only one action is needed:"}
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-500/20 bg-muted/40 px-2 py-1.5">
            <Ltr><code className="font-mono text-xs text-amber-300">NIXIFY_API_KEY=</code></Ltr>
            <span className="text-[10px] text-amber-400">••••••••••</span>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            {isFa ? "کلید را در محیط سرور قرار دهید. هرگز در کد کلاینت استفاده نشود." : "Add the key to your server environment. Never in client code."}
          </p>
        </div>
      </div>

      {/* Goal selector */}
      <div>
        <p className="mb-2 text-xs font-medium text-foreground">{isFa ? "هدف یکپارچه‌سازی را انتخاب کنید" : "Select integration goal"}</p>
        <div className="flex flex-wrap gap-2">
          {INTEGRATION_GOALS.map((goal) => (
            <button
              key={goal.id}
              onClick={() => setSelectedGoal(goal.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                selectedGoal === goal.id
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-border bg-muted/40 text-muted-foreground hover:border-gray-700 hover:text-foreground"
              }`}
            >
              {isFa ? goal.faLabel : goal.enLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Selected goal summary */}
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
        <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-xs text-muted-foreground">{isFa ? "هدف انتخاب شده:" : "Selected goal:"}</span>
        <span className="text-xs font-medium text-foreground">
          {isFa ? selectedGoalObj.faLabel : selectedGoalObj.enLabel}
        </span>
      </div>

      {/* Prompt readiness indicator */}
      <div className="flex items-center gap-2">
        <div className={`flex h-2 w-2 items-center justify-center rounded-full ${copiedPrompt ? "bg-emerald-400" : "bg-amber-400"}`}>
          {copiedPrompt && <Check className="h-1.5 w-1.5 text-gray-900" />}
        </div>
        <span className="text-xs text-muted-foreground">
          {copiedPrompt
            ? (isFa ? "آماده — پرامپت کپی شد" : "Ready — prompt copied")
            : (isFa ? "آماده برای عامل کدنویسی شما" : "Ready for your coding agent")}
        </span>
      </div>

      {/* Prompt preview — ALWAYS English */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">
            {isFa ? "پیش‌نمایش پرامپت (انگلیسی)" : "Prompt preview (English)"}
          </p>
          <span className="rounded bg-border/60 px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground/70">EN</span>
        </div>
        <div className="group relative overflow-hidden rounded-lg border border-border bg-card/60">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5">
            <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
              <Terminal className="h-3 w-3" />
              Agent Prompt
            </span>
            <button
              onClick={copyPrompt}
              className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-medium text-white transition hover:bg-emerald-500"
            >
              {copiedPrompt ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {isFa ? "کپی پرامپت" : "Copy Prompt"}
            </button>
          </div>
          <pre dir="ltr" className="max-h-80 overflow-auto p-3 text-[11px] leading-relaxed">
            <code className="font-mono text-muted-foreground">{prompt}</code>
          </pre>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={copyPrompt}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-emerald-500"
        >
          {copiedPrompt ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {isFa ? "کپی پرامپت" : "Copy Prompt"}
        </button>
        <button
          onClick={copyEnv}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground transition hover:bg-border/40"
        >
          {copiedEnv ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <FileText className="h-3.5 w-3.5" />}
          {isFa ? "کپی تنظیمات env" : "Copy .env Snippet"}
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition hover:bg-border/40"
        >
          {isFa ? "بازنشانی" : "Reset"}
        </button>
      </div>

      {/* Safe-secret explanation */}
      <Note type="warning">
        <div className="flex items-start gap-1.5">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
          <span>
            {isFa
              ? "کلید API فقط باید در محیط سرور استفاده شود. هرگز آن را در کد کلاینت، مرورگر یا متغیرهای محیطی عمومی قرار ندهید."
              : "The API key must only be used in the server environment. Never put it in client-side code, browser-accessible bundles, or public-prefixed environment variables."}
          </span>
        </div>
      </Note>

      {/* API Keys link */}
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/api-keys"
          className="inline-flex items-center gap-1 text-xs text-emerald-400 transition hover:text-emerald-300"
        >
          <KeyRound className="h-3 w-3" />
          {isFa ? "کلید API خود را در داشبورد دریافت کنید" : "Get your API key from the dashboard"}
          <Arrow className="h-3 w-3" />
        </Link>
      </div>
    </DocsChapter>
  );
}
