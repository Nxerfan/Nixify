/**
 * UX-B: Webhooks guide — English content dictionary.
 *
 * AUDIT-GRADE FACTUAL ACCURACY (re-verified this pass):
 *   Every statement here was verified against:
 *     - src/app/dashboard/webhooks/page.tsx                       (~1038-line real UI)
 *     - src/app/api/dashboard/webhooks/route.ts                    (list / create / maskUrl)
 *     - src/lib/dx/webhooks.ts                                     (signing + verification + queue)
 *     - src/i18n/en.ts                                             (dashboard.webhooks.* labels)
 *
 * Specifically:
 *   - The real Webhooks page renders a header (emerald Webhook icon +
 *     "Webhooks" + the subtitle "Register signed webhook endpoints,
 *     inspect deliveries, and replay events."), a Refresh button + an
 *     emerald "New Endpoint" button, an Endpoints Card with a sticky-
 *     header table (columns: URL, Events, Status, Created, Last Used,
 *     Actions), per-row dropdown (Edit / Send test / Rotate secret /
 *     Deactivate), a Deliveries Card with filters + a sticky-header
 *     table (columns: Event, Endpoint, Status, Tries, Code, Error,
 *     Created, Replay), and pagination.
 *   - The Create Dialog has URL input + 8 quick-pick event chips + a
 *     custom event input + Cancel / "Create endpoint" submit. On
 *     success, the secret dialog opens with the signing secret ONCE
 *     (Copy + amber "won't be shown again" warning + "Saved" button).
 *   - The Secret Dialog is also reused for rotate-secret — title
 *     becomes "New signing secret" but the rest of the shape is
 *     identical.
 *   - The Deactivate confirmation is an AlertDialog: amber AlertTriangle
 *     + "Deactivate endpoint" + the message about the endpoint stopping
 *     immediately while deliveries are retained for audit. Cancel +
 *     rose "Deactivate" action.
 *   - URL is masked in the list view: `maskUrl()` keeps the origin and
 *     replaces the path/query with `/***`. GET /:id returns the full URL.
 *     The signing `secret` is NEVER returned by GET (list or detail).
 *   - POST returns the secret ONCE in the response body. PATCH updates
 *     URL/events. DELETE soft-deletes (isActive = false). POST
 *     /:id/rotate-secret overwrites the column and returns the new
 *     secret ONCE. POST /:id/test schedules a nixify.webhook.test
 *     delivery. POST /deliveries/:deliveryId/replay schedules a NEW
 *     delivery with a fresh signature (current secret + fresh timestamp)
 *     — the original delivery is NOT mutated.
 *   - generateWebhookSecret(): "mg_whsec_" + randomBytes(24).toString("base64url")
 *     — ~32 url-safe chars after the prefix.
 *   - signWebhook(): signedPayload = `${timestamp}.${payload}`;
 *     mac = HMAC-SHA256(secret, signedPayload).digest("hex");
 *     return `t=${timestamp},v1=${mac}`. This is what gets sent in the
 *     Nixify-Signature header on every delivery.
 *   - verifyWebhookSignature(): parse `t=<ts>,v1=<hex>`; reject if
 *     missing; reject if |Date.now() - t| > 5min (replay-attack window);
 *     recompute HMAC over `${t}.${payload}`; constant-time XOR compare.
 *   - Durable-only dispatch: ALL deliveries enter the queue BEFORE
 *     network delivery. NO inline first attempt from application paths.
 *     scheduleUserWebhookDeliveries targets ONLY the user's active
 *     endpoints; scheduleSystemWebhookDeliveries targets ONLY userId=null
 *     system endpoints. dedupeKey is DB-enforced unique (P2002 =
 *     idempotent skip).
 *   - Queue processor: atomic claim via updateMany WHERE status='pending'
 *     AND nextRetryAt <= NOW(). Stale-lock recovery via 5-minute timeout.
 *     SSRF validation BEFORE every network call. redirect: "error", 10s
 *     timeout. Safe error classification: network_error / timeout /
 *     http_4xx / http_5xx / ssrf_blocked / endpoint_missing /
 *     configuration_error / max_attempts_exceeded. Backoff: 10s → 30s → 90s.
 *     maxRetries resolved from the endpoint owner's WEBHOOK_RETRIES
 *     entitlement (default 3).
 *   - 401 → /auth (handled by the dashboard's loadEndpoints()). 403 →
 *     not-available screen (Webhooks is PRO+ only).
 *
 * Tokens that must stay LTR (URLs like https://api.acme.com/***,
 * event codes like otp.sent / otp.verified / nixify.webhook.test,
 * signing secrets like mg_whsec_…, HMAC signatures like
 * t=1700000000,v1=4a2d…, delivery IDs (UUIDs), endpoint numeric IDs,
 * ISO timestamps, relative-time strings, HTTP status codes like 200 /
 * 429 / 500, error class codes like network_error / http_4xx /
 * ssrf_blocked / max_attempts_exceeded, file paths like
 * src/lib/dx/webhooks.ts, header names like Nixify-Signature /
 * Nixify-Event / Nixify-Delivery-Id) are stored as raw strings here
 * and wrapped with <Ltr> at render time in the stage component.
 *
 * This dictionary ALSO contains:
 *   - stage: human-facing copy for the simulated WebhooksStage product UI
 *     (which mirrors the real page honestly — same header, same endpoints
 *     table, same deliveries table, same three dialogs).
 *   - creative: copy for the four creative sections (Event journey,
 *     Endpoint anatomy, Signing & verification, Delivery lifecycle).
 * Both are typed via the shared WebhooksGuideContent interface so the
 * render components receive resolved content rather than reading locale
 * directly.
 */

import type { WebhooksGuideContent } from "./webhooks-types";

