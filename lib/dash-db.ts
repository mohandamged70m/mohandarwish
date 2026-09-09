// Drop-in Firestore-compatible data layer backed by Supabase.
//
// The dashboard/ components were written against firebase/firestore. Instead of
// rewriting ~12k lines of UI/logic, this module exposes the same function names
// and snapshot shapes, persisted in the `dashboard_docs` table (path -> data).
// Only the transport changed: Firebase is gone, Supabase is the backend.
//
// Supported surface (everything dashboard/ uses):
//   doc(db, ...segs) / collection(db, ...segs)  (also single "a/b/c" strings)
//   query(col, ...constraints) with where(field,'==',v), orderBy(field,dir), limit(n)
//   onSnapshot(target, onNext, onError?) -> unsubscribe
//   getDoc / getDocs / setDoc (with {merge}) / updateDoc (dotted keys) / deleteDoc
//   deleteField() / serverTimestamp() / writeBatch(db)

import { supabase } from "@/lib/supabase/client";

const TABLE = "dashboard_docs";

const DF = "__dash_delete_field__";
const ST = "__dash_server_timestamp__";

// ---------------------------------------------------------------------------
// Sentinels
// ---------------------------------------------------------------------------

export function deleteField(): unknown {
  return { [DF]: true };
}

export function serverTimestamp(): unknown {
  return { [ST]: true };
}

function isDeleteField(v: unknown): boolean {
  return !!v && typeof v === "object" && !Array.isArray(v) && DF in (v as Record<string, unknown>);
}

function isServerTimestamp(v: unknown): boolean {
  return !!v && typeof v === "object" && !Array.isArray(v) && ST in (v as Record<string, unknown>);
}

function resolveSentinels(v: unknown): unknown {
  if (isServerTimestamp(v)) return new Date().toISOString();
  if (Array.isArray(v)) return v.map(resolveSentinels);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (isDeleteField(val)) continue;
      out[k] = resolveSentinels(val);
    }
    return out;
  }
  return v;
}

// Legacy default/named app handle: `import app, { db } from '.../lib/firebase'`.
// The refs below ignore it (all functions take explicit paths), but the value
// must exist for the copy-pasted imports to keep working.
export const db = { __dashDb: true };
const app = { __dashApp: true };
export default app;

export interface DocRef {
  kind: "doc";
  path: string;
  id: string;
}

export interface ColRef {
  kind: "col";
  path: string;
}

function joinSegs(segs: string[]): string {
  return segs
    .flatMap((s) => String(s).split("/"))
    .map((s) => s.trim())
    .filter(Boolean)
    .join("/");
}

export function doc(_db: unknown, ...segs: string[]): DocRef {
  const path = joinSegs(segs);
  const parts = path.split("/");
  return { kind: "doc", path, id: parts[parts.length - 1] ?? "" };
}

export function collection(_db: unknown, ...segs: string[]): ColRef {
  return { kind: "col", path: joinSegs(segs) };
}

// ---------------------------------------------------------------------------
// Query constraints
// ---------------------------------------------------------------------------

export type Constraint =
  | { t: "where"; field: string; op: string; value: unknown }
  | { t: "order"; field: string; dir: "asc" | "desc" }
  | { t: "limit"; n: number };

export interface Query {
  kind: "query";
  col: ColRef;
  constraints: Constraint[];
}

export function where(field: string, op: string, value: unknown): Constraint {
  return { t: "where", field, op, value };
}

export function orderBy(field: string, dir: "asc" | "desc" = "asc"): Constraint {
  return { t: "order", field, dir };
}

export function limit(n: number): Constraint {
  return { t: "limit", n };
}

