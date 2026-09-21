/**
 * UX-B: Templates guide — stage + creative copy types.
 *
 * The Templates guide is the fourth guide in the UX-B contextual guide
 * system, after Contacts, Branding, and Automations. It mirrors the REAL
 * Nixify Templates pages at:
 *   - src/app/dashboard/templates/page.tsx         (templates list)
 *   - src/app/dashboard/templates/[id]/page.tsx   (template editor)
 *
 * Architecture rules (REGRESSION-PROTECTED):
 *   - The stage + creative copy are guide-specific types defined here, but
 *     they all share the common GuideContentBase fields (chapters,
 *     writtenSteps, etc.) defined in ../types.
 *   - Each content dictionary (templates-en.ts, templates-fa.ts) exports
 *     a TemplatesGuideContent that the view component consumes directly.
 *   - Technical tokens (template slugs, variable names like email/name,
 *     version numbers v1/v2/v3, ISO timestamps, HTTP method names,
 *     {{var}} placeholders, sanitization hints, email addresses) stay LTR
 *     via <Ltr> at render time. They are stored as raw strings here.
 *   - The stage reads `dir` from the copy (ltr for en, rtl for fa) and is
 *     NOT permanently `dir="ltr"`.
 *
 * Source-of-truth UI audit (verbatim labels from the real templates pages):
 *
 *   LIST PAGE (src/app/dashboard/templates/page.tsx):
 *   - Header: ghost "Back to Dashboard" button + emerald FileText icon tile +
 *     h1 "Templates" + subtitle "Reusable transactional email templates.
 *     Versioned, sanitized, preview-only." + emerald "Create Template"
 *     button (Plus icon).
 *   - Search: max-w-sm Input with Search icon at left + "{n} templates"
 *     counter (singular/plural).
 *   - Table columns: Name (with FileText emerald tile + name + description),
 *     Slug (hidden md+ as <code>), Version (emerald outline Badge "v{n}"),
 *     Variables (hidden lg+ — Variable icon + "—"), Updated (hidden md+ —
 *     relative time), Actions (right-aligned DropdownMenu with Pencil Edit +
 *     rose Trash2 Delete).
 *   - Empty state: dashed Card with FileText circle, "No templates yet",
 *     description, emerald "Create Template" button.
 *   - Loading state: 5 skeleton rows.
 *   - Pagination (only when totalPages > 1): "Page {page} of {total}" + Prev/
 *     Next buttons (ChevronLeft / ChevronRight).
 *   - Create dialog (max-w-2xl): name + slug (auto-derived, mono),
 *     description (optional), subject (with {{variable}} help), HTML body
 *     (mono, placeholder "<h1>Welcome, {{first_name}}!</h1>..."), plain text
 *     (optional), Cancel + emerald "Create" submit. On success: toast + push
 *     to /dashboard/templates/{id}.
 *   - Delete: AlertDialog — rose action button, deletes via DELETE method.
 *
 *   EDITOR PAGE (src/app/dashboard/templates/[id]/page.tsx):
 *   - Header: ghost "← Templates" back button + FileText emerald + template
 *     name (truncate) + emerald outline "v{n}" Badge. Right side: emerald
 *     "Save" (Save icon) + rose outline "Delete" (Trash2 icon).
 *   - Two-column grid (lg:grid-cols-2):
 *     Left column  — Tabs (Editor | Versions ({count})):
 *       - Editor tab: Card "Content" with Name input, Slug input (immutable,
 *         amber "immutable" badge with Lock icon, disabled), Description
 *         textarea, Separator, Subject input (with {{var}} help), HTML body
 *         textarea (mono, 10 rows, sanitization note), plain text textarea
 *         (mono, 5 rows, "plain text fallback" placeholder), dirty-state
 *         hint + Revert (RotateCcw) + Save buttons.
 *       - Versions tab: Card "Version history" with each version as a row
 *         (v{n} Badge, subject, "{relativeTime} · {n} vars" with Clock +
 *         Variable icons, current Badge, Eye/EyeOff toggle). Clicking opens
 *         a read-only panel with amber "read-only historical version" badge
 *         + Lock icon. Selected version shows subject box + iframe preview.
 *     Right column — Live preview:
 *       - Card "Live preview" (Eye emerald icon).
 *       - Required variables section: "{n} vars" counter + list of
 *         {{var}} mono labels + Inputs for each variable value.
 *       - Emerald "Preview" button (Eye icon — free preview).
 *       - Emerald-outline "Send test email" button (Send icon — REAL send
 *         consumes MESSAGING_EMAILS quota).
 *       - Caption: "Preview is free. Sending delivers a real email."
 *       - Missing-variables amber alert (AlertCircle icon + amber {{var}}
 *         badges for missing ones).
 *       - Preview output: subject box + iframe (sandbox="allow-same-origin",
 *         srcDoc=html, h-[420px]).
 *       - Metadata Card: Template ID (code), Current version (v{n} Badge),
 *         Created (relative time), Updated (relative time).
 *   - Test send dialog (max-w-md): Send emerald icon + title + description.
 *     Amber Alert warning "⚠️ This sends a REAL email and consumes your
 *     messaging quota. Preview is free — use it first." Recipient email
 *     Input. Variables list (shared with preview, missing highlighted rose).
 *     Cancel + destructive "Send test email" button (Loader2 spinner while
 *     sending). On 201: toast success with message_id. On 400/402/403/404/
 *     409/502: specific toast per code.
 *   - Delete confirmation AlertDialog: rose destructive action.
 *
 * Real API endpoints (NOT called from the stage — for teaching only):
 *   GET    /api/dashboard/templates?page=1&pageSize=20&search=...
 *   POST   /api/dashboard/templates                (create: name, slug, subject, html, text?, description?)
 *   GET    /api/dashboard/templates/{id}          (detail with current + versions)
 *   PATCH  /api/dashboard/templates/{id}          (sends only dirty fields; bumps version if content changed)
 *   DELETE /api/dashboard/templates/{id}          (permanent)
 *   POST   /api/dashboard/templates/preview       (free preview; returns { subject, html, text })
 *   POST   /api/dashboard/templates/{id}/test-send (REAL send — 201 / 400 / 402 / 403 / 404 / 409 / 502)
 *   GET    /api/dashboard/templates/{id}/versions/{n}  (historical version detail)
 *
 * Auth / entitlement:
 *   401 → router.push("/auth")
 *   403 → entitled=false screen ("Not available" + "View Plans" button) on
 *   list page; toast + redirect to /dashboard/templates on editor page.
 *
 * Variable substitution:
 *   - The template's {{var}} placeholders in subject + html + text are
 *     replaced server-side by the values the caller provides.
 *   - If a required variable is missing, the API returns 400 with
 *     code = "missing_template_variables" and a `missing` array of names.
 *   - The list page's "Variables" column currently always shows "—" (the
 *     per-row variable count is not surfaced); variables are surfaced only
 *     in the editor's "Required variables" panel.
 */

