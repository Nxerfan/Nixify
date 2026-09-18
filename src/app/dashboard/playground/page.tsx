"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { generateSnippet, type Language } from "@/lib/dx/code-snippets";
import {
  ArrowLeft, FlaskConical, Send, Copy, Clock, History, Loader2,
} from "lucide-react";

const ENDPOINTS = [
  {
    id: "send",
    label: "POST /api/v1/otp/send",
    method: "POST",
    path: "/api/v1/otp/send",
    template: JSON.stringify({ email: "user@example.com", purpose: "signup" }, null, 2),
  },
  {
    id: "verify",
    label: "POST /api/v1/otp/verify",
    method: "POST",
    path: "/api/v1/otp/verify",
    template: JSON.stringify({ email: "user@example.com", code: "123456", purpose: "signup" }, null, 2),
  },
  {
    id: "resend",
    label: "POST /api/v1/otp/resend",
    method: "POST",
    path: "/api/v1/otp/resend",
    template: JSON.stringify({ email: "user@example.com", purpose: "signup" }, null, 2),
  },
] as const;

type EndpointId = (typeof ENDPOINTS)[number]["id"];
const LANGS: { id: Language; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
  { id: "go", label: "Go" },
];

interface ResponseState {
  status: number | null;
  statusText: string;
  durationMs: number | null;
  headers: Record<string, string>;
  body: string;
  error?: string;
}

interface HistoryItem {
  id: number;
  endpointId: EndpointId;
  path: string;
  method: string;
  status: number | null;
  durationMs: number | null;
  body: string;
  ts: number;
}

