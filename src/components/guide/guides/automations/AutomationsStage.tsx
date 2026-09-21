"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Zap, MailCheck, CheckCircle2, AlertTriangle, CircleSlash,
  Variable, Clock, FileText, Loader2, ChevronDown,
} from "lucide-react";
import { Ltr } from "@/lib/i18n/Ltr";
import type { SceneRenderContext } from "../../CinematicWalkthrough";
import type {
  AutomationsStageCopy,
  AutomationsStageTemplate,
} from "@/lib/guide/content/guides/automations-types";

/**
 * AutomationsStage — the simulated Automations page for the
 * /guide/automations cinematic walkthrough.
 *
 * Mirrors the ACTUAL Nixify Automations product:
 *   - src/app/dashboard/automations/page.tsx  (single-card Automations page)
 *
 * Visual states (driven by the active `scene` key):
 *   - automationOverview  — full page: header + single Card with toggle,
 *                           status strip, template selector, variables grid,
 *                           compatibility indicator, help footer.
 *   - toggleSwitch        — Switch in the Card header is being flipped; the
 *                           hint cycles between "Saving…" and "Auto-saves".
 *   - selectTemplate      — the template Select is open showing the dropdown
 *                           (— No template —, separator, three templates);
 *                           one item is highlighted as hovered.
 *   - autoSave            — the Switch / Select are mid-save: hint reads
 *                           "Saving…", a spinner shows on the template row.
 *   - activeState         — the automation reaches emerald "Active" state:
 *                           Switch on, template selected, compatibility
 *                           emerald, status strip shows the "Active" badge.
 *
 * Localization contract (REGRESSION-PROTECTED):
 *   - The stage is NOT permanently `dir="ltr"`. The `dir` comes from the
 *     resolved stage copy (stage.dir), which mirrors the active product
 *     locale (ltr for en, rtl for fa).
 *   - All human-facing labels (header, card title, toggle, status strip,
 *     template selector, variable sections, compatibility alerts, help
 *     footer) come from the stage copy.
 *   - Technical tokens (automation type "otp-verified-welcome", template
 *     slugs, version strings, {{var}} placeholders, ISO timestamps, method
 *     names like POST /api/...) stay LTR via <Ltr>.
 *
 * Safety contract (REGRESSION-PROTECTED):
 *   - NO real `fetch()` calls anywhere in this file.
 *   - NO real database writes.
 *   - NO real automation mutation.
 *   - All state is local demo state (this component owns its own seeded data).
 *   - No quota consumption.
 */

/* ─── Demo state (mirrors the real AutomationSetting shape) ─────────────── */

interface DemoSetting {
  enabled: boolean;
  templateId: number | null;
  savingEnabled: boolean;
  savingTemplate: boolean;
}

const DEFAULT_SETTING: DemoSetting = {
  enabled: false,
  templateId: null,
  savingEnabled: false,
  savingTemplate: false,
};

/**
 * The stage receives the active scene key + the typing-animation payload from
 * the CinematicWalkthrough shell, plus the resolved stage copy. The stage is
 * responsible for rendering the right simulated UI fragment for that scene in
 * the active locale.
 *
 * All UI state is DERIVED from the active `ctx.scene` directly where possible.
 * Local interactive state (toggle, template selection) is owned by the stage
 * but seeded from the scene — so the walkthrough player stays in sync.
 */