export function query(col: ColRef, ...constraints: Constraint[]): Query {
  return { kind: "query", col, constraints };
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

export interface DocSnapshot {
  id: string;
  ref: DocRef;
  exists: () => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: () => Record<string, any>;
}

export interface QueryDocSnapshot {
  id: string;
  ref: DocRef;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: () => Record<string, any>;
}

export interface QuerySnapshot {
  docs: QueryDocSnapshot[];
  size: number;
  empty: boolean;
  forEach: (cb: (d: QueryDocSnapshot) => void) => void;
}

function getPath(obj: unknown, dotted: string): unknown {
  let cur = obj;
  for (const part of dotted.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function setPath(obj: Record<string, unknown>, dotted: string, value: unknown): void {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const next = cur[p];
    if (!next || typeof next !== "object" || Array.isArray(next)) cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function delPath(obj: Record<string, unknown>, dotted: string): void {
  const parts = dotted.split(".");
  let cur: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur || typeof cur !== "object") return;
    cur = (cur as Record<string, unknown>)[parts[i]];
  }
  if (cur && typeof cur === "object") delete (cur as Record<string, unknown>)[parts[parts.length - 1]];
}

// ---------------------------------------------------------------------------
// Raw reads
// ---------------------------------------------------------------------------

async function readDocRow(path: string): Promise<Record<string, unknown> | undefined> {
  const { data, error } = await supabase.from(TABLE).select("data").eq("path", path).maybeSingle();
  if (error) throw error;
  return (data?.data as Record<string, unknown> | undefined) ?? undefined;
}

interface Row {
  path: string;
  data: Record<string, unknown>;
}

async function readColRows(prefix: string): Promise<Row[]> {
  // Fetch in pages (tables stay small; page defensively anyway).
  const rows: Row[] = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("path,data")
      .like("path", `${prefix}/%`)
      .range(from, from + page - 1);
    if (error) throw error;
    const batch = (data ?? []) as Row[];
    // Firestore collections list DIRECT children only.
    for (const r of batch) {
      const rest = r.path.slice(prefix.length + 1);
      if (rest && !rest.includes("/")) rows.push({ path: r.path, data: (r.data ?? {}) as Record<string, unknown> });
    }
    if (batch.length < page) break;
    from += page;
  }
  return rows;
}

function applyConstraints(rows: Row[], constraints: Constraint[]): Row[] {
  let out = rows;
  for (const c of constraints) {
    if (c.t === "where") {
      out = out.filter((r) => {
        const v = getPath(r.data, c.field);
        if (c.op === "==") return v === c.value;
        if (c.op === "!=") return v !== c.value;
        return true;
      });
    }
  }
  const orders = constraints.filter((c) => c.t === "order") as { field: string; dir: "asc" | "desc" }[];
  if (orders.length) {
    out = [...out].sort((a, b) => {
      for (const o of orders) {
        const av = getPath(a.data, o.field) as number | string | null | undefined;
        const bv = getPath(b.data, o.field) as number | string | null | undefined;
        if (av === bv) continue;
        if (av === undefined || av === null) return 1;
        if (bv === undefined || bv === null) return -1;
        const cmp = av < bv ? -1 : 1;
        return o.dir === "desc" ? -cmp : cmp;
      }
      return 0;
    });
  }
  for (const c of constraints) {
    if (c.t === "limit") out = out.slice(0, c.n);
  }
  return out;
}

function docSnap(ref: DocRef, data: Record<string, unknown> | undefined): DocSnapshot {
  const body = (data ?? {}) as Record<string, never>;
  return {
    id: ref.id,
    ref,
    exists: () => data !== undefined,
    data: () => body,
  };
}

function querySnap(rows: Row[]): QuerySnapshot {
  const docs: QueryDocSnapshot[] = rows.map((r) => {
    const parts = r.path.split("/");
    const id = parts[parts.length - 1];
    const body = (r.data ?? {}) as Record<string, never>;
    return { id, ref: { kind: "doc", path: r.path, id }, data: () => body };
  });
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) };
}

async function fetchTarget(target: DocRef | ColRef | Query): Promise<DocSnapshot | QuerySnapshot> {
  if (target.kind === "doc") return docSnap(target, await readDocRow(target.path));
  if (target.kind === "query") {
    const rows = await readColRows(target.col.path);
    return querySnap(applyConstraints(rows, target.constraints));
  }
  return querySnap(await readColRows(target.path));
}

