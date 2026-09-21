/**
 * UX-B: Branding guide — English content dictionary.
 *
 * AUDIT-GRADE FACTUAL ACCURACY (verified against source):
 *   Every statement here was verified against:
 *     - src/app/dashboard/branding/page.tsx             (Email Themes editor)
 *     - Audit findings in /home/z/my-project/worklog.md (Task ID: audit-dashboard-pages)
 *
 * Specifically:
 *   - The Branding page (called "Email Themes" in the header) shows:
 *       Card 1: Template Gallery (horizontally scrollable row of templates,
 *               with Pro/Free badges, category, and "🔒 Upgrade to edit"
 *               lock notice for FREE+pro templates).
 *       Two-column grid:
 *         Left  = Editor Card with sticky toolbar (Editor title, editing
 *                 subtitle, plan badge) and a 7-tab TabsList (Branding,
 *                 Header, OTP, BG, Footer, Typography, Components).
 *         Right = sticky Live Preview Card with Mode/Language/Inbox client
 *                 selects and a Test button. The iframe renders real HTML.
 *   - Below the grid: Save/Activate bar (Template Name input, Purpose
 *     select, "Save Theme" / "Activate" / "Delete" buttons).
 *   - Below that: Dynamic Theme Rules card (PRO+ feature), Multi-Language
 *     Support card, Live Inbox Preview card, Saved Themes card.
 *
 *   - On FREE plan: only the Template Name field is editable in the editor;
 *     Title/Subtitle on the Header tab and the Footer tab text fields are
 *     editable; everything else (colors, fonts, components, brand kit,
 *     activation rules) requires PRO or MAX.
 *
 *   - Real API endpoints (NOT called from the stage — for teaching only):
 *       GET  /api/admin/themes/templates
 *       GET  /api/admin/themes/list
 *       GET  /api/admin/themes/active
 *       GET  /api/admin/brand-kit
 *       POST /api/admin/themes/preview  body { config, code, email, language, mode }
 *       POST /api/admin/themes/save     body { id?, name, templateId, purpose, config }
 *       POST /api/admin/themes/active   body { id, purpose }
 *       DELETE /api/admin/themes/save?id={id}
 *       POST /api/admin/brand-kit       body { appName, primaryColor, ... }
 *
 * Technical tokens (hex colors, CSS property names, HTML tags, template IDs,
 * font names) are stored as raw strings here and wrapped with <Ltr> at
 * render time. The stage reads `dir` from the copy (ltr for en, rtl for fa)
 * and is NOT permanently dir="ltr".
 *
 * This dictionary also contains:
 *   - stage: human-facing copy for the simulated BrandingStage product UI.
 *   - creative: copy for the four creative sections (Before/After,
 *     Anatomy, What changes in the actual email, Consistency checklist).
 */

import type { BrandingGuideContent } from "./branding-types";

