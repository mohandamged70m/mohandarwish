import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServer } from "./access";
/* eslint-disable @typescript-eslint/no-explicit-any */

// Typed Trails store (Phase 2; see docs/TRAILS-IMPLEMENTATION.md).
//
// Same ingest semantics as trails.applyFlush (add/set/max/append, immutable
// batch dedupe, transactional aggregates, tombstoned deletes), but on typed
// tables with explicit validators and indexes instead of the generic
// dashboardDocs path/data emulation:
//   trailLinks (by_code) / trailVisitors / trailSessions (by_sid, by_started,
//   by_visitor_started, by_link_started) / trailEvents (by_session_t) /
//   trailBatches (by_batch) / trailDays (by_day) / trailTotals (by_key) /
//   trailSources / trailSocials / trailProjects / trailTombs (by_sid).
// Notifications reuse the typed trailOutbox table.
//
// Relationships use Convex document IDs: sessions carry linkId (Id<trailLinks>).
// Share codes are URL lookup values resolved via by_code, never database IDs.

const MAX_SEQ = 300;
const MAX_EVENTS_PER_FLUSH = 120;
const MAX_EVENTS_TOTAL = 500;
const MAX_KEYS = 60;
const HOUR_MS = 60 * 60 * 1000;
const MAX_SESSION_AGE_MS = 12 * HOUR_MS;
const MAX_BATCHES_TRACKED = 25;

const ID_RE = /^[a-z0-9]{1,14}-[a-z0-9]{4,20}$/i;
const VISITOR_RE = /^v-[a-z0-9]{8,20}$/;
const BATCH_RE = /^[a-z0-9-]{8,64}$/i;
const CODE_RE = /^[A-Za-z0-9_-]{4,32}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const EVENT_KINDS = new Set([
  "section", "project", "project_end", "out", "social", "social_back",
  "cv", "contact", "contact_tab", "contact_sent", "copy", "scroll",
  "idle", "wake", "hide", "show", "rage", "print", "end",
]);

const SOURCE_KINDS = new Set(["ai", "search", "social", "mail", "referral", "direct"]);

type Dict = Record<string, unknown>;
const isObj = (val: unknown): val is Dict =>
  !!val && typeof val === "object" && !Array.isArray(val);

