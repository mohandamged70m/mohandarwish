import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Trails ingest: page-view pings + rich session flushes.
// Feeds Analytics/Days/Items, Analytics/Totals, Analytics/Sessions/Items
// (capped at 300), Analytics/Sources/Items, Analytics/Socials/Items and the
// Projects/<id> Views maps that D-Trails reads. No PII is stored.
//
// Two call shapes (backwards compatible):
//   legacy ping: { path, referrer, screen, viewport, language }
//   session:     { kind: "init" | "flush", sid, ... }

const MAX_SESSIONS = 300;
const MAX_EVENTS = 500;

type NumMap = Record<string, number>;

interface ProjectDelta {
  Ms?: number;
  Opens?: number;
  Live?: number;
  Github?: number;
  Download?: number;
}

interface SocialDelta {
  Clicks?: number;
  AwayMs?: number;
}

interface FlushDeltas {
  sections?: NumMap;
  projects?: Record<string, ProjectDelta>;
  projectAgg?: { Project?: number; Live?: number; Github?: number; Download?: number };
  socials?: Record<string, SocialDelta>;
  socialClicks?: number;
  contactsSent?: number;
}

type Body = {
  kind?: "init" | "flush";
  sid?: string;
  vid?: string;
  isNewVisitor?: boolean;
  path?: string;
  referrer?: string;
  screen?: string;
  viewport?: string;
  language?: string;
  utm?: Record<string, string>;
  owner?: boolean;
  linkId?: string;
  linkName?: string;
  linkFor?: string;
  link?: { Id?: string; Name?: string; For?: string };
  device?: Record<string, string>;
  perf?: { LoadMs?: number; LcpMs?: number };
  // flush-only (all deltas except scalars)
  activeMs?: number;
  openMs?: number;
  idleMs?: number;
  scroll?: NumMap;
  contactOpens?: number;
  contactSent?: string;
  cvOpens?: number;
  exitSection?: string;
  events?: Array<{ k: string; v?: string; t: number }>;
  rage?: number;
  copies?: number;
  prints?: number;
  ended?: boolean;
  deltas?: FlushDeltas;
};

type Supa = ReturnType<typeof supabaseServer>;

async function readDoc(supa: Supa, path: string) {
  const { data } = await supa.from("dashboard_docs").select("data").eq("path", path).maybeSingle();
  return ((data?.data as Record<string, unknown>) ?? {}) as Record<string, unknown>;
}

async function writeDoc(supa: Supa, path: string, data: Record<string, unknown>) {
  await supa.from("dashboard_docs").upsert(
    { path, data, updated_at: new Date().toISOString() },
    { onConflict: "path" }
  );
}

function num(v: unknown): number {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function cleanSid(s: unknown): string {
  return typeof s === "string" ? s.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) : "";
}

function sourceKind(host: string): string {
  const h = host.toLowerCase();
  if (/google|bing|duckduckgo|yahoo|yandex|baidu|ecosia|brave/.test(h)) return "search";
  if (/x\.com|twitter|linkedin|github|facebook|instagram|tiktok|reddit|youtube|medium|dev\.to|producthunt/.test(h))
    return "social";
  if (/mail|newsletter|substack/.test(h)) return "mail";
  if (/chatgpt|claude|perplexity|gemini|bard|copilot|grok/.test(h)) return "ai";
  return "referral";
}

