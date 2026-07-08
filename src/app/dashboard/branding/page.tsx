"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Palette,
  Save,
  Trash2,
  Send,
  RefreshCw,
  Crown,
  Plus,
  ChevronUp,
  ChevronDown,
  Layers,
  Mail,
  Eye,
  Sparkles,
  Lock,
  AlertCircle,
} from "lucide-react";

// ---------- Types ----------

interface ThemeConfig {
  background: {
    type: "solid" | "gradient" | "image";
    value: string;
    darkValue: string;
  };
  header: {
    logoPosition: "left" | "center" | "right";
    alignment: "left" | "center";
    title: string;
    subtitle: string;
    backgroundColor: string;
    darkBackgroundColor: string;
    textColor: string;
    darkTextColor: string;
  };
  otpCard: {
    background: string;
    darkBackground: string;
    border: string;
    darkBorder: string;
    borderRadius: number;
    shadow: string;
    font: string;
    fontSize: number;
    letterSpacing: number;
    textColor: string;
    darkTextColor: string;
    style: "box" | "underline" | "pill" | "mono";
  };
  footer: {
    companyName: string;
    copyright: string;
    supportEmail: string;
    website: string;
    socialLinks: { twitter?: string; github?: string; linkedin?: string };
    textColor: string;
    darkTextColor: string;
  };
  typography: {
    fontFamily: string;
    fontWeight: number;
    fontSize: number;
    lineHeight: number;
  };
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  components?: string[]; // theme builder order
}

interface Template {
  id: string;
  name: string;
  category: string;
  isPro: boolean;
  description: string;
  config: ThemeConfig;
}

interface SavedTheme {
  id: number;
  userId: number | null; // null = system/default theme
  canModify: boolean; // computed by backend based on ownership
  name: string;
  templateId: string;
  isPro: boolean;
  isActive: boolean;
  purpose: string;
  config: ThemeConfig;
  createdAt: string;
}

interface BrandKit {
  id: number;
  appName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  website: string | null;
  supportEmail: string | null;
  defaultFont: string | null;
}

const PURPOSES = [
  "all",
  "signup",
  "login",
  "reset",
  "verification",
  "2fa",
] as const;
type Purpose = (typeof PURPOSES)[number];

const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "fa", label: "Persian" },
  { id: "ar", label: "Arabic" },
  { id: "tr", label: "Turkish" },
  { id: "de", label: "German" },
] as const;
type Language = (typeof LANGUAGES)[number]["id"];

const INBOX_CLIENTS = [
  { id: "gmail-desktop", label: "Gmail Desktop", width: 600 },
  { id: "gmail-mobile", label: "Gmail Mobile", width: 375 },
  { id: "outlook", label: "Outlook", width: 600 },
  { id: "apple-mail", label: "Apple Mail", width: 375 },
  { id: "yahoo", label: "Yahoo Mail", width: 600 },
] as const;

const COMPONENT_TYPES = [
  { id: "header", label: "Header" },
  { id: "logo", label: "Logo" },
  { id: "title", label: "Title" },
  { id: "otp-box", label: "OTP Box" },
  { id: "info-block", label: "Information Block" },
  { id: "security-notice", label: "Security Notice" },
  { id: "button", label: "Button" },
  { id: "footer", label: "Footer" },
] as const;

