import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/dash-admin";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const supabase = supabaseServer();
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
