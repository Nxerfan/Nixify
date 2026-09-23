/**
 * UX-B: Automations guide — English content dictionary.
 *
 * AUDIT-GRADE FACTUAL ACCURACY (verified against source):
 *   Every statement here was verified against:
 *     - src/app/dashboard/automations/page.tsx   (the real Automations UI)
 *     - Audit findings in /home/z/my-project/worklog.md (Task ID: audit-dashboard-pages)
 *
 * Specifically:
 *   - The Automations dashboard is a SINGLE Card titled "OTP Verified →
 *     Welcome Email" with an emerald MailCheck icon tile. There is no rule
 *     builder, no multi-condition editor, no flow chart — only:
 *       Card header: title + description on the left; a bordered box on the
 *         right with an "Enabled" / "Disabled" Label, a "Saving…" or
 *         "Auto-saves" hint, and a Switch toggle (emerald when on).
 *       Status strip below the header: Badge among "Active" (emerald),
 *         "Enabled — no template" (amber), "Enabled — incompatible" (amber),
 *         "Paused" (muted) + "Updated {relativeTime}" on the right.
 *       CardContent (gap-6, pt-6): template selector block, a 2-column grid
 *         of bordered info boxes (Built-in variables / Template required
 *         variables), and a CompatibilityIndicator Alert.
 *       Help footer below the card: "Need a template that only uses
 *         {{email}} and {{name}}?" + emerald "Browse templates →" link.
 *
 *   - Auto-save behavior: optimistic UI. Toggling the Switch fires
 *     handleToggle() → PUT /api/dashboard/automations/otp-verified-welcome
 *     with `{ enabled, templateId? }`. While the PUT is in flight the hint
 *     reads "Saving…"; on success it reverts to "Auto-saves" and a toast
 *     ("Enabled" / "Disabled") fires. Same pattern for the template Select:
 *     optimistic update → PUT → toast ("Template selected" / "Template
 *     cleared").
 *
 *   - The automation type key is the literal string "otp-verified-welcome".
 *     It fires when a contact verifies their OTP via POST /api/auth/verify-email.
 *
 *   - Built-in variables (always provided): {{email}} and {{name}}.
 *
 *   - Compatibility rules: setting.compatible is computed by the backend
 *     based on whether every variable the selected template references is in
 *     builtInVariables. If compatible === false, the CompatibilityIndicator
 *     Alert renders an amber AlertTriangle listing missing variables as
 *     amber badges — and warns "fail at send-time and retry" (if enabled) or
 *     "not fire when enabled" (if disabled).
 *
 *   - Real API endpoints (NOT called from the stage — for teaching only):
 *       GET  /api/dashboard/automations/otp-verified-welcome
 *       PUT  /api/dashboard/automations/otp-verified-welcome
 *            body: { enabled: boolean; templateId?: number | null }
 *       GET  /api/dashboard/templates?pageSize=100   (populates the dropdown)
 *
 *   - Auth / entitlement:
 *       401 → router.push("/auth")
 *       403 → entitled=false screen ("Not available" + "View Plans" button)
 *
 * Technical tokens (automation type, variable names like email/name,
 * template slugs, ISO timestamps, {{var}} placeholders, version strings)
 * are stored as raw strings here and wrapped with <Ltr> at render time.
 * The stage reads `dir` from the copy (ltr for en, rtl for fa) and is NOT
 * permanently dir="ltr".
 *
 * This dictionary also contains:
 *   - stage: human-facing copy for the simulated AutomationsStage product UI.
 *   - creative: copy for the four creative sections (Trigger → Action flow,
 *     "What happens when this fires?" execution story, example event
 *     journey, safe design checklist).
 */

import type { AutomationsGuideContent } from "./automations-types";

