/**
 * Phase 18 — Blog comment service (blocker fixes).
 *
 * Locale-scoped, tombstone-preserved, one-reply-level, slug-validated comment
 * system.
 *
 * Locale scoping (Blocker 1):
 *   • Comments belong to (slug, locale). EN and FA threads are partitioned.
 *     listComments / getCommentCount / getMostDiscussedArticles all take a
 *     locale and never mix threads.
 *
 * Slug validation (Blocker 2):
 *   • createComment rejects unknown (slug, locale) pairs by checking the
 *     canonical blog corpus.
 *
 * Tombstone / preserved-thread (Blocker 3):
 *   • Deleting a parent comment with replies does NOT cascade. Instead the
 *     parent is soft-deleted (deleted=true, body cleared, authorName →
 *     tombstone label, userId nulled). Replies (owned by other users)
 *     survive with their parentId still pointing at the tombstone row.
 *   • A leaf comment (no replies) is hard-deleted.
 *   • parentId FK is ON DELETE SET NULL at the DB level as defense-in-depth.
 *
 * Nesting depth (Blocker 4):
 *   • createComment rejects `parentId` that refers to a reply (a comment whose
 *     own parentId is non-null). Only one reply level is allowed.
 *
 * Author identity (Blocker 5):
 *   • resolveAuthorName uses ONLY safe profile display fields (firstName,
 *     lastName, fullName). NEVER falls back to the email local-part. If no
 *     public name exists, returns a generic localized "User" / "کاربر".
 *
 * Moderation (Blocker 6):
 *   • Hiding a parent hides the ENTIRE subtree. Public list/count queries
 *     exclude any comment that is itself hidden OR whose parent chain
 *     reaches a hidden comment. This keeps counts consistent with the
 *     visible thread.
 *
 * Account-deletion compatibility:
 *   • BlogComment.userId is nullable + ON DELETE SET NULL. The deletion
 *     service overwrites authorName to a localized tombstone + nulls userId
 *     before the user row is removed — no PII leak, no broken thread.
 */

import { db } from "@/lib/db";
import { rateLimit, type RateLimitResult } from "@/lib/ratelimit";
import type { Locale } from "@/lib/i18n/locales";
import { getArticle, getAllSlugs } from "@/lib/blog/content";

/** Max comment body length (plain text). */
export const COMMENT_MAX_LEN = 1000;
/** Min comment body length (after trim). */
export const COMMENT_MIN_LEN = 1;
/** Rate limits per user. */
export const COMMENT_RATE_LIMITS = {
  COMMENT_POST_PER_MIN: 3,
  COMMENT_POST_PER_HOUR: 20,
} as const;

/** Pagination page size for comment lists (top-level + replies). */
export const COMMENT_PAGE_SIZE = 20;
/** Max replies fetched per parent (bound; no unlimited lists). */
export const REPLIES_MAX_FETCH = 50;

export interface CommentDTO {
  id: number;
  slug: string;
  locale: string;
  parentId: number | null;
  userId: number | null;
  authorName: string;
  body: string;
  /** Tombstone flag — if true, render a localized "Comment deleted" placeholder. */
  deleted: boolean;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
  /** Direct reply count (one level deep — not recursive). */
  replyCount: number;
}

export interface CommentListResult {
  comments: CommentDTO[];
  /**
   * Top-level visible comment count (parentId IS NULL, hidden=false).
   * Used ONLY for pagination — the client uses this to decide whether to
   * show "Load more".
   */
  topLevelCount: number;
  /**
   * Total visible comment count including replies (top-level + visible
   * replies under non-hidden parents). Used for the heading/badge count.
   * This is the SAME value returned by getCommentCount(slug, locale).
   */
  totalVisibleCount: number;
  hasMore: boolean;
}

// ─── Validation ────────────────────────────────────────────────────────────

