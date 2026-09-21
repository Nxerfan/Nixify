"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Webhook, Plus, RefreshCw, MoreHorizontal, Activity,
  Send, CheckCircle2, AlertTriangle,
  Copy, RotateCw, Loader2,
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
  WebhooksStageCopy,
  WebhooksStageEndpoint,
  WebhooksStageDelivery,
  WebhookEndpointStatus,
  WebhookDeliveryStatus,
} from "@/lib/guide/content/guides/webhooks-types";

/**
 * WebhooksStage — the simulated Webhooks page for the /guide/webhooks
 * cinematic walkthrough.
 *
 * Mirrors the ACTUAL Nixify Webhooks product at:
 *   src/app/dashboard/webhooks/page.tsx (~1038 lines)
 *
 * Visual states (driven by the active `scene` key):
 *   - webhooksOverview    — full list page: header + Endpoints card with
 *                          4 seed endpoints (3 active + 1 inactive) +
 *                          Deliveries card with 6 seed deliveries (every
 *                          visible status: delivered / failed / pending).
 *                          No overlays.
 *   - createEndpoint     — list page with the Create Dialog overlaid.
 *                          The typedText from the cinematic shell
 *                          flows into the URL field. The 8 quick-pick
 *                          event chips are visible; otp.sent +
 *                          otp.verified are pre-selected.
 *   - secretReveal       — list page with the Secret Dialog overlaid.
 *                          Shows the signing secret (mg_whsec_… + 32
 *                          url-safe chars) ONCE. Amber warning reinforces
 *                          "won't be shown again". Copy + Saved buttons.
 *                          A monospace caption reinforces the storage
 *                          invariant (HMAC-SHA256, Nixify-Signature
 *                          header format).
 *   - testDelivery       — list page with the "Send test" action
 *                          highlighted on the first row + a bottom
 *                          banner overlay teaching the durable-queue
 *                          flow: schedule → claim → POST with
 *                          Nixify-Signature + Nixify-Event → delivery
 *                          row appears as pending.
 *   - retryAndFailure    — list page with the failed delivery (attempts=3,
 *                          lastError=max_attempts_exceeded) highlighted +
 *                          a bottom banner overlay teaching the
 *                          exponential backoff (10s → 30s → 90s) and
 *                          max_attempts_exceeded terminal state.
 *   - replayAndAudit     — list page with the Replay button highlighted
 *                          on the failed delivery + a bottom banner
 *                          overlay teaching "replay creates a NEW
 *                          delivery with a fresh signature — the
 *                          original is NOT mutated".
 *
 * Localization contract (REGRESSION-PROTECTED):
 *   - The stage is NOT permanently `dir="ltr"`. The `dir` comes from the
 *     resolved stage copy (stage.dir), which mirrors the active product
 *     locale (ltr for en, rtl for fa).
 *   - All human-facing labels come from the stage copy.
 *   - Technical tokens (URLs like https://api.acme.com/***,
 *     event codes like otp.sent / otp.verified / nixify.webhook.test,
 *     signing secrets like mg_whsec_…, HMAC signature headers like
 *     t=1700000000,v1=4a2d…, delivery IDs (UUIDs), endpoint numeric IDs,
 *     ISO timestamps, relative-time strings, HTTP status codes like 200
 *     / 429 / 500, error class codes like network_error / http_4xx /
 *     ssrf_blocked / max_attempts_exceeded, file paths like
 *     src/lib/dx/webhooks.ts, header names like Nixify-Signature /
 *     Nixify-Event / Nixify-Delivery-Id) stay LTR via <Ltr>.
 *
 * Safety contract (REGRESSION-PROTECTED):
 *   - NO real `fetch()` calls anywhere in this file.
 *   - NO real database writes.
 *   - NO real endpoint creation, no real secret generation, no real
 *     delivery scheduling, no real replay.
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
/* Mirrors the real page's status color palette:
 *   endpoints:  active = emerald, inactive = muted.
 *   deliveries: delivered = emerald, failed = rose, pending = amber. */
const ENDPOINT_STATUS_BADGE_CLASS: Record<WebhookEndpointStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  inactive: "bg-muted text-muted-foreground border-border",
};

