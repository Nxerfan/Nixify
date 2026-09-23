/**
 * UX-B: Webhooks guide — stage + creative copy types.
 *
 * The Webhooks guide is the ninth guide in the UX-B contextual guide
 * system, after Contacts, Branding, Automations, Templates, Broadcasts,
 * Suppressions, Emails, and API Keys. It mirrors the REAL Nixify Webhooks
 * page at:
 *   - src/app/dashboard/webhooks/page.tsx          (~1038 lines, full UI)
 *
 * Architecture rules (REGRESSION-PROTECTED):
 *   - The stage + creative copy are guide-specific types defined here, but
 *     they all share the common GuideContentBase fields (chapters,
 *     writtenSteps, etc.) defined in ../types.
 *   - Each content dictionary (webhooks-en.ts, webhooks-fa.ts) exports a
 *     WebhooksGuideContent that the view component consumes directly.
 *     (WebhooksGuideContent = GuideContentBase & { stage, creative } — i.e.
 *     it satisfies GuideContentBase, just with the unknown stage/creative
 *     slots narrowed to typed shapes.)
 *   - Technical tokens (URLs like https://example.com/hooks/nixify,
 *     masked URLs like https://api.acme.com/***, event codes like
 *     otp.sent / otp.verified / contact.created / nixify.event.received /
 *     nixify.webhook.test, signing secrets like mg_whsec_…, HMAC
 *     signatures like t=1700000000,v1=4a2d…, delivery IDs (UUIDs),
 *     endpoint numeric IDs, ISO timestamps, relative-time strings,
 *     HTTP status codes like 200 / 429 / 500, error class codes like
 *     network_error / timeout / http_4xx / http_5xx / ssrf_blocked /
 *     endpoint_missing / max_attempts_exceeded, file paths like
 *     src/lib/dx/webhooks.ts, header names like Nixify-Signature /
 *     Nixify-Event / Nixify-Delivery-Id) stay LTR via <Ltr> at render
 *     time. They are stored as raw strings here.
 *   - The stage reads `dir` from the copy (ltr for en, rtl for fa) and is
 *     NOT permanently `dir="ltr"`.
 *
 * Source-of-truth UI audit (verbatim labels from the real Webhooks page,
 * src/app/dashboard/webhooks/page.tsx — 1038 lines):
 *
 *   HEADER:
 *   - Ghost "Back to Dashboard" link (ArrowLeft icon, ghost button → /dashboard).
 *   - h1 "Webhooks" with emerald Webhook icon (h-6 w-6 text-emerald-600).
 *   - Subtitle "Register signed webhook endpoints, inspect deliveries, and
 *     replay events.".
 *   - Outline Refresh button (RefreshCw icon, spins while loading) —
 *     triggers both loadEndpoints() and loadDeliveries().
 *   - Emerald "New Endpoint" button (Plus icon, bg-emerald-600).
 *
 *   ENDPOINTS CARD (Card with title "Endpoints" + CardDescription):
 *   - CardDescription: "{endpoints.length} · {activeCount} active" —
 *     interpolated at runtime from the loaded list.
 *   - Empty state: Webhook icon tile + "No webhook endpoints yet" +
 *     "Register a URL to receive signed POSTs whenever an OTP or contact
 *     event fires." + emerald "Create endpoint" button.
 *   - Table (max-h-[28rem] overflow-auto, sticky header): columns
 *     URL (mono text-xs break-all max-w-[280px] wrapped in <Ltr>),
 *     Events (CSV → badges, slice(0,3) + "+N" badge when >3, "—" when 0),
 *     Status (Switch + active=emerald / inactive=muted badge; Switch
 *     disabled when !isActive and onCheckedChange opens deactivate dialog),
 *     Created (relative, hidden on <md), Last Used (relative or "never",
 *     hidden on <lg), Actions (Switch + DropdownMenu with MoreHorizontal).
 *   - Per-row DropdownMenu items: Edit endpoint (Pencil), Send test (Send),
 *     Rotate secret (KeyRound), separator, Deactivate (Trash2, rose,
 *     disabled when !isActive).
 *
 *   DELIVERIES CARD (Card with Activity emerald icon + "Delivery history" title):
 *   - CardDescription: "Recent webhook deliveries across all your endpoints.
 *     Replay to re-send any delivery with a fresh signature."
 *   - Filters row: endpoints Select ("All endpoints" + each endpoint URL
 *     masked to 28 chars), status Select ("All" + pending / delivered /
 *     failed), outline Refresh button.
 *   - Empty state: "No deliveries yet. Send a test webhook from the
 *     endpoint menu to see one here."
 *   - Table (max-h-[32rem] overflow-auto, sticky header): columns
 *     Event (badge mono text-[10px]), Endpoint (mono text-xs truncate,
 *     resolves to URL via endpointLabel(endpointId)), Status (badge —
 *     delivered=emerald, failed=rose, pending=amber), Tries (mono number),
 *     Code (responseCode or "—"), Error (lastError or "—", truncated),
 *     Created (relative, hidden on <md), Replay (RotateCw ghost button).
 *   - Pagination strip: "Page {page} · {total} total" + page-size Select
 *     (10/25/50/100) + Prev/Next buttons.
 *
 *   CREATE / EDIT DIALOG (Dialog, max-w-lg):
 *   - Title: "Create endpoint" / "Edit endpoint".
 *   - URL Input (placeholder https://example.com/hooks/nixify, mono text-sm,
 *     maxLength 2048, autoComplete=url, inputMode=url).
 *   - URL help: "The full https URL Nixify will POST event payloads to."
 *   - Event Subscriptions: 8 quick-pick chips (otp.sent, otp.verified,
 *     otp.failed, otp.expired, nixify.event.received, nixify.webhook.test,
 *     contact.created, contact.updated). Selected chips show as removable
 *     chips below. Custom event input ("custom.event.type" placeholder,
 *     maxLength 100) with Plus button to add. Selected count help text.
 *   - Cancel + emerald "Create endpoint" / "Save changes" submit
 *     (disabled while saving or !url.trim() or events.length === 0).
 *
 *   SECRET DIALOG (Dialog, max-w-lg — shown ONCE after create or rotate):
 *   - Title: emerald CheckCircle2 + "Endpoint secret" (or "New signing
 *     secret" after rotate).
 *   - Description: secretDescription — copy now, won't be shown again.
 *   - Amber Alert: "This secret won't be shown again" + secretWarningDescription.
 *   - Signing secret code block (mono text-xs, dir=ltr, truncate) + outline
 *     Copy button (with copied feedback CheckCircle2 + "Copied").
 *   - Emerald "Saved" close button.
 *
 *   DEACTIVATE ALERT DIALOG (AlertDialog):
 *   - Title: amber AlertTriangle + "Deactivate endpoint".
 *   - Description: deactivateMessage — the endpoint will stop receiving
 *     events immediately. Existing deliveries are retained for audit.
 *   - Cancel + rose "Deactivate" action button.
 *
 *   AUTH / ENTITLEMENT (audited from src/app/api/dashboard/webhooks/route.ts):
 *   - getAuthenticatedUser() — 401 means login required (dashboard → /auth).
 *   - canAccess(userId, FEATURE_KEYS.WEBHOOK_ENDPOINTS) — 403 means
 *     feature_not_available (Webhooks is PRO+ only). The dashboard
 *     surfaces this as the not-available screen.
 *   - GET /api/dashboard/webhooks returns the user's endpoints (NEVER
 *     system endpoints — those have userId=null). Secret is NEVER
 *     returned. URL is masked in list view (maskUrl keeps the origin and
 *     replaces the path/query with `/***`); GET /:id returns the full URL.
 *   - POST /api/dashboard/webhooks — zod body {url, events[]}. SSRF
 *     validation at create time. Capacity check: activeCount < plan
 *     quota (3 PRO, 25 MAX). 402 = quota_exhausted, 403 =
 *     feature_not_available, 400 = validation_failed / SSRF code.
 *     Returns the full secret ONCE in the response body.
 *   - PATCH /api/dashboard/webhooks/:id — zod body {url, events[]} (same
 *     validation, no SSRF re-check at update — the URL was validated at
 *     create time).
 *   - DELETE /api/dashboard/webhooks/:id — soft delete (sets isActive =
 *     false). Existing deliveries are retained. Manual cascade required
 *     because WebhookDelivery → WebhookEndpoint is Restrict on SQLite.
 *   - POST /api/dashboard/webhooks/:id/rotate-secret — generates a fresh
 *     secret via generateWebhookSecret(), overwrites the column, returns
 *     the new secret ONCE.
 *   - POST /api/dashboard/webhooks/:id/test — calls scheduleTestDelivery
 *     (event type nixify.webhook.test). Returns the new deliveryId.
 *   - GET /api/dashboard/webhooks/deliveries — paginated, optional
 *     endpointId + status filters.
 *   - POST /api/dashboard/webhooks/deliveries/:deliveryId/replay — calls
 *     scheduleReplayDelivery. Creates a NEW delivery with a fresh
 *     signature (current secret + fresh timestamp). Does NOT mutate the
 *     original delivery. Returns the new deliveryId.
 *
 *   SIGNING / VERIFICATION (audited from src/lib/dx/webhooks.ts):
 *   - generateWebhookSecret(): "mg_whsec_" + randomBytes(24).toString("base64url")
 *     — ~32 url-safe chars after the mg_whsec_ prefix.
 *   - signWebhook(secret, payload, timestamp = Date.now()):
 *     signedPayload = `${timestamp}.${payload}`;
 *     mac = createHmac("sha256", secret).update(signedPayload).digest("hex");
 *     return `t=${timestamp},v1=${mac}`;
 *   - verifyWebhookSignature(secret, payload, signatureHeader, toleranceMs = 5min):
 *     parses `t=<ts>,v1=<hex>` from the header, rejects if t/v1 missing,
 *     rejects if |Date.now() - t| > toleranceMs (replay-attack window),
 *     recomputes HMAC over `${t}.${payload}`, constant-time XOR compare
 *     of expected vs v1.
 *   - HTTP delivery headers: Content-Type: application/json,
 *     Nixify-Signature (the t=…,v1=… string), Nixify-Event (envelope type).
 *     Nixify-Delivery-Id is exposed in the dashboard but the processor
 *     currently passes signature + event only.
 *
 *   DELIVERY MODEL (audited from src/lib/dx/webhooks.ts):
 *   - Durable-only dispatch: ALL deliveries enter the queue BEFORE
 *     network delivery. NO inline first attempt from application paths.
 *   - scheduleUserWebhookDeliveries(userId, event) targets ONLY active
 *     endpoints where WebhookEndpoint.userId === userId (never another
 *     tenant, never userId=null system endpoints). dedupeKey is
 *     DB-enforced unique — P2002 means a concurrent request already
 *     scheduled this delivery (idempotent skip).
 *   - scheduleSystemWebhookDeliveries(event) targets ONLY userId=null
 *     system endpoints. Never tenant endpoints.
 *   - scheduleTestDelivery(endpointId, userId) — uses
 *     nixify.webhook.test event type, bypasses subscription matching.
 *     Verifies ownership through the endpoint.
 *   - scheduleReplayDelivery(originalDeliveryId, userId) — creates a NEW
 *     auditable delivery with a fresh signature (current secret + fresh
 *     timestamp). Does NOT mutate the original. Verifies ownership
 *     through the endpoint (cross-tenant = "not found").
 *   - Queue processor: processWebhookQueue() → recoverStaleLocks() +
 *     claimPendingJobs(MAX_BATCH_SIZE=25, workerId) + processOneJob.
 *   - Atomic claim via updateMany WHERE status='pending' AND
 *     nextRetryAt <= NOW(). Stale-lock recovery via 5-minute timeout
 *     (STALE_LOCK_TIMEOUT_MS = 5 * 60 * 1000). Bounded batch.
 *   - SSRF validation BEFORE every network call (validateWebhookDestination).
 *     redirect: "error" — no redirect following. 10s timeout.
 *   - Safe error classification (classifyFetchError): bounded
 *     classifications only, never raw exceptions: network_error / timeout
 *     / http_4xx / http_5xx / ssrf_blocked / endpoint_missing /
 *     configuration_error / max_attempts_exceeded.
 *   - Exponential backoff: BACKOFF_BASE_MS = 10s; 10s → 30s → 90s
 *     (Math.min(BACKOFF_BASE_MS * 3^(attempts-1), 90_000)). maxRetries
 *     resolved from the endpoint owner's WEBHOOK_RETRIES entitlement
 *     (default 3).
 *
 *   REAL API ENDPOINTS (NOT called from the stage — for teaching only):
 *   GET    /api/dashboard/webhooks                              (list, masked URLs)
 *   POST   /api/dashboard/webhooks                              (create — returns secret ONCE)
 *   GET    /api/dashboard/webhooks/:id                          (full URL detail)
 *   PATCH  /api/dashboard/webhooks/:id                          (edit URL/events)
 *   DELETE /api/dashboard/webhooks/:id                          (deactivate)
 *   POST   /api/dashboard/webhooks/:id/rotate-secret            (rotate — returns secret ONCE)
 *   POST   /api/dashboard/webhooks/:id/test                     (send test delivery)
 *   GET    /api/dashboard/webhooks/deliveries                   (paginated, filter by endpoint + status)
 *   POST   /api/dashboard/webhooks/deliveries/:deliveryId/replay (replay)
 */