import type { GuideContentBase } from "../types";

/* ─── Stage copy ────────────────────────────────────────────────────────── */

export interface TemplatesStageTemplate {
  /** Numeric ID — matches the real TemplateListItem.id */
  id: number;
  /** Human-friendly template name */
  name: string;
  /** URL-safe slug — LTR token */
  slug: string;
  /** Optional short description (line-clamped in the list) */
  description: string;
  /** Current version number — LTR token */
  currentVersion: number;
  /** Variables the template references (for the editor's Required variables panel) */
  variables: string[];
  /** Subject line (with {{var}} placeholders) — LTR token */
  subject: string;
  /** HTML body string (with {{var}} placeholders) — LTR token */
  html: string;
  /** Plain-text body (with {{var}} placeholders) — LTR token or empty */
  text: string;
  /** Relative-time string for "Updated" column — LTR token */
  updatedAtRelative: string;
}

export interface TemplatesStageVersion {
  /** Version number — LTR token */
  version: number;
  /** Subject line at that version */
  subject: string;
  /** Variable names at that version — LTR tokens */
  variables: string[];
  /** Relative-time string for "Created" — LTR token */
  createdAtRelative: string;
  /** Whether this version is the current one */
  isCurrent: boolean;
}

export interface TemplatesStageCopy {
  dir: "ltr" | "rtl";
  locale: "en" | "fa";

