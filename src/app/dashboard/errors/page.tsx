"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ERRORS_CATALOG, type ErrorEntry } from "@/lib/dx/errors-catalog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, AlertCircle, Search, BookOpen, Lightbulb, Wrench, Link as LinkIcon,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

function httpClass(status: number): string {
  if (status >= 500) return "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  if (status >= 400) return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "bg-muted text-muted-foreground";
}

export default function ErrorsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "4xx" | "5xx">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ERRORS_CATALOG.filter((e) => {
      if (statusFilter === "4xx" && (e.httpStatus < 400 || e.httpStatus >= 500)) return false;
      if (statusFilter === "5xx" && e.httpStatus < 500) return false;
      if (!q) return true;
      return (
        e.code.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
      );
    });
  }, [query, statusFilter]);

  async function copyCode(code: string) {
    try { await navigator.clipboard.writeText(code); toast({ title: t("dashboard.errorsExplorer.codeCopied") }); }
    catch { toast({ title: t("dashboard.errorsExplorer.copyFailed"), variant: "destructive" }); }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}><ArrowLeft className="mr-1 h-4 w-4" /> {t("dashboard.nav.dashboard")}</Button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><AlertCircle className="h-6 w-6 text-emerald-600" /> {t("dashboard.errorsExplorer.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("dashboard.errorsExplorer.subtitle")}</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px] space-y-1">
              <label htmlFor="err-search" className="text-xs font-medium text-muted-foreground">{t("dashboard.errorsExplorer.search")}</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="err-search" placeholder={t("dashboard.errorsExplorer.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} className="pl-7" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t("dashboard.errorsExplorer.httpStatus")}</label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("dashboard.errorsExplorer.all")}</SelectItem>
                  <SelectItem value="4xx">{t("dashboard.errorsExplorer.status4xx")}</SelectItem>
                  <SelectItem value="5xx">{t("dashboard.errorsExplorer.status5xx")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setQuery(""); setStatusFilter("all"); }}>{t("dashboard.errorsExplorer.clear")}</Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t("dashboard.errorsExplorer.summary").replace("{filtered}", String(filtered.length)).replace("{total}", String(ERRORS_CATALOG.length))}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((e) => (
          <ErrorCard key={e.code} entry={e} onCopy={copyCode} />
        ))}
        {filtered.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t("dashboard.errorsExplorer.empty")}
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorCard({ entry, onCopy }: { entry: ErrorEntry; onCopy: (code: string) => void }) {
  const t = useTranslations();
  return (
    <Card id={`error-${entry.code}`} className="flex flex-col scroll-mt-24">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="cursor-pointer font-mono text-xs" onClick={() => onCopy(entry.code)} title={t("dashboard.errorsExplorer.copyTooltip")}>{entry.code}</Badge>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${httpClass(entry.httpStatus)}`}>{entry.httpStatus}</span>
        </div>
        <CardTitle className="mt-2 text-base">{entry.title}</CardTitle>
        <CardDescription>{entry.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 text-sm">
        <div>
          <div className="mb-1 flex items-center gap-1 text-xs font-medium text-amber-600"><AlertCircle className="h-3 w-3" /> {t("dashboard.errorsExplorer.causes")}</div>
          <ul className="ml-4 list-disc space-y-0.5 text-xs text-muted-foreground">
            {entry.causes.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-1 text-xs font-medium text-emerald-600"><Wrench className="h-3 w-3" /> {t("dashboard.errorsExplorer.recommendedFix")}</div>
          <ul className="ml-4 list-disc space-y-0.5 text-xs text-muted-foreground">
            {entry.fixes.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
        <div className="mt-auto pt-2 flex flex-wrap gap-3">
          <a
            href={`/docs#error-${entry.code}`}
            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
          >
            <BookOpen className="h-3 w-3" /> {t("dashboard.errorsExplorer.publicDocs")}
          </a>
          <a
            href={`/dashboard/errors#error-${entry.code}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <LinkIcon className="h-3 w-3" /> {t("dashboard.errorsExplorer.permalink")}
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
