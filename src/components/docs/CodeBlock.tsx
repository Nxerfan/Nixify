"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * Copy-to-clipboard code block used by the /docs and /examples pages.
 *
 * Client component because it uses clipboard + state. The parent page is a
 * server component — this is the standard Next.js server/client split.
 */
export function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — no-op
    }
  }

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-border bg-muted/40">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground/70">{label}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre dir="ltr" className="overflow-auto p-3 text-xs leading-relaxed text-muted-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}
