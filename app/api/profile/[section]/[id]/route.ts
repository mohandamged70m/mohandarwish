import { NextResponse } from "next/server";
import { convexMutation } from "@/lib/convex";
import { api } from "@/convex/_generated/api";
import { isAdminRequest } from "@/lib/admin";
import { parseJsonBody } from "@/lib/validate";

const TABLES = {
  experience: "profileExperience",
  education: "profileEducation",
  skills: "profileSkills",
  stack: "profileStack",
} as const;

type Section = keyof typeof TABLES;

function snakePatchToConvex(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(body)) {
    switch (key) {
      case "start_date":
        out.startDate = val;
        break;
      case "end_date":
        out.endDate = val;
        break;
      case "icon_url":
        out.iconUrl = val;
        break;
      case "sort_order":
        out.sortOrder = val;
        break;
      case "is_visible":
        out.isVisible = val;
        break;
      default:
        out[key] = val;
    }
  }
  return out;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ section: string; id: string }> }) {
  const { section: s, id } = await ctx.params;
  if (!(s in TABLES)) return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await parseJsonBody<Record<string, unknown>>(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const section = s as Section;
  await convexMutation(api.profile.updateFields, {
    table: TABLES[section],
    id,
    patch: snakePatchToConvex(body),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ section: string; id: string }> }) {
  const { section: s, id } = await ctx.params;
  if (!(s in TABLES)) return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await convexMutation(api.profile.remove, { table: TABLES[s as Section], id });
  return NextResponse.json({ ok: true });
}