function safeKey(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const s = val.trim();
  if (!s || s.length > 100) return null;
  if (s === "." || s === "..") return null;
  if (/[/[\]*~]/.test(s)) return null;
  if (s.startsWith("__")) return null;
  return s;
}
function num(val: unknown, max: number): number {
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.round(n), max);
}
function str(val: unknown, max: number): string {
  return typeof val === "string" ? val.slice(0, max) : "";
}
function deltaMap(val: unknown, max: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(val)) return out;
  let n = 0;
  for (const [k, raw] of Object.entries(val)) {
    if (n >= MAX_KEYS) break;
    const key = safeKey(k);
    const value = num(raw, max);
    if (!key || !value) continue;
    out[key] = value;
    n++;
  }
  return out;
}
function readProjects(val: unknown): Record<string, Dict> {
  const out: Record<string, Dict> = {};
  if (!isObj(val)) return out;
  let n = 0;
  for (const [rawKey, rawVal] of Object.entries(val)) {
    if (n >= MAX_KEYS) break;
    const key = safeKey(rawKey);
    if (!key || !isObj(rawVal)) continue;
    out[key] = {
      opens: num(rawVal.opens, 500),
      ms: num(rawVal.ms, 6 * HOUR_MS),
      live: num(rawVal.live, 500),
      github: num(rawVal.github, 500),
      download: num(rawVal.download, 500),
    };
    n++;
  }
  return out;
}
function readSocials(val: unknown): Record<string, Dict> {
  const out: Record<string, Dict> = {};
  if (!isObj(val)) return out;
  let n = 0;
  for (const [rawKey, rawVal] of Object.entries(val)) {
    if (n >= MAX_KEYS) break;
    const key = safeKey(rawKey);
    if (!key || !isObj(rawVal)) continue;
    const clicks = num(rawVal.clicks, 500);
    const awayMs = num(rawVal.awayMs, 6 * HOUR_MS);
    if (!clicks && !awayMs) continue;
    const prev = out[key] as { clicks: number; awayMs: number } | undefined;
    out[key] = prev
      ? { clicks: prev.clicks + clicks, awayMs: prev.awayMs + awayMs }
      : { clicks, awayMs };
    n++;
  }
  return out;
}
function readDevice(raw: unknown): Dict {
  const d = isObj(raw) ? raw : {};
  const type = str(d.Type, 10);
  return {
    type: type === "phone" || type === "tablet" ? type : "desktop",
    os: str(d.OS, 20),
    browser: str(d.Browser, 20),
    screen: str(d.Screen, 20),
    viewport: str(d.Viewport, 20),
    language: str(d.Language, 20),
    theme: str(d.Theme, 10) === "light" ? "light" : "dark",
    timezone: str(d.Timezone, 60),
    localTime: str(d.LocalTime, 10),
    touch: d.Touch === true,
  };
}
function readEntry(raw: unknown): Dict {
  const e = isObj(raw) ? raw : {};
  const utm: Record<string, string> = {};
  if (isObj(e.Utm)) {
    let n = 0;
    for (const [k, val] of Object.entries(e.Utm)) {
      if (n >= 8) break;
      const key = safeKey(k);
      if (key && typeof val === "string") {
        utm[key] = str(val, 80);
        n++;
      }
    }
  }
  return {
    section: safeKey(e.Section) || "home",
    path: str(e.Path, 200),
    referrer: redactUrl(str(e.Referrer, 300)),
    ref: str(e.Ref, 120),
    utm,
  };
}
/** Strip a URL to origin+path. Anything after `?` may identify the visitor. */
function redactUrl(raw: string): string {
  if (!raw) return "";
  return raw.split(/[?#]/)[0].slice(0, 300);
}
function todayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}
function dayOf(startedAt: unknown, now: number): string {
  const at = num(startedAt, Number.MAX_SAFE_INTEGER);
  return at ? new Date(at).toISOString().slice(0, 10) : todayKey(now);
}
function sumField(rows: Record<string, Dict>, field: string): number {
  return Object.values(rows).reduce(
    (total, row) => total + (num(row[field], Number.MAX_SAFE_INTEGER) || 0),
    0,
  );
}

// ── aggregate helpers ─────────────────────────────────────────────────────

async function getTotals(ctx: any): Promise<any> {
  const row = await ctx.db
    .query("trailTotals")
    .withIndex("by_key", (q: any) => q.eq("key", "lifetime"))
    .unique();
  if (row) return row;
  return {
    key: "lifetime", sessions: 0, visitors: 0, returning: 0, events: 0,
    projects: 0, socials: 0, contacts: 0, cv: 0, linkOpens: 0, lastAt: 0,
  };
}

interface Counts {
  opened: boolean;
  visit: number;
  countryCode: string;
  deviceType: string;
  sourceName: string;
  sourceKind: string;
  linkId: string;
  activeMs: number;
  projects: Record<string, Dict>;
  socials: Record<string, Dict>;
  contactOpens: number;
  cvOpens: number;
  events: number;
}

async function applyCounts(ctx: any, c: Counts, sign: 1 | -1, day: string, now: number): Promise<void> {
  const inc = (n: number) => Math.max(0, n) * sign;
  const projectOpens = sumField(c.projects, "opens");
  const socialClicks = sumField(c.socials, "clicks");

  const dayRow = await ctx.db
    .query("trailDays")
    .withIndex("by_day", (q: any) => q.eq("day", day))
    .unique();
  const dayNext: Dict = dayRow
    ? { ...dayRow }
    : {
        day, sessions: 0, visitors: 0, returning: 0, activeMs: 0,
        projects: 0, socials: 0, contacts: 0, cv: 0, linkOpens: 0,
        countries: {}, devices: {},
      };
  const dayAdd = (k: string, delta: number) => {
    if (delta) dayNext[k] = Math.max(0, num(dayNext[k], Number.MAX_SAFE_INTEGER) + delta);
  };
  dayAdd("activeMs", inc(c.activeMs));
  dayAdd("projects", inc(projectOpens));
  dayAdd("socials", inc(socialClicks));
  dayAdd("contacts", inc(c.contactOpens));
  dayAdd("cv", inc(c.cvOpens));
  if (c.opened) {
    dayAdd("sessions", inc(1));
    if (c.visit <= 1) dayAdd("visitors", inc(1));
    else dayAdd("returning", inc(1));
    if (c.countryCode) {
      const m = { ...((dayNext.countries as Dict) as Record<string, number>) };
      m[c.countryCode] = Math.max(0, num(m[c.countryCode], Number.MAX_SAFE_INTEGER) + inc(1));
      dayNext.countries = m;
    }
    if (c.deviceType) {
      const m = { ...((dayNext.devices as Dict) as Record<string, number>) };
      m[c.deviceType] = Math.max(0, num(m[c.deviceType], Number.MAX_SAFE_INTEGER) + inc(1));
      dayNext.devices = m;
    }
    if (c.linkId) dayAdd("linkOpens", inc(1));
  }
  if (dayRow) await ctx.db.patch(dayRow._id, dayNext);
  else await ctx.db.insert("trailDays", dayNext);

  const totals = await getTotals(ctx);
  const totNext: Dict = { ...totals };
  const totAdd = (k: string, delta: number) => {
    if (delta) totNext[k] = Math.max(0, num(totNext[k], Number.MAX_SAFE_INTEGER) + delta);
  };
  totAdd("events", inc(c.events));
  totAdd("projects", inc(projectOpens));
  totAdd("socials", inc(socialClicks));
  totAdd("contacts", inc(c.contactOpens));
  totAdd("cv", inc(c.cvOpens));
  if (sign > 0) totNext.lastAt = now;
  if (c.opened) {
    totAdd("sessions", inc(1));
    if (c.visit <= 1) totAdd("visitors", inc(1));
    else totAdd("returning", inc(1));
    if (c.linkId) totAdd("linkOpens", inc(1));
  }
  if (totals._id) await ctx.db.patch(totals._id, totNext);
  else await ctx.db.insert("trailTotals", totNext);

  if (c.opened && c.sourceName) {
    const key = safeKey(c.sourceName);
    if (key) {
      const srow = await ctx.db
        .query("trailSources")
        .withIndex("by_name", (q: any) => q.eq("name", key))
        .unique();
      if (srow && sign < 0) {
        await ctx.db.patch(srow._id, {
          sessions: Math.max(0, srow.sessions - 1),
        });
      } else if (sign > 0) {
        if (srow) {
          await ctx.db.patch(srow._id, { sessions: srow.sessions + 1, lastAt: now });
        } else {
          await ctx.db.insert("trailSources", {
            name: key, kind: c.sourceKind, sessions: 1, lastAt: now,
          });
        }
      }
    }
  }
  for (const [name, row] of Object.entries(c.socials)) {
    const clicks = num(row.clicks, 500);
    const away = num(row.awayMs, 6 * HOUR_MS);
    if (!clicks && !away) continue;
    const srow = await ctx.db
      .query("trailSocials")
      .withIndex("by_name", (q: any) => q.eq("name", name))
      .unique();
    if (sign < 0 && !srow) continue;
    if (srow) {
      await ctx.db.patch(srow._id, {
        clicks: Math.max(0, srow.clicks + inc(clicks)),
        awayMs: Math.max(0, srow.awayMs + inc(away)),
        ...(sign > 0 ? { lastAt: now } : {}),
      });
    } else {
      await ctx.db.insert("trailSocials", { name, clicks, awayMs: away, lastAt: now });
    }
  }
  for (const [project, row] of Object.entries(c.projects)) {
    const opens = num(row.opens, 500);
    const ms = num(row.ms, 6 * HOUR_MS);
    const live = num(row.live, 500);
    const gh = num(row.github, 500);
    const dl = num(row.download, 500);
    if (!opens && !ms && !live && !gh && !dl) continue;
    const prow = await ctx.db
      .query("trailProjects")
      .withIndex("by_project", (q: any) => q.eq("project", project))
      .unique();
    if (sign < 0 && !prow) continue;
    if (prow) {
      await ctx.db.patch(prow._id, {
        opens: Math.max(0, prow.opens + inc(opens)),
        ms: Math.max(0, prow.ms + inc(ms)),
        live: Math.max(0, prow.live + inc(live)),
        github: Math.max(0, prow.github + inc(gh)),
        download: Math.max(0, prow.download + inc(dl)),
        ...(sign > 0 ? { lastAt: now } : {}),
      });
    } else {
      await ctx.db.insert("trailProjects", {
        project, opens, ms, live, github: gh, download: dl, lastAt: now,
      });
    }
  }
  if (c.opened && c.linkId) {
    const lrow = await ctx.db.get(c.linkId as any).catch(() => null);
    if (lrow) {
      await ctx.db.patch(lrow._id, {
        opens: Math.max(0, lrow.opens + inc(1)),
        sessions: Math.max(0, lrow.sessions + inc(1)),
        ...(sign > 0 ? { lastOpenAt: now } : {}),
      });
    }
  }
}

/** Everything one typed visit contributed to the rollups, read back for subtraction. */
function countedSoFar(s: any): Counts {
  const projs: Record<string, Dict> = {};
  for (const [k, r] of Object.entries((s.projects ?? {}) as Record<string, any>)) {
    projs[k] = {
      opens: num(r?.opens, Number.MAX_SAFE_INTEGER),
      ms: num(r?.ms, Number.MAX_SAFE_INTEGER),
      live: num(r?.live, Number.MAX_SAFE_INTEGER),
      github: num(r?.github, Number.MAX_SAFE_INTEGER),
      download: num(r?.download, Number.MAX_SAFE_INTEGER),
    };
  }
  const socs: Record<string, Dict> = {};
  for (const [k, r] of Object.entries((s.socials ?? {}) as Record<string, any>)) {
    socs[k] = {
      clicks: num(r?.clicks, Number.MAX_SAFE_INTEGER),
      awayMs: num(r?.awayMs, Number.MAX_SAFE_INTEGER),
    };
  }
  return {
    opened: true,
    visit: Math.max(1, num(s.visit, 100000)),
    countryCode: str(s.geo?.code, 2),
    deviceType: str(s.device?.type, 10),
    sourceName: str(s.source?.name, 100),
    sourceKind: str(s.source?.kind, 20) || "referral",
    linkId: s.linkId ? String(s.linkId) : "",
    activeMs: num(s.activeMs, Number.MAX_SAFE_INTEGER),
    projects: projs,
    socials: socs,
    contactOpens: num(s.contact?.opens, Number.MAX_SAFE_INTEGER),
    cvOpens: num(s.cvOpens, Number.MAX_SAFE_INTEGER),
    events: 0, // events counted per-flush at apply time; deletions recount below
  };
}

async function subtractSession(ctx: any, s: any, now: number): Promise<void> {
  if (s.owner === true) return; // owner visits were never counted
  const c = countedSoFar(s);
  const evts = await ctx.db
    .query("trailEvents")
    .withIndex("by_session_t", (q: any) => q.eq("sessionId", s._id))
    .collect();
  c.events = evts.length;
  await applyCounts(ctx, c, -1, dayOf(s.startedAt, now), now);
}

async function tombstone(ctx: any, sid: string, now: number): Promise<void> {
  const existing = await ctx.db
    .query("trailTombs")
    .withIndex("by_sid", (q: any) => q.eq("sid", sid))
    .unique();
  if (existing) await ctx.db.patch(existing._id, { deletedAt: now });
  else await ctx.db.insert("trailTombs", { sid, deletedAt: now });
}

async function deleteSessionRows(ctx: any, s: any, now: number): Promise<void> {
  const evts = await ctx.db
    .query("trailEvents")
    .withIndex("by_session_t", (q: any) => q.eq("sessionId", s._id))
    .collect();
  for (const e of evts) await ctx.db.delete(e._id);
  const batches = await ctx.db
    .query("trailBatches")
    .withIndex("by_session", (q: any) => q.eq("sessionId", s._id))
    .collect();
  for (const b of batches) await ctx.db.delete(b._id);
  await ctx.db.delete(s._id);
  await tombstone(ctx, s.sid, now);
}

// ── ingest ────────────────────────────────────────────────────────────────

export const applyBatch = mutation({
  args: {
    serverKey: v.string(),
    id: v.string(),
    seq: v.number(),
    batchId: v.string(),
    visitor: v.string(),
    visit: v.number(),
    add: v.any(),
    set: v.any(),
    events: v.any(),
    hello: v.any(),
    end: v.boolean(),
    owner: v.boolean(),
    geo: v.any(),
    startedAtHint: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireServer(args.serverKey);
    const now = Date.now();
    const id = str(args.id, 40);
    const batchId = str(args.batchId, 64);
    const visitor = str(args.visitor, 40);
    const seq = Math.round(args.seq);
    const visit = Math.max(1, Math.round(args.visit) || 1);
    if (!ID_RE.test(id) || !VISITOR_RE.test(visitor))
      return { status: "terminal", reason: "bad-identity", tracked: false as const, hello: false as const };
    if (!BATCH_RE.test(batchId))
      return { status: "terminal", reason: "bad-batch", tracked: false as const, hello: false as const };
    if (!(seq >= 1 && seq <= MAX_SEQ))
      return { status: "terminal", reason: "bad-seq", tracked: false as const, hello: false as const };

    const session = await ctx.db
      .query("trailSessions")
      .withIndex("by_sid", (q: any) => q.eq("sid", id))
      .unique();
    const hasSession = !!session;

    const dup = await ctx.db
      .query("trailBatches")
      .withIndex("by_batch", (q: any) => q.eq("batchId", batchId))
      .unique();
    if (hasSession && dup) {
      const link = session.linkId ? await ctx.db.get(session.linkId).catch(() => null) : null;
      return {
        status: "duplicate",
        tracked: true as const,
        hello: true as const,
        seq: session.seq,
        ...(link ? { link: { Name: link.name, For: link.for } } : {}),
      };
    }
    if (hasSession && session.seq >= seq)
      return { status: "replay", tracked: true as const, hello: true as const, seq: session.seq };
    if (hasSession && now - session.startedAt > MAX_SESSION_AGE_MS)
      return { status: "terminal", reason: "expired", tracked: false as const, hello: true as const };
    const hello = isObj(args.hello) ? (args.hello as Dict) : null;
    if (!hasSession && seq > 10 && !hello)
      return { status: "terminal", reason: "unknown-visit", tracked: false as const, hello: false as const };
    if (!hasSession) {
      const tomb = await ctx.db
        .query("trailTombs")
        .withIndex("by_sid", (q: any) => q.eq("sid", id))
        .unique();
      if (tomb)
        return { status: "terminal", reason: "deleted", tracked: false as const, hello: true as const };
    }

    const add = isObj(args.add) ? (args.add as Dict) : {};
    const set = isObj(args.set) ? (args.set as Dict) : {};
    const openMs = num(add.openMs, 6 * HOUR_MS);
    const activeMs = num(add.activeMs, 6 * HOUR_MS);
    const idleMs = num(add.idleMs, 6 * HOUR_MS);
    const sections = deltaMap(add.sections, 6 * HOUR_MS);
    const cvOpens = num(add.cvOpens, 500);
    const contactOpens = num(add.contactOpens, 500);
    const copies = num(add.copies, 500);
    const rage = num(add.rage, 2000);
    const prints = num(add.prints, 200);
    const projects = readProjects(add.projects);
    const socials = readSocials(add.socials);

    const exitSection = safeKey(set.exitSection) || "";
    const scroll = deltaMap(set.scroll, 100);
    const contactTab = str(set.contactTab, 20);
    const contactSent = str(set.contactSent, 20);
    const perfRaw = isObj(set.perf) ? (set.perf as Dict) : null;
    const perf = {
      loadMs: perfRaw ? num(perfRaw.LoadMs, 10 * 60_000) : 0,
      lcpMs: perfRaw ? num(perfRaw.LcpMs, 10 * 60_000) : 0,
    };

    const incoming = Array.isArray(args.events)
      ? (args.events as unknown[]).slice(0, MAX_EVENTS_PER_FLUSH)
      : [];
    const events: Array<{ t: number; k: string; v?: string }> = [];
    for (const raw of incoming) {
      if (!isObj(raw)) continue;
      const k = str(raw.k, 20);
      if (!EVENT_KINDS.has(k)) continue;
      const val = str(raw.v, 120);
      events.push({ t: num(raw.t, 24 * HOUR_MS), k, ...(val ? { v: val } : {}) });
    }

    let linkRow: any = null;
    let linkDropped = false;
    if (!hasSession && hello) {
      const code = str(hello.code, 40);
      if (CODE_RE.test(code)) {
        linkRow = await ctx.db
          .query("trailLinks")
          .withIndex("by_code", (q: any) => q.eq("code", code))
          .unique();
        if (!linkRow) linkDropped = true;
      }
    }

    const owner = args.owner === true;
    const sessionId = hasSession
      ? (session as any)._id
      : await ctx.db.insert("trailSessions", {
          sid: id,
          visitor,
          visit,
          seq: 0,
          startedAt: num(hello?.startedAt, now) || num(args.startedAtHint, now) || now,
          lastSeenAt: now,
          endedAt: null,
          ended: false,
          owner,
          activeMs: 0,
          openMs: 0,
          idleMs: 0,
          ...(linkRow ? { linkId: linkRow._id } : {}),
          entry: readEntry(hello?.entry) as any,
          source: (() => {
            const e = readEntry(hello?.entry);
            const ref = str(e.ref, 120);
            const referrer = str(e.referrer, 300);
            const utm = (e.utm as Record<string, string>) || {};
            const firstUtm = Object.entries(utm)[0];
            let name = "Direct";
            let kind = "direct";
            if (firstUtm && /utm_source|source/i.test(firstUtm[0])) {
              name = firstUtm[1] || "Campaign";
              kind = "referral";
            } else if (ref) {
              name = ref;
              kind = "referral";
            }
            void referrer;
            if (!SOURCE_KINDS.has(kind)) kind = "referral";
            return { name, kind };
          })() as any,
          device: readDevice(hello?.device) as any,
          geo: (() => {
            const g = isObj(args.geo) ? (args.geo as Dict) : {};
            const code2 = typeof g.Code === "string" && /^[A-Z]{2}$/.test(g.Code) ? g.Code : "";
            return {
              country: typeof g.Country === "string" ? g.Country.slice(0, 80) : "",
              code: code2,
            };
          })(),
          exitSection: "",
          sections: {},
          scroll: {},
          projects: {},
          socials: {},
          cvOpens: 0,
          contact: { opens: 0, tab: "", sent: "" },
          copies: 0,
          rage: 0,
          prints: 0,
          flushes: 0,
          eventsCut: false,
          perf: { loadMs: 0, lcpMs: 0 },
          appliedBatches: [],
          confirmed: [],
        });

    const s: any = hasSession
      ? session
      : await ctx.db.get(sessionId);
    const prevEventCount = hasSession
      ? (
          await ctx.db
            .query("trailEvents")
            .withIndex("by_session_t", (q: any) => q.eq("sessionId", s._id))
            .collect()
        ).length
      : 0;
    const room = Math.max(0, MAX_EVENTS_TOTAL - prevEventCount);
    const kept = events.slice(0, room);
    for (const e of kept) {
      await ctx.db.insert("trailEvents", { sessionId: s._id, t: e.t, k: e.k, ...(e.v ? { v: e.v } : {}) });
    }
    const eventsCut = s.eventsCut || incoming.length > events.length || kept.length < events.length;

    // Explicit field semantics: counters ADD, timestamps/state REPLACE,
    // scroll takes the MAXIMUM, events APPEND (rows above, capped).
    const mergedSections = { ...(s.sections as Record<string, number>) };
    for (const [k, val] of Object.entries(sections))
      mergedSections[k] = (mergedSections[k] || 0) + val;
    const mergedScroll = { ...(s.scroll as Record<string, number>) };
    for (const [k, val] of Object.entries(scroll))
      mergedScroll[k] = Math.max(mergedScroll[k] || 0, val);
    const mergedProjects: Record<string, any> = { ...(s.projects as Record<string, any>) };
    for (const [k, row] of Object.entries(projects)) {
      const prev = mergedProjects[k] ?? { opens: 0, ms: 0, live: 0, github: 0, download: 0 };
      mergedProjects[k] = {
        opens: prev.opens + num(row.opens, 500),
        ms: prev.ms + num(row.ms, 6 * HOUR_MS),
        live: prev.live + num(row.live, 500),
        github: prev.github + num(row.github, 500),
        download: prev.download + num(row.download, 500),
      };
    }
    const mergedSocials: Record<string, any> = { ...(s.socials as Record<string, any>) };
    for (const [k, row] of Object.entries(socials)) {
      const prev = mergedSocials[k] ?? { clicks: 0, awayMs: 0 };
      mergedSocials[k] = {
        clicks: prev.clicks + num(row.clicks, 500),
        awayMs: prev.awayMs + num(row.awayMs, 6 * HOUR_MS),
      };
    }
    const appliedBatches = [...(s.appliedBatches as string[]), batchId].slice(-MAX_BATCHES_TRACKED);
    await ctx.db.patch(s._id, {
      seq,
      lastSeenAt: now,
      activeMs: s.activeMs + activeMs,
      openMs: s.openMs + openMs,
      idleMs: s.idleMs + idleMs,
      ...(args.end === true ? { ended: true, endedAt: now } : {}),
      ...(owner && !s.owner ? { owner: true } : {}),
      ...(exitSection ? { exitSection } : {}),
      sections: mergedSections,
      scroll: mergedScroll,
      projects: mergedProjects,
      socials: mergedSocials,
      cvOpens: s.cvOpens + cvOpens,
      contact: {
        opens: (s.contact as any).opens + contactOpens,
        tab: contactTab || (s.contact as any).tab,
        sent: contactSent || (s.contact as any).sent,
      },
      copies: s.copies + copies,
      rage: s.rage + rage,
      prints: s.prints + prints,
      flushes: s.flushes + 1,
      eventsCut,
      perf: perfRaw ? perf : s.perf,
      appliedBatches,
    });
    await ctx.db.insert("trailBatches", { batchId, sessionId: s._id, seq, createdAt: now });

    // Visitor ledger: first visit vs. return.
    const vrow = await ctx.db
      .query("trailVisitors")
      .withIndex("by_visitor", (q: any) => q.eq("visitor", visitor))
      .unique();
    if (!hasSession) {
      if (vrow) await ctx.db.patch(vrow._id, { visits: vrow.visits + 1 });
      else await ctx.db.insert("trailVisitors", { visitor, firstSeenAt: now, visits: 1 });
    }

    if (!owner && !s.owner) {
      const full = hasSession ? await ctx.db.get(s._id) : await ctx.db.get(sessionId);
      const f: any = full;
      await applyCounts(
        ctx,
        {
          opened: !hasSession,
          visit: f.visit,
          countryCode: f.geo.code,
          deviceType: f.device.type,
          sourceName: f.source.name,
          sourceKind: f.source.kind,
          linkId: f.linkId ? String(f.linkId) : "",
          activeMs,
          projects,
          socials,
          contactOpens,
          cvOpens,
          events: kept.length,
        },
        1,
        !hasSession ? todayKey(now) : dayOf(f.startedAt, now),
        now,
      );
    } else if (owner && hasSession && !s.owner) {
      const before = countedSoFar(s);
      const evts = await ctx.db
        .query("trailEvents")
        .withIndex("by_session_t", (q: any) => q.eq("sessionId", s._id))
        .collect();
      before.events = Math.max(0, evts.length - kept.length);
      await applyCounts(ctx, before, -1, dayOf(s.startedAt, now), now);
    }

    let notifyQueued = false;
    if (!hasSession && !owner && linkRow?.notify) {
      await ctx.db.insert("trailOutbox", {
        sessionId: id,
        linkCode: linkRow.code,
        linkName: linkRow.name,
        status: "pending",
        attempts: 0,
        createdAt: now,
      });
      notifyQueued = true;
    }

    return {
      status: "applied",
      tracked: true as const,
      hello: true as const,
      seq,
      ...(linkDropped ? { linkDropped: true as const } : {}),
      ...(linkRow
        ? {
            tailor: {
              AutoCv: linkRow.tailor.autoCv,
              Greeting: linkRow.tailor.greeting,
              Pinned: linkRow.tailor.pinned,
            },
            link: { Name: linkRow.name, For: linkRow.for },
            notifyQueued,
          }
        : {}),
    };
  },
});

// ── links ───────────────────────────────────────────────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export const createLink = mutation({
  args: {
    serverKey: v.string(),
    name: v.string(),
    for: v.string(),
    notify: v.optional(v.boolean()),
    autoCv: v.optional(v.boolean()),
  },
  handler: async (ctx, { serverKey, name, for: forWho, notify, autoCv }) => {
    requireServer(serverKey);
    const Name = str(name, 120).trim();
    const For = str(forWho, 120).trim();
    if (!Name || !For) throw new Error("Name and For are required");
    const now = Date.now();
    for (let attempt = 0; attempt < 5; attempt++) {
      let code = "";
      const bytes = new Uint32Array(8);
      crypto.getRandomValues(bytes);
      for (let i = 0; i < 8; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
      const taken = await ctx.db
        .query("trailLinks")
        .withIndex("by_code", (q: any) => q.eq("code", code))
        .unique();
      if (taken) continue;
      const id = await ctx.db.insert("trailLinks", {
        code,
        name: Name,
        for: For,
        created: now,
        opens: 0,
        sessions: 0,
        lastOpenAt: null,
        notify: notify !== false,
        tailor: { autoCv: autoCv === true, greeting: "", pinned: [] },
      });
      return { id, code };
    }
    throw new Error("Could not allocate a link code");
  },
});

