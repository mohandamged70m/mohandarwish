import { requireServer } from "./access";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Generic dashboardDocs store. Mutations are transactional in Convex, so the
// read-modify-write that needed dash_merge/dash_patch/dash_patch_seq in
// Postgres is just plain TS here — no SQL functions, no fallback path.
/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Firestore-compatible write sentinels ──
// The client emits these objects; they are resolved here, against the value as
// stored, so concurrent increments and deletes never race on a stale snapshot.
const DELETE_FIELD = "__dash_delete_field__";
const SERVER_TIMESTAMP = "__dash_server_timestamp__";
const INCREMENT = "__dash_increment__";

function isSentinel(v: unknown, key: string): boolean {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    key in (v as Record<string, unknown>)
  );
}

export function isDeleteSentinel(v: unknown): boolean {
  return isSentinel(v, DELETE_FIELD);
}
export function isTimestampSentinel(v: unknown): boolean {
  return isSentinel(v, SERVER_TIMESTAMP);
}
export function isIncrementSentinel(v: unknown): boolean {
  return (
    isSentinel(v, INCREMENT) &&
    typeof (v as Record<string, unknown>)[INCREMENT] === "number"
  );
}

/** Resolve sentinels against `base` (the stored value at the same location). */
export function resolveWriteSentinels(base: unknown, value: unknown): unknown {
  if (isIncrementSentinel(value))
    return (typeof base === "number" ? base : 0) +
      ((value as Record<string, unknown>)[INCREMENT] as number);
  if (isTimestampSentinel(value)) return new Date().toISOString();
  if (isDeleteSentinel(value)) return undefined; // callers drop the key
  if (Array.isArray(value)) {
    const baseArr = Array.isArray(base) ? base : [];
    return value.map((v, i) => resolveWriteSentinels(baseArr[i], v));
  }
  if (value && typeof value === "object") {
    const baseObj =
      base && typeof base === "object" && !Array.isArray(base)
        ? (base as Record<string, unknown>)
        : {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isDeleteSentinel(v)) continue;
      out[k] = resolveWriteSentinels(baseObj[k], v);
    }
    return out;
  }
  return value;
}

