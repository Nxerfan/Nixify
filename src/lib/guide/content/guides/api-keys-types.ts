/**
 * UX-B: API Keys guide — stage + creative copy types.
 *
 * The API Keys guide is the eighth guide in the UX-B contextual guide
 * system, after Contacts, Branding, Automations, Templates, Broadcasts,
 * Suppressions, and Emails. It mirrors the REAL Nixify API Keys page at:
 *   - src/app/dashboard/api-keys/page.tsx          (~779 lines, full UI)
 *
 * Architecture rules (REGRESSION-PROTECTED):
 *   - The stage + creative copy are guide-specific types defined here, but
 *     they all share the common GuideContentBase fields (chapters,
 *     writtenSteps, etc.) defined in ../types.
 *   - Each content dictionary (api-keys-en.ts, api-keys-fa.ts) exports an
 *     ApiKeysGuideContent that the view component consumes directly.
 *     (ApiKeysGuideContent = GuideContentBase & { stage, creative } — i.e.
 *     it satisfies GuideContentBase, just with the unknown stage/creative
 *     slots narrowed to typed shapes.)
 *   - Technical tokens (key prefixes like `mg_test_` and `mg_live_`, full
 *     keys like `mg_live_abC12...`, hash placeholders like
 *     `sha256:7c3b9f1e...`, numeric key IDs, ISO timestamps, scope codes
 *     like `full` / `read_only`, environment codes like `development` /
 *     `production`, plan codes like `FREE` / `PRO` / `MAX`, HTTP method
 *     names, file paths) stay LTR via <Ltr> at render time. They are stored
 *     as raw strings here.
 *   - The stage reads `dir` from the copy (ltr for en, rtl for fa) and is
 *     NOT permanently `dir="ltr"`.
 *
 * Source-of-truth UI audit (verbatim labels from the real API Keys page,
 * src/app/dashboard/api-keys/page.tsx — 779 lines):
 *
 *   HEADER:
 *   - Ghost "Back to Dashboard" link (ArrowLeft icon, ghost button).
 *   - h1 "API Keys" with emerald KeyRound icon (h-6 w-6 text-emerald-600).
 *   - Subtitle "Generate, monitor, and revoke programmatic access keys".
 *   - Outline Refresh button (RefreshCw icon, spins while loading).
 *   - Emerald "Create New Key" button (Plus icon, bg-emerald-600).
 *     Disabled when quotaReached; title attribute explains why.
 *
 *   QUOTA CARD (border-emerald-500/20):
 *   - "Plan: " label + outline Badge with the plan code (FREE / PRO / MAX).
 *   - "{activeCount} / {quota} keys used" — count of non-revoked keys
 *     over the plan's quota.
 *   - Quota-reached amber/rose message ("Quota reached — upgrade to PRO
 *     for more" / "All keys in use — revoke one to create a new key").
 *   - Bar (h-2, rounded-full): emerald under 80%, amber 80–99%, rose 100%.
 *
 *   KEYS TABLE (Card with sticky header):
 *   - Columns: Name (KeyRound icon + name + scopes subline), Prefix
 *     (`<code dir="ltr">` truncated with `…`), Environment (dev/prod
 *     badge), Created (relative), Last Used (relative or "Never"),
 *     Status (active/expired/revoked badge), Actions (MoreHorizontal
 *     dropdown).
 *   - Per-row dropdown: "View usage" / "Hide usage" (Activity icon),
 *     "Copy prefix" (Copy icon), "Revoke" (Trash2, destructive, disabled
 *     if isRevoked).
 *   - Expanded usage panel: 3 buckets (last 24h, last 7d, all time),
 *     each showing total + ✓success / ·client (4xx) / ✗server (5xx).
 *   - Status badges: active = emerald, expired = amber, revoked = rose.
 *   - Environment badges: prod = emerald, dev = amber.
 *
 *   EMPTY STATE (no keys yet):
 *   - Dashed-border Card, emerald KeyRound icon tile.
 *   - "No API keys yet" + "Create your first API key to start
 *     integrating Nixify." + emerald "Create New Key" button.
 *
 *   SECURITY TIPS ALERT (emerald, below the table):
 *   - "Security tips" (AlertTriangle icon).
 *   - Bullets:
 *     · "Test keys (mg_test_) are for development; live keys (mg_live_)
 *       should only be used in production."
 *     · "Rotate keys periodically and revoke unused ones."
 *     · "Use read_only scope to limit exposure — read_only keys can only
 *       perform GET requests."
 *
 *   CREATE DIALOG (Dialog, sm:max-w-md):
 *   - Title: emerald Plus icon + "Create API Key".
 *   - Description: secretWarning (the full key is shown ONCE — store it).
 *   - Name input (placeholder from namePlaceholder).
 *   - Environment Select: "development" / "production". Hint: "Key will
 *     start with `mg_test_` / `mg_live_`" (LTR code).
 *   - Scopes Select: "full — all endpoints" / "read_only — GET only".
 *   - Expiration date input (optional, "Leave blank for no expiration").
 *   - Form error box (rose) if create fails.
 *   - Cancel + emerald "Create key" (disabled while creating or if name
 *     is empty).
 *
 *   REVEAL DIALOG (Dialog, sm:max-w-lg, showCloseButton=false):
 *   - Title: emerald CheckCircle2 icon + "Your API key".
 *   - Description: copyNowWarning (copy now, won't be shown again).
 *   - Full key in `<code dir="ltr">` (truncate) + outline Copy button.
 *   - Amber Alert: "This key won't be shown again. Store it in a secure
 *     secret manager."
 *   - Emerald "Done" button (closes the dialog).
 *
 *   REVOKE CONFIRMATION (AlertDialog):
 *   - Title: "Revoke API key".
 *   - Description: "You are about to revoke {name}. Any requests using
 *     this key will immediately stop working. This action cannot be
 *     undone."
 *   - Cancel + rose "Revoke key" / "Revoking…" (when revoking).
 *
 *   PLAN QUOTAS (verbatim from PLAN_QUOTA in the page):
 *     - FREE: 1 key.
 *     - PRO:  5 keys.
 *     - MAX:  20 keys.
 *   NEXT_PLAN: FREE → PRO → MAX → null.
 *
 *   AUTH / ENTITLEMENT (audited from src/app/api/admin/api-keys/route.ts):
 *   - resolveRequester() accepts admin (getAdmin cookie) OR authenticated
 *     user (session cookie). 401 means login required.
 *   - GET returns the user's own keys; admin sees all keys (including
 *     system keys with userId=null).
 *   - POST goes through createResourceWithCapacity (transactional,
 *     concurrency-safe row lock) — the API_KEYS feature is a resource
 *     cardinality limit, NOT monthly quota. Revoked keys do NOT consume
 *     a slot.
 *   - 402 → "API key limit reached. Revoke unused keys or upgrade."
 *     (quota_exhausted).
 *   - 403 → "API keys are not available on your plan."
 *     (not_available_on_plan).
 *   - DELETE: soft delete (sets revokedAt = now, retains keyHash for
 *     audit history). User can only revoke own keys (ownership check);
 *     admin bypasses.
 *   - GET /api/admin/api-keys/usage?id=X returns 2xx/4xx/5xx buckets
 *     for last 24h, last 7d, all time. Powers the per-row usage panel.
 *
 *   KEY GENERATION (audited from src/lib/dx/api-keys.ts):
 *   - Format: `mg_live_<24 url-safe chars>` (production) or
 *     `mg_test_<24 url-safe chars>` (development).
 *   - secret = randomBytes(18).toString("base64url") — ~24 chars.
 *   - keyHash = SHA-256(fullKey).digest("hex"). Stored.
 *   - prefix = fullKey.slice(0, 12) — e.g. `mg_live_abC12`. Stored for
 *     display so admins can identify keys without the secret.
 *   - verifyApiKey(rawKey): rejects if !startsWith("mg_live_") &&
 *     !startsWith("mg_test_") (invalid_format); looks up by keyHash
 *     (not_found); rejects if revokedAt is set (revoked); rejects if
 *     expiresAt <= Date.now() (expired). On success, updates
 *     lastUsedAt + lastUsedIp (best-effort, non-blocking).
 *   - hasScope(scopes, action): "full" → all actions allowed;
 *     "read_only" → only action === "read" allowed; otherwise the
 *     string is split on "," and the action must be in the resulting
 *     list (comma-separated custom scopes).
 *
 *   REAL API ENDPOINTS (NOT called from the stage — for teaching only):
 *   GET    /api/admin/api-keys                       (list)
 *   POST   /api/admin/api-keys                       (create — returns full key ONCE)
 *   DELETE /api/admin/api-keys?id=X                  (revoke — soft delete)
 *   GET    /api/admin/api-keys/usage?id=X            (usage buckets)
 */

