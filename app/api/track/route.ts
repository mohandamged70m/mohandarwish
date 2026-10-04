import { NextResponse } from "next/server";
import { convexQuery, convexMutation } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { canonicalSocial, classifySource, type SourceKind } from "@/lib/analytics/source";
import { linkOpenedHtml } from "@/lib/email";
import { getResendFrom, sendSafe } from "@/lib/resend";
import { siteConfig } from "@/lib/metadata";

// Trails ingest. The only thing that writes anything under `Analytics/`.
//
// The browser buffers a visit and POSTs numbered deltas here (lib/analytics/collect.ts);
// this applies them. Deltas rather than snapshots, so two flushes racing cannot
// overwrite each other, and every flush carries `seq` counting up from 1 - the
// Convex mutation applies the sequence check and the write together, so a retry
// or a double-submit is counted exactly once.
//
// Three things this endpoint is careful about, because each one was a way the old
// ingest lost or inflated the numbers:
//   - `hello` (device, entry, share-link code) rides along until the server confirms
//     it has it. It used to go on flush 1 only, so a refused first flush left the
//     visit recorded but anonymous, and the link never counted its open.
//   - Every number is clamped and every key validated. A public endpoint that adds
//     whatever it is sent will happily add 1e308 to a lifetime counter.
//   - An owner visit is taken back OUT if it is recognised part-way through, or the
//     totals count a visit the dashboard is hiding as the owner's own.
//
// Feeds Analytics/Days/Items, Analytics/Totals, Analytics/Sessions/Items (capped),
// Analytics/Sources/Items, Analytics/Socials/Items and the Projects/<id> Views maps
// that D-Trails reads. No PII is stored.

export const dynamic = "force-dynamic";

const MAX_SEQ = 300;
const MAX_EVENTS_PER_FLUSH = 120;
const MAX_EVENTS_TOTAL = 500;
const MAX_KEYS = 60;
const MAX_SESSIONS = 300;
const HOUR_MS = 60 * 60 * 1000;
const MAX_SESSION_AGE_MS = 12 * HOUR_MS;

const SESSIONS = "Analytics/Sessions/Items";
const DAYS = "Analytics/Days/Items";
const LINKS = "Analytics/Links/Items";
const SOURCES = "Analytics/Sources/Items";
const SOCIALS = "Analytics/Socials/Items";
const TOTALS = "Analytics/Totals";

const ID_RE = /^[a-z0-9]{1,14}-[a-z0-9]{4,20}$/i;
const VISITOR_RE = /^v-[a-z0-9]{8,20}$/;
const CODE_RE = /^[A-Za-z0-9_-]{4,32}$/;

const EVENT_KINDS = new Set([
  "section", "project", "project_end", "out", "social", "social_back",
  "cv", "contact", "contact_tab", "contact_sent", "copy", "scroll",
  "idle", "wake", "hide", "show", "rage", "print", "end",
]);

type Dict = Record<string, unknown>;

// ── validation helpers ────────────────────────────────────────────────
const isObj = (v: unknown): v is Dict => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * A map key we are willing to write as a field or a document id. Project ids are the
 * project documents' own ids and social names carry dashes, so those stay legal;
 * only what would break the path or the merge is rejected.
 */
function safeKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > 100) return null;
  if (s === "." || s === "..") return null;
  if (/[/[\]*~]/.test(s)) return null;
  if (s.startsWith("__")) return null;
  return s;
}

/** A non-negative integer, clamped. Anything else becomes 0. */
function num(v: unknown, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.round(n), max);
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Read a delta map (`{key: number}`) with both the key set and values bounded. */
function deltaMap(v: unknown, max: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(v)) return out;
  let n = 0;
  for (const [k, raw] of Object.entries(v)) {
    if (n >= MAX_KEYS) break;
    const key = safeKey(k);
    const value = num(raw, max);
    if (!key || !value) continue;
    out[key] = value;
    n++;
  }
  return out;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The UTC day a visit began on - the day its opening flush was counted under. */
