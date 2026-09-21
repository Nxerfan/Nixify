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
import Link from "next/link";
import { toast } from "sonner";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Webhook, Plus, RefreshCw, Copy, CheckCircle2, Pencil, KeyRound, Send,
  Trash2, RotateCw, AlertTriangle, ChevronLeft, ChevronRight, MoreHorizontal, X, Activity,
} from "lucide-react";
import { useTranslations, useLocale } from "@/lib/i18n/LocaleProvider";
import { formatRelativeTime } from "@/lib/i18n/relative-time";
import { Ltr } from "@/lib/i18n/Ltr";
import { GuideBanner } from "@/components/guide/GuideBanner";

/* --------------------------------- types --------------------------------- */

interface Endpoint {
  id: number;
  url: string; // masked in list view
  events: string; // CSV string
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

interface DeliveryRow {
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

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface CreatedResponse {
  id: number;
  url: string;
  events: string;
  isActive: boolean;
  secret: string;
  createdAt: string;
}

interface RotatedResponse {
  id: number;
  secret: string;
}

interface DetailResponse {
  id: number;
  url: string;
  events: string;
  isActive: boolean;
  createdAt: string;
}

interface TestResponse {
  deliveryId: string;
}

interface ReplayResponse {
  deliveryId: string;
}

/* ------------------------------- constants -------------------------------- */

/**
 * Common nixify event types offered as quick-pick chips in the create/edit
 * dialog. The backend accepts arbitrary strings (1-50, ≤100 chars each), so
 * users can still add custom event types via the free-text input below.
 */
const COMMON_EVENTS = [
  "otp.sent",
  "otp.verified",
  "otp.failed",
  "otp.expired",
  "nixify.event.received",
  "nixify.webhook.test",
  "contact.created",
  "contact.updated",
];

const DELIVERY_STATUSES = ["pending", "delivered", "failed"] as const;

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/* ------------------------------- helpers --------------------------------- */

function splitEvents(csv: string | undefined | null): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function maskShort(text: string, max = 56): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

function relativeTime(date: string | null): string {
  if (!date) return "never";
  try {
    return formatRelativeTime(date);
  } catch {
    return "—";
  }
}

function statusBadge(status: string) {
  if (status === "delivered") {
    return <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">{status}</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300">{status}</Badge>;
  }
  return <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300">{status}</Badge>;
}

async function copyText(text: string, label: string, copyFailedMsg: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error(copyFailedMsg);
  }
}

/** Extract a friendly error message from a fetch response. */
async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message ?? res.statusText ?? "Request failed";
  } catch {
    return res.statusText ?? "Request failed";
  }
}

/* ============================ Webhooks Page =============================== */

