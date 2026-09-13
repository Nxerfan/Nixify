"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Mail, Clock, Tag, Plus, Trash2, Save, Users as UsersIcon,
} from "lucide-react";

interface ContactDetail {
  id: number;
  email: string;
  name: string | null;
  source: string;
  attributes: Record<string, unknown>;
  marketing_status: string;
  created_at: string;
  updated_at: string;
  timeline: Array<{
    type: string;
    detail: unknown;
    created_at: string;
  }>;
}

const SOURCE_LABELS: Record<string, string> = {
  api: "API",
  dashboard: "Dashboard",
  otp_verified: "OTP Verified",
  import: "Import",
};

const EVENT_LABELS: Record<string, string> = {
  "contact.created": "Contact created",
  "contact.updated": "Contact updated",
};

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editName, setEditName] = useState("");
  const [attrRows, setAttrRows] = useState<{ key: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [contactId, setContactId] = useState<number>(0);

  const loadContact = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/contacts/${contactId}`);
      if (res.status === 401) { router.push("/auth"); return; }
      if (res.status === 403) { router.push("/dashboard/contacts"); return; }
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setContact(data);
      setEditName(data.name || "");
      const attrs = data.attributes as Record<string, unknown>;
      setAttrRows(
        Object.entries(attrs || {}).map(([key, value]) => ({
          key,
          value: typeof value === "string" ? value : JSON.stringify(value),
        }))
      );
    } catch {
      toast({ title: "Failed to load contact", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [contactId, router, toast]);

  useEffect(() => {
    params.then(p => setContactId(Number(p.id)));
  }, [params]);

  useEffect(() => {
    if (contactId > 0) loadContact();
  }, [contactId, loadContact]);

  async function handleSave() {
    if (!contact) return;
    setSaving(true);
    try {
      const attrs: Record<string, string> = {};
      for (const row of attrRows) {
        if (row.key.trim()) attrs[row.key.trim()] = row.value;
      }
      const res = await fetch(`/api/dashboard/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim() || undefined,
          attributes: attrs,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Save failed", description: d.error?.message ?? "", variant: "destructive" });
        return;
      }
      toast({ title: "Contact updated" });
      loadContact();
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!contact) return;
    try {
      const res = await fetch(`/api/dashboard/contacts/${contact.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast({ title: "Delete failed", variant: "destructive" });
        return;
      }
      toast({ title: "Contact deleted" });
      router.push("/dashboard/contacts");
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="container mx-auto max-w-2xl py-20 text-center">
        <h2 className="text-xl font-semibold">Contact not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This contact may have been deleted or doesn't belong to your account.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/contacts">Back to Contacts</Link>
        </Button>
      </div>
    );
  }

  if (!contact) return null;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/contacts")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Contacts
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Contact info + edit */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-sm font-bold text-emerald-600">
                  {(contact.name || contact.email)[0].toUpperCase()}
                </div>
                {contact.name || contact.email}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email (read-only) */}
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{contact.email}</span>
                <Badge variant="outline" className="ml-auto text-xs">Email (immutable)</Badge>
              </div>

              {/* Source (read-only) */}
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Source: </span>
                <Badge variant="outline" className="text-xs">{SOURCE_LABELS[contact.source] || contact.source}</Badge>
              </div>

              {/* Marketing status (read-only display) */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Marketing status: </span>
                <Badge variant="outline" className="text-xs capitalize">{contact.marketing_status}</Badge>
              </div>

              <Separator />

              {/* Editable: Name */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={200}
                  placeholder="No name set"
                />
              </div>

              {/* Editable: Attributes */}
              <div className="space-y-2">
                <Label>Attributes</Label>
                {attrRows.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="key"
                      value={row.key}
                      onChange={(e) => {
                        const next = [...attrRows];
                        next[i] = { ...row, key: e.target.value };
                        setAttrRows(next);
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder="value"
                      value={row.value}
                      onChange={(e) => {
                        const next = [...attrRows];
                        next[i] = { ...row, value: e.target.value };
                        setAttrRows(next);
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAttrRows(rows => rows.filter((_, idx) => idx !== i))}
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
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add field
                </Button>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save className="mr-1 h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  className="text-rose-600 hover:text-rose-700"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Timeline */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-emerald-600" /> Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <div className="space-y-3">
                  {contact.timeline.map((event, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5" />
                        {i < contact.timeline.length - 1 && (
                          <div className="w-px flex-1 bg-gray-200 dark:bg-gray-800" />
                        )}
                      </div>
                      <div className="flex-1 pb-2">
                        <p className="text-sm font-medium">{EVENT_LABELS[event.type] || event.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                        {Boolean(event.detail) && typeof event.detail === "object" && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {Object.entries(event.detail as Record<string, unknown>)
                              .map(([k, v]) => `${k}: ${String(v)}`)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardContent className="p-4 space-y-2 text-xs text-muted-foreground">
              <div>Created: {new Date(contact.created_at).toLocaleString()}</div>
              <div>Updated: {new Date(contact.updated_at).toLocaleString()}</div>
              <div>ID: {contact.id}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {contact.name || contact.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the contact and its contact timeline. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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
