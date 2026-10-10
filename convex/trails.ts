import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServer } from "./access";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  canonicalSocial,
  classifySource,
  type SourceKind,
} from "../lib/analytics/source";

// Single transactional Trails ingest. Replaces the old split path where
// app/api/track applied the session write (patchSeq) and then awaited each
// rollup separately: if any rollup failed, the client saw Seq applied and
// could never repair the missing counters. Everything here — session,
// day/totals/sources/socials/link/projects deltas, batch dedupe and the
// notification outbox row — commits or rolls back together.
//
// Field semantics are explicit (the old mergeValues added EVERY number,
// so LastSeenAt/EndedAt/perf/scroll-max were summed instead of set):
//   add    -> counter deltas only (sessions, ms, opens, clicks, ...)
//   set    -> timestamps / state / perf are replaced, scroll takes the maximum
//   events -> appended once, capped, deduplicated by batchId

const SESSIONS = "Analytics/Sessions/Items";
const DAYS = "Analytics/Days/Items";
const LINKS = "Analytics/Links/Items";
const SOURCES = "Analytics/Sources/Items";
const SOCIALS = "Analytics/Socials/Items";
const TOTALS = "Analytics/Totals";
const TOMBS = "Analytics/Tombstones";

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

const EVENT_KINDS = new Set([
  "section",
  "project",
  "project_end",
  "out",
  "social",
  "social_back",
  "cv",
  "contact",
  "contact_tab",
  "contact_sent",
  "copy",
  "scroll",
  "idle",
  "wake",
  "hide",
  "show",
  "rage",
  "print",
  "end",
]);

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
      Opens: num(rawVal.opens, 500),
      Ms: num(rawVal.ms, 6 * HOUR_MS),
      Live: num(rawVal.live, 500),
      Github: num(rawVal.github, 500),
      Download: num(rawVal.download, 500),
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
    const safe = safeKey(rawKey);
    if (!safe || !isObj(rawVal)) continue;
    const key = canonicalSocial(safe);
    const row = {
      Clicks: num(rawVal.clicks, 500),
      AwayMs: num(rawVal.awayMs, 6 * HOUR_MS),
    };
    if (!row.Clicks && !row.AwayMs) continue;
    const prev = out[key] as { Clicks: number; AwayMs: number } | undefined;
    out[key] = prev
      ? { Clicks: prev.Clicks + row.Clicks, AwayMs: prev.AwayMs + row.AwayMs }
      : row;
    n++;
  }
  return out;
}
function readDevice(raw: unknown): Dict {
  const d = isObj(raw) ? raw : {};
  const type = str(d.Type, 10);
  return {
    Type: type === "phone" || type === "tablet" ? type : "desktop",
    OS: str(d.OS, 20),
    Browser: str(d.Browser, 20),
    Screen: str(d.Screen, 20),
    Viewport: str(d.Viewport, 20),
    Language: str(d.Language, 20),
    Theme: str(d.Theme, 10) === "light" ? "light" : "dark",
    Timezone: str(d.Timezone, 60),
    LocalTime: str(d.LocalTime, 10),
    Touch: d.Touch === true,
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
    Section: safeKey(e.Section) || "home",
    Path: str(e.Path, 200),
    // Stored referrers never carry query strings: tokens, session ids and
    // search queries are PII. Only marketing attribution survives, inside Utm.
    Referrer: redactUrl(str(e.Referrer, 300)),
    Ref: str(e.Ref, 120),
    Utm: utm,
  };
}

