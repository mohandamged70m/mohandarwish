// Convex data layer, Firestore-compatible surface kept for the dashboard UI.
//
// Same function names and snapshot shapes as the old Firestore / document shim
// versions, so the copy-pasted dashboard/ components keep working unchanged.
// Only the transport moved: this time to Convex (real subscriptions, no
// 30s poll fallback).
//
//   doc(db, ...segs) / collection(db, ...segs)
//   query(col, ...constraints) with where(field,'==',v), orderBy, limit(n)
//   onSnapshot(target, onNext, onError?) -> unsubscribe
//   getDoc / getDocs / setDoc ({merge}) / updateDoc (dotted keys) / deleteDoc
//   deleteField() / serverTimestamp() / increment() / writeBatch(db)

import { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";

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

// Legacy default/named app handle: `import app, { db } from '.../lib/dash-db'`.
export const db = { __dashDb: true };
const app = { __dashApp: true };
export default app;

// ---------------------------------------------------------------------------
// Convex client (lazy, tolerant of missing env so build/prerender survives)
// ---------------------------------------------------------------------------

let _client: ConvexReactClient | null = null;

function convex(): ConvexReactClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  _client = new ConvexReactClient(url);
  return _client;
}

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

export function increment(n: number): number {
  // See old note: write current+delta back for JS writers; real atomic
  // increments happen server-side in convex/docs.ts merge functions.
  return n;
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

interface Row {
  path: string;
  data: Record<string, unknown>;
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
// Constraint + snapshot shaping (client-side, same as before)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Live subscriptions — thin wrapper over Convex React client primitives.
// Keeps the old onSnapshot(target, onNext, onError) shape. Convex pushes
// updates; no polling, no realtime channel.
// ---------------------------------------------------------------------------

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
  const client = convex();
  if (!client) {
    const emptySnap =
      target.kind === "doc" ? docSnap(target, undefined) : querySnap([]);
    onNext(emptySnap as never);
    return () => {};
  }
  try {
    if (target.kind === "doc") {
      const watch = client.watchQuery(api.docs.getDoc, { path: target.path });
      const emit = () => {
        const data = watch.localQueryResult();
        onNext(docSnap(target, (data ?? undefined) as Record<string, unknown> | undefined) as never);
      };
      const dispose = watch.onUpdate(emit);
      // Initial fetch so callers don't wait for the first sync round-trip.
      client
        .query(api.docs.getDoc, { path: target.path })
        .then((data: unknown) => onNext(docSnap(target, (data ?? undefined) as Record<string, unknown> | undefined) as never))
        .catch((e: Error) => onError?.({ message: e.message }));
      return dispose;
    }
    const prefix = target.kind === "query" ? target.col.path : target.path;
    const constraints = target.kind === "query" ? target.constraints : [];
    const watch = client.watchQuery(api.docs.listCollection, { prefix });
    const emit = () => {
      const rows = (watch.localQueryResult() ?? []) as Row[];
      onNext(querySnap(applyConstraints(rows, constraints)) as never);
    };
    const dispose = watch.onUpdate(emit);
    client
      .query(api.docs.listCollection, { prefix })
      .then((rows: unknown) => onNext(querySnap(applyConstraints((rows ?? []) as Row[], constraints)) as never))
      .catch((e: Error) => onError?.({ message: e.message }));
    return dispose;
  } catch (e) {
    onError?.(e instanceof Error ? e : new Error(String(e)));
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// One-shot reads
// ---------------------------------------------------------------------------

export async function getDoc(ref: DocRef): Promise<DocSnapshot> {
  const client = convex();
  if (!client) return docSnap(ref, undefined);
  try {
    const data = await client.query(api.docs.getDoc, { path: ref.path });
    return docSnap(ref, (data ?? undefined) as Record<string, unknown> | undefined);
  } catch {
    return docSnap(ref, undefined);
  }
}

export async function getDocs(target: ColRef | Query): Promise<QuerySnapshot> {
  const client = convex();
  if (!client) return querySnap([]);
  const prefix = target.kind === "query" ? target.col.path : target.path;
  try {
    const rows = (await client.query(api.docs.listCollection, { prefix })) as Row[];
    const constraints = target.kind === "query" ? target.constraints : [];
    return querySnap(applyConstraints(rows, constraints));
  } catch {
    return querySnap([]);
  }
}

// ---------------------------------------------------------------------------
// Writes (+ bridges to the site's real tables — same behavior, now on Convex)
// ---------------------------------------------------------------------------

async function writeDoc(path: string, data: Record<string, unknown>): Promise<void> {
  const client = convex();
  if (!client) throw new Error("Convex not configured");
  await client.mutation(api.docs.setDoc, { path, data });
}

function adminToken(): string {
  if (typeof window === "undefined") return "";
  const saved = localStorage.getItem("dashboard_token");
  if (saved) return saved;
  const m = document.cookie.match(/(?:^|;\s*)dashboard_token=([^;]+)/);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

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
    if (typeof change.MeetingLink === "string") upd.meetingLink = change.MeetingLink;
    if (typeof change.GoogleEventId === "string") upd.googleEventId = change.GoogleEventId;
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
    const existingSnap = await getDoc(ref);
    next = { ...(existingSnap.data() ?? {}) };
    for (const [k, v] of Object.entries(clean)) {
      if (isDeleteField(v)) delete next[k];
      else next[k] = v;
    }
  } else {
    next = clean;
  }
  await writeDoc(ref.path, next);
  if (ref.path === "Settings/Availability") void mirrorAvailability(next);
}

export async function updateDoc(ref: DocRef, patch: Record<string, unknown>): Promise<void> {
  const existingSnap = await getDoc(ref);
  const existing = (existingSnap.data() ?? {}) as Record<string, unknown>;
  const next = { ...existing };
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
  await writeDoc(ref.path, next);
  if (ref.path === "Settings/Availability") void mirrorAvailability(next);
  if (ref.path === "Settings/Canary") void mirrorCanary(patch);
}

export async function deleteDoc(ref: DocRef): Promise<void> {
  const client = convex();
  if (!client) throw new Error("Convex not configured");
  await client.mutation(api.docs.deleteDoc, { path: ref.path });
}

interface Batch {
  set: (ref: DocRef, data: Record<string, unknown>, opts?: { merge?: boolean }) => Batch;
  update: (ref: DocRef, patch: Record<string, unknown>) => Batch;
  delete: (ref: DocRef) => Batch;
  commit: () => Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