export const brandingEn: BrandingGuideContent = {
  slug: "branding",
  category: "customization",
  dashboardRoute: "/dashboard/branding",
  title: "Branding",
  description:
    "Design your email appearance — colors, header, footer, typography, and live OTP preview.",
  routeKey: "branding",
  backHref: "/dashboard/branding",
  stepCount: 6,
  durationMin: 5,
  chapters: [
    {
      id: "intro",
      title: "Branding",
      steps: [
        {
          id: "brandingOverview",
          caption:
            "The Branding page (titled \"Email Themes\" in the dashboard) is where you design what your emails look like. It has a Template Gallery at the top, a two-column editor + live preview below, and a Save/Activate bar at the bottom of the editor.",
          duration: 7000,
          scene: "brandingOverview",
        },
        {
          id: "gallery",
          caption:
            "Start from a template. The Template Gallery is a horizontally scrollable row of professionally designed templates, each tagged Pro or Free and grouped by category. On FREE plan, the gallery is browse-only — clicking a Pro template shows \"🔒 Upgrade to edit\".",
          duration: 7000,
          scene: "gallery",
        },
        {
          id: "colorsTab",
          caption:
            "The Branding tab holds your visual identity: App Name, Logo URL, Primary / Secondary / Accent color pickers, Website, Support Email, and Default Font. Use \"Save as Brand Kit\" to reuse these on every theme, and \"Load Brand Kit\" to apply a saved kit to the current theme.",
          duration: 7500,
          scene: "colorsTab",
        },
        {
          id: "headerFooterTabs",
          caption:
            "The Header tab edits the email's title, subtitle, logo position, alignment, and background color. The Footer tab edits company name, copyright, support email, website, and social links. On FREE plan, only the text fields are editable — colors and layout require PRO+.",
          duration: 7500,
          scene: "headerFooterTabs",
        },
        {
          id: "livePreview",
          caption:
            "The Live Preview card on the right renders real HTML from the preview API. Switch Mode (Light / Dark / Auto), Language (English / Persian / Arabic / Turkish / German), and Inbox client (Gmail Desktop 600px / Gmail Mobile 375px / Outlook / Apple Mail / Yahoo) to see how the email looks in each. \"Test\" sends a real preview email.",
          duration: 8000,
          scene: "livePreview",
        },
        {
          id: "savedThemes",
          caption:
            "Name your theme and pick a Purpose (all / signup / login / reset / verification / 2fa), then \"Save Theme\" writes it to your account. \"Activate\" (PRO+) sets a saved theme as the active one for a given purpose. The Dynamic Theme Rules card maps a Purpose to its active theme — and the Saved Themes table lists every theme you own.",
          duration: 8000,
          scene: "savedThemes",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "Open the Email Themes editor",
      body: "From the dashboard, navigate to Branding. The page is titled \"Email Themes\". At the top there's a back button, a Refresh button, and the theme toggle. The first card is the Template Gallery. Below it is a two-column grid: the Editor card on the left, and the Live Preview card on the right.",
    },
    {
      title: "Pick a template from the gallery",
      body: "The Template Gallery is a horizontally scrollable row of templates. Each card shows a MiniPreview, the template name, a Pro or Free badge, and the template category. On FREE plan, the gallery is browse-only — clicking a Pro template shows \"🔒 Upgrade to edit\". On PRO or MAX, clicking any template loads its config into the editor.",
    },
    {
      title: "Edit on the seven-tab editor",
      body: "The Editor card has a sticky toolbar showing \"Editor\", the editing subtitle (\"Editing #N\" or \"New theme from template\"), and a plan badge. Below the toolbar is a 7-tab TabsList: Branding, Header, OTP, BG, Footer, Typography, Components. Each tab edits a different slice of the ThemeConfig. On FREE plan, an amber banner explains that only Template Name is editable; Header text and Footer text remain editable on FREE.",
    },
    {
      title: "Customize colors and brand kit",
      body: "On the Branding tab, set App Name, Logo URL, Primary / Secondary / Accent color pickers, Website, Support Email, and Default Font. Use \"Save as Brand Kit\" to store these and \"Load Brand Kit\" to apply them to the current theme. On FREE plan, these fields are locked — only Template Name in the save bar is editable.",
    },
    {
      title: "Use the live preview to validate",
      body: "The Live Preview card renders real HTML from the preview API. Switch Mode (Light / Dark / Auto), Language (English / Persian / Arabic / Turkish / German), and Inbox client (Gmail Desktop 600px / Gmail Mobile 375px / Outlook / Apple Mail / Yahoo). Click \"Test\" to send a real preview email to your admin inbox. The preview updates as you edit.",
    },
    {
      title: "Save, activate, and reuse themes",
      body: "At the bottom of the editor, set Template Name (always editable) and Purpose (all / signup / login / reset / verification / 2fa), then click \"Save Theme\". To make a saved theme the active one for a Purpose, click \"Activate\" (PRO+ only). The Dynamic Theme Rules card maps a Purpose to its active theme, and the Saved Themes table lists every saved theme you own.",
    },
  ],
  whyWhen: [
    {
      title: "When to use Branding",
      body: "Use Branding whenever you want the OTP, transactional, or broadcast emails Nixify sends on your behalf to match your product's identity — colors, header, footer, typography, and OTP card style. Branding is what makes an email from \"Nixify\" feel like an email from \"Your App\".",
    },
    {
      title: "Template vs saved theme",
      body: "A Template is a professionally designed starting point provided by Nixify — Pro or Free, grouped by category. A Saved Theme is what you create when you load a template, customize it (or leave it as-is), give it a name, and click \"Save Theme\". The Saved Themes table is your personal library; templates never change.",
    },
    {
      title: "Purpose and active theme",
      body: "Each saved theme has a Purpose — all, signup, login, reset, verification, or 2fa. The Dynamic Theme Rules card maps each Purpose to its currently active theme. When Nixify sends an OTP for signup, it looks up the active theme for the \"signup\" purpose and renders with that theme's config. \"all\" is the fallback purpose used when no more specific purpose matches.",
    },
  ],
  mistakes: [
    {
      title: "Expecting the gallery to be editable on FREE",
      body: "On FREE plan, the Template Gallery is browse-only. Clicking a Pro template shows \"🔒 Upgrade to edit\". Even Free templates can only be loaded into the editor on PRO or MAX. On FREE, the only field that's editable is Template Name in the save bar, plus Title/Subtitle on the Header tab and the Footer tab's text fields.",
    },
    {
      title: "Forgetting to Save before Activate",
      body: "Activate operates on a saved theme — it requires a theme ID. If you've loaded a template and customized it but haven't clicked \"Save Theme\" yet, Activate is disabled or toasts \"Save the theme first\". Always Save first, then Activate.",
    },
    {
      title: "Editing the wrong Purpose's active theme",
      body: "Activating a theme sets it as active for its Purpose. If you activate a theme tagged for \"login\", only login OTPs will use it — signup, reset, and verification will use whatever their own active theme is. If you want one theme everywhere, set Purpose = all and activate it.",
    },
    {
      title: "Confusing Brand Kit with a saved theme",
      body: "Brand Kit is a single record holding your App Name, Logo URL, colors, Website, Support Email, and Default Font. It is NOT a saved theme — it's a reusable starting point. \"Load Brand Kit\" applies your brand kit values to the current theme's Branding tab; you still need to \"Save Theme\" to persist the result.",
    },
    {
      title: "Assuming the preview is the final email",
      body: "The Live Preview renders real HTML via the preview API, but the actual delivered email may differ slightly by inbox client (Gmail strips some CSS, Outlook has its own quirks). Use the Inbox client selector to validate against each major client, and use \"Test\" to send a real preview to your admin inbox before activating.",
    },
  ],
  proTips: [
    {
      title: "Start from a template, then Save as Brand Kit",
      body: "Templates give you a sensible starting point. After loading one, fill in the Branding tab with your real App Name, Logo URL, colors, website, and support email, then click \"Save as Brand Kit\". Future themes can \"Load Brand Kit\" to apply these in one click — no need to re-enter them each time.",
    },
    {
      title: "Use the Inbox client selector to catch Gmail/Outlook quirks",
      body: "Before activating, switch the preview's Inbox client between Gmail Desktop (600px), Gmail Mobile (375px), Outlook, Apple Mail, and Yahoo. Each client renders CSS differently — what looks great in Apple Mail may break in Outlook. The width caption below the iframe shows which client you're previewing.",
    },
    {
      title: "Set a Persian/Arabic language and verify RTL",
      body: "Nixify supports English, Persian, Arabic, Turkish, and German. Persian and Arabic are RTL — the preview shows an \"RTL\" tag in the caption. Always preview your theme in those languages to confirm the header, footer, and OTP card render correctly in RTL.",
    },
  ],
  troubleshooting: [
    {
      title: "Preview shows \"Simplified\" with an amber banner",
      body: "The Live Preview shows an amber \"Simplified\" label when the preview API returned a fallback. Causes: your plan doesn't include preview (403 entitlement), your session expired (401), or the server renderer hit an error (500). For 401, sign in again. For 403, the preview pane falls back to a simplified client-rendered preview — to remove the limit, upgrade your plan. The pane is never blank.",
    },
    {
      title: "\"Activate\" button is disabled",
      body: "Activate operates on a saved theme — it requires a theme ID. If you've loaded a template and customized but haven't saved, Activate is disabled and a toast says \"Save the theme first\". Save the theme, then click Activate. Activate is also gated to PRO+ plans — on FREE, the button is disabled.",
    },
    {
      title: "Saved theme isn't being used for my emails",
      body: "Each email uses the active theme for its Purpose. If your emails still look like the default, check the Dynamic Theme Rules card — find the row matching the Purpose (e.g. signup) and make sure your saved theme is selected as the Active Theme and that its Status is \"active\" (emerald), not \"draft\" or \"none\".",
    },
    {
      title: "\"Brand kit save failed\" toast",
      body: "Saving the Brand Kit requires PRO+ and writes to /api/admin/brand-kit. If you see \"Brand kit save failed\", the most common causes are: you're on FREE (the button is gated), your session expired (re-login), or one of the required fields (App Name, colors) is missing. Fill in all Branding tab fields and try again.",
    },
    {
      title: "Can't edit a saved theme I see in the table",
      body: "Each saved theme has a canModify flag computed by the backend based on ownership. System themes (userId = null) and themes owned by another user show a \"read-only\" lock badge. You can only edit themes you own. If you see \"read-only\" or the Edit button is disabled, that's why — clone the config into a new theme instead.",
    },
  ],
  checklist: [
    { label: "Open the Email Themes editor (Dashboard → Branding)" },
    { label: "Browse the Template Gallery and load a template" },
    { label: "Read the 7-tab editor structure (Branding, Header, OTP, BG, Footer, Typography, Components)" },
    { label: "Fill in the Branding tab (App Name, colors, font) and Save as Brand Kit" },
    { label: "Edit Header and Footer tabs (text fields editable on FREE)" },
    { label: "Use Live Preview with Mode / Language / Inbox client selectors" },
    { label: "Save the theme with a name + purpose, then Activate (PRO+)" },
    { label: "Verify the active theme in Dynamic Theme Rules" },
  ],
  whatNext:
    "Once you've saved and activated a theme, the next step is to send a real OTP through the Playground or your app to see the active theme in a delivered email. From there, explore Templates (reusable transactional email bodies with variables and versioning) and Broadcasts (bulk campaigns that use your active theme) — both compose with Branding to deliver a fully on-brand email.",
  related: [
    {
      label: "Open Branding in the dashboard",
      href: "/dashboard/branding",
    },
    {
      label: "Browse templates",
      href: "/dashboard/templates",
    },
    {
      label: "Send a broadcast (uses the active theme)",
      href: "/dashboard/broadcasts",
    },
  ],

  /* ─── Stage copy (simulated Email Themes editor, English) ──────────────── */
  stage: {
    dir: "ltr",
    locale: "en",

    header: {
      title: "Email Themes",
      backToDashboard: "← Dashboard",
      refresh: "Refresh",
    },

    gallery: {
      title: "Template Gallery",
      description: (n) =>
        `${n} professionally designed templates — click any to load it into the editor.`,
      proBadge: "Pro",
      freeBadge: "Free",
      upgradeToEdit: "🔒 Upgrade to edit",
      clickHint: "Click to load into the editor",
    },

    editor: {
      title: "Editor",
      editingName: (name) => `Editing "${name}"`,
      newFromTemplate: "New theme from template",
      templatePrefix: "Template:",
      planBadgeFree: "FREE",
      planBadgePro: "PRO",
      planBadgeMax: "MAX",
      freeBannerTitle: "🔒 FREE plan — only Template Name is editable.",
      freeBannerSubtitle:
        "Upgrade to PRO or MAX to unlock the full editor (colors, fonts, components, brand kit, activation rules).",
      tabs: {
        branding: "Branding",
        header: "Header",
        otp: "OTP",
        bg: "BG",
        footer: "Footer",
        typography: "Typography",
        components: "Components",
      },
      freeTabNotices: {
        branding:
          "🔒 Upgrade to PRO to customize visual branding (colors, logo, company name). You can edit text content in the Header and Footer tabs.",
        header:
          "Content editable on FREE plan. Title and subtitle below can be edited. Layout and color options require PRO.",
        footer:
          "Text content editable on FREE plan. Company name, copyright, and contact details below can be edited. Styling (colors) requires PRO.",
      },
    },

    brandingTab: {
      appName: "App Name",
      logoUrl: "Logo URL",
      primaryColor: "Primary Color",
      secondaryColor: "Secondary Color",
      accentColor: "Accent Color",
      website: "Website",
      supportEmail: "Support Email",
      defaultFont: "Default Font",
      saveAsBrandKit: "Save as Brand Kit",
      loadBrandKit: "Load Brand Kit",
      fontOptions: [
        { value: "Inter", label: "Inter" },
        { value: "Arial", label: "Arial" },
        { value: "Georgia", label: "Georgia" },
        { value: "Roboto", label: "Roboto" },
        { value: "ui-monospace, monospace", label: "Mono" },
        { value: "-apple-system", label: "-apple-system" },
      ],
    },

    headerTab: {
      title: "Title",
      subtitle: "Subtitle",
      logoPosition: "Logo Position",
      alignment: "Alignment",
      backgroundColor: "Background Color",
      textColor: "Text Color",
      positionLeft: "left",
      positionCenter: "center",
      positionRight: "right",
      contentEditableNote:
        "Content editable on FREE plan. Title and subtitle below can be edited. Layout and color options require PRO.",
    },

    footerTab: {
      companyName: "Company Name",
      copyright: "Copyright",
      supportEmail: "Support Email",
      website: "Website",
      twitter: "Twitter",
      github: "GitHub",
      linkedin: "LinkedIn",
      textColor: "Text Color",
      contentEditableNote:
        "Text content editable on FREE plan. Company name, copyright, and contact details below can be edited. Styling (colors) requires PRO.",
    },

    preview: {
      title: "Live Preview",
      description: "Renders real HTML from the preview API · updates as you edit",
      liveIndicator: "Live preview",
      simplified: "Simplified",
      testButton: "Test",
      modeLabel: "Mode",
      languageLabel: "Language",
      inboxClientLabel: "Inbox client",
      modeOptions: [
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
        { value: "auto", label: "Auto" },
      ],
      languageOptions: [
        { value: "en", label: "English" },
        { value: "fa", label: "Persian" },
        { value: "ar", label: "Arabic" },
        { value: "tr", label: "Turkish" },
        { value: "de", label: "German" },
      ],
      inboxClientOptions: [
        { value: "gmail-desktop", label: "Gmail Desktop", width: 600 },
        { value: "gmail-mobile", label: "Gmail Mobile", width: 375 },
        { value: "outlook", label: "Outlook", width: 600 },
        { value: "apple-mail", label: "Apple Mail", width: 375 },
        { value: "yahoo", label: "Yahoo Mail", width: 600 },
      ],
      widthCaption: (client, width) => `${client} · ${width}px wide`,
      rtlCaption: "RTL",
      loadingPreview: "Loading preview…",
      previewCode: "482915",
      previewAppName: "Nixify",
    },

    saveBar: {
      templateName: "Template Name",
      purpose: "Purpose",
      saveTheme: "Save Theme",
      saving: "Saving…",
      activate: "Activate",
      delete: "Delete",
      purposeOptions: [
        { value: "all", label: "all" },
        { value: "signup", label: "signup" },
        { value: "login", label: "login" },
        { value: "reset", label: "reset" },
        { value: "verification", label: "verification" },
        { value: "2fa", label: "2fa" },
      ],
    },

    rules: {
      title: "Dynamic Theme Rules",
      proPlusBadge: "PRO+",
      upgradeNotice: "Dynamic theme rules are a PRO+ feature.",
      purposeHeader: "Purpose",
      activeThemeHeader: "Active Theme",
      statusHeader: "Status",
      statusActive: "active",
      statusDraft: "draft",
      statusNone: "none",
      saveRules: "Save Rules",
    },

    multiLanguage: {
      title: "Multi-Language Support",
      rtlTag: "RTL",
      description:
        "Themes render in five languages. Persian and Arabic are RTL — preview them to confirm layout.",
    },

    inboxPreview: {
      title: "Live Inbox Preview",
      description:
        "Preview against the major inbox clients — each renders CSS differently.",
    },

    savedThemes: {
      title: "Saved Themes",
      description: (n) =>
        `${n} saved theme(s) — load one into the editor to modify it. You can only edit themes you own.`,
      emptyTitle: "No saved themes yet.",
      emptyDescription: "Save one above to enable rules.",
      nameHeader: "Name",
      templateHeader: "Template",
      purposeHeader: "Purpose",
      statusHeader: "Status",
      actionsHeader: "Actions",
      systemBadge: "system",
      readOnlyBadge: "read-only",
      proBadge: "Pro",
      activeBadge: "active",
      inactiveBadge: "inactive",
      edit: "Edit",
      activate: "Activate",
      delete: "Delete",
    },

    templates: [
      { id: "default-emerald", name: "Default Emerald", category: "OTP", isPro: false },
      { id: "minimal-mono", name: "Minimal Mono", category: "OTP", isPro: true },
      { id: "rounded-slate", name: "Rounded Slate", category: "Verification", isPro: true },
      { id: "compact-amber", name: "Compact Amber", category: "2FA", isPro: false },
      { id: "warm-sand", name: "Warm Sand", category: "Login", isPro: true },
    ],

    savedThemesList: [
      {
        id: 1,
        name: "Default Emerald",
        templateId: "default-emerald",
        purpose: "all",
        isActive: true,
        isPro: false,
        isSystem: true,
      },
      {
        id: 2,
        name: "Signup Pro",
        templateId: "rounded-slate",
        purpose: "signup",
        isActive: true,
        isPro: true,
        isSystem: false,
      },
      {
        id: 3,
        name: "Reset Minimal",
        templateId: "minimal-mono",
        purpose: "reset",
        isActive: false,
        isPro: true,
        isSystem: false,
      },
    ],
  },

  /* ─── Creative-section copy (English) ─────────────────────────────────── */
  creative: {
    beforeAfter: {
      heading: "Before & After Branding",
      subheading:
        "Default theme on the left. A customized PRO+ theme on the right. Both render real HTML via the preview API — only the Branding-tab fields differ.",
      before: {
        badge: "Before",
        title: "Default Emerald (system)",
        body: "The default system theme ships with Nixify. App Name is \"Nixify\", primary color is emerald, and the OTP card uses the box style with default radius and shadow.",
        points: [
          "appName: Nixify",
          "primaryColor: #059669",
          "otpCard.style: box",
          "footer.copyright: © 2026 Nixify",
        ],
      },
      after: {
        badge: "After",
        title: "Acme Pro — branded theme",
        body: "Same template, customized via the Branding tab and saved as a new theme. App Name is now \"Acme\", the primary color is the customer's brand indigo, and the OTP card uses a pill style with larger letter spacing.",
        points: [
          "appName: Acme",
          "primaryColor: #4f46e5",
          "otpCard.style: pill",
          "footer.copyright: © 2026 Acme Inc.",
        ],
      },
      arrowLabel: "apply Branding tab",
    },

    anatomy: {
      heading: "Brand Anatomy",
      subheading:
        "A saved theme is a flat ThemeConfig object with five sections plus three top-level color tokens. Hover or tap each field to see where it lives and what it controls.",
      annotationsTitle: "ThemeConfig",
      selectHint: "Click a field for details",
      sections: [
        {
          title: "Colors",
          fields: [
            {
              field: "primaryColor",
              label: "Primary color",
              desc: "Top-level hex color. Used for header background, OTP code text, and primary buttons.",
              icon: "primary",
              value: "#059669",
            },
            {
              field: "secondaryColor",
              label: "Secondary color",
              desc: "Top-level hex color. Used for footer text and secondary accents.",
              icon: "secondary",
              value: "#0f172a",
            },
            {
              field: "accentColor",
              label: "Accent color",
              desc: "Top-level hex color. Used for hover states and small highlights.",
              icon: "accent",
              value: "#f59e0b",
            },
          ],
        },
        {
          title: "Typography",
          fields: [
            {
              field: "typography.fontFamily",
              label: "Font family",
              desc: "CSS font-family string applied to the whole email body.",
              icon: "fontFamily",
              value: "Inter, sans-serif",
            },
            {
              field: "typography.fontWeight",
              label: "Font weight",
              desc: "Numeric CSS weight (300–700) applied to body text.",
              icon: "fontWeight",
              value: "400",
            },
            {
              field: "typography.fontSize",
              label: "Font size",
              desc: "Body font size in px (12–18). The OTP card has its own font size slider.",
              icon: "fontSize",
              value: "15",
            },
            {
              field: "typography.lineHeight",
              label: "Line height",
              desc: "Unitless CSS line-height (1.2–2.0) for body text.",
              icon: "lineHeight",
              value: "1.6",
            },
          ],
        },
        {
          title: "Header & Footer",
          fields: [
            {
              field: "header.title",
              label: "Header title",
              desc: "The email's H1. Editable on FREE. Default: \"Verify your email\".",
              icon: "header",
              value: "Verify your email",
            },
            {
              field: "header.subtitle",
              label: "Header subtitle",
              desc: "A muted line under the title. Editable on FREE.",
              icon: "header",
              value: "Use the code below to complete verification",
            },
            {
              field: "footer.companyName",
              label: "Footer company name",
              desc: "Shown in the footer. Editable on FREE. Also used as the preview App Name.",
              icon: "footer",
              value: "Nixify",
            },
            {
              field: "footer.copyright",
              label: "Footer copyright",
              desc: "Copyright line at the bottom. Editable on FREE.",
              icon: "footer",
              value: "© 2026 Nixify",
            },
          ],
        },
      ],
    },

    emailChanges: {
      heading: "What changes in the actual email?",
      subheading:
        "Each Branding-tab field maps to a specific element in the rendered OTP email. The preview API applies your ThemeConfig in real time — the table below shows the field-by-field effect.",
      tableHeaders: {
        field: "Branding field",
        affects: "Email element",
        before: "Before (default)",
        after: "After (customized)",
      },
      mappings: [
        {
          field: "primaryColor",
          affects: "Header background + OTP code color",
          before: "#059669",
          after: "#4f46e5",
          note: "Single hex drives both the header banner and the OTP digits. Change once, both update.",
        },
        {
          field: "footer.companyName",
          affects: "Footer signature + preview App Name",
          before: "Nixify",
          after: "Acme",
          note: "Also used as the appName shown in the live preview pane header.",
        },
        {
          field: "header.title",
          affects: "Email H1",
          before: "Verify your email",
          after: "Confirm your Acme account",
          note: "Editable on FREE plan — no PRO upgrade required.",
        },
        {
          field: "otpCard.style",
          affects: "OTP digit presentation",
          before: "box",
          after: "pill",
          note: "Switches the OTP card between box / underline / pill / mono. PRO+ only.",
        },
        {
          field: "otpCard.letterSpacing",
          affects: "Spacing between OTP digits",
          before: "8px",
          after: "12px",
          note: "Slider 0–15px. Larger spacing reads more premium but takes more horizontal room.",
        },
        {
          field: "typography.fontFamily",
          affects: "Body + footer text font",
          before: "Inter, sans-serif",
          after: "Georgia, serif",
          note: "Applied globally. Persian/Arabic renderers fall back to Vazirmatn when needed.",
        },
        {
          field: "background.type",
          affects: "Email outer background",
          before: "solid",
          after: "gradient",
          note: "Switches between solid color / CSS gradient / image URL. Has a Dark Value for dark mode.",
        },
      ],
      footnote:
        "All seven fields above are persisted to the saved theme's ThemeConfig. The preview API reads the same ThemeConfig — what you see in the iframe is exactly what gets delivered.",
    },

    consistencyChecklist: {
      heading: "Brand Consistency Checklist",
      subheading:
        "Run through this list before clicking \"Activate\". A theme that fails any of these will look off-brand in at least one inbox.",
      items: [
        {
          label: "Same primary color across header, OTP, and button",
          hint: "primaryColor drives all three. Verify they match — don't override per-component.",
        },
        {
          label: "Footer companyName matches your product",
          hint: "footer.companyName is also the preview's appName. Keep it short — long names wrap on mobile.",
        },
        {
          label: "Header title is plain and specific",
          hint: "Default \"Verify your email\" is fine. For 2FA, prefer \"Your login code\". Avoid marketing copy in the H1.",
        },
        {
          label: "OTP card style matches your brand voice",
          hint: "box is the default. pill feels modern. underline is minimal. mono reads technical. Pick one and stay consistent across purposes.",
        },
        {
          label: "Previewed in Light, Dark, and at least one RTL language",
          hint: "Use the Mode selector and pick Persian or Arabic. Header alignment and footer wrap differently in RTL.",
        },
        {
          label: "Previewed in Gmail Mobile (375px) and Outlook",
          hint: "Gmail Mobile strips some CSS. Outlook ignores border-radius. If it looks broken there, simplify.",
        },
        {
          label: "Purpose is set and the Dynamic Rule is active",
          hint: "After Save, set a Purpose and check the Dynamic Theme Rules card. Status should be emerald \"active\", not \"draft\".",
        },
      ],
      warningTitle: "Don't mix active themes across purposes",
      warningBody:
        "If signup uses an indigo theme and login uses the default emerald, your users will see two different brands in two emails. If you want one consistent brand, set Purpose = all on a single theme and activate that one.",
    },
  },
};
