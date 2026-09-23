"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, ArrowLeft, Megaphone, MessageSquare, KeyRound, Loader2,
  AlertTriangle, ShieldOff, Ban, Clock, Inbox, Send, X,
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Ltr } from "@/lib/i18n/Ltr";
import type { SceneRenderContext } from "../../CinematicWalkthrough";
import type {
  EmailsStageCopy,
  EmailsStageDelivery,
  EmailsStageEvent,
  EmailDeliveryStatus,
  EmailDeliverySourceType,
  EmailDeliveryProvider,
  EmailsStageSourceRow,
} from "@/lib/guide/content/guides/emails-types";

/**
 * EmailsStage — the simulated Emails page for the /guide/emails cinematic
 * walkthrough.
 *
 * HONESTY CONTRACT (REGRESSION-PROTECTED):
 *   This stage mirrors the REAL /dashboard/emails page exactly as it ships
 *   today — a 31-line PLACEHOLDER. The real page renders ONLY:
 *     1. A ghost "Back to Dashboard" link.
 *     2. An emerald Mail icon tile + h1 "Sent Emails" + subtitle.
 *     3. A single centered bordered box with the empty-state copy.
 *   The page does NOT fetch from /api/dashboard/deliveries. There is no
 *   list, no status badge, no event-timeline overlay, no detail drawer.
 *
 *   Anything in this stage that LOOKS like a list / timeline / filters is
 *   explicitly labeled "Concept preview — not the real UI today" via the
 *   `copy.concept.tag` strip. The deliverability backend IS real and
 *   shipped (Phase 11); the dashboard page is the visualization gap.
 *
 * Visual states (driven by the active `scene` key):
 *   - emailsOverview   — the actual placeholder as it ships today (header
 *                        + empty-state card on dark theme). A small callout
 *                        below the placeholder honestly explains the gap.
 *   - conceptPreview   — concept preview of what the page WOULD look like
 *                        once wired to GET /api/dashboard/deliveries.
 *                        9 seed rows covering every visible status, with
 *                        a status badge per row + suppression pill where
 *                        applicable. Tagged as a concept.
 *   - deliveryRow      — same concept list, but with one row highlighted
 *                        (the delivered row, id=1) and an explanatory
 *                        caption overlay reinforcing what each status
 *                        means. Tagged as a concept.
 *   - eventTimeline    — concept overlay: the detail drawer for one
 *                        delivery, showing the full immutable
 *                        EmailDeliveryEvent history. Tagged as a concept.
 *   - bounceSuppression — concept list with the bounced + complained rows
 *                        highlighted (id=3 and id=6), showing the
 *                        suppression pill. Tagged as a concept.
 *   - relatedSources   — concept card showing how emails relate to
 *                        broadcasts + transactional + OTP sources.
 *
 * Localization contract (REGRESSION-PROTECTED):
 *   - The stage is NOT permanently `dir="ltr"`. The `dir` comes from the
 *     resolved stage copy (stage.dir), which mirrors the active product
 *     locale (ltr for en, rtl for fa).
 *   - All human-facing labels come from the stage copy.
 *   - Technical tokens (deliveryId UUIDs, status strings like queued /
 *     provider_accepted / delivered / deferred / bounced / complained /
 *     rejected / failed / unknown, sourceType codes like broadcast /
 *     transactional / otp, provider codes like smtp, providerMessageId,
 *     ISO timestamps, {{var}} placeholders, email addresses, HTTP method
 *     names, lastErrorCode strings) stay LTR via <Ltr>.
 *
 * Safety contract (REGRESSION-PROTECTED):
 *   - NO real `fetch()` calls anywhere in this file.
 *   - NO real database writes.
 *   - NO real delivery mutation.
 *   - NO real suppression changes.
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
/* Mirrors the conceptual dashboard's status color palette (which mirrors the
 * tone classes used by the deliverability service: good / warn / bad /
 * neutral / recovery). The status code itself stays LTR via <Ltr>. */
const STATUS_BADGE_CLASS: Record<EmailDeliveryStatus, string> = {
  queued: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  provider_accepted: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  delivered: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  deferred: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  bounced: "bg-rose-500/10 text-rose-700 border-rose-500/30",
  complained: "bg-rose-500/10 text-rose-700 border-rose-500/30",
  rejected: "bg-rose-500/10 text-rose-700 border-rose-500/30",
  failed: "bg-rose-500/10 text-rose-700 border-rose-500/30",
  unknown: "bg-purple-500/10 text-purple-700 border-purple-500/30",
};

