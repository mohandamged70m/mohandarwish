"use client";
/* eslint-disable @next/next/no-img-element -- takes File/Blob (object URLs) which the optimizer cannot handle; plain <img> is the only correct element here */

import type { CSSProperties } from "react";
import { useObjectURL } from "@/hooks/useObjectURL";

interface Props {
  src: string | File | Blob | null | undefined;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}

// <img> that also accepts File/Blob via the shared object-URL hook
// (revoked on change/unmount) instead of duplicating its lifecycle.
export default function FileImage({ src, alt = "", className, style }: Props) {
  const url = useObjectURL(src);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} style={style} loading="lazy" />;
}
