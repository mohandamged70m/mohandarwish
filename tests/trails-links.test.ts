import { beforeEach, expect, it, vi } from "vitest";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { wantsAutoCv } from "../app/mohanddarwish/[code]/landing";
import { stashTailor, readTailor, clearTailor } from "../lib/analytics/tailor";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {} }) }));
vi.mock("@/components/cv/CvModal", () => ({ requestCvOpen: () => {} }));
const modules = import.meta.glob("../convex/**/*.ts");
const serverKey = "test-key";
beforeEach(() => {
  process.env.CONVEX_SERVER_KEY = serverKey;
  // In-memory sessionStorage: the real one is a browser API.
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("window", { dispatchEvent: () => true });
});

it("creates links with collision-safe ids and unique codes", async () => {
  const t = convexTest(schema, modules);
  const a: any = await t.mutation(api.trails.createLink, {
    serverKey,
    name: "Acme",
    for: "Role",
  });
  const b: any = await t.mutation(api.trails.createLink, {
    serverKey,
    name: "Acme",
    for: "Role",
  });
  expect(a.docId).not.toBe(b.docId);
  expect(a.code).not.toBe(b.code);
  expect(a.code).toMatch(/^[A-Za-z0-9]{8}$/);
});

it("deletes a visit by session id and reconciles every aggregate", async () => {
  const t = convexTest(schema, modules);
  const link: any = await t.mutation(api.trails.createLink, {
    serverKey,
    name: "Acme",
    for: "Role",
  });
  const hello = {
    startedAt: Date.now(),
    entry: { Section: "home", Path: "/", Referrer: "", Ref: "", Utm: {} },
    device: { Type: "desktop" },
    code: link.code,
  };
  await t.mutation(api.trails.applyFlush, {
    serverKey,
    id: "del01-abcdef12",
    seq: 1,
    batchId: "b-del00001",
    visitor: "v-deldeldel12",
    visit: 1,
    add: { activeMs: 700 },
    set: { exitSection: "home" },
    events: [],
    hello,
    end: false,
    owner: false,
    geo: {},
  });
  const before: any = await t.query(api.docs.getDoc, { serverKey, path: "Analytics/Totals" });
  expect(before.Sessions).toBe(1);
  const r: any = await t.mutation(api.trails.deleteSession, {
    serverKey,
    sessionId: "del01-abcdef12",
  });
  expect(r.deleted).toBe(true);
  const after: any = await t.query(api.docs.getDoc, { serverKey, path: "Analytics/Totals" });
  expect(after.Sessions).toBe(0);
  expect(
    await t.query(api.docs.getDoc, { serverKey, path: "Analytics/Sessions/Items/del01-abcdef12" }),
  ).toBeNull();
  // A delayed retry of the deleted visit is terminal, never recreated.
  const retry: any = await t.mutation(api.trails.applyFlush, {
    serverKey,
    id: "del01-abcdef12",
    seq: 2,
    batchId: "b-del00002",
    visitor: "v-deldeldel12",
    visit: 1,
    add: { activeMs: 100 },
    set: {},
    events: [],
    hello,
    end: false,
    owner: false,
    geo: {},
  });
  expect(retry.status).toBe("terminal");
  expect(retry.reason).toBe("deleted");
  expect(
    await t.query(api.docs.getDoc, { serverKey, path: "Analytics/Sessions/Items/del01-abcdef12" }),
  ).toBeNull();
});

