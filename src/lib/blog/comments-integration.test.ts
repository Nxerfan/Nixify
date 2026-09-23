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
    // Clean ALL blog comments + views + rate-limit buckets on the real
    // canonical slugs BEFORE each test so counts are isolated. (The test DB
    // is shared across all integration tests; without this, comments from
    // earlier tests leak into later tests' count assertions.)
    try { await db.blogComment.deleteMany({ where: { slug: { in: ["welcome-to-nixify", "smtp-vs-api-verification", "email-otp-api-for-nextjs", "nixify-vs-building-email-otp-yourself"] } } }); } catch {}
    try { await db.articleView.deleteMany({ where: { slug: { in: ["welcome-to-nixify", "smtp-vs-api-verification", "email-otp-api-for-nextjs", "nixify-vs-building-email-otp-yourself"] } } }); } catch {}
    try { await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "comment_post_" } } }); } catch {}
    try { await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "blog_view:" } } }); } catch {}

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
    // Clean up the real-slug comments + views + users created by this test.
    try { await db.blogComment.deleteMany({ where: { slug: { in: ["welcome-to-nixify", "smtp-vs-api-verification", "email-otp-api-for-nextjs", "nixify-vs-building-email-otp-yourself"] } } }); } catch {}
    try { await db.articleView.deleteMany({ where: { slug: { in: ["welcome-to-nixify", "smtp-vs-api-verification", "email-otp-api-for-nextjs", "nixify-vs-building-email-otp-yourself"] } } }); } catch {}
    try { await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "comment_post_" } } }); } catch {}
    try { await db.rateLimitBucket.deleteMany({ where: { key: { startsWith: "blog_view:" } } }); } catch {}
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
    const result = await deleteComment({ commentId: c.id, userId: userA.id, locale: "en" });
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
    const result = await deleteComment({ commentId: parent.id, userId: userA.id, locale: "en" });
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
    const r = await adminDeleteComment(c.id, "en");
    expect(r.hardDeleted).toBe(true);
    expect(await db.blogComment.findUnique({ where: { id: c.id } })).toBeNull();
  });

  it("admin delete of a parent tombstones it (preserves replies — Blocker 3)", async () => {
    const parent = await createComment({ slug: REAL_SLUG, locale: "en", userId: userA.id, authorName: "A", body: "parent" });
    const reply = await createComment({ slug: REAL_SLUG, locale: "en", userId: userB.id, authorName: "B", body: "reply", parentId: parent.id });
    const r = await adminDeleteComment(parent.id, "en");
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
});
