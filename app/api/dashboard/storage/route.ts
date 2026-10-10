import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { convexQuery, convexMutation } from "@/lib/convex";
import { isAdminRequest } from "@/lib/admin";
export async function POST(req: Request) {
  if (!isAdminRequest(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null),
    a = b?.args;
  if (!a || typeof a !== "object")
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    let data: unknown;
    switch (b.operation) {
      case "getUploadUrl":
        data = await convexMutation(api.storage.getUploadUrl, {});
        break;
      case "getUrl":
        data = await convexQuery(api.storage.getUrl, {
          storageId: a.storageId,
        });
        break;
      case "getByPath":
        data = await convexQuery(api.storage.getByPath, { path: a.path });
        break;
      case "listChildren":
        data = await convexQuery(api.storage.listChildren, {
          prefix: a.prefix,
        });
        break;
      case "removeByPath":
        data = await convexMutation(api.storage.removeByPath, { path: a.path });
        break;
      case "setMapping":
        data = await convexMutation(api.storage.setMapping, {
          path: a.path,
          storageId: a.storageId,
          url: a.url,
          size: a.size,
          ...(a.contentType ? { contentType: a.contentType } : {}),
        });
        break;
      default:
        return NextResponse.json(
          { error: "Unsupported operation" },
          { status: 400 },
        );
    }
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: "Storage request unavailable" },
      { status: 503 },
    );
  }
}
