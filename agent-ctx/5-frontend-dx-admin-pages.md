# Task 5 — DX Admin UI Pages (frontend-only)

**Agent:** fullstack-developer (frontend)
**Task ID:** 5
**Scope:** Build 6 admin DX pages under `src/app/admin/` + update the security dashboard header with navigation. Frontend only — backend API routes built in parallel.

## Work Log

### Pages built (all `"use client"`)
1. **`src/app/admin/api-keys/page.tsx`** — API Key Management
   - On mount: `GET /api/admin/api-keys` (401 → redirect to `/admin/login`).
   - Create form: name (Input), environment (Select: development/production), scopes (Select: full/read_only), expiresAt (optional date Input).
   - On create: `POST /api/admin/api-keys` with `{ name, environment, scopes, expiresAt? }`. Full key shown ONCE in a prominent emerald Alert with a copy button + "won't be shown again" warning.
   - Existing-keys table: prefix (mono), name, env badge (dev=amber, prod=emerald), scopes, lastUsedAt, expiresAt, status (active/revoked/expired badge), revoke button (`DELETE /api/admin/api-keys?id=X`).
   - Per-row expandable usage stats: fetches `GET /api/admin/api-keys/usage?id=X` → renders 3 stat tiles (last24h / last7d / allTime) each showing total + breakdown (✓success / ·client / ✗server).
   - Header: back-to-admin + "API Keys" title + KeyRound icon (emerald).
   - Field-name alignment verified against actual `/api/admin/api-keys/usage` response (`{ last24h, last7d, allTime }` each with `{success, client, server, total}`).

2. **`src/app/admin/webhooks/page.tsx`** — Webhook Testing
   - On mount: `GET /api/admin/webhooks` (returns `{ endpoints: [...with nested recentDeliveries...] }`).
   - Add-endpoint form: URL Input + event multi-select (4 toggle pills: otp.sent, otp.verified, otp.failed, otp.expired). POST sends `{ url, events: string[] }` (array, not comma-joined) to match the zod schema.
   - On create: signing secret shown ONCE in emerald Alert with copy button.
   - Endpoints table: URL, events (mono badges), active/inactive badge, deliveries count (computed from `recentDeliveries.length`), delete button (`DELETE /api/admin/webhooks?id=X`).
   - Deliveries section: table with eventId, requestId (mono, truncated), status (delivered=emerald / failed=rose / pending=amber badge), responseCode, attempts, lastError (truncated), createdAt time, Replay button (`POST /api/admin/webhooks/test { deliveryId }`).
   - Payload viewer (right card): clicking a delivery row shows delivery metadata + signature + JSON payload. Since the recent-deliveries list doesn't include payload/signature (only metadata), the viewer gracefully degrades with a helpful message pointing to the Replay button.
   - Header: back-to-admin + "Webhooks" title + Webhook icon.

3. **`src/app/admin/logs/page.tsx`** — Live Request Logs
   - On mount: `GET /api/admin/request-logs?page=1&pageSize=50` (401 → redirect).
   - Filters: search (requestId/path), status (all/2xx/4xx/5xx), page size (25/50/100/250) — uses shadcn Select + Input with Apply/Clear buttons.
   - Table: timestamp, requestId (mono, truncated, title attr for full), method badge (GET=emerald, POST=cyan, DELETE=rose, etc.), path (mono, truncated), status badge (2xx=emerald, 4xx=amber, 5xx=rose), duration ms (color-coded: <500=emerald, <2s=amber, ≥2s=rose), IP.
   - Auto-refresh checkbox (5s `setInterval`, properly cleaned up in useEffect).
   - Prev/next pagination + page indicator.
   - CSV export button — generates CSV client-side from current page's `logs` array (proper escaping for userAgent/error fields with embedded quotes), downloads via Blob + temp `<a>`.
   - Field-name alignment verified against actual API: response uses `logs` (not `rows`).
   - Header: back-to-admin + "Request Logs" title + Activity icon.

