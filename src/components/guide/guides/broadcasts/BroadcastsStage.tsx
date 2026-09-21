"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone, Plus, Play, X, Eye, Clock, Users, ShieldOff,
  CheckCircle2, AlertCircle, Loader2, Ban, AlertTriangle,
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Ltr } from "@/lib/i18n/Ltr";
import type { SceneRenderContext } from "../../CinematicWalkthrough";
import type {
  BroadcastsStageCopy,
  BroadcastsStageBroadcast,
  BroadcastStatusTone,
} from "@/lib/guide/content/guides/broadcasts-types";

/**
 * BroadcastsStage — the simulated Broadcasts page for the
 * /guide/broadcasts cinematic walkthrough.
 *
 * Mirrors the ACTUAL Nixify Broadcasts product at:
 *   - src/app/dashboard/broadcasts/page.tsx          (broadcasts list)
 *
 * Visual states (driven by the active `scene` key):
 *   - broadcastsOverview   — full list page: header + Card with 6 seed
 *                            broadcasts covering draft / queued / sending /
 *                            completed / cancelled / review_pending. No
 *                            overlays. No banners.
 *   - createBroadcast     — list page with the New Broadcast dialog
 *                            overlaid (name + subject + HTML body +
 *                            audience select).
 *   - previewAudience     — list page with a Preview banner overlay
 *                            showing Total / Eligible / Unknown /
 *                            Unsubscribed / Suppressed for the seed
 *                            draft broadcast.
 *   - launchDecision      — list page with a Launch banner overlay:
 *                            either "Broadcast launched — N recipients"
 *                            (queued path) or "submitted for admin
 *                            review" (review_pending path). Both paths
 *                            shown side-by-side for teaching.
 *   - inFlightProgress    — list page with the sending-row highlighted
 *                            and counts visibly mid-flight (sent=612,
 *                            pending=628). A small "Live" pulse on the
 *                            status badge reinforces that counts update
 *                            as sends complete.
 *   - completedOrCancelled — list page with the completed and cancelled
 *                            rows highlighted. Footer caption reinforces
 *                            "terminal — no actions available".
 *
 * Localization contract (REGRESSION-PROTECTED):
 *   - The stage is NOT permanently `dir="ltr"`. The `dir` comes from the
 *     resolved stage copy (stage.dir), which mirrors the active product
 *     locale (ltr for en, rtl for fa).
 *   - All human-facing labels (header, badge labels, button copy,
 *     dialog text, banner copy) come from the stage copy.
 *   - Technical tokens (broadcast IDs like bc_monthly_2026_09, status
 *     strings like draft/queued/sending/completed/cancelled, audience
 *     type codes like all_contacts, {{var}} placeholders like
 *     {{contact.name}}, ISO timestamps, HTML body strings, email
 *     addresses, HTTP method names, recipient count numbers) stay LTR
 *     via <Ltr>.
 *
 * Safety contract (REGRESSION-PROTECTED):
 *   - NO real `fetch()` calls anywhere in this file.
 *   - NO real database writes.
 *   - NO real broadcast mutation.
 *   - NO real launch (NO real audience snapshot, NO real content freeze,
 *     NO real BROADCAST_EMAILS quota consumption).
 *   - NO real cancel (NO real recipient skip).
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
/* Mirrors STATUS_COLORS in src/app/dashboard/broadcasts/page.tsx verbatim. */

const STATUS_BADGE_CLASS: Record<BroadcastStatusTone, string> = {
  draft: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  review_pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  queued: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  sending: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  paused_quota: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  completed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  cancelled: "bg-rose-500/10 text-rose-700 border-rose-500/30",
  rejected: "bg-rose-500/10 text-rose-700 border-rose-500/30",
  failed: "bg-rose-500/10 text-rose-700 border-rose-500/30",
};

