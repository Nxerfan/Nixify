import { db } from "@/lib/db";

/**
 * Analytics layer for the OTP platform.
 *
 * `OtpEvent` is the single source of truth for all charts, tables, and reports.
 * It's append-only and never updated — every discrete lifecycle event (requested,
 * sent, verified, failed, expired, resent) gets its own row.
 *
 * Email addresses are stored in full for filtering, but **masked at the API
 * layer** before being returned to the dashboard (privacy).
 */

export type OtpEventType =
  | "requested"
  | "sent"
  | "verified"
  | "failed"
  | "expired"
  | "resent";

export type OtpEventStatus = "success" | "error";

export interface LogOtpEventInput {
  requestId: string;
  email: string;
  eventType: OtpEventType;
  status: OtpEventStatus;
  purpose: string;
  ip?: string | null;
  detail?: string | null;
  durationMs?: number | null;
  userId?: number | null; // owner scope (null = admin-only visibility)
}

/** Log an OTP lifecycle event. Never throws (analytics must not break the request path). */
export async function logOtpEvent(input: LogOtpEventInput): Promise<void> {
  try {
    await db.otpEvent.create({
      data: {
        requestId: input.requestId,
        email: input.email,
        eventType: input.eventType,
        status: input.status,
        purpose: input.purpose,
        ip: input.ip ?? null,
        detail: input.detail ?? null,
        durationMs: input.durationMs ?? null,
        userId: input.userId ?? null,
      },
    });
  } catch {
    // Swallow — analytics logging is best-effort.
  }
}

// ---- Email masking (privacy) ----------------------------------------------

/**
 * Mask an email address for display in the dashboard.
 *   "alice@example.com" → "a***@e***.com"
 *   "b@short.io"        → "b***@s***.io"
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const maskedLocal = local.length <= 1 ? local + "***" : local[0] + "***";
  const dot = domain.lastIndexOf(".");
  const maskedDomain =
    dot > 0 ? domain[0] + "***" + domain.slice(dot) : domain[0] + "***";
  return `${maskedLocal}@${maskedDomain}`;
}

// ---- Time-range helpers ----------------------------------------------------

export type TimeRange = "today" | "7d" | "30d" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export function resolveRange(range: TimeRange, from?: string, to?: string): DateRange {
  const now = new Date();
  switch (range) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { from: start, to: now };
    }
    case "7d":
      return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
    case "30d":
      return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
    case "custom":
      return {
        from: from ? new Date(from) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        to: to ? new Date(to) : now,
      };
    default:
      return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
  }
}

// ---- Aggregation helpers --------------------------------------------------

/**
 * KPI summary for the Overview tab.
 * Computed from OtpEvent in the given range.
 */
export interface OverviewKpis {
  totalRequests: number;       // requested + resent events
  successfulVerifications: number; // verified events with status success
  failedVerifications: number;     // failed events
  successRate: number;             // successful / (successful + failed) * 100
  avgVerificationMs: number | null; // avg durationMs on verified events
}

export async function getOverviewKpis(range: DateRange, scope?: { userId?: number }): Promise<OverviewKpis> {
  const events = await db.otpEvent.findMany({
    where: {
      createdAt: { gte: range.from, lte: range.to },
      ...(scope?.userId !== undefined ? { userId: scope.userId } : {}),
    },
    select: { eventType: true, status: true, durationMs: true },
  });

  const totalRequests = events.filter((e) => e.eventType === "requested" || e.eventType === "resent").length;
  const successfulVerifications = events.filter((e) => e.eventType === "verified" && e.status === "success").length;
  const failedVerifications = events.filter((e) => e.eventType === "failed").length;
  const verifyTotal = successfulVerifications + failedVerifications;
  const successRate = verifyTotal > 0 ? (successfulVerifications / verifyTotal) * 100 : 0;

  const verifiedDurations = events.filter((e) => e.eventType === "verified" && e.durationMs != null);
  const avgVerificationMs = verifiedDurations.length > 0
    ? Math.round(verifiedDurations.reduce((s, e) => s + (e.durationMs ?? 0), 0) / verifiedDurations.length)
    : null;

  return { totalRequests, successfulVerifications, failedVerifications, successRate, avgVerificationMs };
}

/**
 * Time-series of OTP request volume, bucketed by day (or hour for "today").
 * Returns [{ label, count }] for charting.
 */
