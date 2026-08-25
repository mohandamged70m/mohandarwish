import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }): ReactNode {
  return (
    <div
      className={`bg-bg-surface border border-border rounded-md p-6 transition-colors hover:border-border-strong hover:bg-bg-surface-hover ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { children: ReactNode }): ReactNode {
  return (
    <h3
      className={`font-heading font-semibold text-lg text-text-primary ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }): ReactNode {
  return (
    <p className={`font-body text-sm text-text-secondary ${className}`} {...props}>
      {children}
    </p>
  );
}