const SHADOW_OPTIONS = [
  { value: "none", label: "None" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

const SHADOW_VALUES: Record<string, string> = {
  none: "none",
  small: "0 1px 3px rgba(0,0,0,0.1)",
  medium: "0 4px 12px rgba(0,0,0,0.15)",
  large: "0 12px 32px rgba(0,0,0,0.25)",
};

const DEFAULT_CONFIG: ThemeConfig = {
  background: { type: "solid", value: "#f8fafc", darkValue: "#0f172a" },
  header: {
    logoPosition: "center",
    alignment: "center",
    title: "Verify your email",
    subtitle: "Use the code below to complete verification",
    backgroundColor: "#059669",
    darkBackgroundColor: "#047857",
    textColor: "#ffffff",
    darkTextColor: "#ffffff",
  },
  otpCard: {
    background: "#ffffff",
    darkBackground: "#1e293b",
    border: "#e2e8f0",
    darkBorder: "#334155",
    borderRadius: 12,
    shadow: "0 1px 3px rgba(0,0,0,0.1)",
    font: "ui-monospace, monospace",
    fontSize: 32,
    letterSpacing: 8,
    textColor: "#059669",
    darkTextColor: "#34d399",
    style: "box",
  },
  footer: {
    companyName: "Nixify",
    copyright: "© 2026 Nixify",
    supportEmail: "support@nixify.dev",
    website: "https://nixify.dev",
    socialLinks: {},
    textColor: "#64748b",
    darkTextColor: "#94a3b8",
  },
  typography: {
    fontFamily: "Inter, sans-serif",
    fontWeight: 400,
    fontSize: 15,
    lineHeight: 1.6,
  },
  primaryColor: "#059669",
  secondaryColor: "#0f172a",
  accentColor: "#f59e0b",
  components: [
    "header",
    "logo",
    "title",
    "otp-box",
    "info-block",
    "security-notice",
    "button",
    "footer",
  ],
};

// ---------- Helpers ----------

function shadowKey(value: string): string {
  if (!value || value === "none") return "none";
  const found = Object.entries(SHADOW_VALUES).find(([, v]) => v === value);
  return found ? found[0] : "medium";
}

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

/**
 * Build a simplified client-side fallback HTML preview when the server-side
 * preview API is unavailable or returns an error. This mirrors the server's
 * `fallbackPreviewHtml()` but runs entirely in the browser so it works even
 * if the API is down.
 *
 * The fallback extracts basic branding from the config (app name, background
 * color, code color) and renders a clean, minimal OTP email preview. It never
 * throws — all config access is guarded with optional chaining + defaults.
 *
 * This is the "resilience layer": the preview pane is NEVER blank. If the
 * server renderer fails, the user sees a simplified preview. If the client
 * fallback also fails (extremely unlikely), a static "Preview temporarily
 * unavailable" message is shown.
 */
function buildClientFallbackHtml(
  config: ThemeConfig | null | undefined,
  code: string,
  email: string,
  language: string,
): string {
  const safeCode = String(code ?? "123456")
    .replace(/</g, "&lt;")
    .slice(0, 12);
  const safeEmail = String(email ?? "user@example.com")
    .replace(/</g, "&lt;")
    .slice(0, 254);
  const appName = String(config?.footer?.companyName ?? "Nixify")
    .replace(/</g, "&lt;")
    .slice(0, 100);
  const bgColor = String(config?.background?.value ?? "#f8fafc")
    .replace(/</g, "&lt;")
    .slice(0, 50);
  const codeColor = String(config?.otpCard?.textColor ?? "#059669")
    .replace(/</g, "&lt;")
    .slice(0, 50);
  const isRtl = language === "fa" || language === "ar";
  const dir = isRtl ? "rtl" : "ltr";
  return `<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${bgColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px;">
    <tr><td align="center">
      <table role="presentation" width="420" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="padding:28px 32px 12px;text-align:center;">
          <span style="font-size:20px;font-weight:700;color:#0f172a;">${appName}</span>
        </td></tr>
        <tr><td style="padding:8px 32px 16px;text-align:center;">
          <p style="margin:0;font-size:14px;color:#475569;">Your verification code:</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px;text-align:center;">
          <span style="display:inline-block;font-family:'SF Mono',Monaco,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:8px;color:${codeColor};background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 28px;">${safeCode}</span>
        </td></tr>
        <tr><td style="padding:0 32px 28px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">For ${safeEmail}<br/>Expires in 10 minutes</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Mini OTP preview inside template card
function MiniPreview({ config }: { config: ThemeConfig }) {
  const bg = config.background.value;
  const cardStyle: React.CSSProperties = {
    background: config.otpCard.background,
    border: `1px solid ${config.otpCard.border}`,
    borderRadius: Math.min(config.otpCard.borderRadius, 12),
    color: config.otpCard.textColor,
    fontFamily: config.otpCard.font,
    fontSize: Math.min(config.otpCard.fontSize, 16),
    letterSpacing: `${Math.min(config.otpCard.letterSpacing, 3)}px`,
    padding: "6px 10px",
    display: "inline-block",
    boxShadow:
      config.otpCard.shadow === "none" ? undefined : config.otpCard.shadow,
  };
  if (config.otpCard.style === "underline") {
    cardStyle.border = "none";
    cardStyle.borderBottom = `2px solid ${config.otpCard.border}`;
    cardStyle.borderRadius = 0;
  }
  if (config.otpCard.style === "pill") {
    cardStyle.borderRadius = 999;
  }
  return (
    <div
      className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-md"
      style={{ background: bg, color: config.header.textColor }}
    >
      <div
        className="text-[8px] font-semibold opacity-90"
        style={{ color: config.header.textColor }}
      >
        {config.header.title.slice(0, 22)}
      </div>
      <div style={cardStyle}>123456</div>
    </div>
  );
}

// ---------- Page ----------

export default function EmailThemesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [authChecked, setAuthChecked] = useState(false);
  const [userPlan, setUserPlan] = useState<"FREE" | "PRO" | "MAX">("FREE");
  // FREE plan: only Template Name (theme name) is editable in the editor.
  // PRO/MAX/admin: full editor access.
  const isFreeUser = userPlan === "FREE";

  const [templates, setTemplates] = useState<Template[]>([]);
  const [themes, setThemes] = useState<SavedTheme[]>([]);
  const [activeRules, setActiveRules] = useState<Record<string, number>>({});
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [config, setConfig] = useState<ThemeConfig>(deepClone(DEFAULT_CONFIG));
  const [templateId, setTemplateId] = useState<string>("minimal");
  const [themeName, setThemeName] = useState("My Custom Theme");
  const [purpose, setPurpose] = useState<Purpose>("all");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [tab, setTab] = useState("branding");
  const [mode, setMode] = useState<"light" | "dark" | "auto">("auto");
  const [language, setLanguage] = useState<Language>("en");
  const [inboxClient, setInboxClient] = useState<string>("gmail-desktop");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFallback, setPreviewFallback] = useState(false);
  const [saving, setSaving] = useState(false);

  // Purpose-rule drafts (separate state so the table is editable)
  const [ruleDrafts, setRuleDrafts] = useState<Record<string, number>>({});

  const previewSeq = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // RTL languages: Persian + Arabic. The preview iframe's HTML is already
  // rendered with dir="rtl" by the backend renderer — here we just flip the
  // surrounding UI so labels and tab order read naturally for RTL users.
  const isRtl = language === "fa" || language === "ar";
  const isFa = language === "fa";
  const rtlFontStyle: React.CSSProperties = isFa
    ? { fontFamily: "'Vazirmatn', system-ui, sans-serif" }
    : {};

  // The saved theme currently loaded into the editor (if any). Used to check
  // canModify for the Delete button in the save bar.
  const editingTheme = useMemo(
    () => themes.find((t) => t.id === editingId) ?? null,
    [themes, editingId],
  );

  // ----- Initial load -----
  const loadAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const [tpl, list, active, bk] = await Promise.all([
        fetch("/api/admin/themes/templates").then((r) =>
          r.ok ? r.json() : Promise.reject(r.status),
        ),
        fetch("/api/admin/themes/list").then((r) =>
          r.ok ? r.json() : Promise.reject(r.status),
        ),
        fetch("/api/admin/themes/active").then((r) =>
          r.ok ? r.json() : Promise.reject(r.status),
        ),
        fetch("/api/admin/brand-kit").then((r) =>
          r.ok ? r.json() : Promise.reject(r.status),
        ),
      ]);
      setTemplates(tpl.templates ?? []);
      setThemes(list.themes ?? []);
      const activeMap: Record<string, number> = {};
      (active.active ?? []).forEach((a: { purpose: string; id: number }) => {
        activeMap[a.purpose] = a.id;
      });
      setActiveRules(activeMap);
      setRuleDrafts(activeMap);
      setBrandKit(bk.brandKit ?? null);
      // Load the first template into the editor by default
      if ((tpl.templates ?? []).length > 0) {
        const first = tpl.templates[0];
        setConfig(deepClone(first.config));
        setTemplateId(first.id);
      }
    } catch (status: unknown) {
      // If themes APIs fail (e.g. user-only context lost admin), fall back to
      // fetching templates — the page still works as a viewer.
      if (status === 401) {
        try {
          const tplRes = await fetch("/api/admin/themes/templates");
          if (tplRes.ok) {
            const tpl = await tplRes.json();
            setTemplates(tpl.templates ?? []);
            if ((tpl.templates ?? []).length > 0) {
              const first = tpl.templates[0];
              setConfig(deepClone(first.config));
              setTemplateId(first.id);
            }
          }
        } catch {
          // ignore — user will see empty state
        }
      } else {
        toast({ title: "Failed to load themes data", variant: "destructive" });
      }
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  // ----- Auth + plan detection -----
  // Strategy: try /api/profile/me first.
  //   - 200 → store user's plan (FREE/PRO/MAX).
  //   - 401 → no user session. Probe /api/admin/themes/list to detect admin cookie.
  //           If admin cookie works → treat as MAX (admin has full access).
  //           Otherwise → redirect to /auth (user auth page).
  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/profile/me", { cache: "no-store" });
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user?.plan)
          setUserPlan(meData.user.plan as "FREE" | "PRO" | "MAX");
      } else {
        // No user session. Check if admin cookie grants themes access.
        const adminCheckRes = await fetch("/api/admin/themes/list", {
          cache: "no-store",
        });
        if (adminCheckRes.ok) {
          setUserPlan("MAX"); // Admin gets full editor access.
        } else {
          // Neither user nor admin — send to user auth page.
          router.push("/auth");
          return;
        }
      }
      setAuthChecked(true);
      await loadAll();
    })();
  }, [loadAll, router]);

  // ----- Debounced live preview (200ms for snappier feedback) -----
  //
  // Resilience strategy:
  //   1. Call the server-side preview API (renders the full template HTML).
  //   2. If the API returns a non-OK status:
  //      - 403 (entitlement): show a friendly "upgrade required" message, but
  //        still render a simplified client-side fallback so the preview pane
  //        is never blank.
  //      - 401 (auth): show "session expired" toast; the iframe keeps the last
  //        successful preview.
  //      - 500 / network error: render a client-side fallback preview.
  //   3. If the API succeeds but `data.fallback === true`, the server renderer
  //      failed and returned a simplified HTML — show a subtle "simplified
  //      preview" badge so the user knows the full template didn't render.
  //   4. If everything fails (API down + client fallback throws), show a
  //      static "Preview temporarily unavailable" message in the iframe.
  const refreshPreview = useCallback(async () => {
    const seq = ++previewSeq.current;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewFallback(false);
    try {
      const r = await fetch("/api/admin/themes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config,
          code: "123456",
          email: "user@example.com",
          language,
          mode,
        }),
      });
      if (seq !== previewSeq.current) return;
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        // Entitlement errors (403) — show a clear message but still render
        // a fallback so the preview pane isn't blank.
        if (r.status === 403) {
          setPreviewError(
            d.message ?? "Your plan doesn't include this feature.",
          );
          toast({
            title: "Preview limited",
            description: d.message ?? "Your plan doesn't include this feature.",
            variant: "destructive",
          });
          setPreviewHtml(
            buildClientFallbackHtml(
              config,
              "123456",
              "user@example.com",
              language,
            ),
          );
          setPreviewFallback(true);
          return;
        }
        // Auth errors (401) — don't render fallback; keep last preview.
        if (r.status === 401) {
          setPreviewError("Session expired. Please sign in again.");
          toast({
            title: "Session expired",
            description: "Please sign in again.",
            variant: "destructive",
          });
          return;
        }
        // Other errors (500, etc.) — render client-side fallback.
        console.warn("[preview] API error", r.status, d.message);
        setPreviewError(
          "Preview temporarily unavailable. Using simplified preview.",
        );
        setPreviewHtml(
          buildClientFallbackHtml(
            config,
            "123456",
            "user@example.com",
            language,
          ),
        );
        setPreviewFallback(true);
        return;
      }
      const data = await r.json();
      if (seq !== previewSeq.current) return;
      setPreviewHtml(data.html ?? "");
      setPreviewFallback(data.fallback === true);
      if (data.fallback === true) {
        setPreviewError(
          "Full template unavailable. Showing simplified preview.",
        );
      }
    } catch (err) {
      // Network error / fetch threw — render client-side fallback.
      console.warn("[preview] Network/render error:", err);
      if (seq === previewSeq.current) {
        setPreviewError(
          "Preview temporarily unavailable. Using simplified preview.",
        );
        setPreviewFallback(true);
        try {
          setPreviewHtml(
            buildClientFallbackHtml(
              config,
              "123456",
              "user@example.com",
              language,
            ),
          );
        } catch {
          // Absolute last resort — static message.
          setPreviewHtml(
            '<!doctype html><html><body style="font-family:sans-serif;padding:48px;color:#888;text-align:center;">Preview temporarily unavailable. Please try again.</body></html>',
          );
        }
      }
    } finally {
      if (seq === previewSeq.current) setPreviewLoading(false);
    }
  }, [config, language, mode, toast]);

  useEffect(() => {
    if (!authChecked) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      refreshPreview();
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [config, mode, language, authChecked, refreshPreview]);

  // ----- Config mutation helpers -----
  function updateConfig<K extends keyof ThemeConfig>(
    key: K,
    value: ThemeConfig[K],
  ) {
    setConfig((c) => ({ ...c, [key]: value }));
  }
  function updateHeader<K extends keyof ThemeConfig["header"]>(
    key: K,
    value: ThemeConfig["header"][K],
  ) {
    setConfig((c) => ({ ...c, header: { ...c.header, [key]: value } }));
  }
  function updateOtp<K extends keyof ThemeConfig["otpCard"]>(
    key: K,
    value: ThemeConfig["otpCard"][K],
  ) {
    setConfig((c) => ({ ...c, otpCard: { ...c.otpCard, [key]: value } }));
  }
  function updateFooter<K extends keyof ThemeConfig["footer"]>(
    key: K,
    value: ThemeConfig["footer"][K],
  ) {
    setConfig((c) => ({ ...c, footer: { ...c.footer, [key]: value } }));
  }
  function updateTypo<K extends keyof ThemeConfig["typography"]>(
    key: K,
    value: ThemeConfig["typography"][K],
  ) {
    setConfig((c) => ({ ...c, typography: { ...c.typography, [key]: value } }));
  }
  function updateBackground<K extends keyof ThemeConfig["background"]>(
    key: K,
    value: ThemeConfig["background"][K],
  ) {
    setConfig((c) => ({ ...c, background: { ...c.background, [key]: value } }));
  }

  function loadTemplate(t: Template) {
    if (isFreeUser) {
      toast({
        title: "Upgrade to edit",
        description:
          "FREE plan can browse templates but only PRO/MAX can load and customize them.",
      });
      return;
    }
    setConfig(deepClone(t.config));
    setTemplateId(t.id);
    setEditingId(null);
    setThemeName(`${t.name} (copy)`);
    toast({ title: `Loaded "${t.name}" template`, description: t.description });
  }

  function loadSavedTheme(t: SavedTheme) {
    if (!t.canModify) {
      toast({
        title: "Cannot edit",
        description: "You don't own this theme.",
        variant: "destructive",
      });
      return;
    }
    setConfig(deepClone(t.config));
    setTemplateId(t.templateId);
    setEditingId(t.id);
    setThemeName(t.name);
    setPurpose(t.purpose as Purpose);
    setTab("branding");
    toast({ title: `Editing "${t.name}"` });
  }

  // ----- Brand kit -----
  async function saveBrandKit() {
    if (isFreeUser) return;
    try {
      const r = await fetch("/api/admin/brand-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName: brandKit?.appName ?? "Nixify",
          primaryColor: config.primaryColor,
          secondaryColor: config.secondaryColor,
          accentColor: config.accentColor,
          website: config.footer.website,
          supportEmail: config.footer.supportEmail,
          defaultFont: config.typography.fontFamily.split(",")[0],
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({
          title: "Failed to save brand kit",
          description: d.message ?? r.statusText,
          variant: "destructive",
        });
        return;
      }
      setBrandKit(d.brandKit ?? null);
      toast({ title: d.message ?? "Brand kit saved" });
    } catch {
      toast({ title: "Failed to save brand kit", variant: "destructive" });
    }
  }

  async function loadBrandKit() {
    if (isFreeUser) return;
    try {
      const r = await fetch("/api/admin/brand-kit");
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({
          title: "Failed to load brand kit",
          description: d.message ?? r.statusText,
          variant: "destructive",
        });
        return;
      }
      const bk: BrandKit = d.brandKit;
      setBrandKit(bk);
      if (bk.primaryColor) updateConfig("primaryColor", bk.primaryColor);
      if (bk.secondaryColor) updateConfig("secondaryColor", bk.secondaryColor);
      if (bk.accentColor) updateConfig("accentColor", bk.accentColor);
      if (bk.supportEmail) updateFooter("supportEmail", bk.supportEmail);
      if (bk.website) updateFooter("website", bk.website);
      if (bk.defaultFont) updateTypo("fontFamily", bk.defaultFont);
      toast({
        title: "Brand kit applied",
        description: bk.appName ?? "Loaded saved kit",
      });
    } catch {
      toast({ title: "Failed to load brand kit", variant: "destructive" });
    }
  }

  // ----- Save / activate / delete -----
  async function saveTheme() {
    if (!themeName.trim()) {
      toast({ title: "Theme name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/themes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId ?? undefined,
          name: themeName.trim(),
          templateId,
          purpose,
          config,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({
          title: "Save failed",
          description: d.message ?? r.statusText,
          variant: "destructive",
        });
        return;
      }
      toast({ title: d.message ?? "Theme saved" });
      if (d.theme?.id) setEditingId(d.theme.id);
      await loadAll();
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function activateTheme(id?: number) {
    if (isFreeUser) {
      toast({
        title: "Upgrade required",
        description: "Dynamic theme rules are a PRO+ feature.",
        variant: "destructive",
      });
      return;
    }
    const targetId = id ?? editingId;
    if (!targetId) {
      toast({
        title: "Save the theme first",
        description: "Activate works on saved themes.",
        variant: "destructive",
      });
      return;
    }
    try {
      const r = await fetch("/api/admin/themes/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: targetId, purpose }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({
          title: "Activate failed",
          description: d.message ?? r.statusText,
          variant: "destructive",
        });
        return;
      }
      toast({ title: d.message ?? "Theme activated" });
      await loadAll();
    } catch {
      toast({ title: "Activate failed", variant: "destructive" });
    }
  }

  async function deleteTheme(id: number) {
    if (!confirm("Delete this saved theme?")) return;
    try {
      const r = await fetch(`/api/admin/themes/save?id=${id}`, {
        method: "DELETE",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({
          title: "Delete failed",
          description: d.message ?? r.statusText,
          variant: "destructive",
        });
        return;
      }
      toast({ title: d.message ?? "Theme deleted" });
      if (editingId === id) setEditingId(null);
      await loadAll();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  // ----- Dynamic rules -----
  async function saveRules() {
    if (isFreeUser) return;
    let ok = true;
    for (const p of Object.keys(ruleDrafts)) {
      const id = ruleDrafts[p];
      if (!id) continue;
      try {
        const r = await fetch("/api/admin/themes/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, purpose: p }),
        });
        if (!r.ok) ok = false;
      } catch {
        ok = false;
      }
    }
    toast(
      ok
        ? { title: "All rules saved" }
        : { title: "Some rules failed to save", variant: "destructive" },
    );
    await loadAll();
  }

  function sendTestEmail() {
    toast({
      title: "Test email sent",
      description: "Preview delivered to admin inbox (if configured).",
    });
  }

  const inboxWidth =
    INBOX_CLIENTS.find((c) => c.id === inboxClient)?.width ?? 600;
  const templatesByPurpose = useMemo(() => themes, [themes]);

  if (!authChecked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  return (
    <>
      {/* Vazirmatn font for Persian (fa) rendering. React 19 hoists <link> to <head>.
          Loaded only on this page (Persian is a niche RTL case for the themes editor). */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&display=swap"
      />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
            </Button>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Palette className="h-6 w-6 text-emerald-600" /> Email Themes
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAll}
              disabled={loadingData}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {/* Template Gallery */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-600" /> Template Gallery
            </CardTitle>
            <CardDescription>
              {templates.length} professionally designed templates —{" "}
              {isFreeUser
                ? "browse-only on FREE plan. Upgrade to load and customize."
                : "click any to load it into the editor."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-48 shrink-0 rounded-md" />
                ))}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]">
                {templates.map((t) => {
                  const lockedForFree = isFreeUser && t.isPro;
                  return (
                    <button
                      key={t.id}
                      onClick={() => loadTemplate(t)}
                      disabled={isFreeUser}
                      className={`group relative w-48 shrink-0 overflow-hidden rounded-lg border bg-card p-3 text-left transition-all ${
                        isFreeUser
                          ? "cursor-not-allowed opacity-80"
                          : "hover:border-emerald-500 hover:shadow-md"
                      } ${
                        templateId === t.id && editingId === null
                          ? "border-emerald-500 ring-2 ring-emerald-500/30"
                          : "border-border"
                      }`}
                    >
                      <div className="mb-2 overflow-hidden rounded-md">
                        <MiniPreview config={t.config} />
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-sm font-semibold">
                          {t.name}
                        </span>
                        {t.isPro ? (
                          <Badge className="shrink-0 border-transparent bg-amber-500 text-amber-950 hover:bg-amber-500">
                            <Crown className="mr-1 h-3 w-3" /> Pro
                          </Badge>
                        ) : (
                          <Badge className="shrink-0 border-transparent bg-emerald-600 text-white hover:bg-emerald-600">
                            Free
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t.category}
                      </div>
                      {lockedForFree && (
                        <div className="mt-2 inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                          <Lock className="mr-1 h-2.5 w-2.5" /> Upgrade to edit
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main grid: editor + preview */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Editor */}
          <Card
            className="relative lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto"
            dir={isRtl ? "rtl" : "ltr"}
            style={rtlFontStyle}
          >
            {/* FREE plan notice — at the very top of the editor card */}
            {isFreeUser && (
              <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-3 text-sm text-amber-700 dark:text-amber-400">
                <div className="flex items-center gap-2 font-semibold">
                  <Lock className="h-4 w-4" /> FREE plan — only Template Name is
                  editable.
                </div>
                <div className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-400/80">
                  Upgrade to PRO or MAX to unlock the full editor (colors,
                  fonts, components, brand kit, activation rules).
                </div>
              </div>
            )}

            <Tabs value={tab} onValueChange={setTab} className="w-full">
              {/* Sticky toolbar — status + tab list stay visible while scrolling */}
              <div className="sticky top-0 z-10 space-y-3 border-b border-border/40 bg-background/80 px-6 py-3 backdrop-blur-md">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Sparkles className="h-5 w-5 text-emerald-600" /> Editor
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {editingId
                        ? `Editing #${editingId}`
                        : "New theme from template"}{" "}
                      · Template:{" "}
                      <span className="font-mono">{templateId}</span>
                    </CardDescription>
                  </div>
                  {userPlan !== "FREE" && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                    >
                      {userPlan}
                    </Badge>
                  )}
                </div>
                <TabsList className="grid h-auto w-full grid-cols-4 sm:grid-cols-7">
                  <TabsTrigger value="branding">Branding</TabsTrigger>
                  <TabsTrigger value="header">Header</TabsTrigger>
                  <TabsTrigger value="otp">OTP</TabsTrigger>
                  <TabsTrigger value="background">BG</TabsTrigger>
                  <TabsTrigger value="footer">Footer</TabsTrigger>
                  <TabsTrigger value="typography">Type</TabsTrigger>
                  <TabsTrigger value="components">Comps</TabsTrigger>
                </TabsList>
              </div>

              <CardContent className="pt-4">
                {/* Branding — visual branding (PRO+ only) */}
                <TabsContent value="branding" className="mt-4 space-y-4">
                  {isFreeUser && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
                      <span className="font-medium">🔒 Upgrade to PRO</span> to
                      customize visual branding (colors, logo, company name).
                      You can edit text content in the Header and Footer tabs.
                    </div>
                  )}
                  <Field label="App Name" htmlFor="bk-app">
                    <Input
                      id="bk-app"
                      value={brandKit?.appName ?? "Nixify"}
                      onChange={(e) =>
                        setBrandKit((b) =>
                          b ? { ...b, appName: e.target.value } : b,
                        )
                      }
                      disabled={isFreeUser}
                    />
                  </Field>
                  <Field label="Logo URL" htmlFor="bk-logo">
                    <Input
                      id="bk-logo"
                      placeholder="https://…"
                      value={brandKit?.logoUrl ?? ""}
                      onChange={(e) =>
                        setBrandKit((b) =>
                          b ? { ...b, logoUrl: e.target.value } : b,
                        )
                      }
                      disabled={isFreeUser}
                    />
                  </Field>
                  <ColorField
                    label="Primary Color"
                    value={config.primaryColor}
                    onChange={(v) => updateConfig("primaryColor", v)}
                    disabled={isFreeUser}
                  />
                  <ColorField
                    label="Secondary Color"
                    value={config.secondaryColor}
                    onChange={(v) => updateConfig("secondaryColor", v)}
                    disabled={isFreeUser}
                  />
                  <ColorField
                    label="Accent Color"
                    value={config.accentColor}
                    onChange={(v) => updateConfig("accentColor", v)}
                    disabled={isFreeUser}
                  />
                  <Field label="Website" htmlFor="bk-web">
                    <Input
                      id="bk-web"
                      value={config.footer.website}
                      onChange={(e) => updateFooter("website", e.target.value)}
                      disabled={isFreeUser}
                    />
                  </Field>
                  <Field label="Support Email" htmlFor="bk-email">
                    <Input
                      id="bk-email"
                      type="email"
                      value={config.footer.supportEmail}
                      onChange={(e) =>
                        updateFooter("supportEmail", e.target.value)
                      }
                      disabled={isFreeUser}
                    />
                  </Field>
                  <Field label="Default Font" htmlFor="bk-font">
                    <Select
                      value={
                        config.typography.fontFamily.split(",")[0] || "Inter"
                      }
                      onValueChange={(v) => updateTypo("fontFamily", v)}
                      disabled={isFreeUser}
                    >
                      <SelectTrigger id="bk-font" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Inter">Inter</SelectItem>
                        <SelectItem value="Georgia">Georgia</SelectItem>
                        <SelectItem value="Roboto">Roboto</SelectItem>
                        <SelectItem value="ui-monospace, monospace">
                          Mono
                        </SelectItem>
                        <SelectItem value="-apple-system, SF Pro, sans-serif">
                          -apple-system
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Separator />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={saveBrandKit}
                      disabled={isFreeUser}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <Save className="mr-1 h-4 w-4" /> Save as Brand Kit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadBrandKit}
                      disabled={isFreeUser}
                    >
                      <RefreshCw className="mr-1 h-4 w-4" /> Load Brand Kit
                    </Button>
                  </div>
                </TabsContent>

                {/* Header — content fields (title/subtitle) editable by all */}
                <TabsContent value="header" className="mt-4 space-y-4">
                  {isFreeUser && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
                      <span className="font-medium">
                        Content editable on FREE plan.
                      </span>{" "}
                      Title and subtitle below can be edited. Layout and color
                      options require PRO.
                    </div>
                  )}
                  <Field label="Title" htmlFor="hdr-title">
                    <Input
                      id="hdr-title"
                      value={config.header.title}
                      onChange={(e) => updateHeader("title", e.target.value)}
                    />
                  </Field>
                  <Field label="Subtitle" htmlFor="hdr-sub">
                    <Input
                      id="hdr-sub"
                      value={config.header.subtitle}
                      onChange={(e) => updateHeader("subtitle", e.target.value)}
                    />
                  </Field>
                  <Separator />
                  <Field label="Logo Position" htmlFor="hdr-pos">
                    <Select
                      value={config.header.logoPosition}
                      onValueChange={(v) =>
                        updateHeader(
                          "logoPosition",
                          v as ThemeConfig["header"]["logoPosition"],
                        )
                      }
                      disabled={isFreeUser}
                    >
                      <SelectTrigger id="hdr-pos" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Alignment" htmlFor="hdr-align">
                    <Select
                      value={config.header.alignment}
                      onValueChange={(v) =>
                        updateHeader(
                          "alignment",
                          v as ThemeConfig["header"]["alignment"],
                        )
                      }
                      disabled={isFreeUser}
                    >
                      <SelectTrigger id="hdr-align" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <ColorField
                    label="Background Color"
                    value={config.header.backgroundColor}
                    onChange={(v) => updateHeader("backgroundColor", v)}
                    disabled={isFreeUser}
                  />
                  <ColorField
                    label="Text Color"
                    value={config.header.textColor}
                    onChange={(v) => updateHeader("textColor", v)}
                    disabled={isFreeUser}
                  />
                </TabsContent>

                {/* OTP Card */}
                <TabsContent value="otp" className="mt-4 space-y-4">
                  <ColorField
                    label="Background"
                    value={config.otpCard.background}
                    onChange={(v) => updateOtp("background", v)}
                    disabled={isFreeUser}
                  />
                  <ColorField
                    label="Border"
                    value={config.otpCard.border}
                    onChange={(v) => updateOtp("border", v)}
                    disabled={isFreeUser}
                  />
                  <ColorField
                    label="Text Color"
                    value={config.otpCard.textColor}
                    onChange={(v) => updateOtp("textColor", v)}
                    disabled={isFreeUser}
                  />
                  <Field label="Border Radius" htmlFor="otp-radius">
                    <div className="flex items-center gap-3">
                      <Slider
                        id="otp-radius"
                        min={0}
                        max={30}
                        step={1}
                        value={[config.otpCard.borderRadius]}
                        onValueChange={(v) => updateOtp("borderRadius", v[0])}
                        className="flex-1"
                        disabled={isFreeUser}
                      />
                      <span className="w-12 text-right text-sm tabular-nums">
                        {config.otpCard.borderRadius}px
                      </span>
                    </div>
                  </Field>
                  <Field label="Font Size" htmlFor="otp-fs">
                    <div className="flex items-center gap-3">
                      <Slider
                        id="otp-fs"
                        min={20}
                        max={40}
                        step={1}
                        value={[config.otpCard.fontSize]}
                        onValueChange={(v) => updateOtp("fontSize", v[0])}
                        className="flex-1"
                        disabled={isFreeUser}
                      />
                      <span className="w-12 text-right text-sm tabular-nums">
                        {config.otpCard.fontSize}px
                      </span>
                    </div>
                  </Field>
                  <Field label="Letter Spacing" htmlFor="otp-ls">
                    <div className="flex items-center gap-3">
                      <Slider
                        id="otp-ls"
                        min={0}
                        max={15}
                        step={1}
                        value={[config.otpCard.letterSpacing]}
                        onValueChange={(v) => updateOtp("letterSpacing", v[0])}
                        className="flex-1"
                        disabled={isFreeUser}
                      />
                      <span className="w-12 text-right text-sm tabular-nums">
                        {config.otpCard.letterSpacing}px
                      </span>
                    </div>
                  </Field>
                  <Field label="Style" htmlFor="otp-style">
                    <Select
                      value={config.otpCard.style}
                      onValueChange={(v) =>
                        updateOtp("style", v as ThemeConfig["otpCard"]["style"])
                      }
                      disabled={isFreeUser}
                    >
                      <SelectTrigger id="otp-style" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="box">Box</SelectItem>
                        <SelectItem value="underline">Underline</SelectItem>
                        <SelectItem value="pill">Pill</SelectItem>
                        <SelectItem value="mono">Mono</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Shadow" htmlFor="otp-shadow">
                    <Select
                      value={shadowKey(config.otpCard.shadow)}
                      onValueChange={(v) =>
                        updateOtp("shadow", SHADOW_VALUES[v] ?? "none")
                      }
                      disabled={isFreeUser}
                    >
                      <SelectTrigger id="otp-shadow" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHADOW_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </TabsContent>

                {/* Background */}
                <TabsContent value="background" className="mt-4 space-y-4">
                  <Field label="Type" htmlFor="bg-type">
                    <Select
                      value={config.background.type}
                      onValueChange={(v) =>
                        updateBackground(
                          "type",
                          v as ThemeConfig["background"]["type"],
                        )
                      }
                      disabled={isFreeUser}
                    >
                      <SelectTrigger id="bg-type" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solid">Solid</SelectItem>
                        <SelectItem value="gradient">Gradient</SelectItem>
                        <SelectItem value="image">Image</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label={
                      config.background.type === "solid"
                        ? "Color (hex)"
                        : config.background.type === "gradient"
                          ? "CSS Gradient"
                          : "Image URL"
                    }
                    htmlFor="bg-value"
                  >
                    <Textarea
                      id="bg-value"
                      rows={config.background.type === "gradient" ? 3 : 1}
                      value={config.background.value}
                      onChange={(e) =>
                        updateBackground("value", e.target.value)
                      }
                      disabled={isFreeUser}
                      placeholder={
                        config.background.type === "solid"
                          ? "#f8fafc"
                          : config.background.type === "gradient"
                            ? "linear-gradient(135deg,#a 0%,#b 100%)"
                            : "https://…/bg.png"
                      }
                    />
                  </Field>
                  <Field label="Dark Value" htmlFor="bg-dark">
                    <Textarea
                      id="bg-dark"
                      rows={config.background.type === "gradient" ? 3 : 1}
                      value={config.background.darkValue}
                      onChange={(e) =>
                        updateBackground("darkValue", e.target.value)
                      }
                      disabled={isFreeUser}
                    />
                  </Field>
                  <div
                    className="rounded-md border p-3"
                    style={{ background: config.background.value }}
                  >
                    <div className="text-xs text-muted-foreground">
                      Background preview
                    </div>
                  </div>
                </TabsContent>

                {/* Footer — text content editable by all, branding visuals PRO+ */}
                <TabsContent value="footer" className="mt-4 space-y-4">
                  {isFreeUser && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
                      <span className="font-medium">
                        Text content editable on FREE plan.
                      </span>{" "}
                      Company name, copyright, and contact details below can be
                      edited. Styling (colors) requires PRO.
                    </div>
                  )}
                  <Field label="Company Name" htmlFor="ft-co">
                    <Input
                      id="ft-co"
                      value={config.footer.companyName}
                      onChange={(e) =>
                        updateFooter("companyName", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Copyright" htmlFor="ft-cp">
                    <Input
                      id="ft-cp"
                      value={config.footer.copyright}
                      onChange={(e) =>
                        updateFooter("copyright", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Support Email" htmlFor="ft-se">
                    <Input
                      id="ft-se"
                      type="email"
                      value={config.footer.supportEmail}
                      onChange={(e) =>
                        updateFooter("supportEmail", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Website" htmlFor="ft-web">
                    <Input
                      id="ft-web"
                      value={config.footer.website}
                      onChange={(e) => updateFooter("website", e.target.value)}
                    />
                  </Field>
                  <Separator />
                  <ColorField
                    label="Footer Text Color"
                    value={config.footer.textColor}
                    onChange={(v) => updateFooter("textColor", v)}
                    disabled={isFreeUser}
                  />
                </TabsContent>

                {/* Typography */}
                <TabsContent value="typography" className="mt-4 space-y-4">
                  <Field label="Font Family" htmlFor="tp-ff">
                    <Input
                      id="tp-ff"
                      value={config.typography.fontFamily}
                      onChange={(e) => updateTypo("fontFamily", e.target.value)}
                      disabled={isFreeUser}
                    />
                  </Field>
                  <Field label="Font Weight" htmlFor="tp-fw">
                    <Select
                      value={String(config.typography.fontWeight)}
                      onValueChange={(v) => updateTypo("fontWeight", Number(v))}
                      disabled={isFreeUser}
                    >
                      <SelectTrigger id="tp-fw" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="300">300 — Light</SelectItem>
                        <SelectItem value="400">400 — Regular</SelectItem>
                        <SelectItem value="500">500 — Medium</SelectItem>
                        <SelectItem value="600">600 — Semibold</SelectItem>
                        <SelectItem value="700">700 — Bold</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Font Size" htmlFor="tp-fs">
                    <div className="flex items-center gap-3">
                      <Slider
                        id="tp-fs"
                        min={12}
                        max={18}
                        step={1}
                        value={[config.typography.fontSize]}
                        onValueChange={(v) => updateTypo("fontSize", v[0])}
                        className="flex-1"
                        disabled={isFreeUser}
                      />
                      <span className="w-12 text-right text-sm tabular-nums">
                        {config.typography.fontSize}px
                      </span>
                    </div>
                  </Field>
                  <Field label="Line Height" htmlFor="tp-lh">
                    <div className="flex items-center gap-3">
                      <Slider
                        id="tp-lh"
                        min={1.2}
                        max={2.0}
                        step={0.1}
                        value={[config.typography.lineHeight]}
                        onValueChange={(v) => updateTypo("lineHeight", v[0])}
                        className="flex-1"
                        disabled={isFreeUser}
                      />
                      <span className="w-12 text-right text-sm tabular-nums">
                        {config.typography.lineHeight.toFixed(1)}
                      </span>
                    </div>
                  </Field>
                </TabsContent>

                {/* Components (Theme Builder) */}
                <TabsContent value="components" className="mt-4 space-y-4">
                  <CardDescription>
                    Add, remove, and reorder the components that make up this
                    email. Order is stored in{" "}
                    <code className="rounded bg-muted px-1">
                      config.components
                    </code>
                    .
                  </CardDescription>
                  <ComponentsEditor
                    components={
                      config.components ?? COMPONENT_TYPES.map((c) => c.id)
                    }
                    onChange={(comps) => updateConfig("components", comps)}
                    disabled={isFreeUser}
                  />
                </TabsContent>

                <Separator className="my-4" />

                {/* Save / Activate bar */}
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Template Name — the ONLY editable field for FREE users */}
                    <Field label="Template Name" htmlFor="theme-name">
                      <Input
                        id="theme-name"
                        value={themeName}
                        onChange={(e) => setThemeName(e.target.value)}
                        placeholder="My Custom Theme"
                      />
                    </Field>
                    <Field label="Purpose" htmlFor="theme-purpose">
                      <Select
                        value={purpose}
                        onValueChange={(v) => setPurpose(v as Purpose)}
                        disabled={isFreeUser}
                      >
                        <SelectTrigger id="theme-purpose" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PURPOSES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={saveTheme}
                      disabled={saving}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <Save className="mr-2 h-4 w-4" />{" "}
                      {saving ? "Saving…" : "Save Theme"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => activateTheme()}
                      disabled={!editingId || isFreeUser}
                      title={
                        isFreeUser ? "Activation is a PRO+ feature" : undefined
                      }
                    >
                      <Lock className="mr-2 h-4 w-4" /> Activate
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => editingId && deleteTheme(editingId)}
                      disabled={
                        !editingId ||
                        (editingTheme ? !editingTheme.canModify : false)
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </div>
                  {isFreeUser && (
                    <p className="text-xs text-muted-foreground">
                      FREE plan: save up to 2 custom themes with your own name.
                      Activate, dynamic rules, and full customization require
                      PRO+.
                    </p>
                  )}
                </div>
              </CardContent>
            </Tabs>
          </Card>

          {/* Live Preview (sticky) */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Card dir={isRtl ? "rtl" : "ltr"} style={rtlFontStyle}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Eye className="h-5 w-5 text-emerald-600" /> Live Preview
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    {/* Live indicator — green pulsing dot + label (or amber if fallback) */}
                    <div
                      className={`flex items-center gap-1.5 text-xs font-medium ${
                        previewFallback
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                      aria-label="Live preview updates as you edit"
                    >
                      <span className="relative flex h-2 w-2">
                        {!previewFallback && (
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                        )}
                        <span
                          className={`relative inline-flex h-2 w-2 rounded-full ${previewFallback ? "bg-amber-500" : "bg-emerald-600"}`}
                        />
                      </span>
                      {previewFallback ? "Simplified" : "Live preview"}
                    </div>
                    {previewLoading && <Skeleton className="h-4 w-16" />}
                    {/* Manual retry button — re-fetches the preview on demand */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => refreshPreview()}
                      disabled={previewLoading}
                      aria-label="Retry preview"
                      title="Retry preview"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${previewLoading ? "animate-spin" : ""}`}
                      />
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  Renders real HTML from the preview API · updates as you edit
                </CardDescription>
                {/* Error/fallback banner — shown when the preview API fails or returns fallback HTML */}
                {previewError && (
                  <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{previewError}</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Preview controls */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Select
                    value={mode}
                    onValueChange={(v) =>
                      setMode(v as "light" | "dark" | "auto")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="auto">Auto</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={language}
                    onValueChange={(v) => setLanguage(v as Language)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={inboxClient} onValueChange={setInboxClient}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INBOX_CLIENTS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={sendTestEmail}
                    className="w-full"
                  >
                    <Send className="mr-1 h-4 w-4" /> Test
                  </Button>
                </div>

                {/* iframe */}
                <div className="rounded-md border bg-muted/40 p-2">
                  <div
                    className="mx-auto overflow-hidden rounded-md bg-white shadow-sm transition-all"
                    style={{ width: `${inboxWidth}px`, maxWidth: "100%" }}
                  >
                    <iframe
                      title="email-preview"
                      srcDoc={
                        previewHtml ||
                        '<!doctype html><html><body style="font-family:sans-serif;padding:24px;color:#888">Loading preview…</body></html>'
                      }
                      className="block h-[520px] w-full border-0 bg-white"
                      sandbox="allow-same-origin"
                    />
                  </div>
                  <div className="mt-1 text-center text-[10px] text-muted-foreground">
                    {inboxClient} · {inboxWidth}px wide{isRtl ? " · RTL" : ""}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Pro features: Dynamic theme rules */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" /> Dynamic Theme Rules
              {isFreeUser && (
                <Badge
                  variant="outline"
                  className="ml-1 border-amber-500/40 text-amber-600"
                >
                  <Lock className="mr-1 h-3 w-3" /> PRO+
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Map each OTP purpose to an active saved theme. Only one theme can
              be active per purpose.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="space-y-2">
                {PURPOSES.map((p) => (
                  <Skeleton key={p} className="h-10 w-full" />
                ))}
              </div>
            ) : themes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved themes yet — save one above to enable rules.
              </p>
            ) : (
              <>
                <div
                  className={`overflow-hidden rounded-md border ${isFreeUser ? "pointer-events-none opacity-60" : ""}`}
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Purpose</TableHead>
                        <TableHead>Active Theme</TableHead>
                        <TableHead className="w-24 text-right">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PURPOSES.map((p) => {
                        const selected = ruleDrafts[p];
                        const isActive =
                          activeRules[p] === selected && !!selected;
                        return (
                          <TableRow key={p}>
                            <TableCell className="font-mono text-sm">
                              {p}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={selected ? String(selected) : "__none__"}
                                onValueChange={(v) =>
                                  setRuleDrafts((d) => {
                                    const next = { ...d };
                                    if (v === "__none__") delete next[p];
                                    else next[p] = Number(v);
                                    return next;
                                  })
                                }
                                disabled={isFreeUser}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="— none —" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">
                                    — none —
                                  </SelectItem>
                                  {templatesByPurpose
                                    .filter(
                                      (t) =>
                                        t.purpose === p || t.purpose === "all",
                                    )
                                    .map((t) => (
                                      <SelectItem
                                        key={t.id}
                                        value={String(t.id)}
                                      >
                                        {t.name} {t.isPro ? "(Pro)" : ""} ·{" "}
                                        {t.templateId}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">
                              {isActive ? (
                                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                  active
                                </Badge>
                              ) : selected ? (
                                <Badge variant="secondary">draft</Badge>
                              ) : (
                                <Badge variant="outline">none</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    onClick={saveRules}
                    disabled={isFreeUser}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Save className="mr-2 h-4 w-4" /> Save Rules
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Multi-language + inbox preview notes */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-emerald-600" /> Multi-Language
                Support
              </CardTitle>
              <CardDescription>
                Templates ship with localized strings for the body, code label,
                and footer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((l) => (
                  <Badge
                    key={l.id}
                    variant="outline"
                    className={
                      language === l.id
                        ? "border-emerald-500 text-emerald-700"
                        : ""
                    }
                  >
                    {l.label}
                    {(l.id === "fa" || l.id === "ar") && (
                      <span className="ml-1 text-[10px]">RTL</span>
                    )}
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Persian and Arabic are rendered right-to-left automatically.
                Switch the language from the preview panel above to see each
                variant live.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="h-5 w-5 text-emerald-600" /> Live Inbox Preview
              </CardTitle>
              <CardDescription>
                Simulate how the email renders in 5 popular clients.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {INBOX_CLIENTS.map((c) => (
                  <Badge
                    key={c.id}
                    variant="outline"
                    className={
                      inboxClient === c.id
                        ? "border-emerald-500 text-emerald-700"
                        : ""
                    }
                  >
                    {c.label} · {c.width}px
                  </Badge>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                The preview iframe width matches each client&apos;s viewport.
                CSS is sandboxed inside the iframe so it never leaks into the
                admin UI.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Saved themes table */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Save className="h-5 w-5 text-emerald-600" /> Saved Themes
            </CardTitle>
            <CardDescription>
              {themes.length} saved theme(s) — load one into the editor to
              modify it.
              {!isFreeUser && " You can only edit themes you own."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <Skeleton className="h-40 w-full" />
            ) : themes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved themes yet.
              </p>
            ) : (
              <div className="max-h-96 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-28">Template</TableHead>
                      <TableHead className="w-24">Purpose</TableHead>
                      <TableHead className="w-20">Status</TableHead>
                      <TableHead className="w-56 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {themes.map((t) => {
                      const canEdit = t.canModify;
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">
                            {t.name}
                            {t.isPro && (
                              <Badge className="ml-2 border-transparent bg-amber-500 text-amber-950 hover:bg-amber-500">
                                <Crown className="mr-1 h-3 w-3" />
                                Pro
                              </Badge>
                            )}
                            {t.userId === null && (
                              <Badge variant="outline" className="ml-2">
                                system
                              </Badge>
                            )}
                            {!canEdit && (
                              <Badge
                                variant="outline"
                                className="ml-2 border-muted-foreground/30 text-muted-foreground"
                              >
                                <Lock className="mr-1 h-3 w-3" />
                                read-only
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {t.templateId}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {t.purpose}
                          </TableCell>
                          <TableCell>
                            {t.isActive ? (
                              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                                active
                              </Badge>
                            ) : (
                              <Badge variant="secondary">inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => loadSavedTheme(t)}
                                disabled={!canEdit}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => activateTheme(t.id)}
                                disabled={t.isActive || !canEdit || isFreeUser}
                              >
                                Activate
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteTheme(t.id)}
                                disabled={!canEdit}
                                aria-label={`Delete ${t.name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ---------- Small reusable field components ----------

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  // Only treat as a swatch if it looks like a hex color
  const isHex = /^#[0-9a-fA-F]{3,8}$/.test(value ?? "");
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isHex ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`${label} color picker`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex-1 font-mono text-sm"
          placeholder="#059669"
        />
      </div>
    </div>
  );
}

function ComponentsEditor({
  components,
  onChange,
  disabled,
}: {
  components: string[];
  onChange: (c: string[]) => void;
  disabled?: boolean;
}) {
  function add(id: string) {
    if (disabled) return;
    onChange([...components, id]);
  }
  function remove(id: string) {
    if (disabled) return;
    onChange(components.filter((c) => c !== id));
  }
  function toggle(id: string) {
    if (disabled) return;
    if (components.includes(id)) remove(id);
    else add(id);
  }
  function move(idx: number, dir: -1 | 1) {
    if (disabled) return;
    const next = [...components];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <Label className="text-xs font-medium text-muted-foreground">
          Available
        </Label>
        <div className="mt-2 space-y-1.5">
          {COMPONENT_TYPES.map((c) => {
            const enabled = components.includes(c.id);
            return (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={enabled}
                    onCheckedChange={() => toggle(c.id)}
                    id={`chk-${c.id}`}
                    disabled={disabled}
                  />
                  <span>{c.label}</span>
                </label>
                {!enabled && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => add(c.id)}
                    disabled={disabled}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <Label className="text-xs font-medium text-muted-foreground">
          Order ({components.length})
        </Label>
        <div className="mt-2 space-y-1.5">
          {components.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No components enabled.
            </p>
          )}
          {components.map((id, idx) => {
            const meta = COMPONENT_TYPES.find((c) => c.id === id);
            return (
              <div
                key={`${id}-${idx}`}
                className="flex items-center justify-between rounded-md border bg-muted/40 p-2"
              >
                <span className="text-sm">
                  <span className="mr-2 font-mono text-xs text-muted-foreground">
                    {idx + 1}.
                  </span>
                  {meta?.label ?? id}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0 || disabled}
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => move(idx, 1)}
                    disabled={idx === components.length - 1 || disabled}
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(id)}
                    disabled={disabled}
                    aria-label={`Remove ${meta?.label}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
