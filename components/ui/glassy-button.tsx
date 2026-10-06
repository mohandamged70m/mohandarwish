import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, Ref } from "react";

type Base = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** React 19 ref-as-prop — forwarded to the underlying <button> via {...rest}. */
  ref?: Ref<HTMLButtonElement>;
};

const cls = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/** Frosted circle icon button (modal close, gallery arrows). Add `danger` for red hover. */
export function GlassCircleButton({ children, danger, className, ...rest }: Base & { danger?: boolean }) {
  return <button {...rest} className={cls("glass-btn glass-btn-circle", danger && "danger", className)}>{children}</button>;
}

/** Big frosted play/pause button centered over videos. */
export function GlassPlayButton({ children, className, ...rest }: Base) {
  return <button {...rest} aria-label="Play video" className={cls("glass-btn glass-btn-play", className)}>{children}</button>;
}

/** Frosted hub bar grouping icon buttons (mute / fullscreen / play). */
export function GlassHub({ children, className, ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cls("glass-btn glass-btn-hub", className)}>{children}</div>;
}

/** Frosted pill tag. Use `dark` for white-text-on-dark pills. */
export function GlassPill({ children, dark, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return <span className={cls("glass-pill", dark && "dark", className)}>{children}</span>;
}

/** Frosted filter chip with accent active state. */
export function GlassChip({ children, active, className, ...rest }: Base & { active?: boolean }) {
  return <button {...rest} className={cls("glass-chip", active && "active", className)}>{children}</button>;
}

/** Frosted subnav tab bar. Pass buttons with `active` class for the current tab. */
export function GlassSubnav({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cls("glass-subnav", className)}>{children}</div>;
}