export const resolveLink = query({
  args: { serverKey: v.string(), code: v.string() },
  handler: async (ctx, { serverKey, code }) => {
    requireServer(serverKey);
    const c = str(code, 40);
    if (!CODE_RE.test(c)) return null;
    const row = await ctx.db
      .query("trailLinks")
      .withIndex("by_code", (q: any) => q.eq("code", c))
      .unique();
    if (!row) return null;
    return {
      id: row._id,
      code: row.code,
      name: row.name,
      for: row.for,
      created: row.created,
      opens: row.opens,
      sessions: row.sessions,
      lastOpenAt: row.lastOpenAt,
      notify: row.notify,
      tailor: {
        AutoCv: row.tailor.autoCv,
        Greeting: row.tailor.greeting,
        Pinned: row.tailor.pinned,
      },
    };
  },
});

export const listLinks = query({
  args: { serverKey: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { serverKey, limit }) => {
    requireServer(serverKey);
    const rows = await ctx.db
      .query("trailLinks")
      .withIndex("by_created")
      .order("desc")
      .take(Math.min(Math.max(limit ?? 100, 1), 500));
    return rows.map((r: any) => ({
      id: r._id,
      code: r.code,
      name: r.name,
      for: r.for,
      created: r.created,
      opens: r.opens,
      sessions: r.sessions,
      lastOpenAt: r.lastOpenAt,
      notify: r.notify,
      tailor: {
        AutoCv: r.tailor.autoCv,
        Greeting: r.tailor.greeting,
        Pinned: r.tailor.pinned,
      },
    }));
  },
});

