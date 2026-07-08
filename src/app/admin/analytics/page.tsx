"use client";

import { AnalyticsDashboard } from "./AnalyticsDashboard";

/**
 * Admin analytics page — wraps the shared AnalyticsDashboard component.
 * The dashboard itself uses admin auth; on 401 it redirects to /admin/login.
 *
 * The same AnalyticsDashboard component is reused by the user-facing route at
 * /dashboard/analytics (with `unauthorizedRedirect="/auth"`).
 */
export default function AdminAnalyticsPage() {
  return (
    <AnalyticsDashboard unauthorizedRedirect="/admin/login" backHref="/admin" />
  );
}
