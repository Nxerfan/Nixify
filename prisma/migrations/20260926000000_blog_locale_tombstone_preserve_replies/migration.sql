-- ============================================================================
-- Phase 18 blocker fixes: locale-scoped threads, tombstones, preserved replies
-- ============================================================================
-- This migration amends the BlogComment table created by
-- 20260925000000_add_blog_comments_article_views to:
--
--   1. Add `deleted` (tombstone flag) + `deletedAt` columns. A soft-deleted
--      parent keeps its row so the thread structure is preserved, but its
--      body is cleared and authorName is overwritten to a neutral tombstone.
--   2. Change the `parentId` self-FK from ON DELETE CASCADE to
--      ON DELETE SET NULL so that deleting a parent does NOT destroy other
--      users' replies — their parentId is nulled and they become top-level.
--   3. Drop the old (slug, hidden, createdAt) index and add the locale-aware
--      (slug, locale, hidden, createdAt) composite index so EN and FA
--      threads are partitioned efficiently.
--
-- No data is lost; the new columns default to false / NULL so existing rows
-- are treated as live (not deleted) and remain visible.
-- ============================================================================

-- ---- 1. Tombstone columns -------------------------------------------------
ALTER TABLE "BlogComment" ADD COLUMN "deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BlogComment" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- ---- 2. parentId FK: CASCADE → SET NULL (preserve replies on parent delete)
--        Blocker 3: deleting a parent must NOT erase other users' replies.
ALTER TABLE "BlogComment" DROP CONSTRAINT IF EXISTS "BlogComment_parentId_fkey";
ALTER TABLE "BlogComment" ADD CONSTRAINT "BlogComment_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "BlogComment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---- 3. Locale-aware composite index (Blocker 1) -------------------------
--        Public list query is now WHERE slug=? AND locale=? AND hidden=false
--        AND parentId IS NULL ORDER BY createdAt ASC.
DROP INDEX IF EXISTS "BlogComment_slug_hidden_createdAt_idx";
CREATE INDEX "BlogComment_slug_locale_hidden_createdAt_idx"
  ON "BlogComment" ("slug", "locale", "hidden", "createdAt");
