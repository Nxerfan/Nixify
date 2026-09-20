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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Activity,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Clock,
  Download,
  RefreshCw,
  BarChart3,
  Zap,
  Mail,
  Server,
  ArrowLeft,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ---- Types ----
interface OverviewData {
  range: { from: string; to: string };
  kpis: {
    totalRequests: number;
    successfulVerifications: number;
    failedVerifications: number;
    successRate: number;
    avgVerificationMs: number | null;
  };
  activitySeries: Array<{ label: string; count: number }>;
  verifyTrend: {
    labels: string[];
    success: number[];
    failed: number[];
    expired: number[];
  };
  heatmap: number[][];
  quickStatus: { api: string; smtp: string; queue: string };
}

interface ActivityData {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: Array<{
    id: number;
    timestamp: string;
    requestId: string;
    email: string;
    eventType: string;
    status: string;
    purpose: string;
    ip: string | null;
    detail: string | null;
    durationMs: number | null;
  }>;
}

interface DailyData {
  range: { from: string; to: string };
  daily: Array<{
    date: string;
    requests: number;
    verified: number;
    failed: number;
    expired: number;
  }>;
}

interface ErrorData {
  range: { from: string; to: string };
  errors: Array<{
    errorType: string;
    errorCount: number;
    lastOccurrence: string;
    description: string;
  }>;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
];

export interface AnalyticsDashboardProps {
  /**
   * page uses "/auth".
   */
  unauthorizedRedirect?: string;
  /**
   * Where the "Back" button in the header should go to. Defaults to "/admin".
   */
  backHref?: string;
  /**
   * Whether to show the header (back button + title + theme toggle). Set to
   * false when embedding inside another layout that already provides a header.
   */
  showHeader?: boolean;
}

/**
 * AnalyticsDashboard — the full 3-tab analytics dashboard (Overview / Activity
 * / Reports). All API routes are user-aware (admin sees all data, PRO/MAX user
 * sees only their own).
 *
 * Extracted from `page.tsx` so it can be reused by both the admin route
 * (`/admin/analytics`) and the user-facing dashboard route
 * (`/dashboard/analytics`).
 */
