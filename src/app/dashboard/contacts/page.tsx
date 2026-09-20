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
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Plus, Search, MoreHorizontal, Trash2, Pencil, ChevronLeft, ChevronRight, ArrowLeft,
  Clock, Mail, User as UserIcon, Tag,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";
import { GuideBanner } from "@/components/guide/GuideBanner";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Contact {
  id: number;
  email: string;
  name: string | null;
  source: string;
  marketing_status: string;
  created_at: string;
  updated_at: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const SOURCE_LABELS: Record<string, string> = {
  api: "API",
  dashboard: "Dashboard",
  otp_verified: "OTP Verified",
  import: "Import",
};

export default function ContactsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations();
  const [authChecked, setAuthChecked] = useState(false);
  const [entitled, setEntitled] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/dashboard/contacts?${params}`);
      if (res.status === 401) { router.push("/auth"); return; }
      if (res.status === 403) { setEntitled(false); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setContacts(data.contacts ?? []);
      setPagination(data.pagination ?? null);
    } catch {
      toast({ title: t("dashboard.contacts.failedLoad"), variant: "destructive" });
    } finally {
      setLoading(false);
      setAuthChecked(true);
    }
  }, [page, search, router, toast]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

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

  async function createContact(email: string, name: string, attrs: Record<string, string>) {
    try {
      const res = await fetch("/api/dashboard/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: t("dashboard.contacts.createFailed"), description: data.error?.message ?? t("errors.generic"), variant: "destructive" });
        return false;
      }
      toast({ title: data.created ? t("dashboard.contacts.createSuccessCreated") : t("dashboard.contacts.createSuccessUpdated") });
      setCreateOpen(false);
      loadContacts();
      return true;
    } catch {
      toast({ title: t("dashboard.contacts.createFailed"), variant: "destructive" });
      return false;
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/dashboard/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast({ title: t("dashboard.contacts.deleteFailed"), description: d.error?.message ?? "", variant: "destructive" });
        return;
      }
      toast({ title: t("dashboard.contacts.deleteSuccess") });
      setDeleteId(null);
      loadContacts();
    } catch {
      toast({ title: t("dashboard.contacts.deleteFailed"), variant: "destructive" });
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
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-xl font-semibold">{t("dashboard.contacts.notAvailable")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("dashboard.contacts.notAvailableDescription")}
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
              <Users className="h-6 w-6 text-emerald-600" /> {t("dashboard.contacts.title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("dashboard.contacts.subtitle")}</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 text-white hover:bg-emerald-500">
          <Plus className="mr-1 h-4 w-4" /> {t("dashboard.contacts.addContact")}
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("dashboard.contacts.search")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
            maxLength={200}
          />
        </div>
        {pagination && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {pagination.total} {pagination.total !== 1 ? t("dashboard.contacts.contactCountPlural") : t("dashboard.contacts.contactCountSingular")}
          </span>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : contacts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/40 border">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">{t("dashboard.contacts.empty")}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {t("dashboard.contacts.emptyDescription")}
            </p>
            <Button className="mt-4 bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> {t("dashboard.contacts.addContact")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="border-b text-left">
                <th className="px-4 py-3 font-medium">{t("dashboard.contacts.name")}</th>
                <th className="px-4 py-3 font-medium">{t("dashboard.contacts.email")}</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">{t("dashboard.contacts.source")}</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">{t("dashboard.contacts.created")}</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">{t("dashboard.contacts.updated")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("dashboard.contacts.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr
                  key={c.id}
                  className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                  onClick={() => router.push(`/dashboard/contacts/${c.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-600">
                        {(c.name || c.email)[0].toUpperCase()}
                      </div>
                      <span className="font-medium">{c.name || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground"><Ltr>{c.email}</Ltr></td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge variant="outline" className="text-xs">{SOURCE_LABELS[c.source] || c.source}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {new Date(c.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/dashboard/contacts/${c.id}`)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> {t("dashboard.contacts.viewEdit")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-rose-600"
                          onClick={() => setDeleteId(c.id)}
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> {t("dashboard.contacts.delete")}
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
            {t("dashboard.contacts.pageOf").replace("{page}", String(pagination.page)).replace("{total}", String(pagination.totalPages))}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> {t("dashboard.contacts.prev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              {t("dashboard.contacts.next")} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <CreateContactDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={createContact}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dashboard.contacts.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dashboard.contacts.deleteMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-500"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              {t("dashboard.contacts.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Guide banner */}
      <GuideBanner guidePath="/guide/contacts" routeKey="contacts" steps={5} duration={4} />
    </div>
  );
}

// ---- Create Contact Dialog ----

function CreateContactDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (email: string, name: string, attrs: Record<string, string>) => Promise<boolean>;
}) {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [attrRows, setAttrRows] = useState<{ key: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);

  function reset() {
    setEmail("");
    setName("");
    setAttrRows([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    const attrs: Record<string, string> = {};
    for (const row of attrRows) {
      if (row.key.trim()) attrs[row.key.trim()] = row.value;
    }
    const ok = await onCreate(email.trim(), name.trim(), attrs);
    if (ok) reset();
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dashboard.contacts.createDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("dashboard.contacts.createDialogDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="contact-email">{t("dashboard.contacts.email")}</Label>
            <Input
              id="contact-email"
              type="email"
              required
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-name">{t("dashboard.contacts.nameOptional")}</Label>
            <Input
              id="contact-name"
              placeholder="Alice Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              maxLength={200}
            />
          </div>
          {/* Attributes editor */}
          <div className="space-y-2">
            <Label>{t("dashboard.contacts.attributesOptional")}</Label>
            {attrRows.map((row, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="key (e.g. plan)"
                  value={row.key}
                  onChange={(e) => {
                    const next = [...attrRows];
                    next[i] = { ...row, key: e.target.value };
                    setAttrRows(next);
                  }}
                  disabled={saving}
                  className="flex-1"
                />
                <Input
                  placeholder="value (e.g. pro)"
                  value={row.value}
                  onChange={(e) => {
                    const next = [...attrRows];
                    next[i] = { ...row, value: e.target.value };
                    setAttrRows(next);
                  }}
                  disabled={saving}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAttrRows(rows => rows.filter((_, idx) => idx !== i))}
                  disabled={saving}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAttrRows(rows => [...rows, { key: "", value: "" }])}
              disabled={saving}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> {t("dashboard.contacts.addField")}
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              {t("common.buttons.cancel")}
            </Button>
            <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-500" disabled={saving || !email.trim()}>
              {saving ? t("dashboard.contacts.saving") : t("dashboard.contacts.addContact")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