/** Strip a URL to origin+path. Anything after `?` may identify the visitor. */
function redactUrl(raw: string): string {
  if (!raw) return "";
  const cut = raw.split(/[?#]/)[0];
  return cut.slice(0, 300);
}
function readTailor(raw: unknown): {
  AutoCv: boolean;
  Greeting: string;
  Pinned: string[];
} {
  const t = isObj(raw) ? raw : {};
  const pinned = Array.isArray(t.Pinned)
    ? t.Pinned.map((p) => safeKey(p)).filter((p): p is string => !!p).slice(
        0,
        12,
      )
    : [];
  return {
    AutoCv: t.AutoCv === true,
    Greeting: str(t.Greeting, 160),
    Pinned: pinned,
  };
}
function todayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}
function dayOf(startedAt: unknown, now: number): string {
  const at = num(startedAt, Number.MAX_SAFE_INTEGER);
  return at ? new Date(at).toISOString().slice(0, 10) : todayKey(now);
}
function sumBy(rows: Record<string, Dict>, field: string): number {
  return Object.values(rows).reduce(
    (total, row) => total + (num(row[field], Number.MAX_SAFE_INTEGER) || 0),
    0,
  );
}

async function getData(ctx: any, path: string): Promise<Dict> {
  const row: any = await ctx.db
    .query("dashboardDocs")
    .withIndex("by_path", (q: any) => q.eq("path", path))
    .unique();
  const data = row?.data;
  return isObj(data) ? (data as Dict) : {};
}
async function upsertData(ctx: any, path: string, data: Dict): Promise<void> {
  const row: any = await ctx.db
    .query("dashboardDocs")
    .withIndex("by_path", (q: any) => q.eq("path", path))
    .unique();
  if (row) await ctx.db.patch(row._id, { data, updatedAt: Date.now() });
  else await ctx.db.insert("dashboardDocs", { path, data, updatedAt: Date.now() });
}

export const applyFlush = mutation({
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

    const path = `${SESSIONS}/${id}`;
    const existing = await getData(ctx, path);
    const hasSession = num(existing.StartedAt, Number.MAX_SAFE_INTEGER) > 0;

    const appliedBatches: string[] = Array.isArray(existing.AppliedBatches)
      ? (existing.AppliedBatches as unknown[]).filter(
          (b): b is string => typeof b === "string",
        )
      : [];
    if (hasSession && appliedBatches.includes(batchId)) {
      const link = isObj(existing.Link) ? existing.Link : null;
      return {
        status: "duplicate",
        tracked: true as const,
        hello: true as const,
        seq: num(existing.Seq, MAX_SEQ),
        ...(link && (link as Dict).Id
          ? { link: { Name: str((link as Dict).Name, 120), For: str((link as Dict).For, 120) } }
          : {}),
      };
    }
    if (hasSession && num(existing.Seq, Number.MAX_SAFE_INTEGER) >= seq)
      return { status: "replay", tracked: true as const, hello: true as const, seq: num(existing.Seq, MAX_SEQ) };
    if (
      hasSession &&
      now - num(existing.StartedAt, Number.MAX_SAFE_INTEGER) > MAX_SESSION_AGE_MS
    )
      return { status: "terminal", reason: "expired", tracked: false as const, hello: true as const };
    if (!hasSession && seq > 10 && !isObj(args.hello))
      return { status: "terminal", reason: "unknown-visit", tracked: false as const, hello: false as const };

    const add = isObj(args.add) ? (args.add as Dict) : {};
    const set = isObj(args.set) ? (args.set as Dict) : {};
    const hello = isObj(args.hello) ? (args.hello as Dict) : null;

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
    const perf = perfRaw
      ? {
          LoadMs: num(perfRaw.LoadMs, 10 * 60_000),
          LcpMs: num(perfRaw.LcpMs, 10 * 60_000),
        }
      : null;

    const priorEvents = Array.isArray(existing.Events) ? existing.Events.length : 0;
    const room = Math.max(0, MAX_EVENTS_TOTAL - priorEvents);
    const incoming = Array.isArray(args.events)
      ? (args.events as unknown[]).slice(0, MAX_EVENTS_PER_FLUSH)
      : [];
    const events: Array<{ t: number; k: string; v?: string }> = [];
    for (const raw of incoming) {
      if (events.length >= room) break;
      if (!isObj(raw)) continue;
      const k = str(raw.k, 20);
      if (!EVENT_KINDS.has(k)) continue;
      const val = str(raw.v, 120);
      events.push({ t: num(raw.t, 24 * HOUR_MS), k, ...(val ? { v: val } : {}) });
    }
    const eventsCut =
      Boolean(existing.EventsCut) || incoming.length > events.length;

    // Share-link resolution, opening only. Scans the bounded link collection
    // inside this same transaction. (Indexed trailLinks table is P2.)
    // A tombstoned session id is never recreated by a delayed retry.
    if (!hasSession) {
      const tomb = await getData(ctx, `${TOMBS}/${id}`);
      if (Object.keys(tomb).length)
        return { status: "terminal", reason: "deleted", tracked: false as const, hello: true as const };
    }
    let linkRow: {
      docId: string;
      path: string;
      Code: string;
      Name: string;
      For: string;
      Notify: boolean;
      Tailor: { AutoCv: boolean; Greeting: string; Pinned: string[] };
    } | null = null;
    if (!hasSession && hello) {
      const code = str(hello.code, 40);
      if (CODE_RE.test(code)) {
        const rows: any[] = await ctx.db
          .query("dashboardDocs")
          .withIndex("by_path", (q: any) =>
            q.eq("path", `${LINKS}/${code}`),
          )
          .collect();
        // Links use numeric doc ids, not the code, so fall back to a bounded scan.
        let found: any = rows[0] ?? null;
        if (!found || (found.data as Dict)?.Code !== code) {
          const all: any[] = await ctx.db.query("dashboardDocs").collect();
          let scanned = 0;
          for (const r of all) {
            if (!r.path.startsWith(LINKS + "/")) continue;
            if (++scanned > 1000) break;
            if (isObj(r.data) && (r.data as Dict).Code === code) {
              found = r;
              break;
            }
          }
          if (!found || (found.data as Dict)?.Code !== code) found = null;
        }
        if (found && isObj(found.data)) {
          const d = found.data as Dict;
          const docId = String(found.path).slice(
            String(found.path).lastIndexOf("/") + 1,
          );
          linkRow = {
            docId,
            path: String(found.path),
            Code: code,
            Name: str(d.Name, 120),
            For: str(d.For, 120),
            Notify: d.Notify !== false,
            Tailor: readTailor(d.Tailor),
          };
        }
      }
      // No valid link: share-link-only tracking stays untracked.
      if (!linkRow)
        return { status: "untracked", tracked: false as const, hello: true as const };
    }

    const owner = args.owner === true;
    let geo: { Country: string; Code: string } | null = null;
    let device: Dict = {};
    let entry: Dict = {};
    let source: { Name: string; Kind: SourceKind } | null = null;
    if (!hasSession) {
      const g = isObj(args.geo) ? (args.geo as Dict) : {};
      const code2 = typeof g.Code === "string" && /^[A-Z]{2}$/.test(g.Code) ? g.Code : "";
      geo = { Country: typeof g.Country === "string" ? g.Country.slice(0, 80) : "", Code: code2 };
      device = readDevice(hello?.device);
      entry = readEntry(hello?.entry);
      source = classifySource({
        Ref: str(entry.Ref, 120),
        Referrer: str(entry.Referrer, 300),
        Utm: (entry.Utm as Record<string, string>) || {},
      });
    }

    // Explicit session write: counters ADD, timestamps/state REPLACE,
    // scroll takes the MAXIMUM, events APPEND. Never mergeValues.
    const next: Dict = { ...(existing as Dict) };
    const addNum = (key: string, delta: number) => {
      next[key] = num(next[key], Number.MAX_SAFE_INTEGER) + delta;
    };
    addNum("ActiveMs", activeMs);
    addNum("OpenMs", openMs);
    addNum("IdleMs", idleMs);
    addNum("Copies", copies);
    addNum("Rage", rage);
    addNum("Prints", prints);
    addNum("Flushes", 1);
    const mergeCounterMap = (key: string, delta: Record<string, number>) => {
      const base = isObj(next[key]) ? { ...((next[key] as Dict) as Record<string, number>) } : {};
      for (const [k, val] of Object.entries(delta))
        base[k] = (num(base[k], Number.MAX_SAFE_INTEGER) || 0) + val;
      if (Object.keys(delta).length) next[key] = base;
    };
    mergeCounterMap("Sections", sections);
    if (contactOpens > 0) {
      const c = isObj(next.Contact) ? { ...(next.Contact as Dict) } : {};
      c.Opens = num(c.Opens, Number.MAX_SAFE_INTEGER) + contactOpens;
      next.Contact = c;
    }
    if (contactTab) {
      const c = isObj(next.Contact) ? { ...(next.Contact as Dict) } : {};
      c.Tab = contactTab;
      next.Contact = c;
    }
    if (contactSent) {
      const c = isObj(next.Contact) ? { ...(next.Contact as Dict) } : {};
      c.Sent = contactSent;
      next.Contact = c;
    }
    const mergeProjects = () => {
      const base = isObj(next.Projects) ? { ...((next.Projects as Dict) as Dict) } : {};
      for (const [k, row] of Object.entries(projects)) {
        const prev = isObj(base[k]) ? (base[k] as Dict) : {};
        base[k] = {
          Opens: num(prev.Opens, Number.MAX_SAFE_INTEGER) + num(row.Opens, 500),
          Ms: num(prev.Ms, Number.MAX_SAFE_INTEGER) + num(row.Ms, 6 * HOUR_MS),
          Live: num(prev.Live, Number.MAX_SAFE_INTEGER) + num(row.Live, 500),
          Github: num(prev.Github, Number.MAX_SAFE_INTEGER) + num(row.Github, 500),
          Download: num(prev.Download, Number.MAX_SAFE_INTEGER) + num(row.Download, 500),
        };
      }
      if (Object.keys(projects).length) next.Projects = base;
    };
    mergeProjects();
    const mergeSocials = () => {
      const base = isObj(next.Socials) ? { ...((next.Socials as Dict) as Dict) } : {};
      for (const [k, row] of Object.entries(socials)) {
        const prev = isObj(base[k]) ? (base[k] as Dict) : {};
        base[k] = {
          Clicks: num(prev.Clicks, Number.MAX_SAFE_INTEGER) + num(row.Clicks, 500),
          AwayMs: num(prev.AwayMs, Number.MAX_SAFE_INTEGER) + num(row.AwayMs, 6 * HOUR_MS),
        };
      }
      if (Object.keys(socials).length) next.Socials = base;
    };
    mergeSocials();
    if (isObj(next.Cv) || cvOpens > 0) {
      const c = isObj(next.Cv) ? { ...(next.Cv as Dict) } : {};
      c.Opens = num(c.Opens, Number.MAX_SAFE_INTEGER) + cvOpens;
      next.Cv = c;
    }
    // Replace semantics.
    next.LastSeenAt = now;
    if (exitSection) next.Exit = { Section: exitSection };
    if (perf) next.Perf = perf;
    if (events.length) next.EventsCut = eventsCut;
    if (Object.keys(scroll).length) {
      const prev = isObj(next.Scroll) ? { ...((next.Scroll as Dict) as Record<string, number>) } : {};
      for (const [k, val] of Object.entries(scroll))
        prev[k] = Math.max(num(prev[k], 100), val);
      next.Scroll = prev;
    }
    if (args.end === true) {
      next.Ended = true;
      next.EndedAt = now;
    } else if (!hasSession) {
      next.Ended = false;
      next.EndedAt = null;
    }
    // Appending events + batch dedupe id + sequence REPLACE the old number.
    const prevEvents = Array.isArray(next.Events) ? (next.Events as unknown[]) : [];
    next.Events = [...prevEvents, ...events];
    next.Seq = seq;
    next.AppliedBatches = [...appliedBatches, batchId].slice(-MAX_BATCHES_TRACKED);

    if (!hasSession) {
      const startedAt = num(hello?.startedAt, now) || num(args.startedAtHint, now) || now;
      next.StartedAt = startedAt;
      next.Visitor = visitor;
      next.Visit = visit;
      next.Owner = owner;
      next.Legacy = false;
      next.Entry = entry;
      next.Source = source;
      next.Device = device;
      next.Geo = geo;
      if (!next.Exit)
        next.Exit = { Section: str(entry.Section, 100) || "home" };
      if (!isObj(next.Scroll)) next.Scroll = scroll;
      if (!isObj(next.Projects)) next.Projects = {};
      if (!isObj(next.Socials)) next.Socials = {};
      if (!isObj(next.Sections)) next.Sections = sections;
      next.Link = linkRow
        ? { Id: linkRow.Code, DocId: linkRow.docId, Name: linkRow.Name, For: linkRow.For }
        : null;
    } else if (owner && !existing.Owner) {
      next.Owner = true;
    }

    await upsertData(ctx, path, next);

    // Aggregates inside the same transaction. Owner visits are recorded but
    // never counted; a visit recognised as owner mid-stream is subtracted.
    const countedBefore = hasSession
      ? {
          activeMs: num(existing.ActiveMs, Number.MAX_SAFE_INTEGER),
          projects: isObj(existing.Projects) ? (existing.Projects as Record<string, Dict>) : {},
          socials: isObj(existing.Socials) ? (existing.Socials as Record<string, Dict>) : {},
          contactOpens: num((existing.Contact as Dict)?.Opens, Number.MAX_SAFE_INTEGER),
          cvOpens: num((existing.Cv as Dict)?.Opens, Number.MAX_SAFE_INTEGER),
          events: Array.isArray(existing.Events) ? existing.Events.length : 0,
        }
      : null;
    const applyCounts = async (
      c: {
        opened: boolean;
        visit: number;
        countryCode: string;
        source: { Name: string; Kind: SourceKind } | null;
        deviceType: string;
        linkDocId: string;
        activeMs: number;
        projects: Record<string, Dict>;
        socials: Record<string, Dict>;
        contactOpens: number;
        cvOpens: number;
        events: number;
      },
      sign: 1 | -1,
      day: string,
    ) => {
      const inc = (n: number) => Math.max(0, n) * sign;
      const projectOpens = sumBy(c.projects, "Opens");
      const socialClicks = sumBy(c.socials, "Clicks");
      const dayDoc = await getData(ctx, `${DAYS}/${day}`);
      const dayNext: Dict = { ...(dayDoc as Dict) };
      const dayAdd = (k: string, delta: number) => {
        if (delta) dayNext[k] = num(dayNext[k], Number.MAX_SAFE_INTEGER) + delta;
      };
      dayAdd("ActiveMs", inc(c.activeMs));
      dayAdd("Projects", inc(projectOpens));
      dayAdd("Socials", inc(socialClicks));
      dayAdd("Contacts", inc(c.contactOpens));
      dayAdd("Cv", inc(c.cvOpens));
      const totalsDoc = await getData(ctx, TOTALS);
      const totalsNext: Dict = { ...(totalsDoc as Dict) };
      const totAdd = (k: string, delta: number) => {
        if (delta) totalsNext[k] = num(totalsNext[k], Number.MAX_SAFE_INTEGER) + delta;
      };
      totAdd("Events", inc(c.events));
      totAdd("Projects", inc(projectOpens));
      totAdd("Socials", inc(socialClicks));
      totAdd("Contacts", inc(c.contactOpens));
      totAdd("Cv", inc(c.cvOpens));
      if (sign > 0) totalsNext.LastAt = now;
      if (c.opened) {
        dayAdd("Sessions", inc(1));
        totAdd("Sessions", inc(1));
        if (c.visit <= 1) {
          dayAdd("Visitors", inc(1));
          totAdd("Visitors", inc(1));
        } else {
          dayAdd("Returning", inc(1));
          totAdd("Returning", inc(1));
        }
        if (c.countryCode) {
          const m = isObj(dayNext.Countries) ? { ...((dayNext.Countries as Dict) as Record<string, number>) } : {};
          m[c.countryCode] = num(m[c.countryCode], Number.MAX_SAFE_INTEGER) + inc(1);
          dayNext.Countries = m;
        }
        if (c.deviceType) {
          const m = isObj(dayNext.Devices) ? { ...((dayNext.Devices as Dict) as Record<string, number>) } : {};
          m[c.deviceType] = num(m[c.deviceType], Number.MAX_SAFE_INTEGER) + inc(1);
          dayNext.Devices = m;
        }
        if (c.linkDocId) {
          dayAdd("LinkOpens", inc(1));
          totAdd("LinkOpens", inc(1));
        }
      }
      await upsertData(ctx, `${DAYS}/${day}`, dayNext);
      await upsertData(ctx, TOTALS, totalsNext);
      if (c.opened && c.source && sign > 0) {
        const key = safeKey(c.source.Name);
        if (key) {
          const sp = `${SOURCES}/${key}`;
          const sdoc = await getData(ctx, sp);
          const snext: Dict = { ...(sdoc as Dict) };
          snext.Name = c.source.Name;
          snext.Kind = c.source.Kind;
          snext.Sessions = num(snext.Sessions, Number.MAX_SAFE_INTEGER) + 1;
          snext.LastAt = now;
          await upsertData(ctx, sp, snext);
        }
      } else if (c.opened && c.source && sign < 0) {
        const key = safeKey(c.source.Name);
        if (key) {
          const sp = `${SOURCES}/${key}`;
          const sdoc = await getData(ctx, sp);
          if (Object.keys(sdoc).length) {
            const snext: Dict = { ...(sdoc as Dict) };
            snext.Sessions = Math.max(0, num(snext.Sessions, Number.MAX_SAFE_INTEGER) - 1);
            await upsertData(ctx, sp, snext);
          }
        }
      }
      for (const [name, row] of Object.entries(c.socials)) {
        const clicks = num(row.Clicks, 500);
        const away = num(row.AwayMs, 6 * HOUR_MS);
        if (!clicks && !away) continue;
        const sp = `${SOCIALS}/${name}`;
        const sdoc = await getData(ctx, sp);
        if (sign < 0 && !Object.keys(sdoc).length) continue;
        const snext: Dict = { ...(sdoc as Dict) };
        // Clamp at zero on subtraction so concurrent deletes cannot go negative.
        snext.Clicks = Math.max(0, num(snext.Clicks, Number.MAX_SAFE_INTEGER) + inc(clicks));
        snext.AwayMs = Math.max(0, num(snext.AwayMs, Number.MAX_SAFE_INTEGER) + inc(away));
        if (sign > 0) snext.LastAt = now;
        await upsertData(ctx, sp, snext);
      }
      for (const [projectId, row] of Object.entries(c.projects)) {
        const opens = num(row.Opens, 500);
        const live = num(row.Live, 500);
        const gh = num(row.Github, 500);
        const dl = num(row.Download, 500);
        if (!opens && !live && !gh && !dl) continue;
        const ppath = `Projects/${projectId}`;
        const pdoc = await getData(ctx, ppath);
        if (!Object.keys(pdoc).length) continue;
        const pnext: Dict = { ...(pdoc as Dict) };
        const views = isObj(pnext.Views) ? { ...(pnext.Views as Dict) } : {};
        const vAdd = (k: string, delta: number) => {
          if (delta) views[k] = Math.max(0, num(views[k], Number.MAX_SAFE_INTEGER) + inc(delta));
        };
        vAdd("Project", opens);
        vAdd("Live", live);
        vAdd("Github", gh);
        vAdd("Download", dl);
        pnext.Views = views;
        await upsertData(ctx, ppath, pnext);
      }
      if (c.opened && c.linkDocId) {
        const linkPath = `${LINKS}/${c.linkDocId}`;
        const ldoc = await getData(ctx, linkPath);
        if (sign > 0 || Object.keys(ldoc).length) {
          const lnext: Dict = { ...(ldoc as Dict) };
          lnext.Opens = Math.max(0, num(lnext.Opens, Number.MAX_SAFE_INTEGER) + inc(1));
          lnext.Sessions = Math.max(0, num(lnext.Sessions, Number.MAX_SAFE_INTEGER) + inc(1));
          if (sign > 0) lnext.LastOpenAt = now;
          await upsertData(ctx, linkPath, lnext);
        }
      }
    };

    if (!owner && !existing.Owner) {
      await applyCounts(
        {
          opened: !hasSession,
          visit,
          countryCode: hasSession
            ? (safeKey((existing.Geo as Dict)?.Code) || "")
            : (geo?.Code || ""),
          source: hasSession
            ? (() => {
                const s = isObj(existing.Source) ? (existing.Source as Dict) : {};
                return typeof s.Name === "string"
                  ? { Name: s.Name, Kind: ((s.Kind as string) || "referral") as SourceKind }
                  : null;
              })()
            : source,
          deviceType: hasSession
            ? (safeKey((existing.Device as Dict)?.Type) || "")
            : str(device.Type, 10),
          linkDocId: !hasSession && linkRow ? linkRow.docId : "",
          activeMs,
          projects,
          socials,
          contactOpens,
          cvOpens,
          events: events.length,
        },
        1,
        !hasSession ? todayKey(now) : dayOf(existing.StartedAt, now),
      );
    } else if (owner && hasSession && !existing.Owner && countedBefore) {
      const s = isObj(existing.Source) ? (existing.Source as Dict) : {};
      await applyCounts(
        {
          opened: true,
          visit: Math.max(1, num(existing.Visit, 100000)),
          countryCode: safeKey((existing.Geo as Dict)?.Code) || "",
          source:
            typeof s.Name === "string"
              ? { Name: s.Name, Kind: ((s.Kind as string) || "referral") as SourceKind }
              : null,
          deviceType: safeKey((existing.Device as Dict)?.Type) || "",
          linkDocId: str((existing.Link as Dict)?.DocId, 40) || "",
          activeMs: countedBefore.activeMs,
          projects: countedBefore.projects as Record<string, Dict>,
          socials: countedBefore.socials as Record<string, Dict>,
          contactOpens: countedBefore.contactOpens,
          cvOpens: countedBefore.cvOpens,
          events: countedBefore.events,
        },
        -1,
        dayOf(existing.StartedAt, now),
      );
    }

    let notifyQueued = false;
    if (!hasSession && !owner && linkRow?.Notify) {
      await ctx.db.insert("trailOutbox", {
        sessionId: id,
        linkCode: linkRow.Code,
        linkName: linkRow.Name,
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
      ...(linkRow
        ? {
            tailor: linkRow.Tailor,
            link: { Name: linkRow.Name, For: linkRow.For },
            notifyQueued,
          }
        : {}),
    };
  },
});

export const outboxPending = query({
  args: { serverKey: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { serverKey, limit }) => {
    requireServer(serverKey);
    return await ctx.db
      .query("trailOutbox")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(Math.min(Math.max(limit ?? 10, 1), 50));
  },
});

export const outboxMark = mutation({
  args: {
    serverKey: v.string(),
    id: v.id("trailOutbox"),
    status: v.union(v.literal("sent"), v.literal("failed"), v.literal("skipped")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { serverKey, id, status, error }) => {
    requireServer(serverKey);
    const row = await ctx.db.get(id);
    if (!row) return;
    await ctx.db.patch(id, {
      status,
      attempts: row.attempts + 1,
      sentAt: status === "sent" ? Date.now() : undefined,
      error: error?.slice(0, 300),
    });
  },
});

// ── link + visit management (owner dashboard) ───────────────────────────
// These replace the old browser read-modify-write path (getDocs + setDoc +
// increment(-1), which wrote the literal -1 and used the share Code as a
// document id). Every operation below is one transaction: counters and rows
// can never disagree, concurrent edits cannot interleave, and removed visits
// leave tombstones so delayed retries cannot recreate them.

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

async function deleteDocRow(ctx: any, path: string): Promise<void> {
  const row: any = await ctx.db
    .query("dashboardDocs")
    .withIndex("by_path", (q: any) => q.eq("path", path))
    .unique();
  if (row) await ctx.db.delete(row._id);
}

/** Everything one visit contributed to the rollups, read back from its row. */
function countedSoFar(s: Dict): {
  visit: number;
  countryCode: string;
  source: { Name: string; Kind: SourceKind } | null;
  deviceType: string;
  linkDocId: string;
  activeMs: number;
  projects: Record<string, Dict>;
  socials: Record<string, Dict>;
  contactOpens: number;
  cvOpens: number;
  events: number;
} {
  const obj = (val: unknown): Dict => (isObj(val) ? val : {});
  const rows = (val: unknown, fields: string[]): Record<string, Dict> => {
    const out: Record<string, Dict> = {};
    for (const [key, row] of Object.entries(obj(val))) {
      if (!safeKey(key) || !isObj(row)) continue;
      out[key] = Object.fromEntries(
        fields.map((f) => [f, num((row as Dict)[f], Number.MAX_SAFE_INTEGER)]),
      );
    }
    return out;
  };
  const source = obj(s.Source);
  return {
    visit: Math.max(1, num(s.Visit, 100000)),
    countryCode: safeKey(obj(s.Geo).Code) || "",
    source:
      typeof source.Name === "string"
        ? { Name: source.Name, Kind: ((source.Kind as string) || "referral") as SourceKind }
        : null,
    deviceType: safeKey(obj(s.Device).Type) || "",
    linkDocId: str(obj(s.Link).DocId, 40),
    activeMs: num(s.ActiveMs, Number.MAX_SAFE_INTEGER),
    projects: rows(s.Projects, ["Opens", "Live", "Github", "Download"]),
    socials: rows(s.Socials, ["Clicks", "AwayMs"]),
    contactOpens: num(obj(s.Contact).Opens, Number.MAX_SAFE_INTEGER),
    cvOpens: num(obj(s.Cv).Opens, Number.MAX_SAFE_INTEGER),
    events: Array.isArray(s.Events) ? s.Events.length : 0,
  };
}

async function subtractSession(ctx: any, session: Dict, now: number): Promise<void> {
  if (session.Owner === true) return; // owner visits were never counted
  const c = countedSoFar(session);
  const inc = (n: number) => -Math.max(0, n);
  const projectOpens = sumBy(c.projects, "Opens");
  const socialClicks = sumBy(c.socials, "Clicks");
  const day = dayOf(session.StartedAt, now);

  const dayDoc = await getData(ctx, `${DAYS}/${day}`);
  const dayNext: Dict = { ...(dayDoc as Dict) };
  const dayAdd = (k: string, delta: number) => {
    if (delta) dayNext[k] = Math.max(0, num(dayNext[k], Number.MAX_SAFE_INTEGER) + delta);
  };
  dayAdd("Sessions", inc(1));
  if (c.visit <= 1) dayAdd("Visitors", inc(1));
  else dayAdd("Returning", inc(1));
  dayAdd("ActiveMs", inc(c.activeMs));
  dayAdd("Projects", inc(projectOpens));
  dayAdd("Socials", inc(socialClicks));
  dayAdd("Contacts", inc(c.contactOpens));
  dayAdd("Cv", inc(c.cvOpens));
  if (c.linkDocId) dayAdd("LinkOpens", inc(1));
  if (c.countryCode && isObj(dayNext.Countries)) {
    const m = { ...((dayNext.Countries as Dict) as Record<string, number>) };
    m[c.countryCode] = Math.max(0, num(m[c.countryCode], Number.MAX_SAFE_INTEGER) - 1);
    dayNext.Countries = m;
  }
  if (c.deviceType && isObj(dayNext.Devices)) {
    const m = { ...((dayNext.Devices as Dict) as Record<string, number>) } ;
    m[c.deviceType] = Math.max(0, num(m[c.deviceType], Number.MAX_SAFE_INTEGER) - 1);
    dayNext.Devices = m;
  }
  await upsertData(ctx, `${DAYS}/${day}`, dayNext);

  const totalsDoc = await getData(ctx, TOTALS);
  const totalsNext: Dict = { ...(totalsDoc as Dict) };
  const totAdd = (k: string, delta: number) => {
    if (delta) totalsNext[k] = Math.max(0, num(totalsNext[k], Number.MAX_SAFE_INTEGER) + delta);
  };
  totAdd("Sessions", inc(1));
  if (c.visit <= 1) totAdd("Visitors", inc(1));
  else totAdd("Returning", inc(1));
  totAdd("Events", inc(c.events));
  totAdd("Projects", inc(projectOpens));
  totAdd("Socials", inc(socialClicks));
  totAdd("Contacts", inc(c.contactOpens));
  totAdd("Cv", inc(c.cvOpens));
  if (c.linkDocId) totAdd("LinkOpens", inc(1));
  await upsertData(ctx, TOTALS, totalsNext);

  if (c.source) {
    const key = safeKey(c.source.Name);
    if (key) {
      const sp = `${SOURCES}/${key}`;
      const sdoc = await getData(ctx, sp);
      if (Object.keys(sdoc).length) {
        const snext: Dict = { ...(sdoc as Dict) };
        snext.Sessions = Math.max(0, num(snext.Sessions, Number.MAX_SAFE_INTEGER) - 1);
        await upsertData(ctx, sp, snext);
      }
    }
  }
  for (const [name, row] of Object.entries(c.socials)) {
    const sp = `${SOCIALS}/${name}`;
    const sdoc = await getData(ctx, sp);
    if (!Object.keys(sdoc).length) continue;
    const snext: Dict = { ...(sdoc as Dict) };
    snext.Clicks = Math.max(0, num(snext.Clicks, Number.MAX_SAFE_INTEGER) - num(row.Clicks, 500));
    snext.AwayMs = Math.max(0, num(snext.AwayMs, Number.MAX_SAFE_INTEGER) - num(row.AwayMs, 6 * HOUR_MS));
    await upsertData(ctx, sp, snext);
  }
  for (const [projectId, row] of Object.entries(c.projects)) {
    const ppath = `Projects/${projectId}`;
    const pdoc = await getData(ctx, ppath);
    if (!Object.keys(pdoc).length) continue;
    const pnext: Dict = { ...(pdoc as Dict) };
    const views = isObj(pnext.Views) ? { ...(pnext.Views as Dict) } : {};
    const sub = (k: string, delta: number) => {
      if (delta) views[k] = Math.max(0, num(views[k], Number.MAX_SAFE_INTEGER) - delta);
    };
    sub("Project", num(row.Opens, 500));
    sub("Live", num(row.Live, 500));
    sub("Github", num(row.Github, 500));
    sub("Download", num(row.Download, 500));
    pnext.Views = views;
    await upsertData(ctx, ppath, pnext);
  }
  if (c.linkDocId) {
    const linkPath = `${LINKS}/${c.linkDocId}`;
    const ldoc = await getData(ctx, linkPath);
    if (Object.keys(ldoc).length) {
      const lnext: Dict = { ...(ldoc as Dict) };
      lnext.Opens = Math.max(0, num(lnext.Opens, Number.MAX_SAFE_INTEGER) - 1);
      lnext.Sessions = Math.max(0, num(lnext.Sessions, Number.MAX_SAFE_INTEGER) - 1);
      await upsertData(ctx, linkPath, lnext);
    }
  }
}

async function tombstone(ctx: any, sessionId: string, now: number): Promise<void> {
  await upsertData(ctx, `${TOMBS}/${sessionId}`, { deletedAt: now });
}

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
      const docId = `${now.toString(36)}-${code.slice(0, 4).toLowerCase()}${attempt || ""}`;
      if (Object.keys(await getData(ctx, `${LINKS}/${docId}`)).length) continue;
      const all: any[] = await ctx.db.query("dashboardDocs").collect();
      let taken = false;
      let scanned = 0;
      for (const r of all) {
        if (!r.path.startsWith(LINKS + "/")) continue;
        if (++scanned > 2000) break;
        if (isObj(r.data) && (r.data as Dict).Code === code) {
          taken = true;
          break;
        }
      }
      if (taken) continue;
      await upsertData(ctx, `${LINKS}/${docId}`, {
        Code: code,
        Name,
        For,
        Created: now,
        Opens: 0,
        Sessions: 0,
        LastOpenAt: null,
        Notify: notify !== false,
        Tailor: { AutoCv: autoCv === true, Greeting: "", Pinned: [] },
      });
      return { docId, code };
    }
    throw new Error("Could not allocate a link code");
  },
});

