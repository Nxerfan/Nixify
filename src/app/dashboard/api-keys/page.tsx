"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card, CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, KeyRound, Plus, Copy, Trash2, MoreHorizontal, Activity, Clock,
  CheckCircle2, AlertTriangle, RefreshCw,
} from "lucide-react";

/* ----------------------------- types & config ---------------------------- */

interface ApiKeyRow {
  id: number;
  prefix: string;
  name: string;
  environment: string;
  scopes: string;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  isRevoked: boolean;
  isExpired: boolean;
}

interface UsageBucket {
  success: number;
  client: number;
  server: number;
  total: number;
}

interface UsageData {
  last24h: UsageBucket;
  last7d: UsageBucket;
  allTime: UsageBucket;
}

type Plan = "FREE" | "PRO" | "MAX";

const PLAN_QUOTA: Record<Plan, number> = { FREE: 1, PRO: 5, MAX: 20 };
const NEXT_PLAN: Record<Plan, Plan | null> = { FREE: "PRO", PRO: "MAX", MAX: null };

/* ------------------------------- helpers ---------------------------------- */

function relativeTime(date: Date | string | null): string {
  if (!date) return "Never";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

/* ------------------------------ page component ---------------------------- */

export default function ApiKeysPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [authChecked, setAuthChecked] = useState(false);
  const [plan, setPlan] = useState<Plan>("FREE");
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"development" | "production">("development");
  const [scopes, setScopes] = useState<"full" | "read_only">("full");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Newly created key (reveal modal)
  const [newKey, setNewKey] = useState<string | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);

  // Revoke confirmation
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Expanded usage rows
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [usageMap, setUsageMap] = useState<Record<number, UsageData | null>>({});
  const [usageLoading, setUsageLoading] = useState<Record<number, boolean>>({});

  /* ------------------------------ data loading --------------------------- */

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/api-keys");
      if (r.status === 401) return;
      if (!r.ok) throw new Error();
      const data = await r.json();
      setKeys(data.keys ?? []);
    } catch {
      toast({ title: "Failed to load API keys", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    (async () => {
      const [profileRes, keysRes] = await Promise.all([
        fetch("/api/profile/me"),
        fetch("/api/admin/api-keys"),
      ]);

      // Both unauthenticated → send to /auth
      if (profileRes.status === 401 && keysRes.status === 401) {
        router.push("/auth");
        return;
      }

      // Admin cookie only (profile 401 but keys 200) → full access
      if (profileRes.status === 401 && keysRes.ok) {
        setPlan("MAX");
      } else if (profileRes.ok) {
        try {
          const profileData = await profileRes.json();
          const p = profileData?.user?.plan as Plan | undefined;
          setPlan(p && p in PLAN_QUOTA ? p : "FREE");
        } catch {
          setPlan("FREE");
        }
      }

      setAuthChecked(true);

      if (keysRes.ok) {
        try {
          const d = await keysRes.json();
          setKeys(d.keys ?? []);
        } catch {
          /* ignore */
        }
      }
      setLoading(false);
    })();
  }, [router]);

  /* ------------------------------- derived ------------------------------- */

  const quota = PLAN_QUOTA[plan];
  const activeCount = useMemo(
    () => keys.filter((k) => !k.isRevoked).length,
    [keys],
  );
  const quotaReached = activeCount >= quota;
  const pct = quota > 0 ? Math.min(100, Math.round((activeCount / quota) * 100)) : 0;
  const barColor =
    pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
  const barTrackColor =
    pct >= 100 ? "bg-rose-500/15" : pct >= 80 ? "bg-amber-500/15" : "bg-emerald-500/15";

  /* ------------------------------- actions ------------------------------- */

  async function createKey() {
    setFormError(null);
    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        environment,
        scopes,
      };
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();

      const r = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));

      if (r.status === 402) {
        setFormError("API key limit reached. Revoke unused keys or upgrade.");
        return;
      }
      if (r.status === 429) {
        setFormError("Too many key creations. Please wait a minute.");
        return;
      }
      if (!r.ok) {
        setFormError(d.message ?? "Failed to create key");
        return;
      }

      // Success → close create modal, reveal the key, refresh list
      setCreateOpen(false);
      setName("");
      setEnvironment("development");
      setScopes("full");
      setExpiresAt("");
      setNewKey(d.key ?? null);
      setRevealOpen(true);
      toast({ title: "API key created" });
      loadKeys();
    } catch {
      setFormError("Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const r = await fetch(`/api/admin/api-keys?id=${revokeTarget.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Revoke failed", description: d.message ?? r.statusText, variant: "destructive" });
        return;
      }
      toast({ title: "Key revoked" });
      setRevokeTarget(null);
      loadKeys();
    } catch {
      toast({ title: "Revoke failed", variant: "destructive" });
    } finally {
      setRevoking(false);
    }
  }

  async function toggleUsage(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (usageMap[id] !== undefined) return;
    setUsageLoading((m) => ({ ...m, [id]: true }));
    try {
      const r = await fetch(`/api/admin/api-keys/usage?id=${id}`);
      const d = await r.json().catch(() => ({}));
      setUsageMap((m) => ({
        ...m,
        [id]: r.ok
          ? {
              last24h: d.last24h ?? { success: 0, client: 0, server: 0, total: 0 },
              last7d: d.last7d ?? { success: 0, client: 0, server: 0, total: 0 },
              allTime: d.allTime ?? { success: 0, client: 0, server: 0, total: 0 },
            }
          : null,
      }));
    } catch {
      setUsageMap((m) => ({ ...m, [id]: null }));
    } finally {
      setUsageLoading((m) => ({ ...m, [id]: false }));
    }
  }

  async function copy(text: string, label = "Copied") {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: label });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }

  /* ------------------------------ rendering ------------------------------ */

  if (!authChecked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  const createDisabledTitle = quotaReached && NEXT_PLAN[plan]
    ? `Quota reached — revoke a key or upgrade to ${NEXT_PLAN[plan]}`
    : quotaReached
      ? "Quota reached — revoke a key to create a new one"
      : undefined;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit -ml-2 text-muted-foreground"
            onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <KeyRound className="h-6 w-6 text-emerald-600" /> API Keys
            </h1>
            <p className="text-sm text-muted-foreground">
              Generate, monitor, and revoke programmatic access keys
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadKeys} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={quotaReached}
            title={createDisabledTitle}
            onClick={() => {
              setFormError(null);
              setCreateOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Create New Key
          </Button>
        </div>
      </div>

      {/* Quota indicator */}
      <Card className="mb-6 overflow-hidden border-emerald-500/20">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Plan: </span>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                {plan}
              </Badge>
              <span className="text-muted-foreground">·</span>
              <span>
                <span className="font-semibold text-foreground">{activeCount}</span>
                <span className="text-muted-foreground"> / {quota} keys used</span>
              </span>
            </div>
            {quotaReached && (
              <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {NEXT_PLAN[plan]
                  ? `Quota reached — upgrade to ${NEXT_PLAN[plan]} for more`
                  : "All keys in use — revoke one to create a new key"}
              </span>
            )}
          </div>
          <div className={`mt-3 h-2 w-full overflow-hidden rounded-full ${barTrackColor}`}>
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Keys table OR empty state */}
      {loading ? (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      ) : keys.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <KeyRound className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">No API keys yet</h2>
              <p className="text-sm text-muted-foreground">
                Create your first API key to start integrating Nixify.
              </p>
            </div>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={quotaReached}
              title={createDisabledTitle}
              onClick={() => {
                setFormError(null);
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Create New Key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur">
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Prefix</th>
                    <th className="px-4 py-3 font-medium">Env</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium">Last Used</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => {
                    const isOpen = expandedId === k.id;
                    const statusLabel = k.isRevoked
                      ? "revoked"
                      : k.isExpired
                        ? "expired"
                        : "active";
                    const statusCls = k.isRevoked
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                      : k.isExpired
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
                    return (
                      <Fragment key={k.id}>
                        <tr className="border-b last:border-0 transition-colors hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <div className="truncate font-medium">{k.name}</div>
                                <div className="text-xs text-muted-foreground">{k.scopes}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <code className="font-mono text-xs text-muted-foreground">
                              {k.prefix}…
                            </code>
                          </td>
                          <td className="px-4 py-3">
                            {k.environment === "production" ? (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                prod
                              </span>
                            ) : (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                dev
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {relativeTime(k.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {k.lastUsedAt ? relativeTime(k.lastUsedAt) : "Never"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusCls}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Actions">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => toggleUsage(k.id)}>
                                  <Activity className="h-4 w-4" />
                                  {isOpen ? "Hide usage" : "View usage"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => copy(k.prefix, "Prefix copied")}>
                                  <Copy className="h-4 w-4" />
                                  Copy prefix
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={k.isRevoked}
                                  onClick={() => setRevokeTarget(k)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Revoke
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b last:border-0 bg-muted/20">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                <Activity className="h-3.5 w-3.5" /> Usage stats
                              </div>
                              {usageLoading[k.id] ? (
                                <Skeleton className="h-20 w-full" />
                              ) : usageMap[k.id] ? (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                  <UsageStat label="Last 24h" data={usageMap[k.id]!.last24h} />
                                  <UsageStat label="Last 7 days" data={usageMap[k.id]!.last7d} />
                                  <UsageStat label="All time" data={usageMap[k.id]!.allTime} />
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">Usage data unavailable.</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security tips */}
      <Alert className="mt-6 border-emerald-500/30 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Security tips</AlertTitle>
        <AlertDescription>
          <ul className="ml-4 list-disc space-y-1 text-sm">
            <li>
              Use <code className="font-mono">mg_test_</code> keys for development and CI;{" "}
              <code className="font-mono">mg_live_</code> only in production.
            </li>
            <li>Rotate keys quarterly. Revoke immediately if compromised.</li>
            <li>
              Use <code className="font-mono">read_only</code> scopes for analytics / dashboard
              integrations.
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Create modal */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setFormError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" /> Create API Key
            </DialogTitle>
            <DialogDescription>
              The full key is shown only once at creation. Store it securely.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ak-name">Name</Label>
              <Input
                id="ak-name"
                placeholder="Production server"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Environment</Label>
              <Select
                value={environment}
                onValueChange={(v) => setEnvironment(v as "development" | "production")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">development</SelectItem>
                  <SelectItem value="production">production</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Key will start with{" "}
                <code className="font-mono">
                  {environment === "production" ? "mg_live_" : "mg_test_"}
                </code>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Scopes</Label>
              <Select value={scopes} onValueChange={(v) => setScopes(v as "full" | "read_only")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">full — all endpoints</SelectItem>
                  <SelectItem value="read_only">read_only — GET only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ak-expires">Expiration (optional)</Label>
              <Input
                id="ak-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave blank for a non-expiring key.</p>
            </div>

            {formError && (
              <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setFormError(null);
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={createKey}
              disabled={creating || !name.trim()}
            >
              {creating ? "Creating…" : (
                <>
                  <Plus className="mr-2 h-4 w-4" /> Create key
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal modal */}
      <Dialog open={revealOpen} onOpenChange={setRevealOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Your API key
            </DialogTitle>
            <DialogDescription>
              Copy this key now. For security reasons, it will not be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="block flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-xs">
                {newKey}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => newKey && copy(newKey, "Key copied")}
              >
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy
              </Button>
            </div>

            <Alert className="border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                This key won&apos;t be shown again. Store it in a secure secret manager.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => {
                setRevealOpen(false);
                setNewKey(null);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.name ? (
                <>
                  You are about to revoke <span className="font-medium">{revokeTarget.name}</span>.
                </>
              ) : null}{" "}
              Any requests using this key will immediately stop working. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={(e) => {
                e.preventDefault();
                confirmRevoke();
              }}
              disabled={revoking}
            >
              {revoking ? "Revoking…" : "Revoke key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ----------------------------- sub-components ----------------------------- */

function UsageStat({ label, data }: { label: string; data: UsageBucket }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 text-xl font-bold text-emerald-600">{data.total}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="text-emerald-600">✓{data.success}</span>
        <span className="text-amber-600">·{data.client}</span>
        <span className="text-rose-600">✗{data.server}</span>
      </div>
    </div>
  );
}
