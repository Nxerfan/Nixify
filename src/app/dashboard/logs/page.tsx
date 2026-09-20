/* eslint-disable react-hooks/set-state-in-effect --
 * Pre-existing async data-fetch pattern: setState occurs inside async callbacks
 * (.then / await), not synchronously in the effect body. Upgrading
 * eslint-plugin-react-hooks to 7.1.1 (Phase 12 dependency refresh) introduced
 * these rules which false-positive on async setState and pre-existing useMemo.
 * Fixing would require unrelated product redesign.
 */
"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRelativeTime } from "@/lib/i18n/relative-time";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Activity, RefreshCw, Search, ChevronLeft, ChevronRight, RotateCw, Webhook, FileJson,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

/* --------------------------------- types --------------------------------- */

interface RequestLogRow {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface EventRow {
  eventId: string;
  type: string;
  email: string;
  environment: string;
  createdAt: string;
}

interface EventDetail extends EventRow {
  data: unknown;
  contactId: number | null;
}

interface WebhookDeliveryRow {
  deliveryId: string;
  endpointId: number;
  eventId: string;
  status: string;
  attempts: number;
  responseCode: number | null;
  createdAt: string;
  deliveredAt: string | null;
  lastError: string | null;
}

interface EndpointOption {
  id: number;
  url: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/* ------------------------------- helpers --------------------------------- */

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function methodClass(method: string): string {
  const m: Record<string, string> = {
    GET: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    POST: "border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
    PATCH: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    PUT: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    DELETE: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  };
  return m[method.toUpperCase()] ?? "text-muted-foreground";
}

function statusClass(status: number): string {
  if (status >= 200 && status < 300) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
  if (status >= 400 && status < 500) return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300";
  if (status >= 500) return "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300";
  return "text-muted-foreground";
}

function durationClass(ms: number): string {
  if (ms < 500) return "text-emerald-600";
  if (ms < 2000) return "text-amber-600";
  return "text-rose-600";
}

function deliveryStatusBadge(status: string) {
  if (status === "delivered") {
    return <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">{status}</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300">{status}</Badge>;
  }
  return <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300">{status}</Badge>;
}

function relativeTime(date: string | null, locale: "en" | "fa" = "en"): string {
  if (!date) return "—";
  try {
    return formatRelativeTime(date);
  } catch {
    return "—";
  }
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "null");
  }
}

function maskShort(text: string, max = 36): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message ?? res.statusText ?? "Request failed";
  } catch {
    return res.statusText ?? "Request failed";
  }
}

/* ============================ Logs Page =================================== */

