"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
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

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  import: "Import",
  api: "API",
  automation: "Automation",
};

export default function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const router = useRouter();
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
      toast.error("Failed to load group");
    } finally {
      setLoading(false);
    }
  }, [groupId, router]);

  const loadMembers = useCallback(async () => {
    if (!groupId) return;
    setMembersLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: "20" });
      const res = await fetch(`/api/dashboard/groups/${groupId}/members?${qs}`);
      if (!res.ok) {
        if (res.status === 404) { setNotFound(true); return; }
        throw new Error();
      }
      const data = await res.json();
      setMembers(data.members ?? []);
      setPagination(data.pagination ?? null);
    } catch {
      toast.error("Failed to load members");
    } finally {
      setMembersLoading(false);
    }
  }, [groupId, page]);

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
        toast.error("Failed to update group", { description: data?.error?.message ?? "" });
        return;
      }
      toast.success("Group updated");
      setEditOpen(false);
      setGroup(data);
    } catch {
      toast.error("Failed to update group");
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
      toast.error("Enter a valid contact ID (numeric).", {
        description: "Use the Contacts page to look up an ID by email.",
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
        toast.error("Failed to add member", { description: data?.error?.message ?? "" });
        return;
      }
      if (data.skipped) {
        toast.success("Already a member", { description: "No changes made." });
      } else {
        toast.success("Member added");
      }
      setContactInput("");
      setAddOpen(false);
      loadMembers();
      loadGroup();
    } catch {
      toast.error("Failed to add member");
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
        toast.error("Failed to remove member", { description: data?.error?.message ?? "" });
        return;
      }
      toast.success(data.removed ? "Member removed" : "Already removed");
      setRemoveId(null);
      loadMembers();
      loadGroup();
    } catch {
      toast.error("Failed to remove member");
    }
  }

  async function handleDeleteGroup() {
    if (!group) return;
    try {
      const res = await fetch(`/api/dashboard/groups/${groupId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("Delete failed", { description: data?.error?.message ?? "" });
        return;
      }
      toast.success("Group deleted");
      router.push("/dashboard/groups");
    } catch {
      toast.error("Delete failed");
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
        <h2 className="text-xl font-semibold">Groups are not available on your current account</h2>
        <Button asChild className="mt-6">
          <Link href="/pricing">View Plans</Link>
        </Button>
      </div>
    );
  }

  if (notFound || !group) {
    return (
      <div className="container mx-auto max-w-2xl py-20 text-center">
        <h2 className="text-xl font-semibold">Group not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This group may have been deleted or doesn&apos;t belong to your account.
        </p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/groups">Back to Groups</Link>
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
            <ArrowLeft className="mr-1 h-4 w-4" /> Groups
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
            <Pencil className="mr-1 h-4 w-4" /> Edit
          </Button>
          <Button variant="outline" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Members</p>
            <p className="text-2xl font-bold text-emerald-600">{group.member_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-sm font-medium mt-1">
              {formatDistanceToNow(new Date(group.created_at), { addSuffix: true })}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Updated</p>
            <p className="text-sm font-medium mt-1">
              {formatDistanceToNow(new Date(group.updated_at), { addSuffix: true })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Members section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <UsersRound className="h-4 w-4 text-emerald-600" /> Members
            <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-600">
              {pagination?.total ?? group.member_count}
            </Badge>
          </CardTitle>
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="mr-1 h-4 w-4" /> Add Contact
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
              <h3 className="text-sm font-medium">No members yet</h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Add an existing contact by its ID. You can find contact IDs on the Contacts page.
              </p>
              <Button
                size="sm"
                className="mt-3 bg-emerald-600 text-white hover:bg-emerald-500"
                onClick={() => setAddOpen(true)}
              >
                <UserPlus className="mr-1 h-4 w-4" /> Add Contact
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="border-b text-left">
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium hidden md:table-cell">Name</th>
                    <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Source</th>
                    <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Added</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
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
                          <span className="text-muted-foreground">{m.contact_email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        {m.contact_name || <span className="italic text-muted-foreground/60">—</span>}
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {SOURCE_LABELS[m.source] || m.source}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
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
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>
              Update the group name or description. Names must remain unique.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={editSaving}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-description">Description (optional)</Label>
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
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={handleSaveEdit}
              disabled={editSaving || !editName.trim()}
            >
              <Save className="mr-1 h-4 w-4" /> {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact to Group</DialogTitle>
            <DialogDescription>
              Enter an existing contact&apos;s numeric ID. Adding is idempotent — duplicates are skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact-id">Contact ID</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="contact-id"
                  inputMode="numeric"
                  placeholder="e.g. 42"
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
                Find a contact&apos;s ID on the{" "}
                <Link href="/dashboard/contacts" className="text-emerald-600 hover:underline">
                  Contacts page
                </Link>
                .
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={handleAddMember}
              disabled={adding || !contactInput.trim()}
            >
              {adding ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation */}
      <AlertDialog open={removeId !== null} onOpenChange={(open) => !open && setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member?</AlertDialogTitle>
            <AlertDialogDescription>
              The contact will be removed from this group but remains in your contacts list. This action is idempotent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-500"
              onClick={() => removeId && handleRemoveMember(removeId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Group Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{group.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the group and clears all memberships. Contacts themselves are not deleted.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-500"
              onClick={handleDeleteGroup}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
