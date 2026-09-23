"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "@/lib/i18n/LocaleProvider";
import {
  RefreshCw,
  LogOut,
  ArrowLeft,
  ShieldAlert,
} from "lucide-react";

interface AdminComment {
  id: number;
  slug: string;
  locale: string;
  parentId: number | null;
  userId: number | null;
  authorName: string;
  body: string;
  hidden: boolean;
  hiddenByAdminEmail: string | null;
  hiddenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  comments: AdminComment[];
  totalCount: number;
  hasMore: boolean;
}

type Filter = "all" | "visible" | "hidden";

/**
 * /admin/comments — Comment moderation page.
 *
 * Uses the existing admin auth system (mg_admin cookie). Admins can:
 *   - view all comments (including hidden)
 *   - filter by article slug and/or status (visible/hidden)
 *   - hide / unhide comments
 *   - delete abusive comments (cascades to replies)
 *
 * This is the ONLY comment-moderation surface — there is no second admin
 * system. The page 401-redirects to /admin/login if the admin cookie is
 * missing or invalid.
 */
export default function AdminCommentsPage() {
  const router = useRouter();
  const t = useTranslations();
  const { toast } = useToast();

  const [comments, setComments] = useState<AdminComment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [slugFilter, setSlugFilter] = useState("");

  const fetchComments = useCallback(async (p: number, append: boolean) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (slugFilter) params.set("slug", slugFilter);
    if (filter === "visible") params.set("hidden", "false");
    if (filter === "hidden") params.set("hidden", "true");
    const res = await fetch(`/api/admin/comments?${params}`);
    if (res.status === 401) {
      setAuthed(false);
      router.push("/admin/login");
      return;
    }
    if (!res.ok) return;
    const data: ListResponse = await res.json();
    setComments(prev => append ? [...prev, ...data.comments] : data.comments);
    setTotalCount(data.totalCount);
    setHasMore(data.hasMore);
    setPage(p);
    setAuthed(true);
    setLoading(false);
  }, [filter, slugFilter, router]);

  useEffect(() => {
    // Data-fetching effect — setState is deferred via async fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchComments(1, false);
  }, [filter, slugFilter]);

  async function handleHide(id: number) {
    const res = await fetch(`/api/admin/comments/${id}/hide`, { method: "PATCH" });
    if (res.ok) {
      toast({ title: t("blog.moderation.hide") });
      setComments(prev => prev.map(c => c.id === id ? { ...c, hidden: true } : c));
    }
  }

  async function handleUnhide(id: number) {
    const res = await fetch(`/api/admin/comments/${id}/unhide`, { method: "PATCH" });
    if (res.ok) {
      toast({ title: t("blog.moderation.unhide") });
      setComments(prev => prev.map(c => c.id === id ? { ...c, hidden: false } : c));
    }
  }

  async function handleDelete(id: number, locale: string) {
    if (!confirm(t("blog.moderation.confirmDelete"))) return;
    const res = await fetch(`/api/admin/comments/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    if (res.ok) {
      const data = await res.json();
      toast({ title: t("blog.moderation.delete") });
      if (data.softDeleted) {
        // Blocker 3 — tombstoned: keep the row, mark as deleted in the UI.
        setComments(prev => prev.map(c => c.id === id ? {
          ...c,
          deleted: true,
          body: "",
          authorName: locale === "fa" ? "کاربر حذف‌شده" : "Deleted user",
          userId: null,
        } : c));
      } else {
        setComments(prev => prev.filter(c => c.id !== id));
        setTotalCount(prev => Math.max(0, prev - 1));
      }
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  if (authed === false) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Admin header chrome — mirrors the security dashboard pattern */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-lg font-semibold text-foreground">{t("blog.moderation.title")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchComments(1, false)}>
              <RefreshCw className="h-4 w-4" /> {t("common.refresh")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-lg border border-border/60 p-1">
            {(["all", "visible", "hidden"] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`blog.moderation.filter${f.charAt(0).toUpperCase() + f.slice(1)}` as "blog.moderation.filterAll")}
              </button>
            ))}
          </div>
          <Input
            placeholder={t("blog.moderation.filterByArticle")}
            value={slugFilter}
            onChange={(e) => setSlugFilter(e.target.value)}
            className="max-w-xs"
          />
          <span className="text-xs text-muted-foreground/60">
            {t("blog.moderation.total")}: {totalCount}
          </span>
        </div>

        {/* Comments table */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground/60">{t("blog.moderation.empty")}</p>
        ) : (
          <div className="space-y-3">
            {comments.map(c => (
              <div key={c.id} className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground/60">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{c.authorName}</span>
                    <span>·</span>
                    <a href={`/blog/${c.slug}`} className="text-emerald-600 dark:text-emerald-400 hover:underline">
                      {c.slug}
                    </a>
                    {c.parentId && <Badge variant="outline" className="text-xs">↳ reply</Badge>}
                    {c.hidden && <Badge variant="destructive" className="text-xs">{t("blog.moderation.filterHidden")}</Badge>}
                  </div>
                  <span>{c.createdAt.slice(0, 10)}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap break-words">{c.body}</p>
                {c.hidden && c.hiddenByAdminEmail && (
                  <p className="mt-1 text-xs text-muted-foreground/40">
                    {t("blog.moderation.hiddenBy")} {c.hiddenByAdminEmail} {t("blog.moderation.on")} {c.hiddenAt?.slice(0, 10)}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  {c.hidden ? (
                    <Button size="sm" variant="outline" onClick={() => handleUnhide(c.id)}>
                      {t("blog.moderation.unhide")}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleHide(c.id)}>
                      {t("blog.moderation.hide")}
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(c.id, c.locale)}>
                    {t("blog.moderation.delete")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <div className="mt-6">
            <Button variant="outline" onClick={() => fetchComments(page + 1, true)}>
              {t("blog.comments.loadMore")}
            </Button>
          </div>
        )}

        <div className="mt-8">
          <a href="/admin" className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> {t("common.back")}
          </a>
        </div>
      </main>
    </div>
  );
}
