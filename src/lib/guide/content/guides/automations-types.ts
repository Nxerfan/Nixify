/**
 * UX-B: Automations guide — stage + creative copy types.
 *
 * The Automations guide is the third guide in the UX-B contextual guide
 * system, after Contacts and Branding. It mirrors the REAL Nixify
 * Automations page at:
 *   src/app/dashboard/automations/page.tsx
 *
 * Architecture rules (REGRESSION-PROTECTED):
 *   - The stage + creative copy are guide-specific types defined here, but
 *     they all share the common GuideContentBase fields (chapters,
 *     writtenSteps, etc.) defined in ../types.
 *   - Each content dictionary (automations-en.ts, automations-fa.ts) exports
 *     an AutomationsGuideContent that the view component consumes directly.
 *   - Technical tokens (template slugs, variable names like email/name,
 *     ISO timestamps, automation type "otp-verified-welcome",
 *     {{var}} placeholders, version strings) stay LTR via <Ltr> at render
 *     time. They are stored as raw strings here.
 *   - The stage reads `dir` from the copy (ltr for en, rtl for fa) and is
 *     NOT permanently `dir="ltr"`.
 *
 * Source-of-truth UI audit (verbatim labels from the real automations page):
 *   - Single Card titled "OTP Verified → Welcome Email" with emerald
 *     MailCheck icon tile.
 *   - Card description: "When an OTP is successfully verified, automatically
 *     send a welcome email to the verified address using the selected
 *     template."
 *   - Right side of header: bordered box with Label (Enabled / Disabled),
 *     small hint ("Saving…" while persisting → "Auto-saves" otherwise),
 *     and a Switch toggle (emerald when checked).
 *   - Status strip below header: Badge among "Active" (emerald, canFire),
 *     "Enabled — no template" (amber), "Enabled — incompatible" (amber),
 *     "Paused" (muted). Plus "Updated {relativeTime}" with Clock icon.
 *   - Template selector block: Label "Welcome template", optional
 *     "Saving…" spinner, Select with first item "— No template —", a
 *     SelectSeparator, then list of templates. Below: hint if
 *     templates.length===0, or "Using template {name} (v{version})" line.
 *   - 2-column grid:
 *       Left  — "Built-in variables" card with emerald Variable icon and
 *               {{email}} / {{name}} emerald badges.
 *       Right — "Template required variables" card listing each var, with
 *               emerald CheckCircle2 if provided / rose if missing.
 *   - CompatibilityIndicator Alert (3 variants):
 *       * no template (muted, "No template selected")
 *       * compatible (emerald, "Compatible")
 *       * incompatible (amber, lists missing variables as amber badges;
 *         "Will fail at send time" if enabled, "Won't fire when enabled"
 *         if disabled)
 *   - Help footer: "Need a template that only uses {{email}} and {{name}}?"
 *     + emerald Link "Browse templates" → /dashboard/templates.
 *
 * The page is a SINGLE card — there is no rule builder, no multi-condition
 * editor, no flow chart. The automation fires when a contact verifies their
 * OTP (POST /api/auth/verify-email → otp-verified-welcome rule).
 */

import type { GuideContentBase } from "../types";

/* ─── Stage copy ────────────────────────────────────────────────────────── */

export interface AutomationsStageTemplate {
  /** Numeric ID — matches the real TemplateListItem.id */
  id: number;
  /** Human-friendly template name */
  name: string;
  /** URL-safe slug — LTR token */
  slug: string;
  /** Current version number — LTR token */
  currentVersion: number;
  /** Variables the template references (for compatibility demo) */
  requiredVariables: string[];
  /** Whether the template is compatible with the built-in variables */
  compatible: boolean;
}

export interface AutomationsStageCopy {
  dir: "ltr" | "rtl";
  locale: "en" | "fa";

  header: {
    title: string; // "Automations"
    backToDashboard: string; // "Back to Dashboard"
    subtitle: string; // "Configure automatic email workflows..."
  };

  card: {
    /** Automation type label, e.g. "OTP Verified → Welcome Email" */
    title: string;
    description: string;
    /** Automation type key — LTR token */
    type: string; // "otp-verified-welcome"
  };

  toggle: {
    /** Label that flips between Enabled / Disabled */
    enabled: string;
    disabled: string;
    /** Hint shown under the label */
    saving: string; // "Saving…"
    autoSaves: string; // "Auto-saves"
  };

