/**
 * UX-B: Guide registry — all dashboard route guides.
 *
 * Each guide is a data-driven definition with chapters and steps.
 * The WalkthroughShell component renders the guide visually.
 * Captions are sourced from the i18n dictionaries.
 *
 * To add a new guide:
 * 1. Add a GuideDefinition here (chapters + steps)
 * 2. Add i18n keys to en.ts and fa.ts under `guide.{routeKey}.*`
 * 3. Add a <GuideLauncher routeKey="..." /> to the page
 */

import type { GuideRegistry, GuideDefinition } from "./types";

/**
 * Helper to create a guide with less boilerplate.
 */
function guide(
  route: string,
  chapters: { id: string; steps: { id: string; duration?: number; spotlight?: string; scene?: string; typedText?: string; typedTarget?: string }[] }[],
): { route: string; chapters: { id: string; steps: { id: string; duration?: number; spotlight?: string; scene?: string; typedText?: string; typedTarget?: string }[] }[]; enabled: boolean } {
  return { route, chapters, enabled: true };
}

export const GUIDE_REGISTRY: GuideRegistry = {
  // ─── Dashboard Overview ───────────────────────────────────────────
  "/dashboard": guide("/dashboard", [
    {
      id: "overview",
      steps: [
        { id: "welcome", duration: 4000, scene: "welcome" },
        { id: "widgets", duration: 4000, spotlight: "[data-guide='widgets']", scene: "widgets" },
        { id: "quickActions", duration: 4000, spotlight: "[data-guide='quick-actions']", scene: "quickActions" },
        { id: "nextSteps", duration: 4000, scene: "nextSteps" },
      ],
    },
  ]),

  // ─── API Keys ──────────────────────────────────────────────────────
  "/dashboard/api-keys": guide("/dashboard/api-keys", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "apikeyIntro" },
        { id: "createKey", duration: 5000, spotlight: "[data-guide='create-key']", scene: "createKey", typedText: "Production server", typedTarget: "[data-guide='key-name-input']" },
        { id: "copySecret", duration: 4000, scene: "copySecret" },
        { id: "securityTip", duration: 4000, scene: "securityTip" },
      ],
    },
  ]),

  // ─── Webhooks ─────────────────────────────────────────────────────
  "/dashboard/webhooks": guide("/dashboard/webhooks", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "webhookIntro" },
        { id: "createEndpoint", duration: 5000, spotlight: "[data-guide='create-endpoint']", scene: "createEndpoint", typedText: "https://example.com/hooks/nixify", typedTarget: "[data-guide='webhook-url-input']" },
        { id: "copySecret", duration: 4000, scene: "copySecret" },
        { id: "verifySignature", duration: 5000, scene: "verifySignature" },
        { id: "testDelivery", duration: 4000, scene: "testDelivery" },
      ],
    },
  ]),

  // ─── Broadcasts ────────────────────────────────────────────────────
  "/dashboard/broadcasts": guide("/dashboard/broadcasts", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "broadcastIntro" },
        { id: "createBroadcast", duration: 5000, spotlight: "[data-guide='create-broadcast']", scene: "createBroadcast", typedText: "Welcome campaign", typedTarget: "[data-guide='broadcast-name']" },
        { id: "selectAudience", duration: 4000, scene: "selectAudience" },
        { id: "selectTemplate", duration: 4000, scene: "selectTemplate" },
        { id: "preview", duration: 4000, scene: "previewStage" },
        { id: "schedule", duration: 4000, scene: "schedule" },
        { id: "complete", duration: 4000, scene: "complete" },
      ],
    },
  ]),

  // ─── Contacts ──────────────────────────────────────────────────────
  "/dashboard/contacts": guide("/dashboard/contacts", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "contactsIntro" },
        { id: "addContact", duration: 4000, spotlight: "[data-guide='add-contact']", scene: "addContact" },
        { id: "import", duration: 4000, spotlight: "[data-guide='import-contacts']", scene: "import" },
        { id: "groups", duration: 4000, scene: "groups" },
        { id: "suppressions", duration: 4000, scene: "suppressions" },
      ],
    },
  ]),

  // ─── Templates ─────────────────────────────────────────────────────
  "/dashboard/templates": guide("/dashboard/templates", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "templatesIntro" },
        { id: "createTemplate", duration: 5000, spotlight: "[data-guide='create-template']", scene: "createTemplate", typedText: "Welcome email", typedTarget: "[data-guide='template-name']" },
        { id: "variables", duration: 4000, scene: "variables" },
        { id: "preview", duration: 4000, scene: "templatePreview" },
        { id: "versioning", duration: 4000, scene: "versioning" },
      ],
    },
  ]),

  // ─── Automations ───────────────────────────────────────────────────
  "/dashboard/automations": guide("/dashboard/automations", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "automationsIntro" },
        { id: "createRule", duration: 5000, spotlight: "[data-guide='create-automation']", scene: "createRule" },
        { id: "trigger", duration: 4000, scene: "trigger" },
        { id: "action", duration: 4000, scene: "action" },
      ],
    },
  ]),

  // ─── Analytics ─────────────────────────────────────────────────────
  "/dashboard/analytics": guide("/dashboard/analytics", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "analyticsIntro" },
        { id: "overview", duration: 4000, spotlight: "[data-guide='overview-tab']", scene: "overview" },
        { id: "trends", duration: 4000, spotlight: "[data-guide='trends-tab']", scene: "trends" },
        { id: "heatmap", duration: 4000, spotlight: "[data-guide='heatmap-tab']", scene: "heatmap" },
        { id: "reports", duration: 4000, spotlight: "[data-guide='reports-tab']", scene: "reports" },
      ],
    },
  ]),

  // ─── Branding ──────────────────────────────────────────────────────
  "/dashboard/branding": guide("/dashboard/branding", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "brandingIntro" },
        { id: "colors", duration: 4000, spotlight: "[data-guide='branding-tab']", scene: "colors" },
        { id: "header", duration: 4000, spotlight: "[data-guide='header-tab']", scene: "headerEditor" },
        { id: "footer", duration: 4000, spotlight: "[data-guide='footer-tab']", scene: "footerEditor" },
        { id: "preview", duration: 4000, scene: "livePreview" },
        { id: "activate", duration: 4000, scene: "activateTheme" },
      ],
    },
  ]),

  // ─── Playground ────────────────────────────────────────────────────
  "/dashboard/playground": guide("/dashboard/playground", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "playgroundIntro" },
        { id: "selectEndpoint", duration: 4000, spotlight: "[data-guide='endpoint-select']", scene: "selectEndpoint" },
        { id: "setParams", duration: 5000, scene: "setParams", typedText: "user@example.com", typedTarget: "[data-guide='email-input']" },
        { id: "sendRequest", duration: 4000, spotlight: "[data-guide='send-button']", scene: "sendRequest" },
        { id: "viewResponse", duration: 4000, scene: "viewResponse" },
      ],
    },
  ]),

  // ─── Logs ───────────────────────────────────────────────────────────
  "/dashboard/logs": guide("/dashboard/logs", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "logsIntro" },
        { id: "filter", duration: 4000, spotlight: "[data-guide='log-filter']", scene: "filter" },
        { id: "details", duration: 4000, scene: "logDetails" },
        { id: "export", duration: 4000, scene: "export" },
      ],
    },
  ]),

  // ─── Errors ─────────────────────────────────────────────────────────
  "/dashboard/errors": guide("/dashboard/errors", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "errorsIntro" },
        { id: "search", duration: 4000, spotlight: "[data-guide='error-search']", scene: "search" },
        { id: "filter", duration: 4000, scene: "filter" },
        { id: "details", duration: 4000, scene: "errorDetails" },
      ],
    },
  ]),

  // ─── Activity ───────────────────────────────────────────────────────
  "/dashboard/activity": guide("/dashboard/activity", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "activityIntro" },
        { id: "events", duration: 4000, scene: "events" },
        { id: "timeline", duration: 4000, scene: "timeline" },
      ],
    },
  ]),

  // ─── Emails ─────────────────────────────────────────────────────────
  "/dashboard/emails": guide("/dashboard/emails", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "emailsIntro" },
        { id: "delivery", duration: 4000, scene: "delivery" },
        { id: "status", duration: 4000, scene: "status" },
      ],
    },
  ]),

  // ─── Suppressions ──────────────────────────────────────────────────
  "/dashboard/suppressions": guide("/dashboard/suppressions", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "suppressionsIntro" },
        { id: "add", duration: 4000, spotlight: "[data-guide='add-suppression']", scene: "addSuppression" },
        { id: "lift", duration: 4000, scene: "liftSuppression" },
      ],
    },
  ]),

  // ─── Groups ─────────────────────────────────────────────────────────
  "/dashboard/groups": guide("/dashboard/groups", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "groupsIntro" },
        { id: "createGroup", duration: 4000, spotlight: "[data-guide='create-group']", scene: "createGroup" },
        { id: "addMembers", duration: 4000, scene: "addMembers" },
      ],
    },
  ]),

  // ─── Notifications ─────────────────────────────────────────────────
  "/dashboard/notifications": guide("/dashboard/notifications", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "notificationsIntro" },
        { id: "types", duration: 4000, scene: "notificationTypes" },
      ],
    },
  ]),

  // ─── Settings ───────────────────────────────────────────────────────
  "/dashboard/settings": guide("/dashboard/settings", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "settingsIntro" },
        { id: "profile", duration: 4000, scene: "profile" },
        { id: "security", duration: 4000, scene: "security" },
      ],
    },
  ]),

  // ─── Docs ───────────────────────────────────────────────────────────
  "/dashboard/docs": guide("/dashboard/docs", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "docsIntro" },
        { id: "quickStart", duration: 4000, spotlight: "[data-guide='quickstart']", scene: "quickStart" },
        { id: "apiReference", duration: 4000, spotlight: "[data-guide='api-reference']", scene: "apiReference" },
        { id: "errors", duration: 4000, spotlight: "[data-guide='errors']", scene: "errors" },
      ],
    },
  ]),

  // ─── Contacts Import ───────────────────────────────────────────────
  "/dashboard/contacts/import": guide("/dashboard/contacts/import", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "importIntro" },
        { id: "upload", duration: 5000, spotlight: "[data-guide='upload-zone']", scene: "upload" },
        { id: "preview", duration: 4000, scene: "previewRows" },
        { id: "confirm", duration: 4000, scene: "confirmImport" },
      ],
    },
  ]),

  // ─── Contact Detail ─────────────────────────────────────────────────
  "/dashboard/contacts/[id]": guide("/dashboard/contacts/[id]", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "contactDetailIntro" },
        { id: "attributes", duration: 4000, scene: "attributes" },
        { id: "events", duration: 4000, scene: "contactEvents" },
        { id: "actions", duration: 4000, scene: "contactActions" },
      ],
    },
  ]),

  // ─── Template Editor ────────────────────────────────────────────────
  "/dashboard/templates/[id]": guide("/dashboard/templates/[id]", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "templateEditorIntro" },
        { id: "editor", duration: 4000, scene: "editor" },
        { id: "preview", duration: 4000, scene: "templatePreview" },
        { id: "versions", duration: 4000, scene: "versions" },
        { id: "testSend", duration: 4000, scene: "testSend" },
      ],
    },
  ]),

  // ─── Group Detail ───────────────────────────────────────────────────
  "/dashboard/groups/[groupId]": guide("/dashboard/groups/[groupId]", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "groupDetailIntro" },
        { id: "members", duration: 4000, scene: "members" },
        { id: "addMember", duration: 4000, scene: "addMember" },
        { id: "settings", duration: 4000, scene: "groupSettings" },
      ],
    },
  ]),

  // ─── Dashboard-v2 Analytics (if exists) ─────────────────────────────
  "/dashboard-v2/analytics": guide("/dashboard-v2/analytics", [
    {
      id: "intro",
      steps: [
        { id: "whatIs", duration: 4000, scene: "analyticsIntro" },
        { id: "charts", duration: 4000, scene: "charts" },
      ],
    },
  ]),
};

/**
 * Get the guide for a route, handling dynamic routes by matching
 * the static prefix.
 */
export function getGuideForRoute(pathname: string): GuideDefinition | undefined {
  // Try exact match first
  if (GUIDE_REGISTRY[pathname]) return GUIDE_REGISTRY[pathname];

  // Try dynamic route matching: /dashboard/contacts/123 → /dashboard/contacts/[id]
  for (const [pattern, guide] of Object.entries(GUIDE_REGISTRY)) {
    if (pattern.includes("[")) {
      // Convert [id] to a regex pattern
      const regexPattern = pattern
        .replace(/\[.*?\]/g, "[^/]+")
        .replace(/\//g, "\\/");
      if (new RegExp(`^${regexPattern}$`).test(pathname)) {
        return guide;
      }
    }
  }

  return undefined;
}
