import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
/* eslint-disable @typescript-eslint/no-explicit-any */

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("bookings").withIndex("by_created").order("desc").collect();
  },
});

export const listSlots = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("bookings").collect();
    return rows.map((r: any) => ({ date: r.date, time: r.time }));
  },
});

export const getLastCreated = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("bookings").withIndex("by_created").order("desc").take(1);
    return rows[0]?.createdAt ?? null;
  },
});

export const slotTaken = query({
  args: { date: v.string(), time: v.string() },
  handler: async (ctx, { date, time }) => {
    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_date_time", (q: any) => q.eq("date", date).eq("time", time))
      .take(1);
    return rows.length > 0;
  },
});

export const get = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    try {
      // Convex ids are validated; old UUID-shaped ids won't parse —
      // normalize to a query that returns null instead of throwing.
      const doc = await ctx.db.get(id as never);
      return doc ?? null;
    } catch {
      return null;
    }
  },
});

export const create = mutation({
  args: {
    date: v.string(),
    time: v.string(),
    userLocalTime: v.optional(v.string()),
    userTimezone: v.optional(v.number()),
    name: v.string(),
    email: v.string(),
    reason: v.optional(v.string()),
    meetingLink: v.optional(v.string()),
    googleEventId: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { createdAt, ...rest } = args;
    return await ctx.db.insert("bookings", { ...rest, createdAt: createdAt ?? Date.now() });
  },
});

export const updateFields = mutation({
  args: {
    id: v.string(),
    patch: v.object({
      date: v.optional(v.string()),
      time: v.optional(v.string()),
      name: v.optional(v.string()),
      reason: v.optional(v.string()),
      meetingLink: v.optional(v.string()),
      googleEventId: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, patch }) => {
    await ctx.db.patch(id as never, patch);
  },
});

export const remove = mutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id as never);
  },
});
