-- ============================================================================
-- Phase 18: Blog Comments + Article View Metrics
-- ============================================================================
-- Adds two new tables:
--   1. "BlogComment"  — native authenticated comment system for /blog/<slug>
--   2. "ArticleView"  — per-view metric rows for real article view counts
--
-- Both carry a NULLABLE "userId" with ON DELETE SET NULL so that account
-- deletion preserves comment threads (anonymized) and view-count aggregates
-- (a view is a fact about the article, not the viewer). No broken FKs and no
-- deleted-user PII leakage. The application-layer deletion service overwrites
-- BlogComment.authorName to "Deleted user" before nulling the FK.
-- ============================================================================

-- ---- BlogComment -----------------------------------------------------------
CREATE TABLE "BlogComment" (
    "id"              SERIAL       NOT NULL,
    "slug"            TEXT         NOT NULL,
    "locale"          TEXT         NOT NULL,
    "parentId"        INTEGER,
    "userId"          INTEGER,
    "authorName"      TEXT         NOT NULL,
    "body"            TEXT         NOT NULL,
    "hidden"          BOOLEAN      NOT NULL DEFAULT false,
    "hiddenByAdminId" INTEGER,
    "hiddenAt"        TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogComment_pkey" PRIMARY KEY ("id")
);

-- Self-referential threading FK: replies cascade with their parent.
ALTER TABLE "BlogComment"
  ADD CONSTRAINT "BlogComment_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "BlogComment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Authorship FK: nullable + ON DELETE SET NULL. The deletion service
-- overwrites authorName BEFORE the user row is removed, so the comment
-- survives with an anonymized byline and a null FK (no broken reference).
ALTER TABLE "BlogComment"
  ADD CONSTRAINT "BlogComment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BlogComment_slug_hidden_createdAt_idx"
  ON "BlogComment" ("slug", "hidden", "createdAt");
CREATE INDEX "BlogComment_userId_idx" ON "BlogComment" ("userId");
CREATE INDEX "BlogComment_parentId_idx" ON "BlogComment" ("parentId");

-- ---- ArticleView -----------------------------------------------------------
CREATE TABLE "ArticleView" (
    "id"        SERIAL       NOT NULL,
    "slug"      TEXT         NOT NULL,
    "userId"    INTEGER,
    "ipHash"    TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleView_pkey" PRIMARY KEY ("id")
);

-- Viewer FK: nullable + ON DELETE SET NULL. View rows are facts about the
-- article; deleting a user nulls their past view rows but preserves counts.
ALTER TABLE "ArticleView"
  ADD CONSTRAINT "ArticleView_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ArticleView_slug_createdAt_idx" ON "ArticleView" ("slug", "createdAt");
CREATE INDEX "ArticleView_userId_idx" ON "ArticleView" ("userId");