  statusStrip: {
    active: string; // "Active"
    enabledNoTemplate: string; // "Enabled — no template"
    enabledIncompatible: string; // "Enabled — incompatible template"
    paused: string; // "Paused"
    updated: string; // "Updated" (prefix for relative time)
    /** Example relative time string, e.g. "2 minutes ago" */
    updatedAtRelative: string;
  };

  templateSelector: {
    label: string; // "Welcome template"
    selectPlaceholder: string; // "Select a transactional template…"
    noTemplateItem: string; // "— No template —"
    noTemplatesHint: string; // "You don't have any transactional templates yet."
    createOneLink: string; // "Create one →"
    usingTemplate: (name: string, version: number) => string;
    /** "Saving…" spinner text on the template row */
    saving: string;
  };

  variables: {
    builtInTitle: string; // "Built-in variables"
    builtInDesc: string; // "These are the variables Nixify automatically injects..."
    templateRequiredTitle: string; // "Template required variables"
    templateRequiredDesc: string; // "Variables the selected template references."
    templateNoVariables: string; // "This template declares no variables."
    selectTemplatePrompt: string; // "Select a template to see its required variables."
    /** "provided" / "missing" pill labels */
    providedLabel: string;
    missingLabel: string;
  };

  compatibility: {
    noTemplateTitle: string; // "No template selected"
    noTemplateDesc: string;
    compatibleTitle: string; // "Compatible"
    compatibleDesc: string;
    incompatibleTitle: string; // "Incompatible — template requires variables..."
    incompatibleDesc: string;
    failAtSendTime: string; // "fail at send-time and retry"
    notFireWhenEnabled: string; // "not fire when enabled"
  };

  helpFooter: {
    prompt: string; // "Need a template that only uses {{email}} and {{name}}?"
    browseLink: string; // "Browse templates →"
  };

  /** Seed templates shown in the simulated dropdown. */
  templates: AutomationsStageTemplate[];
  /** Built-in variables (always {{email}} and {{name}}). */
  builtInVariables: string[];
}

/* ─── Creative section copy ─────────────────────────────────────────────── */

/* 1. Trigger → Action visual flow diagram */

export interface TriggerActionFlowCopy {
  heading: string;
  subheading: string;
  trigger: {
    badge: string;
    title: string;
    body: string;
    /** Trigger event key — LTR token */
    event: string; // "otp.verified"
  };
  arrowLabel: string;
  action: {
    badge: string;
    title: string;
    body: string;
    /** Action key — LTR token */
    action: string; // "send.welcome_email"
  };
  /** Caption beneath the flow */
  caption: string;
  /** Real API endpoint the action calls — LTR token */
  endpointHint: string;
}

/* 2. "What happens when this fires?" execution story */

export interface ExecutionStoryCopy {
  heading: string;
  subheading: string;
  steps: {
    badge: string; // "01", "02", ...
    title: string;
    body: string;
    /** Optional LTR token (API name, variable, etc.) */
    token?: string;
  }[];
  footnote: string;
}

/* 3. Example automation event journey */

export interface EventJourneyStepCopy {
  badge: string;
  title: string;
  body: string;
  /** Tone: ui = neutral, state = transition, downstream = side effect */
  tone: "ui" | "state" | "downstream";
  /** Optional LTR token shown beside the title (e.g. method name, status code) */
  token?: string;
}

export interface EventJourneyCopy {
  heading: string;
  subheading: string;
  legendTitle: string;
  legendItems: { label: string; tone: "ui" | "state" | "downstream" }[];
  steps: EventJourneyStepCopy[];
}

/* 4. Safe design checklist */

export interface SafeDesignChecklistCopy {
  heading: string;
  subheading: string;
  items: { label: string; hint: string }[];
  warningTitle: string;
  warningBody: string;
}

export interface AutomationsCreativeCopy {
  triggerActionFlow: TriggerActionFlowCopy;
  executionStory: ExecutionStoryCopy;
  eventJourney: EventJourneyCopy;
  safeDesignChecklist: SafeDesignChecklistCopy;
}

/* ─── Combined guide content type ───────────────────────────────────────── */

export type AutomationsGuideContent = GuideContentBase & {
  stage: AutomationsStageCopy;
  creative: AutomationsCreativeCopy;
};
