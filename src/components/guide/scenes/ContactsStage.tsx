"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Search, MoreHorizontal, Trash2, Pencil,
  ChevronLeft, ChevronRight, ArrowLeft, Mail, Tag, Clock,
  BellRing, BellOff, ShieldAlert, ShieldOff,
} from "lucide-react";
import { Ltr } from "@/lib/i18n/Ltr";
import type { SceneRenderContext } from "../CinematicWalkthrough";

/**
 * ContactsStage — the real simulated Contacts UI for the /guide/contacts
 * cinematic walkthrough.
 *
 * Mirrors the ACTUAL Nixify Contacts product:
 *   - src/app/dashboard/contacts/page.tsx       (list page)
 *   - src/app/dashboard/contacts/[id]/page.tsx (detail page)
 *
 * Visual states (driven by the active `scene` key):
 *   - contactsOverview   — list with header + search + table + pagination
 *   - addContact         — list with the create-contact dialog overlay open
 *   - searchFilter       — list with the search box focused + typed text
 *   - actionsMenu        — list with one row's actions dropdown open
 *   - contactDetail      — detail page layout (avatar, email, source,
 *                          consent card, timeline)
 *   - consentActions     — detail page with the consent actions row
 *                          highlighted (Subscribe / Unsubscribe / Suppress / Lift)
 *
 * Safety contract (REGRESSION-PROTECTED):
 *   - NO real `fetch()` calls anywhere in this file.
 *   - NO real database writes.
 *   - NO real contact mutation.
 *   - All state is local demo state (this component owns its own seeded data).
 *   - No quota consumption.
 *
 * This component is purely visual — it exists to teach. The "Add Contact"
 * button visibly opens the create dialog but never persists anything; the
 * "Delete" item visibly closes the row but never sends a DELETE request.
 */

interface DemoContact {
  id: number;
  email: string;
  name: string | null;
  source: "api" | "dashboard" | "otp_verified" | "import";
  marketing_status: "subscribed" | "unsubscribed" | "unknown";
  suppressed: boolean;
  created_at: string;
  updated_at: string;
}

const SEED_CONTACTS: DemoContact[] = [
  {
    id: 1,
    email: "sara@example.com",
    name: "Sara Ahmadi",
    source: "dashboard",
    marketing_status: "subscribed",
    suppressed: false,
    created_at: "2026-08-12T09:14:00Z",
    updated_at: "2026-09-18T13:42:00Z",
  },
  {
    id: 2,
    email: "reza@mail.io",
    name: "Reza Karimi",
    source: "api",
    marketing_status: "subscribed",
    suppressed: false,
    created_at: "2026-08-20T11:02:00Z",
    updated_at: "2026-09-15T08:20:00Z",
  },
  {
    id: 3,
    email: "ming@nostarch.io",
    name: null,
    source: "otp_verified",
    marketing_status: "unknown",
    suppressed: false,
    created_at: "2026-09-01T14:33:00Z",
    updated_at: "2026-09-01T14:33:00Z",
  },
  {
    id: 4,
    email: "jules@bandwidth.dev",
    name: "Jules N.",
    source: "import",
    marketing_status: "unsubscribed",
    suppressed: true,
    created_at: "2026-09-10T16:00:00Z",
    updated_at: "2026-09-19T10:11:00Z",
  },
];

const SOURCE_LABELS: Record<DemoContact["source"], string> = {
  api: "API",
  dashboard: "Dashboard",
  otp_verified: "OTP Verified",
  import: "Import",
};

/**
 * The stage receives the active scene key + the typing-animation payload from
 * the CinematicWalkthrough shell. The stage is responsible for rendering the
 * right simulated UI fragment for that scene.
 *
 * All UI state is DERIVED from the active `ctx.scene` and `ctx.typedText`
 * directly — no useEffect, no mirrored state, no cascading renders. The user
 * never controls the scene from inside the stage (the walkthrough player's
 * Next/Prev controls do that), so derived state is the correct model.
 */