export const updateLink = mutation({
  args: {
    serverKey: v.string(),
    docId: v.string(),
    patch: v.any(),
  },
  handler: async (ctx, { serverKey, docId, patch }) => {
    requireServer(serverKey);
    const id = str(docId, 80);
    if (!id || id.includes("/")) throw new Error("Bad link id");
    const path = `${LINKS}/${id}`;
    const existing = await getData(ctx, path);
    if (!Object.keys(existing).length) throw new Error("Not found");
    const p = isObj(patch) ? (patch as Dict) : {};
    const next: Dict = { ...(existing as Dict) };
    if (p.Name !== undefined) {
      const v = str(p.Name, 120).trim();
      if (!v) throw new Error("Name is required");
      next.Name = v;
    }
    if (p.For !== undefined) {
      const v = str(p.For, 120).trim();
      if (!v) throw new Error("For is required");
      next.For = v;
    }
    if (p.Notify !== undefined) next.Notify = p.Notify !== false;
    if (p.Tailor !== undefined) {
      const t = isObj(p.Tailor) ? (p.Tailor as Dict) : {};
      const pinned = Array.isArray(t.Pinned)
        ? t.Pinned.map((x) => safeKey(x)).filter((x): x is string => !!x).slice(0, 12)
        : [];
      next.Tailor = {
        AutoCv: t.AutoCv === true,
        Greeting: str(t.Greeting, 160),
        Pinned: pinned,
      };
    }
    await upsertData(ctx, path, next);
    return { docId: id };
  },
});

