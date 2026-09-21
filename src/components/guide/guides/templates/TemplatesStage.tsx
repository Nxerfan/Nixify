"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, FileText, Plus, Search, MoreHorizontal, Trash2,
  ChevronLeft, ChevronRight, X, Lock, History, Eye, EyeOff, Variable,
  Clock, RotateCcw, Save, Send, AlertCircle,
} from "lucide-react";
import { Ltr } from "@/lib/i18n/Ltr";
import type { SceneRenderContext } from "../../CinematicWalkthrough";
import type {
  TemplatesStageCopy,
  TemplatesStageTemplate,
  TemplatesStageVersion,
} from "@/lib/guide/content/guides/templates-types";

/**
 * TemplatesStage — the simulated Templates page for the
 * /guide/templates cinematic walkthrough.
 *
 * Mirrors the ACTUAL Nixify Templates product:
 *   - src/app/dashboard/templates/page.tsx          (templates list)
 *   - src/app/dashboard/templates/[id]/page.tsx    (template editor)
 *
 * Visual states (driven by the active `scene` key):
 *   - templatesList    — full list page: header + search + table with
 *                        Name/Slug/Version/Variables/Updated/Actions
 *                        columns. Three seed templates are visible.
 *   - createTemplate   — the list page with the Create Template dialog
 *                        overlaid (max-w-lg, name + slug + subject +
 *                        HTML body + plain text).
 *   - editorView       — the editor page: header with v{n} badge, two-
 *                        column grid (Editor tab on left + Live preview
 *                        on right).
 *   - variables        — the editor page with the Required variables
 *                        panel in the right column highlighted.
 *   - preview          — the editor page with the Preview output
 *                        visible: subject box + sandboxed iframe with
 *                        the rendered HTML.
 *   - testSend         — the editor page with the Send test email
 *                        dialog overlaid: amber quota warning, recipient
 *                        Input, variables list, Cancel + destructive
 *                        submit button. (NO real send.)
 *
 * Localization contract (REGRESSION-PROTECTED):
 *   - The stage is NOT permanently `dir="ltr"`. The `dir` comes from the
 *     resolved stage copy (stage.dir), which mirrors the active product
 *     locale (ltr for en, rtl for fa).
 *   - All human-facing labels (header, table headers, dialog titles,
 *     form labels, button copy, alert text) come from the stage copy.
 *   - Technical tokens (template slugs, version strings v1/v2/v3,
 *     {{var}} placeholders, ISO timestamps, HTML body strings, email
 *     addresses, HTTP method names) stay LTR via <Ltr>.
 *
 * Safety contract (REGRESSION-PROTECTED):
 *   - NO real `fetch()` calls anywhere in this file.
 *   - NO real database writes.
 *   - NO real template mutation.
 *   - NO real test send (NO real email delivery, NO quota consumption).
 *   - All state is local demo state (this component owns its own seeded data).
 *   - The iframe preview uses srcDoc with the SEED template HTML only —
 *     never with user input. There is no network round-trip.
 */

/* ─── Demo state (mirrors the real TemplateDetail shape) ────────────────── */

interface DemoState {
  /** Currently selected template ID (for editor scenes). */
  templateId: number;
  /** Currently active editor tab. */
  editorTab: "editor" | "versions";
  /** Whether the create dialog is open (list scene). */
  createDialogOpen: boolean;
  /** Whether the test send dialog is open (editor scene). */
  testSendDialogOpen: boolean;
  /** Whether the preview output is rendered. */
  previewRendered: boolean;
  /** Whether a save / preview / send is in flight (shows spinner). */
  busy: "saving" | "previewing" | "sending" | null;
  /** Selected historical version (Versions tab). */
  selectedVersion: number | null;
}

const DEFAULT_STATE: DemoState = {
  templateId: 1,
  editorTab: "editor",
  createDialogOpen: false,
  testSendDialogOpen: false,
  previewRendered: false,
  busy: null,
  selectedVersion: null,
};

/**
 * Derive the simulated state from the active scene.
 *
 * The walkthrough player controls which scene is active; we derive the demo
 * state so the visual story matches the captions without manual sync.
 */