export async function getOtpActivitySeries(range: DateRange, scope?: { userId?: number }): Promise<Array<{ label: string; count: number }>> {
  const events = await db.otpEvent.findMany({
    where: {
      createdAt: { gte: range.from, lte: range.to },
      eventType: { in: ["requested", "resent"] },
      ...(scope?.userId !== undefined ? { userId: scope.userId } : {}),
    },
    select: { createdAt: true },
  });

  const isToday = range.to.getTime() - range.from.getTime() < 36 * 60 * 60 * 1000;
  const bucket = isToday ? "hour" : "day";

  const buckets = new Map<string, number>();
  for (const e of events) {
    const d = new Date(e.createdAt);
    const key = isToday
      ? `${d.getHours().toString().padStart(2, "0")}:00`
      : `${d.getMonth() + 1}/${d.getDate()}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  // Fill gaps for a continuous chart.
  if (isToday) {
    const result: Array<{ label: string; count: number }> = [];
    for (let h = 0; h < 24; h++) {
      const key = `${h.toString().padStart(2, "0")}:00`;
      result.push({ label: key, count: buckets.get(key) ?? 0 });
    }
    return result;
  } else {
    const result: Array<{ label: string; count: number }> = [];
    const cur = new Date(range.from);
    cur.setHours(0, 0, 0, 0);
    while (cur <= range.to) {
      const key = `${cur.getMonth() + 1}/${cur.getDate()}`;
      result.push({ label: key, count: buckets.get(key) ?? 0 });
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }
}

/**
 * Verification trend: success / failed / expired per day (or hour for today).
 */
export async function getVerificationTrend(range: DateRange, scope?: { userId?: number }): Promise<{
  labels: string[];
  success: number[];
  failed: number[];
  expired: number[];
}> {
  const events = await db.otpEvent.findMany({
    where: {
      createdAt: { gte: range.from, lte: range.to },
      eventType: { in: ["verified", "failed", "expired"] },
      ...(scope?.userId !== undefined ? { userId: scope.userId } : {}),
    },
    select: { eventType: true, status: true, createdAt: true },
  });

  const isToday = range.to.getTime() - range.from.getTime() < 36 * 60 * 60 * 1000;
  const labels: string[] = [];
  const success = new Map<string, number>();
  const failed = new Map<string, number>();
  const expired = new Map<string, number>();

  const genKey = (d: Date) =>
    isToday
      ? `${d.getHours().toString().padStart(2, "0")}:00`
      : `${d.getMonth() + 1}/${d.getDate()}`;

  // Initialize buckets.
  if (isToday) {
    for (let h = 0; h < 24; h++) {
      const k = `${h.toString().padStart(2, "0")}:00`;
      labels.push(k);
      success.set(k, 0); failed.set(k, 0); expired.set(k, 0);
    }
  } else {
    const cur = new Date(range.from);
    cur.setHours(0, 0, 0, 0);
    while (cur <= range.to) {
      const k = `${cur.getMonth() + 1}/${cur.getDate()}`;
      labels.push(k);
      success.set(k, 0); failed.set(k, 0); expired.set(k, 0);
      cur.setDate(cur.getDate() + 1);
    }
  }

  for (const e of events) {
    const k = genKey(new Date(e.createdAt));
    if (e.eventType === "verified" && e.status === "success") success.set(k, (success.get(k) ?? 0) + 1);
    else if (e.eventType === "failed") failed.set(k, (failed.get(k) ?? 0) + 1);
    else if (e.eventType === "expired") expired.set(k, (expired.get(k) ?? 0) + 1);
  }

  return {
    labels,
    success: labels.map((l) => success.get(l) ?? 0),
    failed: labels.map((l) => failed.get(l) ?? 0),
    expired: labels.map((l) => expired.get(l) ?? 0),
  };
}

/**
 * Traffic heatmap: OTP activity by hour-of-day (0-23) × day-of-week (0-6).
 * Returns a 7×24 matrix of counts.
 *   result[dayOfWeek][hour] = count
 */
export async function getTrafficHeatmap(range: DateRange, scope?: { userId?: number }): Promise<number[][]> {
  const events = await db.otpEvent.findMany({
    where: {
      createdAt: { gte: range.from, lte: range.to },
      eventType: { in: ["requested", "resent"] },
      ...(scope?.userId !== undefined ? { userId: scope.userId } : {}),
    },
    select: { createdAt: true },
  });

  // 7 days × 24 hours, initialized to 0.
  const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const e of events) {
    const d = new Date(e.createdAt);
    // JS getDay(): 0=Sunday ... 6=Saturday
    matrix[d.getDay()][d.getHours()]++;
  }
  return matrix;
}

/**
 * Daily statistics for the Reports tab.
 * Returns one row per day in the range.
 */
export interface DailyStat {
  date: string;
  requests: number;
  verified: number;
  failed: number;
  expired: number;
}

export async function getDailyStats(range: DateRange, scope?: { userId?: number }): Promise<DailyStat[]> {
  const events = await db.otpEvent.findMany({
    where: {
      createdAt: { gte: range.from, lte: range.to },
      ...(scope?.userId !== undefined ? { userId: scope.userId } : {}),
    },
    select: { eventType: true, status: true, createdAt: true },
  });

  const byDay = new Map<string, DailyStat>();
  const cur = new Date(range.from);
  cur.setHours(0, 0, 0, 0);
  while (cur <= range.to) {
    const key = cur.toISOString().slice(0, 10);
    byDay.set(key, { date: key, requests: 0, verified: 0, failed: 0, expired: 0 });
    cur.setDate(cur.getDate() + 1);
  }

  for (const e of events) {
    const key = new Date(e.createdAt).toISOString().slice(0, 10);
    const row = byDay.get(key);
    if (!row) continue;
    if (e.eventType === "requested" || e.eventType === "resent") row.requests++;
    else if (e.eventType === "verified" && e.status === "success") row.verified++;
    else if (e.eventType === "failed") row.failed++;
    else if (e.eventType === "expired") row.expired++;
  }

  return Array.from(byDay.values());
}

/**
 * Error report: counts grouped by error type.
 */
export interface ErrorReportRow {
  errorType: string;
  errorCount: number;
  lastOccurrence: Date;
  description: string;
}

export async function getErrorReport(range: DateRange, scope?: { userId?: number }): Promise<ErrorReportRow[]> {
  const events = await db.otpEvent.findMany({
    where: {
      createdAt: { gte: range.from, lte: range.to },
      status: "error",
      ...(scope?.userId !== undefined ? { userId: scope.userId } : {}),
    },
    select: { eventType: true, detail: true, createdAt: true },
  });

  const byType = new Map<string, { count: number; last: Date; detail: string }>();
  for (const e of events) {
    const existing = byType.get(e.eventType);
    if (existing) {
      existing.count++;
      if (e.createdAt > existing.last) {
        existing.last = e.createdAt;
        existing.detail = e.detail ?? existing.detail;
      }
    } else {
      byType.set(e.eventType, { count: 1, last: e.createdAt, detail: e.detail ?? "" });
    }
  }

  const descriptions: Record<string, string> = {
    sent: "SMTP or email delivery error — the OTP could not be delivered to the recipient.",
    failed: "OTP verification error — the user entered an incorrect code.",
    expired: "Expired OTP attempt — the user tried to verify after the 10-minute TTL.",
    verified: "Verification processing error — unexpected failure during consume.",
    requested: "OTP generation error — failed to create or persist the OTP record.",
    resent: "Resend error — failed to re-issue an OTP.",
  };

  return Array.from(byType.entries())
    .map(([type, v]) => ({
      errorType: type,
      errorCount: v.count,
      lastOccurrence: v.last,
      description: v.detail || descriptions[type] || "Unknown error",
    }))
    .sort((a, b) => b.errorCount - a.errorCount);
}

// ---- Quick status ---------------------------------------------------------

export interface QuickStatus {
  api: "operational" | "degraded" | "down";
  smtp: "operational" | "degraded" | "not_configured";
  queue: "direct_send" | "n/a";
}

export async function getQuickStatus(): Promise<QuickStatus> {
  // API status: always operational if this route responds.
  const api: QuickStatus["api"] = "operational";

  // SMTP status: check config + recent send failures.
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass || smtpPass === "your_16_char_app_password") {
    return { api, smtp: "not_configured", queue: "direct_send" };
  }
  // Check last 10 send events — if >50% errored, degraded.
  const recentSends = await db.otpEvent.findMany({
    where: { eventType: "sent" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { status: true },
  });
  if (recentSends.length === 0) return { api, smtp: "operational", queue: "direct_send" };
  const errors = recentSends.filter((s) => s.status === "error").length;
  const smtp: QuickStatus["smtp"] = errors > recentSends.length / 2 ? "degraded" : "operational";

  return { api, smtp, queue: "direct_send" };
}

// ---- CSV export -----------------------------------------------------------

export function toCsv(rows: Record<string, unknown>[], columns: Array<{ key: string; label: string }>): string {
  const header = columns.map((c) => csvEscape(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => csvEscape(String(r[c.key] ?? ""))).join(","))
    .join("\n");
  return header + "\n" + body;
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
