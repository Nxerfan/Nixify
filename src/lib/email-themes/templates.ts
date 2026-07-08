/**
 * 20 professionally designed OTP email templates.
 *
 * Each template defines: background, header, otpCard, footer, typography,
 * and a category. 2 are free (Minimal, Clean); 18 are Pro.
 *
 * Templates are pure data — the renderer (renderThemeHtml) turns a config
 * into HTML. This separation lets users customize any field while the
 * template provides sensible defaults.
 *
 * Light + Dark: every template has both color schemes. The renderer outputs
 * both via CSS that respects `prefers-color-scheme` AND a manual toggle
 * (data-theme attribute) so email clients that strip media queries still
 * render correctly.
 */

export type ThemeCategory =
  | "Minimal"
  | "Modern"
  | "Corporate"
  | "Startup"
  | "Elegant"
  | "Glass"
  | "Luxury"
  | "Cyber"
  | "Gradient"
  | "Neon"
  | "Clean"
  | "Apple"
  | "Google"
  | "GitHub"
  | "Discord"
  | "Stripe"
  | "Terminal"
  | "Professional"
  | "Soft"
  | "Classic";

export interface ThemeConfig {
  // ---- Text content (editable by ALL plans) ----------------
  content?: {
    title?: string;
    subtitle?: string;
    footerText?: string;
    ignoreText?: string;
  };
  // ---- Visual branding (editable by PRO+ only) --------------
  branding?: {
    appName?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    website?: string;
    supportEmail?: string;
    defaultFont?: string;
  };

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
}

export interface Template {
  id: string;
  name: string;
  category: ThemeCategory;
  isPro: boolean;
  description: string;
  config: ThemeConfig;
}

// ---- Helpers to keep template definitions concise ------------------------

function t(
  id: string,
  name: string,
  category: ThemeCategory,
  isPro: boolean,
  description: string,
  config: Partial<ThemeConfig>,
): Template {
  const base: ThemeConfig = {
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
  };
  return {
    id,
    name,
    category,
    isPro,
    description,
    config: { ...base, ...config },
  };
}

// ---- The 20 templates ----------------------------------------------------

