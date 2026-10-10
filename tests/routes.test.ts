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
vi.mock("@/auth", () => ({
  auth: () => Promise.resolve(ownerSession.value),
}));
// server-only throws outside React Server Components; tests run in Node.
vi.mock("server-only", () => ({}));
import { POST as contact } from "../app/api/contact/route";
import { POST as booking } from "../app/api/booking/route";
import { GET as workspace } from "../app/api/dashboard/workspace/route";
import { GET as diag } from "../app/api/diag/route";
import { POST as dataRequest } from "../app/api/data/route";
import { PATCH as editBooking } from "../app/api/booking/[id]/route";
import { mapDashboardDocToProject } from "../data/projects";
beforeEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
  allow.mockResolvedValue(true);
  ownerSession.value = null;
  delete process.env.RESEND_API_KEY;
  delete process.env.MEETING_SYNC_URL;
  process.env.DASHBOARD_OWNER_EMAIL = "owner@example.com";
});

const ownerCookie =
  "authjs.session-token=owner; __Secure-authjs.session-token=owner";
function authed(path: string, init?: RequestInit) {
  return new Request(`https://site.example${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), cookie: ownerCookie },
  });
}

it("denies a conflicting owner reschedule before changing the calendar", async () => {
  ownerSession.value = {
    user: { email: "owner@example.com", isOwner: true },
  };
  process.env.MEETING_SYNC_URL = "https://calendar.example/sync";
  const calendar = vi.fn();
  vi.stubGlobal("fetch", calendar);
  query.mockResolvedValue({
    _id: "booking-id",
    date: "10/10/2030",
    time: "09:00 AM",
    name: "Client",
    email: "client@example.com",
    googleEventId: "event-id",
  });
  mutation.mockRejectedValue(new Error("SLOT_TAKEN"));
  const request = authed("/api/booking/booking-id", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: "10/10/2030",
      time: "10:00 AM",
      startTime: "2030-10-10T08:00:00Z",
      endTime: "2030-10-10T09:00:00Z",
    }),
  });
  expect(
    (
      await editBooking(request, {
        params: Promise.resolve({ id: "booking-id" }),
      })
    ).status,
  ).toBe(409);
  expect(calendar).not.toHaveBeenCalled();
});
it("rejects unauthenticated dashboard edits without touching the calendar", async () => {
  const calendar = vi.fn();
  vi.stubGlobal("fetch", calendar);
  const request = new Request("https://site.example/api/booking/booking-id", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date: "10/10/2030", time: "10:00 AM" }),
  });
  expect(
    (
      await editBooking(request, {
        params: Promise.resolve({ id: "booking-id" }),
      })
    ).status,
  ).toBe(401);
  expect(mutation).not.toHaveBeenCalled();
  expect(calendar).not.toHaveBeenCalled();
});
function req(path: string, body: unknown) {
  return new Request(`https://site.example${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
it("reports contact persistence failures honestly", async () => {
  const b = {
    name: "Client",
    email: "client@example.com",
    message: "Please build my product",
  };
  mutation.mockRejectedValue(new Error());
  expect((await contact(req("/api/contact", b))).status).toBe(503);
  mutation.mockResolvedValue(null);
  expect((await contact(req("/api/contact", b))).status).toBe(503);
  mutation.mockResolvedValue("message-id");
  expect((await contact(req("/api/contact", b))).status).toBe(200);
});
it("rejects booking conflicts and unavailable hours", async () => {
  query.mockResolvedValue({
    workingDays: [0, 1, 2, 3, 4, 5, 6],
    hours: [9],
    timezone: "UTC+02:00",
  });
  mutation.mockRejectedValue(new Error("SLOT_TAKEN"));
  const b = {
    name: "Client",
    email: "client@example.com",
    startTime: "2030-10-10T07:00:00Z",
    endTime: "2030-10-10T08:00:00Z",
  };
  expect((await booking(req("/api/booking", b))).status).toBe(409);
  expect(
    (
      await booking(
        req("/api/booking", {
          ...b,
          startTime: "2030-10-10T01:00:00Z",
          endTime: "2030-10-10T02:00:00Z",
        }),
      )
    ).status,
  ).toBe(400);
});
it("keeps the workspace and diagnostics private without an owner session", async () => {
  expect(
    (
      await workspace(
        new Request("https://site.example/api/dashboard/workspace"),
      )
    ).status,
  ).toBe(401);
  expect(query).not.toHaveBeenCalled();
  expect(
    (await diag(new Request("https://site.example/api/diag"))).status,
  ).toBe(401);
  // A signed-in non-owner is denied too.
  ownerSession.value = { user: { email: "stranger@example.com" } };
  expect((await workspace(authed("/api/dashboard/workspace"))).status).toBe(
    401,
  );
});
it("maps case-study evidence into the public detail page", () => {
  const p = mapDashboardDocToProject("Demo", {
    Problem: "Slow work",
    Role: "Engineer",
    Highlights: ["Retries", 42],
    Metrics: [{ label: "Latency", value: "120ms" }, { invalid: true }],
  });
  expect(p.problem).toBe("Slow work");
  expect(p.role).toBe("Engineer");
  expect(p.highlights).toEqual(["Retries"]);
  expect(p.metrics).toEqual([{ label: "Latency", value: "120ms" }]);
});
it("lets the owner session through while denying unauthenticated gateway writes", async () => {
  ownerSession.value = {
    user: { email: "owner@example.com", isOwner: true },
  };
  query.mockResolvedValue({ Description: "Public", privateNote: "secret" });
  const owned = await dataRequest(
    authed("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "getDoc",
        args: { path: "Projects/demo" },
      }),
    }),
  );
  expect(await owned.json()).toEqual({
    data: { Description: "Public", privateNote: "secret" },
  });
  ownerSession.value = null;
  const response = await dataRequest(
    req("/api/data", { operation: "getDoc", args: { path: "Projects/demo" } }),
  );
  expect(await response.json()).toEqual({ data: { Description: "Public" } });
  expect(
    (
      await dataRequest(
        req("/api/data", {
          operation: "setDoc",
          args: { path: "Projects/demo", data: {} },
        }),
      )
    ).status,
  ).toBe(401);
  expect(mutation).not.toHaveBeenCalled();
});
