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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, UsersRound, Folder, Save, Trash2, UserPlus, Mail, X, Pencil, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";

interface GroupDetail {
  id: number;
  group_id: string;
  name: string;
  description: string | null;
  member_count: number;
  created_at: string;
  updated_at: string;
}

interface Member {
  id: number;
  contact_id: number;
  contact_email: string;
  contact_name: string | null;
  source: string;
  created_at: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const SOURCE_LABEL_KEYS: Record<string, string> = {
  manual: "dashboard.groups.sourceManual",
  import: "dashboard.groups.sourceImport",
  api: "dashboard.groups.sourceApi",
  automation: "dashboard.groups.sourceAutomation",
};

export default function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const router = useRouter();
  const t = useTranslations();
  const formatRelative = useRelativeTime();
  const [groupId, setGroupId] = useState<string>("");
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [entitled, setEntitled] = useState(true);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Add member state
  const [addOpen, setAddOpen] = useState(false);
  const [contactInput, setContactInput] = useState("");
  const [adding, setAdding] = useState(false);

  // Pagination + remove state
  const [page, setPage] = useState(1);
  const [removeId, setRemoveId] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => { params.then(p => setGroupId(p.groupId)); }, [params]);

  const loadGroup = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/groups/${groupId}`);
      if (res.status === 401) { router.push("/auth"); return; }
      if (res.status === 403) { setEntitled(false); return; }
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGroup(data);
      setEditName(data.name || "");
      setEditDescription(data.description || "");
    } catch {
      toast.error(t("dashboard.groups.failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [groupId, router, t]);

  const loadMembers = useCallback(async () => {
    if (!groupId) return;
    setMembersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      const res = await fetch(`/api/dashboard/groups/${groupId}/members?${params}`);
      if (!res.ok) {
        if (res.status === 404) { setNotFound(true); return; }
        throw new Error();
      }
      const data = await res.json();
      setMembers(data.members ?? []);
      setPagination(data.pagination ?? null);
    } catch {
      toast.error(t("dashboard.groups.failedLoadMembers"));
    } finally {
      setMembersLoading(false);
    }
  }, [groupId, page, t]);

  useEffect(() => { loadGroup(); }, [loadGroup]);
  useEffect(() => { if (groupId) loadMembers(); }, [groupId, loadMembers]);

  async function handleSaveEdit() {
    if (!group) return;
    setEditSaving(true);
    try {
      const body: Record<string, string> = { name: editName.trim() };
      if (editDescription.trim() !== (group.description || "")) {
        body.description = editDescription.trim();
      }
      const res = await fetch(`/api/dashboard/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(t("dashboard.groups.failedUpdate"), { description: data?.error?.message ?? "" });
        return;
      }
      toast.success(t("dashboard.groups.updatedToast"));
      setEditOpen(false);
      setGroup(data);
    } catch {
      toast.error(t("dashboard.groups.failedUpdate"));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleAddMember() {
    if (!group) return;
    const trimmed = contactInput.trim();
    if (!trimmed) return;
    const contactId = Number(trimmed);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      toast.error(t("dashboard.groups.failedAddMember"), {
        description: t("dashboard.groups.contactIdHelp"),
      });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/dashboard/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(t("dashboard.groups.failedAddMember"), { description: data?.error?.message ?? "" });
        return;
      }
      if (data.skipped) {
        toast.success(t("dashboard.groups.alreadyMember"), { description: t("dashboard.groups.alreadyMemberDescription") });
      } else {
        toast.success(t("dashboard.groups.memberAdded"));
      }
      setContactInput("");
      setAddOpen(false);
      loadMembers();
      loadGroup();
    } catch {
      toast.error(t("dashboard.groups.failedAddMember"));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveMember(contactId: number) {
    try {
      const res = await fetch(
        `/api/dashboard/groups/${groupId}/members/${contactId}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(t("dashboard.groups.failedRemoveMember"), { description: data?.error?.message ?? "" });
        return;
      }
      toast.success(data.removed ? t("dashboard.groups.memberRemoved") : t("dashboard.groups.alreadyRemoved"));
      setRemoveId(null);
      loadMembers();
      loadGroup();
    } catch {
      toast.error(t("dashboard.groups.failedRemoveMember"));
    }
  }

  async function handleDeleteGroup() {
    if (!group) return;
    try {
      const res = await fetch(`/api/dashboard/groups/${groupId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(t("dashboard.groups.failedDelete"), { description: data?.error?.message ?? "" });
        return;
      }
      toast.success(t("dashboard.groups.deleted"));
      router.push("/dashboard/groups");
    } catch {
      toast.error(t("dashboard.groups.failedDelete"));
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-40 w-full rounded-lg mb-6" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!entitled) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/40 border">
            <UsersRound className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-xl font-semibold">{t("dashboard.groups.notAvailable")}</h2>
        <Button asChild className="mt-6">
          <Link href="/pricing">{t("dashboard.common.viewPlans")}</Link>
        </Button>
      </div>
    );
  }

  if (notFound || !group) {
    return (
      <div className="container mx-auto max-w-2xl py-20 text-center">
        <h2 className="text-xl font-semibold">{t("dashboard.groups.notFound")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("dashboard.groups.notFoundDescription")}
        </p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/groups">{t("dashboard.groups.backToGroups")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/groups")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> {t("dashboard.groups.title")}
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                <Folder className="h-5 w-5" />
              </div>
              {group.name}
            </h1>
            {group.description && (
              <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{group.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1 h-4 w-4" /> {t("dashboard.groups.edit")}
          </Button>
          <Button variant="outline" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> {t("dashboard.groups.delete")}
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("dashboard.groups.memberCount")}</p>
            <p className="text-2xl font-bold text-emerald-600">{group.member_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("dashboard.groups.created")}</p>
            <p className="text-sm font-medium mt-1">
              {formatRelative(group.created_at)}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("dashboard.groups.updated")}</p>
            <p className="text-sm font-medium mt-1">
              {formatRelative(group.updated_at)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Members section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <UsersRound className="h-4 w-4 text-emerald-600" /> {t("dashboard.groups.memberCount")}
            <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-600">
              {pagination?.total ?? group.member_count}
            </Badge>
          </CardTitle>
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="mr-1 h-4 w-4" /> {t("dashboard.groups.addContact")}
          </Button>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {membersLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/40 border">
                <UsersRound className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium">{t("dashboard.groups.noMembers")}</h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                {t("dashboard.groups.noMembersDescription")}
              </p>
              <Button
                size="sm"
                className="mt-3 bg-emerald-600 text-white hover:bg-emerald-500"
                onClick={() => setAddOpen(true)}
              >
                <UserPlus className="mr-1 h-4 w-4" /> {t("dashboard.groups.addContact")}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="border-b text-left">
                    <th className="px-4 py-2.5 font-medium">{t("dashboard.contacts.email")}</th>
                    <th className="px-4 py-2.5 font-medium hidden md:table-cell">{t("dashboard.contacts.name")}</th>
                    <th className="px-4 py-2.5 font-medium hidden sm:table-cell">{t("dashboard.contacts.source")}</th>
                    <th className="px-4 py-2.5 font-medium hidden lg:table-cell">{t("dashboard.groups.created")}</th>
                    <th className="px-4 py-2.5 font-medium text-right">{t("dashboard.contacts.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-600">
                            {(m.contact_name || m.contact_email)[0].toUpperCase()}
                          </div>
                          <span className="text-muted-foreground"><Ltr>{m.contact_email}</Ltr></span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        {m.contact_name || <span className="italic text-muted-foreground/60">—</span>}
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {SOURCE_LABEL_KEYS[m.source] ? t(SOURCE_LABEL_KEYS[m.source]) : m.source}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">
                        {formatRelative(m.created_at)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                          onClick={() => setRemoveId(m.contact_id)}
                          aria-label={`Remove ${m.contact_email}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dashboard.groups.editDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("dashboard.groups.editDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">{t("dashboard.groups.name")}</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={editSaving}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-description">{t("dashboard.groups.descriptionOptional")}</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                disabled={editSaving}
                maxLength={500}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={editSaving}>
              {t("common.buttons.cancel")}
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={handleSaveEdit}
              disabled={editSaving || !editName.trim()}
            >
              <Save className="mr-1 h-4 w-4" /> {editSaving ? t("dashboard.contacts.saving") : t("dashboard.groups.saveChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dashboard.groups.addMemberDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("dashboard.groups.addMemberDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-id">{t("dashboard.groups.contactId")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="contact-id"
                  inputMode="numeric"
                  placeholder={t("dashboard.groups.contactIdPlaceholder")}
                  value={contactInput}
                  onChange={(e) => setContactInput(e.target.value)}
                  disabled={adding}
                  className="pl-9"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && contactInput.trim()) {
                      e.preventDefault();
                      handleAddMember();
                    }
                  }}
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("dashboard.groups.contactIdHelp")}{" "}
                <Link href="/dashboard/contacts" className="text-emerald-600 hover:underline">
                  {t("dashboard.groups.contactsLink")}
                </Link>
                .
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={adding}>
              {t("common.buttons.cancel")}
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={handleAddMember}
              disabled={adding || !contactInput.trim()}
            >
              {adding ? t("dashboard.groups.adding") : t("dashboard.groups.addMember")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation */}
      <AlertDialog open={removeId !== null} onOpenChange={(open) => !open && setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dashboard.groups.removeMemberTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dashboard.groups.removeMemberMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-500"
              onClick={() => removeId && handleRemoveMember(removeId)}
            >
              {t("dashboard.groups.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Group Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dashboard.groups.deleteGroupTitle").replace("{name}", group.name)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dashboard.groups.deleteMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-500"
              onClick={handleDeleteGroup}
            >
              {t("dashboard.groups.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