import type { GuideContentBase } from "../types";

/* ─── Stage copy ────────────────────────────────────────────────────────── */

/** Environment codes an ApiKey.environment can hold today. */
export type ApiKeyEnvironment = "development" | "production";

/** Scope codes supported by the dashboard's create dialog. Custom
 * comma-separated strings are supported by hasScope() but the UI only
 * offers these two. */
export type ApiKeyScope = "full" | "read_only";

/** Plan codes — drive the active-key quota (FREE=1, PRO=5, MAX=20). */
export type ApiKeyPlan = "FREE" | "PRO" | "MAX";

/** The derived status of a key, as the dashboard computes it:
 *   - active   (not revoked, not expired)
 *   - expired  (expiresAt <= Date.now())
 *   - revoked  (revokedAt !== null)
 * The dashboard evaluates them in that order — revoked wins over
 * expired (a revoked-but-also-expired key shows "revoked"). */
export type ApiKeyStatus = "active" | "expired" | "revoked";

/** A single usage bucket shown in the per-row usage panel.
 * Mirrors the shape returned by GET /api/admin/api-keys/usage. */
export interface ApiKeyUsageBucket {
  /** 2xx responses count. */
  success: number;
  /** 4xx responses count. */
  client: number;
  /** 5xx responses count. */
  server: number;
  /** Sum of all status codes (success + client + server; we don't emit 3xx). */
  total: number;
}

