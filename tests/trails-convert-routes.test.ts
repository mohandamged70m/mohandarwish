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
vi.mock("@/auth", () => ({
  auth: () => Promise.resolve(null),
}));
vi.mock("server-only", () => ({}));
import { POST as booking } from "../app/api/booking/route";
import { POST as message } from "../app/api/messages/route";

beforeEach(() => {
  vi.resetAllMocks();
  allow.mockResolvedValue(true);
  delete process.env.RESEND_API_KEY;
  delete process.env.MEETING_SYNC_URL;
});

function req(path: string, body: unknown) {
  return new Request(`https://site.example${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const bookingBody = {
  name: "Client",
  email: "client@example.com",
  startTime: "2030-10-10T07:00:00Z",
  endTime: "2030-10-10T08:00:00Z",
  trails: { sid: "abc12345-ef678901", sub: "sub-meeting-01" },
};

it("confirms the visit conversion after a booking persists", async () => {
  query.mockResolvedValue({
    workingDays: [0, 1, 2, 3, 4, 5, 6],
    hours: [9],
    timezone: "UTC+02:00",
  });
  // bookings.create, bookings.updateFields, trails.confirmConversion.
  mutation
    .mockResolvedValueOnce("booking-id")
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ confirmed: true });
  const res = await booking(req("/api/booking", bookingBody));
  expect(res.status).toBe(200);
  expect(mutation).toHaveBeenCalledTimes(3);
  expect(mutation.mock.calls[2][1]).toEqual(
    { sessionId: "abc12345-ef678901", sub: "sub-meeting-01", kind: "meeting" },
  );
});

it("confirms the visit conversion after a message persists", async () => {
  // messages.create, trails.confirmConversion.
  mutation
    .mockResolvedValueOnce("message-id")
    .mockResolvedValueOnce({ confirmed: true });
  const res = await message(
    req("/api/messages", {
      name: "Client",
      email: "client@example.com",
      message: "Please build my product",
      trails: { sid: "abc12345-ef678901", sub: "sub-message-01" },
    }),
  );
  expect(res.status).toBe(200);
  expect(mutation).toHaveBeenCalledTimes(2);
  expect(mutation.mock.calls[1][1]).toEqual(
    { sessionId: "abc12345-ef678901", sub: "sub-message-01", kind: "message" },
  );
});

it("never loses a submission when conversion confirmation fails", async () => {
  mutation
    .mockResolvedValueOnce("message-id")
    .mockRejectedValueOnce(new Error("convex down"));
  const res = await message(
    req("/api/messages", {
      name: "Client",
      email: "client@example.com",
      message: "Please build my product",
      trails: { sid: "abc12345-ef678901", sub: "sub-message-02" },
    }),
  );
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});

it("saves submissions without Trails attribution untouched", async () => {
  mutation.mockResolvedValueOnce("message-id");
  const res = await message(
    req("/api/messages", {
      name: "Client",
      email: "client@example.com",
      message: "Please build my product",
    }),
  );
  expect(res.status).toBe(200);
  // Only the message persist ran — no conversion call.
  expect(mutation).toHaveBeenCalledTimes(1);
});
