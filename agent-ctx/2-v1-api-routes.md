# Task ID 2 — v1 REST API route handlers (DX layer)

Agent: v1-api-routes

## Work Log
- Read prior context: worklog.md + existing infra (lib/dx/{api-keys,request-context,sandbox,webhooks,errors-catalog,code-snippets}.ts, lib/otp/{verifier,generator}.ts, lib/auth/admin.ts, lib/validation.ts, prisma/schema.prisma).
- Found that another concurrent agent had created `src/lib/dx/v1-helpers.ts` and overwritten my v1/otp/{send,verify,resend} routes with an alternate (non-spec) implementation. Restored all three routes to the spec-compliant `withApiKey()` pattern (per task: `Wrap in withApiKey("otp:send", async (ctx, req) => { ... })`).
- Created 3 v1 public API routes:
  - `src/app/api/v1/otp/send/route.ts` — POST, wrapped in `withApiKey("otp:send", ...)`, zod body `{email, purpose?}`. Honors `X-Sandbox-Simulate` header for dev keys (rate_limited→429, locked→423, smtp_error→500). Dev-key sandbox path generates + persists a real OTP row but does NOT email it; returns the plaintext code in the response so devs can verify. Production path calls `issueOtp`. Fires `otp.sent` webhook with masked email `a***@domain.com`. Adds rate-limit headers `X-RateLimit-Limit/Remaining/Reset`.
  - `src/app/api/v1/otp/verify/route.ts` — POST, wrapped in `withApiKey("otp:verify", ...)`, zod body `{email, code, purpose?}`. Sandbox simulates mismatch (400 code_mismatch), expired (410 expired), locked (423 locked) without calling consumeOtp. Real path calls `consumeOtp`. Fires `otp.verified`/`otp.failed`/`otp.expired` webhooks. Returns `{verified:true, request_id}` on success.
  - `src/app/api/v1/otp/resend/route.ts` — POST, wrapped in `withApiKey("otp:send", ...)`. Same body/behavior as send but passes `isResend: true` to `issueOtp` (so analytics logs "resent"). Returns message `"OTP resent"` and fires `otp.sent` webhook with `data.resend=true`.
