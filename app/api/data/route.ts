import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { convexQuery, convexMutation } from "@/lib/convex";
import { isAdminRequest } from "@/lib/admin";
import { sameOrigin } from "@/lib/request";
import { isPublicPath, publicDocument } from "@/lib/public-docs";
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = await req.json().catch(() => null),
    a = b?.args,
    op = b?.operation;
  if (!a || typeof a !== "object" || typeof op !== "string")
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const owner = await isAdminRequest(req);
  if (
    !owner &&
    !(op === "getDoc" && typeof a.path === "string" && isPublicPath(a.path)) &&
    !(op === "listCollection" && a.prefix === "Projects")
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    let data: unknown;
    if (op === "getDoc") {
      if (typeof a.path !== "string" || a.path.length > 500) throw new Error();
      const row = await convexQuery<Record<string, unknown>>(api.docs.getDoc, {
        path: a.path,
      });
      data = owner ? row : publicDocument(a.path, row);
    } else if (op === "listCollection") {
      if (typeof a.prefix !== "string" || a.prefix.length > 500)
        throw new Error();
      const rows = await convexQuery<
        { path: string; data: Record<string, unknown> }[]
      >(api.docs.listCollection, { prefix: a.prefix });
      data = owner
        ? rows
        : (rows || []).map((r) => ({
            path: r.path,
            data: publicDocument(r.path, r.data),
          }));
    } else if (op === "setDoc" && owner) {
      if (typeof a.path !== "string" || !a.data || typeof a.data !== "object")
        throw new Error();
      await convexMutation(api.docs.setDoc, { path: a.path, data: a.data });
      data = null;
    } else if (op === "deleteDoc" && owner) {
      if (typeof a.path !== "string") throw new Error();
      await convexMutation(api.docs.deleteDoc, { path: a.path });
      data = null;
    } else if (op === "createLink" && owner) {
      if (!a.name || !a.for || typeof a.name !== "string" || typeof a.for !== "string")
        throw new Error();
      data = await convexMutation(api.trails.createLink, {
        name: a.name,
        for: a.for,
        notify: a.notify,
        autoCv: a.autoCv,
      });
    } else if (op === "updateLink" && owner) {
      if (typeof a.docId !== "string" || !a.patch || typeof a.patch !== "object")
        throw new Error();
      data = await convexMutation(api.trails.updateLink, {
        docId: a.docId,
        patch: a.patch,
      });
    } else if (op === "deleteLink" && owner) {
      if (typeof a.docId !== "string") throw new Error();
      data = await convexMutation(api.trails.deleteLink, { docId: a.docId });
    } else if (op === "deleteSession" && owner) {
      if (typeof a.sessionId !== "string") throw new Error();
      data = await convexMutation(api.trails.deleteSession, {
        sessionId: a.sessionId,
      });
    } else if (op === "forgetLinkVisits" && owner) {
      if (typeof a.docId !== "string") throw new Error();
      data = await convexMutation(api.trails.forgetLinkVisits, {
        docId: a.docId,
      });
    } else if (op === "trailsDiagnostics" && owner) {
      data = await convexQuery(api.trails.diagnostics, {});
    } else
      return NextResponse.json(
        { error: "Unsupported operation" },
        { status: 400 },
      );
    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Data request unavailable" },
      { status: 503 },
    );
  }
}
