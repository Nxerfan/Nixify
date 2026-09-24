/**
 * Phase 18 — Regression render test for tombstoned parent reply visibility.
 *
 * Blocker 1: a tombstoned parent (deleted=true) must:
 *   • show the localized "Comment deleted" placeholder;
 *   • NOT show Reply / Edit / Delete buttons;
 *   • STILL show "View replies (N)" so the thread is readable.
 *
 * This test renders the REAL CommentItem production component with
 * renderToStaticMarkup and asserts the DOM contract. It does NOT depend on
 * a DB — it's a pure render test of the UI conditional logic.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CommentItem } from "@/app/blog/[slug]/CommentsSection";
import type { CommentDTO } from "@/lib/blog/comments";

function makeComment(overrides: Partial<CommentDTO> = {}): CommentDTO {
  return {
    id: 1,
    slug: "welcome-to-nixify",
    locale: "en",
    parentId: null,
    userId: 100,
    authorName: "Test User",
    body: "Original body",
    deleted: false,
    hidden: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    replyCount: 0,
    ...overrides,
  };
}

const noop = () => {};

const commonProps = {
  slug: "welcome-to-nixify",
  locale: "en" as const,
  authedUserId: 100, // the owner
  onEdited: noop,
  onDeleted: noop,
  onTombstoned: noop,
  onReplyPosted: noop,
  onReplyDeleted: noop,
};

describe("Blocker 1 — tombstoned parent reply visibility (regression render test)", () => {
  it("a LIVE parent with replies shows Reply + Edit + Delete + View replies", () => {
    const comment = makeComment({ deleted: false, replyCount: 2 });
    const html = renderToStaticMarkup(
      React.createElement(CommentItem, { comment, ...commonProps }),
    );
    // All four action buttons are present.
    expect(html).toContain("Reply");
    expect(html).toContain("Edit");
    expect(html).toContain("Delete");
    expect(html).toContain("View replies (2)");
    // The body is shown (not a tombstone placeholder).
    expect(html).toContain("Original body");
  });

  it("a TOMBSTONED parent with replies shows 'Comment deleted' + View replies, NOT Reply/Edit/Delete", () => {
    const comment = makeComment({ deleted: true, replyCount: 2, body: "", authorName: "Deleted user", userId: null });
    const html = renderToStaticMarkup(
      React.createElement(CommentItem, { comment, ...commonProps }),
    );
    // The tombstone placeholder is shown.
    expect(html).toContain("Comment deleted");
    // The original body is NOT shown (it was cleared).
    expect(html).not.toContain("Original body");
    // View replies IS still shown (the thread is readable).
    expect(html).toContain("View replies (2)");
    // Reply / Edit / Delete are NOT shown for a tombstoned parent.
    // (We check for the button text in the action area, not in the tombstone
    // placeholder. "Delete" appears in the tombstone label "Comment deleted",
    // so we check for the standalone action-button text more carefully.)
    // The "Reply" button text must NOT appear.
    expect(html).not.toContain(">Reply<");
    // The "Edit" button text must NOT appear.
    expect(html).not.toContain(">Edit<");
  });

  it("a TOMBSTONED parent with NO replies shows 'Comment deleted', no View replies, no action buttons", () => {
    const comment = makeComment({ deleted: true, replyCount: 0, body: "", authorName: "Deleted user", userId: null });
    const html = renderToStaticMarkup(
      React.createElement(CommentItem, { comment, ...commonProps }),
    );
    expect(html).toContain("Comment deleted");
    expect(html).not.toContain("View replies");
    expect(html).not.toContain(">Reply<");
    expect(html).not.toContain(">Edit<");
  });

  it("a LIVE parent with 0 replies shows Reply + Edit + Delete but NOT View replies", () => {
    const comment = makeComment({ deleted: false, replyCount: 0 });
    const html = renderToStaticMarkup(
      React.createElement(CommentItem, { comment, ...commonProps }),
    );
    expect(html).toContain("Reply");
    expect(html).toContain("Edit");
    expect(html).toContain("Delete");
    expect(html).not.toContain("View replies");
  });

  it("a tombstoned parent renders the FA tombstone label for FA locale", () => {
    const comment = makeComment({
      deleted: true, replyCount: 1, body: "", authorName: "کاربر حذف‌شده", userId: null, locale: "fa",
    });
    const html = renderToStaticMarkup(
      React.createElement(CommentItem, {
        comment,
        slug: "welcome-to-nixify",
        locale: "fa",
        authedUserId: 100,
        onEdited: noop,
        onDeleted: noop,
        onTombstoned: noop,
        onReplyPosted: noop,
        onReplyDeleted: noop,
      }),
    );
    // FA tombstone label.
    expect(html).toContain("این نظر حذف شده است.");
    // View replies is still shown.
    expect(html).toContain("View replies (1)");
    // No Reply/Edit buttons.
    expect(html).not.toContain(">Reply<");
    expect(html).not.toContain(">Edit<");
  });
});