export const deleteLink = mutation({
  args: { serverKey: v.string(), docId: v.string() },
  handler: async (ctx, { serverKey, docId }) => {
    requireServer(serverKey);
    const id = str(docId, 80);
    if (!id || id.includes("/")) throw new Error("Bad link id");
    // Retains historic visits and aggregates; only the link itself goes.
    await deleteDocRow(ctx, `${LINKS}/${id}`);
    return { docId: id };
  },
});

/** Delete one visit by session id, subtracting its contribution everywhere. */
export const deleteSession = mutation({
  args: { serverKey: v.string(), sessionId: v.string() },
  handler: async (ctx, { serverKey, sessionId }) => {
    requireServer(serverKey);
    const id = str(sessionId, 40);
    if (!id) throw new Error("Bad session id");
    const now = Date.now();
    const path = `${SESSIONS}/${id}`;
    const existing = await getData(ctx, path);
    if (!Object.keys(existing).length) return { deleted: false };
    await subtractSession(ctx, existing, now);
    await deleteDocRow(ctx, path);
    await tombstone(ctx, id, now);
    return { deleted: true };
  },
});

/**
 * Forget every visit attributed to one link (matched by Link.DocId, never by
 * the share Code) and zero that link's own counters. Other aggregates are
 * reconciled per visit. Returns the deleted count plus whether more remain
 * (call again to page through large links).
 */
