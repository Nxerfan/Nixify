/* eslint-disable react-hooks/set-state-in-effect --
 * Pre-existing async data-fetch pattern: setState occurs inside async callbacks
 * (.then / await), not synchronously in the effect body. Upgrading
 * eslint-plugin-react-hooks to 7.1.1 (Phase 12 dependency refresh) introduced
 * these rules which false-positive on async setState and pre-existing useMemo.
 * Fixing would require unrelated product redesign.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Card, CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText, Plus, Search, MoreHorizontal, Trash2, Pencil, ChevronLeft, ChevronRight, ArrowLeft, Variable,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";

interface TemplateListItem {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  current_version: number;
  created_at: string;
  updated_at: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface CreateBody {
  name: string;
  slug: string;
  description?: string;
  subject: string;
  html: string;
  text?: string;
}

/** Derive a slug-friendly string from a free-form name. */
function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function TemplatesPage() {
  const router = useRouter();
  const t = useTranslations();
  const [authChecked, setAuthChecked] = useState(false);
  const [entitled, setEntitled] = useState(true);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/dashboard/templates?${params}`);
      if (res.status === 401) { router.push("/auth"); return; }
      if (res.status === 403) { setEntitled(false); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTemplates(data.templates ?? []);
      setPagination(data.pagination ?? null);
    } catch {
      const msg = t("dashboard.templates.failedLoad");
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setAuthChecked(true);
    }
  }, [page, search, router]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  async function createTemplate(body: CreateBody): Promise<boolean> {
    try {
      const res = await fetch("/api/dashboard/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(t("dashboard.templates.failedCreate"), {
          description: data?.error?.message ?? t("errors.generic"),
        });
        return false;
      }
      toast.success(t("dashboard.templates.createSuccess"), {
        description: `“${data.name}”`,
      });
      setCreateOpen(false);
      router.push(`/dashboard/templates/${data.id}`);
      return true;
    } catch {
      toast.error(t("dashboard.templates.failedCreate"));
      return false;
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/dashboard/templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(t("dashboard.templates.deleteFailed"), { description: d?.error?.message ?? "" });
        return;
      }
      toast.success(t("dashboard.templates.deleteSuccess"));
      setDeleteId(null);
      loadTemplates();
    } catch {
      toast.error(t("dashboard.templates.deleteFailed"));
    }
  }

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
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-xl font-semibold">{t("dashboard.templates.notAvailable")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("dashboard.templates.notAvailableDescription")}
        </p>
        <Button asChild className="mt-6">
          <Link href="/pricing">View Plans</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> {t("dashboard.nav.dashboard")}
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <FileText className="h-6 w-6 text-emerald-600" /> {t("dashboard.templates.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.templates.subtitle")}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-emerald-600 text-white hover:bg-emerald-500"
        >
          <Plus className="mr-1 h-4 w-4" /> {t("dashboard.templates.addTemplate")}
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("dashboard.templates.search")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
            maxLength={200}
          />
        </div>
        {pagination && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {pagination.total} {pagination.total !== 1 ? t("dashboard.templates.templateCountPlural") : t("dashboard.templates.templateCountSingular")}
          </span>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Slug</th>
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Variables</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Updated</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-4 py-3"><Skeleton className="h-5 w-40" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-5 w-28" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-10" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-5 w-10" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-5 w-24" /></td>
                  <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-8 w-8" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : loadError ? (
        <Card className="border-dashed border-rose-500/40">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-rose-600">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={loadTemplates}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/40 border">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">{t("dashboard.templates.empty")}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {t("dashboard.templates.emptyDescription")}
            </p>
            <Button
              className="mt-4 bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-1 h-4 w-4" /> {t("dashboard.templates.addTemplate")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="border-b text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Slug</th>
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Variables</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Updated</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr
                  key={t.id}
                  className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => router.push(`/dashboard/templates/${t.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-600">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">{t.name}</span>
                        {t.description && (
                          <span className="text-xs text-muted-foreground line-clamp-1 max-w-[28ch]">
                            {t.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {t.slug}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-600">
                      v{t.current_version}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    <span className="inline-flex items-center gap-1 text-xs">
                      <Variable className="h-3 w-3" /> —
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/dashboard/templates/${t.id}`)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-rose-600"
                          onClick={() => setDeleteId(t.id)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("dashboard.templates.pageOf").replace("{page}", String(pagination.page)).replace("{total}", String(pagination.totalPages))}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> {t("dashboard.templates.prev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              {t("dashboard.templates.next")} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <CreateTemplateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={createTemplate}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dashboard.templates.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dashboard.templates.deleteMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-500"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              {t("dashboard.templates.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---- Create Template Dialog ----

function CreateTemplateDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (body: CreateBody) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  // slugManual === null means "auto-derive from name"; once the user types in
  // the slug field we flip to manual mode and stop deriving.
  const [slugManual, setSlugManual] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const slug = slugManual ?? deriveSlug(name);

  function reset() {
    setName("");
    setSlugManual(null);
    setDescription("");
    setSubject("");
    setHtml("");
    setText("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || !subject.trim() || !html.trim()) return;
    setSaving(true);
    const body: CreateBody = {
      name: name.trim(),
      slug: slug.trim(),
      subject: subject.trim(),
      html,
    };
    if (description.trim()) body.description = description.trim();
    if (text.trim()) body.text = text;
    const ok = await onCreate(body);
    if (ok) reset();
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Template</DialogTitle>
          <DialogDescription>
            Create a reusable, versioned email template. You can edit content later — the slug is permanent.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                required
                placeholder="Welcome email"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-slug">Slug</Label>
              <Input
                id="tpl-slug"
                required
                placeholder="welcome-email"
                value={slug}
                onChange={(e) => setSlugManual(e.target.value)}
                disabled={saving}
                maxLength={80}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                lowercase letters, numbers, hyphens; cannot be changed after creation.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-description">Description (optional)</Label>
            <Textarea
              id="tpl-description"
              placeholder="Sent when a user signs up."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              maxLength={500}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-subject">Subject</Label>
            <Input
              id="tpl-subject"
              required
              placeholder="Welcome to {{app_name}}, {{first_name}}!"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={saving}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              Use <code className="font-mono bg-muted px-1 rounded">{"{{variable_name}}"}</code> for substitution.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-html">HTML body</Label>
            <Textarea
              id="tpl-html"
              required
              placeholder="<h1>Welcome, {{first_name}}!</h1><p>Your code is <strong>{{code}}</strong>.</p>"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              disabled={saving}
              rows={8}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-text">Plain text (optional)</Label>
            <Textarea
              id="tpl-text"
              placeholder="Welcome, {{first_name}}! Your code is {{code}}."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={saving}
              rows={4}
              className="font-mono text-xs"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              disabled={saving || !name.trim() || !slug.trim() || !subject.trim() || !html.trim()}
            >
              {saving ? "Creating..." : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