import type { GuideContentBase } from "../types";

/* ─── Stage copy ────────────────────────────────────────────────────────── */

/** Endpoint status visible in the dashboard. */
export type WebhookEndpointStatus = "active" | "inactive";

/** Delivery status visible in the deliveries table. */
export type WebhookDeliveryStatus = "pending" | "delivered" | "failed";

/** A single simulated endpoint row shown in the endpoints list. Local
 * demo data only — the stage NEVER calls /api/dashboard/webhooks. URLs
 * are stored masked (origin + `/***`) just like the real list view, and
 * the seed rows cover every visible state (active + inactive) and a
 * representative mix of event subscriptions. */
export interface WebhooksStageEndpoint {
  /** Stable numeric ID (for React keys + delivery endpoint resolution). */
  id: number;
  /** Masked URL — LTR token (e.g. "https://api.acme.com/***"). The real
   * list view masks the path/query with `/***`; the host is preserved so
   * the user can still recognize the endpoint. */
  url: string;
  /** Event subscriptions — array of LTR tokens (e.g. ["otp.sent","otp.verified"]). */
  events: string[];
  /** Whether the endpoint is active (isActive = true) or deactivated. */
  isActive: boolean;
  /** Created-at relative time string — LTR token (e.g. "2 weeks ago"). */
  createdAtRelative: string;
  /** Last-used relative time string, or null if never used — LTR token. */
  lastUsedAtRelative: string | null;
}

