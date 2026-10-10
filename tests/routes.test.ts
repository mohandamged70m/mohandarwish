import { beforeEach, expect, it, vi } from "vitest";
const { mutation, query, allow } = vi.hoisted(() => ({
  mutation: vi.fn(),
  query: vi.fn(),
  allow: vi.fn(),
}));
vi.mock("@/lib/convex", () => ({
  convexMutation: mutation,
  convexQuery: query,
}));
vi.mock("@/lib/rate-limit", () => ({ allowRequest: allow }));
import { POST as contact } from "../app/api/contact/route";
import { POST as booking } from "../app/api/booking/route";
import { GET as workspace } from "../app/api/dashboard/workspace/route";
import { POST as signIn, DELETE as signOut } from "../app/api/auth/owner/route";
import { POST as dataRequest } from "../app/api/data/route";
import { readSession, signSession } from "../lib/session";
import { PATCH as editBooking } from "../app/api/booking/[id]/route";
import { mapDashboardDocToProject } from "../data/projects";
beforeEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
  allow.mockResolvedValue(true);
  delete process.env.RESEND_API_KEY;
  delete process.env.MEETING_SYNC_URL;
  process.env.SESSION_SECRET = "s".repeat(64);
});

it("denies a conflicting owner reschedule before changing the calendar", async () => {
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
  const request = new Request("https://site.example/api/booking/booking-id", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      cookie: `owner_session=${signSession({ role: "owner", exp: Date.now() + 60000 })}`,
    },
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
it("keeps the workspace private without an owner session", async () => {
  expect(
    (
      await workspace(
        new Request("https://site.example/api/dashboard/workspace"),
      )
    ).status,
  ).toBe(401);
  expect(query).not.toHaveBeenCalled();
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
it("exchanges the owner credential for an HttpOnly cookie and expires it on sign-out", async () => {
  process.env.ADMIN_TOKEN = "owner-key";
  expect(
    (await signIn(req("/api/auth/owner", { token: "wrong" }))).status,
  ).toBe(401);
  const response = await signIn(req("/api/auth/owner", { token: "owner-key" }));
  const cookie = response.headers.get("set-cookie")!;
  expect(response.status).toBe(200);
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=strict");
  expect(cookie).not.toContain("owner-key");
  expect(readSession(cookie.split(";")[0].split("=")[1])?.role).toBe("owner");
  expect(
    (
      await signOut(
        new Request("https://site.example/api/auth/owner", {
          method: "DELETE",
        }),
      )
    ).headers.get("set-cookie"),
  ).toContain("Max-Age=0");
});
it("projects public fields and denies unauthenticated gateway writes", async () => {
  query.mockResolvedValue({ Description: "Public", privateNote: "secret" });
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
