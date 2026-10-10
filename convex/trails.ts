import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServer } from "./access";
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
    Referrer: str(e.Referrer, 300),
    Ref: str(e.Ref, 120),
    Utm: utm,
  };
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