/** A single simulated delivery row shown in the deliveries table. Local
 * demo data only — the stage NEVER calls /api/dashboard/webhooks/deliveries.
 * The seed rows cover every visible status (delivered / failed / pending)
 * and exercise the retry, error, and code paths. */
export interface WebhooksStageDelivery {
  /** Delivery ID — LTR token (UUID prefix, e.g. "4a2d8c1e-…"). */
  deliveryId: string;
  /** Endpoint ID — resolves to a row in endpoints[] via endpointLabel(). */
  endpointId: number;
  /** Event type code — LTR token (e.g. "otp.sent", "nixify.webhook.test"). */
  eventId: string;
  /** Delivery status — drives the colored status badge. */
  status: WebhookDeliveryStatus;
  /** Number of attempts made so far — drives the "Tries" column. */
  attempts: number;
  /** HTTP response code from the endpoint, or null when not yet delivered
   * or when the attempt failed before getting a response (network error,
   * timeout, SSRF block). LTR token. */
  responseCode: number | null;
  /** Created-at relative time string — LTR token. */
  createdAtRelative: string;
  /** Safe error classification (network_error / timeout / http_4xx /
   * http_5xx / ssrf_blocked / endpoint_missing / configuration_error /
   * max_attempts_exceeded), or null when status === delivered. LTR token. */
  lastError: string | null;
}