function dayOf(startedAt: unknown): string {
  const at = num(startedAt, Number.MAX_SAFE_INTEGER);
  return at ? new Date(at).toISOString().slice(0, 10) : todayKey();
}

// ── document layer ────────────────────────────────────────────────────
async function readDoc(path: string): Promise<Dict> {
  const data = await convexQuery<Record<string, unknown> | null>(api.docs.getDoc, { path });
  return isObj(data) ? data : {};
}

async function patchDoc(path: string, patch: Dict): Promise<void> {
  if (!Object.keys(patch).length) return;
  await convexMutation(api.docs.patchDoc, { path, patch });
}

/**
 * Apply one flush, exactly once.
 *
 * Returns null when the flush was a replay (its seq was already applied) or when it
 * lost a race to a newer one - the caller retries on null, because its view of the
 * session's Events and Scroll was stale by definition.
 */
async function patchSeq(
  path: string,
  patch: Dict,
  seq: number,
  events: unknown[]
): Promise<Dict | null> {
  const data = await convexMutation<Record<string, unknown> | null>(api.docs.patchSeq, {
    path,
    patch,
    seq,
    events,
  });
  return isObj(data) ? data : null;
}

/** Sessions are capped, newest kept. Old visits are not interesting, and the tab is small. */
async function trimSessions(): Promise<void> {
  const rows = await convexQuery<{ path: string; data: Dict }[]>(api.docs.listByPrefix, {
    prefix: SESSIONS,
    limit: 2000,
  });
  const list = (rows ?? []).sort(
    (a, b) => num(b.data?.LastSeenAt ?? b.data?.StartedAt, Number.MAX_SAFE_INTEGER) - num(a.data?.LastSeenAt ?? a.data?.StartedAt, Number.MAX_SAFE_INTEGER)
  );
  const extra = list.slice(MAX_SESSIONS);
  for (let i = 0; i < extra.length; i += 50) {
    const chunk = extra.slice(i, i + 50).map((r) => r.path);
    if (chunk.length) await convexMutation(api.docs.deleteDocs, { paths: chunk });
  }
}

// ── share-link resolution ─────────────────────────────────────────────
interface LinkRow {
  docId: string;
  path: string;
  Code: string;
  Name: string;
  For: string;
  Notify: boolean;
  Tailor: { AutoCv: boolean; Greeting: string; Pinned: string[] };
}

/**
 * The one pen for a link's counters: a Code is only valid when a link document with
 * that Code exists, and the Name/For stored on the visit are always the document's,
 * never the caller's. Resolved on the opening flush only - it is a table scan, and
 * nothing after the opening needs it.
 *
 * `null` means "no such link". `undefined` means "could not tell" (the read failed),
 * which the caller must treat differently from the former.
 */
async function resolveLink(code: unknown): Promise<LinkRow | null | undefined> {
  if (typeof code !== "string" || !CODE_RE.test(code)) return null;
  try {
    const rows = await convexQuery<{ path: string; data: Dict }[]>(api.docs.listByPrefix, {
      prefix: LINKS,
      limit: 1000,
    });
    if (!rows) return undefined;
    for (const r of rows) {
      const d = isObj(r?.data) ? r.data : {};
      if (d.Code === code) {
        const docId = r.path.slice(r.path.lastIndexOf("/") + 1);
        return {
          docId,
          path: r.path,
          Code: code,
          Name: str(d.Name, 120),
          For: str(d.For, 120),
          Notify: d.Notify !== false,
          Tailor: readTailor(d.Tailor),
        };
      }
    }
    return null;
  } catch {
    return undefined;
  }
}

// ── geo ───────────────────────────────────────────────────────────────
/**
 * Country from whichever edge is in front of us. On Vercel the header is set for
 * free; the others are free too where a CDN sits in front. When none is present Geo
 * stays empty - it is a nice-to-have, and never breaks tracking.
 */
function edgeGeo(req: Request): { Country: string; Code: string } {
  const raw = (
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-country-code") ||
    ""
  ).toUpperCase();
  if (!/^[A-Z]{2}$/.test(raw)) return { Country: "", Code: "" };
  try {
    return { Country: new Intl.DisplayNames(["en"], { type: "region" }).of(raw) || "", Code: raw };
  } catch {
    return { Country: "", Code: raw };
  }
}