it("forgets link visits by DocId and zeroes the link card", async () => {
  const t = convexTest(schema, modules);
  const link: any = await t.mutation(api.trails.createLink, {
    serverKey,
    name: "Acme",
    for: "Role",
  });
  const hello = {
    startedAt: Date.now(),
    entry: { Section: "home", Path: "/", Referrer: "", Ref: "", Utm: {} },
    device: { Type: "desktop" },
    code: link.code,
  };
  await t.mutation(api.trails.applyFlush, {
    serverKey,
    id: "frg01-abcdef12",
    seq: 1,
    batchId: "b-frg00001",
    visitor: "v-frgfrgfrg12",
    visit: 1,
    add: {},
    set: {},
    events: [],
    hello,
    end: false,
    owner: false,
    geo: {},
  });
  const r: any = await t.mutation(api.trails.forgetLinkVisits, {
    serverKey,
    docId: link.docId,
  });
  expect(r.deleted).toBe(1);
  const card: any = await t.query(api.docs.getDoc, {
    serverKey,
    path: `Analytics/Links/Items/${link.docId}`,
  });
  expect(card.Sessions).toBe(0);
  expect(card.Opens).toBe(0);
  const totals: any = await t.query(api.docs.getDoc, { serverKey, path: "Analytics/Totals" });
  expect(totals.Sessions).toBe(0);
});

it("keeps the editor contract: updateLink validates, deleteLink retains visits", async () => {
  const t = convexTest(schema, modules);
  const link: any = await t.mutation(api.trails.createLink, {
    serverKey,
    name: "Acme",
    for: "Role",
  });
  await expect(
    t.mutation(api.trails.updateLink, { serverKey, docId: link.docId, patch: { Name: "" } }),
  ).rejects.toThrow();
  await t.mutation(api.trails.updateLink, {
    serverKey,
    docId: link.docId,
    patch: { Tailor: { AutoCv: false, Greeting: "Hi", Pinned: [] } },
  });
  const kept: any = await t.query(api.docs.getDoc, {
    serverKey,
    path: `Analytics/Links/Items/${link.docId}`,
  });
  expect(kept.Tailor).toEqual({ AutoCv: false, Greeting: "Hi", Pinned: [] });
  await t.mutation(api.trails.deleteLink, { serverKey, docId: link.docId });
  expect(
    await t.query(api.docs.getDoc, { serverKey, path: `Analytics/Links/Items/${link.docId}` }),
  ).toBeNull();
});

it("explicit AutoCv:false wins over HR labels", () => {
  expect(wantsAutoCv({ Code: "x", Name: "HR Manager", For: "Role", Tailor: { AutoCv: false, Greeting: "", Pinned: [] } } as any)).toBe(false);
  expect(wantsAutoCv({ Code: "x", Name: "HR Manager", For: "Role", Tailor: { AutoCv: true, Greeting: "", Pinned: [] } } as any)).toBe(true);
  // Absent setting keeps the HR default.
  expect(wantsAutoCv({ Code: "x", Name: "Recruiter", For: "Role", Tailor: {} } as any)).toBe(true);
  expect(wantsAutoCv({ Code: "x", Name: "Christina", For: "Engineer", Tailor: {} } as any)).toBe(false);
});

it("tailor round-trips through the resolved server shape", () => {
  clearTailor();
  stashTailor({ AutoCv: true, Greeting: "Hello", Pinned: ["demo"] }, { Name: "Acme", For: "Role" });
  expect(readTailor()).toEqual({
    AutoCv: true,
    Greeting: "Hello",
    Pinned: ["demo"],
    LinkName: "Acme",
    LinkFor: "Role",
  });
  clearTailor();
  expect(readTailor()).toBeNull();
});

it("prunes old sessions without touching lifetime totals", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(api.docs.setDoc, {
    serverKey,
    path: "Analytics/Sessions/Items/old01-abcdef12",
    data: { StartedAt: Date.now() - 90 * 24 * 3600_000, LastSeenAt: Date.now() - 90 * 24 * 3600_000, Seq: 3 },
  });
  await t.mutation(api.docs.setDoc, { serverKey, path: "Analytics/Totals", data: { Sessions: 5 } });
  const r: any = await t.mutation(api.trails.pruneSessions, {
    serverKey,
    olderThanMs: 30 * 24 * 3600_000,
  });
  expect(r.pruned).toBe(1);
  expect(
    await t.query(api.docs.getDoc, { serverKey, path: "Analytics/Sessions/Items/old01-abcdef12" }),
  ).toBeNull();
  const totals: any = await t.query(api.docs.getDoc, { serverKey, path: "Analytics/Totals" });
  expect(totals.Sessions).toBe(5);
});