export interface WebhooksStageCopy {
  /** Direction the simulated product chrome should render in. */
  dir: "ltr" | "rtl";
  /** Active locale code for the stage (matches the surrounding page). */
  locale: "en" | "fa";

  /** Header copy — mirrors the real page's header verbatim. */
  header: {
    title: string;                  // "Webhooks"
    subtitle: string;               // "Register signed webhook endpoints, inspect deliveries, and replay events."
    backToDashboard: string;        // "Dashboard" (the ghost link label)
    refresh: string;                // "Refresh"
    addEndpoint: string;            // "New Endpoint"
  };

  /** Endpoints card copy. */
  endpointsCard: {
    title: string;                  // "Endpoints"
    /** Subtitle interpolating total + active count. */
    subtitle: (total: number, active: number) => string;
    /** Shown when the endpoints list is empty. */
    empty: string;                  // "No webhook endpoints yet"
    emptyDescription: string;
    createEndpoint: string;          // "Create endpoint"
  };

  /** Endpoints table header labels. */
  table: {
    url: string;
    events: string;
    status: string;
    created: string;
    lastUsed: string;
    actions: string;
    actionsAria: string;
    /** "never" — shown in the Last Used column when lastUsedAtRelative is null. */
    neverUsed: string;
    /** "+N" badge label when events.length > 3. */
    moreEvents: (n: number) => string;
    /** "—" placeholder shown when events.length === 0. */
    noEvents: string;
  };