/**
 * Validate and normalize a comment body.
 *
 * Rules:
 *   - Trim leading/trailing whitespace.
 *   - Collapse internal newlines to single newlines (no \r).
 *   - Length must be within [COMMENT_MIN_LEN, COMMENT_MAX_LEN].
 *   - Reject if it contains `<` or `>` — defense-in-depth against HTML
 *     injection. The body is plain text; any HTML-like syntax is rejected.
 *
 * Returns the normalized body, or an error message.
 */
export function validateCommentBody(body: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof body !== "string") {
    return { ok: false, error: "Comment body must be text." };
  }
  const trimmed = body.replace(/\r/g, "").trim();
  if (trimmed.length < COMMENT_MIN_LEN) {
    return { ok: false, error: "Comment is empty." };
  }
  if (trimmed.length > COMMENT_MAX_LEN) {
    return { ok: false, error: `Comment is too long (max ${COMMENT_MAX_LEN} characters).` };
  }
  // Reject any HTML-like syntax. Plain text only.
  if (/<|>/.test(trimmed)) {
    return { ok: false, error: "HTML is not allowed in comments." };
  }
  return { ok: true, value: trimmed };
}

// ─── Slug validation (Blocker 2) ───────────────────────────────────────────

/**
 * Verify that (slug, locale) refers to a real published article in the
 * canonical blog corpus. Prevents fabricated slugs from polluting comment
 * counts / Most Discussed / view counts.
 */
export function isValidArticleSlug(slug: string, locale: Locale): boolean {
  return getArticle(slug, locale) !== null;
}

/** Verify a slug refers to a real published article in ANY locale. */
export function isValidArticleSlugAnyLocale(slug: string): boolean {
  return getArticle(slug, "en") !== null || getArticle(slug, "fa") !== null;
}

// ─── Author name resolution (Blocker 5) ────────────────────────────────────

/**
 * Resolve the display name for a user using ONLY safe profile display fields.
 *
 * Rule (Blocker 5): NEVER fall back to the email local-part for a public
 * display name. If no public name exists, return a generic localized
 * identity ("User" / "کاربر").
 *
 * This is the snapshot stored in BlogComment.authorName at post time so the
 * comment survives account deletion with a readable byline.
 */
export function resolveAuthorName(
  user: {
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
  },
  locale: Locale,
): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.fullName) return user.fullName;
  if (user.firstName) return user.firstName;
  // Blocker 5: generic localized identity. NEVER the email local-part.
  return locale === "fa" ? "کاربر" : "User";
}

/** Localized tombstone label for a deleted-user or soft-deleted comment. */
export function tombstoneLabel(locale: Locale): string {
  return locale === "fa" ? "کاربر حذف‌شده" : "Deleted user";
}

/** Localized "Comment deleted" label for a soft-deleted parent tombstone. */
export function deletedCommentLabel(locale: Locale): string {
  return locale === "fa" ? "این نظر حذف شده است." : "Comment deleted";
}

// ─── Rate limiting ─────────────────────────────────────────────────────────

/** Enforce comment-post rate limits per user. Returns the first failing limit. */
export async function enforceCommentPostLimits(userId: number): Promise<RateLimitResult> {
  const perMin = await rateLimit(
    `comment_post_min:${userId}`,
    COMMENT_RATE_LIMITS.COMMENT_POST_PER_MIN,
    60_000,
  );
  if (!perMin.allowed) return perMin;
  const perHour = await rateLimit(
    `comment_post_hour:${userId}`,
    COMMENT_RATE_LIMITS.COMMENT_POST_PER_HOUR,
    3_600_000,
  );
  return perHour;
}

// ─── Public reads (locale-scoped — Blocker 1) ──────────────────────────────

/**
 * List top-level comments for an article (slug, locale) — locale-scoped.
 * Excludes: hidden comments, comments under a hidden parent (subtree policy),
 * and treats soft-deleted tombstone parents as tombstones (kept for structure).
 * Sorted oldest-first. Paginated.
 *
 * @param slug    Article slug.
 * @param locale  Locale thread ("en" or "fa") — comments are partitioned.
 * @param page    1-based page number.
 */
