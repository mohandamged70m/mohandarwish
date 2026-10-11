import { beforeEach, expect, it, vi } from "vitest";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { sendSafe } from "../lib/resend";

vi.mock("server-only", () => ({}));
const modules = import.meta.glob("../convex/**/*.ts");
const serverKey = "test-key";
beforeEach(() => {
  process.env.CONVEX_SERVER_KEY = serverKey;
});

function hello(code: string) {
  return {
    startedAt: Date.now(),
    entry: { Section: "home", Path: "/", Referrer: "", Ref: "", Utm: {} },
    device: { Type: "desktop", OS: "Linux", Browser: "Chrome" },
    code,
  };
}

function batch(sid: string, batchId: string, code: string, visitor: string) {
  return {
    serverKey,
    id: sid,
    seq: 1,
    batchId,
    visitor,
    visit: 1,
    add: { activeMs: 100 },
    set: {},
    events: [],
    hello: hello(code),
    end: false,
    owner: false,
    geo: { Country: "", Code: "" },
  };
}

for (const mod of ["trails", "trailStore"] as const) {
  it(`${mod}: outboxDue returns pending plus retryable failed, bounded at 3 attempts`, async () => {
    const t = convexTest(schema, modules);
    const m: any = (api as any)[mod];
    const link: any = await t.mutation(m.createLink, {
      serverKey,
      name: "Notify",
      for: "Role",
      notify: true,
    });
    const apply = mod === "trails" ? m.applyFlush : m.applyBatch;
    const mark = mod === "trails" ? m.outboxMark : m.outboxSet;
    await t.mutation(apply, batch("sess0001-aaaabbbb", "b-ntf00001", link.code, "v-visitor000001"));
    await t.mutation(apply, batch("sess0002-ccccdddd", "b-ntf00002", link.code, "v-visitor000002"));
    let due: any[] = await t.query(m.outboxDue, { serverKey, limit: 10 });
    expect(due).toHaveLength(2);

    // Fail one row once: still due (bounded retries allow 3 attempts).
    await t.mutation(mark, { serverKey, id: due[0]._id, status: "failed", error: "boom" });
    due = await t.query(m.outboxDue, { serverKey, limit: 10 });
    expect(due).toHaveLength(2);

    // Fail it twice more: attempts exhausted, drops out of the due set.
    for (let i = 0; i < 2; i++)
      await t.mutation(mark, { serverKey, id: due[0]._id, status: "failed", error: "boom" });
    due = await t.query(m.outboxDue, { serverKey, limit: 10 });
    expect(due).toHaveLength(1);
    expect(due[0].sessionId).toBe("sess0002-ccccdddd");

    const recent: any[] = await t.query(m.outboxRecent, {
      serverKey,
      linkCode: link.code,
      limit: 10,
    });
    expect(recent.length).toBeGreaterThanOrEqual(2);
    expect(recent.every((r) => r.linkCode === link.code)).toBe(true);
  });
}

it("sendSafe forwards a stable idempotency key to the provider", async () => {
  const calls: Array<{ params: unknown; opts: unknown }> = [];
  const fake = {
    emails: {
      send: async (params: unknown, opts: unknown) => {
        calls.push({ params, opts });
        return { data: { id: "mail-1" } };
      },
    },
  };
  const r = await sendSafe(fake as never, {
    from: "a@b.c",
    to: "owner@x.y",
    subject: "s",
    html: "<p>h</p>",
  }, { idempotencyKey: "trails-outbox-row1" });
  expect(r).toEqual({ id: "mail-1" });
  expect(calls).toHaveLength(1);
  expect(calls[0].opts).toEqual({ idempotencyKey: "trails-outbox-row1" });
});