export function AutomationsStage(
  ctx: SceneRenderContext & { copy: AutomationsStageCopy },
): React.ReactNode {
  const copy = ctx.copy;
  const dir = copy.dir;

  // DERIVED state: the active scene drives whether the automation is enabled,
  // which template is selected, and which "Saving…" indicators are showing.
  // The user can also interact (toggle / pick template) to explore — local
  // state overrides the scene-derived defaults.
  const sceneSetting = deriveSettingFromScene(ctx.scene);
  const [override, setOverride] = React.useState<Partial<DemoSetting>>({});

  const setting: DemoSetting = { ...sceneSetting, ...override };

  const handleToggle = () => {
    setOverride((o) => ({
      ...o,
      enabled: !setting.enabled,
      savingEnabled: true,
    }));
    // Simulate the PUT round-trip. After 900ms, clear the saving flag.
    window.setTimeout(() => {
      setOverride((o) => ({ ...o, savingEnabled: false }));
    }, 900);
  };

  const handleSelectTemplate = (id: number | null) => {
    setOverride((o) => ({
      ...o,
      templateId: id,
      savingTemplate: true,
    }));
    window.setTimeout(() => {
      setOverride((o) => ({ ...o, savingTemplate: false }));
    }, 900);
  };

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
          <AutomationsSurface
            copy={copy}
            scene={ctx.scene}
            setting={setting}
            onToggle={handleToggle}
            onSelectTemplate={handleSelectTemplate}
            prefersReducedMotion={ctx.prefersReducedMotion}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Derive the simulated AutomationSetting from the active scene.
 *
 * The walkthrough player controls which scene is active; we derive the demo
 * state so the visual story matches the captions without manual sync.
 */
function deriveSettingFromScene(scene: string): DemoSetting {
  switch (scene) {
    case "automationOverview":
      return { ...DEFAULT_SETTING, enabled: false, templateId: null };
    case "toggleSwitch":
      // Mid-toggle: enabled just flipped on, PUT is in flight.
      return { ...DEFAULT_SETTING, enabled: true, savingEnabled: true, templateId: null };
    case "selectTemplate":
      // Select is open — no template selected yet, but enabled.
      return { ...DEFAULT_SETTING, enabled: true, templateId: null };
    case "autoSave":
      // Template was just picked — PUT is in flight, template row shows spinner.
      return { ...DEFAULT_SETTING, enabled: true, templateId: 1, savingTemplate: true };
    case "activeState":
      // Fully active: enabled + template 1 (compatible) + no pending saves.
      return { ...DEFAULT_SETTING, enabled: true, templateId: 1 };
    default:
      return { ...DEFAULT_SETTING };
  }
}

/* ─── Surface ──────────────────────────────────────────────────────────── */

interface AutomationsSurfaceProps {
  copy: AutomationsStageCopy;
  scene: string;
  setting: DemoSetting;
  onToggle: () => void;
  onSelectTemplate: (id: number | null) => void;
  prefersReducedMotion: boolean;
}

function AutomationsSurface({
  copy,
  scene,
  setting,
  onToggle,
  onSelectTemplate,
  prefersReducedMotion,
}: AutomationsSurfaceProps) {
  const selectedTemplate: AutomationsStageTemplate | null = setting.templateId
    ? copy.templates.find((t) => t.id === setting.templateId) ?? null
    : null;

  const hasTemplate = !!selectedTemplate;
  const isCompatible = selectedTemplate?.compatible ?? null;
  const canFire = setting.enabled && hasTemplate && isCompatible === true;

  // Status strip badge derivation (mirrors the real page's canFire logic).
  const status: StatusKind = canFire
    ? "active"
    : setting.enabled && !hasTemplate
      ? "enabledNoTemplate"
      : setting.enabled && isCompatible === false
        ? "enabledIncompatible"
        : "paused";

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex items-center gap-2 border-b border-gray-800/60 px-3 py-2">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-gray-800/40"
        >
          <ArrowLeft className="h-3 w-3" />
          {copy.header.backToDashboard}
        </button>
        <span className="text-gray-700">·</span>
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
          <Zap className="h-3 w-3" />
        </span>
        <p className="text-xs font-semibold text-gray-100">{copy.header.title}</p>
        <span className="hidden text-[9px] text-gray-500 sm:inline">{copy.header.subtitle}</span>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        {/* Single automation card */}
        <AutomationCard
          copy={copy}
          scene={scene}
          setting={setting}
          status={status}
          selectedTemplate={selectedTemplate}
          hasTemplate={hasTemplate}
          isCompatible={isCompatible}
          canFire={canFire}
          onToggle={onToggle}
          onSelectTemplate={onSelectTemplate}
          prefersReducedMotion={prefersReducedMotion}
        />

        {/* Help footer */}
        <p className="mt-3 text-[9px] text-gray-500">
          {copy.helpFooter.prompt}{" "}
          <span className="text-emerald-400 underline-offset-2 hover:underline">
            {copy.helpFooter.browseLink}
          </span>
        </p>
      </div>
    </div>
  );
}