- Created 6 admin API routes:
  - `src/app/api/admin/api-keys/route.ts` — GET (list via listApiKeys, masks hash, includes isRevoked/isExpired flags), POST (zod `{name, environment, scopes?, expiresAt?}`, calls createApiKey, returns the FULL key ONCE — the only time it's visible), DELETE ?id= (calls revokeApiKey, soft-delete).
  - `src/app/api/admin/api-keys/usage/route.ts` — GET ?id=. Three parallel `db.requestLog.groupBy` queries (24h/7d/all-time) bucketed into success/client/server counts. Admin-auth required.
  - `src/app/api/admin/webhooks/route.ts` — GET (list all endpoints + 20 recent deliveries via Prisma `include`), POST (zod `{url, events[]}`, generates `mg_whsec_...` secret via generateWebhookSecret, returns secret ONCE), DELETE ?id= (manually cascades deliveries first because the WebhookDelivery→WebhookEndpoint relation is `Restrict` by default on SQLite — without this, deletes fail with FK constraint errors).
  - `src/app/api/admin/webhooks/test/route.ts` — POST `{deliveryId}`. Calls `replayWebhookDelivery`. Returns 404 if delivery doesn't exist or replay fails.
  - `src/app/api/admin/webhooks/deliveries/route.ts` — GET ?endpointId=&page=&pageSize=. Paginated delivery list, newest first, max 200 per page.
  - `src/app/api/admin/request-logs/route.ts` — GET ?page=&pageSize=&status=&search=. Paginated RequestLog rows. `status` filters by HTTP band: 2xx/4xx/5xx. `search` filters on requestId (contains) or path (contains). Newest first.
  - `src/app/api/admin/snippets/route.ts` — GET ?method=&path=&language=&apiKey=&baseUrl=. Generates a copy-ready snippet via `generateSnippet()` for any of the 8 supported languages. Auto-builds a representative body for /otp/send, /otp/verify, /otp/resend so the snippet shows a realistic request. Admin-auth required (since the apiKey is rendered into the snippet).
- All routes: `export const runtime = "nodejs"; export const dynamic = "force-dynamic";`
- All admin routes: check `getAdmin()` first, return 401 if null.
- All v1 routes: use `withApiKey()` wrapper — it handles auth, request ID, scope check, request logging, and standard error responses.
- Email masking in webhooks: `email[0] + "***@" + domain` (per spec).
- Webhook delivery is fire-and-forget (`.catch(() => {})`) so a slow/failing endpoint never blocks the API response.

## Verification
- `bunx eslint src/app/api/v1/ src/app/api/admin/api-keys/ src/app/api/admin/webhooks/ src/app/api/admin/request-logs/ src/app/api/admin/snippets/` — clean (0 errors). (Note: `bun run lint` flags 2 errors in `sdk/nodejs/index.js` — that's a different agent's file, not mine.)
- curl end-to-end (admin login → create dev API key → use it):
  - POST /api/v1/otp/send (dev key, sandbox) → 200, returns `{request_id, message:"OTP sent", expires_at, code}` + rate-limit headers (limit 3, remaining 2, reset epoch). ✅
  - POST /api/v1/otp/verify (correct code) → 200, `{verified:true, request_id}`. ✅
  - POST /api/v1/otp/verify (wrong code) → 400, `{error:{code:"code_mismatch", ...}}`. ✅
  - Sandbox simulations all return correct status codes: rate_limited→429, locked→423, smtp_error→500, mismatch→400, expired→410, locked→423. ✅
  - GET /api/admin/api-keys → list with isRevoked/isExpired flags. ✅
  - POST /api/admin/api-keys → returns full key ONCE. ✅
  - GET /api/admin/api-keys/usage?id=1 → 24h/7d/all-time counts bucketed by 2xx/4xx/5xx. ✅
  - GET /api/admin/webhooks → endpoints with recent deliveries. ✅
  - POST /api/admin/webhooks → returns secret ONCE. ✅
  - DELETE /api/admin/webhooks?id=1 → cascades deliveries, succeeds (after manual cascade fix). ✅
  - POST /api/admin/webhooks/test `{deliveryId}` → replays delivery. ✅
  - GET /api/admin/webhooks/deliveries?endpointId=1 → paginated list. ✅
  - GET /api/admin/request-logs?page=&pageSize=&status=4xx&search=verify → paginated + filtered + searchable. ✅
  - GET /api/admin/snippets?method=POST&path=/api/v1/otp/send&language=python → returns generated Python snippet. ✅
  - DELETE /api/admin/api-keys?id=1 → revokes. ✅

## Stage Summary
- All 10 specified route files created and verified end-to-end:
  - `src/app/api/v1/otp/send/route.ts`
  - `src/app/api/v1/otp/verify/route.ts`
  - `src/app/api/v1/otp/resend/route.ts`
  - `src/app/api/admin/api-keys/route.ts`
  - `src/app/api/admin/api-keys/usage/route.ts`
  - `src/app/api/admin/webhooks/route.ts`
  - `src/app/api/admin/webhooks/test/route.ts`
  - `src/app/api/admin/webhooks/deliveries/route.ts`
  - `src/app/api/admin/request-logs/route.ts`
  - `src/app/api/admin/snippets/route.ts`
- All routes follow the documented conventions: nodejs runtime, force-dynamic, admin-auth via `getAdmin()`, v1 routes via `withApiKey()`, consistent error/success shapes via `errorResponse()`/`okResponse()`, rate-limit headers via `withRateLimitHeaders()`.
- Webhook events fired on every OTP lifecycle transition (otp.sent / otp.verified / otp.failed / otp.expired) with masked email for privacy.
- Sandbox mode (dev keys only) lets developers test the full flow + simulate errors without SMTP.
