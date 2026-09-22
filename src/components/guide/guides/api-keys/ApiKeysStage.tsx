"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, KeyRound, Plus, RefreshCw, MoreHorizontal, Activity,
  Copy, Trash2, CheckCircle2, AlertTriangle, Loader2, Clock,
} from "lucide-react";
import {
  Card, CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Ltr } from "@/lib/i18n/Ltr";
import type { SceneRenderContext } from "../../CinematicWalkthrough";
import type {
  ApiKeysStageCopy,
  ApiKeysStageRow,
  ApiKeyEnvironment,
  ApiKeyScope,
  ApiKeyStatus,
  ApiKeyUsageBucket,
} from "@/lib/guide/content/guides/api-keys-types";

/**
 * ApiKeysStage — the simulated API Keys page for the /guide/api-keys
 * cinematic walkthrough.
 *
 * Mirrors the ACTUAL Nixify API Keys product at:
 *   src/app/dashboard/api-keys/page.tsx (~779 lines)
 *
 * Visual states (driven by the active `scene` key):
 *   - apiKeysOverview       — full list page: header + quota card + keys
 *                             table with 5 seed rows covering every
 *                             visible status (active, expired, revoked)
 *                             and every environment × scope combination.
 *                             No overlays.
 *   - createDialog          — list page with the Create Dialog overlaid.
 *                             The typedText from the cinematic shell
 *                             flows into the Name field. Environment,
 *                             Scopes, and Expiration are pre-filled with
 *                             the demo's seed values.
 *   - secretReveal          — list page with the Reveal Dialog overlaid.
 *                             Shows the full key (mg_test_… + 24 chars)
 *                             ONCE. Amber warning reinforces "won't be
 *                             shown again". Copy button + Done button.
 *                             A monospace caption reinforces the storage
 *                             invariant (SHA-256 + prefix).
 *   - quotaReached          — list page with the quota bar at 100% (rose),
 *                             the Create button disabled, and a rose
 *                             "quota reached" hint explaining the path
 *                             (revoke a key or upgrade).
 *   - revokeConfirmation    — list page with the Revoke AlertDialog
 *                             overlaid on the first active key. Cancel +
 *                             rose "Revoke key" button. A monospace
 *                             caption reinforces "soft delete — keyHash
 *                             retained".
 *   - revokedState          — list page with the revoked row highlighted
 *                             (rose), the Revoke menu item disabled, and
 *                             a bottom banner reinforcing "revoked keys
 *                             don't count against quota — create a new
 *                             one immediately".
 *
 * Localization contract (REGRESSION-PROTECTED):
 *   - The stage is NOT permanently `dir="ltr"`. The `dir` comes from the
 *     resolved stage copy (stage.dir), which mirrors the active product
 *     locale (ltr for en, rtl for fa).
 *   - All human-facing labels come from the stage copy.
 *   - Technical tokens (key prefixes like mg_test_ / mg_live_, full
 *     keys like mg_live_abC12..., hash tokens like
 *     sha256:7c3b9f1e..., numeric key IDs, scope codes like full /
 *     read_only, environment codes like development / production, plan
 *     codes like FREE / PRO / MAX, HTTP method names, ISO timestamps,
 *     relative-time strings) stay LTR via <Ltr>.
 *
 * Safety contract (REGRESSION-PROTECTED):
 *   - NO real `fetch()` calls anywhere in this file.
 *   - NO real database writes.
 *   - NO real key creation, no real revoke, no real usage fetch.
 *   - All state is local demo state — derived from the active `scene`.
 *
 * Remount contract:
 *   - The parent <motion.div key={ctx.scene}> remounts this component on
 *     every scene change. This means useState initializers re-evaluate
 *     against the new scene, so we deliberately do NOT use useEffect to
 *     sync state to the scene (that would trigger setState-in-effect
 *     cascading renders and is unnecessary).
 */

/* ─── Status → badge color class ────────────────────────────────────────── */
/* Mirrors the conceptual dashboard's status color palette: active=emerald,
 * expired=amber, revoked=rose. The status code label itself is localized. */
const STATUS_BADGE_CLASS: Record<ApiKeyStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  expired: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  revoked: "bg-rose-500/10 text-rose-700 border-rose-500/30",
};

