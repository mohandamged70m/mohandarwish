import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("messages").withIndex("by_created").order("desc").collect();
  },
});

export const getLastCreated = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("messages").withIndex("by_created").order("desc").take(1);
    return rows[0]?.createdAt ?? null;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    number: v.optional(v.string()),
    hasWhatsapp: v.boolean(),
    message: v.string(),
    files: v.any(),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { createdAt, ...rest } = args;
    return await ctx.db.insert("messages", { ...rest, createdAt: createdAt ?? Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id as never);
  },
});