export default function PlaygroundPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [authChecked, setAuthChecked] = useState(false);
  const [endpointId, setEndpointId] = useState<EndpointId>("send");
  const [apiKey, setApiKey] = useState("");
  const [body, setBody] = useState(ENDPOINTS[0].template);
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [lang, setLang] = useState<Language>("curl");
  const [historySeq, setHistorySeq] = useState(1);

  useEffect(() => {
    // Middleware already guards /admin/* — auth is guaranteed. Just render.
    setAuthChecked(true);
  }, []);

  const endpoint = useMemo(() => ENDPOINTS.find((e) => e.id === endpointId)!, [endpointId]);

  function selectEndpoint(id: EndpointId) {
    setEndpointId(id);
    const ep = ENDPOINTS.find((e) => e.id === id)!;
    setBody(ep.template);
  }

  async function sendRequest() {
    setSending(true);
    const start = Date.now();
    let parsedBody: Record<string, unknown> | null = null;
    try { parsedBody = body.trim() ? JSON.parse(body) : null; }
    catch {
      toast({ title: "Invalid JSON body", variant: "destructive" });
      setSending(false);
      return;
    }
    try {
      const res = await fetch(endpoint.path, {
        method: endpoint.method,
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: parsedBody ? JSON.stringify(parsedBody) : undefined,
      });
      const text = await res.text();
      const durationMs = Date.now() - start;
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* keep raw */ }
      setResponse({
        status: res.status,
        statusText: res.statusText,
        durationMs,
        headers,
        body: pretty,
      });
      setHistory((h) => [
        { id: historySeq, endpointId, path: endpoint.path, method: endpoint.method, status: res.status, durationMs, body, ts: Date.now() },
        ...h,
      ].slice(0, 5));
      setHistorySeq((n) => n + 1);
    } catch (err) {
      const durationMs = Date.now() - start;
      setResponse({
        status: null, statusText: "Network error", durationMs, headers: {}, body: "",
        error: err instanceof Error ? err.message : String(err),
      });
      toast({ title: "Request failed", description: err instanceof Error ? err.message : "network error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  function reRun(h: HistoryItem) {
    selectEndpoint(h.endpointId);
    setBody(h.body);
  }

  async function copy(text: string, label = "Copied") {
    try { await navigator.clipboard.writeText(text); toast({ title: label }); }
    catch { toast({ title: "Copy failed", variant: "destructive" }); }
  }

  const snippet = useMemo(() => {
    let parsed: Record<string, unknown> | null = null;
    try { parsed = body.trim() ? JSON.parse(body) : null; } catch { /* ignore */ }
    return generateSnippet({
      method: endpoint.method,
      path: endpoint.path,
      apiKey: apiKey || undefined,
      body: parsed,
      language: lang,
    });
  }, [endpoint, apiKey, body, lang]);

  if (!authChecked) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Skeleton className="h-8 w-8 rounded-full" /></div>;
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><FlaskConical className="h-6 w-6 text-emerald-600" /> API Playground</h1>
          <p className="text-sm text-muted-foreground">Send real requests against the v1 API and inspect responses + generated code</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Request panel */}
        <Card>
          <CardHeader>
            <CardTitle>Request</CardTitle>
            <CardDescription>Choose an endpoint, provide your API key, and edit the JSON body.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ep-select">Endpoint</Label>
              <Select value={endpointId} onValueChange={(v) => selectEndpoint(v as EndpointId)}>
                <SelectTrigger id="ep-select" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENDPOINTS.map((e) => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="api-key">API Key</Label>
              <Input id="api-key" type="password" placeholder="mg_live_xxxxxxxxxxxxxxxxxxxxxxxx" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
              <p className="text-xs text-muted-foreground">Create a key on the <button className="underline hover:text-foreground" onClick={() => router.push("/dashboard/api-keys")}>API Keys</button> page.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body">Request Body (JSON)</Label>
              <Textarea id="body" rows={10} value={body} onChange={(e) => setBody(e.target.value)} dir="ltr" className="font-mono text-xs" spellCheck={false} />
            </div>
            <Button onClick={sendRequest} disabled={sending} className="w-full">
              {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</> : <><Send className="mr-2 h-4 w-4" /> Send request</>}
            </Button>
          </CardContent>
        </Card>

        {/* Response panel */}
        <Card>
          <CardHeader>
            <CardTitle>Response</CardTitle>
            <CardDescription>Status code, headers, and pretty-printed body.</CardDescription>
          </CardHeader>
          <CardContent>
            {!response ? (
              <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
                Send a request to see the response here.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  {response.status === null ? (
                    <Badge variant="destructive">network error</Badge>
                  ) : (
                    <Badge className={badgeClass(response.status)}>{response.status} {response.statusText}</Badge>
                  )}
                  {response.durationMs != null && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {response.durationMs}ms
                    </span>
                  )}
                </div>
                {response.error && <p className="text-sm text-rose-600">{response.error}</p>}
                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Headers</Label>
                  <div className="mt-1 max-h-32 overflow-auto rounded border bg-muted/30 p-2">
                    <table className="w-full text-xs">
                      <tbody>
                        {Object.entries(response.headers).filter(([k]) => k.toLowerCase().startsWith("x-") || k.toLowerCase() === "content-type").map(([k, v]) => (
                          <tr key={k}><td dir="ltr" className="py-0.5 pr-3 font-mono text-muted-foreground">{k}</td><td dir="ltr" className="py-0.5 font-mono break-all">{v}</td></tr>
                        ))}
                        {Object.keys(response.headers).length === 0 && <tr><td className="text-muted-foreground">no headers</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Body</Label>
                    <Button size="sm" variant="ghost" className="h-6" onClick={() => copy(response.body, "Body copied")}><Copy className="h-3 w-3" /></Button>
                  </div>
                  <pre dir="ltr" className="max-h-80 overflow-auto rounded border bg-muted/30 p-2 text-xs">{response.body || "<empty>"}</pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Generated code */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Generated Code</CardTitle>
          <CardDescription>Copy-ready snippets in your language of choice.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={lang} onValueChange={(v) => setLang(v as Language)}>
            <TabsList className="mb-3">
              {LANGS.map((l) => <TabsTrigger key={l.id} value={l.id}>{l.label}</TabsTrigger>)}
            </TabsList>
            {LANGS.map((l) => (
              <TabsContent key={l.id} value={l.id}>
                <div className="relative">
                  <Button size="sm" variant="outline" className="absolute right-2 top-2 h-7" onClick={() => copy(snippet, `${l.label} snippet copied`)}>
                    <Copy className="mr-1 h-3 w-3" /> Copy
                  </Button>
                  <pre dir="ltr" className="max-h-80 overflow-auto rounded border bg-muted/30 p-3 pr-24 text-xs">{snippet}</pre>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* History */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Request History</CardTitle>
          <CardDescription>Last 5 requests — click to re-run.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requests yet.</p>
          ) : (
            <div className="max-h-72 overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50 backdrop-blur">
                  <tr className="border-b text-left">
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Endpoint</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Duration</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/30" onClick={() => reRun(h)}>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(h.ts).toLocaleTimeString()}</td>
                      <td dir="ltr" className="px-3 py-2 font-mono text-xs">{h.method} {h.path}</td>
                      <td className="px-3 py-2">
                        {h.status != null ? <Badge className={badgeClass(h.status)}>{h.status}</Badge> : <Badge variant="destructive">err</Badge>}
                      </td>
                      <td dir="ltr" className="px-3 py-2 text-right font-mono text-xs">{h.durationMs}ms</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" className="h-7"><History className="h-3.5 w-3.5" /></Button>
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
  );
}

function badgeClass(status: number): string {
  if (status >= 200 && status < 300) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (status >= 400 && status < 500) return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  if (status >= 500) return "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  return "bg-muted text-muted-foreground";
}
