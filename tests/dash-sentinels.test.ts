import { beforeEach, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import {
  resolveWriteSentinels,
  isIncrementSentinel,
  isDeleteSentinel,
} from "../convex/docs";

const modules = import.meta.glob("../convex/**/*.ts");
const serverKey = "test-key";

beforeEach(() => {
  process.env.CONVEX_SERVER_KEY = serverKey;
});

const INC = "__dash_increment__";
const DEL = "__dash_delete_field__";

it("resolves increment and delete sentinels against the stored value", () => {
  expect(isIncrementSentinel({ [INC]: -1 })).toBe(true);
  expect(isIncrementSentinel({ [INC]: "nope" })).toBe(false);
  expect(isDeleteSentinel({ [DEL]: true })).toBe(true);
  expect(resolveWriteSentinels(5, { [INC]: -1 })).toBe(4);
  expect(resolveWriteSentinels(undefined, { [INC]: 3 })).toBe(3);
  expect(resolveWriteSentinels({ a: { n: 2 } }, {
    a: { n: { [INC]: 5 }, gone: { [DEL]: true } },
  })).toEqual({ a: { n: 7 } });
});

it("applies setDoc increment sentinels server-side", async () => {
  const t = convexTest(schema, modules);
  const path = "Analytics/Links/Items/link1";
  await t.mutation(api.docs.setDoc, {
    serverKey,
    path,
    data: { Opens: 5, Meta: { Sessions: 2 } },
  });
  await t.mutation(api.docs.setDoc, {
    serverKey,
    path,
    data: { Opens: { [INC]: -1 }, Meta: { Sessions: { [INC]: 4 } } },
  });
  expect(await t.query(api.docs.getDoc, { serverKey, path })).toEqual({
    Opens: 4,
    Meta: { Sessions: 6 },
  });
});

it("applies a whole batch in one mutation, including dotted updates and mergeFields", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.docs.setDoc, {
    serverKey,
    path: "Projects/a",
    data: { name: "A", keep: "yes", Meta: { Views: 10 }, Categories: { x: "cat" } },
  });
  await t.mutation(api.docs.setDoc, {
    serverKey,
    path: "Projects/b",
    data: { name: "B", keep: "yes" },
  });
  await t.mutation(api.docs.setDoc, {
    serverKey,
    path: "Projects/old",
    data: { name: "Old" },
  });

  await t.mutation(api.docs.applyBatch, {
    serverKey,
    ops: [
      { type: "set", path: "Projects/c", data: { name: "C" } },
      {
        type: "update",
        path: "Projects/a",
        data: {
          "Meta.Views": { [INC]: 2 },
          "Categories.x": { [DEL]: true },
        },
      },
      {
        type: "set",
        path: "Projects/b",
        data: { name: "B2", keep: "overwritten" },
        options: { mergeFields: ["name"] },
      },
      { type: "delete", path: "Projects/old" },
    ],
  });

  expect(await t.query(api.docs.getDoc, { serverKey, path: "Projects/c" })).toEqual({ name: "C" });
  expect(await t.query(api.docs.getDoc, { serverKey, path: "Projects/a" })).toEqual({
    name: "A",
    keep: "yes",
    Meta: { Views: 12 },
    Categories: {},
  });
  expect(await t.query(api.docs.getDoc, { serverKey, path: "Projects/b" })).toEqual({
    name: "B2",
    keep: "yes",
  });
  expect(await t.query(api.docs.getDoc, { serverKey, path: "Projects/old" })).toBeNull();
});

it("rolls back every write when one batch op is invalid", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.mutation(api.docs.applyBatch, {
      serverKey,
      ops: [
        { type: "set", path: "Projects/rollback", data: { ok: true } },
        { type: "update", path: "Projects/bad", data: null },
      ],
    }),
  ).rejects.toThrow("Invalid batch data");
  expect(
    await t.query(api.docs.getDoc, { serverKey, path: "Projects/rollback" }),
  ).toBeNull();
});

it("guards applyBatch with the server key", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.mutation(api.docs.applyBatch, { serverKey: "wrong", ops: [] }),
  ).rejects.toThrow("Unauthorized");
});
