import { requireServer } from "./access";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { serverKey: v.string() },
  handler: async (ctx, { serverKey }) => {
    requireServer(serverKey);
    return await ctx.db
      .query("messages")
      .withIndex("by_created")
      .order("desc")
      .collect();
  },
});

export const getLastCreated = query({
  args: { serverKey: v.string() },
  handler: async (ctx, { serverKey }) => {
    requireServer(serverKey);
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_created")
      .order("desc")
      .take(1);
    return rows[0]?.createdAt ?? null;
  },
});

export const create = mutation({
  args: {
    serverKey: v.string(),
    name: v.string(),
    email: v.string(),
    number: v.optional(v.string()),
    hasWhatsapp: v.boolean(),
    message: v.string(),
    files: v.any(),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, { serverKey, ...args }) => {
    requireServer(serverKey);
    const { createdAt, ...rest } = args;
    const now = Date.now();
    await ctx.db.insert("leads", {
      name: args.name,
      email: args.email,
      stage: "inquiry",
      note: args.message.slice(0, 5000),
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.insert("messages", {
      ...rest,
      createdAt: createdAt ?? now,
    });
  },
});

export const remove = mutation({
  args: { serverKey: v.string(), id: v.string() },
  handler: async (ctx, { serverKey, id }) => {
    requireServer(serverKey);
    await ctx.db.delete(id as never);
  },
});