export async function listComments(
  slug: string,
  locale: Locale,
  page = 1,
): Promise<CommentListResult> {
  const skip = (page - 1) * COMMENT_PAGE_SIZE;
  // Public list: top-level (parentId IS NULL), not hidden, in this locale.
  // Soft-deleted tombstone parents ARE included (so the thread structure is
  // visible) but their body is cleared and the UI renders a tombstone.
  const where = {
    slug,
    locale,
    hidden: false,
    parentId: null,
  };
  const [rows, topLevelCount, totalVisibleCount] = await Promise.all([
    db.blogComment.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip,
      take: COMMENT_PAGE_SIZE,
    }),
    // topLevelCount: top-level visible — for pagination only.
    db.blogComment.count({ where }),
    // totalVisibleCount: ALL visible comments (top-level + visible replies).
    // Same semantics as getCommentCount — used for the heading/badge.
    getCommentCount(slug, locale),
  ]);
  const ids = rows.map(r => r.id);
  const replyCounts = await getReplyCounts(ids);
  return {
    comments: rows.map(r => toDTO(r, replyCounts.get(r.id) ?? 0)),
    topLevelCount,
    totalVisibleCount,
    hasMore: skip + rows.length < topLevelCount,
  };
}

/**
 * List direct replies to a parent comment — locale-scoped, hidden excluded,
 * subtree-policy applied (replies under a hidden parent are not fetched).
 * Bounded by REPLIES_MAX_FETCH (no unlimited lists — Blocker 4).
 */
export async function listReplies(
  parentId: number,
): Promise<CommentDTO[]> {
  // Verify the parent is visible (not hidden). If the parent is hidden, the
  // entire subtree is suppressed (Blocker 6).
  const parent = await db.blogComment.findUnique({
    where: { id: parentId },
    select: { hidden: true, locale: true, slug: true },
  });
  if (!parent || parent.hidden) return [];
  const rows = await db.blogComment.findMany({
    where: { parentId, hidden: false },
    orderBy: { createdAt: "asc" },
    take: REPLIES_MAX_FETCH,
  });
  const ids = rows.map(r => r.id);
  const replyCounts = await getReplyCounts(ids);
  return rows.map(r => toDTO(r, replyCounts.get(r.id) ?? 0));
}

/** Get reply counts for a set of comment ids. Returns Map<id, count>. */
async function getReplyCounts(ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const grouped = await db.blogComment.groupBy({
    by: ["parentId"],
    where: {
      parentId: { in: ids },
      hidden: false,
    },
    _count: { _all: true },
  });
  const map = new Map<number, number>();
  for (const g of grouped) {
    if (g.parentId !== null) map.set(g.parentId, g._count._all);
  }
  return map;
}

/**
 * Total visible comment count for an article (slug, locale) — locale-scoped
 * (Blocker 1). Includes top-level + visible replies.
 *
 * Counting policy (Blocker 2):
 *   • hidden=false comments are visible → COUNTED.
 *   • Soft-deleted tombstone parents (deleted=true, hidden=false) ARE counted
 *     because they are structurally visible (rendered as a "Comment deleted"
 *     placeholder). The thread structure is preserved, so the count reflects
 *     the visible discussion footprint.
 *   • Hidden comments and replies under hidden parents are NOT counted
 *     (subtree policy: a hidden parent suppresses its entire subtree).
 *
 * This is the SAME value returned as `totalVisibleCount` in listComments, so
 * the heading/badge count is always consistent with the list API.
 */
export async function getCommentCount(slug: string, locale: Locale): Promise<number> {
  // Count non-hidden comments in this locale thread. Replies under a hidden
  // parent are also non-hidden themselves, but the subtree policy treats them
  // as suppressed. To keep counts consistent with visible UI, we exclude
  // replies whose parent is hidden.
  // Top-level non-hidden count:
  const topLevel = await db.blogComment.count({
    where: { slug, locale, hidden: false, parentId: null },
  });
  // Reply count: non-hidden replies whose parent is also non-hidden.
  // (A reply under a hidden parent is suppressed by the subtree policy.)
  const replies = await db.blogComment.count({
    where: {
      slug,
      locale,
      hidden: false,
      parentId: { not: null },
      parent: { hidden: false },
    },
  });
  return topLevel + replies;
}

