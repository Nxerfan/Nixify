"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Megaphone, Users, ShieldOff, ChevronLeft, ChevronRight, Play, X,
} from "lucide-react";

interface Broadcast {
  id: number;
  broadcastId: string;
  name: string;
  subject: string;
  status: string;
  reviewStatus: string;
  totalRecipients: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  pendingCount: number;
  createdAt: string;
}

interface Pagination { page: number; page_size: number; total: number; }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  review_pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  queued: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  sending: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  paused_quota: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  completed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  cancelled: "bg-rose-500/10 text-rose-700 border-rose-500/30",
  rejected: "bg-rose-500/10 text-rose-700 border-rose-500/30",
  failed: "bg-rose-500/10 text-rose-700 border-rose-500/30",
};

export default function BroadcastsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [authChecked, setAuthChecked] = useState(false);
  const [entitled, setEntitled] = useState(true);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newHtml, setNewHtml] = useState("<p>Hello {{contact.name}}!</p>\n<p>Welcome to our newsletter.</p>");
  const [newAudience, setNewAudience] = useState("all_contacts");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      const res = await fetch(`/api/dashboard/broadcasts?${params}`);
      if (res.status === 401) { router.push("/auth"); return; }
      if (res.status === 403) { setEntitled(false); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBroadcasts(data.broadcasts ?? []);
      setPagination({ page: data.page, page_size: data.page_size, total: data.total });
    } catch {
      toast({ title: "Failed to load broadcasts", variant: "destructive" });
    } finally {
      setLoading(false);
      setAuthChecked(true);
    }
  }, [page, router, toast]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/dashboard/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          subject: newSubject.trim(),
          htmlContent: newHtml,
          audienceType: newAudience,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Create failed", description: d.error?.message ?? "", variant: "destructive" });
        return;
      }
      toast({ title: "Broadcast draft created" });
      setNewName(""); setNewSubject(""); setNewHtml("<p>Hello!</p>"); setNewAudience("all_contacts");
      setCreateOpen(false);
      load();
    } catch {
      toast({ title: "Create failed", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function handleLaunch(broadcastId: string) {
    try {
      const res = await fetch(`/api/dashboard/broadcasts/${broadcastId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Launch failed", description: d.error?.message ?? "", variant: "destructive" });
        return;
      }
      const data = await res.json();
      if (data.requiresReview) {
        toast({ title: "Broadcast submitted for admin review", description: `Recipient count exceeds review threshold.` });
      } else {
        toast({ title: "Broadcast launched", description: `${data.recipientCount} recipients` });
      }
      load();
    } catch {
      toast({ title: "Launch failed", variant: "destructive" });
    }
  }

  async function handleCancel(broadcastId: string) {
    try {
      const res = await fetch(`/api/dashboard/broadcasts/${broadcastId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        toast({ title: "Cancel failed", variant: "destructive" });
        return;
      }
      toast({ title: "Broadcast cancelled" });
      load();
    } catch {
      toast({ title: "Cancel failed", variant: "destructive" });
    }
  }

  async function handlePreview(broadcastId: string) {
    try {
      const res = await fetch(`/api/dashboard/broadcasts/${broadcastId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        toast({ title: "Preview failed", variant: "destructive" });
        return;
      }
      const data = await res.json();
      toast({
        title: "Audience preview",
        description: `Total: ${data.total} · Eligible: ${data.eligible} · Unknown: ${data.unknown} · Unsubscribed: ${data.unsubscribed} · Suppressed: ${data.suppressed}`,
      });
    } catch {
      toast({ title: "Preview failed", variant: "destructive" });
    }
  }

  if (!authChecked) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!entitled) {
    return (
      <div className="container mx-auto max-w-2xl py-20 text-center">
        <h2 className="text-xl font-semibold">Broadcasts not available</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Broadcasts are part of the Contacts capability, which is not available on your current plan.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-emerald-600" /> Broadcasts
        </h1>
        <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> New broadcast
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Marketing campaigns</CardTitle>
          <p className="text-xs text-muted-foreground">
            Only explicitly subscribed, non-suppressed contacts can receive broadcasts. Audience membership is snapshotted at launch. Consent is re-checked at send time.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : broadcasts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No broadcasts yet. Create one above.
            </p>
          ) : (
            <div className="space-y-2">
              {broadcasts.map((b) => (
                <div key={b.broadcastId} className="rounded-md border p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{b.name}</span>
                        <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[b.status] ?? ""}`}>
                          {b.status.replace(/_/g, " ")}
                        </Badge>
                        {b.reviewStatus === "pending" && (
                          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/30">
                            Review pending
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 truncate">{b.subject}</p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Total: {b.totalRecipients}</span>
                        <span className="text-emerald-600">Sent: {b.sentCount}</span>
                        <span className="text-amber-600">Skipped: {b.skippedCount}</span>
                        <span className="text-rose-600">Failed: {b.failedCount}</span>
                        <span>Pending: {b.pendingCount}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {b.status === "draft" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handlePreview(b.broadcastId)}>
                            Preview
                          </Button>
                          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => handleLaunch(b.broadcastId)}>
                            <Play className="mr-1 h-3.5 w-3.5" /> Launch
                          </Button>
                        </>
                      )}
                      {["review_pending", "queued", "sending", "paused_quota"].includes(b.status) && (
                        <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700" onClick={() => handleCancel(b.broadcastId)}>
                          <X className="mr-1 h-3.5 w-3.5" /> Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pagination && pagination.total > pagination.page_size && (
            <div className="flex items-center justify-between pt-4">
              <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="text-sm text-muted-foreground">Page {pagination.page} · {pagination.total} total</span>
              <Button variant="outline" size="sm" disabled={pagination.page * pagination.page_size >= pagination.total} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New broadcast</DialogTitle>
            <DialogDescription>
              Create a draft broadcast. You can preview the audience and launch when ready.
              Every recipient will receive an unsubscribe footer automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="bc-name">Name</Label>
              <Input id="bc-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Monthly newsletter" maxLength={200} />
            </div>
            <div>
              <Label htmlFor="bc-subject">Subject</Label>
              <Input id="bc-subject" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Hello {{contact.name}}!" maxLength={200} />
              <p className="text-xs text-muted-foreground mt-1">Variables: {"{{contact.name}}"}, {"{{contact.email}}"}, {"{{unsubscribe_url}}"}</p>
            </div>
            <div>
              <Label htmlFor="bc-html">HTML content</Label>
              <textarea
                id="bc-html"
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                value={newHtml}
                onChange={(e) => setNewHtml(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">An unsubscribe footer is automatically appended if not present.</p>
            </div>
            <div>
              <Label>Audience</Label>
              <Select value={newAudience} onValueChange={setNewAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_contacts">All contacts</SelectItem>
                  <SelectItem value="group">Specific group</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Only subscribed, non-suppressed contacts will receive the broadcast.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={handleCreate} disabled={creating || !newName.trim() || !newSubject.trim()}>
              {creating ? "Creating..." : "Create draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