  /** Status badge labels — driven by isActive. */
  statusLabels: Record<WebhookEndpointStatus, string>;

  /** Per-row actions dropdown (decorative in the stage — the cinematic
   * shell exposes these labels so the user can see what's available). */
  actionsMenu: {
    editEndpoint: string;            // "Edit endpoint"
    sendTest: string;                 // "Send test"
    rotateSecret: string;             // "Rotate secret"
    deactivate: string;               // "Deactivate"
  };

  /** Deliveries card copy. */
  deliveriesCard: {
    title: string;                    // "Delivery history"
    subtitle: string;
    allEndpoints: string;              // "All endpoints"
    all: string;                       // "All"
    empty: string;                     // "No deliveries yet. Send a test webhook from the endpoint menu to see one here."
    refreshAria: string;
    columnEvent: string;
    columnEndpoint: string;
    columnStatus: string;
    columnTries: string;
    columnCode: string;
    columnError: string;
    columnCreated: string;
    columnReplay: string;
    replayAria: string;
    replayTooltip: string;
  };

  /** Delivery status badge labels — drives the colored badge in the
   * status column. The real page renders delivered=emerald, failed=rose,
   * pending=amber. */
  deliveryStatus: Record<WebhookDeliveryStatus, string>;

  /** Pagination strip copy (decorative — the seed list is short). */
  pagination: {
    pageOf: (page: number, total: number) => string;
    prev: string;
    next: string;
  };

  /** Create / Edit Dialog copy. */
  createDialog: {
    titleCreate: string;               // "Create endpoint"
    titleEdit: string;                 // "Edit endpoint"
    descriptionCreate: string;
    descriptionEdit: string;
    urlLabel: string;                  // "Endpoint URL"
    urlPlaceholder: string;            // "https://example.com/hooks/nixify"
    urlHelp: string;
    eventsLabel: string;               // "Event subscriptions"
    eventsSelected: (n: number) => string;
    customPlaceholder: string;         // "custom.event.type"
    cancel: string;
    submitCreate: string;              // "Create endpoint"
    submitEdit: string;                // "Save changes"
  };

  /** Secret Dialog copy — shown ONCE after create or rotate-secret.
   * Mirrors the SecretDialog component in the real page. */
  secretDialog: {
    /** Title used after create. */
    titleCreate: string;                // "Endpoint secret"
    /** Title used after rotate-secret. */
    titleRotate: string;                // "New signing secret"
    description: string;
    secretLabel: string;                 // "Signing secret"
    copy: string;                        // "Copy"
    copied: string;                      // "Copied"
    warningTitle: string;
    warningBody: string;
    done: string;                        // "Saved"
    /** LTR caption shown in the simulated secret dialog reinforcing the
     * storage invariant (HMAC-SHA256 only — the secret is never retrievable
     * after the dialog closes). */
    hashCaption: string;
  };

  /** Deactivate AlertDialog copy. */
  deactivateDialog: {
    title: string;
    message: string;
    cancel: string;
    confirm: string;                    // "Deactivate"
  };

  /** Not-available screen (403 entitlement — feature not on plan). */
  notAvailable: {
    title: string;
    description: string;
    cta: string;                        // "View Plans"
  };

  /* ─── Seed data ────────────────────────────────────────────────────────── */