/** A single simulated API key row shown in the list. Local demo data
 * only — the stage NEVER calls /api/admin/api-keys. The seed rows
 * cover every visible status (active, expired, revoked) and every
 * environment × scope combination. */
export interface ApiKeysStageRow {
  /** Stable numeric ID (for React keys + highlighting). */
  id: number;
  /** Human-friendly name — localizable; the dashboard stores it as-is. */
  name: string;
  /** Key prefix (first 12 chars of the full key) — LTR token (e.g. "mg_live_abC12"). */
  prefix: string;
  /** Environment code — LTR token. */
  environment: ApiKeyEnvironment;
  /** Scope code — LTR token. */
  scopes: ApiKeyScope;
  /** Whether the key has been revoked (revokedAt !== null). */
  isRevoked: boolean;
  /** Whether the key has expired (expiresAt <= Date.now()). */
  isExpired: boolean;
  /** Created-at relative time string — LTR token (e.g. "2h ago"). */
  createdAtRelative: string;
  /** Last-used relative time string, or null if never used — LTR token. */
  lastUsedAtRelative: string | null;
  /** Optional seed usage stats — only populated on the row(s) the stage
   * is teaching about at any given scene. Local demo data only. */
  usage?: {
    last24h: ApiKeyUsageBucket;
    last7d: ApiKeyUsageBucket;
    allTime: ApiKeyUsageBucket;
  };
}

export interface ApiKeysStageCopy {
  /** Direction the simulated product chrome should render in. */
  dir: "ltr" | "rtl";
  /** Active locale code for the stage (matches the surrounding page). */
  locale: "en" | "fa";

  /** Header copy — mirrors the real page's header verbatim. */
  header: {
    title: string;                 // "API Keys"
    subtitle: string;              // "Generate, monitor, and revoke programmatic access keys"
    backToDashboard: string;       // "Dashboard" (the ghost link label)
    refresh: string;               // "Refresh"
    createNewKey: string;          // "Create New Key"
  };

