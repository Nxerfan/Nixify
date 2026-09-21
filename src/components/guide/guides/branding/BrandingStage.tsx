"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette, Sparkles, RefreshCw, ArrowLeft, Eye, Save, Trash2,
  Lock, Crown, Send, Mail, Layers, ChevronRight,
} from "lucide-react";
import { Ltr } from "@/lib/i18n/Ltr";
import type { SceneRenderContext } from "../../CinematicWalkthrough";
import type { BrandingStageCopy } from "@/lib/guide/content/guides/branding-types";

/**
 * BrandingStage — the simulated Email Themes editor for the /guide/branding
 * cinematic walkthrough.
 *
 * Mirrors the ACTUAL Nixify Branding product:
 *   - src/app/dashboard/branding/page.tsx  (Email Themes editor)
 *
 * Visual states (driven by the active `scene` key):
 *   - brandingOverview  — full editor page: header + gallery + editor + preview
 *   - gallery           — template gallery focused, with one card highlighted
 *   - colorsTab         — editor with the Branding tab open, color pickers
 *                         actively being edited
 *   - headerFooterTabs  — editor with the Header tab focused, switches to
 *                         Footer tab visually
 *   - livePreview       — Live Preview card with Mode / Language / Inbox
 *                         client selectors + iframe preview rendered
 *   - savedThemes       — Saved Themes table with one row's Activate action
 *                         highlighted + Dynamic Theme Rules card
 *
 * Localization contract (REGRESSION-PROTECTED):
 *   - The stage is NOT permanently `dir="ltr"`. The `dir` comes from the
 *     resolved stage copy (stage.dir), which mirrors the active product
 *     locale (ltr for en, rtl for fa).
 *   - All human-facing labels (header, gallery card text, editor toolbar,
 *     tab labels, save bar, rules table, saved themes table) come from the
 *     stage copy.
 *   - Technical tokens (hex colors, CSS property names, HTML tags, template
 *     IDs, font family names, email addresses) stay LTR via <Ltr>.
 *
 * Safety contract (REGRESSION-PROTECTED):
 *   - NO real `fetch()` calls anywhere in this file.
 *   - NO real database writes.
 *   - NO real theme mutation.
 *   - All state is local demo state (this component owns its own seeded data).
 *   - No quota consumption.
 */

/* ─── Demo state ──────────────────────────────────────────────────────── */

interface DemoColor {
  primary: string;
  secondary: string;
  accent: string;
}

const DEFAULT_COLORS: DemoColor = {
  primary: "#059669",
  secondary: "#0f172a",
  accent: "#f59e0b",
};

const CUSTOM_COLORS: DemoColor = {
  primary: "#4f46e5",
  secondary: "#1e1b4b",
  accent: "#f59e0b",
};

/**
 * The stage receives the active scene key + the typing-animation payload from
 * the CinematicWalkthrough shell, plus the resolved stage copy. The stage is
 * responsible for rendering the right simulated UI fragment for that scene in
 * the active locale.
 *
 * All UI state is DERIVED from the active `ctx.scene` directly where possible.
 * Local interactive state (selected tab, color draft) is owned by the stage
 * but initialized from the scene — so the walkthrough player stays in sync.
 */
