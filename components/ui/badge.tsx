import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant = "default" | "accent" | "soft";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-bg-surface border border-border text-text-secondary",
  accent: "bg-accent text-text-on-accent border border-transparent",
  soft: "bg-accent-soft text-accent-soft-text border border-transparent",
};

export function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
}): ReactNode {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium font-heading border ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
