// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Collector } from '../lib/analytics/collect';

const collectors: Collector[] = [];
let bodies: Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
const reply = (body = { ok: true, hello: true, tracked: true }) => new Response(JSON.stringify(body), { status: 200 });
function create(code = '') {
  const c = new Collector();
  collectors.push(c);
  c.start({ section: 'home', code });
  return c;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-11T12:00:00Z'));
  vi.spyOn(window.screen, 'width', 'get').mockReturnValue(1440);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  localStorage.clear(); sessionStorage.clear();
  bodies = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return reply();
  }));
});
afterEach(async () => {
  for (const c of collectors.splice(0)) c.stop();
  await Promise.resolve();
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});
it('opens direct visits and awaits the in-flight flush', async () => {
  let release!: (r: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return await new Promise<Response>(resolve => { release = resolve; });
  });
  const c = create();
  let finished = false;
  const flushing = c.flushNow().then(() => { finished = true; });
  await Promise.resolve();
  expect(finished).toBe(false);
  release(reply()); await flushing;
  expect(bodies[0].hello.entry.Section).toBe('home');
  expect(bodies[0].hello.code).toBeUndefined();
  expect(sessionStorage.getItem('trails_sid_hello')).toBe('1');
});
it('retries an immutable batch after a lost response without double-counting', async () => {
  vi.mocked(fetch).mockImplementationOnce(async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    throw new Error('offline');
  });
  const c = create('CODE0001');
  await Promise.resolve(); await Promise.resolve();
  c.cvOpen();
  await vi.advanceTimersByTimeAsync(2100);
  await c.flushNow();
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies.slice(2).reduce((n, b) => n + b.add.cvOpens, 0)).toBe(1);
});
it('keeps old queued counters and orders the ending before a new link opening', async () => {
  let release!: (r: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return await new Promise<Response>(r => { release = r; });
  });
  const c = create('CODE0001');
  const old = c.id(); c.cvOpen(); c.restartWithCode('CODE0002', 'projects');
  const next = c.id(); expect(next).not.toBe(old);
  release(reply()); await c.flushNow();
  const ending = bodies.findIndex(b => b.id === old && b.end);
  const opening = bodies.findIndex(b => b.id === next && b.hello);
  expect(ending).toBeGreaterThan(0); expect(opening).toBeGreaterThan(ending);
  expect(bodies[ending].add.cvOpens).toBe(1);
  expect(bodies[opening].seq).toBe(1);
  expect(bodies[opening].hello.code).toBe('CODE0002');
  expect(sessionStorage.getItem('trails_sid')).toBe(next);
  expect(sessionStorage.getItem('trails_sid_ended')).not.toBe('1');
});
it('stops for a successful HTTP terminal owner response', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(reply({ ok: true, terminal: true, reason: 'owner', hello: true, tracked: false } as never));
  const c = create(); await c.flushNow();
  expect(c.isRunning()).toBe(false);
  const count = vi.mocked(fetch).mock.calls.length;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetch).toHaveBeenCalledTimes(count);
});
it('drops stale attribution and continues the direct visit', async () => {
  sessionStorage.setItem('trails_link', JSON.stringify({ Id: 'DELETED1' }));
  sessionStorage.setItem('trails_tailor', 'old greeting');
  vi.mocked(fetch).mockResolvedValueOnce(reply({ ok: true, hello: true, tracked: true, linkDropped: true } as never));
  const c = create('DELETED1'); await c.flushNow();
  expect(c.isRunning()).toBe(true);
  expect(sessionStorage.getItem('trails_link')).toBeNull();
  expect(sessionStorage.getItem('trails_tailor')).toBeNull();
  expect(sessionStorage.getItem('trails_sid_code')).toBe('');
});
it('does not end a bfcache visit or a cancelled beforeunload', async () => {
  const c = create(); await c.flushNow();
  window.dispatchEvent(new Event('beforeunload'));
  window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
  await c.flushNow();
  expect(bodies.some(b => b.end)).toBe(false);
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  expect(c.id()).toBe(sessionStorage.getItem('trails_sid'));
  window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
  expect(sessionStorage.getItem('trails_sid_ended')).toBe('1');
});
it('counts project opens once and stops project time on close', async () => {
  const c = create(); await c.flushNow();
  c.projectOpen('reviewkit'); c.projectOpen('reviewkit');
  await vi.advanceTimersByTimeAsync(3000);
  c.projectClose(); await vi.advanceTimersByTimeAsync(4000); await c.flushNow();
  const projects = bodies.map(b => b.add.projects.reviewkit).filter(Boolean);
  expect(projects.reduce((n, p) => n + p.opens, 0)).toBe(1);
  expect(projects.reduce((n, p) => n + p.ms, 0)).toBe(3000);
});
it('rolls over after 30 minutes without input and does not treat idle ticks as activity', async () => {
  const c = create(); await c.flushNow(); const old = c.id();
  await vi.advanceTimersByTimeAsync(31 * 60_000);
  expect(Number(sessionStorage.getItem('trails_sid_at'))).toBeLessThan(Date.now() - 29 * 60_000);
  window.dispatchEvent(new Event('pointerdown')); await c.flushNow();
  expect(c.id()).not.toBe(old);
  expect(bodies.some(b => b.id === old && b.end)).toBe(true);
});
it('ignores rapid clicks on ordinary reading content', async () => {
  const c = create(); await c.flushNow();
  const text = document.createElement('p'); document.body.append(text);
  for (let i = 0; i < 3; i++) text.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await c.flushNow();
  expect(bodies.reduce((n, b) => n + b.add.rage, 0)).toBe(0);
});

it('repairs an invalid persisted visitor identity before starting', async () => {
  localStorage.setItem('trails_vid', 'old-unsupported-format');
  localStorage.setItem('trails_visits', 'broken');
  const c = create(); await c.flushNow();
  expect(bodies[0].visitor).toMatch(/^v-[a-z0-9]{12}$/);
  expect(bodies[0].visit).toBe(1);
});
it('keeps a queued scroll snapshot immutable while the live page scrolls', async () => {
  let release!: (r: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return await new Promise<Response>(r => { release = r; });
  });
  const c = create();
  const el = document.documentElement;
  vi.spyOn(el, 'scrollHeight', 'get').mockReturnValue(2000);
  vi.spyOn(el, 'clientHeight', 'get').mockReturnValue(1000);
  el.scrollTop = 500; document.dispatchEvent(new Event('scroll'));
  expect(JSON.parse(sessionStorage.getItem('trails_queue')!)[0].body.set.scroll).toEqual({});
  release(reply()); await c.flushNow();
  expect(bodies[0].set.scroll).toEqual({});
  expect(bodies.at(-1)?.set.scroll.home).toBeGreaterThan(0);
});