function deriveStateFromScene(scene: string): DemoState {
  switch (scene) {
    case "templatesList":
      return { ...DEFAULT_STATE };
    case "createTemplate":
      return { ...DEFAULT_STATE, createDialogOpen: true };
    case "editorView":
      return { ...DEFAULT_STATE, editorTab: "editor" };
    case "variables":
      return { ...DEFAULT_STATE, editorTab: "editor" };
    case "preview":
      return {
        ...DEFAULT_STATE,
        editorTab: "editor",
        previewRendered: true,
      };
    case "testSend":
      return {
        ...DEFAULT_STATE,
        editorTab: "editor",
        previewRendered: true,
        testSendDialogOpen: true,
      };
    default:
      return { ...DEFAULT_STATE };
  }
}

/* ─── Stage entry ───────────────────────────────────────────────────────── */

export function TemplatesStage(
  ctx: SceneRenderContext & { copy: TemplatesStageCopy },
): React.ReactNode {
  const copy = ctx.copy;
  const dir = copy.dir;
  const sceneState = deriveStateFromScene(ctx.scene);

  return (
    <div className="h-full w-full overflow-hidden bg-[#0A0F0D] text-gray-200" dir={dir}>
      <AnimatePresence mode="wait">
        <motion.div
          key={ctx.scene}
          initial={ctx.prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={ctx.prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: ctx.prefersReducedMotion ? 0.1 : 0.3 }}
          className="h-full"
        >
          <TemplatesSurface
            copy={copy}
            scene={ctx.scene}
            state={sceneState}
            prefersReducedMotion={ctx.prefersReducedMotion}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ─── Surface (switches list ↔ editor) ──────────────────────────────────── */

interface TemplatesSurfaceProps {
  copy: TemplatesStageCopy;
  scene: string;
  state: DemoState;
  prefersReducedMotion: boolean;
}

function TemplatesSurface({
  copy,
  scene,
  state,
  prefersReducedMotion,
}: TemplatesSurfaceProps) {
  // List scenes vs editor scenes.
  const isListScene =
    scene === "templatesList" || scene === "createTemplate";

  if (isListScene) {
    return (
      <ListView
        copy={copy}
        scene={scene}
        state={state}
        prefersReducedMotion={prefersReducedMotion}
      />
    );
  }
  return (
    <EditorView
      copy={copy}
      scene={scene}
      state={state}
      prefersReducedMotion={prefersReducedMotion}
    />
  );
}

/* ─── List view ─────────────────────────────────────────────────────────── */

function ListView({
  copy,
  scene,
  state,
  prefersReducedMotion,
}: {
  copy: TemplatesStageCopy;
  scene: string;
  state: DemoState;
  prefersReducedMotion: boolean;
}) {
  const templates = copy.templates;
  return (
    <div className="relative flex h-full flex-col">
      {/* List page header */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-800/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-gray-800/40"
          >
            <ArrowLeft className="h-3 w-3" />
            {copy.listHeader.backToDashboard}
          </button>
          <span className="text-gray-700">·</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
            <FileText className="h-3 w-3" />
          </span>
          <p className="text-xs font-semibold text-gray-100">{copy.listHeader.title}</p>
          <span className="hidden text-[9px] text-gray-500 md:inline">{copy.listHeader.subtitle}</span>
        </div>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium ${
            scene === "createTemplate"
              ? "border border-emerald-500/40 text-emerald-300"
              : "bg-emerald-600 text-white"
          }`}
        >
          <Plus className="h-3 w-3" />
          {copy.listHeader.create}
        </button>
      </div>

      {/* Scrollable list content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        {/* Search */}
        <div className="mb-2 flex items-center gap-2">
          <div className="relative max-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              disabled
              placeholder={copy.search.placeholder}
              className="w-full rounded-md border border-gray-700/60 bg-gray-950/60 py-1 pl-7 pr-2 text-[10px] text-gray-300 placeholder-gray-500"
            />
          </div>
          <span className="text-[9px] text-gray-500">
            {copy.search.count(templates.length)}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-md border border-gray-800/60">
          <table className="w-full text-[10px]">
            <thead className="bg-gray-900/40">
              <tr className="border-b border-gray-800/60 text-left text-[9px] uppercase tracking-wider text-gray-500">
                <th className="px-2 py-1.5 font-medium">{copy.table.name}</th>
                <th className="hidden px-2 py-1.5 font-medium md:table-cell">{copy.table.slug}</th>
                <th className="px-2 py-1.5 font-medium">{copy.table.version}</th>
                <th className="hidden px-2 py-1.5 font-medium lg:table-cell">{copy.table.variables}</th>
                <th className="hidden px-2 py-1.5 font-medium md:table-cell">{copy.table.updated}</th>
                <th className="px-2 py-1.5 text-right font-medium">{copy.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tpl, i) => (
                <motion.tr
                  key={tpl.id}
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0.1 : 0.2, delay: prefersReducedMotion ? 0 : i * 0.05 }}
                  className={`border-b border-gray-800/60 last:border-0 hover:bg-gray-900/30 ${
                    scene === "templatesList" && i === 0 ? "bg-emerald-500/[0.04]" : ""
                  }`}
                >
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                        <FileText className="h-3 w-3" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-100">{tpl.name}</p>
                        <p className="truncate text-[8px] text-gray-500">{tpl.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-2 py-1.5 md:table-cell">
                    <code className="rounded bg-gray-900/60 px-1 py-0.5 text-[9px] text-gray-400">
                      <Ltr>{tpl.slug}</Ltr>
                    </code>
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="inline-flex items-center rounded border border-emerald-500/30 px-1 py-0.5 text-[9px] text-emerald-400">
                      <Ltr>v{tpl.currentVersion}</Ltr>
                    </span>
                  </td>
                  <td className="hidden px-2 py-1.5 text-gray-500 lg:table-cell">
                    <span className="inline-flex items-center gap-1 text-[9px]">
                      <Variable className="h-2.5 w-2.5" /> —
                    </span>
                  </td>
                  <td className="hidden px-2 py-1.5 text-[9px] text-gray-500 md:table-cell">
                    <Ltr>{tpl.updatedAtRelative}</Ltr>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-800/40">
                      <MoreHorizontal className="h-3 w-3" />
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination (decorative — single page) */}
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[9px] text-gray-500">{copy.table.pageOf(1, 1)}</p>
          <div className="flex gap-1">
            <button type="button" disabled className="inline-flex items-center gap-1 rounded border border-gray-800/60 px-1.5 py-0.5 text-[9px] text-gray-600">
              <ChevronLeft className="h-2.5 w-2.5" /> {copy.table.prev}
            </button>
            <button type="button" disabled className="inline-flex items-center gap-1 rounded border border-gray-800/60 px-1.5 py-0.5 text-[9px] text-gray-600">
              {copy.table.next} <ChevronRight className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Create dialog overlay */}
      <AnimatePresence>
        {state.createDialogOpen && (
          <CreateTemplateDialog
            copy={copy}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Create template dialog ────────────────────────────────────────────── */

function CreateTemplateDialog({
  copy,
  prefersReducedMotion,
}: {
  copy: TemplatesStageCopy;
  prefersReducedMotion: boolean;
}) {
  const c = copy.createDialog;
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.2 }}
      className="absolute inset-0 z-30 flex items-start justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: prefersReducedMotion ? 0.1 : 0.2 }}
        className="mt-2 w-full max-w-lg overflow-hidden rounded-lg border border-gray-700/60 bg-gray-950 shadow-2xl"
      >
        {/* Dialog header */}
        <div className="flex items-center justify-between border-b border-gray-800/60 px-3 py-2">
          <div>
            <p className="text-[11px] font-semibold text-gray-100">{c.title}</p>
            <p className="text-[9px] text-gray-500">{c.description}</p>
          </div>
          <span className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-500">
            <X className="h-3 w-3" />
          </span>
        </div>

        {/* Form */}
        <div className="max-h-[280px] space-y-2 overflow-y-auto p-3">
          {/* Name + Slug */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[9px] font-medium text-gray-300">{c.nameLabel}</label>
              <input
                disabled
                value="Welcome email"
                className="w-full rounded border border-gray-700/60 bg-gray-900/60 px-2 py-1 text-[10px] text-gray-200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-medium text-gray-300">{c.slugLabel}</label>
              <input
                disabled
                value="welcome-email"
                className="w-full rounded border border-gray-700/60 bg-gray-900/60 px-2 py-1 font-mono text-[10px] text-gray-200"
              />
              <p className="text-[8px] text-gray-500">{c.slugHelp}</p>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <label className="text-[9px] font-medium text-gray-300">{c.subjectLabel}</label>
            <input
              disabled
              value="Welcome to Nixify, {{name}}!"
              className="w-full rounded border border-gray-700/60 bg-gray-900/60 px-2 py-1 text-[10px] text-gray-200"
            />
            <p className="text-[8px] text-gray-500">{c.subjectHelp}</p>
          </div>

          {/* HTML body */}
          <div className="space-y-1">
            <label className="text-[9px] font-medium text-gray-300">{c.htmlLabel}</label>
            <pre className="h-16 overflow-hidden rounded border border-gray-700/60 bg-gray-900/60 px-2 py-1 font-mono text-[9px] text-gray-300">
{`<h1>Welcome, {{name}}!</h1>
<p>Your email <strong>{{email}}</strong> is verified.</p>`}
            </pre>
          </div>

          {/* Plain text */}
          <div className="space-y-1">
            <label className="text-[9px] font-medium text-gray-300">{c.textLabel}</label>
            <input
              disabled
              value="Welcome, {{name}}! Your email {{email}} is verified."
              className="w-full rounded border border-gray-700/60 bg-gray-900/60 px-2 py-1 font-mono text-[10px] text-gray-200"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-800/60 px-3 py-2">
          <button
            type="button"
            className="rounded px-2 py-1 text-[10px] text-gray-400 hover:bg-gray-800/40"
          >
            {c.cancel}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[10px] font-medium text-white shadow hover:bg-emerald-500"
          >
            <Plus className="h-3 w-3" />
            {c.submit}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Editor view ───────────────────────────────────────────────────────── */

function EditorView({
  copy,
  scene,
  state,
  prefersReducedMotion,
}: {
  copy: TemplatesStageCopy;
  scene: string;
  state: DemoState;
  prefersReducedMotion: boolean;
}) {
  const template: TemplatesStageTemplate =
    copy.templates.find((t) => t.id === state.templateId) ?? copy.templates[0];

  return (
    <div className="relative flex h-full flex-col">
      {/* Editor header */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-800/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-gray-800/40"
          >
            <ArrowLeft className="h-3 w-3" />
            {copy.editorHeader.backToTemplates}
          </button>
          <span className="text-gray-700">·</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
            <FileText className="h-3 w-3" />
          </span>
          <p className="truncate text-xs font-semibold text-gray-100">{template.name}</p>
          <span className="inline-flex items-center rounded border border-emerald-500/30 px-1 py-0.5 text-[9px] text-emerald-400">
            <Ltr>v{template.currentVersion}</Ltr>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-500"
          >
            <Save className="h-3 w-3" />
            {copy.editorHeader.save}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-rose-500/40 px-2 py-1 text-[10px] text-rose-400 hover:bg-rose-500/10"
          >
            <Trash2 className="h-3 w-3" />
            {copy.editorHeader.delete}
          </button>
        </div>
      </div>

      {/* Body — 2 column grid (lg:grid-cols-2). On small stage widths we
          stack vertically with the editor on top and preview below. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        <div className="grid gap-3 lg:grid-cols-2">
          {/* Left column — Tabs (Editor | Versions) */}
          <div className="space-y-2">
            {/* Tabs list */}
            <div className="inline-flex rounded-md border border-gray-800/60 bg-gray-950/40 p-0.5">
              <button
                type="button"
                className={`rounded px-2 py-1 text-[10px] ${
                  state.editorTab === "editor"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-gray-400"
                }`}
              >
                {copy.editorTabs.editor}
              </button>
              <button
                type="button"
                className={`rounded px-2 py-1 text-[10px] ${
                  state.editorTab === "versions"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-gray-400"
                }`}
              >
                <History className="mr-1 inline h-2.5 w-2.5" />
                {copy.editorTabs.versions(copy.versionHistory.length)}
              </button>
            </div>

            {/* Editor tab content */}
            {state.editorTab === "editor" ? (
              <EditorTabContent
                copy={copy}
                template={template}
                scene={scene}
              />
            ) : (
              <VersionsTabContent
                copy={copy}
                versions={copy.versionHistory}
                selectedVersion={state.selectedVersion}
              />
            )}
          </div>

          {/* Right column — Live preview */}
          <div className="space-y-2">
            <LivePreviewPanel
              copy={copy}
              template={template}
              scene={scene}
              state={state}
              prefersReducedMotion={prefersReducedMotion}
            />
            <MetadataPanel copy={copy} template={template} />
          </div>
        </div>
      </div>

      {/* Test send dialog overlay */}
      <AnimatePresence>
        {state.testSendDialogOpen && (
          <TestSendDialog copy={copy} template={template} prefersReducedMotion={prefersReducedMotion} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Editor tab content ───────────────────────────────────────────────── */

function EditorTabContent({
  copy,
  template,
  scene,
}: {
  copy: TemplatesStageCopy;
  template: TemplatesStageTemplate;
  scene: string;
}) {
  const f = copy.editorForm;
  return (
    <div className="rounded-lg border border-gray-800/60 bg-gray-950/40 p-2.5">
      <p className="mb-2 text-[10px] font-semibold text-gray-200">{f.contentTitle}</p>

      {/* Name */}
      <div className="mb-2 space-y-1">
        <label className="text-[9px] font-medium text-gray-300">{f.nameLabel}</label>
        <input
          disabled
          value={template.name}
          className="w-full rounded border border-gray-700/60 bg-gray-900/60 px-2 py-1 text-[10px] text-gray-200"
        />
      </div>

      {/* Slug (immutable) */}
      <div className="mb-2 space-y-1">
        <label className="flex items-center gap-1 text-[9px] font-medium text-gray-300">
          {f.slugLabel}
          <span className="inline-flex items-center rounded border border-amber-500/40 px-1 py-0 text-[8px] font-normal text-amber-500">
            <Lock className="mr-0.5 h-2 w-2" />
            {f.immutableBadge}
          </span>
        </label>
        <input
          disabled
          value={template.slug}
          className="w-full rounded border border-gray-700/60 bg-gray-900/40 px-2 py-1 font-mono text-[10px] text-gray-400"
        />
        <p className="text-[8px] text-gray-500">{f.slugFixed}</p>
      </div>

      {/* Subject */}
      <div className="mb-2 space-y-1">
        <label className="text-[9px] font-medium text-gray-300">{f.subjectLabel}</label>
        <input
          disabled
          value={template.subject}
          className={`w-full rounded border bg-gray-900/60 px-2 py-1 text-[10px] text-gray-200 ${
            scene === "editorView" ? "border-emerald-500/40" : "border-gray-700/60"
          }`}
        />
        <p className="text-[8px] text-gray-500">{f.subjectHelp}</p>
      </div>

      {/* HTML body */}
      <div className="mb-2 space-y-1">
        <label className="text-[9px] font-medium text-gray-300">{f.htmlLabel}</label>
        <pre className="h-20 overflow-hidden rounded border border-gray-700/60 bg-gray-900/60 px-2 py-1 font-mono text-[9px] text-gray-300">
          {template.html}
        </pre>
        <p className="text-[8px] text-gray-500">{f.htmlHelp}</p>
      </div>

      {/* Plain text */}
      <div className="mb-2 space-y-1">
        <label className="text-[9px] font-medium text-gray-300">{f.textLabel}</label>
        <input
          disabled
          value={template.text}
          className="w-full rounded border border-gray-700/60 bg-gray-900/60 px-2 py-1 font-mono text-[10px] text-gray-200"
        />
      </div>

      {/* Dirty state + buttons */}
      <div className="flex items-center justify-between border-t border-gray-800/60 pt-2">
        <p className="text-[8px] text-gray-500">{f.allChangesSaved}</p>
        <div className="flex gap-1">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1 rounded border border-gray-800/60 px-1.5 py-0.5 text-[9px] text-gray-500"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            {f.revert}
          </button>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1 rounded bg-emerald-600/40 px-1.5 py-0.5 text-[9px] text-white"
          >
            <Save className="h-2.5 w-2.5" />
            {f.save}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Versions tab content ─────────────────────────────────────────────── */

function VersionsTabContent({
  copy,
  versions,
  selectedVersion,
}: {
  copy: TemplatesStageCopy;
  versions: TemplatesStageVersion[];
  selectedVersion: number | null;
}) {
  const v = copy.versions;
  return (
    <div className="rounded-lg border border-gray-800/60 bg-gray-950/40 p-2.5">
      <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold text-gray-200">
        <History className="h-3 w-3 text-emerald-400" />
        {v.historyTitle}
      </p>

      <div className="space-y-1.5">
        {versions.map((ver) => {
          const isSelected = selectedVersion === ver.version;
          return (
            <div key={ver.version} className="rounded border border-gray-800/60">
              <button
                type="button"
                className={`flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors ${
                  isSelected ? "bg-emerald-500/5" : "hover:bg-gray-900/40"
                }`}
              >
                <span
                  className={`inline-flex items-center rounded border px-1 py-0.5 text-[8px] ${
                    ver.isCurrent
                      ? "border-emerald-500/40 text-emerald-400"
                      : "border-gray-700/60 text-gray-400"
                  }`}
                >
                  <Ltr>v{ver.version}</Ltr>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] text-gray-200">
                    {ver.subject || v.noSubject}
                  </p>
                  <p className="flex items-center gap-1 text-[8px] text-gray-500">
                    <Clock className="h-2 w-2" />
                    <Ltr>{ver.createdAtRelative}</Ltr>
                    <span className="mx-0.5">·</span>
                    <Variable className="h-2 w-2" />
                    {v.varsSuffix(ver.variables.length)}
                  </p>
                </div>
                {ver.isCurrent && (
                  <span className="rounded border border-emerald-500/30 px-1 py-0 text-[8px] text-emerald-400">
                    {v.current}
                  </span>
                )}
                <EyeOff className="h-3 w-3 text-gray-500" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Live preview panel (right column) ─────────────────────────────────── */

function LivePreviewPanel({
  copy,
  template,
  scene,
  state,
  prefersReducedMotion,
}: {
  copy: TemplatesStageCopy;
  template: TemplatesStageTemplate;
  scene: string;
  state: DemoState;
  prefersReducedMotion: boolean;
}) {
  const p = copy.preview;
  const requiredVars = template.variables;

  // Build a demo value map (so the preview output makes sense).
  const demoValues: Record<string, string> = {
    email: "sara@example.com",
    name: "Sara",
    code: "987654",
    reset_link: "https://nixify.app/reset/abc123",
  };

  return (
    <div className="rounded-lg border border-gray-800/60 bg-gray-950/40 p-2.5">
      <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold text-gray-200">
        <Eye className="h-3 w-3 text-emerald-400" />
        {p.title}
      </p>

      {/* Required variables */}
      <div className="mb-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1 text-[9px] font-medium text-gray-300">
            <Variable className="h-2.5 w-2.5" />
            {p.requiredVars}
          </label>
          <span className="text-[8px] text-gray-500">
            {p.requiredVarsCount(requiredVars.length)}
          </span>
        </div>
        {requiredVars.length === 0 ? (
          <p className="text-[8px] text-gray-500">{p.noVars}</p>
        ) : (
          <div className="max-h-32 space-y-1 overflow-y-auto pr-0.5">
            {requiredVars.map((name) => (
              <div key={name} className="space-y-0.5">
                <label className={`font-mono text-[8px] ${scene === "variables" ? "text-emerald-300" : "text-gray-400"}`}>
                  <Ltr>{`{{${name}}}`}</Ltr>
                </label>
                <input
                  disabled
                  value={demoValues[name] ?? ""}
                  placeholder={p.placeholderValue(name)}
                  className={`w-full rounded border bg-gray-900/60 px-1.5 py-0.5 text-[9px] text-gray-200 ${
                    scene === "variables" ? "border-emerald-500/40" : "border-gray-700/60"
                  }`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview + Send test email buttons */}
      <button
        type="button"
        className={`mb-1 w-full rounded px-2 py-1 text-[10px] font-medium ${
          scene === "preview"
            ? "bg-emerald-600 text-white"
            : "bg-emerald-600/80 text-white hover:bg-emerald-500"
        }`}
      >
        <Eye className="mr-1 inline h-3 w-3" />
        {state.busy === "previewing" ? p.rendering : p.previewButton}
      </button>
      <button
        type="button"
        className={`mb-1 w-full rounded border px-2 py-1 text-[10px] font-medium ${
          scene === "testSend"
            ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
            : "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
        }`}
      >
        <Send className="mr-1 inline h-3 w-3" />
        {p.testSendButton}
      </button>
      <p className="mb-2 text-center text-[8px] text-gray-500">{p.caption}</p>

      {/* Preview output */}
      <AnimatePresence>
        {state.previewRendered && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
            className="space-y-1.5"
          >
            {/* Rendered subject */}
            <div className="rounded border border-gray-800/60 bg-gray-900/40 p-1.5">
              <p className="mb-0.5 text-[8px] font-medium text-gray-500">{p.renderedSubject}</p>
              <p className="text-[10px] text-gray-200">
                <Ltr>{renderTemplate(template.subject, demoValues)}</Ltr>
              </p>
            </div>
            {/* Rendered HTML */}
            <div>
              <p className="mb-0.5 text-[8px] font-medium text-gray-500">{p.renderedHtml}</p>
              <iframe
                title="template-preview"
                sandbox="allow-same-origin"
                srcDoc={renderTemplate(template.html, demoValues)}
                className="h-32 w-full rounded border border-gray-800/60 bg-white"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!state.previewRendered && (
        <p className="text-center text-[8px] text-gray-500">{p.fillInPrompt}</p>
      )}
    </div>
  );
}

/* ─── Metadata panel (right column, below preview) ──────────────────────── */

function MetadataPanel({
  copy,
  template,
}: {
  copy: TemplatesStageCopy;
  template: TemplatesStageTemplate;
}) {
  const m = copy.metadata;
  return (
    <div className="rounded-lg border border-gray-800/60 bg-gray-950/40 p-2.5">
      <div className="space-y-1 text-[9px] text-gray-500">
        <div className="flex items-center justify-between">
          <span>{m.templateId}</span>
          <code className="font-mono text-gray-400">
            <Ltr>{template.id}</Ltr>
          </code>
        </div>
        <div className="flex items-center justify-between">
          <span>{m.currentVersion}</span>
          <span className="inline-flex items-center rounded border border-emerald-500/30 px-1 py-0 text-[9px] text-emerald-400">
            <Ltr>v{template.currentVersion}</Ltr>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>{m.created}</span>
          <Ltr>{template.updatedAtRelative}</Ltr>
        </div>
        <div className="flex items-center justify-between">
          <span>{m.updated}</span>
          <Ltr>{template.updatedAtRelative}</Ltr>
        </div>
      </div>
    </div>
  );
}

/* ─── Test send dialog ─────────────────────────────────────────────────── */

function TestSendDialog({
  copy,
  template,
  prefersReducedMotion,
}: {
  copy: TemplatesStageCopy;
  template: TemplatesStageTemplate;
  prefersReducedMotion: boolean;
}) {
  const t = copy.testSend;
  const requiredVars = template.variables;
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.2 }}
      className="absolute inset-0 z-30 flex items-start justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: prefersReducedMotion ? 0.1 : 0.2 }}
        className="mt-2 w-full max-w-sm overflow-hidden rounded-lg border border-gray-700/60 bg-gray-950 shadow-2xl"
      >
        {/* Header */}
        <div className="border-b border-gray-800/60 px-3 py-2">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-gray-100">
            <Send className="h-3 w-3 text-emerald-400" />
            {t.title}
          </p>
          <p className="text-[9px] text-gray-500">{t.description}</p>
        </div>

        {/* Body */}
        <div className="space-y-2 p-3">
          {/* Quota warning */}
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
              <p className="text-[9px] text-amber-600 dark:text-amber-400">{t.warning}</p>
            </div>
          </div>

          {/* Recipient */}
          <div className="space-y-1">
            <label className="text-[9px] font-medium text-gray-300">{t.recipientLabel}</label>
            <input
              disabled
              placeholder={t.recipientPlaceholder}
              className="w-full rounded border border-gray-700/60 bg-gray-900/60 px-2 py-1 text-[10px] text-gray-200"
            />
            <p className="text-[8px] text-gray-500">{t.recipientHelp}</p>
          </div>

          {/* Variables */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1 text-[9px] font-medium text-gray-300">
                <Variable className="h-2.5 w-2.5" />
                <Ltr>{t.varsLabel(requiredVars.length)}</Ltr>
              </label>
            </div>
            {requiredVars.length === 0 ? (
              <p className="text-[8px] text-gray-500">{t.noVars}</p>
            ) : (
              <div className="space-y-1">
                {requiredVars.map((name) => (
                  <div key={name} className="space-y-0.5">
                    <label className="font-mono text-[8px] text-gray-400">
                      <Ltr>{`{{${name}}}`}</Ltr>
                    </label>
                    <input
                      disabled
                      placeholder={copy.preview.placeholderValue(name)}
                      className="w-full rounded border border-gray-700/60 bg-gray-900/60 px-1.5 py-0.5 text-[9px] text-gray-200"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-800/60 px-3 py-2">
          <button
            type="button"
            className="rounded px-2 py-1 text-[10px] text-gray-400 hover:bg-gray-800/40"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-rose-500"
          >
            <Send className="h-3 w-3" />
            {t.submit}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

/**
 * Render the template by replacing {{var}} placeholders with values.
 *
 * This is the SAME simple string-replace the backend performs — no
 * conditionals, no escaping. Purely local; no network round-trip.
 */
function renderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return values[key] ?? match;
  });
}
