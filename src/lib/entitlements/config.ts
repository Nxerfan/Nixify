/**
 * ENTITLEMENT LIMITS — the single source of truth for all plan-gated features.
 *
 * To add a new feature:
 *   1. Pick a `featureKey` (string constant below).
 *   2. Add one entry to `FEATURE_LIMITS` with the limits per plan.
 *   3. Call `canAccess()` or `checkUsage()` from your route handler.
 *
 * No route handler should ever hardcode a plan name or limit number.
 *
 * Two entitlement types:
 *   - Access-gated (binary): `access` field — feature is available or not.
 *   - Volume-gated (quota + rate): `quota` (monthly total) + `ratePerMin` fields.
 *
 * MAX "unlimited" values use `Infinity` for business quota. Every `Infinity`
 * has an accompanying `infraCeiling` comment documenting the hard infrastructure
 * limit that prevents abuse. Features where no realistic abuse ceiling exists
 * have an explicit justification comment instead.
 *
 * STATUS LEGEND:
 *   ACTIVE_ENFORCED — checkUsage()/canAccess() (or peekUsage for read-only
 *                    enforcement like AUDIT_LOG_RETENTION) is called from
 *                    a real production route handler or service. The
 *                    Phase 14 production-path tests in
 *                    src/lib/billing/billing.test.ts prove the gate blocks
 *                    or allows mutation at the boundary.
 *   CONFIGURED_ONLY — feature key + limits exist here, but no route checks
 *                     them yet. MUST NOT be claimed as enforced.
 *   FUTURE          — no code exists at all (future feature).
 *
 * PHASE 14 NOTE (Plans, Pricing & Billing):
 *   The marketing/pricing UI (src/lib/pricingData.ts) derives every numeric
 *   limit on every pricing card from this file via `getFeatureQuota()` in
 *   src/lib/billing/plan-catalog.ts. The catalog itself never hardcodes a
 *   quota number. If you change a value here, the pricing card automatically
 *   reflects it. The catalog + tests in src/lib/billing/billing.test.ts are
 *   the drift guard — if the catalog/UI drifts from this config, the tests
 *   fail. There is ONE source of truth for limits: this file.
 */

export type Plan = "FREE" | "PRO" | "MAX";

export const FEATURE_KEYS = {
  API_MESSAGES: "api_messages",
  OTP_EMAILS: "otp_emails",
  EMAIL_TEMPLATES: "email_templates",
  CUSTOM_BRANDING: "custom_branding",
  BRAND_KIT: "brand_kit",
  WEBHOOK_ENDPOINTS: "webhook_endpoints",
  WEBHOOK_RETRIES: "webhook_retries",
  API_KEYS: "api_keys",
  DYNAMIC_THEME_RULES: "dynamic_theme_rules",
  MULTI_LANGUAGE: "multi_language",
  EMAIL_CONTENT: "email_content",
  BRANDING_VISUAL: "branding_visual",
  TEAM_MEMBERS: "team_members",
  AUDIT_LOG_RETENTION: "audit_log_retention",
  // ─── Messaging product expansion ──────────────────────────────────────
  // These are FINAL commercial limits (Phase 14). The pricing UI reads them
  // directly via getFeatureQuota() in src/lib/billing/plan-catalog.ts. They
  // are NOT placeholders — changing a value here updates the pricing card.
  MESSAGING_EMAILS: "messaging_emails",
  CONTACTS: "contacts",
  EVENTS_API: "events_api",
  AUTOMATIONS: "automations",
  GROUPS: "groups",
  CONTACT_IMPORT: "contact_import",
  BROADCAST_EMAILS: "broadcast_emails",
} as const;

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS];

export interface FeatureLimit {
  /** Binary access: is this feature available on this plan at all? */
  access: boolean;
  /** Monthly quota. `Infinity` = unlimited (see infraCeiling). `0` = not available. */
  quota: number;
  /** Per-minute rate limit. `Infinity` = unlimited (see infraCeiling). */
  ratePerMin: number;
}

export type FeatureLimits = Record<Plan, FeatureLimit>;

/**
 * The master config. Every feature's limits for every plan live here.
 * Adding a new feature = adding one key to this object.
 *
 * Every `Infinity` (MAX plan) has an infra ceiling documented inline.
 */
