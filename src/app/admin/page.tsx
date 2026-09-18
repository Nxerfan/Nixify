"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ShieldAlert,
  ShieldCheck,
  Ban,
  Lock,
  Unlock,
  Trash2,
  Plus,
  RefreshCw,
  LogOut,
  Users,
  Activity,
  Eye,
  MailX,
  BarChart3,
  ChevronDown,
  KeyRound,
  Webhook,
  ScrollText,
  FlaskConical,
  BookOpen,
  AlertCircle,
  Terminal,
} from "lucide-react";

interface Stats {
  totals: {
    users: number;
    lockedAccounts: number;
    activeIpBlocks: number;
    disposableDomainsBlocked: number;
    securityEvents24h: number;
    otpsIssued24h: number;
    otpsVerified24h: number;
  };
  recentEvents: Array<{
    id: number;
    type: string;
    ip: string | null;
    email: string | null;
    fingerprint: string | null;
    detail: string | null;
    createdAt: string;
  }>;
}

interface IpBlock {
  id: number;
  ip: string;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
  permanent: boolean;
}
interface DisposableLists {
  block: Array<{ domain: string; source: string }>;
  allow: Array<{ domain: string; source: string }>;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [authChecked, setAuthChecked] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<Stats["recentEvents"]>([]);
  const [ipBlocks, setIpBlocks] = useState<IpBlock[]>([]);
  const [disposable, setDisposable] = useState<DisposableLists>({
    block: [],
    allow: [],
  });
  const [loading, setLoading] = useState(true);