/** Source-type badge color classes — used for the Source column chip. */
const SOURCE_BADGE_CLASS: Record<EmailDeliverySourceType, string> = {
  broadcast: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  transactional: "bg-sky-500/10 text-sky-700 border-sky-500/30",
  otp: "bg-amber-500/10 text-amber-700 border-amber-500/30",
};

/** Source-type icon. */
function SourceIcon({ type }: { type: EmailDeliverySourceType }): React.ReactElement {
  if (type === "broadcast") return <Megaphone className="h-3 w-3" />;
  if (type === "transactional") return <MessageSquare className="h-3 w-3" />;
  return <KeyRound className="h-3 w-3" />;
}

/** Source-row tone → icon mapping for the related-sources card. */
function SourcesRowIcon({ tone }: { tone: EmailsStageSourceRow["tone"] }): React.ReactElement {
  if (tone === "broadcast") return <Megaphone className="h-4 w-4 text-emerald-600" />;
  if (tone === "transactional") return <MessageSquare className="h-4 w-4 text-sky-600" />;
  return <KeyRound className="h-4 w-4 text-amber-600" />;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/** A single simulated EmailDelivery row — mirrors the conceptual dashboard
 * row layout the page is meant to show once wired. */
function DeliveryRow({
  d,
  copy,
  highlighted,
  prefersReducedMotion,
}: {
  d: EmailsStageDelivery;
  copy: EmailsStageCopy;
  highlighted: boolean;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  const statusLabel = copy.statusLabels[d.currentStatus];
  const sourceLabel = copy.sourceLabels[d.sourceType];
  const isLive = d.isLive;

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
      className={`rounded-md border p-3 transition-colors ${
        highlighted
          ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/20"
          : "border-border hover:bg-accent/50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: recipient + subject + source */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs">
              <Ltr>{d.recipient}</Ltr>
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] ${STATUS_BADGE_CLASS[d.currentStatus]}`}
            >
              {isLive && !prefersReducedMotion && (
                <motion.span
                  className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <Ltr>{d.currentStatus}</Ltr>
            </Badge>
            {d.suppressionApplied && (
              <Badge
                variant="outline"
                className="text-[10px] bg-rose-500/10 text-rose-700 border-rose-500/30"
              >
                <ShieldOff className="mr-1 h-2.5 w-2.5" />
                {copy.suppressionPill}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 truncate">
            <Ltr>{d.subject}</Ltr>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Badge
              variant="outline"
              className={`text-[10px] ${SOURCE_BADGE_CLASS[d.sourceType]}`}
            >
              <SourceIcon type={d.sourceType} />
              <span className="ml-1">{sourceLabel}</span>
            </Badge>
            <span className="text-muted-foreground/70">{d.sourceLabel}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="font-mono text-[10px]">
              <Ltr>{d.provider}</Ltr>
            </span>
            {d.lastErrorCode && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="font-mono text-[10px] text-rose-600">
                  <Ltr>{d.lastErrorCode}</Ltr>
                </span>
              </>
            )}
            <span className="text-muted-foreground/40">·</span>
            <Clock className="h-2.5 w-2.5" />
            <span><Ltr>{d.createdAtRelative}</Ltr></span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── The actual placeholder scene ────────────────────────────────────────── */
/** Renders the real Emails page exactly as it ships today — a 31-line
 * placeholder with a header + one empty-state card on a dark backdrop. */
function PlaceholderScene({
  copy,
}: {
  copy: EmailsStageCopy;
}): React.ReactElement {
  return (
    <div className="flex h-full flex-col bg-card text-foreground">
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        {/* Ghost "Back to Dashboard" link */}
        <div className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-muted-foreground cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
          {copy.header.backToDashboard}
        </div>

        {/* Header: emerald Mail icon tile + title + subtitle */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/15 bg-emerald-500/10">
            <Mail className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {copy.header.title}
            </h1>
            <p className="text-sm text-muted-foreground">{copy.header.subtitle}</p>
          </div>
        </div>

        {/* Empty-state bordered box (verbatim from the real page) */}
        <div className="rounded-xl border border-border/60 bg-muted/40 p-8 text-center backdrop-blur-xl">
          <p className="text-sm text-muted-foreground">{copy.placeholder.body}</p>
        </div>

        {/* Honest callout below the placeholder */}
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="mb-1.5 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-semibold text-amber-200">
              {copy.placeholder.calloutTitle}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{copy.placeholder.calloutBody}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Concept-preview tag strip ──────────────────────────────────────────── */
function ConceptTag({ tag }: { tag: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-1.5 border-b border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-[11px] text-amber-700">
      <AlertTriangle className="h-3 w-3" />
      <span>{tag}</span>
    </div>
  );
}

/* ─── Concept-preview scene: list of EmailDelivery rows ──────────────────── */
function ConceptListScene({
  scene,
  copy,
  prefersReducedMotion,
}: {
  scene: string;
  copy: EmailsStageCopy;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  // Highlighted rows per scene — visually draw the user's eye to the
  // rows the caption is teaching about.
  const highlightedIds: Set<number> = new Set(
    scene === "deliveryRow"
      ? [1] // delivered row
      : scene === "bounceSuppression"
        ? [3, 6] // bounced + complained (with suppression pill)
        : [],
  );

  return (
    <div className="flex h-full flex-col bg-white">
      <ConceptTag tag={copy.concept.tag} />
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50/50 px-4 py-3">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Mail className="h-5 w-5 text-emerald-600" />
          {copy.header.title}
        </h1>
      </div>

      {/* Card body — list */}
      <div className="flex-1 overflow-y-auto p-4">
        <Card className="overflow-hidden">
          <CardHeader className="bg-gray-50/40 pb-3">
            <CardTitle className="text-base">{copy.concept.cardTitle}</CardTitle>
            <p className="text-xs text-muted-foreground">{copy.concept.cardSubtitle}</p>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {copy.deliveries.map((d) => (
              <DeliveryRow
                key={d.id}
                d={d}
                copy={copy}
                highlighted={highlightedIds.has(d.id)}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
          </CardContent>
        </Card>

        {/* Decorative pagination (9 rows < 20 page_size, so it's static) */}
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {copy.pagination.pageOf(1, copy.deliveries.length)}
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

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          {copy.concept.caption}
        </p>
      </div>
    </div>
  );
}

/* ─── Event-timeline overlay scene ──────────────────────────────────────── */
function EventTimelineScene({
  copy,
  prefersReducedMotion,
}: {
  copy: EmailsStageCopy;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  // Use the seed delivery that has the most complete event history — the
  // one whose lifecycle goes queued → accepted → deferred → delivered →
  // complained. We pick the first delivery (delivered row) for the demo.
  const d = copy.deliveries[0];

  return (
    <div className="flex h-full flex-col bg-white">
      <ConceptTag tag={copy.eventTimeline.tag} />
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50/50 px-4 py-3">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Mail className="h-5 w-5 text-emerald-600" />
          {copy.header.title}
        </h1>
      </div>

      {/* Body — detail card */}
      <div className="flex-1 overflow-y-auto p-4">
        <Card className="overflow-hidden">
          <CardHeader className="bg-gray-50/40 pb-3">
            <CardTitle className="text-base">{copy.eventTimeline.cardTitle}</CardTitle>
            <p className="text-xs text-muted-foreground">{copy.eventTimeline.cardSubtitle}</p>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            {/* Row-level metadata */}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-background p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {copy.eventTimeline.deliveryIdLabel}
                </p>
                <p className="mt-0.5 font-mono text-[11px]">
                  <Ltr>{d.deliveryId}</Ltr>
                </p>
              </div>
              <div className="rounded-md border border-border bg-background p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {copy.eventTimeline.recipientLabel}
                </p>
                <p className="mt-0.5 font-mono text-xs">
                  <Ltr>{d.recipient}</Ltr>
                </p>
              </div>
              <div className="rounded-md border border-border bg-background p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {copy.eventTimeline.statusLabel}
                </p>
                <div className="mt-0.5">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${STATUS_BADGE_CLASS[d.currentStatus]}`}
                  >
                    <Ltr>{d.currentStatus}</Ltr>
                  </Badge>
                </div>
              </div>
              <div className="rounded-md border border-border bg-background p-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {copy.eventTimeline.providerLabel}
                </p>
                <p className="mt-0.5 font-mono text-[11px]">
                  <Ltr>{d.provider}</Ltr>
                </p>
              </div>
              <div className="rounded-md border border-border bg-background p-2 sm:col-span-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {copy.eventTimeline.sourceLabel}
                </p>
                <p className="mt-0.5 text-xs">
                  <Ltr>{d.sourceType}</Ltr>
                  <span className="text-muted-foreground"> · {d.sourceLabel}</span>
                </p>
              </div>
            </div>

            {/* Event history */}
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {copy.eventTimeline.historyTitle}
              </p>
              <ol className="relative space-y-2 border-l border-gray-200 pl-4">
                {copy.events.map((e, i) => {
                  const toneClass =
                    e.tone === "good"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                      : e.tone === "warn"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
                        : e.tone === "bad"
                          ? "border-rose-500/40 bg-rose-500/10 text-rose-700"
                          : "border-slate-500/40 bg-slate-500/10 text-slate-700";
                  return (
                    <motion.li
                      key={e.id}
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 4 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                      transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.06 }}
                      className="relative"
                    >
                      {/* Node marker */}
                      <span className="absolute -left-[1.4rem] top-1 flex h-3 w-3 items-center justify-center rounded-full border border-emerald-500/40 bg-white">
                        <span className={`h-1.5 w-1.5 rounded-full ${toneClass.split(" ").find((c) => c.startsWith("bg-"))?.replace("bg-", "bg-") ?? "bg-emerald-400"}`} />
                      </span>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <Badge variant="outline" className={`text-[10px] ${toneClass}`}>
                            <Ltr>{e.type}</Ltr>
                          </Badge>
                          <p className="mt-1 text-[11px] text-muted-foreground">{e.desc}</p>
                          {e.token && (
                            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">
                              <Ltr>{e.token}</Ltr>
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          <Ltr>{e.occurredAt}</Ltr>
                        </span>
                      </div>
                    </motion.li>
                  );
                })}
              </ol>
            </div>

            {/* Footnote */}
            <p className="rounded-md border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
              {copy.eventTimeline.footnote}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ─── Related-sources scene ──────────────────────────────────────────────── */
function RelatedSourcesScene({
  copy,
  prefersReducedMotion,
}: {
  copy: EmailsStageCopy;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  return (
    <div className="flex h-full flex-col bg-white">
      <ConceptTag tag={copy.concept.tag} />
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50/50 px-4 py-3">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Mail className="h-5 w-5 text-emerald-600" />
          {copy.header.title}
        </h1>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        <Card className="overflow-hidden">
          <CardHeader className="bg-gray-50/40 pb-3">
            <CardTitle className="text-base">{copy.sourcesCard.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{copy.sourcesCard.subtitle}</p>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {copy.sourcesCard.rows.map((r, i) => (
              <motion.div
                key={r.key}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, delay: prefersReducedMotion ? 0 : i * 0.08 }}
                className="flex items-start gap-3 rounded-md border border-border bg-background p-3"
              >
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
                  <SourcesRowIcon tone={r.tone} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{r.label}</p>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      <Ltr>{r.key}</Ltr>
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.desc}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground/80">
                    <Ltr>{r.token}</Ltr>
                  </p>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          {copy.sourcesCard.footnote}
        </p>
      </div>
    </div>
  );
}

/* ─── Main stage ─────────────────────────────────────────────────────────── */

interface EmailsStageProps extends SceneRenderContext {
  copy: EmailsStageCopy;
}

export function EmailsStage({
  scene,
  isPlaying,
  prefersReducedMotion,
  copy,
}: EmailsStageProps): React.ReactElement {
  const dir = copy.dir;

  return (
    <div
      dir={dir}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-gray-200 bg-white"
    >
      {/* Scene switcher — each scene is a distinct visual surface. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scene}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
          className="absolute inset-0"
        >
          {scene === "emailsOverview" ? (
            <PlaceholderScene copy={copy} />
          ) : scene === "eventTimeline" ? (
            <EventTimelineScene copy={copy} prefersReducedMotion={prefersReducedMotion} />
          ) : scene === "relatedSources" ? (
            <RelatedSourcesScene copy={copy} prefersReducedMotion={prefersReducedMotion} />
          ) : (
            /* conceptPreview / deliveryRow / bounceSuppression all use the
             * same concept list, with different rows highlighted. */
            <ConceptListScene
              scene={scene}
              copy={copy}
              prefersReducedMotion={prefersReducedMotion}
            />
          )}
        </motion.div>
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
  );
}
