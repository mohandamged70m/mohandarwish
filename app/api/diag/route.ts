import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// GET /api/diag — connectivity self-check for the dashboard <-> Supabase bridge.
// Reports only booleans/counts (no PII, no secret values). Used to answer
// "dashboard saves don't stick" without opening Supabase Studio.
export async function GET() {
  const report: Record<string, unknown> = {
    supabaseUrlSet: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKeySet: !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    adminTokenSet: !!process.env.ADMIN_TOKEN,
  };

  let supabase;
  try {
    supabase = supabaseServer();
  } catch (e) {
    report.fatal = e instanceof Error ? e.message : String(e);
    return NextResponse.json(report, { status: 500 });
  }

  // 1. Can we read dashboard_docs? (missing table = schema never run)
  try {
    const { data, error } = await supabase
      .from("dashboard_docs")
      .select("path")
      .like("path", "Projects/%")
      .limit(100);
    if (error) throw error;
    const ids = (data ?? [])
      .map((r) => (r as { path: string }).path.slice("Projects/".length))
      .filter((rest) => rest && !rest.includes("/"));
    report.tableReadable = true;
    report.projectCount = ids.length;
    report.projectIds = ids.slice(0, 50);
  } catch (e) {
    report.tableReadable = false;
    report.tableError = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
  }

  // 2. Can we write + delete? (RLS probe, cleaned up immediately)
  try {
    const probe = "__diag__/probe";
    const { error: wErr } = await supabase
      .from("dashboard_docs")
      .upsert({ path: probe, data: { ok: true }, updated_at: new Date().toISOString() }, { onConflict: "path" });
    if (wErr) throw wErr;
    const { error: dErr } = await supabase.from("dashboard_docs").delete().eq("path", probe);
    if (dErr) throw dErr;
    report.tableWritable = true;
  } catch (e) {
    report.tableWritable = false;
    report.writeError = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
  }

  // 3. Does the `dash` storage bucket exist? (project images/icons need it)
  try {
    const { error } = await supabase.storage.from("dash").list(undefined, { limit: 1 });
    if (error) throw error;
    report.storageBucketOk = true;
  } catch (e) {
    report.storageBucketOk = false;
    report.storageError = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
  }

  return NextResponse.json(report);
}
