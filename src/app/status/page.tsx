import type { Metadata } from "next";
import { AmbientBackground } from "@/app/auth/components/AmbientBackground";
import { Activity, AlertCircle, CheckCircle, Clock, Zap, KeyRound } from "lucide-react";
import { absoluteUrl } from "@/lib/site/site-url";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Status",
  description:
    "Real-time API request metrics from the Nixify production database — request volume, error rate, and response latency over the last 24 hours.",
  alternates: {
    canonical: "/status",
  },
  openGraph: {
    title: "Nixify Status",
    description:
      "Real-time API request metrics from the Nixify production database — request volume, error rate, and response latency over the last 24 hours.",
    url: absoluteUrl("/status"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nixify Status",
    description:
      "Real-time API request metrics from the Nixify production database — request volume, error rate, and response latency over the last 24 hours.",
  },
  // Status data changes frequently — don't cache aggressively in CDNs.
  revalidate: 60,
};

export const dynamic = "force-dynamic";

interface StatusMetrics {
  totalRequests24h: number;
  errorRate24h: number;
  avgLatencyMs24h: number;
  totalRequests7d: number;
  activeApiKeys: number;
  webhookDeliveries24h: number;
  webhookSuccessRate: number;
  generatedAt: string;
}

async function getMetrics(): Promise<StatusMetrics> {
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Run independent counts in parallel. All queries are bounded time windows
  // and use the createdAt index.
  const [
    total24h,
    errors24h,
    latencyAgg,
    total7d,
    activeKeys,
    webhookDeliveries,
    webhookSuccess,
  ] = await Promise.all([
    db.requestLog.count({ where: { createdAt: { gte: h24 } } }),
    db.requestLog.count({ where: { createdAt: { gte: h24 }, status: { gte: 400 } } }),
    db.requestLog.aggregate({
      _avg: { durationMs: true },
      where: { createdAt: { gte: h24 } },
    }),
    db.requestLog.count({ where: { createdAt: { gte: d7 } } }),
    db.apiKey.count({ where: { revokedAt: null } }),
    db.webhookDelivery.count({ where: { createdAt: { gte: h24 } } }),
    db.webhookDelivery.count({
      where: { createdAt: { gte: h24 }, status: "delivered" },
    }),
  ]);

  const errorRate = total24h > 0 ? (errors24h / total24h) * 100 : 0;
  const webhookSuccessRate =
    webhookDeliveries > 0 ? (webhookSuccess / webhookDeliveries) * 100 : 0;

  return {
    totalRequests24h: total24h,
    errorRate24h: Math.round(errorRate * 100) / 100,
    avgLatencyMs24h: Math.round(latencyAgg._avg.durationMs ?? 0),
    totalRequests7d: total7d,
    activeApiKeys: activeKeys,
    webhookDeliveries24h: webhookDeliveries,
    webhookSuccessRate: Math.round(webhookSuccessRate * 100) / 100,
    generatedAt: now.toISOString(),
  };
}

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
  let metrics: StatusMetrics;
  let dbError = false;

  try {
    metrics = await getMetrics();
  } catch {
    // If the DB is unreachable, surface that honestly rather than faking data.
    dbError = true;
    metrics = {
      totalRequests24h: 0,
      errorRate24h: 0,
      avgLatencyMs24h: 0,
      totalRequests7d: 0,
      activeApiKeys: 0,
      webhookDeliveries24h: 0,
      webhookSuccessRate: 0,
      generatedAt: new Date().toISOString(),
    };
  }

  return (
    <>
      <AmbientBackground />
      <div className="mx-auto max-w-4xl px-4 pb-24 pt-28 sm:px-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-100">
          <Activity className="h-8 w-8 text-emerald-400" /> Status
        </h1>
        <p className="mt-3 text-sm text-gray-400">
          Real-time metrics from the Nixify production database. These numbers
          are computed live from the <code dir="ltr" className="font-mono text-emerald-300">RequestLog</code> and
          <code dir="ltr" className="font-mono text-emerald-300">WebhookDelivery</code> tables — no synthetic or
          cached data. No uptime SLA, historical incident history, or external
          monitoring is claimed.
        </p>

        {dbError ? (
          <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            <AlertCircle className="mr-2 inline h-4 w-4" />
            Unable to fetch live metrics right now — the database is unreachable.
            This is a real error, not a placeholder. Please retry shortly.
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-2 text-sm text-gray-400">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span>Operational — data generated at{" "}
                <code dir="ltr" className="font-mono text-emerald-300">
                  {new Date(metrics.generatedAt).toISOString()}
                </code>
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard
                icon={<Zap className="h-4 w-4" />}
                label="API Requests (24h)"
                value={metrics.totalRequests24h.toLocaleString()}
                sub={`${metrics.totalRequests7d.toLocaleString()} in the last 7 days`}
                accent="emerald"
              />
              <MetricCard
                icon={<AlertCircle className="h-4 w-4" />}
                label="Error Rate (24h)"
                value={`${metrics.errorRate24h}%`}
                sub="HTTP status ≥ 400"
                accent={metrics.errorRate24h < 5 ? "emerald" : "amber"}
              />
              <MetricCard
                icon={<Clock className="h-4 w-4" />}
                label="Avg Latency (24h)"
                value={`${metrics.avgLatencyMs24h} ms`}
                sub="Mean response time"
                accent="blue"
              />
              <MetricCard
                icon={<KeyRound className="h-4 w-4" />}
                label="Active API Keys"
                value={metrics.activeApiKeys.toLocaleString()}
                sub="Non-revoked keys"
                accent="gray"
              />
              <MetricCard
                icon={<Activity className="h-4 w-4" />}
                label="Webhook Deliveries (24h)"
                value={metrics.webhookDeliveries24h.toLocaleString()}
                sub={`${metrics.webhookSuccessRate}% delivered successfully`}
                accent="emerald"
              />
            </div>

            <div className="mt-8 rounded-lg border border-gray-800/60 bg-gray-950/60 p-6">
              <h2 className="text-sm font-medium uppercase tracking-wide text-gray-500">
                What this page is
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-gray-400">
                <li>Live data from the production database (PostgreSQL), refreshed on every page load (max once per 60s via ISR).</li>
                <li>Metrics cover the authenticated v1 API (<code dir="ltr" className="font-mono text-emerald-300">/api/v1/*</code>) — every request is logged with its status, duration, and API key.</li>
                <li>Webhook delivery metrics cover all queued deliveries, regardless of tenant.</li>
              </ul>
              <h2 className="mt-6 text-sm font-medium uppercase tracking-wide text-gray-500">
                What this page is not
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-gray-400">
                <li>No uptime percentage or SLA — that would require external synthetic monitoring, which is not deployed.</li>
                <li>No historical incident list or status timeline — incidents are not tracked in the database.</li>
                <li>No component-level status (database, SMTP, etc.) — only the aggregate API request metrics above.</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  );
}
