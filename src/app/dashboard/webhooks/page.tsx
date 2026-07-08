"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Webhook, Plus, Copy, Trash2, RefreshCw, CheckCircle2,
  RotateCw, Eye,
} from "lucide-react";

interface Endpoint {
  id: number;
  url: string;
  events: string;
  isActive: boolean;
  createdAt: string;
  recentDeliveries: DeliveryMeta[];
}

interface DeliveryMeta {
  id: number;
  endpointId?: number;
  eventId: string;
  requestId: string;
  status: string;
  responseCode: number | null;
  attempts: number;
  lastError: string | null;
  payload?: string;
  signature?: string;
  createdAt: string;
}

const EVENT_OPTIONS = ["otp.sent", "otp.verified", "otp.failed", "otp.expired"];

export default function WebhooksPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [authChecked, setAuthChecked] = useState(false);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);

  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["otp.sent", "otp.verified"]);
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryMeta | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/webhooks");
      if (r.status === 401) { router.push("/auth"); return; }
      if (!r.ok) throw new Error();
      const d = await r.json();
      setEndpoints(d.endpoints ?? []);
    } catch {
      toast({ title: "Failed to load webhooks", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/webhooks");
      if (r.status === 401) { router.push("/auth"); return; }
      setAuthChecked(true);
      await load();
    })();
  }, [load, router]);

  if (!authChecked) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Skeleton className="h-8 w-8 rounded-full" /></div>;
  }

  // Flatten recent deliveries across endpoints (newest first).
  const deliveries: DeliveryMeta[] = endpoints
    .flatMap((ep) => ep.recentDeliveries.map((d) => ({ ...d, endpointId: ep.id })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  async function createEndpoint() {
    if (!url.trim()) { toast({ title: "URL is required", variant: "destructive" }); return; }
    if (events.length === 0) { toast({ title: "Select at least one event", variant: "destructive" }); return; }
    setCreating(true);
    try {
      const r = await fetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), events }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Failed to add endpoint", description: d.message ?? r.statusText, variant: "destructive" });
        return;
      }
      setNewSecret(d.secret ?? null);
      setUrl("");
      toast({ title: "Webhook endpoint added" });
      load();
    } catch {
      toast({ title: "Failed to add endpoint", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  async function deleteEndpoint(id: number) {
    if (!confirm("Delete this endpoint?")) return;
    try {
      const r = await fetch(`/api/admin/webhooks?id=${id}`, { method: "DELETE" });
      if (!r.ok) { toast({ title: "Delete failed", variant: "destructive" }); return; }
      toast({ title: "Endpoint deleted" });
      load();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  async function replay(d: DeliveryMeta) {
    try {
      const r = await fetch("/api/admin/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId: d.id }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Replay failed", description: data.message ?? r.statusText, variant: "destructive" });
        return;
      }
      toast({ title: "Replay sent" });
      load();
    } catch {
      toast({ title: "Replay failed", variant: "destructive" });
    }
  }

  async function copy(text: string, label = "Copied") {
    try { await navigator.clipboard.writeText(text); toast({ title: label }); }
    catch { toast({ title: "Copy failed", variant: "destructive" }); }
  }

  function toggleEvent(ev: string) {
    setEvents((arr) => (arr.includes(ev) ? arr.filter((e) => e !== ev) : [...arr, ev]));
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><Webhook className="h-6 w-6 text-emerald-600" /> Webhooks</h1>
            <p className="text-sm text-muted-foreground">Register endpoints, inspect deliveries, and replay events</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      {newSecret && (
        <Alert className="mb-6 border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Signing secret — copy it now</AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="text-sm">Used to verify webhook signatures. Won&apos;t be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="block flex-1 truncate rounded border border-emerald-300 bg-white px-2 py-1 font-mono text-xs dark:bg-black/40 dark:text-emerald-200">{newSecret}</code>
              <Button size="sm" variant="outline" onClick={() => copy(newSecret, "Secret copied")}><Copy className="mr-1 h-3 w-3" /> Copy</Button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setNewSecret(null)}>Dismiss</Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Add endpoint */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add Webhook Endpoint</CardTitle>
            <CardDescription>You&apos;ll receive signed POSTs for the selected events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wh-url">Endpoint URL</Label>
              <Input id="wh-url" placeholder="https://example.com/hooks/nixify" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Events</Label>
              <div className="flex flex-wrap gap-2">
                {EVENT_OPTIONS.map((ev) => {
                  const on = events.includes(ev);
                  return (
                    <button
                      type="button"
                      key={ev}
                      onClick={() => toggleEvent(ev)}
                      aria-pressed={on}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${on
                        ? "border-emerald-500 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"}`}
                    >
                      {ev}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Selected: {events.join(", ") || "none"}</p>
            </div>
            <Button className="w-full" onClick={createEndpoint} disabled={creating}>
              {creating ? "Adding…" : <><Plus className="mr-2 h-4 w-4" /> Add endpoint</>}
            </Button>
          </CardContent>
        </Card>

        {/* Endpoints table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Endpoints</CardTitle>
            <CardDescription>{endpoints.length} registered</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full" /> : endpoints.length === 0 ? (
              <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">No endpoints yet.</div>
            ) : (
              <div className="max-h-72 overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 backdrop-blur">
                    <tr className="border-b text-left">
                      <th className="px-3 py-2 font-medium">URL</th>
                      <th className="px-3 py-2 font-medium">Events</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium text-right">Deliveries</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoints.map((ep) => (
                      <tr key={ep.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-xs break-all">{ep.url}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {ep.events.split(",").filter(Boolean).map((e) => (
                              <Badge key={e} variant="outline" className="font-mono text-[10px]">{e.trim()}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {ep.isActive
                            ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">active</span>
                            : <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">inactive</span>}
                        </td>
                        <td className="px-3 py-2 text-right">{ep.recentDeliveries?.length ?? 0}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="ghost" className="h-7 text-rose-600 hover:text-rose-700" onClick={() => deleteEndpoint(ep.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
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
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Deliveries table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Deliveries</CardTitle>
            <CardDescription>Click a row to inspect its payload + signature</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64 w-full" /> : deliveries.length === 0 ? (
              <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">No deliveries yet.</div>
            ) : (
              <div className="max-h-96 overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 backdrop-blur">
                    <tr className="border-b text-left">
                      <th className="px-3 py-2 font-medium">Event</th>
                      <th className="px-3 py-2 font-medium">Request ID</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Code</th>
                      <th className="px-3 py-2 font-medium">Tries</th>
                      <th className="px-3 py-2 font-medium">Error</th>
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d) => {
                      const isSel = selectedDelivery?.id === d.id;
                      return (
                        <Fragment key={d.id}>
                          <tr
                            className={`cursor-pointer border-b last:border-0 hover:bg-muted/30 ${isSel ? "bg-muted/40" : ""}`}
                            onClick={() => setSelectedDelivery(d)}
                          >
                            <td className="px-3 py-2"><Badge variant="outline" className="font-mono text-[10px]">{d.eventId}</Badge></td>
                            <td className="px-3 py-2 font-mono text-xs">{d.requestId.slice(0, 8)}…</td>
                            <td className="px-3 py-2">
                              {d.status === "delivered"
                                ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">delivered</span>
                                : d.status === "failed"
                                  ? <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">failed</span>
                                  : <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">{d.status}</span>}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">{d.responseCode ?? "—"}</td>
                            <td className="px-3 py-2">{d.attempts}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground max-w-[180px] truncate" title={d.lastError ?? ""}>{d.lastError ?? "—"}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(d.createdAt).toLocaleTimeString()}</td>
                            <td className="px-3 py-2 text-right">
                              <Button size="sm" variant="ghost" className="h-7" onClick={(e) => { e.stopPropagation(); replay(d); }}>
                                <RotateCw className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payload viewer */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> Payload Viewer</CardTitle>
            <CardDescription>{selectedDelivery ? `Delivery #${selectedDelivery.id}` : "Select a delivery"}</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedDelivery ? (
              <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
                Click a delivery row to see its payload + signature.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded border bg-muted/30 p-2 text-xs">
                  <div className="mb-1 font-medium">Delivery #{selectedDelivery.id}</div>
                  <div className="text-muted-foreground">Event: <code className="font-mono">{selectedDelivery.eventId}</code></div>
                  <div className="text-muted-foreground">Request: <code className="font-mono">{selectedDelivery.requestId}</code></div>
                </div>
                {selectedDelivery.payload ? (
                  <>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Signature</Label>
                        <Button size="sm" variant="ghost" className="h-6" onClick={() => copy(selectedDelivery.signature ?? "", "Signature copied")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <pre className="max-h-20 overflow-auto rounded border bg-muted/30 p-2 text-[11px] leading-tight break-all whitespace-pre-wrap">{selectedDelivery.signature}</pre>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Payload</Label>
                        <Button size="sm" variant="ghost" className="h-6" onClick={() => copy(selectedDelivery.payload ?? "", "Payload copied")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <pre className="max-h-72 overflow-auto rounded border bg-muted/30 p-2 text-xs">{prettyJson(selectedDelivery.payload)}</pre>
                    </div>
                  </>
                ) : (
                  <div className="rounded border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Payload + signature are not included in the recent-deliveries list. Use the <strong>Replay</strong> button to re-send this delivery to your endpoint and inspect it on your server.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function prettyJson(s: string): string {
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
}