export default function WebhooksPage() {
  const router = useRouter();
  const t = useTranslations();
  const { locale } = useLocale();

  const [authChecked, setAuthChecked] = useState(false);
  const [entitled, setEntitled] = useState(true);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [endpointsLoading, setEndpointsLoading] = useState(true);

  // create / edit / secret / deactivate dialog state
  const [createOpen, setCreateOpen] = useState(false);
  // Bumps every time the create dialog opens — used as a `key` to remount the
  // form, ensuring fresh initial state each open without a `setState`-in-effect.
  const [createNonce, setCreateNonce] = useState(0);
  const [editTarget, setEditTarget] = useState<Endpoint | null>(null);
  const [editDetail, setEditDetail] = useState<DetailResponse | null>(null);
  const [secretDialog, setSecretDialog] = useState<{ secret: string; title: string } | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Endpoint | null>(null);

  // deliveries state
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);
  const [delivPagination, setDelivPagination] = useState<Pagination | null>(null);
  const [delivPage, setDelivPage] = useState(1);
  const [delivPageSize, setDelivPageSize] = useState(25);
  const [delivEndpointFilter, setDelivEndpointFilter] = useState<number | "all">("all");
  const [delivStatusFilter, setDelivStatusFilter] = useState<string>("all");

  const loadEndpoints = useCallback(async () => {
    setEndpointsLoading(true);
    try {
      const res = await fetch("/api/dashboard/webhooks?pageSize=100");
      if (res.status === 401) { router.push("/auth"); return; }
      if (res.status === 403) { setEntitled(false); return; }
      if (!res.ok) {
        toast.error(t("dashboard.toasts.webhookLoadFailed"), { description: await readError(res) });
        return;
      }
      const data = await res.json();
      setEndpoints(data.endpoints ?? []);
      setEntitled(true);
    } catch {
      toast.error(t("dashboard.toasts.webhookLoadFailed"));
    } finally {
      setEndpointsLoading(false);
      setAuthChecked(true);
    }
  }, [router]);

  const loadDeliveries = useCallback(async () => {
    setDeliveriesLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(delivPage),
        pageSize: String(delivPageSize),
      });
      if (delivEndpointFilter !== "all") params.set("endpointId", String(delivEndpointFilter));
      if (delivStatusFilter !== "all") params.set("status", delivStatusFilter);
      const res = await fetch(`/api/dashboard/webhooks/deliveries?${params}`);
      if (res.status === 401) { router.push("/auth"); return; }
      if (!res.ok) {
        toast.error(t("dashboard.toasts.deliveriesLoadFailed"), { description: await readError(res) });
        return;
      }
      const data = await res.json();
      setDeliveries(data.deliveries ?? []);
      setDelivPagination(data.pagination ?? null);
    } catch {
      toast.error(t("dashboard.toasts.deliveriesLoadFailed"));
    } finally {
      setDeliveriesLoading(false);
    }
  }, [delivPage, delivPageSize, delivEndpointFilter, delivStatusFilter, router]);

  useEffect(() => { loadEndpoints(); }, [loadEndpoints]);

  // Load deliveries on mount + whenever filters/page change.
  useEffect(() => { loadDeliveries(); }, [loadDeliveries]);

  /* ------------------------------ actions ------------------------------- */

  async function handleCreate(url: string, events: string[]): Promise<boolean> {
    try {
      const res = await fetch("/api/dashboard/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events }),
      });
      const data: CreatedResponse = await res.json().catch(() => ({} as CreatedResponse));
      if (!res.ok) {
        toast.error(t("dashboard.toasts.endpointCreateFailed"), { description: await readError(res) });
        return false;
      }
      // Secret shown ONCE — display in dedicated dialog with copy + warning.
      setSecretDialog({ secret: data.secret, title: "Endpoint secret" });
      toast.success(t("dashboard.toasts.endpointCreated"), { description: t("dashboard.toasts.endpointCreatedDesc") });
      loadEndpoints();
      loadDeliveries();
      return true;
    } catch {
      toast.error(t("dashboard.toasts.endpointCreateFailed"));
      return false;
    }
  }

  function openCreate() {
    setCreateNonce((n) => n + 1);
    setCreateOpen(true);
  }

  async function openEdit(ep: Endpoint) {
    // Set the target immediately so the dialog mounts with skeleton; the
    // `key` includes a `loading`/`ready` segment so the form remounts fresh
    // when the full URL detail arrives.
    setEditTarget(ep);
    setEditDetail(null);
    try {
      const res = await fetch(`/api/dashboard/webhooks/${ep.id}`);
      if (!res.ok) {
        toast.error(t("dashboard.toasts.endpointLoadFailed"), { description: await readError(res) });
        setEditTarget(null);
        return;
      }
      const detail: DetailResponse = await res.json();
      setEditDetail(detail);
    } catch {
      toast.error(t("dashboard.toasts.endpointLoadFailed"));
      setEditTarget(null);
    }
  }

  async function handleEdit(id: number, url: string, events: string[]): Promise<boolean> {
    try {
      const res = await fetch(`/api/dashboard/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events }),
      });
      if (!res.ok) {
        toast.error(t("dashboard.toasts.endpointUpdateFailed"), { description: await readError(res) });
        return false;
      }
      toast.success(t("dashboard.toasts.endpointUpdated"));
      setEditTarget(null);
      setEditDetail(null);
      loadEndpoints();
      return true;
    } catch {
      toast.error(t("dashboard.toasts.endpointUpdateFailed"));
      return false;
    }
  }

  async function handleDeactivate(id: number) {
    try {
      const res = await fetch(`/api/dashboard/webhooks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(t("dashboard.toasts.deactivationFailed"), { description: await readError(res) });
        return;
      }
      toast.success(t("dashboard.toasts.endpointDeactivated"), { description: t("dashboard.toasts.endpointDeactivatedDesc") });
      setDeactivateTarget(null);
      loadEndpoints();
    } catch {
      toast.error(t("dashboard.toasts.deactivationFailed"));
    }
  }

  async function handleRotateSecret(ep: Endpoint) {
    try {
      const res = await fetch(`/api/dashboard/webhooks/${ep.id}/rotate-secret`, { method: "POST" });
      const data: RotatedResponse = await res.json().catch(() => ({} as RotatedResponse));
      if (!res.ok) {
        toast.error(t("dashboard.toasts.rotateFailed"), { description: await readError(res) });
        return;
      }
      // New secret shown ONCE.
      setSecretDialog({ secret: data.secret, title: "New signing secret" });
      toast.success(t("dashboard.toasts.secretRotated"), { description: t("dashboard.toasts.secretRotatedDesc") });
    } catch {
      toast.error(t("dashboard.toasts.rotateFailed"));
    }
  }

  async function handleTest(ep: Endpoint) {
    try {
      const res = await fetch(`/api/dashboard/webhooks/${ep.id}/test`, { method: "POST" });
      const data: TestResponse = await res.json().catch(() => ({} as TestResponse));
      if (!res.ok) {
        toast.error(t("dashboard.toasts.testDeliveryFailed"), { description: await readError(res) });
        return;
      }
      toast.success(t("dashboard.toasts.testWebhookScheduled"), { description: `deliveryId: ${data.deliveryId.slice(0, 8)}…` });
      // Refresh deliveries so the new pending row appears.
      setTimeout(() => loadDeliveries(), 400);
    } catch {
      toast.error(t("dashboard.toasts.testDeliveryFailed"));
    }
  }

  async function handleReplay(d: DeliveryRow) {
    try {
      const res = await fetch(`/api/dashboard/webhooks/deliveries/${d.deliveryId}/replay`, { method: "POST" });
      const data: ReplayResponse = await res.json().catch(() => ({} as ReplayResponse));
      if (!res.ok) {
        toast.error(t("dashboard.toasts.replayFailed"), { description: await readError(res) });
        return;
      }
      toast.success(t("dashboard.toasts.replayScheduled"), { description: `new deliveryId: ${data.deliveryId.slice(0, 8)}…` });
      setTimeout(() => loadDeliveries(), 400);
    } catch {
      toast.error(t("dashboard.toasts.replayFailed"));
    }
  }

  function endpointLabel(id: number): string {
    const ep = endpoints.find((e) => e.id === id);
    return ep ? ep.url : `#${id}`;
  }

  /* ------------------------------ render --------------------------------- */

  if (!authChecked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  if (!entitled) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border bg-muted/40">
            <Webhook className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-xl font-semibold">{t("dashboard.webhooks.notAvailable")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("dashboard.webhooks.notAvailableDescription")}
        </p>
        <Button asChild className="mt-6 bg-emerald-600 text-white hover:bg-emerald-500">
          <Link href="/pricing">View Plans</Link>
        </Button>
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
              <Webhook className="h-6 w-6 text-emerald-600" /> {t("dashboard.webhooks.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.webhooks.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { loadEndpoints(); loadDeliveries(); }} disabled={endpointsLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${endpointsLoading ? "animate-spin" : ""}`} /> {t("dashboard.webhooks.refresh")}
          </Button>
          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> {t("dashboard.webhooks.addEndpoint")}
          </Button>
        </div>
      </div>

      {/* Endpoints card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("dashboard.webhooks.endpoints")}</CardTitle>
          <CardDescription>
            {endpoints.length} {endpoints.length > 0 ? `· ${endpoints.filter((e) => e.isActive).length} ${t("dashboard.webhooks.active")}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {endpointsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : endpoints.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border bg-muted/40">
                <Webhook className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">{t("dashboard.webhooks.empty")}</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                {t("dashboard.webhooks.emptyDescription")}
              </p>
              <Button size="sm" className="mt-4 bg-emerald-600 text-white hover:bg-emerald-500" onClick={openCreate}>
                <Plus className="mr-1 h-4 w-4" /> {t("dashboard.webhooks.createEndpoint")}
              </Button>
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur">
                  <TableRow>
                    <TableHead className="pl-4">{t("dashboard.webhooks.url")}</TableHead>
                    <TableHead>{t("dashboard.webhooks.events")}</TableHead>
                    <TableHead>{t("dashboard.common.status")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("dashboard.common.created")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("dashboard.common.lastUsed")}</TableHead>
                    <TableHead className="text-right pr-4">{t("dashboard.common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpoints.map((ep) => (
                    <TableRow key={ep.id}>
                      <TableCell className="pl-4 font-mono text-xs break-all max-w-[280px]">
                        <Ltr>{ep.url}</Ltr>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {splitEvents(ep.events).slice(0, 3).map((ev) => (
                            <Badge key={ev} variant="outline" className="font-mono text-[10px]">
                              {ev}
                            </Badge>
                          ))}
                          {splitEvents(ep.events).length > 3 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{splitEvents(ep.events).length - 3}
                            </Badge>
                          )}
                          {splitEvents(ep.events).length === 0 && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {ep.isActive ? (
                          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">{t("dashboard.webhooks.active")}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">{t("dashboard.webhooks.inactive")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground whitespace-nowrap">
                        {relativeTime(ep.createdAt)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                        {relativeTime(ep.lastUsedAt)}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={ep.isActive}
                              disabled={!ep.isActive}
                              aria-label={`Endpoint ${ep.id} active`}
                              onCheckedChange={() => setDeactivateTarget(ep)}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(ep)}>
                                  <Pencil className="mr-2 h-3.5 w-3.5" /> {t("dashboard.webhooks.editEndpoint")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleTest(ep)}>
                                  <Send className="mr-2 h-3.5 w-3.5" /> {t("dashboard.webhooks.sendTest")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRotateSecret(ep)}>
                                  <KeyRound className="mr-2 h-3.5 w-3.5" /> {t("dashboard.webhooks.rotateSecret")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-rose-600"
                                  disabled={!ep.isActive}
                                  onClick={() => setDeactivateTarget(ep)}
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" /> {t("dashboard.webhooks.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deliveries card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-600" /> {t("dashboard.webhooks.deliveryHistory")}
              </CardTitle>
              <CardDescription>
                {t("dashboard.webhooks.deliveryHistoryDescription")}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={String(delivEndpointFilter)}
                onValueChange={(v) => { setDelivEndpointFilter(v === "all" ? "all" : Number(v)); setDelivPage(1); }}
              >
                <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder={t("dashboard.webhooks.endpoints")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("dashboard.webhooks.allEndpoints")}</SelectItem>
                  {endpoints.map((ep) => (
                    <SelectItem key={ep.id} value={String(ep.id)}>{maskShort(ep.url, 28)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={delivStatusFilter}
                onValueChange={(v) => { setDelivStatusFilter(v); setDelivPage(1); }}
              >
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder={t("dashboard.webhooks.status")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("dashboard.webhooks.all")}</SelectItem>
                  {DELIVERY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-8" onClick={loadDeliveries} disabled={deliveriesLoading}>
                <RefreshCw className={`h-4 w-4 ${deliveriesLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {deliveriesLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : deliveries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              {t("dashboard.webhooks.deliveriesEmpty")}
            </div>
          ) : (
            <Fragment>
              <div className="max-h-[32rem] overflow-auto rounded-lg border">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur">
                    <TableRow>
                      <TableHead className="pl-4">{t("dashboard.webhooks.columnEvent")}</TableHead>
                      <TableHead>{t("dashboard.webhooks.columnEndpoint")}</TableHead>
                      <TableHead>{t("dashboard.webhooks.columnStatus")}</TableHead>
                      <TableHead className="text-right">{t("dashboard.webhooks.columnTries")}</TableHead>
                      <TableHead className="text-right">{t("dashboard.webhooks.columnCode")}</TableHead>
                      <TableHead>{t("dashboard.webhooks.columnError")}</TableHead>
                      <TableHead className="hidden md:table-cell">{t("dashboard.common.created")}</TableHead>
                      <TableHead className="text-right pr-4">{t("dashboard.webhooks.columnReplay")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.map((d) => (
                      <TableRow key={d.deliveryId}>
                        <TableCell className="pl-4">
                          <Badge variant="outline" className="font-mono text-[10px]">{d.eventId}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate" title={endpointLabel(d.endpointId)}>
                          {endpointLabel(d.endpointId)}
                        </TableCell>
                        <TableCell>{statusBadge(d.status)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{d.attempts}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {d.responseCode ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={d.lastError ?? ""}>
                          {d.lastError ?? "—"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground whitespace-nowrap">
                          {relativeTime(d.createdAt)}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleReplay(d)}
                            aria-label={t("dashboard.webhooks.replayDelivery")}
                            title={t("dashboard.webhooks.replayTooltip")}
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t("dashboard.logs.pageSummary").replace("{total}", String(delivPagination?.total ?? 0)).replace("{page}", String(delivPagination?.page ?? 1)).replace("{totalPages}", String(delivPagination?.totalPages ?? 1))}
                  </span>
                  <Select value={String(delivPageSize)} onValueChange={(v) => { setDelivPageSize(Number(v)); setDelivPage(1); }}>
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
                    disabled={(delivPagination?.page ?? 1) <= 1}
                    onClick={() => setDelivPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" /> {t("dashboard.webhooks.prev")}
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    disabled={(delivPagination?.page ?? 1) >= (delivPagination?.totalPages ?? 1)}
                    onClick={() => setDelivPage((p) => p + 1)}
                  >
                    {t("dashboard.webhooks.next")} <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Fragment>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <CreateEditDialog
        key={`create-${createNonce}`}
        open={createOpen}
        mode="create"
        onOpenChange={setCreateOpen}
        initialUrl=""
        initialEvents={["otp.sent", "otp.verified"]}
        onSubmit={handleCreate}
      />

      {/* Edit dialog — key changes when target endpoint OR detail-load state
          changes, ensuring the form remounts with fresh initial values without
          a setState-in-effect. */}
      <CreateEditDialog
        key={`edit-${editTarget?.id ?? "none"}-${editDetail ? "ready" : "loading"}`}
        open={editTarget !== null}
        mode="edit"
        onOpenChange={(v) => { if (!v) { setEditTarget(null); setEditDetail(null); } }}
        initialUrl={editDetail?.url ?? ""}
        initialEvents={editDetail ? splitEvents(editDetail.events) : []}
        loading={editDetail === null}
        onSubmit={(url, events) => editTarget ? handleEdit(editTarget.id, url, events) : Promise.resolve(false)}
      />

      {/* Secret dialog (shown once after create or rotate). Keying on the
          secret value forces a fresh mount → copied state resets naturally. */}
      <SecretDialog
        key={secretDialog?.secret ?? "none"}
        open={secretDialog !== null}
        onOpenChange={(v) => { if (!v) setSecretDialog(null); }}
        secret={secretDialog?.secret ?? ""}
        title={secretDialog?.title ?? "Endpoint secret"}
      />

      {/* Deactivate confirm */}
      <AlertDialog open={deactivateTarget !== null} onOpenChange={(v) => !v && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> {t("dashboard.webhooks.deactivateTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("dashboard.webhooks.deactivateMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-500"
              onClick={() => deactivateTarget && handleDeactivate(deactivateTarget.id)}
            >
              {t("dashboard.webhooks.deactivateAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <GuideBanner guidePath="/guide/webhooks" routeKey="webhooks" steps={6} duration={5} />

    </div>
  );
}

/* ============================ Create / Edit Dialog ======================== */

function CreateEditDialog({
  open,
  mode,
  onOpenChange,
  initialUrl,
  initialEvents,
  loading,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  onOpenChange: (open: boolean) => void;
  initialUrl: string;
  initialEvents: string[];
  loading?: boolean;
  onSubmit: (url: string, events: string[]) => Promise<boolean>;
}) {
  const t = useTranslations();
  // Initial state is derived from props at mount time. The parent remounts
  // this component (via `key`) every time the dialog opens or the target
  // changes — so initialUrl/initialEvents are always correct on mount, and
  // we never need to call setState inside an effect to re-sync them.
  const [url, setUrl] = useState(initialUrl);
  const [events, setEvents] = useState<string[]>(initialEvents);
  const [customEvent, setCustomEvent] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleEvent(ev: string) {
    setEvents((arr) => (arr.includes(ev) ? arr.filter((e) => e !== ev) : [...arr, ev]));
  }

  function addCustomEvent() {
    const ev = customEvent.trim();
    if (!ev) return;
    if (events.includes(ev)) { setCustomEvent(""); return; }
    if (events.length >= 50) {
      toast.error(t("dashboard.toasts.maxEventSubs"));
      return;
    }
    setEvents((arr) => [...arr, ev]);
    setCustomEvent("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) { toast.error(t("dashboard.toasts.urlRequired")); return; }
    if (events.length === 0) { toast.error(t("dashboard.toasts.selectOneEvent")); return; }
    setSaving(true);
    const ok = await onSubmit(url.trim(), events);
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("dashboard.webhooks.createDialogTitleCreate") : t("dashboard.webhooks.createDialogTitleEdit")}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? t("dashboard.webhooks.createDialogDescriptionCreate")
              : t("dashboard.webhooks.createDialogDescriptionEdit")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wh-url">{t("dashboard.webhooks.endpointUrl")}</Label>
              <Input
                id="wh-url"
                placeholder="https://example.com/hooks/nixify"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={saving}
                className="font-mono text-sm"
                maxLength={2048}
                autoComplete="url"
                inputMode="url"
              />
              <p className="text-xs text-muted-foreground">{t("dashboard.webhooks.endpointUrlHelp")}</p>
            </div>

            <div className="space-y-1.5">
              <Label>{t("dashboard.common.eventSubscriptions")}</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_EVENTS.map((ev) => {
                  const on = events.includes(ev);
                  return (
                    <button
                      type="button"
                      key={ev}
                      onClick={() => toggleEvent(ev)}
                      aria-pressed={on}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                        on
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "border-border bg-card text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {ev}
                    </button>
                  );
                })}
              </div>

              {/* Selected events with removable chips */}
              {events.length > 0 && (
                <div className="flex flex-wrap gap-1.5 rounded-md border bg-muted/30 p-2">
                  {events.map((ev) => (
                    <span
                      key={ev}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700 dark:text-emerald-300"
                    >
                      {ev}
                      <button
                        type="button"
                        onClick={() => toggleEvent(ev)}
                        className="ml-0.5 rounded-full hover:bg-emerald-500/20"
                        aria-label={`Remove ${ev}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Custom event input */}
              <div className="flex gap-2">
                <Input
                  placeholder="custom.event.type"
                  value={customEvent}
                  onChange={(e) => setCustomEvent(e.target.value)}
                  disabled={saving}
                  className="font-mono text-xs"
                  maxLength={100}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addCustomEvent(); }
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addCustomEvent} disabled={saving}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("dashboard.webhooks.eventsSelected").replace("{count}", String(events.length))}</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                {t("common.buttons.cancel")}
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={saving || !url.trim() || events.length === 0}
              >
                {saving ? t("dashboard.webhooks.saving") : mode === "create" ? t("dashboard.webhooks.createEndpoint") : t("dashboard.webhooks.saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ============================ Secret Dialog =============================== */

function SecretDialog({
  open,
  onOpenChange,
  secret,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secret: string;
  title: string;
}) {
  const t = useTranslations();
  // `copied` resets to false on each fresh mount. The parent remounts this
  // component (via `key` based on the secret value) every time a new secret
  // is shown — so we don't need a setState-in-effect to reset it.
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.success(t("dashboard.toasts.secretCopied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("dashboard.toasts.copyFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" /> {title}
          </DialogTitle>
          <DialogDescription>
            {t("dashboard.webhooks.secretDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="text-xs">
                <p className="font-semibold">{t("dashboard.webhooks.secretWarningTitle")}</p>
                <p className="mt-0.5">
                  {t("dashboard.webhooks.secretWarningDescription")}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t("dashboard.common.signingSecret")}</Label>
            <div className="flex items-center gap-2">
              <code dir="ltr" className="block flex-1 truncate rounded border bg-muted/40 px-2 py-2 font-mono text-xs">
                {secret}
              </code>
              <Button size="sm" variant="outline" onClick={handleCopy}>
                {copied
                  ? <><CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" /> {t("dashboard.webhooks.copied")}</>
                  : <><Copy className="mr-1 h-3.5 w-3.5" /> {t("dashboard.common.copy")}</>}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button className="bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => onOpenChange(false)}>
            {t("dashboard.webhooks.saved")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================ Hooks / utils ============================== */
