/**
 * UX-B: Branding guide — stage + creative copy types.
 *
 * The Branding guide is the second guide in the UX-B contextual guide system,
 * after Contacts. It mirrors the real Email Themes editor at
 *   src/app/dashboard/branding/page.tsx
 *
 * Architecture rules (REGRESSION-PROTECTED):
 *   - The stage + creative copy are guide-specific types defined here, but
 *     they all share the common GuideContentBase fields (chapters, writtenSteps,
 *     etc.) defined in ../types.
 *   - Each content dictionary (branding-en.ts, branding-fa.ts) exports a
 *     BrandingGuideContent that the view component consumes directly.
 *   - Technical tokens (hex colors, CSS property names, HTML tags, template
 *     IDs, email addresses, font family names) stay LTR via <Ltr> at render
 *     time. They are stored as raw strings here.
 *   - The stage reads `dir` from the copy (ltr for en, rtl for fa) and is NOT
 *     permanently `dir="ltr"`.
 *
 * Source-of-truth UI audit (verbatim labels from the real branding page):
 *   - 7 tabs: Branding · Header · OTP · BG · Footer · Typography · Components
 *   - Branding tab fields: App Name, Logo URL, Primary/Secondary/Accent Color,
 *     Website, Support Email, Default Font + "Save as Brand Kit" / "Load Brand Kit".
 *   - Header tab: Title, Subtitle, Logo Position, Alignment, Background Color,
 *     Text Color.
 *   - Footer tab: Company Name, Copyright, Support Email, Website, social
 *     links (Twitter/GitHub/LinkedIn), Text Color.
 *   - Live Preview: Mode (Light/Dark/Auto), Language (en/fa/ar/tr/de), Inbox
 *     client (Gmail Desktop 600 / Gmail Mobile 375 / Outlook 600 / Apple Mail
 *     375 / Yahoo Mail 600), Test button.
 *   - Save/Activate bar: Template Name, Purpose (all/signup/login/reset/
 *     verification/2fa), "Save Theme", "Activate", "Delete".
 *   - Dynamic Theme Rules: table of Purpose → Active Theme → Status
 *     (active/draft/none), with a PRO+ gate.
 *   - Saved Themes table: Name, Template, Purpose, Status, Actions.
 */

import type { GuideContentBase } from "../types";

/* ─── Stage copy ────────────────────────────────────────────────────────── */

export interface BrandingStageTemplate {
  id: string;
  name: string;
  category: string;
  isPro: boolean;
}

export interface BrandingStageSavedTheme {
  id: number;
  name: string;
  templateId: string;
  purpose: string;
  isActive: boolean;
  isPro: boolean;
  isSystem: boolean;
}

export interface BrandingStageCopy {
  dir: "ltr" | "rtl";
  locale: "en" | "fa";

  header: {
    title: string; // "Email Themes"
    backToDashboard: string; // "← Dashboard"
    refresh: string; // "Refresh"
  };

  gallery: {
    title: string; // "Template Gallery"
    description: (n: number) => string;
    proBadge: string; // "Pro"
    freeBadge: string; // "Free"
    upgradeToEdit: string; // "🔒 Upgrade to edit"
    clickHint: string; // hint shown on hover
  };

  editor: {
    title: string; // "Editor"
    editingName: (name: string) => string; // `Editing "{name}"`
    newFromTemplate: string; // "New theme from template"
    templatePrefix: string; // "Template:"
    planBadgeFree: string; // "FREE"
    planBadgePro: string; // "PRO"
    planBadgeMax: string; // "MAX"
    freeBannerTitle: string; // "🔒 FREE plan — only Template Name is editable."
    freeBannerSubtitle: string;
    tabs: {
      branding: string;
      header: string;
      otp: string;
      bg: string;
      footer: string;
      typography: string;
      components: string;
    };
    freeTabNotices: {
      branding: string;
      header: string;
      footer: string;
    };
  };

  brandingTab: {
    appName: string; // "App Name"
    logoUrl: string; // "Logo URL"
    primaryColor: string; // "Primary Color"
    secondaryColor: string; // "Secondary Color"
    accentColor: string; // "Accent Color"
    website: string; // "Website"
    supportEmail: string; // "Support Email"
    defaultFont: string; // "Default Font"
    saveAsBrandKit: string; // "Save as Brand Kit"
    loadBrandKit: string; // "Load Brand Kit"
    fontOptions: { value: string; label: string }[];
  };

  headerTab: {
    title: string; // "Title"
    subtitle: string; // "Subtitle"
    logoPosition: string; // "Logo Position"
    alignment: string; // "Alignment"
    backgroundColor: string; // "Background Color"
    textColor: string; // "Text Color"
    positionLeft: string;
    positionCenter: string;
    positionRight: string;
    contentEditableNote: string; // amber notice: "Content editable on FREE plan..."
  };

  footerTab: {
    companyName: string; // "Company Name"
    copyright: string; // "Copyright"
    supportEmail: string; // "Support Email"
    website: string; // "Website"
    twitter: string; // "Twitter"
    github: string; // "GitHub"
    linkedin: string; // "LinkedIn"
    textColor: string; // "Text Color"
    contentEditableNote: string;
  };

