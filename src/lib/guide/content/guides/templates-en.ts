/**
 * UX-B: Templates guide — English content dictionary.
 *
 * AUDIT-GRADE FACTUAL ACCURACY (verified against source):
 *   Every statement here was verified against:
 *     - src/app/dashboard/templates/page.tsx          (the real Templates list UI)
 *     - src/app/dashboard/templates/[id]/page.tsx    (the real Template editor UI)
 *     - Audit findings in /home/z/my-project/worklog.md (Task ID: audit-dashboard-pages)
 *
 * Specifically:
 *   - The Templates list page has a header (ghost "Back to Dashboard" button
 *     + emerald FileText icon + h1 "Templates" + subtitle "Reusable
 *     transactional email templates. Versioned, sanitized, preview-only." +
 *     emerald "Create Template" button with Plus icon).
 *   - A max-w-sm Search Input with Search icon at left and a "{n} templates"
 *     counter (singular/plural) on the right.
 *   - The table has six columns: Name (FileText emerald tile + name +
 *     description line-clamped), Slug (hidden md+, mono <code>), Version
 *     (emerald outline Badge "v{n}"), Variables (hidden lg+ — currently
 *     always "—" with a Variable icon), Updated (hidden md+, relative
 *     time), Actions (right-aligned DropdownMenu with Pencil "Edit" + rose
 *     Trash2 "Delete").
 *   - Row click navigates to /dashboard/templates/{id}.
 *   - Empty state: dashed Card with FileText circle + "No templates yet" +
 *     description + emerald "Create Template" button.
 *   - Create dialog (max-w-2xl, scrollable): name + slug (auto-derived,
 *     mono, can be overridden) + description (optional) + subject (with
 *     {{variable}} help) + HTML body (mono, 8 rows, placeholder shows
 *     {{first_name}}/{{code}}) + plain text (optional, mono). Cancel +
 *     emerald "Create" submit. On success: toast + push to
 *     /dashboard/templates/{id}.
 *   - The editor page header has: ghost "← Templates" back button + emerald
 *     FileText icon + template name (truncate) + emerald outline "v{n}"
 *     Badge. Right side: emerald "Save" (Save icon) + rose outline "Delete"
 *     (Trash2 icon).
 *   - The editor's body is a 2-column grid (lg:grid-cols-2):
 *       Left  — Tabs (Editor | Versions ({count})). Editor tab has Card
 *               "Content" with Name input, Slug input (immutable, amber
 *               "immutable" badge with Lock icon, disabled), Description
 *               textarea, Separator, Subject input (with {{var}} help),
 *               HTML body textarea (mono, 10 rows, sanitization note),
 *               plain text textarea (mono, 5 rows), dirty-state hint +
 *               Revert (RotateCcw) + Save buttons. Versions tab has Card
 *               "Version history" with each version as a clickable row:
 *               v{n} Badge + subject + "{relativeTime} · {n} vars" (Clock +
 *               Variable icons) + current Badge + Eye/EyeOff. Selected row
 *               expands to show subject box + iframe preview, with an
 *               amber "read-only historical version" badge with Lock icon.
 *       Right — Live preview Card (Eye emerald icon) with Required
 *               variables panel (count + Inputs per {{var}}), emerald
 *               "Preview" button (free), emerald-outline "Send test email"
 *               button (REAL send), caption "Preview is free. Sending
 *               delivers a real email.", missing-vars amber alert (with
 *               {{var}} badges), preview output (subject box + iframe
 *               sandbox="allow-same-origin" srcDoc=html h-[420px]).
 *               Metadata Card: Template ID, Current version, Created,
 *               Updated.
 *   - Test send dialog (max-w-md): Send emerald icon + "Send test email"
 *     title + description. Amber Alert warning "⚠️ This sends a REAL email
 *     and consumes your messaging quota. Preview is free — use it first."
 *     Recipient email Input. Variables list (shared with preview, missing
 *     highlighted rose). Cancel + destructive "Send test email" button
 *     (Loader2 spinner while sending).
 *
 *   - Variable substitution: the template's {{var}} placeholders in subject
 *     + html + text are replaced server-side by the values the caller
 *     provides. Missing required variables return 400 with code =
 *     "missing_template_variables" + a `missing` array.
 *
 *   - Real API endpoints (NOT called from the stage — for teaching only):
 *       GET    /api/dashboard/templates?page=1&pageSize=20&search=...
 *       POST   /api/dashboard/templates              (create)
 *       GET    /api/dashboard/templates/{id}        (detail with current + versions)
 *       PATCH  /api/dashboard/templates/{id}        (only dirty fields; bumps version if content changed)
 *       DELETE /api/dashboard/templates/{id}        (permanent)
 *       POST   /api/dashboard/templates/preview     (free preview)
 *       POST   /api/dashboard/templates/{id}/test-send  (REAL send — 201 / 400 / 402 / 403 / 404 / 409 / 502)
 *       GET    /api/dashboard/templates/{id}/versions/{n}  (historical version detail)
 *
 *   - Auth / entitlement:
 *       401 → router.push("/auth")
 *       403 (list) → entitled=false screen ("Not available" + "View Plans" button)
 *       403 (editor) → toast + router.push("/dashboard/templates")
 *
 * Technical tokens (template slugs, variable names like email/name, version
 * numbers v1/v2/v3, ISO timestamps, HTTP method names, {{var}} placeholders,
 * sanitization hints, email addresses) are stored as raw strings here and
 * wrapped with <Ltr> at render time. The stage reads `dir` from the copy
 * (ltr for en, rtl for fa) and is NOT permanently dir="ltr".
 *
 * This dictionary also contains:
 *   - stage: human-facing copy for the simulated TemplatesStage product UI.
 *   - creative: copy for the four creative sections (template anatomy,
 *     variable substitution playground, version history, safe test-send
 *     mental model).
 */