// ---------------------------------------------------------------------------
// Live subscriptions: local emit + Supabase Realtime + safety poll
// ---------------------------------------------------------------------------

type Listener = {
  target: DocRef | ColRef | Query;
  onNext: (s: never) => void;
  onError?: (e: { message: string; code?: string }) => void;
};
const listeners = new Set<Listener>();
let channelStarted = false;
let pollStarted = false;
let notifyTimer: ReturnType<typeof setTimeout> | null = null;

async function refetchAll(): Promise<void> {
  const jobs = [...listeners].map(async (l) => {
    try {
      const snap = await fetchTarget(l.target);
      l.onNext(snap as never);
    } catch (e) {
      l.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  });
  await Promise.all(jobs);
}

function scheduleRefetch(): void {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    void refetchAll();
  }, 50);
}

function ensureChannel(): void {
  if (channelStarted || pollStarted) return;
  pollStarted = true;
  try {
    supabase
      .channel("dashboard_docs_live")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => scheduleRefetch())
      .subscribe();
    channelStarted = true;
  } catch {
    // Realtime unavailable (e.g. publication not enabled) — local emit + poll cover us.
  }
  // Safety net for other tabs / external writes when Realtime is off.
  setInterval(() => {
    if (listeners.size) void refetchAll();
  }, 30000);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && listeners.size) void refetchAll();
    });
  }
}

export function onSnapshot(
  target: DocRef,
  onNext: (snap: DocSnapshot) => void,
  onError?: (e: { message: string; code?: string }) => void
): () => void;
export function onSnapshot(
  target: ColRef | Query,
  onNext: (snap: QuerySnapshot) => void,
  onError?: (e: { message: string; code?: string }) => void
): () => void;
export function onSnapshot(
  target: DocRef | ColRef | Query,
  onNext: (snap: never) => void,
  onError?: (e: { message: string; code?: string }) => void
): () => void {
  ensureChannel();
  const entry: Listener = { target, onNext, onError };
  listeners.add(entry);
  fetchTarget(target)
    .then((snap) => onNext(snap as never))
    .catch((e: Error) => onError?.(e));
  return () => {
    listeners.delete(entry);
  };
}

// ---------------------------------------------------------------------------
// One-shot reads
// ---------------------------------------------------------------------------

export async function getDoc(ref: DocRef): Promise<DocSnapshot> {
  return docSnap(ref, await readDocRow(ref.path));
}

export async function getDocs(target: ColRef | Query): Promise<QuerySnapshot> {
  const snap = (await fetchTarget(target)) as QuerySnapshot;
  return snap;
}

// ---------------------------------------------------------------------------
// Writes (+ bridges to the site's real tables)
// ---------------------------------------------------------------------------

async function upsertDoc(path: string, data: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert(
    { path, data, updated_at: new Date().toISOString() },
    { onConflict: "path" }
  );
  if (error) throw error;
}

function adminToken(): string {
  if (typeof window === "undefined") return "";
  const saved = localStorage.getItem("dashboard_token");
  if (saved) return saved;
  // Cookie fallback (set by the dashboard shell alongside localStorage so
  // server routes + middleware can also read it). Kept for compat.
  const m = document.cookie.match(/(?:^|;\s*)dashboard_token=([^;]+)/);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

// Mirror dashboard availability edits into the site's availability table,
// so the booking flow sees them (D-Settings / D-Canary only write the doc).
async function mirrorAvailability(data: Record<string, unknown>): Promise<void> {
  if (!Array.isArray(data.workingDays) || !Array.isArray(data.hours)) return;
  try {
    await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-token": adminToken() },
      body: JSON.stringify({ workingDays: data.workingDays, hours: data.hours }),
    });
  } catch {
    // best-effort; the doc itself is already saved
  }
}

