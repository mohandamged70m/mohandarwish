import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Lift-and-shift schema: Convex tables match the current product model 1:1.
// dashboardDocs is the generic Firestore-emulation store (path -> data)
// that lib/dash-db.ts reads/writes. Everything else is a proper table.

export default defineSchema({
  leads: defineTable({
    name: v.string(),
    email: v.string(),
    stage: v.string(),
    note: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_updated", ["updatedAt"]),
  workProjects: defineTable({
    title: v.string(),
    clientName: v.string(),
    clientEmail: v.string(),
    summary: v.string(),
    status: v.string(),
    paymentStatus: v.string(),
    invoiceUrl: v.string(),
    dueDate: v.string(),
    leadId: v.optional(v.id("leads")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_updated", ["updatedAt"]),
  milestones: defineTable({
    projectId: v.id("workProjects"),
    title: v.string(),
    description: v.string(),
    previewUrl: v.string(),
    dueDate: v.string(),
    status: v.string(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),
  projectNotes: defineTable({
    projectId: v.id("workProjects"),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_project", ["projectId", "createdAt"]),
  rateLimits: defineTable({
    key: v.string(),
    count: v.number(),
    expiresAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_expiry", ["expiresAt"]),
  // ── Generic document store (Settings/*, Projects/*, Tags/*, Analytics/*, Treasury/*)
  dashboardDocs: defineTable({
    path: v.string(),
    data: v.any(),
    updatedAt: v.number(),
  }).index("by_path", ["path"]),

  // ── Availability: single logical row
  availability: defineTable({
    workingDays: v.array(v.number()),
    hours: v.array(v.number()),
    timezone: v.string(),
    updatedAt: v.number(),
  }),

  // Logical path -> Convex storageId mapping for the Firestore-compatible
  // storage shim in lib/dash-storage.ts (path verbatim, bucket semantics).
  storageMap: defineTable({
    path: v.string(),
    storageId: v.id("_storage"),
    url: v.string(),
    size: v.number(),
    contentType: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_path", ["path"]),

  // ── Bookings
  bookings: defineTable({
    date: v.string(),
    time: v.string(),
    status: v.optional(v.union(v.literal("pending"), v.literal("confirmed"))),
    expiresAt: v.optional(v.number()),
    userLocalTime: v.optional(v.string()),
    userTimezone: v.optional(v.number()),
    name: v.string(),
    email: v.string(),
    reason: v.optional(v.string()),
    meetingLink: v.optional(v.string()),
    googleEventId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_date_time", ["date", "time"])
    .index("by_created", ["createdAt"]),

  // ── Messages (contact inbox)
  messages: defineTable({
    name: v.string(),
    email: v.string(),
    number: v.optional(v.string()),
    hasWhatsapp: v.boolean(),
    message: v.string(),
    files: v.any(),
    createdAt: v.number(),
  }).index("by_created", ["createdAt"]),

  // ── Profile content (/about)
  profileExperience: defineTable({
    company: v.string(),
    role: v.string(),
    period: v.string(),
    startDate: v.optional(v.union(v.string(), v.null())),
    endDate: v.optional(v.union(v.string(), v.null())),
    slug: v.optional(v.union(v.string(), v.null())),
    brand: v.optional(v.union(v.string(), v.null())),
    location: v.optional(v.union(v.string(), v.null())),
    description: v.optional(v.union(v.string(), v.null())),
    link: v.optional(v.union(v.string(), v.null())),
    sortOrder: v.number(),
    isVisible: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_order", ["sortOrder", "createdAt"]),

  profileEducation: defineTable({
    school: v.string(),
    degree: v.string(),
    period: v.string(),
    startDate: v.optional(v.union(v.string(), v.null())),
    endDate: v.optional(v.union(v.string(), v.null())),
    slug: v.optional(v.union(v.string(), v.null())),
    link: v.optional(v.union(v.string(), v.null())),
    sortOrder: v.number(),
    isVisible: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_order", ["sortOrder", "createdAt"]),

  profileSkills: defineTable({
    label: v.string(),
    sortOrder: v.number(),
    isVisible: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_order", ["sortOrder", "createdAt"]),

  profileStack: defineTable({
    label: v.string(),
    slug: v.string(),
    bg: v.string(),
    fg: v.string(),
    iconUrl: v.optional(v.union(v.string(), v.null())),
    sortOrder: v.number(),
    isVisible: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_order", ["sortOrder", "createdAt"]),
});
