/**
 * Phase 12 — `Ltr` inline component for technical content in RTL pages.
 *
 * Wraps technical content (emails, URLs, API keys, OTP codes, message IDs,
 * dates with Latin digits) with `dir="ltr"` and `unicode-bidi: isolate` so
 * that it renders correctly when embedded inside an RTL (`fa`) page.
 *
 * Without this, mixed-direction content can cause the browser's bidirectional
 * algorithm to flip punctuation and reorder adjacent text in confusing ways.
 *
 * Usage:
 *   ```tsx
 *   <p>
 *     Your API key is <Ltr>{apiKey}</Ltr> — keep it secret.
 *   </p>
 *   ```
 *
 * This component is a SPAN (inline). It does not introduce a block boundary.
 *
 * DO NOT use this for natural-language Persian or English copy — only for
 * technical strings (identifiers, codes, Latin-digit numbers, URLs, emails,
 * HTTP statuses, ISO timestamps, JSON keys).
 */

import * as React from "react";

export interface LtrProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
}

export function Ltr({ children, className, ...rest }: LtrProps) {
  return (
    <span
      dir="ltr"
      className={className}
      style={{ unicodeBidi: "isolate" }}
      {...rest}
    >
      {children}
    </span>
  );
}

export default Ltr;