export function BrandingStage(
  ctx: SceneRenderContext & { copy: BrandingStageCopy },
): React.ReactNode {
  const copy = ctx.copy;
  const dir = copy.dir;

  // DERIVED state: the active scene drives what tab and what colors are shown.
  // This mirrors the ContactsStage pattern — no useEffect, no mirrored state,
  // no cascading renders. The user never controls the scene from inside the
  // stage (the walkthrough player's Next/Prev controls do that), so derived
  // state is the correct model. The local override allows a user click on a
  // tab to visually change the highlight without changing the walkthrough scene.
  const sceneTab: string =
    ctx.scene === "colorsTab"
      ? "branding"
      : ctx.scene === "headerFooterTabs"
        ? "header"
        : "branding";
  const [tabOverride, setTabOverride] = React.useState<string | null>(null);
  const activeTab = tabOverride ?? sceneTab;

  const colors: DemoColor = ctx.scene === "colorsTab" ? CUSTOM_COLORS : DEFAULT_COLORS;

  // Local preview-pane state — these are user-interactive (Mode / Language /
  // Inbox client selectors). They live entirely on the stage; the walkthrough
  // player doesn't drive them.
  const [previewMode, setPreviewMode] = React.useState<string>("light");
  const [previewLang, setPreviewLang] = React.useState<string>("en");
  const [previewInbox, setPreviewInbox] = React.useState<string>("gmail-desktop");

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
          <BrandingSurface
            copy={copy}
            scene={ctx.scene}
            activeTab={activeTab}
            colors={colors}
            previewMode={previewMode}
            previewLang={previewLang}
            previewInbox={previewInbox}
            onTab={(t) => setTabOverride(t)}
            onMode={setPreviewMode}
            onLang={setPreviewLang}
            onInbox={setPreviewInbox}
            prefersReducedMotion={ctx.prefersReducedMotion}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ─── Branding surface ────────────────────────────────────────────────── */

interface BrandingSurfaceProps {
  copy: BrandingStageCopy;
  scene: string;
  activeTab: string;
  colors: DemoColor;
  previewMode: string;
  previewLang: string;
  previewInbox: string;
  onTab: (t: string) => void;
  onMode: (m: string) => void;
  onLang: (l: string) => void;
  onInbox: (i: string) => void;
  prefersReducedMotion: boolean;
}

function BrandingSurface({
  copy,
  scene,
  activeTab,
  colors,
  previewMode,
  previewLang,
  previewInbox,
  onTab,
  onMode,
  onLang,
  onInbox,
  prefersReducedMotion,
}: BrandingSurfaceProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-gray-800/60 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-gray-300 hover:bg-gray-800/40"
          >
            <ArrowLeft className="h-3 w-3" />
            {copy.header.backToDashboard}
          </button>
          <span className="text-gray-700">·</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
            <Palette className="h-3 w-3" />
          </span>
          <p className="text-xs font-semibold text-gray-100">{copy.header.title}</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-gray-700/60 px-1.5 py-0.5 text-[10px] text-gray-300 hover:bg-gray-800/40"
        >
          <RefreshCw className="h-2.5 w-2.5" />
          {copy.header.refresh}
        </button>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        {/* Template Gallery card */}
        <GalleryCard copy={copy} highlight={scene === "gallery"} prefersReducedMotion={prefersReducedMotion} />

        {/* Two-column editor + preview */}
        <div className="mt-2.5 grid gap-2.5 lg:grid-cols-2">
          <EditorCard
            copy={copy}
            activeTab={activeTab}
            colors={colors}
            onTab={onTab}
            scene={scene}
            prefersReducedMotion={prefersReducedMotion}
          />
          <PreviewCard
            copy={copy}
            colors={colors}
            previewMode={previewMode}
            previewLang={previewLang}
            previewInbox={previewInbox}
            onMode={onMode}
            onLang={onLang}
            onInbox={onInbox}
            highlight={scene === "livePreview"}
            prefersReducedMotion={prefersReducedMotion}
          />
        </div>

        {/* Save/Activate bar */}
        <SaveBar copy={copy} highlight={scene === "savedThemes"} />

        {/* Dynamic Theme Rules + Saved Themes */}
        {(scene === "savedThemes" || scene === "brandingOverview") && (
          <div className="mt-2.5 space-y-2.5">
            <RulesCard copy={copy} prefersReducedMotion={prefersReducedMotion} />
            <div className="grid gap-2.5 lg:grid-cols-2">
              <MultiLanguageCard copy={copy} />
              <InboxPreviewCard copy={copy} />
            </div>
            <SavedThemesCard
              copy={copy}
              highlight={scene === "savedThemes"}
              prefersReducedMotion={prefersReducedMotion}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Gallery card ────────────────────────────────────────────────────── */

function GalleryCard({
  copy,
  highlight,
  prefersReducedMotion,
}: {
  copy: BrandingStageCopy;
  highlight: boolean;
  prefersReducedMotion: boolean;
}) {
  return (
    <motion.div
      animate={
        highlight && !prefersReducedMotion
          ? { boxShadow: "0 0 0 1px rgba(16,185,129,0.5)" }
          : { boxShadow: "0 0 0 1px rgba(31,41,55,0.6)" }
      }
      transition={{ duration: 0.3 }}
      className={`rounded-lg border bg-gray-950/40 p-2.5 ${
        highlight ? "border-emerald-500/40" : "border-gray-800/60"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-emerald-400" />
          <p className="text-[11px] font-semibold text-gray-100">{copy.gallery.title}</p>
        </div>
        <p className="text-[9px] text-gray-400">{copy.gallery.description(copy.templates.length)}</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {copy.templates.map((tpl, i) => (
          <div
            key={tpl.id}
            className={`w-28 shrink-0 rounded-md border bg-gray-950/60 p-1.5 ${
              highlight && i === 2 ? "border-emerald-500/40 ring-1 ring-emerald-500/30" : "border-gray-800/60"
            }`}
          >
            {/* MiniPreview */}
            <div
              className="mb-1 flex h-10 items-center justify-center rounded text-[8px] font-bold"
              style={{
                background: tpl.isPro
                  ? "linear-gradient(135deg, #312e81, #4338ca)"
                  : "linear-gradient(135deg, #059669, #047857)",
                color: "#fff",
              }}
            >
              <Ltr>{tpl.name.split(" ").map((w) => w[0]).join("").slice(0, 3)}</Ltr>
            </div>
            <p className="truncate text-[9px] font-medium text-gray-200">
              <Ltr>{tpl.name}</Ltr>
            </p>
            <div className="mt-0.5 flex items-center gap-1">
              <span
                className={`inline-flex rounded px-1 py-px text-[7px] font-medium ${
                  tpl.isPro
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-emerald-500/15 text-emerald-300"
                }`}
              >
                {tpl.isPro ? (
                  <>
                    <Crown className="mr-0.5 inline h-2 w-2" />
                    {copy.gallery.proBadge}
                  </>
                ) : (
                  copy.gallery.freeBadge
                )}
              </span>
              <span className="text-[7px] text-gray-600">
                <Ltr>{tpl.category}</Ltr>
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Editor card ──────────────────────────────────────────────────────── */

function EditorCard({
  copy,
  activeTab,
  colors,
  onTab,
  scene,
  prefersReducedMotion,
}: {
  copy: BrandingStageCopy;
  activeTab: string;
  colors: DemoColor;
  onTab: (t: string) => void;
  scene: string;
  prefersReducedMotion: boolean;
}) {
  const tabs = copy.editor.tabs;
  const tabEntries: [string, string][] = [
    ["branding", tabs.branding],
    ["header", tabs.header],
    ["otp", tabs.otp],
    ["bg", tabs.bg],
    ["footer", tabs.footer],
    ["typography", tabs.typography],
    ["components", tabs.components],
  ];

  return (
    <div
      className={`rounded-lg border bg-gray-950/40 ${
        scene === "colorsTab" || scene === "headerFooterTabs" ? "border-emerald-500/40" : "border-gray-800/60"
      }`}
    >
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-800/60 bg-gray-950/80 px-2.5 py-1.5 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-emerald-400" />
          <p className="text-[10px] font-semibold text-gray-100">{copy.editor.title}</p>
          <span className="text-[9px] text-gray-400">·</span>
          <p className="text-[9px] text-gray-400">
            {copy.editor.editingName("Acme Pro")}{" "}
            <span className="text-gray-600">
              {copy.editor.templatePrefix}{" "}
              <Ltr className="font-mono text-gray-300">rounded-slate</Ltr>
            </span>
          </p>
        </div>
        <span className="inline-flex rounded px-1.5 py-px text-[8px] font-medium bg-emerald-500/15 text-emerald-300">
          {copy.editor.planBadgePro}
        </span>
      </div>

      {/* FREE plan banner (collapsed) */}
      <div className="mx-2.5 mt-2 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5">
        <p className="text-[9px] font-medium text-amber-200">{copy.editor.freeBannerTitle}</p>
        <p className="mt-0.5 text-[8px] text-amber-200/70">{copy.editor.freeBannerSubtitle}</p>
      </div>

      {/* Tabs list */}
      <div className="flex gap-px overflow-x-auto border-b border-gray-800/60 px-2 py-1.5">
        {tabEntries.map(([key, label]) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onTab(key)}
              className={`shrink-0 rounded px-2 py-1 text-[9px] font-medium transition ${
                isActive
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "text-gray-400 hover:bg-gray-800/40 hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-2.5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.2 }}
          >
            {activeTab === "branding" && (
              <BrandingTabContent copy={copy} colors={colors} active={scene === "colorsTab"} />
            )}
            {activeTab === "header" && <HeaderTabContent copy={copy} />}
            {activeTab === "footer" && <FooterTabContent copy={copy} />}
            {(activeTab !== "branding" && activeTab !== "header" && activeTab !== "footer") && (
              <OtherTabContent copy={copy} tabKey={activeTab} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Branding tab content ────────────────────────────────────────────── */

function BrandingTabContent({
  copy,
  colors,
  active,
}: {
  copy: BrandingStageCopy;
  colors: DemoColor;
  active: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[8px] text-amber-300/80">{copy.editor.freeTabNotices.branding}</p>
      <Field label={copy.brandingTab.appName}>
        <Ltr>Acme</Ltr>
      </Field>
      <Field label={copy.brandingTab.logoUrl}>
        <Ltr className="truncate">https://acme.example.com/logo.png</Ltr>
      </Field>
      <div className="grid grid-cols-3 gap-1.5">
        <ColorField label={copy.brandingTab.primaryColor} value={colors.primary} active={active} />
        <ColorField label={copy.brandingTab.secondaryColor} value={colors.secondary} />
        <ColorField label={copy.brandingTab.accentColor} value={colors.accent} />
      </div>
      <Field label={copy.brandingTab.website}>
        <Ltr>https://acme.example.com</Ltr>
      </Field>
      <Field label={copy.brandingTab.supportEmail}>
        <Ltr>support@acme.example.com</Ltr>
      </Field>
      <Field label={copy.brandingTab.defaultFont}>
        <Ltr>Inter</Ltr>
      </Field>
      <div className="flex gap-1.5 pt-1">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[9px] font-medium text-white hover:bg-emerald-500"
        >
          <Save className="h-2.5 w-2.5" />
          {copy.brandingTab.saveAsBrandKit}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-gray-700/60 px-2 py-1 text-[9px] text-gray-300 hover:bg-gray-800/40"
        >
          <Layers className="h-2.5 w-2.5" />
          {copy.brandingTab.loadBrandKit}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[9px] text-gray-400">{label}</label>
      <div className="mt-0.5 h-6 w-full rounded-md border border-gray-700/60 bg-gray-900/60 px-2 text-[10px] text-gray-200 flex items-center">
        {children}
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div>
      <label className="text-[9px] text-gray-400">{label}</label>
      <div
        className={`mt-0.5 flex h-7 items-center gap-1 rounded-md border bg-gray-900/60 px-1.5 ${
          active ? "border-emerald-500/40 ring-1 ring-emerald-500/30" : "border-gray-700/60"
        }`}
      >
        <span
          className="h-4 w-4 shrink-0 rounded border border-gray-700/60"
          style={{ backgroundColor: value }}
        />
        <Ltr className="truncate text-[9px] text-gray-300">{value}</Ltr>
      </div>
    </div>
  );
}

/* ─── Header tab content ──────────────────────────────────────────────── */

function HeaderTabContent({ copy }: { copy: BrandingStageCopy }) {
  const positions = [
    { value: "left", label: copy.headerTab.positionLeft },
    { value: "center", label: copy.headerTab.positionCenter },
    { value: "right", label: copy.headerTab.positionRight },
  ];
  return (
    <div className="space-y-2">
      <p className="text-[8px] text-amber-300/80">{copy.headerTab.contentEditableNote}</p>
      <Field label={copy.headerTab.title}>Verify your email</Field>
      <Field label={copy.headerTab.subtitle}>Use the code below to complete verification</Field>
      <div>
        <label className="text-[9px] text-gray-400">{copy.headerTab.logoPosition}</label>
        <div className="mt-0.5 flex gap-1">
          {positions.map((p, i) => (
            <button
              key={p.value}
              type="button"
              className={`flex-1 rounded border px-1 py-1 text-[9px] ${
                i === 1
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-gray-700/60 text-gray-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Field label={copy.headerTab.backgroundColor}>
          <Ltr className="flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-gray-700/60" style={{ backgroundColor: "#059669" }} />
            #059669
          </Ltr>
        </Field>
        <Field label={copy.headerTab.textColor}>
          <Ltr className="flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-gray-700/60" style={{ backgroundColor: "#ffffff" }} />
            #ffffff
          </Ltr>
        </Field>
      </div>
    </div>
  );
}

/* ─── Footer tab content ──────────────────────────────────────────────── */

function FooterTabContent({ copy }: { copy: BrandingStageCopy }) {
  return (
    <div className="space-y-2">
      <p className="text-[8px] text-amber-300/80">{copy.footerTab.contentEditableNote}</p>
      <Field label={copy.footerTab.companyName}>Acme</Field>
      <Field label={copy.footerTab.copyright}>© 2026 Acme Inc.</Field>
      <Field label={copy.footerTab.supportEmail}>
        <Ltr>support@acme.example.com</Ltr>
      </Field>
      <Field label={copy.footerTab.website}>
        <Ltr>https://acme.example.com</Ltr>
      </Field>
      <div className="grid grid-cols-3 gap-1.5">
        <Field label={copy.footerTab.twitter}>
          <Ltr className="truncate">@acme</Ltr>
        </Field>
        <Field label={copy.footerTab.github}>
          <Ltr className="truncate">acme</Ltr>
        </Field>
        <Field label={copy.footerTab.linkedin}>
          <Ltr className="truncate">acme</Ltr>
        </Field>
      </div>
      <Field label={copy.footerTab.textColor}>
        <Ltr className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-gray-700/60" style={{ backgroundColor: "#64748b" }} />
          #64748b
        </Ltr>
      </Field>
    </div>
  );
}

/* ─── Other tab content (OTP / BG / Typography / Components) ──────────── */

function OtherTabContent({
  copy,
  tabKey,
}: {
  copy: BrandingStageCopy;
  tabKey: string;
}) {
  const PRO_LOCK = (
    <div className="flex items-center gap-1.5 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5">
      <Lock className="h-3 w-3 text-amber-400" />
      <p className="text-[9px] text-amber-200">PRO+ only — unlock to edit.</p>
    </div>
  );

  if (tabKey === "otp") {
    return (
      <div className="space-y-2">
        {PRO_LOCK}
        <div className="grid grid-cols-3 gap-1.5">
          <Field label="Background">
            <Ltr className="flex items-center gap-1">
              <span className="h-3 w-3 rounded border border-gray-700/60" style={{ backgroundColor: "#ffffff" }} />
              #ffffff
            </Ltr>
          </Field>
          <Field label="Border">
            <Ltr className="flex items-center gap-1">
              <span className="h-3 w-3 rounded border border-gray-700/60" style={{ backgroundColor: "#e2e8f0" }} />
              #e2e8f0
            </Ltr>
          </Field>
          <Field label="Text Color">
            <Ltr className="flex items-center gap-1">
              <span className="h-3 w-3 rounded border border-gray-700/60" style={{ backgroundColor: "#059669" }} />
              #059669
            </Ltr>
          </Field>
        </div>
        <Slider label="Border Radius" value={12} min={0} max={30} suffix="px" />
        <Slider label="Font Size" value={32} min={20} max={40} suffix="px" />
        <Slider label="Letter Spacing" value={8} min={0} max={15} suffix="px" />
      </div>
    );
  }
  if (tabKey === "bg") {
    return (
      <div className="space-y-2">
        {PRO_LOCK}
        <Field label="Type">
          <span className="text-gray-300">solid</span>
        </Field>
        <Field label="Color (hex)">
          <Ltr className="flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-gray-700/60" style={{ backgroundColor: "#f8fafc" }} />
            #f8fafc
          </Ltr>
        </Field>
        <Field label="Dark Value">
          <Ltr className="flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-gray-700/60" style={{ backgroundColor: "#0f172a" }} />
            #0f172a
          </Ltr>
        </Field>
      </div>
    );
  }
  if (tabKey === "typography") {
    return (
      <div className="space-y-2">
        {PRO_LOCK}
        <Field label="Font Family">
          <Ltr>Inter, sans-serif</Ltr>
        </Field>
        <Slider label="Font Weight" value={400} min={300} max={700} />
        <Slider label="Font Size" value={15} min={12} max={18} suffix="px" />
        <Slider label="Line Height" value={1.6} min={1.2} max={2.0} step={0.1} />
      </div>
    );
  }
  if (tabKey === "components") {
    const available = [
      { id: "header", label: "Header" },
      { id: "logo", label: "Logo" },
      { id: "title", label: "Title" },
      { id: "otp-box", label: "OTP Box" },
      { id: "info-block", label: "Information Block" },
      { id: "security-notice", label: "Security Notice" },
      { id: "button", label: "Button" },
      { id: "footer", label: "Footer" },
    ];
    return (
      <div className="space-y-2">
        {PRO_LOCK}
        <div className="grid gap-1.5 sm:grid-cols-2">
          <div className="rounded border border-gray-800/60 bg-gray-950/40 p-1.5">
            <p className="mb-1 text-[8px] uppercase tracking-wider text-gray-400">Available</p>
            <div className="space-y-0.5">
              {available.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-1 text-[9px] text-gray-300">
                  <input type="checkbox" defaultChecked className="h-2 w-2" />
                  <Ltr>{c.label}</Ltr>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded border border-gray-800/60 bg-gray-950/40 p-1.5">
            <p className="mb-1 text-[8px] uppercase tracking-wider text-gray-400">Order</p>
            <div className="space-y-0.5">
              {available.slice(0, 4).map((c, i) => (
                <div key={c.id} className="flex items-center gap-1 text-[9px] text-gray-300">
                  <span className="text-gray-600">{i + 1}.</span>
                  <Ltr>{c.label}</Ltr>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between">
        <label className="text-[9px] text-gray-400">{label}</label>
        <Ltr className="text-[9px] text-gray-300">
          {value}
          {suffix}
        </Ltr>
      </div>
      <div className="relative h-1.5 rounded-full bg-gray-800/60">
        <div
          className="absolute h-full rounded-full bg-emerald-400"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-emerald-500/40 bg-emerald-400"
          style={{ left: `calc(${pct}% - 5px)` }}
        />
      </div>
    </div>
  );
}

/* ─── Preview card ────────────────────────────────────────────────────── */

function PreviewCard({
  copy,
  colors,
  previewMode,
  previewLang,
  previewInbox,
  onMode,
  onLang,
  onInbox,
  highlight,
  prefersReducedMotion,
}: {
  copy: BrandingStageCopy;
  colors: DemoColor;
  previewMode: string;
  previewLang: string;
  previewInbox: string;
  onMode: (m: string) => void;
  onLang: (l: string) => void;
  onInbox: (i: string) => void;
  highlight: boolean;
  prefersReducedMotion: boolean;
}) {
  const inbox = copy.preview.inboxClientOptions.find((i) => i.value === previewInbox);
  const width = inbox?.width ?? 600;
  const isRTL = previewLang === "fa" || previewLang === "ar";
  const dark = previewMode === "dark";

  return (
    <motion.div
      animate={
        highlight && !prefersReducedMotion
          ? { boxShadow: "0 0 0 1px rgba(16,185,129,0.5)" }
          : { boxShadow: "0 0 0 1px rgba(31,41,55,0.6)" }
      }
      transition={{ duration: 0.3 }}
      className={`rounded-lg border bg-gray-950/40 ${
        highlight ? "border-emerald-500/40" : "border-gray-800/60"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800/60 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5">
          <Eye className="h-3 w-3 text-emerald-400" />
          <p className="text-[10px] font-semibold text-gray-100">{copy.preview.title}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-px text-[8px] text-emerald-300">
          <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
          {copy.preview.liveIndicator}
        </span>
      </div>
      <p className="px-2.5 pt-1 text-[8px] text-gray-400">{copy.preview.description}</p>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-1 px-2.5 pt-1.5">
        <SelectMini
          label={copy.preview.modeLabel}
          value={previewMode}
          options={copy.preview.modeOptions}
          onChange={onMode}
        />
        <SelectMini
          label={copy.preview.languageLabel}
          value={previewLang}
          options={copy.preview.languageOptions}
          onChange={onLang}
        />
        <SelectMini
          label={copy.preview.inboxClientLabel}
          value={previewInbox}
          options={copy.preview.inboxClientOptions.map((o) => ({ value: o.value, label: o.label }))}
          onChange={onInbox}
        />
      </div>

      {/* Test button */}
      <div className="px-2.5 pt-1.5">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[9px] font-medium text-white hover:bg-emerald-500"
        >
          <Send className="h-2.5 w-2.5" />
          {copy.preview.testButton}
        </button>
      </div>

      {/* iframe-like preview */}
      <div className="p-2.5">
        <div
          className="mx-auto overflow-hidden rounded-md border border-gray-700/40 bg-white"
          style={{ maxWidth: width / 1.6, height: 180, background: dark ? "#0f172a" : "#ffffff" }}
          dir={isRTL ? "rtl" : "ltr"}
        >
          {/* Email header */}
          <div
            className="px-2 py-1.5 text-center"
            style={{ backgroundColor: colors.primary, color: "#ffffff" }}
          >
            <p className="text-[8px] font-semibold">{copy.preview.previewAppName}</p>
          </div>
          {/* Email body */}
          <div className="p-2" style={{ background: dark ? "#0f172a" : "#f8fafc" }}>
            <p className="text-[8px] font-semibold" style={{ color: dark ? "#f1f5f9" : "#0f172a" }}>
              Verify your email
            </p>
            <p className="mt-0.5 text-[7px]" style={{ color: dark ? "#94a3b8" : "#475569" }}>
              Use the code below to complete verification
            </p>
            {/* OTP code box */}
            <div
              className="mx-auto mt-1.5 rounded border px-2 py-1 text-center"
              style={{
                backgroundColor: dark ? "#1e293b" : "#ffffff",
                borderColor: dark ? "#334155" : "#e2e8f0",
                color: colors.primary,
                fontFamily: "ui-monospace, monospace",
                fontSize: 14,
                letterSpacing: 4,
              }}
            >
              <Ltr>{copy.preview.previewCode}</Ltr>
            </div>
            <p className="mt-1 text-center text-[6px]" style={{ color: dark ? "#64748b" : "#94a3b8" }}>
              © 2026 {copy.preview.previewAppName}
            </p>
          </div>
        </div>
        {/* Caption */}
        <p className="mt-1.5 text-center text-[8px] text-gray-400">
          <Ltr>{copy.preview.widthCaption(inbox?.label ?? previewInbox, width)}</Ltr>
          {isRTL && (
            <span className="ml-1.5 inline-flex rounded bg-amber-500/15 px-1 py-px text-[7px] text-amber-300">
              {copy.preview.rtlCaption}
            </span>
          )}
        </p>
      </div>
    </motion.div>
  );
}

function SelectMini({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div>
      <label className="text-[8px] text-gray-400">{label}</label>
      <div className="relative mt-0.5 h-6 rounded-md border border-gray-700/60 bg-gray-900/60 px-1.5 text-[9px] text-gray-200 flex items-center justify-between">
        <span className="truncate">
          <Ltr>{current?.label ?? value}</Ltr>
        </span>
        <ChevronRight className="h-2 w-2 rotate-90 text-gray-400" />
      </div>
      {/* Hidden native-style dropdown hint for screen readers */}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ─── Save bar ────────────────────────────────────────────────────────── */

function SaveBar({ copy, highlight }: { copy: BrandingStageCopy; highlight: boolean }) {
  return (
    <motion.div
      animate={
        highlight
          ? { boxShadow: "0 0 0 1px rgba(16,185,129,0.4)" }
          : { boxShadow: "0 0 0 1px rgba(31,41,55,0.6)" }
      }
      transition={{ duration: 0.3 }}
      className={`mt-2.5 rounded-lg border bg-gray-950/40 p-2.5 ${
        highlight ? "border-emerald-500/40" : "border-gray-800/60"
      }`}
    >
      <div className="grid gap-1.5 sm:grid-cols-2">
        <Field label={copy.saveBar.templateName}>
          <Ltr>Acme Pro</Ltr>
        </Field>
        <Field label={copy.saveBar.purpose}>
          <Ltr>signup</Ltr>
        </Field>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[9px] font-medium text-white hover:bg-emerald-500"
        >
          <Save className="h-2.5 w-2.5" />
          {copy.saveBar.saveTheme}
        </button>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[9px] ${
            highlight
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-gray-700/60 text-gray-300"
          }`}
        >
          <Lock className="h-2.5 w-2.5" />
          {copy.saveBar.activate}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 px-2.5 py-1 text-[9px] text-rose-300 hover:bg-rose-500/10"
        >
          <Trash2 className="h-2.5 w-2.5" />
          {copy.saveBar.delete}
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Rules card ──────────────────────────────────────────────────────── */

function RulesCard({ copy, prefersReducedMotion }: { copy: BrandingStageCopy; prefersReducedMotion: boolean }) {
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
      className="rounded-lg border border-gray-800/60 bg-gray-950/40 p-2.5"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Crown className="h-3 w-3 text-amber-400" />
          <p className="text-[10px] font-semibold text-gray-100">{copy.rules.title}</p>
        </div>
        <span className="inline-flex rounded bg-amber-500/15 px-1.5 py-px text-[8px] font-medium text-amber-300">
          {copy.rules.proPlusBadge}
        </span>
      </div>
      <table className="w-full text-[9px]">
        <thead>
          <tr className="border-b border-gray-800/60 text-left text-gray-400">
            <th className="px-1 py-1 font-medium">{copy.rules.purposeHeader}</th>
            <th className="px-1 py-1 font-medium">{copy.rules.activeThemeHeader}</th>
            <th className="px-1 py-1 font-medium">{copy.rules.statusHeader}</th>
          </tr>
        </thead>
        <tbody>
          {copy.savedThemesList.map((t) => (
            <tr key={t.id} className="border-b border-gray-800/40 last:border-0">
              <td className="px-1 py-1.5">
                <Ltr className="font-mono text-gray-300">{t.purpose}</Ltr>
              </td>
              <td className="px-1 py-1.5">
                <Ltr className="text-gray-200">{t.name}</Ltr>
              </td>
              <td className="px-1 py-1.5">
                <span
                  className={`inline-flex rounded px-1.5 py-px text-[8px] ${
                    t.isActive
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-gray-700/40 text-gray-300"
                  }`}
                >
                  {t.isActive ? copy.rules.statusActive : copy.rules.statusDraft}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1.5 flex justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[9px] font-medium text-white hover:bg-emerald-500"
        >
          <Save className="h-2.5 w-2.5" />
          {copy.rules.saveRules}
        </button>
      </div>
    </motion.div>
  );
}

/* ─── Multi-Language + Inbox Preview cards ────────────────────────────── */

function MultiLanguageCard({ copy }: { copy: BrandingStageCopy }) {
  return (
    <div className="rounded-lg border border-gray-800/60 bg-gray-950/40 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Mail className="h-3 w-3 text-emerald-400" />
        <p className="text-[10px] font-semibold text-gray-100">{copy.multiLanguage.title}</p>
      </div>
      <p className="mb-1.5 text-[8px] text-gray-400">{copy.multiLanguage.description}</p>
      <div className="flex flex-wrap gap-1">
        {copy.preview.languageOptions.map((opt, i) => {
          const isRTL = opt.value === "fa" || opt.value === "ar";
          return (
            <span
              key={opt.value}
              className="inline-flex items-center gap-1 rounded border border-gray-700/60 bg-gray-900/60 px-1.5 py-0.5 text-[8px] text-gray-300"
            >
              <Ltr>{opt.label}</Ltr>
              {isRTL && (
                <span className="rounded bg-amber-500/15 px-1 py-px text-[7px] text-amber-300">
                  {copy.multiLanguage.rtlTag}
                </span>
              )}
              {i === 0 && <span className="text-gray-600">·</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function InboxPreviewCard({ copy }: { copy: BrandingStageCopy }) {
  return (
    <div className="rounded-lg border border-gray-800/60 bg-gray-950/40 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Eye className="h-3 w-3 text-emerald-400" />
        <p className="text-[10px] font-semibold text-gray-100">{copy.inboxPreview.title}</p>
      </div>
      <p className="mb-1.5 text-[8px] text-gray-400">{copy.inboxPreview.description}</p>
      <div className="flex flex-wrap gap-1">
        {copy.preview.inboxClientOptions.map((opt) => (
          <span
            key={opt.value}
            className="inline-flex items-center gap-1 rounded border border-gray-700/60 bg-gray-900/60 px-1.5 py-0.5 text-[8px] text-gray-300"
          >
            <Ltr>{opt.label}</Ltr>
            <Ltr className="text-gray-400">{opt.width}px</Ltr>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Saved Themes card ───────────────────────────────────────────────── */

function SavedThemesCard({
  copy,
  highlight,
  prefersReducedMotion,
}: {
  copy: BrandingStageCopy;
  highlight: boolean;
  prefersReducedMotion: boolean;
}) {
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.3 }}
      className={`rounded-lg border bg-gray-950/40 p-2.5 ${
        highlight ? "border-emerald-500/40" : "border-gray-800/60"
      }`}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <Save className="h-3 w-3 text-emerald-400" />
        <p className="text-[10px] font-semibold text-gray-100">{copy.savedThemes.title}</p>
      </div>
      <p className="mb-1.5 text-[8px] text-gray-400">
        {copy.savedThemes.description(copy.savedThemesList.length)}
      </p>
      <table className="w-full text-[9px]">
        <thead>
          <tr className="border-b border-gray-800/60 text-left text-gray-400">
            <th className="px-1 py-1 font-medium">{copy.savedThemes.nameHeader}</th>
            <th className="px-1 py-1 font-medium">{copy.savedThemes.templateHeader}</th>
            <th className="px-1 py-1 font-medium">{copy.savedThemes.purposeHeader}</th>
            <th className="px-1 py-1 font-medium">{copy.savedThemes.statusHeader}</th>
            <th className="px-1 py-1 text-right font-medium">{copy.savedThemes.actionsHeader}</th>
          </tr>
        </thead>
        <tbody>
          {copy.savedThemesList.map((t) => (
            <tr key={t.id} className="border-b border-gray-800/40 last:border-0">
              <td className="px-1 py-1.5">
                <div className="flex items-center gap-1">
                  <Ltr className="font-medium text-gray-200">{t.name}</Ltr>
                  {t.isPro && (
                    <span className="inline-flex rounded bg-amber-500/15 px-1 py-px text-[7px] text-amber-300">
                      {copy.savedThemes.proBadge}
                    </span>
                  )}
                  {t.isSystem && (
                    <span className="inline-flex rounded bg-gray-700/40 px-1 py-px text-[7px] text-gray-300">
                      {copy.savedThemes.systemBadge}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-1 py-1.5">
                <Ltr className="font-mono text-gray-300">{t.templateId}</Ltr>
              </td>
              <td className="px-1 py-1.5">
                <Ltr className="font-mono text-gray-300">{t.purpose}</Ltr>
              </td>
              <td className="px-1 py-1.5">
                <span
                  className={`inline-flex rounded px-1.5 py-px text-[7px] ${
                    t.isActive
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-gray-700/40 text-gray-300"
                  }`}
                >
                  {t.isActive ? copy.savedThemes.activeBadge : copy.savedThemes.inactiveBadge}
                </span>
              </td>
              <td className="px-1 py-1.5 text-right">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="rounded px-1 py-0.5 text-[8px] text-gray-300 hover:bg-gray-800/40"
                  >
                    {copy.savedThemes.edit}
                  </button>
                  <button
                    type="button"
                    className={`rounded border px-1 py-0.5 text-[8px] ${
                      highlight && !t.isActive
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border-gray-700/60 text-gray-300"
                    } ${t.isActive ? "opacity-40" : ""}`}
                  >
                    {copy.savedThemes.activate}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}
