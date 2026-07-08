import type { ThemeConfig, Language } from "./templates";
import { TRANSLATIONS, LANGUAGE_RTL } from "./templates";

/**
 * Render a ThemeConfig + OTP code into a complete HTML email.
 *
 * The HTML uses inline CSS (email-client compatible) and a table-based layout.
 * Dark mode is supported via both:
 *   - `prefers-color-scheme: dark` media query (for modern clients)
 *   - A `.dark-mode` class wrapper (for manual toggle in the preview)
 *
 * The renderer is deterministic — same config + code = same HTML.
 */

export interface RenderOptions {
  code: string;
  email: string;
  expiresAt: Date;
  language?: Language;
  appName?: string;
  logoUrl?: string;
  /** Force a specific mode for preview ("light" | "dark" | "auto"). */
  mode?: "light" | "dark" | "auto";
}

export function renderThemeHtml(config: ThemeConfig, opts: RenderOptions): string {
  const lang = opts.language ?? "en";
  const t = TRANSLATIONS[lang];
  const rtl = LANGUAGE_RTL[lang];
  const dir = rtl ? "rtl" : "ltr";
  const code = escapeHtml(opts.code);
  const appName = escapeHtml(opts.appName ?? config.footer.companyName);
  const email = escapeHtml(opts.email);

  const title = escapeHtml(t.title);
  const subtitle = escapeHtml(t.subtitle);
  const codeLabel = escapeHtml(t.codeLabel);
  const expiresIn = escapeHtml(t.expiresIn.replace("10", "10"));
  const expiresFriendly = escapeHtml(formatExpiry(opts.expiresAt, lang));

  const otpStyle = otpCardStyle(config.otpCard);
  const headerStyle = `background-color:${config.header.backgroundColor};text-align:${config.header.alignment};padding:24px 28px;`;
  const bgStyle = backgroundStyle(config.background);
  const footerColor = config.footer.textColor;

  // Logo HTML
  const logoHtml = opts.logoUrl
    ? `<img src="${escapeHtml(opts.logoUrl)}" alt="${appName}" style="height:36px;max-width:180px;display:inline-block;" />`
    : `<span style="font-size:20px;font-weight:700;color:${config.header.textColor};">${appName}</span>`;

  // OTP code rendering based on style
  const codeHtml = renderOtpCode(code, config.otpCard);

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light dark"/>
<meta name="supported-color-schemes" content="light dark"/>
<title>${title}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .mg-bg { background: ${config.background.darkValue} !important; }
    .mg-header { background-color: ${config.header.darkBackgroundColor} !important; }
    .mg-header-text, .mg-header-text * { color: ${config.header.darkTextColor} !important; }
    .mg-card { background: ${config.otpCard.darkBackground} !important; border-color: ${config.otpCard.darkBorder} !important; }
    .mg-code { color: ${config.otpCard.darkTextColor} !important; }
    .mg-footer, .mg-footer * { color: ${config.footer.darkTextColor} !important; }
  }
  .dark-mode .mg-bg { background: ${config.background.darkValue} !important; }
  .dark-mode .mg-header { background-color: ${config.header.darkBackgroundColor} !important; }
  .dark-mode .mg-header-text, .dark-mode .mg-header-text * { color: ${config.header.darkTextColor} !important; }
  .dark-mode .mg-card { background: ${config.otpCard.darkBackground} !important; border-color: ${config.otpCard.darkBorder} !important; }
  .dark-mode .mg-code { color: ${config.otpCard.darkTextColor} !important; }
  .dark-mode .mg-footer, .dark-mode .mg-footer * { color: ${config.footer.darkTextColor} !important; }
</style>
</head>
<body class="${opts.mode === "dark" ? "dark-mode" : ""}" style="margin:0;padding:0;font-family:${config.typography.fontFamily};font-weight:${config.typography.fontWeight};font-size:${config.typography.fontSize}px;line-height:${config.typography.lineHeight};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="mg-bg" style="${bgStyle};padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:transparent;">
<tr><td class="mg-header" style="${headerStyle}">
  ${logoHtml}
  ${config.header.title ? `<h1 class="mg-header-text" style="margin:16px 0 4px 0;font-size:22px;font-weight:700;color:${config.header.textColor};">${title}</h1>` : ""}
  ${config.header.subtitle ? `<p class="mg-header-text" style="margin:0;font-size:14px;color:${config.header.textColor};opacity:0.9;">${subtitle}</p>` : ""}
