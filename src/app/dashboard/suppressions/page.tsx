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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldOff, ChevronLeft, ChevronRight, Search, Plus, ShieldAlert,
} from "lucide-react";

interface SuppressionEntry {
  id: number;
  suppression_id: string;
  email: string;
  reason: string;
  source: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  lifted_at: string | null;
}

interface Pagination {
  page: number;
  page_size: number;
  total: number;
}

const REASON_LABELS: Record<string, string> = {
  unsubscribe: "Unsubscribe",
  manual: "Manual",
  hard_bounce: "Hard bounce",
  complaint: "Complaint",
};

const SOURCE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  api: "API",
  unsubscribe: "Unsubscribe link",
  system: "System",
};

export default function SuppressionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [authChecked, setAuthChecked] = useState(false);
  const [entitled, setEntitled] = useState(true);
  const [entries, setEntries] = useState<SuppressionEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [liftTarget, setLiftTarget] = useState<SuppressionEntry | null>(null);
  const [liftAlsoSubscribe, setLiftAlsoSubscribe] = useState(false);
  const [lifting, setLifting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search) params.set("search", search);
      if (activeOnly) params.set("activeOnly", "true");
      const res = await fetch(`/api/dashboard/suppressions?${params}`);
      if (res.status === 401) { router.push("/auth"); return; }
      if (res.status === 403) { setEntitled(false); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries(data.suppressions ?? []);
      setPagination({ page: data.page, page_size: data.page_size, total: data.total });
    } catch {
      toast({ title: "Failed to load suppressions", variant: "destructive" });
    } finally {
      setLoading(false);
      setAuthChecked(true);
    }
  }, [page, search, activeOnly, router, toast]);

  useEffect(() => { load(); }, [load]);

  // Debounced search input → search
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, search]);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch(`/api/dashboard/suppressions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), reason: "manual" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Failed to suppress", description: d.error?.message ?? "", variant: "destructive" });
        return;
      }
      toast({ title: "Suppression added" });
      setNewEmail("");
      setCreateOpen(false);
      load();
    } catch {
      toast({ title: "Failed to suppress", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function handleLift() {
    if (!liftTarget) return;
    setLifting(true);
    try {
      const res = await fetch(`/api/dashboard/suppressions/${liftTarget.suppression_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ also_subscribe: liftAlsoSubscribe }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Failed to lift suppression", description: d.error?.message ?? "", variant: "destructive" });
        return;
      }
      toast({ title: liftAlsoSubscribe ? "Suppression lifted + contact subscribed" : "Suppression lifted" });
      setLiftTarget(null);
      setLiftAlsoSubscribe(false);
      load();
    } catch {
      toast({ title: "Failed to lift suppression", variant: "destructive" });
    } finally {
      setLifting(false);
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
        <h2 className="text-xl font-semibold">Contacts not available</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Suppression management is part of the Contacts capability, which is not available on your current plan.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Suppressions</h1>
        <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Suppress email
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Marketing suppression list</CardTitle>
          <p className="text-xs text-muted-foreground">
            Suppressed emails are excluded from marketing eligibility, regardless of their marketing consent status.
            Transactional emails (OTP, password reset, security) are NOT affected by suppression.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant={activeOnly ? "default" : "outline"}
              size="sm"
              onClick={() => { setActiveOnly(!activeOnly); setPage(1); }}
              className={activeOnly ? "bg-emerald-600 text-white hover:bg-emerald-500" : ""}
            >
              {activeOnly ? "Showing active only" : "Showing all"}
            </Button>
          </div>

          <Separator />

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No suppressions found. Add one above or change the filter.
            </p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-mono text-sm">{entry.email}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {REASON_LABELS[entry.reason] ?? entry.reason}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        via {SOURCE_LABELS[entry.source] ?? entry.source}
                      </Badge>
                      {entry.active ? (
                        <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-700 border-rose-500/30">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-slate-500/10 text-slate-700 border-slate-500/30">
                          Lifted
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {new Date(entry.created_at).toLocaleString()}
                      {entry.lifted_at && ` · Lifted ${new Date(entry.lifted_at).toLocaleString()}`}
                    </p>
                  </div>
                  {entry.active && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLiftTarget(entry)}
                    >
                      <ShieldOff className="mr-1 h-3.5 w-3.5" /> Lift
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.total > pagination.page_size && (
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} · {pagination.total} total
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page * pagination.page_size >= pagination.total}
                onClick={() => setPage(p => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add manual suppression</DialogTitle>
            <DialogDescription>
              Suppress an email from marketing. The contact matching this email (if any) will also be unsubscribed.
              Existing transactional messages are not affected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="sup-email">Email</Label>
            <Input
              id="sup-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="user@example.com"
              maxLength={254}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={handleCreate}
              disabled={creating || !newEmail.trim()}
            >
              {creating ? "Suppressing…" : "Suppress"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lift confirmation */}
      <AlertDialog open={!!liftTarget} onOpenChange={(o) => { if (!o) { setLiftTarget(null); setLiftAlsoSubscribe(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Lift suppression for {liftTarget?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This deactivates the suppression entry. Lifting alone does NOT resubscribe the contact —
              to also explicitly subscribe, check the box below. The contact will then become eligible
              for marketing messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              id="also-subscribe"
              checked={liftAlsoSubscribe}
              onChange={(e) => setLiftAlsoSubscribe(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="also-subscribe" className="text-sm cursor-pointer">
              Also subscribe this contact to marketing (explicit consent)
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={lifting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={liftAlsoSubscribe ? "bg-emerald-600 text-white hover:bg-emerald-500" : "bg-rose-600 text-white hover:bg-rose-500"}
              onClick={handleLift}
              disabled={lifting}
            >
              {lifting ? "Lifting…" : "Lift suppression"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
