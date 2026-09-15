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
 *   IMPLEMENTED     — checkUsage()/canAccess() call exists in a route handler
 *   CONFIGURED-ONLY — feature key + limits exist here, but no route checks it yet
 *   PROPOSAL        — no code exists at all (future feature)
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
  // ─── Messaging product expansion (Phase 0+ — PLACEHOLDER LIMITS) ────────
  // These feature keys are added now so the entitlement system recognizes them.
  // Routes that check them don't exist yet — they'll be added in future phases.
  // Commercial limits are PLACEHOLDERS — not final. See FEATURE_LIMITS below.
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
  // STATUS: IMPLEMENTED — enforced in src/lib/dx/request-context.ts:72
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
  // STATUS: CONFIGURED-ONLY — limits defined but issueOtp() in verifier.ts
  // does not call checkUsage() yet. Currently enforced only by the existing
  // per-email rate limiter (3/min, 10/hour) which is plan-agnostic.
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
  // STATUS: CONFIGURED-ONLY — EmailTheme model exists, themes/save route
  // exists, but does not call checkUsage() before creating a new theme.
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
  // STATUS: CONFIGURED-ONLY — EmailTheme.config contains branding, but
  // themes/save route does not call canAccess(CUSTOM_BRANDING) before
  // allowing custom colors.
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
  // STATUS: CONFIGURED-ONLY — BrandKit model exists, brand-kit route exists,
  // but does not call canAccess(BRAND_KIT) before saving.
  [FEATURE_KEYS.BRAND_KIT]: {
    FREE: { access: false, quota: 0, ratePerMin: Infinity },
    PRO: { access: true, quota: 1, ratePerMin: 5 }, // 1 kit, 5 saves/min (burst protection)
    // No ceiling needed: a brand kit is a single DB row with ~500 bytes of
    // config (colors, font, logo URL). Even unlimited kits = negligible
    // storage. The 1-kit PRO limit is a business constraint, not an infra one.
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity }, // no ceiling: single ~500B row, storage negligible
  },

  // ─── Webhook Endpoints (number of registered URLs) ──────────────────────
  // STATUS: CONFIGURED-ONLY — WebhookEndpoint model exists, webhooks route
  // exists, but does not call checkUsage(WEBHOOK_ENDPOINTS) before creating.
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
  // STATUS: CONFIGURED-ONLY — WebhookDelivery model exists, but
  // deliverWebhook() in webhooks.ts does not check this limit.
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
  // STATUS: CONFIGURED-ONLY — ApiKey model exists, api-keys route exists,
  // but does not call checkUsage(API_KEYS) before creating a new key.
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
  // STATUS: CONFIGURED-ONLY — EmailTheme.purpose field exists, themes/active
  // route exists, but does not call canAccess(DYNAMIC_THEME_RULES).
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
  // STATUS: NEW — all users can edit text content (title, subtitle, etc.)
  [FEATURE_KEYS.EMAIL_CONTENT]: {
    FREE: { access: true, quota: Infinity, ratePerMin: Infinity },
    PRO: { access: true, quota: Infinity, ratePerMin: Infinity },
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity },
  },

  // ─── Branding Visual (edit colors, logo, company name in themes) ────────
  // STATUS: NEW — only PRO and MAX users can edit visual branding
  [FEATURE_KEYS.BRANDING_VISUAL]: {
    FREE: { access: false, quota: 0, ratePerMin: Infinity },
    PRO: { access: true, quota: Infinity, ratePerMin: Infinity },
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity },
  },

  // ─── Multi-Language Templates ───────────────────────────────────────────
  // STATUS: CONFIGURED-ONLY — TRANSLATIONS map exists in email-themes/
  // templates.ts, but no route calls canAccess(MULTI_LANGUAGE).
  [FEATURE_KEYS.MULTI_LANGUAGE]: {
    FREE: { access: false, quota: 0, ratePerMin: Infinity },
    PRO: { access: true, quota: 5, ratePerMin: Infinity }, // 5 languages
    // No ceiling needed: there are only 5 supported languages (EN/FA/AR/TR/DE).
    // You can't enable more languages than exist in the TRANSLATIONS map.
    // The quota=5 IS the ceiling — it's a fixed domain.
    MAX: { access: true, quota: 5, ratePerMin: Infinity }, // ceiling = 5 (fixed domain: one per supported language)
  },

  // ─── Team Members (future — not yet implemented) ────────────────────────
  // STATUS: PROPOSAL — no model, no route, no UI. Included for completeness.
  [FEATURE_KEYS.TEAM_MEMBERS]: {
    FREE: { access: false, quota: 0, ratePerMin: Infinity },
    PRO: { access: true, quota: 3, ratePerMin: Infinity },
    // Infra ceiling: each team member is a User row + associated sessions.
    // 50 members is a Vercel Hobby tier constraint (max 100 serverless
    // invocations concurrent — 50 users × 2 avg concurrent = 100).
    MAX: { access: true, quota: 50, ratePerMin: Infinity }, // infra: Vercel Hobby ~100 concurrent functions
  },

  // ─── Audit Log Retention (days) ─────────────────────────────────────────
  // STATUS: CONFIGURED-ONLY — SecurityEvent and OtpEvent models exist, but
  // no cleanup cron enforces retention. The proposed /api/admin/cleanup
  // endpoint (from the audit) would use this limit.
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
  // MESSAGING PRODUCT EXPANSION — PLACEHOLDER LIMITS
  // ════════════════════════════════════════════════════════════════════════
  // The limits below are PLACEHOLDERS for architecture readiness.
  // They are NOT final commercial numbers.
  // Plan→feature mapping will be decided as a business decision.
  // The only non-negotiable rule: OTP_EMAILS ≠ MESSAGING_EMAILS (independent quotas).
  // ════════════════════════════════════════════════════════════════════════

  // ─── PERIODIC USAGE QUOTAS (consumed via checkUsage / UsageTracking) ───
  // These represent consumption over a billing period (monthly).
  // checkUsage() atomically increments a counter row and checks against quota.
  // Deleting a resource (e.g., an email) does NOT refund the counter.

  // Messaging Emails (transactional + broadcast email sends)
  // STATUS: PROPOSAL — no route checks this yet. Will be checked in Phase 4.
  // INDEPENDENT from OTP_EMAILS — consuming one never touches the other.
  [FEATURE_KEYS.MESSAGING_EMAILS]: {
    FREE: { access: false, quota: 0, ratePerMin: 0 },
    PRO: { access: true, quota: 10_000, ratePerMin: 100 }, // PLACEHOLDER
    MAX: { access: true, quota: 100_000, ratePerMin: 500 }, // PLACEHOLDER
  },

  // Broadcast Emails (marketing campaign sends)
  // STATUS: PROPOSAL — will be checked in Phase 10.
  // INDEPENDENT from MESSAGING_EMAILS — broadcast has its own quota.
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
  // STATUS: PROPOSAL — will be checked in Phase 1 (Contacts CRUD).
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
  // STATUS: PROPOSAL — will be checked in Phase 6.
  [FEATURE_KEYS.EVENTS_API]: {
    FREE: { access: false, quota: Infinity, ratePerMin: Infinity },
    PRO: { access: true, quota: Infinity, ratePerMin: Infinity },
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity },
  },

  // Automations — binary access: can the user create automation rules?
  // STATUS: PROPOSAL — will be checked in Phase 5.
  // NOTE: Do NOT call checkUsage(userId, AUTOMATIONS) on rule creation.
  //       Instead, check access via canAccess and enforce capacity via
  //       COUNT(AutomationRule WHERE userId = X) against a configured max.
  [FEATURE_KEYS.AUTOMATIONS]: {
    FREE: { access: false, quota: Infinity, ratePerMin: Infinity },
    PRO: { access: true, quota: Infinity, ratePerMin: Infinity },
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity },
  },

  // Groups — binary access: can the user create static groups?
  // STATUS: PROPOSAL — will be checked in Phase 8.
  // NOTE: Do NOT call checkUsage(userId, GROUPS) on group creation.
  //       Instead, check access via canAccess and enforce capacity via
  //       COUNT(ContactGroup WHERE userId = X) against a configured max.
  [FEATURE_KEYS.GROUPS]: {
    FREE: { access: false, quota: Infinity, ratePerMin: Infinity },
    PRO: { access: true, quota: Infinity, ratePerMin: Infinity },
    MAX: { access: true, quota: Infinity, ratePerMin: Infinity },
  },

  // Contact Import — binary access: can the user import contacts from file?
  // STATUS: PROPOSAL — will be checked in Phase 8.
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