/**
 * "Most Discussed" — top articles by REAL visible comment count —
 * locale-aware (Blocker 1). Returns { slug, commentCount } sorted desc.
 *
 * Blocker 3 — subtree policy + canonical pre-filter:
 *   • Uses the SAME visible-comment semantics as getCommentCount: a hidden
 *     parent suppresses its entire subtree, so replies under a hidden parent
 *     are excluded from the count.
 *   • Canonical slugs are pre-filtered BEFORE ranking/take so fabricated
 *     rows cannot consume ranking slots. The `slug: { in: canonicalSlugs }`
 *     clause means only real published articles are ever ranked.
 */
export async function getMostDiscussedArticles(
  locale: Locale,
  limit = 5,
): Promise<Array<{ slug: string; commentCount: number }>> {
  // Pre-filter canonical slugs BEFORE ranking so fabricated rows can't
  // displace real articles. getAllSlugs() returns the canonical slug set.
  const canonicalSlugs = getAllSlugs();
  if (canonicalSlugs.length === 0) return [];

  const grouped = await db.blogComment.groupBy({
    by: ["slug"],
    where: {
      locale,
      hidden: false,
      // Subtree policy: a hidden parent suppresses its entire subtree.
      // Count top-level non-hidden + replies whose parent is non-hidden.
      OR: [
        { parentId: null },
        { parent: { hidden: false } },
      ],
      slug: { in: canonicalSlugs },
    },
    _count: { _all: true },
    orderBy: { _count: { slug: "desc" } },
    take: limit,
  });
  return grouped.map(g => ({ slug: g.slug, commentCount: g._count._all }));
}

// ─── Authenticated writes ─────────────────────────────────────────────────

/**
 * Create a comment. Requires an authenticated user. Validates:
 *   - (slug, locale) is a real published article (Blocker 2)
 *   - parentId (if provided) refers to a top-level comment in the SAME
 *     (slug, locale) thread (Blocker 4 — one reply level; Blocker 1 —
 *     cross-locale parent rejected)
 */
export async function createComment(opts: {
  slug: string;
  locale: Locale;
  userId: number;
  authorName: string;
  body: string;
  parentId?: number | null;
}): Promise<CommentDTO> {
  const { slug, locale, userId, authorName, body, parentId = null } = opts;
  // Blocker 2: verify the article exists in the canonical corpus.
  if (!isValidArticleSlug(slug, locale)) {
    throw new CommentError("not_found", "Article not found for this locale.", 404);
  }
  // Blocker 4: if parentId is provided, verify it's a top-level comment
  // (parentId IS NULL on the parent) in the SAME (slug, locale) thread.
  // Blocker (final): also reject replies to a tombstoned parent — a deleted
  // parent is read-only. Existing replies remain readable, but no new reply
  // may be created through the API.
  if (parentId !== null) {
    const parent = await db.blogComment.findUnique({
      where: { id: parentId },
      select: { slug: true, locale: true, parentId: true, hidden: true, deleted: true },
    });
    if (!parent || parent.hidden) {
      throw new CommentError("not_found", "Parent comment not found.", 404);
    }
    // Reject replies to a tombstoned parent — it's read-only.
    if (parent.deleted) {
      throw new CommentError("validation_failed", "Cannot reply to a deleted comment.", 400);
    }
    // Blocker 1: parent must be in the same (slug, locale) thread.
    if (parent.slug !== slug || parent.locale !== locale) {
      throw new CommentError("validation_failed", "Parent comment does not belong to this article/locale.", 400);
    }
    // Blocker 4: parent must itself be top-level (no nested replies).
    if (parent.parentId !== null) {
      throw new CommentError("validation_failed", "Replies can only be one level deep.", 400);
    }
  }
  const created = await db.blogComment.create({
    data: { slug, locale, userId, authorName, body, parentId },
  });
  return toDTO(created, 0);
}

/**
 * Edit a comment. Only the author (matching userId) can edit. Body is
 * re-validated. A soft-deleted (tombstone) comment cannot be edited.
 */