/** Environment badge color classes — dev=amber, prod=emerald. */
const ENV_BADGE_CLASS: Record<ApiKeyEnvironment, string> = {
  development: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  production: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
};

/** Derive the row status from the row's flags (same precedence as the
 * real page: revoked wins over expired). */
function rowStatus(row: ApiKeysStageRow): ApiKeyStatus {
  if (row.isRevoked) return "revoked";
  if (row.isExpired) return "expired";
  return "active";
}

/* ─── Per-row usage panel (expanded state) ────────────────────────────── */

function UsageStat({
  label,
  data,
  copy,
}: {
  label: string;
  data: ApiKeyUsageBucket;
  copy: ApiKeysStageCopy;
}): React.ReactElement {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 text-xl font-bold text-emerald-600">
        {data.total}
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="text-emerald-600">
          {copy.usageStats.successSymbol}{data.success}
        </span>
        <span className="text-amber-600">
          {copy.usageStats.clientSymbol}{data.client}
        </span>
        <span className="text-rose-600">
          {copy.usageStats.serverSymbol}{data.server}
        </span>
      </div>
    </div>
  );
}

/* ─── A single key row — mirrors the real page's table row layout ──────── */

function KeyRow({
  row,
  copy,
  highlighted,
  expanded,
  prefersReducedMotion,
}: {
  row: ApiKeysStageRow;
  copy: ApiKeysStageCopy;
  highlighted: boolean;
  expanded: boolean;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  const status = rowStatus(row);
  const statusLabel = copy.statusLabels[status];
  const envLabel = row.environment === "production" ? copy.envBadges.prod : copy.envBadges.dev;

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
      className={`rounded-md border transition-colors ${
        highlighted
          ? status === "revoked"
            ? "border-rose-500/60 bg-rose-500/5 ring-1 ring-rose-500/20"
            : "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/20"
          : "border-border hover:bg-accent/50"
      }`}
    >
      {/* Row body — Name + Prefix + Environment + Created + Last Used + Status + Actions */}
      <div className="grid grid-cols-12 items-center gap-2 p-3">
        {/* Name (KeyRound + name + scopes subline) */}
        <div className="col-span-12 sm:col-span-4 flex items-center gap-2 min-w-0">
          <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="truncate font-medium text-sm">{row.name}</div>
            <div className="text-xs text-muted-foreground">
              <Ltr>{row.scopes}</Ltr>
            </div>
          </div>
        </div>

        {/* Prefix */}
        <div className="col-span-6 sm:col-span-2">
          <code dir="ltr" className="font-mono text-xs text-muted-foreground">
            <Ltr>{row.prefix}</Ltr>…
          </code>
        </div>

        {/* Environment */}
        <div className="col-span-3 sm:col-span-1">
          <Badge variant="outline" className={`text-[10px] ${ENV_BADGE_CLASS[row.environment]}`}>
            <Ltr>{envLabel}</Ltr>
          </Badge>
        </div>

        {/* Created */}
        <div className="col-span-6 sm:col-span-2 text-xs text-muted-foreground">
          <Ltr>{row.createdAtRelative}</Ltr>
        </div>

        {/* Last Used */}
        <div className="col-span-6 sm:col-span-1 text-xs text-muted-foreground">
          <Ltr>
            {row.lastUsedAtRelative ?? copy.table.neverUsed}
          </Ltr>
        </div>

        {/* Status */}
        <div className="col-span-6 sm:col-span-1">
          <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE_CLASS[status]}`}>
            {statusLabel}
          </Badge>
        </div>

        {/* Actions (MoreHorizontal — decorative) */}
        <div className="col-span-6 sm:col-span-1 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            aria-label={copy.table.actionsAria}
            tabIndex={-1}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded usage panel */}
      <AnimatePresence initial={false}>
        {expanded && row.usage && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
            className="overflow-hidden border-t bg-muted/20"
          >
            <div className="p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Activity className="h-3.5 w-3.5" /> {copy.usageStats.title}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <UsageStat label={copy.usageStats.last24h} data={row.usage.last24h} copy={copy} />
                <UsageStat label={copy.usageStats.last7d} data={row.usage.last7d} copy={copy} />
                <UsageStat label={copy.usageStats.allTime} data={row.usage.allTime} copy={copy} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Quota card ─────────────────────────────────────────────────────────── */

function QuotaCard({
  copy,
  used,
  quota,
  reached,
}: {
  copy: ApiKeysStageCopy;
  used: number;
  quota: number;
  reached: boolean;
}): React.ReactElement {
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const barColor =
    pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
  const barTrackColor =
    pct >= 100 ? "bg-rose-500/15" : pct >= 80 ? "bg-amber-500/15" : "bg-emerald-500/15";

  return (
    <Card className="overflow-hidden border-emerald-500/20">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{copy.quota.planLabel}</span>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-600 dark:text-emerald-400">
              <Ltr>{copy.plan}</Ltr>
            </Badge>
            <span className="text-muted-foreground">·</span>
            <span>
              <span className="font-semibold text-foreground">{used}</span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-muted-foreground">{quota} keys used</span>
            </span>
          </div>
          {reached && (
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {copy.quota.quotaReached(null)}
            </span>
          )}
        </div>
        <div className={`mt-3 h-2 w-full overflow-hidden rounded-full ${barTrackColor}`}>
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Create Dialog overlay ────────────────────────────────────────────── */

function CreateKeyDialog({
  copy,
  typedText,
  prefersReducedMotion,
}: {
  copy: ApiKeysStageCopy;
  typedText: string;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  const d = copy.createDialog;
  // typedText flows into the Name field during the createDialog scene.
  const nameValue = typedText || d.namePlaceholder;
  // Pre-fill the demo seed values: development environment + full scope.
  const envCode = "development" as ApiKeyEnvironment;
  const scopeCode = "full" as ApiKeyScope;
  const envPrefix: string = envCode === "production" ? "mg_live_" : "mg_test_";

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-lg border bg-background shadow-xl">
        {/* Header */}
        <div className="p-6 pb-2">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Plus className="h-5 w-5 text-emerald-600" />
            {d.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
        </div>

        {/* Form */}
        <div className="space-y-4 px-6 pb-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="ak-name-sim" className="text-xs">
              {d.nameLabel}
            </Label>
            <Input
              id="ak-name-sim"
              value={nameValue}
              readOnly
              autoFocus={false}
              placeholder={d.namePlaceholder}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{d.environmentLabel}</Label>
            <div className="flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm">
              <Ltr>{envCode}</Ltr>
            </div>
            <p className="text-xs text-muted-foreground">
              {d.keyStartsWithHint}{" "}
              <code className="font-mono">
                <Ltr>{envPrefix}</Ltr>
              </code>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{d.scopesLabel}</Label>
            <div className="flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm">
              <Ltr>{scopeCode === "full" ? d.scopeFull : d.scopeReadOnly}</Ltr>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ak-expires-sim" className="text-xs">
              {d.expirationLabel}
            </Label>
            <Input id="ak-expires-sim" type="text" readOnly placeholder="—" />
            <p className="text-xs text-muted-foreground">{d.leaveBlank}</p>
          </div>
        </div>

        <Separator />

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 pt-3">
          <Button variant="outline" size="sm" tabIndex={-1}>
            {d.cancel}
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            tabIndex={-1}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> {d.submit}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Reveal Dialog overlay (the one-time secret reveal) ──────────────── */

function RevealKeyDialog({
  copy,
  prefersReducedMotion,
}: {
  copy: ApiKeysStageCopy;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  const d = copy.revealDialog;

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-lg rounded-lg border bg-background shadow-xl">
        {/* Header */}
        <div className="p-6 pb-2">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            {d.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
        </div>

        {/* Full key + Copy button */}
        <div className="space-y-3 px-6 pb-4 pt-2">
          <div className="flex items-center gap-2">
            <code dir="ltr" className="block flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-xs">
              <Ltr>{copy.revealedKey}</Ltr>
            </code>
            <Button size="sm" variant="outline" tabIndex={-1}>
              <Copy className="mr-1 h-3.5 w-3.5" /> {d.copyButton}
            </Button>
          </div>

          {/* Amber warning */}
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50 p-3 dark:bg-amber-950/30">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {d.warningTitle}
              </p>
              <p className="text-xs text-amber-900 dark:text-amber-200">
                {d.warningBody}
              </p>
            </div>
          </div>

          {/* Storage invariant caption */}
          <p className="text-[11px] text-muted-foreground font-mono">
            <Ltr>{d.hashCaption}</Ltr>
          </p>
        </div>

        <Separator />

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 pt-3">
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            tabIndex={-1}
          >
            {d.done}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Revoke AlertDialog overlay ────────────────────────────────────────── */

function RevokeConfirmDialog({
  copy,
  targetName,
  prefersReducedMotion,
}: {
  copy: ApiKeysStageCopy;
  targetName: string;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  const d = copy.revokeDialog;

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-lg border bg-background shadow-xl">
        <div className="p-6 pb-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            {d.title}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">{d.body(targetName)}</p>
        </div>

        {/* Soft-delete caption */}
        <div className="px-6 pb-2">
          <p className="text-[11px] text-muted-foreground font-mono">
            <Ltr>{d.softDeleteCaption}</Ltr>
          </p>
        </div>

        <Separator />

        <div className="flex justify-end gap-2 p-4 pt-3">
          <Button variant="outline" size="sm" tabIndex={-1}>
            {d.cancel}
          </Button>
          <Button
            size="sm"
            className="bg-rose-600 text-white hover:bg-rose-500"
            tabIndex={-1}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> {d.confirm}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Quota-reached banner (bottom overlay) ─────────────────────────────── */

function QuotaReachedBanner({
  copy,
  prefersReducedMotion,
}: {
  copy: ApiKeysStageCopy;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
      className="absolute inset-x-0 bottom-0 z-30 border-t border-rose-500/40 bg-rose-500/5 backdrop-blur-sm p-4"
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-1 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600" />
          <p className="text-sm font-semibold text-rose-700">
            {copy.quota.quotaReached(null)}
          </p>
          <Badge
            variant="outline"
            className="ml-auto text-xs bg-rose-500/10 text-rose-700 border-rose-500/30"
          >
            <Ltr>quota_exhausted · 402</Ltr>
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          <Ltr>createResourceWithCapacity → activeCount &gt;= quota</Ltr>
        </p>
      </div>
    </motion.div>
  );
}

/* ─── Revoked-state banner (bottom overlay) ─────────────────────────────── */

function RevokedStateBanner({
  copy,
  prefersReducedMotion,
}: {
  copy: ApiKeysStageCopy;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
      className="absolute inset-x-0 bottom-0 z-30 border-t border-rose-500/40 bg-rose-500/5 backdrop-blur-sm p-4"
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <Trash2 className="h-5 w-5 text-rose-600" />
        <div>
          <p className="text-sm font-semibold text-rose-700">
            {copy.statusLabels.revoked}
          </p>
          <p className="text-xs text-muted-foreground">
            <Ltr>{`revokedAt: now · keyHash retained · does NOT count against quota`}</Ltr>
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Not-available screen (403 entitlement) ────────────────────────────── */

function NotAvailableScreen({
  copy,
}: {
  copy: ApiKeysStageCopy;
}): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center py-16 text-center">
      <KeyRound className="h-10 w-10 text-muted-foreground" />
      <h2 className="mt-3 text-xl font-semibold">{copy.notAvailable.title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {copy.notAvailable.description}
      </p>
      <Button className="mt-4 bg-emerald-600 text-white hover:bg-emerald-500" tabIndex={-1}>
        {copy.notAvailable.cta}
      </Button>
    </div>
  );
}

/* ─── Main stage ─────────────────────────────────────────────────────────── */

interface ApiKeysStageProps extends SceneRenderContext {
  copy: ApiKeysStageCopy;
}

export function ApiKeysStage({
  scene,
  isPlaying,
  prefersReducedMotion,
  copy,
}: ApiKeysStageProps): React.ReactElement {
  const dir = copy.dir;

  // Scenes that show the not-available (403) screen instead of the list.
  const showNotAvailable = scene === "notAvailable";

  // For the quota-reached scene, we pretend the activeCount equals the quota
  // so the bar shows 100% and the Create button is disabled.
  const seedActiveCount = copy.rows.filter((r) => !r.isRevoked).length;
  const isQuotaReachedScene = scene === "quotaReached";
  const used = isQuotaReachedScene ? copy.planQuota : seedActiveCount;
  const reached = isQuotaReachedScene || used >= copy.planQuota;

  // Which row is highlighted (border + ring) per scene.
  // - revokeConfirmation → entry id 1 (first active key)
  // - revokedState → entry id 5 (the revoked key)
  function isHighlighted(id: number): boolean {
    if (scene === "revokeConfirmation") return id === 1;
    if (scene === "revokedState") return id === 5;
    return false;
  }

  // Which row's usage panel is expanded (the first row in the overview
  // scene, to teach users that the per-row usage panel exists).
  const expandedId = scene === "apiKeysOverview" ? 1 : null;

  // The revoke target name — always the first active key.
  const revokeTargetName =
    copy.rows.find((r) => r.id === 1 && !r.isRevoked)?.name ?? copy.revealedName;

  return (
    <div
      dir={dir}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-gray-200 bg-white"
    >
      {showNotAvailable ? (
        <NotAvailableScreen copy={copy} />
      ) : (
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50/50 px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" tabIndex={-1}>
                <ArrowLeft className="mr-1 h-4 w-4" /> {copy.header.backToDashboard}
              </Button>
              <div>
                <h1 className="flex items-center gap-2 text-lg font-bold">
                  <KeyRound className="h-5 w-5 text-emerald-600" />
                  {copy.header.title}
                </h1>
                <p className="text-xs text-muted-foreground">{copy.header.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" tabIndex={-1}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> {copy.header.refresh}
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={reached}
                tabIndex={-1}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> {copy.header.createNewKey}
              </Button>
            </div>
          </div>

          {/* Body — quota card + keys table */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Quota card */}
            <QuotaCard copy={copy} used={used} quota={copy.planQuota} reached={reached} />

            {/* Keys table */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="max-h-[360px] overflow-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur">
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3 font-medium">{copy.table.name}</th>
                        <th className="px-4 py-3 font-medium">{copy.table.prefix}</th>
                        <th className="px-4 py-3 font-medium">{copy.table.environment}</th>
                        <th className="px-4 py-3 font-medium">{copy.table.created}</th>
                        <th className="px-4 py-3 font-medium">{copy.table.lastUsed}</th>
                        <th className="px-4 py-3 font-medium">{copy.table.status}</th>
                        <th className="px-4 py-3 text-right font-medium">{copy.table.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {copy.rows.map((row) => (
                        <tr
                          key={row.id}
                          className={`border-b last:border-0 transition-colors ${
                            isHighlighted(row.id)
                              ? rowStatus(row) === "revoked"
                                ? "bg-rose-500/5"
                                : "bg-emerald-500/5"
                              : "hover:bg-muted/30"
                          }`}
                        >
                          <td colSpan={7} className="p-0">
                            <KeyRow
                              row={row}
                              copy={copy}
                              highlighted={isHighlighted(row.id)}
                              expanded={expandedId === row.id}
                              prefersReducedMotion={prefersReducedMotion}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Security tips Alert (emerald) */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 dark:bg-emerald-950/30">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  {copy.securityTips.title}
                </p>
              </div>
              <ul className="ml-4 list-disc space-y-1 text-xs text-emerald-900 dark:text-emerald-200">
                <li>{copy.securityTips.tipTest}</li>
                <li>{copy.securityTips.tipRotate}</li>
                <li>{copy.securityTips.tipReadOnly}</li>
              </ul>
            </div>
          </div>

          {/* Overlays / banners */}
          <AnimatePresence mode="wait">
            {scene === "createDialog" && (
              <CreateKeyDialog
                key="create-dialog"
                copy={copy}
                typedText=""
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
            {scene === "secretReveal" && (
              <RevealKeyDialog
                key="reveal-dialog"
                copy={copy}
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
            {scene === "revokeConfirmation" && (
              <RevokeConfirmDialog
                key="revoke-dialog"
                copy={copy}
                targetName={revokeTargetName}
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
            {scene === "quotaReached" && (
              <QuotaReachedBanner
                key="quota-banner"
                copy={copy}
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
            {scene === "revokedState" && (
              <RevokedStateBanner
                key="revoked-banner"
                copy={copy}
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
          </AnimatePresence>

          {/* Playing indicator (subtle top-right pill, only when actively playing) */}
          {isPlaying && (
            <div className="pointer-events-none absolute right-3 top-3 z-40">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                <Ltr>auto</Ltr>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