// ── shapers ───────────────────────────────────────────────────────────
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
    for (const [k, v] of Object.entries(e.Utm)) {
      if (n >= 8) break;
      const key = safeKey(k);
      if (key && typeof v === "string") {
        utm[key] = str(v, 80);
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

function readTailor(raw: unknown): { AutoCv: boolean; Greeting: string; Pinned: string[] } {
  const t = isObj(raw) ? raw : {};
  const pinned = Array.isArray(t.Pinned)
    ? t.Pinned.map((p) => safeKey(p)).filter((p): p is string => !!p).slice(0, 12)
    : [];
  return { AutoCv: t.AutoCv === true, Greeting: str(t.Greeting, 160), Pinned: pinned };
}

function readProjects(v: unknown): Record<string, Dict> {
  const out: Record<string, Dict> = {};
  if (!isObj(v)) return out;
  let n = 0;
  for (const [rawKey, rawVal] of Object.entries(v)) {
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

function readSocials(v: unknown): Record<string, Dict> {
  const out: Record<string, Dict> = {};
  if (!isObj(v)) return out;
  let n = 0;
  for (const [rawKey, rawVal] of Object.entries(v)) {
    if (n >= MAX_KEYS) break;
    const safe = safeKey(rawKey);
    if (!safe || !isObj(rawVal)) continue;
    // One document per network, not one per spelling.
    const key = canonicalSocial(safe);
    const row = { Clicks: num(rawVal.clicks, 500), AwayMs: num(rawVal.awayMs, 6 * HOUR_MS) };
    if (!row.Clicks && !row.AwayMs) continue;
    const prev = out[key] as { Clicks: number; AwayMs: number } | undefined;
    out[key] = prev ? { Clicks: prev.Clicks + row.Clicks, AwayMs: prev.AwayMs + row.AwayMs } : row;
    n++;
  }
  return out;
}

function sumBy(rows: Record<string, Dict>, field: string): number {
  return Object.values(rows).reduce((total, row) => total + (num(row[field], Number.MAX_SAFE_INTEGER) || 0), 0);
}

// ── the endpoint ──────────────────────────────────────────────────────
interface Applied {
  /** False when the visit was not (and will never be) recorded. */
  tracked: boolean;
  /** True once the server holds this visit's `hello`. */
  hello: boolean;
  tailor?: unknown;
  link?: { Name: string; For: string };
}

export async function POST(req: Request) {
  let body: Dict;
  try {
    const parsed: unknown = await req.json();
    if (!isObj(parsed)) return NextResponse.json({ ok: false, error: "Bad body" }, { status: 400 });
    body = parsed;
  } catch {
    return NextResponse.json({ ok: false, error: "Bad body" }, { status: 400 });
  }

  const id = str(body.id, 40);
  const seq = num(body.seq, MAX_SEQ + 1);
  const visitor = str(body.visitor, 40);
  const visit = Math.max(1, num(body.visit, 100000));

  if (!ID_RE.test(id) || !VISITOR_RE.test(visitor)) {
    return NextResponse.json({ ok: false, error: "Bad session identity" }, { status: 400 });
  }
  if (seq < 1 || seq > MAX_SEQ) {
    return NextResponse.json({ ok: false, error: "Too many flushes for one visit" }, { status: 429 });
  }

  try {
    let result = await applyFlush({ id, seq, visitor, visit, body }, req);
    if (result === "retry") result = await applyFlush({ id, seq, visitor, visit, body }, req);
    return NextResponse.json({
      ok: true,
      v: 2,
      seq,
      tracked: result !== "retry" ? result.tracked : false,
      hello: result !== "retry" ? result.hello : false,
      ...(result !== "retry" && result.tailor ? { tailor: result.tailor } : {}),
      ...(result !== "retry" && result.link ? { link: result.link } : {}),
    });
  } catch {
    // tracking must never break the page - but say so, so the client keeps its
    // buffer and the next flush carries what this one was holding.
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

async function applyFlush(
  ctx: { id: string; seq: number; visitor: string; visit: number; body: Dict },
  req: Request
): Promise<Applied | "retry"> {
  const { id, seq, visitor, visit, body } = ctx;
  const now = Date.now();
  const path = `${SESSIONS}/${id}`;

  const existing = await readDoc(path);
  const isNew = !num(existing.StartedAt, Number.MAX_SAFE_INTEGER);

  // Idempotent: a retried or out-of-order flush is dropped rather than double-counted.
  if (!isNew && num(existing.Seq, Number.MAX_SAFE_INTEGER) >= seq) {
    return { tracked: true, hello: true };
  }
  if (!isNew && now - num(existing.StartedAt, Number.MAX_SAFE_INTEGER) > MAX_SESSION_AGE_MS) {
    throw new Error("reject:Visit expired");
  }
  if (isNew && seq !== 1 && seq > 10) {
    // The opening flush never arrived (blocked, offline) and this is too deep into
    // the visit to reconstruct it. Rejected: the client stops, rather than inventing
    // a story that starts mid-way.
    throw new Error("reject:Unknown visit");
  }

  const add = isObj(body.add) ? body.add : {};
  const set = isObj(body.set) ? body.set : {};
  const hello = isObj(body.hello) ? body.hello : null;

  // ── deltas ─────────────────────────────────────────────────────────
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

  // ── absolute state ─────────────────────────────────────────────────
  const exitSection = safeKey(set.exitSection) || "";
  const scroll = deltaMap(set.scroll, 100);
  const contactTab = str(set.contactTab, 20);
  const contactSent = str(set.contactSent, 20);
  const perf = isObj(set.perf)
    ? { LoadMs: num((set.perf as Dict).LoadMs, 10 * 60_000), LcpMs: num((set.perf as Dict).LcpMs, 10 * 60_000) }
    : null;

  // ── timeline ───────────────────────────────────────────────────────
  // Room is what is left of the cap once this visit's existing events are counted.
  const priorEvents = Array.isArray(existing.Events) ? existing.Events.length : 0;
  const room = Math.max(0, MAX_EVENTS_TOTAL - priorEvents);
  const incoming = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS_PER_FLUSH) : [];
  const events: Array<{ t: number; k: string; v?: string }> = [];
  for (const raw of incoming) {
    if (events.length >= room) break;
    if (!isObj(raw)) continue;
    const k = str(raw.k, 20);
    if (!EVENT_KINDS.has(k)) continue;
    const v = str(raw.v, 120);
    events.push({ t: num(raw.t, 24 * HOUR_MS), k, ...(v ? { v } : {}) });
  }
  const eventsCut = Boolean(existing.EventsCut) || incoming.length > events.length;

  // ── link resolution + geo, opening flush only ──────────────────────
  let linkRow: LinkRow | null = null;
  let linkLookupFailed = false;
  let geo: { Country: string; Code: string } | null = null;
  let device: Dict = {};
  let entry: Dict = {};
  let source: { Name: string; Kind: SourceKind } | null = null;

  if (hello) {
    const code = str(hello.code, 40);
    if (CODE_RE.test(code)) {
      const found = await resolveLink(code);
      if (found === undefined) linkLookupFailed = true;
      else linkRow = found;
    }
  }
  // A visit with no share link is direct traffic: the portfolio records share-link
  // visits only, so this one is never stored. `undefined` (the lookup could not
  // complete) is not that verdict - it must not throw a real visit away.
  if (isNew && !linkRow && !linkLookupFailed) {
    return { tracked: false, hello: true };
  }

  if (isNew) {
    geo = edgeGeo(req);
    device = readDevice(hello?.device);
    entry = readEntry(hello?.entry);
    source = classifySource({
      Ref: str(entry.Ref, 120),
      Referrer: str(entry.Referrer, 300),
      Utm: (entry.Utm as Record<string, string>) || {},
    });
  }

  const owner = body.owner === true;

  // ── the session patch ──────────────────────────────────────────────
  // Counters and nested maps ride as deltas (dash_merge adds them); Events are
  // appended by the guarded write; Seq is set by it, not merged.
  const patch: Dict = {
    LastSeenAt: now,
    ActiveMs: activeMs,
    OpenMs: openMs,
    IdleMs: idleMs,
    Copies: copies,
    Rage: rage,
    Prints: prints,
    Cv: { Opens: cvOpens },
    Flushes: 1,
  };
  if (Object.keys(sections).length) patch.Sections = sections;
  if (Object.keys(projects).length) patch.Projects = projects;
  if (Object.keys(socials).length) patch.Socials = socials;
  if (contactOpens > 0) patch.Contact = { Opens: contactOpens };
  if (contactTab) patch.Contact = { ...(patch.Contact as Dict | undefined), Tab: contactTab };
  if (contactSent) patch.Contact = { ...(patch.Contact as Dict | undefined), Sent: contactSent };
  if (exitSection) patch.Exit = { Section: exitSection };
  if (perf) patch.Perf = perf;
  if (events.length) patch.EventsCut = eventsCut;

  if (isNew) {
    patch.StartedAt = num(hello?.startedAt, now) || now;
    patch.Ended = false;
    patch.EndedAt = null;
    patch.Visitor = visitor;
    patch.Visit = visit;
    patch.Owner = owner;
    patch.Legacy = false;
    patch.EventsCut = eventsCut;
    patch.Entry = entry;
    patch.Source = source;
    patch.Device = device;
    patch.Geo = geo;
    patch.Exit = { Section: exitSection || str(entry.Section, 100) || "home" };
    // Scroll and Events start empty on a new visit: the client keeps them absolute,
    // so seeding them here is all that is needed.
    patch.Scroll = scroll;
    patch.Projects = projects;
    patch.Socials = socials;
    patch.Sections = sections;
    patch.Link = linkRow
      ? { Id: linkRow.Code, DocId: linkRow.docId, Name: linkRow.Name, For: linkRow.For }
      : null;
  } else {
    // Scroll is a maximum, not a total: read-modify-write per section, inside the
    // guarded write. A losing flush is retried against a fresh read, so this can
    // never go backwards.
    const prevScroll = isObj(existing.Scroll) ? (existing.Scroll as Record<string, unknown>) : {};
    for (const [k, v] of Object.entries(scroll)) {
      patch.Scroll = { ...(patch.Scroll as Dict | undefined), [k]: Math.max(num(prevScroll[k], 100), v) };
    }
    if (owner) patch.Owner = true;
  }

  if (body.end === true) {
    patch.Ended = true;
    patch.EndedAt = now;
  }

  const written = await patchSeq(path, patch, seq, events);
  if (written === null) {
    // Replay, or a newer flush won the race. Re-read and try once more with an
    // up-to-date view; a second loss means the newer one already covers this.
    const after = await readDoc(path);
    if (num(after.Seq, Number.MAX_SAFE_INTEGER) >= seq) return { tracked: true, hello: true };
    return "retry";
  }

  // ── counting ───────────────────────────────────────────────────────
  // Owner visits are recorded (so the tab that flipped the switch has a row) but
  // never counted: they would drown the real numbers.
  if (!owner && !existing.Owner) {
    await addCounts(
      {
        opened: isNew,
        visit,
        countryCode: geo?.Code || "",
        source,
        deviceType: str(device.Type, 10),
        linkDocId: isNew && linkRow ? linkRow.docId : "",
        activeMs,
        projects,
        socials,
        contactOpens,
        cvOpens,
        events: events.length,
      },
      1,
      todayKey(),
      now
    );
  } else if (owner && !isNew && !existing.Owner) {
    // Recognised as the owner part-way through the visit: every flush before this one
    // was counted as a stranger's. Take them back out, or the totals and the link's
    // card would count a visit that Trails hides as the owner's own.
    await addCounts(countedSoFar(existing), -1, dayOf(existing.StartedAt), now);
  }

  if (isNew && !owner) await trimSessions();

  // Notification last: a mail failure must never cost us the visit.
  if (isNew && !owner && linkRow?.Notify) {
    try {
      await notifyLinkOpened({
        link: linkRow,
        sessionId: id,
        geo,
        device,
        visit,
        ref: str(entry.Ref, 120),
      });
    } catch (err) {
      console.error("[track] link-open notification failed:", err);
    }
  }

  return {
    tracked: true,
    hello: !!hello || !isNew,
    ...(linkRow ? { tailor: linkRow.Tailor } : {}),
    ...(linkRow ? { link: { Name: linkRow.Name, For: linkRow.For } } : {}),
  };
}

// ── counting ─────────────────────────────────────────────────────────
/** What one visit adds to the rollups: a flush's deltas, or a whole visit so far. */
interface Counts {
  /** The visit itself: sessions, visitors, country, source, device, link open. */
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
}

/**
 * Add a visit's counts to the day, the totals, the projects, the socials, the
 * sources and its link (sign 1), or take them back out (sign -1). Taking back never
 * creates a document: a link or project removed since stays removed.
 */
async function addCounts(c: Counts, sign: 1 | -1, day: string, now: number): Promise<void> {
  const inc = (n: number) => Math.max(0, n) * sign;
  const projectOpens = sumBy(c.projects, "Opens");
  const socialClicks = sumBy(c.socials, "Clicks");

  const dayPatch: Dict = {
    ActiveMs: inc(c.activeMs),
    Projects: inc(projectOpens),
    Socials: inc(socialClicks),
    Contacts: inc(c.contactOpens),
    Cv: inc(c.cvOpens),
  };
  const totalsPatch: Dict = {
    Events: inc(c.events),
    Projects: inc(projectOpens),
    Socials: inc(socialClicks),
    Contacts: inc(c.contactOpens),
    Cv: inc(c.cvOpens),
  };
  if (sign > 0) totalsPatch.LastAt = now;

  if (c.opened) {
    dayPatch.Sessions = inc(1);
    totalsPatch.Sessions = inc(1);
    if (c.visit <= 1) {
      dayPatch.Visitors = inc(1);
      totalsPatch.Visitors = inc(1);
    } else {
      // A returning visit is a session, not a new person. Counting it as a visitor
      // again is how a portfolio ends up with more "people" than exist. Lifetime
      // returns live on Totals (the day rollup already keeps its own).
      dayPatch.Returning = inc(1);
      totalsPatch.Returning = inc(1);
    }
    if (c.countryCode) dayPatch.Countries = { [c.countryCode]: inc(1) };
    if (c.source) {
      const sourceKey = safeKey(c.source.Name);
      if (sourceKey) {
        dayPatch.Sources = { [sourceKey]: inc(1) };
        // One document per origin, so the dashboard can list them without reading
        // every visit back.
        await patchDoc(
          `${SOURCES}/${sourceKey}`,
          sign > 0
            ? { Name: c.source.Name, Kind: c.source.Kind, Sessions: inc(1), LastAt: now }
            : { Sessions: inc(1) }
        );
      }
    }
    if (c.deviceType) dayPatch.Devices = { [c.deviceType]: inc(1) };
    if (c.linkDocId) {
      dayPatch.LinkOpens = inc(1);
      totalsPatch.LinkOpens = inc(1);
    }
  }

  await patchDoc(`${DAYS}/${day}`, dayPatch);
  await patchDoc(TOTALS, totalsPatch);

  // Per-project engagement stays on the project itself: the public project modal
  // shows these counts to visitors, so they stay on Projects/{id}.Views.
  //
  // The id comes from the caller's payload and only ever passed safeKey(), which
  // says the string is a legal document id - not that the project exists. So: only
  // raise counters on a project that is already there, never create one.
  for (const [projectId, row] of Object.entries(c.projects)) {
    const path = `Projects/${projectId}`;
    const exists = await readDoc(path);
    if (!Object.keys(exists).length) continue;
    const views: Dict = {};
    // Read through num() before adding: the delta has already been clamped, and inc()
    // must not push the result past that ceiling.
    const opens = num(row.Opens, 500);
    const live = num(row.Live, 500);
    const gh = num(row.Github, 500);
    const dl = num(row.Download, 500);
    if (opens) views.Project = inc(opens);
    if (live) views.Live = inc(live);
    if (gh) views.Github = inc(gh);
    if (dl) views.Download = inc(dl);
    if (Object.keys(views).length) await patchDoc(path, { Views: views });
  }

  for (const [name, row] of Object.entries(c.socials)) {
    await patchDoc(`${SOCIALS}/${name}`, {
      Clicks: inc(num(row.Clicks, 500)),
      AwayMs: inc(num(row.AwayMs, 6 * HOUR_MS)),
      ...(sign > 0 ? { LastAt: now } : {}),
    });
  }

  if (c.opened && c.linkDocId) {
    const linkPath = `${LINKS}/${c.linkDocId}`;
    if (sign > 0) {
      await patchDoc(linkPath, { Opens: inc(1), Sessions: inc(1), LastOpenAt: now });
    } else {
      const exists = await readDoc(linkPath);
      if (Object.keys(exists).length) await patchDoc(linkPath, { Opens: inc(1), Sessions: inc(1) });
    }
  }
}

/** Everything a visit has had counted so far, read back from its own row. */
function countedSoFar(s: Dict): Counts {
  const obj = (v: unknown): Dict => (isObj(v) ? v : {});
  const rows = (v: unknown, fields: string[]): Record<string, Dict> => {
    const out: Record<string, Dict> = {};
    for (const [key, row] of Object.entries(obj(v))) {
      if (!safeKey(key) || !isObj(row)) continue;
      out[key] = Object.fromEntries(fields.map((f) => [f, num((row as Dict)[f], Number.MAX_SAFE_INTEGER)]));
    }
    return out;
  };
  const source = obj(s.Source);
  return {
    opened: true,
    visit: Math.max(1, num(s.Visit, 100000)),
    countryCode: safeKey(obj(s.Geo).Code) || "",
    source: typeof source.Name === "string" ? { Name: source.Name, Kind: (source.Kind || "referral") as SourceKind } : null,
    deviceType: safeKey(obj(s.Device).Type) || "",
    linkDocId: str(obj(s.Link).DocId, 40) || safeKey(obj(s.Link).Id) || "",
    activeMs: num(s.ActiveMs, Number.MAX_SAFE_INTEGER),
    projects: rows(s.Projects, ["Opens", "Live", "Github", "Download"]),
    socials: rows(s.Socials, ["Clicks", "AwayMs"]),
    contactOpens: num(obj(s.Contact).Opens, Number.MAX_SAFE_INTEGER),
    cvOpens: num(obj(s.Cv).Opens, Number.MAX_SAFE_INTEGER),
    events: Array.isArray(s.Events) ? s.Events.length : 0,
  };
}

// ── notification ──────────────────────────────────────────────────────
async function notifyLinkOpened(args: {
  link: LinkRow;
  sessionId: string;
  geo: { Country: string; Code: string } | null;
  device: Dict;
  visit: number;
  ref: string;
}): Promise<void> {
  const to = process.env.OWNER_EMAIL;
  const key = process.env.RESEND_API_KEY;
  if (!to || !key) return; // not configured - a missing key must not be an error

  const { Resend } = await import("resend");
  const resend = new Resend(key);
  const linkName = args.link.Name || "Someone";
  const linkFor = args.link.For || "your portfolio";
  const site = siteConfig.url;

  await sendSafe(resend, {
    from: getResendFrom(),
    to,
    subject: `${linkName} opened your link`.replace(/[\r\n]+/g, " ").slice(0, 200),
    html: linkOpenedHtml({
      linkName,
      linkFor,
      country: args.geo?.Code ? `${args.geo.Country} (${args.geo.Code})` : "",
      device: [args.device.Type, args.device.OS, args.device.Browser].filter(Boolean).join(" - "),
      localTime: str(args.device.LocalTime, 10),
      source: args.ref || "Direct",
      visit: args.visit,
      storyUrl: `${site}/dashboard?s=${encodeURIComponent(args.sessionId)}`,
    }),
  });
}