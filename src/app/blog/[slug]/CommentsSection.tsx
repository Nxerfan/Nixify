"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n/locales";
import { LOCALE_HTML_DIR } from "@/lib/i18n/locales";
import type { CommentDTO } from "@/lib/blog/comments";

interface CommentsSectionProps {
  slug: string;
  locale: Locale;
  initialCount: number;
}

interface ListResponse {
  comments: CommentDTO[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Phase 18 — Blog comments section.
 *
 * Authenticated comment system:
 *   - Anonymous users: can READ comments, cannot POST (sign-in prompt shown).
 *   - Logged-in users: post, reply, edit own, delete own.
 *   - Threaded replies (one level expanded at a time via "View replies").
 *   - Pagination via "Load more".
 *   - Body is plain-text only — rendered with escaping (no dangerouslySetInnerHTML).
 *
 * All mutations enforce server-side ownership checks; this client only hides
 * edit/delete controls for comments not owned by the current user (the server
 * is the source of truth).
 */
export function CommentsSection({ slug, locale, initialCount }: CommentsSectionProps) {
  const t = useTranslations();
  const dir = LOCALE_HTML_DIR[locale];

  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [totalCount, setTotalCount] = useState(initialCount);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [authedUserId, setAuthedUserId] = useState<number | null>(null);

  const fetchPage = useCallback(async (p: number, append: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/blog/comments?slug=${encodeURIComponent(slug)}&locale=${locale}&page=${p}`);
      if (!res.ok) return;
      const data: ListResponse = await res.json();
      setComments(prev => append ? [...prev, ...data.comments] : data.comments);
      setTotalCount(data.totalCount);
      setHasMore(data.hasMore);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [slug, locale]);

  // Load the first page on mount.
  useEffect(() => {
    // Data-fetching effect — setState happens after async fetch resolves (not
    // synchronous). The linter flags the initial setLoading(true); this is the
    // canonical data-loading pattern for client components.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPage(1, false);
  }, [fetchPage]);

  // Check auth status (for showing the post form + edit/delete controls).
  // /api/profile/me returns { user: { id: "1", ... } } or 401.
  useEffect(() => {
    fetch("/api/profile/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const id = d?.user?.id;
        if (id !== undefined && id !== null) setAuthedUserId(Number(id));
      })
      .catch(() => {});
  }, []);

  return (
    <section className="mt-12 border-t border-border/60 pt-8" dir={dir}>
      <h2 className="text-xl font-semibold text-foreground mb-4">
        {t("blog.comments.title")}
        {totalCount > 0 && (
          <span className="text-muted-foreground/50 text-sm font-normal"> ({totalCount})</span>
        )}
      </h2>

      {/* Post form — auth-gated */}
      <CommentComposer
        slug={slug}
        locale={locale}
        authedUserId={authedUserId}
        onPosted={(c) => {
          setComments(prev => [c, ...prev]);
          setTotalCount(prev => prev + 1);
        }}
      />

      {/* Comment list */}
      <div className="space-y-4">
        {comments.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground/60">{t("blog.comments.empty")}</p>
        )}
        {comments.map(c => (
          <CommentItem
            key={c.id}
            comment={c}
            slug={slug}
            locale={locale}
            authedUserId={authedUserId}
            onEdited={(updated) => {
              setComments(prev => prev.map(x => x.id === updated.id ? { ...x, ...updated } : x));
            }}
            onDeleted={(id) => {
              setComments(prev => prev.filter(x => x.id !== id));
              setTotalCount(prev => Math.max(0, prev - 1));
            }}
            onTombstoned={(id) => {
              // Blocker 3: replace the comment with a tombstone marker so
              // the thread structure is preserved in the UI.
              setComments(prev => prev.map(x => x.id === id ? {
                ...x,
                deleted: true,
                body: "",
                authorName: locale === "fa" ? "کاربر حذف‌شده" : "Deleted user",
                userId: null,
              } : x));
            }}
          />
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="mt-6">
          <button
            type="button"
            disabled={loading}
            onClick={() => fetchPage(page + 1, true)}
            className="rounded-lg border border-border/60 px-4 py-2 text-sm text-muted-foreground hover:border-emerald-500/30 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-50"
          >
            {loading ? t("blog.comments.loadingMore") : t("blog.comments.loadMore")}
          </button>
        </div>
      )}
    </section>
  );
}

// ─── Composer (post a top-level comment) ─────────────────────────────────

function CommentComposer({
  slug,
  locale,
  authedUserId,
  onPosted,
}: {
  slug: string;
  locale: Locale;
  authedUserId: number | null;
  onPosted: (c: CommentDTO) => void;
}) {
  const t = useTranslations();
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authedUserId === null) {
    return (
      <div className="mb-6 rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
        {t("blog.comments.signInToPost")}{" "}
        <a href="/login" className="text-emerald-600 dark:text-emerald-400 underline">
          {t("blog.comments.signIn")}
        </a>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/blog/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, locale, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(mapError(data.error, t));
        return;
      }
      setBody("");
      onPosted(data.comment);
    } catch {
      setError(t("blog.comments.errorGeneric"));
    } finally {
      setPosting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("blog.comments.placeholder")}
        rows={3}
        maxLength={1000}
        className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      />
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={posting || !body.trim()}
        className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {posting ? t("blog.comments.posting") : t("blog.comments.post")}
      </button>
    </form>
  );
}

// ─── Single comment item (with reply expansion) ──────────────────────────

function CommentItem({
  comment,
  slug,
  locale,
  authedUserId,
  onEdited,
  onDeleted,
  onTombstoned,
}: {
  comment: CommentDTO;
  slug: string;
  locale: Locale;
  authedUserId: number | null;
  onEdited: (updated: Pick<CommentDTO, "id" | "body" | "updatedAt">) => void;
  onDeleted: (id: number) => void;
  onTombstoned: (id: number) => void;
}) {
  const t = useTranslations();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<CommentDTO[]>([]);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isOwner = authedUserId !== null && authedUserId === comment.userId;

  async function toggleReplies() {
    if (showReplies) {
      setShowReplies(false);
      return;
    }
    try {
      const res = await fetch(`/api/blog/comments/${comment.id}/replies`);
      if (!res.ok) return;
      const data = await res.json();
      setReplies(data.replies || []);
      setShowReplies(true);
    } catch {
      // ignore
    }
  }

  async function handleEditSave() {
    if (!editBody.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/blog/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody }),
      });
      const data = await res.json();
      if (res.ok) {
        onEdited({ id: comment.id, body: editBody, updatedAt: data.comment?.updatedAt ?? new Date().toISOString() });
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t("blog.comments.confirmDelete"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/blog/comments/${comment.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (res.ok) {
        const data = await res.json();
        // Blocker 3: a soft-deleted parent becomes a tombstone — replace it
        // in the list rather than removing it, so the thread structure stays.
        if (data.softDeleted) {
          onTombstoned(comment.id);
        } else {
          onDeleted(comment.id);
        }
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground/60">
        <span className="font-medium text-foreground">{comment.authorName || t("blog.comments.deletedUser")}</span>
        <span>{formatDate(comment.createdAt, locale)}</span>
      </div>

      {comment.deleted ? (
        // Blocker 3 — tombstone. The original body and author identity are
        // gone; render a localized "Comment deleted" placeholder so the
        // thread structure is preserved.
        <p className="mt-2 text-sm italic text-muted-foreground/50">
          {locale === "fa" ? "این نظر حذف شده است." : "Comment deleted"}
        </p>
      ) : editing ? (
        <div className="mt-2">
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus:border-emerald-500/40 focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button onClick={handleEditSave} disabled={saving} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {saving ? t("blog.comments.saving") : t("blog.comments.save")}
            </button>
            <button onClick={() => { setEditing(false); setEditBody(comment.body); }} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              {t("blog.comments.cancel")}
            </button>
          </div>
        </div>
      ) : (
        // Body is plain text — React escapes it by default. No
        // dangerouslySetInnerHTML, no Markdown rendering.
        <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap break-words">{comment.body}</p>
      )}

      {comment.updatedAt !== comment.createdAt && !editing && !comment.deleted && (
        <p className="mt-1 text-xs text-muted-foreground/40">({t("blog.comments.edited")})</p>
      )}

      {!comment.deleted && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <button onClick={() => setShowReplyForm(s => !s)} className="text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400">
            {t("blog.comments.reply")}
          </button>
          {isOwner && !editing && (
            <>
              <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400">
                {t("blog.comments.edit")}
              </button>
              <button onClick={handleDelete} disabled={deleting} className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50">
                {deleting ? t("blog.comments.deleting") : t("blog.comments.delete")}
              </button>
            </>
          )}
        {comment.replyCount > 0 && (
          <button onClick={toggleReplies} className="text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400">
            {showReplies ? t("blog.comments.hideReplies") : `${t("blog.comments.viewReplies")} (${comment.replyCount})`}
          </button>
        )}
        </div>
      )}

      {/* Reply form */}
      {showReplyForm && (
        <div className="mt-3">
          <ReplyComposer
            slug={slug}
            locale={locale}
            parentId={comment.id}
            authedUserId={authedUserId}
            onPosted={(c) => {
              setReplies(prev => [...prev, c]);
              setShowReplies(true);
              setShowReplyForm(false);
            }}
          />
        </div>
      )}

      {/* Replies (one level) */}
      {showReplies && replies.length > 0 && (
        <div className="mt-3 space-y-3 border-s-2 border-border/40 ps-4">
          {replies.map(r => (
            <div key={r.id} className="rounded-lg border border-border/40 bg-muted/10 p-3">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground/60">
                <span className="font-medium text-foreground">{r.authorName || t("blog.comments.deletedUser")}</span>
                <span>{formatDate(r.createdAt, locale)}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap break-words">{r.body}</p>
              {r.userId !== null && authedUserId === r.userId && (
                <div className="mt-2 flex gap-3 text-xs">
                  <ReplyEditDelete
                    comment={r}
                    onEdited={(updated) => setReplies(prev => prev.map(x => x.id === updated.id ? { ...x, ...updated } : x))}
                    onDeleted={(id) => setReplies(prev => prev.filter(x => x.id !== id))}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Reply composer (reuse for nested reply form) ─────────────────────────

function ReplyComposer({
  slug,
  locale,
  parentId,
  authedUserId,
  onPosted,
}: {
  slug: string;
  locale: Locale;
  parentId: number;
  authedUserId: number | null;
  onPosted: (c: CommentDTO) => void;
}) {
  const t = useTranslations();
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authedUserId === null) {
    return (
      <p className="text-xs text-muted-foreground/60">
        {t("blog.comments.signInToPost")}{" "}
        <a href="/login" className="text-emerald-600 dark:text-emerald-400 underline">{t("blog.comments.signIn")}</a>
      </p>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/blog/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, locale, body, parentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(mapError(data.error, t));
        return;
      }
      setBody("");
      onPosted(data.comment);
    } catch {
      setError(t("blog.comments.errorGeneric"));
    } finally {
      setPosting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("blog.comments.placeholder")}
        rows={2}
        maxLength={1000}
        className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      />
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={posting || !body.trim()} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {posting ? t("blog.comments.posting") : t("blog.comments.reply")}
        </button>
      </div>
    </form>
  );
}

// ─── Edit/delete controls for reply-level comments ───────────────────────

function ReplyEditDelete({
  comment,
  onEdited,
  onDeleted,
}: {
  comment: CommentDTO;
  onEdited: (updated: Pick<CommentDTO, "id" | "body" | "updatedAt">) => void;
  onDeleted: (id: number) => void;
}) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (editing) {
    return (
      <>
        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          rows={2}
          maxLength={1000}
          className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus:border-emerald-500/40 focus:outline-none"
        />
        <div className="mt-1 flex gap-2">
          <button onClick={async () => {
            if (!editBody.trim() || saving) return;
            setSaving(true);
            try {
              const res = await fetch(`/api/blog/comments/${comment.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: editBody }),
              });
              const data = await res.json();
              if (res.ok) {
                onEdited({ id: comment.id, body: editBody, updatedAt: data.comment?.updatedAt ?? new Date().toISOString() });
                setEditing(false);
              }
            } finally {
              setSaving(false);
            }
          }} disabled={saving} className="text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400">
            {saving ? t("blog.comments.saving") : t("blog.comments.save")}
          </button>
          <button onClick={() => { setEditing(false); setEditBody(comment.body); }} className="text-muted-foreground hover:text-foreground">
            {t("blog.comments.cancel")}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400">
        {t("blog.comments.edit")}
      </button>
      <button onClick={async () => {
        if (!confirm(t("blog.comments.confirmDelete"))) return;
        setDeleting(true);
        try {
          const res = await fetch(`/api/blog/comments/${comment.id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locale: comment.locale }),
          });
          if (res.ok) {
            const data = await res.json();
            // Replies are leaves (one level only) — they hard-delete. If the
            // API reports a soft-delete (unexpected for a reply), still
            // remove it from the list since replies are leaves.
            onDeleted(comment.id);
          }
        } finally {
          setDeleting(false);
        }
      }} disabled={deleting} className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50">
        {deleting ? t("blog.comments.deleting") : t("blog.comments.delete")}
      </button>
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function mapError(code: string | undefined, t: (k: string) => string): string {
  switch (code) {
    case "rate_limited": return t("blog.comments.errorRateLimited");
    case "validation_failed": return t("blog.comments.errorHtml");
    case "unauthorized": return t("blog.comments.signInToPost");
    default: return t("blog.comments.errorGeneric");
  }
}

function formatDate(iso: string, locale: Locale): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(locale === "fa" ? "fa-IR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}
