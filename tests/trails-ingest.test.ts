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

const LINK = {
  Code: "TESTCODE",
  Name: "Acme",
  For: "Frontend role",
  Created: 1700000000000,
  Opens: 0,
  Sessions: 0,
  LastOpenAt: null,
  Notify: false,
  Tailor: { AutoCv: false, Greeting: "", Pinned: [] },
};

async function seedLink(t: any) {
  await t.mutation(api.docs.setDoc, {
    serverKey,
    path: "Analytics/Links/Items/1",
    data: LINK,
  });
}

function hello(code = "TESTCODE") {
  return {
    startedAt: Date.now(),
    entry: { Section: "home", Path: "/", Referrer: "", Ref: "", Utm: {} },
    device: { Type: "desktop", OS: "Linux", Browser: "Chrome" },
    code,
  };
}

function flush(over: Record<string, any> = {}) {
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

async function sessionOf(t: any, id: string) {
  return await t.query(api.docs.getDoc, {
    serverKey,
    path: `Analytics/Sessions/Items/${id}`,
  });
}

it("replaces timestamps/state/perf and takes scroll maxima while adding counters", async () => {
  const t = convexTest(schema, modules);
  await seedLink(t);
  const r1: any = await t.mutation(api.trails.applyFlush, flush());
  expect(r1.status).toBe("applied");
  const s1: any = await sessionOf(t, "abc12345-ef678901");
  expect(s1.LastSeenAt).toBeGreaterThan(1700000000000);
  expect(s1.ActiveMs).toBe(800);
  const firstSeen = s1.LastSeenAt;

  const r2: any = await t.mutation(
    api.trails.applyFlush,
    flush({
      seq: 2,
      batchId: "b-00000002",
      hello: null,
      add: { openMs: 1000, activeMs: 500, idleMs: 0, sections: { home: 500 } },
      set: {
        exitSection: "projects",
        scroll: { home: 25 },
        perf: { LoadMs: 1200, LcpMs: 800 },
      },
      events: [],
    }),
  );
  expect(r2.status).toBe("applied");
  const s2: any = await sessionOf(t, "abc12345-ef678901");
  // Counters ADD.
  expect(s2.ActiveMs).toBe(1300);
  // Timestamps/state REPLACE (the old mergeValues summed them).
  expect(s2.LastSeenAt).toBeGreaterThanOrEqual(firstSeen);
  expect(s2.LastSeenAt).toBeLessThan(firstSeen + 60_000);
  expect(s2.Exit).toEqual({ Section: "projects" });
  expect(s2.Perf).toEqual({ LoadMs: 1200, LcpMs: 800 });
  // Scroll takes the MAXIMUM (old code summed 50+25=75... and worse on repeats).
  expect(s2.Scroll).toEqual({ home: 50 });

  const r3: any = await t.mutation(
    api.trails.applyFlush,
    flush({
      seq: 3,
      batchId: "b-00000003",
      hello: null,
      add: {},
      set: { scroll: { home: 75 }, perf: { LoadMs: 900, LcpMs: 700 } },
      events: [],
    }),
  );
  expect(r3.status).toBe("applied");
  const s3: any = await sessionOf(t, "abc12345-ef678901");
  expect(s3.Scroll).toEqual({ home: 75 });
  expect(s3.Perf).toEqual({ LoadMs: 900, LcpMs: 700 });
});

it("dedupes retried batches, drops replays and out-of-order flushes", async () => {
  const t = convexTest(schema, modules);
  await seedLink(t);
  const base = flush();
  expect(((await t.mutation(api.trails.applyFlush, base)) as any).status).toBe("applied");

  // Same batchId retried after a lost response: counted once.
  const dup: any = await t.mutation(api.trails.applyFlush, base);
  expect(dup.status).toBe("duplicate");
  expect((await sessionOf(t, base.id)).ActiveMs).toBe(800);

  // Out-of-order: seq 3 lands before seq 2; the late seq 2 is a replay.
  await t.mutation(
    api.trails.applyFlush,
    flush({ seq: 3, batchId: "b-00000003", hello: null, add: { activeMs: 100 }, set: {}, events: [] }),
  );
  const late: any = await t.mutation(
    api.trails.applyFlush,
    flush({ seq: 2, batchId: "b-00000002", hello: null, add: { activeMs: 5000 }, set: {}, events: [] }),
  );
  expect(late.status).toBe("replay");
  expect((await sessionOf(t, base.id)).ActiveMs).toBe(900);
});

it("resolves simultaneous opens to a single counted visit", async () => {
  const t = convexTest(schema, modules);
  await seedLink(t);
  const a = flush({ batchId: "b-aaaa1111" });
  const b = flush({ batchId: "b-bbbb2222" });
  const [ra, rb] = await Promise.all([
    t.mutation(api.trails.applyFlush, a),
    t.mutation(api.trails.applyFlush, b),
  ]);
  const statuses = [(ra as any).status, (rb as any).status].sort();
  // Whichever opening committed first wins; the loser is recognised as the
  // same visit (duplicate batch or replayed seq) and never counted twice.
  expect(statuses[0]).toBe("applied");
  expect(["duplicate", "replay"]).toContain(statuses[1]);
  const totals: any = await t.query(api.docs.getDoc, { serverKey, path: "Analytics/Totals" });
  expect(totals.Sessions).toBe(1);
});

it("records direct visits with full detail and no link", async () => {
  const t = convexTest(schema, modules);
  await seedLink(t);
  const direct: any = await t.mutation(
    api.trails.applyFlush,
    flush({ id: "direct01-abcdef12", batchId: "b-direct55", hello: hello("") }),
  );
  expect(direct.status).toBe("applied");
  expect(direct.tracked).toBe(true);
  const s: any = await sessionOf(t, "direct01-abcdef12");
  expect(s.Link).toBeNull();
  expect(s.ActiveMs).toBe(800);
  const totals: any = await t.query(api.docs.getDoc, { serverKey, path: "Analytics/Totals" });
  expect(totals.Sessions).toBe(1);
  expect(totals.LinkOpens || 0).toBe(0);
});

it("drops an invalid hello code and keeps the visit as direct", async () => {
  const t = convexTest(schema, modules);
  await seedLink(t);
  const r: any = await t.mutation(
    api.trails.applyFlush,
    flush({ id: "stale01-abcdef12", batchId: "b-stale0001", hello: hello("DELETED1") }),
  );
  expect(r.status).toBe("applied");
  expect(r.linkDropped).toBe(true);
  const s: any = await sessionOf(t, "stale01-abcdef12");
  expect(s.Link).toBeNull();
});

it("rejects invalid/expired sessions terminally", async () => {
  const t = convexTest(schema, modules);
  await seedLink(t);
  const bad: any = await t.mutation(api.trails.applyFlush, flush({ id: "!!!", batchId: "b-bad66666" }));
  expect(bad.status).toBe("terminal");

  const deep: any = await t.mutation(
    api.trails.applyFlush,
    flush({ id: "ghost01-abcdef12", seq: 11, batchId: "b-deep3333", hello: null }),
  );
  expect(deep.status).toBe("terminal");
  expect(deep.reason).toBe("unknown-visit");
});

it("records owner visits without counting them, and subtracts on mid-visit recognition", async () => {
  const t = convexTest(schema, modules);
  await seedLink(t);
  const r: any = await t.mutation(
    api.trails.applyFlush,
    flush({ owner: true, batchId: "b-owner444" }),
  );
  expect(r.status).toBe("applied");
  const totals: any = await t.query(api.docs.getDoc, { serverKey, path: "Analytics/Totals" });
  expect(totals?.Sessions || 0).toBe(0);

  // Stranger first, recognised as owner on flush 2: contribution removed.
  const id = "flip01-abcdef12";
  await t.mutation(api.trails.applyFlush, flush({ id, batchId: "b-flip1001", visitor: "v-flipflip1234" }));
  const before: any = await t.query(api.docs.getDoc, { serverKey, path: "Analytics/Totals" });
  expect(before.Sessions).toBe(1);
  await t.mutation(
    api.trails.applyFlush,
    flush({ id, seq: 2, batchId: "b-flip1002", visitor: "v-flipflip1234", hello: null, owner: true, add: {}, set: {}, events: [] }),
  );
  const after: any = await t.query(api.docs.getDoc, { serverKey, path: "Analytics/Totals" });
  expect(after.Sessions).toBe(0);
});

it("queues a notification outbox row for link opens", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.docs.setDoc, {
    serverKey,
    path: "Analytics/Links/Items/9",
    data: { ...LINK, Code: "NOTIFYME", Name: "Acme", Notify: true },
  });
  const r: any = await t.mutation(
    api.trails.applyFlush,
    flush({ batchId: "b-notify77", hello: hello("NOTIFYME") }),
  );
  expect(r.status).toBe("applied");
  expect(r.notifyQueued).toBe(true);
});