export const forgetLinkVisits = mutation({
  args: { serverKey: v.string(), docId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { serverKey, docId, limit }) => {
    requireServer(serverKey);
    const id = str(docId, 80);
    if (!id || id.includes("/")) throw new Error("Bad link id");
    const now = Date.now();
    const cap = Math.min(Math.max(limit ?? 200, 1), 500);
    const all: any[] = await ctx.db.query("dashboardDocs").collect();
    const matched: string[] = [];
    for (const r of all) {
      if (!r.path.startsWith(SESSIONS + "/")) continue;
      const d = isObj(r.data) ? (r.data as Dict) : null;
      const link = d && isObj(d.Link) ? (d.Link as Dict) : null;
      if (link && str(link.DocId, 80) === id)
        matched.push(String(r.path).slice(String(r.path).lastIndexOf("/") + 1));
      if (matched.length >= cap) break;
    }
    for (const sid of matched) {
      const s = await getData(ctx, `${SESSIONS}/${sid}`);
      if (Object.keys(s).length) {
        await subtractSession(ctx, s, now);
        await deleteDocRow(ctx, `${SESSIONS}/${sid}`);
        await tombstone(ctx, sid, now);
      }
    }
    const linkPath = `${LINKS}/${id}`;
    const ldoc = await getData(ctx, linkPath);
    if (Object.keys(ldoc).length) {
      const lnext: Dict = { ...(ldoc as Dict), Opens: 0, Sessions: 0, LastOpenAt: null };
      await upsertData(ctx, linkPath, lnext);
    }
    return { deleted: matched.length, docId: id };
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
    const all: any[] = await ctx.db.query("dashboardDocs").collect();
    const victims: Array<{ sid: string; seen: number }> = [];
    for (const r of all) {
      if (!r.path.startsWith(SESSIONS + "/")) continue;
      const d = isObj(r.data) ? (r.data as Dict) : {};
      const seen = num(d.LastSeenAt ?? d.StartedAt, Number.MAX_SAFE_INTEGER);
      if (seen > 0 && seen < cutoff)
        victims.push({ sid: String(r.path).slice(String(r.path).lastIndexOf("/") + 1), seen });
    }
    victims.sort((a, b) => a.seen - b.seen);
    let pruned = 0;
    for (const v of victims.slice(0, cap)) {
      await deleteDocRow(ctx, `${SESSIONS}/${v.sid}`);
      await tombstone(ctx, v.sid, now);
      pruned++;
    }
    return { pruned, remaining: victims.length - pruned };
  },
});