4. **`src/app/admin/playground/page.tsx`** — API Playground
   - Left panel: endpoint Select (3 endpoints: POST /api/v1/otp/send, /verify, /resend), API key password Input (placeholder `mg_live_xxx…`), JSON body Textarea pre-filled with per-endpoint template.
   - "Send Request" button — fetches the selected endpoint with the key + JSON-parsed body, captures status, duration, headers (filters to `x-*` + `content-type`), and pretty-prints body.
   - Right panel: response viewer — status badge (color-coded), duration (ms), filtered headers table, pretty-printed JSON body in `<pre>` with copy button.
   - Below: Generated Code section with 4 language Tabs (cURL, JavaScript, Python, Go) — uses `generateSnippet()` from `@/lib/dx/code-snippets` (client-safe, no server-only imports) to produce copy-ready snippets in a `<pre>`.
   - Request history: last 5 requests stored in component state — click a row to re-run (re-selects endpoint + repopulates body).
   - Auth check simplified to just `setAuthChecked(true)` since middleware already guards `/admin/*`.
   - Header: back-to-admin + "API Playground" title + FlaskConical icon.

5. **`src/app/admin/errors/page.tsx`** — Error Explorer
   - Imports `ERRORS_CATALOG` from `@/lib/dx/errors-catalog` (static — no API call).
   - Search bar (filters by code / title / description, case-insensitive).
   - HTTP status filter (all / 4xx / 5xx) via shadcn Select.
   - Responsive grid of error cards (md:2 cols, xl:3 cols). Each card: code (mono badge, click-to-copy), HTTP status (color-coded badge), title, description, "Possible Causes" list (amber icon), "Recommended Fix" list (emerald icon), doc link `/admin/errors#<code>`.
   - "X of Y error codes" indicator.
   - Header: back-to-admin + "Error Explorer" title + AlertCircle icon.

6. **`src/app/admin/docs/page.tsx`** — Interactive Docs
   - Two-column layout: left sidebar (sticky) with 8 sections, right content area.
   - Sidebar nav: Quick Start, Authentication, API Reference, SDKs, Webhooks, Rate Limits, Error Codes, Changelog — clicking smooth-scrolls to the section + highlights active.
   - Quick Start: 3-step guide (1. Create API key, 2. Install SDK with npm/pip commands, 3. Send your first OTP) with numbered emerald circles + copyable code blocks.
   - Authentication: Bearer token explanation + side-by-side `mg_test_` (amber, dev) vs `mg_live_` (emerald, prod) cards.
   - API Reference: all 3 endpoints with method badge, path, purpose, request body schema table, response body schema table, example request, example response, possible error codes as mono badges.
   - SDKs: install commands for npm/pip/composer/go get.
   - Webhooks: signature header format, Node.js verification snippet (HMAC-SHA256 + timingSafeEqual), event type list.
   - Rate Limits: table of per-email / per-IP / per-device limits, X-RateLimit-* header documentation, 429 + Retry-After behavior.
   - Error Codes: envelope JSON example + link to /admin/errors.
   - Changelog: v1.0.0 release notes.
   - All code blocks have copy buttons + language labels.
   - Header: back-to-admin + "Documentation" title + BookOpen icon.

### Admin dashboard header update (`src/app/admin/page.tsx`)
- Added a "Developer" DropdownMenu button (with Terminal icon + ChevronDown) next to the existing "Analytics" button.
- Dropdown contains 6 items grouped with a separator: API Keys / Webhooks / Request Logs / API Playground | Documentation / Error Explorer.
- Each item routes via `router.push()` to the new admin subpage.
- Existing "Analytics", "Refresh", "Logout" buttons preserved.
- Button group now `flex-wrap` so it stays usable on narrow viewports.

