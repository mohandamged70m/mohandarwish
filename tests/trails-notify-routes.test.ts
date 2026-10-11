import { beforeEach, expect, it, vi } from "vitest";

const { mutation, query } = vi.hoisted(() => ({
  mutation: vi.fn(),
  query: vi.fn(),
}));
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/convex", () => ({
  convexMutation: mutation,
  convexQuery: query,
}));
vi.mock("@/lib/admin", () => ({
  isAdminRequest: () => Promise.resolve(true),
}));
vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: vi.fn(() => ({ emails: { send } })),
}));
import { GET, POST } from "../app/api/dashboard/trails-outbox/route";

beforeEach(() => {
  vi.resetAllMocks();
  query.mockResolvedValue({ Link: { Name: "Acme", For: "Website" }, Visit: 1 });
  process.env.OWNER_EMAIL = "owner@example.com";
  process.env.RESEND_API_KEY = "key";
});

const row = (over: Record<string, unknown> = {}) => ({
  _id: "outbox-1",
  sessionId: "abc12345-ef678901",
  linkCode: "CODE1234",
  linkName: "Acme",
  status: "pending",
  attempts: 0,
  createdAt: 1700000000000,
  ...over,
});

function req(method: string) {
  return new Request("https://site.example/api/dashboard/trails-outbox", { method });
}

it("reports the backlog and recent per-link status", async () => {
  query
    .mockResolvedValueOnce([row()])
    .mockResolvedValueOnce([row(), row({ _id: "outbox-2", status: "sent" })]);
  const res = await GET(req("GET"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.pending).toBe(1);
  expect(body.recent).toHaveLength(2);
  expect(body.recent[0]).toMatchObject({ linkCode: "CODE1234", status: "pending" });
});

it("sends due rows with stable idempotency keys and marks them sent", async () => {
  query.mockResolvedValueOnce([row()]);
  send.mockResolvedValue({ data: { id: "mail-1" } });
  mutation.mockResolvedValue(null);
  const res = await POST(req("POST"));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, sent: 1, failed: 0 });
  expect(send).toHaveBeenCalledTimes(1);
  const [, opts] = send.mock.calls[0] as [unknown, { idempotencyKey?: string }];
  expect(opts).toEqual({ idempotencyKey: "trails-visit-abc12345-ef678901" });
  expect(mutation).toHaveBeenCalledWith(expect.anything(), {
    id: "outbox-1",
    status: "sent",
  });
});

it("marks failures without losing the remaining queue", async () => {
  query.mockResolvedValueOnce([row(), row({ _id: "outbox-2" })]);
  send
    .mockRejectedValueOnce(new Error("provider down"))
    .mockResolvedValueOnce({ data: { id: "mail-2" } });
  mutation.mockResolvedValue(null);
  const res = await POST(req("POST"));
  expect(await res.json()).toMatchObject({ ok: true, sent: 1, failed: 1 });
  const failedCall = mutation.mock.calls.find(([, a]: unknown[]) => (a as { status?: string }).status === "failed");
  expect(failedCall?.[1]).toEqual({ id: "outbox-1", status: "failed", error: "Error: provider down" });
  const sentCall = mutation.mock.calls.find(([, a]: unknown[]) => (a as { status?: string }).status === "sent");
  expect(sentCall?.[1]).toEqual({ id: "outbox-2", status: "sent" });
});

it('counts more than one pending notification accurately', async () => {
  query.mockResolvedValueOnce([row(), row({ _id: 'outbox-2' }), row({ _id: 'outbox-3' })]).mockResolvedValueOnce([]);
  expect(await (await GET(req('GET'))).json()).toMatchObject({ pending: 3, configured: true, pendingCapped: false });
});
it('never labels a provider test-mode rejection as delivered', async () => {
  mutation.mockResolvedValue(null);
  query.mockResolvedValueOnce([row()]);
  send.mockResolvedValue({ error: { message: 'You can only send testing emails' } });
  expect(await (await POST(req('POST'))).json()).toMatchObject({ sent: 0, failed: 1 });
  expect(mutation.mock.calls.every(([, args]) => args.status !== 'sent')).toBe(true);
});