</td></tr>
<tr><td style="padding:28px 28px 8px 28px;text-align:${config.header.alignment};">
  <p style="margin:0 0 16px 0;font-size:13px;color:${footerColor};">${codeLabel}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <div class="mg-card" style="${otpStyle}">${codeHtml}</div>
  </td></tr></table>
  <p style="margin:16px 0 0 0;font-size:12px;color:${footerColor};">${expiresIn} (${expiresFriendly})</p>
</td></tr>
<tr><td style="padding:8px 28px 24px 28px;text-align:${config.header.alignment};">
  <p style="margin:0;font-size:13px;color:${footerColor};">${escapeHtml(t.ignoreText)}</p>
</td></tr>
<tr><td class="mg-footer" style="padding:18px 28px;border-top:1px solid ${config.otpCard.border};">
  <p style="margin:0 0 4px 0;font-size:12px;color:${footerColor};">${escapeHtml(t.footerText)} <strong>${email}</strong>.</p>
  <p style="margin:0;font-size:12px;color:${footerColor};">${escapeHtml(config.footer.companyName)} · ${escapeHtml(config.footer.copyright)}</p>
  ${config.footer.website ? `<p style="margin:4px 0 0 0;font-size:12px;"><a href="${escapeHtml(config.footer.website)}" style="color:${config.primaryColor};text-decoration:none;">${escapeHtml(config.footer.website)}</a>${config.footer.supportEmail ? ` · <a href="mailto:${escapeHtml(config.footer.supportEmail)}" style="color:${config.primaryColor};text-decoration:none;">${escapeHtml(config.footer.supportEmail)}</a>` : ""}</p>` : ""}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Render the OTP code digits based on the card style. */
function renderOtpCode(code: string, card: ThemeConfig["otpCard"]): string {
  const style = `font-family:${card.font};font-size:${card.fontSize}px;letter-spacing:${card.letterSpacing}px;font-weight:700;color:${card.textColor};`;
  switch (card.style) {
    case "underline":
      return `<span class="mg-code" style="${style}border-bottom:3px solid ${card.textColor};padding-bottom:8px;">${code}</span>`;
    case "pill":
      return `<span class="mg-code" style="${style}background:${card.textColor}20;padding:12px 32px;border-radius:9999px;">${code}</span>`;
    case "mono":
      return `<span class="mg-code" style="${style}">${code}</span>`;
    case "box":
    default:
      return `<span class="mg-code" style="${style}">${code}</span>`;
  }
}

function otpCardStyle(card: ThemeConfig["otpCard"]): string {
  return `display:inline-block;background:${card.background};border:1px solid ${card.border};border-radius:${card.borderRadius}px;box-shadow:${card.shadow};padding:20px 32px;margin:0 auto;`;
}

function backgroundStyle(bg: ThemeConfig["background"]): string {
  switch (bg.type) {
    case "gradient": return `background:${bg.value};`;
    case "image": return `background-image:url('${bg.value}');background-size:cover;background-position:center;`;
    case "solid":
    default: return `background-color:${bg.value};`;
  }
}

function formatExpiry(date: Date, lang: Language): string {
  try {
    const locale = lang === "fa" ? "fa-IR" : lang === "ar" ? "ar-SA" : lang === "tr" ? "tr-TR" : lang === "de" ? "de-DE" : "en-US";
    return date.toLocaleString(locale);
  } catch {
    return date.toUTCString();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Generate a plain-text version of the email (multipart/alternative). */
export function renderThemeText(config: ThemeConfig, opts: RenderOptions): string {
  const lang = opts.language ?? "en";
  const t = TRANSLATIONS[lang];
  return [
    config.footer.companyName,
    "",
    t.title,
    "",
    `${t.codeLabel}: ${opts.code}`,
    "",
    `${t.expiresIn}.`,
    "",
    t.ignoreText,
    "",
    `${t.footerText} ${opts.email}`,
  ].join("\n");
}