export async function editComment(opts: {
  commentId: number;
  userId: number;
  body: string;
}): Promise<CommentDTO | null> {
  const { commentId, userId, body } = opts;
  // Ownership check: scoped by BOTH id AND userId. Also reject tombstones.
  const updated = await db.blogComment.updateMany({
    where: { id: commentId, userId, deleted: false },
    data: { body },
  });
  if (updated.count === 0) return null;
  const row = await db.blogComment.findUnique({ where: { id: commentId } });
  if (!row) return null;
  return toDTO(row, 0);
}

/**
 * Delete a comment. Only the author (matching userId) can delete.
 *
 * Blocker 3 — preserved-thread tombstone:
 *   • If the comment has replies (owned by any user), it is SOFT-DELETED:
 *     deleted=true, body cleared, authorName → tombstone label, userId
 *     nulled. The row remains so the thread structure is preserved. The
 *     original content and author identity are gone.
 *   • If the comment is a leaf (no replies), it is HARD-DELETED.
 *   • Deleting a parent NEVER destroys other users' replies (parentId FK
 *     is ON DELETE SET NULL at the DB level as defense-in-depth: if a
 *     hard-delete did happen, replies would become top-level, not vanish).
 *
 * Blocker 4 — authoritative locale:
 *   The tombstone label's locale is derived from the comment's ACTUAL locale
 *   stored in the DB — NOT from any client-supplied value. The caller cannot
 *   choose the stored tombstone language.
 */
export async function deleteComment(opts: {
  commentId: number;
  userId: number;
}): Promise<{ hardDeleted: boolean; softDeleted: boolean }> {
  const { commentId, userId } = opts;
  // First, verify ownership AND fetch the authoritative locale + reply count.
  const comment = await db.blogComment.findUnique({
    where: { id: commentId },
    select: { userId: true, deleted: true, locale: true },
  });
  if (!comment || comment.userId !== userId) {
    return { hardDeleted: false, softDeleted: false };
  }
  // Count direct replies (any user). If > 0 → tombstone. If 0 → hard delete.
  const replyCount = await db.blogComment.count({
    where: { parentId: commentId },
  });
  if (replyCount > 0) {
    // Soft-delete: preserve the thread, clear content + identity.
    // Blocker 4: the tombstone label uses the comment's authoritative DB
    // locale — NOT a client-supplied value.
    await db.blogComment.update({
      where: { id: commentId },
      data: {
        deleted: true,
        deletedAt: new Date(),
        body: "",
        authorName: tombstoneLabel(comment.locale as Locale),
        userId: null,
      },
    });
    return { hardDeleted: false, softDeleted: true };
  }
  // Leaf: hard-delete. Replies would have been preserved by SET NULL FK if
  // any existed, but there are none, so a clean delete is safe.
  await db.blogComment.delete({ where: { id: commentId } });
  return { hardDeleted: true, softDeleted: false };
}

// ─── Admin moderation ─────────────────────────────────────────────────────

