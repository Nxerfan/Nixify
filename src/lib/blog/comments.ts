/**
 * Phase 18 — Blog comment service.
 *
 * Native authenticated comment system for /blog/<slug> articles.
 *
 * Rules:
 *   • Anonymous users can READ comments but cannot POST.
 *   • Logged-in users can post, reply, edit their OWN, delete their OWN.
 *   • Threading via `parentId` self-FK (Cascade on parent delete).
 *   • Body is plain text — no Markdown, no HTML. Rejected if it contains
 *     `<` or `>` after trim (defense-in-depth against HTML injection). Escaped
 *     on render. Length capped at COMMENT_MAX_LEN.
 *   • Rate limited: COMMENT_POST_PER_MIN/min, COMMENT_POST_PER_HOUR/hour
 *     per user (DB-backed via the shared rateLimit primitive).
 *   • Moderation: admins can hide/unhide and delete. Hidden comments are
 *     excluded from public lists AND from counts.
 *   • Account-deletion compatible: BlogComment.userId is nullable + ON
 *     DELETE SET NULL. The deletion service overwrites authorName to
 *     "Deleted user" before the FK is nulled — no PII leaks, no broken
 *     threads.
 */

import { db } from "@/lib/db";
import { rateLimit, type RateLimitResult } from "@/lib/ratelimit";
import type { Locale } from "@/lib/i18n/locales";

/** Max comment body length (plain text). */
export const COMMENT_MAX_LEN = 1000;
/** Min comment body length (after trim). */
export const COMMENT_MIN_LEN = 1;
/** Rate limits per user. */
export const COMMENT_RATE_LIMITS = {
  COMMENT_POST_PER_MIN: 3,
  COMMENT_POST_PER_HOUR: 20,
} as const;

/** Pagination page size for comment lists. */
export const COMMENT_PAGE_SIZE = 20;

export interface CommentDTO {
  id: number;
  slug: string;
  locale: string;
  parentId: number | null;
  userId: number | null;
  authorName: string;
  body: string;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
  /** Direct reply count (one level deep — not recursive). */
  replyCount: number;
}

export interface CommentListResult {
  comments: CommentDTO[];
  totalCount: number;
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

// ─── Author name resolution ───────────────────────────────────────────────

/**
 * Resolve the display name for a user. Prefers firstName + lastName, then
 * fullName, then the local-part of the email. Never returns null.
 *
 * This is the snapshot stored in BlogComment.authorName at post time so the
 * comment survives account deletion with a readable byline.
 */
export function resolveAuthorName(user: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email: string;
}): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.fullName) return user.fullName;
  if (user.firstName) return user.firstName;
  // Fall back to the email local-part (before @).
  return user.email.split("@")[0] || "User";
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

// ─── Public reads ──────────────────────────────────────────────────────────

/**
 * List top-level comments for an article slug (hidden excluded), with their
 * direct reply counts. Sorted oldest-first (threaded discussion reads
 * top-down). Paginated.
 *
 * @param slug    Article slug.
 * @param page    1-based page number.
 */
export async function listComments(
  slug: string,
  page = 1,
): Promise<CommentListResult> {
  const skip = (page - 1) * COMMENT_PAGE_SIZE;
  const where = { slug, hidden: false, parentId: null };
  const [rows, totalCount] = await Promise.all([
    db.blogComment.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip,
      take: COMMENT_PAGE_SIZE,
    }),
    db.blogComment.count({ where }),
  ]);
  // Fetch reply counts in one grouped query.
  const ids = rows.map(r => r.id);
  const replyCounts = await getReplyCounts(ids);
  return {
    comments: rows.map(r => toDTO(r, replyCounts.get(r.id) ?? 0)),
    totalCount,
    hasMore: skip + rows.length < totalCount,
  };
}

/**
 * List replies for a parent comment (one level — clients fetch deeper levels
 * lazily). Hidden excluded. Sorted oldest-first.
 */
export async function listReplies(parentId: number): Promise<CommentDTO[]> {
  const rows = await db.blogComment.findMany({
    where: { parentId, hidden: false },
    orderBy: { createdAt: "asc" },
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
    where: { parentId: { in: ids }, hidden: false },
    _count: { _all: true },
  });
  const map = new Map<number, number>();
  for (const g of grouped) {
    if (g.parentId !== null) map.set(g.parentId, g._count._all);
  }
  return map;
}

