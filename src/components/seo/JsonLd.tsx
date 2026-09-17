/**
 * Phase 16 — Safe JSON-LD script component.
 *
 * Renders a `<script type="application/ld+json">` tag with serialized
 * structured data. The `<` character is escaped to `\\u003c` via
 * `serializeJsonLd()` to prevent `</script>` breakout.
 *
 * The `data` prop is always a plain object built from source-controlled
 * sources (site URL helper, blog content) — never user-controlled.
 */
import { serializeJsonLd } from "@/lib/seo/json-ld";

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
