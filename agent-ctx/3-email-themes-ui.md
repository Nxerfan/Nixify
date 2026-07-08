# Task ID: 3 — Email Customization System Admin UI

## Agent
fullstack-developer (email-themes UI)

## Work Log
- Verified backend API contracts before coding by reading all 8 existing routes (`/api/admin/themes/{templates,list,save,preview,active}`, `/api/admin/brand-kit`), the `ThemeConfig` type from `src/lib/email-themes/templates.ts`, and the zod schemas (hex-regex colors, nullable website/email, `SUPPORTED_LANGUAGES = ["en","fa","ar","tr","de"]`).
- Created `src/app/admin/email-themes/page.tsx` (~720 LOC, single-file page + 3 inline sub-components `Field`, `ColorField`, `ComponentsEditor`, `MiniPreview`).
- Page sections (all matching the task spec):
  1. Header — back-to-admin Button, "Email Themes" h1 with `Palette` icon (emerald), Refresh + `ThemeToggle`.
  2. Template Gallery — horizontal-scrollable row of 20 template cards. Each card has a `MiniPreview` div (background color/gradient + truncated title + fake `123456` styled per `otpCard.style`), name, category, gold Pro or emerald Free badge. Click loads that template's `config` into the editor.
  3. Main Editor — `Tabs` with 7 tabs: Branding, Header, OTP, Background, Footer, Type, Comps. Each tab uses shadcn Input/Select/Slider + a custom `ColorField` (color picker + hex text side-by-side). Components tab is a theme builder with add/remove + up/down reorder.
  4. Save/Activate bar — Theme Name + Purpose select + Save (POST `/themes/save`) / Activate (POST `/themes/active`) / Delete (DELETE `/themes/save?id=X`).
  5. Live Preview — sticky on lg. iframe with `srcDoc` (sandboxed) inside a width-constrained wrapper that matches the selected inbox client (Gmail Desktop 600px / Gmail Mobile 375px / Outlook 600px / Apple Mail 375px / Yahoo 600px). Controls: Mode (light/dark/auto) + Language (en/fa/ar/tr/de) + Inbox client. Updates are debounced 500ms; sends the full `config` to `/themes/preview` so every field is reflected live.
  6. Pro Features — Dynamic Theme Rules table (purpose→saved theme dropdown with draft state + active/draft/none status badge) + Save Rules button; Multi-Language + Live Inbox Preview info cards.
  7. Saved Themes table — scrollable (`max-h-96`) with Edit/Activate/Delete actions; Edit loads the theme back into the editor.

## Verification
- `bun run lint` → exit 0, 0 errors.
- With admin cookie: `GET /admin/email-themes` → HTTP 200. Page hydrates client-side (initial SSR shows Skeleton, then `useEffect` validates cookie + loads 4 APIs in parallel).
- Without admin cookie: HTTP 307 → `/admin/login` (middleware guard).
- APIs verified: `/themes/templates` returns 20 templates with `config`, `/themes/preview` returns `{html, text}`, `/brand-kit` returns the saved kit.

## Stage Summary
- `src/app/admin/email-themes/page.tsx` (new, ~720 LOC).
- All 8 API routes wired, emerald accent only, gold Pro badges, sandboxed iframe, color picker + hex text for every color field, responsive 2-col→1-col. Lint-clean. Frontend-only deliverable — no API routes added or modified.
