import { NextResponse } from "next/server";
import { convexQuery, convexMutation } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { isAdminRequest } from "@/lib/admin";
import { parseJsonBody, trimText } from "@/lib/validate";

const TABLES = {
  experience: "profileExperience",
  education: "profileEducation",
  skills: "profileSkills",
  stack: "profileStack",
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

// Convex rows come back camelCase; the admin form and public pages have
// always consumed snake_case, so map back here.
function mapOut(row: Record<string, unknown> & { _id?: string }): Record<string, unknown> {
  const out: Record<string, unknown> = { id: row._id };
  for (const [key, val] of Object.entries(row)) {
    if (key === "_id" || key === "_creationTime" || key === "createdAt" || key === "updatedAt") continue;
    out[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = val;
  }
  return out;
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
    if (body.start_date !== undefined) row.startDate = toDate(body.start_date);
    if (body.end_date !== undefined) row.endDate = toDate(body.end_date);
    if (body.slug !== undefined) row.slug = cleanStr(body.slug, 120);
    if (body.brand !== undefined) row.brand = cleanStr(body.brand, 20);
    if (body.location !== undefined) row.location = cleanStr(body.location, 200);
    if (body.description !== undefined) row.description = cleanStr(body.description, 2000);
    if (body.link !== undefined) row.link = cleanStr(body.link, 500);
    if (body.sort_order !== undefined && typeof body.sort_order === "number") row.sortOrder = body.sort_order;
    if (body.is_visible !== undefined) row.isVisible = body.is_visible === true;
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
    if (body.start_date !== undefined) row.startDate = toDate(body.start_date);
    if (body.end_date !== undefined) row.endDate = toDate(body.end_date);
    if (body.slug !== undefined) row.slug = cleanStr(body.slug, 120);
    if (body.link !== undefined) row.link = cleanStr(body.link, 500);
    if (body.sort_order !== undefined && typeof body.sort_order === "number") row.sortOrder = body.sort_order;
    if (body.is_visible !== undefined) row.isVisible = body.is_visible === true;
    return row;
  }
  if (section === "skills") {
    const label = cleanRequired(body.label, 120);
    if (isCreate && !label) return { error: "label is required" };
    const row: Record<string, unknown> = {};
    if (body.label !== undefined) row.label = label ?? "";
    if (body.sort_order !== undefined && typeof body.sort_order === "number") row.sortOrder = body.sort_order;
    if (body.is_visible !== undefined) row.isVisible = body.is_visible === true;
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
  if (body.icon_url !== undefined) row.iconUrl = cleanStr(body.icon_url, 500);
  if (body.sort_order !== undefined && typeof body.sort_order === "number") row.sortOrder = body.sort_order;
  if (body.is_visible !== undefined) row.isVisible = body.is_visible === true;
  return row;
}

export async function GET(req: Request, ctx: { params: Promise<{ section: string }> }) {
  const section = getSection(await ctx.params);
  if (!section) return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  const url = new URL(req.url);
  const includeHidden = url.searchParams.get("all") === "1";
  if (includeHidden && !isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await convexQuery<Record<string, unknown> & { _id?: string }[]>(
    includeHidden ? api.profile.listAll : api.profile.listVisible,
    { table: TABLES[section] }
  );
  return NextResponse.json({ items: (rows ?? []).map(mapOut) });
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
    await convexMutation(api.profile.updateOrder, {
      table: TABLES[section],
      items: items
        .filter((it) => it.id && typeof it.sort_order === "number")
        .map((it) => ({ id: it.id!, sortOrder: it.sort_order! })),
    });
    return NextResponse.json({ ok: true });
  }

  const row = buildRow(section, body, true);
  if ("error" in row) return NextResponse.json({ error: row.error }, { status: 400 });
  const id = await convexMutation<string>(api.profile.create, { table: TABLES[section], row });
  return NextResponse.json({ ok: true, item: { id, ...body } });
}