export const updateLink = mutation({
  args: {
    serverKey: v.string(),
    id: v.id("trailLinks"),
    patch: v.any(),
  },
  handler: async (ctx, { serverKey, id, patch }) => {
    requireServer(serverKey);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Not found");
    const p = isObj(patch) ? (patch as Dict) : {};
    const next: Dict = {};
    if (p.Name !== undefined) {
      const val = str(p.Name, 120).trim();
      if (!val) throw new Error("Name is required");
      next.name = val;
    }
    if (p.For !== undefined) {
      const val = str(p.For, 120).trim();
      if (!val) throw new Error("For is required");
      next.for = val;
    }
    if (p.Notify !== undefined) next.notify = p.Notify !== false;
    if (p.Tailor !== undefined) {
      const t = isObj(p.Tailor) ? (p.Tailor as Dict) : {};
      const pinned = Array.isArray(t.Pinned)
        ? t.Pinned.map((x) => safeKey(x)).filter((x): x is string => !!x).slice(0, 12)
        : [];
      next.tailor = {
        autoCv: t.AutoCv === true,
        greeting: str(t.Greeting, 160),
        pinned,
      };
    }
    if (Object.keys(next).length) await ctx.db.patch(id, next as any);
    return { id };
  },
});

/** Remove a link; historic visits and aggregates are retained. */
export const deleteLink = mutation({
  args: { serverKey: v.string(), id: v.id("trailLinks") },
  handler: async (ctx, { serverKey, id }) => {
    requireServer(serverKey);
    const existing = await ctx.db.get(id);
    if (!existing) return { deleted: false };
    await ctx.db.delete(id);
    return { deleted: true };
  },
});

