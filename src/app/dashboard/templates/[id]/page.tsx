/* eslint-disable react-hooks/preserve-manual-memoization --
 * Pre-existing useMemo where the React Compiler cannot prove memoization safety.
 * Upgrading eslint-plugin-react-hooks to 7.1.1 (Phase 12 dependency refresh)
 * introduced this rule. Fixing would require unrelated product redesign.
 */
/* eslint-disable react-hooks/set-state-in-effect --
 * Pre-existing async data-fetch pattern: setState occurs inside async callbacks
 * (.then / await), not synchronously in the effect body. Upgrading
 * eslint-plugin-react-hooks to 7.1.1 (Phase 12 dependency refresh) introduced
 * these rules which false-positive on async setState and pre-existing useMemo.
 * Fixing would require unrelated product redesign.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRelativeTime } from "@/lib/i18n/relative-time";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft, Save, Trash2, FileText, Lock, History, Eye, EyeOff, AlertCircle, Variable, Clock, RotateCcw, Send, Loader2,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

// ---- API response shapes --------------------------------------------------

interface TemplateVersion {
  version: number;
  subject: string;
  html: string;
  text: string | null;
  variables: string[];
  created_at: string;
}

interface TemplateVersionSummary {
  version: number;
  subject: string;
  variables: string[];
  created_at: string;
}

interface TemplateDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  current_version: number;
  created_at: string;
  updated_at: string;
  current: TemplateVersion;
  versions: TemplateVersionSummary[];
}

interface PatchResponse {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  current_version: number;
  version_created: boolean;
  current: TemplateVersion;
  created_at: string;
  updated_at: string;
}

interface PreviewResponse {
  subject: string;
  html: string;
  text: string | null;
  variables: Record<string, unknown>;
}

// ---- Component ------------------------------------------------------------

export default function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const t = useTranslations();
  const formatRelative = useRelativeTime();
  const [templateId, setTemplateId] = useState<number>(0);
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // editor form
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editHtml, setEditHtml] = useState("");
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // preview (current version)
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ subject: string; html: string } | null>(null);
  const [previewMissing, setPreviewMissing] = useState<string[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // version history preview
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [versionDetail, setVersionDetail] = useState<TemplateVersion | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);

  // test send (REAL email — consumes MESSAGING_EMAILS quota; preview stays free)
  const [testSendOpen, setTestSendOpen] = useState(false);
  const [testSendTo, setTestSendTo] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [missingVars, setMissingVars] = useState<string[] | null>(null);

  const loadTemplate = useCallback(async () => {
    if (templateId <= 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/templates/${templateId}`);
      if (res.status === 401) { router.push("/auth"); return; }
      if (res.status === 403) {
        toast.error(t("dashboard.toasts.templateNotAvailable"));
        router.push("/dashboard/templates");
        return;
      }
      if (res.status === 404) {
        setNotFound(true);
        toast.error(t("dashboard.toasts.templateNotFound"), {
          description: "It may have been deleted or doesn't belong to your account.",
        });
        return;
      }
      if (!res.ok) throw new Error();
      const data: TemplateDetail = await res.json();
      setTemplate(data);
      setEditName(data.name);
      setEditDescription(data.description ?? "");
      setEditSubject(data.current.subject);
      setEditHtml(data.current.html);
      setEditText(data.current.text ?? "");
      // seed preview variable inputs with empty strings
      const seed: Record<string, string> = {};
      for (const v of data.current.variables) seed[v] = "";
      setPreviewVars(seed);
    } catch {
      toast.error(t("dashboard.toasts.templateLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [templateId, router]);

  useEffect(() => {
    params.then(p => setTemplateId(Number(p.id)));
  }, [params]);

  useEffect(() => {
    if (templateId > 0) loadTemplate();
  }, [templateId, loadTemplate]);

  // derived: dirty checks for PATCH (only send changed fields)
  const patchBody = useMemo(() => {
    if (!template) return null;
    const body: Record<string, string | undefined> = {};
    if (editName.trim() !== template.name) body.name = editName.trim();
    if (editDescription !== (template.description ?? "")) {
      body.description = editDescription.trim() ? editDescription.trim() : undefined;
    }
    if (editSubject.trim() !== template.current.subject) body.subject = editSubject.trim();
    if (editHtml !== template.current.html) body.html = editHtml;
    if (editText !== (template.current.text ?? "")) {
      body.text = editText.trim() ? editText : undefined;
    }
    return body;
  }, [template, editName, editDescription, editSubject, editHtml, editText]);

  const isDirty = patchBody !== null && Object.keys(patchBody).length > 0;

  async function handleSave() {
    if (!template || !patchBody || !isDirty) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(t("dashboard.toasts.saveFailed"), {
          description: data?.error?.message ?? "Unknown error",
        });
        return;
      }
      const patched: PatchResponse = data;
      // reconcile local form state with the server response so dirty flags clear.
      setTemplate((prev) =>
        prev
          ? {
              ...prev,
              name: patched.name,
              description: patched.description,
              current_version: patched.current_version,
              updated_at: patched.updated_at,
              current: patched.current,
              // prepend the new version to the history list if one was created
              versions:
                patched.version_created && !prev.versions.some(v => v.version === patched.current.version)
                  ? [
                      {
                        version: patched.current.version,
                        subject: patched.current.subject,
                        variables: patched.current.variables,
                        created_at: patched.current.created_at,
                      },
                      ...prev.versions,
                    ]
                  : prev.versions,
            }
          : prev,
      );
      setEditName(patched.name);
      setEditDescription(patched.description ?? "");
      setEditSubject(patched.current.subject);
      setEditHtml(patched.current.html);
      setEditText(patched.current.text ?? "");
      // reset preview var seeds if the variable set changed
      const seed: Record<string, string> = {};
      for (const v of patched.current.variables) {
        seed[v] = previewVars[v] ?? "";
      }
      setPreviewVars(seed);
      // clear stale preview output (it may no longer match)
      setPreviewResult(null);
      setPreviewMissing(null);
      setPreviewError(null);

      if (patched.version_created) {
        toast.success(t("dashboard.toasts.versionCreated"), {
          description: "Content changed — a new immutable version was saved.",
        });
      } else {
        toast.success(t("dashboard.toasts.saved"), { description: t("dashboard.toasts.metadataUpdated") });
      }
    } catch {
      toast.error(t("dashboard.toasts.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!template) return;
    try {
      const res = await fetch(`/api/dashboard/templates/${template.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(t("dashboard.toasts.deleteFailed"), { description: d?.error?.message ?? "" });
        return;
      }
      toast.success(t("dashboard.toasts.templateDeleted"));
      router.push("/dashboard/templates");
    } catch {
      toast.error(t("dashboard.toasts.deleteFailed"));
    }
  }

  async function handlePreview() {
    if (!template) return;
    setPreviewing(true);
    setPreviewError(null);
    setPreviewMissing(null);
    try {
      // Only send variables the user has filled in; missing ones come back in
      // the 400 `missing_template_variables` list — that's intentional UX so
      // the user sees exactly which ones still need values.
      const variables: Record<string, string> = {};
      for (const [k, v] of Object.entries(previewVars)) {
        if (v.trim() !== "") variables[k] = v;
      }
      const res = await fetch("/api/dashboard/templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          variables,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 400 && data?.error?.code === "missing_template_variables") {
        setPreviewMissing(Array.isArray(data.error.missing) ? data.error.missing : []);
        setPreviewResult(null);
        return;
      }
      if (!res.ok) {
        setPreviewError(data?.error?.message ?? "Preview failed.");
        return;
      }
      const out: PreviewResponse = data;
      setPreviewResult({ subject: out.subject, html: out.html });
    } catch {
      setPreviewError("Preview failed. Please try again.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleTestSend() {
    if (!template) return;
    setMissingVars(null);
    const to = testSendTo.trim();
    if (!to) {
      toast.error(t("dashboard.toasts.invalidInput"), { description: "Please enter a recipient email address." });
      return;
    }
    // Same shape as the backend's normalizeRecipient check.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      toast.error(t("dashboard.toasts.invalidInput"), { description: "Please enter a valid email address." });
      return;
    }
    setTestSending(true);
    try {
      // Only send variables the user has filled in — mirrors the preview flow.
      const variables: Record<string, string> = {};
      for (const [k, v] of Object.entries(previewVars)) {
        if (v.trim() !== "") variables[k] = v;
      }
      const res = await fetch(`/api/dashboard/templates/${template.id}/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, variables }),
      });
      const data = await res.json().catch(() => ({}));

      // 201 — success
      if (res.status === 201 && data?.message_id) {
        toast.success(t("dashboard.toasts.testEmailSent"), {
          description: `Message ID: ${data.message_id}`,
        });
        setTestSendOpen(false);
        setTestSendTo("");
        return;
      }

      const code = (data?.error?.code as string | undefined);
      const message = (data?.error?.message as string | undefined) ?? "";
      const errorCode = (data?.error?.error_code as string | undefined);

      // 502 — delivery_failed (provider/config issue)
      if (res.status === 502 && code === "delivery_failed") {
        const desc = (message || "Email delivery failed.") +
          (errorCode === "configuration_error" ? " (SMTP config issue)" : "");
        toast.error(t("dashboard.toasts.sendFailed"), { description: desc });
        return;
      }
      // 402 — quota / rate limit
      if (res.status === 402 && (code === "quota_exhausted" || code === "rate_limited")) {
        toast.error(t("dashboard.toasts.quotaExceeded"), { description: message || t("dashboard.toasts.quotaExceededDesc") });
        return;
      }
      // 400 — missing_template_variables: highlight which ones
      if (res.status === 400 && code === "missing_template_variables") {
        // The route doesn't echo a `missing` array, but the missing set is
        // exactly the required vars the user left empty — compute locally so
        // we can highlight them in both the dialog and the preview panel.
        const missing = template.current.variables.filter(
          (v) => !(previewVars[v] ?? "").trim(),
        );
        setMissingVars(missing);
        toast.error(t("dashboard.toasts.missingVariables"), {
          description: message || "Some template variables are not filled in.",
        });
        return;
      }
      // 400 — other validation failures (validation_failed, invalid_recipient, ...)
      if (res.status === 400) {
        toast.error(t("dashboard.toasts.invalidInput"), { description: message || "Please check your input and try again." });
        return;
      }
      // 403 — feature not available (plan gate)
      if (res.status === 403 && code === "feature_not_available") {
        toast.error(t("dashboard.toasts.templateNotAvailable"), {
          description: "Upgrade your plan to use transactional messaging.",
        });
        return;
      }
      // 404 — template gone (deleted by another session, etc.)
      if (res.status === 404) {
        toast.error(t("dashboard.toasts.templateNotFound"));
        setTestSendOpen(false);
        router.push("/dashboard/templates");
        return;
      }
      // 409 — idempotency conflict (double-click dedupe on the server)
      if (res.status === 409 && code === "idempotency_conflict") {
        toast.error(t("dashboard.toasts.sendFailed"), { description: message || "Duplicate request detected." });
        return;
      }
      // Any other status — generic fallback.
      toast.error(t("dashboard.toasts.sendFailed"), { description: "An unexpected error occurred." });
    } catch {
      toast.error(t("dashboard.toasts.sendFailed"), { description: "An unexpected error occurred." });
    } finally {
      setTestSending(false);
    }
  }

  async function handleSelectVersion(version: number) {
    if (!template) return;
    if (selectedVersion === version) {
      // toggle off
      setSelectedVersion(null);
      setVersionDetail(null);
      return;
    }
    setSelectedVersion(version);
    setVersionDetail(null);
    setVersionLoading(true);
    try {
      const res = await fetch(`/api/dashboard/templates/${template.id}/versions/${version}`);
      if (res.status === 404) {
        toast.error(t("dashboard.toasts.versionNotFound"));
        setSelectedVersion(null);
        return;
      }
      if (!res.ok) throw new Error();
      const data: TemplateVersion = await res.json();
      setVersionDetail(data);
    } catch {
      toast.error(t("dashboard.toasts.versionLoadFailed"));
      setSelectedVersion(null);
    } finally {
      setVersionLoading(false);
    }
  }

  // ---- render -------------------------------------------------------------

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Skeleton className="h-8 w-32 mb-4" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[480px] rounded-lg" />
          <Skeleton className="h-[480px] rounded-lg" />
        </div>
      </div>
    );
  }

  if (notFound || !template) {
    return (
      <div className="container mx-auto max-w-2xl py-20 text-center">
        <h2 className="text-xl font-semibold">{t("dashboard.common.templateNotFound")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This template may have been deleted or doesn&apos;t belong to your account.
        </p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/templates">{t("dashboard.common.backToTemplates")}</Link>
        </Button>
      </div>
    );
  }

  const requiredVars = template.current.variables;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/templates")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Templates
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            <h1 className="text-xl font-bold truncate max-w-[40ch]">{template.name}</h1>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">
              v{template.current_version}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            <Save className="mr-1 h-4 w-4" /> {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            className="text-rose-600 hover:text-rose-700"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: Editor (with versions tab) */}
        <div className="space-y-6">
          <Tabs defaultValue="editor">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="editor">{t("dashboard.common.editor")}</TabsTrigger>
              <TabsTrigger value="versions">
                <History className="mr-1.5 h-3.5 w-3.5" /> Versions ({template.versions.length})
              </TabsTrigger>
            </TabsList>

            {/* Editor tab */}
            <TabsContent value="editor" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("dashboard.templates.editor.content")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-name">{t("dashboard.common.name")}</Label>
                    <Input
                      id="tpl-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={120}
                      disabled={saving}
                    />
                  </div>

                  {/* Slug (immutable) */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-slug" className="flex items-center gap-1.5">
                      Slug
                      <Badge variant="outline" className="text-[10px] font-normal border-amber-500/40 text-amber-600">
                        <Lock className="mr-1 h-2.5 w-2.5" /> immutable
                      </Badge>
                    </Label>
                    <Input
                      id="tpl-slug"
                      value={template.slug}
                      disabled
                      readOnly
                      className="font-mono text-sm text-muted-foreground bg-muted/40"
                    />
                    <p className="text-xs text-muted-foreground">
                      The slug is fixed at creation and used as a stable identifier in the API.
                    </p>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-description">{t("dashboard.common.description")}</Label>
                    <Textarea
                      id="tpl-description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      maxLength={500}
                      rows={2}
                      disabled={saving}
                      placeholder="Short note about what this template is for."
                    />
                  </div>

                  <Separator />

                  {/* Subject */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-subject">{t("dashboard.common.subject")}</Label>
                    <Input
                      id="tpl-subject"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      maxLength={200}
                      disabled={saving}
                      placeholder="Welcome to {{app_name}}, {{first_name}}!"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use <code className="font-mono bg-muted px-1 rounded">{"{{variable_name}}"}</code> for substitution.
                    </p>
                  </div>

                  {/* HTML */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-html">{t("dashboard.common.htmlBody")}</Label>
                    <Textarea
                      id="tpl-html"
                      value={editHtml}
                      onChange={(e) => setEditHtml(e.target.value)}
                      rows={10}
                      disabled={saving}
                      className="font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Saved HTML is sanitized server-side (scripts/iframes/forms stripped). Content changes create a new version.
                    </p>
                  </div>

                  {/* Plain text */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-text">{t("dashboard.common.plainTextOptional")}</Label>
                    <Textarea
                      id="tpl-text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={5}
                      disabled={saving}
                      className="font-mono text-xs"
                      placeholder="Fallback plain-text body for clients that don't render HTML."
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <p className="text-xs text-muted-foreground">
                      {isDirty
                        ? "You have unsaved changes."
                        : "All changes saved."}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!template) return;
                          setEditName(template.name);
                          setEditDescription(template.description ?? "");
                          setEditSubject(template.current.subject);
                          setEditHtml(template.current.html);
                          setEditText(template.current.text ?? "");
                        }}
                        disabled={saving || !isDirty}
                      >
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> Revert
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 text-white hover:bg-emerald-500"
                        onClick={handleSave}
                        disabled={saving || !isDirty}
                      >
                        <Save className="mr-1 h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Versions tab */}
            <TabsContent value="versions" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="h-4 w-4 text-emerald-600" /> Version history
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {template.versions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("dashboard.common.noVersionsRecorded")}</p>
                  ) : (
                    template.versions.map((v) => {
                      const isCurrent = v.version === template.current_version;
                      const isSelected = selectedVersion === v.version;
                      return (
                        <div key={v.version} className="rounded-md border">
                          <button
                            type="button"
                            onClick={() => handleSelectVersion(v.version)}
                            className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                              isSelected ? "bg-emerald-500/5" : "hover:bg-muted/40"
                            }`}
                          >
                            <Badge
                              variant="outline"
                              className={`text-xs ${isCurrent ? "border-emerald-500/40 text-emerald-600" : ""}`}
                            >
                              v{v.version}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{v.subject || "(no subject)"}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatRelative(v.created_at)}
                                <span className="mx-1">·</span>
                                <Variable className="h-3 w-3" />
                                {v.variables.length} var{v.variables.length !== 1 ? "s" : ""}
                              </p>
                            </div>
                            {isCurrent && (
                              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">
                                current
                              </Badge>
                            )}
                            {isSelected ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>

                          {isSelected && (
                            <div className="border-t bg-muted/20 p-3">
                              <div className="mb-2 flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
                                  <Lock className="mr-1 h-2.5 w-2.5" /> read-only historical version
                                </Badge>
                                {v.version !== template.current_version && (
                                  <span className="text-xs text-muted-foreground">
                                    Historical versions cannot be edited.
                                  </span>
                                )}
                              </div>
                              {versionLoading ? (
                                <Skeleton className="h-64 w-full rounded" />
                              ) : versionDetail ? (
                                <div className="space-y-2">
                                  <div className="rounded border bg-background p-2">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">{t("dashboard.common.subject")}</p>
                                    <p className="text-sm">{versionDetail.subject || "(no subject)"}</p>
                                  </div>
                                  <iframe
                                    title={`Version ${v.version} preview`}
                                    sandbox="allow-same-origin"
                                    srcDoc={versionDetail.html}
                                    className="w-full h-[400px] rounded border bg-white"
                                  />
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">t("dashboard.toasts.versionLoadFailed")</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right column: Live preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-4 w-4 text-emerald-600" /> Live preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Required variables */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Variable className="h-3.5 w-3.5" /> Required variables
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {requiredVars.length} var{requiredVars.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {requiredVars.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    This template has no variables. Click Preview to render it.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {requiredVars.map((name) => {
                      const isMissing = missingVars?.includes(name);
                      return (
                        <div key={name} className="space-y-1">
                          <Label
                            htmlFor={`pv-${name}`}
                            className={`text-xs font-mono ${isMissing ? "text-rose-600" : ""}`}
                          >
                            {`{{${name}}}`}
                            {isMissing && <span className="ml-1 font-sans">— required</span>}
                          </Label>
                          <Input
                            id={`pv-${name}`}
                            value={previewVars[name] ?? ""}
                            onChange={(e) =>
                              setPreviewVars((prev) => ({ ...prev, [name]: e.target.value }))
                            }
                            disabled={previewing}
                            className="h-8 text-sm"
                            aria-invalid={isMissing ? true : undefined}
                            placeholder={`value for ${name}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Button
                onClick={handlePreview}
                disabled={previewing}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
              >
                <Eye className="mr-1.5 h-4 w-4" />
                {previewing ? "Rendering..." : "Preview"}
              </Button>

              {/* REAL send — consumes MESSAGING_EMAILS quota. Visually distinct
                  from the free Preview (outline vs emerald fill) and labeled
                  with the Send icon so users don't confuse the two. */}
              <Button
                onClick={() => {
                  setMissingVars(null);
                  setTestSendOpen(true);
                }}
                variant="outline"
                className="w-full border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
              >
                <Send className="mr-1.5 h-4 w-4" />
                Send test email
              </Button>
              <p className="-mt-1 text-center text-[11px] text-muted-foreground">
                Preview is free. Sending delivers a real email.
              </p>

              {/* Missing variables error */}
              {previewMissing && previewMissing.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-500">
                        Missing variables
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Fill in values for the following before previewing:
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {previewMissing.map((m) => (
                          <code
                            key={m}
                            className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs font-mono text-amber-700 dark:text-amber-500"
                          >
                            {`{{${m}}}`}
                          </code>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Generic preview error */}
              {previewError && !previewMissing && (
                <div className="rounded-md border border-rose-500/40 bg-rose-500/5 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    <p className="text-sm text-rose-600">{previewError}</p>
                  </div>
                </div>
              )}

              {/* Preview output */}
              {previewResult && (
                <div className="space-y-2">
                  <div className="rounded border bg-background p-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{t("dashboard.templates.editor.renderedSubject")}</p>
                    <p className="text-sm">{previewResult.subject || "(no subject)"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{t("dashboard.common.renderedHtml")}</p>
                    <iframe
                      title={t("dashboard.templates.editor.templatePreview")}
                      sandbox="allow-same-origin"
                      srcDoc={previewResult.html}
                      className="w-full h-[420px] rounded border bg-white"
                    />
                  </div>
                </div>
              )}

              {!previewResult && !previewMissing && !previewError && (
                <p className="text-xs text-muted-foreground text-center">
                  Fill in the variables and click Preview to render the email.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardContent className="p-4 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>{t("dashboard.common.templateId")}</span>
                <code className="font-mono">{template.id}</code>
              </div>
              <div className="flex items-center justify-between">
                <span>{t("dashboard.templates.editor.currentVersion")}</span>
                <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-600">
                  v{template.current_version}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>{t("dashboard.common.created")}</span>
                <span>{formatRelative(template.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t("dashboard.common.updated")}</span>
                <span>{formatRelative(template.updated_at)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Send test email dialog (REAL send — consumes MESSAGING_EMAILS quota) */}
      <Dialog
        open={testSendOpen}
        onOpenChange={(open) => {
          setTestSendOpen(open);
          if (!open) setMissingVars(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-emerald-600" />
              Send test email
            </DialogTitle>
            <DialogDescription>
              Deliver this template to a real inbox using the current version and the preview variables you entered.
            </DialogDescription>
          </DialogHeader>

          {/* Quota cost warning — the explicit cost reminder required by the spec. */}
          <Alert className="border-amber-500/40 bg-amber-500/10">
            <AlertCircle className="text-amber-600" />
            <AlertDescription className="text-amber-700 dark:text-amber-500">
              ⚠️ This sends a REAL email and consumes your messaging quota. Preview is free — use it first.
            </AlertDescription>
          </Alert>

          {/* Recipient */}
          <div className="space-y-1.5">
            <Label htmlFor="test-send-to">{t("dashboard.templates.editor.recipientEmail")}</Label>
            <Input
              id="test-send-to"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={testSendTo}
              onChange={(e) => setTestSendTo(e.target.value)}
              placeholder="me@example.com"
              disabled={testSending}
            />
            <p className="text-xs text-muted-foreground">
              The email will be delivered to this address.
            </p>
          </div>

          {/* Variables — shared with the preview panel (previewVars). Editable
              here so the user can fix missing values without closing the dialog. */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Variable className="h-3.5 w-3.5" /> Variables ({requiredVars.length})
              </Label>
              {missingVars && missingVars.length > 0 && (
                <span className="text-xs text-rose-600">
                  {missingVars.length} missing
                </span>
              )}
            </div>
            {requiredVars.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                This template has no variables.
              </p>
            ) : (
              <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                {requiredVars.map((name) => {
                  const isMissing = missingVars?.includes(name);
                  return (
                    <div key={name} className="space-y-1">
                      <Label
                        htmlFor={`ts-${name}`}
                        className={`text-xs font-mono ${isMissing ? "text-rose-600" : ""}`}
                      >
                        {`{{${name}}}`}
                        {isMissing && <span className="ml-1 font-sans">— required</span>}
                      </Label>
                      <Input
                        id={`ts-${name}`}
                        value={previewVars[name] ?? ""}
                        onChange={(e) =>
                          setPreviewVars((prev) => ({ ...prev, [name]: e.target.value }))
                        }
                        disabled={testSending}
                        className="h-8 text-sm"
                        aria-invalid={isMissing ? true : undefined}
                        placeholder={`value for ${name}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTestSendOpen(false)}
              disabled={testSending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleTestSend}
              disabled={testSending}
            >
              {testSending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-1.5 h-4 w-4" />
                  Send test email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dashboard.common.deleteTemplate")}</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the template and all of its version history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dashboard.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-500"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
