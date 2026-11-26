"use client";

import type { CSSProperties } from "react";
import { Image as ImageIcon } from "lucide-react";
import FileImageBase from "@/components/dashboard/primitives/FileImage";

interface Props {
  src?: string | File | Blob | null;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  /** StoragePicker's empty state: an icon placeholder when there is no image. */
  size?: number;
}

export default function FileImage({ src, alt, className, style, size }: Props) {
  if (src == null && size != null) {
    return (
      <span
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          color: "var(--text-muted)",
          ...style,
        }}
        aria-hidden
      >
        <ImageIcon size={size} />
      </span>
    );
  }
  return <FileImageBase src={src} alt={alt} className={className} style={style} />;
}
