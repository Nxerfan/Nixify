"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Activity, RefreshCw, Download, ChevronLeft, ChevronRight,
  Play, Pause, Search,
} from "lucide-react";

interface LogRow {
  id: number;
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ip: string | null;
  userAgent: string | null;
  error: string | null;
  createdAt: string;
}

interface LogPage {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  logs: LogRow[];
}

function statusClass(status: number): string {
  if (status >= 200 && status < 300) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (status >= 400 && status < 500) return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  if (status >= 500) return "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  return "bg-muted text-muted-foreground";
}

function durationClass(ms: number): string {
  if (ms < 500) return "text-emerald-600";
  if (ms < 2000) return "text-amber-600";
  return "text-rose-600";
}

function methodClass(method: string): string {
  const m: Record<string, string> = {
    GET: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    POST: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
    PATCH: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    PUT: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    DELETE: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  };
  return m[method.toUpperCase()] ?? "bg-muted text-muted-foreground";
}

export default function RequestLogsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState<LogPage | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "2xx" | "4xx" | "5xx">("all");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    try {
      const r = await fetch(`/api/admin/request-logs?${params}`);
      if (r.status === 401) { router.push("/auth"); return; }
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      toast({ title: "Failed to load logs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, router, toast]);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/request-logs?page=1&pageSize=50");
      if (r.status === 401) { router.push("/auth"); return; }
      setAuthChecked(true);
      try { setData(await r.json()); } catch { /* noop */ }
      setLoading(false);
    })();
  }, [router]);

  // Reload when filters/page change (after initial mount)
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    load();
  }, [page, pageSize, statusFilter, load]);

  // Auto-refresh every 5s
  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    intervalRef.current = setInterval(() => { load(); }, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, load]);

  if (!authChecked) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Skeleton className="h-8 w-8 rounded-full" /></div>;
  }

  function exportCsv() {
    const rows = data?.logs ?? [];
    if (rows.length === 0) { toast({ title: "Nothing to export", variant: "destructive" }); return; }
    const headers = ["timestamp", "requestId", "method", "path", "status", "durationMs", "ip", "userAgent", "error"];
    const csv = [
      headers.join(","),
      ...rows.map((r) => [
        new Date(r.createdAt).toISOString(),
        r.requestId,
        r.method,
        r.path,
        String(r.status),
        String(r.durationMs),
        r.ip ?? "",
        `"${(r.userAgent ?? "").replace(/"/g, '""')}"`,
        `"${(r.error ?? "").replace(/"/g, '""')}"`,
      ].join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `request-logs-page-${data?.page ?? 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported", description: `${rows.length} rows` });
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><Activity className="h-6 w-6 text-emerald-600" /> Request Logs</h1>
            <p className="text-sm text-muted-foreground">Live v1 API request stream with filters, pagination, and CSV export</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={autoRefresh} onCheckedChange={(v) => setAutoRefresh(v === true)} id="ar" />
            <span className="flex items-center gap-1">
              {autoRefresh ? <Play className="h-3 w-3 text-emerald-600" /> : <Pause className="h-3 w-3" />}
              Auto-refresh (5s)
            </span>
          </label>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="log-search" className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="log-search" placeholder="Request ID or path" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); load(); } }} className="w-56 pl-7" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1); }}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="2xx">2xx</SelectItem>
                  <SelectItem value="4xx">4xx</SelectItem>
                  <SelectItem value="5xx">5xx</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Page size</Label>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[25, 50, 100, 250].map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => { setPage(1); load(); }}><Search className="mr-1 h-4 w-4" /> Apply</Button>
            <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setPage(1); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? <Skeleton className="h-96 w-full" /> : (
            <>
              <div className="mb-3 text-sm text-muted-foreground">
                {data?.total ?? 0} requests — page {data?.page} of {data?.totalPages || 1}
              </div>
              <div className="max-h-[560px] overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 backdrop-blur">
                    <tr className="border-b text-left">
                      <th className="px-3 py-2 font-medium">Timestamp</th>
                      <th className="px-3 py-2 font-medium">Request ID</th>
                      <th className="px-3 py-2 font-medium">Method</th>
                      <th className="px-3 py-2 font-medium">Path</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium text-right">Duration</th>
                      <th className="px-3 py-2 font-medium">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.logs ?? []).length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No requests found.</td></tr>
                    ) : data?.logs.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-2 font-mono text-xs" title={r.requestId}>{r.requestId.slice(0, 8)}…</td>
                        <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${methodClass(r.method)}`}>{r.method}</span></td>
                        <td className="px-3 py-2 font-mono text-xs max-w-[260px] truncate" title={r.path}>{r.path}</td>
                        <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs font-bold ${statusClass(r.status)}`}>{r.status}</span></td>
                        <td className={`px-3 py-2 text-right font-mono text-xs ${durationClass(r.durationMs)}`}>{r.durationMs}ms</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.ip ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{data?.total ?? 0} total</div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={(data?.page ?? 1) <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">Page {data?.page ?? 1} / {data?.totalPages ?? 1}</span>
                  <Button size="sm" variant="outline" disabled={(data?.page ?? 0) >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
