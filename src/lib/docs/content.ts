/**
 * Shared docs content — navigation structure + localized labels.
 *
 * Both public /docs and dashboard /dashboard/docs consume this to render
 * their sidebar navigation and section labels. The actual section CONTENT
 * (code examples, API descriptions, etc.) is rendered by the DocsContent
 * component, which reads from ERRORS_CATALOG and other canonical sources.
 *
 * Technical tokens (endpoint paths, HTTP methods, field names) are NEVER
 * translated — they're stored as raw strings and rendered LTR.
 */

import {
  Rocket, KeyRound, Send, MailCheck, RotateCcw, Webhook,
  Gauge, AlertCircle, History, BookOpen, Code2, FlaskConical,
  Search, FileText,
} from "lucide-react";
import type { DocNavGroup } from "./types";

export function getDocsNavGroups(locale: "en" | "fa"): DocNavGroup[] {
  if (locale === "fa") {
    return [
      {
        label: "شروع کار",
        sections: [
          { id: "overview", label: "نمای کلی", icon: BookOpen },
          { id: "quickstart", label: "شروع سریع", icon: Rocket },
          { id: "authentication", label: "احراز هویت", icon: KeyRound },
        ],
      },
      {
        label: "مرجع API",
        sections: [
          { id: "send-otp", label: "ارسال OTP", icon: Send, methodBadge: "POST" },
          { id: "verify-otp", label: "تأیید OTP", icon: MailCheck, methodBadge: "POST" },
          { id: "resend-otp", label: "ارسال مجدد OTP", icon: RotateCcw, methodBadge: "POST" },
        ],
      },
      {
        label: "پلتفرم",
        sections: [
          { id: "webhooks", label: "وب‌هوک‌ها", icon: Webhook },
          { id: "rate-limits", label: "محدودیت‌های نرخ", icon: Gauge },
          { id: "errors", label: "کدهای خطا", icon: AlertCircle },
          { id: "sandbox", label: "سندباکس و تست", icon: FlaskConical },
          { id: "request-ids", label: "شناسه‌های درخواست", icon: Search },
        ],
      },
      {
        label: "بیشتر",
        sections: [
          { id: "examples", label: "نمونه‌ها", icon: Code2 },
          { id: "changelog", label: "تاریخچهٔ تغییرات", icon: History },
        ],
      },
    ];
  }
  return [
    {
      label: "Getting Started",
      sections: [
        { id: "overview", label: "Overview", icon: BookOpen },
        { id: "quickstart", label: "Quick Start", icon: Rocket },
        { id: "authentication", label: "Authentication", icon: KeyRound },
      ],
    },
    {
      label: "API Reference",
      sections: [
        { id: "send-otp", label: "Send OTP", icon: Send, methodBadge: "POST" },
        { id: "verify-otp", label: "Verify OTP", icon: MailCheck, methodBadge: "POST" },
        { id: "resend-otp", label: "Resend OTP", icon: RotateCcw, methodBadge: "POST" },
      ],
    },
    {
      label: "Platform",
      sections: [
        { id: "webhooks", label: "Webhooks", icon: Webhook },
        { id: "rate-limits", label: "Rate Limits", icon: Gauge },
        { id: "errors", label: "Error Codes", icon: AlertCircle },
        { id: "sandbox", label: "Sandbox & Testing", icon: FlaskConical },
        { id: "request-ids", label: "Request IDs", icon: Search },
      ],
    },
    {
      label: "More",
      sections: [
        { id: "examples", label: "Examples", icon: Code2 },
        { id: "changelog", label: "Changelog", icon: History },
      ],
    },
  ];
}

export function getQuickLinks(locale: "en" | "fa"): { label: string; anchor: string }[] {
  if (locale === "fa") {
    return [
      { label: "اولین OTP را ارسال کنم", anchor: "send-otp" },
      { label: "کد را تأیید کنم", anchor: "verify-otp" },
      { label: "بدون ایمیل تست کنم", anchor: "sandbox" },
      { label: "خطای API را دیباگ کنم", anchor: "errors" },
    ];
  }
  return [
    { label: "Send my first OTP", anchor: "send-otp" },
    { label: "Verify a code", anchor: "verify-otp" },
    { label: "Test without sending email", anchor: "sandbox" },
    { label: "Debug an API error", anchor: "errors" },
  ];
}

export function getDocsTitle(locale: "en" | "fa"): { title: string; subtitle: string } {
  if (locale === "fa") {
    return {
      title: "مستندات API",
      subtitle: "مرجع کامل API تأیید OTP ایمیل Nixify — نقاط انتهایی، احراز هویت، وب‌هوک‌ها، محدودیت‌ها و کدهای خطا.",
    };
  }
  return {
    title: "API Documentation",
    subtitle: "Complete reference for the Nixify email OTP API — endpoints, authentication, webhooks, rate limits, and error codes.",
  };
}