function hostOf(ref: string): string {
  try {
    return ref ? new URL(ref).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

// Country from the platform edge (Vercel). Locally / elsewhere this is
// absent and Geo stays empty — never breaks tracking.
function edgeGeo(req: Request): { Country: string; Code: string } {
  const raw = (req.headers.get("x-vercel-ip-country") || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(raw)) return { Country: "", Code: "" };
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(raw) || "";
    return { Country: name, Code: raw };
  } catch {
    return { Country: "", Code: raw };
  }
}

async function bumpDay(supa: Supa, day: string, patch: Record<string, number>) {
  if (!Object.values(patch).some((n) => n > 0)) {
    // Still ensure the day doc exists for session-only inits handled by caller.
    return;
  }
  const doc = await readDoc(supa, `Analytics/Days/Items/${day}`);
  const next = { ...doc };
  for (const [k, v] of Object.entries(patch)) next[k] = num(next[k]) + v;
  await writeDoc(supa, `Analytics/Days/Items/${day}`, next);
}

async function trimSessions(supa: Supa) {
  const { data: rows } = await supa
    .from("dashboard_docs")
    .select("path,data")
    .like("path", "Analytics/Sessions/Items/%")
    .limit(2000);
  const list = ((rows ?? []) as { path: string; data: Record<string, unknown> }[]).sort(
    (a, b) => num(b.data?.LastSeenAt ?? b.data?.StartedAt) - num(a.data?.LastSeenAt ?? a.data?.StartedAt)
  );
  const extra = list.slice(MAX_SESSIONS);
  for (let i = 0; i < extra.length; i += 50) {
    const chunk = extra.slice(i, i + 50).map((r) => r.path);
    if (chunk.length) await supa.from("dashboard_docs").delete().in("path", chunk);
  }
}

// --- legacy minimal ping (old TrackView): one Ended session per page view ---
async function legacyPing(supa: Supa, body: Body, path: string, now: number, day: string) {
  await bumpDay(supa, day, { Sessions: 1 });
  // ensure day doc exists even when bumpDay short-circuits (never here: Sessions=1)
  const totals = await readDoc(supa, "Analytics/Totals");
  await writeDoc(supa, "Analytics/Totals", {
    ...totals,
    Sessions: num(totals.Sessions) + 1,
    Visitors: num(totals.Visitors) + 1,
  });

  const id = `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await writeDoc(supa, `Analytics/Sessions/Items/${id}`, {
    StartedAt: now,
    LastSeenAt: now,
    Ended: true,
    ActiveMs: 0,
    OpenMs: 0,
    IdleMs: 0,
    Visit: 1,
    Entry: { Ref: body.referrer || "Direct", Section: path },
    Device: {
      Screen: body.screen || "",
      Viewport: body.viewport || "",
      Language: body.language || "",
    },
    Sections: { [path]: 1 },
  });
  await trimSessions(supa);

  const host = hostOf(body.referrer || "");
  const srcId = host || "direct";
  const src = await readDoc(supa, `Analytics/Sources/Items/${srcId}`);
  await writeDoc(supa, `Analytics/Sources/Items/${srcId}`, {
    ...src,
    Name: host || "Direct",
    Kind: host ? sourceKind(host) : "direct",
    Sessions: num(src.Sessions) + 1,
    LastAt: now,
  });
}

// --- session init: one live session row per visitor session ---
async function sessionInit(
  supa: Supa,
  body: Body,
  path: string,
  now: number,
  day: string,
  geo: { Country: string; Code: string },
) {
  const sid = cleanSid(body.sid);
  if (!sid) return;
  const existing = await readDoc(supa, `Analytics/Sessions/Items/${sid}`);
  if (existing.StartedAt) {
    // Re-init (e.g. HMR / remount): keep it live, don't double-count aggregates.
    await writeDoc(supa, `Analytics/Sessions/Items/${sid}`, {
      ...existing,
      LastSeenAt: now,
      Ended: false,
    });
    return;
  }

  const d = body.device ?? {};
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 120) : "");
  const linkStr = (v: unknown) => (typeof v === "string" ? v.slice(0, 120) : "");
  const utm: Record<string, string> = {};
  if (body.utm && typeof body.utm === "object") {
    for (const [k, v] of Object.entries(body.utm)) {
      if (typeof v === "string" && v) utm[k.slice(0, 24)] = v.slice(0, 200);
    }
  }
  await writeDoc(supa, `Analytics/Sessions/Items/${sid}`, {
    StartedAt: now,
    LastSeenAt: now,
    Ended: false,
    ActiveMs: 0,
    OpenMs: 0,
    IdleMs: 0,
    Owner: body.owner === true,
    Visit: 1,
    Legacy: false,
    EventsCut: false,
    Geo: geo,
    Device: {
      Type: str(d.Type),
      Browser: str(d.Browser),
      OS: str(d.OS),
      LocalTime: str(d.LocalTime),
      Timezone: str(d.Timezone),
      Screen: str(d.Screen || body.screen),
      Viewport: str(d.Viewport || body.viewport),
      Language: str(d.Language || body.language),
      Theme: str(d.Theme),
    },
    Link: {
      Id: linkStr(body.linkId),
      Name: linkStr(body.linkName),
      For: linkStr(body.linkFor),
    },
    Entry: { Ref: body.referrer || "Direct", Section: path, Utm: utm },
    Source: { Name: hostOf(body.referrer || "") || "Direct" },
    Exit: { Section: path },
    Contact: { Opens: 0, Sent: "" },
    Cv: { Opens: 0 },
    Projects: {},
    Socials: {},
    Sections: { [path]: 1 },
    Scroll: {},
    Events: [],
    Rage: 0,
    Copies: 0,
    Prints: 0,
    Flushes: 0,
    Perf: { LoadMs: num(body.perf?.LoadMs), LcpMs: num(body.perf?.LcpMs) },
  });

  const dayDoc = await readDoc(supa, `Analytics/Days/Items/${day}`);
  await writeDoc(supa, `Analytics/Days/Items/${day}`, { ...dayDoc, Sessions: num(dayDoc.Sessions) + 1 });
  const totals = await readDoc(supa, "Analytics/Totals");
  await writeDoc(supa, "Analytics/Totals", {
    ...totals,
    Sessions: num(totals.Sessions) + 1,
    Visitors: num(totals.Visitors) + (body.isNewVisitor === false ? 0 : 1),
  });
  await trimSessions(supa);

  const host = hostOf(body.referrer || "");
  const srcId = host || "direct";
  const src = await readDoc(supa, `Analytics/Sources/Items/${srcId}`);
  await writeDoc(supa, `Analytics/Sources/Items/${srcId}`, {
    ...src,
    Name: host || "Direct",
    Kind: host ? sourceKind(host) : "direct",
    Sessions: num(src.Sessions) + 1,
    LastAt: now,
  });
}

// --- session flush: additive deltas merged into the live session row ---
async function sessionFlush(supa: Supa, body: Body, now: number, day: string) {
  const sid = cleanSid(body.sid);
  if (!sid) return;
  const cur = await readDoc(supa, `Analytics/Sessions/Items/${sid}`);
  if (!cur.StartedAt) return; // unknown session: ignore (client will re-init)

  const dz = body.deltas ?? {};
  const sec = (dz.sections ?? {}) as NumMap;
  const proj = (dz.projects ?? {}) as Record<string, ProjectDelta>;
  const soc = (dz.socials ?? {}) as Record<string, SocialDelta>;
  const scr = (body.scroll ?? {}) as NumMap;

  const sections = { ...((cur.Sections as NumMap) ?? {}) };
  for (const [k, v] of Object.entries(sec)) {
    if (num(v) > 0) sections[k.slice(0, 200)] = num(sections[k]) + num(v);
  }
  const scroll = { ...((cur.Scroll as NumMap) ?? {}) };
  for (const [k, v] of Object.entries(scr)) {
    const key = k.slice(0, 200);
    scroll[key] = Math.max(num(scroll[key]), num(v));
  }
  const projects = { ...((cur.Projects as Record<string, ProjectDelta>) ?? {}) };
  for (const [id, d] of Object.entries(proj)) {
    const key = id.slice(0, 120);
    const p = projects[key] ?? { Ms: 0, Opens: 0, Live: 0, Github: 0, Download: 0 };
    projects[key] = {
      Ms: num(p.Ms) + num(d.Ms),
      Opens: num(p.Opens) + num(d.Opens),
      Live: num(p.Live) + num(d.Live),
      Github: num(p.Github) + num(d.Github),
      Download: num(p.Download) + num(d.Download),
    };
  }
  const socials = { ...((cur.Socials as Record<string, SocialDelta>) ?? {}) };
  for (const [name, d] of Object.entries(soc)) {
    const key = name.slice(0, 120);
    const s = socials[key] ?? { Clicks: 0, AwayMs: 0 };
    socials[key] = { Clicks: num(s.Clicks) + num(d.Clicks), AwayMs: num(s.AwayMs) + num(d.AwayMs) };
  }

  const prevEvents = Array.isArray(cur.Events) ? cur.Events : [];
  const incoming = Array.isArray(body.events) ? body.events : [];
  const saneEvents = incoming
    .filter((e) => e && typeof e.k === "string")
    .slice(0, MAX_EVENTS)
    .map((e) => ({ k: e.k.slice(0, 24), v: typeof e.v === "string" ? e.v.slice(0, 200) : undefined, t: num(e.t) }));
  const mergedEvents = [...prevEvents, ...saneEvents].slice(-MAX_EVENTS);
  const eventsCut = Boolean(cur.EventsCut) || prevEvents.length + saneEvents.length > MAX_EVENTS;

  const prevContact = (cur.Contact ?? {}) as { Opens?: unknown; Sent?: unknown };
  const contactSent = typeof body.contactSent === "string" && body.contactSent ? body.contactSent.slice(0, 24) : "";
  // Late link attribution (landing handoff): stamp the session once known.
  const linkPatch =
    body.link && typeof body.link.Id === "string" && body.link.Id
      ? {
          Id: body.link.Id.slice(0, 120),
          Name: typeof body.link.Name === "string" ? body.link.Name.slice(0, 120) : "",
          For: typeof body.link.For === "string" ? body.link.For.slice(0, 120) : "",
        }
      : null;
  const prevCv = (cur.Cv ?? {}) as { Opens?: unknown };
  const prevPerf = (cur.Perf ?? {}) as { LoadMs?: unknown; LcpMs?: unknown };

  await writeDoc(supa, `Analytics/Sessions/Items/${sid}`, {
    ...cur,
    LastSeenAt: now,
    Ended: body.ended === true,
    ActiveMs: num(cur.ActiveMs) + num(body.activeMs),
    OpenMs: Math.max(num(cur.OpenMs), num(body.openMs)),
    IdleMs: num(cur.IdleMs) + num(body.idleMs),
    Exit: { Section: typeof body.exitSection === "string" && body.exitSection ? body.exitSection.slice(0, 200) : ((cur.Exit as { Section?: string } | undefined)?.Section ?? "") },
    ...(linkPatch ? { Link: linkPatch } : null),
    Contact: {
      Opens: num(prevContact.Opens) + num(body.contactOpens),
      Sent: contactSent || (typeof prevContact.Sent === "string" ? prevContact.Sent : ""),
    },
    Cv: { Opens: num(prevCv.Opens) + num(body.cvOpens) },
    Projects: projects,
    Socials: socials,
    Sections: sections,
    Scroll: scroll,
    Events: mergedEvents,
    EventsCut: eventsCut,
    Rage: num(cur.Rage) + num(body.rage),
    Copies: num(cur.Copies) + num(body.copies),
    Prints: num(cur.Prints) + num(body.prints),
    Flushes: num(cur.Flushes) + 1,
    Perf: {
      LoadMs: num(prevPerf.LoadMs) || num(body.perf?.LoadMs),
      LcpMs: num(prevPerf.LcpMs) || num(body.perf?.LcpMs),
    },
  });

  // Aggregates driven by explicit deltas (exactly-once per flush from client).
  const agg = dz.projectAgg ?? {};
  const dayProjects = num(agg.Project) + num(agg.Live) + num(agg.Github) + num(agg.Download);
  const daySocials = num(dz.socialClicks);
  if (dayProjects > 0 || daySocials > 0) {
    const dayDoc = await readDoc(supa, `Analytics/Days/Items/${day}`);
    await writeDoc(supa, `Analytics/Days/Items/${day}`, {
      ...dayDoc,
      Projects: num(dayDoc.Projects) + dayProjects,
      Socials: num(dayDoc.Socials) + daySocials,
    });
  }
  if (num(dz.contactsSent) > 0) {
    const totals = await readDoc(supa, "Analytics/Totals");
    await writeDoc(supa, "Analytics/Totals", {
      ...totals,
      Contacts: num(totals.Contacts) + num(dz.contactsSent),
    });
  }
  for (const [name, d] of Object.entries(soc)) {
    if (num(d.Clicks) <= 0 && num(d.AwayMs) <= 0) continue;
    const key = name.slice(0, 120);
    const row = await readDoc(supa, `Analytics/Socials/Items/${key}`);
    await writeDoc(supa, `Analytics/Socials/Items/${key}`, {
      ...row,
      Name: key,
      Clicks: num(row.Clicks) + num(d.Clicks),
      AwayMs: num(row.AwayMs) + num(d.AwayMs),
    });
  }
  for (const [id, d] of Object.entries(proj)) {
    const opens = num(d.Opens);
    const live = num(d.Live);
    const gh = num(d.Github);
    const dl = num(d.Download);
    if (opens <= 0 && live <= 0 && gh <= 0 && dl <= 0) continue;
    const key = id.slice(0, 120);
    const row = await readDoc(supa, `Projects/${key}`);
    if (!row || Object.keys(row).length === 0) continue; // never invent project docs
    const views = { ...((row.Views as Record<string, unknown>) ?? {}) };
    views.Project = num(views.Project) + opens;
    views.Live = num(views.Live) + live;
    views.Github = num(views.Github) + gh;
    views.Download = num(views.Download) + dl;
    await writeDoc(supa, `Projects/${key}`, { ...row, Views: views });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const path = typeof body.path === "string" && body.path ? body.path.slice(0, 200) : "/";
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);

  try {
    const supa = supabaseServer();
    if (body.kind === "init") await sessionInit(supa, body, path, now, day, edgeGeo(req));
    else if (body.kind === "flush") await sessionFlush(supa, body, now, day);
    else await legacyPing(supa, body, path, now, day);
  } catch {
    // tracking must never break the page
  }
  return NextResponse.json({ ok: true });
}
