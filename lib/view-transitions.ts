// Shared View Transition helpers (progressive enhancement).
//
// The app already animates with Motion as its baseline; these helpers add the
// native View Transitions API on top (card -> modal morph, circular theme
// reveal) only when the browser supports it and the user has no
// prefers-reduced-motion. Every helper degrades to a plain synchronous update.

export const MORPH_NAME = "project-morph";

type StartVT = (update: () => void | Promise<void>) => { finished: Promise<void> };

function getStartVT(): StartVT | null {
  if (typeof document === "undefined") return null;
  const fn = (document as Document & { startViewTransition?: unknown }).startViewTransition;
  if (typeof fn !== "function") return null;
  return fn.bind(document) as StartVT;
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function canMorph(): boolean {
  return getStartVT() !== null && !prefersReducedMotion();
}

/** Tag an element as the morph source/target for the next transition. */
export function tagMorph(el: HTMLElement | null): void {
  if (!el) return;
  try {
    el.style.viewTransitionName = MORPH_NAME;
  } catch {
    // non-fatal: transition just won't morph
  }
}

/** Clear a previously tagged morph element. */
export function untagMorph(el: HTMLElement | null): void {
  if (!el) return;
  try {
    el.style.viewTransitionName = "";
  } catch {
    // non-fatal
  }
}

export function findCardMorphImg(projectId: string): HTMLElement | null {
  try {
    return document.querySelector<HTMLElement>(
      `[data-project-card="${CSS.escape(projectId)}"] [data-morph-img]`
    );
  } catch {
    return null;
  }
}

/**
 * Run `update` inside a same-document view transition when possible,
 * otherwise run it synchronously. Resolves when the transition finishes
 * (or immediately on the fallback path).
 */
export function transitionOrUpdate(update: () => void): Promise<void> {
  const start = getStartVT();
  if (!start || prefersReducedMotion()) {
    update();
    return Promise.resolve();
  }
  try {
    return start(update).finished.catch(() => {});
  } catch {
    update();
    return Promise.resolve();
  }
}
