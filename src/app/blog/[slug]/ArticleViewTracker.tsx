"use client";

import { useEffect, useRef } from "react";

/**
 * Client view-tracker — fires a single POST /api/blog/views on mount to record
 * a real, deduped view. The server dedupes by (ipHash, slug) per 30-min window
 * so rapid refreshes don't inflate counts.
 *
 * Uses a ref guard so React 18+ StrictMode double-invoke of effects doesn't
 * fire the request twice (the server dedups anyway, but this avoids the extra
 * network round-trip).
 */
export function ArticleViewTracker({ slug }: { slug: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    // Fire-and-forget — we don't need to await or handle the result. The
    // server records the view (or ignores it if deduped).
    fetch("/api/blog/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {
      // Network failure / 5xx — ignore. Views are best-effort.
    });
  }, [slug]);

  return null;
}
