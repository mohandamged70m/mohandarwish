import { beforeEach, expect, it, vi } from "vitest";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

vi.mock("server-only", () => ({}));
const modules = import.meta.glob("../convex/**/*.ts");
const serverKey = "test-key";
beforeEach(() => {
  process.env.CONVEX_SERVER_KEY = serverKey;
});

// ── shared seed helpers ───────────────────────────────────────────────────

function hello() {
  return {
    startedAt: Date.now(),
    entry: { Section: "home", Path: "/", Referrer: "", Ref: "", Utm: {} },
    device: { Type: "desktop", OS: "Linux", Browser: "Chrome" },
  };
}

function legacyFlush(over: Record<string, any> = {}) {
  return {
    serverKey,
    id: "abc12345-ef678901",
    seq: 1,
    batchId: "b-00000001",
    visitor: "v-abcdefgh1234",
    visit: 1,
    add: { openMs: 1000, activeMs: 800, idleMs: 200, sections: { home: 800 } },
    set: { exitSection: "home", scroll: { home: 50 }, contactTab: "", contactSent: "" },
    events: [{ t: 100, k: "section", v: "home" }],
    hello: hello(),
    end: false,
    owner: false,
    geo: { Country: "", Code: "" },
    ...over,
  };
}

function typedBatch(over: Record<string, any> = {}) {
  return { ...legacyFlush(), ...over };
}

// ── A: live backend (dashboardDocs) ───────────────────────────────────────

it("confirms conversions once per submission identity", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.trails.applyFlush, legacyFlush());
  const first: any = await t.mutation(api.trails.confirmConversion, {
    serverKey,
    sessionId: "abc12345-ef678901",
    sub: "sub-00000001",
    kind: "message",
  });
  expect(first.confirmed).toBe(true);
  const session: any = await t.query(api.docs.getDoc, {
    serverKey,
    path: "Analytics/Sessions/Items/abc12345-ef678901",
  });
  expect(session.Contact.Sent).toBe("message");
  expect(
    session.Events.filter((e: any) => e.k === "contact_sent" && e.v === "message"),
  ).toHaveLength(1);

  // Retried delivery of the same submission: deduped, no second event.
  const retry: any = await t.mutation(api.trails.confirmConversion, {
    serverKey,
    sessionId: "abc12345-ef678901",
    sub: "sub-00000001",
    kind: "message",
  });
  expect(retry).toEqual({ confirmed: true, duplicate: true });
  const after: any = await t.query(api.docs.getDoc, {
    serverKey,
    path: "Analytics/Sessions/Items/abc12345-ef678901",
  });
  expect(
    after.Events.filter((e: any) => e.k === "contact_sent"),
  ).toHaveLength(1);

  // A distinct submission (e.g. booked after messaging) updates state.
  const second: any = await t.mutation(api.trails.confirmConversion, {
    serverKey,
    sessionId: "abc12345-ef678901",
    sub: "sub-00000002",
    kind: "meeting",
  });
  expect(second.confirmed).toBe(true);
  const latest: any = await t.query(api.docs.getDoc, {
    serverKey,
    path: "Analytics/Sessions/Items/abc12345-ef678901",
  });
  expect(latest.Contact.Sent).toBe("meeting");
});

it("refuses conversions for unknown or deleted visits without throwing", async () => {
  const t = convexTest(schema, modules);
  const ghost: any = await t.mutation(api.trails.confirmConversion, {
    serverKey,
    sessionId: "ghost000-abcdef12",
    sub: "sub-00000009",
    kind: "message",
  });
  expect(ghost.confirmed).toBe(false);
  const bad: any = await t.mutation(api.trails.confirmConversion, {
    serverKey,
    sessionId: "!!!",
    sub: "sub-00000009",
    kind: "message",
  });
  expect(bad.confirmed).toBe(false);
});

// ── B: typed store ────────────────────────────────────────────────────────

it("marks conversions on the typed store with the same dedupe contract", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.trailStore.applyBatch, typedBatch());
  const first: any = await t.mutation(api.trailStore.markConversion, {
    serverKey,
    sid: "abc12345-ef678901",
    sub: "sub-00000001",
    kind: "meeting",
  });
  expect(first.confirmed).toBe(true);
  const story: any = await t.query(api.trailStore.getStory, {
    serverKey,
    sid: "abc12345-ef678901",
  });
  expect(story.contact.sent).toBe("meeting");
  expect(story.events.filter((e: any) => e.k === "contact_sent")).toHaveLength(1);
  const retry: any = await t.mutation(api.trailStore.markConversion, {
    serverKey,
    sid: "abc12345-ef678901",
    sub: "sub-00000001",
    kind: "meeting",
  });
  expect(retry).toEqual({ confirmed: true, duplicate: true });
  const unknown: any = await t.mutation(api.trailStore.markConversion, {
    serverKey,
    sid: "ghost000-abcdef12",
    sub: "sub-00000001",
    kind: "meeting",
  });
  expect(unknown.confirmed).toBe(false);
});