  /** Seed endpoints shown in the simulated list. NEVER fetched from the
   * API. Numbers chosen to exercise both visible statuses (active +
   * inactive) and a representative mix of event subscriptions. The URL
   * is stored masked (origin + `/***`) just like the real list view. */
  endpoints: WebhooksStageEndpoint[];
  /** Seed deliveries shown in the simulated deliveries table. NEVER
   * fetched from the API. Covers every visible status (delivered /
   * failed / pending) and exercises the retry, error, and code paths. */
  deliveries: WebhooksStageDelivery[];

  /** The signing secret revealed during the createEndpoint scene — LTR
   * token, looks like `mg_whsec_<32 url-safe chars>`. NEVER a real secret. */
  revealedSecret: string;
  /** The URL of the endpoint created in the createEndpoint scene — LTR
   * token (the full, unmasked URL the user typed in the create dialog). */
  revealedUrl: string;
}

/* ─── Creative section copy ─────────────────────────────────────────────── */

/* 1. Event journey — event lifecycle from trigger to audit */

/** One step in the event-journey vertical timeline. */
export interface EventJourneyStepCopy {
  /** Step badge — LTR token ("01".."07" or Persian numerals). */
  badge: string;
  /** Step title. */
  title: string;
  /** Step body — one or two sentences. */
  body: string;
  /** Optional LTR token (e.g. "POST /api/v1/otp/send", "scheduleUserWebhookDeliveries"). */
  token?: string;
  /** Tone — controls the color coding. ui = sky (user surface), state =
   * emerald (Nixify internal state change), downstream = amber (the
   * receiver side / out-of-band). */
  tone: "ui" | "state" | "downstream";
}

export interface EventJourneyCopy {
  heading: string;
  subheading: string;
  legendTitle: string;
  legendItems: { label: string; tone: "ui" | "state" | "downstream" }[];
  steps: EventJourneyStepCopy[];
  /** Footnote pointing to src/lib/dx/webhooks.ts. */
  footnote: string;
  /** Amber warning reinforcing "durable-only dispatch — every delivery
   * enters the queue BEFORE network delivery". */
  warningTitle: string;
  warningBody: string;
}

/* 2. Endpoint anatomy — what's stored, what's masked, what's revealed */

export interface EndpointFieldCopy {
  /** Stable key for React lists. */
  key: "url" | "events" | "secret" | "active" | "dates" | "id";
  /** Localized field name (e.g. "URL"). */
  label: string;
  /** One-sentence description of what this field is. */
  desc: string;
  /** LTR token shown beside the desc — the actual value pattern. */
  token: string;
  /** Tone — controls the field's accent color. ui = sky (visible
   * everywhere), secret = amber (shown once, never retrievable),
   * storage = emerald (persisted). */
  tone: "ui" | "secret" | "storage";
}

export interface EndpointAnatomyCopy {
  heading: string;
  subheading: string;
  fieldsTitle: string;
  fields: EndpointFieldCopy[];
  /** Masking matrix — what the list view shows vs. what the detail view
   * shows for each field. */
  matrixTitle: string;
  matrixSubtitle: string;
  matrixColDimension: string;          // "Field"
  matrixColListView: string;           // "List view"
  matrixColDetailView: string;         // "Detail view"
  matrixRows: {
    dimension: string;
    listView: string;                   // LTR token if technical
    detailView: string;                 // LTR token if technical
    tone: "ui" | "secret" | "storage";
  }[];
  /** The create → reveal → sign → deliver → audit cycle. */
  cycleTitle: string;
  cycleSubtitle: string;
  cycle: {
    badge: string;
    title: string;
    body: string;
    token?: string;
    tone: "ui" | "secret" | "storage" | "deliver";
  }[];
  /** Footnote pointing to src/lib/dx/webhooks.ts. */
  footnote: string;
  /** Amber warning reinforcing "the secret is shown ONCE — Nixify stores
   * only the HMAC verification key, never the secret in plaintext after
   * the reveal dialog closes". */
  warningTitle: string;
  warningBody: string;
}

/* 3. Signing & verification — HMAC-SHA256 signing explained */

export interface SigningHeaderCopy {
  /** Header name — LTR token (e.g. "Nixify-Signature"). */
  header: string;
  /** Example value — LTR token (e.g. "t=1700000000,v1=4a2d…"). */
  value: string;
  /** One-sentence description of what the header carries. */
  desc: string;
  /** Tone — sign = emerald (set by Nixify on send), verify = sky
   * (read by receiver), id = amber (correlation / idempotency). */
  tone: "sign" | "verify" | "id";
}