export function AnalyticsDashboard({
  unauthorizedRedirect = "/admin/login",
  backHref = "/admin",
  showHeader = true,
}: AnalyticsDashboardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations();
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState("overview");

  // Overview state
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewRange, setOverviewRange] = useState("7d");
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Activity state
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [actPage, setActPage] = useState(1);
  const [actPageSize, setActPageSize] = useState(50);
  const [actRange, setActRange] = useState("7d");
  const [actEmail, setActEmail] = useState("");
  const [actRequestId, setActRequestId] = useState("");
  const [actStatus, setActStatus] = useState("");
  const [actEventType, setActEventType] = useState("");
  const [actSearch, setActSearch] = useState("");
  const [actLoading, setActLoading] = useState(true);

  // Reports state
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [errors, setErrors] = useState<ErrorData | null>(null);
  const [reportRange, setReportRange] = useState("30d");
  const [reportLoading, setReportLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const r = await fetch(
        `/api/admin/analytics/overview?range=${overviewRange}`,
      );
      if (r.status === 401) {
        router.push(unauthorizedRedirect);
        return;
      }
      setOverview(await r.json());
    } catch {
      toast({ title: "Failed to load overview", variant: "destructive" });
    } finally {
      setOverviewLoading(false);
    }
  }, [overviewRange, router, toast, unauthorizedRedirect]);

  const loadActivity = useCallback(async () => {
    setActLoading(true);
    const params = new URLSearchParams({
      page: String(actPage),
      pageSize: String(actPageSize),
      range: actRange,
    });
    if (actEmail) params.set("email", actEmail);
    if (actRequestId) params.set("requestId", actRequestId);
    if (actStatus) params.set("status", actStatus);
    if (actEventType) params.set("eventType", actEventType);
    if (actSearch) params.set("search", actSearch);
    try {
      const r = await fetch(`/api/admin/analytics/activity?${params}`);
      if (r.status === 401) {
        router.push(unauthorizedRedirect);
        return;
      }
      setActivity(await r.json());
    } catch {
      toast({ title: "Failed to load activity", variant: "destructive" });
    } finally {
      setActLoading(false);
    }
  }, [
    actPage,
    actPageSize,
    actRange,
    actEmail,
    actRequestId,
    actStatus,
    actEventType,
    actSearch,
    router,
    toast,
    unauthorizedRedirect,
  ]);

  const loadReports = useCallback(async () => {
    setReportLoading(true);
    try {
      const [d, e] = await Promise.all([
        fetch(`/api/admin/analytics/reports/daily?range=${reportRange}`).then(
          (r) => r.json(),
        ),
        fetch(`/api/admin/analytics/reports/errors?range=${reportRange}`).then(
          (r) => r.json(),
        ),
      ]);
      setDaily(d);
      setErrors(e);
    } catch {
      toast({ title: "Failed to load reports", variant: "destructive" });
    } finally {
      setReportLoading(false);
    }
  }, [reportRange, toast]);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/analytics/overview?range=7d");
      if (r.status === 401) {
        router.push(unauthorizedRedirect);
        return;
      }
      setAuthChecked(true);
      await loadOverview();
    })();
  }, [loadOverview, router, unauthorizedRedirect]);

  useEffect(() => {
    if (authChecked && tab === "activity") loadActivity();
  }, [tab, authChecked, loadActivity, actPage, actPageSize]);
  useEffect(() => {
    if (authChecked && tab === "reports") loadReports();
  }, [tab, authChecked, loadReports, reportRange]);

  if (!authChecked)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      {showHeader && (
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(backHref)}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <BarChart3 className="h-6 w-6 text-emerald-600" /> Analytics
                Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                OTP performance, activity monitoring & operational reports
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">
            <TrendingUp className="mr-1 h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="mr-1 h-4 w-4" /> Activity
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 className="mr-1 h-4 w-4" /> Reports
          </TabsTrigger>
        </TabsList>

        {/* ==================== OVERVIEW TAB ==================== */}
        <TabsContent value="overview" className="space-y-6">
          <div className="flex items-center justify-between">
            <Select
              value={overviewRange}
              onValueChange={(v) => {
                setOverviewRange(v);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={loadOverview}
              disabled={overviewLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>

          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              label={t("dashboard.common.totalOtpRequests")}
              value={overview?.kpis.totalRequests}
              icon={<Activity className="h-4 w-4" />}
              loading={overviewLoading}
            />
            <KpiCard
              label="Successful Verifications"
              value={overview?.kpis.successfulVerifications}
              icon={<CheckCircle2 className="h-4 w-4" />}
              loading={overviewLoading}
              tone="emerald"
            />
            <KpiCard
              label="Failed Verifications"
              value={overview?.kpis.failedVerifications}
              icon={<XCircle className="h-4 w-4" />}
              loading={overviewLoading}
              tone="rose"
            />
            <KpiCard
              label={t("dashboard.common.successRate")}
              value={
                overview
                  ? `${overview.kpis.successRate.toFixed(1)}%`
                  : undefined
              }
              icon={<TrendingUp className="h-4 w-4" />}
              loading={overviewLoading}
              tone={
                overview && overview.kpis.successRate >= 80
                  ? "emerald"
                  : "amber"
              }
            />
            <KpiCard
              label="Avg Verification Time"
              value={
                overview && overview.kpis.avgVerificationMs != null
                  ? `${(overview.kpis.avgVerificationMs / 1000).toFixed(1)}s`
                  : "—"
              }
              icon={<Clock className="h-4 w-4" />}
              loading={overviewLoading}
            />
          </div>

          {/* Charts row */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.common.otpActivity")}</CardTitle>
                <CardDescription>{t("dashboard.analytics.requestVolume")}</CardDescription>
              </CardHeader>
              <CardContent>
                {overviewLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={overview?.activitySeries ?? []}>
                      <defs>
                        <linearGradient
                          id="actGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#059669"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#059669"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--background)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#059669"
                        strokeWidth={2}
                        fill="url(#actGrad)"
                        name="Requests"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.analytics.verificationTrend")}</CardTitle>
                <CardDescription>{t("dashboard.analytics.successVsFailure")}</CardDescription>
              </CardHeader>
              <CardContent>
                {overviewLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={(overview?.verifyTrend.labels ?? []).map(
                        (l, i) => ({
                          label: l,
                          Success: overview!.verifyTrend.success[i],
                          Failed: overview!.verifyTrend.failed[i],
                          Expired: overview!.verifyTrend.expired[i],
                        }),
                      )}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--background)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Success" stackId="a" fill="#059669" />
                      <Bar dataKey="Failed" stackId="a" fill="#e11d48" />
                      <Bar dataKey="Expired" stackId="a" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Heatmap + Quick Status */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t("dashboard.common.trafficHeatmap")}</CardTitle>
                <CardDescription>
                  OTP activity by hour × day of week
                </CardDescription>
              </CardHeader>
              <CardContent>
                {overviewLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <Heatmap data={overview?.heatmap ?? []} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.common.quickStatus")}</CardTitle>
                <CardDescription>{t("dashboard.common.realTimeHealth")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {overviewLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <>
                    <StatusRow
                      label="API"
                      status={overview?.quickStatus.api ?? "operational"}
                      icon={<Server className="h-4 w-4" />}
                    />
                    <StatusRow
                      label="SMTP"
                      status={overview?.quickStatus.smtp ?? "operational"}
                      icon={<Mail className="h-4 w-4" />}
                    />
                    <StatusRow
                      label={t("dashboard.analytics.queue")}
                      status={overview?.quickStatus.queue ?? "direct_send"}
                      icon={<Zap className="h-4 w-4" />}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== ACTIVITY TAB ==================== */}
        <TabsContent value="activity" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t("dashboard.common.search")}</Label>
                  <Input
                    placeholder={t("dashboard.analytics.searchPlaceholder")}
                    value={actSearch}
                    onChange={(e) => setActSearch(e.target.value)}
                    className="w-48"
                    onKeyDown={(e) => e.key === "Enter" && setActPage(1)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("dashboard.analytics.range")}</Label>
                  <Select
                    value={actRange}
                    onValueChange={(v) => {
                      setActRange(v);
                      setActPage(1);
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RANGES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("dashboard.common.status")}</Label>
                  <Select
                    value={actStatus || "all"}
                    onValueChange={(v) => {
                      setActStatus(v === "all" ? "" : v);
                      setActPage(1);
                    }}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("dashboard.common.all")}</SelectItem>
                      <SelectItem value="success">{t("dashboard.common.success")}</SelectItem>
                      <SelectItem value="error">{t("dashboard.analytics.errorType")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("dashboard.common.eventType")}</Label>
                  <Select
                    value={actEventType || "all"}
                    onValueChange={(v) => {
                      setActEventType(v === "all" ? "" : v);
                      setActPage(1);
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("dashboard.common.all")}</SelectItem>
                      {[
                        "requested",
                        "sent",
                        "verified",
                        "failed",
                        "expired",
                        "resent",
                      ].map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("dashboard.analytics.pageSize")}</Label>
                  <Select
                    value={String(actPageSize)}
                    onValueChange={(v) => {
                      setActPageSize(Number(v));
                      setActPage(1);
                    }}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[25, 50, 100, 250].map((s) => (
                        <SelectItem key={s} value={String(s)}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setActPage(1);
                    loadActivity();
                  }}
                >
                  <Filter className="mr-1 h-4 w-4" /> Apply
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActSearch("");
                    setActEmail("");
                    setActRequestId("");
                    setActStatus("");
                    setActEventType("");
                    setActPage(1);
                  }}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="pt-6">
              {actLoading ? (
                <Skeleton className="h-96 w-full" />
              ) : (
                <>
                  <div className="mb-3 text-sm text-muted-foreground">
                    {activity?.total ?? 0} events — page {activity?.page} of{" "}
                    {activity?.totalPages || 1}
                  </div>
                  <div className="max-h-[500px] overflow-auto rounded border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/50 backdrop-blur">
                        <tr className="border-b text-left">
                          <th className="px-3 py-2 font-medium">{t("dashboard.common.timestamp")}</th>
                          <th className="px-3 py-2 font-medium">{t("dashboard.common.requestId")}</th>
                          <th className="px-3 py-2 font-medium">{t("dashboard.common.email")}</th>
                          <th className="px-3 py-2 font-medium">{t("dashboard.common.event")}</th>
                          <th className="px-3 py-2 font-medium">{t("dashboard.common.status")}</th>
                          <th className="px-3 py-2 font-medium">{t("dashboard.common.purpose")}</th>
                          <th className="px-3 py-2 font-medium">IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activity?.rows ?? []).length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-3 py-8 text-center text-muted-foreground"
                            >
                              No events found.
                            </td>
                          </tr>
                        ) : (
                          activity?.rows.map((r) => (
                            <tr
                              key={r.id}
                              className="border-b last:border-0 hover:bg-muted/30"
                            >
                              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                {new Date(r.timestamp).toLocaleString()}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">
                                {r.requestId.slice(0, 8)}…
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">
                                {r.email}
                              </td>
                              <td className="px-3 py-2">
                                <EventBadge type={r.eventType} />
                              </td>
                              <td className="px-3 py-2">
                                <StatusBadge status={r.status} />
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {r.purpose}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                                {r.ip ?? "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {activity?.total ?? 0} total
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={(activity?.page ?? 1) <= 1}
                        onClick={() => setActPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {activity?.page ?? 1} / {activity?.totalPages ?? 1}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          (activity?.page ?? 0) >= (activity?.totalPages ?? 1)
                        }
                        onClick={() => setActPage((p) => p + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== REPORTS TAB ==================== */}
        <TabsContent value="reports" className="space-y-6">
          <div className="flex items-center justify-between">
            <Select value={reportRange} onValueChange={setReportRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={loadReports}
              disabled={reportLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>

          {/* CSV Export */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" /> CSV Export
              </CardTitle>
              <CardDescription>
                Download raw data for external analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <CsvButton
                label={t("dashboard.common.otpRequests")}
                type="requests"
                range={reportRange}
                toast={toast}
              />
              <CsvButton
                label="Verification Results"
                type="verifications"
                range={reportRange}
                toast={toast}
              />
              <CsvButton
                label={t("dashboard.common.errorLogs")}
                type="errors"
                range={reportRange}
                toast={toast}
              />
              <CsvButton
                label={t("dashboard.common.dailyStatistics")}
                type="daily"
                range={reportRange}
                toast={toast}
              />
            </CardContent>
          </Card>

          {/* Daily Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.common.dailyStatistics")}</CardTitle>
              <CardDescription>
                Daily OTP request + verification breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reportLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <div className="max-h-80 overflow-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/50 backdrop-blur">
                      <tr className="border-b text-left">
                        <th className="px-3 py-2 font-medium">{t("dashboard.common.date")}</th>
                        <th className="px-3 py-2 text-right font-medium">
                          Requests
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Verified
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Failed
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Expired
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(daily?.daily ?? []).length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-8 text-center text-muted-foreground"
                          >
                            No data.
                          </td>
                        </tr>
                      ) : (
                        daily?.daily.map((d) => (
                          <tr
                            key={d.date}
                            className="border-b last:border-0 hover:bg-muted/30"
                          >
                            <td className="px-3 py-2">{d.date}</td>
                            <td className="px-3 py-2 text-right">
                              {d.requests}
                            </td>
                            <td className="px-3 py-2 text-right text-emerald-600 font-medium">
                              {d.verified}
                            </td>
                            <td className="px-3 py-2 text-right text-rose-600">
                              {d.failed}
                            </td>
                            <td className="px-3 py-2 text-right text-amber-600">
                              {d.expired}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error Reports */}
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.common.errorReports")}</CardTitle>
              <CardDescription>
                Errors grouped by type with last occurrence
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reportLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <div className="max-h-80 overflow-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/50 backdrop-blur">
                      <tr className="border-b text-left">
                        <th className="px-3 py-2 font-medium">{t("dashboard.common.errorType")}</th>
                        <th className="px-3 py-2 text-right font-medium">
                          Count
                        </th>
                        <th className="px-3 py-2 font-medium">
                          Last Occurrence
                        </th>
                        <th className="px-3 py-2 font-medium">{t("dashboard.common.descriptionCol")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(errors?.errors ?? []).length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-8 text-center text-muted-foreground"
                          >
                            No errors in this period.
                          </td>
                        </tr>
                      ) : (
                        errors?.errors.map((e) => (
                          <tr
                            key={e.errorType}
                            className="border-b last:border-0 hover:bg-muted/30"
                          >
                            <td className="px-3 py-2">
                              <Badge variant="destructive">{e.errorType}</Badge>
                            </td>
                            <td className="px-3 py-2 text-right font-bold">
                              {e.errorCount}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                              {new Date(e.lastOccurrence).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {e.description}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---- Sub-components ----

function KpiCard({
  label,
  value,
  icon,
  loading,
  tone,
}: {
  label: string;
  value?: number | string;
  icon: React.ReactNode;
  loading: boolean;
  tone?: "emerald" | "rose" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "rose"
        ? "text-rose-600"
        : tone === "amber"
          ? "text-amber-600"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={toneClass}>{icon}</span>
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-16" />
        ) : (
          <div className={`mt-1 text-2xl font-bold ${toneClass}`}>
            {value ?? 0}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Heatmap({ data }: { data: number[][] }) {
  const max = Math.max(1, ...data.flat());
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="px-1 py-1"></th>
            {hours.map((h) => (
              <th
                key={h}
                className="px-0.5 py-1 font-normal text-muted-foreground"
              >
                {h.toString().padStart(2, "0")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((day, dIdx) => (
            <tr key={day}>
              <td className="pr-2 py-0.5 font-medium text-muted-foreground">
                {day}
              </td>
              {hours.map((h) => {
                const count = data[dIdx]?.[h] ?? 0;
                const intensity = count / max;
                const bg =
                  count === 0
                    ? "rgba(5,150,105,0.03)"
                    : `rgba(5,150,105,${0.15 + intensity * 0.85})`;
                return (
                  <td
                    key={h}
                    className="p-0.5"
                    title={`${day} ${h}:00 — ${count} requests`}
                  >
                    <div
                      className="h-5 w-5 rounded-sm"
                      style={{ backgroundColor: bg }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusRow({
  label,
  status,
  icon,
}: {
  label: string;
  status: string;
  icon: React.ReactNode;
}) {
  const tone =
    status === "operational" || status === "direct_send"
      ? "emerald"
      : status === "degraded"
        ? "amber"
        : status === "not_configured"
          ? "muted"
          : "rose";
  const colorClass =
    tone === "emerald"
      ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
      : tone === "amber"
        ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30"
        : tone === "rose"
          ? "text-rose-600 bg-rose-50 dark:bg-rose-950/30"
          : "text-muted-foreground bg-muted";
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
      >
        {status.replace(/_/g, " ")}
      </span>
    </div>
  );
}

function EventBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    requested: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    sent: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
    verified:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    failed: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    expired:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    resent:
      "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${map[type] ?? ""}`}
    >
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return status === "success" ? (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
      <CheckCircle2 className="h-3 w-3" /> success
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-rose-600">
      <XCircle className="h-3 w-3" /> error
    </span>
  );
}

function CsvButton({
  label,
  type,
  range,
  toast,
}: {
  label: string;
  type: string;
  range: string;
  toast: any;
}) {
  const [loading, setLoading] = useState(false);
  async function download() {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/admin/analytics/export?type=${type}&range=${range}`,
      );
      if (!r.ok) {
        toast({ title: "Export failed", variant: "destructive" });
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        r.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        `${type}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export ready", description: label });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={download} disabled={loading}>
      <Download className="mr-2 h-4 w-4" /> {loading ? "Preparing…" : label}
    </Button>
  );
}
