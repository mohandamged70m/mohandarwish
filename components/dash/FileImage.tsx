"use client";

import { useEffect, useState, type CSSProperties } from "react";

interface Props {
  src: string | File | Blob | null | undefined;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}

// <img> that also accepts File/Blob (object URL, revoked on cleanup).
export default function FileImage({ src, alt = "", className, style }: Props) {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    if (!src || typeof src === "string") {
      setUrl(typeof src === "string" ? src : "");
      return;
    }
    const u = URL.createObjectURL(src);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [src]);

  if (!url) return null;
  return <img src={url} alt={alt} className={className} style={style} loading="lazy" />;
}
