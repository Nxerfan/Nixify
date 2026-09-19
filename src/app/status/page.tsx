import type { Metadata } from "next";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { Activity, AlertCircle, CheckCircle, Clock, Zap, KeyRound } from "lucide-react";
import { absoluteUrl } from "@/lib/site/site-url";
import { db } from "@/lib/db";
import { getCachedStatusMetrics, type StatusMetrics } from "@/lib/status/metrics";

export const metadata: Metadata = {
  title: "Status",
  description:
    "Recent Nixify API and webhook metrics derived from application telemetry. This page is not an uptime monitor or SLA.",
  alternates: {
    canonical: "/status",
  },
  openGraph: {
    title: "Nixify Status",
    description:
      "Recent Nixify API and webhook metrics derived from application telemetry. This page is not an uptime monitor or SLA.",
    url: absoluteUrl("/status"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nixify Status",
    description:
      "Recent Nixify API and webhook metrics derived from application telemetry. This page is not an uptime monitor or SLA.",
  },
};

/**
 * ISR — revalidate the page (and the cached metrics) every 60 seconds.
 *
 * This page MUST NOT be force-dynamic (that would bypass caching and hit the DB
 * on every anonymous page view) and MUST NOT query the DB at build time (the
 * build environment has no production data). `revalidate: 60` gives bounded
 * staleness: the first request after deployment builds the page, and
 * subsequent requests within 60s serve the cached HTML.
 */
export const revalidate = 60;

function MetricCard({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: "emerald" | "amber" | "blue" | "gray";
}) {
  const accentMap = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    blue: "text-blue-400",
    gray: "text-gray-400",
  };
  return (
    <div className="rounded-lg border border-gray-800/60 bg-gray-950/60 p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        <span className={accentMap[accent]}>{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-100">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

export default async function StatusPage() {
  let result: { metrics: StatusMetrics | null; ok: boolean };
  try {
    result = await getCachedStatusMetrics(db);
  } catch {
    // Defensive — getCachedStatusMetrics already swallows internal errors,
    // but if the module itself fails to load we still render gracefully.
    result = { metrics: null, ok: false };
  }

  const ok = result.ok && result.metrics !== null;
  const m = result.metrics;

  return (
    <>
      <AmbientBackground />
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-28 sm:px-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-100">
          <Activity className="h-8 w-8 text-emerald-400" /> Status
        </h1>
        <p className="mt-3 text-sm text-gray-400">
          Recent service metrics derived from Nixify RequestLog and
          WebhookDelivery records. Metrics may be cached for up to 60 seconds to
          limit database load. These are application telemetry, not an
          independent uptime monitor or SLA.
        </p>

        {ok && m ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-gray-400">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span>
              Latest metrics available — generated at{" "}
              <code dir="ltr" className="font-mono text-emerald-300">
                {new Date(m.generatedAt).toISOString()}
              </code>
            </span>
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            <AlertCircle className="mr-2 inline h-4 w-4" />
            Unable to load status metrics right now. This page cannot determine
            overall service availability from this failure alone. Please retry
            later.
          </div>
        )}

        {ok && m && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              icon={<Zap className="h-4 w-4" />}
              label="API Requests (24h)"
              value={m.totalRequests24h.toLocaleString()}
              sub={`${m.totalRequests7d.toLocaleString()} in the last 7 days`}
              accent="emerald"
            />
            <MetricCard
              icon={<AlertCircle className="h-4 w-4" />}
              label="HTTP ≥400 Rate (24h)"
              value={`${m.errorRate24h}%`}
              sub="Share of logged authenticated v1 requests returning status 400 or higher."
              accent={m.errorRate24h < 5 ? "emerald" : "amber"}
            />
            <MetricCard
              icon={<Clock className="h-4 w-4" />}
              label="Avg Latency (24h)"
              value={`${m.avgLatencyMs24h} ms`}
              sub="Mean response time"
              accent="blue"
            />
            <MetricCard
              icon={<KeyRound className="h-4 w-4" />}
              label="Active API Keys"
              value={m.activeApiKeys.toLocaleString()}
              sub="Non-revoked, non-expired keys"
              accent="gray"
            />
            <MetricCard
              icon={<Activity className="h-4 w-4" />}
              label="Webhook Deliveries (24h)"
              value={m.webhookDeliveries24h.toLocaleString()}
              sub={`${m.webhookSuccessRate}% delivered successfully (delivered / (delivered + failed))`}
              accent="emerald"
            />
          </div>
        )}

        <div className="mt-8 rounded-lg border border-gray-800/60 bg-gray-950/60 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
            What this page is
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-400">
            <li>Aggregated application telemetry from authenticated v1 request logs and webhook delivery records.</li>
            <li>Metrics may be cached for up to 60 seconds.</li>
            <li>Webhook metrics are aggregate counts and do not expose tenant-level data.</li>
          </ul>
          <h2 className="mt-6 text-sm font-medium uppercase tracking-wide text-gray-500">
            What this page is not
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-400">
            <li>No uptime percentage or SLA. Independent uptime measurement requires external synthetic monitoring.</li>
            <li>No historical incident timeline is published from this page.</li>
            <li>No component-level health claim is inferred from these aggregate metrics.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
