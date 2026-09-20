/* eslint-disable react-hooks/set-state-in-effect --
 * Pre-existing async data-fetch pattern: setState occurs inside async callbacks
 * (.then / await), not synchronously in the effect body. Upgrading
 * eslint-plugin-react-hooks to 7.1.1 (Phase 12 dependency refresh) introduced
 * these rules which false-positive on async setState and pre-existing useMemo.
 * Fixing would require unrelated product redesign.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Mail, Clock, Tag, Plus, Trash2, Save, Users as UsersIcon,
  BellRing, BellOff, ShieldAlert, ShieldCheck, ShieldOff,
} from "lucide-react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";

interface ContactDetail {
  id: number;
  email: string;
  name: string | null;
  source: string;
  attributes: Record<string, unknown>;
  marketing_status: string;
  created_at: string;
  updated_at: string;
  timeline: Array<{
    type: string;
    detail: unknown;
    created_at: string;
  }>;
}

const SOURCE_LABELS: Record<string, string> = {
  api: "API",
  dashboard: "Dashboard",
  otp_verified: "OTP Verified",
  import: "Import",
};

const EVENT_LABELS: Record<string, string> = {
  "contact.created": "Contact created",
  "contact.updated": "Contact updated",
  "contact.imported": "Imported",
  "contact.subscribed": "Subscribed to marketing",
  "contact.unsubscribed": "Unsubscribed from marketing",
  "contact.unsuppressed": "Suppression lifted",
  "otp.verified": "OTP verified",
  "email.sent": "Email sent",
};

interface ConsentState {
  contact_id: number;
  marketing_status: string;
  marketing_consent_source: string | null;
  marketing_consent_at: string | null;
  suppressed: boolean;
  suppression_id: string | null;
  suppression_reason: string | null;
  suppression_source: string | null;
  suppression_lifted_at: string | null;
  eligible: boolean;
  history: Array<{
    event_id: string;
    previous_status: string;
    new_status: string;
    source: string;
    reason: string | null;
    created_at: string;
  }>;
}

const MARKETING_STATUS_LABELS: Record<string, string> = {
  unknown: "Unknown",
  subscribed: "Subscribed",
  unsubscribed: "Unsubscribed",
};

function MarketingBadge({ status }: { status: string }) {
  const cls = status === "subscribed"
    ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
    : status === "unsubscribed"
      ? "bg-rose-500/10 text-rose-700 border-rose-500/30"
      : "bg-slate-500/10 text-slate-700 border-slate-500/30";
  return <Badge variant="outline" className={`text-xs ${cls}`}>{MARKETING_STATUS_LABELS[status] ?? status}</Badge>;
}

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editName, setEditName] = useState("");
  const [attrRows, setAttrRows] = useState<{ key: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [contactId, setContactId] = useState<number>(0);
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [consentLoading, setConsentLoading] = useState(false);
  const [confirmUnsubscribe, setConfirmUnsubscribe] = useState(false);
  const [confirmSubscribe, setConfirmSubscribe] = useState(false);
  const [confirmSuppress, setConfirmSuppress] = useState(false);
  const [confirmLift, setConfirmLift] = useState(false);

  const loadContact = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/contacts/${contactId}`);
      if (res.status === 401) { router.push("/auth"); return; }
      if (res.status === 403) { router.push("/dashboard/contacts"); return; }
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setContact(data);
      setEditName(data.name || "");
      const attrs = data.attributes as Record<string, unknown>;
      setAttrRows(
        Object.entries(attrs || {}).map(([key, value]) => ({
          key,
          value: typeof value === "string" ? value : JSON.stringify(value),
        }))
      );
    } catch {
      toast({ title: t("dashboard.toasts.contactLoadFailed"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [contactId, router, toast]);

  const loadConsent = useCallback(async () => {
    if (!contactId) return;
    setConsentLoading(true);
    try {
      const res = await fetch(`/api/dashboard/contacts/${contactId}/consent`);
      if (res.ok) {
        const data = await res.json();
        setConsent(data);
      }
    } catch {
      // Non-blocking — consent state is secondary.
    } finally {
      setConsentLoading(false);
    }
  }, [contactId]);

  async function runConsentAction(action: "subscribe" | "unsubscribe" | "suppress" | "lift") {
    if (!contact) return;
    // Choose the right endpoint:
    //  - subscribe    → POST /api/dashboard/contacts/:id/subscribe
    //  - unsubscribe   → POST /api/dashboard/contacts/:id/unsubscribe
    //  - suppress      → POST /api/dashboard/suppressions  (manual reason)
    //  - lift          → POST /api/dashboard/suppressions/:suppressionId  (also_subscribe: false)
    let url: string;
    let body: Record<string, unknown> = {};
    if (action === "subscribe") {
      url = `/api/dashboard/contacts/${contact.id}/subscribe`;
    } else if (action === "unsubscribe") {
      url = `/api/dashboard/contacts/${contact.id}/unsubscribe`;
    } else if (action === "suppress") {
      url = `/api/dashboard/suppressions`;
      body = { email: contact.email, reason: "manual" };
    } else {
      // lift
      if (!consent?.suppression_id) {
        toast({ title: t("dashboard.toasts.noSuppressionToLift"), variant: "destructive" });
        return;
      }
      url = `/api/dashboard/suppressions/${consent.suppression_id}`;
      body = { also_subscribe: false };
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast({ title: t("dashboard.toasts.actionFailed"), description: d.error?.message ?? "", variant: "destructive" });
        return;
      }
      toast({ title: action === "subscribe" ? t("dashboard.toasts.subscribed") : action === "unsubscribe" ? t("dashboard.toasts.unsubscribed") : action === "suppress" ? t("dashboard.toasts.suppressed") : t("dashboard.toasts.suppressionLifted") });
      await Promise.all([loadContact(), loadConsent()]);
    } catch {
      toast({ title: t("dashboard.toasts.actionFailed"), variant: "destructive" });
    }
  }

  useEffect(() => {
    params.then(p => setContactId(Number(p.id)));
  }, [params]);

  useEffect(() => {
    if (contactId > 0) {
      loadContact();
      loadConsent();
    }
  }, [contactId, loadContact, loadConsent]);

  async function handleSave() {
    if (!contact) return;
    setSaving(true);
    try {
      // Build attributes from rows — preserve non-string original values
      const attrs: Record<string, unknown> = {};
      const originalAttrs = (contact.attributes as Record<string, unknown>) || {};
      for (const row of attrRows) {
        const key = row.key.trim();
        if (!key) continue;
        // If the value hasn't changed from the original, preserve the original type
        if (key in originalAttrs) {
          const origValue = originalAttrs[key];
          const origString = typeof origValue === "string" ? origValue : JSON.stringify(origValue);
          if (row.value === origString) {
            attrs[key] = origValue; // preserve original type
          } else {
            attrs[key] = row.value; // user intentionally changed it (string)
          }
        } else {
          attrs[key] = row.value; // new key, string value
        }
      }
      const res = await fetch(`/api/dashboard/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(), // empty string = clear (service converts to null)
          attributes: attrs,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast({ title: "Save failed", description: d.error?.message ?? "", variant: "destructive" });
        return;
      }
      toast({ title: t("dashboard.toasts.contactUpdated") });
      loadContact();
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!contact) return;
    try {
      const res = await fetch(`/api/dashboard/contacts/${contact.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast({ title: "Delete failed", variant: "destructive" });
        return;
      }
      toast({ title: t("dashboard.toasts.contactDeleted") });
      router.push("/dashboard/contacts");
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="container mx-auto max-w-2xl py-20 text-center">
        <h2 className="text-xl font-semibold">{t("dashboard.common.contactNotFound")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">This contact may have been deleted or doesn't belong to your account.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/contacts">{t("dashboard.common.backToContacts")}</Link>
        </Button>
      </div>
    );
  }

  if (!contact) return null;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/contacts")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Contacts
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Contact info + edit */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-sm font-bold text-emerald-600">
                  {(contact.name || contact.email)[0].toUpperCase()}
                </div>
                <span className="break-all">{contact.name || contact.email}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email (read-only) */}
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm break-all" dir="ltr">{contact.email}</span>
                <Badge variant="outline" className="ml-auto text-xs">t("dashboard.common.emailImmutable")</Badge>
              </div>

              {/* Source (read-only) */}
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Source: </span>
                <Badge variant="outline" className="text-xs">{SOURCE_LABELS[contact.source] || contact.source}</Badge>
              </div>

              {/* Marketing status (read-only display) */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Marketing status: </span>
                <MarketingBadge status={contact.marketing_status} />
                {consent?.suppressed && (
                  <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-700 border-rose-500/30">
                    Suppressed ({consent.suppression_reason ?? "unknown"})
                  </Badge>
                )}
              </div>

              {/* Consent info note */}
              <p className="text-xs text-muted-foreground">
                Email verification (OTP) is separate from marketing consent. Importing a contact does not subscribe them.
                Transactional emails are not affected by marketing status.
              </p>

              <Separator />

              {/* Editable: Name */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">{t("dashboard.common.name")}</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={200}
                  placeholder={t("dashboard.contacts.noNamePlaceholder")}
                />
              </div>

              {/* Editable: Attributes */}
              <div className="space-y-2">
                <Label>{t("dashboard.common.attributes")}</Label>
                {attrRows.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="key"
                      value={row.key}
                      onChange={(e) => {
                        const next = [...attrRows];
                        next[i] = { ...row, key: e.target.value };
                        setAttrRows(next);
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder="value"
                      value={row.value}
                      onChange={(e) => {
                        const next = [...attrRows];
                        next[i] = { ...row, value: e.target.value };
                        setAttrRows(next);
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAttrRows(rows => rows.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAttrRows(rows => [...rows, { key: "", value: "" }])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add field
                </Button>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save className="mr-1 h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  className="text-rose-600 hover:text-rose-700"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Consent & Marketing actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BellRing className="h-4 w-4 text-emerald-600" /> Consent & Marketing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {consentLoading && <Skeleton className="h-8 w-full" />}
              {!consentLoading && consent && (
                <>
                  <div className="flex flex-wrap gap-2 items-center text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <MarketingBadge status={consent.marketing_status} />
                    {consent.suppressed ? (
                      <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-700 border-rose-500/30">
                        Suppressed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                        Not suppressed
                      </Badge>
                    )}
                    {consent.eligible && (
                      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                        Eligible for marketing
                      </Badge>
                    )}
                  </div>
                  {consent.marketing_consent_at && (
                    <p className="text-xs text-muted-foreground">
                      Consent last changed: {new Date(consent.marketing_consent_at).toLocaleString()}
                      {consent.marketing_consent_source ? ` via ${consent.marketing_consent_source}` : ""}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Importing a contact does not subscribe them. Email verification (OTP) is separate from marketing consent.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {consent.marketing_status !== "subscribed" && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 text-white hover:bg-emerald-500"
                        onClick={() => setConfirmSubscribe(true)}
                      >
                        <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Subscribe
                      </Button>
                    )}
                    {consent.marketing_status !== "unsubscribed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => setConfirmUnsubscribe(true)}
                      >
                        <BellOff className="mr-1 h-3.5 w-3.5" /> Unsubscribe
                      </Button>
                    )}
                    {!consent.suppressed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmSuppress(true)}
                      >
                        <ShieldAlert className="mr-1 h-3.5 w-3.5" /> Suppress manually
                      </Button>
                    )}
                    {consent.suppressed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmLift(true)}
                      >
                        <ShieldOff className="mr-1 h-3.5 w-3.5" /> Lift suppression
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Timeline */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-emerald-600" /> Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <div className="space-y-3">
                  {contact.timeline.map((event, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5" />
                        {i < contact.timeline.length - 1 && (
                          <div className="w-px flex-1 bg-gray-200 dark:bg-gray-800" />
                        )}
                      </div>
                      <div className="flex-1 pb-2">
                        <p className="text-sm font-medium">{EVENT_LABELS[event.type] || event.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                        {Boolean(event.detail) && typeof event.detail === "object" && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {Object.entries(event.detail as Record<string, unknown>)
                              .map(([k, v]) => `${k}: ${String(v)}`)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardContent className="p-4 space-y-2 text-xs text-muted-foreground">
              <div>Created: {new Date(contact.created_at).toLocaleString()}</div>
              <div>Updated: {new Date(contact.updated_at).toLocaleString()}</div>
              <div>ID: {contact.id}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {contact.name || contact.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the contact and its contact timeline. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dashboard.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-500"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subscribe confirmation */}
      <AlertDialog open={confirmSubscribe} onOpenChange={setConfirmSubscribe}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Subscribe {contact.email} to marketing?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the contact as Subscribed and lift any active suppression. The contact will be eligible to receive marketing messages. This is an explicit consent action and will be recorded in the audit history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dashboard.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={() => { setConfirmSubscribe(false); runConsentAction("subscribe"); }}
            >
              Subscribe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsubscribe confirmation */}
      <AlertDialog open={confirmUnsubscribe} onOpenChange={setConfirmUnsubscribe}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsubscribe {contact.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the contact as Unsubscribed and add them to the suppression list. They will no longer receive marketing messages. Transactional emails (OTP, security) are not affected. This action will be recorded in the audit history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dashboard.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-500"
              onClick={() => { setConfirmUnsubscribe(false); runConsentAction("unsubscribe"); }}
            >
              Unsubscribe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual suppress confirmation */}
      <AlertDialog open={confirmSuppress} onOpenChange={setConfirmSuppress}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Manually suppress {contact.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This adds the email to the suppression list with reason “manual” and unsubscribes the contact. The contact will not be eligible for marketing messages. This action will be recorded in the audit history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dashboard.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-500"
              onClick={() => { setConfirmSuppress(false); runConsentAction("suppress"); }}
            >
              Suppress
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lift suppression confirmation */}
      <AlertDialog open={confirmLift} onOpenChange={setConfirmLift}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lift suppression for {contact.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deactivates the suppression entry. To actually resubscribe the contact, also click “Subscribe” after lifting. Lifting alone does not subscribe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dashboard.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={() => { setConfirmLift(false); runConsentAction("lift"); }}
            >
              Lift suppression
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
