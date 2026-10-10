import { requireServer } from "./access";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { serverKey: v.string() },
  handler: async (ctx, { serverKey }) => {
    requireServer(serverKey);
    const rows = await ctx.db.query("availability").take(1);
    return rows[0] ?? null;
  },
});

export const upsert = mutation({
  args: {
    serverKey: v.string(),
    workingDays: v.array(v.number()),
    hours: v.array(v.number()),
    timezone: v.string(),
  },
  handler: async (ctx, { serverKey, ...args }) => {
    requireServer(serverKey);
    const rows = await ctx.db.query("availability").take(1);
    if (rows[0]) {
      await ctx.db.patch(rows[0]._id, { ...args, updatedAt: Date.now() });
      return rows[0]._id;
    }
    return await ctx.db.insert("availability", {
      ...args,
      updatedAt: Date.now(),
    });
  },
});