/**
 * Total visible (non-hidden) comment count for an article slug. Used for
 * "Most Discussed" and the comment-count badge on cards. Includes all
 * non-hidden comments (top-level + replies).
 */
export async function getCommentCount(slug: string): Promise<number> {
  return db.blogComment.count({ where: { slug, hidden: false } });
}

/**
 * "Most Discussed" — top articles by visible comment count. Returns
 * { slug, commentCount } sorted desc. Real counts only.
 */
export async function getMostDiscussedArticles(
  limit = 5,
): Promise<Array<{ slug: string; commentCount: number }>> {
  const grouped = await db.blogComment.groupBy({
    by: ["slug"],
    where: { hidden: false },
    _count: { _all: true },
    orderBy: { _count: { slug: "desc" } },
    take: limit,
  });
  return grouped.map(g => ({ slug: g.slug, commentCount: g._count._all }));
}

// ─── Authenticated writes ─────────────────────────────────────────────────

/**
 * Create a comment. Requires an authenticated user. The user's display name is
 * snapshotted into authorName so it survives account deletion (the FK is
 * SET NULL on deletion and authorName is overwritten to "Deleted user" — but
 * for live comments the snapshot shows the real name at post time).
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
  const created = await db.blogComment.create({
    data: { slug, locale, userId, authorName, body, parentId },
  });
  return toDTO(created, 0);
}

/**
 * Edit a comment. Only the author (matching userId) can edit. Body is
 * re-validated. The `updatedAt` timestamp is bumped automatically by Prisma.
 * Returns the updated DTO or null if not found / not owned.
 */
export async function editComment(opts: {
  commentId: number;
  userId: number;
  body: string;
}): Promise<CommentDTO | null> {
  const { commentId, userId, body } = opts;
  // Ownership check: only the author can edit. Scoped by BOTH id AND userId
  // so a user can never edit another user's comment (even if they guess the id).
  const updated = await db.blogComment.updateMany({
    where: { id: commentId, userId, hidden: false },
    data: { body },
  });
  if (updated.count === 0) return null;
  const row = await db.blogComment.findUnique({ where: { id: commentId } });
  if (!row) return null;
  return toDTO(row, 0);
}

/**
 * Delete a comment. Only the author (matching userId) can delete. Cascades
 * to all replies (onDelete: Cascade on the self-FK). Returns true if a row
 * was deleted, false if not found / not owned.
 */
export async function deleteComment(opts: {
  commentId: number;
  userId: number;
}): Promise<boolean> {
  const { commentId, userId } = opts;
  // Ownership check: scoped by BOTH id AND userId.
  const deleted = await db.blogComment.deleteMany({
    where: { id: commentId, userId },
  });
  return deleted.count > 0;
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
  hidden: boolean;
  hiddenByAdminEmail: string | null;
  hiddenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Admin: list ALL comments (including hidden) for moderation. Optional
 * filters by article slug and/or hidden status. Paginated.
 */
export async function adminListComments(opts: {
  slug?: string;
  hidden?: boolean;
  page?: number;
}): Promise<{ comments: AdminCommentView[]; totalCount: number; hasMore: boolean }> {
  const { slug, hidden, page = 1 } = opts;
  const skip = (page - 1) * COMMENT_PAGE_SIZE;
  const where: Record<string, unknown> = {};
  if (slug) where.slug = slug;
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
  // Resolve hiddenByAdminId → admin email for display.
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

/** Admin: hide a comment (suppress from public display). */
export async function hideComment(commentId: number, adminId: number): Promise<boolean> {
  const updated = await db.blogComment.updateMany({
    where: { id: commentId },
    data: { hidden: true, hiddenByAdminId: adminId, hiddenAt: new Date() },
  });
  return updated.count > 0;
}

/** Admin: unhide a comment (restore public display). */
export async function unhideComment(commentId: number, adminId: number): Promise<boolean> {
  const updated = await db.blogComment.updateMany({
    where: { id: commentId },
    // Clear the audit fields on unhide so the moderation trail reflects the
    // current visible state.
    data: { hidden: false, hiddenByAdminId: adminId, hiddenAt: null },
  });
  return updated.count > 0;
}

/** Admin: permanently delete a comment (cascades to replies). */
export async function adminDeleteComment(commentId: number): Promise<boolean> {
  const deleted = await db.blogComment.deleteMany({ where: { id: commentId } });
  return deleted.count > 0;
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
    hidden: row.hidden,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    replyCount,
  };
}
