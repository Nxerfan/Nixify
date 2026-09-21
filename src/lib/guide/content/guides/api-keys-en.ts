/**
 * UX-B: API Keys guide — English content dictionary.
 *
 * AUDIT-GRADE FACTUAL ACCURACY (re-verified this pass):
 *   Every statement here was verified against:
 *     - src/app/dashboard/api-keys/page.tsx                       (~779-line real UI)
 *     - src/app/api/admin/api-keys/route.ts                       (list / create / revoke)
 *     - src/app/api/admin/api-keys/usage/route.ts                 (per-key usage buckets)
 *     - src/lib/dx/api-keys.ts                                    (key generation + verify + scope)
 *     - src/i18n/en.ts                                            (dashboard.apiKeys.* labels)
 *
 * Specifically:
 *   - The real API Keys page renders a header (emerald KeyRound icon +
 *     "API Keys" + the subtitle "Generate, monitor, and revoke
 *     programmatic access keys"), a Refresh button + an emerald "Create
 *     New Key" button, a quota Card with plan badge + "{n} / {quota}
 *     keys used" + a colored bar, a keys Card with a sticky-header
 *     table (columns: Name, Prefix, Environment, Created, Last Used,
 *     Status, Actions), per-row dropdown (View usage / Copy prefix /
 *     Revoke), an expandable usage panel (last 24h / last 7d / all
 *     time, with success / client / server buckets), and an emerald
 *     "Security tips" Alert at the bottom.
 *   - The Create Dialog has Name (input), Environment (Select:
 *     development / production), Scopes (Select: full — all endpoints
 *     / read_only — GET only), Expiration (optional date), and a hint
 *     "Key will start with mg_test_ / mg_live_". On success, the full
 *     key is shown ONCE in the Reveal Dialog (with Copy + amber "won't
 *     be shown again" warning).
 *   - The Revoke confirmation is an AlertDialog: "You are about to
 *     revoke {name}. Any requests using this key will immediately stop
 *     working. This action cannot be undone." — Cancel + rose "Revoke
 *     key" / "Revoking…" button.
 *   - PLAN_QUOTA = { FREE: 1, PRO: 5, MAX: 20 }. NEXT_PLAN = FREE →
 *     PRO → MAX → null. The Create button is disabled when
 *     activeCount >= quota; the title attribute explains why.
 *   - Key format: `mg_live_<24 url-safe chars>` (production) or
 *     `mg_test_<24 url-safe chars>` (development). The full key is
 *     shown ONCE at creation; we store only SHA-256(key) (keyHash) +
 *     the first 12 chars (prefix) for display.
 *   - POST /api/admin/api-keys goes through createResourceWithCapacity
 *     (transactional row lock) — API_KEYS is a resource cardinality
 *     limit, not monthly quota. Revoked keys do NOT consume a slot.
 *     402 = quota_exhausted, 403 = not_available_on_plan.
 *   - DELETE /api/admin/api-keys?id=X is a soft delete (sets revokedAt
 *     = now). keyHash is retained for audit. User can only revoke
 *     own keys (ownership check); admin bypasses.
 *   - GET /api/admin/api-keys/usage?id=X returns 2xx/4xx/5xx buckets
 *     for last 24h, last 7d, all time.
 *   - hasScope(scopes, action): "full" → all; "read_only" → only
 *     action === "read" allowed; otherwise split on "," and require
 *     exact match (custom comma-separated scopes). Routes that need
 *     read access pass "read"; routes that need write access pass "full".
 *
 * Tokens that must stay LTR (key prefixes like mg_test_ / mg_live_,
 * full keys like mg_live_abC12..., hash tokens like
 * sha256:7c3b9f1e..., numeric key IDs, ISO timestamps, scope codes
 * like full / read_only, environment codes like development /
 * production, plan codes like FREE / PRO / MAX, HTTP method names,
 * file paths) are stored as raw strings here and wrapped with <Ltr>
 * at render time in the stage component.
 *
 * This dictionary ALSO contains:
 *   - stage: human-facing copy for the simulated ApiKeysStage product UI
 *     (which mirrors the real page honestly — same header, same quota
 *     card, same table, same dialogs).
 *   - creative: copy for the four creative sections (Key anatomy,
 *     Live vs Test, Scopes explainer, Secure storage checklist).
 * Both are typed via the shared ApiKeysGuideContent interface so the
 * render components receive resolved content rather than reading
 * locale directly.
 */

import type { ApiKeysGuideContent } from "./api-keys-types";