const DELIVERY_STATUS_BADGE_CLASS: Record<WebhookDeliveryStatus, string> = {
  delivered: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  failed: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
};

/** Resolve an endpoint ID → a short label for the deliveries table. */
function endpointLabel(endpoints: WebhooksStageEndpoint[], id: number): string {
  const ep = endpoints.find((e) => e.id === id);
  return ep ? ep.url : `#${id}`;
}

/* ─── Endpoint row (table row in the Endpoints card) ────────────────────── */

function EndpointRow({
  endpoint,
  copy,
  highlighted,
  highlightTone,
  prefersReducedMotion,
}: {
  endpoint: WebhooksStageEndpoint;
  copy: WebhooksStageCopy;
  highlighted: boolean;
  highlightTone: "create" | "test" | "neutral";
  prefersReducedMotion: boolean;
}): React.ReactElement {
  const statusLabel = copy.statusLabels[endpoint.isActive ? "active" : "inactive"];
  const events = endpoint.events.slice(0, 3);
  const moreCount = endpoint.events.length - 3;

  return (
    <motion.tr
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
      className={`border-b last:border-0 transition-colors ${
        highlighted
          ? highlightTone === "test"
            ? "bg-sky-500/5 ring-1 ring-inset ring-sky-500/30"
            : highlightTone === "create"
              ? "bg-emerald-500/5 ring-1 ring-inset ring-emerald-500/30"
              : "bg-emerald-500/5"
          : "hover:bg-muted/30"
      }`}
    >
      {/* URL (mono, break-all, Ltr) */}
      <td className="px-4 py-3 align-top">
        <code dir="ltr" className="block max-w-[280px] break-all font-mono text-xs">
          <Ltr>{endpoint.url}</Ltr>
        </code>
      </td>

      {/* Events (badges, max 3 + "+N") */}
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap gap-1">
          {events.map((ev) => (
            <Badge key={ev} variant="outline" className="font-mono text-[10px]">
              <Ltr>{ev}</Ltr>
            </Badge>
          ))}
          {moreCount > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {copy.table.moreEvents(moreCount)}
            </Badge>
          )}
          {endpoint.events.length === 0 && (
            <span className="text-xs text-muted-foreground">{copy.table.noEvents}</span>
          )}
        </div>
      </td>

      {/* Status (Switch + active/inactive badge) */}
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          {/* Switch — decorative; disabled when !isActive (same as real page). */}
          <span
            className={`inline-flex h-5 w-9 items-center rounded-full px-0.5 transition-colors ${
              endpoint.isActive ? "bg-emerald-500" : "bg-muted"
            }`}
          >
            <span
              className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                endpoint.isActive ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </span>
          <Badge variant="outline" className={`text-[10px] ${ENDPOINT_STATUS_BADGE_CLASS[endpoint.isActive ? "active" : "inactive"]}`}>
            {statusLabel}
          </Badge>
        </div>
      </td>

      {/* Created (relative) */}
      <td className="hidden px-4 py-3 align-top text-xs text-muted-foreground whitespace-nowrap md:table-cell">
        <Ltr>{endpoint.createdAtRelative}</Ltr>
      </td>

      {/* Last used (relative or "never") */}
      <td className="hidden px-4 py-3 align-top text-xs text-muted-foreground whitespace-nowrap lg:table-cell">
        <Ltr>{endpoint.lastUsedAtRelative ?? copy.table.neverUsed}</Ltr>
      </td>

      {/* Actions (MoreHorizontal — decorative) */}
      <td className="px-4 py-3 align-top text-right">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          aria-label={copy.table.actionsAria}
          tabIndex={-1}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </td>
    </motion.tr>
  );
}

/* ─── Delivery row (table row in the Delivery history card) ─────────────── */

