import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { convexQuery } from "@/lib/convex";
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  if (!/^[a-zA-Z0-9_-]{4,80}$/.test(code))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const rows = await convexQuery<{ data: Record<string, unknown> }[]>(
      api.docs.listCollection,
      { prefix: "Analytics/Links/Items" },
    );
    const link = rows?.find((r) => r.data.Code === code)?.data;
    if (!link)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      { Name: link.Name, For: link.For, Tailor: link.Tailor },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}