// Mirror Canary meeting/email removals + meeting edits into bookings/messages.
async function mirrorCanary(patch: Record<string, unknown>): Promise<void> {
  const token = adminToken();
  const jobs: Promise<unknown>[] = [];
  const call = (url: string, init: RequestInit) =>
    fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", "x-admin-token": token, ...(init.headers || {}) },
    }).catch(() => null);

  const meetings = new Map<string, Record<string, unknown>>();
  const emails = new Map<string, Record<string, unknown>>();
  for (const [key, val] of Object.entries(patch)) {
    const m = key.match(/^(Meetings|Emails)\.([^.]+)(?:\.(.+))?$/);
    if (!m) continue;
    const [, kind, id, field] = m;
    const store = kind === "Meetings" ? meetings : emails;
    if (!store.has(id)) store.set(id, {});
    if (field) store.get(id)![field] = val;
    else store.get(id)!.__whole = val;
  }

  for (const [id, change] of meetings) {
    if (isDeleteField(change.__whole)) {
      jobs.push(call(`/api/booking/${id}`, { method: "DELETE" }));
      continue;
    }
    const upd: Record<string, unknown> = {};
    if (typeof change.Date === "string") upd.date = change.Date;
    if (typeof change.Time === "string") upd.time = change.Time;
    if (typeof change.Name === "string") upd.name = change.Name;
    if (typeof change["What For"] === "string") upd.reason = change["What For"];
    if (typeof change.MeetingLink === "string") upd.meeting_link = change.MeetingLink;
    if (typeof change.GoogleEventId === "string") upd.google_event_id = change.GoogleEventId;
    if (Object.keys(upd).length) jobs.push(call(`/api/booking/${id}`, { method: "PATCH", body: JSON.stringify(upd) }));
  }
  for (const [id, change] of emails) {
    if (isDeleteField(change.__whole)) {
      jobs.push(call(`/api/messages/${id}`, { method: "DELETE" }));
    }
  }
  if (jobs.length) await Promise.all(jobs);
}

export async function setDoc(
  ref: DocRef,
  data: Record<string, unknown>,
  opts?: { merge?: boolean }
): Promise<void> {
  const clean = resolveSentinels(data) as Record<string, unknown>;
  let next: Record<string, unknown>;
  if (opts?.merge) {
    const existing = (await readDocRow(ref.path)) ?? {};
    next = { ...existing };
    for (const [k, v] of Object.entries(clean)) {
      if (isDeleteField(v)) delete next[k];
      else next[k] = v;
    }
  } else {
    next = clean;
  }
  await upsertDoc(ref.path, next);
  scheduleRefetch();
  if (ref.path === "Settings/Availability") void mirrorAvailability(next);
}

export async function updateDoc(ref: DocRef, patch: Record<string, unknown>): Promise<void> {
  const existing = (await readDocRow(ref.path)) ?? {};
  const next = { ...(existing as Record<string, unknown>) };
  for (const [key, val] of Object.entries(patch)) {
    if (isDeleteField(val)) {
      if (key.includes(".")) delPath(next, key);
      else delete next[key];
    } else if (key.includes(".")) {
      setPath(next, key, resolveSentinels(val));
    } else {
      next[key] = resolveSentinels(val);
    }
  }
  await upsertDoc(ref.path, next);
  scheduleRefetch();
  if (ref.path === "Settings/Availability") void mirrorAvailability(next);
  if (ref.path === "Settings/Canary") void mirrorCanary(patch);
}

export async function deleteDoc(ref: DocRef): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("path", ref.path);
  if (error) throw error;
  scheduleRefetch();
}

interface Batch {
  set: (ref: DocRef, data: Record<string, unknown>, opts?: { merge?: boolean }) => Batch;
  update: (ref: DocRef, patch: Record<string, unknown>) => Batch;
  delete: (ref: DocRef) => Batch;
  commit: () => Promise<void>;
}

export function writeBatch(_db: unknown): Batch {
  const ops: (() => Promise<void>)[] = [];
  const batch: Batch = {
    set(ref, data, opts) {
      ops.push(() => setDoc(ref, data, opts));
      return batch;
    },
    update(ref, patch) {
      ops.push(() => updateDoc(ref, patch));
      return batch;
    },
    delete(ref) {
      ops.push(() => deleteDoc(ref));
      return batch;
    },
    async commit() {
      for (const op of ops) await op();
    },
  };
  return batch;
}