  /** Quota card copy — the emerald-bordered plan/usage strip. */
  quota: {
    planLabel: string;             // "Plan:"
    keysUsed: (used: number, total: number) => string;  // "{used} / {total} keys used"
    /** Shown when quota is reached. The argument is the next plan code
     * (or null when already on the top plan). */
    quotaReached: (nextPlan: ApiKeyPlan | null) => string;
  };

  /** Table header labels. */
  table: {
    name: string;
    prefix: string;
    environment: string;
    created: string;
    lastUsed: string;
    status: string;
    actions: string;
    actionsAria: string;
    /** "Never" — shown in the Last Used column when lastUsedAt is null. */
    neverUsed: string;
  };

  /** Environment badge labels — short codes shown in the table column. */
  envBadges: {
    dev: string;                   // "dev"
    prod: string;                  // "prod"
  };

  /** Status badge labels — driven by isRevoked / isExpired. */
  statusLabels: Record<ApiKeyStatus, string>;

  /** Per-row actions dropdown. */
  actionsMenu: {
    viewUsage: string;             // "View usage"
    hideUsage: string;             // "Hide usage"
    copyPrefix: string;            // "Copy prefix"
    revoke: string;                // "Revoke"
  };

  /** Usage panel copy (shown when a row's usage panel is expanded). */
  usageStats: {
    title: string;                 // "Usage stats"
    last24h: string;               // "Last 24h"
    last7d: string;                // "Last 7d"
    allTime: string;               // "All time"
    /** Symbol prefix for 2xx (success) — shown in the breakdown. */
    successSymbol: string;         // "✓"
    /** Symbol prefix for 4xx (client errors) — shown in the breakdown. */
    clientSymbol: string;          // "·"
    /** Symbol prefix for 5xx (server errors) — shown in the breakdown. */
    serverSymbol: string;          // "✗"
    /** Shown when the usage endpoint returned no data / errored. */
    noData: string;
  };

  /** Pagination strip (decorative — the seed list is short). */
  pagination: {
    pageOf: (page: number, total: number) => string;
    prev: string;
    next: string;
  };

  /** Empty-state card copy (no keys yet). */
  empty: {
    title: string;                 // "No API keys yet"
    body: string;                  // "Create your first API key to start integrating Nixify."
    create: string;                // "Create New Key"
  };

  /** Security tips Alert (emerald) shown below the table. */
  securityTips: {
    title: string;                 // "Security tips"
    /** The three tips shown as bullets. Each tip is a localized string.
     * The LTR tokens (mg_test_, mg_live_, read_only) are interpolated at
     * render time via <Ltr> in the stage component. The string accepts
     * a `{prefix1}` / `{prefix2}` / `{scope}` placeholder the stage
     * replaces with the LTR-wrapped token. */
    tipTest: string;              // tip about mg_test_ vs mg_live_
    tipRotate: string;            // tip about rotation
    tipReadOnly: string;          // tip about read_only scope
  };

  /** Create Dialog copy. */
  createDialog: {
    title: string;                 // "Create API Key"
    description: string;           // secret warning — the full key is shown ONCE.
    nameLabel: string;             // "Name"
    namePlaceholder: string;       // "Production backend worker"
    nameRequired: string;          // "Name is required."
    environmentLabel: string;     // "Environment"
    environmentDev: string;        // "development"
    environmentProd: string;       // "production"
    /** Hint shown under the environment select. The LTR token (mg_test_
     * or mg_live_) is rendered as a separate mono code element after
     * this label string — see the stage component. */
    keyStartsWithHint: string;  // "Key will start with:"
    scopesLabel: string;           // "Scopes"
    scopeFull: string;             // "full — all endpoints"
    scopeReadOnly: string;         // "read_only — GET only"
    expirationLabel: string;       // "Expiration (optional)"
    leaveBlank: string;            // "Leave blank for no expiration."
    cancel: string;                // "Cancel"
    submit: string;                // "Create key"
    submitting: string;             // "Creating…"
    /** 402 — quota reached. */
    limitReached: string;
    /** 429 — too many creations in a short window. */
    tooManyCreations: string;
    /** Generic failure. */
    failedCreate: string;
  };