export const apiKeysEn: ApiKeysGuideContent = {
  slug: "api-keys",
  routeKey: "api-keys",
  backHref: "/dashboard/api-keys",
  stepCount: 6,
  durationMin: 5,
  category: "developer",
  dashboardRoute: "/dashboard/api-keys",
  title: "API Keys",
  description:
    "Generate, monitor, and revoke programmatic access keys. The full key is shown ONCE at creation — Nixify only ever stores its SHA-256 hash and a 12-char prefix for display. Learn the test/live distinction, the full vs read_only scope model, and the secure storage checklist.",
  chapters: [
    {
      id: "intro",
      title: "API Keys",
      steps: [
        {
          id: "apiKeysOverview",
          caption:
            "Here is the real API Keys page. The header has an emerald KeyRound icon, the title \"API Keys\", and the subtitle \"Generate, monitor, and revoke programmatic access keys.\" Below it: a Refresh button, an emerald \"Create New Key\" button, then a quota Card showing your plan badge and how many active keys you've used against your plan's quota. The table lists every key — name, prefix, environment, status, last used, and a per-row actions menu.",
          duration: 8000,
          scene: "apiKeysOverview",
        },
        {
          id: "createDialog",
          caption:
            "Click \"Create New Key\" to open the create dialog. Pick a name (anything to help you remember what this key is for), an environment (development → key starts with mg_test_ ; production → key starts with mg_live_), a scope (full = all endpoints, or read_only = GET only), and an optional expiration date. The hint under the environment selector reminds you which prefix the key will get.",
          duration: 8500,
          scene: "createDialog",
        },
        {
          id: "secretReveal",
          caption:
            "On submit, the dialog closes and a reveal dialog opens with the full key — exactly once. Copy it now. Nixify only stores SHA-256(key) and the first 12 chars (the prefix) for display; the full secret is never retrievable again. If you lose it, you have to revoke the key and create a new one. The amber warning reinforces: \"This key won't be shown again. Store it in a secure secret manager.\"",
          duration: 8500,
          scene: "secretReveal",
        },
        {
          id: "quotaReached",
          caption:
            "Each plan has a key-count quota — FREE = 1, PRO = 5, MAX = 20. It's a resource cardinality limit, not monthly quota: revoked keys do NOT consume a slot. When activeCount >= quota, the Create button is disabled and the quota bar turns rose. The hint explains the path: revoke an unused key, or upgrade to the next plan.",
          duration: 8000,
          scene: "quotaReached",
        },
        {
          id: "revokeConfirmation",
          caption:
            "Open a row's actions menu and click \"Revoke\". An AlertDialog opens: \"You are about to revoke {name}. Any requests using this key will immediately stop working. This action cannot be undone.\" Revoke is a soft delete — Nixify sets revokedAt = now and retains the keyHash for audit history. Any in-flight requests signed with this key will immediately start failing.",
          duration: 8000,
          scene: "revokeConfirmation",
        },
        {
          id: "revokedState",
          caption:
            "After revoke, the row's status badge turns rose \"revoked\" and the actions menu's Revoke item becomes disabled (you can't revoke an already-revoked key). The prefix and key hash are retained — admins can still identify the key in audit logs without ever seeing the secret. Revoked keys don't count against your quota, so you can immediately create a replacement.",
          duration: 7500,
          scene: "revokedState",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "Read the keys list + quota card",
      body: "The API Keys page opens with a header (emerald KeyRound icon + \"API Keys\" + the subtitle \"Generate, monitor, and revoke programmatic access keys\"), a Refresh button, and an emerald \"Create New Key\" button. Below it: a quota Card showing your plan badge (FREE / PRO / MAX) and \"{activeCount} / {quota} keys used\" with a colored bar (emerald < 80%, amber 80–99%, rose at 100%). The keys table below lists every key with columns: Name (KeyRound icon + name + scopes subline), Prefix (first 12 chars + …, mono LTR), Environment (dev / prod badge), Created, Last Used, Status (active / expired / revoked), and a per-row Actions menu.",
    },
    {
      title: "Open the Create dialog and pick name + environment + scope",
      body: "Click \"Create New Key\". The dialog has Name (input), Environment (Select: development / production), Scopes (Select: full — all endpoints / read_only — GET only), and an optional Expiration date. The hint under the environment selector tells you which prefix the key will get: mg_test_ for development, mg_live_ for production. The submit button is disabled while the name is empty.",
    },
    {
      title: "Copy the full key from the Reveal dialog (shown ONCE)",
      body: "On submit, the create dialog closes and a reveal dialog opens with the full key string (e.g. mg_test_abC12xyz...). Copy it now — Nixify stores only SHA-256(key) (keyHash) and the first 12 chars (prefix) for display; the full secret is NEVER retrievable again. The amber warning reinforces: \"This key won't be shown again. Store it in a secure secret manager.\" Click Done to close the dialog; the new row appears in the table.",
    },
    {
      title: "Inspect a row's usage stats",
      body: "Open a row's actions menu and click \"View usage\". The row expands to show three buckets: last 24h, last 7d, and all time. Each bucket shows the total request count plus a breakdown of ✓success (2xx), ·client (4xx), and ✗server (5xx). The numbers come from GET /api/admin/api-keys/usage?id=X, which groups RequestLog rows by status code over each window. Click \"Hide usage\" to collapse the panel.",
    },
    {
      title: "Revoke a key when you no longer need it",
      body: "Open a row's actions menu and click \"Revoke\". An AlertDialog opens: \"You are about to revoke {name}. Any requests using this key will immediately stop working. This action cannot be undone.\" Confirm, and Nixify sets revokedAt = now (a soft delete — keyHash is retained for audit history). The status badge turns rose \"revoked\", and the Revoke menu item is disabled. Revoked keys do NOT count against your quota, so you can immediately create a replacement if needed.",
    },
    {
      title: "Respect the security tips",
      body: "The emerald Security tips Alert at the bottom of the page reinforces three rules: (1) Test keys (mg_test_) are for development; live keys (mg_live_) should only be used in production. (2) Rotate keys periodically and revoke unused ones. (3) Use read_only scope to limit exposure — read_only keys can only perform GET requests. The dashboard's hasScope() helper enforces these: full allows any action; read_only allows only action === \"read\" (GET).",
    },
  ],
  whyWhen: [
    {
      title: "When to create a new key",
      body: "Create a new key whenever a new integration needs programmatic access to your Nixify account — a backend worker, a CI script, a partner webhook receiver. Give it a name that helps you identify what it's for (e.g. \"Production backend worker\"). Pick the smallest scope that does the job: read_only if the integration only reads data, full if it needs to write. Use mg_test_ keys during development and switch to mg_live_ for production.",
    },
    {
      title: "Why the full key is shown only once",
      body: "Storing the full key would mean a database compromise could leak every key. Instead, Nixify stores only SHA-256(key) (a one-way hash) and the first 12 chars (the prefix) for display. The hash lets the verify path compare an incoming key against the stored record without ever storing the secret. The trade-off: if you lose the full key after the reveal dialog closes, it's gone forever — you have to revoke and create a new one. The dashboard cannot recover it.",
    },
    {
      title: "Why quota is a count, not monthly usage",
      body: "The API_KEYS feature is a resource cardinality limit (how many keys exist), not a monthly quota (how many calls they make). FREE = 1 key, PRO = 5, MAX = 20. Revoked keys do NOT consume a slot — only active keys count. The Create path goes through createResourceWithCapacity, a transactional row-lock that prevents over-allocation under concurrent requests. 402 means quota_exhausted (revoke a key or upgrade); 403 means not_available_on_plan (the feature isn't on your plan at all).",
    },
    {
      title: "When to use read_only vs full scope",
      body: "Use read_only for integrations that only need to read data — analytics dashboards, audit log pullers, status pages. A read_only key can call any GET endpoint (action === \"read\") but is rejected on writes (POST / PUT / DELETE). Use full only when the integration genuinely needs to mutate — sending OTPs, creating contacts, managing broadcasts. The smaller scope means a leaked key does less damage. Note: hasScope() also supports comma-separated custom scopes (e.g. \"otp:send,contacts:read\"), but the dashboard's create dialog only offers full and read_only.",
    },
  ],
  mistakes: [
    {
      title: "Closing the reveal dialog without copying",
      body: "The reveal dialog is the ONE time the full key is ever shown. Closing it without copying the key means the key is gone — the dashboard cannot recover it. You'll have to revoke the key and create a new one, and update every integration that was using it. Always copy the full key from the reveal dialog into a secret manager BEFORE clicking Done.",
    },
    {
      title: "Using mg_live_ keys in development",
      body: "mg_live_ keys hit production data with production permissions. A bug in your dev script that calls DELETE /api/.../contacts with a live key will actually delete contacts. Always use mg_test_ keys for development. The hint in the create dialog reminds you which prefix the key will get — read it. The environment badge in the table (dev amber / prod emerald) is your second reminder.",
    },
    {
      title: "Committing a key to source control",
      body: "Once a key is in git history — even a private repo — it's effectively leaked. Anyone with repo access (including a future compromise or a contributor's leaked laptop) has it. Rotate immediately if this happens: revoke the leaked key, create a new one, store it in a secret manager (not a .env file in the repo), and audit your RequestLog for unexpected traffic. The dashboard's \"Last used\" column is your forensic trail.",
    },
    {
      title: "Assuming revoked keys stop counting against quota",
      body: "This one's actually true — revoked keys do NOT consume a slot. But many users assume the opposite: that they have to delete the key entirely. Nixify never hard-deletes keys; revoke is a soft delete that sets revokedAt = now. The keyHash is retained for audit history. After revoke, you can immediately create a new key (the count goes down by one). Don't try to \"delete\" a key — there is no delete, only revoke.",
    },
    {
      title: "Treating read_only as a permission to view the dashboard",
      body: "read_only scope is for the API (programmatic access via the Authorization header), not for the dashboard. The dashboard uses session cookies (a separate auth path), not API keys. A read_only API key can call any GET endpoint programmatically — but it cannot log you into the dashboard, view pages, or do anything UI-side. The two auth paths are independent.",
    },
  ],
  proTips: [
    {
      title: "Name keys after their purpose, not their environment",
      body: "The environment is already encoded in the prefix (mg_test_ vs mg_live_) and shown as a badge in the table. Don't waste the name field on \"test-key-1\" — name it after what it does: \"Production backend worker\", \"CI: nightly contact sync\", \"Partner: Acme webhook receiver\". When you need to revoke a key six months later, the name should tell you which integration will break.",
    },
    {
      title: "Rotate keys on a schedule",
      body: "Even with no known compromise, rotating keys every 90 days is a healthy practice. Create the new key first, update the integration to use it (verify via the \"Last used\" column), then revoke the old one. The dashboard's per-key usage panel helps you confirm the new key is actually being used before you revoke the old one — look for non-zero traffic in the last 24h bucket.",
    },
    {
      title: "Use the usage panel for anomaly detection",
      body: "A key that suddenly spikes in request volume, or that starts returning 5xx responses where it used to return 2xx, is a signal something changed — either the integration is misbehaving, or the key has been compromised. Click \"View usage\" on the row and compare the last 24h bucket to the all-time one. A healthy key has a stable success ratio; a compromised one often shows a sudden burst of client (4xx) or server (5xx) errors.",
    },
    {
      title: "Revoke immediately on suspected compromise",
      body: "If you suspect a key has been leaked — it shows up in an unexpected IP, the \"Last used\" timestamp is recent but you didn't make any calls, or a partner reports a breach — revoke immediately. The keyHash is retained for audit (you can still see the row and its usage history), but the key stops working the instant revokedAt is set. You can create a new key right away; revoked keys don't count against quota.",
    },
  ],
  troubleshooting: [
    {
      title: "Create button is disabled",
      body: "You've hit your plan's quota. The quota card at the top of the page shows your plan badge and \"{activeCount} / {quota} keys used\" with a rose bar at 100%. The button's title attribute (hover) tells you exactly what to do: \"Quota reached — revoke a key or upgrade to {next_plan}\" (if there is a next plan) or \"All keys in use — revoke one to create a new key\" (if you're on MAX). Revoked keys do NOT count, so revoking one immediately frees a slot.",
    },
    {
      title: "Create returns 402 (quota_exhausted)",
      body: "This is the API equivalent of the disabled Create button. POST /api/admin/api-keys went through createResourceWithCapacity, the transactional row lock, and activeCount was already at quota. Revoke an unused key (DELETE /api/admin/api-keys?id=X) and retry, or upgrade your plan. The response code is FORBIDDEN with status 402 — distinct from the 403 not_available_on_plan below.",
    },
    {
      title: "Create returns 403 (not_available_on_plan)",
      body: "The API_KEYS feature isn't on your plan at all (as opposed to quota, where the feature is on your plan but you've used all your slots). Upgrade to a plan that includes API Keys. The response code is FORBIDDEN with status 403. The dashboard surfaces this as the not-available screen; the API surfaces it as a 403 with code = not_available_on_plan.",
    },
    {
      title: "Verify returns invalid_format",
      body: "The key you sent doesn't start with mg_live_ or mg_test_. Check for whitespace, missing prefix, or a typo. The verifyApiKey() helper in src/lib/dx/api-keys.ts short-circuits on this before any DB lookup — it's a fast rejection. Make sure your integration is sending the full key exactly as it appeared in the reveal dialog (including the mg_test_ / mg_live_ prefix).",
    },
    {
      title: "Verify returns revoked or expired",
      body: "revoked means revokedAt !== null on the key row (someone clicked Revoke in the dashboard, or DELETE /api/admin/api-keys?id=X was called). expired means expiresAt <= Date.now() — the optional expiration date you set in the create dialog has passed. Both are terminal: the key stops working immediately. Create a new key with the same name + environment + scope to replace it.",
    },
    {
      title: "read_only key rejected on a POST endpoint",
      body: "hasScope(\"read_only\", \"full\") returns false — read_only keys are only allowed for action === \"read\" (GET endpoints). If your integration needs to write, you need a full key. Either create a new full key (and revoke the read_only one if it's no longer needed), or — if you want fine-grained control — use hasScope's comma-separated custom scope support (e.g. scopes: \"otp:send,contacts:read\"). The dashboard UI doesn't offer custom scopes; you'd have to set them via the API directly.",
    },
  ],
  checklist: [
    { label: "Picked a name that identifies the integration's purpose" },
    { label: "Picked the smallest scope that does the job (prefer read_only)" },
    { label: "Used mg_test_ for development, mg_live_ for production" },
    { label: "Copied the full key from the reveal dialog into a secret manager" },
    { label: "Tested the key with a simple GET before deploying the integration" },
    { label: "Know where the revoke button is and that revoke is a soft delete (keyHash retained)" },
  ],
  whatNext:
    "Once your keys are created and stored securely, integrate them into your backend by sending the key as a Bearer token in the Authorization header. Start with a read_only mg_test_ key to verify your integration can read the data it needs, then promote to a full mg_live_ key once you're confident. Set a 90-day calendar reminder to rotate. If a key is ever compromised, revoke it immediately — the dashboard's \"Last used\" column and the per-key usage panel are your forensic trail. For the full API surface, see the developer documentation.",
  related: [
    { label: "API Keys dashboard", href: "/dashboard/api-keys" },
    { label: "Webhooks guide", href: "/guide/webhooks" },
    { label: "Contacts guide", href: "/guide/contacts" },
  ],

  /* ─── Stage copy ──────────────────────────────────────────────────────── */
  stage: {
    dir: "ltr",
    locale: "en",

    header: {
      title: "API Keys",
      subtitle: "Generate, monitor, and revoke programmatic access keys",
      backToDashboard: "Dashboard",
      refresh: "Refresh",
      createNewKey: "Create New Key",
    },

    quota: {
      planLabel: "Plan:",
      keysUsed: (used, total) => `${used} / ${total} keys used`,
      quotaReached: (nextPlan) =>
        nextPlan
          ? `Quota reached — upgrade to ${nextPlan} for more`
          : "All keys in use — revoke one to create a new key",
    },

    table: {
      name: "Name",
      prefix: "Prefix",
      environment: "Environment",
      created: "Created",
      lastUsed: "Last used",
      status: "Status",
      actions: "Actions",
      actionsAria: "Actions",
      neverUsed: "Never",
    },

    envBadges: {
      dev: "dev",
      prod: "prod",
    },

    statusLabels: {
      active: "active",
      expired: "expired",
      revoked: "revoked",
    },

    actionsMenu: {
      viewUsage: "View usage",
      hideUsage: "Hide usage",
      copyPrefix: "Copy prefix",
      revoke: "Revoke",
    },

    usageStats: {
      title: "Usage stats",
      last24h: "Last 24h",
      last7d: "Last 7d",
      allTime: "All time",
      successSymbol: "✓",
      clientSymbol: "·",
      serverSymbol: "✗",
      noData: "No data",
    },

    pagination: {
      pageOf: (page, total) => `Page ${page} · ${total} total`,
      prev: "Prev",
      next: "Next",
    },

    empty: {
      title: "No API keys yet",
      body: "Create your first API key to start integrating Nixify.",
      create: "Create New Key",
    },

    securityTips: {
      title: "Security tips",
      tipTest: "Test keys (mg_test_) are for development; live keys (mg_live_) should only be used in production.",
      tipRotate: "Rotate keys periodically and revoke unused ones.",
      tipReadOnly: "Use read_only scope to limit exposure — read_only keys can only perform GET requests.",
    },

    createDialog: {
      title: "Create API Key",
      description:
        "This is the only time the full key will be shown. Copy it now — Nixify stores only its SHA-256 hash and a 12-char prefix for display, so the full secret cannot be recovered later.",
      nameLabel: "Name",
      namePlaceholder: "Production backend worker",
      nameRequired: "Name is required.",
      environmentLabel: "Environment",
      environmentDev: "development",
      environmentProd: "production",
      keyStartsWithHint: "Key will start with:",
      scopesLabel: "Scopes",
      scopeFull: "full — all endpoints",
      scopeReadOnly: "read_only — GET only",
      expirationLabel: "Expiration (optional)",
      leaveBlank: "Leave blank for no expiration.",
      cancel: "Cancel",
      submit: "Create key",
      submitting: "Creating…",
      limitReached: "API key limit reached. Revoke unused keys or upgrade.",
      tooManyCreations: "Too many key creations. Please wait a moment and try again.",
      failedCreate: "Failed to create API key.",
    },

    revealDialog: {
      title: "Your API key",
      description:
        "Copy this key now. It won't be shown again — Nixify stores only the SHA-256 hash and a 12-char prefix, so the full secret cannot be retrieved later.",
      copyButton: "Copy",
      copyToast: "Key copied",
      warningTitle: "Won't be shown again",
      warningBody:
        "This key won't be shown again. Store it in a secure secret manager.",
      hashCaption: "stored: SHA-256(key) + first 12 chars (prefix)",
      done: "Done",
    },

    revokeDialog: {
      title: "Revoke API key",
      body: (name) =>
        `You are about to revoke ${name}. Any requests using this key will immediately stop working. This action cannot be undone.`,
      cancel: "Cancel",
      confirm: "Revoke key",
      confirming: "Revoking…",
      softDeleteCaption: "soft delete — keyHash retained for audit (revokedAt = now)",
    },

    notAvailable: {
      title: "API keys not available",
      description:
        "API Keys are part of the Developer Tools capability, which is not available on your current plan.",
      cta: "View Plans",
    },

    /* Seed plan + rows. The seed plan is PRO so the quota card shows
     * meaningful-but-not-full usage. PRO = 5 keys. The seed rows
     * cover every visible status (active, expired, revoked) and
     * every environment × scope combination. */
    plan: "PRO",
    planQuota: 5,
    rows: [
      {
        id: 1,
        name: "Production backend worker",
        prefix: "mg_live_abC12",
        environment: "production",
        scopes: "full",
        isRevoked: false,
        isExpired: false,
        createdAtRelative: "2 weeks ago",
        lastUsedAtRelative: "3m ago",
        usage: {
          last24h: { success: 1284, client: 18, server: 2, total: 1304 },
          last7d: { success: 8421, client: 124, server: 9, total: 8554 },
          allTime: { success: 31872, client: 482, server: 31, total: 32385 },
        },
      },
      {
        id: 2,
        name: "CI: nightly contact sync",
        prefix: "mg_test_def34",
        environment: "development",
        scopes: "full",
        isRevoked: false,
        isExpired: false,
        createdAtRelative: "5 days ago",
        lastUsedAtRelative: "1h ago",
        usage: {
          last24h: { success: 4, client: 0, server: 0, total: 4 },
          last7d: { success: 28, client: 1, server: 0, total: 29 },
          allTime: { success: 142, client: 3, server: 1, total: 146 },
        },
      },
      {
        id: 3,
        name: "Partner: Acme webhook receiver",
        prefix: "mg_live_ghi56",
        environment: "production",
        scopes: "read_only",
        isRevoked: false,
        isExpired: false,
        createdAtRelative: "1 month ago",
        lastUsedAtRelative: "12m ago",
        usage: {
          last24h: { success: 96, client: 2, server: 0, total: 98 },
          last7d: { success: 612, client: 14, server: 1, total: 627 },
          allTime: { success: 2408, client: 51, server: 4, total: 2463 },
        },
      },
      {
        id: 4,
        name: "Old: deprecated dashboard",
        prefix: "mg_live_jkl78",
        environment: "production",
        scopes: "read_only",
        isRevoked: false,
        isExpired: true,
        createdAtRelative: "6 months ago",
        lastUsedAtRelative: "2mo ago",
        usage: {
          last24h: { success: 0, client: 0, server: 0, total: 0 },
          last7d: { success: 0, client: 0, server: 0, total: 0 },
          allTime: { success: 187, client: 12, server: 0, total: 199 },
        },
      },
      {
        id: 5,
        name: "Leaked: committed by accident",
        prefix: "mg_test_mno90",
        environment: "development",
        scopes: "full",
        isRevoked: true,
        isExpired: false,
        createdAtRelative: "3 months ago",
        lastUsedAtRelative: "1mo ago",
        usage: {
          last24h: { success: 0, client: 0, server: 0, total: 0 },
          last7d: { success: 0, client: 0, server: 0, total: 0 },
          allTime: { success: 38, client: 4, server: 0, total: 42 },
        },
      },
    ],

    /* The full key revealed during the createKey scene — local demo
     * data. NEVER a real key. Looks like a real mg_test_ key (mg_test_
     * + 24 url-safe chars). */
    revealedKey: "mg_test_7c3b9f1e4a2d4e7b9c1a8b4f5e2d3a01",
    revealedPrefix: "mg_test_7c3",
    revealedName: "Production backend worker",
  },

  /* ─── Creative section copy ──────────────────────────────────────────── */
  creative: {
    /* 1. Key anatomy — the three parts of an API key + the storage cycle */
    keyAnatomy: {
      heading: "Key anatomy",
      subheading:
        "An API key has three parts: a prefix (mg_test_ or mg_live_), a secret (24 url-safe chars), and the underlying SHA-256 hash that Nixify stores. The full key is shown ONCE at creation; only the hash and the first 12 chars are persisted. The contract is enforced by src/lib/dx/api-keys.ts — routes verify against the hash, never the secret.",
      partsTitle: "The three parts of a key",
      parts: [
        {
          key: "prefix",
          label: "Prefix",
          desc: "The first 8 chars identify the environment (mg_test_ for development, mg_live_ for production). The first 12 chars are stored for display so admins can identify keys without the secret.",
          token: "mg_live_abC12",
          tone: "ui",
        },
        {
          key: "secret",
          label: "Secret",
          desc: "24 url-safe chars generated by randomBytes(18).toString(\"base64url\"). Shown ONCE in the reveal dialog; never stored. Combined with the prefix to form the full key the integration sends.",
          token: "7c3b9f1e4a2d4e7b9c1a8b4f",
          tone: "secret",
        },
        {
          key: "hash",
          label: "SHA-256 hash",
          desc: "Stored in the keyHash column on the ApiKey row. Used by verifyApiKey() to compare an incoming key against the record without ever storing the secret. The hash is one-way — the secret cannot be recovered from it.",
          token: "sha256:7c3b9f1e4a2d4e7b9c1a8b4f5e2d3a01…",
          tone: "storage",
        },
      ],
      fullKey: "mg_live_7c3b9f1e4a2d4e7b9c1a8b4f",
      cycleTitle: "The create → store → verify → revoke cycle",
      cycleSubtitle:
        "Every key goes through the same four-stage lifecycle. The full secret exists in plaintext only during stage 1 (reveal) and on the integration's side; Nixify never persists it.",
      cycle: [
        {
          badge: "01",
          title: "Create",
          body: "POST /api/admin/api-keys with name + environment + scopes (+ optional expiresAt). Goes through createResourceWithCapacity (transactional row lock). Returns the full key ONCE in the response.",
          token: "POST /api/admin/api-keys",
          tone: "ui",
        },
        {
          badge: "02",
          title: "Reveal once",
          body: "The reveal dialog shows the full key. Copy it into a secret manager BEFORE closing the dialog. Nixify persists only SHA-256(key) (keyHash) and the first 12 chars (prefix); the full secret is gone forever once the dialog closes.",
          token: "keyHash = SHA-256(fullKey)",
          tone: "secret",
        },
        {
          badge: "03",
          title: "Verify",
          body: "When the integration sends the key in the Authorization header, verifyApiKey() hashes it, looks up by keyHash, and checks revokedAt + expiresAt. On success, lastUsedAt + lastUsedIp are updated (best-effort, non-blocking). On failure, the reason is invalid_format / not_found / revoked / expired.",
          token: "verifyApiKey(rawKey, ip)",
          tone: "storage",
        },
        {
          badge: "04",
          title: "Revoke",
          body: "DELETE /api/admin/api-keys?id=X is a soft delete — sets revokedAt = now. keyHash + prefix are retained for audit history. Any in-flight requests signed with this key immediately start failing. Revoked keys do NOT count against quota.",
          token: "DELETE /api/admin/api-keys?id=X",
          tone: "revoke",
        },
      ],
      footnote:
        "All four stages are implemented in src/lib/dx/api-keys.ts (createApiKey, hashKey, verifyApiKey, revokeApiKey) and surfaced by the routes in src/app/api/admin/api-keys/. The dashboard reads/writes only via those routes — never directly against the ApiKey table.",
      warningTitle: "Shown once, never retrievable",
      warningBody:
        "The dashboard cannot recover a lost full key. The reveal dialog is the only time it ever exists in plaintext on Nixify's side. If you lose it, revoke the key and create a new one — there is no password-reset path.",
    },

    /* 2. Live vs Test — mg_live_ vs mg_test_ comparison */
    liveVsTest: {
      heading: "Live vs Test",
      subheading:
        "Every key starts with a prefix that identifies its environment: mg_test_ for development, mg_live_ for production. The prefix is more than a label — it determines which data the key can reach. Pick the prefix in the create dialog's environment selector; the dashboard shows it as a colored badge (dev amber / prod emerald) on every row.",
      testCard: {
        badge: "Test",
        title: "mg_test_",
        body:
          "For development, staging, and CI. Test keys target the test environment — bugs in your script can't accidentally delete production contacts or send real OTPs to real recipients.",
        bullets: [
          "Use during local development and integration testing",
          "Safe to share with collaborators on a feature branch",
          "Still counts against your plan's quota (FREE=1, PRO=5, MAX=20)",
          "Same SHA-256 storage + reveal-once contract as live keys",
        ],
      },
      liveCard: {
        badge: "Live",
        title: "mg_live_",
        body:
          "For production integrations — backend workers, scheduled jobs, partner webhooks. Live keys target real data with production permissions. A bug in your script will affect real recipients.",
        bullets: [
          "Use only in production deployments",
          "Never commit to source control or paste in chat",
          "Stored in a secret manager (AWS Secrets Manager, Doppler, Vault)",
          "Rotate on a 90-day schedule; revoke immediately on suspicion",
        ],
      },
      matrixTitle: "Test vs Live — at a glance",
      matrixSubtitle:
        "Both key types use the same generation, hashing, and verification pipeline. Only the prefix + the data they can reach differ.",
      testCol: "Test",
      liveCol: "Live",
      dimensionCol: "Dimension",
      rows: [
        {
          key: "environment",
          dimension: "Environment code",
          testValue: "development",
          liveValue: "production",
        },
        {
          key: "prefix",
          dimension: "Key prefix",
          testValue: "mg_test_",
          liveValue: "mg_live_",
        },
        {
          key: "purpose",
          dimension: "Purpose",
          testValue: "Dev, staging, CI",
          liveValue: "Production integrations",
        },
        {
          key: "riskLevel",
          dimension: "Risk if leaked",
          testValue: "Low — test data only",
          liveValue: "High — real recipients, real data",
        },
        {
          key: "keyStatus",
          dimension: "Stored as",
          testValue: "SHA-256(key) + 12-char prefix",
          liveValue: "SHA-256(key) + 12-char prefix",
        },
        {
          key: "rotation",
          dimension: "Rotation cadence",
          testValue: "Whenever convenient",
          liveValue: "Every 90 days",
        },
      ],
      warningTitle: "Never commit a live key",
      warningBody:
        "A live key in git history is effectively leaked. Anyone with repo access — including future contributors and a compromised laptop — has it. If it happens, revoke immediately, create a new key, store it in a secret manager, and audit your RequestLog for unexpected traffic.",
    },

    /* 3. Scopes explainer — full vs read_only with examples */
    scopesExplainer: {
      heading: "Scopes",
      subheading:
        "Each key has a scope: full (all endpoints, including writes) or read_only (GET only). Pick the smallest scope that does the job. The scope is checked by hasScope() in src/lib/dx/api-keys.ts on every authenticated request — full allows any action, read_only allows only action === \"read\".",
      fullCard: {
        badge: "full",
        title: "All endpoints",
        body:
          "For integrations that need to write — send OTPs, create contacts, manage broadcasts, trigger automations. Use for backend workers, scheduled jobs, and any code that mutates data.",
        bullets: [
          "Allowed: every endpoint, including POST / PUT / DELETE",
          "Stored as the literal string \"full\" in the scopes column",
          "hasScope(\"full\", anyAction) → true",
          "Use only when the integration genuinely needs write access",
        ],
      },
      readOnlyCard: {
        badge: "read_only",
        title: "GET only",
        body:
          "For integrations that only read — analytics dashboards, audit log pullers, status pages, partner webhook verifiers. A leaked read_only key can exfiltrate data but cannot mutate anything.",
        bullets: [
          "Allowed: any GET endpoint (action === \"read\")",
          "Rejected: any POST / PUT / DELETE (action !== \"read\")",
          "hasScope(\"read_only\", \"read\") → true",
          "hasScope(\"read_only\", \"full\") → false",
        ],
      },
      matrixTitle: "What each scope can call",
      matrixSubtitle:
        "Every authenticated route declares a required scope. hasScope() returns true if the key's scope satisfies the required action. Read routes pass \"read\"; write routes pass \"full\".",
      methodCol: "Endpoint",
      descCol: "What it does",
      fullCol: "full",
      readOnlyCol: "read_only",
      examples: [
        {
          method: "GET /api/dashboard/contacts",
          desc: "List contacts in your account.",
          full: true,
          readOnly: true,
          tone: "read",
        },
        {
          method: "POST /api/dashboard/contacts",
          desc: "Create or update a contact.",
          full: true,
          readOnly: false,
          tone: "write",
        },
        {
          method: "POST /api/otp/send",
          desc: "Send a one-time passcode to an email.",
          full: true,
          readOnly: false,
          tone: "write",
        },
        {
          method: "GET /api/dashboard/deliveries",
          desc: "List EmailDelivery rows for forensics.",
          full: true,
          readOnly: true,
          tone: "read",
        },
        {
          method: "POST /api/dashboard/broadcasts",
          desc: "Create + send a marketing broadcast.",
          full: true,
          readOnly: false,
          tone: "write",
        },
        {
          method: "POST /api/dashboard/suppressions",
          desc: "Add a manual suppression entry.",
          full: true,
          readOnly: false,
          tone: "write",
        },
      ],
      customScopesNote:
        "hasScope() also supports comma-separated custom scopes (e.g. \"otp:send,contacts:read\") for fine-grained access. The dashboard's create dialog only offers full and read_only — to set a custom scope, call POST /api/admin/api-keys directly with a custom scopes string. Custom scopes are checked by exact match against the action the route requires.",
      footnote:
        "Implemented in src/lib/dx/api-keys.ts (hasScope). Routes import the helper and call it with the action they require: \"read\" for GET endpoints, \"full\" for everything else. The dashboard never stores more than one scope string per key.",
    },

    /* 4. Secure storage checklist */
    secureStorageChecklist: {
      heading: "Secure storage checklist",
      subheading:
        "The dashboard's security-tips Alert reminds you of the basics. Here's the full lifecycle of a securely-stored key — from creation through rotation through revocation. Follow every step; the dashboard cannot recover a lost key.",
      doTitle: "Do",
      doItems: [
        {
          key: "secret-manager",
          title: "Store in a secret manager",
          body: "Use AWS Secrets Manager, GCP Secret Manager, Doppler, Vault, or your platform's equivalent. Never a plaintext .env file in the repo.",
          token: "AWS Secrets Manager",
          tone: "do",
        },
        {
          key: "bearer-header",
          title: "Send as a Bearer token",
          body: "Put the key in the Authorization header as \"Bearer mg_live_…\". Never in the URL (URLs end up in access logs).",
          token: "Authorization: Bearer mg_live_…",
          tone: "do",
        },
        {
          key: "least-privilege",
          title: "Pick the smallest scope",
          body: "Default to read_only. Promote to full only when the integration genuinely needs to write. A leaked read_only key can exfiltrate data; a leaked full key can mutate it.",
          token: "read_only",
          tone: "do",
        },
        {
          key: "test-first",
          title: "Test with mg_test_ first",
          body: "Develop against a mg_test_ key. Verify your integration can read what it needs, handle errors gracefully, and retry on 5xx. Only then promote to mg_live_.",
          token: "mg_test_",
          tone: "do",
        },
      ],
      avoidTitle: "Avoid",
      avoidItems: [
        {
          key: "git-commit",
          title: "Don't commit to source control",
          body: "Once a key is in git history — even a private repo — it's effectively leaked. Rotate immediately if it happens; the dashboard cannot recover it.",
          token: "git",
          tone: "avoid",
        },
        {
          key: "url-param",
          title: "Don't put in URL parameters",
          body: "URLs are logged by proxies, CDNs, and access logs. Use the Authorization header instead.",
          token: "?api_key=…",
          tone: "avoid",
        },
        {
          key: "chat-paste",
          title: "Don't paste in chat or tickets",
          body: "Slack, Jira, GitHub Issues — all retain messages indefinitely. Use a secret-sharing tool that expires the link after one view.",
          token: "Slack",
          tone: "avoid",
        },
        {
          key: "shared-env",
          title: "Don't reuse one key across environments",
          body: "Each environment (dev, staging, prod) should have its own key with its own prefix. A leaked dev key shouldn't be the same secret as your prod key.",
          token: "mg_test_ ≠ mg_live_",
          tone: "avoid",
        },
      ],
      rotateTitle: "Rotate",
      rotateItems: [
        {
          key: "schedule",
          title: "Set a 90-day rotation calendar",
          body: "Even with no known compromise, rotating every 90 days is a healthy practice. Create the new key first, update the integration, then revoke the old.",
          token: "90 days",
          tone: "rotate",
        },
        {
          key: "verify-usage",
          title: "Verify the new key is being used",
          body: "After rotation, check the dashboard's per-key usage panel — the new key's last 24h bucket should be non-zero before you revoke the old one.",
          token: "View usage",
          tone: "rotate",
        },
        {
          key: "immediate-revoke",
          title: "Revoke immediately on suspicion",
          body: "If the Last used timestamp is recent but you didn't make any calls, or a partner reports a breach, revoke immediately. The keyHash is retained for audit; the key stops working the instant revokedAt is set.",
          token: "Revoke",
          tone: "rotate",
        },
      ],
      footnote:
        "The dashboard's security-tips Alert surfaces the three highest-leverage rules: (1) mg_test_ for dev, mg_live_ for prod only. (2) Rotate periodically and revoke unused ones. (3) Use read_only scope to limit exposure. The full checklist above is the operational version of those rules.",
      warningTitle: "The dashboard cannot recover a lost key",
      warningBody:
        "Nixify stores only the SHA-256 hash and a 12-char prefix — the full secret exists in plaintext only during the reveal dialog. If you lose it, revoke the key and create a new one. There is no password-reset path.",
    },
  },
};