### Design compliance
- All pages `"use client"` at top.
- Emerald accent everywhere (no indigo/blue) — title icons are `text-emerald-600`, badges for success/active use emerald, dev badges use amber, destructive/failed use rose.
- Mobile-first responsive: most layouts use `grid gap-6 lg:grid-cols-2` or `lg:grid-cols-3`; filter rows use `flex flex-wrap items-end gap-3`.
- Long lists/tables: `max-h-96 overflow-y-auto` (deliveries, request logs, docs code blocks) + sticky table headers with `bg-muted/50 backdrop-blur`.
- Loading states: `Skeleton` components for cards/tables.
- Errors: `toast` notifications from `@/hooks/use-toast` for fetch failures + actionable messages.
- All fetches use relative paths only (no absolute URLs, no port in URLs).
- Copy-to-clipboard uses `navigator.clipboard.writeText()` + toast feedback.
- JSON pretty-print uses `JSON.stringify(JSON.parse(s), null, 2)` in `<pre className="text-xs overflow-auto">`.
- All form inputs have `<Label htmlFor>` associations; interactive controls have `aria-label` / `aria-pressed` where appropriate.

### API contract verification
Before writing the client code, I read the actual backend route files (`/api/admin/api-keys`, `/api/admin/api-keys/usage`, `/api/admin/webhooks`, `/api/admin/webhooks/test`, `/api/admin/request-logs`, `/api/admin/snippets`) and verified my page field names match:
- API keys list: `{ keys: [...] }` with `prefix, name, environment, scopes, lastUsedAt, expiresAt, revokedAt, createdAt, isRevoked, isExpired`.
- API key usage: `{ last24h, last7d, allTime }` each `{ success, client, server, total }`.
- Webhooks list: `{ endpoints: [{ ..., recentDeliveries: [...] }] }` (nested per endpoint, no `secretPrefix` / `deliveriesCount` / top-level `deliveries`).
- Webhook create: `{ url, events: string[] }` (array, not comma-joined string) → returns `{ secret, ... }`.
- Request logs: `{ page, pageSize, total, totalPages, logs: [...] }` (uses `logs` not `rows`).
- Snippets: I used the `generateSnippet()` function directly (client-safe import) instead of fetching, which gives the same output without an extra round-trip.

### Verification
- `npx eslint src/app/admin/**/*.tsx` — **0 errors, 0 warnings** (clean for all 7 files I touched).
- `bun run lint` (project-wide) — only pre-existing errors in `sdk/nodejs/index.js` (CommonJS `require()` + `this` aliasing, intentional in that file; not from my work).
- Curl end-to-end with admin cookie: `/admin/api-keys`, `/admin/webhooks`, `/admin/logs`, `/admin/playground`, `/admin/errors`, `/admin/docs` all return **HTTP 200**.
- Without admin cookie: all 6 pages return **HTTP 307** → `/admin/login` (middleware guard working).
- Curl-verified the underlying API routes return correct shapes that match my page interfaces (api-keys list, webhooks list, request-logs list).
- Static-content pages (`/admin/errors` shows full ERRORS_CATALOG including `validation_failed`, `unauthorized`, `rate_limited`; `/admin/docs` shows all 8 section headings) confirmed via curl HTML grep.

## Stage Summary
- `src/app/admin/page.tsx` — **updated** (added "Developer" DropdownMenu with 6 DX nav links; preserved existing Analytics/Refresh/Logout).
- `src/app/admin/api-keys/page.tsx` — **new** (~380 LOC).
- `src/app/admin/webhooks/page.tsx` — **new** (~370 LOC).
- `src/app/admin/logs/page.tsx` — **new** (~280 LOC).
- `src/app/admin/playground/page.tsx` — **new** (~310 LOC).
- `src/app/admin/errors/page.tsx` — **new** (~140 LOC).
- `src/app/admin/docs/page.tsx` — **new** (~440 LOC).

All 6 DX admin pages are built, lint-clean, and verified end-to-end. Backend API contracts confirmed before coding to avoid field-name mismatches. Frontend-only deliverable — no API routes were added or modified.
