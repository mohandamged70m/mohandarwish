import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServer } from "./access";
/* eslint-disable @typescript-eslint/no-explicit-any */

// One-way migration: dashboardDocs Analytics emulation -> typed trail* tables
// (Phase 6; see docs/TRAILS-IMPLEMENTATION.md cutover runbook).
//
// Dry-run by default (write:false plans without writing). Bounded
// (limit sessions per call) and resumable: re-running skips everything
// already copied, so an interrupted migration continues where it stopped.
// Repeat execution creates no duplicates.
//
// Fidelity notes:
// - Session sids, timestamps, counters, labels, and link codes are preserved.
//   Link document IDs necessarily change (new tables); sessions are relinked
//   by share code. Direct visits and visits of deleted links keep linkId empty.
// - Aggregates (days, lifetime totals, sources, socials, project counters)
//   are copied as-is, so lifetime numbers survive exactly, including history
//   whose sessions were already pruned (pruned history is never
//   reconstructed or fabricated).
// - Project active-ms has no per-project rollup in the old model, so it is
//   summed from the migrated sessions themselves.
// - Legacy Confirmed maps store {submissionId: at} without a kind; migrated
//   entries inherit the session's Contact.Sent (fallback "message").
// - Legacy batch ids carry no per-batch seq; migrated trailBatches rows reuse
//   the session seq (only batchId is used for dedupe).
// - Tombstones migrate FIRST so delayed pre-cutover packets can never
//   recreate deleted visits through the typed ingest.
// - The notification outbox is already the shared typed trailOutbox table:
//   nothing to migrate, pending jobs stay pending.

const SESSIONS = "Analytics/Sessions/Items";
const DAYS = "Analytics/Days/Items";
const LINKS = "Analytics/Links/Items";
const SOURCES = "Analytics/Sources/Items";
const SOCIALS = "Analytics/Socials/Items";
const TOTALS = "Analytics/Totals";
const TOMBS = "Analytics/Tombstones";

type Dict = Record<string, unknown>;
const isObj = (val: unknown): val is Dict =>
  !!val && typeof val === "object" && !Array.isArray(val);
function num(val: unknown, max: number): number {
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.round(n), max);
}
function str(val: unknown, max: number): string {
  return typeof val === "string" ? val.slice(0, max) : "";
}
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

async function allDocs(ctx: any): Promise<Array<{ path: string; data: Dict }>> {
  const rows: any[] = await ctx.db.query("dashboardDocs").collect();
  return rows.map((r) => ({ path: r.path as string, data: (isObj(r.data) ? r.data : {}) as Dict }));
}

async function typedLinkIds(ctx: any): Promise<Map<string, any>> {
  const rows: any[] = await ctx.db.query("trailLinks").collect();
  const map = new Map<string, any>();
  for (const r of rows) map.set(r.code as string, r._id);
  return map;
}