export const TEMPLATES: Template[] = [
  // FREE (2)
  t(
    "minimal",
    "Minimal",
    "Minimal",
    false,
    "Clean, distraction-free. Maximum readability.",
    {
      background: { type: "solid", value: "#ffffff", darkValue: "#0a0a0a" },
      header: {
        logoPosition: "left",
        alignment: "left",
        title: "Your verification code",
        subtitle: "",
        backgroundColor: "#ffffff",
        darkBackgroundColor: "#0a0a0a",
        textColor: "#0f172a",
        darkTextColor: "#fafafa",
      },
      otpCard: {
        background: "#f8fafc",
        darkBackground: "#171717",
        border: "#e2e8f0",
        darkBorder: "#262626",
        borderRadius: 8,
        shadow: "none",
        font: "ui-monospace, monospace",
        fontSize: 30,
        letterSpacing: 6,
        textColor: "#0f172a",
        darkTextColor: "#fafafa",
        style: "box",
      },
      primaryColor: "#0f172a",
      secondaryColor: "#64748b",
      accentColor: "#0f172a",
    },
  ),
  t(
    "clean",
    "Clean",
    "Clean",
    false,
    "Simple and professional. Works everywhere.",
    {
      background: { type: "solid", value: "#f1f5f9", darkValue: "#111827" },
      header: {
        logoPosition: "center",
        alignment: "center",
        title: "Verify your email",
        subtitle: "Enter this code to continue",
        backgroundColor: "#ffffff",
        darkBackgroundColor: "#1f2937",
        textColor: "#0f172a",
        darkTextColor: "#f9fafb",
      },
      otpCard: {
        background: "#ffffff",
        darkBackground: "#374151",
        border: "#e5e7eb",
        darkBorder: "#4b5563",
        borderRadius: 12,
        shadow: "0 1px 2px rgba(0,0,0,0.05)",
        font: "ui-monospace, monospace",
        fontSize: 32,
        letterSpacing: 8,
        textColor: "#059669",
        darkTextColor: "#34d399",
        style: "box",
      },
    },
  ),

  // PRO (18)
  t("modern", "Modern", "Modern", true, "Contemporary with subtle gradients.", {
    background: {
      type: "gradient",
      value: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)",
      darkValue: "linear-gradient(135deg,#1e1b4b 0%,#4c1d95 100%)",
    },
    header: {
      logoPosition: "center",
      alignment: "center",
      title: "Verification Code",
      subtitle: "Secure access to your account",
      backgroundColor: "transparent",
      darkBackgroundColor: "transparent",
      textColor: "#ffffff",
      darkTextColor: "#ffffff",
    },
    otpCard: {
      background: "#ffffff",
      darkBackground: "#1e1b4b",
      border: "rgba(255,255,255,0.2)",
      darkBorder: "rgba(255,255,255,0.1)",
      borderRadius: 16,
      shadow: "0 20px 40px rgba(0,0,0,0.15)",
      font: "ui-monospace, monospace",
      fontSize: 34,
      letterSpacing: 10,
      textColor: "#667eea",
      darkTextColor: "#a78bfa",
      style: "box",
    },
    primaryColor: "#667eea",
    secondaryColor: "#764ba2",
    accentColor: "#f59e0b",
  }),
  t(
    "corporate",
    "Corporate",
    "Corporate",
    true,
    "Professional blue for enterprise.",
    {
      background: { type: "solid", value: "#f0f4f8", darkValue: "#0f172a" },
      header: {
        logoPosition: "left",
        alignment: "left",
        title: "Email Verification",
        subtitle: "Please confirm your email address",
        backgroundColor: "#1e40af",
        darkBackgroundColor: "#1e3a8a",
        textColor: "#ffffff",
        darkTextColor: "#ffffff",
      },
      otpCard: {
        background: "#ffffff",
        darkBackground: "#1e293b",
        border: "#cbd5e1",
        darkBorder: "#334155",
        borderRadius: 8,
        shadow: "0 1px 3px rgba(0,0,0,0.1)",
        font: "ui-monospace, monospace",
        fontSize: 30,
        letterSpacing: 6,
        textColor: "#1e40af",
        darkTextColor: "#60a5fa",
        style: "box",
      },
      primaryColor: "#1e40af",
      secondaryColor: "#1e3a8a",
      accentColor: "#f59e0b",
    },
  ),
  t("startup", "Startup", "Startup", true, "Vibrant and energetic.", {
    background: {
      type: "gradient",
      value: "linear-gradient(135deg,#f97316 0%,#ec4899 100%)",
      darkValue: "linear-gradient(135deg,#7c2d12 0%,#831843 100%)",
    },
    header: {
      logoPosition: "center",
      alignment: "center",
      title: "Almost there!",
      subtitle: "Verify your email to get started",
      backgroundColor: "transparent",
      darkBackgroundColor: "transparent",
      textColor: "#ffffff",
      darkTextColor: "#ffffff",
    },
    otpCard: {
      background: "#ffffff",
      darkBackground: "#1f2937",
      border: "#fed7aa",
      darkBorder: "#7c2d12",
      borderRadius: 20,
      shadow: "0 10px 30px rgba(0,0,0,0.2)",
      font: "ui-monospace, monospace",
      fontSize: 36,
      letterSpacing: 10,
      textColor: "#f97316",
      darkTextColor: "#fb923c",
      style: "pill",
    },
    primaryColor: "#f97316",
    secondaryColor: "#ec4899",
    accentColor: "#fbbf24",
  }),
  t("elegant", "Elegant", "Elegant", true, "Sophisticated serif typography.", {
    background: { type: "solid", value: "#fafaf9", darkValue: "#1c1917" },
    header: {
      logoPosition: "center",
      alignment: "center",
      title: "Your Code",
      subtitle: "For your security",
      backgroundColor: "transparent",
      darkBackgroundColor: "transparent",
      textColor: "#1c1917",
      darkTextColor: "#fafaf9",
    },
    otpCard: {
      background: "#ffffff",
      darkBackground: "#292524",
      border: "#d6d3d1",
      darkBorder: "#44403c",
      borderRadius: 4,
      shadow: "0 1px 2px rgba(0,0,0,0.05)",
      font: "Georgia, serif",
      fontSize: 34,
      letterSpacing: 12,
      textColor: "#1c1917",
      darkTextColor: "#fafaf9",
      style: "underline",
    },
    typography: {
      fontFamily: "Georgia, serif",
      fontWeight: 400,
      fontSize: 15,
      lineHeight: 1.7,
    },
    primaryColor: "#1c1917",
    secondaryColor: "#78716c",
    accentColor: "#a8a29e",
  }),
  t("glass", "Glass", "Glass", true, "Frosted glass morphism effect.", {
    background: {
      type: "gradient",
      value: "linear-gradient(135deg,#a78bfa 0%,#f0abfc 50%,#67e8f9 100%)",
      darkValue: "linear-gradient(135deg,#312e81 0%,#581c87 50%,#164e63 100%)",
    },
    header: {
      logoPosition: "center",
      alignment: "center",
      title: "Verify Email",
      subtitle: "Your security code",
      backgroundColor: "rgba(255,255,255,0.1)",
      darkBackgroundColor: "rgba(255,255,255,0.05)",
      textColor: "#ffffff",
      darkTextColor: "#ffffff",
    },
    otpCard: {
      background: "rgba(255,255,255,0.25)",
      darkBackground: "rgba(255,255,255,0.1)",
      border: "rgba(255,255,255,0.4)",
      darkBorder: "rgba(255,255,255,0.2)",
      borderRadius: 20,
      shadow: "0 8px 32px rgba(0,0,0,0.1)",
      font: "ui-monospace, monospace",
      fontSize: 34,
      letterSpacing: 10,
      textColor: "#1e1b4b",
      darkTextColor: "#e0e7ff",
      style: "box",
    },
    primaryColor: "#7c3aed",
    secondaryColor: "#c026d3",
    accentColor: "#06b6d4",
  }),
  t("luxury", "Luxury", "Luxury", true, "Gold on black. Premium feel.", {
    background: { type: "solid", value: "#0a0a0a", darkValue: "#000000" },
    header: {
      logoPosition: "center",
      alignment: "center",
      title: "Verification",
      subtitle: "Exclusive access code",
      backgroundColor: "transparent",
      darkBackgroundColor: "transparent",
      textColor: "#d4af37",
      darkTextColor: "#d4af37",
    },
    otpCard: {
      background: "#111111",
      darkBackground: "#0a0a0a",
      border: "#d4af37",
      darkBorder: "#d4af37",
      borderRadius: 4,
      shadow: "0 0 20px rgba(212,175,55,0.2)",
      font: "Georgia, serif",
      fontSize: 36,
      letterSpacing: 14,
      textColor: "#d4af37",
      darkTextColor: "#d4af37",
      style: "box",
    },
    typography: {
      fontFamily: "Georgia, serif",
      fontWeight: 400,
      fontSize: 15,
      lineHeight: 1.7,
    },
    primaryColor: "#d4af37",
    secondaryColor: "#1c1917",
    accentColor: "#d4af37",
  }),
  t("cyber", "Cyber", "Cyber", true, "Neon green on dark. Hacker aesthetic.", {
    background: { type: "solid", value: "#0a0e0a", darkValue: "#000000" },
    header: {
      logoPosition: "left",
      alignment: "left",
      title: "> ACCESS_CODE",
      subtitle: "// authenticate to continue",
      backgroundColor: "#0f1f0f",
      darkBackgroundColor: "#000000",
      textColor: "#00ff41",
      darkTextColor: "#00ff41",
    },
    otpCard: {
      background: "#001100",
      darkBackground: "#000000",
      border: "#00ff41",
      darkBorder: "#00ff41",
      borderRadius: 0,
      shadow: "0 0 15px rgba(0,255,65,0.3)",
      font: "ui-monospace, monospace",
      fontSize: 32,
      letterSpacing: 8,
      textColor: "#00ff41",
      darkTextColor: "#00ff41",
      style: "mono",
    },
    primaryColor: "#00ff41",
    secondaryColor: "#008f11",
    accentColor: "#00ff41",
  }),
  t("gradient", "Gradient", "Gradient", true, "Flowing rainbow gradient.", {
    background: {
      type: "gradient",
      value:
        "linear-gradient(135deg,#06b6d4 0%,#3b82f6 25%,#8b5cf6 50%,#ec4899 75%,#f59e0b 100%)",
      darkValue:
        "linear-gradient(135deg,#0e7490 0%,#1e40af 25%,#5b21b6 50%,#9d174d 75%,#92400e 100%)",
    },
    header: {
      logoPosition: "center",
      alignment: "center",
      title: "Your Code",
      subtitle: "Beautiful by design",
      backgroundColor: "transparent",
      darkBackgroundColor: "transparent",
      textColor: "#ffffff",
      darkTextColor: "#ffffff",
    },
    otpCard: {
      background: "#ffffff",
      darkBackground: "#1f2937",
      border: "rgba(255,255,255,0.5)",
      darkBorder: "rgba(255,255,255,0.1)",
      borderRadius: 24,
      shadow: "0 15px 35px rgba(0,0,0,0.2)",
      font: "ui-monospace, monospace",
      fontSize: 36,
      letterSpacing: 10,
      textColor: "#8b5cf6",
      darkTextColor: "#a78bfa",
      style: "pill",
    },
    primaryColor: "#8b5cf6",
    secondaryColor: "#ec4899",
    accentColor: "#06b6d4",
  }),
  t("neon", "Neon", "Neon", true, "Electric pink neon glow.", {
    background: { type: "solid", value: "#0d0221", darkValue: "#000000" },
    header: {
      logoPosition: "center",
      alignment: "center",
      title: "VERIFY",
      subtitle: "Enter the neon code",
      backgroundColor: "transparent",
      darkBackgroundColor: "transparent",
      textColor: "#ff10f0",
      darkTextColor: "#ff10f0",
    },
    otpCard: {
      background: "#1a0b2e",
      darkBackground: "#0d0221",
      border: "#ff10f0",
      darkBorder: "#ff10f0",
      borderRadius: 12,
      shadow: "0 0 20px rgba(255,16,240,0.4)",
      font: "ui-monospace, monospace",
      fontSize: 34,
      letterSpacing: 12,
      textColor: "#ff10f0",
      darkTextColor: "#ff10f0",
      style: "box",
    },
    primaryColor: "#ff10f0",
    secondaryColor: "#7b2cbf",
    accentColor: "#39ff14",
  }),
  t("apple", "Apple Inspired", "Apple", true, "Clean San Francisco style.", {
    background: { type: "solid", value: "#f5f5f7", darkValue: "#1d1d1f" },
    header: {
      logoPosition: "center",
      alignment: "center",
      title: "Verify your email",
      subtitle: "Enter this code on your device",
      backgroundColor: "transparent",
      darkBackgroundColor: "transparent",
      textColor: "#1d1d1f",
      darkTextColor: "#f5f5f7",
    },
    otpCard: {
      background: "#ffffff",
      darkBackground: "#2d2d2f",
      border: "#d2d2d7",
      darkBorder: "#424245",
      borderRadius: 16,
      shadow: "0 1px 3px rgba(0,0,0,0.08)",
      font: "-apple-system, SF Pro, sans-serif",
      fontSize: 34,
      letterSpacing: 8,
      textColor: "#0071e3",
      darkTextColor: "#2997ff",
      style: "box",
    },
    typography: {
      fontFamily: "-apple-system, SF Pro, sans-serif",
      fontWeight: 400,
      fontSize: 15,
      lineHeight: 1.5,
    },
    primaryColor: "#0071e3",
    secondaryColor: "#1d1d1f",
    accentColor: "#86868b",
  }),
  t(
    "google",
    "Google Inspired",
    "Google",
    true,
    "Material Design with Google colors.",
    {
      background: { type: "solid", value: "#ffffff", darkValue: "#202124" },
      header: {
        logoPosition: "left",
        alignment: "left",
        title: "Verification code",
        subtitle: "To finish, enter this code",
        backgroundColor: "transparent",
        darkBackgroundColor: "transparent",
        textColor: "#202124",
        darkTextColor: "#e8eaed",
      },
      otpCard: {
        background: "#f1f3f4",
        darkBackground: "#28292c",
        border: "#dadce0",
        darkBorder: "#5f6368",
        borderRadius: 8,
        shadow: "none",
        font: "Google Sans, Roboto, sans-serif",
        fontSize: 32,
        letterSpacing: 6,
        textColor: "#1a73e8",
        darkTextColor: "#8ab4f8",
        style: "box",
      },
      typography: {
        fontFamily: "Google Sans, Roboto, sans-serif",
        fontWeight: 400,
        fontSize: 14,
        lineHeight: 1.6,
      },
      primaryColor: "#1a73e8",
      secondaryColor: "#202124",
      accentColor: "#ea4335",
    },
  ),
  t(
    "github",
    "GitHub Inspired",
    "GitHub",
    true,
    "Developer-friendly dark default.",
    {
      background: { type: "solid", value: "#ffffff", darkValue: "#0d1117" },
      header: {
        logoPosition: "left",
        alignment: "left",
        title: "Verify your email address",
        subtitle: "Thanks for signing up! Use this code:",
        backgroundColor: "#f6f8fa",
        darkBackgroundColor: "#161b22",
        textColor: "#24292f",
        darkTextColor: "#c9d1d9",
      },
      otpCard: {
        background: "#f6f8fa",
        darkBackground: "#161b22",
        border: "#d0d7de",
        darkBorder: "#30363d",
        borderRadius: 6,
        shadow: "0 1px 0 rgba(0,0,0,0.05)",
        font: "ui-monospace, SFMono-Regular, monospace",
        fontSize: 28,
        letterSpacing: 4,
        textColor: "#24292f",
        darkTextColor: "#e6edf3",
        style: "box",
      },
      primaryColor: "#0969da",
      secondaryColor: "#24292f",
      accentColor: "#1f883d",
    },
  ),
  t("discord", "Discord Inspired", "Discord", true, "Playful with blurple.", {
    background: { type: "solid", value: "#f2f3f5", darkValue: "#36393f" },
    header: {
      logoPosition: "center",
      alignment: "center",
      title: "Verify your email",
      subtitle: "Enter this code to verify",
      backgroundColor: "#5865f2",
      darkBackgroundColor: "#5865f2",
      textColor: "#ffffff",
      darkTextColor: "#ffffff",
    },
    otpCard: {
      background: "#ffffff",
      darkBackground: "#2f3136",
      border: "#5865f2",
      darkBorder: "#5865f2",
      borderRadius: 12,
      shadow: "0 2px 10px rgba(0,0,0,0.1)",
      font: "gg sans, sans-serif",
      fontSize: 36,
      letterSpacing: 10,
      textColor: "#5865f2",
      darkTextColor: "#7983f5",
      style: "pill",
    },
    typography: {
      fontFamily: "gg sans, sans-serif",
      fontWeight: 500,
      fontSize: 15,
      lineHeight: 1.4,
    },
    primaryColor: "#5865f2",
    secondaryColor: "#36393f",
    accentColor: "#eb459e",
  }),
  t(
    "stripe",
    "Stripe Inspired",
    "Stripe",
    true,
    "Polished with purple accents.",
    {
      background: { type: "solid", value: "#f6f9fc", darkValue: "#0a2540" },
      header: {
        logoPosition: "center",
        alignment: "center",
        title: "Your verification code",
        subtitle: "Enter this code to continue",
        backgroundColor: "transparent",
        darkBackgroundColor: "transparent",
        textColor: "#0a2540",
        darkTextColor: "#ffffff",
      },
      otpCard: {
        background: "#ffffff",
        darkBackground: "#1a3a5c",
        border: "#e3e8ee",
        darkBorder: "#2a4a6c",
        borderRadius: 8,
        shadow: "0 1px 3px rgba(0,0,0,0.08)",
        font: "ui-monospace, monospace",
        fontSize: 32,
        letterSpacing: 8,
        textColor: "#635bff",
        darkTextColor: "#7a73ff",
        style: "box",
      },
      typography: {
        fontFamily: "Inter, sans-serif",
        fontWeight: 400,
        fontSize: 15,
        lineHeight: 1.6,
      },
      primaryColor: "#635bff",
      secondaryColor: "#0a2540",
      accentColor: "#00d4ff",
    },
  ),
  t("terminal", "Terminal", "Terminal", true, "Monospace green-on-black.", {
    background: { type: "solid", value: "#000000", darkValue: "#000000" },
    header: {
      logoPosition: "left",
      alignment: "left",
      title: "$ verify --email",
      subtitle: ">>> awaiting code...",
      backgroundColor: "#0c0c0c",
      darkBackgroundColor: "#000000",
      textColor: "#33ff33",
      darkTextColor: "#33ff33",
    },
    otpCard: {
      background: "#0c0c0c",
      darkBackground: "#000000",
      border: "#33ff33",
      darkBorder: "#33ff33",
      borderRadius: 0,
      shadow: "none",
      font: "ui-monospace, monospace",
      fontSize: 30,
      letterSpacing: 6,
      textColor: "#33ff33",
      darkTextColor: "#33ff33",
      style: "mono",
    },
    typography: {
      fontFamily: "ui-monospace, monospace",
      fontWeight: 400,
      fontSize: 14,
      lineHeight: 1.5,
    },
    primaryColor: "#33ff33",
    secondaryColor: "#006600",
    accentColor: "#ffffff",
  }),
  t(
    "professional",
    "Professional",
    "Professional",
    true,
    "Conservative and trustworthy.",
    {
      background: { type: "solid", value: "#f3f4f6", darkValue: "#111827" },
      header: {
        logoPosition: "left",
        alignment: "left",
        title: "Email Verification Code",
        subtitle: "Please use the following code",
        backgroundColor: "#1f2937",
        darkBackgroundColor: "#0f172a",
        textColor: "#ffffff",
        darkTextColor: "#f9fafb",
      },
      otpCard: {
        background: "#ffffff",
        darkBackground: "#1f2937",
        border: "#d1d5db",
        darkBorder: "#374151",
        borderRadius: 8,
        shadow: "0 1px 3px rgba(0,0,0,0.1)",
        font: "ui-monospace, monospace",
        fontSize: 30,
        letterSpacing: 6,
        textColor: "#1f2937",
        darkTextColor: "#f9fafb",
        style: "box",
      },
      primaryColor: "#1f2937",
      secondaryColor: "#374151",
      accentColor: "#3b82f6",
    },
  ),
  t("soft", "Soft", "Soft", true, "Gentle pastel palette.", {
    background: {
      type: "gradient",
      value: "linear-gradient(135deg,#fce7f3 0%,#ddd6fe 50%,#cffafe 100%)",
      darkValue: "linear-gradient(135deg,#4a044e 0%,#2e1065 50%,#083344 100%)",
    },
    header: {
      logoPosition: "center",
      alignment: "center",
      title: "Here's your code ✨",
      subtitle: "Stay safe and secure",
      backgroundColor: "transparent",
      darkBackgroundColor: "transparent",
      textColor: "#831843",
      darkTextColor: "#fbcfe8",
    },
    otpCard: {
      background: "#ffffff",
      darkBackground: "#3b0764",
      border: "#fbcfe8",
      darkBorder: "#7e22ce",
      borderRadius: 24,
      shadow: "0 4px 14px rgba(0,0,0,0.08)",
      font: "ui-monospace, monospace",
      fontSize: 34,
      letterSpacing: 10,
      textColor: "#db2777",
      darkTextColor: "#f9a8d4",
      style: "pill",
    },
    primaryColor: "#db2777",
    secondaryColor: "#7c3aed",
    accentColor: "#06b6d4",
  }),
  t(
    "classic",
    "Classic",
    "Classic",
    true,
    "Traditional business letter style.",
    {
      background: { type: "solid", value: "#ffffff", darkValue: "#1a1a1a" },
      header: {
        logoPosition: "left",
        alignment: "left",
        title: "Email Verification",
        subtitle: "Dear User,",
        backgroundColor: "transparent",
        darkBackgroundColor: "transparent",
        textColor: "#000000",
        darkTextColor: "#e5e5e5",
      },
      otpCard: {
        background: "#f8f8f8",
        darkBackground: "#262626",
        border: "#000000",
        darkBorder: "#e5e5e5",
        borderRadius: 0,
        shadow: "none",
        font: "Times New Roman, serif",
        fontSize: 32,
        letterSpacing: 8,
        textColor: "#000000",
        darkTextColor: "#e5e5e5",
        style: "underline",
      },
      typography: {
        fontFamily: "Times New Roman, serif",
        fontWeight: 400,
        fontSize: 14,
        lineHeight: 1.7,
      },
      primaryColor: "#000000",
      secondaryColor: "#404040",
      accentColor: "#1e40af",
    },
  ),
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function getFreeTemplates(): Template[] {
  return TEMPLATES.filter((t) => !t.isPro);
}

