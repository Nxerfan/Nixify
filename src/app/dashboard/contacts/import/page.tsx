"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Upload, FileUp, FileSpreadsheet, FileJson, FileText, CheckCircle2, XCircle,
  AlertTriangle, Loader2, RefreshCw, Trash2, Folder, Info, ShieldAlert,
} from "lucide-react";

type Stage = "upload" | "uploading" | "preview" | "confirming" | "processing" | "results" | "error";

interface ImportSummary {
  import_id: string;
  status: string;
  format: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  existing_rows: number;
  imported_rows: number;
  failed_rows: number;
  target_group_id: string | null;
  created_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
}

interface PreviewRow {
  row_number: number;
  email: string;
  name: string | null;
  status: string;
  error_code: string | null;
}

interface GroupItem {
  id: number;
  group_id: string;
  name: string;
  member_count: number;
}

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  staged: { label: "New", tone: "emerald" },
  existing: { label: "Existing", tone: "amber" },
  imported: { label: "Imported", tone: "emerald" },
  invalid: { label: "Invalid", tone: "rose" },
  failed: { label: "Failed", tone: "rose" },
  duplicate_file: { label: "Duplicate", tone: "slate" },
};

const ERROR_LABELS: Record<string, string> = {
  invalid_email: "Invalid email format",
  empty_email: "Email is empty",
  email_too_long: "Email too long (>254)",
  name_too_long: "Name too long (>200)",
  too_many_columns: "Too many columns",
  duplicate_in_file: "Duplicate within file",
  invalid_attribute: "Invalid attribute shape",
  unknown: "Unknown error",
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 10_000;
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150; // 5 minutes @ 2s

export default function ImportContactsPage() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("upload");
  const [entitled, setEntitled] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import + preview state
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [targetGroupId, setTargetGroupId] = useState<string>(""); // "" = none
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsAvailable, setGroupsAvailable] = useState(true);

  // Processing poll state
  const [pollAttempts, setPollAttempts] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Load groups for the optional target dropdown (only once on mount) ----
  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const res = await fetch("/api/dashboard/groups?page=1&pageSize=100");
      if (res.status === 401) { router.push("/auth"); return; }
      if (res.status === 403) { setGroupsAvailable(false); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGroups(data.groups ?? []);
    } catch {
      // Soft-fail: group dropdown stays empty but import still works.
      setGroupsAvailable(false);
    } finally {
      setGroupsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    (async () => {
      // No entitlement probe — the upload itself returns 403 if not entitled,
      // and we surface that error inline. We just mark auth-checked.
      setAuthChecked(true);
      await loadGroups();
    })();
  }, [loadGroups]);

  // ---- Cleanup poll timer on unmount ----
  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  // ---- Drag & drop handlers ----
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelected(f);
  }

  function handleFileSelected(f: File) {
    const ext = f.name.toLowerCase().split(".").pop() ?? "";
    if (!["txt", "json", "xlsx"].includes(ext)) {
      toast.error("Unsupported file type", {
        description: "Allowed formats: .txt, .json, .xlsx (.xls/.xlsm are rejected).",
      });
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      toast.error("File too large", {
        description: `Max is 5 MiB. Yours is ${(f.size / 1024 / 1024).toFixed(2)} MiB.`,
      });
      return;
    }
    setFile(f);
  }

  // ---- Upload file to backend (multipart) ----
  async function handleUpload() {
    if (!file) return;
    setStage("uploading");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/dashboard/contacts/imports", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { router.push("/auth"); return; }
      if (res.status === 403) {
        setEntitled(false);
        setStage("error");
        return;
      }
      if (!res.ok) {
        toast.error("Upload failed", { description: data?.error?.message ?? "" });
        setStage("upload");
        return;
      }
      setSummary(data);
      toast.success("File parsed", {
        description: `${data.total_rows} rows · ${data.valid_rows} valid · ${data.invalid_rows} invalid`,
      });
      // Fetch preview rows immediately.
      await loadPreviewRows(data.import_id);
      setStage("preview");
    } catch {
      toast.error("Upload failed", { description: "Network error. Try again." });
      setStage("upload");
    }
  }

  async function loadPreviewRows(importId: string) {
    try {
      const res = await fetch(
        `/api/dashboard/contacts/imports/${importId}/rows?page=1&pageSize=100`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Failed to load preview rows", { description: data?.error?.message ?? "" });
        return;
      }
      setRows(data.rows ?? []);
    } catch {
      toast.error("Failed to load preview rows");
    }
  }

  // ---- Confirm the import ----
  async function handleConfirm() {
    if (!summary) return;
    setStage("confirming");
    try {
      const body: Record<string, string> = {};
      if (targetGroupId) body.targetGroupId = targetGroupId;
      const res = await fetch(
        `/api/dashboard/contacts/imports/${summary.import_id}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: Object.keys(body).length > 0 ? JSON.stringify(body) : "{}",
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { router.push("/auth"); return; }
      if (!res.ok) {
        toast.error("Confirm failed", { description: data?.error?.message ?? "" });
        setStage("preview");
        return;
      }
      toast.success("Import queued", { description: "Processing has started." });
      setStage("processing");
      setPollAttempts(0);
      // Kick off polling.
      schedulePoll(summary.import_id);
    } catch {
      toast.error("Confirm failed");
      setStage("preview");
    }
  }

  // ---- Poll the import status while processing ----
  function schedulePoll(importId: string) {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = setTimeout(() => pollOnce(importId), POLL_INTERVAL_MS);
  }

  async function pollOnce(importId: string) {
    try {
      const res = await fetch(`/api/dashboard/contacts/imports/${importId}`);
      const data: ImportSummary = await res.json();
      if (!res.ok) {
        toast.error("Status check failed");
        setStage("error");
        return;
      }
      setSummary(data);
      if (data.status === "completed") {
        setStage("results");
        toast.success("Import complete", {
          description: `${data.imported_rows} imported · ${data.existing_rows} existing · ${data.failed_rows} failed`,
        });
        return;
      }
      if (data.status === "failed") {
        setStage("error");
        toast.error("Import failed", { description: "See the imports log for details." });
        return;
      }
      if (data.status === "cancelled") {
        setStage("upload");
        setSummary(null);
        setRows([]);
        setFile(null);
        toast("Import cancelled");
        return;
      }
      // Still queued or processing — keep polling, with a hard cap.
      setPollAttempts(n => {
        const next = n + 1;
        if (next >= MAX_POLL_ATTEMPTS) {
          toast.error("Import is taking too long", {
            description: "Refresh the page later to see results.",
          });
          setStage("error");
          return next;
        }
        schedulePoll(importId);
        return next;
      });
    } catch {
      // Transient network error — keep trying with backoff.
      setPollAttempts(n => {
        const next = n + 1;
        if (next >= MAX_POLL_ATTEMPTS) {
          setStage("error");
          return next;
        }
        schedulePoll(importId);
        return next;
      });
    }
  }

  // ---- Cancel a preview_ready import ----
  async function handleCancelImport() {
    if (!summary) return;
    try {
      const res = await fetch(`/api/dashboard/contacts/imports/${summary.import_id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) {
        toast.error("Cancel failed", { description: data?.error?.message ?? "" });
        return;
      }
      toast.success("Import discarded");
      resetToUpload();
    } catch {
      toast.error("Cancel failed");
    }
  }

  function resetToUpload() {
    setSummary(null);
    setRows([]);
    setFile(null);
    setTargetGroupId("");
    setPollAttempts(0);
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    setStage("upload");
  }

  // ---- Render guards ----
  if (!authChecked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  if (!entitled) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/40 border">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-xl font-semibold">Contact Import is not available on your current account</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Bulk contact import is a PRO+ feature.
        </p>
        <Button asChild className="mt-6">
          <Link href="/pricing">View Plans</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Upload className="h-6 w-6 text-emerald-600" /> Import Contacts
            </h1>
            <p className="text-sm text-muted-foreground">
              Bulk-upload contacts from a .txt, .json, or .xlsx file. Preview before committing.
            </p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <Stepper stage={stage} />

      {/* Stage: Upload */}
      {stage === "upload" && (
        <UploadStage
          file={file}
          dragOver={dragOver}
          fileInputRef={fileInputRef}
          onFileSelected={handleFileSelected}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onUpload={handleUpload}
          onClearFile={() => setFile(null)}
        />
      )}

      {/* Stage: Uploading (parsing) */}
      {stage === "uploading" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-emerald-600" />
            <h3 className="text-base font-medium">Parsing your file…</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Detecting format, validating emails, deduping within the file.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stage: Preview */}
      {stage === "preview" && summary && (
        <PreviewStage
          summary={summary}
          rows={rows}
          groups={groups}
          groupsLoading={groupsLoading}
          groupsAvailable={groupsAvailable}
          targetGroupId={targetGroupId}
          onTargetGroupChange={setTargetGroupId}
          onConfirm={handleConfirm}
          onCancel={handleCancelImport}
          onRefreshRows={() => loadPreviewRows(summary.import_id)}
        />
      )}

      {/* Stage: Confirming */}
      {stage === "confirming" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-emerald-600" />
            <h3 className="text-base font-medium">Queueing import…</h3>
            <p className="mt-1 text-sm text-muted-foreground">Transitioning the staged rows to the processor.</p>
          </CardContent>
        </Card>
      )}

      {/* Stage: Processing */}
      {stage === "processing" && summary && (
        <ProcessingStage summary={summary} pollAttempts={pollAttempts} />
      )}

      {/* Stage: Results */}
      {stage === "results" && summary && (
        <ResultsStage summary={summary} onAnother={resetToUpload} onViewContacts={() => router.push("/dashboard/contacts")} />
      )}

      {/* Stage: Error */}
      {stage === "error" && (
        <Card className="border-rose-500/40">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20">
              <XCircle className="h-6 w-6 text-rose-600" />
            </div>
            <h3 className="text-base font-medium">Import could not be completed</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              The import failed or timed out. You can discard it and start over.
            </p>
            <div className="mt-4 flex gap-2">
              {summary && (
                <Button variant="outline" onClick={handleCancelImport}>
                  <Trash2 className="mr-1 h-4 w-4" /> Discard
                </Button>
              )}
              <Button onClick={resetToUpload}>Start over</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Stepper
// ============================================================================

function Stepper({ stage }: { stage: Stage }) {
  const steps: { key: Stage[]; label: string }[] = [
    { key: ["upload", "uploading"], label: "Upload" },
    { key: ["preview", "confirming"], label: "Preview" },
    { key: ["processing"], label: "Process" },
    { key: ["results"], label: "Done" },
  ];
  // Find active step index — error redirects to the previous step visually.
  const activeIdx = steps.findIndex(s => s.key.includes(stage));
  return (
    <div className="mb-6 flex items-center gap-2">
      {steps.map((s, i) => {
        const isActive = i === activeIdx;
        const isDone = i < activeIdx;
        return (
          <div key={s.label} className="flex items-center gap-2 flex-1">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium ${
                isActive
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                  : isDone
                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                  : "border-border text-muted-foreground"
              }`}
            >
              {isDone ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-xs sm:text-sm ${
                isActive ? "font-medium text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`hidden sm:block flex-1 h-px ${isDone ? "bg-emerald-500/40" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Upload Stage
// ============================================================================

function UploadStage({
  file, dragOver, fileInputRef,
  onFileSelected, onDrop, onDragOver, onDragLeave, onUpload, onClearFile,
}: {
  file: File | null;
  dragOver: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelected: (f: File) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onUpload: () => void;
  onClearFile: () => void;
}) {
  const formatIcon = (ext: string) => {
    if (ext === "json") return <FileJson className="h-5 w-5" />;
    if (ext === "xlsx") return <FileSpreadsheet className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Drop zone + selected file */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileUp className="h-4 w-4 text-emerald-600" /> Choose a file
            </CardTitle>
            <CardDescription>
              Drag &amp; drop or browse. Format is auto-detected from the file content.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragOver
                  ? "border-emerald-500 bg-emerald-500/5"
                  : "border-border hover:border-emerald-500/50 hover:bg-muted/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.json,.xlsx"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFileSelected(f);
                  e.target.value = ""; // allow re-selecting the same file
                }}
              />
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="text-sm">
                  <button
                    type="button"
                    className="text-emerald-600 hover:underline font-medium"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Browse
                  </button>{" "}
                  or drop a file here
                </p>
                <p className="text-xs text-muted-foreground">
                  .txt, .json, .xlsx · max 5 MiB · max 10,000 rows
                </p>
              </div>
            </div>

            {file && (
              <div className="mt-4 flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                  {formatIcon(file.name.toLowerCase().split(".").pop() ?? "")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB · {file.type || "unknown type"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={onClearFile}
                  aria-label="Clear file"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={!file}
                onClick={onUpload}
              >
                <Upload className="mr-1 h-4 w-4" /> Upload &amp; Parse
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Format requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-emerald-600" /> Format requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-3">
              <FormatSpec
                icon={<FileText className="h-4 w-4" />}
                title="TXT"
                desc="One email per line. Names optional, separated by whitespace or comma."
              />
              <FormatSpec
                icon={<FileJson className="h-4 w-4" />}
                title="JSON"
                desc='Array of objects: [{ "email": "...", "name": "...", "attributes": {...} }]'
              />
              <FormatSpec
                icon={<FileSpreadsheet className="h-4 w-4" />}
                title="XLSX"
                desc="First worksheet. Columns: email, name. Formula cells are rejected."
              />
            </div>
            <Separator />
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Maximum file size: 5 MiB.</li>
              <li>• Maximum rows per file: 10,000. Extra rows are dropped.</li>
              <li>• Maximum columns per row: 50. Cell length: 2 KiB.</li>
              <li>• Duplicate emails within the file are de-duplicated.</li>
              <li>• Legacy .xls and macro-enabled .xlsm are rejected.</li>
              <li>• Spreadsheet formula cells are rejected — only static values.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar: disclaimer + tips */}
      <div className="space-y-4">
        <Alert className="border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Importing does not subscribe contacts to marketing emails</AlertTitle>
          <AlertDescription>
            Imported contacts are stored with a marketing status of <code className="font-mono">pending</code>.
            You must obtain explicit opt-in separately before sending marketing emails.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>• Verify the first 100 rows in the preview before confirming.</p>
            <p>• Optionally target a group — imported contacts will be added as members.</p>
            <p>• Invalid rows are kept in the preview but skipped at write-time.</p>
            <p>• You can discard a staged import at any time before confirming.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FormatSpec({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="mb-1 flex items-center gap-2 text-emerald-600">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

// ============================================================================
// Preview Stage
// ============================================================================

function PreviewStage({
  summary, rows, groups, groupsLoading, groupsAvailable,
  targetGroupId, onTargetGroupChange, onConfirm, onCancel, onRefreshRows,
}: {
  summary: ImportSummary;
  rows: PreviewRow[];
  groups: GroupItem[];
  groupsLoading: boolean;
  groupsAvailable: boolean;
  targetGroupId: string;
  onTargetGroupChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onRefreshRows: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total" value={summary.total_rows} tone="default" />
        <StatCard label="Valid" value={summary.valid_rows} tone="emerald" />
        <StatCard label="Invalid" value={summary.invalid_rows} tone="rose" />
        <StatCard label="Duplicates" value={summary.duplicate_rows} tone="slate" />
        <StatCard label="Existing" value={summary.existing_rows} tone="amber" />
        <StatCard
          label="New"
          value={Math.max(0, summary.valid_rows - summary.existing_rows)}
          tone="emerald"
        />
      </div>

      {/* Target group + actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Folder className="h-4 w-4 text-emerald-600" /> Target group (optional)
          </CardTitle>
          <CardDescription>
            Imported contacts will be added to this group as members. You can also leave this blank.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {groupsLoading ? (
            <Skeleton className="h-9 w-full max-w-sm" />
          ) : !groupsAvailable ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Groups not available on your plan</AlertTitle>
              <AlertDescription>
                Importing still works — contacts will be added to your general contacts list, just not to a group.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="space-y-1.5 flex-1 max-w-sm">
                <Label htmlFor="target-group">Add imported contacts to</Label>
                <Select value={targetGroupId} onValueChange={onTargetGroupChange}>
                  <SelectTrigger id="target-group" className="w-full">
                    <SelectValue placeholder="No group (contacts only)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No group (contacts only)</SelectItem>
                    {groups.map(g => (
                      <SelectItem key={g.group_id} value={g.group_id}>
                        {g.name} ({g.member_count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {groups.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No groups yet.{" "}
                  <Link href="/dashboard/groups" className="text-emerald-600 hover:underline">
                    Create one →
                  </Link>
                </p>
              )}
            </div>
          )}

          <Separator />

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Format detected:</span>{" "}
              <Badge variant="outline" className="text-xs uppercase">
                {summary.format}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onRefreshRows}>
                <RefreshCw className="mr-1 h-4 w-4" /> Refresh preview
              </Button>
              <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" onClick={onCancel}>
                <Trash2 className="mr-1 h-4 w-4" /> Discard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview rows */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Preview rows (first 100)</CardTitle>
          <span className="text-xs text-muted-foreground">
            Showing {rows.length} of {summary.total_rows}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">No preview rows.</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr className="border-b text-left">
                    <th className="px-4 py-2.5 font-medium w-16">#</th>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium hidden md:table-cell">Name</th>
                    <th className="px-4 py-2.5 font-medium w-28">Status</th>
                    <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const meta = STATUS_LABELS[r.status] || { label: r.status, tone: "slate" };
                    return (
                      <tr key={r.row_number} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{r.row_number}</td>
                        <td className="px-4 py-2 break-all">{r.email || <span className="italic text-muted-foreground/60">—</span>}</td>
                        <td className="px-4 py-2 hidden md:table-cell">
                          {r.name || <span className="italic text-muted-foreground/60">—</span>}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className={`text-xs ${toneClass(meta.tone)}`}>
                            {meta.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 hidden lg:table-cell text-xs text-muted-foreground">
                          {r.error_code ? (ERROR_LABELS[r.error_code] || r.error_code) : <span className="text-muted-foreground/60">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm footer */}
      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button
          className="bg-emerald-600 text-white hover:bg-emerald-500"
          onClick={onConfirm}
          disabled={summary.valid_rows === 0}
        >
          <CheckCircle2 className="mr-1 h-4 w-4" />
          Confirm &amp; Import {summary.valid_rows > 0 ? `(${summary.valid_rows} contact${summary.valid_rows !== 1 ? "s" : ""})` : ""}
        </Button>
      </div>
    </div>
  );
}

function toneClass(tone: string): string {
  switch (tone) {
    case "emerald": return "border-emerald-500/30 text-emerald-600";
    case "amber": return "border-amber-500/30 text-amber-600";
    case "rose": return "border-rose-500/30 text-rose-600";
    case "slate": return "border-slate-500/30 text-slate-600 dark:text-slate-400";
    default: return "";
  }
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const toneText =
    tone === "emerald" ? "text-emerald-600"
    : tone === "rose" ? "text-rose-600"
    : tone === "amber" ? "text-amber-600"
    : tone === "slate" ? "text-slate-600 dark:text-slate-400"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${toneText}`}>{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Processing Stage
// ============================================================================

function ProcessingStage({ summary, pollAttempts }: { summary: ImportSummary; pollAttempts: number }) {
  const pct = Math.min(95, Math.round((pollAttempts / MAX_POLL_ATTEMPTS) * 100));
  const statusLabel =
    summary.status === "queued" ? "Queued — waiting for the processor"
    : summary.status === "processing" ? "Writing contacts to the database"
    : "Working…";
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Loader2 className="mb-3 h-10 w-10 animate-spin text-emerald-600" />
        <h3 className="text-base font-medium">{statusLabel}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          This usually takes a few seconds for small files. Larger imports are processed in batches of 100 rows.
        </p>
        <div className="mt-6 w-full max-w-md">
          <Progress value={pct} className="h-2" />
          <p className="mt-1 text-xs text-muted-foreground text-right">
            {pct}% · status: <code className="font-mono">{summary.status}</code>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Results Stage
// ============================================================================

function ResultsStage({
  summary,
  onAnother,
  onViewContacts,
}: {
  summary: ImportSummary;
  onAnother: () => void;
  onViewContacts: () => void;
}) {
  return (
    <div className="space-y-6">
      <Card className="border-emerald-500/40">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold">Import complete</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.imported_rows + summary.existing_rows} of {summary.total_rows} rows processed.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Imported" value={summary.imported_rows} tone="emerald" />
        <StatCard label="Already existed" value={summary.existing_rows} tone="amber" />
        <StatCard label="Failed" value={summary.failed_rows} tone="rose" />
      </div>

      {summary.failed_rows > 0 && (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{summary.failed_rows} row(s) could not be imported</AlertTitle>
          <AlertDescription>
            Inspect the original file for malformed emails or invalid attributes and try again.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
        <Button variant="outline" onClick={onAnother}>
          <Upload className="mr-1 h-4 w-4" /> Import another file
        </Button>
        <Button
          className="bg-emerald-600 text-white hover:bg-emerald-500"
          onClick={onViewContacts}
        >
          View Contacts
        </Button>
      </div>
    </div>
  );
}
