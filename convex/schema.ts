import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Lift-and-shift schema: Convex tables match the current product model 1:1.
// dashboardDocs is the generic Firestore-emulation store (path -> data)
// that lib/dash-db.ts reads/writes. Everything else is a proper table.

export default defineSchema({
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
  // ── Trails notification outbox (ingest writes, sender drains)
  trailOutbox: defineTable({
    sessionId: v.string(),
    linkCode: v.string(),
    linkName: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    attempts: v.number(),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_status", ["status", "createdAt"])
    .index("by_session", ["sessionId"]),

  // ── Trails typed store (Phase 2; see docs/TRAILS-IMPLEMENTATION.md)
  // Share codes are URL lookup values, never document IDs: sessions point at
  // links by Convex document ID (linkId), codes resolve via by_code.
  trailLinks: defineTable({
    code: v.string(),
    name: v.string(),
    for: v.string(),
    created: v.number(),
    opens: v.number(),
    sessions: v.number(),
    lastOpenAt: v.union(v.number(), v.null()),
    notify: v.boolean(),
    tailor: v.object({
      autoCv: v.boolean(),
      greeting: v.string(),
      pinned: v.array(v.string()),
    }),
  })
    .index("by_code", ["code"])
    .index("by_created", ["created"]),
  trailVisitors: defineTable({
    visitor: v.string(),
    firstSeenAt: v.number(),
    visits: v.number(),
  }).index("by_visitor", ["visitor"]),
  trailSessions: defineTable({
    sid: v.string(),
    visitor: v.string(),
    visit: v.number(),
    seq: v.number(),
    startedAt: v.number(),
    lastSeenAt: v.number(),
    endedAt: v.union(v.number(), v.null()),
    ended: v.boolean(),
    owner: v.boolean(),
    activeMs: v.number(),
    openMs: v.number(),
    idleMs: v.number(),
    linkId: v.optional(v.id("trailLinks")),
    entry: v.object({
      section: v.string(),
      path: v.string(),
      referrer: v.string(),
      ref: v.string(),
      utm: v.record(v.string(), v.string()),
    }),
    source: v.object({
      name: v.string(),
      kind: v.union(
        v.literal("ai"),
        v.literal("search"),
        v.literal("social"),
        v.literal("mail"),
        v.literal("referral"),
        v.literal("direct"),
      ),
    }),
    device: v.object({
      type: v.string(),
      os: v.string(),
      browser: v.string(),
      screen: v.string(),
      viewport: v.string(),
      language: v.string(),
      theme: v.string(),
      timezone: v.string(),
      localTime: v.string(),
      touch: v.boolean(),
    }),
    geo: v.object({ country: v.string(), code: v.string() }),
    exitSection: v.string(),
    sections: v.record(v.string(), v.number()),
    scroll: v.record(v.string(), v.number()),
    projects: v.record(
      v.string(),
      v.object({
        opens: v.number(),
        ms: v.number(),
        live: v.number(),
        github: v.number(),
        download: v.number(),
      }),
    ),
    socials: v.record(
      v.string(),
      v.object({ clicks: v.number(), awayMs: v.number() }),
    ),
    cvOpens: v.number(),
    contact: v.object({
      opens: v.number(),
      tab: v.string(),
      sent: v.string(),
    }),
    copies: v.number(),
    rage: v.number(),
    prints: v.number(),
    flushes: v.number(),
    eventsCut: v.boolean(),
    perf: v.object({ loadMs: v.number(), lcpMs: v.number() }),
    appliedBatches: v.array(v.string()),
    confirmed: v.array(
      v.object({ sub: v.string(), kind: v.string(), at: v.number() }),
    ),
  })
    .index("by_sid", ["sid"])
    .index("by_started", ["startedAt"])
    .index("by_visitor_started", ["visitor", "startedAt"])
    .index("by_link_started", ["linkId", "startedAt"]),
  trailEvents: defineTable({
    sessionId: v.id("trailSessions"),
    t: v.number(),
    k: v.string(),
    v: v.optional(v.string()),
  }).index("by_session_t", ["sessionId", "t"]),
  trailBatches: defineTable({
    batchId: v.string(),
    sessionId: v.id("trailSessions"),
    seq: v.number(),
    createdAt: v.number(),
  })
    .index("by_batch", ["batchId"])
    .index("by_session", ["sessionId"]),
  trailDays: defineTable({
    day: v.string(),
    sessions: v.number(),
    visitors: v.number(),
    returning: v.number(),
    activeMs: v.number(),
    projects: v.number(),
    socials: v.number(),
    contacts: v.number(),
    cv: v.number(),
    linkOpens: v.number(),
    countries: v.record(v.string(), v.number()),
    devices: v.record(v.string(), v.number()),
  }).index("by_day", ["day"]),
  trailTotals: defineTable({
    key: v.string(),
    sessions: v.number(),
    visitors: v.number(),
    returning: v.number(),
    events: v.number(),
    projects: v.number(),
    socials: v.number(),
    contacts: v.number(),
    cv: v.number(),
    linkOpens: v.number(),
    lastAt: v.number(),
  }).index("by_key", ["key"]),
  trailSources: defineTable({
    name: v.string(),
    kind: v.string(),
    sessions: v.number(),
    lastAt: v.number(),
  }).index("by_name", ["name"]),
  trailSocials: defineTable({
    name: v.string(),
    clicks: v.number(),
    awayMs: v.number(),
    lastAt: v.number(),
  }).index("by_name", ["name"]),
  trailProjects: defineTable({
    project: v.string(),
    opens: v.number(),
    ms: v.number(),
    live: v.number(),
    github: v.number(),
    download: v.number(),
    lastAt: v.number(),
  }).index("by_project", ["project"]),
  trailTombs: defineTable({
    sid: v.string(),
    deletedAt: v.number(),
  }).index("by_sid", ["sid"]),
});