  /** Reveal Dialog copy — shown ONCE after a successful create. */
  revealDialog: {
    title: string;                 // "Your API key"
    description: string;           // copyNowWarning — copy now, won't be shown again.
    copyButton: string;            // "Copy"
    copyToast: string;             // "Key copied"
    warningTitle: string;          // (no title in the real UI — we add a short one for teaching)
    warningBody: string;            // "This key won't be shown again. Store it in a secure secret manager."
    done: string;                  // "Done"
    /** LTR caption shown in the simulated reveal dialog reinforcing the
     * storage invariant (SHA-256 hash stored, full key never retrievable). */
    hashCaption: string;
  };

  /** Revoke confirmation AlertDialog copy. */
  revokeDialog: {
    title: string;                 // "Revoke API key"
    /** Body interpolating the key name. The stage renders the name as-is. */
    body: (name: string) => string; // "You are about to revoke {name}. Any requests using this key will immediately stop working. This action cannot be undone."
    cancel: string;                // "Cancel"
    confirm: string;               // "Revoke key"
    confirming: string;             // "Revoking…"
    /** LTR caption shown in the simulated revoke dialog reinforcing that
     * revoke is a soft delete — the keyHash is retained for audit. */
    softDeleteCaption: string;
  };

  /** Not-available screen (403 entitlement — feature not on plan). */
  notAvailable: {
    title: string;                 // "API keys not available"
    description: string;
    cta: string;                   // "View Plans"
  };

  /* ─── Seed data ────────────────────────────────────────────────────────── */

  /** The plan used for the simulated quota card. Drives the quota number
   * shown and the seed-row count. The stage never reads the user's real
   * plan — it uses this seed value for teaching. */
  plan: ApiKeyPlan;
  /** The active-key quota for the seed plan. The stage derives this
   * from PLAN_QUOTA at module-load (kept here so the FA dictionary
   * doesn't have to mirror the table). */
  planQuota: number;
  /** Seed API key rows shown in the simulated list. NEVER fetched from
   * the API. Numbers chosen to exercise every visible status (active,
   * expired, revoked) and every environment × scope combination. */
  rows: ApiKeysStageRow[];
  /** The full key string revealed during the createKey scene — LTR
   * token, looks like `mg_test_<24 url-safe chars>`. NEVER a real key. */
  revealedKey: string;
  /** The prefix of the revealed key (first 12 chars) — LTR token. */
  revealedPrefix: string;
  /** The key name used in the createKey scene's typedText flow. */
  revealedName: string;
}

/* ─── Creative section copy ─────────────────────────────────────────────── */

/* 1. Key anatomy — the three parts of an API key, plus storage + reveal */

export interface KeyAnatomyFieldCopy {
  /** Stable key for React lists. */
  key: "prefix" | "secret" | "hash";
  /** Localized field name (e.g. "Prefix"). */
  label: string;
  /** One-sentence description of what this field is. */
  desc: string;
  /** LTR token shown beside the desc — the actual value pattern. */
  token: string;
  /** Tone — controls the field's accent color. */
  tone: "ui" | "secret" | "storage";
}

export interface KeyAnatomyCopy {
  heading: string;
  subheading: string;
  /** Title for the "three parts of a key" card. */
  partsTitle: string;
  parts: KeyAnatomyFieldCopy[];
  /** The full key string shown decomposed — LTR token. */
  fullKey: string;
  /** Title for the storage + reveal cycle section. */
  cycleTitle: string;
  cycleSubtitle: string;
  /** The four stages of the create → store → verify → revoke cycle. */
  cycle: {
    /** Step badge ("01", "02", ...). */
    badge: string;
    /** Step title. */
    title: string;
    /** Step body. */
    body: string;
    /** Optional LTR token (e.g. "POST /api/admin/api-keys"). */
    token?: string;
    /** Tone — controls color coding. */
    tone: "ui" | "secret" | "storage" | "revoke";
  }[];
  /** Footnote pointing to src/lib/dx/api-keys.ts. */
  footnote: string;
  /** Amber warning reinforcing the "shown once, never retrievable" invariant. */
  warningTitle: string;
  warningBody: string;
}

/* 2. Live vs Test — mg_live_ vs mg_test_ comparison */