async function migrateSession(ctx: any, d: Dict, linkIds: Map<string, any>, now: number): Promise<{ events: number; projectsMs: Record<string, number> }> {
  const sid = str(d.Id, 40);
  const link = isObj(d.Link) ? d.Link : null;
  const code = link ? str(link.Id, 40) : "";
  const entry = isObj(d.Entry) ? d.Entry : {};
  const utm: Record<string, string> = {};
  if (isObj(entry.Utm)) {
    for (const [k, val] of Object.entries(entry.Utm)) {
      if (typeof val === "string" && k.length <= 100) utm[k.slice(0, 100)] = val.slice(0, 80);
    }
  }
  const device = isObj(d.Device) ? d.Device : {};
  const geo = isObj(d.Geo) ? d.Geo : {};
  const source = isObj(d.Source) ? d.Source : {};
  const kind = str(source.Kind, 20);
  const contact = isObj(d.Contact) ? d.Contact : {};
  const cv = isObj(d.Cv) ? d.Cv : {};
  const perf = isObj(d.Perf) ? d.Perf : {};
  const projs: Record<string, any> = {};
  const projectsMs: Record<string, number> = {};
  if (isObj(d.Projects)) {
    for (const [k, r] of Object.entries(d.Projects)) {
      if (!isObj(r)) continue;
      projs[k.slice(0, 100)] = {
        opens: num(r.Opens, MAX_SAFE),
        ms: num(r.Ms, MAX_SAFE),
        live: num(r.Live, MAX_SAFE),
        github: num(r.Github, MAX_SAFE),
        download: num(r.Download, MAX_SAFE),
      };
      if (projs[k.slice(0, 100)].ms) projectsMs[k.slice(0, 100)] = projs[k.slice(0, 100)].ms;
    }
  }
  const socs: Record<string, any> = {};
  if (isObj(d.Socials)) {
    for (const [k, r] of Object.entries(d.Socials)) {
      if (!isObj(r)) continue;
      socs[k.slice(0, 100)] = { clicks: num(r.Clicks, MAX_SAFE), awayMs: num(r.AwayMs, MAX_SAFE) };
    }
  }
  const confirmed: Array<{ sub: string; kind: string; at: number }> = [];
  if (isObj(d.Confirmed)) {
    const sent = str(contact.Sent, 20) || "message";
    for (const [s, at] of Object.entries(d.Confirmed)) {
      if (confirmed.length >= 20) break;
      confirmed.push({ sub: s.slice(0, 64), kind: sent, at: num(at, MAX_SAFE) || now });
    }
  }
  const sessionId = await ctx.db.insert("trailSessions", {
    sid,
    visitor: str(d.Visitor, 40),
    visit: Math.max(1, num(d.Visit, 100000)),
    seq: num(d.Seq, 300),
    startedAt: num(d.StartedAt, MAX_SAFE),
    lastSeenAt: num(d.LastSeenAt, MAX_SAFE),
    endedAt: typeof d.EndedAt === "number" ? d.EndedAt : null,
    ended: d.Ended === true,
    owner: d.Owner === true,
    activeMs: num(d.ActiveMs, MAX_SAFE),
    openMs: num(d.OpenMs, MAX_SAFE),
    idleMs: num(d.IdleMs, MAX_SAFE),
    ...(code && linkIds.has(code) ? { linkId: linkIds.get(code) } : {}),
    entry: {
      section: str(entry.Section, 100) || "home",
      path: str(entry.Path, 200),
      referrer: str(entry.Referrer, 300),
      ref: str(entry.Ref, 120),
      utm,
    },
    source: {
      name: str(source.Name, 100) || "Direct",
      kind: (["ai", "search", "social", "mail", "referral", "direct"].includes(kind) ? kind : "referral") as
        "ai" | "search" | "social" | "mail" | "referral" | "direct",
    },
    device: {
      type: str(device.Type, 10),
      os: str(device.OS, 20),
      browser: str(device.Browser, 20),
      screen: str(device.Screen, 20),
      viewport: str(device.Viewport, 20),
      language: str(device.Language, 20),
      theme: str(device.Theme, 10),
      timezone: str(device.Timezone, 60),
      localTime: str(device.LocalTime, 10),
      touch: device.Touch === true,
    },
    geo: { country: str(geo.Country, 80), code: str(geo.Code, 2) },
    exitSection: str(isObj(d.Exit) ? d.Exit.Section : "", 100),
    sections: isObj(d.Sections) ? Object.fromEntries(Object.entries(d.Sections).map(([k, val]) => [k.slice(0, 100), num(val, MAX_SAFE)])) : {},
    scroll: isObj(d.Scroll) ? Object.fromEntries(Object.entries(d.Scroll).map(([k, val]) => [k.slice(0, 100), num(val, 100)])) : {},
    projects: projs,
    socials: socs,
    cvOpens: num(cv.Opens, MAX_SAFE),
    contact: { opens: num(contact.Opens, MAX_SAFE), tab: str(contact.Tab, 20), sent: str(contact.Sent, 20) },
    copies: num(d.Copies, MAX_SAFE),
    rage: num(d.Rage, MAX_SAFE),
    prints: num(d.Prints, MAX_SAFE),
    flushes: num(d.Flushes, MAX_SAFE),
    eventsCut: d.EventsCut === true,
    perf: { loadMs: num(perf.LoadMs, MAX_SAFE), lcpMs: num(perf.LcpMs, MAX_SAFE) },
    appliedBatches: Array.isArray(d.AppliedBatches)
      ? (d.AppliedBatches as unknown[]).filter((b): b is string => typeof b === "string").slice(-25)
      : [],
    confirmed,
  });
  let events = 0;
  if (Array.isArray(d.Events)) {
    for (const raw of (d.Events as unknown[]).slice(0, 500)) {
      if (!isObj(raw)) continue;
      await ctx.db.insert("trailEvents", {
        sessionId,
        t: num(raw.t, MAX_SAFE),
        k: str(raw.k, 20),
        ...(str(raw.v, 120) ? { v: str(raw.v, 120) } : {}),
      });
      events++;
    }
  }
  if (Array.isArray(d.AppliedBatches)) {
    for (const b of d.AppliedBatches as unknown[]) {
      if (typeof b !== "string") continue;
      await ctx.db.insert("trailBatches", {
        batchId: b.slice(0, 64),
        sessionId,
        seq: num(d.Seq, 300),
        createdAt: now,
      });
    }
  }
  // Visitor ledger from the visit itself (the old model stores visits on rows).
  const visitor = str(d.Visitor, 40);
  if (visitor) {
    const vrow: any = await ctx.db
      .query("trailVisitors")
      .withIndex("by_visitor", (q: any) => q.eq("visitor", visitor))
      .unique();
    const startedAt = num(d.StartedAt, MAX_SAFE);
    const visitNo = Math.max(1, num(d.Visit, 100000));
    if (vrow) {
      await ctx.db.patch(vrow._id, {
        visits: Math.max(vrow.visits, visitNo),
        firstSeenAt: startedAt && vrow.firstSeenAt ? Math.min(vrow.firstSeenAt, startedAt) : (vrow.firstSeenAt || startedAt),
      });
    } else {
      await ctx.db.insert("trailVisitors", { visitor, firstSeenAt: startedAt || now, visits: visitNo });
    }
  }
  return { events, projectsMs };
}

