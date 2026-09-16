/**
 * Billing domain — provider-neutral commercial plan catalog + helpers.
 *
 * This is the SINGLE entry point for pricing/plan commercial metadata.
 * Routes and UIs that need to render plan names, prices, or feature lines
 * MUST import from `@/lib/billing` rather than reading a hardcoded plan list
 * or an ad-hoc pricing-data file.
 *
 * What lives here:
 *   - `PLAN_CATALOG` — display name, description, prices, CTA, feature list
 *   - `getFeatureQuota()` — read a quota from the entitlement config (so
 *     the catalog never duplicates a number)
 *   - `getPlanCatalogEntry()` / `getPriceMinor()` — lookup helpers
 *
 * What does NOT live here:
 *   - The entitlement config itself (limits, access flags) — that lives in
 *     `src/lib/entitlements/config.ts`.
 *   - The pricing-page comparison-table shape (ComparisonRow) — that lives
 *     in `src/lib/pricingData.ts`, derived from this catalog.
 *   - Any payment provider integration (Stripe, checkout). None exists.
 *
 * When a real billing provider is added, this file is the integration seam:
 *   - Provider webhook → reconcile against PLAN_CATALOG prices
 *   - Provider subscription ID → map back to PlanKey via this catalog
 *   - Provider checkout → use getPriceMinor(plan, interval) for the amount
 *
 * There must NEVER be a second catalog. If you find yourself writing
 * `const PLANS = [...]` in another file, stop — extend this one instead.
 */

export {
  PLAN_CATALOG,
  PLAN_ORDER,
  getPlanCatalogEntry,
  getPriceMinor,
  getFeatureQuota,
  formatQuota,
  type PlanKey,
  type BillingInterval,
  type PlanPricing,
  type PlanCatalogEntry,
} from "./plan-catalog";
