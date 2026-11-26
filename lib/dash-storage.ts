// Convex storage shim, Firebase-storage compatible surface.
//
// Supports the exact surface dashboard/ uses:
//   getStorage(app?) / ref(storage, path|url) / uploadBytes / getDownloadURL
//   listAll / deleteObject / getMetadata
// Paths are preserved verbatim via the storageMap table (convex/storage.ts);
// files live in Convex storage and are served by the recorded URL.

import { storageCall } from "./dash-transport";

const BUCKET = "firebase"; // legacy app handle shape only

/** Firebase-compatible name used by the ported dashboard tabs. */
export type StorageReference = StorageRef;

export interface StorageRef {
  kind: "file" | "prefix";
  path: string;
  name: string;
  fullPath: string;
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

const urlPaths = new Map<string, string>();
const cleanUrl = (url: string) => url.split("?")[0];

/** Remember a logical path for a Convex/Firebase download URL. */
export function rememberUrlPath(url: string, path: string): void {
  if (url && path) urlPaths.set(cleanUrl(url), path);
}

/** A path only when it is known — safe for cleanup decisions. */
export function knownPathFromUrl(url: string): string | null {
  return urlPaths.get(cleanUrl(url)) ?? null;
}

/** Preload URL→path mappings from the server before a save needs them. */
export async function rememberStoragePaths(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length) return;
  const rows = await storageCall<{ url: string; path: string }[]>("resolvePaths", { urls: unique });
  for (const row of rows) rememberUrlPath(row.url, row.path);
}

function pathFromUrl(url: string): string {
  const known = knownPathFromUrl(url);
  if (known) return known;
  // Unknown Convex URL: last segment is the storage id, not the logical path.
  // Callers that make destructive decisions must use knownPathFromUrl instead.
  const clean = cleanUrl(url);
  const i = clean.lastIndexOf("/");
  return i >= 0 ? clean.slice(i + 1) : clean;
}

export function ref(_storage: unknown, pathOrUrl: string): StorageRef {
  const path = /^https?:\/\//.test(pathOrUrl)
    ? pathFromUrl(pathOrUrl)
    : pathOrUrl.replace(/^\/+/, "");
  return { kind: "file", path, name: baseName(path), fullPath: path };
}

export async function uploadBytes(
  storageRef: StorageRef,
  data: File | Blob | ArrayBuffer | Uint8Array,
  _metadata?: { contentType?: string; cacheControl?: string },
): Promise<{ ref: StorageRef }> {
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
  const uploadUrl = await storageCall<string>("getUploadUrl", {});
  const res = await fetch(uploadUrl, { method: "POST", body });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const { storageId } = (await res.json()) as { storageId: string };
  const url = await storageCall<string>("getUrl", {
    storageId: storageId as never,
  });
  if (!url) throw new Error("Missing storage URL");
  rememberUrlPath(url, storageRef.path);
  await storageCall("setMapping", {
    path: storageRef.path,
    storageId: storageId as never,
    url,
    size,
  });
  return { ref: storageRef };
}

export async function getDownloadURL(storageRef: StorageRef): Promise<string> {
  const hit = await storageCall<{ url: string; size: number }>("getByPath", {
    path: storageRef.path,
  });
  if (!hit?.url) throw new Error(`No file at ${storageRef.path}`);
  rememberUrlPath(hit.url, storageRef.path);
  return hit.url;
}

export async function deleteObject(storageRef: StorageRef): Promise<void> {
  await storageCall("removeByPath", { path: storageRef.path });
}

export interface ListResult {
  items: StorageRef[];
  prefixes: StorageRef[];
}

export async function listAll(dirRef: StorageRef): Promise<ListResult> {
  const prefix = dirRef.path.replace(/\/+$/, "");
  const { items, prefixes } = await storageCall<{
    items: { path: string }[];
    prefixes: { path: string }[];
  }>("listChildren", { prefix });
  return {
    items: items.map((it) => ({
      kind: "file" as const,
      path: it.path,
      name: baseName(it.path),
      fullPath: it.path,
    })),
    prefixes: prefixes.map((p) => ({
      kind: "prefix" as const,
      path: p.path,
      name: baseName(p.path),
      fullPath: p.path,
    })),
  };
}

export async function getMetadata(
  storageRef: StorageRef,
): Promise<{ size: number; name: string }> {
  const hit = await storageCall<{ url: string; size: number }>("getByPath", {
    path: storageRef.path,
  });
  if (!hit || typeof hit.size !== "number")
    throw new Error("Metadata unavailable");
  return { size: hit.size, name: storageRef.name };
}