export const FEATURE_LIMITS: Record<FeatureKey, FeatureLimits> = {
  // ─── API Messages (v1 OTP send/verify/resend) ──────────────────────────
  // STATUS: ACTIVE_ENFORCED — checkUsage(API_MESSAGES) is called in
  // src/lib/dx/request-context.ts before the request reaches the route
  // handler. Phase 14 production-path tests prove the gate blocks at the
  // boundary when the FREE quota is exceeded.
  [FEATURE_KEYS.API_MESSAGES]: {
    FREE: { access: true, quota: 1_000, ratePerMin: 10 },
    PRO: { access: true, quota: 50_000, ratePerMin: 500 },
    // Infra ceiling: Vercel serverless function timeout (10s) + Neon connection
    // pool (20 conns) caps theoretical throughput at ~10K req/min. The existing
    // IP rate limiter (src/lib/security/index.ts IP_OTP_SEND_PER_MIN=10) provides
    // a secondary per-IP ceiling. No business ceiling — MAX users get full pipe.
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity }, // infra: ~10K/min
  },

  // ─── OTP Emails (auth flow OTP sends — separate from API) ───────────────
  // STATUS: ACTIVE_ENFORCED — checkUsage(OTP_EMAILS) is called in
  // src/lib/otp/verifier.ts (issueOtp) before generating + sending the OTP
  // email. The per-email rate limiter (3/min, 10/hour) provides an
  // additional rate-limit layer; the entitlement check is the quota layer.
  [FEATURE_KEYS.OTP_EMAILS]: {
    FREE: { access: true, quota: 100, ratePerMin: 3 },
    PRO: { access: true, quota: 10_000, ratePerMin: 60 },
    // Infra ceiling: Gmail SMTP caps outbound at ~500/day per account. With
    // multiple sending accounts or Postfix relay (Architecture C), the ceiling
    // rises to ~1K/min (SMTP connection pool limit). The existing per-email
    // rate limiter provides the actual enforcement today.
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity }, // infra: ~1K/min (SMTP pool)
  },

  // ─── Email Templates (number of saved custom themes) ────────────────────
  // STATUS: ACTIVE_ENFORCED — checkUsage(EMAIL_TEMPLATES) is called in
  // src/app/api/admin/themes/save/route.ts on the CREATE path (before
  // db.emailTheme.create). Phase 14 production-path tests prove FREE at
  // quota=2 and PRO at quota=20 are both rejected at the boundary.
  [FEATURE_KEYS.EMAIL_TEMPLATES]: {
    FREE: { access: true, quota: 2, ratePerMin: 5 },
    PRO: { access: true, quota: 20, ratePerMin: 10 },
    // No realistic abuse ceiling: each theme is a single JSON row in the DB
    // (~2KB). Even 1M themes = ~2GB — within Neon's free tier. The cost is
    // storage, not compute. An infra ceiling of 10,000 is reasonable but not
    // urgent. Justification for omitting: storage is cheap, and the admin
    // can delete abandoned themes manually.
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity }, // no ceiling: storage-bound, ~2KB/row
  },

  // ─── Custom Branding (access-gated: use custom colors/logo in emails) ──
  // STATUS: CONFIGURED_ONLY — no production route calls canAccess(CUSTOM_BRANDING)
  // directly. The brand-kit route uses BRAND_KIT, and themes/save uses
  // BRANDING_VISUAL — both of which have IDENTICAL access semantics to
  // CUSTOM_BRANDING (FREE=false, PRO=true, MAX=true). CUSTOM_BRANDING is
  // retained for documentation/legacy reasons but is not a live gate. New
  // routes should use BRAND_KIT or BRANDING_VISUAL instead.
  [FEATURE_KEYS.CUSTOM_BRANDING]: {
    FREE: { access: false, quota: 0, ratePerMin: Infinity },
    PRO: { access: true, quota: Infinity, ratePerMin: Infinity },
    // No ceiling needed: this is a binary access gate (access=true). Once
    // allowed, the user can set colors — there's no volume dimension to abuse.
    // The number of themes they can save is separately limited by
    // EMAIL_TEMPLATES quota above.
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity }, // no ceiling: binary access, volume capped by EMAIL_TEMPLATES
  },

  // ─── Brand Kit (save reusable brand assets) ─────────────────────────────
  // STATUS: ACTIVE_ENFORCED — canAccess(BRAND_KIT) is called in
  // src/app/api/admin/brand-kit/route.ts POST before db.brandKit.upsert.
  // Phase 14 production-path tests prove FREE is denied (403, no row
  // created) and PRO succeeds (200, BrandKit upserted).
  [FEATURE_KEYS.BRAND_KIT]: {
    FREE: { access: false, quota: 0, ratePerMin: Infinity },
    PRO: { access: true, quota: 1, ratePerMin: 5 }, // 1 kit, 5 saves/min (burst protection)
    // No ceiling needed: a brand kit is a single DB row with ~500 bytes of
    // config (colors, font, logo URL). Even unlimited kits = negligible
    // storage. The 1-kit PRO limit is a business constraint, not an infra one.
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity }, // no ceiling: single ~500B row, storage negligible
  },

  // ─── Webhook Endpoints (number of registered URLs) ──────────────────────
  // STATUS: ACTIVE_ENFORCED — canAccess(WEBHOOK_ENDPOINTS) and
  // checkUsage(WEBHOOK_ENDPOINTS) are both called in
  // src/app/api/admin/webhooks/route.ts POST before
  // db.webhookEndpoint.create. Phase 14 production-path tests prove FREE is
  // denied (403, no row), PRO below quota succeeds (201, +1 endpoint),
  // and PRO at quota is denied (402, count unchanged).
  [FEATURE_KEYS.WEBHOOK_ENDPOINTS]: {
    FREE: { access: false, quota: 0, ratePerMin: Infinity },
    PRO: { access: true, quota: 3, ratePerMin: Infinity },
    // Infra ceiling: each webhook delivery makes an outbound HTTP request
    // (10s timeout). With 25 endpoints × N events, the Vercel function
    // concurrency limit (~100 concurrent) is the hard ceiling. 25 endpoints
    // × 5 event types = 125 potential deliveries per OTP event — within
    // Vercel's concurrency but approaching it. 25 is the practical max.
    MAX: { access: true, quota: 25, ratePerMin: Infinity }, // infra: Vercel ~100 concurrent functions
  },

  // ─── Webhook Retry Attempts (per failed delivery) ───────────────────────
  // STATUS: CONFIGURED_ONLY — src/lib/dx/webhooks.ts reads FEATURE_LIMITS
  // directly (via getUserPlan + FEATURE_LIMITS[WEBHOOK_RETRIES][plan]) to
  // resolve the per-plan retry ceiling. It does NOT go through the engine's
  // canAccess/checkUsage entry points — the value is enforced via direct
  // config read, not via a runtime gate. The retry counter is bounded but
  // there is no deterministic regression test that proves the per-plan
  // boundary blocks excess retries.
  [FEATURE_KEYS.WEBHOOK_RETRIES]: {
    FREE: { access: false, quota: 0, ratePerMin: Infinity },
    PRO: { access: true, quota: 3, ratePerMin: Infinity },
    // No additional ceiling needed: 10 retries × 25 endpoints = 250 outbound
    // HTTP requests per event — bounded by the WEBHOOK_ENDPOINTS ceiling.
    // Each retry has a 10s timeout, so worst case = 250 × 10s = 2500s of
    // function time, spread across Vercel's concurrent functions.
    MAX: { access: true, quota: 10, ratePerMin: Infinity }, // bounded by WEBHOOK_ENDPOINTS ceiling
  },

  // ─── API Keys (number of active keys) ───────────────────────────────────
  // STATUS: ACTIVE_ENFORCED — checkUsage(API_KEYS) is called in
  // src/app/api/admin/api-keys/route.ts POST before createApiKey().
  // Phase 14 production-path tests prove FREE at quota=1 and PRO at
  // quota=5 are both rejected at the boundary (402, no new row created).
  [FEATURE_KEYS.API_KEYS]: {
    FREE: { access: true, quota: 1, ratePerMin: Infinity },
    PRO: { access: true, quota: 5, ratePerMin: Infinity },
    // Infra ceiling: each API key is a single DB row (~200 bytes). 1000 keys
    // = ~200KB — negligible. The real ceiling is the API key verification
    // lookup (SHA-256 hash compare per request), which is O(1) via the
    // unique index on keyHash. 100 keys is a reasonable infra safety ceiling.
    MAX: { access: true, quota: 20, ratePerMin: Infinity }, // infra: 20 keys (hash lookup is O(1) but admin UI pagination)
  },

  // ─── Dynamic Theme Rules (different template per OTP purpose) ───────────
  // STATUS: ACTIVE_ENFORCED — canAccess(DYNAMIC_THEME_RULES) is called in
  // src/app/api/admin/themes/active/route.ts (the route that activates a
  // theme for a specific purpose). The 3-purpose ceiling (signup/login/reset)
  // is enforced structurally by the OTP purpose enum in validation.ts.
  [FEATURE_KEYS.DYNAMIC_THEME_RULES]: {
    FREE: { access: false, quota: 0, ratePerMin: Infinity },
    PRO: { access: true, quota: 3, ratePerMin: Infinity }, // 3 purposes (confirmed: validation.ts:26)
    // Domain ceiling = 3: confirmed in src/lib/validation.ts:26 —
    // otpPurposeSchema = z.enum(["signup", "login", "reset"]). Exactly 3
    // purposes exist. The config also lists "verification" and "2fa" in the
    // themes/active route's purpose enum, but these don't exist in the OTP
    // engine. The real domain is 3.
    MAX: { access: true, quota: 3, ratePerMin: Infinity }, // domain ceiling = 3
  },

  // ─── Email Content (edit text copy in email themes) ─────────────────────
  // STATUS: ACTIVE_ENFORCED — canAccess(EMAIL_CONTENT) is called in
  // src/app/api/admin/themes/save/route.ts when the save payload contains
  // content field changes (title, subtitle, footerText, ignoreText).
  [FEATURE_KEYS.EMAIL_CONTENT]: {
    FREE: { access: true, quota: Infinity, ratePerMin: Infinity },
    PRO: { access: true, quota: Infinity, ratePerMin: Infinity },
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity },
  },

  // ─── Branding Visual (edit colors, logo, company name in themes) ────────
  // STATUS: ACTIVE_ENFORCED — canAccess(BRANDING_VISUAL) is called in
  // src/app/api/admin/themes/save/route.ts when the save payload contains
  // branding field changes (appName, logoUrl, primaryColor, etc.).
  [FEATURE_KEYS.BRANDING_VISUAL]: {
    FREE: { access: false, quota: 0, ratePerMin: Infinity },
    PRO: { access: true, quota: Infinity, ratePerMin: Infinity },
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity },
  },

  // ─── Multi-Language Templates ───────────────────────────────────────────
  // STATUS: ACTIVE_ENFORCED — canAccess(MULTI_LANGUAGE) is called in
  // src/app/api/admin/themes/preview/route.ts before rendering a preview
  // under a non-default locale.
  //
  // SHIPPED LOCALES: The application currently ships with EXACTLY TWO
  // supported UI locales — `en` (English) and `fa` (Persian). See
  // src/lib/i18n/locales.ts SUPPORTED_LOCALES. The quota numbers below
  // (PRO=5, MAX=5) are FUTURE-FACING CAPACITY for additional locales that
  // have NOT shipped yet — they are NOT the count of currently-supported
  // languages. The pricing comparison tooltip lists only the two shipped
  // locales (English and Persian).
  [FEATURE_KEYS.MULTI_LANGUAGE]: {
    FREE: { access: false, quota: 0, ratePerMin: Infinity },
    // 5 = future capacity (reserved for ar/tr/de + 2 more). Only en/fa ship today.
    PRO: { access: true, quota: 5, ratePerMin: Infinity },
    // No ceiling needed today: only 2 locales (en/fa) actually ship. The
    // quota=5 is future-facing capacity — it does NOT represent 5
    // currently-shipped languages. When additional locales ship, the
    // quota can stay 5 (allowing 5 active languages per account) without
    // a schema/config change.
    MAX: { access: true, quota: 5, ratePerMin: Infinity }, // future capacity (5 reserved) — 2 ship today
  },

  // ─── Team Members (future — not yet implemented) ────────────────────────
  // STATUS: FUTURE — no model, no route, no UI. Included for completeness.
  // When team-member CRUD lands, this key will gate it via canAccess(TEAM_MEMBERS).
  [FEATURE_KEYS.TEAM_MEMBERS]: {
    FREE: { access: false, quota: 0, ratePerMin: Infinity },
    PRO: { access: true, quota: 3, ratePerMin: Infinity },
    // Infra ceiling: each team member is a User row + associated sessions.
    // 50 members is a Vercel Hobby tier constraint (max 100 serverless
    // invocations concurrent — 50 users × 2 avg concurrent = 100).
    MAX: { access: true, quota: 50, ratePerMin: Infinity }, // infra: Vercel Hobby ~100 concurrent functions
  },

  // ─── Audit Log Retention (days) ─────────────────────────────────────────
  // STATUS: ACTIVE_ENFORCED — peekUsage(AUDIT_LOG_RETENTION) is called from
  // multiple admin routes (src/app/api/admin/events/route.ts,
  // src/app/api/admin/request-logs/route.ts,
  // src/app/api/admin/analytics/activity/route.ts,
  // src/app/api/admin/cleanup/route.ts) to apply the per-plan retention
  // ceiling when listing/purging audit rows. peekUsage is the read-only
  // variant of checkUsage (does not consume quota — retention is a TTL,
  // not a counter), but it goes through the same engine so the plan key is
  // resolved from the User row and the limit is read from FEATURE_LIMITS.
  [FEATURE_KEYS.AUDIT_LOG_RETENTION]: {
    FREE: { access: true, quota: 7, ratePerMin: Infinity },
    PRO: { access: true, quota: 90, ratePerMin: Infinity },
    // No ceiling needed: retention is a TTL, not a volume. 365 days of logs
    // for a single user = ~365 × 10 events/day = ~3,650 rows = ~1MB.
    // Negligible storage even at MAX scale. The quota field represents days,
    // not count — the engine treats it identically.
    MAX: { access: true, quota: 365, ratePerMin: Infinity }, // no ceiling: TTL, ~1MB/user/year
  },

  // ════════════════════════════════════════════════════════════════════════
  // MESSAGING PRODUCT EXPANSION — FINAL COMMERCIAL LIMITS (Phase 14)
  // ════════════════════════════════════════════════════════════════════════
  // The limits below are FINAL commercial numbers, not placeholders. The
  // pricing UI (src/lib/pricingData.ts) reads them directly via
  // getFeatureQuota() in src/lib/billing/plan-catalog.ts and renders them on
  // the pricing cards. The tests in src/lib/billing/billing.test.ts are the
  // drift guard.
  //
  // The non-negotiable rule: OTP_EMAILS ≠ MESSAGING_EMAILS — independent
  // quotas, never shared. Each feature key consumes its own counter.
  // ════════════════════════════════════════════════════════════════════════

  // ─── PERIODIC USAGE QUOTAS (consumed via checkUsage / UsageTracking) ───
  // These represent consumption over a billing period (monthly).
  // checkUsage() atomically increments a counter row and checks against quota.
  // Deleting a resource (e.g., an email) does NOT refund the counter.

  // Messaging Emails (transactional email sends)
  // STATUS: ACTIVE_ENFORCED — checkUsage(MESSAGING_EMAILS) is enforced in
  // src/lib/messaging/service.ts (sendMessage) before provider dispatch.
  // INDEPENDENT from OTP_EMAILS — consuming one never touches the other.
  [FEATURE_KEYS.MESSAGING_EMAILS]: {
    FREE: { access: false, quota: 0, ratePerMin: 0 },
    PRO: { access: true, quota: 10_000, ratePerMin: 100 },
    MAX: { access: true, quota: 100_000, ratePerMin: 500 },
  },

  // Broadcast Emails (marketing campaign sends)
  // STATUS: ACTIVE_ENFORCED — canAccess(BROADCAST_EMAILS) is enforced at the
  // route boundary (src/app/api/dashboard/broadcasts/[broadcastId]/launch/route.ts)
  // AND inside launchBroadcast (src/lib/broadcasts/service.ts).
  // checkUsage(BROADCAST_EMAILS) is consumed exactly once per provider
  // dispatch attempt in processRecipient. PRO is access=false so broadcasts
  // are MAX-only. INDEPENDENT from MESSAGING_EMAILS — broadcast has its own quota.
  [FEATURE_KEYS.BROADCAST_EMAILS]: {
    FREE: { access: false, quota: 0, ratePerMin: 0 },
    PRO: { access: false, quota: 0, ratePerMin: 0 },
    MAX: { access: true, quota: 50_000, ratePerMin: 100 },
  },

  // ─── ACCESS-ONLY FEATURE KEYS (binary access via canAccess, NOT consumed) ─
  // These keys control whether a feature is available at all.
  // They do NOT represent monthly consumption — do NOT call checkUsage() on these.
  // The `quota` field is set to Infinity because these are not consumed per-use.
  // Resource capacity limits (e.g., max contacts stored) are NOT enforced here.
  // Resource capacity will be enforced by counting actual DB rows
  // (e.g., COUNT(Contact WHERE userId = X)) against a configured max.
  // That enforcement will be added in future phases when the models exist.

  // Contacts — binary access: can the user use the Contacts product?
  // STATUS: ACTIVE_ENFORCED — canAccess(CONTACTS) is enforced in the contacts
  // API routes (src/app/api/dashboard/contacts/route.ts,
  // src/app/api/v1/contacts/route.ts). Capacity (max stored contacts) is
  // enforced by counting DB rows, not by consuming a quota counter — see
  // the comments at the bottom of this section.
  // NOTE: Do NOT call checkUsage(userId, CONTACTS) on contact creation.
  //       Instead, check access via canAccess(userId, CONTACTS) and
  //       enforce capacity via COUNT(Contact WHERE userId = X) against a
  //       configured maxContacts limit (future phase).
  [FEATURE_KEYS.CONTACTS]: {
    FREE: { access: false, quota: Infinity, ratePerMin: Infinity },
    PRO: { access: true, quota: Infinity, ratePerMin: Infinity },
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity },
  },

  // Events API — binary access: can the user call POST /api/v1/events?
  // STATUS: ACTIVE_ENFORCED — canAccess(EVENTS_API) is enforced in
  // src/app/api/v1/events/route.ts.
  [FEATURE_KEYS.EVENTS_API]: {
    FREE: { access: false, quota: Infinity, ratePerMin: Infinity },
    PRO: { access: true, quota: Infinity, ratePerMin: Infinity },
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity },
  },

  // Automations — binary access: can the user create automation rules?
  // STATUS: ACTIVE_ENFORCED — canAccess(AUTOMATIONS) is enforced in
  // src/app/api/dashboard/automations/otp-verified-welcome/route.ts and
  // in src/lib/automation/processor.ts (when an automation fires).
  // NOTE: Do NOT call checkUsage(userId, AUTOMATIONS) on rule creation.
  //       Instead, check access via canAccess and enforce capacity via
  //       COUNT(AutomationRule WHERE userId = X) against a configured max.
  [FEATURE_KEYS.AUTOMATIONS]: {
    FREE: { access: false, quota: Infinity, ratePerMin: Infinity },
    PRO: { access: true, quota: Infinity, ratePerMin: Infinity },
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity },
  },

  // Groups — binary access: can the user create static groups?
  // STATUS: ACTIVE_ENFORCED — canAccess(GROUPS) is enforced in the groups
  // API routes (src/app/api/dashboard/groups/route.ts,
  // src/app/api/v1/groups/route.ts).
  // NOTE: Do NOT call checkUsage(userId, GROUPS) on group creation.
  //       Instead, check access via canAccess and enforce capacity via
  //       COUNT(ContactGroup WHERE userId = X) against a configured max.
  [FEATURE_KEYS.GROUPS]: {
    FREE: { access: false, quota: Infinity, ratePerMin: Infinity },
    PRO: { access: true, quota: Infinity, ratePerMin: Infinity },
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity },
  },

  // Contact Import — binary access: can the user import contacts from file?
  // STATUS: ACTIVE_ENFORCED — canAccess(CONTACT_IMPORT) is enforced in the
  // imports API routes (src/app/api/dashboard/contacts/imports/route.ts).
  [FEATURE_KEYS.CONTACT_IMPORT]: {
    FREE: { access: false, quota: Infinity, ratePerMin: Infinity },
    PRO: { access: true, quota: Infinity, ratePerMin: Infinity },
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity },
  },
};

// ─── Features that must NEVER be plan-gated (core security) ────────────────
export const NEVER_GATED: ReadonlySet<string> = new Set([
  "account_login",
  "account_signup",
  "password_reset",
  "email_verification",
  "account_security",
  "account_deletion",
]);

export const PLAN_RANK: Record<Plan, number> = { FREE: 0, PRO: 1, MAX: 2 };