function DeliveryRow({
  delivery,
  endpoints,
  copy,
  highlighted,
  highlightTone,
  replayHighlighted,
  prefersReducedMotion,
}: {
  delivery: WebhooksStageDelivery;
  endpoints: WebhooksStageEndpoint[];
  copy: WebhooksStageCopy;
  highlighted: boolean;
  highlightTone: "failed" | "pending" | "replay" | "neutral";
  replayHighlighted: boolean;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  const statusLabel = copy.deliveryStatus[delivery.status];
  const epLabel = endpointLabel(endpoints, delivery.endpointId);

  return (
    <motion.tr
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
      className={`border-b last:border-0 transition-colors ${
        highlighted
          ? highlightTone === "failed"
            ? "bg-rose-500/5 ring-1 ring-inset ring-rose-500/30"
            : highlightTone === "pending"
              ? "bg-amber-500/5 ring-1 ring-inset ring-amber-500/30"
              : "bg-emerald-500/5 ring-1 ring-inset ring-emerald-500/30"
          : "hover:bg-muted/30"
      }`}
    >
      {/* Event (badge mono) */}
      <td className="px-4 py-3 align-top">
        <Badge variant="outline" className="font-mono text-[10px]">
          <Ltr>{delivery.eventId}</Ltr>
        </Badge>
      </td>

      {/* Endpoint (mono truncate) */}
      <td className="px-4 py-3 align-top">
        <code dir="ltr" className="block max-w-[200px] truncate font-mono text-xs text-muted-foreground" title={epLabel}>
          <Ltr>{epLabel}</Ltr>
        </code>
      </td>

      {/* Status (delivered/failed/pending badge) */}
      <td className="px-4 py-3 align-top">
        <Badge variant="outline" className={`text-[10px] ${DELIVERY_STATUS_BADGE_CLASS[delivery.status]}`}>
          {statusLabel}
        </Badge>
      </td>

      {/* Tries (mono number) */}
      <td className="px-4 py-3 align-top text-right font-mono text-xs">
        {delivery.attempts}
      </td>

      {/* Code (responseCode or —) */}
      <td className="px-4 py-3 align-top text-right font-mono text-xs">
        {delivery.responseCode ?? "—"}
      </td>

      {/* Error (lastError or —) */}
      <td className="px-4 py-3 align-top">
        <span className="block max-w-[200px] truncate text-xs text-muted-foreground" title={delivery.lastError ?? ""}>
          {delivery.lastError ? <Ltr>{delivery.lastError}</Ltr> : "—"}
        </span>
      </td>

      {/* Created (relative) */}
      <td className="hidden px-4 py-3 align-top text-xs text-muted-foreground whitespace-nowrap md:table-cell">
        <Ltr>{delivery.createdAtRelative}</Ltr>
      </td>

      {/* Replay (RotateCw ghost button) */}
      <td className="px-4 py-3 align-top text-right">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${replayHighlighted ? "ring-1 ring-emerald-500/40 bg-emerald-500/10" : ""}`}
          aria-label={copy.deliveriesCard.replayAria}
          title={copy.deliveriesCard.replayTooltip}
          tabIndex={-1}
        >
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
      </td>
    </motion.tr>
  );
}

/* ─── Create Dialog overlay ────────────────────────────────────────────── */

function CreateEndpointDialog({
  copy,
  typedText,
  prefersReducedMotion,
}: {
  copy: WebhooksStageCopy;
  typedText: string;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  const d = copy.createDialog;
  // typedText flows into the URL field during the createEndpoint scene.
  // Falls back to the placeholder + the seed URL so the dialog always
  // shows something meaningful even before typing completes.
  const urlValue = typedText || copy.revealedUrl;
  // Pre-select the seed events: otp.sent + otp.verified (the two most
  // commonly-subscribed OTP events).
  const selectedEvents = ["otp.sent", "otp.verified"];
  const commonEvents = [
    "otp.sent", "otp.verified", "otp.failed", "otp.expired",
    "nixify.event.received", "nixify.webhook.test",
    "contact.created", "contact.updated",
  ];

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
            <Plus className="h-5 w-5 text-emerald-600" />
            {d.titleCreate}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{d.descriptionCreate}</p>
        </div>

        {/* Form */}
        <div className="space-y-4 px-6 pb-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="wh-url-sim" className="text-xs">
              {d.urlLabel}
            </Label>
            <Input
              id="wh-url-sim"
              value={urlValue}
              readOnly
              autoFocus={false}
              placeholder={d.urlPlaceholder}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">{d.urlHelp}</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{d.eventsLabel}</Label>
            <div className="flex flex-wrap gap-2">
              {commonEvents.map((ev) => {
                const on = selectedEvents.includes(ev);
                return (
                  <button
                    type="button"
                    key={ev}
                    aria-pressed={on}
                    tabIndex={-1}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      on
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    <Ltr>{ev}</Ltr>
                  </button>
                );
              })}
            </div>

            {/* Selected events as removable chips */}
            <div className="flex flex-wrap gap-1.5 rounded-md border bg-muted/30 p-2">
              {selectedEvents.map((ev) => (
                <span
                  key={ev}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700 dark:text-emerald-300"
                >
                  <Ltr>{ev}</Ltr>
                </span>
              ))}
            </div>

            {/* Custom event input (decorative) */}
            <div className="flex gap-2">
              <Input
                placeholder={d.customPlaceholder}
                readOnly
                className="font-mono text-xs"
                tabIndex={-1}
              />
              <Button type="button" variant="outline" size="sm" tabIndex={-1}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {d.eventsSelected(selectedEvents.length)}
            </p>
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
            <Plus className="mr-1 h-3.5 w-3.5" /> {d.submitCreate}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Secret Dialog overlay (the one-time secret reveal) ──────────────── */

function SecretRevealDialog({
  copy,
  isRotate,
  prefersReducedMotion,
}: {
  copy: WebhooksStageCopy;
  isRotate: boolean;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  const d = copy.secretDialog;
  const title = isRotate ? d.titleRotate : d.titleCreate;

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
            {title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
        </div>

        {/* Amber warning */}
        <div className="px-6 pb-2">
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
        </div>

        {/* Secret + Copy button */}
        <div className="space-y-3 px-6 pb-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {d.secretLabel}
            </Label>
            <div className="flex items-center gap-2">
              <code dir="ltr" className="block flex-1 truncate rounded border bg-muted/40 px-2 py-2 font-mono text-xs">
                <Ltr>{copy.revealedSecret}</Ltr>
              </code>
              <Button size="sm" variant="outline" tabIndex={-1}>
                <Copy className="mr-1 h-3.5 w-3.5" /> {d.copy}
              </Button>
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

/* ─── Test-delivery banner (bottom overlay) ─────────────────────────────── */

function TestDeliveryBanner({
  prefersReducedMotion,
}: {
  prefersReducedMotion: boolean;
}): React.ReactElement {
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
      className="absolute inset-x-0 bottom-0 z-30 border-t border-sky-500/40 bg-sky-500/5 backdrop-blur-sm p-4"
    >
      <div className="mx-auto max-w-2xl space-y-1">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-sky-600" />
          <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">
            <Ltr>scheduleTestDelivery(endpointId, userId)</Ltr>
          </p>
          <Badge variant="outline" className="ml-auto text-[10px] bg-sky-500/10 text-sky-700 border-sky-500/30">
            <Ltr>nixify.webhook.test</Ltr>
          </Badge>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          <Ltr>{`WebhookDelivery(pending) + WebhookQueue(pending) → claimPendingJobs(25, workerId) → POST {url} · Nixify-Signature · Nixify-Event`}</Ltr>
        </p>
        <p className="text-[11px] text-muted-foreground">
          <Ltr>bypasses subscription matching · 10s timeout · redirect: "error"</Ltr>
        </p>
      </div>
    </motion.div>
  );
}

/* ─── Retry-and-failure banner (bottom overlay) ────────────────────────── */

function RetryFailureBanner({
  prefersReducedMotion,
}: {
  prefersReducedMotion: boolean;
}): React.ReactElement {
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
      className="absolute inset-x-0 bottom-0 z-30 border-t border-rose-500/40 bg-rose-500/5 backdrop-blur-sm p-4"
    >
      <div className="mx-auto max-w-2xl space-y-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600" />
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
            <Ltr>attempts &gt;= maxRetries → status=failed · lastError=max_attempts_exceeded</Ltr>
          </p>
          <Badge variant="outline" className="ml-auto text-[10px] bg-rose-500/10 text-rose-700 border-rose-500/30">
            <Ltr>terminal</Ltr>
          </Badge>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          <Ltr>{`backoff: 10s → 30s → 90s · Math.min(BACKOFF_BASE_MS * 3^(attempts-1), 90_000)`}</Ltr>
        </p>
        <p className="text-[11px] text-muted-foreground">
          <Ltr>classifyFetchError → network_error · timeout · http_4xx · http_5xx · ssrf_blocked · endpoint_missing · configuration_error</Ltr>
        </p>
      </div>
    </motion.div>
  );
}

/* ─── Replay-and-audit banner (bottom overlay) ────────────────────────── */

function ReplayAuditBanner({
  prefersReducedMotion,
}: {
  prefersReducedMotion: boolean;
}): React.ReactElement {
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
      className="absolute inset-x-0 bottom-0 z-30 border-t border-emerald-500/40 bg-emerald-500/5 backdrop-blur-sm p-4"
    >
      <div className="mx-auto max-w-2xl space-y-1">
        <div className="flex items-center gap-2">
          <RotateCw className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <Ltr>scheduleReplayDelivery(originalDeliveryId, userId)</Ltr>
          </p>
          <Badge variant="outline" className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
            <Ltr>NEW delivery</Ltr>
          </Badge>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          <Ltr>{`fresh signature · current secret + fresh timestamp · original NOT mutated`}</Ltr>
        </p>
        <p className="text-[11px] text-muted-foreground">
          <Ltr>POST /api/dashboard/webhooks/deliveries/:deliveryId/replay</Ltr>
        </p>
      </div>
    </motion.div>
  );
}

/* ─── Not-available screen (403 entitlement) ────────────────────────────── */

function NotAvailableScreen({
  copy,
}: {
  copy: WebhooksStageCopy;
}): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center py-16 text-center">
      <Webhook className="h-10 w-10 text-muted-foreground" />
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

interface WebhooksStageProps extends SceneRenderContext {
  copy: WebhooksStageCopy;
}

export function WebhooksStage({
  scene,
  isPlaying,
  prefersReducedMotion,
  copy,
}: WebhooksStageProps): React.ReactElement {
  const dir = copy.dir;

  // Scenes that show the not-available (403) screen instead of the list.
  const showNotAvailable = scene === "notAvailable";

  // Which endpoint row is highlighted per scene.
  // - createEndpoint → endpoint id 1 (so the new row appears at the top of
  //   the list once the dialog closes).
  // - testDelivery → endpoint id 1 (the row whose "Send test" action was
  //   clicked).
  function isEndpointHighlighted(id: number): boolean {
    if (scene === "createEndpoint") return id === 1;
    if (scene === "testDelivery") return id === 1;
    return false;
  }
  function endpointHighlightTone(id: number): "create" | "test" | "neutral" {
    if (scene === "createEndpoint" && id === 1) return "create";
    if (scene === "testDelivery" && id === 1) return "test";
    return "neutral";
  }

  // Which delivery row is highlighted per scene.
  // - testDelivery → the pending nixify.webhook.test row.
  // - retryAndFailure → the failed row with attempts=3 + max_attempts_exceeded.
  // - replayAndAudit → the failed row (replay target).
  function isDeliveryHighlighted(d: WebhooksStageDelivery): boolean {
    if (scene === "testDelivery") return d.status === "pending" && d.eventId === "nixify.webhook.test";
    if (scene === "retryAndFailure") return d.status === "failed" && d.lastError === "max_attempts_exceeded";
    if (scene === "replayAndAudit") return d.status === "failed" && d.lastError === "max_attempts_exceeded";
    return false;
  }
  function deliveryHighlightTone(d: WebhooksStageDelivery): "failed" | "pending" | "replay" | "neutral" {
    if (scene === "testDelivery" && d.status === "pending") return "pending";
    if (scene === "retryAndFailure" && d.status === "failed") return "failed";
    if (scene === "replayAndAudit" && d.status === "failed") return "replay";
    return "neutral";
  }
  function isReplayHighlighted(d: WebhooksStageDelivery): boolean {
    return scene === "replayAndAudit" && d.status === "failed" && d.lastError === "max_attempts_exceeded";
  }

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
                  <Webhook className="h-5 w-5 text-emerald-600" />
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
                tabIndex={-1}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> {copy.header.addEndpoint}
              </Button>
            </div>
          </div>

          {/* Body — endpoints card + deliveries card */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Endpoints card */}
            <Card className="overflow-hidden">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">{copy.endpointsCard.title}</p>
                <p className="text-xs text-muted-foreground">
                  {copy.endpointsCard.subtitle(
                    copy.endpoints.length,
                    copy.endpoints.filter((e) => e.isActive).length,
                  )}
                </p>
              </div>
              <CardContent className="p-0">
                <div className="max-h-[20rem] overflow-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur">
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3 font-medium">{copy.table.url}</th>
                        <th className="px-4 py-3 font-medium">{copy.table.events}</th>
                        <th className="px-4 py-3 font-medium">{copy.table.status}</th>
                        <th className="hidden px-4 py-3 font-medium md:table-cell">{copy.table.created}</th>
                        <th className="hidden px-4 py-3 font-medium lg:table-cell">{copy.table.lastUsed}</th>
                        <th className="px-4 py-3 text-right font-medium">{copy.table.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {copy.endpoints.map((ep) => (
                        <EndpointRow
                          key={ep.id}
                          endpoint={ep}
                          copy={copy}
                          highlighted={isEndpointHighlighted(ep.id)}
                          highlightTone={endpointHighlightTone(ep.id)}
                          prefersReducedMotion={prefersReducedMotion}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Deliveries card */}
            <Card className="overflow-hidden">
              <div className="border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-semibold">{copy.deliveriesCard.title}</p>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{copy.deliveriesCard.subtitle}</p>
              </div>
              <CardContent className="p-0">
                <div className="max-h-[24rem] overflow-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur">
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3 font-medium">{copy.deliveriesCard.columnEvent}</th>
                        <th className="px-4 py-3 font-medium">{copy.deliveriesCard.columnEndpoint}</th>
                        <th className="px-4 py-3 font-medium">{copy.deliveriesCard.columnStatus}</th>
                        <th className="px-4 py-3 text-right font-medium">{copy.deliveriesCard.columnTries}</th>
                        <th className="px-4 py-3 text-right font-medium">{copy.deliveriesCard.columnCode}</th>
                        <th className="px-4 py-3 font-medium">{copy.deliveriesCard.columnError}</th>
                        <th className="hidden px-4 py-3 font-medium md:table-cell">{copy.deliveriesCard.columnCreated}</th>
                        <th className="px-4 py-3 text-right font-medium">{copy.deliveriesCard.columnReplay}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {copy.deliveries.map((d) => (
                        <DeliveryRow
                          key={d.deliveryId}
                          delivery={d}
                          endpoints={copy.endpoints}
                          copy={copy}
                          highlighted={isDeliveryHighlighted(d)}
                          highlightTone={deliveryHighlightTone(d)}
                          replayHighlighted={isReplayHighlighted(d)}
                          prefersReducedMotion={prefersReducedMotion}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Decorative pagination strip */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                <Ltr>{copy.pagination.pageOf(1, copy.deliveries.length)}</Ltr>
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled tabIndex={-1}>
                  <Ltr>{copy.pagination.prev}</Ltr>
                </Button>
                <Button variant="outline" size="sm" disabled tabIndex={-1}>
                  <Ltr>{copy.pagination.next}</Ltr>
                </Button>
              </div>
            </div>
          </div>

          {/* Overlays / banners */}
          <AnimatePresence mode="wait">
            {scene === "createEndpoint" && (
              <CreateEndpointDialog
                key="create-dialog"
                copy={copy}
                typedText=""
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
            {scene === "secretReveal" && (
              <SecretRevealDialog
                key="secret-dialog"
                copy={copy}
                isRotate={false}
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
            {scene === "testDelivery" && (
              <TestDeliveryBanner
                key="test-banner"
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
            {scene === "retryAndFailure" && (
              <RetryFailureBanner
                key="retry-banner"
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
            {scene === "replayAndAudit" && (
              <ReplayAuditBanner
                key="replay-banner"
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