type StatusKind =
  | "active"
  | "enabledNoTemplate"
  | "enabledIncompatible"
  | "paused";

/* ─── Automation Card ──────────────────────────────────────────────────── */

interface AutomationCardProps {
  copy: AutomationsStageCopy;
  scene: string;
  setting: DemoSetting;
  status: StatusKind;
  selectedTemplate: AutomationsStageTemplate | null;
  hasTemplate: boolean;
  isCompatible: boolean | null;
  canFire: boolean;
  onToggle: () => void;
  onSelectTemplate: (id: number | null) => void;
  prefersReducedMotion: boolean;
}

function AutomationCard({
  copy,
  scene,
  setting,
  status,
  selectedTemplate,
  hasTemplate,
  isCompatible,
  canFire,
  onToggle,
  onSelectTemplate,
  prefersReducedMotion,
}: AutomationCardProps) {
  return (
    <div
      className={`overflow-hidden rounded-lg border bg-gray-950/40 ${
        scene === "automationOverview" ? "border-gray-800/60" : "border-emerald-500/30"
      }`}
    >
      {/* Card header (border-b) */}
      <div className="border-b border-gray-800/60 p-2.5">
        <div className="flex items-start justify-between gap-2">
          {/* Left: MailCheck tile + title + description */}
          <div className="flex items-start gap-2">
            <motion.div
              animate={
                scene === "activeState" && !prefersReducedMotion
                  ? { boxShadow: "0 0 0 1px rgba(16,185,129,0.5)" }
                  : { boxShadow: "0 0 0 1px rgba(31,41,55,0.4)" }
              }
              transition={{ duration: 0.3 }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10"
            >
              <MailCheck className="h-3.5 w-3.5 text-emerald-500" />
            </motion.div>
            <div>
              <p className="text-[11px] font-semibold text-gray-100">{copy.card.title}</p>
              <p className="mt-0.5 max-w-md text-[9px] text-gray-400">{copy.card.description}</p>
              <p className="mt-1 text-[8px] text-gray-600">
                <span className="text-gray-500">type:</span>{" "}
                <Ltr className="font-mono text-emerald-300/80">{copy.card.type}</Ltr>
              </p>
            </div>
          </div>

          {/* Right: Enabled/Disabled + hint + Switch */}
          <ToggleBox
            copy={copy}
            enabled={setting.enabled}
            saving={setting.savingEnabled}
            highlight={scene === "toggleSwitch" || scene === "autoSave"}
            onToggle={onToggle}
            prefersReducedMotion={prefersReducedMotion}
          />
        </div>

        {/* Status strip */}
        <StatusStrip copy={copy} status={status} scene={scene} prefersReducedMotion={prefersReducedMotion} />
      </div>

      {/* Card content */}
      <div className="grid gap-3 p-2.5 pt-3">
        {/* Template selector */}
        <TemplateSelector
          copy={copy}
          scene={scene}
          setting={setting}
          selectedTemplate={selectedTemplate}
          hasTemplate={hasTemplate}
          onSelectTemplate={onSelectTemplate}
          prefersReducedMotion={prefersReducedMotion}
        />

        {/* Variables grid (2 columns) */}
        <div className="grid gap-2 sm:grid-cols-2">
          <BuiltInVariablesCard copy={copy} />
          <TemplateRequiredVariablesCard
            copy={copy}
            selectedTemplate={selectedTemplate}
            hasTemplate={hasTemplate}
          />
        </div>

        {/* Compatibility indicator */}
        <CompatibilityIndicator
          copy={copy}
          hasTemplate={hasTemplate}
          isCompatible={isCompatible}
          enabled={setting.enabled}
          selectedTemplate={selectedTemplate}
        />
      </div>
    </div>
  );
}

/* ─── Toggle box ───────────────────────────────────────────────────────── */

function ToggleBox({
  copy,
  enabled,
  saving,
  highlight,
  onToggle,
  prefersReducedMotion,
}: {
  copy: AutomationsStageCopy;
  enabled: boolean;
  saving: boolean;
  highlight: boolean;
  onToggle: () => void;
  prefersReducedMotion: boolean;
}) {
  return (
    <motion.div
      animate={
        highlight && !prefersReducedMotion
          ? { boxShadow: "0 0 0 1px rgba(16,185,129,0.5)" }
          : { boxShadow: "0 0 0 1px rgba(31,41,55,0.4)" }
      }
      transition={{ duration: 0.3 }}
      className={`flex items-center gap-2 self-start rounded-lg border bg-gray-900/40 px-2 py-1.5 ${
        highlight ? "border-emerald-500/40" : "border-gray-700/60"
      }`}
    >
      <div className="flex flex-col">
        <span
          className={`text-[9px] font-medium ${
            enabled ? "text-emerald-400" : "text-gray-400"
          }`}
        >
          {enabled ? copy.toggle.enabled : copy.toggle.disabled}
        </span>
        <span className="text-[8px] text-gray-500">
          {saving ? copy.toggle.saving : copy.toggle.autoSaves}
        </span>
      </div>
      {/* Switch (custom, accessible) */}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
          enabled ? "bg-emerald-600" : "bg-gray-700"
        }`}
      >
        <motion.span
          layout
          className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow"
          animate={{ left: enabled ? "calc(100% - 14px)" : "2px" }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
        />
      </button>
    </motion.div>
  );
}

/* ─── Status strip ────────────────────────────────────────────────────── */

function StatusStrip({
  copy,
  status,
  scene,
  prefersReducedMotion,
}: {
  copy: AutomationsStageCopy;
  status: StatusKind;
  scene: string;
  prefersReducedMotion: boolean;
}) {
  const badge = STATUS_BADGE[status];
  const Icon = badge.icon;
  const isHighlight = scene === "activeState" && status === "active";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-0.5">
      <motion.span
        animate={
          isHighlight && !prefersReducedMotion
            ? { scale: [1, 1.04, 1] }
            : { scale: 1 }
        }
        transition={{ duration: 0.5 }}
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${badge.cls}`}
      >
        <Icon className="h-2.5 w-2.5" />
        {copy.statusStrip[status]}
      </motion.span>

      <span className="ml-auto inline-flex items-center gap-1 text-[8px] text-gray-500">
        <Clock className="h-2.5 w-2.5" />
        {copy.statusStrip.updated}{" "}
        <Ltr>{copy.statusStrip.updatedAtRelative}</Ltr>
      </span>
    </div>
  );
}