export const status = query({
  args: { serverKey: v.string() },
  handler: async (ctx, { serverKey }) => {
    requireServer(serverKey);
    const docs = await allDocs(ctx);
    const legacy = { sessions: 0, links: 0, days: 0, totals: false, tombs: 0 };
    for (const r of docs) {
      if (r.path.startsWith(SESSIONS + "/")) legacy.sessions++;
      else if (r.path.startsWith(LINKS + "/")) legacy.links++;
      else if (r.path.startsWith(DAYS + "/")) legacy.days++;
      else if (r.path === TOTALS) legacy.totals = true;
      else if (r.path.startsWith(TOMBS + "/")) legacy.tombs++;
    }
    const migrated = {
      sessions: (await ctx.db.query("trailSessions").collect()).length,
      links: (await ctx.db.query("trailLinks").collect()).length,
      tombs: (await ctx.db.query("trailTombs").collect()).length,
    };
    return { legacy, migrated };
  },
});

export const migrate = mutation({
  args: {
    serverKey: v.string(),
    limit: v.optional(v.number()),
    write: v.optional(v.boolean()),
  },
  handler: async (ctx, { serverKey, limit, write }) => {
    requireServer(serverKey);
    const now = Date.now();
    const doWrite = write === true;
    const cap = Math.min(Math.max(limit ?? 200, 1), 500);
    const docs = await allDocs(ctx);
    const plan = {
      tombs: [] as string[],
      links: [] as Array<{ path: string; data: Dict }>,
      sessions: [] as Array<{ path: string; sid: string; data: Dict }>,
    };
    for (const r of docs) {
      if (r.path.startsWith(TOMBS + "/")) plan.tombs.push(r.path.slice(r.path.lastIndexOf("/") + 1));
      else if (r.path.startsWith(LINKS + "/")) plan.links.push(r);
      else if (r.path.startsWith(SESSIONS + "/"))
        plan.sessions.push({ path: r.path, sid: r.path.slice(r.path.lastIndexOf("/") + 1), data: r.data });
    }
    plan.sessions.sort((a, b) => num(a.data.StartedAt, MAX_SAFE) - num(b.data.StartedAt, MAX_SAFE));

    const migrated = { tombs: 0, links: 0, sessions: 0, events: 0 };
    // 1. Tombstones first: delayed packets must never recreate deleted visits.
    for (const sid of plan.tombs) {
      const existing: any = await ctx.db
        .query("trailTombs")
        .withIndex("by_sid", (q: any) => q.eq("sid", sid))
        .unique();
      if (!existing && doWrite) {
        await ctx.db.insert("trailTombs", { sid, deletedAt: now });
        migrated.tombs++;
      } else if (!existing) migrated.tombs++;
    }
    // 2. Links (matched by code; existing typed rows are never overwritten).
    for (const { data } of plan.links) {
      const code = str(data.Code, 40);
      if (!code) continue;
      const existing: any = await ctx.db
        .query("trailLinks")
        .withIndex("by_code", (q: any) => q.eq("code", code))
        .unique();
      if (existing) continue;
      if (doWrite) {
        const tailor = isObj(data.Tailor) ? data.Tailor : {};
        await ctx.db.insert("trailLinks", {
          code,
          name: str(data.Name, 120),
          for: str(data.For, 120),
          created: num(data.Created, MAX_SAFE),
          opens: num(data.Opens, MAX_SAFE),
          sessions: num(data.Sessions, MAX_SAFE),
          lastOpenAt: typeof data.LastOpenAt === "number" ? data.LastOpenAt : null,
          notify: data.Notify !== false,
          tailor: {
            autoCv: tailor.AutoCv === true,
            greeting: str(tailor.Greeting, 160),
            pinned: Array.isArray(tailor.Pinned)
              ? (tailor.Pinned as unknown[]).filter((p): p is string => typeof p === "string").slice(0, 12)
              : [],
          },
        });
      }
      migrated.links++;
    }
    const linkIds = await typedLinkIds(ctx);
    // 3. Sessions (+events, batches, visitors), oldest first, bounded.
    let remaining = 0;
    let taken = 0;
    for (const s of plan.sessions) {
      const tombed: any = await ctx.db
        .query("trailTombs")
        .withIndex("by_sid", (q: any) => q.eq("sid", s.sid))
        .unique();
      if (tombed) continue;
      const existing: any = await ctx.db
        .query("trailSessions")
        .withIndex("by_sid", (q: any) => q.eq("sid", s.sid))
        .unique();
      if (existing) continue;
      if (taken >= cap) {
        remaining++;
        continue;
      }
      taken++;
      if (!doWrite) {
        migrated.sessions++;
        continue;
      }
      const out = await migrateSession(ctx, { ...s.data, Id: s.sid }, linkIds, now);
      migrated.sessions++;
      migrated.events += out.events;
      for (const [project, ms] of Object.entries(out.projectsMs)) {
        const prow: any = await ctx.db
          .query("trailProjects")
          .withIndex("by_project", (q: any) => q.eq("project", project))
          .unique();
        if (prow) await ctx.db.patch(prow._id, { ms: prow.ms + ms, lastAt: now });
        else await ctx.db.insert("trailProjects", { project, opens: 0, ms, live: 0, github: 0, download: 0, lastAt: now });
      }
    }
    if (doWrite) {
      // 4. Aggregates copied as-is (absolute replace = idempotent).
      for (const r of docs) {
        if (!r.path.startsWith(DAYS + "/")) continue;
        const day = r.path.slice(r.path.lastIndexOf("/") + 1);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
        const d = r.data;
        const rec = (val: unknown): Record<string, number> =>
          isObj(val) ? Object.fromEntries(Object.entries(val).map(([k, val2]) => [k, num(val2, MAX_SAFE)])) : {};
        const row: any = await ctx.db
          .query("trailDays")
          .withIndex("by_day", (q: any) => q.eq("day", day))
          .unique();
        const next = {
          day,
          sessions: num(d.Sessions, MAX_SAFE),
          visitors: num(d.Visitors, MAX_SAFE),
          returning: num(d.Returning, MAX_SAFE),
          activeMs: num(d.ActiveMs, MAX_SAFE),
          projects: num(d.Projects, MAX_SAFE),
          socials: num(d.Socials, MAX_SAFE),
          contacts: num(d.Contacts, MAX_SAFE),
          cv: num(d.Cv, MAX_SAFE),
          linkOpens: num(d.LinkOpens, MAX_SAFE),
          countries: rec(d.Countries),
          devices: rec(d.Devices),
        };
        if (row) await ctx.db.patch(row._id, next);
        else await ctx.db.insert("trailDays", next);
      }
      const totalsDoc = docs.find((r) => r.path === TOTALS)?.data ?? {};
      const totals: any = await ctx.db
        .query("trailTotals")
        .withIndex("by_key", (q: any) => q.eq("key", "lifetime"))
        .unique();
      const totalsNext = {
        key: "lifetime",
        sessions: num(totalsDoc.Sessions, MAX_SAFE),
        visitors: num(totalsDoc.Visitors, MAX_SAFE),
        returning: num(totalsDoc.Returning, MAX_SAFE),
        events: num(totalsDoc.Events, MAX_SAFE),
        projects: num(totalsDoc.Projects, MAX_SAFE),
        socials: num(totalsDoc.Socials, MAX_SAFE),
        contacts: num(totalsDoc.Contacts, MAX_SAFE),
        cv: num(totalsDoc.Cv, MAX_SAFE),
        linkOpens: num(totalsDoc.LinkOpens, MAX_SAFE),
        lastAt: num(totalsDoc.LastAt, MAX_SAFE),
      };
      if (totals) await ctx.db.patch(totals._id, totalsNext);
      else await ctx.db.insert("trailTotals", totalsNext);
      for (const r of docs) {
        if (r.path.startsWith(SOURCES + "/")) {
          const name = r.path.slice(r.path.lastIndexOf("/") + 1);
          const srow: any = await ctx.db
            .query("trailSources")
            .withIndex("by_name", (q: any) => q.eq("name", name))
            .unique();
          const next = {
            name,
            kind: str(r.data.Kind, 20),
            sessions: num(r.data.Sessions, MAX_SAFE),
            lastAt: num(r.data.LastAt, MAX_SAFE),
          };
          if (srow) await ctx.db.patch(srow._id, next);
          else await ctx.db.insert("trailSources", next);
        } else if (r.path.startsWith(SOCIALS + "/")) {
          const name = r.path.slice(r.path.lastIndexOf("/") + 1);
          const srow: any = await ctx.db
            .query("trailSocials")
            .withIndex("by_name", (q: any) => q.eq("name", name))
            .unique();
          const next = {
            name,
            clicks: num(r.data.Clicks, MAX_SAFE),
            awayMs: num(r.data.AwayMs, MAX_SAFE),
            lastAt: num(r.data.LastAt, MAX_SAFE),
          };
          if (srow) await ctx.db.patch(srow._id, next);
          else await ctx.db.insert("trailSocials", next);
        }
      }
      // Project counters from the Projects docs (Views map); ms accumulated
      // from migrated sessions above and preserved by the merge below.
      for (const r of docs) {
        if (!r.path.startsWith("Projects/") || r.path.slice("Projects/".length).includes("/")) continue;
        const project = r.path.slice("Projects/".length);
        const views = isObj(r.data.Views) ? r.data.Views : {};
        const prow: any = await ctx.db
          .query("trailProjects")
          .withIndex("by_project", (q: any) => q.eq("project", project))
          .unique();
        const next = {
          project,
          opens: num(views.Project, MAX_SAFE),
          ms: prow ? prow.ms : 0,
          live: num(views.Live, MAX_SAFE),
          github: num(views.Github, MAX_SAFE),
          download: num(views.Download, MAX_SAFE),
          lastAt: now,
        };
        if (prow) await ctx.db.patch(prow._id, next);
        else await ctx.db.insert("trailProjects", next);
      }
    }
    return { migrated, remainingSessions: remaining, done: remaining === 0, dryRun: !doWrite };
  },
});