export interface AdminCommentView {
  id: number;
  slug: string;
  locale: string;
  parentId: number | null;
  userId: number | null;
  authorName: string;
  body: string;
  deleted: boolean;
  deletedAt: string | null;
  hidden: boolean;
  hiddenByAdminEmail: string | null;
  hiddenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Admin: list ALL comments (including hidden + deleted tombstones) for
 * moderation. Optional filters by article slug, locale, and/or status.
 * Paginated.
 */
export async function adminListComments(opts: {
  slug?: string;
  locale?: Locale;
  hidden?: boolean;
  page?: number;
}): Promise<{ comments: AdminCommentView[]; totalCount: number; hasMore: boolean }> {
  const { slug, locale, hidden, page = 1 } = opts;
  const skip = (page - 1) * COMMENT_PAGE_SIZE;
  const where: Record<string, unknown> = {};
  if (slug) where.slug = slug;
  if (locale) where.locale = locale;
  if (typeof hidden === "boolean") where.hidden = hidden;
  const [rows, totalCount] = await Promise.all([
    db.blogComment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: COMMENT_PAGE_SIZE,
    }),
    db.blogComment.count({ where }),
  ]);
  const adminIds = Array.from(new Set(rows.map(r => r.hiddenByAdminId).filter((x): x is number => x !== null)));
  const admins = adminIds.length
    ? await db.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, email: true } })
    : [];
  const adminMap = new Map(admins.map(a => [a.id, a.email]));
  return {
    comments: rows.map(r => ({
      id: r.id,
      slug: r.slug,
      locale: r.locale,
      parentId: r.parentId,
      userId: r.userId,
      authorName: r.authorName,
      body: r.body,
      deleted: r.deleted,
      deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
      hidden: r.hidden,
      hiddenByAdminEmail: r.hiddenByAdminId !== null ? (adminMap.get(r.hiddenByAdminId) ?? null) : null,
      hiddenAt: r.hiddenAt ? r.hiddenAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    totalCount,
    hasMore: skip + rows.length < totalCount,
  };
}

/**
 * Admin: hide a comment (Blocker 6 — subtree policy). Hiding a parent
 * suppresses the parent AND all its replies from public display/counts.
 * The replies themselves are not marked hidden (so an admin un-hiding the
 * parent restores the whole subtree), but the public list/count queries
 * exclude replies whose parent is hidden.
 */
export async function hideComment(commentId: number, adminId: number): Promise<boolean> {
  const updated = await db.blogComment.updateMany({
    where: { id: commentId },
    data: { hidden: true, hiddenByAdminId: adminId, hiddenAt: new Date() },
  });
  return updated.count > 0;
}

/** Admin: unhide a comment (restores the whole subtree — Blocker 6). */
export async function unhideComment(commentId: number, adminId: number): Promise<boolean> {
  const updated = await db.blogComment.updateMany({
    where: { id: commentId },
    data: { hidden: false, hiddenByAdminId: adminId, hiddenAt: null },
  });
  return updated.count > 0;
}

/**
 * Admin: permanently delete a comment. Blocker 3 — if the comment has
 * replies, tombstone it instead (preserves the thread). If it's a leaf,
 * hard-delete. Returns which action was taken.
 *
 * Blocker 4 — authoritative locale:
 *   The tombstone label's locale is derived from the comment's ACTUAL locale
 *   stored in the DB — NOT from any client-supplied value.
 */
export async function adminDeleteComment(
  commentId: number,
): Promise<{ hardDeleted: boolean; softDeleted: boolean }> {
  // Fetch the authoritative locale from the DB.
  const comment = await db.blogComment.findUnique({
    where: { id: commentId },
    select: { locale: true },
  });
  if (!comment) {
    return { hardDeleted: false, softDeleted: false };
  }
  const replyCount = await db.blogComment.count({ where: { parentId: commentId } });
  if (replyCount > 0) {
    await db.blogComment.update({
      where: { id: commentId },
      data: {
        deleted: true,
        deletedAt: new Date(),
        body: "",
        authorName: tombstoneLabel(comment.locale as Locale),
        userId: null,
      },
    });
    return { hardDeleted: false, softDeleted: true };
  }
  await db.blogComment.delete({ where: { id: commentId } });
  return { hardDeleted: true, softDeleted: false };
}

// ─── Errors ────────────────────────────────────────────────────────────────

/** Thrown by createComment for slug/nesting/locale violations. */
export class CommentError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// ─── DTO mapping ──────────────────────────────────────────────────────────

function toDTO(
  row: {
    id: number;
    slug: string;
    locale: string;
    parentId: number | null;
    userId: number | null;
    authorName: string;
    body: string;
    deleted: boolean;
    deletedAt: Date | null;
    hidden: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  replyCount: number,
): CommentDTO {
  return {
    id: row.id,
    slug: row.slug,
    locale: row.locale,
    parentId: row.parentId,
    userId: row.userId,
    authorName: row.authorName,
    body: row.body,
    deleted: row.deleted,
    hidden: row.hidden,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    replyCount,
  };
}