export function getProTemplates(): Template[] {
  return TEMPLATES.filter((t) => t.isPro);
}

// ---- Multi-language support ----------------------------------------------

export const SUPPORTED_LANGUAGES = ["en", "fa", "ar", "tr", "de"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  fa: "Persian",
  ar: "Arabic",
  tr: "Turkish",
  de: "German",
};

export const LANGUAGE_RTL: Record<Language, boolean> = {
  en: false,
  fa: true,
  ar: true,
  tr: false,
  de: false,
};

/** Default localized strings for the email body. */
export const TRANSLATIONS: Record<
  Language,
  {
    title: string;
    subtitle: string;
    codeLabel: string;
    expiresIn: string;
    ignoreText: string;
    footerText: string;
  }
> = {
  en: {
    title: "Verify your email",
    subtitle: "Use the code below to complete verification",
    codeLabel: "Your code",
    expiresIn: "This code expires in 10 minutes",
    ignoreText:
      "If you didn't request this code, you can safely ignore this email.",
    footerText: "This message was sent to",
  },
  fa: {
    title: "ایمیل خود را تأیید کنید",
    subtitle: "از کد زیر برای تکمیل تأیید استفاده کنید",
    codeLabel: "کد شما",
    expiresIn: "این کد در ۱۰ دقیقه منقضی می‌شود",
    ignoreText:
      "اگر این کد را درخواست نکرده‌اید، می‌توانید این ایمیل را نادیده بگیرید.",
    footerText: "این پیام به",
  },
  ar: {
    title: "تأكيد بريدك الإلكتروني",
    subtitle: "استخدم الرمز أدناه لإكمال التحقق",
    codeLabel: "رمزك",
    expiresIn: "تنتهي صلاحية هذا الرمز خلال 10 دقائق",
    ignoreText:
      "إذا لم تطلب هذا الرمز، فيمكنك تجاهل هذا البريد الإلكتروني بأمان.",
    footerText: "تم إرسال هذه الرسالة إلى",
  },
  tr: {
    title: "E-postanızı doğrulayın",
    subtitle: "Doğrulamayı tamamlamak için aşağıdaki kodu kullanın",
    codeLabel: "Kodunuz",
    expiresIn: "Bu kod 10 dakika içinde sona erer",
    ignoreText:
      "Bu kodu talep etmediyseniz, bu e-postayı güvenle yok sayabilirsiniz.",
    footerText: "Bu mesaj şu adrese gönderildi",
  },
  de: {
    title: "Bestätigen Sie Ihre E-Mail",
    subtitle:
      "Verwenden Sie den Code unten, um die Verifizierung abzuschließen",
    codeLabel: "Ihr Code",
    expiresIn: "Dieser Code läuft in 10 Minuten ab",
    ignoreText:
      "Wenn Sie diesen Code nicht angefordert haben, können Sie diese E-Mail sicher ignorieren.",
    footerText: "Diese Nachricht wurde gesendet an",
  },
};