export default function LogsPage() {
  const router = useRouter();
  const t = useTranslations();
  const { locale } = useLocale();
  const [authChecked, setAuthChecked] = useState(false);

  // Preload endpoint options for the Webhooks tab filter dropdown.
  const [endpointOptions, setEndpointOptions] = useState<EndpointOption[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/dashboard/webhooks?pageSize=100");
        if (res.status === 401) { router.push("/auth"); return; }
        if (res.ok) {
          const data = await res.json();
          setEndpointOptions(data.endpoints ?? []);
        }
      } catch {
        // Non-fatal — the endpoint filter just won't show labels.
      }
      setAuthChecked(true);
    })();
  }, [router]);

  if (!authChecked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
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
              <Activity className="h-6 w-6 text-emerald-600" /> {t("dashboard.logs.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.logs.subtitle")}
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="h-9">
          <TabsTrigger value="requests">{t("dashboard.logs.tabApiRequests")}</TabsTrigger>
          <TabsTrigger value="events">{t("dashboard.logs.tabEvents")}</TabsTrigger>
          <TabsTrigger value="webhooks">{t("dashboard.logs.tabWebhooks")}</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <RequestsTab />
        </TabsContent>
        <TabsContent value="events" className="mt-4">
          <EventsTab />
        </TabsContent>
        <TabsContent value="webhooks" className="mt-4">
          <WebhooksTab endpointOptions={endpointOptions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================ API Requests tab =========================== */

function RequestsTab() {
  const router = useRouter();
  const t = useTranslations();
  const [data, setData] = useState<RequestLogRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [pathSearch, setPathSearch] = useState("");
  const [pathSearchInput, setPathSearchInput] = useState("");
  const [statusBand, setStatusBand] = useState<string>("all");
  const [environment, setEnvironment] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (methodFilter !== "all") params.set("method", methodFilter);
      if (pathSearch) params.set("path", pathSearch);
      if (statusBand !== "all") params.set("status", statusBand);
      if (environment !== "all") params.set("environment", environment);
      const res = await fetch(`/api/dashboard/logs/requests?${params}`);
      if (res.status === 401) { router.push("/auth"); return; }
      if (!res.ok) {
        toast.error(t("dashboard.logs.apiRequestsTitle"), { description: await readError(res) });
        return;
      }
      const json = await res.json();
      setData(json.logs ?? []);
      setPagination(json.pagination ?? null);
    } catch {
      toast.error(t("dashboard.logs.apiRequestsTitle"));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, methodFilter, pathSearch, statusBand, environment, router]);

  useEffect(() => { load(); }, [load]);

  function applySearch() {
    if (pathSearchInput !== pathSearch) {
      setPathSearch(pathSearchInput);
      setPage(1);
    }
  }

  function clearFilters() {
    setMethodFilter("all");
    setPathSearch("");
    setPathSearchInput("");
    setStatusBand("all");
    setEnvironment("all");
    setPage(1);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t("dashboard.logs.apiRequestsTitle")}</CardTitle>
            <CardDescription>
              {t("dashboard.logs.apiRequestsDescription")}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {t("dashboard.common.refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("dashboard.common.path")}</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("dashboard.logs.searchPathPlaceholder")}
                value={pathSearchInput}
                onChange={(e) => setPathSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }}
                className="w-56 pl-7 text-sm"
                maxLength={200}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("dashboard.common.method")}</Label>
            <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(1); }}>
              <SelectTrigger className="w-28 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.common.all")}</SelectItem>
                {["GET", "POST", "PATCH", "PUT", "DELETE"].map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("dashboard.common.status")}</Label>
            <Select value={statusBand} onValueChange={(v) => { setStatusBand(v); setPage(1); }}>
              <SelectTrigger className="w-28 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.common.all")}</SelectItem>
                <SelectItem value="2xx">2xx</SelectItem>
                <SelectItem value="4xx">4xx</SelectItem>
                <SelectItem value="5xx">5xx</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("dashboard.common.environment")}</Label>
            <Select value={environment} onValueChange={(v) => { setEnvironment(v); setPage(1); }}>
              <SelectTrigger className="w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.common.all")}</SelectItem>
                <SelectItem value="development">development</SelectItem>
                <SelectItem value="production">production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={applySearch}>
            <Search className="mr-1 h-3.5 w-3.5" /> {t("dashboard.common.apply")}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearFilters}>{t("dashboard.common.clear")}</Button>
        </div>

        {/* Table */}
        {loading ? (
          <Skeleton className="h-80 w-full" />
        ) : data.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            {t("dashboard.logs.emptyRequests")}
          </div>
        ) : (
          <Fragment>
            <div className="max-h-[32rem] overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur">
                  <TableRow>
                    <TableHead className="pl-4">{t("dashboard.logs.columnTime")}</TableHead>
                    <TableHead>{t("dashboard.logs.columnRequestId")}</TableHead>
                    <TableHead>{t("dashboard.common.method")}</TableHead>
                    <TableHead>{t("dashboard.common.path")}</TableHead>
                    <TableHead>{t("dashboard.common.status")}</TableHead>
                    <TableHead className="text-right">{t("dashboard.common.duration")}</TableHead>
                    <TableHead className="pr-4">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((r) => (
                    <TableRow key={r.requestId}>
                      <TableCell className="pl-4 text-xs text-muted-foreground whitespace-nowrap">
                        {relativeTime(r.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono text-xs" title={r.requestId}>
                        {r.requestId.slice(0, 8)}…
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-mono text-[10px] ${methodClass(r.method)}`}>
                          {r.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[260px] truncate" title={r.path}>
                        {r.path}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-mono text-[10px] ${statusClass(r.status)}`}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-mono text-xs ${durationClass(r.durationMs)}`}>
                        {r.durationMs}ms
                      </TableCell>
                      <TableCell className="pr-4 font-mono text-xs text-muted-foreground">
                        {r.ip ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <PaginationBar
              pagination={pagination}
              page={page}
              pageSize={pageSize}
              setPage={setPage}
              setPageSize={(s) => { setPageSize(s); setPage(1); }}
            />
          </Fragment>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================ Events tab ================================= */

function EventsTab() {
  const router = useRouter();
  const t = useTranslations();
  const [data, setData] = useState<EventRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [emailSearch, setEmailSearch] = useState("");
  const [emailSearchInput, setEmailSearchInput] = useState("");
  const [environment, setEnvironment] = useState<string>("all");

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (emailSearch) params.set("email", emailSearch);
      if (environment !== "all") params.set("environment", environment);
      const res = await fetch(`/api/dashboard/logs/events?${params}`);
      if (res.status === 401) { router.push("/auth"); return; }
      if (!res.ok) {
        toast.error(t("dashboard.common.inboundEvents"), { description: await readError(res) });
        return;
      }
      const json = await res.json();
      setData(json.events ?? []);
      setPagination(json.pagination ?? null);
    } catch {
      toast.error(t("dashboard.common.inboundEvents"));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, emailSearch, environment, router]);

  useEffect(() => { load(); }, [load]);

  function applySearch() {
    if (emailSearchInput !== emailSearch) {
      setEmailSearch(emailSearchInput);
      setPage(1);
    }
  }

  function clearFilters() {
    setTypeFilter("all");
    setEmailSearch("");
    setEmailSearchInput("");
    setEnvironment("all");
    setPage(1);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t("dashboard.common.inboundEvents")}</CardTitle>
            <CardDescription>
              {t("dashboard.logs.eventsDescription")}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {t("dashboard.common.refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("dashboard.common.type")}</Label>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.common.allTypes")}</SelectItem>
                {EVENT_TYPE_FILTERS.map((tt) => (
                  <SelectItem key={tt} value={tt}>{tt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("dashboard.common.email")}</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("dashboard.logs.searchEmailPlaceholder")}
                value={emailSearchInput}
                onChange={(e) => setEmailSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }}
                className="w-56 pl-7 text-sm"
                maxLength={200}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("dashboard.common.environment")}</Label>
            <Select value={environment} onValueChange={(v) => { setEnvironment(v); setPage(1); }}>
              <SelectTrigger className="w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.common.all")}</SelectItem>
                <SelectItem value="development">development</SelectItem>
                <SelectItem value="production">production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={applySearch}>
            <Search className="mr-1 h-3.5 w-3.5" /> {t("dashboard.common.apply")}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearFilters}>{t("dashboard.common.clear")}</Button>
        </div>

        {/* Table */}
        {loading ? (
          <Skeleton className="h-80 w-full" />
        ) : data.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            {t("dashboard.logs.emptyEvents")}
          </div>
        ) : (
          <Fragment>
            <div className="max-h-[32rem] overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur">
                  <TableRow>
                    <TableHead className="pl-4">{t("dashboard.logs.columnTime")}</TableHead>
                    <TableHead>{t("dashboard.logs.columnEventId")}</TableHead>
                    <TableHead>{t("dashboard.common.type")}</TableHead>
                    <TableHead>{t("dashboard.common.email")}</TableHead>
                    <TableHead>{t("dashboard.common.environment")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((e) => (
                    <TableRow
                      key={e.eventId}
                      className="cursor-pointer"
                      onClick={() => setSelectedEventId(e.eventId)}
                    >
                      <TableCell className="pl-4 text-xs text-muted-foreground whitespace-nowrap">
                        {relativeTime(e.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono text-xs" title={e.eventId}>
                        {e.eventId.slice(0, 8)}…
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px] text-emerald-600 dark:text-emerald-300">
                          {e.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{e.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {e.environment}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <PaginationBar
              pagination={pagination}
              page={page}
              pageSize={pageSize}
              setPage={setPage}
              setPageSize={(s) => { setPageSize(s); setPage(1); }}
            />
          </Fragment>
        )}
      </CardContent>

      <EventDetailDialog
        eventId={selectedEventId}
        onOpenChange={(open) => { if (!open) setSelectedEventId(null); }}
      />
    </Card>
  );
}

const EVENT_TYPE_FILTERS = [
  "signup",
  "verify_email",
  "login",
  "forgot_password",
  "reset_password",
  "otp.sent",
  "otp.verified",
  "otp.failed",
  "contact.created",
  "contact.updated",
];

/* ============================ Event detail dialog ======================== */

function EventDetailDialog({
  eventId,
  onOpenChange,
}: {
  eventId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch detail whenever a new event is selected. The list view omits the
  // `data` field by design (section 29 — summary only), so we need this call
  // to display the full payload.
  useEffect(() => {
    if (!eventId) { setDetail(null); setError(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/dashboard/logs/events/${encodeURIComponent(eventId)}`);
        if (res.status === 401) { router.push("/auth"); return; }
        if (!res.ok) {
          if (!cancelled) setError(await readError(res));
          return;
        }
        const json = await res.json();
        if (!cancelled) setDetail(json);
      } catch {
        if (!cancelled) setError(t("dashboard.logs.eventDetail"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, router]);

  async function copyData() {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(prettyJson(detail.data));
      toast.success(t("dashboard.logs.eventCopied"));
    } catch {
      toast.error(t("dashboard.common.copy"));
    }
  }

  return (
    <Dialog open={eventId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-emerald-600" /> {t("dashboard.logs.eventDetail")}
          </DialogTitle>
          <DialogDescription>
            {t("dashboard.logs.eventDetailDescription")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-6 w-60" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-300">
            {error}
          </div>
        ) : detail ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <DetailField label={t("dashboard.logs.columnEventId")} value={<code className="font-mono text-xs">{detail.eventId}</code>} />
              <DetailField label={t("dashboard.common.type")} value={
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px] text-emerald-600 dark:text-emerald-300">
                  {detail.type}
                </Badge>
              } />
              <DetailField label={t("dashboard.common.email")} value={<span className="text-xs">{detail.email}</span>} />
              <DetailField label={t("dashboard.common.environment")} value={
                <Badge variant="outline" className="text-[10px]">{detail.environment}</Badge>
              } />
              <DetailField label="Contact ID" value={
                <span className="font-mono text-xs">{detail.contactId ?? "—"}</span>
              } />
              <DetailField label={t("dashboard.common.created")} value={
                <span className="text-xs text-muted-foreground">{new Date(detail.createdAt).toLocaleString()}</span>
              } />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t("dashboard.common.payloadData")}</Label>
                <Button size="sm" variant="ghost" className="h-7" onClick={copyData}>
                  {t("dashboard.logs.copyJson")}
                </Button>
              </div>
              <pre dir="ltr" className="max-h-72 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap break-all">
                {prettyJson(detail.data)}
              </pre>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

/* ============================ Webhooks tab =============================== */

function WebhooksTab({ endpointOptions }: { endpointOptions: EndpointOption[] }) {
  const router = useRouter();
  const t = useTranslations();
  const [data, setData] = useState<WebhookDeliveryRow[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [endpointId, setEndpointId] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Track which delivery is currently being replayed (for the spinner).
  const [replayingId, setReplayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (endpointId !== "all") params.set("endpointId", String(endpointId));
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/dashboard/logs/webhooks?${params}`);
      if (res.status === 401) { router.push("/auth"); return; }
      if (!res.ok) {
        toast.error(t("dashboard.logs.webhookDeliveriesTitle"), { description: await readError(res) });
        return;
      }
      const json = await res.json();
      setData(json.deliveries ?? []);
      setPagination(json.pagination ?? null);
    } catch {
      toast.error(t("dashboard.logs.webhookDeliveriesTitle"));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, endpointId, statusFilter, router]);

  useEffect(() => { load(); }, [load]);

  function endpointLabel(id: number): string {
    const ep = endpointOptions.find((e) => e.id === id);
    return ep ? ep.url : `#${id}`;
  }

  async function handleReplay(d: WebhookDeliveryRow) {
    setReplayingId(d.deliveryId);
    try {
      const res = await fetch(`/api/dashboard/webhooks/deliveries/${encodeURIComponent(d.deliveryId)}/replay`, { method: "POST" });
      const json = await res.json().catch(() => ({} as { deliveryId?: string }));
      if (!res.ok) {
        toast.error(t("dashboard.logs.replayDelivery"), { description: await readError(res) });
        return;
      }
      toast.success(t("dashboard.logs.tabWebhooks"), {
        description: json.deliveryId ? `new deliveryId: ${String(json.deliveryId).slice(0, 8)}…` : undefined,
      });
      setTimeout(() => load(), 400);
    } catch {
      toast.error(t("dashboard.logs.replayDelivery"));
    } finally {
      setReplayingId(null);
    }
  }

  function clearFilters() {
    setEndpointId("all");
    setStatusFilter("all");
    setPage(1);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-emerald-600" /> {t("dashboard.logs.webhookDeliveriesTitle")}
            </CardTitle>
            <CardDescription>
              {t("dashboard.logs.webhookDeliveriesDescription")}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {t("dashboard.common.refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("dashboard.logs.columnEndpoint")}</Label>
            <Select value={String(endpointId)} onValueChange={(v) => { setEndpointId(v === "all" ? "all" : Number(v)); setPage(1); }}>
              <SelectTrigger className="w-52 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.logs.allEndpoints")}</SelectItem>
                {endpointOptions.map((ep) => (
                  <SelectItem key={ep.id} value={String(ep.id)}>{maskShort(ep.url, 32)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("dashboard.common.status")}</Label>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.common.all")}</SelectItem>
                <SelectItem value="pending">pending</SelectItem>
                <SelectItem value="delivered">delivered</SelectItem>
                <SelectItem value="failed">failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters}>{t("dashboard.common.clear")}</Button>
        </div>

        {/* Table */}
        {loading ? (
          <Skeleton className="h-80 w-full" />
        ) : data.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            {t("dashboard.logs.emptyWebhooks")}
          </div>
        ) : (
          <Fragment>
            <div className="max-h-[32rem] overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur">
                  <TableRow>
                    <TableHead className="pl-4">{t("dashboard.logs.columnTime")}</TableHead>
                    <TableHead>{t("dashboard.logs.columnDeliveryId")}</TableHead>
                    <TableHead>{t("dashboard.logs.columnEvent")}</TableHead>
                    <TableHead>{t("dashboard.logs.columnEndpoint")}</TableHead>
                    <TableHead>{t("dashboard.common.status")}</TableHead>
                    <TableHead className="text-right">{t("dashboard.logs.columnTries")}</TableHead>
                    <TableHead className="text-right">{t("dashboard.logs.columnCode")}</TableHead>
                    <TableHead>{t("dashboard.logs.columnError")}</TableHead>
                    <TableHead className="text-right pr-4">{t("dashboard.logs.columnReplay")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((d) => (
                    <TableRow key={d.deliveryId}>
                      <TableCell className="pl-4 text-xs text-muted-foreground whitespace-nowrap">
                        {relativeTime(d.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono text-xs" title={d.deliveryId}>
                        {d.deliveryId.slice(0, 8)}…
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">{d.eventId}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[180px] truncate" title={endpointLabel(d.endpointId)}>
                        {endpointLabel(d.endpointId)}
                      </TableCell>
                      <TableCell>{deliveryStatusBadge(d.status)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{d.attempts}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{d.responseCode ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={d.lastError ?? ""}>
                        {d.lastError ?? "—"}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleReplay(d)}
                          disabled={replayingId === d.deliveryId}
                          aria-label={t("dashboard.logs.replayDelivery")}
                          title={t("dashboard.logs.replayTooltip")}
                        >
                          <RotateCw className={`h-3.5 w-3.5 ${replayingId === d.deliveryId ? "animate-spin" : ""}`} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <PaginationBar
              pagination={pagination}
              page={page}
              pageSize={pageSize}
              setPage={setPage}
              setPageSize={(s) => { setPageSize(s); setPage(1); }}
            />
          </Fragment>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================ Pagination bar ============================= */

function PaginationBar({
  pagination,
  page,
  pageSize,
  setPage,
  setPageSize,
}: {
  pagination: Pagination | null;
  page: number;
  pageSize: number;
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
}) {
  const t = useTranslations();
  if (!pagination) return null;
  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-2 sm:flex-row">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {t("dashboard.logs.pageSummary").replace("{total}", String(pagination.total)).replace("{page}", String(pagination.page)).replace("{totalPages}", String(pagination.totalPages))}
        </span>
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((s) => (
              <SelectItem key={s} value={String(s)}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline" size="sm"
          disabled={page <= 1}
          onClick={() => setPage(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4" /> {t("dashboard.logs.prev")}
        </Button>
        <Button
          variant="outline" size="sm"
          disabled={page >= pagination.totalPages}
          onClick={() => setPage(page + 1)}
        >
          {t("dashboard.logs.next")} <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