export function ContactsStage(ctx: SceneRenderContext): React.ReactNode {
  // Demo-only local state. NEVER persists, NEVER triggers a network request.
  const contacts = SEED_CONTACTS;

  // Derive stage UI purely from the active scene key. This keeps the stage
  // in sync with the walkthrough player and avoids setState-in-effect.
  const dialogOpen = ctx.scene === "addContact";
  const actionsOpenFor = ctx.scene === "actionsMenu" ? 2 : null;
  const searchValue = ctx.scene === "searchFilter" ? ctx.typedText : "";
  const showDetail = ctx.scene === "contactDetail" || ctx.scene === "consentActions";
  // The active row is the one the user "opens" via the contactDetail /
  // consentActions scenes. Otherwise we visually highlight row 2 so the
  // overview shot has a clear focal point.
  const activeRowId: number = showDetail ? 1 : 2;
  // Local interactive override: clicking a different row in the list scene
  // updates the highlight, but doesn't change the walkthrough scene.
  const [rowHighlightOverride, setRowHighlightOverride] = React.useState<number | null>(null);
  const effectiveRowId = rowHighlightOverride ?? activeRowId;
  const activeContact = contacts.find((c) => c.id === effectiveRowId) ?? contacts[0];

  return (
    <div className="h-full w-full overflow-hidden bg-[#0A0F0D] text-gray-200" dir="ltr">
      {/* The stage ALWAYS renders the contacts surface; the detail page is
          shown as an overlay/transition when the scene requires it. */}
      <AnimatePresence mode="wait">
        {showDetail ? (
          <motion.div
            key="detail"
            initial={ctx.prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={ctx.prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
            transition={{ duration: ctx.prefersReducedMotion ? 0.1 : 0.35 }}
            className="h-full"
          >
            <DetailSurface
              contact={activeContact}
              highlightConsent={ctx.scene === "consentActions"}
              prefersReducedMotion={ctx.prefersReducedMotion}
            />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={ctx.prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={ctx.prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
            transition={{ duration: ctx.prefersReducedMotion ? 0.1 : 0.35 }}
            className="h-full"
          >
            <ListSurface
              contacts={contacts}
              searchValue={searchValue}
              dialogOpen={dialogOpen}
              actionsOpenFor={actionsOpenFor}
              activeRowId={effectiveRowId}
              onRowClick={(id) => setRowHighlightOverride(id)}
              onCloseDialog={() => {
                /* dialog open state is driven by the scene; no-op */
              }}
              prefersReducedMotion={ctx.prefersReducedMotion}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── LIST SURFACE ────────────────────────────────────────────────────────── */

interface ListSurfaceProps {
  contacts: DemoContact[];
  searchValue: string;
  dialogOpen: boolean;
  actionsOpenFor: number | null;
  activeRowId: number | null;
  onRowClick: (id: number) => void;
  onCloseDialog: () => void;
  prefersReducedMotion: boolean;
}

function ListSurface({
  contacts,
  searchValue,
  dialogOpen,
  actionsOpenFor,
  activeRowId,
  onRowClick,
  onCloseDialog,
  prefersReducedMotion,
}: ListSurfaceProps) {
  // Apply the live search filter visually (just for the stage — no API).
  const filtered = React.useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        (c.name?.toLowerCase().includes(q) ?? false),
    );
  }, [contacts, searchValue]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <Users className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-100">Contacts</p>
            <p className="text-[10px] text-gray-500">Manage your account contacts</p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-medium text-white"
          aria-label="Add Contact"
        >
          <Plus className="h-3 w-3" />
          Add Contact
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-4 py-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-500" />
          <div className="h-7 w-full rounded-md border border-gray-700/60 bg-gray-950/60 pl-7 pr-2 text-[11px] text-gray-200 flex items-center">
            <Ltr>{searchValue}</Ltr>
            {searchValue && <span className="ml-0.5 animate-pulse">|</span>}
          </div>
        </div>
        <span className="text-[10px] text-gray-500 whitespace-nowrap">
          {filtered.length} {filtered.length !== 1 ? "contacts" : "contact"}
        </span>
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <table className="w-full text-[11px]">
          <thead className="bg-gray-900/60 sticky top-0">
            <tr className="border-b border-gray-800/60 text-left text-gray-400">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium hidden md:table-cell">Source</th>
              <th className="px-3 py-2 font-medium hidden lg:table-cell">Created</th>
              <th className="px-3 py-2 font-medium hidden lg:table-cell">Updated</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  No contacts match &ldquo;<Ltr>{searchValue}</Ltr>&rdquo;.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  className={`border-b border-gray-800/40 last:border-0 hover:bg-gray-900/30 ${
                    c.id === activeRowId ? "bg-emerald-500/5" : ""
                  }`}
                  onClick={() => onRowClick(c.id)}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[9px] font-medium text-emerald-400 border border-emerald-500/20">
                        {(c.name || c.email)[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-100">{c.name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-400">
                    <Ltr>{c.email}</Ltr>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <span className="inline-flex items-center rounded-md border border-gray-700/60 bg-gray-900/60 px-1.5 py-0.5 text-[9px] text-gray-300">
                      {SOURCE_LABELS[c.source]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[10px] text-gray-500 hidden lg:table-cell">
                    <Ltr>{new Date(c.created_at).toLocaleDateString()}</Ltr>
                  </td>
                  <td className="px-3 py-2 text-[10px] text-gray-500 hidden lg:table-cell">
                    <Ltr>{new Date(c.updated_at).toLocaleDateString()}</Ltr>
                  </td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-block">
                      <button
                        type="button"
                        className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-800/40"
                        aria-label="Row actions"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </button>
                      <AnimatePresence>
                        {actionsOpenFor === c.id && (
                          <motion.div
                            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                            transition={{ duration: prefersReducedMotion ? 0.1 : 0.15 }}
                            className="absolute right-0 z-20 mt-1 w-36 rounded-md border border-gray-700/60 bg-gray-950/95 py-1 shadow-xl backdrop-blur-sm"
                          >
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[10px] text-gray-200 hover:bg-gray-800/40"
                            >
                              <Pencil className="h-3 w-3" />
                              View/Edit
                            </button>
                            <div className="my-1 border-t border-gray-800/60" />
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[10px] text-rose-400 hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-gray-800/60 px-4 py-2">
        <p className="text-[10px] text-gray-500">Page 1 of 1</p>
        <div className="flex gap-1">
          <button
            type="button"
            disabled
            className="inline-flex h-5 items-center gap-1 rounded border border-gray-700/60 px-1.5 text-[9px] text-gray-500 disabled:opacity-40"
          >
            <ChevronLeft className="h-2.5 w-2.5" />
            Prev
          </button>
          <button
            type="button"
            disabled
            className="inline-flex h-5 items-center gap-1 rounded border border-gray-700/60 px-1.5 text-[9px] text-gray-500 disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      {/* Create-contact dialog overlay */}
      <AnimatePresence>
        {dialogOpen && (
          <CreateContactOverlay
            prefersReducedMotion={prefersReducedMotion}
            onClose={onCloseDialog}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// (No helpers needed — the stage state is driven entirely by the parent
// effect that mirrors the active scene key.)

/* ─── CREATE-CONTACT OVERLAY (simulated dialog) ──────────────────────────── */

function CreateContactOverlay({
  prefersReducedMotion,
  onClose,
}: {
  prefersReducedMotion: boolean;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0.1 : 0.2 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: prefersReducedMotion ? 0.1 : 0.2 }}
        className="w-full max-w-sm rounded-xl border border-gray-700/60 bg-gray-950/95 p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-gray-100">Add Contact</p>
        <p className="mt-0.5 text-[10px] text-gray-500">
          Email is required. Name and attributes are optional.
        </p>
        <div className="mt-3 space-y-2.5">
          <div>
            <label className="text-[10px] text-gray-400">Email</label>
            <div className="mt-1 h-7 w-full rounded-md border border-gray-700/60 bg-gray-900/60 px-2 text-[11px] text-gray-200 flex items-center">
              <Ltr>sara@example.com</Ltr>
              <span className="ml-0.5 animate-pulse">|</span>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-400">Name (optional)</label>
            <div className="mt-1 h-7 w-full rounded-md border border-gray-700/60 bg-gray-900/60 px-2 text-[11px] text-gray-300 flex items-center">
              Sara Ahmadi
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-400">Attributes (optional)</label>
            <div className="mt-1 flex gap-1.5">
              <div className="h-6 flex-1 rounded-md border border-gray-700/60 bg-gray-900/60 px-2 text-[10px] text-gray-300 flex items-center">
                plan
              </div>
              <div className="h-6 flex-1 rounded-md border border-gray-700/60 bg-gray-900/60 px-2 text-[10px] text-gray-300 flex items-center">
                pro
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2.5 py-1 text-[10px] text-gray-400 hover:bg-gray-800/40"
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-emerald-500"
          >
            Add Contact
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── DETAIL SURFACE ───────────────────────────────────────────────────────── */

function DetailSurface({
  contact,
  highlightConsent,
  prefersReducedMotion,
}: {
  contact: DemoContact;
  highlightConsent: boolean;
  prefersReducedMotion: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-800/60 px-4 py-3">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-gray-400 hover:bg-gray-800/40"
        >
          <ArrowLeft className="h-3 w-3" />
          Contacts
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-3">
        {/* Left: contact card + consent */}
        <div className="space-y-2.5 lg:col-span-2">
          <div className="rounded-lg border border-gray-800/60 bg-gray-950/40 p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">
                {(contact.name || contact.email)[0].toUpperCase()}
              </div>
              <p className="text-xs font-semibold text-gray-100">
                {contact.name || <Ltr>{contact.email}</Ltr>}
              </p>
            </div>
            <div className="mt-2 space-y-1.5 text-[11px]">
              <div className="flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-gray-500" />
                <Ltr>{contact.email}</Ltr>
                <span className="ml-auto inline-flex rounded-md border border-gray-700/60 px-1.5 py-0.5 text-[9px] text-gray-400">
                  immutable
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Tag className="h-3 w-3 text-gray-500" />
                <span className="text-gray-400">Source:</span>
                <span className="inline-flex rounded-md border border-gray-700/60 bg-gray-900/60 px-1.5 py-0.5 text-[9px] text-gray-300">
                  {SOURCE_LABELS[contact.source]}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-gray-500" />
                <span className="text-gray-400">Updated:</span>
                <Ltr className="text-gray-300">
                  {new Date(contact.updated_at).toLocaleDateString()}
                </Ltr>
              </div>
            </div>
          </div>

          {/* Consent & Marketing card */}
          <motion.div
            animate={
              highlightConsent && !prefersReducedMotion
                ? { boxShadow: "0 0 0 1px rgba(16,185,129,0.4)" }
                : { boxShadow: "0 0 0 1px rgba(31,41,55,0.6)" }
            }
            transition={{ duration: 0.3 }}
            className={`rounded-lg border bg-gray-950/40 p-3 ${
              highlightConsent ? "border-emerald-500/40" : "border-gray-800/60"
            }`}
          >
            <div className="mb-1.5 flex items-center gap-1.5">
              <BellRing className="h-3 w-3 text-emerald-400" />
              <p className="text-xs font-semibold text-gray-100">Consent & Marketing</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <MarketingBadge status={contact.marketing_status} />
              {contact.suppressed ? (
                <span className="inline-flex rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] text-rose-300">
                  Suppressed
                </span>
              ) : (
                <span className="inline-flex rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300">
                  Not suppressed
                </span>
              )}
              {contact.marketing_status === "subscribed" && !contact.suppressed && (
                <span className="inline-flex rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300">
                  Eligible for marketing
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ConsentBtn
                icon={<BellRing className="h-2.5 w-2.5" />}
                label="Subscribe"
                tone="primary"
              />
              <ConsentBtn
                icon={<BellOff className="h-2.5 w-2.5" />}
                label="Unsubscribe"
                tone="danger"
              />
              <ConsentBtn
                icon={<ShieldAlert className="h-2.5 w-2.5" />}
                label="Suppress manually"
                tone="neutral"
              />
              <ConsentBtn
                icon={<ShieldOff className="h-2.5 w-2.5" />}
                label="Lift suppression"
                tone="neutral"
              />
            </div>
            <p className="mt-2 text-[9px] text-gray-500">
              Importing a contact does not subscribe them. Each action is recorded in
              the audit history.
            </p>
          </motion.div>
        </div>

        {/* Right: timeline */}
        <div className="space-y-2">
          <div className="rounded-lg border border-gray-800/60 bg-gray-950/40 p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-emerald-400" />
              <p className="text-xs font-semibold text-gray-100">Timeline</p>
            </div>
            <ol className="space-y-1.5">
              {[
                { label: "Contact created", at: contact.created_at },
                { label: "Contact updated", at: contact.updated_at },
                ...(contact.marketing_status === "subscribed"
                  ? [{ label: "Subscribed to marketing", at: contact.updated_at }]
                  : []),
                ...(contact.suppressed
                  ? [{ label: "Manually suppressed", at: contact.updated_at }]
                  : []),
              ].map((ev, i) => (
                <li key={i} className="flex gap-1.5">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-1 w-1 rounded-full bg-emerald-500" />
                    <span className="mt-0.5 w-px flex-1 bg-gray-800" />
                  </div>
                  <div className="pb-1">
                    <p className="text-[10px] font-medium text-gray-200">{ev.label}</p>
                    <Ltr className="text-[9px] text-gray-500">
                      {new Date(ev.at).toLocaleString()}
                    </Ltr>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-lg border border-gray-800/60 bg-gray-950/40 p-3 text-[9px] text-gray-500">
            <div>ID: <Ltr>{contact.id}</Ltr></div>
            <div>Created: <Ltr>{new Date(contact.created_at).toLocaleString()}</Ltr></div>
            <div>Updated: <Ltr>{new Date(contact.updated_at).toLocaleString()}</Ltr></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketingBadge({ status }: { status: DemoContact["marketing_status"] }) {
  const cls =
    status === "subscribed"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : status === "unsubscribed"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
        : "border-slate-500/30 bg-slate-500/10 text-slate-300";
  const label =
    status === "subscribed" ? "Subscribed" : status === "unsubscribed" ? "Unsubscribed" : "Unknown";
  return (
    <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[9px] ${cls}`}>
      {label}
    </span>
  );
}

function ConsentBtn({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "primary" | "danger" | "neutral";
}) {
  const cls =
    tone === "primary"
      ? "bg-emerald-600/80 text-white hover:bg-emerald-500"
      : tone === "danger"
        ? "border border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
        : "border border-gray-700/60 text-gray-300 hover:bg-gray-800/40";
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] font-medium ${cls}`}
    >
      {icon}
      {label}
    </button>
  );
}
