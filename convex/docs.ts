import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Generic dashboardDocs store. Mutations are transactional in Convex, so the
// read-modify-write that needed dash_merge/dash_patch/dash_patch_seq in
// Postgres is just plain TS here — no SQL functions, no fallback path.
/* eslint-disable @typescript-eslint/no-explicit-any */

// ── shared merge (twin of the old SQL dash_merge) ──
// number + number -> add (counters), object + object -> deep merge,
// anything else -> overwrite (state).
export function mergeValues(base: unknown, patch: unknown): unknown {
  if (
    base !== null &&
    patch !== null &&
    typeof base === "object" &&
    typeof patch === "object" &&
    !Array.isArray(base) &&
    !Array.isArray(patch)
  ) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, val] of Object.entries(patch as Record<string, unknown>)) {
      out[k] = mergeValues((base as Record<string, unknown>)[k], val);
    }
    return out;
  }
  if (typeof base === "number" && typeof patch === "number") return base + patch;
  return patch;
}

export const getDoc = query({
  args: { path: v.string() },
  handler: async (ctx, { path }) => {
    const row = await ctx.db
      .query("dashboardDocs")
      .withIndex("by_path", (q: any) => q.eq("path", path))
      .unique();
    return row?.data ?? null;
  },
});

export const getDocsByPaths = query({
  args: { paths: v.array(v.string()) },
  handler: async (ctx, { paths }) => {
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
  args: { prefix: v.string() },
  handler: async (ctx, { prefix }) => {
    const rows = await ctx.db.query("dashboardDocs").collect();
    const out: { path: string; data: unknown }[] = [];
    for (const row of rows) {
      if (!row.path.startsWith(prefix + "/")) continue;
      const rest = row.path.slice(prefix.length + 1);
      if (rest && !rest.includes("/")) out.push({ path: row.path, data: row.data });
    }
    return out;
  },
});

// Prefix scan (for Analytics/Sessions/Items, Analytics/Links/Items trims).
export const listByPrefix = query({
  args: { prefix: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { prefix, limit }) => {
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
  args: { path: v.string(), data: v.any() },
  handler: async (ctx, { path, data }) => {
    const existing = await ctx.db
      .query("dashboardDocs")
      .withIndex("by_path", (q: any) => q.eq("path", path))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { data, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("dashboardDocs", { path, data, updatedAt: Date.now() });
    }
  },
});

// Atomic merge-patch (replaces SQL dash_patch).
export const patchDoc = mutation({
  args: { path: v.string(), patch: v.any() },
  handler: async (ctx, { path, patch }) => {
    const existing = await ctx.db
      .query("dashboardDocs")
      .withIndex("by_path", (q: any) => q.eq("path", path))
      .unique();
    const base = (existing?.data ?? {}) as Record<string, unknown>;
    const next = mergeValues(base, patch) as Record<string, unknown>;
    if (existing) {
      await ctx.db.patch(existing._id, { data: next, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("dashboardDocs", { path, data: next, updatedAt: Date.now() });
    }
    return next;
  },
});

// Guarded exactly-once write (replaces SQL dash_patch_seq).
// Returns null when stored Seq >= seq (replay / lost race).
export const patchSeq = mutation({
  args: {
    path: v.string(),
    patch: v.any(),
    seq: v.number(),
    events: v.any(),
  },
  handler: async (ctx, { path, patch, seq, events }) => {
    const existing = await ctx.db
      .query("dashboardDocs")
      .withIndex("by_path", (q: any) => q.eq("path", path))
      .unique();
    const cur = (existing?.data ?? {}) as Record<string, unknown>;
    const curSeq = typeof cur.Seq === "number" ? cur.Seq : 0;
    if (curSeq >= seq) return null;
    const withSeq = { ...(patch as Record<string, unknown>), Seq: seq };
    const merged = mergeValues(cur, withSeq) as Record<string, unknown>;
    const prevEvents = Array.isArray(cur.Events) ? (cur.Events as unknown[]) : [];
    const add = Array.isArray(events) ? (events as unknown[]) : [];
    merged.Events = [...prevEvents, ...add];
    if (existing) {
      await ctx.db.patch(existing._id, { data: merged, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("dashboardDocs", { path, data: merged, updatedAt: Date.now() });
    }
    return merged;
  },
});

export const deleteDoc = mutation({
  args: { path: v.string() },
  handler: async (ctx, { path }) => {
    const existing = await ctx.db
      .query("dashboardDocs")
      .withIndex("by_path", (q: any) => q.eq("path", path))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const deleteDocs = mutation({
  args: { paths: v.array(v.string()) },
  handler: async (ctx, { paths }) => {
    for (const path of paths) {
      const existing = await ctx.db
        .query("dashboardDocs")
        .withIndex("by_path", (q: any) => q.eq("path", path))
        .unique();
      if (existing) await ctx.db.delete(existing._id);
    }
  },
});