const STATUS_BADGE: Record<
  StatusKind,
  { icon: typeof CheckCircle2; cls: string }
> = {
  active: {
    icon: CheckCircle2,
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  enabledNoTemplate: {
    icon: AlertTriangle,
    cls: "border-amber-500/40 text-amber-500",
  },
  enabledIncompatible: {
    icon: AlertTriangle,
    cls: "border-amber-500/40 text-amber-500",
  },
  paused: {
    icon: CircleSlash,
    cls: "border-gray-700/60 text-gray-500",
  },
};

/* ─── Template selector ───────────────────────────────────────────────── */

function TemplateSelector({
  copy,
  scene,
  setting,
  selectedTemplate,
  hasTemplate,
  onSelectTemplate,
  prefersReducedMotion,
}: {
  copy: AutomationsStageCopy;
  scene: string;
  setting: DemoSetting;
  selectedTemplate: AutomationsStageTemplate | null;
  hasTemplate: boolean;
  onSelectTemplate: (id: number | null) => void;
  prefersReducedMotion: boolean;
}) {
  // NOTE: The parent <motion.div key={ctx.scene}> in AutomationsStage remounts
  // this component on every scene change, so useState's initial value below is
  // re-evaluated each time the scene changes. We deliberately avoid a useEffect
  // to sync `open` to the scene (setState-in-effect triggers cascading renders).
  const [open, setOpen] = React.useState<boolean>(scene === "selectTemplate");

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-medium text-gray-200">
          {copy.templateSelector.label}
        </label>
        {setting.savingTemplate && (
          <span className="inline-flex items-center gap-1 text-[8px] text-gray-400">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            {copy.templateSelector.saving}
          </span>
        )}
      </div>

      {/* Select-like custom dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex w-full items-center justify-between rounded-md border bg-gray-950/60 px-2 py-1.5 text-left text-[10px] transition ${
            open
              ? "border-emerald-500/40 ring-1 ring-emerald-500/20"
              : "border-gray-700/60 hover:border-gray-600"
          }`}
        >
          <span className={hasTemplate ? "text-gray-100" : "text-gray-500"}>
            {hasTemplate ? (
              <span className="flex flex-col">
                <span className="font-medium">{selectedTemplate!.name}</span>
                <span className="text-[8px] text-gray-500">
                  <Ltr className="font-mono">{selectedTemplate!.slug}</Ltr>
                </span>
              </span>
            ) : (
              copy.templateSelector.selectPlaceholder
            )}
          </span>
          <ChevronDown
            className={`h-3 w-3 shrink-0 text-gray-500 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.15 }}
              className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-gray-700/60 bg-gray-950/95 shadow-lg backdrop-blur"
            >
              {/* No template item */}
              <button
                type="button"
                onClick={() => {
                  onSelectTemplate(null);
                  setOpen(false);
                }}
                className="block w-full px-2 py-1 text-left text-[10px] text-gray-400 hover:bg-gray-800/40"
              >
                {copy.templateSelector.noTemplateItem}
              </button>

              <div className="my-0.5 h-px bg-gray-800/60" />

              {/* Templates */}
              {copy.templates.length === 0 ? (
                <div className="px-2 py-1.5 text-[9px] text-gray-500">
                  {copy.templateSelector.noTemplatesHint}{" "}
                  <span className="text-emerald-400">
                    {copy.templateSelector.createOneLink}
                  </span>
                </div>
              ) : (
                copy.templates.map((tpl, i) => {
                  const isActive = setting.templateId === tpl.id;
                  const isHovered = scene === "selectTemplate" && i === 0;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        onSelectTemplate(tpl.id);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-2 py-1 text-left transition ${
                        isActive
                          ? "bg-emerald-500/10 text-emerald-200"
                          : isHovered
                            ? "bg-gray-800/60 text-gray-100"
                            : "text-gray-200 hover:bg-gray-800/40"
                      }`}
                    >
                      <span className="flex flex-col">
                        <span className="font-medium">{tpl.name}</span>
                        <span className="text-[8px] text-gray-500">
                          <Ltr className="font-mono">{tpl.slug}</Ltr>
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        {tpl.compatible ? (
                          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-px text-[7px] text-emerald-300">
                            ok
                          </span>
                        ) : (
                          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-px text-[7px] text-amber-400">
                            !
                          </span>
                        )}
                        {isActive && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />}
                      </span>
                    </button>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Selected template line */}
      {hasTemplate && selectedTemplate && (
        <p className="inline-flex items-center gap-1 text-[9px] text-gray-400">
          <FileText className="h-2.5 w-2.5" />
          <Ltr>{copy.templateSelector.usingTemplate(selectedTemplate.name, selectedTemplate.currentVersion)}</Ltr>
        </p>
      )}
    </div>
  );
}

/* ─── Variables cards (2-column grid) ──────────────────────────────────── */

function BuiltInVariablesCard({ copy }: { copy: AutomationsStageCopy }) {
  return (
    <div className="rounded-lg border border-gray-800/60 bg-gray-950/40 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Variable className="h-3 w-3 text-emerald-500" />
        <p className="text-[10px] font-medium text-gray-200">{copy.variables.builtInTitle}</p>
      </div>
      <p className="mb-2 text-[8px] text-gray-500">{copy.variables.builtInDesc}</p>
      <div className="flex flex-wrap gap-1">
        {copy.builtInVariables.map((v) => (
          <span
            key={v}
            className="inline-flex items-center rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] text-emerald-400"
          >
            <Ltr className="font-mono">{`{{${v}}}`}</Ltr>
          </span>
        ))}
      </div>
    </div>
  );
}

function TemplateRequiredVariablesCard({
  copy,
  selectedTemplate,
  hasTemplate,
}: {
  copy: AutomationsStageCopy;
  selectedTemplate: AutomationsStageTemplate | null;
  hasTemplate: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-800/60 bg-gray-950/40 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <FileText className="h-3 w-3 text-gray-400" />
        <p className="text-[10px] font-medium text-gray-200">{copy.variables.templateRequiredTitle}</p>
      </div>
      {hasTemplate && selectedTemplate && selectedTemplate.requiredVariables.length > 0 ? (
        <>
          <p className="mb-2 text-[8px] text-gray-500">{copy.variables.templateRequiredDesc}</p>
          <div className="flex flex-wrap gap-1">
            {selectedTemplate.requiredVariables.map((v) => {
              const provided = copy.builtInVariables.includes(v);
              return (
                <span
                  key={v}
                  className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[8px] ${
                    provided
                      ? "border-emerald-500/30 text-emerald-400"
                      : "border-rose-500/40 text-rose-400"
                  }`}
                >
                  <Ltr className="font-mono">{`{{${v}}}`}</Ltr>
                  {provided && <CheckCircle2 className="h-2 w-2" />}
                </span>
              );
            })}
          </div>
        </>
      ) : hasTemplate ? (
        <p className="text-[8px] text-gray-500">{copy.variables.templateNoVariables}</p>
      ) : (
        <p className="text-[8px] text-gray-500">{copy.variables.selectTemplatePrompt}</p>
      )}
    </div>
  );
}

