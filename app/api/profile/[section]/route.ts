import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin";
import { parseJsonBody, trimText } from "@/lib/validate";

const TABLES = {
  experience: "profile_experience",
  education: "profile_education",
  skills: "profile_skills",
  stack: "profile_stack",
} as const;

type Section = keyof typeof TABLES;

function getSection(params: { section?: string }): Section | null {
  const s = params.section ?? "";
  return s in TABLES ? (s as Section) : null;
}

function cleanStr(v: unknown, max = 500): string | null {
  const t = trimText(v, max);
  return t ? t : null;
}

function cleanRequired(v: unknown, max = 500): string | null {
  const t = trimText(v, max);
  return t || null;
}

function toDate(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildRow(section: Section, body: Record<string, unknown>, isCreate: boolean): Record<string, unknown> | { error: string } {
  if (section === "experience") {
    const company = cleanRequired(body.company, 200);
    const role = cleanRequired(body.role, 300);
    const period = cleanRequired(body.period, 120);
    if (isCreate && (!company || !role || !period)) return { error: "company, role, period are required" };
    const row: Record<string, unknown> = {};
    if (body.company !== undefined) row.company = company ?? "";
    if (body.role !== undefined) row.role = role ?? "";
    if (body.period !== undefined) row.period = period ?? "";
    if (body.start_date !== undefined) row.start_date = toDate(body.start_date);
    if (body.end_date !== undefined) row.end_date = toDate(body.end_date);
    if (body.slug !== undefined) row.slug = cleanStr(body.slug, 120);
    if (body.brand !== undefined) row.brand = cleanStr(body.brand, 20);
    if (body.location !== undefined) row.location = cleanStr(body.location, 200);
    if (body.description !== undefined) row.description = cleanStr(body.description, 2000);
    if (body.link !== undefined) row.link = cleanStr(body.link, 500);
    if (body.sort_order !== undefined && typeof body.sort_order === "number") row.sort_order = body.sort_order;
    if (body.is_visible !== undefined) row.is_visible = body.is_visible === true;
    return row;
  }
  if (section === "education") {
    const school = cleanRequired(body.school, 200);
    const degree = cleanRequired(body.degree, 300);
    const period = cleanRequired(body.period, 120);
    if (isCreate && (!school || !degree || !period)) return { error: "school, degree, period are required" };
    const row: Record<string, unknown> = {};
    if (body.school !== undefined) row.school = school ?? "";
    if (body.degree !== undefined) row.degree = degree ?? "";
    if (body.period !== undefined) row.period = period ?? "";
    if (body.start_date !== undefined) row.start_date = toDate(body.start_date);
    if (body.end_date !== undefined) row.end_date = toDate(body.end_date);
    if (body.slug !== undefined) row.slug = cleanStr(body.slug, 120);
    if (body.link !== undefined) row.link = cleanStr(body.link, 500);
    if (body.sort_order !== undefined && typeof body.sort_order === "number") row.sort_order = body.sort_order;
    if (body.is_visible !== undefined) row.is_visible = body.is_visible === true;
    return row;
  }
  if (section === "skills") {
    const label = cleanRequired(body.label, 120);
    if (isCreate && !label) return { error: "label is required" };
    const row: Record<string, unknown> = {};
    if (body.label !== undefined) row.label = label ?? "";
    if (body.sort_order !== undefined && typeof body.sort_order === "number") row.sort_order = body.sort_order;
    if (body.is_visible !== undefined) row.is_visible = body.is_visible === true;
    return row;
  }
  const label = cleanRequired(body.label, 120);
  const slug = cleanRequired(body.slug, 120);
  if (isCreate && (!label || !slug)) return { error: "label, slug are required" };
  const row: Record<string, unknown> = {};
  if (body.label !== undefined) row.label = label ?? "";
  if (body.slug !== undefined) row.slug = slug ?? "";
  if (body.bg !== undefined) row.bg = cleanStr(body.bg, 20) ?? "#1f1f1f";
  if (body.fg !== undefined) row.fg = cleanStr(body.fg, 20) ?? "#ffffff";
  if (body.icon_url !== undefined) row.icon_url = cleanStr(body.icon_url, 500);
  if (body.sort_order !== undefined && typeof body.sort_order === "number") row.sort_order = body.sort_order;
  if (body.is_visible !== undefined) row.is_visible = body.is_visible === true;
  return row;
}

export async function GET(req: Request, ctx: { params: Promise<{ section: string }> }) {
  const section = getSection(await ctx.params);
  if (!section) return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  const supabase = supabaseServer();
  const url = new URL(req.url);
  const includeHidden = url.searchParams.get("all") === "1";
  if (includeHidden && !isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let q = supabase.from(TABLES[section]).select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (!includeHidden) q = q.eq("is_visible", true);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request, ctx: { params: Promise<{ section: string }> }) {
  const section = getSection(await ctx.params);
  if (!section) return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await parseJsonBody<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Bulk reorder: { items: [{ id, sort_order }] }
  if (Array.isArray((body as Record<string, unknown>).items)) {
    const items = (body as { items: { id?: string; sort_order?: number }[] }).items;
    const supabase = supabaseServer();
    for (const it of items) {
      if (!it.id || typeof it.sort_order !== "number") continue;
      await supabase.from(TABLES[section]).update({ sort_order: it.sort_order }).eq("id", it.id);
    }
    return NextResponse.json({ ok: true });
  }

  const row = buildRow(section, body, true);
  if ("error" in row) return NextResponse.json({ error: row.error }, { status: 400 });
  const supabase = supabaseServer();
  const { data, error } = await supabase.from(TABLES[section]).insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}