export const outboxMarkBySession = mutation({  args: {
    serverKey: v.string(),
    sessionId: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { serverKey, sessionId, status, error }) => {
    requireServer(serverKey);
    const row = await ctx.db
      .query("trailOutbox")
      .withIndex("by_session", (q: any) => q.eq("sessionId", str(sessionId, 40)))
      .first();
    if (!row || row.status !== "pending") return { marked: false };
    await ctx.db.patch(row._id, {
      status,
      attempts: row.attempts + 1,
      sentAt: status === "sent" ? Date.now() : undefined,
      error: error?.slice(0, 300),
    });
    return { marked: true };
  },
});

/** Corruption audit over retained sessions (read-only; see repairSessionFields).
 *
 * The pre-transactional writer summed timestamps, scroll maxima and
 * performance numbers (mergeValues added every number), so old rows can hold
 * LastSeenAt far in the future and Scroll above 100.
 * This reports repairable rows WITHOUT writing; repairSessionFields fixes
 * them. Aggregate history (totals/days) is never rewritten from retained
 * sessions — pruned history cannot be reconstructed, and fabricating exact
 * historical counts would be dishonest.
 */
export const reconcileDryRun = query({
  args: { serverKey: v.string() },
  handler: async (ctx, { serverKey }) => {
    requireServer(serverKey);
    const now = Date.now();
    const all: any[] = await ctx.db.query("dashboardDocs").collect();
    const corrupt: Array<{ sid: string; issues: string[] }> = [];
    const orphaned: string[] = [];
    let retainedSessions = 0;
    let checked = 0;
    const linkIds = new Set<string>();
    for (const r of all) {
      if (r.path.startsWith(LINKS + "/")) {
        linkIds.add(String(r.path).slice(String(r.path).lastIndexOf("/") + 1));
      }
    }
    for (const r of all) {
      if (!r.path.startsWith(SESSIONS + "/")) continue;
      if (++checked > 2000) break;
      const sid = String(r.path).slice(String(r.path).lastIndexOf("/") + 1);
      const d = isObj(r.data) ? (r.data as Dict) : {};
      retainedSessions++;
      const issues: string[] = [];
      const started = num(d.StartedAt, Number.MAX_SAFE_INTEGER);
      const seen = num(d.LastSeenAt, Number.MAX_SAFE_INTEGER);
      if (d.LastSeenAt !== undefined && (seen > now + 5 * 60_000 || (started > 0 && seen < started)))
        issues.push("LastSeenAt");
      if (d.EndedAt !== undefined && d.EndedAt !== null && typeof d.EndedAt === "number" && d.EndedAt > now + 5 * 60_000)
        issues.push("EndedAt");
      const scroll = isObj(d.Scroll) ? (d.Scroll as Dict) : null;
      if (scroll && Object.values(scroll).some((v) => typeof v === "number" && (v > 100 || v < 0)))
        issues.push("Scroll");
      for (const k of ["ActiveMs", "OpenMs", "IdleMs", "Copies", "Rage", "Prints", "Flushes"]) {
        if (d[k] !== undefined && (typeof d[k] !== "number" || (d[k] as number) < 0)) issues.push(k);
      }
      if (d.Events !== undefined && !Array.isArray(d.Events)) issues.push("Events");
      if (issues.length) corrupt.push({ sid, issues });
      const link = isObj(d.Link) ? (d.Link as Dict) : null;
      const docId = link ? str(link.DocId, 80) : "";
      if (docId && !linkIds.has(docId)) orphaned.push(sid);
    }
    const totals = await getData(ctx, TOTALS);
    return {
      checked,
      retainedSessions,
      corrupt,
      orphaned,
      totalsSessions: num(totals.Sessions, Number.MAX_SAFE_INTEGER),
    };
  },
});