/* ─── Compatibility indicator ──────────────────────────────────────────── */

function CompatibilityIndicator({
  copy,
  hasTemplate,
  isCompatible,
  enabled,
  selectedTemplate,
}: {
  copy: AutomationsStageCopy;
  hasTemplate: boolean;
  isCompatible: boolean | null;
  enabled: boolean;
  selectedTemplate: AutomationsStageTemplate | null;
}) {
  // Variant: no template selected (muted)
  if (!hasTemplate || isCompatible === null) {
    return (
      <Alert tone="muted" icon={CircleSlash} title={copy.compatibility.noTemplateTitle}>
        <p className="text-[9px] text-gray-400">{copy.compatibility.noTemplateDesc}</p>
      </Alert>
    );
  }

  // Variant: compatible (emerald)
  if (isCompatible === true) {
    return (
      <Alert tone="emerald" icon={CheckCircle2} title={copy.compatibility.compatibleTitle}>
        <p className="text-[9px] text-gray-300">
          {copy.compatibility.compatibleDesc}
        </p>
        <p className="mt-1 text-[8px] text-emerald-300/70">
          {enabled
            ? copy.toggle.enabled
            : copy.toggle.disabled}
        </p>
      </Alert>
    );
  }

  // Variant: incompatible (amber, lists missing vars)
  const missingVars =
    selectedTemplate?.requiredVariables.filter(
      (v) => !copy.builtInVariables.includes(v),
    ) ?? [];

  return (
    <Alert tone="amber" icon={AlertTriangle} title={copy.compatibility.incompatibleTitle}>
      <p className="text-[9px] text-gray-400">{copy.compatibility.incompatibleDesc}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {missingVars.map((v) => (
          <span
            key={v}
            className="inline-flex rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[8px] text-amber-400"
          >
            <Ltr className="font-mono">{`{{${v}}}`}</Ltr>
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[8px] text-amber-500/80">
        {enabled ? copy.compatibility.failAtSendTime : copy.compatibility.notFireWhenEnabled}.
      </p>
    </Alert>
  );
}

/* ─── Alert helper ─────────────────────────────────────────────────────── */

function Alert({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: "muted" | "emerald" | "amber";
  icon: typeof CheckCircle2;
  title: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
      : tone === "amber"
        ? "border-amber-500/40 bg-amber-500/5 text-amber-500"
        : "border-gray-700/60 bg-gray-900/40 text-gray-400";

  const iconCls =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "amber"
        ? "text-amber-500"
        : "text-gray-400";

  return (
    <div className={`rounded-lg border p-2.5 ${cls}`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${iconCls}`} />
        <p className="text-[10px] font-semibold">{title}</p>
      </div>
      <div className="mt-1 pl-4">{children}</div>
    </div>
  );
}