// ── reads ───────────────────────────────────────────────────────────────────

async function linkInfo(ctx: any, linkId: unknown): Promise<any> {
  if (!linkId) return null;
  try {
    const row = await ctx.db.get(linkId as any);
    if (!row) return null;
    return { id: row._id, code: row.code, name: row.name, for: row.for };
  } catch {
    return null;
  }
}

function sessionView(s: any, link: any): any {
  return {
    id: s._id,
    sid: s.sid,
    visitor: s.visitor,
    visit: s.visit,
    seq: s.seq,
    startedAt: s.startedAt,
    lastSeenAt: s.lastSeenAt,
    endedAt: s.endedAt,
    ended: s.ended,
    owner: s.owner,
    activeMs: s.activeMs,
    openMs: s.openMs,
    idleMs: s.idleMs,
    link,
    linkCode: link?.code ?? null,
    entry: s.entry,
    source: s.source,
    device: s.device,
    geo: s.geo,
    exitSection: s.exitSection,
    sections: s.sections,
    scroll: s.scroll,
    projects: s.projects,
    socials: s.socials,
    cvOpens: s.cvOpens,
    contact: s.contact,
    copies: s.copies,
    rage: s.rage,
    prints: s.prints,
    flushes: s.flushes,
    eventsCut: s.eventsCut,
    perf: s.perf,
  };
}

