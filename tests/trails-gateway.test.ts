import { beforeEach, expect, it, vi } from 'vitest';
const { mutation, query, allow, session, admin, send } = vi.hoisted(() => ({
  mutation: vi.fn(), query: vi.fn(), allow: vi.fn(), session: { value: null as unknown }, admin: { value: true }, send: vi.fn(),
}));
vi.mock('@/lib/convex', () => ({ convexMutation: mutation, convexQuery: query }));
vi.mock('@/lib/rate-limit', () => ({ allowRequest: allow }));
vi.mock('@/auth', () => ({ auth: () => session.value }));
vi.mock('@/lib/admin', () => ({ isAdminRequest: () => admin.value }));
vi.mock('server-only', () => ({}));
vi.mock('resend', () => ({ Resend: class { emails = { send }; } }));
import { POST } from '../app/api/track/route';
import { POST as drain } from '../app/api/dashboard/trails-outbox/route';
import { GET as health } from '../app/api/dashboard/trails-health/route';
const req = (body: unknown) => new Request('https://site.example/api/track', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 Chrome/130.0' }, body: JSON.stringify(body),
});
const flush = { id: 'abc12345-ef678901', seq: 1, batchId: 'b-gateway1', visitor: 'v-abcdefgh1234', visit: 1, hello: {} };
beforeEach(() => {
  vi.resetAllMocks(); session.value = null; admin.value = true; allow.mockResolvedValue(true);
  process.env.DASHBOARD_OWNER_EMAIL = 'owner@example.com';
  process.env.NEXT_PUBLIC_CONVEX_URL = 'https://test.convex.cloud';
  process.env.CONVEX_SERVER_KEY = 'test-key';
  delete process.env.OWNER_EMAIL; delete process.env.RESEND_API_KEY;
  query.mockResolvedValue({ Link: { Name: 'Acme', For: 'Website' }, Visit: 1 });
  mutation.mockResolvedValue({ status: 'applied', tracked: true, hello: true, seq: 1 });
});
it('forwards linkDropped so the collector can remove deleted attribution', async () => {
  mutation.mockResolvedValue({ status: 'applied', tracked: true, hello: true, linkDropped: true });
  expect(await (await POST(req(flush))).json()).toMatchObject({ ok: true, linkDropped: true });
});
it('keeps unconfigured notifications pending while recording the visit', async () => {
  mutation.mockResolvedValue({ status: 'applied', tracked: true, hello: true, notifyQueued: true });
  expect(await (await POST(req(flush))).json()).toMatchObject({ ok: true, tracked: true });
  expect(mutation).toHaveBeenCalledTimes(1); expect(send).not.toHaveBeenCalled();
});
it.each([{ error: { message: 'provider unavailable' } }, { error: { message: 'You can only send testing emails' } }])('does not mark failed or skipped mail sent: %j', async (result) => {
  process.env.OWNER_EMAIL = 'owner@example.com'; process.env.RESEND_API_KEY = 'test-key';
  send.mockResolvedValue(result);
  mutation.mockResolvedValue({ status: 'applied', tracked: true, hello: true, notifyQueued: true });
  expect(await (await POST(req(flush))).json()).toMatchObject({ ok: true, tracked: true });
  expect(mutation).toHaveBeenCalledTimes(1);
});
it('marks actual deliveries sent using the shared visit deduplication key', async () => {
  process.env.OWNER_EMAIL = 'owner@example.com'; process.env.RESEND_API_KEY = 'test-key';
  send.mockResolvedValue({ data: { id: 'email-id' } });
  mutation.mockResolvedValue({ status: 'applied', tracked: true, hello: true, notifyQueued: true });
  await POST(req(flush));
  expect(send.mock.calls[0][1]).toEqual({ idempotencyKey: `trails-visit-${flush.id}` });
  expect(mutation.mock.calls[1][1]).toEqual({ sessionId: flush.id, status: 'sent' });
  const inline = send.mock.calls[0];
  query.mockResolvedValueOnce([{ _id: 'outbox-id', sessionId: flush.id, linkName: 'Acme', status: 'pending', attempts: 0 }]);
  await drain(new Request('https://site.example/api/dashboard/trails-outbox', { method: 'POST' }));
  expect(send.mock.calls[1]).toEqual(inline); // key AND email payload agree across retries
});
it('reconciles owner counts then returns terminal success to stop the browser', async () => {
  session.value = { user: { email: 'owner@example.com', isOwner: true } };
  expect(await (await POST(req({ ...flush, owner: false }))).json()).toMatchObject({ ok: true, terminal: true, tracked: false, reason: 'owner' });
  expect(mutation.mock.calls[0][1].owner).toBe(true);
});
it('keeps rate limiting retryable', async () => {
  allow.mockResolvedValue(false);
  const response = await POST(req(flush));
  expect(response.status).toBe(429); expect(await response.json()).toMatchObject({ terminal: false });
  expect(mutation).not.toHaveBeenCalled();
});
it('protects the health report from public callers', async () => {
  admin.value = false;
  expect((await health(new Request('https://site.example/api/dashboard/trails-health'))).status).toBe(401);
  expect(query).not.toHaveBeenCalled();
});
it('explains missing configuration without exposing secrets', async () => {
  delete process.env.CONVEX_SERVER_KEY;
  const response = await health(new Request('https://site.example/api/dashboard/trails-health'));
  expect(await response.json()).toMatchObject({ ok: false, checks: { serverKey: false } });
  expect(query).not.toHaveBeenCalled();
});
it('reports an empty but connected store without inventing a write success', async () => {
  query.mockResolvedValueOnce({ sessions: 0, totals: { Sessions: 0 } }).mockResolvedValueOnce(null);
  const response = await health(new Request('https://site.example/api/dashboard/trails-health'));
  expect(await response.json()).toMatchObject({ ok: true, visits: 0, message: 'Visit storage connected' });
  expect(response.headers.get('Cache-Control')).toBe('no-store'); expect(mutation).not.toHaveBeenCalled();
});
it('classifies deployed-function failures and does not leak raw errors', async () => {
  query.mockRejectedValue(new Error('Could not find public function trails:diagnostics secret-value'));
  const data = await (await health(new Request('https://site.example/api/dashboard/trails-health'))).json();
  expect(data.ok).toBe(false); expect(data.message).toContain('Deploy'); expect(JSON.stringify(data)).not.toContain('secret-value');
});