/**
 * Idempotent field repair for rows flagged by reconcileDryRun. Clamps
 * impossible values into range (timestamps into [StartedAt, now], scroll
 * into [0, 100], negative counters to 0, non-array Events to []). Dry-run by
 * default; pass dryRun:false to write. Second run is always clean.
 */
export const repairSessionFields = mutation({
  args: { serverKey: v.string(), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { serverKey, dryRun }) => {
    requireServer(serverKey);
    const now = Date.now();
    const write = dryRun !== true;
    const all: any[] = await ctx.db.query("dashboardDocs").collect();
    let fixed = 0;
    let checked = 0;
    for (const r of all) {
      if (!r.path.startsWith(SESSIONS + "/")) continue;
      if (++checked > 2000) break;
      if (fixed >= 500) break;
      const d = isObj(r.data) ? { ...(r.data as Dict) } : null;
      if (!d) continue;
      let dirty = false;
      const started = num(d.StartedAt, Number.MAX_SAFE_INTEGER) || now;
      if (typeof d.LastSeenAt === "number" && (d.LastSeenAt > now + 5 * 60_000 || d.LastSeenAt < started)) {
        d.LastSeenAt = Math.min(Math.max(d.LastSeenAt, started), now);
        dirty = true;
      }
      if (typeof d.EndedAt === "number" && d.EndedAt > now + 5 * 60_000) {
        d.EndedAt = now;
        dirty = true;
      }
      if (isObj(d.Scroll)) {
        const s = { ...(d.Scroll as Dict) };
        for (const [k, v] of Object.entries(s)) {
          if (typeof v === "number" && (v > 100 || v < 0)) {
            s[k] = Math.min(Math.max(Math.round(v), 0), 100);
            dirty = true;
          }
        }
        if (dirty) d.Scroll = s;
      }
      for (const k of ["ActiveMs", "OpenMs", "IdleMs", "Copies", "Rage", "Prints", "Flushes"]) {
        if (typeof d[k] !== "number" || (d[k] as number) < 0) {
          d[k] = 0;
          dirty = true;
        }
      }
      if (d.Events !== undefined && !Array.isArray(d.Events)) {
        d.Events = [];
        dirty = true;
      }
      if (dirty) {
        fixed++;
        if (write) await ctx.db.patch(r._id, { data: d, updatedAt: now });
      }
    }
    return { checked, fixed, dryRun: !write };
  },
});

