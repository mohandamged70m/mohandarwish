import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer } from "./access";
const leadStage = v.union(
  v.literal("inquiry"),
  v.literal("qualified"),
  v.literal("proposal"),
  v.literal("won"),
  v.literal("lost"),
);
const projectStatus = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("completed"),
);
const paymentStatus = v.union(
  v.literal("not_applicable"),
  v.literal("unpaid"),
  v.literal("partial"),
  v.literal("paid"),
);
const milestoneStatus = v.union(
  v.literal("planned"),
  v.literal("in_progress"),
  v.literal("review"),
  v.literal("done"),
  v.literal("blocked"),
);
function bounded(value: string, max = 5000) {
  if (value.length > max) throw new Error("Text too long");
}
function date(value: string) {
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Invalid date");
}
function url(value: string) {
  if (value) {
    const u = new URL(value);
    if (u.protocol !== "https:") throw new Error("Use HTTPS links");
  }
  bounded(value, 2000);
}
function email(value: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    throw new Error("Valid email required");
  bounded(value, 254);
}
export const list = query({
  args: { serverKey: v.string() },
  handler: async (ctx, { serverKey }) => {
    requireServer(serverKey);
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_updated")
      .order("desc")
      .take(100);
    const projects = await ctx.db
      .query("workProjects")
      .withIndex("by_updated")
      .order("desc")
      .take(100);
    const milestones = [];
    for (const p of projects)
      milestones.push(
        ...(await ctx.db
          .query("milestones")
          .withIndex("by_project", (q) => q.eq("projectId", p._id))
          .take(50)),
      );
    return { leads, projects, milestones };
  },
});
export const saveLead = mutation({
  args: {
    serverKey: v.string(),
    id: v.optional(v.id("leads")),
    name: v.string(),
    email: v.string(),
    stage: leadStage,
    note: v.string(),
  },
  handler: async (ctx, { serverKey, id, ...fields }) => {
    requireServer(serverKey);
    bounded(fields.name, 120);
    bounded(fields.note);
    email(fields.email);
    if (!fields.name.trim()) throw new Error("Name required");
    if (id) {
      if (!(await ctx.db.get(id))) throw new Error("Not found");
      await ctx.db.patch(id, { ...fields, updatedAt: Date.now() });
      return id;
    }
    return await ctx.db.insert("leads", {
      ...fields,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
export const saveProject = mutation({
  args: {
    serverKey: v.string(),
    id: v.optional(v.id("workProjects")),
    leadId: v.optional(v.id("leads")),
    title: v.string(),
    clientName: v.string(),
    clientEmail: v.string(),
    summary: v.string(),
    status: projectStatus,
    paymentStatus,
    invoiceUrl: v.string(),
    dueDate: v.string(),
  },
  handler: async (ctx, { serverKey, id, leadId, ...fields }) => {
    requireServer(serverKey);
    bounded(fields.title, 160);
    bounded(fields.clientName, 120);
    bounded(fields.summary);
    email(fields.clientEmail);
    url(fields.invoiceUrl);
    date(fields.dueDate);
    if (!fields.title.trim() || !fields.clientName.trim())
      throw new Error("Project title and client name required");
    if (id) {
      if (!(await ctx.db.get(id))) throw new Error("Not found");
      await ctx.db.patch(id, { ...fields, updatedAt: Date.now() });
      return id;
    }
    if (leadId) {
      if (!(await ctx.db.get(leadId))) throw new Error("Lead not found");
      await ctx.db.patch(leadId, { stage: "won", updatedAt: Date.now() });
    }
    return await ctx.db.insert("workProjects", {
      ...fields,
      ...(leadId ? { leadId } : {}),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
export const saveMilestone = mutation({
  args: {
    serverKey: v.string(),
    id: v.optional(v.id("milestones")),
    projectId: v.id("workProjects"),
    title: v.string(),
    description: v.string(),
    previewUrl: v.string(),
    dueDate: v.string(),
    status: milestoneStatus,
  },
  handler: async (ctx, { serverKey, id, ...fields }) => {
    requireServer(serverKey);
    bounded(fields.title, 160);
    bounded(fields.description);
    url(fields.previewUrl);
    date(fields.dueDate);
    if (!fields.title.trim() || !(await ctx.db.get(fields.projectId)))
      throw new Error("Project and milestone title required");
    if (id) {
      const previous = await ctx.db.get(id);
      if (!previous || previous.projectId !== fields.projectId)
        throw new Error("Not found");
      await ctx.db.patch(id, { ...fields, updatedAt: Date.now() });
      return id;
    }
    const existing = await ctx.db
      .query("milestones")
      .withIndex("by_project", (q) => q.eq("projectId", fields.projectId))
      .take(50);
    if (existing.length >= 50)
      throw new Error("Maximum 50 milestones per project");
    return await ctx.db.insert("milestones", {
      ...fields,
      updatedAt: Date.now(),
    });
  },
});
export const notes = query({
  args: { serverKey: v.string(), projectId: v.id("workProjects") },
  handler: async (ctx, { serverKey, projectId }) => {
    requireServer(serverKey);
    return await ctx.db
      .query("projectNotes")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(100);
  },
});
export const addNote = mutation({
  args: {
    serverKey: v.string(),
    projectId: v.id("workProjects"),
    body: v.string(),
  },
  handler: async (ctx, { serverKey, projectId, body }) => {
    requireServer(serverKey);
    bounded(body);
    if (!body.trim() || !(await ctx.db.get(projectId)))
      throw new Error("Project and note required");
    await ctx.db.insert("projectNotes", {
      projectId,
      body,
      createdAt: Date.now(),
    });
  },
});
