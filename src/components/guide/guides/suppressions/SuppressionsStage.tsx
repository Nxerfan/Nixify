"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldOff, Plus, Search, ShieldCheck, AlertTriangle,
  Loader2, Ban, MailX,
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Ltr } from "@/lib/i18n/Ltr";
import type { SceneRenderContext } from "../../CinematicWalkthrough";
import type {
  SuppressionsStageCopy,
  SuppressionsStageEntry,
  SuppressionReasonTone,
} from "@/lib/guide/content/guides/suppressions-types";

/**
 * SuppressionsStage — the simulated Suppressions page for the
 * /guide/suppressions cinematic walkthrough.
 *
 * Mirrors the ACTUAL Nixify Suppressions product at:
 *   src/app/dashboard/suppressions/page.tsx
 *
 * Visual states (driven by the active `scene` key):
 *   - suppressionsOverview  — full list page: header + Card with 6 seed
 *                             entries covering every reason (manual,
 *                             unsubscribe, hard_bounce, complaint),
 *                             every source, and both active + lifted
 *                             states. No overlays.
 *   - createSuppression    — list page with the Add-suppression dialog
 *                             overlaid (email input + emerald Suppress
 *                             button). The typedText from the cinematic
 *                             shell flows into the email field.
 *   - liftConfirmation     — list page with the Lift AlertDialog overlaid
 *                             on the first active manual entry. The
 *                             also_subscribe checkbox is UNCHECKED → the
 *                             confirm button is rose (lift only).
 *   - alsoSubscribeChecked — same dialog but the also_subscribe checkbox
 *                             is CHECKED → the confirm button is emerald
 *                             (lift + subscribe).
 *   - nonLiftableReview    — list page with the hard_bounce + complaint
 *                             rows highlighted and a non-liftable
 *                             warning callout overlay teaching the
 *                             NON_LIFTABLE_BY_RESUBSCRIBE invariant.
 *   - liftedState          — list page with the lifted rows highlighted,
 *                             showing the Lifted badge + Lifted timestamp
 *                             + no Lift button. Footer caption reinforces
 *                             "lift = state transition, not delete".
 *
 * Localization contract (REGRESSION-PROTECTED):
 *   - The stage is NOT permanently `dir="ltr"`. The `dir` comes from the
 *     resolved stage copy (stage.dir), which mirrors the active product
 *     locale (ltr for en, rtl for fa).
 *   - All human-facing labels (header, badge labels, button copy,
 *     dialog text, banner copy) come from the stage copy.
 *   - Technical tokens (email addresses like spammer@example.com,
 *     suppression public IDs like sup_manual_spammer, reason codes like
 *     manual/unsubscribe/hard_bounce/complaint, source codes like
 *     dashboard/api/unsubscribe/system, NON_LIFTABLE_BY_RESUBSCRIBE,
 *     also_subscribe, HTTP method names, ISO timestamps) stay LTR via
 *     <Ltr>.
 *
 * Safety contract (REGRESSION-PROTECTED):
 *   - NO real `fetch()` calls anywhere in this file.
 *   - NO real database writes.
 *   - NO real suppression mutation (no real create, no real lift, no real
 *     subscribe).
 *   - All state is local demo state — derived from the active `scene`.
 *
 * Remount contract:
 *   - The parent <motion.div key={ctx.scene}> remounts this component on
 *     every scene change. This means useState initializers re-evaluate
 *     against the new scene, so we deliberately do NOT use useEffect to
 *     sync state to the scene (that would trigger setState-in-effect
 *     cascading renders and is unnecessary).
 */

/* ─── Reason → badge color class ────────────────────────────────────────── */
/* Mirrors REASON_LABELS in src/app/dashboard/suppressions/page.tsx — the
 * reason badge itself is `variant="outline"`; the tone differentiates the
 * four reasons visually for teaching. The real page does not color-code by
 * reason (only by active/lifted state); we add this layer for pedagogy. */

