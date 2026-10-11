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
  Code: "MIGRATE1",
  Name: "Acme",
  For: "Frontend role",
  Created: 1700000000000,
  Opens: 0,
  Sessions: 0,
  LastOpenAt: null,
  Notify: true,
  Tailor: { AutoCv: false, Greeting: "Hi", Pinned: [] },
};

function hello(code = "") {
  return {
    startedAt: Date.now(),
    entry: { Section: "home", Path: "/", Referrer: "", Ref: "", Utm: { utm_source: "nl" } },
    device: { Type: "desktop", OS: "Linux", Browser: "Chrome" },
    ...(code ? { code } : {}),
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

async function seed(t: any) {
  await t.mutation(api.docs.setDoc, {
    serverKey,
    path: "Analytics/Links/Items/1",
    data: LINK,
  });
  await t.mutation(
    api.trails.applyFlush,
    flush({ batchId: "b-mig00001", hello: hello("MIGRATE1") }),
  );
  await t.mutation(
    api.trails.applyFlush,
    flush({
      id: "direct01-abcdef12",
      batchId: "b-mig00002",
      visitor: "v-direct000012",
      hello: hello(""),
    }),
  );
  // A deleted visit: row gone, tombstone left behind.
  await t.mutation(api.trails.deleteSession, { serverKey, sessionId: "direct01-abcdef12" });
}

it("reports legacy vs migrated counts", async () => {
  const t = convexTest(schema, modules);
  await seed(t);
  const s: any = await t.query(api.trailMigration.status, { serverKey });
  expect(s.legacy.links).toBe(1);
  expect(s.legacy.sessions).toBe(1); // the direct visit was deleted
  expect(s.legacy.tombs).toBe(1);
  expect(s.migrated.sessions).toBe(0);
});

it("dry-runs without writing anything", async () => {
  const t = convexTest(schema, modules);
  await seed(t);
  const r: any = await t.mutation(api.trailMigration.migrate, { serverKey });
  expect(r.dryRun).toBe(true);
  expect(r.migrated.links).toBe(1);
  expect(r.migrated.sessions).toBe(1);
  const s: any = await t.query(api.trailMigration.status, { serverKey });
  expect(s.migrated.sessions).toBe(0);
  expect(s.migrated.links).toBe(0);
});

it("migrates faithfully, then repeats with no duplicates", async () => {
  const t = convexTest(schema, modules);
  await seed(t);
  const first: any = await t.mutation(api.trailMigration.migrate, {
    serverKey,
    write: true,
  });
  expect(first.dryRun).toBe(false);
  expect(first.migrated).toMatchObject({ tombs: 1, links: 1, sessions: 1 });
  expect(first.migrated.events).toBeGreaterThan(0);
  expect(first.done).toBe(true);

  // Link preserved with code, counters, and tailor; session relinked by code.
  const link: any = await t.query(api.trailStore.resolveLink, { serverKey, code: "MIGRATE1" });
  expect(link.name).toBe("Acme");
  expect(link.sessions).toBe(1);
  expect(link.tailor).toEqual({ AutoCv: false, Greeting: "Hi", Pinned: [] });
  const story: any = await t.query(api.trailStore.getStory, {
    serverKey,
    sid: "abc12345-ef678901",
  });
  expect(story.link.code).toBe("MIGRATE1");
  expect(story.activeMs).toBe(800);
  expect(story.sections).toEqual({ home: 800 });
  expect(story.events).toHaveLength(1);

  // Aggregates copied as-is: lifetime totals survive exactly.
  const ov: any = await t.query(api.trailStore.overview, {
    serverKey,
    from: "2000-01-01",
    to: "2100-01-01",
  });
  expect(ov.totals.sessions).toBe(1);
  expect(ov.totals.linkOpens).toBe(1);

  // Tombstoned visit stays gone on the typed side too.
  const retry: any = await t.mutation(
    api.trailStore.applyBatch,
    flush({ id: "direct01-abcdef12", batchId: "b-mig00099", hello: hello("") }),
  );
  expect(retry.status).toBe("terminal");
  expect(retry.reason).toBe("deleted");

  // Idempotent repeat: nothing new, nothing duplicated.
  const second: any = await t.mutation(api.trailMigration.migrate, {
    serverKey,
    write: true,
  });
  expect(second.migrated).toMatchObject({ tombs: 0, links: 0, sessions: 0, events: 0 });
  expect(second.done).toBe(true);
  const ov2: any = await t.query(api.trailStore.overview, {
    serverKey,
    from: "2000-01-01",
    to: "2100-01-01",
  });
  expect(ov2.totals.sessions).toBe(1);
});

it("migrates in bounded batches with resume", async () => {
  const t = convexTest(schema, modules);
  await seed(t);
  // One more live session so two remain.
  await t.mutation(
    api.trails.applyFlush,
    flush({
      id: "second02-abcdef12",
      batchId: "b-mig00003",
      visitor: "v-second000012",
      visit: 2,
      hello: hello(""),
    }),
  );
  const part: any = await t.mutation(api.trailMigration.migrate, {
    serverKey,
    write: true,
    limit: 1,
  });
  expect(part.migrated.sessions).toBe(1);
  expect(part.done).toBe(false);
  expect(part.remainingSessions).toBe(1);
  const rest: any = await t.mutation(api.trailMigration.migrate, {
    serverKey,
    write: true,
    limit: 1,
  });
  expect(rest.migrated.sessions).toBe(1);
  expect(rest.done).toBe(true);
});
