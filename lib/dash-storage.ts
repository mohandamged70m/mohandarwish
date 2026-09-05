// Firebase-storage compatible shim over Supabase Storage (bucket: dash).
//
// Supports the exact surface dashboard/ uses:
//   getStorage(app?) / ref(storage, path|url) / uploadBytes / getDownloadURL
//   listAll / deleteObject / getMetadata
// Paths are used verbatim as bucket keys (src/projects-imgs/..., treasury/...).

import { supabase } from "@/lib/supabase/client";

const BUCKET = "dash";

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

function pathFromUrl(url: string): string {
  // Supabase public URL: .../storage/v1/object/public/dash/<path>
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx >= 0) return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
  throw new Error(`Cannot resolve storage path from URL: ${url.slice(0, 80)}`);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ref(_storage: unknown, pathOrUrl: string): StorageRef {
  const path = /^https?:\/\//.test(pathOrUrl) ? pathFromUrl(pathOrUrl) : pathOrUrl.replace(/^\/+/, "");
  return { kind: "file", path, name: baseName(path), fullPath: path };
}

export async function uploadBytes(
  storageRef: StorageRef,
  data: File | Blob | ArrayBuffer | Uint8Array
): Promise<{ ref: StorageRef }> {
  const body =
    data instanceof ArrayBuffer
      ? new Blob([data])
      : data instanceof Uint8Array
        ? new Blob([data.buffer as ArrayBuffer])
        : data;
  const { error } = await supabase.storage.from(BUCKET).upload(storageRef.path, body, { upsert: true });
  if (error) throw error;
  return { ref: storageRef };
}

export async function getDownloadURL(storageRef: StorageRef): Promise<string> {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storageRef.path);
  if (!data?.publicUrl) throw new Error("Could not build public URL");
  return data.publicUrl;
}

export async function deleteObject(storageRef: StorageRef): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([storageRef.path]);
  if (error) throw error;
}

export interface ListResult {
  items: StorageRef[];
  prefixes: StorageRef[];
}

export async function listAll(dirRef: StorageRef): Promise<ListResult> {
  const prefix = dirRef.path.replace(/\/+$/, "");
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix || undefined, { limit: 1000 });
  if (error) throw error;
  const items: StorageRef[] = [];
  const prefixes: StorageRef[] = [];
  for (const entry of data ?? []) {
    const name = (entry as { name: string }).name;
    if (!name) continue;
    const full = prefix ? `${prefix}/${name}` : name;
    // Supabase marks folders with metadata null... id null indicates folder.
    const isFolder = (entry as { id?: string | null }).id == null && !(entry as { metadata?: unknown }).metadata;
    const r: StorageRef = {
      kind: isFolder ? "prefix" : "file",
      path: full,
      name,
      fullPath: full,
    };
    (isFolder ? prefixes : items).push(r);
  }
  return { items, prefixes };
}

export async function getMetadata(storageRef: StorageRef): Promise<{ size: number; name: string }> {
  const parent = storageRef.path.includes("/") ? storageRef.path.slice(0, storageRef.path.lastIndexOf("/")) : "";
  const { data, error } = await supabase.storage.from(BUCKET).list(parent || undefined, { limit: 1000 });
  if (error) throw error;
  const hit = (data ?? []).find((e) => (e as { name: string }).name === storageRef.name) as
    | { metadata?: { size?: number } }
    | undefined;
  const size = hit?.metadata?.size;
  if (typeof size !== "number") throw new Error("Metadata unavailable");
  return { size, name: storageRef.name };
}