/** Read-only ingest health for the dashboard/diagnostics. */
export const diagnostics = query({
  args: { serverKey: v.string() },
  handler: async (ctx, { serverKey }) => {
    requireServer(serverKey);
    const all: any[] = await ctx.db.query("dashboardDocs").collect();
    let sessions = 0;
    let links = 0;
    let tombs = 0;
    for (const r of all) {
      if (r.path.startsWith(SESSIONS + "/")) sessions++;
      else if (r.path.startsWith(LINKS + "/")) links++;
      else if (r.path.startsWith(TOMBS + "/")) tombs++;
    }
    const totals = await getData(ctx, TOTALS);
    const pending = await ctx.db
      .query("trailOutbox")
      .withIndex("by_status", (q: any) => q.eq("status", "pending"))
      .take(1);
    return {
      sessions,
      links,
      tombstones: tombs,
      totals: {
        Sessions: num(totals.Sessions, Number.MAX_SAFE_INTEGER),
        Visitors: num(totals.Visitors, Number.MAX_SAFE_INTEGER),
        Returning: num(totals.Returning, Number.MAX_SAFE_INTEGER),
        LinkOpens: num(totals.LinkOpens, Number.MAX_SAFE_INTEGER),
      },
      outboxPending: pending.length,
    };
  },
});
