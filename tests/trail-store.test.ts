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

function hello(code = "") {
  return {
    startedAt: Date.now(),
    entry: { Section: "home", Path: "/", Referrer: "", Ref: "", Utm: {} },
    device: { Type: "desktop", OS: "Linux", Browser: "Chrome" },
    ...(code ? { code } : {}),
  };
}

function batch(over: Record<string, any> = {}) {
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

async function makeLink(t: any, over: Record<string, any> = {}) {
  return (await t.mutation(api.trailStore.createLink, {
    serverKey,
    name: "Acme",
    for: "Frontend role",
    notify: true,
    ...over,
  })) as any;
}

it("rejects private operations without the server key", async () => {
  const t = convexTest(schema, modules);
  const { api } = await import("../convex/_generated/api");
  await expect(
    t.mutation(api.trailStore.createLink, { serverKey: "wrong", name: "A", for: "B" }),
  ).rejects.toThrow();
  await expect(t.query(api.trailStore.overview, { serverKey: "wrong", from: "2026-01-01", to: "2026-12-31" })).rejects.toThrow();
});

it("allocates unique link codes and resolves them via the code index", async () => {
  const t = convexTest(schema, modules);
  const { api } = await import("../convex/_generated/api");
  const a = await makeLink(t);
  const b = await makeLink(t);
  expect(a.code).not.toBe(b.code);
  const found = (await t.query(api.trailStore.resolveLink, { serverKey, code: a.code })) as any;
  expect(found.name).toBe("Acme");
  expect(found.tailor).toEqual({ AutoCv: false, Greeting: "", Pinned: [] });
  expect(await t.query(api.trailStore.resolveLink, { serverKey, code: "NOPE1234" })).toBeNull();
});

it("applies batches transactionally with add/replace/max/append semantics", async () => {
  const t = convexTest(schema, modules);
  const { api } = await import("../convex/_generated/api");
  const r1: any = await t.mutation(api.trailStore.applyBatch, batch());
  expect(r1.status).toBe("applied");
  const r2: any = await t.mutation(
    api.trailStore.applyBatch,
    batch({
      seq: 2,
      batchId: "b-00000002",
      hello: null,
      add: { activeMs: 500, sections: { home: 500 } },
      set: { exitSection: "projects", scroll: { home: 25 }, perf: { LoadMs: 1200, LcpMs: 800 } },
      events: [],
    }),
  );
  expect(r2.status).toBe("applied");
  const story: any = await t.query(api.trailStore.getStory, { serverKey, sid: "abc12345-ef678901" });
  expect(story.sections).toEqual({ home: 1300 });
  expect(story.activeMs).toBe(1300); // counters ADD across flushes
  expect(story.scroll).toEqual({ home: 50 }); // maximum, not sum
  expect(story.exitSection).toBe("projects"); // replaced
  expect(story.perf).toEqual({ loadMs: 1200, lcpMs: 800 });
  expect(story.events).toHaveLength(1);
  const ov: any = await t.query(api.trailStore.overview, {
    serverKey,
    from: "2000-01-01",
    to: "2100-01-01",
  });
  expect(ov.totals.sessions).toBe(1);
  expect(ov.totals.visitors).toBe(1);
  expect(ov.days.length).toBe(1);
  expect(ov.days[0].sessions).toBe(1);
});

it("dedupes retried batches and drops replays", async () => {
  const t = convexTest(schema, modules);
  const { api } = await import("../convex/_generated/api");
  const base = batch();
  expect(((await t.mutation(api.trailStore.applyBatch, base)) as any).status).toBe("applied");
  const dup: any = await t.mutation(api.trailStore.applyBatch, base);
  expect(dup.status).toBe("duplicate");
  await t.mutation(
    api.trailStore.applyBatch,
    batch({ seq: 3, batchId: "b-00000003", hello: null, add: { activeMs: 100 }, set: {}, events: [] }),
  );
  const late: any = await t.mutation(
    api.trailStore.applyBatch,
    batch({ seq: 2, batchId: "b-00000002", hello: null, add: { activeMs: 5000 }, set: {}, events: [] }),
  );
  expect(late.status).toBe("replay");
  const ov: any = await t.query(api.trailStore.overview, {
    serverKey,
    from: "2000-01-01",
    to: "2100-01-01",
  });
  expect(ov.totals.sessions).toBe(1);
});

it("attributes link opens, queues notifications, and counts link cards", async () => {
  const t = convexTest(schema, modules);
  const { api } = await import("../convex/_generated/api");
  const link = await makeLink(t);
  const r: any = await t.mutation(
    api.trailStore.applyBatch,
    batch({ batchId: "b-linkopen1", hello: hello(link.code) }),
  );
  expect(r.status).toBe("applied");
  expect(r.notifyQueued).toBe(true);
  expect(r.link).toEqual({ Name: "Acme", For: "Frontend role" });
  const resolved: any = await t.query(api.trailStore.resolveLink, { serverKey, code: link.code });
  expect(resolved.sessions).toBe(1);
  expect(resolved.opens).toBe(1);
  const outbox: any = await t.query(api.trailStore.outboxList, { serverKey, status: "pending" });
  expect(outbox).toHaveLength(1);
  const marked: any = await t.mutation(api.trailStore.outboxSet, {
    serverKey,
    id: outbox[0]._id,
    status: "sent",
  });
  expect(marked.marked).toBe(true);
});

it("records owner visits without counting, and subtracts on mid-visit recognition", async () => {
  const t = convexTest(schema, modules);
  const { api } = await import("../convex/_generated/api");
  await t.mutation(api.trailStore.applyBatch, batch({ owner: true, batchId: "b-owner444" }));
  let ov: any = await t.query(api.trailStore.overview, {
    serverKey,
    from: "2000-01-01",
    to: "2100-01-01",
  });
  expect(ov.totals.sessions).toBe(0);

  const id = "flip01-abcdef12";
  await t.mutation(
    api.trailStore.applyBatch,
    batch({ id, batchId: "b-flip1001", visitor: "v-flipflip1234" }),
  );
  ov = await t.query(api.trailStore.overview, {
    serverKey,
    from: "2000-01-01",
    to: "2100-01-01",
  });
  expect(ov.totals.sessions).toBe(1);
  await t.mutation(
    api.trailStore.applyBatch,
    batch({ id, seq: 2, batchId: "b-flip1002", visitor: "v-flipflip1234", hello: null, owner: true, add: {}, set: {}, events: [] }),
  );
  ov = await t.query(api.trailStore.overview, {
    serverKey,
    from: "2000-01-01",
    to: "2100-01-01",
  });
  expect(ov.totals.sessions).toBe(0);
});

it("deletes sessions with aggregate reconciliation and tombstoned retries", async () => {
  const t = convexTest(schema, modules);
  const { api } = await import("../convex/_generated/api");
  const link = await makeLink(t);
  await t.mutation(
    api.trailStore.applyBatch,
    batch({ batchId: "b-del00001", hello: hello(link.code) }),
  );
  const del: any = await t.mutation(api.trailStore.deleteSession, {
    serverKey,
    sid: "abc12345-ef678901",
  });
  expect(del.deleted).toBe(true);
  const ov: any = await t.query(api.trailStore.overview, {
    serverKey,
    from: "2000-01-01",
    to: "2100-01-01",
  });
  expect(ov.totals.sessions).toBe(0);
  const resolved: any = await t.query(api.trailStore.resolveLink, { serverKey, code: link.code });
  expect(resolved.sessions).toBe(0);
  expect(await t.query(api.trailStore.getStory, { serverKey, sid: "abc12345-ef678901" })).toBeNull();
  // Delayed retry must not recreate the visit.
  const retry: any = await t.mutation(
    api.trailStore.applyBatch,
    batch({ batchId: "b-del00002", hello: hello(link.code) }),
  );
  expect(retry.status).toBe("terminal");
  expect(retry.reason).toBe("deleted");
});

it("forgets a link's visits by document ID and zeroes the card", async () => {
  const t = convexTest(schema, modules);
  const { api } = await import("../convex/_generated/api");
  const link = await makeLink(t);
  await t.mutation(
    api.trailStore.applyBatch,
    batch({ id: "aaa11111-bbbb2222", batchId: "b-forget001", hello: hello(link.code) }),
  );
  await t.mutation(
    api.trailStore.applyBatch,
    batch({
      id: "ccc33333-dddd4444",
      batchId: "b-forget002",
      visitor: "v-secondvisit123",
      visit: 2,
      hello: hello(link.code),
    }),
  );
  const res: any = await t.mutation(api.trailStore.forgetLinkVisits, {
    serverKey,
    linkId: link.id,
  });
  expect(res.deleted).toBe(2);
  const ov: any = await t.query(api.trailStore.overview, {
    serverKey,
    from: "2000-01-01",
    to: "2100-01-01",
  });
  expect(ov.totals.sessions).toBe(0);
  const resolved: any = await t.query(api.trailStore.resolveLink, { serverKey, code: link.code });
  expect(resolved.opens).toBe(0);
  expect(resolved.sessions).toBe(0);
});

it("lists sessions with pagination and filters, and counts distinct browsers", async () => {
  const t = convexTest(schema, modules);
  const { api } = await import("../convex/_generated/api");
  const link = await makeLink(t);
  await t.mutation(
    api.trailStore.applyBatch,
    batch({ id: "sess0001-aaaabbbb", batchId: "b-page00001", hello: hello(link.code) }),
  );
  await t.mutation(
    api.trailStore.applyBatch,
    batch({
      id: "sess0002-ccccdddd",
      batchId: "b-page00002",
      visitor: "v-otherbrowser12",
      visit: 2,
      hello: hello(""),
    }),
  );
  const page1: any = await t.query(api.trailStore.listSessions, { serverKey, limit: 1 });
  expect(page1.sessions).toHaveLength(1);
  expect(page1.hasMore).toBe(true);
  const page2: any = await t.query(api.trailStore.listSessions, {
    serverKey,
    limit: 1,
    cursor: page1.nextCursor,
    cursorId: page1.nextCursorId,
  });
  expect(page2.sessions).toHaveLength(1);
  expect(page2.sessions[0].sid).not.toBe(page1.sessions[0].sid);
  const linked: any = await t.query(api.trailStore.listSessions, { serverKey, linkId: link.id });
  expect(linked.sessions).toHaveLength(1);
  expect(linked.sessions[0].link.code).toBe(link.code);
  const distinct: any = await t.query(api.trailStore.distinctVisitors, {
    serverKey,
    from: 0,
    to: Date.now() + 60_000,
  });
  expect(distinct.browsers).toBe(2);
  expect(distinct.sessions).toBe(2);
});
