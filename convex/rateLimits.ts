import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer } from "./access";
export const consume = mutation({
  args: {
    serverKey: v.string(),
    key: v.string(),
    limit: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, { serverKey, key, limit, windowMs }) => {
    requireServer(serverKey);
    const now = Date.now();
    const row = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (row && row.expiresAt > now) {
      if (row.count >= limit) return false;
      await ctx.db.patch(row._id, { count: row.count + 1 });
    } else if (row)
      await ctx.db.patch(row._id, { count: 1, expiresAt: now + windowMs });
    else
      await ctx.db.insert("rateLimits", {
        key,
        count: 1,
        expiresAt: now + windowMs,
      });
    const expired = await ctx.db
      .query("rateLimits")
      .withIndex("by_expiry", (q) => q.lt("expiresAt", now))
      .take(20);
    for (const e of expired) await ctx.db.delete(e._id);
    return true;
  },
});
