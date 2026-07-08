"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Real dashboard data hook — fetches actual data from the existing backend:
 *   - Profile: GET /api/profile/me (real user info)
 *   - Stats: GET /api/admin/stats (real user counts, OTP counts, security events)
 *   - Activity: GET /api/admin/analytics/activity (real OTP events from OtpEvent table)
 *
 * Falls back gracefully if the user isn't an admin (stats/activity will be empty).
 */

export interface DashboardStats {
  totalUsers: number;
  activeSessions: number;
  otpSentToday: number;
  signupsThisWeek: number;
}

export interface ActivityItem {
  id: string;
  type: "signup" | "signin" | "otp_sent" | "otp_verified" | "password_reset";
  description: string;
  timestamp: string;
  email: string;
}

export interface UserProfile {
  name: string;
  email: string;
  plan: "Free" | "Pro";
  initials: string;
}

export function useDashboardData() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch real user profile
      const profileRes = await fetch("/api/profile/me", { cache: "no-store" });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        const user = profileData.user;
        if (user) {
          const name = user.fullName || user.email?.split("@")[0] || "User";
          const initials = name
            .split(" ")
            .map((n: string) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
          setProfile({
            name,
            email: user.email || "",
            plan: "Free", // TODO: determine plan from user data
            initials,
          });
        }
      }

      // 2. Fetch real stats (user-scoped, no admin required)
      const statsRes = await fetch("/api/dashboard/stats", { cache: "no-store" });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats({
          totalUsers: statsData.totalUsers || 0,
          activeSessions: statsData.activeSessions || 0,
          otpSentToday: statsData.otpSentToday || 0,
          signupsThisWeek: statsData.signupsThisWeek || 0,
        });
      }

      // 3. Fetch real activity (user-scoped)
      const activityRes = await fetch("/api/dashboard/activity", { cache: "no-store" });
      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setActivity(activityData.activities || []);
      }
    } catch {
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Refresh stats every 30s (real data)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/dashboard/stats", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setStats((prev) => ({
            totalUsers: data.totalUsers || prev?.totalUsers || 0,
            activeSessions: data.activeSessions || 0,
            otpSentToday: data.otpSentToday || prev?.otpSentToday || 0,
            signupsThisWeek: data.signupsThisWeek || prev?.signupsThisWeek || 0,
          }));
        }
      } catch {
        // Silently ignore — best-effort refresh
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return { stats, activity, profile, loading, error, refetch: fetchAll };
}
