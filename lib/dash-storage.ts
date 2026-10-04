// Convex storage shim, Firebase-storage compatible surface.
//
// Supports the exact surface dashboard/ uses:
//   getStorage(app?) / ref(storage, path|url) / uploadBytes / getDownloadURL
//   listAll / deleteObject / getMetadata
// Paths are preserved verbatim via the storageMap table (convex/storage.ts);
// files live in Convex storage and are served by the recorded URL.

import { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";

const BUCKET = "firebase"; // legacy app handle shape only

export interface StorageRef {
  kind: "file" | "prefix";
  path: string;
  name: string;
  fullPath: string;
}

let _client: ConvexReactClient | null = null;

function convex(): ConvexReactClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  _client = new ConvexReactClient(url);
  return _client;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getStorage(_app?: unknown): { bucket: string } {
  return { bucket: BUCKET };
}

function baseName(path: string): string {
  const clean = path.replace(/\/+$/, "");
  const i = clean.lastIndexOf("/");
  return i >= 0 ? clean.slice(i + 1) : clean;
}

function pathFromUrl(url: string): string {
  // Try Convex storage URL format: .../api/storage/<storageId> — we can't map
  // back to a path synchronously; require callers to pass the logical path.
  // Kept for call-site compatibility: strip query, return last segment.
  const clean = url.split("?")[0];
  const i = clean.lastIndexOf("/");
  return i >= 0 ? clean.slice(i + 1) : clean;
}

export function ref(_storage: unknown, pathOrUrl: string): StorageRef {
  const path = /^https?:\/\//.test(pathOrUrl) ? pathFromUrl(pathOrUrl) : pathOrUrl.replace(/^\/+/, "");
  return { kind: "file", path, name: baseName(path), fullPath: path };
}

export async function uploadBytes(
  storageRef: StorageRef,
  data: File | Blob | ArrayBuffer | Uint8Array
): Promise<{ ref: StorageRef }> {
  const client = convex();
  if (!client) throw new Error("Convex not configured");
  const body =
    data instanceof ArrayBuffer
      ? new Blob([data])
      : data instanceof Uint8Array
        ? new Blob([data.buffer as ArrayBuffer])
        : data;
  const size =
    data instanceof ArrayBuffer
      ? data.byteLength
      : data instanceof Uint8Array
        ? data.byteLength
        : (data as Blob).size;
  const uploadUrl = await client.mutation(api.storage.getUploadUrl, {});
  const res = await fetch(uploadUrl, { method: "POST", body });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const { storageId } = (await res.json()) as { storageId: string };
  const url = await client.query(api.storage.getUrl, { storageId: storageId as never });
  if (!url) throw new Error("Missing storage URL");
  await client.mutation(api.storage.setMapping, {
    path: storageRef.path,
    storageId: storageId as never,
    url,
    size,
  });
  return { ref: storageRef };
}

export async function getDownloadURL(storageRef: StorageRef): Promise<string> {
  const client = convex();
  if (!client) throw new Error("Convex not configured");
  const hit = await client.query(api.storage.getByPath, { path: storageRef.path });
  if (!hit?.url) throw new Error(`No file at ${storageRef.path}`);
  return hit.url;
}

export async function deleteObject(storageRef: StorageRef): Promise<void> {
  const client = convex();
  if (!client) throw new Error("Convex not configured");
  await client.mutation(api.storage.removeByPath, { path: storageRef.path });
}

export interface ListResult {
  items: StorageRef[];
  prefixes: StorageRef[];
}

export async function listAll(dirRef: StorageRef): Promise<ListResult> {
  const client = convex();
  if (!client) return { items: [], prefixes: [] };
  const prefix = dirRef.path.replace(/\/+$/, "");
  const { items, prefixes } = await client.query(api.storage.listChildren, { prefix });
  return {
    items: items.map((it) => ({ kind: "file" as const, path: it.path, name: baseName(it.path), fullPath: it.path })),
    prefixes: prefixes.map((p) => ({ kind: "prefix" as const, path: p.path, name: baseName(p.path), fullPath: p.path })),
  };
}

export async function getMetadata(storageRef: StorageRef): Promise<{ size: number; name: string }> {
  const client = convex();
  if (!client) throw new Error("Convex not configured");
  const hit = await client.query(api.storage.getByPath, { path: storageRef.path });
  if (!hit || typeof hit.size !== "number") throw new Error("Metadata unavailable");
  return { size: hit.size, name: storageRef.name };
}