import type { TemplatesGuideContent } from "./templates-types";

export const templatesEn: TemplatesGuideContent = {
  slug: "templates",
  category: "messaging",
  dashboardRoute: "/dashboard/templates",
  title: "Templates",
  description:
    "Create reusable transactional email templates with HTML, variables, versioning, and a free live preview. Send real test emails against your messaging quota.",
  routeKey: "templates",
  backHref: "/dashboard/templates",
  stepCount: 6,
  durationMin: 5,
  chapters: [
    {
      id: "intro",
      title: "Templates",
      steps: [
        {
          id: "templatesList",
          caption:
            "The Templates list page is the hub for every reusable transactional email you'll send. The header has a FileText icon, the h1 \"Templates\", and a subtitle reminding you these are versioned, sanitized, and preview-only. The emerald \"Create Template\" button in the top-right opens the create dialog. The table below lists each template with its name, slug, version, and last-updated time.",
          duration: 7500,
          scene: "templatesList",
        },
        {
          id: "createTemplate",
          caption:
            "Click \"Create Template\" to open the create dialog (max-w-2xl, scrollable). Fill in a name — the slug auto-derives from it (lowercase, hyphenated; override by typing in the slug field). Add a subject (with {{variable}} placeholders), an HTML body (mono, 8 rows), and an optional plain-text fallback. On submit, the backend creates the template and you're pushed to /dashboard/templates/{id}.",
          duration: 7500,
          scene: "createTemplate",
        },
        {
          id: "editorView",
          caption:
            "The editor page is a 2-column grid. The left column has Tabs (\"Editor\" and \"Versions ({count})\"). The Editor tab is a Card titled \"Content\" with Name, Slug (immutable — amber \"immutable\" badge, disabled), Description, Subject (with {{variable}} help), HTML body (mono, 10 rows, sanitization note), and plain text. Edit freely; the dirty-state hint reads \"Unsaved changes\" and the Revert + Save buttons light up.",
          duration: 7500,
          scene: "editorView",
        },
        {
          id: "variables",
          caption:
            "The right column is the \"Live preview\" Card. The Required variables panel lists every {{var}} the current version references — fill in each one (or leave blank and the backend will tell you which are missing). Below is the emerald \"Preview\" button (free) and the emerald-outline \"Send test email\" button (REAL send). The caption reads \"Preview is free. Sending delivers a real email.\" — the boundary between the two is intentional.",
          duration: 7500,
          scene: "variables",
        },
        {
          id: "preview",
          caption:
            "Click \"Preview\" to render the template against the values you entered. The output appears below: a small subject box and a sandboxed iframe (sandbox=\"allow-same-origin\", srcDoc=html, h-[420px]) showing the rendered email. If any required variable is empty, the backend returns 400 with code = \"missing_template_variables\" and the panel shows an amber alert listing the missing {{var}} badges.",
          duration: 7500,
          scene: "preview",
        },
        {
          id: "testSend",
          caption:
            "Click \"Send test email\" to open the dialog. The amber warning is unmissable: \"⚠️ This sends a REAL email and consumes your messaging quota. Preview is free — use it first.\" Enter the recipient, confirm variables, and click the destructive button. The backend delivers through the active provider and returns 201 with a message_id — or surfaces a specific error code (402 quota_exhausted, 502 delivery_failed, 400 missing_template_variables, 403 feature_not_available).",
          duration: 7500,
          scene: "testSend",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "Open the Templates list",
      body: "From the dashboard sidebar, click Templates. The page header shows a FileText icon, the h1 \"Templates\", and the subtitle \"Reusable transactional email templates. Versioned, sanitized, preview-only.\". The emerald \"Create Template\" button sits in the top-right. Below the header is a Search input (max-w-sm) with a \"{n} templates\" counter on the right, then the table: Name, Slug, Version, Variables, Updated, Actions.",
    },
    {
      title: "Create a new template",
      body: "Click \"Create Template\" to open the create dialog. Enter a name (e.g. \"Welcome email\"); the slug auto-derives from it (e.g. \"welcome-email\") — override by typing in the slug field. Add a subject like \"Welcome to {{app_name}}, {{first_name}}!\". Paste your HTML body (mono, 8 rows). Optionally add a plain-text fallback. Click \"Create\" — the backend returns the new template ID and you're pushed to /dashboard/templates/{id}.",
    },
    {
      title: "Edit the template (Editor tab)",
      body: "In the editor, the Editor tab is a Card titled \"Content\". Edit Name, Description, Subject, HTML body, and plain text freely. The Slug field is immutable — it has an amber \"immutable\" badge with a Lock icon and is disabled (the slug is your API identifier; renaming would break upstream callers). The dirty-state hint reads \"Unsaved changes\"; the Revert button (RotateCcw) restores the last-saved state, and the emerald Save button persists your edits.",
    },
    {
      title: "Inspect version history (Versions tab)",
      body: "Click the \"Versions ({count})\" tab to see every saved version. Each row shows a v{n} Badge, the subject, \"{relativeTime} · {n} vars\" with Clock + Variable icons, and a \"current\" Badge on the live version. Click a row to expand a read-only panel with an amber \"read-only historical version\" badge (Lock icon), the subject box, and a sandboxed iframe preview of that version's HTML. Historical versions cannot be edited — only the current version can.",
    },
    {
      title: "Preview with variables",
      body: "Switch back to the Editor tab. The right column's \"Live preview\" Card lists every Required variable the current version references — fill in each Input. Click the emerald \"Preview\" button (Eye icon). The backend POSTs to /api/dashboard/templates/preview with your variables; the response is rendered as a subject box + sandboxed iframe below the button. This call is FREE — it doesn't consume quota or send any email.",
    },
    {
      title: "Send a real test email",
      body: "Once preview looks right, click the emerald-outline \"Send test email\" button (Send icon). The dialog opens with an amber warning: \"⚠️ This sends a REAL email and consumes your messaging quota. Preview is free — use it first.\" Enter the recipient address, confirm variables are filled in (missing ones highlight rose), and click the destructive \"Send test email\" button. On 201, a toast surfaces the message_id. Check the recipient's inbox (and Sent Emails) — a real message was delivered.",
    },
  ],
  whyWhen: [
    {
      title: "When to create a template",
      body: "Whenever you'll send the same email body more than once — a welcome email, an OTP code email, a password-reset email, a receipt — make it a template. Templates are versioned (every content edit bumps the version and the old one is preserved read-only), sanitized (HTML is run through a sanitizer that strips dangerous tags/attributes), and preview-only by default (no quota is consumed until you explicitly send). Building them once means your dashboard, automations, and API all reference the same source of truth.",
    },
    {
      title: "Why a slug is immutable",
      body: "The slug is your API identifier — your code (or automation config) references templates by slug, not by ID. Renaming the slug mid-stream would break every upstream caller silently. So once a template is created, the slug is locked: the Slug field is disabled, has an amber \"immutable\" badge with a Lock icon, and PATCH will refuse to change it. If you need a different slug, delete the template and recreate it (or accept the original slug).",
    },
    {
      title: "Why preview is free but test-send consumes quota",
      body: "Preview POSTs to /api/dashboard/templates/preview with your variables; the backend renders the template into HTML+text and returns it — but never hands it to the provider. No message is sent, no quota is consumed, no sent_emails row is written. Test-send POSTs to /api/dashboard/templates/{id}/test-send with a recipient address; the backend renders identically, then dispatches through the active provider (SMTP/Postmark/…). A real email lands in the recipient's inbox, a sent_emails row is written, and one unit of your MESSAGING_EMAILS quota is consumed. That's why the dialog's amber warning reads \"⚠️ This sends a REAL email and consumes your messaging quota. Preview is free — use it first.\".",
    },
  ],
  mistakes: [
    {
      title: "Editing a template and forgetting to Save",
      body: "The Editor tab does NOT auto-save (unlike the Automations page). Every edit is local until you click the emerald \"Save\" button. The dirty-state hint at the bottom of the Card cycles between \"All changes saved.\" and \"Unsaved changes\" — watch that line. If you navigate away with unsaved changes, they're lost (the page doesn't prompt). Click \"Revert\" (RotateCcw) to discard and reload the last-saved state.",
    },
    {
      title: "Clicking Send test email before Preview",
      body: "The dialog explicitly warns \"Preview is free — use it first.\". If you skip preview and click Send test email with missing variables, the backend returns 400 with code = \"missing_template_variables\" — your test send is rejected, no email is sent, but you've wasted a round-trip. Worse: if the variables ARE all filled but the rendering is broken (HTML typo, wrong {{var}} name), you'll deliver a broken email to a real inbox and consume quota. Always Preview first.",
    },
    {
      title: "Expecting the Variables column to show counts",
      body: "The list page's \"Variables\" column currently always shows \"—\" with a Variable icon — it's a placeholder. The actual variable list (the {{var}} names the current version references) is only surfaced in the editor's \"Live preview\" Card under \"Required variables\". If you need to know which templates use {{email}} or {{code}}, open each template's editor — there's no list-level variable filter today.",
    },
    {
      title: "Trying to edit a historical version",
      body: "Click a row in the Versions tab to expand its read-only panel. The panel has an amber \"read-only historical version\" badge with a Lock icon and the note \"Historical versions cannot be edited.\". You cannot restore or modify a previous version — only the current version is editable. If you need an old subject line back, copy it from the read-only panel and paste it into the Editor tab, then Save (which creates a NEW version that mirrors the old content).",
    },
    {
      title: "Hardcoding recipient-specific values in the HTML",
      body: "Templates are reusable — don't hardcode a recipient's name or email in the HTML body. Use {{var}} placeholders ({{first_name}}, {{email}}, {{code}}, etc.) and let the caller provide values per-send. Hardcoded values mean the template only works for one recipient, defeating the purpose. The backend's variable substitution is a simple string replace — there's no conditional logic, no loops, no partials. Keep it dumb.",
    },
  ],
  proTips: [
    {
      title: "Auto-derive the slug, then leave it alone",
      body: "Type a friendly name (\"Welcome email\") and let the slug field auto-derive (\"welcome-email\"). The derive function lowercases, trims, replaces non-[a-z0-9]+ with hyphens, and strips leading/trailing hyphens. Once you've created the template, treat the slug as immutable — your API clients and automation config will reference it by that string. If you must change the slug, delete and recreate (and update every caller).",
    },
    {
      title: "Use the Versions tab as your undo history",
      body: "Every Save that changes subject/html/text bumps current_version and writes a new immutable row in the Versions tab. If your latest edit breaks rendering, open the Versions tab, click the previous version, and read its subject + iframe preview — you can't restore it, but you CAN copy the HTML back into the Editor tab and Save to recreate the previous state as a new version. The tab is your safety net.",
    },
    {
      title: "Keep the variable surface small and predictable",
      body: "The fewer {{var}} placeholders a template has, the fewer places a caller can forget to fill one in. Design templates around 2–4 variables max — typically {{email}}, {{name}} (or {{first_name}}), and one domain value ({{code}}, {{reset_link}}, {{order_id}}). If you find yourself adding a 6th variable, split the template or move the dynamic content into the body's HTML and accept a slightly less personalized result.",
    },
    {
      title: "Treat Preview as your staging environment",
      body: "Before every Send test email, run Preview with realistic values (a real-looking email, a plausible name, a real OTP). The iframe shows you exactly what the recipient will see — broken layouts, unstyled tags, escaped placeholders (a literal {{first_name}} in the output means you misspelled the variable). Preview is free and unlimited — there's no reason to skip it.",
    },
  ],
  troubleshooting: [
    {
      title: "List page shows \"Templates are not available on your current account\"",
      body: "The GET returned 403 — your plan doesn't include the MESSAGING_EMAILS entitlement. The list page renders a centered FileText icon in a muted circle, the heading \"Templates are not available on your current account\", the description explaining transactional messaging is part of a feature pack, and a \"View Plans\" button linking to /pricing. Upgrade and refresh — your existing templates are preserved.",
    },
    {
      title: "Create dialog says \"Failed to create template\"",
      body: "The POST returned non-2xx. The most common causes: 400 (validation_failed — name/slug/subject/html is empty or invalid; slug has bad characters; subject > 200 chars), 409 (a template with that slug already exists — change the slug), 403 (no entitlement). The toast surfaces the error message from the response body; the dialog stays open so you can fix and retry.",
    },
    {
      title: "Preview shows \"Missing variables\" amber alert",
      body: "You clicked Preview with one or more Required variables left empty. The backend returns 400 with code = \"missing_template_variables\" and a `missing` array. The panel renders an amber alert with an AlertCircle icon, the title \"Missing variables\", the description \"Fill in values for the following before previewing:\", and amber {{var}} badges for each missing variable. Fill them in and click Preview again — no quota was consumed.",
    },
    {
      title: "Send test email returns \"Quota exceeded\"",
      body: "The POST returned 402 with code = \"quota_exhausted\" (or \"rate_limited\"). Your MESSAGING_EMAILS quota is exhausted (or you've hit the per-minute rate limit). The toast surfaces the message. Check your plan's quota in /pricing or the dashboard's quota widget; wait for the next reset window or upgrade. The dialog stays open; no email was sent.",
    },
    {
      title: "Send test email returns \"delivery_failed\" (502)",
      body: "The provider rejected the email. The 502 response has code = \"delivery_failed\" and possibly error_code = \"configuration_error\" (SMTP config issue). Check your Branding/DNS settings (SPF/DKIM/DMARC), verify the recipient address is valid, and confirm the active provider is healthy. The toast description appends \"(SMTP config issue)\" when the backend flags a configuration error. The dialog stays open; no email was delivered but the quota MAY have been consumed (depends on provider behavior).",
    },
    {
      title: "Editor's iframe preview is blank",
      body: "The iframe uses sandbox=\"allow-same-origin\" (no allow-scripts) — it renders HTML but won't execute JS. If your template's HTML relies on JavaScript to render content (e.g. a <script> that injects the OTP), it'll be blank in preview AND in the recipient's inbox (most providers strip <script> anyway). Make your template self-contained HTML with {{var}} placeholders only — no JS, no external resources, no iframes inside iframes.",
    },
  ],
  checklist: [
    { label: "Open the Templates list (Dashboard → Templates)" },
    { label: "Click \"Create Template\", fill in name + subject + HTML body" },
    { label: "Confirm the slug auto-derived (or override) and click Create" },
    { label: "In the editor, fill in Required variables in the Live preview panel" },
    { label: "Click emerald \"Preview\" and verify the rendered output (free)" },
    { label: "Only then click \"Send test email\" and confirm the 201 toast" },
  ],
  whatNext:
    "Once your template renders correctly in Preview and you've delivered a real test email, wire it into production: reference it by slug from your API client (POST /api/v1/messages/send with template_slug + variables), or attach it to the Welcome Email automation in /dashboard/automations. Every send will be logged in /dashboard/emails with its delivery status — if a recipient's inbox bounces or complains, the contact will be auto-suppressed and you'll see it in /dashboard/suppressions.",
  related: [
    {
      label: "Open Templates in the dashboard",
      href: "/dashboard/templates",
    },
    {
      label: "Wire the Welcome Email automation",
      href: "/dashboard/automations",
    },
    {
      label: "View sent emails (delivery log)",
      href: "/dashboard/emails",
    },
  ],

  /* ─── Stage copy (simulated Templates page, English) ──────────────────── */
  stage: {
    dir: "ltr",
    locale: "en",

    listHeader: {
      title: "Templates",
      backToDashboard: "Back to Dashboard",
      subtitle:
        "Reusable transactional email templates. Versioned, sanitized, preview-only.",
      create: "Create Template",
    },

    search: {
      placeholder: "Search templates…",
      count: (n) => `${n} ${n === 1 ? "template" : "templates"}`,
    },

    table: {
      name: "Name",
      slug: "Slug",
      version: "Version",
      variables: "Variables",
      updated: "Updated",
      actions: "Actions",
      actionsEdit: "Edit",
      actionsDelete: "Delete",
      empty: "No templates yet",
      emptyDescription:
        "Create a reusable transactional email template with versioned, sanitized HTML content.",
      emptyCreate: "Create Template",
      notAvailable: "Templates are not available on your current account",
      notAvailableDescription:
        "Transactional messaging is part of the Messaging feature pack.",
      notAvailableCta: "View Plans",
      pageOf: (page, total) => `Page ${page} of ${total}`,
      prev: "Prev",
      next: "Next",
    },

    createDialog: {
      title: "Create template",
      description:
        "Templates are versioned. Each content edit creates a new immutable version.",
      nameLabel: "Name",
      slugLabel: "Slug",
      slugHelp:
        "Lowercase, hyphenated. Used as the API identifier — once created, the slug is immutable.",
      descriptionOptional: "Description (optional)",
      subjectLabel: "Subject",
      subjectHelp: "Use {{variable}} placeholders — they're substituted at send time.",
      htmlLabel: "HTML body",
      textLabel: "Plain text (optional)",
      cancel: "Cancel",
      submit: "Create",
      creating: "Creating…",
    },

    editorHeader: {
      backToTemplates: "Templates",
      save: "Save",
      saving: "Saving…",
      delete: "Delete",
    },

    editorTabs: {
      editor: "Editor",
      versions: (count) => `Versions (${count})`,
    },

    editorForm: {
      contentTitle: "Content",
      nameLabel: "Name",
      slugLabel: "Slug",
      immutableBadge: "immutable",
      slugFixed: "The slug is your API identifier and cannot be changed after creation.",
      descriptionLabel: "Description",
      subjectLabel: "Subject",
      subjectHelp: "{{variable}} placeholders are substituted at send time.",
      htmlLabel: "HTML body",
      htmlHelp:
        "HTML is sanitized on save. Scripts, event handlers, and dangerous tags are stripped.",
      textLabel: "Plain text (optional)",
      textPlaceholder: "Plain text fallback for clients that don't render HTML.",
      unsavedChanges: "Unsaved changes",
      allChangesSaved: "All changes saved.",
      revert: "Revert",
      save: "Save",
      saving: "Saving…",
    },

    versions: {
      historyTitle: "Version history",
      noVersions: "No versions recorded yet.",
      noSubject: "(no subject)",
      varsSuffix: (n) => `${n} var${n === 1 ? "" : "s"}`,
      current: "current",
      readOnlyBadge: "read-only historical version",
      historicalCantEdit: "Historical versions cannot be edited.",
      loadFailed: "Failed to load version.",
    },

    preview: {
      title: "Live preview",
      requiredVars: "Required variables",
      requiredVarsCount: (n) => `${n} var${n === 1 ? "" : "s"}`,
      noVars: "This template has no variables. Click Preview to render it.",
      placeholderValue: (name) => `value for ${name}`,
      previewButton: "Preview",
      rendering: "Rendering…",
      testSendButton: "Send test email",
      caption: "Preview is free. Sending delivers a real email.",
      renderedSubject: "Rendered subject",
      renderedHtml: "Rendered HTML",
      fillInPrompt:
        "Fill in the variables and click Preview to render the email.",
      missingVarsTitle: "Missing variables",
      missingVarsDesc: "Fill in values for the following before previewing:",
      requiredHint: "— required",
    },

    testSend: {
      title: "Send test email",
      description:
        "Deliver this template to a real inbox using the current version and the preview variables you entered.",
      warning:
        "⚠️ This sends a REAL email and consumes your messaging quota. Preview is free — use it first.",
      recipientLabel: "Recipient email",
      recipientPlaceholder: "me@example.com",
      recipientHelp: "The email will be delivered to this address.",
      varsLabel: (n) => `Variables (${n})`,
      missingSuffix: (n) => `${n} missing`,
      noVars: "This template has no variables.",
      cancel: "Cancel",
      submit: "Send test email",
      sending: "Sending…",
    },

    metadata: {
      templateId: "Template ID",
      currentVersion: "Current version",
      created: "Created",
      updated: "Updated",
    },

    templates: [
      {
        id: 1,
        name: "Welcome email",
        slug: "welcome-email",
        description: "Sent when a contact verifies their OTP.",
        currentVersion: 3,
        variables: ["email", "name"],
        subject: "Welcome to Nixify, {{name}}!",
        html:
          "<div style=\"font-family:system-ui\"><h1>Welcome, {{name}}!</h1><p>Your email <strong>{{email}}</strong> is verified.</p><p>— The Nixify team</p></div>",
        text: "Welcome, {{name}}! Your email {{email}} is verified. — The Nixify team",
        updatedAtRelative: "2 hours ago",
      },
      {
        id: 2,
        name: "OTP verification",
        slug: "otp-verification",
        description: "One-time-password delivery template.",
        currentVersion: 5,
        variables: ["email", "code"],
        subject: "Your Nixify verification code is {{code}}",
        html:
          "<div style=\"font-family:system-ui;text-align:center\"><h2>Your code</h2><p style=\"font-size:32px;letter-spacing:6px;font-weight:bold\">{{code}}</p><p>Expires in 10 minutes. Don't share it.</p></div>",
        text: "Your Nixify verification code is {{code}}. Expires in 10 minutes.",
        updatedAtRelative: "yesterday",
      },
      {
        id: 3,
        name: "Password reset",
        slug: "password-reset",
        description: "Password reset link delivery.",
        currentVersion: 2,
        variables: ["email", "reset_link"],
        subject: "Reset your Nixify password",
        html:
          "<div style=\"font-family:system-ui\"><p>We received a password reset request for <strong>{{email}}</strong>.</p><p><a href=\"{{reset_link}}\">Reset your password</a></p><p>Link expires in 1 hour.</p></div>",
        text: "Reset your password: {{reset_link}} — expires in 1 hour.",
        updatedAtRelative: "3 days ago",
      },
    ],

    versionHistory: [
      {
        version: 3,
        subject: "Welcome to Nixify, {{name}}!",
        variables: ["email", "name"],
        createdAtRelative: "2 hours ago",
        isCurrent: true,
      },
      {
        version: 2,
        subject: "Welcome to Nixify!",
        variables: ["email"],
        createdAtRelative: "5 days ago",
        isCurrent: false,
      },
      {
        version: 1,
        subject: "Welcome",
        variables: ["email"],
        createdAtRelative: "2 weeks ago",
        isCurrent: false,
      },
    ],
  },

  /* ─── Creative-section copy (English) ──────────────────────────────────── */
  creative: {
    anatomy: {
      heading: "Template anatomy",
      subheading:
        "Every Nixify template is four parts: a slug (immutable identifier), a subject line, an HTML body, and a plain-text fallback. Variables flow through all three. Knowing which part does what prevents the most common template mistakes.",
      annotationsTitle: "Anatomy of the Welcome email template",
      annotations: [
        {
          field: "Slug",
          label: "welcome-email",
          desc:
            "Lowercase, hyphenated, immutable after creation. Used as the API identifier — your code references templates by slug, not by ID.",
          icon: "slug",
          value: "welcome-email",
        },
        {
          field: "Subject",
          label: "Welcome to Nixify, {{name}}!",
          desc:
            "Single line shown in the recipient's inbox preview. {{variable}} placeholders are substituted at send time. Keep it short and personal.",
          icon: "subject",
          value: "Welcome to Nixify, {{name}}!",
        },
        {
          field: "HTML body",
          label: "<h1>Welcome, {{name}}!</h1>…",
          desc:
            "Full HTML rendered in the recipient's email client. Sanitized on save (scripts, event handlers, and dangerous tags stripped). Use inline styles — most clients ignore <style> blocks.",
          icon: "html",
          value: "<h1>Welcome, {{name}}!</h1><p>Your email <strong>{{email}}</strong> is verified.</p>",
        },
        {
          field: "Plain text",
          label: "Welcome, {{name}}! …",
          desc:
            "Optional fallback for clients that don't render HTML (rare today, but some spam filters penalize HTML-only emails). Same variables, same substitution.",
          icon: "text",
          value: "Welcome, {{name}}! Your email {{email}} is verified.",
        },
        {
          field: "Variables",
          label: "{{email}}, {{name}}",
          desc:
            "Surfaced in the editor's Required variables panel. The caller provides values per-send; missing ones return 400 with code = missing_template_variables.",
          icon: "variables",
          value: "{{email}}, {{name}}",
        },
        {
          field: "Version",
          label: "v3 (current)",
          desc:
            "Bumped every time subject/html/text changes. Previous versions are read-only — you can't restore them, only copy from them into a new version.",
          icon: "version",
          value: "v3",
        },
      ],
    },

    variableSubstitution: {
      heading: "Variable substitution playground",
      subheading:
        "Variables are a simple string replace — no conditionals, no loops, no escaping. The backend takes the template's subject/html/text, finds every {{var}} placeholder, and swaps in the value the caller provided. Here's the Welcome template before and after substitution.",
      beforeTitle: "Template (raw)",
      afterTitle: "Rendered (with values)",
      beforeLabel: "subject + html",
      afterLabel: "subject + html",
      variablesTitle: "Values used",
      variables: [
        { variable: "email", value: "sara@example.com", source: "builtin" },
        { variable: "name", value: "Sara", source: "per-send" },
      ],
      rawSubject: "Welcome to Nixify, {{name}}!",
      rawHtml:
        "<h1>Welcome, {{name}}!</h1><p>Your email <strong>{{email}}</strong> is verified.</p>",
      renderedSubject: "Welcome to Nixify, Sara!",
      renderedHtml:
        "<h1>Welcome, Sara!</h1><p>Your email <strong>sara@example.com</strong> is verified.</p>",
      caption:
        "Notice: the literal {{name}} and {{email}} tokens are gone in the rendered output — they've been replaced with the values. If the caller had left name empty, the backend would return 400 with code = missing_template_variables.",
    },

    versionHistory: {
      heading: "Version history, explained",
      subheading:
        "Every Save that changes subject, html, or text creates a new immutable version. The Versions tab is your audit trail — you can read any past version but you can never restore or edit one.",
      legendTitle: "Legend",
      legendItems: [
        { label: "UI step — what you do in the editor", tone: "ui" },
        { label: "State transition — a version row is created", tone: "state" },
        { label: "Downstream effect — callers see the new version", tone: "downstream" },
      ],
      steps: [
        {
          badge: "01",
          title: "Edit the subject line",
          body:
            "In the Editor tab, change the subject from \"Welcome to Nixify!\" to \"Welcome to Nixify, {{name}}!\". The dirty-state hint reads \"Unsaved changes\" — Save is enabled, Revert is enabled.",
          tone: "ui",
        },
        {
          badge: "02",
          title: "Click Save",
          body:
            "PATCH /api/dashboard/templates/{id} is sent with only the changed fields ({ subject }). The backend detects the content change and writes a new immutable version row.",
          tone: "state",
          token: "PATCH /api/dashboard/templates/{id}",
        },
        {
          badge: "03",
          title: "Version is bumped",
          body:
            "current_version goes from 2 to 3. The response includes version_created: true and the new current object. The toast reads \"New version saved.\" with the description \"Content changed — a new immutable version was saved.\".",
          tone: "state",
          token: "version_created = true",
        },
        {
          badge: "04",
          title: "Old version is preserved",
          body:
            "v2 (subject \"Welcome to Nixify!\") remains in the Versions tab, now marked read-only. Clicking it shows an amber \"read-only historical version\" badge with a Lock icon and the rendered iframe.",
          tone: "state",
          token: "v2 (read-only)",
        },
        {
          badge: "05",
          title: "Callers see v3 immediately",
          body:
            "Every API call, automation fire, and Send test email that references the template now uses v3. There's no \"publish\" step — saving IS publishing. Your in-flight automations pick up the new version on the next fire.",
          tone: "downstream",
          token: "v3 (current)",
        },
        {
          badge: "06",
          title: "Restore-via-copy (manual)",
          body:
            "If v3 is wrong, open v2 in the Versions tab, copy its subject + HTML back into the Editor tab, and Save. That creates v4 — a NEW version that mirrors v2's content. You cannot revert to v2 in place; you can only recreate it.",
          tone: "ui",
          token: "v4 (recreated)",
        },
      ],
      footnote:
        "Metadata-only changes (name, description) do NOT bump the version. Only content changes (subject, html, text) trigger version_created. That's why editing the description shows a plain \"Saved.\" toast, not the \"New version saved.\" toast.",
    },

    safeTestSend: {
      heading: "Safe test-send mental model",
      subheading:
        "Preview and Send test email are siblings — same input shape, same rendering pipeline — but they diverge at the very last step. Preview stops before the provider; Send test email hands the rendered message to the provider and writes a sent_emails row. Knowing where they diverge is the difference between a free iteration loop and a surprise quota bill.",
      previewCard: {
        badge: "Free",
        title: "Preview",
        body:
          "POST /api/dashboard/templates/preview with your variables. The backend renders the template into HTML+text and returns it — but never hands it to the provider. No message is sent, no quota is consumed, no sent_emails row is written. Use it unlimited times.",
        icon: "preview",
      },
      testSendCard: {
        badge: "Real send",
        title: "Send test email",
        body:
          "POST /api/dashboard/templates/{id}/test-send with a recipient + variables. The backend renders identically, then dispatches through the active provider (SMTP/Postmark/…). A real email lands in the recipient's inbox, a sent_emails row is written, and one unit of MESSAGING_EMAILS quota is consumed.",
        icon: "send",
      },
      comparison: [
        {
          dimension: "Quota cost",
          previewValue: "0 emails (unlimited)",
          testSendValue: "1 email (MESSAGING_EMAILS)",
        },
        {
          dimension: "Provider dispatch",
          previewValue: "No — render only",
          testSendValue: "Yes — SMTP/Postmark/…",
        },
        {
          dimension: "Sent-emails row",
          previewValue: "Not written",
          testSendValue: "Written (with delivery status)",
        },
        {
          dimension: "Recipient inbox",
          previewValue: "Empty",
          testSendValue: "Receives the message",
        },
        {
          dimension: "Failure mode",
          previewValue: "400 missing_template_variables",
          testSendValue: "400 / 402 / 403 / 404 / 409 / 502",
        },
      ],
      warningTitle: "Always Preview first. Always.",
      warningBody:
        "The dialog opens with the amber warning for a reason — Send test email is a real delivery. If you skip Preview, you risk sending a broken email (HTML typo, escaped {{var}}, unstyled layout) to a real inbox AND consuming quota on the failed attempt. Preview is free, unlimited, and shows you exactly what the recipient will see. There's no reason to skip it.",
    },
  },
};
