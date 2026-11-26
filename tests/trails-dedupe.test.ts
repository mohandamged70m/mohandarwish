import { beforeEach, expect, it, vi } from "vitest";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

vi.mock("server-only", () => ({}));
const modules = import.meta.glob("../convex/**/*.ts");
const serverKey = "test-key";
const startedAt = 1_700_000_000_000;

beforeEach(() => {
  process.env.CONVEX_SERVER_KEY = serverKey;
});

function session(over: Record<string, any> = {}) {
  return {
    Visitor: "v-abcdefgh1234",
    StartedAt: startedAt,
    LastSeenAt: startedAt + 8700,
    ActiveMs: 8700,
    Ended: true,
    Geo: { Country: "Egypt", Code: "EG" },
    Device: { Type: "desktop", OS: "Linux", Browser: "Chrome" },
    ...over,
  };
}

it("hides the shorter duplicate from a same-minute opening", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.docs.setDoc, {
    serverKey,
    path: "Analytics/Sessions/Items/first0001-aaaa0001",
    data: session({ ActiveMs: 8700 }),
  });
  await t.mutation(api.docs.setDoc, {
    serverKey,
    path: "Analytics/Sessions/Items/second001-bbbb0002",
    data: session({ StartedAt: startedAt + 20_000, ActiveMs: 0 }),
  });

  const result: any = await t.mutation(api.trails.dedupeWindow, { serverKey, windowMs: 60_000 });
  expect(result.hidden).toBe(1);

  const second: any = await t.query(api.docs.getDoc, {
    serverKey,
    path: "Analytics/Sessions/Items/second001-bbbb0002",
  });
  expect(second.Hidden).toBe(true);
  const first: any = await t.query(api.docs.getDoc, {
    serverKey,
    path: "Analytics/Sessions/Items/first0001-aaaa0001",
  });
  expect(first.Hidden).toBeUndefined();
});

it("stops a second opening in the same window at ingest", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.docs.setDoc, {
    serverKey,
    path: "Analytics/Sessions/Items/first0001-aaaa0001",
    data: session(),
  });

  const result: any = await t.mutation(api.trails.applyFlush, {
    serverKey,
    id: "second001-bbbb0002",
    seq: 1,
    batchId: "b-dedupe-01",
    visitor: "v-abcdefgh1234",
    visit: 1,
    add: { openMs: 1000, activeMs: 0, idleMs: 1000 },
    set: {},
    events: [],
    hello: {
      startedAt: startedAt + 20_000,
      entry: { Section: "home", Path: "/", Referrer: "", Ref: "", Utm: {} },
      device: { Type: "desktop", OS: "Linux", Browser: "Chrome" },
    },
    end: false,
    owner: false,
    geo: { Country: "Egypt", Code: "EG" },
  });

  expect(result.status).toBe("terminal");
  expect(result.reason).toBe("duplicate-window");
});
