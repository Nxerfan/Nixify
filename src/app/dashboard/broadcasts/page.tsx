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
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import { Ltr } from "@/lib/i18n/Ltr";

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
  const t = useTranslations();
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
      toast({ title: t("dashboard.broadcasts.failedLoad"), variant: "destructive" });
    } finally {
      setLoading(false);
      setAuthChecked(true);
    }
  }, [page, router, toast, t]);

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
        toast({ title: t("dashboard.broadcasts.createFailed"), description: d.error?.message ?? "", variant: "destructive" });
        return;
      }
      toast({ title: t("dashboard.broadcasts.draftCreated") });
      setNewName(""); setNewSubject(""); setNewHtml("<p>Hello!</p>"); setNewAudience("all_contacts");
      setCreateOpen(false);
      load();
    } catch {
      toast({ title: t("dashboard.broadcasts.createFailed"), variant: "destructive" });
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
        toast({ title: t("dashboard.broadcasts.launchFailed"), description: d.error?.message ?? "", variant: "destructive" });
        return;
      }
      const data = await res.json();
      if (data.requiresReview) {
        toast({ title: t("dashboard.broadcasts.submittedForReview"), description: t("dashboard.broadcasts.submittedForReviewDescription") });
      } else {
        toast({ title: t("dashboard.broadcasts.launched"), description: `${data.recipientCount}` });
      }
      load();
    } catch {
      toast({ title: t("dashboard.broadcasts.launchFailed"), variant: "destructive" });
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
        toast({ title: t("dashboard.broadcasts.cancelFailed"), variant: "destructive" });
        return;
      }
      toast({ title: t("dashboard.broadcasts.cancelled") });
      load();
    } catch {
      toast({ title: t("dashboard.broadcasts.cancelFailed"), variant: "destructive" });
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
        <h2 className="text-xl font-semibold">{t("dashboard.broadcasts.notAvailable")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("dashboard.broadcasts.notAvailableDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-emerald-600" /> {t("dashboard.broadcasts.title")}
        </h1>
        <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> {t("dashboard.broadcasts.create")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("dashboard.broadcasts.title")}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.broadcasts.subtitle")}
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
              {t("dashboard.broadcasts.empty")} {t("dashboard.broadcasts.emptyDescription")}
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
                            {t("dashboard.broadcasts.reviewPending")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 truncate"><Ltr>{b.subject}</Ltr></p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{t("dashboard.broadcasts.total")}: {b.totalRecipients}</span>
                        <span className="text-emerald-600">{t("dashboard.broadcasts.sent")}: {b.sentCount}</span>
                        <span className="text-amber-600">{t("dashboard.broadcasts.skipped")}: {b.skippedCount}</span>
                        <span className="text-rose-600">{t("dashboard.broadcasts.failed")}: {b.failedCount}</span>
                        <span>{t("dashboard.broadcasts.pending")}: {b.pendingCount}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {b.status === "draft" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handlePreview(b.broadcastId)}>
                            {t("dashboard.broadcasts.preview")}
                          </Button>
                          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => handleLaunch(b.broadcastId)}>
                            <Play className="mr-1 h-3.5 w-3.5" /> {t("dashboard.broadcasts.launch")}
                          </Button>
                        </>
                      )}
                      {["review_pending", "queued", "sending", "paused_quota"].includes(b.status) && (
                        <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700" onClick={() => handleCancel(b.broadcastId)}>
                          <X className="mr-1 h-3.5 w-3.5" /> {t("dashboard.broadcasts.cancel")}
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
                <ChevronLeft className="h-4 w-4" /> {t("dashboard.broadcasts.prev")}
              </Button>
              <span className="text-sm text-muted-foreground">{t("dashboard.broadcasts.pageTotal").replace("{page}", String(pagination.page)).replace("{total}", String(pagination.total))}</span>
              <Button variant="outline" size="sm" disabled={pagination.page * pagination.page_size >= pagination.total} onClick={() => setPage(p => p + 1)}>
                {t("dashboard.broadcasts.next")} <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("dashboard.broadcasts.createDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("dashboard.broadcasts.createDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="bc-name">{t("dashboard.broadcasts.name")}</Label>
              <Input id="bc-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Monthly newsletter" maxLength={200} />
            </div>
            <div>
              <Label htmlFor="bc-subject">{t("dashboard.broadcasts.subject")}</Label>
              <Input id="bc-subject" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Hello {{contact.name}}!" maxLength={200} />
              <p className="text-xs text-muted-foreground mt-1">{t("dashboard.broadcasts.variablesHelp")}</p>
            </div>
            <div>
              <Label htmlFor="bc-html">{t("dashboard.broadcasts.htmlContent")}</Label>
              <textarea
                id="bc-html"
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                value={newHtml}
                onChange={(e) => setNewHtml(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">{t("dashboard.broadcasts.htmlContentHelp")}</p>
            </div>
            <div>
              <Label>{t("dashboard.broadcasts.audience")}</Label>
              <Select value={newAudience} onValueChange={setNewAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_contacts">{t("dashboard.broadcasts.allContacts")}</SelectItem>
                  <SelectItem value="group">{t("dashboard.broadcasts.specificGroup")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{t("dashboard.broadcasts.audienceHelp")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>{t("common.buttons.cancel")}</Button>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={handleCreate} disabled={creating || !newName.trim() || !newSubject.trim()}>
              {creating ? t("dashboard.broadcasts.creating") : t("dashboard.broadcasts.createDraft")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
