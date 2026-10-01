import type { ReactNode } from "react";

/**
 * Renders a JSON-LD graph from a Server Component.
 *
 * Uses a native `<script type="application/ld+json">` (per the Next.js JSON-LD
 * guide — `next/script` is for executable code, not structured data) and
 * scrubs `<` to `<` so a value containing markup can never break out of the
 * script tag.
 */
export function JsonLd({ data }: { data: unknown }): ReactNode {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
