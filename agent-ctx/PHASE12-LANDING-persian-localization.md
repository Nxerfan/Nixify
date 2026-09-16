# PHASE12-LANDING — Persian Localization of Landing + Auth Shell

**Task ID:** PHASE12-LANDING
**Branch:** `feat/phase-12-persian-localization`
**Worktree:** `/home/z/phase12-v5`
**Base commit:** `b8981f2` (docs(phase-12): add lessons — dependency drift + framework runtime tests)

## Summary

Resolved BLOCKER #1 of Phase 12 Persian Localization: the landing page (`src/app/page.tsx`, 1063 lines) and auth shell (`src/app/auth/page.tsx`, 126 lines) contained hard-coded English product copy. Switching to Persian activated RTL correctly but left the visible page in English because the production components did not consume the i18n dictionaries.

## What changed

### 1. Dictionary additions (`src/i18n/en.ts` + `src/i18n/fa.ts`)

Added a new `landing` section (80 keys across 11 subsections: hero, stats, features, howItWorks, otpDemo, templateShowcase, codePreview, comparison, getStarted, faq, finalCta) and an `auth.shell` section (8 keys: taglineFirst, taglineSecond, subtitle, 4 feature pills, footer) to BOTH dictionaries.

Persian copy uses natural UX phrasing (e.g. "شروع رایگان" not "شروع کنید — رایگان"). Brand names ("Nixify") and technical terms ("OTP", "SMTP", "API", "Webhook", "Postfix", "Gmail", "Vercel", "Postgres", "SQLite", "HMAC", "SHA-256") remain in English/Latin script.

Total new keys: **88 per dictionary** (176 total entries).

### 2. Route wiring

- `src/app/page.tsx`: Added `const t = useTranslations();` to each of the 10 section functions (HeroSection, LiveStatsBar, FeaturesSection, OtpDemoSection, TemplateShowcase, CodePreviewSection, ComparisonSection, HowItWorksSection, FaqSection, FinalCtaSection). Replaced every hard-coded English string with `t("landing.xxx.yyy")` calls.
- `src/app/auth/page.tsx`: Added `const t = useTranslations();` at top of `AuthPage`. Replaced tagline, subtitle, feature pills array, and footer with translation calls.

### 3. Regression tests

Created:
- `src/app/page.test.tsx` — 3 tests asserting that the production `LandingPage` renders Persian hero copy under `locale="fa"` (and that English "Verify emails" is NOT visible), and English hero copy under `locale="en"`. Also asserts Persian FAQ and final CTA copy.
- `src/app/auth/page.test.tsx` — 2 tests asserting that the production `AuthPage` renders Persian tagline under `locale="fa"` (and that English "Secure authentication," is NOT visible), and English tagline under `locale="en"`.

Both test files use `@vitest-environment jsdom`. Polyfills installed in `beforeEach`:
- `window.matchMedia` (used by `CustomCursor` + `AmbientBackground` via `useSyncExternalStore`)
- `window.requestAnimationFrame` / `cancelAnimationFrame` (used by framer-motion springs + canvas loop)
- `window.IntersectionObserver` (used by framer-motion's `useInView`)

The auth test additionally mocks `next/navigation` (`useRouter` etc.) because `AuthCard` calls `useRouter()` which requires the Next.js App Router context.

`global.fetch` is stubbed to a 401 response to prevent `ExploreTemplatesButton` from making a real network call.

Assertion strategy: tests use `container.textContent` with regex patterns like `/تأیید\s+ایمیل/` (since `AnimatedText` inserts non-breaking spaces `\u00a0` between words; `\s` in JS regex includes `\u00a0`). Single-word assertions use `toContain` directly.

### 4. Engineering lesson

Appended to `docs/engineering/agent-lessons.md`:

> **RTL success does not prove localization success.** Locale resolution and RTL direction worked, while production components continued rendering hard-coded English strings. Switching to Persian changed `lang` and `dir` but left the visible page in English. Localization was validated at infrastructure/dictionary level instead of at the rendered route/component level. Permanent rule: For every localized user-facing route, tests must assert that changing locale changes visible production copy. Render the production component under both locales and assert the Persian text appears and the English text disappears.

## Verification results

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `bun run typecheck` | ✅ exit 0, no diagnostics |
| Lint | `bun run lint` | ✅ exit 0, no errors/warnings |
| New tests | `bunx vitest run src/app/page.test.tsx src/app/auth/page.test.tsx` | ✅ 5/5 passed |
| Full suite | `bun run test` | ✅ 642 passed, 612 skipped (DB integration tests gated behind `TEST_DATABASE_URL`) |

## Files modified

- `src/i18n/en.ts` — added `landing` + `auth.shell` keys
- `src/i18n/fa.ts` — added `landing` + `auth.shell` Persian translations
- `src/app/page.tsx` — wired all 10 sections to `useTranslations()`
- `src/app/auth/page.tsx` — wired tagline + subtitle + pills + footer
- `src/app/page.test.tsx` — NEW regression test (3 tests)
- `src/app/auth/page.test.tsx` — NEW regression test (2 tests)
- `docs/engineering/agent-lessons.md` — appended RTL localization lesson

## Notes for downstream agents

- The landing page still has some English strings NOT covered by the Phase 12 spec (mock email card "Verify your email", "Expires in 10 minutes"; template showcase title "20 templates. Infinite branding."; code preview tab labels "JavaScript/cURL/Python"; comparison subtitle "Everything you'd get from a paid ESP — for zero cost."; "Step 1/2/3/4" labels; "Explore all 20 templates" button text). These were intentionally left as English because the spec only authorized the listed keys. A follow-up phase can promote them to dictionary keys.
- Persian digits are used in user-facing copy ("۳۰ روز آزمایشی", "$۰/ماه"). Canonical ASCII digits remain in OTP codes, API keys, ISO timestamps, etc. per the existing fa.ts convention.