export const listSessions = query({
  args: {
    serverKey: v.string(),
    linkId: v.optional(v.id("trailLinks")),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    activity: v.optional(
      v.union(
        v.literal("all"),
        v.literal("live"),
        v.literal("links"),
        v.literal("direct"),
        v.literal("contacted"),
        v.literal("converted"),
      ),
    ),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
    cursorId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServer(args.serverKey);
    const now = Date.now();
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const cursor = args.cursor ?? Number.MAX_SAFE_INTEGER;
    const cursorId = str(args.cursorId ?? "", 64);
    const activity = args.activity ?? "all";
    const needle = str(args.search ?? "", 80).trim().toLowerCase();
    const LIVE_MS = 60_000;
    // Chronological scan (newest first), bounded so filters cannot run away.
    // Collected then sorted by (startedAt, _id) desc: two visits opened in the
    // same millisecond still paginate deterministically.
    const base = args.linkId
      ? ctx.db
          .query("trailSessions")
          .withIndex("by_link_started", (q: any) => q.eq("linkId", args.linkId))
          .order("desc")
      : ctx.db.query("trailSessions").withIndex("by_started").order("desc");
    const candidates: any[] = [];
    for await (const s of base) {
      if (s.startedAt > cursor) continue;
      if (args.from && s.startedAt < args.from) break;
      candidates.push(s);
      if (candidates.length >= 2000) break;
    }
    candidates.sort((a, b) =>
      b.startedAt - a.startedAt || (b._id < a._id ? -1 : b._id > a._id ? 1 : 0),
    );
    let start = 0;
    if (cursorId) {
      const at = candidates.findIndex(
        (s) => s.startedAt === cursor && String(s._id) === cursorId,
      );
      // Anchor deleted since: resume at the first strictly older row.
      start = at >= 0 ? at + 1 : candidates.findIndex((s) => s.startedAt < cursor);
      if (start < 0) start = candidates.length;
    } else if (cursor < Number.MAX_SAFE_INTEGER) {
      start = candidates.findIndex((s) => s.startedAt < cursor);
      if (start < 0) start = candidates.length;
    }
    const out: any[] = [];
    let end = start;
    for (; end < candidates.length && out.length < limit; end++) {
      const s: any = candidates[end];
      if (args.to && s.startedAt > args.to) continue;
      if (s.owner) continue;
      if (activity === "links" && !s.linkId) continue;
      if (activity === "direct" && s.linkId) continue;
      if (activity === "live" && (s.ended || now - s.lastSeenAt > LIVE_MS || s.lastSeenAt > now)) continue;
      if (activity === "contacted" && !((s.contact as any)?.opens || (s.contact as any)?.sent)) continue;
      if (activity === "converted" && !(s.contact as any)?.sent) continue;
      const link = await linkInfo(ctx, s.linkId);
      if (needle) {
        const hay = [
          (s.geo as any)?.country, (s.geo as any)?.code,
          (s.device as any)?.browser, (s.device as any)?.os,
          (s.entry as any)?.ref, link?.name, link?.for,
        ]
          .map((x) => str(x, 120).toLowerCase())
          .join(" ");
        if (!hay.includes(needle)) continue;
      }
      out.push(sessionView(s, link));
    }
    const last = out[out.length - 1];
    return {
      sessions: out,
      nextCursor: last ? last.startedAt : 0,
      nextCursorId: last ? String(last.id) : "",
      hasMore: end < candidates.length,
    };
  },
});

