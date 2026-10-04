import { NextResponse } from "next/server";
import { convexQuery, convexMutation } from "@/lib/convex";
import { api } from "@/convex/_generated/api";

// GET /api/diag — connectivity self-check for the dashboard <-> Convex bridge.
// Reports only booleans/counts (no PII, no secret values).
export async function GET() {
  const report: Record<string, unknown> = {
    convexUrlSet: !!process.env.NEXT_PUBLIC_CONVEX_URL,
    adminTokenSet: !!process.env.ADMIN_TOKEN,
  };

  // 1. Can we read dashboardDocs?
  try {
    const rows = await convexQuery<{ path: string }[]>(api.docs.listByPrefix, {
      prefix: "Projects",
      limit: 100,
    });
    const ids = (rows ?? [])
      .map((r) => r.path.slice("Projects/".length))
      .filter((rest) => rest && !rest.includes("/"));
    report.tableReadable = true;
    report.projectCount = ids.length;
    report.projectIds = ids.slice(0, 50);
  } catch (e) {
    report.tableReadable = false;
    report.tableError = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
  }

  // 2. Can we write + delete? (cleaned up immediately)
  try {
    const probe = "__diag__/probe";
    await convexMutation(api.docs.setDoc, { path: probe, data: { ok: true } });
    await convexMutation(api.docs.deleteDoc, { path: probe });
    report.tableWritable = true;
  } catch (e) {
    report.tableWritable = false;
    report.writeError = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
  }

  // 3. Can we list storage mappings? (project images/icons need Convex storage)
  try {
    await convexQuery(api.storage.listChildren, { prefix: "" });
    report.storageOk = true;
  } catch (e) {
    report.storageOk = false;
    report.storageError = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
  }

  return NextResponse.json(report);
}
