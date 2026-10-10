import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { convexMutation, convexQuery } from "@/lib/convex";
import { isAdminRequest } from "@/lib/admin";
export async function GET(req: Request) {
  if (!isAdminRequest(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const projectId = new URL(req.url).searchParams.get("projectId");
    const data = projectId
      ? await convexQuery(api.workspace.notes, { projectId })
      : await convexQuery(api.workspace.list, {});
    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Workspace unavailable" },
      { status: 503 },
    );
  }
}
export async function POST(req: Request) {
  if (!isAdminRequest(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b?.args || typeof b.args !== "object")
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    let data: unknown;
    switch (b.operation) {
      case "saveLead":
        data = await convexMutation(api.workspace.saveLead, b.args);
        break;
      case "saveProject":
        data = await convexMutation(api.workspace.saveProject, b.args);
        break;
      case "saveMilestone":
        data = await convexMutation(api.workspace.saveMilestone, b.args);
        break;
      case "addNote":
        data = await convexMutation(api.workspace.addNote, b.args);
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
      { error: "Could not save. Check the fields and try again." },
      { status: 400 },
    );
  }
}