export const getStory = query({
  args: { serverKey: v.string(), sid: v.string() },
  handler: async (ctx, { serverKey, sid }) => {
    requireServer(serverKey);
    const s = await ctx.db
      .query("trailSessions")
      .withIndex("by_sid", (q: any) => q.eq("sid", str(sid, 40)))
      .unique();
    if (!s) return null;
    const link = await linkInfo(ctx, (s as any).linkId);
    const events = await ctx.db
      .query("trailEvents")
      .withIndex("by_session_t", (q: any) => q.eq("sessionId", (s as any)._id))
      .order("asc")
      .take(MAX_EVENTS_TOTAL);
    return {
      ...sessionView(s, link),
      events: events.map((e: any) => ({ t: e.t, k: e.k, ...(e.v ? { v: e.v } : {}) })),
    };
  },
});

export const overview = query({
  args: {
    serverKey: v.string(),
    from: v.string(),
    to: v.string(),
  },
  handler: async (ctx, { serverKey, from, to }) => {
    requireServer(serverKey);
    const f = DAY_RE.test(from) ? from : "1970-01-01";
    const t = DAY_RE.test(to) ? to : todayKey(Date.now());
    const totals = await getTotals(ctx);
    const days = await ctx.db
      .query("trailDays")
      .withIndex("by_day", (q: any) => q.gte("day", f).lte("day", t))
      .order("asc")
      .collect();
    const sources = (await ctx.db.query("trailSources").collect()).sort(
      (a: any, b: any) => b.sessions - a.sessions,
    );
    const socials = (await ctx.db.query("trailSocials").collect()).sort(
      (a: any, b: any) => b.clicks - a.clicks,
    );
    const projects = (await ctx.db.query("trailProjects").collect()).sort(
      (a: any, b: any) => b.opens + b.live * 4 + b.github * 3 + b.download * 6 - (a.opens + a.live * 4 + a.github * 3 + a.download * 6),
    );
    return {
      totals: {
        sessions: totals.sessions ?? 0,
        visitors: totals.visitors ?? 0,
        returning: totals.returning ?? 0,
        events: totals.events ?? 0,
        projects: totals.projects ?? 0,
        socials: totals.socials ?? 0,
        contacts: totals.contacts ?? 0,
        cv: totals.cv ?? 0,
        linkOpens: totals.linkOpens ?? 0,
        lastAt: totals.lastAt ?? 0,
      },
      days: days.map((d: any) => ({
        day: d.day,
        sessions: d.sessions,
        visitors: d.visitors,
        returning: d.returning,
        activeMs: d.activeMs,
        projects: d.projects,
        socials: d.socials,
        contacts: d.contacts,
        cv: d.cv,
        linkOpens: d.linkOpens,
        countries: d.countries,
        devices: d.devices,
      })),
      sources: sources.map((s: any) => ({ name: s.name, kind: s.kind, sessions: s.sessions, lastAt: s.lastAt })),
      socials: socials.map((s: any) => ({ name: s.name, clicks: s.clicks, awayMs: s.awayMs, lastAt: s.lastAt })),
      projects: projects.map((p: any) => ({
        project: p.project,
        opens: p.opens,
        ms: p.ms,
        live: p.live,
        github: p.github,
        download: p.download,
        lastAt: p.lastAt,
      })),
    };
  },
});

/** Distinct browsers across a startedAt range (bounded scan). */
export const distinctVisitors = query({
  args: { serverKey: v.string(), from: v.number(), to: v.number() },
  handler: async (ctx, { serverKey, from, to }) => {
    requireServer(serverKey);
    const seen = new Set<string>();
    let sessions = 0;
    let scanned = 0;
    const rows = ctx.db
      .query("trailSessions")
      .withIndex("by_started", (q: any) => q.gte("startedAt", from).lte("startedAt", to))
      .order("asc");
    for await (const s of rows) {
      if (++scanned > 5000) break;
      if ((s as any).owner) continue;
      sessions++;
      seen.add((s as any).visitor);
    }
    return { browsers: seen.size, sessions, truncated: scanned > 5000 };
  },
});

/**
 * Server-confirmed conversion for the typed store. Same contract as
 * trails.confirmConversion: the booking/message route calls this after its own
 * persistence succeeds; retried deliveries of one submission confirm once.
 */
export const markConversion = mutation({
  args: {
    serverKey: v.string(),
    sid: v.string(),
    sub: v.string(),
    kind: v.union(v.literal("message"), v.literal("meeting"), v.literal("book")),
  },
  handler: async (ctx, { serverKey, sid, sub, kind }) => {
    requireServer(serverKey);
    const id = str(sid, 40);
    const s = str(sub, 64);
    if (!ID_RE.test(id) || !/^[A-Za-z0-9-]{8,64}$/.test(s))
      return { confirmed: false as const, reason: "bad-identity" };
    const session = await ctx.db
      .query("trailSessions")
      .withIndex("by_sid", (q: any) => q.eq("sid", id))
      .unique();
    if (!session) return { confirmed: false as const, reason: "unknown-visit" };
    const tomb = await ctx.db
      .query("trailTombs")
      .withIndex("by_sid", (q: any) => q.eq("sid", id))
      .unique();
    if (tomb) return { confirmed: false as const, reason: "deleted" };
    const confirmed = [...((session as any).confirmed as Array<{ sub: string; kind: string; at: number }>)];
    if (confirmed.some((c) => c.sub === s))
      return { confirmed: true as const, duplicate: true as const };
    const now = Date.now();
    while (confirmed.length >= 20) confirmed.shift();
    confirmed.push({ sub: s, kind, at: now });
    await ctx.db.patch((session as any)._id, {
      contact: { opens: (session as any).contact.opens, tab: (session as any).contact.tab, sent: kind },
      confirmed,
    });
    const count = (
      await ctx.db
        .query("trailEvents")
        .withIndex("by_session_t", (q: any) => q.eq("sessionId", (session as any)._id))
        .collect()
    ).length;
    if (count < MAX_EVENTS_TOTAL) {
      const started = num((session as any).startedAt, Number.MAX_SAFE_INTEGER) || now;
      await ctx.db.insert("trailEvents", {
        sessionId: (session as any)._id,
        t: Math.max(0, Math.min(now - started, 24 * HOUR_MS)),
        k: "contact_sent",
        v: kind,
      });
    } else {
      await ctx.db.patch((session as any)._id, { eventsCut: true });
    }
    return { confirmed: true as const };
  },
});