  listHeader: {
    title: string; // "Templates"
    backToDashboard: string; // "Back to Dashboard"
    subtitle: string; // "Reusable transactional email templates..."
    create: string; // "Create Template"
  };

  search: {
    placeholder: string; // "Search templates…"
    /** "{n} templates" / "{n} template" — n already converted to locale digits */
    count: (n: number) => string;
  };

  table: {
    name: string; // "Name"
    slug: string; // "Slug"
    version: string; // "Version"
    variables: string; // "Variables"
    updated: string; // "Updated"
    actions: string; // "Actions"
    actionsEdit: string; // "Edit"
    actionsDelete: string; // "Delete"
    empty: string; // "No templates yet"
    emptyDescription: string;
    emptyCreate: string; // "Create Template"
    notAvailable: string; // "Templates are not available on your current account"
    notAvailableDescription: string;
    notAvailableCta: string; // "View Plans"
    pageOf: (page: number, total: number) => string;
    prev: string; // "Prev"
    next: string; // "Next"
  };

  createDialog: {
    title: string; // "Create template"
    description: string;
    nameLabel: string;
    slugLabel: string;
    slugHelp: string;
    descriptionOptional: string;
    subjectLabel: string;
    subjectHelp: string;
    htmlLabel: string;
    textLabel: string;
    cancel: string;
    submit: string; // "Create"
    creating: string; // "Creating…"
  };

  editorHeader: {
    backToTemplates: string; // "Templates"
    save: string; // "Save"
    saving: string; // "Saving…"
    delete: string; // "Delete"
  };

  editorTabs: {
    editor: string; // "Editor"
    versions: (count: number) => string; // "Versions ({n})"
  };

  editorForm: {
    contentTitle: string; // "Content"
    nameLabel: string;
    slugLabel: string; // "Slug"
    immutableBadge: string; // "immutable"
    slugFixed: string;
    descriptionLabel: string;
    subjectLabel: string;
    subjectHelp: string; // {{variable}} substitution hint
    htmlLabel: string;
    htmlHelp: string; // sanitization note
    textLabel: string;
    textPlaceholder: string;
    unsavedChanges: string;
    allChangesSaved: string;
    revert: string; // "Revert"
    save: string;
    saving: string;
  };

  versions: {
    historyTitle: string; // "Version history"
    noVersions: string;
    noSubject: string; // "(no subject)"
    varsSuffix: (n: number) => string; // "1 var" / "2 vars"
    current: string; // "current"
    readOnlyBadge: string; // "read-only historical version"
    historicalCantEdit: string;
    loadFailed: string;
  };

  preview: {
    title: string; // "Live preview"
    requiredVars: string; // "Required variables"
    requiredVarsCount: (n: number) => string; // "1 var" / "2 vars"
    noVars: string; // "This template has no variables..."
    placeholderValue: (name: string) => string; // "value for {name}"
    previewButton: string; // "Preview"
    rendering: string; // "Rendering…"
    testSendButton: string; // "Send test email"
    caption: string; // "Preview is free. Sending delivers a real email."
    renderedSubject: string; // "Rendered subject"
    renderedHtml: string; // "Rendered HTML"
    fillInPrompt: string; // "Fill in the variables and click Preview..."
    missingVarsTitle: string; // "Missing variables"
    missingVarsDesc: string; // "Fill in values for the following before previewing:"
    requiredHint: string; // "— required"
  };