/** Statuses that show the Cancel button in the real UI. */
const CANCELLABLE_STATUSES: ReadonlySet<BroadcastStatusTone> = new Set([
  "review_pending",
  "queued",
  "sending",
  "paused_quota",
]);

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "good" | "warn" | "bad";
}): React.ReactElement {
  const toneClass =
    tone === "good"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "bad"
          ? "text-rose-600"
          : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${toneClass}`}>
      <span className="text-muted-foreground/70">{label}:</span>
      <Ltr>{value.toLocaleString()}</Ltr>
    </span>
  );
}

/** A single broadcast row — mirrors the real page's row layout. */
function BroadcastRow({
  b,
  copy,
  highlighted,
  showActions = true,
  prefersReducedMotion,
}: {
  b: BroadcastsStageBroadcast;
  copy: BroadcastsStageCopy;
  highlighted: boolean;
  showActions?: boolean;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  const statusLabel = copy.statusLabels[b.status];
  const isDraft = b.status === "draft";
  const cancellable = CANCELLABLE_STATUSES.has(b.status);
  const isTerminal = b.status === "completed" || b.status === "cancelled" || b.status === "rejected" || b.status === "failed";
  const isLive = b.status === "sending";

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
      className={`rounded-md border p-4 transition-colors ${
        highlighted
          ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/20"
          : "hover:bg-accent/50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: name + badges + subject + stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{b.name}</span>
            <Badge
              variant="outline"
              className={`text-xs ${STATUS_BADGE_CLASS[b.status]}`}
            >
              {isLive && !prefersReducedMotion && (
                <motion.span
                  className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <Ltr>{statusLabel}</Ltr>
            </Badge>
            {b.reviewPending && (
              <Badge
                variant="outline"
                className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/30"
              >
                {copy.reviewPendingBadge}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 truncate">
            <Ltr>{b.subject}</Ltr>
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            <StatPill label={copy.stats.total} value={b.totalRecipients} tone="neutral" />
            <StatPill label={copy.stats.sent} value={b.sentCount} tone="good" />
            <StatPill label={copy.stats.skipped} value={b.skippedCount} tone="warn" />
            <StatPill label={copy.stats.failed} value={b.failedCount} tone="bad" />
            <StatPill label={copy.stats.pending} value={b.pendingCount} tone="neutral" />
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
            {b.audienceType === "group" ? (
              <Users className="h-3 w-3" />
            ) : (
              <Users className="h-3 w-3" />
            )}
            <span className="text-muted-foreground/70">{copy.stats.audience}:</span>
            <span>{b.audienceLabel}</span>
            <span className="text-muted-foreground/40">·</span>
            <Clock className="h-3 w-3" />
            <span>{b.createdAtRelative}</span>
          </div>
        </div>
        {/* Right: actions */}
        {showActions && (
          <div className="flex gap-1 shrink-0">
            {isDraft && (
              <>
                <Button size="sm" variant="outline" tabIndex={-1}>
                  <Eye className="mr-1 h-3.5 w-3.5" /> {copy.actions.preview}
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                  tabIndex={-1}
                >
                  <Play className="mr-1 h-3.5 w-3.5" /> {copy.actions.launch}
                </Button>
              </>
            )}
            {cancellable && (
              <Button
                size="sm"
                variant="outline"
                className="text-rose-600 hover:text-rose-700"
                tabIndex={-1}
              >
                <X className="mr-1 h-3.5 w-3.5" /> {copy.actions.cancel}
              </Button>
            )}
            {isTerminal && (
              <span className="text-[10px] text-muted-foreground/60 self-center">
                —
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Overlays ────────────────────────────────────────────────────────────── */

function CreateBroadcastDialog({
  copy,
  typedText,
  prefersReducedMotion,
}: {
  copy: BroadcastsStageCopy;
  typedText: string;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  const d = copy.createDialog;
  // In the createBroadcast scene, typedText animates into the Name field.
  const nameValue = typedText || d.namePlaceholder;
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-2xl rounded-lg border bg-background shadow-xl">
        <div className="flex items-start justify-between p-6 pb-2">
          <div>
            <h3 className="text-lg font-semibold">{d.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
          </div>
        </div>
        <div className="space-y-4 px-6 pb-4">
          {/* Name */}
          <div>
            <Label htmlFor="bc-name-sim" className="text-xs">
              {d.nameLabel}
            </Label>
            <Input
              id="bc-name-sim"
              value={nameValue}
              readOnly
              className="mt-1"
              placeholder={d.namePlaceholder}
            />
          </div>
          {/* Subject */}
          <div>
            <Label htmlFor="bc-subject-sim" className="text-xs">
              {d.subjectLabel}
            </Label>
            <Input
              id="bc-subject-sim"
              readOnly
              className="mt-1 font-mono text-xs"
              value="Hello {{contact.name}} — what's new in September"
            />
            <p className="text-xs text-muted-foreground mt-1">
              <Ltr>{d.variablesHelp}</Ltr>
            </p>
          </div>
          {/* HTML content */}
          <div>
            <Label htmlFor="bc-html-sim" className="text-xs">
              {d.htmlLabel}
            </Label>
            <pre
              id="bc-html-sim"
              className="mt-1 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-xs font-mono whitespace-pre-wrap"
            >
              <Ltr>{"<p>Hello {{contact.name}}!</p>\n<p>Welcome to our newsletter.</p>"}</Ltr>
            </pre>
            <p className="text-xs text-muted-foreground mt-1">{d.htmlHelp}</p>
          </div>
          {/* Audience */}
          <div>
            <Label className="text-xs">{d.audienceLabel}</Label>
            <div className="mt-1 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{d.allContacts}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{d.audienceHelp}</p>
          </div>
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
            {d.submit}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function PreviewBanner({
  copy,
  prefersReducedMotion,
}: {
  copy: BroadcastsStageCopy;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  const labels = copy.previewBanner.labels;
  const breakdown = copy.previewBreakdown;
  const labelByKey: Record<string, string> = {
    total: labels.total,
    eligible: labels.eligible,
    unknown: labels.unknown,
    unsubscribed: labels.unsubscribed,
    suppressed: labels.suppressed,
  };
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
      className="absolute inset-x-0 bottom-0 z-30 border-t border-emerald-500/40 bg-emerald-500/5 backdrop-blur-sm p-4"
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 flex items-center gap-2">
          <Eye className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-700">
            {copy.previewBanner.title}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {breakdown.map((row) => (
            <div
              key={row.key}
              className={`rounded-md border px-3 py-2 ${
                row.tone === "good"
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : row.tone === "warn"
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-border bg-background"
              }`}
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {labelByKey[row.key]}
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">
                <Ltr>{row.count.toLocaleString()}</Ltr>
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {copy.previewBanner.note}
        </p>
      </div>
    </motion.div>
  );
}

function LaunchBanner({
  copy,
  prefersReducedMotion,
}: {
  copy: BroadcastsStageCopy;
  prefersReducedMotion: boolean;
}): React.ReactElement {
  // Show BOTH paths side-by-side for teaching: the queued path (under threshold)
  // and the review_pending path (over threshold).
  const queued = copy.broadcasts.find((b) => b.status === "queued");
  const review = copy.broadcasts.find((b) => b.status === "review_pending");
  const queuedCount = queued?.totalRecipients ?? 482;
  const reviewCount = review?.totalRecipients ?? 2150;

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
      className="absolute inset-x-0 bottom-0 z-30 border-t border-emerald-500/40 bg-emerald-500/5 backdrop-blur-sm p-4"
    >
      <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
        {/* Queued path */}
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-700">
              {copy.launchBanner.titleLaunched}
            </p>
            <Badge
              variant="outline"
              className="ml-auto text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
            >
              <Ltr>queued</Ltr>
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {copy.launchBanner.recipientCountLabel(queuedCount)} ·{" "}
            <Ltr>{`recipientCount ≤ 1000`}</Ltr>
          </p>
        </div>
        {/* Review-pending path */}
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-700">
              {copy.launchBanner.titleReview}
            </p>
            <Badge
              variant="outline"
              className="ml-auto text-xs bg-amber-500/10 text-amber-700 border-amber-500/30"
            >
              <Ltr>review_pending</Ltr>
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {copy.launchBanner.bodyReview}{" "}
            {copy.launchBanner.recipientCountLabel(reviewCount)} ·{" "}
            <Ltr>{`recipientCount > 1000`}</Ltr>
          </p>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
        <Ltr>POST /api/dashboard/broadcasts/{`{broadcastId}`}/launch</Ltr> · idempotency-key auto-generated · CAS draft → queued | review_pending
      </p>
    </motion.div>
  );
}

function CancelBanner({
  copy,
  prefersReducedMotion,
}: {
  copy: BroadcastsStageCopy;
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
        <Ban className="h-5 w-5 text-rose-600" />
        <div>
          <p className="text-sm font-semibold text-rose-700">
            {copy.cancelBanner.title}
          </p>
          <p className="text-xs text-muted-foreground">
            <Ltr>POST /api/dashboard/broadcasts/{`{broadcastId}`}/cancel</Ltr> · idempotent · pending recipients skipped with reason = <Ltr>broadcast_cancelled</Ltr>
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
  copy: BroadcastsStageCopy;
}): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center py-16 text-center">
      <ShieldOff className="h-10 w-10 text-muted-foreground" />
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

interface BroadcastsStageProps extends SceneRenderContext {
  copy: BroadcastsStageCopy;
}

export function BroadcastsStage({
  scene,
  typedText,
  isPlaying,
  prefersReducedMotion,
  copy,
}: BroadcastsStageProps): React.ReactElement {
  const dir = copy.dir;

  // Scenes that show the not-available (403) screen instead of the list.
  // Currently no scene uses this — the not-available path is taught in the
  // troubleshooting section. Kept here for parity with the real page.
  const showNotAvailable = scene === "notAvailable";

  // Which broadcast row should be highlighted (border + ring) per scene.
  const highlightedId: number | null =
    scene === "previewAudience"
      ? 1 // the draft row that got Preview clicked
      : scene === "launchDecision"
        ? 2 // the queued row (showing the result of a launch)
        : scene === "inFlightProgress"
          ? 3 // the sending row (live counts)
          : scene === "completedOrCancelled"
            ? 4 // the completed row (or 5 cancelled — we highlight both via terminal filter)
            : null;

  // Hide the row action buttons on scenes where we're showing a banner —
  // the banner is the focus, not the buttons. (Mirrors how the real page's
  // toast diverts attention; we just don't show real toasts.)
  const showActions = scene !== "previewAudience" && scene !== "launchDecision";

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
              <Megaphone className="h-5 w-5 text-emerald-600" />
              {copy.header.title}
            </h1>
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              tabIndex={-1}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {copy.header.create}
            </Button>
          </div>

          {/* Card body — list */}
          <div className="flex-1 overflow-y-auto p-4">
            <Card className="overflow-hidden">
              <CardHeader className="bg-gray-50/40 pb-3">
                <CardTitle className="text-base">{copy.card.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{copy.card.subtitle}</p>
              </CardHeader>
              <CardContent className="space-y-2 p-3">
                {copy.broadcasts.map((b) => (
                  <BroadcastRow
                    key={b.id}
                    b={b}
                    copy={copy}
                    highlighted={
                      scene === "completedOrCancelled"
                        ? b.status === "completed" || b.status === "cancelled"
                        : b.id === highlightedId
                    }
                    showActions={showActions}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Decorative pagination (6 rows < 20 page_size, so it's static) */}
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {copy.pagination.pageOf(1, copy.broadcasts.length)}
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
          </div>

          {/* Overlays / banners */}
          <AnimatePresence mode="wait">
            {scene === "createBroadcast" && (
              <CreateBroadcastDialog
                key="create-dialog"
                copy={copy}
                typedText={typedText}
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
            {scene === "previewAudience" && (
              <PreviewBanner
                key="preview-banner"
                copy={copy}
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
            {scene === "launchDecision" && (
              <LaunchBanner
                key="launch-banner"
                copy={copy}
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
            {scene === "completedOrCancelled" && (
              <CancelBanner
                key="cancel-banner"
                copy={copy}
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
          </AnimatePresence>

          {/* Playing indicator (subtle bottom-right pill, only when actively playing) */}
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
