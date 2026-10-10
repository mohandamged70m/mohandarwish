import { requireServer } from "./access";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
/* eslint-disable @typescript-eslint/no-explicit-any */

function minutes(time: string) {
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d) (AM|PM)$/.exec(time);
  if (!match) throw new Error("Invalid booking time");
  return (
    ((Number(match[1]) % 12) + (match[3] === "PM" ? 12 : 0)) * 60 +
    Number(match[2])
  );
}
function active(row: { status?: string; expiresAt?: number }) {
  return row.status !== "pending" || (row.expiresAt ?? 0) > Date.now();
}

export const list = query({
  args: { serverKey: v.string() },
  handler: async (ctx, { serverKey }) => {
    requireServer(serverKey);
    return (
      await ctx.db
        .query("bookings")
        .withIndex("by_created")
        .order("desc")
        .collect()
    ).filter(active);
  },
});

export const listSlots = query({
  args: { serverKey: v.string() },
  handler: async (ctx, { serverKey }) => {
    requireServer(serverKey);
    const rows = await ctx.db.query("bookings").collect();
    return rows.filter(active).map((r) => ({ date: r.date, time: r.time }));
  },
});

export const getLastCreated = query({
  args: { serverKey: v.string() },
  handler: async (ctx, { serverKey }) => {
    requireServer(serverKey);
    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_created")
      .order("desc")
      .take(1);
    return rows[0]?.createdAt ?? null;
  },
});

export const slotTaken = query({
  args: { serverKey: v.string(), date: v.string(), time: v.string() },
  handler: async (ctx, { serverKey, date, time }) => {
    requireServer(serverKey);
    const rows = await ctx.db
      .query("bookings")
      .withIndex("by_date_time", (q: any) =>
        q.eq("date", date).eq("time", time),
      )
      .take(1);
    return rows.length > 0;
  },
});

export const get = query({
  args: { serverKey: v.string(), id: v.string() },
  handler: async (ctx, { serverKey, id }) => {
    requireServer(serverKey);
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
    serverKey: v.string(),
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
  handler: async (ctx, { serverKey, ...args }) => {
    requireServer(serverKey);
    const existing = await ctx.db
      .query("bookings")
      .withIndex("by_date_time", (q) => q.eq("date", args.date))
      .collect();
    const start = minutes(args.time);
    if (
      existing.some(
        (row) =>
          active(row) &&
          minutes(row.time) < start + 60 &&
          minutes(row.time) + 60 > start,
      )
    )
      throw new Error("SLOT_TAKEN");
    const { createdAt, ...rest } = args;
    return await ctx.db.insert("bookings", {
      ...rest,
      status: "pending",
      expiresAt: Date.now() + 120_000,
      createdAt: createdAt ?? Date.now(),
    });
  },
});

export const updateFields = mutation({
  args: {
    serverKey: v.string(),
    id: v.string(),
    patch: v.object({
      status: v.optional(v.union(v.literal("pending"), v.literal("confirmed"))),
      expiresAt: v.optional(v.number()),
      date: v.optional(v.string()),
      time: v.optional(v.string()),
      name: v.optional(v.string()),
      reason: v.optional(v.string()),
      meetingLink: v.optional(v.string()),
      googleEventId: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { serverKey, id, patch }) => {
    requireServer(serverKey);
    const bookingId = ctx.db.normalizeId("bookings", id);
    if (!bookingId) throw new Error("Not found");
    const current = await ctx.db.get(bookingId);
    if (!current) throw new Error("Not found");
    const date = patch.date ?? current.date;
    const time = patch.time ?? current.time;
    const start = minutes(time);
    if (patch.date || patch.time || patch.status === "confirmed") {
      const rows = await ctx.db
        .query("bookings")
        .withIndex("by_date_time", (q) => q.eq("date", date))
        .collect();
      if (
        rows.some(
          (row) =>
            row._id !== bookingId &&
            active(row) &&
            minutes(row.time) < start + 60 &&
            minutes(row.time) + 60 > start,
        )
      )
        throw new Error("SLOT_TAKEN");
    }
    await ctx.db.patch(bookingId, patch);
  },
});

export const remove = mutation({
  args: { serverKey: v.string(), id: v.string() },
  handler: async (ctx, { serverKey, id }) => {
    requireServer(serverKey);
    await ctx.db.delete(id as never);
  },
});
