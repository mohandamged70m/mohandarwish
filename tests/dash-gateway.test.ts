import { beforeEach, expect, it, vi } from "vitest";

const { mutation, query, allow, ownerSession } = vi.hoisted(() => ({
  mutation: vi.fn(),
  query: vi.fn(),
  allow: vi.fn(),
  ownerSession: { value: null as unknown },
}));
vi.mock("@/lib/convex", () => ({
  convexMutation: mutation,
  convexQuery: query,
}));
vi.mock("@/lib/rate-limit", () => ({ allowRequest: allow }));
vi.mock("@/auth", () => ({ auth: () => Promise.resolve(ownerSession.value) }));
vi.mock("server-only", () => ({}));

import { POST as dataRoute } from "../app/api/data/route";
import { POST as calendarRoute } from "../app/api/dashboard/google-calendar/route";
import { POST as retryRoute } from "../app/api/dashboard/retry-mail-job/route";

const cookie = "authjs.session-token=owner; __Secure-authjs.session-token=owner";
function req(path: string, body: unknown, authed = true) {
  return new Request(`https://site.example${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authed ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  allow.mockResolvedValue(true);
  mutation.mockResolvedValue(null);
  query.mockResolvedValue(null);
  process.env.DASHBOARD_OWNER_EMAIL = "owner@example.com";
  delete process.env.GOOGLE_CALENDAR_BRIDGE_URL;
  delete process.env.MAIL_JOB_RETRY_URL;
  ownerSession.value = {
    user: { email: "owner@example.com", isOwner: true },
  };
});

it("passes a valid owner batch straight to one Convex mutation", async () => {
  const ops = [
    { type: "set", path: "Projects/a", data: { name: "A" } },
    { type: "update", path: "Projects/b", data: { Opens: { __dash_increment__: -1 } } },
    { type: "delete", path: "Projects/old" },
  ];
  const r = await dataRoute(req("/api/data", { operation: "batch", args: { ops } }));
  expect(r.status).toBe(200);
  expect(mutation).toHaveBeenCalledTimes(1);
  expect(mutation).toHaveBeenCalledWith(expect.anything(), { ops });
});

it("rejects malformed batches and anonymous callers", async () => {
  const bad = [
    { operation: "batch", args: { ops: [] } },
    { operation: "batch", args: { ops: [{ type: "set", path: "x".repeat(501), data: {} }] } },
    { operation: "batch", args: { ops: [{ type: "set", path: "Projects/a", data: null }] } },
    { operation: "batch", args: { ops: [{ type: "set", path: "Projects/a", data: {}, surprise: 1 }] } },
  ];
  for (const body of bad)
    expect((await dataRoute(req("/api/data", body))).status).toBe(503);
  mutation.mockClear();

  ownerSession.value = null;
  expect(
    (
      await dataRoute(
        req(
          "/api/data",
          { operation: "batch", args: { ops: [{ type: "delete", path: "Projects/a" }] } },
          false,
        ),
      )
    ).status,
  ).toBe(401);
  expect(mutation).not.toHaveBeenCalled();
});

it("fails honestly when the calendar bridge or mail retry backend is absent", async () => {
  expect(
    (
      await calendarRoute(req("/api/dashboard/google-calendar", { action: "connect" }))
    ).status,
  ).toBe(503);
  const status = await calendarRoute(
    req("/api/dashboard/google-calendar", { action: "status" }),
  );
  expect(status.status).toBe(200);
  expect((await status.json()).configured).toBe(false);
  expect(
    (await retryRoute(req("/api/dashboard/retry-mail-job", { id: "job1" }))).status,
  ).toBe(503);
  expect(
    (
      await calendarRoute(req("/api/dashboard/google-calendar", { action: "nope" }))
    ).status,
  ).toBe(400);
  expect(
    (await retryRoute(req("/api/dashboard/retry-mail-job", { id: "" }))).status,
  ).toBe(400);
});

it("rejects cross-origin calls to both new callables", async () => {
  const cross = new Request("https://site.example/api/dashboard/retry-mail-job", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie, origin: "https://evil.example" },
    body: JSON.stringify({ id: "job1" }),
  });
  expect((await retryRoute(cross)).status).toBe(403);
});