function getAt(obj: unknown, dotted: string): unknown {
  let cur = obj;
  for (const part of dotted.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function setAt(
  obj: Record<string, unknown>,
  dotted: string,
  value: unknown,
): void {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur[parts[i]];
    if (!next || typeof next !== "object" || Array.isArray(next))
      cur[parts[i]] = {};
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function delAt(obj: Record<string, unknown>, dotted: string): void {
  const parts = dotted.split(".");
  let cur: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur || typeof cur !== "object") return;
    cur = (cur as Record<string, unknown>)[parts[i]];
  }
  if (cur && typeof cur === "object")
    delete (cur as Record<string, unknown>)[parts[parts.length - 1]];
}

// ── shared merge (twin of the old SQL dash_merge) ──
// number + number -> add (counters), object + object -> deep merge,
// anything else -> overwrite (state). Sentinels are handled before the
// ordinary arithmetic so a patch never double-counts its stored base.
export function mergeValues(base: unknown, patch: unknown): unknown {
  if (isIncrementSentinel(patch))
    return (typeof base === "number" ? base : 0) +
      ((patch as Record<string, unknown>)[INCREMENT] as number);
  if (isTimestampSentinel(patch)) return new Date().toISOString();
  if (
    base !== null &&
    patch !== null &&
    typeof base === "object" &&
    typeof patch === "object" &&
    !Array.isArray(base) &&
    !Array.isArray(patch)
  ) {
    const out: Record<string, unknown> = {
      ...(base as Record<string, unknown>),
    };
    for (const [k, val] of Object.entries(patch as Record<string, unknown>)) {
      if (isDeleteSentinel(val)) delete out[k];
      else out[k] = mergeValues((base as Record<string, unknown>)[k], val);
    }
    return out;
  }
  if (typeof base === "number" && typeof patch === "number")
    return base + patch;
  return patch;
}

export const getDoc = query({
  args: { serverKey: v.string(), path: v.string() },
  handler: async (ctx, { serverKey, path }) => {
    requireServer(serverKey);
    const row = await ctx.db
      .query("dashboardDocs")
      .withIndex("by_path", (q: any) => q.eq("path", path))
      .unique();
    return row?.data ?? null;
  },
});

export const getDocsByPaths = query({
  args: { serverKey: v.string(), paths: v.array(v.string()) },
  handler: async (ctx, { serverKey, paths }) => {
    requireServer(serverKey);
    const out: { path: string; data: unknown }[] = [];
    for (const path of paths) {
      const row = await ctx.db
        .query("dashboardDocs")
        .withIndex("by_path", (q: any) => q.eq("path", path))
        .unique();
      if (row) out.push({ path: row.path, data: row.data });
    }
    return out;
  },
});

// Direct children of a collection prefix (Firestore semantics: no nested "/").
export const listCollection = query({
  args: { serverKey: v.string(), prefix: v.string() },
  handler: async (ctx, { serverKey, prefix }) => {
    requireServer(serverKey);
    const rows = await ctx.db.query("dashboardDocs").collect();
    const out: { path: string; data: unknown }[] = [];
    for (const row of rows) {
      if (!row.path.startsWith(prefix + "/")) continue;
      const rest = row.path.slice(prefix.length + 1);
      if (rest && !rest.includes("/"))
        out.push({ path: row.path, data: row.data });
    }
    return out;
  },
});

// Prefix scan (for Analytics/Sessions/Items, Analytics/Links/Items trims).
export const listByPrefix = query({
  args: {
    serverKey: v.string(),
    prefix: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { serverKey, prefix, limit }) => {
    requireServer(serverKey);
    const rows = await ctx.db.query("dashboardDocs").collect();
    const out: { path: string; data: unknown }[] = [];
    for (const row of rows) {
      if (row.path === prefix || row.path.startsWith(prefix + "/")) {
        out.push({ path: row.path, data: row.data });
        if (limit && out.length >= limit) break;
      }
    }
    return out;
  },
});

export const setDoc = mutation({
  args: { serverKey: v.string(), path: v.string(), data: v.any() },
  handler: async (ctx, { serverKey, path, data }) => {
    requireServer(serverKey);
    const existing = await ctx.db
      .query("dashboardDocs")
      .withIndex("by_path", (q: any) => q.eq("path", path))
      .unique();
    const resolved = resolveWriteSentinels(existing?.data ?? {}, data);
    if (existing) {
      await ctx.db.patch(existing._id, { data: resolved, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("dashboardDocs", {
        path,
        data: resolved,
        updatedAt: Date.now(),
      });
    }
  },
});

const batchOpValidator = v.object({
  type: v.union(v.literal("set"), v.literal("delete"), v.literal("update")),
  path: v.string(),
  data: v.optional(v.any()),
  options: v.optional(
    v.object({
      merge: v.optional(v.boolean()),
      mergeFields: v.optional(v.array(v.string())),
    }),
  ),
});

type BatchOp = {
  type: "set" | "delete" | "update";
  path: string;
  data?: unknown;
  options?: { merge?: boolean; mergeFields?: string[] };
};

/** Compute the stored document for one set/update op. */
function applyOp(base: Record<string, unknown>, op: BatchOp): Record<string, unknown> {
  if (op.type === "set") {
    const data = op.data;
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("Invalid batch data");
    if (op.options?.mergeFields?.length) {
      // mergeFields replaces only those fields, whole (no deep merge of maps).
      const next = { ...base };
      for (const field of op.options.mergeFields) {
        const val = getAt(data, field);
        if (val === undefined) continue;
        if (isDeleteSentinel(val)) delAt(next, field);
        else setAt(next, field, resolveWriteSentinels(getAt(base, field), val));
      }
      return next;
    }
    if (op.options?.merge) {
      const clean = resolveWriteSentinels(base, data) as Record<string, unknown>;
      return { ...base, ...clean };
    }
    return resolveWriteSentinels(base, data) as Record<string, unknown>;
  }
  const patch = op.data;
  if (!patch || typeof patch !== "object" || Array.isArray(patch))
    throw new Error("Invalid batch data");
  const next = { ...base };
  for (const [key, val] of Object.entries(patch as Record<string, unknown>)) {
    if (isDeleteSentinel(val)) {
      delAt(next, key);
      continue;
    }
    const resolved = resolveWriteSentinels(getAt(base, key), val);
    if (key.includes(".")) setAt(next, key, resolved);
    else next[key] = resolved;
  }
  return next;
}

// One Convex mutation is one transaction: every op commits together or none do.
export const applyBatch = mutation({
  args: { serverKey: v.string(), ops: v.array(batchOpValidator) },
  handler: async (ctx, { serverKey, ops }) => {
    requireServer(serverKey);
    if (ops.length > 500) throw new Error("Too many operations");
    for (const op of ops) {
      if (!op.path || op.path.length > 500) throw new Error("Invalid path");
      const existing = await ctx.db
        .query("dashboardDocs")
        .withIndex("by_path", (q: any) => q.eq("path", op.path))
        .unique();
      if (op.type === "delete") {
        if (existing) await ctx.db.delete(existing._id);
        continue;
      }
      const next = applyOp(
        (existing?.data ?? {}) as Record<string, unknown>,
        op,
      );
      if (existing) {
        await ctx.db.patch(existing._id, { data: next, updatedAt: Date.now() });
      } else {
        await ctx.db.insert("dashboardDocs", {
          path: op.path,
          data: next,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

// Atomic merge-patch (replaces SQL dash_patch).
export const patchDoc = mutation({
  args: { serverKey: v.string(), path: v.string(), patch: v.any() },
  handler: async (ctx, { serverKey, path, patch }) => {
    requireServer(serverKey);
    const existing = await ctx.db
      .query("dashboardDocs")
      .withIndex("by_path", (q: any) => q.eq("path", path))
      .unique();
    const base = (existing?.data ?? {}) as Record<string, unknown>;
    const next = mergeValues(base, patch) as Record<string, unknown>;
    if (existing) {
      await ctx.db.patch(existing._id, { data: next, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("dashboardDocs", {
        path,
        data: next,
        updatedAt: Date.now(),
      });
    }
    return next;
  },
});

// Guarded exactly-once write (replaces SQL dash_patch_seq).
// Returns null when stored Seq >= seq (replay / lost race).
export const patchSeq = mutation({
  args: {
    serverKey: v.string(),
    path: v.string(),
    patch: v.any(),
    seq: v.number(),
    events: v.any(),
  },
  handler: async (ctx, { serverKey, path, patch, seq, events }) => {
    requireServer(serverKey);
    const existing = await ctx.db
      .query("dashboardDocs")
      .withIndex("by_path", (q: any) => q.eq("path", path))
      .unique();
    const cur = (existing?.data ?? {}) as Record<string, unknown>;
    const curSeq = typeof cur.Seq === "number" ? cur.Seq : 0;
    if (curSeq >= seq) return null;
    const withSeq = { ...(patch as Record<string, unknown>), Seq: seq };
    const merged = mergeValues(cur, withSeq) as Record<string, unknown>;
    merged.Seq = seq;
    const prevEvents = Array.isArray(cur.Events)
      ? (cur.Events as unknown[])
      : [];
    const add = Array.isArray(events) ? (events as unknown[]) : [];
    merged.Events = [...prevEvents, ...add];
    if (existing) {
      await ctx.db.patch(existing._id, { data: merged, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("dashboardDocs", {
        path,
        data: merged,
        updatedAt: Date.now(),
      });
    }
    return merged;
  },
});

export const deleteDoc = mutation({
  args: { serverKey: v.string(), path: v.string() },
  handler: async (ctx, { serverKey, path }) => {
    requireServer(serverKey);
    const existing = await ctx.db
      .query("dashboardDocs")
      .withIndex("by_path", (q: any) => q.eq("path", path))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const deleteDocs = mutation({
  args: { serverKey: v.string(), paths: v.array(v.string()) },
  handler: async (ctx, { serverKey, paths }) => {
    requireServer(serverKey);
    for (const path of paths) {
      const existing = await ctx.db
        .query("dashboardDocs")
        .withIndex("by_path", (q: any) => q.eq("path", path))
        .unique();
      if (existing) await ctx.db.delete(existing._id);
    }
  },
});
