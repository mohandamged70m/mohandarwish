import { requireServer } from "./access";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
/* eslint-disable @typescript-eslint/no-explicit-any */

const TABLES = [
  "profileExperience",
  "profileEducation",
  "profileSkills",
  "profileStack",
] as const;
type Table = (typeof TABLES)[number];

function tableName(section: string): Table | null {
  if ((TABLES as readonly string[]).includes(section)) return section as Table;
  return null;
}

export const listVisible = query({
  args: { serverKey: v.string(), table: v.string() },
  handler: async (ctx, { serverKey, table }) => {
    requireServer(serverKey);
    const t = tableName(table);
    if (!t) return [];
    const rows = await ctx.db.query(t).withIndex("by_order").collect();
    return rows.filter((r: any) => r.isVisible);
  },
});

export const listAll = query({
  args: { serverKey: v.string(), table: v.string() },
  handler: async (ctx, { serverKey, table }) => {
    requireServer(serverKey);
    const t = tableName(table);
    if (!t) return [];
    return await ctx.db.query(t).withIndex("by_order").collect();
  },
});

export const create = mutation({
  args: { serverKey: v.string(), table: v.string(), row: v.any() },
  handler: async (ctx, { serverKey, table, row }) => {
    requireServer(serverKey);
    const t = tableName(table);
    if (!t) throw new Error("Unknown table");
    const now = Date.now();
    return await ctx.db.insert(
      t as never,
      {
        ...(row as Record<string, unknown>),
        createdAt: now,
        updatedAt: now,
      } as never,
    );
  },
});

export const updateFields = mutation({
  args: {
    serverKey: v.string(),
    table: v.string(),
    id: v.string(),
    patch: v.any(),
  },
  handler: async (ctx, { serverKey, table, id, patch }) => {
    requireServer(serverKey);
    if (!tableName(table)) throw new Error("Unknown table");
    await ctx.db.patch(
      id as never,
      {
        ...(patch as Record<string, unknown>),
        updatedAt: Date.now(),
      } as never,
    );
  },
});

export const updateOrder = mutation({
  args: {
    serverKey: v.string(),
    table: v.string(),
    items: v.array(v.object({ id: v.string(), sortOrder: v.number() })),
  },
  handler: async (ctx, { serverKey, table, items }) => {
    requireServer(serverKey);
    if (!tableName(table)) throw new Error("Unknown table");
    for (const it of items) {
      await ctx.db.patch(it.id as never, { sortOrder: it.sortOrder } as never);
    }
  },
});

export const remove = mutation({
  args: { serverKey: v.string(), table: v.string(), id: v.string() },
  handler: async (ctx, { serverKey, table, id }) => {
    requireServer(serverKey);
    if (!tableName(table)) throw new Error("Unknown table");
    await ctx.db.delete(id as never);
  },
});
