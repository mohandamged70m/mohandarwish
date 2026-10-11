// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../convex/schema';
import { api } from '../convex/_generated/api';
import { Collector } from '../lib/analytics/collect';
const { mutation, query, owner } = vi.hoisted(() => ({ mutation: vi.fn(), query: vi.fn(), owner: { value: false } }));
vi.mock('@/lib/convex', () => ({ convexMutation: mutation, convexQuery: query }));
vi.mock('@/auth', () => ({ auth: () => owner.value ? { user: { email: 'owner@example.com', isOwner: true } } : null }));
vi.mock('@/lib/admin', () => ({ isAdminRequest: () => owner.value }));
vi.mock('@/lib/rate-limit', () => ({ allowRequest: () => true }));
vi.mock('server-only', () => ({}));
import { POST as track } from '../app/api/track/route';
import { POST as data } from '../app/api/data/route';
const modules = import.meta.glob('../convex/**/*.ts');
const serverKey = 'test-key';
let collector: Collector;
beforeEach(() => {
  owner.value = false; process.env.CONVEX_SERVER_KEY = serverKey;
  process.env.DASHBOARD_OWNER_EMAIL = 'owner@example.com';
  delete process.env.RESEND_API_KEY; delete process.env.OWNER_EMAIL;
  sessionStorage.clear(); localStorage.clear();
  vi.spyOn(window.screen, 'width', 'get').mockReturnValue(1440);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});
afterEach(async () => { collector?.stop(); await collector?.flushNow(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('records a real client story through the gateway and Convex, exposes it only to the owner, and deletes it transactionally', async () => {
  const t = convexTest(schema, modules);
  mutation.mockImplementation((ref, args) => t.mutation(ref, { ...args, serverKey }));
  query.mockImplementation((ref, args) => t.query(ref, { ...args, serverKey }));
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => track(new Request('https://site.example/api/track', {
    ...init, signal: undefined, headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 Chrome/130.0' },
  }))));
  collector = new Collector(); collector.start({ section: 'home' });
  collector.projectOpen('reviewkit'); collector.projectOutbound('reviewkit', 'github');
  collector.cvOpen(); collector.contactOpen(); await collector.flushNow();
  expect(fetch).toHaveBeenCalled();
  const directId = collector.id();
  const link = await t.mutation(api.trails.createLink, { serverKey, name: 'Acme', for: 'Website', notify: false });
  collector.restartWithCode(link.code, 'projects'); collector.socialClick('github.com'); await collector.flushNow();
  const linkedId = collector.id();
  const request = (operation: string, args: Record<string, unknown>) => data(new Request('https://site.example/api/data', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://site.example' }, body: JSON.stringify({ operation, args }),
  }));
  expect((await request('listCollection', { prefix: 'Analytics/Sessions/Items' })).status).toBe(401);
  owner.value = true;
  const response = await request('listCollection', { prefix: 'Analytics/Sessions/Items' });
  const rows = (await response.json()).data as Array<{ path: string; data: Record<string, any> }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  expect(rows).toHaveLength(2);
  const direct = rows.find(r => r.path.endsWith(directId))!.data;
  const linked = rows.find(r => r.path.endsWith(linkedId))!.data;
  expect(direct.Link).toBeNull(); expect(direct.Ended).toBe(true);
  expect(direct.Projects.reviewkit).toMatchObject({ Opens: 1, Github: 1 });
  expect(direct.Cv.Opens).toBe(1); expect(direct.Contact.Opens).toBe(1);
  expect(linked.Link).toMatchObject({ Id: link.code, Name: 'Acme', For: 'Website' });
  expect(linked.Socials.GitHub.Clicks).toBe(1);
  const totals = (await (await request('getDoc', { path: 'Analytics/Totals' })).json()).data;
  expect(totals).toMatchObject({ Sessions: 2, LinkOpens: 1, Projects: 1, Cv: 1, Socials: 1 });
  await request('deleteSession', { sessionId: linkedId });
  const after = (await (await request('getDoc', { path: 'Analytics/Totals' })).json()).data;
  expect(after.Sessions).toBe(1); expect(after.LinkOpens).toBe(0);
});