  const [newIp, setNewIp] = useState("");
  const [newIpReason, setNewIpReason] = useState("admin");
  const [newIpPermanent, setNewIpPermanent] = useState(false);
  const [lockEmail, setLockEmail] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newDomainType, setNewDomainType] = useState<"block" | "allow">(
    "block",
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, e, ip, d] = await Promise.all([
        fetch("/api/admin/stats").then((r) =>
          r.ok ? r.json() : Promise.reject(r.status),
        ),
        fetch("/api/admin/events?take=50").then((r) =>
          r.ok ? r.json() : Promise.reject(r.status),
        ),
        fetch("/api/admin/ip-blocks").then((r) =>
          r.ok ? r.json() : Promise.reject(r.status),
        ),
        fetch("/api/admin/disposable").then((r) =>
          r.ok ? r.json() : Promise.reject(r.status),
        ),
      ]);
      setStats(s);
      setEvents(e.events ?? []);
      setIpBlocks(ip.blocks ?? []);
      setDisposable(d);
    } catch (status: any) {
      if (status === 401) router.push("/admin/login");
      else toast({ title: "Failed to load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/stats");
      if (r.status === 401) {
        router.push("/admin/login");
        return;
      }
      setAuthChecked(true);
      await loadAll();
    })();
  }, [loadAll, router]);

  if (!authChecked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  async function api(path: string, opts: RequestInit = {}) {
    const r = await fetch(path, opts);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast({
        title: "Action failed",
        description: d.message ?? r.statusText,
        variant: "destructive",
      });
      return false;
    }
    toast({ title: d.message ?? "Done" });
    return true;
  }

  async function addIpBlock() {
    if (!newIp.trim()) return;
    const ok = await api("/api/admin/ip-blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ip: newIp.trim(),
        reason: newIpReason,
        permanent: newIpPermanent,
      }),
    });
    if (ok) {
      setNewIp("");
      setNewIpReason("admin");
      setNewIpPermanent(false);
      loadAll();
    }
  }
  async function removeIpBlock(ip: string) {
    if (
      await api(`/api/admin/ip-blocks?ip=${encodeURIComponent(ip)}`, {
        method: "DELETE",
      })
    )
      loadAll();
  }
  async function lockOrUnlock(action: "lock" | "unlock") {
    if (!lockEmail.trim()) return;
    if (
      await api("/api/admin/account-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: lockEmail.trim(), action }),
      })
    )
      setLockEmail("");
  }
  async function addDomain() {
    if (!newDomain.trim()) return;
    if (
      await api("/api/admin/disposable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: newDomain.trim(),
          listType: newDomainType,
        }),
      })
    ) {
      setNewDomain("");
      loadAll();
    }
  }
  async function removeDomain(domain: string) {
    if (
      await api(`/api/admin/disposable?domain=${encodeURIComponent(domain)}`, {
        method: "DELETE",
      })
    )
      loadAll();
  }
  async function logout() {
    await api("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldAlert className="h-6 w-6 text-rose-600" /> Security Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Deterministic, rule-based abuse protection console
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/analytics")}
          >
            <BarChart3 className="mr-2 h-4 w-4" /> Analytics
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Terminal className="mr-2 h-4 w-4" /> Developer
                <ChevronDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>DX Tools</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/api-keys")}
              >
                <KeyRound className="mr-2 h-4 w-4" /> API Keys
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/webhooks")}
              >
                <Webhook className="mr-2 h-4 w-4" /> Webhooks
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/logs")}>
                <ScrollText className="mr-2 h-4 w-4" /> Request Logs
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/playground")}
              >
                <FlaskConical className="mr-2 h-4 w-4" /> API Playground
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/dashboard/docs")}>
                <BookOpen className="mr-2 h-4 w-4" /> Documentation
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/errors")}
              >
                <AlertCircle className="mr-2 h-4 w-4" /> Error Explorer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAll}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
        <StatCard
          label="Users"
          value={stats?.totals.users}
          icon={<Users className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Locked accounts"
          value={stats?.totals.lockedAccounts}
          icon={<Lock className="h-4 w-4" />}
          loading={loading}
          tone="amber"
        />
        <StatCard
          label="Active IP blocks"
          value={stats?.totals.activeIpBlocks}
          icon={<Ban className="h-4 w-4" />}
          loading={loading}
          tone="rose"
        />
        <StatCard
          label="Disposable domains"
          value={stats?.totals.disposableDomainsBlocked}
          icon={<MailX className="h-4 w-4" />}
          loading={loading}
          tone="rose"
        />
        <StatCard
          label="Security events (24h)"
          value={stats?.totals.securityEvents24h}
          icon={<ShieldAlert className="h-4 w-4" />}
          loading={loading}
          tone="amber"
        />
        <StatCard
          label="OTPs issued (24h)"
          value={stats?.totals.otpsIssued24h}
          icon={<Activity className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="OTPs verified (24h)"
          value={stats?.totals.otpsVerified24h}
          icon={<ShieldCheck className="h-4 w-4" />}
          loading={loading}
          tone="emerald"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* IP blocks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5" /> IP Blocks
            </CardTitle>
            <CardDescription>Auto + admin-set blocked IPs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="1.2.3.4"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                className="w-32"
              />
              <Input
                placeholder="reason"
                value={newIpReason}
                onChange={(e) => setNewIpReason(e.target.value)}
                className="w-40"
              />
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={newIpPermanent}
                  onChange={(e) => setNewIpPermanent(e.target.checked)}
                />{" "}
                permanent
              </label>
              <Button size="sm" onClick={addIpBlock}>
                <Plus className="mr-1 h-4 w-4" /> Block
              </Button>
            </div>
            <div className="max-h-64 overflow-auto rounded border">
              {ipBlocks.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  No active IP blocks.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {ipBlocks.map((b) => (
                      <tr key={b.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-mono">{b.ip}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {b.reason}
                        </td>
                        <td className="px-3 py-2">
                          {b.permanent ? (
                            <Badge variant="destructive">permanent</Badge>
                          ) : (
                            <Badge variant="secondary">
                              {new Date(b.expiresAt!).toLocaleString()}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeIpBlock(b.ip)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account locks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Account Lock
            </CardTitle>
            <CardDescription>Manual lock / unlock by email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="user@example.com"
                value={lockEmail}
                onChange={(e) => setLockEmail(e.target.value)}
                className="flex-1 min-w-[200px]"
              />
              <Button
                size="sm"
                variant="destructive"
                onClick={() => lockOrUnlock("lock")}
              >
                <Lock className="mr-1 h-4 w-4" /> Lock
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => lockOrUnlock("unlock")}
              >
                <Unlock className="mr-1 h-4 w-4" /> Unlock
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Locked accounts cannot complete OTP verification until unlocked or
              the auto-expiry passes. Brute-force lockouts are applied
              automatically after {10} failed verifies.
            </p>
          </CardContent>
        </Card>

        {/* Disposable domains */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailX className="h-5 w-5" /> Disposable Email Lists
            </CardTitle>
            <CardDescription>Blocklist + allowlist management</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="domain.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="w-40"
              />
              <select
                value={newDomainType}
                onChange={(e) => setNewDomainType(e.target.value as any)}
                className="h-9 rounded border bg-background px-2 text-sm"
              >
                <option value="block">block</option>
                <option value="allow">allow</option>
              </select>
              <Button size="sm" onClick={addDomain}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
            <div className="max-h-48 overflow-auto rounded border">
              <table className="w-full text-sm">
                <tbody>
                  {disposable.block.map((d) => (
                    <tr key={d.domain} className="border-b last:border-0">
                      <td className="px-3 py-1.5">
                        <Badge variant="destructive" className="mr-2">
                          block
                        </Badge>
                        {d.domain}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeDomain(d.domain)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {disposable.allow.map((d) => (
                    <tr key={d.domain} className="border-b last:border-0">
                      <td className="px-3 py-1.5">
                        <Badge className="mr-2 bg-emerald-600">allow</Badge>
                        {d.domain}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeDomain(d.domain)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Security events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" /> Security Event Log
            </CardTitle>
            <CardDescription>Recent 50 events (newest first)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-auto rounded border">
              {events.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No events.</p>
              ) : (
                <table className="w-full text-xs">
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="px-2 py-1.5 align-top">
                          <Badge variant="outline" className="font-mono">
                            {e.type}
                          </Badge>
                        </td>
                        <td className="px-2 py-1.5 align-top text-muted-foreground">
                          {e.ip && <span className="font-mono">{e.ip} </span>}
                          {e.email && <span>{e.email} </span>}
                          {e.detail && (
                            <span className="text-foreground/70">
                              — {e.detail}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 align-top whitespace-nowrap text-muted-foreground">
                          {new Date(e.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  loading,
  tone,
}: {
  label: string;
  value?: number;
  icon: React.ReactNode;
  loading: boolean;
  tone?: "rose" | "amber" | "emerald";
}) {
  const toneClass =
    tone === "rose"
      ? "text-rose-600"
      : tone === "amber"
        ? "text-amber-600"
        : tone === "emerald"
          ? "text-emerald-600"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={toneClass}>{icon}</span>
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-6 w-12" />
        ) : (
          <div className={`mt-1 text-2xl font-bold ${toneClass}`}>
            {value ?? 0}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