// ── deletion ──────────────────────────────────────────────────────────────
export const deleteSession = mutation({
  args: { serverKey: v.string(), sid: v.string() },
  handler: async (ctx, { serverKey, sid }) => {
    requireServer(serverKey);
    const now = Date.now();
    const s = await ctx.db
      .query("trailSessions")
      .withIndex("by_sid", (q: any) => q.eq("sid", str(sid, 40)))
      .unique();
    if (!s) return { deleted: false };
    await subtractSession(ctx, s, now);
    await deleteSessionRows(ctx, s, now);
    return { deleted: true };
  },
});

export const forgetLinkVisits = mutation({
  args: {
    serverKey: v.string(),
    linkId: v.id("trailLinks"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { serverKey, linkId, limit }) => {
    requireServer(serverKey);
    const now = Date.now();
    const cap = Math.min(Math.max(limit ?? 200, 1), 500);
    const rows = await ctx.db
      .query("trailSessions")
      .withIndex("by_link_started", (q: any) => q.eq("linkId", linkId))
      .order("asc")
      .take(cap + 1);
    const victims = rows.slice(0, cap);
    for (const s of victims) {
      await subtractSession(ctx, s, now);
      await deleteSessionRows(ctx, s, now);
    }
    const link = await ctx.db.get(linkId);
    if (link) await ctx.db.patch(linkId, { opens: 0, sessions: 0, lastOpenAt: null });
    return { deleted: victims.length, hasMore: rows.length > cap };
  },
});

/** Explicit retention prune: drops old sessions but KEEPS lifetime totals. */
export const pruneSessions = mutation({
  args: {
    serverKey: v.string(),
    olderThanMs: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { serverKey, olderThanMs, limit }) => {
    requireServer(serverKey);
    const now = Date.now();
    const cutoff = now - Math.max(24 * 60 * 60_000, olderThanMs);
    const cap = Math.min(Math.max(limit ?? 100, 1), 500);
    const rows = await ctx.db
      .query("trailSessions")
      .withIndex("by_started", (q: any) => q.lt("startedAt", cutoff))
      .order("asc")
      .take(cap + 1);
    const victims = rows.slice(0, cap);
    for (const s of victims) await deleteSessionRows(ctx, s, now);
    return { pruned: victims.length, hasMore: rows.length > cap };
  },
});

// ── notifications ─────────────────────────────────────────────────────────

export const outboxDue = query({
  args: { serverKey: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { serverKey, limit }) => {
    requireServer(serverKey);
    const cap = Math.min(Math.max(limit ?? 10, 1), 50);
    const pending = await ctx.db
      .query("trailOutbox")
      .withIndex("by_status", (q: any) => q.eq("status", "pending"))
      .take(cap);
    if (pending.length >= cap) return pending;
    const failed = await ctx.db
      .query("trailOutbox")
      .withIndex("by_status", (q: any) => q.eq("status", "failed"))
      .take(cap);
    return [...pending, ...failed.filter((r: any) => r.attempts < 3)]
      .sort((a: any, b: any) => a.createdAt - b.createdAt)
      .slice(0, cap);
  },
});

export const outboxRecent = query({
  args: {
    serverKey: v.string(),
    linkCode: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { serverKey, linkCode, limit }) => {
    requireServer(serverKey);
    const cap = Math.min(Math.max(limit ?? 50, 1), 100);
    const code = str(linkCode ?? "", 40);
    const rows = await ctx.db.query("trailOutbox").order("desc").take(cap * 2);
    const out = [];
    for (const r of rows) {
      if (code && (r as any).linkCode !== code) continue;
      out.push(r);
      if (out.length >= cap) break;
    }
    return out;
  },
});

export const outboxList = query({
  args: {
    serverKey: v.string(),
    status: v.optional(
      v.union(v.literal("pending"), v.literal("sent"), v.literal("failed"), v.literal("skipped")),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { serverKey, status, limit }) => {
    requireServer(serverKey);
    const cap = Math.min(Math.max(limit ?? 20, 1), 50);
    if (status) {
      return await ctx.db
        .query("trailOutbox")
        .withIndex("by_status", (q: any) => q.eq("status", status))
        .order("desc")
        .take(cap);
    }
    return await ctx.db.query("trailOutbox").order("desc").take(cap);
  },
});

export const outboxSet = mutation({
  args: {
    serverKey: v.string(),
    id: v.id("trailOutbox"),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { serverKey, id, status, error }) => {
    requireServer(serverKey);
    const row = await ctx.db.get(id);
    if (!row) return { marked: false };
    await ctx.db.patch(id, {
      status,
      attempts: row.attempts + 1,
      ...(status === "sent" ? { sentAt: Date.now() } : {}),
      ...(error ? { error: error.slice(0, 300) } : {}),
    });
    return { marked: true };
  },
});

/** Read-only ingest health for the dashboard/diagnostics. */
export const diagnostics = query({
  args: { serverKey: v.string() },
  handler: async (ctx, { serverKey }) => {
    requireServer(serverKey);
    const counts: Dict = {};
    counts.links = (await ctx.db.query("trailLinks").collect()).length;
    counts.visitors = (await ctx.db.query("trailVisitors").collect()).length;
    counts.sessions = (await ctx.db.query("trailSessions").collect()).length;
    counts.tombstones = (await ctx.db.query("trailTombs").collect()).length;
    const totals = await getTotals(ctx);
    const pending = await ctx.db
      .query("trailOutbox")
      .withIndex("by_status", (q: any) => q.eq("status", "pending"))
      .take(1);
    return {
      links: counts.links,
      visitors: counts.visitors,
      sessions: counts.sessions,
      tombstones: counts.tombstones,
      totals: {
        sessions: totals.sessions ?? 0,
        visitors: totals.visitors ?? 0,
        returning: totals.returning ?? 0,
        linkOpens: totals.linkOpens ?? 0,
      },
      outboxPending: pending.length,
    };
  },
});
