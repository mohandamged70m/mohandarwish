export * from "./project-utils";

/**
 * The portfolio tags carry their own `iconSvg`, so there is no central icon
 * map to look up. Accept the tech name for call-site compatibility and leave
 * the caller's SVG/dot fallback in charge.
 */
export function getStackIcon(_tech?: string): string {
  return "";
}