export const automationsEn: AutomationsGuideContent = {
  slug: "automations",
  category: "automation",
  dashboardRoute: "/dashboard/automations",
  title: "Automations",
  description:
    "Configure trigger-based email workflows. The Welcome Email automation fires automatically when a contact verifies their OTP.",
  routeKey: "automations",
  backHref: "/dashboard/automations",
  stepCount: 5,
  durationMin: 4,
  chapters: [
    {
      id: "intro",
      title: "Automations",
      steps: [
        {
          id: "automationOverview",
          caption:
            "The Automations page is a single Card titled \"OTP Verified → Welcome Email\". There's no rule builder — just a Switch to enable/disable the automation and a Select to pick which transactional template fires when a contact verifies their OTP. The Card header shows the MailCheck icon and the description; the right side holds the toggle and an \"Auto-saves\" hint.",
          duration: 7000,
          scene: "automationOverview",
        },
        {
          id: "toggleSwitch",
          caption:
            "Toggle the Switch in the top-right of the Card header to enable or disable the automation. The label flips between \"Enabled\" (emerald) and \"Disabled\". While the PUT is in flight, the hint reads \"Saving…\" — once it returns, the hint reverts to \"Auto-saves\" and a toast confirms the new state.",
          duration: 7000,
          scene: "toggleSwitch",
        },
        {
          id: "selectTemplate",
          caption:
            "Pick a Welcome template from the Select below the toggle. The first item is always \"— No template —\"; below the separator, every transactional template you own is listed with its name and slug. Choosing one optimistically sets it and fires a PUT — the row shows a \"Saving…\" spinner until the response lands.",
          duration: 7000,
          scene: "selectTemplate",
        },
        {
          id: "autoSave",
          caption:
            "Auto-save is the page's persistence model — there's no Save button anywhere. Every toggle and every template selection immediately fires a PUT to /api/dashboard/automations/otp-verified-welcome. Optimistic UI shows the new value instantly; if the PUT fails, the value reverts and a toast surfaces the error.",
          duration: 7000,
          scene: "autoSave",
        },
        {
          id: "activeState",
          caption:
            "When the automation is enabled, has a template selected, and the template is compatible (only references {{email}} and {{name}}), the status strip shows an emerald \"Active\" badge with a CheckCircle2 icon. That means: on the next successful OTP verification, Nixify will render and send the welcome email automatically.",
          duration: 7500,
          scene: "activeState",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "Open the Automations page",
      body: "From the dashboard sidebar, click Automations. The page header has a back button, an emerald Zap icon, the h1 \"Automations\", and the subtitle \"Configure automatic email workflows triggered by user events.\". Below it sits a single Card titled \"OTP Verified → Welcome Email\". There is no rule builder on this page — only a Switch and a Select.",
    },
    {
      title: "Enable the Welcome Email automation",
      body: "In the top-right of the Card header is a bordered box containing an \"Enabled\" / \"Disabled\" label, a hint (\"Auto-saves\" or \"Saving…\"), and a Switch. Click the Switch to flip it on. The label turns emerald \"Enabled\" and a toast confirms \"Enabled\" with the description \"Welcome emails will be sent on successful OTP verification.\". The PUT happens immediately — there's no Save button.",
    },
    {
      title: "Pick a Welcome template",
      body: "Below the header, find the \"Welcome template\" Select. Clicking it opens a dropdown whose first item is \"— No template —\", followed by a separator, then every transactional template you own — each shown with its name (bold) and slug (mono). Pick one. The Select collapses, a \"Saving…\" spinner briefly appears, then the row updates to show \"Using template {name} (v{version}).\" with a FileText icon.",
    },
    {
      title: "Verify template compatibility",
      body: "The 2-column grid below the Select shows \"Built-in variables\" (always {{email}} and {{name}} in emerald badges) on the left and \"Template required variables\" on the right. The right card lists every variable the selected template references — emerald with a CheckCircle2 if provided, rose if missing. The CompatibilityIndicator Alert below mirrors this: emerald \"Compatible\" if all vars are provided; amber \"Incompatible\" if any are missing.",
    },
    {
      title: "Confirm the Active state",
      body: "When enabled + has-template + compatible, the status strip below the Card header shows an emerald \"Active\" badge with a CheckCircle2. To the right of the badge is \"Updated {relativeTime}\" (e.g. \"Updated 2 minutes ago\") with a Clock icon. The automation is now live — on the next successful OTP verification, Nixify renders the selected template with {{email}} and {{name}} and sends it.",
    },
  ],
  whyWhen: [
    {
      title: "When the Welcome Email automation fires",
      body: "The automation type is \"otp-verified-welcome\". It fires the moment a contact verifies their OTP via POST /api/auth/verify-email — Nixify then renders the selected welcome template with the built-in variables {{email}} (the verified address) and {{name}} (the contact's name, if known) and sends the email. There's no cron, no manual trigger — it's purely event-driven.",
    },
    {
      title: "Why only one card",
      body: "Nixify's Automations page today exposes a single automation: the OTP-verified welcome email. It's the most common onboarding touchpoint — the user just proved they own their inbox, so it's the perfect moment to greet them. The card is intentionally minimal: a Switch (on/off) + a Select (which template) is all you need to configure it. Future automation types will follow the same shape.",
    },
    {
      title: "Why a template is required to fire",
      body: "The automation can be Enabled without a template — but it won't fire. The status strip will show \"Enabled — no template\" (amber), and the CompatibilityIndicator will show \"No template selected\" (muted). Similarly, if you pick a template that references variables outside {{email}} and {{name}} (e.g. {{order_id}}), the status shows \"Enabled — incompatible\" and the Alert warns the automation \"will fail at send-time and retry\". Always pick a template that only uses the built-in variables.",
    },
  ],
  mistakes: [
    {
      title: "Assuming there's a Save button",
      body: "There isn't. The Automations page auto-saves every change: flipping the Switch, picking a template — each fires an immediate PUT. The hint below the toggle cycles between \"Auto-saves\" (idle) and \"Saving…\" (PUT in flight). If you click away mid-save, the optimistic update will revert on error and a toast will surface the failure.",
    },
    {
      title: "Picking a template that needs variables you don't have",
      body: "The automation can only inject {{email}} and {{name}}. If you pick a template whose body references {{order_id}} or {{reset_link}}, the backend marks it incompatible. The status badge turns amber \"Enabled — incompatible\", and the CompatibilityIndicator Alert lists the missing variables as amber badges. The automation will NOT fire — and if you re-enable it, the next OTP verification will fail at send-time and retry.",
    },
    {
      title: "Leaving the automation Enabled with no template",
      body: "Toggling the Switch on without picking a template is allowed (you won't be blocked), but it puts the page in the \"Enabled — no template\" amber state. No welcome email will be sent on OTP verification. Always pair the toggle with a template selection — both must be set for the emerald \"Active\" state.",
    },
    {
      title: "Expecting the automation to fire immediately on save",
      body: "Toggling on the automation doesn't send a welcome email right now. It arms the rule: the next time a contact verifies their OTP, the welcome email will fire. To test it end-to-end, sign up a new contact, request an OTP, and verify it — then check the Sent Emails page to confirm the welcome email was delivered.",
    },
    {
      title: "Forgetting that templates list comes from /api/dashboard/templates",
      body: "The Select is populated by GET /api/dashboard/templates?pageSize=100. If you've created a new template in the Templates page and it doesn't show up here, refresh the Automations page (the list is fetched once on mount). If the fetch fails entirely, the dropdown shows a muted \"No transactional templates found.\" hint and an emerald \"Create one →\" link to /dashboard/templates.",
    },
  ],
  proTips: [
    {
      title: "Design the welcome template around {{email}} and {{name}} only",
      body: "The automation only injects {{email}} and {{name}} — no other variables. Design your welcome template to use only those two tokens. If you need to greet by first name, use {{name}} and let it fall back to {{email}} when the contact has no name on file. Keep the welcome body short, on-brand, and free of conditional placeholders.",
    },
    {
      title: "Use the CompatibilityIndicator as your pre-flight check",
      body: "Before you walk away, glance at the Alert below the variables grid. Emerald \"Compatible\" = you're good. Amber \"Incompatible\" = the template references a variable the automation can't provide — fix the template or pick a different one. Muted \"No template selected\" = pick one. The badge in the status strip mirrors the Alert so you can spot the state at a glance.",
    },
    {
      title: "Test the round-trip with a real OTP verification",
      body: "After you set enabled + template + compatibility, sign up a fresh contact (an incognito email works), request an OTP, paste it into /verify-email, and submit. Then visit Sent Emails — the welcome email should appear there with its delivery status. This end-to-end test is the only way to confirm the automation is wired correctly.",
    },
  ],
  troubleshooting: [
    {
      title: "The dropdown shows \"No transactional templates found.\"",
      body: "The GET /api/dashboard/templates?pageSize=100 returned an empty list (or 403). Either you haven't created any templates yet, or your plan doesn't include the MESSAGING_EMAILS entitlement. The hint below the Select reads \"You don't have any transactional templates yet.\" with an emerald \"Create one →\" link — click it to open /dashboard/templates and create one.",
    },
    {
      title: "Status badge reads \"Enabled — incompatible template\"",
      body: "The selected template references a variable the automation can't provide. The amber CompatibilityIndicator Alert lists the missing variables as amber badges. To fix: either edit the template (in /dashboard/templates) to remove the missing variable, or provide a default for it, or pick a different template that only uses {{email}} and {{name}}. Until you fix it, the automation will not fire — and if re-enabled, it will fail at send-time and retry.",
    },
    {
      title: "Toast says \"Failed to update automation.\"",
      body: "The PUT to /api/dashboard/automations/otp-verified-welcome failed. The most common causes: 401 (session expired — sign in again, the page will router.push(\"/auth\") automatically), 403 (your plan no longer includes the Automations feature pack — the page will switch to the \"Not available\" view with a \"View Plans\" button), or a 500 (server error — try again in a moment). The optimistic UI reverts on error so the page stays in the last-known-good state.",
    },
    {
      title: "Page shows \"Not available\" instead of the Card",
      body: "The GET returned 403 — your account doesn't have the Automations entitlement. The page renders a centered Zap icon in a muted circle, the heading \"Automations are not available on your current account\", the description \"OTP-verified welcome automation is part of the Automations feature pack.\", and a \"View Plans\" button that links to /pricing. Upgrade to a plan that includes the feature pack and refresh.",
    },
    {
      title: "Welcome email didn't arrive after an OTP verification",
      body: "Check three things, in order: (1) the status strip shows emerald \"Active\" (not amber \"Enabled — no template\" or muted \"Paused\"); (2) the contact's email is in your Sent Emails page with a delivered status; (3) the contact isn't on the Suppressions list (a suppressed contact won't receive transactional emails). If all three are fine, check the contact's record — if their OTP verification came back as failed/expired, the automation didn't fire.",
    },
  ],
  checklist: [
    { label: "Open the Automations page (Dashboard → Automations)" },
    { label: "Toggle the Switch to \"Enabled\" (auto-saves)" },
    { label: "Pick a Welcome template from the Select dropdown" },
    { label: "Confirm the CompatibilityIndicator reads emerald \"Compatible\"" },
    { label: "Verify the status strip shows emerald \"Active\"" },
    { label: "Test end-to-end: sign up a fresh contact, verify OTP, check Sent Emails" },
  ],
  whatNext:
    "Once your Welcome Email automation is armed, the next step is to design the welcome template itself — visit /dashboard/templates and either edit an existing one or create a new transactional template that uses only {{email}} and {{name}}. From there, explore Branding (the email theme the automation will render with) and Sent Emails (where every welcome email Nixify fires on your behalf is logged with delivery status).",
  related: [
    {
      label: "Open Automations in the dashboard",
      href: "/dashboard/automations",
    },
    {
      label: "Browse transactional templates",
      href: "/dashboard/templates",
    },
    {
      label: "View sent emails (delivery log)",
      href: "/dashboard/emails",
    },
  ],

  /* ─── Stage copy (simulated Automations page, English) ─────────────────── */
  stage: {
    dir: "ltr",
    locale: "en",

    header: {
      title: "Automations",
      backToDashboard: "Back to Dashboard",
      subtitle: "Configure automatic email workflows triggered by user events.",
    },

    card: {
      title: "OTP Verified → Welcome Email",
      description:
        "When an OTP is successfully verified, automatically send a welcome email to the verified address using the selected template.",
      type: "otp-verified-welcome",
    },

    toggle: {
      enabled: "Enabled",
      disabled: "Disabled",
      saving: "Saving…",
      autoSaves: "Auto-saves",
    },

    statusStrip: {
      active: "Active",
      enabledNoTemplate: "Enabled — no template",
      enabledIncompatible: "Enabled — incompatible template",
      paused: "Paused",
      updated: "Updated",
      updatedAtRelative: "2 minutes ago",
    },

    templateSelector: {
      label: "Welcome template",
      selectPlaceholder: "Select a transactional template…",
      noTemplateItem: "— No template —",
      noTemplatesHint: "You don't have any transactional templates yet.",
      createOneLink: "Create one →",
      usingTemplate: (name, version) => `Using template ${name} (v${version}).`,
      saving: "Saving…",
    },

    variables: {
      builtInTitle: "Built-in variables",
      builtInDesc:
        "These are the variables Nixify automatically injects when the automation fires.",
      templateRequiredTitle: "Template required variables",
      templateRequiredDesc: "Variables the selected template references.",
      templateNoVariables: "This template declares no variables.",
      selectTemplatePrompt: "Select a template to see its required variables.",
      providedLabel: "provided",
      missingLabel: "missing",
    },

    compatibility: {
      noTemplateTitle: "No template selected",
      noTemplateDesc:
        "Choose a transactional template above. The automation will not fire until one is selected and compatible with the built-in variables.",
      compatibleTitle: "Compatible",
      compatibleDesc:
        "The selected template only uses variables Nixify can provide.",
      incompatibleTitle:
        "Incompatible — template requires variables the automation cannot provide",
      incompatibleDesc:
        "The automation can only inject email and name. Edit the template to remove or provide defaults for these missing variables:",
      failAtSendTime: "fail at send-time and retry",
      notFireWhenEnabled: "not fire when enabled",
    },

    helpFooter: {
      prompt: "Need a template that only uses {{email}} and {{name}}?",
      browseLink: "Browse templates →",
    },

    templates: [
      {
        id: 1,
        name: "Welcome — Onboarding",
        slug: "welcome-onboarding",
        currentVersion: 3,
        requiredVariables: ["email", "name"],
        compatible: true,
      },
      {
        id: 2,
        name: "Quick Start Guide",
        slug: "quick-start-guide",
        currentVersion: 2,
        requiredVariables: ["email", "name"],
        compatible: true,
      },
      {
        id: 3,
        name: "Welcome + Order Summary",
        slug: "welcome-order-summary",
        currentVersion: 1,
        requiredVariables: ["email", "name", "order_id"],
        compatible: false,
      },
    ],

    builtInVariables: ["email", "name"],
  },

  /* ─── Creative-section copy (English) ──────────────────────────────────── */
  creative: {
    triggerActionFlow: {
      heading: "Trigger → Action",
      subheading:
        "The Welcome Email automation is a single trigger wired to a single action. There's no rule builder — the trigger is fixed (OTP verified) and the action is fixed (send welcome email). You only control whether it's on and which template it sends.",
      trigger: {
        badge: "Trigger",
        title: "OTP verified",
        body: "A contact submits a valid OTP via POST /api/auth/verify-email. The verification succeeds — Nixify records the contact's email as verified and emits the otp.verified event.",
        event: "otp.verified",
      },
      arrowLabel: "fires",
      action: {
        badge: "Action",
        title: "Send welcome email",
        body: "Nixify looks up the otp-verified-welcome automation setting. If enabled + has-template + compatible, it renders the selected template with {{email}} and {{name}} and dispatches the welcome email through the active provider.",
        action: "send.welcome_email",
      },
      caption:
        "Trigger and action are fixed by Nixify — your only configuration is on/off + which template.",
      endpointHint: "PUT /api/dashboard/automations/otp-verified-welcome",
    },

    executionStory: {
      heading: "What happens when this fires?",
      subheading:
        "Step-by-step walkthrough of the moment a contact verifies their OTP. Everything below happens server-side in milliseconds — the user just sees the welcome email land in their inbox.",
      steps: [
        {
          badge: "01",
          title: "Contact submits the OTP",
          body: "The user types the 6-digit code into /verify-email and submits. The frontend POSTs to /api/auth/verify-email with the email + code.",
          token: "POST /api/auth/verify-email",
        },
        {
          badge: "02",
          title: "OTP is verified",
          body: "The backend hashes the submitted code, compares it to the stored hash, checks the expiry, and marks the contact's email as verified. The contact row is upserted with source = otp_verified.",
          token: "otp.verified",
        },
        {
          badge: "03",
          title: "Automation setting is read",
          body: "Nixify fetches the otp-verified-welcome automation setting. If enabled === false, the pipeline stops here — no welcome email. If enabled === true, it proceeds.",
          token: "GET /api/dashboard/automations/otp-verified-welcome",
        },
        {
          badge: "04",
          title: "Template compatibility is checked",
          body: "If no template is selected (template_id === null) or the selected template is incompatible (compatible === false), the pipeline stops. Otherwise, the template body + current_version are loaded.",
          token: "compatible === true",
        },
        {
          badge: "05",
          title: "Variables are injected",
          body: "The template's {{email}} and {{name}} placeholders are replaced with the verified contact's email and name (or empty string if name is null). The result is HTML ready to send.",
          token: "{{email}}, {{name}}",
        },
        {
          badge: "06",
          title: "Email is dispatched",
          body: "Nixify renders the email with the active theme (from Branding) and hands the message to the active provider (SMTP, Postmark, etc.). A sent_emails row is written for tracking.",
          token: "POST /api/dashboard/sent-emails",
        },
        {
          badge: "07",
          title: "User receives the welcome",
          body: "The welcome email lands in the contact's inbox. The Sent Emails page in the dashboard shows the new row with its delivery status (sent, delivered, bounced, etc.).",
          token: "delivered",
        },
      ],
      footnote:
        "Steps 01–02 are the user's action. Steps 03–06 are Nixify's response — they happen server-side in milliseconds, with no UI feedback to the contact beyond the welcome email itself.",
    },

    eventJourney: {
      heading: "Example automation event journey",
      subheading:
        "Follow one real welcome-email event from contact submit to delivered inbox. Each step is annotated with the system that owns it and the side effect (if any) it produces.",
      legendTitle: "Legend",
      legendItems: [
        { label: "UI step — what the contact sees", tone: "ui" },
        { label: "State transition — Nixify changes a record", tone: "state" },
        { label: "Downstream effect — leaves the dashboard", tone: "downstream" },
      ],
      steps: [
        {
          badge: "01",
          title: "Sara signs up with sara@example.com",
          body: "Sara enters her email on /signup and submits. Nixify creates a contact row (source = dashboard) and sends an OTP to her inbox.",
          tone: "ui",
          token: "POST /api/auth/signup",
        },
        {
          badge: "02",
          title: "Sara pastes the 6-digit code",
          body: "Sara reads the OTP from her inbox, types it into /verify-email, and submits. The frontend POSTs the code to the verify endpoint.",
          tone: "ui",
          token: "POST /api/auth/verify-email",
        },
        {
          badge: "03",
          title: "Contact row is marked verified",
          body: "The OTP hash matches and the code hasn't expired. Nixify flips the contact's email_verified flag to true and sets source = otp_verified.",
          tone: "state",
          token: "email_verified = true",
        },
        {
          badge: "04",
          title: "Automation setting is loaded",
          body: "The server reads the otp-verified-welcome automation setting for Sara's account. enabled === true, template_id = 1 (Welcome — Onboarding, v3), compatible === true.",
          tone: "state",
          token: "enabled && compatible",
        },
        {
          badge: "05",
          title: "Welcome template is rendered",
          body: "Template v3 is loaded, {{email}} is replaced with sara@example.com, {{name}} is replaced with \"Sara\". The result is wrapped in the active Branding theme.",
          tone: "state",
          token: "render(template, vars)",
        },
        {
          badge: "06",
          title: "Welcome email is sent",
          body: "The rendered HTML is handed to the active provider. A sent_emails row is written with status = sent and the contact_id of Sara.",
          tone: "downstream",
          token: "provider.dispatch()",
        },
        {
          badge: "07",
          title: "Sara's inbox receives the welcome",
          body: "Seconds later, the welcome email arrives in Sara's inbox. The Sent Emails page in the dashboard updates to show delivered status once the provider confirms receipt.",
          tone: "downstream",
          token: "delivered",
        },
      ],
    },

    safeDesignChecklist: {
      heading: "Safe design checklist",
      subheading:
        "Run through this list before walking away from the Automations page. A misconfigured welcome automation won't crash — it'll just silently fail to send, which is worse.",
      items: [
        {
          label: "Switch is Enabled and reads emerald",
          hint: "If the Switch is off, the status strip shows muted \"Paused\" — no welcome email will fire. Toggle it on.",
        },
        {
          label: "A Welcome template is selected",
          hint: "If no template is selected, the status shows amber \"Enabled — no template\". Pick one from the Select.",
        },
        {
          label: "Selected template only uses {{email}} and {{name}}",
          hint: "Built-in variables are exactly email and name. Any other {{var}} in the template body makes it incompatible and the automation won't fire.",
        },
        {
          label: "CompatibilityIndicator reads emerald \"Compatible\"",
          hint: "This Alert mirrors the backend's compatibility computation. If it's amber, fix the template before walking away.",
        },
        {
          label: "Status strip shows emerald \"Active\"",
          hint: "Active = enabled + has-template + compatible. Anything else means the automation won't fire on the next OTP verification.",
        },
        {
          label: "Updated timestamp is recent",
          hint: "The \"Updated {relativeTime}\" line on the right of the status strip confirms your last save landed. If it shows \"just now\", you're good.",
        },
        {
          label: "End-to-end test: signed up a fresh contact and verified their OTP",
          hint: "Sign up with an incognito email, request an OTP, verify it. Then check Sent Emails — the welcome email should be there with a delivered status.",
        },
      ],
      warningTitle: "An enabled-but-broken automation is worse than a disabled one",
      warningBody:
        "If you toggle the Switch on and leave it with an incompatible or missing template, every successful OTP verification will attempt to fire the automation and fail silently. Users won't get their welcome email and you won't know — until they complain. Always finish the configuration (template + compatibility) before walking away.",
    },
  },
};
