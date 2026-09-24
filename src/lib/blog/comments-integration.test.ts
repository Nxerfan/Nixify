/**
 * Phase 18 — Blog comments real PostgreSQL integration tests.
 *
 * Runs ONLY in CI with:
 *   TEST_DATABASE_URL=<postgres-url> RUN_BLOG_INTEGRATION=1
 *
 * Coverage (Blocker 7):
 *   - authenticated create
 *   - invalid article slug rejected
 *   - EN/FA thread isolation
 *   - cross-locale parent rejected
 *   - reply to wrong article rejected
 *   - excessive nesting rejected (parentId must be top-level)
 *   - edit-own succeeds
 *   - edit-other denied
 *   - delete-own leaf (hard delete)
 *   - deleting parent preserves another user's replies (tombstone — Blocker 3)
 *   - hidden comments excluded correctly
 *   - moderation hide/unhide/delete
 *   - comment counts (locale-scoped, subtree policy)
 *   - pagination
 *   - rate limiting
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import {
  createComment,
  listComments,
  listReplies,
  getCommentCount,
  getMostDiscussedArticles,
  editComment,
  deleteComment,
  hideComment,
  unhideComment,
  adminDeleteComment,
  enforceCommentPostLimits,
  COMMENT_RATE_LIMITS,
  COMMENT_PAGE_SIZE,
  CommentError,
} from "@/lib/blog/comments";

const RUN_BLOG_TESTS =
  process.env.RUN_BLOG_INTEGRATION === "1" && !!process.env.TEST_DATABASE_URL;

describe.skipIf(!RUN_BLOG_TESTS)("Blog Comments DB Integration", () => {
  let userA: { id: number };
  let userB: { id: number };
  let adminId: number;

  beforeEach(async () => {
    // Clean blog comments + comment-post rate-limit buckets on the real
    // canonical slugs BEFORE each test so counts are isolated.
    //
    // Blocker 5 — test isolation: this suite does NOT delete ArticleView rows
    // or blog_view:* rate-limit buckets. Those belong to the view-metrics
    // integration suite and can race when vitest executes files concurrently.
    // Each integration suite is responsible only for its own rows.
    try { await db.blogComment.deleteMany({ where: { slug: { in: ["welcome-to-nixify", "smtp-vs-api-verification", "email-otp-api-for-nextjs", "nixify-vs-building-email-otp-yourself"] } } }); } catch {}
    try { await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "comment_post_" } } }); } catch {}

    userA = await db.user.create({
      data: {
        email: `blog-a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.nixify.dev`,
        passwordHash: "hash",
        emailVerified: true,
        fullName: "User A",
        firstName: "User",
        lastName: "A",
      },
    });
    userB = await db.user.create({
      data: {
        email: `blog-b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.nixify.dev`,
        passwordHash: "hash",
        emailVerified: true,
        fullName: "User B",
      },
    });
    const admin = await db.adminUser.create({
      data: {
        email: `blog-admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.nixify.dev`,
        passwordHash: "admin-hash",
      },
    });
    adminId = admin.id;
  });

  afterEach(async () => {
    // Clean up the real-slug comments + comment-post buckets + users created
    // by this test. Does NOT touch ArticleView or blog_view:* buckets (Blocker 5).
    try { await db.blogComment.deleteMany({ where: { slug: { in: ["welcome-to-nixify", "smtp-vs-api-verification", "email-otp-api-for-nextjs", "nixify-vs-building-email-otp-yourself"] } } }); } catch {}
    try { await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "comment_post_" } } }); } catch {}
    try { await db.user.delete({ where: { id: userA.id } }); } catch {}
    try { await db.user.delete({ where: { id: userB.id } }); } catch {}
    try { await db.adminUser.delete({ where: { id: adminId } }); } catch {}
  });

  // We use a real canonical slug so createComment's slug validation passes.
  const REAL_SLUG = "welcome-to-nixify";

  // ─── Create ──────────────────────────────────────────────────────────────

  it("authenticated create persists a comment (locale-scoped)", async () => {
    const c = await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userA.id,
      authorName: "User A",
      body: "Great article!",
    });
    expect(c.id).toBeDefined();
    expect(c.slug).toBe(REAL_SLUG);
    expect(c.locale).toBe("en");
    expect(c.body).toBe("Great article!");
    expect(c.userId).toBe(userA.id);

    const fetched = await db.blogComment.findUnique({ where: { id: c.id } });
    expect(fetched).not.toBeNull();
    expect(fetched!.locale).toBe("en");
  });

  it("invalid article slug is rejected (Blocker 2)", async () => {
    await expect(
      createComment({
        slug: "totally-fabricated-slug-xyz",
        locale: "en",
        userId: userA.id,
        authorName: "User A",
        body: "test",
      }),
    ).rejects.toThrow(CommentError);
  });

  it("EN/FA thread isolation — an EN comment is NOT visible in the FA list (Blocker 1)", async () => {
    await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userA.id,
      authorName: "User A",
      body: "English comment",
    });
    const enList = await listComments(REAL_SLUG, "en", 1);
    const faList = await listComments(REAL_SLUG, "fa", 1);
    expect(enList.comments.some(c => c.body === "English comment")).toBe(true);
    expect(faList.comments.some(c => c.body === "English comment")).toBe(false);
  });

  it("cross-locale parent is rejected (Blocker 1)", async () => {
    // Create an EN parent.
    const parent = await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userA.id,
      authorName: "User A",
      body: "EN parent",
    });
    // Try to reply to it from the FA thread — must fail.
    await expect(
      createComment({
        slug: REAL_SLUG,
        locale: "fa",
        userId: userB.id,
        authorName: "User B",
        body: "FA reply to EN parent",
        parentId: parent.id,
      }),
    ).rejects.toThrow(CommentError);
  });

  it("reply to a different article's comment is rejected (Blocker 1)", async () => {
    // Parent on REAL_SLUG.
    const parent = await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userA.id,
      authorName: "User A",
      body: "parent on welcome",
    });
    // Reply attempts to attach to a different slug.
    await expect(
      createComment({
        slug: "smtp-vs-api-verification", // different real slug
        locale: "en",
        userId: userB.id,
        authorName: "User B",
        body: "reply on wrong article",
        parentId: parent.id,
      }),
    ).rejects.toThrow(CommentError);
  });

  it("excessive nesting is rejected — parentId must be top-level (Blocker 4)", async () => {
    const parent = await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userA.id,
      authorName: "User A",
      body: "top-level",
    });
    const reply = await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userB.id,
      authorName: "User B",
      body: "first reply",
      parentId: parent.id,
    });
    // Attempt to reply to the reply (depth 2) — must be rejected.
    await expect(
      createComment({
        slug: REAL_SLUG,
        locale: "en",
        userId: userA.id,
        authorName: "User A",
        body: "nested reply (depth 2)",
        parentId: reply.id,
      }),
    ).rejects.toThrow(CommentError);
  });

  // ─── Reject replies to tombstoned parents (final Blocker 1) ───────────────

  it("reply to a tombstoned parent is rejected — deleted parent is read-only", async () => {
    // 1. Create a parent.
    const parent = await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userA.id,
      authorName: "User A",
      body: "parent",
    });
    // 2. Create a reply (so the parent has children → becomes a tombstone on delete).
    const reply = await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userB.id,
      authorName: "User B",
      body: "first reply",
      parentId: parent.id,
    });
    // 3. Delete the parent so it becomes tombstoned.
    await deleteComment({ commentId: parent.id, userId: userA.id });
    const tombstone = await db.blogComment.findUnique({ where: { id: parent.id } });
    expect(tombstone!.deleted).toBe(true);

    // 4. Attempt another reply to the tombstoned parent — must be rejected.
    await expect(
      createComment({
        slug: REAL_SLUG,
        locale: "en",
        userId: userA.id,
        authorName: "User A",
        body: "second reply after tombstone",
        parentId: parent.id,
      }),
    ).rejects.toThrow(CommentError);

    // 5. The original reply still exists (the thread is preserved).
    const survivingReply = await db.blogComment.findUnique({ where: { id: reply.id } });
    expect(survivingReply).not.toBeNull();
    expect(survivingReply!.body).toBe("first reply");
    expect(survivingReply!.userId).toBe(userB.id);
  });

  // ─── Edit ────────────────────────────────────────────────────────────────

  it("edit-own succeeds", async () => {
    const c = await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userA.id,
      authorName: "User A",
      body: "original",
    });
    const updated = await editComment({ commentId: c.id, userId: userA.id, body: "edited" });
    expect(updated).not.toBeNull();
    expect(updated!.body).toBe("edited");
  });

  it("edit-other is denied (server-side ownership check)", async () => {
    const c = await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userA.id,
      authorName: "User A",
      body: "userA's comment",
    });
    // userB tries to edit userA's comment — must return null (not found / not owned).
    const result = await editComment({ commentId: c.id, userId: userB.id, body: "hijacked" });
    expect(result).toBeNull();
    // Verify the body is unchanged (still "userA's comment", not "hijacked").
    const fetched = await db.blogComment.findUnique({ where: { id: c.id } });
    expect(fetched!.body).toBe("userA's comment");
  });

  // ─── Delete (tombstone / preserved-thread — Blocker 3) ───────────────────

  it("delete-own leaf hard-deletes the comment", async () => {
    const c = await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userA.id,
      authorName: "User A",
      body: "leaf",
    });
    const result = await deleteComment({ commentId: c.id, userId: userA.id });
    expect(result.hardDeleted).toBe(true);
    expect(result.softDeleted).toBe(false);
    expect(await db.blogComment.findUnique({ where: { id: c.id } })).toBeNull();
  });

  it("deleting a parent preserves another user's replies (tombstone — Blocker 3)", async () => {
    // userA creates a parent.
    const parent = await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userA.id,
      authorName: "User A",
      body: "parent by userA",
    });
    // userB replies.
    const reply = await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userB.id,
      authorName: "User B",
      body: "reply by userB",
      parentId: parent.id,
    });

    // userA deletes their parent comment.
    const result = await deleteComment({ commentId: parent.id, userId: userA.id });
    // Since the parent has a reply, it must be SOFT-DELETED (tombstoned), not hard-deleted.
    expect(result.softDeleted).toBe(true);
    expect(result.hardDeleted).toBe(false);

    // The parent row still exists (tombstone).
    const tombstone = await db.blogComment.findUnique({ where: { id: parent.id } });
    expect(tombstone).not.toBeNull();
    expect(tombstone!.deleted).toBe(true);
    expect(tombstone!.body).toBe(""); // body cleared
    expect(tombstone!.authorName).toBe("Deleted user"); // localized tombstone
    expect(tombstone!.userId).toBeNull(); // identity unlinked

    // The reply SURVIVES — it is NOT destroyed.
    const survivingReply = await db.blogComment.findUnique({ where: { id: reply.id } });
    expect(survivingReply).not.toBeNull();
    expect(survivingReply!.body).toBe("reply by userB");
    expect(survivingReply!.userId).toBe(userB.id); // still owned by userB
  });

  // ─── Hidden / moderation ─────────────────────────────────────────────────

  it("hidden comments are excluded from the public list (Blocker 6)", async () => {
    const visible = await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userA.id,
      authorName: "User A",
      body: "visible",
    });
    const hidden = await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userB.id,
      authorName: "User B",
      body: "will be hidden",
    });
    await hideComment(hidden.id, adminId);

    const list = await listComments(REAL_SLUG, "en", 1);
    expect(list.comments.some(c => c.id === visible.id)).toBe(true);
    expect(list.comments.some(c => c.id === hidden.id)).toBe(false);
  });

  it("hidden comments are excluded from the locale-scoped count (Blocker 6)", async () => {
    await createComment({ slug: REAL_SLUG, locale: "en", userId: userA.id, authorName: "A", body: "v1" });
    const h = await createComment({ slug: REAL_SLUG, locale: "en", userId: userB.id, authorName: "B", body: "h1" });
    await hideComment(h.id, adminId);
    const count = await getCommentCount(REAL_SLUG, "en");
    expect(count).toBe(1);
  });

  it("moderation hide/unhide/delete works", async () => {
    const c = await createComment({ slug: REAL_SLUG, locale: "en", userId: userA.id, authorName: "A", body: "mod-test" });
    expect(await hideComment(c.id, adminId)).toBe(true);
    expect((await db.blogComment.findUnique({ where: { id: c.id } }))!.hidden).toBe(true);
    expect(await unhideComment(c.id, adminId)).toBe(true);
    expect((await db.blogComment.findUnique({ where: { id: c.id } }))!.hidden).toBe(false);
    // Admin delete of a leaf → hard delete.
    const r = await adminDeleteComment(c.id);
    expect(r.hardDeleted).toBe(true);
    expect(await db.blogComment.findUnique({ where: { id: c.id } })).toBeNull();
  });

  it("admin delete of a parent tombstones it (preserves replies — Blocker 3)", async () => {
    const parent = await createComment({ slug: REAL_SLUG, locale: "en", userId: userA.id, authorName: "A", body: "parent" });
    const reply = await createComment({ slug: REAL_SLUG, locale: "en", userId: userB.id, authorName: "B", body: "reply", parentId: parent.id });
    const r = await adminDeleteComment(parent.id);
    expect(r.softDeleted).toBe(true);
    // Reply survives.
    expect(await db.blogComment.findUnique({ where: { id: reply.id } })).not.toBeNull();
  });

  // ─── Counts + pagination ─────────────────────────────────────────────────

  it("locale-scoped count is correct (Blocker 1)", async () => {
    await createComment({ slug: REAL_SLUG, locale: "en", userId: userA.id, authorName: "A", body: "en1" });
    await createComment({ slug: REAL_SLUG, locale: "en", userId: userB.id, authorName: "B", body: "en2" });
    await createComment({ slug: REAL_SLUG, locale: "fa", userId: userA.id, authorName: "A", body: "fa1" });
    expect(await getCommentCount(REAL_SLUG, "en")).toBe(2);
    expect(await getCommentCount(REAL_SLUG, "fa")).toBe(1);
  });

  it("pagination respects page size", async () => {
    // Create more than COMMENT_PAGE_SIZE top-level comments.
    for (let i = 0; i < COMMENT_PAGE_SIZE + 2; i++) {
      await createComment({ slug: REAL_SLUG, locale: "en", userId: userA.id, authorName: "A", body: `p-${i}` });
    }
    const page1 = await listComments(REAL_SLUG, "en", 1);
    expect(page1.comments.length).toBe(COMMENT_PAGE_SIZE);
    expect(page1.hasMore).toBe(true);
    const page2 = await listComments(REAL_SLUG, "en", 2);
    expect(page2.comments.length).toBe(2);
    expect(page2.hasMore).toBe(false);
  });

  it("replies are bounded (REPLIES_MAX_FETCH)", async () => {
    const parent = await createComment({ slug: REAL_SLUG, locale: "en", userId: userA.id, authorName: "A", body: "parent" });
    // The bound is 50 — create fewer than that and verify they all come back.
    for (let i = 0; i < 3; i++) {
      await createComment({ slug: REAL_SLUG, locale: "en", userId: userB.id, authorName: "B", body: `r-${i}`, parentId: parent.id });
    }
    const replies = await listReplies(parent.id);
    expect(replies.length).toBe(3);
  });

  // ─── Rate limiting ───────────────────────────────────────────────────────

  it("rate limiting blocks posts exceeding the per-minute limit", async () => {
    // Exhaust the per-minute limit first.
    for (let i = 0; i < COMMENT_RATE_LIMITS.COMMENT_POST_PER_MIN; i++) {
      await enforceCommentPostLimits(userA.id);
    }
    // The next call must be blocked.
    const result = await enforceCommentPostLimits(userA.id);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  // ─── Blocker 1 — tombstoned parent reply visibility contract ──────────────

  it("tombstoned parent is structurally visible and replies are expandable (Blocker 1)", async () => {
    const parent = await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userA.id,
      authorName: "User A",
      body: "parent by userA",
    });
    await createComment({
      slug: REAL_SLUG,
      locale: "en",
      userId: userB.id,
      authorName: "User B",
      body: "reply by userB",
      parentId: parent.id,
    });

    // userA deletes the parent → it becomes a tombstone.
    const result = await deleteComment({ commentId: parent.id, userId: userA.id });
    expect(result.softDeleted).toBe(true);

    // The tombstone parent is STILL in the public list (structurally visible).
    const list = await listComments(REAL_SLUG, "en", 1);
    const tombstone = list.comments.find(c => c.id === parent.id);
    expect(tombstone).toBeDefined();
    expect(tombstone!.deleted).toBe(true);
    expect(tombstone!.body).toBe("");
    expect(tombstone!.userId).toBeNull();
    // The reply count is STILL > 0 so "View replies" can be shown.
    expect(tombstone!.replyCount).toBe(1);

    // The reply is STILL fetchable via listReplies.
    const replies = await listReplies(parent.id);
    expect(replies.length).toBe(1);
    expect(replies[0].body).toBe("reply by userB");
    expect(replies[0].userId).toBe(userB.id);
  });

  // ─── Blocker 2 — total visible count includes replies ───────────────────

  it("totalVisibleCount includes top-level + visible replies (Blocker 2)", async () => {
    const parent = await createComment({
      slug: REAL_SLUG, locale: "en", userId: userA.id, authorName: "A", body: "parent",
    });
    await createComment({
      slug: REAL_SLUG, locale: "en", userId: userB.id, authorName: "B", body: "reply1", parentId: parent.id,
    });
    await createComment({
      slug: REAL_SLUG, locale: "en", userId: userA.id, authorName: "A", body: "reply2", parentId: parent.id,
    });

    const list = await listComments(REAL_SLUG, "en", 1);
    // topLevelCount = 1 (just the parent). totalVisibleCount = 3 (parent + 2 replies).
    expect(list.topLevelCount).toBe(1);
    expect(list.totalVisibleCount).toBe(3);
    // getCommentCount must return the SAME value as totalVisibleCount.
    const count = await getCommentCount(REAL_SLUG, "en");
    expect(count).toBe(list.totalVisibleCount);
  });

  it("reply create/delete updates the visible total correctly (Blocker 2)", async () => {
    const parent = await createComment({
      slug: REAL_SLUG, locale: "en", userId: userA.id, authorName: "A", body: "parent",
    });
    // Before reply: total = 1.
    expect((await listComments(REAL_SLUG, "en", 1)).totalVisibleCount).toBe(1);

    // Create a reply → total = 2.
    const reply = await createComment({
      slug: REAL_SLUG, locale: "en", userId: userB.id, authorName: "B", body: "reply", parentId: parent.id,
    });
    expect((await listComments(REAL_SLUG, "en", 1)).totalVisibleCount).toBe(2);

    // Delete the reply (leaf) → total = 1.
    await deleteComment({ commentId: reply.id, userId: userB.id });
    expect((await listComments(REAL_SLUG, "en", 1)).totalVisibleCount).toBe(1);
  });

  it("tombstoned parent still counts in totalVisibleCount (structurally visible)", async () => {
    const parent = await createComment({
      slug: REAL_SLUG, locale: "en", userId: userA.id, authorName: "A", body: "parent",
    });
    await createComment({
      slug: REAL_SLUG, locale: "en", userId: userB.id, authorName: "B", body: "reply", parentId: parent.id,
    });
    // Before delete: total = 2 (parent + reply).
    expect((await listComments(REAL_SLUG, "en", 1)).totalVisibleCount).toBe(2);
    // Soft-delete parent → tombstone is still visible, reply still visible.
    await deleteComment({ commentId: parent.id, userId: userA.id });
    // Total is STILL 2: the tombstone counts (hidden=false) + the reply counts.
    expect((await listComments(REAL_SLUG, "en", 1)).totalVisibleCount).toBe(2);
  });

  // ─── Blocker 3 — hidden-parent subtree excluded from Most Discussed ──────

  it("hidden parent subtree excluded from Most Discussed (Blocker 3)", async () => {
    // Create a parent + reply on REAL_SLUG in EN.
    const parent = await createComment({
      slug: REAL_SLUG, locale: "en", userId: userA.id, authorName: "A", body: "parent",
    });
    await createComment({
      slug: REAL_SLUG, locale: "en", userId: userB.id, authorName: "B", body: "reply", parentId: parent.id,
    });
    // Before hiding: Most Discussed includes REAL_SLUG with count 2.
    const before = await getMostDiscussedArticles("en", 5);
    const beforeEntry = before.find(t => t.slug === REAL_SLUG);
    expect(beforeEntry).toBeDefined();
    expect(beforeEntry!.commentCount).toBe(2); // parent + reply

    // Hide the parent → subtree suppressed.
    await hideComment(parent.id, adminId);

    // Most Discussed must now EXCLUDE the subtree (both parent and reply).
    const after = await getMostDiscussedArticles("en", 5);
    const afterEntry = after.find(t => t.slug === REAL_SLUG);
    // Either REAL_SLUG is absent, or its count is 0 (no visible comments).
    if (afterEntry) {
      expect(afterEntry.commentCount).toBe(0);
    }
    // The visible count must also be 0.
    expect(await getCommentCount(REAL_SLUG, "en")).toBe(0);

    // Unhide the parent → counts/ranking restore correctly.
    await unhideComment(parent.id, adminId);
    const restored = await getMostDiscussedArticles("en", 5);
    const restoredEntry = restored.find(t => t.slug === REAL_SLUG);
    expect(restoredEntry).toBeDefined();
    expect(restoredEntry!.commentCount).toBe(2); // back to parent + reply
  });

  it("fabricated ranking rows cannot displace canonical articles in Most Discussed (Blocker 3)", async () => {
    // Insert many comments on a fabricated slug directly via Prisma.
    for (let i = 0; i < 10; i++) {
      await db.blogComment.create({
        data: { slug: "fabricated-slug-xyz", locale: "en", userId: userA.id, authorName: "A", body: `fake-${i}` },
      });
    }
    // Insert ONE comment on a real slug.
    await createComment({
      slug: REAL_SLUG, locale: "en", userId: userB.id, authorName: "B", body: "real",
    });
    const top = await getMostDiscussedArticles("en", 5);
    // The fabricated slug must NOT appear even though it has 10x more comments.
    expect(top.some(t => t.slug === "fabricated-slug-xyz")).toBe(false);
    // The real slug MUST appear.
    expect(top.some(t => t.slug === REAL_SLUG)).toBe(true);
  });

  // ─── Blocker 4 — authoritative DB locale during user delete ──────────────

  it("user delete: EN comment always gets EN tombstone regardless of caller (Blocker 4)", async () => {
    // Create an EN comment.
    const c = await createComment({
      slug: REAL_SLUG, locale: "en", userId: userA.id, authorName: "User A", body: "EN comment",
    });
    // Add a reply so it becomes a tombstone (not hard-deleted).
    await createComment({
      slug: REAL_SLUG, locale: "en", userId: userB.id, authorName: "User B", body: "reply", parentId: c.id,
    });
    // Delete as userA. deleteComment no longer accepts a locale param — it
    // fetches the locale from the DB.
    await deleteComment({ commentId: c.id, userId: userA.id });
    // The tombstone label MUST be EN ("Deleted user"), not FA.
    const tombstone = await db.blogComment.findUnique({ where: { id: c.id } });
    expect(tombstone!.authorName).toBe("Deleted user");
    expect(tombstone!.authorName).not.toBe("کاربر حذف‌شده");
  });

  it("user delete: FA comment always gets FA tombstone regardless of caller (Blocker 4)", async () => {
    // Create an FA comment.
    const c = await createComment({
      slug: REAL_SLUG, locale: "fa", userId: userA.id, authorName: "User A", body: "FA comment",
    });
    // Add a reply so it becomes a tombstone.
    await createComment({
      slug: REAL_SLUG, locale: "fa", userId: userB.id, authorName: "User B", body: "reply", parentId: c.id,
    });
    // Delete as userA. No locale param — the server uses the DB locale.
    await deleteComment({ commentId: c.id, userId: userA.id });
    // The tombstone label MUST be FA ("کاربر حذف‌شده"), not EN.
    const tombstone = await db.blogComment.findUnique({ where: { id: c.id } });
    expect(tombstone!.authorName).toBe("کاربر حذف‌شده");
  });

  // ─── Blocker 4 — authoritative DB locale during admin delete ─────────────

  it("admin delete: EN comment always gets EN tombstone (Blocker 4)", async () => {
    const c = await createComment({
      slug: REAL_SLUG, locale: "en", userId: userA.id, authorName: "User A", body: "EN comment",
    });
    await createComment({
      slug: REAL_SLUG, locale: "en", userId: userB.id, authorName: "User B", body: "reply", parentId: c.id,
    });
    // adminDeleteComment no longer accepts a locale param — it fetches from DB.
    await adminDeleteComment(c.id);
    const tombstone = await db.blogComment.findUnique({ where: { id: c.id } });
    expect(tombstone!.authorName).toBe("Deleted user");
  });

  it("admin delete: FA comment always gets FA tombstone (Blocker 4)", async () => {
    const c = await createComment({
      slug: REAL_SLUG, locale: "fa", userId: userA.id, authorName: "User A", body: "FA comment",
    });
    await createComment({
      slug: REAL_SLUG, locale: "fa", userId: userB.id, authorName: "User B", body: "reply", parentId: c.id,
    });
    await adminDeleteComment(c.id);
    const tombstone = await db.blogComment.findUnique({ where: { id: c.id } });
    expect(tombstone!.authorName).toBe("کاربر حذف‌شده");
  });
});
