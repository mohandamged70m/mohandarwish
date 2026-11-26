import { beforeEach, expect, it, vi } from "vitest";

const { dataCall } = vi.hoisted(() => ({ dataCall: vi.fn() }));
vi.mock("../lib/dash-transport", () => ({ dataCall }));

import {
  addDoc,
  collection,
  deleteField,
  doc,
  increment,
  isDeleteField,
  isIncrement,
  isServerTimestamp,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "../lib/dash-db";

beforeEach(() => {
  dataCall.mockReset();
  dataCall.mockResolvedValue(null);
});

it("keeps increment and delete sentinels distinct", () => {
  const inc = increment(-1);
  const del = deleteField();
  expect(isIncrement(inc)).toBe(true);
  expect(isIncrement(del)).toBe(false);
  expect(isDeleteField(del)).toBe(true);
  expect(isServerTimestamp(serverTimestamp())).toBe(true);
  expect(inc).toEqual({ __dash_increment__: -1 });
  expect(() => increment(Number.NaN)).toThrow();
});

it("commits a writeBatch as a single atomic batch call", async () => {
  const batch = writeBatch(undefined);
  batch.set(doc(undefined, "Projects", "a"), { name: "A" });
  batch.update(doc(undefined, "Projects", "b"), {
    "Meta.Views": increment(2),
    gone: deleteField(),
  });
  batch.delete(doc(undefined, "Projects", "old"));
  await batch.commit();

  expect(dataCall).toHaveBeenCalledTimes(1);
  const [operation, args] = dataCall.mock.calls[0] as [string, { ops: unknown[] }];
  expect(operation).toBe("batch");
  expect(args.ops).toEqual([
    { type: "set", path: "Projects/a", data: { name: "A" } },
    {
      type: "update",
      path: "Projects/b",
      data: { "Meta.Views": { __dash_increment__: 2 }, gone: { __dash_delete_field__: true } },
    },
    { type: "delete", path: "Projects/old" },
  ]);
});

it("queues transaction writes and commits them once after the callback", async () => {
  dataCall.mockImplementation((op: string) =>
    Promise.resolve(op === "getDoc" ? { Opens: 5 } : null),
  );
  const result = await runTransaction(undefined, async (tx) => {
    const snap = await tx.get(doc(undefined, "Analytics/Links/Items", "l1"));
    if (!snap.exists()) throw new Error("missing");
    tx.set(doc(undefined, "Projects", "p1"), { name: snap.data().name ?? "P" }, {
      mergeFields: ["name"],
    });
    tx.update(doc(undefined, "Analytics/Links/Items", "l1"), {
      Opens: increment(-1),
    });
    return { name: snap.id };
  });

  expect(result).toEqual({ name: "l1" });
  const operations = dataCall.mock.calls.map((c) => c[0]);
  expect(operations.filter((o) => o === "batch")).toHaveLength(1);
  expect(operations[0]).toBe("getDoc");
  const batchArgs = dataCall.mock.calls.find((c) => c[0] === "batch")?.[1] as {
    ops: unknown[];
  };
  expect(batchArgs.ops).toEqual([
    {
      type: "set",
      path: "Projects/p1",
      data: { name: "P" },
      options: { mergeFields: ["name"] },
    },
    {
      type: "update",
      path: "Analytics/Links/Items/l1",
      data: { Opens: { __dash_increment__: -1 } },
    },
  ]);
});

it("addDoc generates an id and writes through setDoc", async () => {
  const ref = await addDoc(collection(undefined, "Inbox"), { text: "hi" });
  expect(ref.path).toMatch(/^Inbox\/[^/]+$/);
  expect(ref.id).toBe(ref.path.split("/")[1]);
  expect(dataCall).toHaveBeenCalledTimes(1);
  expect(dataCall).toHaveBeenCalledWith("setDoc", {
    path: ref.path,
    data: { text: "hi" },
  });
});
