"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import {
  ArrowLeft, Zap, MailCheck, CheckCircle2, AlertTriangle, CircleSlash, Variable, Clock, FileText, Loader2,
} from "lucide-react";

// ---- API response shapes --------------------------------------------------

interface AutomationSetting {
  type: string;
  enabled: boolean;
  template_id: number | null;
  template_variables: string[] | null;
  compatible: boolean | null;
  built_in_variables: string[];
  updated_at: string | null;
}

interface TemplateListItem {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  current_version: number;
  created_at: string;
  updated_at: string;
}

// ---- Component ------------------------------------------------------------

export default function AutomationsPage() {
  const t = useTranslations();
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [entitled, setEntitled] = useState(true);
  const [setting, setSetting] = useState<AutomationSetting | null>(null);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [savingEnabled, setSavingEnabled] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // ---- Loaders ------------------------------------------------------------

  const loadSetting = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/automations/otp-verified-welcome", {
        cache: "no-store",
      });
      if (res.status === 401) {
        router.push("/auth");
        return false;
      }
      if (res.status === 403) {
        setEntitled(false);
        return false;
      }
      if (!res.ok) throw new Error();
      const data: AutomationSetting = await res.json();
      setSetting(data);
      return true;
    } catch {
      const msg = t("dashboard.automations.errors.loadFailed");
      setLoadError(msg);
      toast.error(msg);
      return false;
    }
  }, [router]);

  const loadTemplates = useCallback(async () => {
    try {
      // Fetch up to 100 templates — automations usually pick from a small set.
      const res = await fetch("/api/dashboard/templates?pageSize=100", {
        cache: "no-store",
      });
      if (res.status === 401) {
        router.push("/auth");
        return false;
      }
      if (res.status === 403) {
        // Templates ride the MESSAGING_EMAILS gate; if the user lacks it, we
        // still render the automation card but with an empty template list.
        setTemplates([]);
        return true;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTemplates(data.templates ?? []);
      return true;
    } catch {
      // Soft-fail: templates dropdown will be empty + a hint shown.
      toast.error(t("dashboard.automations.errors.loadTemplatesFailed"));
      setTemplates([]);
      return false;
    }
  }, [router]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [okSetting] = await Promise.all([loadSetting(), loadTemplates()]);
    setLoading(false);
    setAuthChecked(true);
    void okSetting;
  }, [loadSetting, loadTemplates]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ---- Derived compatibility display -------------------------------------

  const builtInVars = setting?.built_in_variables ?? ["email", "name"];

  const missingVariables = useMemo(() => {
    if (!setting || setting.compatible !== false || !setting.template_variables) {
      return [];
    }
    const provided = new Set(builtInVars);
    return setting.template_variables.filter((v) => !provided.has(v));
  }, [setting, builtInVars]);

  const selectedTemplate = useMemo(() => {
    if (!setting?.template_id) return null;
    return templates.find((t) => t.id === setting.template_id) ?? null;
  }, [setting, templates]);

  // ---- Mutations (auto-save with toast feedback) -------------------------

  async function persist(nextEnabled: boolean, nextTemplateId: number | null) {
    const body: { enabled: boolean; templateId?: number | null } = { enabled: nextEnabled };
    if (nextTemplateId !== null) body.templateId = nextTemplateId;
    // Sending templateId: null is allowed by the schema (optional → null),
    // but we only send it when we explicitly want to clear.
    if (nextTemplateId === null && setting?.template_id) body.templateId = null;

    const res = await fetch("/api/dashboard/automations/otp-verified-welcome", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message ?? "Failed to save automation setting.");
    }
    return data as AutomationSetting;
  }

  async function handleToggle(nextEnabled: boolean) {
    if (!setting) return;
    // Optimistic update for snappy UI.
    setSetting((s) => (s ? { ...s, enabled: nextEnabled } : s));
    setSavingEnabled(true);
    try {
      const updated = await persist(nextEnabled, setting.template_id ?? null);
      setSetting(updated);
      toast.success(nextEnabled ? t("dashboard.automations.welcomeEmail.enabled") : t("dashboard.automations.welcomeEmail.disabled"), {
        description: nextEnabled
          ? t("dashboard.automations.welcomeEmail.statusOn")
          : t("dashboard.automations.welcomeEmail.statusOff"),
      });
    } catch (e) {
      // Revert on error.
      setSetting((s) => (s ? { ...s, enabled: !nextEnabled } : s));
      const msg = e instanceof Error ? e.message : t("dashboard.automations.errors.updateFailed");
      toast.error(t("dashboard.automations.errors.updateError"), { description: msg });
    } finally {
      setSavingEnabled(false);
    }
  }

  async function handleTemplateChange(value: string) {
    if (!setting) return;
    // Radix Select returns string values; "none" → null.
    const nextTemplateId = value === "none" ? null : Number(value);
    if (Number.isNaN(nextTemplateId) && value !== "none") return;

    // Optimistic update (compatibility will be re-derived from the response).
    setSetting((s) => (s ? { ...s, template_id: nextTemplateId } : s));
    setSavingTemplate(true);
    try {
      const updated = await persist(setting.enabled, nextTemplateId);
      setSetting(updated);
      const tpl = templates.find((t) => t.id === nextTemplateId);
      if (tpl) {
        toast.success(t("dashboard.automations.template.selected"), {
          description: `“${tpl.name}” is now the welcome template.`,
        });
      } else {
        toast.success(t("dashboard.automations.template.cleared"), {
          description: t("dashboard.automations.template.clearedDesc"),
        });
      }
    } catch (e) {
      // Revert.
      setSetting((s) => (s ? { ...s, template_id: setting.template_id } : s));
      const msg = e instanceof Error ? e.message : t("dashboard.automations.errors.selectFailed");
      toast.error(t("dashboard.automations.errors.updateError"), { description: msg });
    } finally {
      setSavingTemplate(false);
    }
  }

  // ---- Render: gate states ------------------------------------------------

  if (!authChecked) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!entitled) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/40 border">
            <Zap className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-xl font-semibold">Automations are not available on your current account</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          OTP-verified welcome automation is part of the Automations feature pack.
        </p>
        <Button asChild className="mt-6">
          <Link href="/pricing">View Plans</Link>
        </Button>
      </div>
    );
  }

  if (loadError && !setting) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Failed to load</AlertTitle>
          <AlertDescription>
            <p>{loadError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={loadAll}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Defensive — should not happen once authChecked is true, but satisfies TS.
  if (!setting) {
    return null;
  }

  // ---- Render: main page --------------------------------------------------

  const enabled = setting.enabled;
  const hasTemplate = setting.template_id !== null && !!selectedTemplate;
  const isCompatible = setting.compatible;
  const canFire = enabled && hasTemplate && isCompatible === true;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Zap className="h-6 w-6 text-emerald-500" /> Automations
            </h1>
            <p className="text-sm text-muted-foreground">
              Built-in automations connect your OTP verification flow to transactional messaging.
              When a user verifies their OTP, Nixify can automatically send a welcome email.
            </p>
          </div>
        </div>
      </div>

      {/* Automation card */}
      <Card className="overflow-hidden">
        <CardHeader className="gap-3 border-b">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                <MailCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-base sm:text-lg">
                  OTP Verified → Welcome Email
                </CardTitle>
                <CardDescription className="max-w-2xl">
                  When an OTP is successfully verified, automatically send a welcome email to the
                  verified address using the selected template.
                </CardDescription>
              </div>
            </div>

            {/* Enable / disable */}
            <div className="flex items-center gap-3 self-start rounded-lg border bg-muted/30 px-3 py-2">
              <div className="flex flex-col">
                <Label htmlFor="auto-enabled" className="text-xs font-medium text-muted-foreground">
                  {enabled ? t("dashboard.automations.welcomeEmail.enabled") : t("dashboard.automations.welcomeEmail.disabled")}
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {savingEnabled ? t("dashboard.automations.welcomeEmail.saving") : t("dashboard.automations.welcomeEmail.autoSaves")}
                </span>
              </div>
              <Switch
                id="auto-enabled"
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={savingEnabled}
                className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-input"
              />
            </div>
          </div>

          {/* Status strip */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {canFire ? (
              <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Active
              </Badge>
            ) : enabled && !hasTemplate ? (
              <Badge variant="outline" className="border-amber-500/40 text-amber-500">
                <AlertTriangle className="h-3 w-3" /> Enabled — no template
              </Badge>
            ) : enabled && isCompatible === false ? (
              <Badge variant="outline" className="border-amber-500/40 text-amber-500">
                <AlertTriangle className="h-3 w-3" /> Enabled — incompatible template
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                <CircleSlash className="h-3 w-3" /> Paused
              </Badge>
            )}

            {setting.updated_at && (
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Updated {formatDistanceToNow(new Date(setting.updated_at), { addSuffix: true })}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="grid gap-6 pt-6">
          {/* Template selector */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="auto-template" className="text-sm font-medium">
                Welcome template
              </Label>
              {savingTemplate && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                </span>
              )}
            </div>
            <Select
              value={setting.template_id ? String(setting.template_id) : "none"}
              onValueChange={handleTemplateChange}
              disabled={savingTemplate}
            >
              <SelectTrigger id="auto-template" className="w-full">
                <SelectValue placeholder={t("dashboard.automations.template.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">No template</span>
                </SelectItem>
                <SelectSeparator />
                {templates.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No transactional templates found.
                  </div>
                ) : (
                  templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      <div className="flex flex-col">
                        <span className="font-medium">{t.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{t.slug}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {templates.length === 0 && (
              <p className="text-xs text-muted-foreground">
                You don&apos;t have any transactional templates yet.{" "}
                <Link
                  href="/dashboard/templates"
                  className="text-emerald-500 underline-offset-4 hover:underline"
                >
                  Create one →
                </Link>
              </p>
            )}
            {hasTemplate && selectedTemplate && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                Using <span className="font-medium text-foreground">{selectedTemplate.name}</span>{" "}
                (v{selectedTemplate.current_version}).
              </p>
            )}
          </div>

          {/* Variables + compatibility grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Variables the automation provides */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Variable className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-medium">Built-in variables</h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                These are the variables Nixify automatically injects when the automation fires.
              </p>
              <div className="flex flex-wrap gap-2">
                {builtInVars.map((v) => (
                  <Badge
                    key={v}
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                  >
                    <code className="font-mono">{`{{${v}}}`}</code>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Template required variables */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Template required variables</h3>
              </div>
              {hasTemplate && setting.template_variables && setting.template_variables.length > 0 ? (
                <>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Variables the selected template references.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {setting.template_variables.map((v) => {
                      const provided = builtInVars.includes(v);
                      return (
                        <Badge
                          key={v}
                          variant="outline"
                          className={
                            provided
                              ? "border-emerald-500/30 text-emerald-500"
                              : "border-rose-500/40 text-rose-500"
                          }
                        >
                          <code className="font-mono">{`{{${v}}}`}</code>
                          {provided && <CheckCircle2 className="h-3 w-3" />}
                        </Badge>
                      );
                    })}
                  </div>
                </>
              ) : hasTemplate ? (
                <p className="text-xs text-muted-foreground">
                  This template declares no variables.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Select a template to see its required variables.
                </p>
              )}
            </div>
          </div>

          {/* Compatibility indicator */}
          <CompatibilityIndicator
            compatible={isCompatible}
            hasTemplate={hasTemplate}
            missingVariables={missingVariables}
            enabled={enabled}
          />
        </CardContent>
      </Card>

      {/* Help footer */}
      <p className="mt-6 text-xs text-muted-foreground">
        Need a template that only uses <code className="font-mono">{"{{email}}"}</code> and{" "}
        <code className="font-mono">{"{{name}}"}</code>?{" "}
        <Link
          href="/dashboard/templates"
          className="text-emerald-500 underline-offset-4 hover:underline"
        >
          Browse templates →
        </Link>
      </p>
    </div>
  );
}

// ---- Sub-components -------------------------------------------------------

function CompatibilityIndicator({
  compatible,
  hasTemplate,
  missingVariables,
  enabled,
}: {
  compatible: boolean | null;
  hasTemplate: boolean;
  missingVariables: string[];
  enabled: boolean;
}) {
  const t = useTranslations();
  if (!hasTemplate || compatible === null) {
    return (
      <Alert className="border-muted-foreground/20 bg-muted/20 text-muted-foreground">
        <CircleSlash className="h-4 w-4" />
        <AlertTitle>No template selected</AlertTitle>
        <AlertDescription>
          Choose a transactional template above. The automation will not fire until one is selected
          and compatible with the built-in variables.
        </AlertDescription>
      </Alert>
    );
  }

  if (compatible === true) {
    return (
      <Alert className="border-emerald-500/30 bg-emerald-500/5 text-emerald-500">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Compatible</AlertTitle>
        <AlertDescription>
          <p>
            The selected template only uses variables Nixify can provide.{" "}
            {enabled
              ? t("dashboard.automations.welcomeEmail.activeHelp")
              : t("dashboard.automations.welcomeEmail.inactiveHelp")}
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  // compatible === false
  return (
    <Alert
      variant="destructive"
      className="border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Incompatible — template requires variables the automation cannot provide</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          The automation can only inject <code className="font-mono">email</code> and{" "}
          <code className="font-mono">name</code>. Edit the template to remove or provide defaults
          for these missing variables:
        </p>
        <div className="flex flex-wrap gap-2">
          {missingVariables.map((v) => (
            <Badge
              key={v}
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            >
              <code className="font-mono">{`{{${v}}}`}</code>
            </Badge>
          ))}
        </div>
        <p className="mt-3 text-xs">
          Until resolved, the automation will{" "}
          {enabled ? (
            <span className="font-medium">fail at send-time and retry</span>
          ) : (
            <span className="font-medium">not fire when enabled</span>
          )}
          .
        </p>
      </AlertDescription>
    </Alert>
  );
}