export interface LiveVsTestRowCopy {
  /** Stable key. */
  key: "environment" | "prefix" | "purpose" | "riskLevel" | "keyStatus" | "rotation";
  /** Dimension label (e.g. "Environment code"). */
  dimension: string;
  /** Value for the test environment — LTR token if technical. */
  testValue: string;
  /** Value for the live environment — LTR token if technical. */
  liveValue: string;
}

export interface LiveVsTestCopy {
  heading: string;
  subheading: string;
  /** Two side-by-side cards: test (amber) vs live (emerald). */
  testCard: {
    badge: string;                 // "Test"
    title: string;                 // "mg_test_"
    body: string;
    bullets: string[];
  };
  liveCard: {
    badge: string;                 // "Live"
    title: string;                 // "mg_live_"
    body: string;
    bullets: string[];
  };
  /** Comparison matrix. */
  matrixTitle: string;
  matrixSubtitle: string;
  testCol: string;                 // "Test"
  liveCol: string;                 // "Live"
  dimensionCol: string;            // "Dimension"
  rows: LiveVsTestRowCopy[];
  /** Amber warning reinforcing "never commit a live key". */
  warningTitle: string;
  warningBody: string;
}

/* 3. Scopes explainer — full vs read_only with examples */

export interface ScopeExampleCopy {
  /** HTTP method code — LTR token (e.g. "POST /api/.../send"). */
  method: string;
  /** One-sentence description of what the endpoint does. */
  desc: string;
  /** Whether a `full` key can call it. */
  full: boolean;
  /** Whether a `read_only` key can call it. */
  readOnly: boolean;
  /** Tone — controls the row accent color. */
  tone: "read" | "write";
}

export interface ScopesExplainerCopy {
  heading: string;
  subheading: string;
  /** Two cards: full (emerald) vs read_only (sky). */
  fullCard: {
    badge: string;                 // "full"
    title: string;                 // "All endpoints"
    body: string;
    bullets: string[];
  };
  readOnlyCard: {
    badge: string;                 // "read_only"
    title: string;                 // "GET only"
    body: string;
    bullets: string[];
  };
  /** Examples matrix — what each scope can call. */
  matrixTitle: string;
  matrixSubtitle: string;
  methodCol: string;               // "Endpoint"
  descCol: string;                 // "What it does"
  fullCol: string;                 // "full"
  readOnlyCol: string;             // "read_only"
  examples: ScopeExampleCopy[];
  /** Footnote explaining hasScope() supports comma-separated custom scopes too. */
  customScopesNote: string;
  /** Footnote pointing to src/lib/dx/api-keys.ts. */
  footnote: string;
}

/* 4. Secure storage checklist — the lifecycle of a stored key */

export interface SecureStorageItemCopy {
  /** Stable key for React lists. */
  key: string;
  /** Localized imperative title (e.g. "Store in a secret manager"). */
  title: string;
  /** One-sentence elaboration. */
  body: string;
  /** LTR token (e.g. ".env", "AWS Secrets Manager"). Optional. */
  token?: string;
  /** Tone — controls the row accent. */
  tone: "do" | "avoid" | "rotate";
}

export interface SecureStorageChecklistCopy {
  heading: string;
  subheading: string;
  /** Title for the "DO" list. */
  doTitle: string;
  doItems: SecureStorageItemCopy[];
  /** Title for the "AVOID" list. */
  avoidTitle: string;
  avoidItems: SecureStorageItemCopy[];
  /** Title for the rotation row. */
  rotateTitle: string;
  rotateItems: SecureStorageItemCopy[];
  /** Footer reinforcing the security-tips banner from the real page. */
  footnote: string;
  /** Amber warning reinforcing "the dashboard cannot recover a lost key". */
  warningTitle: string;
  warningBody: string;
}

export interface ApiKeysCreativeCopy {
  keyAnatomy: KeyAnatomyCopy;
  liveVsTest: LiveVsTestCopy;
  scopesExplainer: ScopesExplainerCopy;
  secureStorageChecklist: SecureStorageChecklistCopy;
}

/* ─── Combined guide content type ───────────────────────────────────────── */

export type ApiKeysGuideContent = GuideContentBase & {
  stage: ApiKeysStageCopy;
  creative: ApiKeysCreativeCopy;
};
