import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function checkAuth(req: Request): boolean {
  const t = req.headers.get("x-admin-token") || new URL(req.url).searchParams.get("admin");
  return !!process.env.ADMIN_TOKEN && t === process.env.ADMIN_TOKEN;
}
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const supabase = supabaseServer();
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
