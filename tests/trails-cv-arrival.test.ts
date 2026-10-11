// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { requestCvOnArrival, useCvArrival } from '../lib/analytics/cv-arrival';
let root: Root;
const open = vi.fn();
function Host({ path }: { path: string }) { useCvArrival(path, open); return null; }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); open.mockReset(); sessionStorage.clear();
  const el = document.createElement('div'); document.body.append(el); root = createRoot(el);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
it('opens once after navigation commits, without relying on the landing remaining mounted', async () => {
  await act(async () => root.render(createElement(Host, { path: '/mohanddarwish/CODE0001' })));
  await act(async () => requestCvOnArrival()); expect(open).not.toHaveBeenCalled();
  await act(async () => root.render(createElement(Host, { path: '/' })));
  expect(open).toHaveBeenCalledTimes(1); expect(sessionStorage.getItem('trails_cv_pending')).toBeNull();
  await act(async () => root.render(createElement(Host, { path: '/' })));
  expect(open).toHaveBeenCalledTimes(1);
});
it('restores a pending request across a remount and Strict Mode', async () => {
  sessionStorage.setItem('trails_cv_pending', String(Date.now()));
  await act(async () => root.render(createElement(StrictMode, null, createElement(Host, { path: '/' }))));
  expect(open).toHaveBeenCalledTimes(1);
});
it('ignores an abandoned old request', async () => {
  sessionStorage.setItem('trails_cv_pending', String(Date.now() - 60_000));
  await act(async () => root.render(createElement(Host, { path: '/' })));
  expect(open).not.toHaveBeenCalled();
});
