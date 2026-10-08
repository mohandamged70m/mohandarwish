type BrandMarkProps = {
  /** Rendered pixel size (square). Defaults to 32. */
  size?: number;
  className?: string;
  /** Accessible label. Omit + set decorative for aria-hidden. */
  title?: string;
  decorative?: boolean;
};

/**
 * MD monogram — inline twin of `public/logo.svg` (keep the two in sync).
 * Ivory M shares its right stem with an ember D bowl; wine beacon diamond
 * above. Fixed brand colors on a black tile, so it reads on either theme.
 */
export function BrandMark({ size = 32, className, title = "Mohand Darwish — home", decorative = false }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : title}
      aria-hidden={decorative || undefined}
      className={className}
    >
      <rect width="512" height="512" rx="112" fill="#0a0a0a" />
      <rect x="30" y="30" width="452" height="452" rx="86" fill="none" stroke="#ad2831" strokeOpacity="0.45" strokeWidth="2" />
      <path d="M256 104 L268 116 L256 128 L244 116 Z" fill="#ad2831" />
      <path d="M278 176 C402 176 402 352 278 352" fill="none" stroke="#e8624a" strokeWidth="30" strokeLinecap="butt" />
      <path d="M110 352 L110 176 L198 290 L286 176 L286 352" fill="none" stroke="#fff7ed" strokeWidth="30" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}
