import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin";
import { parseJsonBody } from "@/lib/validate";

const TABLES = {
  experience: "profile_experience",
  education: "profile_education",
  skills: "profile_skills",
  stack: "profile_stack",
} as const;

type Section = keyof typeof TABLES;

export async function PATCH(req: Request, ctx: { params: Promise<{ section: string; id: string }> }) {
  const { section: s, id } = await ctx.params;
  if (!(s in TABLES)) return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await parseJsonBody<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const section = s as Section;
  const supabase = supabaseServer();
  const { data: existing } = await supabase.from(TABLES[section]).select("id").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await supabase.from(TABLES[section]).update({ ...body, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ section: string; id: string }> }) {
  const { section: s, id } = await ctx.params;
  if (!(s in TABLES)) return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = supabaseServer();
  const table = TABLES[s as Section];
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