export interface SigningStepCopy {
  /** Step badge — LTR token ("01".."06" or Persian numerals). */
  badge: string;
  /** Step title. */
  title: string;
  /** Step body. */
  body: string;
  /** Optional LTR token (e.g. "HMAC-SHA256(secret, `${t}.${payload}`)"). */
  token?: string;
  /** Tone — sign = emerald (signing side), verify = sky (verification
   * side), guard = amber (security guard: tolerance + constant-time). */
  tone: "sign" | "verify" | "guard";
}

export interface SigningVerificationCopy {
  heading: string;
  subheading: string;
  /** Two side-by-side cards: signing (Nixify side) + verification (receiver side). */
  signCard: {
    badge: string;                     // "Sign"
    title: string;                     // "Nixify side"
    body: string;
    bullets: string[];
  };
  verifyCard: {
    badge: string;                     // "Verify"
    title: string;                      // "Receiver side"
    body: string;
    bullets: string[];
  };
  /** Headers table. */
  headersTitle: string;
  headersSubtitle: string;
  headerCol: string;                    // "Header"
  valueCol: string;                     // "Example"
  descCol: string;                      // "Carries"
  headers: SigningHeaderCopy[];
  /** Lifecycle steps — sign + verify side by side as a vertical timeline. */
  stepsTitle: string;
  steps: SigningStepCopy[];
  /** Two security guards — tolerance window + constant-time compare. */
  toleranceTitle: string;
  toleranceBody: string;
  constantTimeTitle: string;
  constantTimeBody: string;
  /** Footnote pointing to src/lib/dx/webhooks.ts (signWebhook + verifyWebhookSignature). */
  footnote: string;
  /** Amber warning reinforcing "rotate the secret if you suspect compromise
   * — old signatures become invalid immediately". */
  warningTitle: string;
  warningBody: string;
}

/* 4. Delivery lifecycle — pending → processing → delivered/failed state diagram */

export interface DeliveryStateCopy {
  /** Stable key for React lists. */
  key: "pending" | "processing" | "delivered" | "failed" | "recovered";
  /** Localized state label (e.g. "Pending"). */
  label: string;
  /** One-sentence description of the state. */
  desc: string;
  /** Tone — controls color coding. pending = amber, processing = sky,
   * delivered = emerald, failed = rose, recovered = slate. */
  tone: "pending" | "active" | "good" | "bad" | "warn";
}

export interface DeliveryTransitionCopy {
  /** Source state key. */
  from: DeliveryStateCopy["key"];
  /** Target state key. */
  to: DeliveryStateCopy["key"];
  /** What triggers the transition. */
  trigger: string;
  /** Optional LTR token (e.g. "updateMany WHERE status='pending'"). */
  token?: string;
  /** Tone — controls color coding of the arrow + chip. claim = sky,
   * success = emerald, failure = rose, recover = amber, exhaust = rose. */
  tone: "claim" | "success" | "failure" | "recover" | "exhaust";
}

export interface DeliveryLifecycleCopy {
  heading: string;
  subheading: string;
  /** Title for the state diagram grid. */
  statesTitle: string;
  states: DeliveryStateCopy[];
  /** Title for the transitions timeline. */
  transitionsTitle: string;
  transitions: DeliveryTransitionCopy[];
  /** Retry + backoff explainer. */
  retryTitle: string;
  retryBody: string;
  /** Stale-lock recovery explainer. */
  staleLockTitle: string;
  staleLockBody: string;
  /** Footnote pointing to src/lib/dx/webhooks.ts (processWebhookQueue). */
  footnote: string;
  /** Amber warning reinforcing "replay creates a NEW auditable delivery —
   * it does NOT mutate the original; the original retains its audit trail". */
  warningTitle: string;
  warningBody: string;
}

export interface WebhooksCreativeCopy {
  eventJourney: EventJourneyCopy;
  endpointAnatomy: EndpointAnatomyCopy;
  signingVerification: SigningVerificationCopy;
  deliveryLifecycle: DeliveryLifecycleCopy;
}

/* ─── Combined guide content type ───────────────────────────────────────── */

export type WebhooksGuideContent = GuideContentBase & {
  stage: WebhooksStageCopy;
  creative: WebhooksCreativeCopy;
};
