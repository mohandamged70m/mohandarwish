import { requireServer } from "./access";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
/* eslint-disable @typescript-eslint/no-explicit-any */

// Convex file storage replaces the old `dash` + `attachments` buckets.
// Logical paths (src/projects-imgs/..., treasury/...) are preserved via the
// storageMap table; files themselves live in Convex storage and are served
// via the URL recorded at upload time.

export const getUploadUrl = mutation({
  args: { serverKey: v.string() },
  handler: async (ctx, { serverKey }) => {
    requireServer(serverKey);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getUrl = query({
  args: { serverKey: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, { serverKey, storageId }) => {
    requireServer(serverKey);
    return await ctx.storage.getUrl(storageId);
  },
});

export const setMapping = mutation({
  args: {
    serverKey: v.string(),
    path: v.string(),
    storageId: v.id("_storage"),
    url: v.string(),
    size: v.number(),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, { serverKey, ...args }) => {
    requireServer(serverKey);
    const existing = await ctx.db
      .query("storageMap")
      .withIndex("by_path", (q: any) => q.eq("path", args.path))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        storageId: args.storageId,
        url: args.url,
        size: args.size,
        contentType: args.contentType,
      });
    } else {
      await ctx.db.insert("storageMap", { ...args, createdAt: Date.now() });
    }
    return args.url;
  },
});

export const getByPath = query({
  args: { serverKey: v.string(), path: v.string() },
  handler: async (ctx, { serverKey, path }) => {
    requireServer(serverKey);
    return await ctx.db
      .query("storageMap")
      .withIndex("by_path", (q: any) => q.eq("path", path))
      .unique();
  },
});

// Direct children of `prefix` (Firestore listAll semantics: items = files,
// prefixes = directories, both one level deep).
export const listChildren = query({
  args: { serverKey: v.string(), prefix: v.string() },
  handler: async (ctx, { serverKey, prefix }) => {
    requireServer(serverKey);
    const rows = await ctx.db.query("storageMap").collect();
    const items: { path: string; url: string; size: number }[] = [];
    const prefixes = new Set<string>();
    const cleanPrefix = prefix.replace(/\/+$/, "");
    for (const row of rows) {
      if (cleanPrefix && !row.path.startsWith(cleanPrefix + "/")) continue;
      if (!cleanPrefix && row.path.includes("/")) {
        // top level: first segment is a prefix dir
        prefixes.add(row.path.split("/")[0]);
        continue;
      }
      const rest = cleanPrefix
        ? row.path.slice(cleanPrefix.length + 1)
        : row.path;
      if (!rest) continue;
      const idx = rest.indexOf("/");
      if (idx === -1) {
        items.push({ path: row.path, url: row.url, size: row.size });
      } else {
        prefixes.add(rest.slice(0, idx));
      }
    }
    return {
      items,
      prefixes: [...prefixes].sort().map((p) => ({
        path: cleanPrefix ? `${cleanPrefix}/${p}` : p,
      })),
    };
  },
});

export const removeByPath = mutation({
  args: { serverKey: v.string(), path: v.string() },
  handler: async (ctx, { serverKey, path }) => {
    requireServer(serverKey);
    const existing = await ctx.db
      .query("storageMap")
      .withIndex("by_path", (q: any) => q.eq("path", path))
      .unique();
    if (!existing) return;
    try {
      await ctx.storage.delete(existing.storageId);
    } catch {
      // file may already be gone; drop the mapping regardless
    }
    await ctx.db.delete(existing._id);
  },
});
