import { beforeEach, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { isOwnerEmail, isOwnerSession, normalizeEmail } from "../lib/owner";
import { isAdminRequest } from "../lib/admin";
import { allowRequest } from "../lib/rate-limit";
import { createHmac } from "node:crypto";
import { publicDocument } from "../lib/public-docs";
const { ownerSession, consumeKey } = vi.hoisted(() => ({
  ownerSession: { value: null as unknown },
  consumeKey: vi.fn(),
}));
vi.mock("@/auth", () => ({
  auth: () => Promise.resolve(ownerSession.value),
}));
// server-only throws outside React Server Components; tests run in Node.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/convex", () => ({
  convexMutation: (...args: unknown[]) => consumeKey(...args),
  convexQuery: () => Promise.resolve(null),
}));
const modules = import.meta.glob("../convex/**/*.ts");
const serverKey = "test-key";
const ownerEmail = "owner@example.com";
beforeEach(() => {
  process.env.CONVEX_SERVER_KEY = serverKey;
  process.env.DASHBOARD_OWNER_EMAIL = ownerEmail;
  delete process.env.AUTH_SECRET;
  delete process.env.RATE_LIMIT_SECRET;
  ownerSession.value = null;
  consumeKey.mockReset();
});
it("rejects direct reads, writes, uploads, and private workspace access without the server key", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.query(api.docs.getDoc, { serverKey: "wrong", path: "Settings/MCP" }),
  ).rejects.toThrow("Unauthorized");
  await expect(
    t.mutation(api.docs.setDoc, {
      serverKey: "wrong",
      path: "Projects/demo",
      data: {},
    }),
  ).rejects.toThrow("Unauthorized");
  await expect(
    t.query(api.messages.list, { serverKey: "wrong" }),
  ).rejects.toThrow("Unauthorized");
  await expect(
    t.mutation(api.storage.getUploadUrl, { serverKey: "wrong" }),
  ).rejects.toThrow("Unauthorized");
  await expect(
    t.query(api.workspace.list, { serverKey: "wrong" }),
  ).rejects.toThrow("Unauthorized");
});
it("does not persist server keys", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.availability.upsert, {
    serverKey,
    workingDays: [1],
    hours: [9],
    timezone: "UTC+02:00",
  });
  expect(await t.query(api.availability.get, { serverKey })).not.toHaveProperty(
    "serverKey",
  );
});
it("only the verified owner Gmail passes the email check", () => {
  expect(normalizeEmail("  Owner@Example.COM ")).toBe(ownerEmail);
  expect(isOwnerEmail("owner@example.com", true)).toBe(true);
  expect(isOwnerEmail("OWNER@EXAMPLE.COM", true)).toBe(true);
  expect(isOwnerEmail("owner@example.com", false)).toBe(false);
  expect(isOwnerEmail("owner@example.com")).toBe(false);
  expect(isOwnerEmail("stranger@example.com", true)).toBe(false);
  expect(isOwnerEmail("owner@example.com.evil.com", true)).toBe(false);
  expect(isOwnerEmail("", true)).toBe(false);
  expect(isOwnerEmail(null, true)).toBe(false);
  delete process.env.DASHBOARD_OWNER_EMAIL;
  expect(isOwnerEmail("owner@example.com", true)).toBe(false);
  process.env.DASHBOARD_OWNER_EMAIL = ownerEmail;
});
it("accepts only owner sessions and rejects legacy credential markers", async () => {
  const owner = () =>
    new Request("https://site.example/api/dashboard/workspace");
  ownerSession.value = {
    user: { email: "owner@example.com", isOwner: true },
  };
  expect(await isAdminRequest(owner())).toBe(true);
  // Another Google account (or a tampered flag) is denied.
  ownerSession.value = { user: { email: "stranger@example.com", isOwner: true } };
  expect(await isAdminRequest(owner())).toBe(false);
  ownerSession.value = { user: { email: "owner@example.com" } };
  expect(await isAdminRequest(owner())).toBe(false);
  // Unauthenticated and expired sessions fail closed.
  ownerSession.value = null;
  expect(await isAdminRequest(owner())).toBe(false);
  // Cross-origin writes are rejected even with an owner session.
  ownerSession.value = {
    user: { email: "owner@example.com", isOwner: true },
  };
  expect(
    await isAdminRequest(
      new Request("https://site.example/api/dashboard", {
        method: "POST",
        headers: {
          cookie: "authjs.session-token=present",
          origin: "https://evil.example",
        },
      }),
    ),
  ).toBe(false);
  // Legacy access-key markers no longer grant anything on their own.
  ownerSession.value = null;
  expect(
    await isAdminRequest(
      new Request("https://site.example/api/dashboard?admin=secret", {
        headers: {
          "x-admin-token": "secret",
          cookie: "dashboard_token=secret; owner_session=secret",
        },
      }),
    ),
  ).toBe(false);
  expect(
    isOwnerSession({ user: { email: "owner@example.com", isOwner: true } }),
  ).toBe(true);
  expect(isOwnerSession({ user: { email: "owner@example.com" } })).toBe(false);
  expect(isOwnerSession(null)).toBe(false);
});
it("projects only public document fields", () => {
  expect(publicDocument("Settings/MCP", { apiKey: "secret" })).toBeNull();
  expect(
    publicDocument("Settings/Developer", {
      featuredRepos: ["demo"],
      apiKey: "secret",
    }),
  ).toEqual({ featuredRepos: ["demo"] });
  expect(
    publicDocument("Projects/demo", {
      Description: "Public",
      notes: "Private",
    }),
  ).toEqual({ Description: "Public" });
});
it("reserves one slot atomically and rejects an overlapping custom time", async () => {
  const t = convexTest(schema, modules);
  const body = {
    serverKey,
    date: "20/10/2026",
    time: "09:00 AM",
    name: "Client",
    email: "client@example.com",
  };
  const results = await Promise.allSettled([
    t.mutation(api.bookings.create, body),
    t.mutation(api.bookings.create, body),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  await expect(
    t.mutation(api.bookings.create, { ...body, time: "09:30 AM" }),
  ).rejects.toThrow("SLOT_TAKEN");
});
it("rate-limits with a server-only secret and fails closed without one", async () => {
  const visitor = () =>
    new Request("https://site.example/api/contact", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
  delete process.env.RATE_LIMIT_SECRET;
  delete process.env.AUTH_SECRET;
  await expect(allowRequest(visitor(), "contact")).rejects.toThrow(
    /Rate limiting/,
  );
  expect(consumeKey).not.toHaveBeenCalled();
  process.env.AUTH_SECRET = "a".repeat(32);
  consumeKey.mockResolvedValue(true);
  await expect(allowRequest(visitor(), "contact")).resolves.toBe(true);
  expect(consumeKey).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({
      key: createHmac("sha256", "a".repeat(32))
        .update("contact:1.2.3.4")
        .digest("hex"),
    }),
  );
  process.env.RATE_LIMIT_SECRET = "r".repeat(32);
  await expect(allowRequest(visitor(), "contact")).resolves.toBe(true);
  expect(consumeKey).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({
      key: createHmac("sha256", "r".repeat(32))
        .update("contact:1.2.3.4")
        .digest("hex"),
    }),
  );
  delete process.env.RATE_LIMIT_SECRET;
  delete process.env.AUTH_SECRET;
});
it("rate-limits visitors independently", async () => {
  const t = convexTest(schema, modules);
  const a = { serverKey, key: "a", limit: 1, windowMs: 60000 };
  expect(await t.mutation(api.rateLimits.consume, a)).toBe(true);
  expect(await t.mutation(api.rateLimits.consume, a)).toBe(false);
  expect(await t.mutation(api.rateLimits.consume, { ...a, key: "b" })).toBe(
    true,
  );
});
it("rejects conflicting reschedules and allows an expired reservation to be replaced", async () => {
  const t = convexTest(schema, modules);
  const body = {
    serverKey,
    date: "20/10/2026",
    name: "Client",
    email: "client@example.com",
  };
  const first = await t.mutation(api.bookings.create, {
    ...body,
    time: "09:00 AM",
  });
  const second = await t.mutation(api.bookings.create, {
    ...body,
    time: "11:00 AM",
  });
  await expect(
    t.mutation(api.bookings.updateFields, {
      serverKey,
      id: second,
      patch: { time: "09:30 AM" },
    }),
  ).rejects.toThrow("SLOT_TAKEN");
  await t.mutation(api.bookings.updateFields, {
    serverKey,
    id: first,
    patch: { expiresAt: 1 },
  });
  expect(await t.query(api.bookings.listSlots, { serverKey })).toEqual([
    { date: body.date, time: "11:00 AM" },
  ]);
  await t.mutation(api.bookings.create, { ...body, time: "09:00 AM" });
  await expect(
    t.mutation(api.bookings.updateFields, {
      serverKey,
      id: first,
      patch: { status: "confirmed" },
    }),
  ).rejects.toThrow("SLOT_TAKEN");
});
it("overwrites sequence numbers while adding counters", async () => {
  const t = convexTest(schema, modules);
  const a = {
    serverKey,
    path: "Analytics/Sessions/Items/demo",
    patch: { Views: 1 },
    events: [],
  };
  await t.mutation(api.docs.patchSeq, { ...a, seq: 1 });
  const second = await t.mutation(api.docs.patchSeq, { ...a, seq: 2 });
  expect(second?.Seq).toBe(2);
  expect(second?.Views).toBe(2);
});
it("creates a lead with a contact and converts it when a project is saved", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.messages.create, {
    serverKey,
    name: "Client",
    email: "client@example.com",
    hasWhatsapp: false,
    message: "Build an MVP",
    files: [],
  });
  const data = await t.query(api.workspace.list, { serverKey });
  expect(data.leads[0].stage).toBe("inquiry");
  await t.mutation(api.workspace.saveProject, {
    serverKey,
    leadId: data.leads[0]._id,
    title: "MVP",
    clientName: "Client",
    clientEmail: "client@example.com",
    summary: "",
    status: "active",
    paymentStatus: "unpaid",
    invoiceUrl: "",
    dueDate: "",
  });
  expect(
    (await t.query(api.workspace.list, { serverKey })).leads[0].stage,
  ).toBe("won");
});
it("rejects moving a milestone into a different project", async () => {
  const t = convexTest(schema, modules);
  const make = (title: string) => ({
    serverKey,
    title,
    clientName: "Client",
    clientEmail: "client@example.com",
    summary: "",
    status: "active" as const,
    paymentStatus: "unpaid" as const,
    invoiceUrl: "",
    dueDate: "",
  });
  const a = await t.mutation(api.workspace.saveProject, make("A")),
    b = await t.mutation(api.workspace.saveProject, make("B"));
  const fields = {
    serverKey,
    projectId: a,
    title: "Preview",
    description: "",
    previewUrl: "https://example.com",
    dueDate: "",
    status: "review" as const,
  };
  const id = await t.mutation(api.workspace.saveMilestone, fields);
  await expect(
    t.mutation(api.workspace.saveMilestone, { ...fields, id, projectId: b }),
  ).rejects.toThrow("Not found");
});