const REASON_BADGE_CLASS: Record<SuppressionReasonTone, string> = {
  manual: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  unsubscribe: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  hard_bounce: "bg-rose-500/10 text-rose-700 border-rose-500/30",
  complaint: "bg-rose-500/10 text-rose-700 border-rose-500/30",
};

/** Reasons that are NON_LIFTABLE_BY_RESUBSCRIBE (taught as a separate
 * visual treatment even though the real page does not gate the Lift
 * button — the guide teaches the consent model). */
const NON_LIFTABLE_REASONS: ReadonlySet<SuppressionReasonTone> = new Set([
  "hard_bounce",
  "complaint",
]);

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/** A single suppression row — mirrors the real page's row layout. */
function SuppressionRow({
  entry,
  copy,
  highlighted,
  showLiftButton = true,
  prefersReducedMotion,
}: {
  entry: SuppressionsStageEntry;
  copy: SuppressionsStageCopy;
  highlighted: boolean;
  showLiftButton?: boolean;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  const reasonLabel = copy.reasonLabels[entry.reason];
  const sourceLabel = copy.sourceLabels[entry.source];
  const isNonLiftable = NON_LIFTABLE_REASONS.has(entry.reason);
  const isActive = entry.active;

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
      className={`flex flex-wrap items-center gap-3 rounded-md border p-3 transition-colors ${
        highlighted
          ? isNonLiftable
            ? "border-rose-500/60 bg-rose-500/5 ring-1 ring-rose-500/20"
            : "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/20"
          : "hover:bg-accent/50"
      }`}
    >
      <div className="flex-1 min-w-[200px]">
        <p className="font-mono text-sm break-all">
          <Ltr>{entry.email}</Ltr>
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          <Badge variant="outline" className={`text-xs ${REASON_BADGE_CLASS[entry.reason]}`}>
            {reasonLabel}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {copy.sourcePrefix} <Ltr>{sourceLabel}</Ltr>
          </Badge>
          {isActive ? (
            <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-700 border-rose-500/30">
              {copy.state.active}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs bg-slate-500/10 text-slate-700 border-slate-500/30">
              {copy.state.lifted}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          <Ltr>
            {copy.timestamps.joined(entry.createdAtRelative, entry.liftedAtRelative)}
          </Ltr>
        </p>
      </div>
      {showLiftButton && isActive && (
        <Button
          size="sm"
          variant="outline"
          tabIndex={-1}
        >
          <ShieldOff className="mr-1 h-3.5 w-3.5" /> {copy.actions.lift}
        </Button>
      )}
      {showLiftButton && !isActive && (
        <span className="text-[10px] text-muted-foreground/60 self-center">
          {copy.actions.noAction}
        </span>
      )}
    </motion.div>
  );
}

/* ─── Overlays ────────────────────────────────────────────────────────────── */

function AddSuppressionDialog({
  copy,
  typedText,
  prefersReducedMotion,
}: {
  copy: SuppressionsStageCopy;
  typedText: string;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  const d = copy.addDialog;
  // In the createSuppression scene, typedText animates into the Email field.
  const emailValue = typedText || d.emailPlaceholder;
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-lg border bg-background shadow-xl">
        <div className="p-6 pb-2">
          <h3 className="text-lg font-semibold">{d.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
        </div>
        <div className="space-y-2 px-6 pb-4 pt-2">
          <Label htmlFor="sup-email-sim" className="text-xs">
            {d.emailLabel}
          </Label>
          <Input
            id="sup-email-sim"
            type="email"
            value={emailValue}
            readOnly
            className="font-mono text-sm"
            placeholder={d.emailPlaceholder}
          />
          <p className="text-[11px] text-muted-foreground">
            <Ltr>{`POST /api/dashboard/suppressions { email, reason: "manual" }`}</Ltr>
          </p>
        </div>
        <Separator />
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

function LiftDialog({
  copy,
  targetEmail,
  alsoSubscribe,
  prefersReducedMotion,
}: {
  copy: SuppressionsStageCopy;
  targetEmail: string;
  alsoSubscribe: boolean;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  const d = copy.liftDialog;
  // The confirm button color depends on also_subscribe — emerald when
  // checked (lift + subscribe), rose when unchecked (lift only). This
  // mirrors the real page's className toggle.
  const confirmClass = alsoSubscribe
    ? "bg-emerald-600 text-white hover:bg-emerald-500"
    : "bg-rose-600 text-white hover:bg-rose-500";
  const confirmLabel = alsoSubscribe
    ? d.confirmLiftAndSubscribe
    : d.confirmLiftOnly;

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-lg border bg-background shadow-xl">
        <div className="p-6 pb-2">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                alsoSubscribe
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-600"
              }`}
            >
              {alsoSubscribe ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <ShieldOff className="h-4 w-4" />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold leading-tight">
                {d.title(targetEmail)}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
            </div>
          </div>
        </div>
        <div className="px-6 pb-2 pt-1">
          <label
            htmlFor="also-subscribe-sim"
            className="flex items-center gap-2 cursor-pointer rounded-md border border-input bg-background px-3 py-2 hover:bg-accent/50 transition-colors"
          >
            <input
              type="checkbox"
              id="also-subscribe-sim"
              checked={alsoSubscribe}
              readOnly
              className="h-4 w-4"
            />
            <span className="text-sm">{d.alsoSubscribeLabel}</span>
          </label>
          <p className="mt-2 text-[11px] text-muted-foreground font-mono">
            <Ltr>
              {alsoSubscribe
                ? `POST /api/dashboard/suppressions/{id} { also_subscribe: true }`
                : `POST /api/dashboard/suppressions/{id} { also_subscribe: false }`}
            </Ltr>
          </p>
        </div>
        <Separator />
        <div className="flex justify-end gap-2 p-4 pt-3">
          <Button variant="outline" size="sm" tabIndex={-1}>
            {d.cancel}
          </Button>
          <Button
            size="sm"
            className={confirmClass}
            tabIndex={-1}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function NonLiftableBanner({
  copy,
  prefersReducedMotion,
}: {
  copy: SuppressionsStageCopy;
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
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600" />
          <p className="text-sm font-semibold text-rose-700">
            {copy.liftDialog.nonLiftableWarningTitle}
          </p>
          <Badge
            variant="outline"
            className="ml-auto text-xs bg-rose-500/10 text-rose-700 border-rose-500/30"
          >
            <Ltr>NON_LIFTABLE_BY_RESUBSCRIBE</Ltr>
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {copy.liftDialog.nonLiftableWarningBody}
        </p>
        <p className="mt-2 text-[10px] text-muted-foreground/70 font-mono">
          <Ltr>{`reason ∈ { hard_bounce, complaint } → subscribeContact() throws ResubscribeBlockedError`}</Ltr>
        </p>
      </div>
    </motion.div>
  );
}

function LiftedStateBanner({
  copy,
  prefersReducedMotion,
}: {
  copy: SuppressionsStageCopy;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
      className="absolute inset-x-0 bottom-0 z-30 border-t border-slate-500/40 bg-slate-500/5 backdrop-blur-sm p-4"
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <Ban className="h-5 w-5 text-slate-600" />
        <div>
          <p className="text-sm font-semibold text-slate-700">
            {copy.state.lifted} · {copy.actions.noAction}
          </p>
          <p className="text-xs text-muted-foreground">
            <Ltr>{`active: false, liftedAt: now → POST (not DELETE) — audit history retains the lifted event`}</Ltr>
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
  copy: SuppressionsStageCopy;
}): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center py-16 text-center">
      <MailX className="h-10 w-10 text-muted-foreground" />
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

interface SuppressionsStageProps extends SceneRenderContext {
  copy: SuppressionsStageCopy;
}

export function SuppressionsStage({
  scene,
  typedText,
  isPlaying,
  prefersReducedMotion,
  copy,
}: SuppressionsStageProps): React.ReactElement {
  const dir = copy.dir;

  // Scenes that show the not-available (403) screen instead of the list.
  const showNotAvailable = scene === "notAvailable";

  // Which entry should be highlighted (border + ring) per scene.
  // - liftConfirmation / alsoSubscribeChecked → entry id 1 (active manual)
  // - nonLiftableReview → entries 3 + 4 (hard_bounce + complaint)
  // - liftedState → entries 5 + 6 (lifted rows)
  function isHighlighted(id: number): boolean {
    if (scene === "liftConfirmation" || scene === "alsoSubscribeChecked") {
      return id === 1;
    }
    if (scene === "nonLiftableReview") {
      return id === 3 || id === 4;
    }
    if (scene === "liftedState") {
      return id === 5 || id === 6;
    }
    return false;
  }

  // Hide the Lift button on scenes where the focus is the dialog overlay
  // or the lifted-state teaching — the action is not the point.
  const showLiftButton =
    scene !== "nonLiftableReview" && scene !== "liftedState";

  // The lift dialog target email — always the first active manual entry
  // for the liftConfirmation / alsoSubscribeChecked scenes.
  const liftTargetEmail =
    copy.entries.find((e) => e.id === 1 && e.active)?.email ?? "spammer@example.com";

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
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50/50 px-4 py-3">
            <h1 className="flex items-center gap-2 text-lg font-bold">
              <ShieldOff className="h-5 w-5 text-emerald-600" />
              {copy.header.title}
            </h1>
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              tabIndex={-1}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {copy.header.addSuppression}
            </Button>
          </div>

          {/* Card body — list */}
          <div className="flex-1 overflow-y-auto p-4">
            <Card className="overflow-hidden">
              <CardHeader className="bg-gray-50/40 pb-3">
                <CardTitle className="text-base">{copy.card.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{copy.card.subtitle}</p>
              </CardHeader>
              <CardContent className="space-y-4 p-3">
                {/* Filter controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={copy.search.placeholder}
                      readOnly
                      className="pl-9"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-500"
                    tabIndex={-1}
                  >
                    {copy.filter.showingActiveOnly}
                  </Button>
                </div>

                <Separator />

                {/* Entries */}
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {copy.entries.map((entry) => (
                    <SuppressionRow
                      key={entry.id}
                      entry={entry}
                      copy={copy}
                      highlighted={isHighlighted(entry.id)}
                      showLiftButton={showLiftButton}
                      prefersReducedMotion={prefersReducedMotion}
                    />
                  ))}
                </div>

                {/* Pagination (decorative — 6 rows < 20 page_size) */}
                <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {copy.pagination.pageOf(1, copy.entries.length)}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled tabIndex={-1}>
                      {copy.pagination.prev}
                    </Button>
                    <Button variant="outline" size="sm" disabled tabIndex={-1}>
                      {copy.pagination.next}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overlays / banners */}
          <AnimatePresence mode="wait">
            {scene === "createSuppression" && (
              <AddSuppressionDialog
                key="add-dialog"
                copy={copy}
                typedText={typedText}
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
            {scene === "liftConfirmation" && (
              <LiftDialog
                key="lift-dialog-unchecked"
                copy={copy}
                targetEmail={liftTargetEmail}
                alsoSubscribe={false}
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
            {scene === "alsoSubscribeChecked" && (
              <LiftDialog
                key="lift-dialog-checked"
                copy={copy}
                targetEmail={liftTargetEmail}
                alsoSubscribe={true}
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
            {scene === "nonLiftableReview" && (
              <NonLiftableBanner
                key="non-liftable-banner"
                copy={copy}
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
            {scene === "liftedState" && (
              <LiftedStateBanner
                key="lifted-banner"
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
