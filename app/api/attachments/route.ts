import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { api } from "@/convex/_generated/api";
import { convexMutation, convexQuery } from "@/lib/convex";
import { sameOrigin } from "@/lib/session";
import { allowRequest } from "@/lib/rate-limit";
const TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const length = Number(req.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0 || length > 11 * 1024 * 1024)
    return NextResponse.json(
      { error: "Attachment too large or missing size" },
      { status: 413 },
    );
  try {
    if (!(await allowRequest(req, "attachment", 10)))
      return NextResponse.json(
        { error: "Upload limit reached" },
        { status: 429 },
      );
    const file = (await req.formData()).get("file");
    if (
      !(file instanceof File) ||
      file.size > 10 * 1024 * 1024 ||
      !TYPES.has(file.type)
    )
      return NextResponse.json(
        { error: "Unsupported attachment" },
        { status: 400 },
      );
    const uploadUrl = await convexMutation<string>(
      api.storage.getUploadUrl,
      {},
    );
    if (!uploadUrl) throw new Error();
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!response.ok) throw new Error();
    const { storageId } = await response.json();
    const url = await convexQuery<string>(api.storage.getUrl, { storageId });
    if (!url) throw new Error();
    await convexMutation(api.storage.setMapping, {
      path: `attachments/${randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      storageId,
      url,
      size: file.size,
      contentType: file.type,
    });
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json(
      { error: "Attachment upload unavailable" },
      { status: 503 },
    );
  }
}