export const webhooksEn: WebhooksGuideContent = {
  slug: "webhooks",
  routeKey: "webhooks",
  backHref: "/dashboard/webhooks",
  stepCount: 6,
  durationMin: 5,
  category: "developer",
  dashboardRoute: "/dashboard/webhooks",
  title: "Webhooks",
  description:
    "Register signed webhook endpoints, inspect deliveries, and replay events. Every delivery is HMAC-SHA256 signed with a per-endpoint secret shown ONCE at creation — Nixify never returns the secret again. Learn the durable-only dispatch model, the signing + verification contract, and the retry + replay lifecycle.",
  chapters: [
    {
      id: "intro",
      title: "Webhooks",
      steps: [
        {
          id: "webhooksOverview",
          caption:
            "Here is the real Webhooks page. The header has an emerald Webhook icon, the title \"Webhooks\", and the subtitle \"Register signed webhook endpoints, inspect deliveries, and replay events.\" Below it: a Refresh button and an emerald \"New Endpoint\" button. The Endpoints card lists every endpoint — masked URL, subscribed events, active/inactive status, created + last-used timestamps, and a per-row actions menu (Edit / Send test / Rotate secret / Deactivate). The Delivery history card below lists every delivery — event, endpoint, status, tries, response code, error class, and a Replay button.",
          duration: 8000,
          scene: "webhooksOverview",
        },
        {
          id: "createEndpoint",
          caption:
            "Click \"New Endpoint\" to open the create dialog. Type the full https URL Nixify will POST event payloads to. Pick event subscriptions from the 8 quick-pick chips (otp.sent, otp.verified, otp.failed, otp.expired, nixify.event.received, nixify.webhook.test, contact.created, contact.updated), or add a custom event type. The submit button is disabled while the URL is empty or no events are selected. SSRF validation runs at create time — private / loopback / datacenter ranges are rejected.",
          duration: 8500,
          scene: "createEndpoint",
        },
        {
          id: "secretReveal",
          caption:
            "On submit, the create dialog closes and a secret dialog opens with the signing secret — exactly once. Copy it now. The secret is the HMAC verification key: Nixify uses it to sign every delivery (HMAC-SHA256 over `${timestamp}.${payload}`), and the receiver uses it to verify the Nixify-Signature header. Nixify stores the secret in plaintext on the WebhookEndpoint row, but never returns it via the API after this dialog. If you lose it, you have to rotate it (POST /:id/rotate-secret) — the old secret stops working immediately.",
          duration: 8500,
          scene: "secretReveal",
        },
        {
          id: "testDelivery",
          caption:
            "Open a row's actions menu and click \"Send test\". Nixify schedules a nixify.webhook.test delivery — it bypasses subscription matching so you can verify your endpoint is reachable even if you haven't subscribed to any production events yet. The delivery enters the durable queue (NEVER an inline first attempt), the processor claims it atomically, makes a single POST attempt with the Nixify-Signature + Nixify-Event headers, and the new row appears in the deliveries table with status, response code, and tries count.",
          duration: 9000,
          scene: "testDelivery",
        },
        {
          id: "retryAndFailure",
          caption:
            "When a delivery fails (non-2xx response, network error, timeout, or SSRF block on a re-resolved URL), the queue processor classifies the error safely (network_error / timeout / http_4xx / http_5xx / ssrf_blocked / endpoint_missing / configuration_error) and schedules a retry with exponential backoff: 10s → 30s → 90s. After maxRetries (default 3, entitlement-driven), the delivery is marked failed with lastError = max_attempts_exceeded. The deliveries table surfaces the tries count + the lastError code so you can diagnose without leaking raw exception messages.",
          duration: 9500,
          scene: "retryAndFailure",
        },
        {
          id: "replayAndAudit",
          caption:
            "Click the Replay button on any delivery row. Nixify schedules a NEW delivery with a fresh signature (current secret + fresh timestamp) — the original delivery is NOT mutated and retains its audit trail. This is why replay uses POST /deliveries/:deliveryId/replay, not a re-send of the original: the original is immutable evidence. Use replay when your endpoint was down during the original delivery, when you've fixed a bug in your handler, or when you want to verify your verifier still works.",
          duration: 8500,
          scene: "replayAndAudit",
        },
      ],
    },
  ],
  writtenSteps: [
    {
      title: "Read the endpoints list + the deliveries list",
      body: "The Webhooks page opens with a header (emerald Webhook icon + \"Webhooks\" + the subtitle \"Register signed webhook endpoints, inspect deliveries, and replay events.\"), a Refresh button, and an emerald \"New Endpoint\" button. The Endpoints card lists every endpoint with columns: URL (mono, masked — origin + /***, wrapped in <Ltr>), Events (CSV → badges, max 3 shown + \"+N\" badge, \"—\" when none), Status (Switch + active=emerald / inactive=muted badge; the Switch is disabled when the endpoint is already inactive and opens the deactivate dialog when toggled off an active one), Created (relative), Last Used (relative or \"never\"), and a per-row Actions dropdown (Edit / Send test / Rotate secret / Deactivate). The Delivery history card below lists every delivery with columns: Event (badge mono), Endpoint (mono truncate), Status (delivered=emerald / failed=rose / pending=amber), Tries (mono number), Code (responseCode or \"—\"), Error (lastError or \"—\"), Created (relative), and a Replay button.",
    },
    {
      title: "Open the Create dialog and pick URL + events",
      body: "Click \"New Endpoint\". The dialog has a URL input (placeholder https://example.com/hooks/nixify, mono, maxLength 2048) and an event-subscriptions editor with 8 quick-pick chips (otp.sent, otp.verified, otp.failed, otp.expired, nixify.event.received, nixify.webhook.test, contact.created, contact.updated). Selected events appear as removable chips below; you can also add a custom event type (maxLength 100) via the free-text input + Plus button. The submit button is disabled while the URL is empty or no events are selected. SSRF validation runs at create time — private / loopback / datacenter ranges are rejected with the SSRF error code.",
    },
    {
      title: "Copy the signing secret from the Secret dialog (shown ONCE)",
      body: "On submit, the create dialog closes and a secret dialog opens with the signing secret — exactly once. Copy it now. The secret is the HMAC verification key: Nixify uses it to sign every delivery (HMAC-SHA256 over `${timestamp}.${payload}`, returned as `t=<timestamp>,v1=<hex>` in the Nixify-Signature header), and the receiver uses it to verify the signature on incoming POSTs. Nixify never returns the secret again — if you lose it, you have to rotate it via POST /:id/rotate-secret, which overwrites the column and returns a fresh secret ONCE (old signatures stop verifying immediately). Click \"Saved\" to close the dialog; the new endpoint row appears in the table.",
    },
    {
      title: "Send a test delivery to verify reachability",
      body: "Open a row's actions menu and click \"Send test\". Nixify calls scheduleTestDelivery, which creates a delivery with event type nixify.webhook.test (it bypasses subscription matching so you can verify your endpoint is reachable even with no production events subscribed). The delivery enters the durable queue — NEVER an inline first attempt from the application request path. The queue processor claims it atomically (updateMany WHERE status='pending' AND nextRetryAt <= NOW()), makes a single POST attempt with the Nixify-Signature + Nixify-Event headers, and the new row appears in the deliveries table with status, response code, and tries count. If your endpoint returns 2xx, the delivery is marked delivered; otherwise it retries with backoff.",
    },
    {
      title: "Inspect a failed delivery + the error class",
      body: "When a delivery fails (non-2xx response, network error, timeout, or SSRF block on a re-resolved URL), the queue processor classifies the error safely via classifyFetchError — it never persists raw exception messages. The bounded classifications are: network_error, timeout, http_4xx, http_5xx, ssrf_blocked, endpoint_missing, configuration_error, and max_attempts_exceeded (terminal). The deliveries table surfaces the tries count and the lastError code so you can diagnose. Common patterns: http_4xx means your endpoint returned 4xx (often a verifier rejecting the signature — check that you're using the right secret and the right tolerance window); http_5xx means your endpoint crashed; timeout means your handler took longer than 10s; ssrf_blocked means the URL re-resolved to a private / loopback / datacenter range at delivery time (a different IP than at create time).",
    },
    {
      title: "Replay a delivery when your endpoint is ready",
      body: "Click the Replay button on any delivery row. Nixify calls scheduleReplayDelivery, which creates a NEW auditable delivery with a fresh signature (current secret + fresh timestamp) — the original delivery is NOT mutated and retains its audit trail. This is why replay uses POST /deliveries/:deliveryId/replay, not a re-send of the original: the original is immutable evidence of what was attempted and when. Use replay when your endpoint was down during the original delivery, when you've fixed a bug in your handler, or when you want to verify your verifier still works. The new delivery appears as a fresh row in the deliveries table with its own deliveryId, attempts, and status.",
    },
  ],
  whyWhen: [
    {
      title: "When to register a webhook endpoint",
      body: "Register a webhook endpoint whenever you want Nixify to push real-time event notifications to your own server — instead of polling the API. Common use cases: sync contact creates/updates into your CRM, fire a Slack notification when an OTP is verified, audit OTP failure spikes, trigger an internal workflow when a broadcast completes. Pick event subscriptions from the 8 quick-pick chips or add your own custom event type. The endpoint URL must be https and SSRF-safe — Nixify rejects private / loopback / datacenter ranges at create time AND before every delivery.",
    },
    {
      title: "Why the secret is shown only once",
      body: "Storing the secret in plaintext would mean a database compromise could leak every endpoint's signing key. Nixify DOES store the secret in plaintext on the WebhookEndpoint row (it needs it to sign every delivery), but it never returns it via the API after the create or rotate-secret response. If you lose it, you have to rotate it — POST /:id/rotate-secret overwrites the column and returns the new secret ONCE. Old signatures stop verifying immediately (the receiver's verifier rejects them because the recomputed HMAC no longer matches the v1 in the header). Rotate immediately if you suspect compromise.",
    },
    {
      title: "Why all deliveries enter the queue before network delivery",
      body: "An inline first attempt from the application request path (e.g. from /api/v1/otp/send) would block the OTP response on the receiver's latency — a slow endpoint would slow down OTP delivery. Worse, a crash between scheduling and delivery would silently lose the event. Instead, ALL deliveries enter the durable queue (WebhookDelivery + WebhookQueue rows) BEFORE any network call. The application request returns immediately; the queue processor claims jobs atomically (updateMany WHERE status='pending' AND nextRetryAt <= NOW()) and delivers them out-of-band. This is what makes the webhook system reliable: a slow or down endpoint never blocks OTP delivery, and a processor crash mid-batch is recovered by the next worker (stale-lock recovery via 5-minute timeout).",
    },
    {
      title: "When to use replay vs. sending a test",
      body: "Send a test (POST /:id/test) when you want to verify your endpoint is reachable and your verifier works — it sends a synthetic nixify.webhook.test event with a synthetic payload, bypassing subscription matching. Use replay (POST /deliveries/:deliveryId/replay) when you want to re-deliver a real event that your endpoint missed (it was down, your handler had a bug, you deployed a fix). Replay creates a NEW delivery with a fresh signature but the SAME payload — the original delivery is immutable evidence of what was attempted and when. Don't use replay as a way to spam your endpoint; each replay is a full new delivery that counts against your delivery volume.",
    },
  ],
  mistakes: [
    {
      title: "Closing the secret dialog without copying",
      body: "The secret dialog is the ONE time the signing secret is ever shown via the API (after create or rotate-secret). Closing it without copying the secret means you have no way to verify incoming signatures — your verifier will reject every delivery because it can't recompute the HMAC. You'll have to rotate the secret (POST /:id/rotate-secret) to get a new one, and the old secret stops working immediately. Always copy the secret into a secret manager BEFORE clicking \"Saved\".",
    },
    {
      title: "Verifying the signature without the timestamp",
      body: "The Nixify-Signature header is `t=<timestamp>,v1=<hex>`. The HMAC is computed over `${timestamp}.${payload}`, not over the payload alone. If your verifier ignores the `t=` part and computes HMAC over just the payload, the comparison will fail every time. Parse the header into a map, extract `t` and `v1`, recompute HMAC over `${t}.${rawRequestBody}`, then constant-time compare against `v1`. The 5-minute tolerance window (|Date.now() - t| <= 5min) is also mandatory — without it, a captured signature can be replayed indefinitely.",
    },
    {
      title: "Trusting the payload without verifying",
      body: "If your handler reads the JSON body without verifying the Nixify-Signature, anyone who can POST to your endpoint URL can forge a webhook. The signature is the only proof the request came from Nixify. Always verify BEFORE trusting the payload: parse the header, recompute the HMAC with your stored secret, constant-time compare, and reject with 401 if it doesn't match. Use the raw request body (not a re-serialized JSON object) for the HMAC input — re-serialization can change whitespace / key order and break the signature.",
    },
    {
      title: "Expecting inline delivery from the application request",
      body: "The application request path (e.g. POST /api/v1/otp/send) does NOT deliver the webhook inline. It schedules a delivery (creates WebhookDelivery + WebhookQueue rows in a transaction) and returns immediately. The actual POST to your endpoint happens out-of-band, when the queue processor claims the job. If your endpoint is slow, the OTP response is unaffected. If your endpoint is down, the delivery retries with backoff — the OTP response is still unaffected. Don't write integration tests that assert the webhook arrived synchronously after the OTP send returns.",
    },
    {
      title: "Treating replay as a re-send of the original",
      body: "Replay creates a NEW auditable delivery with a fresh signature (current secret + fresh timestamp) and a new deliveryId. The original delivery is NOT mutated — it retains its original status, attempts, responseCode, and lastError as immutable evidence of what was attempted and when. This is why replay uses POST /deliveries/:deliveryId/replay, not a re-send of the original. If your audit log asserts a 1:1 mapping between OTP events and deliveries, replays will appear as additional rows — that's by design. The replayed delivery's payload is identical to the original, but the signature is fresh.",
    },
  ],
  proTips: [
    {
      title: "Subscribe to the test event during integration",
      body: "When you're integrating, subscribe your endpoint to nixify.webhook.test in the create dialog (it's one of the 8 quick-pick chips). Then use the per-row \"Send test\" action to fire a synthetic test delivery at any time. The test event bypasses subscription matching, so it'll arrive even if your subscription list is otherwise empty — but having it subscribed means your handler can route it consistently. Once you're confident, you can drop the test subscription and rely on the per-row Send test for spot checks.",
    },
    {
      title: "Implement idempotency on your receiver",
      body: "Webhook deliveries are at-least-once, not exactly-once. The queue processor retries on failure, and a stale-lock recovery can re-claim a job that was actually mid-flight — so your receiver may see the same delivery twice (rare, but possible). Use the Nixify-Delivery-Id header (or the deliveryId field in the payload) as your idempotency key: store it in a unique-constraint column on your side and skip processing if you've already seen it. Without idempotency, a retried delivery can cause double side-effects (e.g. two Slack notifications for one OTP).",
    },
    {
      title: "Rotate the secret on a schedule",
      body: "Even with no known compromise, rotating the signing secret every 90 days is a healthy practice. POST /:id/rotate-secret overwrites the column and returns the new secret ONCE; the old secret stops signing deliveries immediately. Update your verifier to use the new secret BEFORE the rotation (or right after — old deliveries will fail verification until your verifier is updated, which is the point of rotating). If you have multiple endpoints, rotate them on a staggered schedule so you're never updating all your verifiers at once.",
    },
    {
      title: "Use the deliveries table for forensics",
      body: "The Delivery history card is your forensic trail. Filter by endpoint + status to find failed deliveries; the tries count and lastError code tell you what went wrong. http_4xx + tries=1 often means your verifier rejected the signature (check the secret + tolerance window). http_4xx + retries means your endpoint returned 4xx on every attempt. http_5xx means your endpoint crashed. timeout means your handler took longer than 10s. ssrf_blocked means the URL re-resolved to a private / loopback / datacenter range at delivery time — someone changed DNS on you. Replay any delivery to re-deliver it after you've fixed the root cause.",
    },
  ],
  troubleshooting: [
    {
      title: "Create returns 400 (validation_failed / SSRF code)",
      body: "POST /api/dashboard/webhooks validates the URL with zod (min 1, max 2048) and runs SSRF validation via validateWebhookDestination. Private / loopback / datacenter IP ranges are rejected with the SSRF error code (e.g. ssrf_blocked_private, ssrf_blocked_loopback, ssrf_blocked_datacenter). Use a public URL pointing at your real endpoint. The events array is also zod-validated: 1-50 non-empty strings, each max 100 chars. If you need more than 50 subscriptions, consider consolidating event types or using a wildcard subscription (the backend's endpointMatchesEvent accepts \"*\" — the dashboard doesn't expose it, but you can set it via the API directly).",
    },
    {
      title: "Create returns 402 (quota_exhausted)",
      body: "Each plan has an active-endpoint quota (3 PRO, 25 MAX). The capacity check counts ACTIVE endpoints only — deactivated (isActive=false) endpoints don't consume a slot. Deactivate an unused endpoint to free a slot, or upgrade. The response code is 402 with code = quota_exhausted; distinct from 403 feature_not_available (below).",
    },
    {
      title: "Create returns 403 (feature_not_available)",
      body: "Webhooks is a PRO+ feature. The canAccess(userId, FEATURE_KEYS.WEBHOOK_ENDPOINTS) check returns false on FREE; the dashboard surfaces this as the not-available screen (\"Webhooks are not available on your current plan\"). Upgrade to PRO or above to register endpoints. Existing endpoints on a downgraded account are retained but stop receiving deliveries (the queue processor skips endpoints where isActive=false).",
    },
    {
      title: "Deliveries stuck in pending",
      body: "A delivery stuck in pending for more than a few seconds usually means the queue processor isn't running (it's an out-of-band worker, not part of the application request path). Check that processWebhookQueue is being invoked — typically by a cron, a separate worker process, or an edge function. The 5-minute stale-lock recovery means a crashed worker's claimed jobs will eventually be re-claimed by the next worker, but if no worker is running, deliveries stay pending indefinitely. The deliveries table will show tries=0 and lastError=null for these stuck rows.",
    },
    {
      title: "Delivery status failed with lastError = max_attempts_exceeded",
      body: "The delivery exhausted its retries. maxRetries is entitlement-driven (default 3); the queue processor retried with exponential backoff (10s → 30s → 90s) and every attempt failed. The lastError column will show the LAST attempt's error class (network_error / http_4xx / http_5xx / timeout / ssrf_blocked / endpoint_missing / configuration_error), and the final state is marked with lastError = max_attempts_exceeded. Inspect the tries count + lastError code to diagnose, fix your endpoint, then click Replay to schedule a fresh delivery with a fresh signature.",
    },
    {
      title: "Verifier rejects every delivery",
      body: "Your receiver computes HMAC-SHA256(secret, `${t}.${rawPayload}`) and constant-time compares against v1 in the Nixify-Signature header. Common failure modes: (1) wrong secret — check that you copied the secret from the create/rotate-secret dialog, not the masked prefix from the list view. (2) re-serialized payload — JSON.parse then JSON.stringify can change whitespace / key order; use the raw request body for the HMAC input. (3) tolerance window exceeded — verifyWebhookSignature rejects if |Date.now() - t| > 5min; check your server clock (NTP sync). (4) header parsing — the header is `t=<ts>,v1=<hex>` with a comma; split on \",\" then split each on \"=\".",
    },
  ],
  checklist: [
    { label: "Registered an https URL that passes SSRF validation (no private / loopback / datacenter ranges)" },
    { label: "Subscribed to at least one event type from the 8 quick-pick chips (or a custom event)" },
    { label: "Copied the signing secret from the create dialog into a secret manager BEFORE clicking \"Saved\"" },
    { label: "Implemented signature verification (parse t + v1, recompute HMAC, constant-time compare, 5min tolerance)" },
    { label: "Implemented idempotency on the receiver (dedupe by Nixify-Delivery-Id or deliveryId in payload)" },
    { label: "Used the raw request body for the HMAC input (not a re-serialized JSON object)" },
  ],
  whatNext:
    "Once your endpoint is registered and your verifier is implemented, subscribe to the production events you care about (otp.sent, otp.verified, contact.created, etc.) and watch the Delivery history card for live deliveries. Implement idempotency on your receiver (dedupe by Nixify-Delivery-Id) — deliveries are at-least-once, not exactly-once. Set a 90-day calendar reminder to rotate the signing secret. If a delivery fails, the tries count + lastError code in the deliveries table is your forensic trail — diagnose, fix, and click Replay to re-deliver with a fresh signature. For the full event catalog and the signing algorithm, see the developer documentation.",
  related: [
    { label: "Webhooks dashboard", href: "/dashboard/webhooks" },
    { label: "API Keys guide", href: "/guide/api-keys" },
    { label: "Contacts guide", href: "/guide/contacts" },
  ],

  /* ─── Stage copy ──────────────────────────────────────────────────────── */
  stage: {
    dir: "ltr",
    locale: "en",

    header: {
      title: "Webhooks",
      subtitle: "Register signed webhook endpoints, inspect deliveries, and replay events.",
      backToDashboard: "Dashboard",
      refresh: "Refresh",
      addEndpoint: "New Endpoint",
    },

    endpointsCard: {
      title: "Endpoints",
      subtitle: (total, active) =>
        `${total} ${total === 1 ? "endpoint" : "endpoints"} · ${active} active`,
      empty: "No webhook endpoints yet",
      emptyDescription:
        "Register a URL to receive signed POSTs whenever an OTP or contact event fires.",
      createEndpoint: "Create endpoint",
    },

    table: {
      url: "URL",
      events: "Events",
      status: "Status",
      created: "Created",
      lastUsed: "Last used",
      actions: "Actions",
      actionsAria: "Endpoint actions",
      neverUsed: "never",
      moreEvents: (n) => `+${n}`,
      noEvents: "—",
    },

    statusLabels: {
      active: "active",
      inactive: "inactive",
    },

    actionsMenu: {
      editEndpoint: "Edit endpoint",
      sendTest: "Send test",
      rotateSecret: "Rotate secret",
      deactivate: "Deactivate",
    },

    deliveriesCard: {
      title: "Delivery history",
      subtitle:
        "Recent webhook deliveries across all your endpoints. Replay to re-send any delivery with a fresh signature.",
      allEndpoints: "All endpoints",
      all: "All",
      empty: "No deliveries yet. Send a test webhook from the endpoint menu to see one here.",
      refreshAria: "Refresh deliveries",
      columnEvent: "Event",
      columnEndpoint: "Endpoint",
      columnStatus: "Status",
      columnTries: "Tries",
      columnCode: "Code",
      columnError: "Error",
      columnCreated: "Created",
      columnReplay: "Replay",
      replayAria: "Replay delivery",
      replayTooltip: "Replay this delivery with a fresh signature",
    },

    deliveryStatus: {
      delivered: "delivered",
      failed: "failed",
      pending: "pending",
    },

    pagination: {
      pageOf: (page, total) => `Page ${page} · ${total} total`,
      prev: "Prev",
      next: "Next",
    },

    createDialog: {
      titleCreate: "Create endpoint",
      titleEdit: "Edit endpoint",
      descriptionCreate:
        "Register a URL to receive signed POSTs whenever a subscribed event fires. The signing secret will be shown ONCE after you create the endpoint — copy it immediately.",
      descriptionEdit: "Update the URL or event subscriptions for this endpoint. The signing secret is not changed by editing.",
      urlLabel: "Endpoint URL",
      urlPlaceholder: "https://example.com/hooks/nixify",
      urlHelp: "The full https URL Nixify will POST event payloads to. Private / loopback / datacenter ranges are rejected.",
      eventsLabel: "Event subscriptions",
      eventsSelected: (n) => `${n} event${n === 1 ? "" : "s"} selected`,
      customPlaceholder: "custom.event.type",
      cancel: "Cancel",
      submitCreate: "Create endpoint",
      submitEdit: "Save changes",
    },

    secretDialog: {
      titleCreate: "Endpoint secret",
      titleRotate: "New signing secret",
      description:
        "Copy this signing secret now. It won't be shown again — Nixify uses it to sign every delivery and the receiver uses it to verify the Nixify-Signature header.",
      secretLabel: "Signing secret",
      copy: "Copy",
      copied: "Copied",
      warningTitle: "This secret won't be shown again",
      warningBody:
        "Nixify uses HMAC-SHA256(secret, `${timestamp}.${payload}`) to sign every delivery. If you lose the secret, you have to rotate it — old signatures will stop verifying immediately.",
      done: "Saved",
      hashCaption: "HMAC-SHA256 · Nixify-Signature: t=<ts>,v1=<hex>",
    },

    deactivateDialog: {
      title: "Deactivate endpoint",
      message:
        "This endpoint will stop receiving events immediately. Existing deliveries are retained for audit. You can reactivate by editing the endpoint.",
      cancel: "Cancel",
      confirm: "Deactivate",
    },

    notAvailable: {
      title: "Webhooks not available",
      description:
        "Webhook endpoints are part of the Developer Tools capability, which is not available on your current plan.",
      cta: "View Plans",
    },

    /* Seed endpoints. URLs are masked (origin + `/***`) just like the real
     * list view. The seed rows cover both visible statuses (active +
     * inactive) and a representative mix of event subscriptions. */
    endpoints: [
      {
        id: 1,
        url: "https://api.acme.com/***",
        events: ["otp.sent", "otp.verified", "otp.failed"],
        isActive: true,
        createdAtRelative: "2 weeks ago",
        lastUsedAtRelative: "3m ago",
      },
      {
        id: 2,
        url: "https://hooks.internal.acme.com/***",
        events: ["contact.created", "contact.updated", "nixify.event.received"],
        isActive: true,
        createdAtRelative: "5 days ago",
        lastUsedAtRelative: "12m ago",
      },
      {
        id: 3,
        url: "https://staging.acme.com/***",
        events: ["nixify.webhook.test"],
        isActive: true,
        createdAtRelative: "1 day ago",
        lastUsedAtRelative: "1h ago",
      },
      {
        id: 4,
        url: "https://legacy.acme.com/***",
        events: ["otp.sent"],
        isActive: false,
        createdAtRelative: "3 months ago",
        lastUsedAtRelative: "1mo ago",
      },
    ],

    /* Seed deliveries. Cover every visible status (delivered / failed /
     * pending) and exercise the retry, error, and code paths. */
    deliveries: [
      {
        deliveryId: "4a2d8c1e-7b3f-4e7b-9c1a-8b4f5e2d3a01",
        endpointId: 1,
        eventId: "otp.verified",
        status: "delivered",
        attempts: 1,
        responseCode: 200,
        createdAtRelative: "3m ago",
        lastError: null,
      },
      {
        deliveryId: "5b3e9d2f-8c4a-4f8c-ad2b-9c5f6e3d4b12",
        endpointId: 2,
        eventId: "contact.created",
        status: "delivered",
        attempts: 1,
        responseCode: 200,
        createdAtRelative: "12m ago",
        lastError: null,
      },
      {
        deliveryId: "6c4f1e3a-9d5b-4a9d-be3c-ad6f7e4e5c23",
        endpointId: 1,
        eventId: "otp.failed",
        status: "failed",
        attempts: 3,
        responseCode: 500,
        createdAtRelative: "1h ago",
        lastError: "max_attempts_exceeded",
      },
      {
        deliveryId: "7d5e2f4b-ae6c-4bae-cf4d-be7a8f5f6d34",
        endpointId: 3,
        eventId: "nixify.webhook.test",
        status: "pending",
        attempts: 0,
        responseCode: null,
        createdAtRelative: "just now",
        lastError: null,
      },
      {
        deliveryId: "8e6f3a5c-bf7d-4cbf-da5e-cf8b9a6a7e45",
        endpointId: 2,
        eventId: "contact.updated",
        status: "delivered",
        attempts: 1,
        responseCode: 200,
        createdAtRelative: "2h ago",
        lastError: null,
      },
      {
        deliveryId: "9f7a4b6d-c8e-4dcc-eb6f-da9cab7b8f56",
        endpointId: 1,
        eventId: "otp.sent",
        status: "failed",
        attempts: 2,
        responseCode: null,
        createdAtRelative: "3h ago",
        lastError: "timeout",
      },
    ],

    /* The signing secret revealed during the createEndpoint scene — local
     * demo data. NEVER a real secret. Looks like a real mg_whsec_ secret
     * (mg_whsec_ + ~32 url-safe chars). */
    revealedSecret: "mg_whsec_7c3b9f1e4a2d4e7b9c1a8b4f5e2d3a01",
    revealedUrl: "https://api.acme.com/hooks/nixify",
  },

  /* ─── Creative section copy ──────────────────────────────────────────── */
  creative: {
    /* 1. Event journey — event lifecycle from trigger to audit */
    eventJourney: {
      heading: "Event journey",
      subheading:
        "Every webhook event follows the same path: a trigger in the application schedules a delivery, the durable queue claims it atomically, the processor makes a single POST attempt with the Nixify-Signature + Nixify-Event headers, and the delivery lands in your endpoint (or retries with backoff). The original delivery is immutable evidence; replays create new deliveries with fresh signatures.",
      legendTitle: "Color key",
      legendItems: [
        { label: "User / API surface", tone: "ui" },
        { label: "Nixify internal state change", tone: "state" },
        { label: "Downstream / receiver side", tone: "downstream" },
      ],
      steps: [
        {
          badge: "01",
          title: "Trigger fires",
          body: "An OTP send, OTP verify, contact create, or contact update completes inside the application. The application calls deliverWebhook(event, userId) — fire-and-forget (catches internally so the OTP response is never blocked).",
          token: "POST /api/v1/otp/send",
          tone: "ui",
        },
        {
          badge: "02",
          title: "Schedule deliveries",
          body: "scheduleUserWebhookDeliveries queries active endpoints where WebhookEndpoint.userId === userId, filters by subscription match (endpointMatchesEvent includes \"*\" as a wildcard), and creates WebhookDelivery(pending) + WebhookQueue(pending) rows in a single transaction. dedupeKey is DB-enforced unique — P2002 means a concurrent request already scheduled this delivery (idempotent skip).",
          token: "scheduleUserWebhookDeliveries",
          tone: "state",
        },
        {
          badge: "03",
          title: "Sign the payload",
          body: "For each matching endpoint, the secret is used to compute the signature: signedPayload = `${timestamp}.${payload}`; mac = HMAC-SHA256(secret, signedPayload).digest(\"hex\"); signature = `t=${timestamp},v1=${mac}`. The signature is stored on the delivery row so the processor doesn't have to recompute it.",
          token: "signWebhook(secret, payload)",
          tone: "state",
        },
        {
          badge: "04",
          title: "Queue processor claims",
          body: "An out-of-band worker calls processWebhookQueue. It recovers stale locks (jobs in 'processing' with lockedAt older than 5min), then atomically claims a bounded batch (MAX_BATCH_SIZE=25) via updateMany WHERE status='pending' AND nextRetryAt <= NOW(). Only one worker can win each job.",
          token: "claimPendingJobs(25, workerId)",
          tone: "state",
        },
        {
          badge: "05",
          title: "SSRF re-validate + POST",
          body: "Before every network call, validateWebhookDestination re-resolves the URL and rejects private / loopback / datacenter ranges (someone could have changed DNS on you since create time). The POST is sent with Content-Type: application/json, Nixify-Signature, and Nixify-Event headers. redirect: \"error\" — no redirect following. 10s timeout.",
          token: "fetch(url, { method: 'POST', ...SAFE_FETCH_OPTIONS })",
          tone: "downstream",
        },
        {
          badge: "06",
          title: "Classify result + retry",
          body: "On 2xx, the delivery is marked delivered + the queue job is marked done. On failure, classifyFetchError safely classifies the error (network_error / timeout / http_4xx / http_5xx / ssrf_blocked) and either schedules a retry with exponential backoff (10s → 30s → 90s) or, if attempts >= maxRetries, marks the delivery failed with lastError = max_attempts_exceeded.",
          token: "classifyFetchError(err, httpStatus)",
          tone: "state",
        },
        {
          badge: "07",
          title: "Audit + replay",
          body: "The delivery row is immutable evidence: status, attempts, responseCode, lastError, deliveredAt. The dashboard's Delivery history card surfaces these for forensics. Replay (POST /deliveries/:deliveryId/replay) creates a NEW delivery with a fresh signature (current secret + fresh timestamp) — the original is NOT mutated.",
          token: "scheduleReplayDelivery(originalDeliveryId, userId)",
          tone: "downstream",
        },
      ],
      footnote:
        "All seven stages are implemented in src/lib/dx/webhooks.ts (deliverWebhook, scheduleUserWebhookDeliveries, signWebhook, processWebhookQueue, claimPendingJobs, classifyFetchError, scheduleReplayDelivery). The dashboard reads/writes only via the routes in src/app/api/dashboard/webhooks/ — never directly against the WebhookEndpoint / WebhookDelivery / WebhookQueue tables.",
      warningTitle: "Durable-only dispatch",
      warningBody:
        "ALL deliveries enter the queue BEFORE network delivery. There is no inline first attempt from application request paths. This is what makes the webhook system reliable: a slow or down endpoint never blocks OTP delivery, and a processor crash mid-batch is recovered by the next worker.",
    },

    /* 2. Endpoint anatomy — what's stored, what's masked, what's revealed */
    endpointAnatomy: {
      heading: "Endpoint anatomy",
      subheading:
        "A webhook endpoint has six persisted fields: id, url, events, secret, isActive, and the derived lastUsedAt. The list view masks the URL (origin + `/***`) and never returns the secret; the detail view returns the full URL but still never returns the secret. The secret is shown ONCE in the create or rotate-secret response — Nixify needs it in plaintext to sign every delivery, but never returns it via the API after that one-time reveal.",
      fieldsTitle: "The six fields of an endpoint",
      fields: [
        {
          key: "url",
          label: "URL",
          desc: "The full https URL Nixify POSTs to. SSRF-validated at create AND before every delivery (re-resolved at delivery time to detect DNS changes). Masked in the list view (origin + `/***`); full URL returned by GET /:id.",
          token: "https://api.acme.com/hooks/nixify",
          tone: "ui",
        },
        {
          key: "events",
          label: "Events",
          desc: "Comma-joined event subscriptions (storage format). endpointMatchesEvent splits on \",\" and checks if the event type is in the resulting list, or if \"*\" is present (wildcard). 1-50 subscriptions, each max 100 chars.",
          token: "otp.sent,otp.verified,otp.failed",
          tone: "ui",
        },
        {
          key: "secret",
          label: "Signing secret",
          desc: "mg_whsec_ + 32 url-safe chars (randomBytes(24).toString(\"base64url\")). Used by signWebhook to compute HMAC-SHA256(secret, `${timestamp}.${payload}`). Stored in plaintext on the WebhookEndpoint row — Nixify needs it to sign every delivery — but NEVER returned via the API after create or rotate-secret.",
          token: "mg_whsec_7c3b9f1e4a2d4e7b9c1a8b4f5e2d3a01",
          tone: "secret",
        },
        {
          key: "active",
          label: "Active flag",
          desc: "isActive boolean. The queue processor skips endpoints where isActive=false. Deactivate (DELETE /:id) is a soft delete — sets isActive=false, retains the row + deliveries for audit. Capacity check counts only ACTIVE endpoints.",
          token: "isActive: true",
          tone: "storage",
        },
        {
          key: "dates",
          label: "Created + last used",
          desc: "createdAt is set at create time. lastUsedAt is derived from the most recent deliveredAt on a WebhookDelivery row (deliveredAt !== null). The list view shows both as relative strings; \"never\" is shown when lastUsedAt is null.",
          token: "createdAt · lastUsedAt",
          tone: "storage",
        },
        {
          key: "id",
          label: "Numeric ID",
          desc: "Stable integer primary key. Used in URL paths (/api/dashboard/webhooks/:id) and as the foreign key on WebhookDelivery.endpointId. The public deliveryId is a separate UUID on the delivery row.",
          token: "id: 1",
          tone: "storage",
        },
      ],
      matrixTitle: "List view vs. detail view",
      matrixSubtitle:
        "The list view (GET /api/dashboard/webhooks) masks the URL and never returns the secret. The detail view (GET /:id) returns the full URL but still never returns the secret. The secret is only ever returned by POST (create) and POST /:id/rotate-secret — exactly once each.",
      matrixColDimension: "Field",
      matrixColListView: "List view",
      matrixColDetailView: "Detail view",
      matrixRows: [
        {
          dimension: "URL",
          listView: "https://api.acme.com/***",
          detailView: "https://api.acme.com/hooks/nixify",
          tone: "ui",
        },
        {
          dimension: "Events",
          listView: "otp.sent,otp.verified,otp.failed",
          detailView: "otp.sent,otp.verified,otp.failed",
          tone: "ui",
        },
        {
          dimension: "Signing secret",
          listView: "—",
          detailView: "—",
          tone: "secret",
        },
        {
          dimension: "Active flag",
          listView: "isActive: true",
          detailView: "isActive: true",
          tone: "storage",
        },
        {
          dimension: "Created / last used",
          listView: "2 weeks ago · 3m ago",
          detailView: "2 weeks ago · 3m ago",
          tone: "storage",
        },
        {
          dimension: "Numeric ID",
          listView: "id: 1",
          detailView: "id: 1",
          tone: "storage",
        },
      ],
      cycleTitle: "The create → reveal → sign → deliver → audit cycle",
      cycleSubtitle:
        "Every endpoint goes through the same five-stage lifecycle. The full secret exists in plaintext on Nixify's side for the lifetime of the endpoint (it's needed to sign every delivery), but it's only ever returned via the API in stage 1 (create) or when you explicitly rotate it.",
      cycle: [
        {
          badge: "01",
          title: "Create",
          body: "POST /api/dashboard/webhooks with {url, events[]}. SSRF validation at create time. Capacity check (activeCount < plan quota). Returns the secret ONCE in the response body.",
          token: "POST /api/dashboard/webhooks",
          tone: "ui",
        },
        {
          badge: "02",
          title: "Reveal once",
          body: "The secret dialog shows the mg_whsec_… secret. Copy it into a secret manager BEFORE closing the dialog. Nixify stores it on the WebhookEndpoint row; the API never returns it again.",
          token: "mg_whsec_7c3b9f1e4a2d4e7b9c1a8b4f5e2d3a01",
          tone: "secret",
        },
        {
          badge: "03",
          title: "Sign",
          body: "Every time a subscribed event fires, signWebhook(secret, payload, timestamp) computes HMAC-SHA256(secret, `${timestamp}.${payload}`).digest(\"hex\") and returns `t=${timestamp},v1=${hex}`. The signature is stored on the delivery row.",
          token: "HMAC-SHA256(secret, `${t}.${payload}`)",
          tone: "storage",
        },
        {
          badge: "04",
          title: "Deliver",
          body: "The queue processor claims the job atomically, re-validates SSRF, and POSTs the payload with Nixify-Signature + Nixify-Event headers. redirect: \"error\". 10s timeout. On 2xx → delivered. On failure → classify + retry with backoff (10s → 30s → 90s).",
          token: "POST {url} · Nixify-Signature · Nixify-Event",
          tone: "deliver",
        },
        {
          badge: "05",
          title: "Audit + replay",
          body: "The delivery row is immutable evidence. Replay (POST /deliveries/:deliveryId/replay) creates a NEW delivery with a fresh signature — the original is NOT mutated. Rotate-secret (POST /:id/rotate-secret) overwrites the secret column and returns the new secret ONCE; old signatures stop verifying immediately.",
          token: "POST /:id/rotate-secret · POST /deliveries/:id/replay",
          tone: "storage",
        },
      ],
      footnote:
        "All six fields are persisted on the WebhookEndpoint table. The masking + never-return-secret rules are enforced by the routes in src/app/api/dashboard/webhooks/route.ts (maskUrl + the explicit omission of `secret` from GET responses). The signing + delivery logic is in src/lib/dx/webhooks.ts.",
      warningTitle: "The secret is shown ONCE",
      warningBody:
        "Nixify needs the secret in plaintext to sign every delivery, so it IS stored on the WebhookEndpoint row — but it's only ever returned via the API in the POST (create) response or the POST /:id/rotate-secret response. If you lose it, you have to rotate it — there is no other way to retrieve it.",
    },

    /* 3. Signing & verification — HMAC-SHA256 signing explained */
    signingVerification: {
      heading: "Signing & verification",
      subheading:
        "Every webhook delivery is signed with HMAC-SHA256 using the endpoint's signing secret. The Nixify-Signature header carries `t=<timestamp>,v1=<hex>` — the timestamp prevents replay attacks (5-minute tolerance window), and the v1 hex is the HMAC of `${timestamp}.${rawPayload}`. The receiver recomputes the HMAC with the stored secret and constant-time compares against v1. Never trust the payload without verifying the signature.",
      signCard: {
        badge: "Sign",
        title: "Nixify side",
        body:
          "Before delivery, Nixify computes the signature with the endpoint's stored secret. The signed payload is `${timestamp}.${rawPayload}` — the timestamp is included so the receiver can reject replays.",
        bullets: [
          "signedPayload = `${timestamp}.${payload}`",
          "mac = HMAC-SHA256(secret, signedPayload).digest(\"hex\")",
          "signature = `t=${timestamp},v1=${mac}`",
          "Stored on the WebhookDelivery row; sent in the Nixify-Signature header",
        ],
      },
      verifyCard: {
        badge: "Verify",
        title: "Receiver side",
        body:
          "Your handler parses the Nixify-Signature header, recomputes the HMAC with the stored secret, and constant-time compares against v1. Reject with 401 if anything fails — never trust the payload without verifying.",
        bullets: [
          "Parse `t=<ts>,v1=<hex>` from the Nixify-Signature header",
          "Reject if t or v1 is missing",
          "Reject if |Date.now() - t| > 5 minutes (replay window)",
          "expected = HMAC-SHA256(secret, `${t}.${rawPayload}`).digest(\"hex\")",
          "Constant-time compare expected vs v1 — reject on mismatch",
        ],
      },
      headersTitle: "Delivery headers",
      headersSubtitle:
        "Every POST carries these three headers. The first two (Nixify-Signature + Nixify-Event) are required for verification and routing; the third (Nixify-Delivery-Id) is the public UUID for idempotency / replay correlation.",
      headerCol: "Header",
      valueCol: "Example",
      descCol: "Carries",
      headers: [
        {
          header: "Nixify-Signature",
          value: "t=1700000000,v1=4a2d8c1e7b3f4e7b9c1a8b4f5e2d3a01",
          desc: "The HMAC-SHA256 signature: `t=<unix-ms>,v1=<hex>`. Verify with the endpoint's stored secret + the raw request body.",
          tone: "sign",
        },
        {
          header: "Nixify-Event",
          value: "otp.verified",
          desc: "The envelope event type (e.g. otp.sent, otp.verified, contact.created, nixify.webhook.test). Route your handler on this — it's also in the payload's `type` field.",
          tone: "verify",
        },
        {
          header: "Nixify-Delivery-Id",
          value: "4a2d8c1e-7b3f-4e7b-9c1a-8b4f5e2d3a01",
          desc: "Public UUID for the delivery. Use as your idempotency key — deliveries are at-least-once, so the same deliveryId may arrive twice (rare; stale-lock recovery).",
          tone: "id",
        },
      ],
      stepsTitle: "Sign + verify side by side",
      steps: [
        {
          badge: "01",
          title: "Build the signed payload",
          body: "Concatenate the unix-ms timestamp + \".\" + the raw JSON payload as a string. The timestamp is included so the receiver can reject replays outside the 5-minute window.",
          token: "signedPayload = `${timestamp}.${payload}`",
          tone: "sign",
        },
        {
          badge: "02",
          title: "Compute the HMAC",
          body: "Use Node's createHmac(\"sha256\", secret).update(signedPayload).digest(\"hex\"). The output is a 64-char lowercase hex string. The secret is the endpoint's mg_whsec_… value — Nixify stores it in plaintext to compute this on every delivery.",
          token: "createHmac(\"sha256\", secret).update(signedPayload).digest(\"hex\")",
          tone: "sign",
        },
        {
          badge: "03",
          title: "Format the header",
          body: "Build the `t=<timestamp>,v1=<hex>` string and put it in the Nixify-Signature header. The receiver parses this exact format — split on \",\", then split each on \"=\".",
          token: "Nixify-Signature: t=1700000000,v1=4a2d…",
          tone: "sign",
        },
        {
          badge: "04",
          title: "Parse the header",
          body: "On the receiver side, read the Nixify-Signature header, split on \",\", build a {t, v1} map. Reject with 401 if either field is missing or not a number / non-empty string.",
          token: "Object.fromEntries(header.split(\",\").map(p => p.split(\"=\")))",
          tone: "verify",
        },
        {
          badge: "05",
          title: "Check the tolerance window",
          body: "Compute |Date.now() - t|. If it exceeds 5 minutes (300000 ms), reject with 401. This bounds the replay-attack window — a captured signature is worthless after 5 minutes.",
          token: "toleranceMs = 5 * 60 * 1000",
          tone: "guard",
        },
        {
          badge: "06",
          title: "Constant-time compare",
          body: "Recompute expected = HMAC-SHA256(secret, `${t}.${rawRequestBody}`).digest(\"hex\"). Compare against v1 with a constant-time XOR loop — never use === (timing attack). Reject with 401 on any byte mismatch.",
          token: "for (i) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i); return diff === 0",
          tone: "guard",
        },
      ],
      toleranceTitle: "5-minute tolerance window",
      toleranceBody:
        "verifyWebhookSignature rejects if |Date.now() - t| > 5 * 60 * 1000 ms. This bounds the replay-attack window: a captured signature is worthless after 5 minutes. Make sure your server clock is NTP-synced — clock drift > 5 minutes will reject every delivery.",
      constantTimeTitle: "Constant-time comparison",
      constantTimeBody:
        "The compare loop XORs each byte of expected vs v1 and ORs the result into a single `diff` flag. Returning `diff === 0` avoids short-circuiting: even the first mismatched byte still iterates the full length, so a timing attacker can't learn the prefix of a valid signature.",
      footnote:
        "Signing is implemented in src/lib/dx/webhooks.ts (signWebhook + generateWebhookSecret). Verification is implemented in the same file (verifyWebhookSignature) — you can copy this function verbatim into your receiver. The 5-minute tolerance and constant-time compare are mandatory; do not weaken them.",
      warningTitle: "Rotate on suspected compromise",
      warningBody:
        "If you suspect the signing secret has been leaked (it shows up in an unexpected IP, a partner reports a breach, you committed it to git), rotate it via POST /:id/rotate-secret. Nixify overwrites the column and returns the new secret ONCE — old signatures stop verifying immediately because the recomputed HMAC no longer matches the v1 in the header.",
    },

    /* 4. Delivery lifecycle — pending → processing → delivered/failed */
    deliveryLifecycle: {
      heading: "Delivery lifecycle",
      subheading:
        "Every delivery moves through a 5-state lifecycle driven by the queue processor. Pending deliveries are claimed atomically (only one worker wins each job), processed with a single POST attempt, and either marked delivered (2xx) or scheduled for retry with exponential backoff (10s → 30s → 90s). After maxRetries (default 3), the delivery is marked failed with lastError = max_attempts_exceeded. Stale locks are recovered automatically via the 5-minute timeout.",
      statesTitle: "Delivery states",
      states: [
        {
          key: "pending",
          label: "Pending",
          desc: "Default state at creation. The job is in the WebhookQueue with status='pending' and nextRetryAt <= NOW(). Waiting for a worker to claim it atomically.",
          tone: "pending",
        },
        {
          key: "processing",
          label: "Processing",
          desc: "A worker has claimed the job (status='processing', lockedAt=now, lockedBy=workerId). The POST attempt is in flight. Only one worker can hold this state per job at a time.",
          tone: "active",
        },
        {
          key: "delivered",
          label: "Delivered",
          desc: "The endpoint returned 2xx. status='done' on the queue job, status='delivered' on the delivery row. deliveredAt + responseCode recorded. Terminal state — no further attempts.",
          tone: "good",
        },
        {
          key: "failed",
          label: "Failed",
          desc: "Either max_attempts_exceeded (retries exhausted, lastError=max_attempts_exceeded) or endpoint_missing (endpoint deactivated or deleted mid-flight). Terminal state — but you can still replay to create a new delivery.",
          tone: "bad",
        },
        {
          key: "recovered",
          label: "Stale-lock recovered",
          desc: "A worker held 'processing' for > 5min (STALE_LOCK_TIMEOUT_MS). The next processWebhookQueue pass resets it to pending (with backoff if not exhausted) or to failed (if attempts >= maxRetries). The compare-and-swap guard prevents resetting a fresh claim.",
          tone: "warn",
        },
      ],
      transitionsTitle: "Transitions",
      transitions: [
        {
          from: "pending",
          to: "processing",
          trigger: "Worker claims the job",
          token: "updateMany WHERE status='pending' AND nextRetryAt <= NOW()",
          tone: "claim",
        },
        {
          from: "processing",
          to: "delivered",
          trigger: "Endpoint returns 2xx",
          token: "singleAttempt → res.ok",
          tone: "success",
        },
        {
          from: "processing",
          to: "pending",
          trigger: "Endpoint fails + attempts < maxRetries",
          token: "backoff: 10s → 30s → 90s (Math.min(10_000 * 3^(n-1), 90_000))",
          tone: "failure",
        },
        {
          from: "processing",
          to: "failed",
          trigger: "Endpoint fails + attempts >= maxRetries",
          token: "lastError: max_attempts_exceeded",
          tone: "exhaust",
        },
        {
          from: "processing",
          to: "pending",
          trigger: "Stale lock recovered (lockedAt > 5min) + attempts < maxRetries",
          token: "recoverStaleLocks → reset to pending with backoff",
          tone: "recover",
        },
        {
          from: "processing",
          to: "failed",
          trigger: "Stale lock recovered + attempts >= maxRetries",
          token: "recoverStaleLocks → mark failed",
          tone: "exhaust",
        },
        {
          from: "processing",
          to: "failed",
          trigger: "Endpoint deactivated or deleted mid-flight",
          token: "lastError: endpoint_missing",
          tone: "exhaust",
        },
        {
          from: "processing",
          to: "failed",
          trigger: "URL re-resolved to a private / loopback / datacenter range",
          token: "lastError: ssrf_blocked",
          tone: "exhaust",
        },
      ],
      retryTitle: "Exponential backoff",
      retryBody:
        "Each retry's nextRetryAt = now + Math.min(BACKOFF_BASE_MS * 3^(attempts-1), 90_000). BACKOFF_BASE_MS = 10_000 (10s), so attempts 1 → 2 → 3 wait 10s → 30s → 90s. The cap is 90s — a misbehaving endpoint can't hold a delivery hostage for hours. maxRetries is resolved from the endpoint owner's WEBHOOK_RETRIES entitlement (default 3) — so the full retry sequence is 10s → 30s → 90s → failed.",
      staleLockTitle: "Stale-lock recovery",
      staleLockBody:
        "If a worker crashes mid-flight (status='processing' but the process is dead), the next processWebhookQueue pass finds jobs where lockedAt < (now - 5min) and resets them. The compare-and-swap guard (WHERE lockedAt < cutoff) prevents a race where one worker reads a stale job, another worker recovers it, a new worker claims it with a fresh lockedAt, and the old recovery attempt resets the fresh claim.",
      footnote:
        "The full state machine is implemented in src/lib/dx/webhooks.ts (processWebhookQueue, claimPendingJobs, recoverStaleLocks, processOneJob, markJobFailed, singleAttempt). The MAX_BATCH_SIZE = 25 — each worker pass processes at most 25 jobs. Workers are out-of-band (cron / separate process / edge function); the application request path only schedules deliveries.",
      warningTitle: "Replay creates a NEW delivery",
      warningBody:
        "Replay (POST /deliveries/:deliveryId/replay) does NOT transition the original delivery — it creates a NEW delivery with a fresh signature (current secret + fresh timestamp) and a new deliveryId. The original is immutable evidence of what was attempted and when. This is why replay uses a separate endpoint, not a state transition on the original.",
    },
  },
};
