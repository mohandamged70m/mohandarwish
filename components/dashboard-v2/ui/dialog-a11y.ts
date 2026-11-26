"use client";

/**
 * Shared keyboard behaviour for every dashboard modal, including ones portaled
 * to document.body: Escape closes, Tab is trapped inside, focus lands on the
 * close control when a dialog opens and returns to the trigger when it closes.
 */
const DIALOG_SELECTOR = '[role="dialog"],[role="alertdialog"],[data-dash-dialog]';
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function topDialog(): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(DIALOG_SELECTOR));
  return nodes.length ? nodes[nodes.length - 1] : null;
}

function visibleFocusables(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  );
}

export function installDashboardDialogA11y(): () => void {
  let previousFocus: HTMLElement | null = null;
  let activeDialog: HTMLElement | null = null;

  const onKeyDown = (event: KeyboardEvent) => {
    const dialog = topDialog();
    if (!dialog) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      const close =
        dialog.querySelector<HTMLElement>('[data-dialog-close]') ||
        dialog.querySelector<HTMLElement>('button[aria-label="Close"]');
      close?.click();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusables = visibleFocusables(dialog);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const sync = () => {
    const dialog = topDialog();
    if (dialog && dialog !== activeDialog) {
      previousFocus = document.activeElement as HTMLElement | null;
      activeDialog = dialog;
      const target =
        dialog.querySelector<HTMLElement>('[data-dialog-close]') ||
        visibleFocusables(dialog)[0];
      target?.focus();
    } else if (!dialog && activeDialog) {
      previousFocus?.focus();
      activeDialog = null;
      previousFocus = null;
    }
  };

  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('keydown', onKeyDown, true);
  return () => {
    observer.disconnect();
    document.removeEventListener('keydown', onKeyDown, true);
  };
}
