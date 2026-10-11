import { beforeEach, expect, it, vi } from "vitest";

const { mutation, allow } = vi.hoisted(() => ({
  mutation: vi.fn(),
  allow: vi.fn(),
}));
vi.mock("@/lib/convex", () => ({
  convexMutation: mutation,
  convexQuery: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ allowRequest: allow }));
vi.mock("@/auth", () => ({
  auth: () => Promise.resolve(null),
}));
vi.mock("server-only", () => ({}));
import { POST } from "../app/api/track/route";

beforeEach(() => {
  vi.resetAllMocks();
  allow.mockResolvedValue(true);
});

function trackReq(body: unknown, ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120") {
  return new Request("https://site.example/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": ua },
    body: JSON.stringify(body),
  });
}

const hello = {
  startedAt: Date.now(),
  entry: { Section: "home", Path: "/" },
  device: { Type: "desktop" },
};

it("forwards linkDropped so the client clears revoked-code attribution", async () => {
  mutation.mockResolvedValue({
    status: "applied",
    tracked: true,
    hello: true,
    seq: 1,
    linkDropped: true,
  });
  const res = await POST(
    trackReq({
      id: "sess0001-aaaabbbb",
      seq: 1,
      batchId: "b-route0001",
      visitor: "v-routetest001",
      visit: 1,
      add: {},
      set: {},
      events: [],
      hello: { ...hello, code: "REVOKED01" },
      end: false,
    }),
  );
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, tracked: true, linkDropped: true });
});

it("omits linkDropped for attributed and direct visits", async () => {
  mutation.mockResolvedValue({ status: "applied", tracked: true, hello: true, seq: 1 });
  const res = await POST(
    trackReq({
      id: "sess0002-ccccdddd",
      seq: 1,
      batchId: "b-route0002",
      visitor: "v-routetest002",
      visit: 1,
      add: {},
      set: {},
      events: [],
      hello,
      end: false,
    }),
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ ok: true, tracked: true });
  expect(body).not.toHaveProperty("linkDropped");
});
