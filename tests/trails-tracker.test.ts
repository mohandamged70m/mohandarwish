// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://portfolio.example"}
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { recorder, nav } = vi.hoisted(() => ({
  nav: { path: '/' },
  recorder: { start: vi.fn(), stop: vi.fn(), restartWithCode: vi.fn(), isRunning: vi.fn(() => true), currentSessionId: vi.fn(() => 'visit-id'), projectOpen: vi.fn(), projectClose: vi.fn(), setSection: vi.fn(), cvOpen: vi.fn(), socialClick: vi.fn(), contactOpen: vi.fn() },
}));
vi.mock('next/navigation', () => ({ usePathname: () => nav.path }));
vi.mock('@/lib/analytics/collect', () => ({ analytics: recorder }));
import { TrailsTracker } from '../components/dashboard/TrailsTracker';
let root: Root;
let host: HTMLElement;
let observed: Element[];
beforeEach(() => {
  vi.clearAllMocks(); nav.path = '/'; observed = [];
  sessionStorage.clear(); localStorage.clear();
  window.history.replaceState({}, '', '/');
  document.body.innerHTML = ''; host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
  vi.stubGlobal('IntersectionObserver', class {
    observe(el: Element) { observed.push(el); }
    unobserve() {} disconnect() {} takeRecords() { return []; }
  });
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });
const render = () => act(async () => root.render(createElement(TrailsTracker)));
it('starts a direct visit once and registers streamed sections arriving later', async () => {
  await render(); expect(recorder.start).toHaveBeenCalledTimes(1);
  expect(recorder.start.mock.calls[0][0].code).toBeUndefined();
  const hero = document.createElement('section'); hero.id = 'hero';
  await act(async () => { document.body.append(hero); });
  expect(observed).toContain(hero);
});
it('uses the latest link handoff while the owner check is in flight', async () => {
  let release!: (r: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>(r => { release = r; }));
  await render();
  const bridge = (window as unknown as { __trails: { track: (k: string, v: string) => void } }).__trails;
  bridge.track('link', JSON.stringify({ Id: 'CODE0002', Name: 'Acme', For: 'Website' }));
  await act(async () => { release(new Response('{}')); });
  expect(recorder.start).toHaveBeenCalledTimes(1);
  expect(recorder.start.mock.calls[0][0].code).toBe('CODE0002');
});
it('tracks an initial project and closes it when navigating home', async () => {
  nav.path = '/projects/reviewkit'; window.history.replaceState({}, '', nav.path);
  await render(); expect(recorder.projectOpen).toHaveBeenCalledTimes(1);
  expect(recorder.projectOpen).toHaveBeenCalledWith('reviewkit');
  nav.path = '/'; await render(); expect(recorder.projectClose).toHaveBeenCalledTimes(1);
});
it('keeps owners and private dashboard pages out of tracking', async () => {
  nav.path = '/dashboard'; window.history.replaceState({}, '', nav.path);
  await render(); expect(recorder.start).not.toHaveBeenCalled();
});
it('does not start for an authenticated owner', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ user: { isOwner: true } })));
  await render(); expect(recorder.start).not.toHaveBeenCalled();
});
it('captures tracked clicks even when a modal stops bubbling', async () => {
  await render();
  const modal = document.createElement('div'); modal.addEventListener('click', e => e.stopPropagation());
  const button = document.createElement('button'); button.dataset.track = 'cv'; modal.append(button); document.body.append(modal);
  button.click(); expect(recorder.cvOpen).toHaveBeenCalledTimes(1);
  const social = document.createElement('a'); social.dataset.track = 'social'; social.dataset.name = 'GitHub'; social.href = 'https://github.com/example'; document.body.append(social);
  social.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  expect(recorder.socialClick).toHaveBeenCalledWith('GitHub');
});