  preview: {
    title: string; // "Live Preview"
    description: string; // "Renders real HTML from the preview API..."
    liveIndicator: string; // "Live preview"
    simplified: string; // "Simplified"
    testButton: string; // "Test"
    modeLabel: string; // "Mode"
    languageLabel: string; // "Language"
    inboxClientLabel: string; // "Inbox client"
    modeOptions: { value: string; label: string }[];
    languageOptions: { value: string; label: string }[];
    inboxClientOptions: { value: string; label: string; width: number }[];
    widthCaption: (client: string, width: number) => string;
    rtlCaption: string;
    loadingPreview: string; // "Loading preview…"
    previewCode: string; // the OTP code displayed in preview
    previewAppName: string; // app name shown in preview
  };

  saveBar: {
    templateName: string; // "Template Name"
    purpose: string; // "Purpose"
    saveTheme: string; // "Save Theme"
    saving: string; // "Saving…"
    activate: string; // "Activate"
    delete: string; // "Delete"
    purposeOptions: { value: string; label: string }[];
  };

  rules: {
    title: string; // "Dynamic Theme Rules"
    proPlusBadge: string; // "PRO+"
    upgradeNotice: string; // "Dynamic theme rules are a PRO+ feature."
    purposeHeader: string; // "Purpose"
    activeThemeHeader: string; // "Active Theme"
    statusHeader: string; // "Status"
    statusActive: string; // "active"
    statusDraft: string; // "draft"
    statusNone: string; // "none"
    saveRules: string; // "Save Rules"
  };

  multiLanguage: {
    title: string; // "Multi-Language Support"
    rtlTag: string; // "RTL"
    description: string;
  };

  inboxPreview: {
    title: string; // "Live Inbox Preview"
    description: string;
  };

  savedThemes: {
    title: string; // "Saved Themes"
    description: (n: number) => string;
    emptyTitle: string; // "No saved themes yet."
    emptyDescription: string;
    nameHeader: string; // "Name"
    templateHeader: string; // "Template"
    purposeHeader: string; // "Purpose"
    statusHeader: string; // "Status"
    actionsHeader: string; // "Actions"
    systemBadge: string; // "system"
    readOnlyBadge: string; // "read-only"
    proBadge: string; // "Pro"
    activeBadge: string; // "active"
    inactiveBadge: string; // "inactive"
    edit: string; // "Edit"
    activate: string; // "Activate"
    delete: string; // "Delete"
  };

  /** Seed templates shown in the simulated gallery. Template IDs are LTR. */
  templates: BrandingStageTemplate[];
  /** Seed saved themes shown in the simulated saved-themes table. */
  savedThemesList: BrandingStageSavedTheme[];
}

/* ─── Creative section copy ─────────────────────────────────────────────── */

/* 1. Before / After preview comparison */

export interface BrandingBeforeAfterCopy {
  heading: string;
  subheading: string;
  before: {
    badge: string;
    title: string;
    body: string;
    points: string[];
  };
  after: {
    badge: string;
    title: string;
    body: string;
    points: string[];
  };
  arrowLabel: string;
}

/* 2. Brand anatomy (colors, typography, header, footer) */

export interface BrandAnatomyFieldCopy {
  field: string; // raw field name (e.g. "primaryColor") — LTR token
  label: string; // human label
  desc: string; // description
  icon: "primary" | "secondary" | "accent" | "fontFamily" | "fontWeight" | "fontSize" | "lineHeight" | "header" | "footer" | "logo" | "bg";
  value: string; // sample value (LTR token if technical)
}

export interface BrandAnatomyCopy {
  heading: string;
  subheading: string;
  annotationsTitle: string;
  selectHint: string;
  sections: { title: string; fields: BrandAnatomyFieldCopy[] }[];
}

/* 3. "What changes in the actual email?" explainer */

export interface EmailChangeMappingCopy {
  field: string; // branding field (LTR token)
  affects: string; // email element affected (human)
  before: string; // default value
  after: string; // customized value
  note: string; // explanation
}

export interface EmailChangesCopy {
  heading: string;
  subheading: string;
  tableHeaders: { field: string; affects: string; before: string; after: string };
  mappings: EmailChangeMappingCopy[];
  footnote: string;
}

/* 4. Consistency checklist */

export interface ConsistencyChecklistCopy {
  heading: string;
  subheading: string;
  items: { label: string; hint: string }[];
  warningTitle: string;
  warningBody: string;
}

export interface BrandingCreativeCopy {
  beforeAfter: BrandingBeforeAfterCopy;
  anatomy: BrandAnatomyCopy;
  emailChanges: EmailChangesCopy;
  consistencyChecklist: ConsistencyChecklistCopy;
}

/* ─── Combined guide content type ───────────────────────────────────────── */

export type BrandingGuideContent = GuideContentBase & {
  stage: BrandingStageCopy;
  creative: BrandingCreativeCopy;
};