  testSend: {
    title: string; // "Send test email"
    description: string;
    warning: string; // "⚠️ This sends a REAL email and consumes your messaging quota..."
    recipientLabel: string;
    recipientPlaceholder: string;
    recipientHelp: string;
    varsLabel: (n: number) => string; // "Variables ({n})"
    missingSuffix: (n: number) => string; // "{n} missing"
    noVars: string;
    cancel: string;
    submit: string; // "Send test email"
    sending: string; // "Sending…"
  };

  metadata: {
    templateId: string;
    currentVersion: string;
    created: string;
    updated: string;
  };

  /** Seed templates shown in the simulated list and editor. */
  templates: TemplatesStageTemplate[];
  /** Seed version-history rows for the editor's Versions tab. */
  versionHistory: TemplatesStageVersion[];
}

/* ─── Creative section copy ─────────────────────────────────────────────── */

/* 1. Template anatomy — annotated breakdown of subject + HTML body + variables */

export interface TemplateAnatomyFieldCopy {
  field: string; // "Subject line" / "HTML body" / "Plain text" / "Variables"
  label: string;
  desc: string;
  icon: "subject" | "html" | "text" | "variables" | "slug" | "version";
  /** Example raw value with {{var}} placeholders — LTR token */
  value: string;
}

export interface TemplateAnatomyCopy {
  heading: string;
  subheading: string;
  annotationsTitle: string;
  annotations: TemplateAnatomyFieldCopy[];
}

/* 2. Variable substitution playground — before/after {{variable}} replacement */

export interface VariableSubstitutionRowCopy {
  /** Variable name — LTR token */
  variable: string;
  /** Example value — LTR token */
  value: string;
  /** Source: built-in (always available) or per-send (caller provides) */
  source: "builtin" | "per-send";
}

export interface VariableSubstitutionPlaygroundCopy {
  heading: string;
  subheading: string;
  beforeTitle: string; // "Template (raw)"
  afterTitle: string; // "Rendered (with values)"
  beforeLabel: string; // "subject + html"
  afterLabel: string;
  variablesTitle: string;
  variables: VariableSubstitutionRowCopy[];
  /** Raw subject with {{var}} placeholders — LTR token */
  rawSubject: string;
  /** Raw HTML body with {{var}} placeholders — LTR token */
  rawHtml: string;
  /** Rendered subject — LTR token */
  renderedSubject: string;
  /** Rendered HTML body — LTR token */
  renderedHtml: string;
  caption: string;
}

/* 3. Version history explanation */

export interface VersionHistoryStepCopy {
  badge: string; // "01", "02", ...
  title: string;
  body: string;
  /** Optional LTR token (e.g. "v1", "v2", "PATCH", "version_created") */
  token?: string;
  /** Tone: ui = neutral, state = transition, downstream = side effect */
  tone: "ui" | "state" | "downstream";
}

export interface VersionHistoryCopy {
  heading: string;
  subheading: string;
  legendTitle: string;
  legendItems: { label: string; tone: "ui" | "state" | "downstream" }[];
  steps: VersionHistoryStepCopy[];
  footnote: string;
}

/* 4. Safe test-send mental model */

export interface SafeTestSendCopy {
  heading: string;
  subheading: string;
  previewCard: {
    badge: string; // "Free"
    title: string; // "Preview"
    body: string;
    icon: "preview";
  };
  testSendCard: {
    badge: string; // "Real send"
    title: string; // "Send test email"
    body: string;
    icon: "send";
  };
  /** Side-by-side comparison rows */
  comparison: {
    dimension: string; // "Quota cost"
    previewValue: string; // "0 emails"
    testSendValue: string; // "1 email (MESSAGING_EMAILS)"
  }[];
  warningTitle: string;
  warningBody: string;
}

export interface TemplatesCreativeCopy {
  anatomy: TemplateAnatomyCopy;
  variableSubstitution: VariableSubstitutionPlaygroundCopy;
  versionHistory: VersionHistoryCopy;
  safeTestSend: SafeTestSendCopy;
}

/* ─── Combined guide content type ───────────────────────────────────────── */

export type TemplatesGuideContent = GuideContentBase & {
  stage: TemplatesStageCopy;
  creative: TemplatesCreativeCopy;
};
